import express from 'express';
import { db, runWithSystemDbContext } from '../../config.ts';
import {
  AuthenticatedRequestUser,
  hasUserStoreAccess,
  requireModuleAccess,
  requireRoles,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import {
  generateHlcTimestamp,
  generateReservationId,
  generateStandardId,
} from '../../../utils/idGenerator.ts';
import { hasReservationConflict } from '../../../utils/storeDomain.ts';
import { stageSyncOutboxInTransaction } from '../../persistence/PersistenceDriver.ts';
import {
  isSingleBranchLocked,
  omitKeys,
  stripPrototypePollution,
} from './storeAccessHelpers.ts';

const router = express.Router();

// ==========================================
// SUPPLIERS & RESERVATIONS ENDPOINTS
// ==========================================

router.get('/suppliers', verifyAutonomousToken, requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']), requireModuleAccess('suppliers'), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    if (authenticatedUser.role !== 'DEV_OWNER' && req.query.storeId && !hasUserStoreAccess(authenticatedUser, String(req.query.storeId))) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }
    const snap = await db.collection('suppliers').get();
    let suppliers = snap.docs.map(d => d.data()).filter(s => s && !s._deleted);

    if (authenticatedUser.role !== 'DEV_OWNER') {
      const userTenant = authenticatedUser.tenantId || 'tenant-1';
      suppliers = suppliers.filter(s => s.tenantId === userTenant && (!s.storeId || hasUserStoreAccess(authenticatedUser, s.storeId)));
    }
    if (req.query.storeId) {
      suppliers = suppliers.filter(s => !s.storeId || s.storeId === req.query.storeId);
    }

    res.json(suppliers);
  } catch {
    res.status(500).json({ error: 'Erro ao listar fornecedores.' });
  }
});

router.post('/suppliers', verifyAutonomousToken, requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']), requireModuleAccess('suppliers'), async (req, res) => {
  try {
    const rawSupplier = stripPrototypePollution(req.body || {});
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const id = rawSupplier.id || generateStandardId('sup');
    const cleanSupplier = omitKeys(
      rawSupplier,
      authenticatedUser.role === 'DEV_OWNER' ? ['id'] : ['id', 'tenantId', ...(isSingleBranchLocked(authenticatedUser) ? ['storeId'] : [])]
    );

    const savedSupplier = await db.runTransaction(async (transaction) => {
      const supRef = db.collection('suppliers').doc(id);
      const existingSnap = await transaction.get(supRef);
      if (existingSnap.exists && authenticatedUser.role !== 'DEV_OWNER') {
        if (existingSnap.data()?.tenantId !== authenticatedUser.tenantId) {
          const err: any = new Error('Acesso negado: Fornecedor pertence a outra empresa/tenant.');
          err.statusCode = 403;
          throw err;
        }
        if (existingSnap.data()?.storeId && !hasUserStoreAccess(authenticatedUser, existingSnap.data()?.storeId)) {
          const err: any = new Error('Acesso negado: Fornecedor pertence a outra filial.');
          err.statusCode = 403;
          throw err;
        }
      }

      const targetStoreId = rawSupplier.storeId || existingSnap.data()?.storeId || authenticatedUser.storeId;
      if (targetStoreId && authenticatedUser.role !== 'DEV_OWNER') {
        const storeSnap = await transaction.get(db.collection('stores').doc(String(targetStoreId)));
        if (!storeSnap.exists) {
          const err: any = new Error(`Loja '${targetStoreId}' não encontrada.`);
          err.statusCode = 404;
          throw err;
        }
        if (storeSnap.data()?.tenantId !== authenticatedUser.tenantId) {
          const err: any = new Error('Acesso negado: Loja pertence a outra empresa/tenant.');
          err.statusCode = 403;
          throw err;
        }
        if (!hasUserStoreAccess(authenticatedUser, String(targetStoreId))) {
          const err: any = new Error('Acesso negado: Perfil restrito a outra filial.');
          err.statusCode = 403;
          throw err;
        }
      }

      const tenantId = authenticatedUser.role === 'DEV_OWNER'
        ? (rawSupplier.tenantId || existingSnap.data()?.tenantId || authenticatedUser.tenantId)
        : authenticatedUser.tenantId;
      const supHlc = generateHlcTimestamp('cloud_core');
      const nextSupplier = {
        ...(existingSnap.exists ? existingSnap.data() : {}),
        ...cleanSupplier,
        id,
        tenantId,
        ...(targetStoreId ? { storeId: targetStoreId } : {}),
        hlc: supHlc,
        updatedAt: new Date().toISOString(),
      };

      transaction.set(supRef, nextSupplier, { merge: true });
      stageSyncOutboxInTransaction(transaction, {
        entity: 'suppliers',
        entityId: id,
        operation: 'UPSERT',
        tenantId: tenantId || 'tenant-1',
        storeId: nextSupplier.storeId || null,
        hlc: supHlc,
        payload: nextSupplier,
      });
      return nextSupplier;
    });

    res.json({ success: true, supplier: savedSupplier });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar fornecedor.' });
  }
});

router.delete('/suppliers/:id', verifyAutonomousToken, requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']), requireModuleAccess('suppliers'), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const { id } = req.params;

    await db.runTransaction(async (transaction) => {
      const supRef = db.collection('suppliers').doc(id);
      const snap = await transaction.get(supRef);

      if (!snap.exists) {
        const err: any = new Error('Fornecedor não encontrado.');
        err.statusCode = 404;
        throw err;
      }

      const prev = snap.data();
      if (authenticatedUser.role !== 'DEV_OWNER') {
        if (!prev?.tenantId || prev.tenantId !== authenticatedUser.tenantId) {
          const err: any = new Error('Acesso negado: Fornecedor pertence a outra empresa/tenant.');
          err.statusCode = 403;
          throw err;
        }
        if (prev?.storeId && !hasUserStoreAccess(authenticatedUser, prev.storeId)) {
          const err: any = new Error('Acesso negado: Perfil restrito a outra filial.');
          err.statusCode = 403;
          throw err;
        }
      }

      transaction.delete(supRef);
      stageSyncOutboxInTransaction(transaction, {
        entity: 'suppliers',
        entityId: id,
        operation: 'DELETE',
        tenantId: prev?.tenantId || authenticatedUser.tenantId || 'tenant-1',
        storeId: prev?.storeId || null,
        hlc: generateHlcTimestamp('cloud_core'),
        payload: { id },
      });
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao excluir fornecedor.' });
  }
});

router.get('/reservations', verifyAutonomousToken, async (req, res) => {
  try {
    const { storeId } = req.query;
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    if (
      authenticatedUser.role !== 'DEV_OWNER' &&
      !['CUSTOMER', 'CONSUMER'].includes(authenticatedUser.role) &&
      storeId &&
      !hasUserStoreAccess(authenticatedUser, String(storeId))
    ) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }
    const isConsumer = authenticatedUser.role === 'CUSTOMER' || authenticatedUser.role === 'CONSUMER';
    const snap = isConsumer
      ? await runWithSystemDbContext('CONSUMER_RESERVATIONS_LIST', () => db.collection('reservations').get())
      : await db.collection('reservations').get();
    let resList = snap.docs.map(d => d.data()).filter(r => r && !r._deleted);

    if (authenticatedUser.role === 'CUSTOMER' || authenticatedUser.role === 'CONSUMER') {
      resList = resList.filter(r => r.customerId === authenticatedUser.uid);
    } else if (authenticatedUser.role !== 'DEV_OWNER') {
      const userTenant = authenticatedUser.tenantId || 'tenant-1';
      resList = resList.filter(r => r.tenantId === userTenant && hasUserStoreAccess(authenticatedUser, r.storeId));
    }

    if (storeId) resList = resList.filter(r => r.storeId === storeId);
    res.json(resList);
  } catch {
    res.status(500).json({ error: 'Erro ao listar reservas.' });
  }
});

router.post('/reservations', verifyAutonomousToken, requireModuleAccess('reservations'), async (req, res) => {
  try {
    const rawRes = stripPrototypePollution(req.body || {});
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    if (authenticatedUser.role === 'DEV_OWNER' || authenticatedUser.role === 'SUPER_ADMIN') {
      return res.status(403).json({
        error: 'Acesso negado: Perfis de governança HQ não operam reservas diárias de estabelecimentos.',
      });
    }
    const id = rawRes.id || generateReservationId();

    const isConsumerRole = authenticatedUser.role === 'CUSTOMER' || authenticatedUser.role === 'CONSUMER';
    const existingSnap = isConsumerRole
      ? await runWithSystemDbContext('CONSUMER_RESERVATION_LOOKUP', () => db.collection('reservations').doc(id).get())
      : await db.collection('reservations').doc(id).get();
    const existingData = existingSnap.exists ? existingSnap.data() : null;
    if (existingData && authenticatedUser.role !== 'DEV_OWNER') {
      if (isConsumerRole) {
        if (existingData.customerId !== authenticatedUser.uid) {
          return res.status(403).json({ error: 'Acesso negado: Reserva pertence a outro cliente.' });
        }
      } else {
        if (existingData.tenantId !== authenticatedUser.tenantId) {
          return res.status(403).json({ error: 'Acesso negado: Reserva pertence a outra empresa/tenant.' });
        }
        if (!hasUserStoreAccess(authenticatedUser, existingData.storeId)) {
          return res.status(403).json({ error: 'Acesso negado: Reserva pertence a outra filial.' });
        }
      }
    }

    const targetStoreId = rawRes.storeId || existingData?.storeId || (!isConsumerRole ? authenticatedUser.storeId : undefined);
    let resolvedTenantId = existingData?.tenantId || authenticatedUser.tenantId;
    if (targetStoreId) {
      const storeMeta = await runWithSystemDbContext('RESERVATION_STORE_LOOKUP', async () => {
        const storeSnap = await db.collection('stores').doc(String(targetStoreId)).get();
        if (!storeSnap.exists) return { exists: false as const, tenantId: null as string | null, suspended: false };
        const sData = storeSnap.data() || {};
        const tId = sData.tenantId || null;
        const tenantSnap = tId ? await db.collection('tenants').doc(String(tId)).get() : null;
        const suspended = Boolean(
          (tenantSnap?.exists && String(tenantSnap.data()?.status || 'ACTIVE').toUpperCase() === 'SUSPENDED') ||
            String(sData.status || 'ACTIVE').toUpperCase() === 'SUSPENDED'
        );
        return { exists: true as const, tenantId: tId, suspended };
      });
      if (!storeMeta.exists) {
        return res.status(404).json({ error: `Loja '${targetStoreId}' não encontrada.` });
      }
      resolvedTenantId = storeMeta.tenantId || resolvedTenantId;
      if (authenticatedUser.role !== 'DEV_OWNER' && storeMeta.suspended) {
        return res.status(403).json({ error: 'Estabelecimento temporariamente indisponível na plataforma.' });
      }
      if (
        authenticatedUser.role !== 'DEV_OWNER' &&
        authenticatedUser.role !== 'CUSTOMER' &&
        authenticatedUser.role !== 'CONSUMER'
      ) {
        if (resolvedTenantId !== authenticatedUser.tenantId) {
          return res.status(403).json({ error: 'Acesso negado: Loja pertence a outra empresa/tenant.' });
        }
        if (!hasUserStoreAccess(authenticatedUser, String(targetStoreId))) {
          return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
        }
      }
    }

    const effectiveDateTime = rawRes.dateTime || existingData?.dateTime;
    const effectiveDate = rawRes.date || existingData?.date;
    const effectiveTime = rawRes.time || existingData?.time;
    if (!existingData && !effectiveDateTime && (!effectiveDate || !effectiveTime)) {
      return res.status(400).json({ error: 'Data e horário (dateTime ou date + time) são obrigatórios para criar reserva.' });
    }

    const isConsumerCaller = authenticatedUser.role === 'CUSTOMER' || authenticatedUser.role === 'CONSUMER';
    const cleanRes = omitKeys(rawRes, isConsumerCaller ? ['id', 'tenantId', 'customerId', 'status'] : ['id', 'tenantId']);

    const savedRes = await db.runTransaction(async (transaction) => {
      const resRef = db.collection('reservations').doc(id);
      const txExistingSnap = await transaction.get(resRef);
      const txExistingData = txExistingSnap.exists ? txExistingSnap.data() : existingData;

      const mergedCandidate = {
        ...(txExistingData || {}),
        ...rawRes,
        id,
        ...(targetStoreId ? { storeId: targetStoreId } : {}),
      };
      if (
        targetStoreId &&
        !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(String(mergedCandidate.status || 'CONFIRMED')) &&
        (mergedCandidate.dateTime || (mergedCandidate.date && mergedCandidate.time))
      ) {
        const allResSnap = await db.collection('reservations').get();
        const storeReservations = allResSnap.docs
          .map(d => d.data())
          .filter(r => r.id !== id && !r._deleted && r.storeId === targetStoreId);
        if (hasReservationConflict(storeReservations, mergedCandidate)) {
          const conflictErr: any = new Error(
            'Conflito de horário: já existe uma reserva ativa para este recurso/mesa na janela selecionada.'
          );
          conflictErr.statusCode = 409;
          throw conflictErr;
        }
      }

      const resHlc = generateHlcTimestamp('cloud_core');
      const nextRes = {
        ...(txExistingData || {}),
        ...cleanRes,
        id,
        tenantId: resolvedTenantId,
        ...(targetStoreId ? { storeId: targetStoreId } : {}),
        customerId: isConsumerCaller
          ? authenticatedUser.uid
          : (rawRes.customerId || txExistingData?.customerId || authenticatedUser.uid),
        ...(isConsumerCaller ? { status: txExistingData?.status || 'PENDING' } : {}),
        hlc: resHlc,
        updatedAt: new Date().toISOString()
      };

      transaction.set(resRef, nextRes, { merge: true });
      stageSyncOutboxInTransaction(transaction, {
        entity: 'reservations',
        entityId: id,
        operation: 'UPSERT',
        tenantId: resolvedTenantId || 'tenant-1',
        storeId: nextRes.storeId || null,
        hlc: resHlc,
        payload: nextRes,
      });
      return nextRes;
    }, resolvedTenantId ? { tenantId: resolvedTenantId, bypassRls: false, reason: 'RESERVATION_UPSERT' } : undefined);

    res.json({ success: true, reservation: savedRes });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar reserva.' });
  }
});

router.delete('/reservations/:id', verifyAutonomousToken, requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER', 'WAITER', 'CUSTOMER', 'CONSUMER']), requireModuleAccess('reservations'), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const { id } = req.params;
    const isConsumerDel = authenticatedUser.role === 'CUSTOMER' || authenticatedUser.role === 'CONSUMER';
    let consumerDelTenantId: string | undefined;
    if (isConsumerDel) {
      const preSnap = await runWithSystemDbContext('CONSUMER_RESERVATION_DEL_LOOKUP', () =>
        db.collection('reservations').doc(id).get()
      );
      if (!preSnap.exists) {
        return res.status(404).json({ error: 'Reserva não encontrada.' });
      }
      if (preSnap.data()?.customerId !== authenticatedUser.uid) {
        return res.status(403).json({ error: 'Acesso negado: Reserva pertence a outro cliente.' });
      }
      consumerDelTenantId = preSnap.data()?.tenantId ? String(preSnap.data()?.tenantId) : undefined;
    }

    await db.runTransaction(async (transaction) => {
      const docRef = db.collection('reservations').doc(id);
      const snap = await transaction.get(docRef);

      if (!snap.exists) {
        const err: any = new Error('Reserva não encontrada.');
        err.statusCode = 404;
        throw err;
      }

      const prev = snap.data();
      if (authenticatedUser.role !== 'DEV_OWNER') {
        if (authenticatedUser.role === 'CUSTOMER' || authenticatedUser.role === 'CONSUMER') {
          if (prev?.customerId !== authenticatedUser.uid) {
            const err: any = new Error('Acesso negado: Reserva pertence a outro cliente.');
            err.statusCode = 403;
            throw err;
          }
        } else {
          if (!prev?.tenantId || prev.tenantId !== authenticatedUser.tenantId) {
            const err: any = new Error('Acesso negado: Reserva pertence a outra empresa/tenant.');
            err.statusCode = 403;
            throw err;
          }
          if (prev?.storeId && !hasUserStoreAccess(authenticatedUser, prev.storeId)) {
            const err: any = new Error('Acesso negado: Perfil restrito a outra filial.');
            err.statusCode = 403;
            throw err;
          }
        }
      }

      transaction.delete(docRef);
      stageSyncOutboxInTransaction(transaction, {
        entity: 'reservations',
        entityId: id,
        operation: 'DELETE',
        tenantId: prev.tenantId || authenticatedUser.tenantId || 'tenant-1',
        storeId: prev.storeId || null,
        hlc: generateHlcTimestamp('cloud_core'),
        payload: { id },
      });
    }, consumerDelTenantId ? { tenantId: consumerDelTenantId, bypassRls: false, reason: 'CONSUMER_RESERVATION_DELETE' } : undefined);

    res.json({ success: true });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao deletar reserva.' });
  }
});

export default router;
