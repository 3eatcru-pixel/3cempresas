import crypto from 'crypto';
import express from 'express';
import { db } from '../config.ts';
import { AuthenticatedRequestUser, hasUserStoreAccess } from '../middleware/auth.ts';
import {
  PAIRING_CODE_TTL_MS,
  PAIRING_LOCKOUT_MS,
  PAIRING_MAX_ATTEMPTS,
  generateSecurePairingCode,
  recordDeviceAuditEvent,
  sanitizeDeviceForResponse,
  sha256Hex,
  timingSafeEqualStr,
} from './deviceCryptoAndAudit.ts';

export async function regenerateDevicePairing(params: {
  id: string;
  actor: AuthenticatedRequestUser;
  req: express.Request;
  channel: string;
}): Promise<{ status: number; body: any }> {
  const { id, actor, req, channel } = params;
  const isHqGlobal = actor.role === 'DEV_OWNER' || actor.role === 'SUPER_ADMIN';

  const txOutcome = await db.runTransaction(async (transaction) => {
    const docRef = db.collection('device_licenses').doc(id);
    const snap = await transaction.get(docRef);
    if (!snap.exists) {
      return { status: 404, body: { error: 'Dispositivo não encontrado.' } };
    }
    const dev = snap.data() || {};
    if (!isHqGlobal) {
      if (dev.tenantId !== actor.tenantId) {
        return { status: 403, body: { error: 'Acesso negado: Dispositivo pertence a outra empresa/tenant.' } };
      }
      if (!hasUserStoreAccess(actor, dev.storeId)) {
        return { status: 403, body: { error: 'Acesso negado: Perfil restrito a outra filial.' } };
      }
    }

    const pairingCode = generateSecurePairingCode();
    const nowIso = new Date().toISOString();
    const patch = {
      paired: false,
      status: 'PENDING_PAIRING',
      pairingCode,
      pairingCodeHash: sha256Hex(pairingCode),
      pairingCodeExpiresAt: new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString(),
      pairingCodeUsed: false,
      pairingAttempts: 0,
      pairingLockedUntil: null,
      deviceTokenHash: null,
      terminalTokenVersion: (Number(dev.terminalTokenVersion) || 1) + 1,
      updatedAt: nowIso,
    };
    transaction.update(docRef, patch);
    return { status: 200, dev, patch, pairingCode };
  });

  if (txOutcome.status !== 200 || !txOutcome.patch) {
    return { status: txOutcome.status, body: txOutcome.body };
  }

  await recordDeviceAuditEvent(
    'DEVICE_PAIRING_CODE_REGENERATED',
    `Novo código de pareamento emitido para '${txOutcome.dev.name || id}'`,
    channel,
    txOutcome.dev.tenantId || actor.tenantId,
    { req, actor, resourceId: id }
  );
  return {
    status: 200,
    body: {
      success: true,
      pairingCode: txOutcome.pairingCode,
      pairingCodeExpiresAt: txOutcome.patch.pairingCodeExpiresAt,
      device: sanitizeDeviceForResponse({ ...txOutcome.dev, ...txOutcome.patch }),
    },
  };
}

export async function pairDeviceRecord(params: {
  id: string;
  pairingCode?: string;
  ipAddress?: string;
  appVersion?: string;
  actor: AuthenticatedRequestUser | null;
  allowedRoles: string[];
  req: express.Request;
  channel: string;
}): Promise<{ status: number; body: any }> {
  const { id, pairingCode, ipAddress, appVersion, actor, allowedRoles, req, channel } = params;
  const submittedCode = typeof pairingCode === 'string' ? pairingCode.trim().toUpperCase() : '';
  const callerIp = ipAddress || req.ip?.replace(/^::ffff:/, '') || '127.0.0.1';

  const txOutcome = await db.runTransaction(async (transaction) => {
    const docRef = db.collection('device_licenses').doc(id);
    const snap = await transaction.get(docRef);
    if (!snap.exists) {
      return { kind: 'ERROR' as const, status: 404, body: { error: 'Dispositivo não encontrado para pareamento.' } };
    }

    const dev = snap.data() || {};

    if (actor) {
      if (!allowedRoles.includes(actor.role)) {
        return {
          kind: 'ERROR' as const,
          status: 403,
          body: { error: `Acesso negado: Perfil '${actor.role}' não tem permissão para parear terminais.` },
        };
      }
      if (actor.role !== 'DEV_OWNER' && actor.role !== 'SUPER_ADMIN') {
        if (dev.tenantId !== actor.tenantId) {
          return { kind: 'ERROR' as const, status: 403, body: { error: 'Acesso negado: Dispositivo pertence a outra empresa/tenant.' } };
        }
        if (!hasUserStoreAccess(actor, dev.storeId)) {
          return { kind: 'ERROR' as const, status: 403, body: { error: 'Acesso negado: Operador restrito a outra filial.' } };
        }
      }
    }

    if (dev.pairingLockedUntil && new Date(dev.pairingLockedUntil).getTime() > Date.now()) {
      return {
        kind: 'ERROR' as const,
        status: 429,
        body: { error: 'Pareamento bloqueado temporariamente por excesso de tentativas inválidas. Regenere o código no painel autorizado.' },
      };
    }

    if (dev.paired === true || dev.pairingCodeUsed === true) {
      return {
        kind: 'ERROR' as const,
        status: 409,
        body: { error: 'Dispositivo já pareado ou código de uso único já consumido. Regenere um novo código para reparear.' },
      };
    }

    if (!dev.pairingCodeExpiresAt || new Date(dev.pairingCodeExpiresAt).getTime() < Date.now()) {
      return { kind: 'ERROR' as const, status: 401, body: { error: 'Código de pareamento expirado. Emita um novo código no painel autorizado.' } };
    }

    const expectedHash =
      dev.pairingCodeHash || (dev.pairingCode ? sha256Hex(String(dev.pairingCode).trim().toUpperCase()) : '');

    if (!submittedCode || !expectedHash || !timingSafeEqualStr(sha256Hex(submittedCode), expectedHash)) {
      const nextAttempts = (Number(dev.pairingAttempts) || 0) + 1;
      const locked = nextAttempts >= PAIRING_MAX_ATTEMPTS;
      const lockUntil = locked ? new Date(Date.now() + PAIRING_LOCKOUT_MS).toISOString() : null;
      transaction.update(docRef, {
        pairingAttempts: nextAttempts,
        ...(locked ? { pairingLockedUntil: lockUntil } : {}),
        updatedAt: new Date().toISOString(),
      });
      return {
        kind: 'FAILED_ATTEMPT' as const,
        status: locked ? 429 : 401,
        locked,
        nextAttempts,
        dev,
        body: {
          error: locked
            ? 'Limite de tentativas de pareamento excedido. Pareamento bloqueado por 15 minutos.'
            : 'Código de pareamento obrigatório ou inválido.',
        },
      };
    }

    const deviceToken = `devtok_${crypto.randomBytes(32).toString('hex')}`;
    const deviceTokenHash = sha256Hex(deviceToken);
    const nowIso = new Date().toISOString();
    const patch = {
      paired: true,
      status: 'ONLINE',
      pairingCode: null,
      pairingCodeHash: null,
      pairingCodeUsed: true,
      pairingAttempts: 0,
      pairingLockedUntil: null,
      deviceTokenHash,
      pairedByUid: actor?.uid || null,
      pairedAt: nowIso,
      ipAddress: callerIp,
      lastPing: nowIso,
      lastHeartbeatAt: nowIso,
      appVersion: appVersion || dev?.appVersion || '5.2.1',
      updatedAt: nowIso,
    };

    transaction.update(docRef, patch);
    return {
      kind: 'PAIRED' as const,
      status: 200,
      dev,
      patch,
      deviceToken,
    };
  });

  if (txOutcome.kind === 'ERROR') {
    return { status: txOutcome.status, body: txOutcome.body };
  }

  if (txOutcome.kind === 'FAILED_ATTEMPT') {
    await recordDeviceAuditEvent(
      'DEVICE_PAIRING_FAILED',
      `Tentativa inválida de pareamento para '${txOutcome.dev.name || id}' (${txOutcome.nextAttempts}/${PAIRING_MAX_ATTEMPTS})`,
      channel,
      txOutcome.dev.tenantId || actor?.tenantId || 'tenant-1',
      { req, actor, resourceId: id, result: txOutcome.locked ? 'LOCKED_429' : 'FAILED_401', critical: false }
    );
    return { status: txOutcome.status, body: txOutcome.body };
  }

  await recordDeviceAuditEvent(
    'DEVICE_PAIRED',
    `Dispositivo '${txOutcome.dev?.name || id}' pareado com sucesso (IP: ${callerIp})`,
    channel,
    txOutcome.dev?.tenantId || actor?.tenantId || 'tenant-1',
    { req, actor, resourceId: id }
  );

  return {
    status: 200,
    body: {
      success: true,
      deviceToken: txOutcome.deviceToken,
      device: sanitizeDeviceForResponse({ ...txOutcome.dev, ...txOutcome.patch }),
    },
  };
}

export async function revokeDeviceTokenRecord(params: {
  id: string;
  actor: AuthenticatedRequestUser;
  req: express.Request;
  channel: string;
}): Promise<{ status: number; body: any }> {
  const { id, actor, req, channel } = params;
  const isHqGlobal = actor.role === 'DEV_OWNER' || actor.role === 'SUPER_ADMIN';

  const txOutcome = await db.runTransaction(async (transaction) => {
    const docRef = db.collection('device_licenses').doc(id);
    const snap = await transaction.get(docRef);
    if (!snap.exists) {
      return { status: 404, body: { error: 'Dispositivo não encontrado.' } };
    }
    const prev = snap.data() || {};
    if (!isHqGlobal) {
      if (prev.tenantId !== actor.tenantId || !hasUserStoreAccess(actor, prev.storeId)) {
        return { status: 403, body: { error: 'Acesso negado: Dispositivo pertence a outra empresa/filial.' } };
      }
    }
    const nowIso = new Date().toISOString();
    transaction.update(docRef, {
      paired: false,
      status: 'REVOKED',
      deviceTokenHash: null,
      pairingCode: null,
      pairingCodeHash: null,
      pairingCodeUsed: true,
      terminalTokenVersion: (Number(prev.terminalTokenVersion) || 1) + 1,
      updatedAt: nowIso,
    });
    return { status: 200, prev, nowIso };
  });

  if (txOutcome.status !== 200) {
    return { status: txOutcome.status, body: txOutcome.body };
  }

  await recordDeviceAuditEvent(
    'DEVICE_TOKEN_REVOKED',
    `Credencial do dispositivo '${txOutcome.prev.name || id}' revogada`,
    channel,
    txOutcome.prev.tenantId || actor.tenantId,
    { req, actor, resourceId: id }
  );
  return { status: 200, body: { success: true, revokedAt: txOutcome.nowIso } };
}
