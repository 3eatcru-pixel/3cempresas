import express from 'express';
import { auth, db, runWithSystemDbContext } from '../../config.ts';
import { isProductBlockedForUser, isRoleAllowedForAppId } from '../../middleware/auth.ts';
import { DEFAULT_PLATFORM_GOVERNANCE } from '../../../constants/platformDefaults.ts';
import { verifySupabaseAccessToken } from '../../services/supabaseProvider.ts';
import { setSessionCookie } from './sessionCookie.ts';

const router = express.Router();

const DEDICATED_PRODUCT_IDS = new Set([
  'marketplace',
  'store-os',
  'driver',
  'waiter',
  'hq',
  'server-core',
]);

function resolveStrictProductAppId(req: express.Request, bodyContextId?: unknown): string | null {
  const rawHeader = String(
    req.headers['x-3c-app-id'] || (req as any).clientContext?.appId || ''
  )
    .trim()
    .toLowerCase();
  const headerAppId = rawHeader === 'hq-central' ? 'hq' : rawHeader;
  if (DEDICATED_PRODUCT_IDS.has(headerAppId)) {
    return headerAppId;
  }
  const rawBody = String(bodyContextId || '')
    .trim()
    .toLowerCase();
  const requestedContext = rawBody === 'hq-central' ? 'hq' : rawBody;
  if (DEDICATED_PRODUCT_IDS.has(requestedContext)) {
    return requestedContext;
  }
  return null;
}

export async function getSupabaseGovernanceState(): Promise<{
  masterEnabled: boolean;
  authEnabled: boolean;
  dbEnabled: boolean;
  govData?: any;
}> {
  const defaultMaster = Boolean(DEFAULT_PLATFORM_GOVERNANCE.featureFlags.supabaseEnabled ?? true);
  const defaultAuth = Boolean(DEFAULT_PLATFORM_GOVERNANCE.featureFlags.supabaseAuthEnabled ?? true);
  const defaultDb = Boolean(DEFAULT_PLATFORM_GOVERNANCE.featureFlags.supabaseDbEnabled ?? true);
  try {
    const govSnap = await runWithSystemDbContext('AUTH_SUPABASE_PROVIDERS_CHECK', () =>
      db.collection('governance').doc('governance').get()
    );
    const govData = govSnap.exists ? govSnap.data() : undefined;
    const flags = govData?.featureFlags;
    if (flags && typeof flags === 'object') {
      const masterEnabled =
        typeof flags.supabaseEnabled === 'boolean' ? flags.supabaseEnabled : defaultMaster;
      const authEnabled =
        typeof flags.supabaseAuthEnabled === 'boolean' ? flags.supabaseAuthEnabled : defaultAuth;
      const dbEnabled =
        typeof flags.supabaseDbEnabled === 'boolean' ? flags.supabaseDbEnabled : defaultDb;
      return {
        masterEnabled,
        authEnabled: masterEnabled && authEnabled,
        dbEnabled: masterEnabled && dbEnabled,
        govData,
      };
    }
    return {
      masterEnabled: defaultMaster,
      authEnabled: defaultMaster && defaultAuth,
      dbEnabled: defaultMaster && defaultDb,
      govData,
    };
  } catch {
    // Fallback to default governance flag
  }
  return {
    masterEnabled: defaultMaster,
    authEnabled: defaultMaster && defaultAuth,
    dbEnabled: defaultMaster && defaultDb,
  };
}

/**
 * Optional Supabase Auth JWT Exchange (Server Core Backbone)
 * - Governed in 1 click by HQ featureFlags.supabaseEnabled / supabaseAuthEnabled
 * - Cryptographically verifies Supabase JWT via @supabase/server JWKS
 * - Enforces separated product & role isolation identically to autonomous login
 */
router.post('/supabase-exchange', async (req, res) => {
  const { accessToken, contextId } = req.body || {};

  try {
    const sbState = await getSupabaseGovernanceState();
    if (!sbState.authEnabled) {
      return res.status(403).json({
        error:
          'Autenticação via Supabase está desativada na governança do HQ Central. Utilize login por e-mail e senha.',
      });
    }

    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({ error: 'Token de autenticação Supabase ausente.' });
    }

    const verified = await verifySupabaseAccessToken(accessToken, sbState.govData);
    const effectiveAppId = resolveStrictProductAppId(req, contextId) || 'marketplace';

    return await runWithSystemDbContext('AUTH_SUPABASE_EXCHANGE', async () => {
      const usersTable = await db.collection('users').get();
      const existingDoc = usersTable.docs.find(
        (d) => !d.data()?._deleted && d.data()?.email?.toLowerCase() === verified.email
      );

      if (!existingDoc) {
        if (effectiveAppId === 'marketplace') {
          const nowIso = new Date().toISOString();
          const uid = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const newConsumerProfile = {
            uid,
            id: uid,
            email: verified.email,
            name: verified.name,
            role: 'CUSTOMER',
            tenantId: 'tenant-1',
            emailVerified: true,
            status: 'ACTIVE',
            authProvider: 'supabase',
            supabaseUid: verified.uid,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          await db.runTransaction(async (transaction) => {
            transaction.set(db.collection('users').doc(uid), newConsumerProfile);
            transaction.set(
              db.collection('consumers').doc(uid),
              {
                id: uid,
                uid,
                name: verified.name,
                email: verified.email,
                phone: '',
                tenantId: 'tenant-1',
                savedAddresses: [],
                favoriteStoreIds: [],
                loyaltyRewards: [],
                preferences: {
                  dietaryRestrictions: [],
                  favoriteCategories: [],
                  defaultPaymentMethod: 'PIX',
                  emailNotifications: true,
                  whatsappNotifications: true,
                },
                createdAt: nowIso,
              },
              { merge: true }
            );
          });

          const token = auth.generateDevToken({
            uid,
            email: verified.email,
            email_verified: true,
            name: verified.name,
            role: 'CUSTOMER',
            tenantId: 'tenant-1',
            tokenVersion: 1,
            ...(effectiveAppId ? { appId: effectiveAppId } : {}),
          });
          setSessionCookie(res, token);

          return res.status(201).json({
            token,
            user: {
              uid,
              email: verified.email,
              name: verified.name,
              role: 'CUSTOMER',
              tenantId: 'tenant-1',
              emailVerified: true,
              authProvider: 'supabase',
              mustChangePassword: false,
              permissions: [],
              blockedApps: [],
            },
          });
        }

        if (effectiveAppId === 'store-os') {
          return res.status(404).json({
            error:
              'Nenhuma conta de lojista vinculada a este e-mail Supabase. Crie sua conta comercial no Store OS primeiro.',
          });
        }

        if (effectiveAppId === 'hq' || effectiveAppId === 'server-core') {
          return res.status(403).json({
            error: 'Acesso restrito ao HQ Central: e-mail não autorizado para governança.',
          });
        }

        return res.status(403).json({
          error: 'Nenhuma conta operacional provisionada para este e-mail.',
        });
      }

      const profile = existingDoc.data();
      if (
        profile.status === 'DISABLED' ||
        profile.status === 'PENDING_ACTIVATION' ||
        profile.disabled === true
      ) {
        return res.status(403).json({
          error: 'Conta de usuário desativada ou pendente de ativação.',
        });
      }

      const normalizedRole = String(profile.role || '').toUpperCase();
      if (
        normalizedRole !== 'DEV_OWNER' &&
        normalizedRole !== 'CUSTOMER' &&
        normalizedRole !== 'CONSUMER'
      ) {
        const userTenant = typeof profile.tenantId === 'string' ? profile.tenantId.trim() : '';
        const tenantSnap = userTenant ? await db.collection('tenants').doc(userTenant).get() : null;
        if (!tenantSnap || !tenantSnap.exists) {
          return res.status(403).json({ error: 'Acesso bloqueado: Empresa/Tenant não encontrada.' });
        }
        const tenantStatus = String(tenantSnap.data()?.status || 'ACTIVE').toUpperCase();
        if (tenantStatus !== 'ACTIVE') {
          return res.status(403).json({
            error: `Acesso bloqueado: Empresa em estado inválido (${tenantStatus}).`,
          });
        }
      }

      const canonicalRole = normalizedRole === 'DRIVER' ? 'COURIER' : profile.role;
      if (!isRoleAllowedForAppId(canonicalRole, effectiveAppId)) {
        return res.status(403).json({
          code: 'APP_ROLE_FORBIDDEN',
          error: `Acesso negado: esta conta (${canonicalRole}) não tem permissão no aplicativo '${effectiveAppId}'.`,
        });
      }
      if (isProductBlockedForUser(profile.blockedApps, effectiveAppId)) {
        return res.status(403).json({
          error: `Acesso bloqueado: O aplicativo '${effectiveAppId}' está bloqueado para sua conta.`,
        });
      }

      if (profile.supabaseUid !== verified.uid || profile.emailVerified !== true) {
        await db.collection('users').doc(existingDoc.id).update({
          supabaseUid: verified.uid,
          emailVerified: true,
          updatedAt: new Date().toISOString(),
        });
      }

      const token = auth.generateDevToken({
        uid: profile.uid,
        email: profile.email,
        email_verified: true,
        name: profile.name || verified.name,
        role: canonicalRole,
        tenantId: profile.tenantId || 'tenant-1',
        storeId: profile.storeId,
        allowedStoreIds: profile.allowedStoreIds,
        tokenVersion: Number(profile.tokenVersion || 1),
        ...(effectiveAppId ? { appId: effectiveAppId } : {}),
      });
      setSessionCookie(res, token);

      return res.json({
        token,
        user: {
          uid: profile.uid,
          email: profile.email,
          name: profile.name || verified.name,
          role: canonicalRole,
          tenantId: profile.tenantId,
          storeId: profile.storeId,
          allowedStoreIds: profile.allowedStoreIds,
          emailVerified: true,
          authProvider: 'supabase',
          mustChangePassword: profile.mustChangePassword === true,
          permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
          blockedApps: Array.isArray(profile.blockedApps) ? profile.blockedApps : [],
        },
      });
    });
  } catch (err: any) {
    return res.status(401).json({
      error: err?.message || 'Falha ao validar token Supabase via JWKS no Server Core.',
    });
  }
});

export default router;
