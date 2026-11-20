import express from 'express';
import { db } from '../config.ts';
import { AuthenticatedRequestUser, hasUserStoreAccess } from '../middleware/auth.ts';
import {
  PAIRING_CODE_TTL_MS,
  PAIRING_LOCKOUT_MS,
  PAIRING_MAX_ATTEMPTS,
  generateSecurePairingCode,
  recordDeviceAuditEvent,
  resolveDefaultDevicesForPlan,
  sanitizeDeviceForResponse,
  sha256Hex,
  stripDeviceProtoPollution,
  timingSafeEqualStr,
} from './deviceCryptoAndAudit.ts';
import {
  pairDeviceRecord,
  regenerateDevicePairing,
  revokeDeviceTokenRecord,
} from './devicePairingEngine.ts';

export {
  PAIRING_CODE_TTL_MS,
  PAIRING_MAX_ATTEMPTS,
  PAIRING_LOCKOUT_MS,
  sha256Hex,
  timingSafeEqualStr,
  generateSecurePairingCode,
  sanitizeDeviceForResponse,
  resolveDefaultDevicesForPlan,
  recordDeviceAuditEvent,
  regenerateDevicePairing,
  pairDeviceRecord,
  revokeDeviceTokenRecord,
};

export async function upsertDeviceLicense(params: {
  license: Record<string, any>;
  actor: AuthenticatedRequestUser;
  req: express.Request;
  channel: string;
  allowHqConsole?: boolean;
}): Promise<{ status: number; body: any }> {
  const { actor, req, channel, allowHqConsole = false } = params;
  const license = stripDeviceProtoPollution(params.license || {});
  const id = license.id || `dev-${Date.now()}`;
  const isHqGlobal = actor.role === 'DEV_OWNER' || actor.role === 'SUPER_ADMIN';
  const isAdminConsoleException =
    allowHqConsole && actor.role === 'DEV_OWNER' && license.scope === 'HQ_ADMIN_CONSOLE';

  if (!license.storeId && !isAdminConsoleException) {
    return { status: 400, body: { error: 'storeId é obrigatório para registrar dispositivo operacional.' } };
  }

  const txOutcome = await db.runTransaction(async (transaction) => {
    const devRef = db.collection('device_licenses').doc(id);
    const existingSnap = await transaction.get(devRef);
    if (existingSnap.exists && !isHqGlobal) {
      if (existingSnap.data()?.tenantId !== actor.tenantId) {
        return { status: 403, body: { error: 'Acesso negado: Dispositivo pertence a outra empresa/tenant.' } };
      }
      if (!hasUserStoreAccess(actor, existingSnap.data()?.storeId)) {
        return { status: 403, body: { error: 'Acesso negado: Perfil restrito a outra filial.' } };
      }
    }

    let resolvedStoreTenantId: string | undefined;
    let resolvedStoreData: any = null;
    if (license.storeId) {
      const storeIdStr = String(license.storeId);
      if (!isHqGlobal && !hasUserStoreAccess(actor, storeIdStr)) {
        return { status: 403, body: { error: 'Acesso negado: Perfil restrito a outra filial.' } };
      }
      const storeSnap = await transaction.get(db.collection('stores').doc(storeIdStr));
      if (!storeSnap.exists) {
        return {
          status: 404,
          body: { error: `Loja '${license.storeId}' não encontrada para vínculo do dispositivo.` },
        };
      }
      resolvedStoreData = storeSnap.data();
      resolvedStoreTenantId = resolvedStoreData?.tenantId;
      if (!isHqGlobal && resolvedStoreTenantId !== actor.tenantId) {
        return { status: 403, body: { error: 'Acesso negado: Loja não pertence ao tenant autenticado.' } };
      }

      if (!existingSnap.exists) {
        const maxAllowedDevices =
          Number(resolvedStoreData?.maxAllowedDevices) > 0
            ? Number(resolvedStoreData.maxAllowedDevices)
            : resolveDefaultDevicesForPlan(resolvedStoreData?.subscriptionPlan);
        const allDevsSnap = await db.collection('device_licenses').get();
        const storeDevsCount = allDevsSnap.docs
          .map((d) => d.data())
          .filter((d) => d.storeId === storeIdStr && !d._deleted).length;
        if (storeDevsCount >= maxAllowedDevices) {
          return {
            status: 403,
            body: {
              error: `Limite de dispositivos do plano ${
                resolvedStoreData?.subscriptionPlan || 'atual'
              } atingido (${storeDevsCount}/${maxAllowedDevices}). Faça upgrade de plano no HQ para parear mais terminais.`,
            },
          };
        }
      }
    }

    const tenantId =
      actor.role === 'DEV_OWNER'
        ? license.tenantId || resolvedStoreTenantId || existingSnap.data()?.tenantId || actor.tenantId
        : resolvedStoreTenantId || actor.tenantId;

    const {
      tenantId: _ignoredTenant,
      id: _ignoredId,
      status: _ignoredStatus,
      paired: _ignoredPaired,
      ipAddress: _ignoredIp,
      lastPing: _ignoredLastPing,
      pairingCode: _ignoredPairingCode,
      pairingCodeHash: _ignoredPairingCodeHash,
      pairingCodeExpiresAt: _ignoredExpiresAt,
      pairingCodeUsed: _ignoredUsed,
      pairingAttempts: _ignoredAttempts,
      pairingLockedUntil: _ignoredLockedUntil,
      deviceToken: _ignoredDeviceToken,
      deviceTokenHash: _ignoredDeviceTokenHash,
      ...cleanLicense
    } = license;

    const nowIso = new Date().toISOString();
    const isNewDevice = !existingSnap.exists;
    const prev = existingSnap.data() || {};
    const pairingCode = isNewDevice
      ? generateSecurePairingCode()
      : prev.paired
      ? null
      : prev.pairingCode || generateSecurePairingCode();
    const pairingCodeHash = pairingCode
      ? sha256Hex(pairingCode.trim().toUpperCase())
      : prev.pairingCodeHash || null;
    const pairingCodeExpiresAt = isNewDevice
      ? new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString()
      : prev.pairingCodeExpiresAt || new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString();

    const saved: Record<string, any> = {
      ...cleanLicense,
      id,
      tenantId,
      status: isNewDevice ? 'PENDING_PAIRING' : prev.status || 'PENDING_PAIRING',
      paired: isNewDevice ? false : Boolean(prev.paired),
      pairingCode,
      pairingCodeHash,
      pairingCodeExpiresAt,
      pairingCodeUsed: isNewDevice ? false : Boolean(prev.pairingCodeUsed),
      pairingAttempts: isNewDevice ? 0 : prev.pairingAttempts || 0,
      pairingLockedUntil: isNewDevice ? null : prev.pairingLockedUntil || null,
      deviceTokenHash: isNewDevice ? null : prev.deviceTokenHash || null,
      terminalTokenVersion: isNewDevice ? 1 : Number(prev.terminalTokenVersion) || 1,
      ipAddress: isNewDevice ? 'Aguardando pareamento' : prev.ipAddress || 'Aguardando pareamento',
      lastPing: isNewDevice ? 'Aguardando pareamento' : prev.lastPing || 'Aguardando pareamento',
      lastHeartbeatAt: isNewDevice ? null : prev.lastHeartbeatAt ?? null,
      appVersion: license.appVersion || prev.appVersion || '5.2.1',
      updatedAt: nowIso,
    };
    transaction.set(devRef, saved, { merge: true });
    return { status: 200, saved, tenantId };
  });

  if (txOutcome.status !== 200 || !txOutcome.saved) {
    return { status: txOutcome.status, body: txOutcome.body ?? { error: 'Erro ao registrar dispositivo.' } };
  }

  await recordDeviceAuditEvent(
    'DEVICE_REGISTERED',
    `Dispositivo ${txOutcome.saved.name || id} registrado para loja ${
      txOutcome.saved.storeId || 'HQ_ADMIN_CONSOLE'
    } (status: ${txOutcome.saved.status})`,
    channel,
    txOutcome.tenantId,
    { req, actor, resourceId: id, after: sanitizeDeviceForResponse(txOutcome.saved) }
  );
  return { status: 200, body: { success: true, device: sanitizeDeviceForResponse(txOutcome.saved) } };
}

export async function deleteDeviceLicenseRecord(params: {
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
      if (prev.tenantId !== actor.tenantId) {
        return { status: 403, body: { error: 'Acesso negado: Dispositivo pertence a outra empresa/tenant.' } };
      }
      if (!hasUserStoreAccess(actor, prev.storeId)) {
        return { status: 403, body: { error: 'Acesso negado: Perfil restrito a outra filial.' } };
      }
    }
    transaction.delete(docRef);
    return { status: 200, prev };
  });

  if (txOutcome.status !== 200) {
    return { status: txOutcome.status, body: txOutcome.body };
  }

  await recordDeviceAuditEvent(
    'DEVICE_REVOKED',
    `Licença do dispositivo ${txOutcome.prev?.name || id} revogada`,
    channel,
    txOutcome.prev?.tenantId || actor.tenantId || 'tenant-1',
    { req, actor, resourceId: id }
  );
  return { status: 200, body: { success: true } };
}
