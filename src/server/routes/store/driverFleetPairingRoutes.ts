import express from 'express';
import crypto from 'crypto';
import { auth, db, runWithSystemDbContext } from '../../config.ts';
import {
  AuthenticatedRequestUser,
  hasUserStoreAccess,
  requireRoles,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import { generateEventId } from '../../../utils/idGenerator.ts';
import { timingSafeEqualStr } from '../../utils/deviceLicensing.ts';
import { verifyStoreTenantAccess } from './storeAccessHelpers.ts';
import {
  PAIRING_ADMIN_ROLES,
  PAIRING_PIN_LOCKOUT_MS,
  PAIRING_PIN_MAX_ATTEMPTS,
  generatePairingPin,
  normalizePairingPin,
} from './pairingHelpers.ts';

const router = express.Router();

// ==========================================
// OWN-FLEET DRIVER QR CODE & 6-DIGIT PIN PAIRING
// ==========================================

router.get(
  '/:id/driver-pairing',
  verifyAutonomousToken,
  requireRoles(PAIRING_ADMIN_ROLES),
  async (req, res) => {
    try {
      const { id } = req.params;
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;

      const outcome = await db.runTransaction(async (transaction) => {
        const storeRef = db.collection('stores').doc(id);
        const storeSnap = await transaction.get(storeRef);
        if (!storeSnap.exists || storeSnap.data()?._deleted) {
          return { ok: false as const, status: 404, error: `Loja '${id}' não encontrada.` };
        }
        const storeData = storeSnap.data() || {};
        if (
          String(storeData.status || 'ACTIVE').toUpperCase() === 'SUSPENDED' ||
          String(storeData.tenantStatus || 'ACTIVE').toUpperCase() === 'SUSPENDED'
        ) {
          return { ok: false as const, status: 403, error: 'Acesso bloqueado: estabelecimento suspenso.' };
        }
        if (authenticatedUser.role !== 'DEV_OWNER') {
          if (storeData.tenantId !== authenticatedUser.tenantId) {
            return { ok: false as const, status: 403, error: 'Acesso negado: Loja pertence a outra empresa/tenant.' };
          }
          if (!hasUserStoreAccess(authenticatedUser, id)) {
            return { ok: false as const, status: 403, error: 'Acesso negado: Perfil restrito a outra filial.' };
          }
        }

        let pin = storeData.driverPairingPin;
        let updatedAt = storeData.driverPairingPinUpdatedAt || storeData.updatedAt || new Date().toISOString();

        if (!pin || normalizePairingPin(pin).length < 6) {
          pin = generatePairingPin();
          updatedAt = new Date().toISOString();
          transaction.update(storeRef, {
            driverPairingPin: pin,
            driverPairingPinUpdatedAt: updatedAt,
          });
        }

        return {
          ok: true as const,
          storeName: storeData.name || id,
          deliveryModality: storeData.deliveryModality || 'STORE_FLEET',
          pin,
          updatedAt,
        };
      });

      if (outcome.ok === false) {
        return res.status(outcome.status).json({ error: outcome.error });
      }

      res.json({
        storeId: id,
        storeName: outcome.storeName,
        deliveryModality: outcome.deliveryModality,
        pin: outcome.pin,
        updatedAt: outcome.updatedAt,
      });
    } catch {
      res.status(500).json({ error: 'Erro ao consultar QR/PIN de pareamento da frota própria.' });
    }
  }
);

router.post(
  '/:id/driver-pairing/regenerate',
  verifyAutonomousToken,
  requireRoles(PAIRING_ADMIN_ROLES),
  async (req, res) => {
    try {
      const { id } = req.params;
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
      const access = await verifyStoreTenantAccess(id, authenticatedUser);
      if (access.ok === false) {
        return res.status(access.status).json({ error: access.error });
      }
      if (
        String(access.store?.status || 'ACTIVE').toUpperCase() === 'SUSPENDED' ||
        String(access.store?.tenantStatus || 'ACTIVE').toUpperCase() === 'SUSPENDED'
      ) {
        return res.status(403).json({ error: 'Acesso bloqueado: estabelecimento suspenso.' });
      }

      const pin = generatePairingPin();
      const updatedAt = new Date().toISOString();
      await db.collection('stores').doc(id).update({
        driverPairingPin: pin,
        driverPairingPinUpdatedAt: updatedAt,
        driverPinAttempts: 0,
        driverPinLockedUntil: null,
      });

      const evtId = generateEventId();
      await db.collection('events').doc(evtId).set({
        id: evtId,
        type: 'DRIVER_PAIRING_PIN_REGENERATED',
        payload: `QR Code / PIN de pareamento de motorista próprio regenerado para loja ${id}`,
        channel: 'store/driver-pairing',
        tenantId: access.store?.tenantId || authenticatedUser.tenantId,
        actorUid: authenticatedUser.uid,
        timestamp: updatedAt,
      });

      res.json({
        success: true,
        storeId: id,
        pin,
        updatedAt,
      });
    } catch {
      res.status(500).json({ error: 'Erro ao regenerar QR/PIN de pareamento da frota própria.' });
    }
  }
);

router.post('/driver-pairing/login', async (req, res) => {
  try {
    const {
      qrPayload,
      storeId: rawStoreId,
      pin: rawPin,
      driverName,
      phone,
      vehicle,
      vehiclePlate,
    } = req.body || {};

    let resolvedStoreIdentifier = typeof rawStoreId === 'string' ? rawStoreId.trim() : '';
    let resolvedPinInput = rawPin;

    if (qrPayload) {
      try {
        const parsedQr = typeof qrPayload === 'string' ? JSON.parse(qrPayload) : qrPayload;
        if (parsedQr && typeof parsedQr === 'object') {
          if (!resolvedStoreIdentifier && typeof parsedQr.storeId === 'string') {
            resolvedStoreIdentifier = parsedQr.storeId.trim();
          }
          if (!resolvedPinInput && parsedQr.pin) {
            resolvedPinInput = parsedQr.pin;
          }
        }
      } catch {
        return res.status(400).json({ error: 'Payload do QR Code de pareamento da frota inválido.' });
      }
    }

    if (!resolvedStoreIdentifier) {
      return res.status(400).json({ error: 'Informe o identificador da loja (storeId ou slug).' });
    }

    const submittedNormalized = normalizePairingPin(resolvedPinInput);
    if (submittedNormalized.length !== 6) {
      return res.status(400).json({ error: 'Informe o PIN numérico de 6 dígitos do QR Code da Frota Própria.' });
    }

    return await runWithSystemDbContext('DRIVER_PAIRING_LOGIN', async () => {
      const storesSnap = await db.collection('stores').get();
      const matchedStoreDoc = storesSnap.docs.find((d) => {
        const s = d.data() || {};
        if (s._deleted) return false;
        return (
          d.id === resolvedStoreIdentifier ||
          String(s.slug || '').trim().toLowerCase() === resolvedStoreIdentifier.toLowerCase()
        );
      });

      if (!matchedStoreDoc) {
        return res.status(404).json({ error: `Loja '${resolvedStoreIdentifier}' não encontrada.` });
      }

      const callerIp = req.ip?.replace(/^::ffff:/, '') || '127.0.0.1';
      const cleanDriverName =
        typeof driverName === 'string' && driverName.trim().length >= 2
          ? driverName.trim()
          : '';
      const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
      const rawVehicle = String(vehicle || 'SCOOTER').toUpperCase();
      const cleanVehicle: 'SCOOTER' | 'BIKE' | 'CAR' =
        rawVehicle === 'BIKE' || rawVehicle === 'CAR' ? rawVehicle : 'SCOOTER';
      const cleanPlate = typeof vehiclePlate === 'string' ? vehiclePlate.trim().toUpperCase() : '';

      const txResult = await db.runTransaction(async (transaction) => {
        const storeRef = db.collection('stores').doc(matchedStoreDoc.id);
        const storeSnap = await transaction.get(storeRef);
        if (!storeSnap.exists || storeSnap.data()?._deleted) {
          return { ok: false as const, status: 404, error: 'Loja não encontrada.' };
        }
        const storeData = storeSnap.data() || {};
        if (String(storeData.status || 'ACTIVE').toUpperCase() === 'SUSPENDED') {
          return { ok: false as const, status: 403, error: 'Acesso bloqueado: estabelecimento suspenso.' };
        }

        const tenantId = String(storeData.tenantId || '');
        if (!tenantId) {
          return { ok: false as const, status: 403, error: 'Estabelecimento sem empresa/tenant válida.' };
        }
        const tenantSnap = await transaction.get(db.collection('tenants').doc(tenantId));
        if (!tenantSnap.exists || String(tenantSnap.data()?.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') {
          return { ok: false as const, status: 403, error: 'Acesso bloqueado: empresa temporariamente inativa na plataforma.' };
        }

        if (storeData.driverPinLockedUntil && new Date(storeData.driverPinLockedUntil).getTime() > Date.now()) {
          return {
            ok: false as const,
            status: 429,
            error: 'Pareamento de frota temporariamente bloqueado por excesso de tentativas. Regenere o QR/PIN no painel da loja.',
          };
        }

        const expectedNormalized = normalizePairingPin(storeData.driverPairingPin);
        if (!expectedNormalized) {
          return {
            ok: false as const,
            status: 401,
            error: 'QR Code / PIN de Frota Própria ainda não gerado no Store OS desta loja.',
          };
        }

        if (
          submittedNormalized.length !== expectedNormalized.length ||
          !timingSafeEqualStr(submittedNormalized, expectedNormalized)
        ) {
          const nextAttempts = (Number(storeData.driverPinAttempts) || 0) + 1;
          const locked = nextAttempts >= PAIRING_PIN_MAX_ATTEMPTS;
          const lockUntil = locked ? new Date(Date.now() + PAIRING_PIN_LOCKOUT_MS).toISOString() : null;
          transaction.update(storeRef, {
            driverPinAttempts: nextAttempts,
            ...(locked ? { driverPinLockedUntil: lockUntil } : {}),
            updatedAt: new Date().toISOString(),
          });
          return {
            ok: false as const,
            status: locked ? 429 : 401,
            error: locked
              ? 'Limite de tentativas inválidas atingido. Pareamento bloqueado por 15 minutos.'
              : 'PIN de pareamento da frota inválido. Confira o QR Code exibido no Store OS.',
          };
        }

        const nowIso = new Date().toISOString();
        const driverUid = `drv-own-${matchedStoreDoc.id}-${crypto.randomBytes(4).toString('hex')}`;
        const storeName = storeData.name || matchedStoreDoc.id;
        const displayName = cleanDriverName || `Motorista Próprio • ${storeName}`;

        transaction.update(storeRef, {
          driverPinAttempts: 0,
          driverPinLockedUntil: null,
          updatedAt: nowIso,
        });

        const userProfileDoc = {
          uid: driverUid,
          id: driverUid,
          email: `${driverUid}@frota.local`,
          name: displayName,
          phone: cleanPhone,
          role: 'COURIER',
          tenantId,
          storeId: matchedStoreDoc.id,
          allowedStoreIds: [matchedStoreDoc.id],
          status: 'ACTIVE',
          authProvider: 'DRIVER_QR_PIN_PAIRING',
          tokenVersion: 1,
          emailVerified: true,
          mustChangePassword: false,
          permissions: [],
          blockedApps: [],
          ipAddress: callerIp,
          pairedAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        const driverRecordDoc = {
          id: driverUid,
          uid: driverUid,
          name: displayName,
          phone: cleanPhone || storeData.phone || '(43) 99999-0000',
          vehicle: cleanVehicle,
          vehiclePlate: cleanPlate || 'FROTA-LOJA',
          rating: 5.0,
          status: 'AVAILABLE',
          fleetType: 'STORE_FLEET',
          allowedFleetModes: ['STORE_FLEET', 'PLATFORM_FLEET'],
          activeOperationMode: 'STORE',
          accountStatus: 'ACTIVE',
          hqManaged: false,
          storeId: matchedStoreDoc.id,
          tenantId,
          totalDeliveries: 0,
          walletBalance: 0,
          avatar: '',
          ...(typeof storeData.latitude === 'number' ? { latitude: storeData.latitude } : {}),
          ...(typeof storeData.longitude === 'number' ? { longitude: storeData.longitude } : {}),
          pairedAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        transaction.set(db.collection('users').doc(driverUid), userProfileDoc);
        transaction.set(db.collection('drivers').doc(driverUid), driverRecordDoc);

        return {
          ok: true as const,
          driverUid,
          storeId: matchedStoreDoc.id,
          tenantId,
          storeName,
          displayName,
          userProfileDoc,
          driverRecordDoc,
          nowIso,
        };
      });

      if (!txResult.ok) {
        return res.status(txResult.status).json({ error: txResult.error });
      }

      const evtId = generateEventId();
      await db.collection('events').doc(evtId).set({
        id: evtId,
        type: 'OWN_FLEET_DRIVER_PAIRED',
        payload: `Motorista próprio '${txResult.displayName}' pareado via QR/PIN na loja ${txResult.storeId}`,
        channel: 'store/driver-pairing',
        tenantId: txResult.tenantId,
        actorUid: txResult.driverUid,
        timestamp: txResult.nowIso,
      });

      const token = auth.generateDevToken({
        uid: txResult.driverUid,
        email: txResult.userProfileDoc.email,
        email_verified: true,
        name: txResult.displayName,
        role: 'COURIER',
        tenantId: txResult.tenantId,
        storeId: txResult.storeId,
        tokenVersion: 1,
      });

      res.json({
        success: true,
        token,
        store: {
          id: txResult.storeId,
          name: txResult.storeName,
        },
        driver: txResult.driverRecordDoc,
        user: {
          uid: txResult.driverUid,
          email: txResult.userProfileDoc.email,
          name: txResult.displayName,
          phone: txResult.userProfileDoc.phone,
          role: 'COURIER',
          tenantId: txResult.tenantId,
          storeId: txResult.storeId,
          allowedStoreIds: [txResult.storeId],
          authProvider: 'DRIVER_QR_PIN_PAIRING',
          emailVerified: true,
          mustChangePassword: false,
          permissions: [],
          blockedApps: [],
        },
      });
    });
  } catch {
    res.status(500).json({ error: 'Erro ao parear motorista da frota própria via QR/PIN.' });
  }
});

router.post(
  '/:id/driver-pairing/verify',
  verifyAutonomousToken,
  requireRoles([...PAIRING_ADMIN_ROLES, 'COURIER', 'DRIVER']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { pin, vehicle, vehiclePlate } = req.body || {};
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;

      return await runWithSystemDbContext('DRIVER_PAIRING_VERIFY', async () => {
        const storeRef = db.collection('stores').doc(id);
        const storeSnap = await storeRef.get();
        if (!storeSnap.exists || storeSnap.data()?._deleted) {
          return res.status(404).json({ error: `Loja '${id}' não encontrada.` });
        }
        const storeData = storeSnap.data() || {};
        if (
          String(storeData.status || 'ACTIVE').toUpperCase() === 'SUSPENDED' ||
          String(storeData.tenantStatus || 'ACTIVE').toUpperCase() === 'SUSPENDED'
        ) {
          return res.status(403).json({ error: 'Acesso bloqueado: estabelecimento suspenso.' });
        }

        const expectedNormalized = normalizePairingPin(storeData.driverPairingPin);
        const submittedNormalized = normalizePairingPin(pin);

        if (!expectedNormalized) {
          return res.status(401).json({ error: 'QR Code / PIN de Frota Própria ainda não gerado no Store OS desta loja.' });
        }
        if (
          !submittedNormalized ||
          submittedNormalized.length !== expectedNormalized.length ||
          !timingSafeEqualStr(submittedNormalized, expectedNormalized)
        ) {
          return res.status(401).json({ error: 'PIN de pareamento da frota inválido. Confira o código exibido no Store OS.' });
        }

        const nowIso = new Date().toISOString();
        const roleUpper = String(authenticatedUser.role || '').toUpperCase();
        if (roleUpper === 'COURIER' || roleUpper === 'DRIVER') {
          const driverRef = db.collection('drivers').doc(authenticatedUser.uid);
          const driverSnap = await driverRef.get();
          const existingDriver = driverSnap.exists ? driverSnap.data() || {} : {};
          const rawVehicle = String(vehicle || existingDriver.vehicle || 'SCOOTER').toUpperCase();
          const cleanVehicle: 'SCOOTER' | 'BIKE' | 'CAR' =
            rawVehicle === 'BIKE' || rawVehicle === 'CAR' ? rawVehicle : 'SCOOTER';

          const driverPatch = {
            ...existingDriver,
            id: authenticatedUser.uid,
            uid: authenticatedUser.uid,
            name: existingDriver.name || authenticatedUser.name || 'Motorista Próprio',
            phone: existingDriver.phone || '',
            vehicle: cleanVehicle,
            ...(vehiclePlate ? { vehiclePlate: String(vehiclePlate).trim().toUpperCase() } : {}),
            rating: existingDriver.rating || 5.0,
            status: existingDriver.status && existingDriver.status !== 'OFFLINE' ? existingDriver.status : 'AVAILABLE',
            fleetType: 'STORE_FLEET',
            allowedFleetModes: ['STORE_FLEET', 'PLATFORM_FLEET'],
            activeOperationMode: 'STORE',
            storeId: id,
            tenantId: storeData.tenantId || authenticatedUser.tenantId || 'tenant-1',
            totalDeliveries: Number(existingDriver.totalDeliveries) || 0,
            walletBalance: Number(existingDriver.walletBalance) || 0,
            avatar: existingDriver.avatar && !String(existingDriver.avatar).startsWith('/src/assets/') ? existingDriver.avatar : '',
            updatedAt: nowIso,
          };
          await driverRef.set(driverPatch, { merge: true });
          await db.collection('users').doc(authenticatedUser.uid).set(
            {
              storeId: id,
              tenantId: storeData.tenantId || authenticatedUser.tenantId || 'tenant-1',
              allowedStoreIds: [id],
              updatedAt: nowIso,
            },
            { merge: true }
          );
        }

        return res.json({
          success: true,
          verified: true,
          storeId: id,
          storeName: storeData.name || id,
        });
      });
    } catch {
      res.status(500).json({ error: 'Erro ao validar PIN de pareamento da frota própria.' });
    }
  }
);

export default router;
