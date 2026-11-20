import express from 'express';
import { db, runWithSystemDbContext } from '../../config.ts';
import { verifyAutonomousToken, requireRoles, resolveOptionalUser, AuthenticatedRequestUser } from '../../middleware/auth.ts';
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
import {
  DEVICE_MANAGER_ROLES,
  HQ_ONLY_ROLES,
} from './adminHelpersCore.ts';
import integrationsCore, { sanitizeIntegrationForResponse } from './integrationsCore.ts';

export { sanitizeIntegrationForResponse };

const router = express.Router();

// ==========================================
// DEVICE LICENSES ENDPOINTS (HQ GLOBAL)
// ==========================================

router.get(
  '/devices',
  verifyAutonomousToken,
  requireRoles(HQ_ONLY_ROLES),
  async (req, res) => {
    try {
      const requestedStoreId = req.query.storeId ? String(req.query.storeId) : '';
      const requestedTenantId = req.query.tenantId ? String(req.query.tenantId) : '';

      const snap = await db.collection('device_licenses').get();
      let devices = snap.docs.map(d => d.data());

      if (requestedTenantId) {
        devices = devices.filter(d => d.tenantId === requestedTenantId);
      }
      if (requestedStoreId) {
        devices = devices.filter(d => d.storeId === requestedStoreId);
      }

      res.json(devices.map(sanitizeDeviceForResponse));
    } catch {
      res.status(500).json({ error: 'Erro ao listar dispositivos.' });
    }
  }
);

router.post('/devices', verifyAutonomousToken, requireRoles(HQ_ONLY_ROLES), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const outcome = await upsertDeviceLicense({
      license: req.body || {},
      actor: authenticatedUser,
      req,
      channel: 'hq/devices',
      allowHqConsole: true,
    });
    res.status(outcome.status).json(outcome.body);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao salvar licença de dispositivo.' });
  }
});

router.post('/devices/:id/regenerate-pairing', verifyAutonomousToken, requireRoles(HQ_ONLY_ROLES), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const outcome = await regenerateDevicePairing({
      id: req.params.id,
      actor: authenticatedUser,
      req,
      channel: 'hq/devices',
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

    const outcome = await runWithSystemDbContext('HQ_DEVICE_PAIR', () =>
      pairDeviceRecord({
        id,
        pairingCode,
        ipAddress,
        appVersion,
        actor: authenticatedUser,
        allowedRoles: DEVICE_MANAGER_ROLES,
        req,
        channel: 'hq/devices',
      })
    );
    res.status(outcome.status).json(outcome.body);
  } catch (err: any) {
    console.error('PAIR ERROR:', err);
    res.status(500).json({ error: 'Falha ao parear dispositivo.', detail: err?.message });
  }
});

router.post('/devices/:id/heartbeat', async (req, res) => {
  try {
    const { id } = req.params;
    const { appVersion } = req.body || {};
    const authHeader = req.headers.authorization;
    const xDeviceToken = typeof req.headers['x-device-token'] === 'string' ? req.headers['x-device-token'].trim() : '';

    const result = await runWithSystemDbContext('HQ_DEVICE_HEARTBEAT', async () => {
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
          return { status: 401 as const, body: { error: userErr || 'Token de operador inválido para heartbeat.' } };
        }
        if (!HQ_ONLY_ROLES.includes(callerUser.role)) {
          return { status: 403 as const, body: { error: 'Perfil sem permissão administrativa para heartbeat HQ.' } };
        }
        authorized = true;
      }

      if (!authorized) {
        return { status: 401 as const, body: { error: 'Autenticação obrigatória para heartbeat (x-device-token ou Bearer válido).' } };
      }

      const nowIso = new Date().toISOString();
      const callerIp = req.ip?.replace(/^::ffff:/, '') || '127.0.0.1';
      const patch: Record<string, any> = {
        status: 'ONLINE',
        lastPing: nowIso,
        lastHeartbeatAt: nowIso,
        ipAddress: callerIp,
        updatedAt: nowIso
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

router.post('/devices/:id/revoke-token', verifyAutonomousToken, requireRoles(HQ_ONLY_ROLES), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const outcome = await revokeDeviceTokenRecord({
      id: req.params.id,
      actor: authenticatedUser,
      req,
      channel: 'hq/devices',
    });
    res.status(outcome.status).json(outcome.body);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao revogar credencial do dispositivo.' });
  }
});

router.delete('/devices/:id', verifyAutonomousToken, requireRoles(HQ_ONLY_ROLES), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const outcome = await deleteDeviceLicenseRecord({
      id: req.params.id,
      actor: authenticatedUser,
      req,
      channel: 'hq/devices',
    });
    res.status(outcome.status).json(outcome.body);
  } catch {
    res.status(500).json({ error: 'Erro ao deletar dispositivo.' });
  }
});

router.use(integrationsCore);

export default router;
