import express from 'express';
import { auth, db, DbExecutionContext, runWithDbContext, runWithSystemDbContext } from '../config.ts';

export function buildDbContextForUser(user: AuthenticatedRequestUser): DbExecutionContext {
  const roleUpper = String(user?.role || '').toUpperCase();
  if (roleUpper === 'DEV_OWNER' || roleUpper === 'SUPER_ADMIN') {
    return { tenantId: null, bypassRls: true, reason: `AUTH_${roleUpper}` };
  }
  return {
    tenantId: user?.tenantId || 'tenant-1',
    bypassRls: false,
    reason: `AUTH_${roleUpper || 'USER'}`,
  };
}

export interface AuthenticatedRequestUser {
  uid: string;
  email: string;
  email_verified?: boolean;
  name: string;
  role: string;
  tenantId: string;
  storeId?: string;
  allowedStoreIds?: string[];
  permissions?: string[];
  blockedApps?: string[];
  authProvider?: string;
  deviceDocId?: string;
  deviceId?: string;
  terminalId?: string;
}

const APP_ID_ALLOWED_ROLES: Record<string, Set<string>> = {
  marketplace: new Set(['CUSTOMER', 'CONSUMER']),
  'store-os': new Set([
    'STORE_OWNER',
    'STORE_MANAGER',
    'REGIONAL_MANAGER',
    'CASHIER',
    'KITCHEN_STAFF',
  ]),
  waiter: new Set(['WAITER', 'STORE_OWNER', 'STORE_MANAGER', 'REGIONAL_MANAGER']),
  driver: new Set(['COURIER', 'DRIVER']),
  hq: new Set(['DEV_OWNER', 'SUPER_ADMIN']),
  'server-core': new Set(['DEV_OWNER']),
};

export function isRoleAllowedForAppId(role: string | undefined, appId: string | undefined): boolean {
  const normalizedApp = String(appId || 'unified-portal').trim().toLowerCase();
  if (!normalizedApp || normalizedApp === 'unified-portal' || normalizedApp === 'portal') {
    return true;
  }
  const allowed = APP_ID_ALLOWED_ROLES[normalizedApp];
  if (!allowed) return true;
  return allowed.has(String(role || '').toUpperCase());
}

export function isProductBlockedForUser(blockedApps: unknown, appId: string | undefined): boolean {
  const normalizedApp = String(appId || '').trim().toLowerCase();
  if (!normalizedApp || normalizedApp === 'unified-portal' || normalizedApp === 'portal') {
    return false;
  }
  if (!Array.isArray(blockedApps) || blockedApps.length === 0) return false;
  return blockedApps.some((b) => String(b).trim().toLowerCase() === normalizedApp);
}

export interface OptionalUserResolution {
  user: AuthenticatedRequestUser | null;
  tokenProvided: boolean;
  error?: string;
}

export const SESSION_COOKIE_NAME = '3ccorp_session';

export function extractSessionToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice('Bearer '.length).trim();
    if (bearer) return bearer;
  }
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader === 'string' && cookieHeader.includes(`${SESSION_COOKIE_NAME}=`)) {
    const pairs = cookieHeader.split(';');
    for (const pair of pairs) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx <= 0) continue;
      const k = pair.slice(0, eqIdx).trim();
      if (k === SESSION_COOKIE_NAME) {
        const rawVal = pair.slice(eqIdx + 1).trim();
        try {
          const decoded = decodeURIComponent(rawVal);
          if (decoded) return decoded;
        } catch {
          if (rawVal) return rawVal;
        }
      }
    }
  }
  return null;
}

const AUTH_DOC_CACHE_TTL_MS = 5_000;
const AUTH_DOC_CACHE_MAX_ENTRIES = 2_000;
const authDocCache = new Map<string, { rev: number; expiresAt: number; exists: boolean; data: any }>();

async function getCachedAuthDoc(
  collection: 'users' | 'tenants',
  docId: string
): Promise<{ exists: boolean; data: any }> {
  const rev = db.getRevisions().collections[collection] || 1;
  const key = `${collection}:${docId}`;
  const now = Date.now();
  const hit = authDocCache.get(key);
  if (hit && hit.rev === rev && hit.expiresAt > now) {
    return { exists: hit.exists, data: hit.data };
  }

  const snap = await db.collection(collection).doc(docId).get();
  const entry = {
    rev,
    expiresAt: now + AUTH_DOC_CACHE_TTL_MS,
    exists: snap.exists,
    data: snap.exists ? snap.data() : null,
  };
  if (authDocCache.size >= AUTH_DOC_CACHE_MAX_ENTRIES && !authDocCache.has(key)) {
    const oldest = authDocCache.keys().next().value;
    if (oldest) authDocCache.delete(oldest);
  }
  authDocCache.set(key, entry);
  return { exists: entry.exists, data: entry.data };
}

async function checkTenantActive(
  tenantIdRaw: unknown
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const userTenant = typeof tenantIdRaw === 'string' ? tenantIdRaw.trim() : '';
  if (!userTenant) {
    return {
      ok: false,
      status: 403,
      error: 'Acesso bloqueado: Usuário corporativo sem empresa/tenant válido vinculado.'
    };
  }
  try {
    const tenantSnap = await getCachedAuthDoc('tenants', userTenant);
    if (!tenantSnap.exists) {
      return {
        ok: false,
        status: 403,
        error: 'Acesso bloqueado: Empresa/Tenant vinculado não existe ou foi removido.'
      };
    }
    const tenantStatus = String(tenantSnap.data?.status || 'ACTIVE').toUpperCase();
    if (tenantStatus === 'SUSPENDED') {
      return {
        ok: false,
        status: 403,
        error: 'Acesso bloqueado: Empresa suspensa pelo HQ Central.'
      };
    }
    if (tenantStatus !== 'ACTIVE') {
      return {
        ok: false,
        status: 403,
        error: `Acesso bloqueado: Empresa em estado inválido (${tenantStatus}).`
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 503, error: 'Serviço de autenticação indisponível: falha ao verificar status da empresa.' };
  }
}

export async function resolveWaiterDevicePrincipal(
  decodedToken: any
): Promise<{ ok: true; user: AuthenticatedRequestUser } | { ok: false; status: number; error: string }> {
  if (String(decodedToken?.role || '').toUpperCase() !== 'WAITER' || !decodedToken?.storeId) {
    return { ok: false, status: 403, error: 'Acesso negado: Sessão de terminal inválida ou sem loja vinculada.' };
  }

  const storeId = String(decodedToken.storeId);
  const storeSnap = await db.collection('stores').doc(storeId).get();
  if (!storeSnap.exists || storeSnap.data()?._deleted) {
    return { ok: false, status: 401, error: 'Terminal revogado: loja vinculada não encontrada.' };
  }
  const storeData = storeSnap.data() || {};
  if (String(storeData.status || 'ACTIVE').toUpperCase() === 'SUSPENDED') {
    return { ok: false, status: 403, error: 'Acesso bloqueado: estabelecimento suspenso.' };
  }

  const tenantId = String(storeData.tenantId || decodedToken.tenantId || '');
  if (!tenantId || (decodedToken.tenantId && decodedToken.tenantId !== tenantId)) {
    return { ok: false, status: 403, error: 'Acesso negado: divergência de empresa/tenant do terminal.' };
  }

  const tenantCheck = await checkTenantActive(tenantId);
  if (!tenantCheck.ok) {
    return tenantCheck;
  }

  if (
    typeof storeData.waiterPairingRevokedAtSec === 'number' &&
    typeof decodedToken.iat === 'number' &&
    decodedToken.iat < storeData.waiterPairingRevokedAtSec
  ) {
    return { ok: false, status: 401, error: 'Não autorizado: Sessão de terminal do salão revogada pela loja.' };
  }

  if (decodedToken.deviceDocId) {
    const devSnap = await db.collection('device_licenses').doc(String(decodedToken.deviceDocId)).get();
    if (!devSnap.exists) {
      return { ok: false, status: 401, error: 'Dispositivo/PDQ não encontrado ou licença removida.' };
    }
    const dev = devSnap.data() || {};
    if (dev._deleted || !dev.paired || dev.status === 'REVOKED') {
      return { ok: false, status: 401, error: 'Sessão do dispositivo/PDQ revogada ou despareada pela loja.' };
    }
    if (dev.storeId !== storeId || dev.tenantId !== tenantId) {
      return { ok: false, status: 403, error: 'Acesso negado: dispositivo pertence a outra loja.' };
    }
    const expectedVersion = Number(dev.terminalTokenVersion) || 1;
    const tokenVersion = Number(decodedToken.tokenVersion) || 1;
    if (tokenVersion !== expectedVersion) {
      return { ok: false, status: 401, error: 'Sessão do PDQ revogada. Gere um novo código de pareamento na loja.' };
    }

    return {
      ok: true,
      user: {
        uid: decodedToken.uid,
        email: '',
        email_verified: false,
        name: decodedToken.name || dev.name || 'Terminal PDQ Salão',
        role: 'WAITER',
        tenantId,
        storeId,
        allowedStoreIds: [storeId],
        authProvider: 'STORE_DEVICE_PDQ',
        deviceDocId: dev.id,
        deviceId: dev.deviceId || dev.id,
      },
    };
  }

  if (decodedToken.terminalId) {
    const termSnap = await db.collection('waiter_terminals').doc(String(decodedToken.terminalId)).get();
    if (!termSnap.exists) {
      return { ok: false, status: 401, error: 'Terminal de garçom não encontrado ou desconectado.' };
    }
    const term = termSnap.data() || {};
    if (term.status !== 'ACTIVE') {
      return { ok: false, status: 401, error: 'Sessão de terminal do garçom encerrada.' };
    }
    if (term.storeId !== storeId || term.tenantId !== tenantId) {
      return { ok: false, status: 403, error: 'Acesso negado: terminal pertence a outra loja.' };
    }
    const expectedVersion = Number(term.tokenVersion) || 1;
    const tokenVersion = Number(decodedToken.tokenVersion) || 1;
    if (tokenVersion !== expectedVersion) {
      return { ok: false, status: 401, error: 'Sessão de terminal revogada pela loja.' };
    }

    return {
      ok: true,
      user: {
        uid: decodedToken.uid,
        email: '',
        email_verified: false,
        name: decodedToken.name || term.operatorName || 'Terminal Salão',
        role: 'WAITER',
        tenantId,
        storeId,
        allowedStoreIds: [storeId],
        authProvider: 'WAITER_PIN_TERMINAL',
        terminalId: term.id,
      },
    };
  }

  return { ok: false, status: 401, error: 'Credencial de terminal sem vínculo válido.' };
}

async function checkSessionRevocationAndTenant(
  decodedToken: any,
  userData: any
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (
    typeof userData?.tokenVersion === 'number' &&
    typeof decodedToken?.tokenVersion === 'number' &&
    decodedToken.tokenVersion !== userData.tokenVersion
  ) {
    return { ok: false, status: 401, error: 'Não autorizado: Sessão revogada pelo HQ. Faça login novamente.' };
  }

  if (
    typeof userData?.tokenRevokedAtSec === 'number' &&
    typeof decodedToken?.iat === 'number' &&
    decodedToken.iat < userData.tokenRevokedAtSec
  ) {
    return { ok: false, status: 401, error: 'Não autorizado: Sessão revogada pelo HQ. Faça login novamente.' };
  }

  const userRole = String(userData?.role || '').toUpperCase();
  const isPlatformOrConsumer = userRole === 'DEV_OWNER' || userRole === 'CUSTOMER' || userRole === 'CONSUMER';
  if (!isPlatformOrConsumer) {
    return checkTenantActive(userData?.tenantId);
  }

  return { ok: true };
}

/**
 * Fail-closed verification of Bearer token + persistent DB user record.
 * Used on public/mixed routes so invalid or arbitrary "Bearer" headers NEVER bypass sanitization.
 */
export async function resolveOptionalUser(req: express.Request): Promise<OptionalUserResolution> {
  const token = extractSessionToken(req);
  if (!token) {
    return { user: null, tokenProvided: false };
  }

  return await runWithSystemDbContext('AUTH_RESOLVE_OPTIONAL', async () => {
    try {
      const decodedToken = await auth.verifyIdToken(token);
      if (!decodedToken?.uid) {
        return { user: null, tokenProvided: true, error: 'Token sem identificador de usuário.' };
      }

      if (decodedToken.typ === 'waiter_device') {
        const deviceResult = await resolveWaiterDevicePrincipal(decodedToken);
        if (!deviceResult.ok) {
          return { user: null, tokenProvided: true, error: deviceResult.error };
        }
        return { tokenProvided: true, user: deviceResult.user };
      }

      const userDoc = await getCachedAuthDoc('users', decodedToken.uid);
      if (!userDoc.exists) {
        return { user: null, tokenProvided: true, error: 'Usuário não encontrado na base de dados.' };
      }

      const userData = userDoc.data;
      if (!userData || userData.status === 'DISABLED' || userData.status === 'PENDING_ACTIVATION' || userData.disabled === true) {
        return { user: null, tokenProvided: true, error: 'Conta de usuário desativada ou pendente de ativação.' };
      }

      if (!userData.role) {
        return { user: null, tokenProvided: true, error: 'Perfil de acesso não atribuído.' };
      }

      const sessionCheck = await checkSessionRevocationAndTenant(decodedToken, userData);
      if (!sessionCheck.ok) {
        return { user: null, tokenProvided: true, error: sessionCheck.error };
      }

      return {
        tokenProvided: true,
        user: {
          uid: decodedToken.uid,
          email: userData.email || decodedToken.email || '',
          email_verified: Boolean(userData.emailVerified ?? decodedToken.email_verified),
          name: userData.name || decodedToken.name || 'Usuário',
          role: userData.role,
          tenantId: userData.tenantId || 'tenant-1',
          storeId: userData.storeId || undefined,
          allowedStoreIds: Array.isArray(userData.allowedStoreIds) ? userData.allowedStoreIds : undefined,
          permissions: Array.isArray(userData.permissions) ? userData.permissions : [],
          blockedApps: Array.isArray(userData.blockedApps) ? userData.blockedApps : [],
        }
      };
    } catch (err: any) {
      return {
        user: null,
        tokenProvided: true,
        error: err?.message || 'Falha ao validar sessão.'
      };
    }
  });
}

export const verifyAutonomousToken = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = extractSessionToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Não autorizado: Credencial de sessão (Bearer ou cookie HttpOnly) ausente.' });
  }

  let decodedToken: any;
  try {
    decodedToken = await auth.verifyIdToken(token);
  } catch (err: any) {
    console.warn('[Security] Falha na validação do token de autenticação:', err?.message);
    return res.status(401).json({ error: 'Não autorizado: Token de autenticação inválido, revogado ou expirado.' });
  }

  if (!decodedToken?.uid) {
    return res.status(401).json({ error: 'Não autorizado: Token sem identificador de usuário.' });
  }

  if (decodedToken.typ === 'waiter_device') {
    let deviceResult: Awaited<ReturnType<typeof resolveWaiterDevicePrincipal>>;
    try {
      deviceResult = await runWithSystemDbContext('AUTH_VERIFY_WAITER_DEVICE', () =>
        resolveWaiterDevicePrincipal(decodedToken)
      );
    } catch (err: any) {
      console.error('[Auth Middleware] Falha ao validar dispositivo/terminal de garçom:', err?.message);
      return res.status(503).json({ error: 'Serviço de autenticação indisponível ao validar terminal.' });
    }
    if (!deviceResult.ok) {
      return res.status(deviceResult.status).json({ error: deviceResult.error });
    }
    (req as any).user = deviceResult.user;
    return runWithDbContext(buildDbContextForUser(deviceResult.user), () => next());
  }

  // P0-02 Fail-Closed: Database lookup failure or missing user record MUST reject the request!
  let authResolution:
    | { ok: true; user: AuthenticatedRequestUser }
    | { ok: false; status: number; error: string };
  try {
    authResolution = await runWithSystemDbContext('AUTH_VERIFY_HUMAN_SESSION', async () => {
      const userDoc = await getCachedAuthDoc('users', decodedToken.uid);
      if (!userDoc.exists) {
        return { ok: false as const, status: 401, error: 'Não autorizado: Usuário não encontrado ou sessão revogada.' };
      }

      const userData = userDoc.data;
      if (!userData || userData.status === 'DISABLED' || userData.status === 'PENDING_ACTIVATION' || userData.disabled === true) {
        return { ok: false as const, status: 403, error: 'Acesso negado: Conta de usuário desativada ou pendente de ativação.' };
      }

      if (!userData.role) {
        return { ok: false as const, status: 403, error: 'Acesso negado: Usuário sem papel RBAC válido atribuído.' };
      }

      const sessionCheck = await checkSessionRevocationAndTenant(decodedToken, userData);
      if (!sessionCheck.ok) {
        return sessionCheck;
      }

      return {
        ok: true as const,
        user: {
          uid: decodedToken.uid,
          email: userData.email || decodedToken.email || '',
          email_verified: Boolean(userData.emailVerified ?? decodedToken.email_verified),
          name: userData.name || decodedToken.name || 'Usuário',
          role: userData.role,
          tenantId: userData.tenantId || 'tenant-1',
          storeId: userData.storeId || undefined,
          allowedStoreIds: Array.isArray(userData.allowedStoreIds) ? userData.allowedStoreIds : undefined,
          permissions: Array.isArray(userData.permissions) ? userData.permissions : [],
          blockedApps: Array.isArray(userData.blockedApps) ? userData.blockedApps : [],
        },
      };
    });
  } catch (dbErr: any) {
    console.error('[Auth Middleware] Falha crítica ao consultar usuário no banco:', dbErr?.message);
    return res.status(503).json({ error: 'Serviço de autenticação indisponível: falha na verificação do usuário.' });
  }

  if (!authResolution.ok) {
    return res.status(authResolution.status).json({ error: authResolution.error });
  }

  const requestAppId = String((req as any).clientContext?.appId || req.headers['x-3c-app-id'] || '').trim().toLowerCase();
  const requestPlatform = String((req as any).clientContext?.platform || req.headers['x-3c-platform'] || '').trim().toLowerCase();
  const isEdgeSyncSidecarRequest =
    requestAppId === 'server-core' &&
    requestPlatform === 'edge-node-sqlite' &&
    req.originalUrl.startsWith('/api/v1/sync') &&
    ['DEV_OWNER', 'STORE_OWNER', 'STORE_MANAGER', 'REGIONAL_MANAGER'].includes(String(authResolution.user.role || '').toUpperCase());

  if (!isEdgeSyncSidecarRequest && !isRoleAllowedForAppId(authResolution.user.role, requestAppId)) {
    return res.status(403).json({
      error: `Acesso negado: Perfil '${authResolution.user.role}' não é autorizado para o produto '${requestAppId}'.`,
    });
  }
  if (isProductBlockedForUser(authResolution.user.blockedApps, requestAppId)) {
    return res.status(403).json({
      error: `Acesso bloqueado: Produto '${requestAppId}' está bloqueado para sua conta.`,
    });
  }

  // Hydrate identity strictly from authoritative persistent user record
  (req as any).user = authResolution.user;
  return runWithDbContext(buildDbContextForUser(authResolution.user), () => next());
};

export const BRANCH_LOCKED_ROLES = new Set([
  'STORE_MANAGER',
  'CASHIER',
  'KITCHEN_STAFF',
  'WAITER',
]);

export function hasUserStoreAccess(
  user: AuthenticatedRequestUser | null | undefined,
  targetStoreId?: string | null
): boolean {
  if (!user) return false;
  if (user.role === 'DEV_OWNER' || user.role === 'SUPER_ADMIN') return true;
  const allowedStores = Array.isArray(user.allowedStoreIds) ? user.allowedStoreIds.filter(Boolean) : [];
  if (BRANCH_LOCKED_ROLES.has(user.role) && !user.storeId && allowedStores.length === 0) {
    return false;
  }
  if (!targetStoreId) return true;
  if (allowedStores.length > 0) {
    return allowedStores.includes(targetStoreId) || user.storeId === targetStoreId;
  }
  if (!user.storeId) return true;
  return user.storeId === targetStoreId;
}

export const requireRoles = (roles: string[]) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userRole = (req as any).user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        error: `Acesso negado: Perfil '${userRole || 'ANÔNIMO'}' não possui autorização para esta operação. Requer: [${roles.join(', ')}]`
      });
    }
    next();
  };
};

export const requireModuleAccess = (...moduleIds: string[]) => {
  const normalizedTargets = moduleIds.map((m) => m.trim().toLowerCase()).filter(Boolean);
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user as AuthenticatedRequestUser | undefined;
    if (!user) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }
    if (user.role === 'DEV_OWNER' || user.role === 'SUPER_ADMIN') {
      return next();
    }
    const blocked = Array.isArray(user.blockedApps)
      ? user.blockedApps.map((b) => String(b).trim().toLowerCase())
      : [];
    const hit = normalizedTargets.find((target) => blocked.includes(target));
    if (hit || blocked.includes('*') || blocked.includes('all')) {
      return res.status(403).json({
        error: `Acesso bloqueado: O módulo '${hit || normalizedTargets[0]}' foi restringido para sua conta pela administração.`,
      });
    }
    next();
  };
};
