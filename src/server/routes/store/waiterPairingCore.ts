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
import driverFleetPairingRoutes from './driverFleetPairingRoutes.ts';

const router = express.Router();

const WAITER_PIN_ADMIN_ROLES = PAIRING_ADMIN_ROLES;
const WAITER_PIN_MAX_ATTEMPTS = PAIRING_PIN_MAX_ATTEMPTS;
const WAITER_PIN_LOCKOUT_MS = PAIRING_PIN_LOCKOUT_MS;
const generateWaiterPairingPin = generatePairingPin;
const normalizeWaiterPin = normalizePairingPin;

router.get(
  '/:id/waiter-pairing',
  verifyAutonomousToken,
  requireRoles(WAITER_PIN_ADMIN_ROLES),
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

        let pin = storeData.waiterPairingPin;
        let updatedAt = storeData.waiterPairingPinUpdatedAt || storeData.updatedAt || new Date().toISOString();

        if (!pin || normalizeWaiterPin(pin).length < 6) {
          pin = generateWaiterPairingPin();
          updatedAt = new Date().toISOString();
          transaction.update(storeRef, {
            waiterPairingPin: pin,
            waiterPairingPinUpdatedAt: updatedAt,
          });
        }

        return {
          ok: true as const,
          storeName: storeData.name || id,
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
        pin: outcome.pin,
        updatedAt: outcome.updatedAt,
      });
    } catch {
      res.status(500).json({ error: 'Erro ao consultar PIN de pareamento do garçom.' });
    }
  }
);

router.post(
  '/:id/waiter-pairing/regenerate',
  verifyAutonomousToken,
  requireRoles(WAITER_PIN_ADMIN_ROLES),
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

      const pin = generateWaiterPairingPin();
      const updatedAt = new Date().toISOString();
      await db.collection('stores').doc(id).update({
        waiterPairingPin: pin,
        waiterPairingPinUpdatedAt: updatedAt,
        waiterPinAttempts: 0,
        waiterPinLockedUntil: null,
      });

      const evtId = generateEventId();
      await db.collection('events').doc(evtId).set({
        id: evtId,
        type: 'WAITER_PAIRING_PIN_REGENERATED',
        payload: `PIN de pareamento BYOD de garçom regenerado para loja ${id}`,
        channel: 'store/waiter-pairing',
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
      res.status(500).json({ error: 'Erro ao regenerar PIN de pareamento do garçom.' });
    }
  }
);

router.post('/waiter-pairing/login', async (req, res) => {
  try {
    const { qrPayload, storeId: rawStoreId, pin: rawPin, operatorName } = req.body || {};

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
        return res.status(400).json({ error: 'Payload do QR Code de pareamento inválido.' });
      }
    }

    if (!resolvedStoreIdentifier) {
      return res.status(400).json({ error: 'Informe o identificador da loja (storeId ou slug).' });
    }

    const submittedNormalized = normalizeWaiterPin(resolvedPinInput);
    if (submittedNormalized.length !== 6) {
      return res.status(400).json({ error: 'Informe o PIN numérico de 6 dígitos exibido no painel da loja.' });
    }

    return await runWithSystemDbContext('WAITER_PAIRING_LOGIN', async () => {
    const storesSnap = await db.collection('stores').get();
    const matchedStoreDoc = storesSnap.docs.find((d) => {
      const s = d.data() || {};
      if (s._deleted) return false;
      return d.id === resolvedStoreIdentifier || String(s.slug || '').trim().toLowerCase() === resolvedStoreIdentifier.toLowerCase();
    });

    if (!matchedStoreDoc) {
      return res.status(404).json({ error: `Loja '${resolvedStoreIdentifier}' não encontrada.` });
    }

    const callerIp = req.ip?.replace(/^::ffff:/, '') || '127.0.0.1';
    const cleanOperator =
      typeof operatorName === 'string' && operatorName.trim().length >= 2
        ? operatorName.trim()
        : '';

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

      if (storeData.waiterPinLockedUntil && new Date(storeData.waiterPinLockedUntil).getTime() > Date.now()) {
        return {
          ok: false as const,
          status: 429,
          error: 'Pareamento por PIN temporariamente bloqueado por excesso de tentativas. Regenere o PIN no painel da loja.',
        };
      }

      const expectedNormalized = normalizeWaiterPin(storeData.waiterPairingPin);
      if (!expectedNormalized) {
        return {
          ok: false as const,
          status: 401,
          error: 'PIN de pareamento ainda não gerado no caixa/salão desta loja.',
        };
      }

      if (
        submittedNormalized.length !== expectedNormalized.length ||
        !timingSafeEqualStr(submittedNormalized, expectedNormalized)
      ) {
        const nextAttempts = (Number(storeData.waiterPinAttempts) || 0) + 1;
        const locked = nextAttempts >= WAITER_PIN_MAX_ATTEMPTS;
        const lockUntil = locked ? new Date(Date.now() + WAITER_PIN_LOCKOUT_MS).toISOString() : null;
        transaction.update(storeRef, {
          waiterPinAttempts: nextAttempts,
          ...(locked ? { waiterPinLockedUntil: lockUntil } : {}),
          updatedAt: new Date().toISOString(),
        });
        return {
          ok: false as const,
          status: locked ? 429 : 401,
          error: locked
            ? 'Limite de tentativas inválidas atingido. Pareamento bloqueado por 15 minutos.'
            : 'PIN de pareamento inválido. Confira o código exibido no painel da loja.',
        };
      }

      const nowIso = new Date().toISOString();
      const terminalId = `wterm-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const storeName = storeData.name || matchedStoreDoc.id;
      const displayName = cleanOperator || `Terminal Salão • ${storeName}`;

      transaction.update(storeRef, {
        waiterPinAttempts: 0,
        waiterPinLockedUntil: null,
        updatedAt: nowIso,
      });

      transaction.set(db.collection('waiter_terminals').doc(terminalId), {
        id: terminalId,
        storeId: matchedStoreDoc.id,
        tenantId,
        operatorName: displayName,
        status: 'ACTIVE',
        tokenVersion: 1,
        ipAddress: callerIp,
        pairedAt: nowIso,
        updatedAt: nowIso,
      });

      return {
        ok: true as const,
        terminalId,
        storeId: matchedStoreDoc.id,
        tenantId,
        storeName,
        displayName,
        nowIso,
      };
    });

    if (!txResult.ok) {
      return res.status(txResult.status).json({ error: txResult.error });
    }

    const evtId = generateEventId();
    await db.collection('events').doc(evtId).set({
      id: evtId,
      type: 'WAITER_TERMINAL_PAIRED',
      payload: `Terminal de salão '${txResult.displayName}' pareado na loja ${txResult.storeId} (IP: ${callerIp})`,
      channel: 'store/waiter-pairing',
      tenantId: txResult.tenantId,
      actorUid: txResult.terminalId,
      timestamp: txResult.nowIso,
    });

    const token = auth.generateDevToken({
      typ: 'waiter_device',
      uid: txResult.terminalId,
      terminalId: txResult.terminalId,
      name: txResult.displayName,
      role: 'WAITER',
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
      user: {
        uid: txResult.terminalId,
        email: '',
        name: txResult.displayName,
        role: 'WAITER',
        tenantId: txResult.tenantId,
        storeId: txResult.storeId,
        allowedStoreIds: [txResult.storeId],
        authProvider: 'WAITER_PIN_TERMINAL',
        terminalId: txResult.terminalId,
        emailVerified: false,
        mustChangePassword: false,
        permissions: [],
        blockedApps: [],
      },
    });
    });
  } catch {
    res.status(500).json({ error: 'Erro ao autenticar terminal de garçom via QR/PIN.' });
  }
});

router.post('/waiter-pairing/disconnect', verifyAutonomousToken, async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    if (authenticatedUser.terminalId) {
      const termRef = db.collection('waiter_terminals').doc(authenticatedUser.terminalId);
      const snap = await termRef.get();
      if (snap.exists) {
        const nowIso = new Date().toISOString();
        await termRef.update({
          status: 'DISCONNECTED',
          disconnectedAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erro ao desconectar terminal do salão.' });
  }
});

router.post(
  '/:id/waiter-pairing/verify',
  verifyAutonomousToken,
  requireRoles([...WAITER_PIN_ADMIN_ROLES, 'WAITER']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { pin } = req.body || {};
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
      const access = await verifyStoreTenantAccess(id, authenticatedUser);
      if (access.ok === false) {
        return res.status(access.status).json({ error: access.error });
      }

      const storeData = access.store || {};
      if (
        String(storeData.status || 'ACTIVE').toUpperCase() === 'SUSPENDED' ||
        String(storeData.tenantStatus || 'ACTIVE').toUpperCase() === 'SUSPENDED'
      ) {
        return res.status(403).json({ error: 'Acesso bloqueado: estabelecimento suspenso.' });
      }
      const expectedNormalized = normalizeWaiterPin(storeData.waiterPairingPin);
      const submittedNormalized = normalizeWaiterPin(pin);

      if (!expectedNormalized) {
        return res.status(401).json({ error: 'PIN de pareamento ainda não gerado no caixa/salão desta loja.' });
      }
      if (!submittedNormalized || submittedNormalized.length !== expectedNormalized.length || !timingSafeEqualStr(submittedNormalized, expectedNormalized)) {
        return res.status(401).json({ error: 'PIN de pareamento inválido. Confira o código exibido no painel da loja.' });
      }

      res.json({
        success: true,
        verified: true,
        storeId: id,
        storeName: storeData.name || id,
      });
    } catch {
      res.status(500).json({ error: 'Erro ao validar PIN de pareamento do garçom.' });
    }
  }
);

router.use('/', driverFleetPairingRoutes);

export default router;

