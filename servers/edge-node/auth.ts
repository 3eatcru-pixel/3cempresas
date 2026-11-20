import express from 'express';
import { auth } from '../../src/server/config.ts';
import { BRANCH_LOCKED_ROLES } from '../../src/server/middleware/auth.ts';
import { SqliteWalDriver } from '../../src/server/persistence/SqliteWalDriver.ts';

export interface EdgeAuthenticatedUser {
  uid: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  storeId?: string;
  allowedStoreIds: string[];
  authProvider?: string;
  deviceDocId?: string;
  deviceId?: string;
  terminalId?: string;
}

function authError(message: string, statusCode: number): Error & { statusCode: number } {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function resolveEdgeWaiterDevice(
  driver: SqliteWalDriver,
  storeId: string,
  tenantId: string,
  decoded: any
): Promise<EdgeAuthenticatedUser> {
  if (String(decoded?.role || '').toUpperCase() !== 'WAITER' || !decoded?.storeId) {
    throw authError('Acesso negado: Sessão de terminal inválida ou sem loja vinculada.', 403);
  }
  if (decoded.storeId !== storeId) {
    throw authError('Acesso negado: Terminal vinculado a outra filial.', 403);
  }
  if (decoded.tenantId && decoded.tenantId !== tenantId) {
    throw authError('Acesso negado: Edge Node pertence a outro tenant.', 403);
  }

  const storeDoc = await driver.getDoc<any>('stores', storeId);
  if (storeDoc) {
    if (storeDoc._deleted || String(storeDoc.status || 'ACTIVE').toUpperCase() === 'SUSPENDED') {
      throw authError('Acesso bloqueado: estabelecimento suspenso ou removido.', 403);
    }
    if (
      typeof storeDoc.waiterPairingRevokedAtSec === 'number' &&
      typeof decoded.iat === 'number' &&
      decoded.iat < storeDoc.waiterPairingRevokedAtSec
    ) {
      throw authError('Não autorizado: Sessão de terminal do salão revogada pela loja.', 401);
    }
  }

  const tenantDoc = await driver.getDoc<any>('tenants', tenantId);
  if (tenantDoc?.status && String(tenantDoc.status).toUpperCase() === 'SUSPENDED') {
    throw authError('Acesso bloqueado: Empresa suspensa pelo HQ Central.', 403);
  }

  if (decoded.deviceDocId) {
    const devDoc = await driver.getDoc<any>('device_licenses', String(decoded.deviceDocId));
    if (devDoc) {
      if (devDoc._deleted || !devDoc.paired || devDoc.status === 'REVOKED') {
        throw authError('Sessão do dispositivo/PDQ revogada ou despareada pela loja.', 401);
      }
      if (devDoc.storeId !== storeId || devDoc.tenantId !== tenantId) {
        throw authError('Acesso negado: dispositivo pertence a outra loja.', 403);
      }
      const expectedVersion = Number(devDoc.terminalTokenVersion) || 1;
      const tokenVersion = Number(decoded.tokenVersion) || 1;
      if (tokenVersion !== expectedVersion) {
        throw authError('Sessão do PDQ revogada. Gere um novo código de pareamento na loja.', 401);
      }
    }
    return {
      uid: decoded.uid,
      email: '',
      name: decoded.name || devDoc?.name || 'Terminal PDQ Salão',
      role: 'WAITER',
      tenantId,
      storeId,
      allowedStoreIds: [storeId],
      authProvider: 'STORE_DEVICE_PDQ',
      deviceDocId: String(decoded.deviceDocId),
      deviceId: devDoc?.deviceId || String(decoded.deviceId || decoded.deviceDocId),
    };
  }

  if (decoded.terminalId) {
    const termDoc = await driver.getDoc<any>('waiter_terminals', String(decoded.terminalId));
    if (termDoc) {
      if (termDoc.status !== 'ACTIVE') {
        throw authError('Sessão de terminal do garçom encerrada.', 401);
      }
      if (termDoc.storeId !== storeId || termDoc.tenantId !== tenantId) {
        throw authError('Acesso negado: terminal pertence a outra loja.', 403);
      }
      const expectedVersion = Number(termDoc.tokenVersion) || 1;
      const tokenVersion = Number(decoded.tokenVersion) || 1;
      if (tokenVersion !== expectedVersion) {
        throw authError('Sessão de terminal revogada pela loja.', 401);
      }
    }
    return {
      uid: decoded.uid,
      email: '',
      name: decoded.name || termDoc?.operatorName || 'Terminal Salão',
      role: 'WAITER',
      tenantId,
      storeId,
      allowedStoreIds: [storeId],
      authProvider: 'WAITER_PIN_TERMINAL',
      terminalId: String(decoded.terminalId),
    };
  }

  throw authError('Credencial de terminal sem vínculo válido.', 401);
}

export async function verifyEdgeTokenAndUser(
  driver: SqliteWalDriver,
  storeId: string,
  tenantId: string,
  token: string
): Promise<EdgeAuthenticatedUser> {
  const decoded = await auth.verifyIdToken(token);
  if (!decoded?.uid) {
    throw authError('Token sem identificador de usuário.', 401);
  }

  if (decoded.typ === 'waiter_device') {
    return resolveEdgeWaiterDevice(driver, storeId, tenantId, decoded);
  }

  const localUsersCount = driver.getCollectionSize('users');
  const localUser = await driver.getDoc<any>('users', decoded.uid);

  if (localUsersCount === 0 && decoded.role !== 'DEV_OWNER') {
    throw authError('Edge Node aguardando sincronização inicial de usuários do Server Core.', 503);
  }

  if (localUsersCount > 0 && !localUser && decoded.role !== 'DEV_OWNER') {
    throw authError('Usuário não autorizado ou revogado neste Edge Node.', 401);
  }

  const effective = localUser || decoded;
  if (
    effective.status === 'DISABLED' ||
    effective.status === 'PENDING_ACTIVATION' ||
    effective.disabled === true
  ) {
    throw authError('Conta desativada ou pendente de ativação.', 403);
  }

  if (
    typeof localUser?.tokenVersion === 'number' &&
    typeof decoded?.tokenVersion === 'number' &&
    decoded.tokenVersion !== localUser.tokenVersion
  ) {
    throw authError('Não autorizado: Sessão revogada pelo HQ. Faça login novamente.', 401);
  }

  if (
    typeof localUser?.tokenRevokedAtSec === 'number' &&
    typeof decoded?.iat === 'number' &&
    decoded.iat < localUser.tokenRevokedAtSec
  ) {
    throw authError('Não autorizado: Sessão revogada pelo HQ. Faça login novamente.', 401);
  }

  const role = String(effective.role || '');
  if (!role) {
    throw authError('Perfil de acesso ausente.', 403);
  }

  if (role !== 'DEV_OWNER' && role !== 'CUSTOMER' && role !== 'CONSUMER') {
    const userTenant = effective.tenantId || tenantId;
    const tenantDoc = await driver.getDoc<any>('tenants', userTenant);
    if (tenantDoc?.status === 'SUSPENDED') {
      throw authError('Acesso bloqueado: Empresa suspensa pelo HQ Central.', 403);
    }
    const storeDoc = await driver.getDoc<any>('stores', storeId);
    if (storeDoc && String(storeDoc.status || 'ACTIVE').toUpperCase() === 'SUSPENDED') {
      throw authError('Acesso bloqueado: Estabelecimento suspenso.', 403);
    }
  }

  const userTenantId = effective.tenantId || decoded.tenantId || '';
  const userStoreId = effective.storeId || decoded.storeId || undefined;
  const allowedStores = Array.isArray(effective.allowedStoreIds)
    ? effective.allowedStoreIds
    : Array.isArray(decoded.allowedStoreIds)
    ? decoded.allowedStoreIds
    : [];

  if (role !== 'DEV_OWNER') {
    if (userTenantId && userTenantId !== tenantId) {
      throw authError('Acesso negado: Edge Node pertence a outro tenant.', 403);
    }
    const isBranchLocked = BRANCH_LOCKED_ROLES.has(role);
    const hasStoreAccess =
      (!isBranchLocked && !userStoreId && allowedStores.length === 0) ||
      userStoreId === storeId ||
      allowedStores.includes(storeId);
    if (!hasStoreAccess) {
      throw authError('Acesso negado: Usuário vinculado a outra filial.', 403);
    }
  }

  return {
    uid: decoded.uid,
    email: effective.email || decoded.email || '',
    name: effective.name || decoded.name || 'Operador Edge',
    role,
    tenantId: userTenantId || tenantId,
    storeId: userStoreId,
    allowedStoreIds: allowedStores,
  };
}

export function createEdgeAuthGuards(
  driver: SqliteWalDriver,
  storeId: string,
  tenantId: string
) {
  const authenticateEdge = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token Bearer obrigatório no 3C Edge Node.' });
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({ error: 'Token Bearer inválido.' });
    }
    try {
      (req as any).user = await verifyEdgeTokenAndUser(driver, storeId, tenantId, token);
      next();
    } catch (err: any) {
      return res.status(err?.statusCode || 401).json({ error: err?.message || 'Token inválido.' });
    }
  };

  const requireEdgeRoles = (roles: string[]) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const userRole = (req as any).user?.role;
      if (!userRole || (!roles.includes(userRole) && userRole !== 'DEV_OWNER')) {
        return res.status(403).json({
          error: `Acesso negado no Edge Node: perfil '${userRole || 'ANÔNIMO'}' requer [${roles.join(', ')}].`,
        });
      }
      next();
    };
  };

  return { authenticateEdge, requireEdgeRoles };
}
