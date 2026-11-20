import express from 'express';
import crypto from 'crypto';
import { db } from '../../config.ts';
import { verifyAutonomousToken, requireRoles, hasUserStoreAccess } from '../../middleware/auth.ts';
import { broadcastSseEvent } from '../../state.ts';
import { generateHlcTimestamp } from '../../../utils/idGenerator.ts';
import { stageSyncOutboxInTransaction } from '../../persistence/PersistenceDriver.ts';
import { stripPrototypePollution } from '../../utils/requestSanitizer.ts';

const router = express.Router();

const ALLOWED_COURIER_STATUSES = new Set(['AVAILABLE', 'BUSY', 'OFFLINE', 'ON_DELIVERY']);

router.get(
  '/drivers',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER', 'COURIER']),
  async (req, res) => {
    try {
      const { storeId } = req.query;
      const authenticatedUser = (req as any).user;
      const snap = await db.collection('drivers').get();
      let drivers = snap.docs.map(d => d.data()).filter(d => d && !d._deleted);

      if (authenticatedUser.role !== 'DEV_OWNER') {
        const userTenant = authenticatedUser.tenantId || 'tenant-1';
        drivers = drivers.filter(d => d.tenantId === userTenant);
      }
      if (storeId) {
        drivers = drivers.filter(
          (d) =>
            d.storeId === storeId ||
            d.fleetType === 'PLATFORM_FLEET' ||
            (Array.isArray(d.allowedFleetModes) && d.allowedFleetModes.includes('PLATFORM_FLEET'))
        );
      }

      res.json(drivers);
    } catch {
      res.status(500).json({ error: 'Erro ao listar motoristas.' });
    }
  }
);

router.post('/drivers', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const rawDriver = stripPrototypePollution(req.body || {});
    const authenticatedUser = (req as any).user;
    if (
      rawDriver.latitude !== undefined &&
      rawDriver.latitude !== null &&
      (typeof rawDriver.latitude !== 'number' ||
        !Number.isFinite(rawDriver.latitude) ||
        rawDriver.latitude < -90 ||
        rawDriver.latitude > 90)
    ) {
      return res.status(400).json({ error: 'Latitude inválida (deve estar entre -90 e 90).' });
    }
    if (
      rawDriver.longitude !== undefined &&
      rawDriver.longitude !== null &&
      (typeof rawDriver.longitude !== 'number' ||
        !Number.isFinite(rawDriver.longitude) ||
        rawDriver.longitude < -180 ||
        rawDriver.longitude > 180)
    ) {
      return res.status(400).json({ error: 'Longitude inválida (deve estar entre -180 e 180).' });
    }
    const id = rawDriver.id || `drv-${Date.now()}`;

    const existingSnap = await db.collection('drivers').doc(id).get();
    const existingData = existingSnap.exists ? existingSnap.data() : null;
    if (existingData && authenticatedUser.role !== 'DEV_OWNER') {
      if (existingData.tenantId !== authenticatedUser.tenantId) {
        return res.status(403).json({ error: 'Acesso negado: Motorista pertence a outra empresa/tenant.' });
      }
      if (existingData.storeId && !hasUserStoreAccess(authenticatedUser, existingData.storeId)) {
        return res.status(403).json({ error: 'Acesso negado: Motorista pertence a outra filial.' });
      }
    }

    if (
      authenticatedUser.role !== 'DEV_OWNER' &&
      rawDriver.storeId &&
      !hasUserStoreAccess(authenticatedUser, String(rawDriver.storeId))
    ) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }

    const isDriverCallerSingleLocked = Boolean(
      authenticatedUser.role !== 'DEV_OWNER' &&
      authenticatedUser.storeId &&
      !(Array.isArray(authenticatedUser.allowedStoreIds) && authenticatedUser.allowedStoreIds.length > 1)
    );
    const targetStoreId = isDriverCallerSingleLocked
      ? authenticatedUser.storeId
      : (rawDriver.storeId || existingData?.storeId || null);

    const tenantId = authenticatedUser.role === 'DEV_OWNER'
      ? (rawDriver.tenantId || existingData?.tenantId || authenticatedUser.tenantId)
      : authenticatedUser.tenantId;
    const { id: _ignoredId, tenantId: _ignoredTenant, storeId: _ignoredStore, ...cleanDriver } = rawDriver;
    const savedDriver = {
      ...(existingData || {}),
      ...cleanDriver,
      id,
      tenantId,
      ...(targetStoreId ? { storeId: targetStoreId } : {}),
      updatedAt: new Date().toISOString(),
    };

    await db.collection('drivers').doc(id).set(savedDriver, { merge: true });
    res.json({ success: true, driver: savedDriver });
  } catch {
    res.status(500).json({ error: 'Erro ao salvar motorista.' });
  }
});

router.put('/drivers/:id', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'COURIER']), async (req, res) => {
  try {
    const { id } = req.params;
    const authenticatedUser = (req as any).user;
    const bodyClean = stripPrototypePollution(req.body || {});
    const docRef = db.collection('drivers').doc(id);
    const snap = await docRef.get();

    if (
      bodyClean.latitude !== undefined &&
      bodyClean.latitude !== null &&
      (typeof bodyClean.latitude !== 'number' ||
        !Number.isFinite(bodyClean.latitude) ||
        bodyClean.latitude < -90 ||
        bodyClean.latitude > 90)
    ) {
      return res.status(400).json({ error: 'Latitude inválida (deve estar entre -90 e 90).' });
    }
    if (
      bodyClean.longitude !== undefined &&
      bodyClean.longitude !== null &&
      (typeof bodyClean.longitude !== 'number' ||
        !Number.isFinite(bodyClean.longitude) ||
        bodyClean.longitude < -180 ||
        bodyClean.longitude > 180)
    ) {
      return res.status(400).json({ error: 'Longitude inválida (deve estar entre -180 e 180).' });
    }

    if (authenticatedUser.role === 'COURIER') {
      if (bodyClean.status !== undefined && !ALLOWED_COURIER_STATUSES.has(String(bodyClean.status))) {
        return res.status(400).json({ error: `Status de entregador inválido: '${bodyClean.status}'.` });
      }
      if (
        bodyClean.activeOperationMode !== undefined &&
        bodyClean.activeOperationMode !== 'PLATFORM' &&
        bodyClean.activeOperationMode !== 'STORE'
      ) {
        return res.status(400).json({ error: "Modalidade de operação inválida. Use 'PLATFORM' ou 'STORE'." });
      }
    }

    if (!snap.exists) {
      if (authenticatedUser.role === 'COURIER' && id === authenticatedUser.uid) {
        const { status, latitude, longitude, activeOperationMode } = bodyClean;
        const hasStore = Boolean(authenticatedUser.storeId);
        if (activeOperationMode === 'STORE' && !hasStore) {
          return res.status(403).json({ error: 'Acesso negado: Conta não vinculada a nenhuma loja para Modo Loja.' });
        }
        const resolvedOpMode: 'PLATFORM' | 'STORE' =
          activeOperationMode === 'STORE' || (hasStore && activeOperationMode !== 'PLATFORM') ? 'STORE' : 'PLATFORM';
        const allowedFleetModes: ('PLATFORM_FLEET' | 'STORE_FLEET')[] = hasStore
          ? ['STORE_FLEET', 'PLATFORM_FLEET']
          : ['PLATFORM_FLEET'];
        const nowIso = new Date().toISOString();
        const newDriverDoc = {
          id: authenticatedUser.uid,
          uid: authenticatedUser.uid,
          name: authenticatedUser.name || 'Entregador Parceiro',
          phone: '',
          vehicle: 'SCOOTER',
          rating: 5.0,
          status: typeof status === 'string' ? status : 'AVAILABLE',
          fleetType: resolvedOpMode === 'STORE' ? 'STORE_FLEET' : 'PLATFORM_FLEET',
          allowedFleetModes,
          activeOperationMode: resolvedOpMode,
          accountStatus: 'ACTIVE',
          hqManaged: true,
          ...(authenticatedUser.storeId ? { storeId: authenticatedUser.storeId } : {}),
          totalDeliveries: 0,
          walletBalance: 0,
          avatar: '',
          tenantId: authenticatedUser.tenantId || 'tenant-1',
          ...(typeof latitude === 'number' ? { latitude } : {}),
          ...(typeof longitude === 'number' ? { longitude } : {}),
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        await docRef.set(newDriverDoc);
        return res.json({ success: true, driver: newDriverDoc });
      }
      return res.status(404).json({ error: 'Motorista não encontrado.' });
    }

    const driverData = snap.data() || {};
    if (authenticatedUser.role === 'COURIER') {
      if (driverData.uid !== authenticatedUser.uid && driverData.id !== authenticatedUser.uid) {
        return res.status(403).json({ error: 'Acesso negado: Entregador só pode atualizar seu próprio status/posição.' });
      }
      if (driverData.accountStatus === 'DISABLED') {
        return res.status(403).json({ error: 'Acesso negado: Conta de entregador temporariamente suspensa pela administração da plataforma.' });
      }

      const { status, latitude, longitude, activeOperationMode } = bodyClean;
      const courierPatch: Record<string, any> = { updatedAt: new Date().toISOString() };
      if (typeof status === 'string') courierPatch.status = status;
      if (typeof latitude === 'number') courierPatch.latitude = latitude;
      if (typeof longitude === 'number') courierPatch.longitude = longitude;

      if (activeOperationMode === 'PLATFORM' || activeOperationMode === 'STORE') {
        const hasStore = Boolean(driverData.storeId || authenticatedUser.storeId);
        const fallbackFleet = driverData.fleetType || (hasStore ? 'STORE_FLEET' : 'PLATFORM_FLEET');
        const allowedModes = new Set<string>(
          Array.isArray(driverData.allowedFleetModes) && driverData.allowedFleetModes.length > 0
            ? driverData.allowedFleetModes
            : [fallbackFleet]
        );
        if (hasStore && !driverData.allowedFleetModes) {
          allowedModes.add('STORE_FLEET');
        }
        if (activeOperationMode === 'PLATFORM' && !allowedModes.has('PLATFORM_FLEET')) {
          return res.status(403).json({ error: 'Sua conta está vinculada exclusivamente à frota da loja.' });
        }
        if (activeOperationMode === 'STORE' && (!allowedModes.has('STORE_FLEET') || !hasStore)) {
          return res.status(403).json({ error: 'Sua conta não possui vínculo de loja autorizado na plataforma.' });
        }
        courierPatch.activeOperationMode = activeOperationMode;
        courierPatch.fleetType = activeOperationMode === 'STORE' ? 'STORE_FLEET' : 'PLATFORM_FLEET';
      }

      await docRef.update(courierPatch);
      return res.json({ success: true, driver: { ...driverData, ...courierPatch } });
    }

    if (authenticatedUser.role !== 'DEV_OWNER') {
      if (driverData.tenantId !== authenticatedUser.tenantId) {
        return res.status(403).json({ error: 'Acesso negado: Motorista pertence a outra empresa/tenant.' });
      }
      if (driverData.storeId && !hasUserStoreAccess(authenticatedUser, driverData.storeId)) {
        return res.status(403).json({ error: 'Acesso negado: Motorista pertence a outra filial.' });
      }
      if (bodyClean.storeId && !hasUserStoreAccess(authenticatedUser, String(bodyClean.storeId))) {
        return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
      }
    }

    const { id: _ignoredId, tenantId: _ignoredTenant, createdAt: _ignoredCreated, ...cleanUpdates } = bodyClean;
    const isPutDriverSingleLocked = Boolean(
      authenticatedUser.role !== 'DEV_OWNER' &&
      authenticatedUser.storeId &&
      !(Array.isArray(authenticatedUser.allowedStoreIds) && authenticatedUser.allowedStoreIds.length > 1)
    );
    if (isPutDriverSingleLocked) {
      delete cleanUpdates.storeId;
    }
    const nowIso = new Date().toISOString();
    await docRef.update({ ...cleanUpdates, updatedAt: nowIso });

    // Mirror HQ fleet governance metadata back to users/{uid} when applicable
    const targetUserUid = driverData.uid || id;
    const userRef = db.collection('users').doc(String(targetUserUid));
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      const userMirror: Record<string, any> = { updatedAt: nowIso };
      if (cleanUpdates.fleetType !== undefined) userMirror.fleetType = cleanUpdates.fleetType;
      if (cleanUpdates.allowedFleetModes !== undefined) userMirror.allowedFleetModes = cleanUpdates.allowedFleetModes;
      if (cleanUpdates.vehicle !== undefined) userMirror.vehicle = cleanUpdates.vehicle;
      if (cleanUpdates.vehiclePlate !== undefined) userMirror.vehiclePlate = cleanUpdates.vehiclePlate;
      if (cleanUpdates.storeId !== undefined) userMirror.storeId = cleanUpdates.storeId;
      if (Object.keys(userMirror).length > 1) {
        await userRef.update(userMirror);
      }
    }

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar motorista.' });
  }
});

router.get(
  '/drivers/:id/payouts',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'COURIER']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const authenticatedUser = (req as any).user;
      const driverSnap = await db.collection('drivers').doc(id).get();
      if (authenticatedUser.role === 'COURIER') {
        const drv = driverSnap.exists ? driverSnap.data() : null;
        if (id !== authenticatedUser.uid && drv?.uid !== authenticatedUser.uid && drv?.id !== authenticatedUser.uid) {
          return res.status(403).json({ error: 'Acesso negado: Repasses pertencem a outro entregador.' });
        }
      } else if (authenticatedUser.role !== 'DEV_OWNER' && driverSnap.exists) {
        const drv = driverSnap.data();
        if (drv?.tenantId !== authenticatedUser.tenantId) {
          return res.status(403).json({ error: 'Acesso negado: Motorista pertence a outra empresa/tenant.' });
        }
      }

      const snap = await db.collection('driver_payouts').get();
      const payouts = snap.docs
        .map(d => d.data())
        .filter(p => p && p.driverId === id)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      res.json(payouts);
    } catch {
      res.status(500).json({ error: 'Erro ao listar repasses do entregador.' });
    }
  }
);

router.post(
  '/drivers/:id/withdraw',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'COURIER']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, pixKey } = req.body || {};
      const authenticatedUser = (req as any).user;

      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Valor de saque inválido: informe um valor maior que zero.' });
      }
      const cleanPixKey = typeof pixKey === 'string' ? pixKey.trim() : '';
      if (cleanPixKey.length < 3) {
        return res.status(400).json({ error: 'Chave PIX inválida: informe uma chave válida para o repasse.' });
      }

      const roundedAmount = Math.round(parsedAmount * 100) / 100;

      const txResult = await db.runTransaction(async (transaction) => {
        const driverRef = db.collection('drivers').doc(id);
        const driverSnap = await transaction.get(driverRef);
        if (!driverSnap.exists) {
          throw new Error('Motorista não encontrado.');
        }

        const driverData = driverSnap.data() || {};
        if (authenticatedUser.role === 'COURIER') {
          if (driverData.uid !== authenticatedUser.uid && driverData.id !== authenticatedUser.uid) {
            throw new Error('Acesso negado: Entregador só pode solicitar saque da própria carteira.');
          }
        } else if (authenticatedUser.role !== 'DEV_OWNER') {
          if (driverData.tenantId !== authenticatedUser.tenantId) {
            throw new Error('Acesso negado: Motorista pertence a outra empresa/tenant.');
          }
        }

        const currentBalance = Math.round((Number(driverData.walletBalance) || 0) * 100) / 100;
        if (roundedAmount > currentBalance) {
          throw new Error(`Saldo insuficiente na carteira (disponível: R$ ${currentBalance.toFixed(2)}).`);
        }

        const nextBalance = Math.round((currentBalance - roundedAmount) * 100) / 100;
        const nowIso = new Date().toISOString();
        const hlc = generateHlcTimestamp('cloud_core');
        const payoutId = `pay-${crypto.randomBytes(6).toString('hex')}`;
        const tenantId = driverData.tenantId || authenticatedUser.tenantId || 'tenant-1';

        const payoutDoc = {
          id: payoutId,
          driverId: id,
          driverName: driverData.name || authenticatedUser.name || 'Entregador',
          tenantId,
          storeId: driverData.storeId || null,
          amount: roundedAmount,
          pixKey: cleanPixKey,
          status: 'REQUESTED',
          requestedByUid: authenticatedUser.uid,
          hlc,
          createdAt: nowIso,
        };

        const finId = `fin-${payoutId}`;
        const finRecord = {
          id: finId,
          tenantId,
          storeId: driverData.storeId || 'CENTRAL_FLEET',
          type: 'PAYABLE',
          category: 'REPASSE_ENTREGADOR',
          description: `Repasse PIX Entregador ${payoutDoc.driverName} (${cleanPixKey})`,
          amount: roundedAmount,
          dueDate: nowIso.slice(0, 10),
          status: 'PENDING',
          payoutId,
          driverId: id,
          hlc,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        transaction.update(driverRef, {
          walletBalance: nextBalance,
          hlc,
          updatedAt: nowIso,
        });
        transaction.set(db.collection('driver_payouts').doc(payoutId), payoutDoc);
        transaction.set(db.collection('financial_records').doc(finId), finRecord);

        stageSyncOutboxInTransaction(transaction, {
          entity: 'drivers',
          entityId: id,
          operation: 'UPSERT',
          tenantId,
          storeId: driverData.storeId || null,
          hlc,
          payload: { ...driverData, id, walletBalance: nextBalance, hlc, updatedAt: nowIso },
        });
        stageSyncOutboxInTransaction(transaction, {
          entity: 'financial_records',
          entityId: finId,
          operation: 'UPSERT',
          tenantId,
          storeId: driverData.storeId || 'CENTRAL_FLEET',
          hlc,
          payload: finRecord,
        });

        return { payout: payoutDoc, walletBalance: nextBalance, tenantId };
      });

      broadcastSseEvent(
        'DRIVER_PAYOUT_REQUESTED',
        {
          payoutId: txResult.payout.id,
          driverId: id,
          storeId: txResult.payout.storeId || null,
          amount: txResult.payout.amount,
          walletBalance: txResult.walletBalance,
        },
        txResult.tenantId,
        true,
        {
          driverId: id,
          storeId: txResult.payout.storeId || null,
          allowedRoles: ['COURIER', 'DRIVER', 'DEV_OWNER', 'SUPER_ADMIN', 'STORE_OWNER', 'REGIONAL_MANAGER'],
        }
      );

      return res.status(201).json({
        success: true,
        payout: txResult.payout,
        walletBalance: txResult.walletBalance,
      });
    } catch (err: any) {
      const msg = err?.message || 'Erro ao processar solicitação de saque.';
      const status = msg.includes('Acesso negado')
        ? 403
        : msg.includes('não encontrado')
          ? 404
          : 400;
      return res.status(status).json({ error: msg });
    }
  }
);

export default router;
