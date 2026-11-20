import express from 'express';
import { auth, db, runWithSystemDbContext } from '../../config.ts';
import {
  AuthenticatedRequestUser,
  hasUserStoreAccess,
  requireRoles,
  resolveOptionalUser,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import {
  deleteDeviceLicenseRecord,
  pairDeviceRecord,
  regenerateDevicePairing,
  revokeDeviceTokenRecord,
  sanitizeDeviceForResponse,
  sha256Hex,
  timingSafeEqualStr,
  upsertDeviceLicense,
} from '../../utils/deviceLicensing.ts';
import { isSingleBranchLocked } from './storeAccessHelpers.ts';

const router = express.Router();

const STORE_DEVICE_MANAGER_ROLES = ['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER'];
const WAITER_DEVICE_ALLOWED_TYPES = new Set(['WAITER_TABLET', 'POS_TERMINAL']);

router.get(
  '/devices',
  verifyAutonomousToken,
  requireRoles([...STORE_DEVICE_MANAGER_ROLES, 'CASHIER']),
  async (req, res) => {
    try {
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
      const requestedStoreId = req.query.storeId ? String(req.query.storeId) : '';
      const isHq = authenticatedUser.role === 'DEV_OWNER' || authenticatedUser.role === 'SUPER_ADMIN';
      const isBranchRestricted = !isHq && isSingleBranchLocked(authenticatedUser);

      if (!isHq && requestedStoreId && !hasUserStoreAccess(authenticatedUser, requestedStoreId)) {
        return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
      }
      const effectiveStoreId = isBranchRestricted ? String(authenticatedUser.storeId) : requestedStoreId;

      const snap = await db.collection('device_licenses').get();
      let devices = snap.docs.map((d) => d.data()).filter((d) => d && !d._deleted);
      if (!isHq) {
        const userTenant = authenticatedUser.tenantId || 'tenant-1';
        devices = devices.filter((d) => d.tenantId === userTenant && (!d.storeId || hasUserStoreAccess(authenticatedUser, d.storeId)));
      }
      if (effectiveStoreId) {
        devices = devices.filter((d) => d.storeId === effectiveStoreId);
      }
      res.json(devices.map(sanitizeDeviceForResponse));
    } catch {
      res.status(500).json({ error: 'Erro ao listar dispositivos da loja.' });
    }
  }
);

router.post('/devices', verifyAutonomousToken, requireRoles(STORE_DEVICE_MANAGER_ROLES), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const outcome = await upsertDeviceLicense({
      license: req.body || {},
      actor: authenticatedUser,
      req,
      channel: 'store/devices',
      allowHqConsole: false,
    });
    res.status(outcome.status).json(outcome.body);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao salvar dispositivo da loja.' });
  }
});

router.post('/devices/:id/regenerate-pairing', verifyAutonomousToken, requireRoles(STORE_DEVICE_MANAGER_ROLES), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const outcome = await regenerateDevicePairing({
      id: req.params.id,
      actor: authenticatedUser,
      req,
      channel: 'store/devices',
    });
    res.status(outcome.status).json(outcome.body);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao regenerar código de pareamento.' });
  }
});

router.post('/devices/:id/pair', async (req, res) => {
  try {
    const { id } = req.params;
    const { pairingCode, ipAddress, appVersion } = req.body || {};
    const { user: authenticatedUser, tokenProvided, error: tokenError } = await resolveOptionalUser(req);
    if (tokenProvided && !authenticatedUser) {
      return res.status(401).json({ error: tokenError || 'Token de autorização inválido para pareamento.' });
    }
    const outcome = await runWithSystemDbContext('STORE_DEVICE_PAIR', () =>
      pairDeviceRecord({
        id,
        pairingCode,
        ipAddress,
        appVersion,
        actor: authenticatedUser,
        allowedRoles: STORE_DEVICE_MANAGER_ROLES,
        req,
        channel: 'store/devices',
      })
    );
    res.status(outcome.status).json(outcome.body);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao parear dispositivo da loja.' });
  }
});

router.post('/devices/:id/heartbeat', async (req, res) => {
  try {
    const { id } = req.params;
    const { appVersion } = req.body || {};
    const authHeader = req.headers.authorization;
    const xDeviceToken = typeof req.headers['x-device-token'] === 'string' ? req.headers['x-device-token'].trim() : '';

    const result = await runWithSystemDbContext('STORE_DEVICE_HEARTBEAT', async () => {
      const docRef = db.collection('device_licenses').doc(id);
      const snap = await docRef.get();
      if (!snap.exists) {
        return { status: 404 as const, body: { error: 'Dispositivo não encontrado.' } };
      }
      const dev = snap.data() || {};
      if (!dev.paired || dev.status === 'REVOKED') {
        return { status: 401 as const, body: { error: 'Dispositivo não pareado ou com licença revogada.' } };
      }

      const bearerRaw = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
      const presentedDeviceToken = xDeviceToken || (bearerRaw.startsWith('devtok_') ? bearerRaw : '');
      let authorized = false;

      if (presentedDeviceToken) {
        if (!dev.deviceTokenHash || !timingSafeEqualStr(sha256Hex(presentedDeviceToken), String(dev.deviceTokenHash))) {
          return { status: 401 as const, body: { error: 'Credencial de dispositivo (x-device-token) inválida ou revogada.' } };
        }
        authorized = true;
      } else if (bearerRaw) {
        const { user: callerUser, error: userErr } = await resolveOptionalUser(req);
        if (!callerUser) {
          return { status: 401 as const, body: { error: userErr || 'Token de operador inválido.' } };
        }
        if (!STORE_DEVICE_MANAGER_ROLES.includes(callerUser.role)) {
          return { status: 403 as const, body: { error: 'Perfil sem permissão administrativa para heartbeat.' } };
        }
        if (callerUser.role !== 'DEV_OWNER' && callerUser.role !== 'SUPER_ADMIN') {
          if (dev.tenantId !== callerUser.tenantId || !hasUserStoreAccess(callerUser, dev.storeId)) {
            return { status: 403 as const, body: { error: 'Acesso negado: Dispositivo pertence a outro tenant ou filial.' } };
          }
        }
        authorized = true;
      }

      if (!authorized) {
        return { status: 401 as const, body: { error: 'Autenticação obrigatória para heartbeat.' } };
      }

      const nowIso = new Date().toISOString();
      const callerIp = req.ip?.replace(/^::ffff:/, '') || '127.0.0.1';
      const patch: Record<string, any> = {
        status: 'ONLINE',
        lastPing: nowIso,
        lastHeartbeatAt: nowIso,
        ipAddress: callerIp,
        updatedAt: nowIso,
      };
      if (appVersion) patch.appVersion = appVersion;
      await docRef.update(patch);
      return { status: 200 as const, body: { success: true, lastHeartbeatAt: nowIso } };
    });
    return res.status(result.status).json(result.body);
  } catch {
    res.status(500).json({ error: 'Falha ao registrar heartbeat do dispositivo.' });
  }
});

router.post('/devices/:id/revoke-token', verifyAutonomousToken, requireRoles(STORE_DEVICE_MANAGER_ROLES), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const outcome = await revokeDeviceTokenRecord({
      id: req.params.id,
      actor: authenticatedUser,
      req,
      channel: 'store/devices',
    });
    res.status(outcome.status).json(outcome.body);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao revogar credencial do dispositivo.' });
  }
});

router.delete('/devices/:id', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER']), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const outcome = await deleteDeviceLicenseRecord({
      id: req.params.id,
      actor: authenticatedUser,
      req,
      channel: 'store/devices',
    });
    res.status(outcome.status).json(outcome.body);
  } catch {
    res.status(500).json({ error: 'Erro ao deletar dispositivo da loja.' });
  }
});

router.post('/devices/pair-login', async (req, res) => {
  try {
    const { deviceIdentifier, pairingCode, operatorName, ipAddress, appVersion } = req.body || {};
    const rawIdentifier = typeof deviceIdentifier === 'string' ? deviceIdentifier.trim() : '';
    const submittedCode = typeof pairingCode === 'string' ? pairingCode.trim().toUpperCase() : '';

    if (!rawIdentifier) {
      return res.status(400).json({ error: 'Informe o identificador do dispositivo ou PDQ (ex: TAB-BGL-04 ou POS-BGL-01).' });
    }
    if (!submittedCode) {
      return res.status(400).json({ error: 'Informe o código de pareamento exibido no Store OS.' });
    }

    return await runWithSystemDbContext('STORE_DEVICE_PAIR_LOGIN', async () => {
    const snap = await db.collection('device_licenses').get();
    const upperIdentifier = rawIdentifier.toUpperCase();
    const matchedDoc = snap.docs.find((d) => {
      const data = d.data() || {};
      if (data._deleted) return false;
      return d.id === rawIdentifier || String(data.deviceId || '').trim().toUpperCase() === upperIdentifier;
    });

    if (!matchedDoc) {
      return res.status(404).json({ error: `Dispositivo ou PDQ '${rawIdentifier}' não encontrado na loja.` });
    }

    const devData = matchedDoc.data() || {};
    const deviceType = String(devData.type || '').toUpperCase();
    if (!WAITER_DEVICE_ALLOWED_TYPES.has(deviceType)) {
      return res.status(403).json({
        error: `Tipo de dispositivo '${deviceType || 'DESCONHECIDO'}' não autorizado para sessão 3C Waiter. Use um PDQ (POS_TERMINAL) ou Tablet de Garçom (WAITER_TABLET).`,
      });
    }

    if (!devData.storeId) {
      return res.status(403).json({ error: 'Dispositivo corporativo sem loja vinculada para operação no salão.' });
    }

    const storeSnap = await db.collection('stores').doc(String(devData.storeId)).get();
    if (!storeSnap.exists || storeSnap.data()?._deleted) {
      return res.status(403).json({ error: 'Loja vinculada ao dispositivo não encontrada ou removida.' });
    }
    const storeData = storeSnap.data() || {};
    if (String(storeData.status || 'ACTIVE').toUpperCase() === 'SUSPENDED') {
      return res.status(403).json({ error: 'Acesso bloqueado: estabelecimento suspenso.' });
    }

    const tenantId = String(storeData.tenantId || devData.tenantId || '');
    if (!tenantId) {
      return res.status(403).json({ error: 'Dispositivo sem empresa/tenant válida.' });
    }
    const tenantSnap = await db.collection('tenants').doc(tenantId).get();
    if (!tenantSnap.exists || String(tenantSnap.data()?.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') {
      return res.status(403).json({ error: 'Acesso bloqueado: empresa suspensa ou inativa no HQ Central.' });
    }

    const outcome = await pairDeviceRecord({
      id: matchedDoc.id,
      pairingCode: submittedCode,
      ipAddress,
      appVersion: appVersion || '5.2.1-waiter',
      actor: null,
      allowedRoles: STORE_DEVICE_MANAGER_ROLES,
      req,
      channel: 'store/devices',
    });

    if (outcome.status !== 200) {
      return res.status(outcome.status).json(outcome.body);
    }

    const cleanOperator =
      typeof operatorName === 'string' && operatorName.trim().length >= 2
        ? operatorName.trim()
        : '';
    const displayName = cleanOperator
      ? `${cleanOperator} (${devData.name || devData.deviceId || matchedDoc.id})`
      : (devData.name || `PDQ Salão • ${devData.deviceId || matchedDoc.id}`);

    const freshSnap = await db.collection('device_licenses').doc(matchedDoc.id).get();
    const freshDev = freshSnap.data() || devData;
    const tokenVersion = Number(freshDev.terminalTokenVersion) || 1;

    if (cleanOperator) {
      await db.collection('device_licenses').doc(matchedDoc.id).update({
        operatorName: cleanOperator,
        updatedAt: new Date().toISOString(),
      });
    }

    const terminalUid = `devterm-${matchedDoc.id}`;
    const resolvedDeviceId = String(freshDev.deviceId || matchedDoc.id);
    const token = auth.generateDevToken({
      typ: 'waiter_device',
      uid: terminalUid,
      name: displayName,
      role: 'WAITER',
      tenantId,
      storeId: String(devData.storeId),
      deviceDocId: matchedDoc.id,
      deviceId: resolvedDeviceId,
      tokenVersion,
    });

    res.json({
      success: true,
      token,
      deviceToken: outcome.body.deviceToken,
      device: outcome.body.device,
      store: {
        id: String(devData.storeId),
        name: storeData.name || String(devData.storeId),
      },
      user: {
        uid: terminalUid,
        email: '',
        name: displayName,
        role: 'WAITER',
        tenantId,
        storeId: String(devData.storeId),
        allowedStoreIds: [String(devData.storeId)],
        authProvider: 'STORE_DEVICE_PDQ',
        deviceDocId: matchedDoc.id,
        deviceId: resolvedDeviceId,
        emailVerified: false,
        mustChangePassword: false,
        permissions: [],
        blockedApps: [],
      },
    });
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao autenticar dispositivo/PDQ no 3C Waiter.' });
  }
});

export default router;
