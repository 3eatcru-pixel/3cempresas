import express from 'express';
import { db, runWithSystemDbContext } from '../../config.ts';
import {
  AuthenticatedRequestUser,
  hasUserStoreAccess,
  requireModuleAccess,
  requireRoles,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import { broadcastSseEvent } from '../../state.ts';
import {
  generateHlcTimestamp,
  generateTableId,
} from '../../../utils/idGenerator.ts';
import { stageSyncOutboxInTransaction } from '../../persistence/PersistenceDriver.ts';
import {
  isSingleBranchLocked,
  stripPrototypePollution,
  verifyStoreTenantAccess,
} from './storeAccessHelpers.ts';
import suppliersReservationsCore from './suppliersReservationsCore.ts';

const router = express.Router();

// ==========================================
// 1. DINING TABLES ENDPOINTS
// ==========================================

router.get('/tables', verifyAutonomousToken, requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER', 'WAITER']), requireModuleAccess('tables'), async (req, res) => {
  try {
    const { storeId } = req.query;
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    if (authenticatedUser.role !== 'DEV_OWNER' && storeId && !hasUserStoreAccess(authenticatedUser, String(storeId))) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }
    const snap = await db.collection('tables').get();
    let tables = snap.docs.map(d => d.data()).filter(t => t && !t._deleted);

    if (authenticatedUser.role !== 'DEV_OWNER') {
      const userTenant = authenticatedUser.tenantId || 'tenant-1';
      tables = tables.filter(t => t.tenantId === userTenant && hasUserStoreAccess(authenticatedUser, t.storeId));
    }
    if (storeId) tables = tables.filter(t => t.storeId === storeId);
    res.json(tables);
  } catch {
    res.status(500).json({ error: 'Erro ao listar mesas.' });
  }
});

router.post(
  '/tables',
  verifyAutonomousToken,
  requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']),
  requireModuleAccess('tables'),
  async (req, res) => {
    try {
      const rawTable = stripPrototypePollution(req.body || {});
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
      const id = rawTable.id || generateTableId();

      const targetStoreId =
        authenticatedUser.role !== 'DEV_OWNER' && isSingleBranchLocked(authenticatedUser)
          ? String(authenticatedUser.storeId)
          : String(rawTable.storeId || authenticatedUser.storeId || '');
      if (!targetStoreId) {
        return res.status(400).json({ error: 'storeId é obrigatório para criar/atualizar mesa.' });
      }
      if (authenticatedUser.role !== 'DEV_OWNER') {
        const check = await verifyStoreTenantAccess(targetStoreId, authenticatedUser);
        if (check.ok === false) {
          return res.status(check.status).json({ error: check.error });
        }
      }

      const VALID_TABLE_STATUSES = ['FREE', 'OCCUPIED', 'RESERVED', 'BILL_REQUESTED', 'CLEANING'];
      const nextStatus = rawTable.status ? String(rawTable.status) : 'FREE';
      if (!VALID_TABLE_STATUSES.includes(nextStatus)) {
        return res.status(400).json({ error: `Status de mesa inválido: utilize [${VALID_TABLE_STATUSES.join(', ')}].` });
      }
      const tableNumber = Number(rawTable.tableNumber);
      if (!Number.isInteger(tableNumber) || tableNumber < 1) {
        return res.status(400).json({ error: 'tableNumber válido (>= 1) é obrigatório.' });
      }
      const capacity = rawTable.capacity !== undefined ? Number(rawTable.capacity) : 4;
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
        return res.status(400).json({ error: 'Capacidade da mesa inválida (1 a 100).' });
      }

      const savedTable = await db.runTransaction(async (transaction) => {
        const tableRef = db.collection('tables').doc(id);
        const existingSnap = await transaction.get(tableRef);
        const existing = existingSnap.exists ? existingSnap.data() : null;
        if (existing && authenticatedUser.role !== 'DEV_OWNER') {
          if (existing.tenantId !== authenticatedUser.tenantId) {
            const err: any = new Error('Acesso negado: Mesa pertence a outra empresa/tenant.');
            err.statusCode = 403;
            throw err;
          }
          if (!hasUserStoreAccess(authenticatedUser, existing.storeId)) {
            const err: any = new Error('Acesso negado: Mesa pertence a outra filial.');
            err.statusCode = 403;
            throw err;
          }
        }
        const tenantId = authenticatedUser.role === 'DEV_OWNER'
          ? (rawTable.tenantId || existing?.tenantId || authenticatedUser.tenantId)
          : authenticatedUser.tenantId;
        const tableHlc = generateHlcTimestamp('cloud_core');
        const nowIso = new Date().toISOString();
        const nextDoc = {
          ...(existing || {}),
          id,
          storeId: targetStoreId,
          tenantId,
          tableNumber,
          capacity,
          status: nextStatus,
          activeItemsCount: existing?.activeItemsCount ?? Number(rawTable.activeItemsCount || 0),
          totalAmount: existing?.totalAmount ?? Number(rawTable.totalAmount || 0),
          hlc: tableHlc,
          updatedAt: nowIso,
        };
        transaction.set(tableRef, nextDoc, { merge: true });
        stageSyncOutboxInTransaction(transaction, {
          entity: 'tables',
          entityId: id,
          operation: 'UPSERT',
          tenantId: tenantId || 'tenant-1',
          storeId: targetStoreId,
          hlc: tableHlc,
          payload: nextDoc,
        });
        return nextDoc;
      });

      res.json({ success: true, table: savedTable });
    } catch (err: any) {
      res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar mesa.' });
    }
  }
);

router.delete(
  '/tables/:id',
  verifyAutonomousToken,
  requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']),
  requireModuleAccess('tables'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
      await db.runTransaction(async (transaction) => {
        const tableRef = db.collection('tables').doc(id);
        const snap = await transaction.get(tableRef);
        if (!snap.exists) {
          const err: any = new Error('Mesa não encontrada.');
          err.statusCode = 404;
          throw err;
        }
        const prev = snap.data() || {};
        if (authenticatedUser.role !== 'DEV_OWNER') {
          if (prev.tenantId !== authenticatedUser.tenantId) {
            const err: any = new Error('Acesso negado: Mesa pertence a outra empresa/tenant.');
            err.statusCode = 403;
            throw err;
          }
          if (!hasUserStoreAccess(authenticatedUser, prev.storeId)) {
            const err: any = new Error('Acesso negado: Mesa pertence a outra filial.');
            err.statusCode = 403;
            throw err;
          }
        }
        transaction.delete(tableRef);
        stageSyncOutboxInTransaction(transaction, {
          entity: 'tables',
          entityId: id,
          operation: 'DELETE',
          tenantId: prev.tenantId || authenticatedUser.tenantId || 'tenant-1',
          storeId: prev.storeId || null,
          hlc: generateHlcTimestamp('cloud_core'),
          payload: { id },
        });
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao remover mesa.' });
    }
  }
);

router.put('/tables/:id/status', verifyAutonomousToken, requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER', 'WAITER']), requireModuleAccess('tables'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;

    const VALID_TABLE_STATUSES = ['FREE', 'OCCUPIED', 'RESERVED', 'BILL_REQUESTED', 'CLEANING'];
    if (!status || typeof status !== 'string' || !VALID_TABLE_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Status de mesa inválido: utilize [${VALID_TABLE_STATUSES.join(', ')}].`,
      });
    }

    await db.runTransaction(async (transaction) => {
      const tableRef = db.collection('tables').doc(id);
      const tableDoc = await transaction.get(tableRef);
      if (!tableDoc.exists) {
        const err: any = new Error('Mesa não encontrada.');
        err.statusCode = 404;
        throw err;
      }

      const prevTable = tableDoc.data();
      if (authenticatedUser.role !== 'DEV_OWNER') {
        if (!prevTable?.tenantId || prevTable.tenantId !== authenticatedUser.tenantId) {
          const err: any = new Error('Acesso negado: Mesa pertence a outra empresa/tenant.');
          err.statusCode = 403;
          throw err;
        }
        if (!hasUserStoreAccess(authenticatedUser, prevTable.storeId)) {
          const err: any = new Error('Acesso negado: Mesa pertence a outra filial.');
          err.statusCode = 403;
          throw err;
        }
      }

      const tableHlc = generateHlcTimestamp('cloud_core');
      const updatedAt = new Date().toISOString();
      transaction.update(tableRef, { status, hlc: tableHlc, updatedAt });
      stageSyncOutboxInTransaction(transaction, {
        entity: 'tables',
        entityId: id,
        operation: 'UPSERT',
        tenantId: prevTable.tenantId || authenticatedUser.tenantId || 'tenant-1',
        storeId: prevTable.storeId || null,
        hlc: tableHlc,
        payload: { ...prevTable, id, status, hlc: tableHlc, updatedAt },
      });
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao atualizar mesa.' });
  }
});

router.post('/tables/request-bill', verifyAutonomousToken, async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const { storeId, tableNumber, includeServiceFee, splitCount, totalWithService } = req.body || {};
    const parsedTableNumber = Number(tableNumber);
    if (!storeId || !Number.isInteger(parsedTableNumber) || parsedTableNumber < 1) {
      return res.status(400).json({ error: 'storeId e tableNumber válido (>= 1) são obrigatórios.' });
    }

    const storeLookup = await runWithSystemDbContext('REQUEST_BILL_STORE_LOOKUP', async () => {
      const storeSnap = await db.collection('stores').doc(String(storeId)).get();
      if (!storeSnap.exists) {
        return { found: false as const, tenantId: 'tenant-1', suspended: false };
      }
      const tid = String(storeSnap.data()?.tenantId || 'tenant-1');
      const tenantSnap = await db.collection('tenants').doc(tid).get();
      const suspended = Boolean(
        tenantSnap.exists && String(tenantSnap.data()?.status || 'ACTIVE').toUpperCase() === 'SUSPENDED'
      );
      return { found: true as const, tenantId: tid, suspended };
    });
    if (!storeLookup.found) {
      return res.status(404).json({ error: `Loja '${storeId}' não encontrada.` });
    }
    const tenantId = storeLookup.tenantId;
    if (storeLookup.suspended) {
      return res.status(403).json({ error: 'Estabelecimento temporariamente indisponível na plataforma.' });
    }

    if (!['CUSTOMER', 'CONSUMER'].includes(authenticatedUser.role)) {
      const access = await verifyStoreTenantAccess(String(storeId), authenticatedUser);
      if (access.ok === false) {
        return res.status(access.status).json({ error: access.error });
      }
    }

    const tableId = await db.runTransaction(async (transaction) => {
      const snap = await db.collection('tables').get();
      const targetDoc = snap.docs.find(d => {
        const data = d.data();
        return data && !data._deleted && data.tableNumber === Number(tableNumber) && data.storeId === storeId && data.tenantId === tenantId;
      });
      if (!targetDoc) return null;

      const billHlc = generateHlcTimestamp('cloud_core');
      const updatedAt = new Date().toISOString();
      const tableRef = db.collection('tables').doc(targetDoc.id);
      const freshSnap = await transaction.get(tableRef);
      const prevData = freshSnap.exists ? freshSnap.data() : targetDoc.data();

      transaction.update(tableRef, {
        status: 'BILL_REQUESTED',
        hlc: billHlc,
        updatedAt,
      });
      stageSyncOutboxInTransaction(transaction, {
        entity: 'tables',
        entityId: targetDoc.id,
        operation: 'UPSERT',
        tenantId,
        storeId,
        hlc: billHlc,
        payload: { ...prevData, id: targetDoc.id, status: 'BILL_REQUESTED', hlc: billHlc, updatedAt },
      });
      return targetDoc.id;
    }, { tenantId, bypassRls: false, reason: 'REQUEST_BILL_TX' });

    broadcastSseEvent('BILL_REQUESTED', {
      storeId,
      customerId: authenticatedUser.uid,
      tableNumber: Number(tableNumber),
      includeServiceFee: Boolean(includeServiceFee),
      splitCount: Number(splitCount) || 1,
      totalWithService: Number(totalWithService) || 0
    }, tenantId, true, {
      storeId,
      customerId: authenticatedUser.uid,
      allowedRoles: ['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER', 'WAITER'],
    });
    res.json({ success: true, tableId });
  } catch {
    res.status(500).json({ error: 'Erro ao solicitar fechamento da mesa.' });
  }
});

router.use(suppliersReservationsCore);

export default router;
