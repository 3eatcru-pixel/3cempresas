import express from 'express';
import { db, runWithSystemDbContext } from '../../config.ts';
import {
  AuthenticatedRequestUser,
  hasUserStoreAccess,
  requireModuleAccess,
  requireRoles,
  resolveOptionalUser,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import { generateHlcTimestamp } from '../../../utils/idGenerator.ts';
import {
  stageStockLedgerInTransaction,
  stageSyncOutboxInTransaction,
} from '../../persistence/PersistenceDriver.ts';
import {
  isSingleBranchLocked,
  omitKeys,
  sanitizeMenuItemForPublic,
  stripPrototypePollution,
  validateMenuNumericFields,
} from './storeAccessHelpers.ts';

const router = express.Router();

// ==========================================
// 1. MENU ITEMS ENDPOINTS
// ==========================================

router.get('/menu', async (req, res) => {
  try {
    const { storeId, tenantId } = req.query;
    const { user: callerUser } = await resolveOptionalUser(req);

    const [snap, storesSnap, tenantsSnap, govSnap] = await runWithSystemDbContext('PUBLIC_STORE_MENU', () =>
      Promise.all([
        db.collection('menu_items').get(),
        db.collection('stores').get(),
        db.collection('tenants').get(),
        db.collection('governance').doc('governance').get(),
      ])
    );

    const hiddenStoreIds = new Set<string>(
      Array.isArray(govSnap.data()?.marketplaceConfig?.hiddenStoreIds)
        ? govSnap.data()!.marketplaceConfig.hiddenStoreIds.map((id: any) => String(id))
        : []
    );

    const suspendedTenants = new Set(
      tenantsSnap.docs
        .map(d => d.data())
        .filter(t => String(t?.status || 'ACTIVE').toUpperCase() === 'SUSPENDED')
        .map(t => t.id)
    );
    const activeStoresById = new Map<string, any>();
    storesSnap.docs.forEach(d => {
      const s = d.data();
      if (s && !s._deleted) {
        activeStoresById.set(d.id, s);
      }
    });

    const isAdminViewer = Boolean(callerUser && ['DEV_OWNER', 'SUPER_ADMIN'].includes(callerUser.role));
    const isStaffViewer = Boolean(
      callerUser && ['STORE_OWNER', 'STORE_MANAGER', 'REGIONAL_MANAGER', 'CASHIER', 'KITCHEN_STAFF', 'WAITER'].includes(callerUser.role)
    );

    let items = snap.docs.map(d => d.data()).filter(i => i && !i._deleted);
    if (storeId) items = items.filter(i => i.storeId === storeId);
    if (tenantId) items = items.filter(i => i.tenantId === tenantId);

    if (!isAdminViewer) {
      items = items.filter(item => {
        const store = item.storeId ? activeStoresById.get(item.storeId) : undefined;
        if (item.storeId && !store) return false;
        if (!isStaffViewer && item.storeId && hiddenStoreIds.has(String(item.storeId))) {
          return false;
        }
        if (store && String(store.status || 'ACTIVE').toUpperCase() === 'SUSPENDED') {
          return false;
        }
        const effectiveTenantId = item.tenantId || store?.tenantId;
        if (effectiveTenantId && suspendedTenants.has(effectiveTenantId)) {
          return false;
        }
        return true;
      });
    }

    items = items.map(item => {
      const isPlatformAdmin = callerUser && (callerUser.role === 'DEV_OWNER' || callerUser.role === 'SUPER_ADMIN');
      const isStoreStaffOfItem = callerUser &&
        callerUser.tenantId === item.tenantId &&
        ['STORE_OWNER', 'STORE_MANAGER', 'KITCHEN_STAFF', 'REGIONAL_MANAGER'].includes(callerUser.role) &&
        hasUserStoreAccess(callerUser, item.storeId);

      if (isPlatformAdmin || isStoreStaffOfItem) {
        return item;
      }
      return sanitizeMenuItemForPublic(item);
    });

    res.json(items);
  } catch {
    res.status(500).json({ error: 'Erro ao listar produtos do cardápio.' });
  }
});

router.post('/menu', verifyAutonomousToken, requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']), requireModuleAccess('catalog'), async (req, res) => {
  try {
    const rawItem = stripPrototypePollution(req.body || {});
    const id = rawItem.id || `menu-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;

    const numericErr = validateMenuNumericFields(rawItem);
    if (numericErr) {
      return res.status(400).json({ error: numericErr });
    }

    const cleanItem = omitKeys(rawItem, authenticatedUser.role === 'DEV_OWNER' ? ['id'] : ['id', 'tenantId']);

    const savedItem = await db.runTransaction(async (transaction) => {
      const itemRef = db.collection('menu_items').doc(id);
      const existingSnap = await transaction.get(itemRef);
      if (existingSnap.exists && authenticatedUser.role !== 'DEV_OWNER') {
        if (existingSnap.data()?.tenantId !== authenticatedUser.tenantId) {
          const err: any = new Error('Acesso negado: Item do cardápio pertence a outra empresa/tenant.');
          err.statusCode = 403;
          throw err;
        }
        if (!hasUserStoreAccess(authenticatedUser, existingSnap.data()?.storeId)) {
          const err: any = new Error('Acesso negado: Item pertence a outra filial.');
          err.statusCode = 403;
          throw err;
        }
      }

      const targetStoreId = rawItem.storeId || existingSnap.data()?.storeId || authenticatedUser.storeId;
      if (targetStoreId && authenticatedUser.role !== 'DEV_OWNER') {
        const storeSnap = await transaction.get(db.collection('stores').doc(String(targetStoreId)));
        if (!storeSnap.exists || storeSnap.data()?._deleted) {
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
        ? (rawItem.tenantId || existingSnap.data()?.tenantId || authenticatedUser.tenantId)
        : authenticatedUser.tenantId;

      const hlc = generateHlcTimestamp('cloud_core');
      const nextDoc = {
        ...(existingSnap.exists ? existingSnap.data() : {}),
        ...cleanItem,
        id,
        tenantId,
        ...(targetStoreId ? { storeId: targetStoreId } : {}),
        hlc,
        updatedAt: new Date().toISOString()
      };

      transaction.set(itemRef, nextDoc, { merge: true });
      stageSyncOutboxInTransaction(transaction, {
        entity: 'menu_items',
        entityId: id,
        operation: 'UPSERT',
        tenantId: nextDoc.tenantId || 'tenant-1',
        storeId: nextDoc.storeId || null,
        hlc,
        payload: nextDoc,
      });
      return nextDoc;
    });

    res.json({ success: true, item: savedItem });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar item do cardápio.' });
  }
});

router.put('/menu/:id', verifyAutonomousToken, requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']), requireModuleAccess('catalog'), async (req, res) => {
  try {
    const { id } = req.params;
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const rawUpdates = stripPrototypePollution(req.body || {});
    const numericErr = validateMenuNumericFields(rawUpdates);
    if (numericErr) {
      return res.status(400).json({ error: numericErr });
    }
    const cleanUpdates = omitKeys(rawUpdates, ['id', 'tenantId', 'createdAt', ...(isSingleBranchLocked(authenticatedUser) ? ['storeId'] : [])]);

    await db.runTransaction(async (transaction) => {
      const itemRef = db.collection('menu_items').doc(id);
      const itemDoc = await transaction.get(itemRef);

      if (!itemDoc.exists) {
        const err: any = new Error('Item do cardápio não encontrado.');
        err.statusCode = 404;
        throw err;
      }

      const prev = itemDoc.data();
      if (authenticatedUser.role !== 'DEV_OWNER') {
        if (prev?.tenantId !== authenticatedUser.tenantId) {
          const err: any = new Error('Acesso negado: Item do cardápio pertence a outra empresa/tenant.');
          err.statusCode = 403;
          throw err;
        }
        if (!hasUserStoreAccess(authenticatedUser, prev?.storeId)) {
          const err: any = new Error('Acesso negado: Item pertence a outra filial.');
          err.statusCode = 403;
          throw err;
        }
      }

      const hlc = generateHlcTimestamp('cloud_core');
      const patch = { ...cleanUpdates, hlc, updatedAt: new Date().toISOString() };
      transaction.update(itemRef, patch);

      stageSyncOutboxInTransaction(transaction, {
        entity: 'menu_items',
        entityId: id,
        operation: 'UPSERT',
        tenantId: prev.tenantId || authenticatedUser.tenantId || 'tenant-1',
        storeId: prev.storeId || null,
        hlc,
        payload: { ...prev, ...patch, id },
      });
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao atualizar item.' });
  }
});

router.delete('/menu/:id', verifyAutonomousToken, requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER']), requireModuleAccess('catalog'), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const { id } = req.params;

    await db.runTransaction(async (transaction) => {
      const itemRef = db.collection('menu_items').doc(id);
      const itemDoc = await transaction.get(itemRef);

      if (!itemDoc.exists) {
        const err: any = new Error('Item do cardápio não encontrado.');
        err.statusCode = 404;
        throw err;
      }

      const prev = itemDoc.data();
      if (authenticatedUser.role !== 'DEV_OWNER') {
        if (prev?.tenantId !== authenticatedUser.tenantId) {
          const err: any = new Error('Acesso negado: Item do cardápio pertence a outra empresa/tenant.');
          err.statusCode = 403;
          throw err;
        }
        if (!hasUserStoreAccess(authenticatedUser, prev?.storeId)) {
          const err: any = new Error('Acesso negado: Item pertence a outra filial.');
          err.statusCode = 403;
          throw err;
        }
      }

      transaction.delete(itemRef);
      stageSyncOutboxInTransaction(transaction, {
        entity: 'menu_items',
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
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao deletar item.' });
  }
});

// ==========================================
// 2. INVENTORY ENDPOINTS
// ==========================================

router.get('/inventory', verifyAutonomousToken, requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'KITCHEN_STAFF']), requireModuleAccess('inventory'), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    if (authenticatedUser.role !== 'DEV_OWNER' && req.query.storeId && !hasUserStoreAccess(authenticatedUser, String(req.query.storeId))) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }
    const snap = await db.collection('inventory_batches').get();
    let batches = snap.docs.map(d => d.data()).filter(b => b && !b._deleted);

    if (authenticatedUser.role !== 'DEV_OWNER') {
      const userTenant = authenticatedUser.tenantId || 'tenant-1';
      batches = batches.filter(b => b.tenantId === userTenant && hasUserStoreAccess(authenticatedUser, b.storeId));
    }
    if (req.query.storeId) {
      batches = batches.filter(b => b.storeId === req.query.storeId);
    }

    res.json(batches);
  } catch {
    res.status(500).json({ error: 'Erro ao listar inventário.' });
  }
});

router.post('/inventory', verifyAutonomousToken, requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'KITCHEN_STAFF']), requireModuleAccess('inventory'), async (req, res) => {
  try {
    const rawBatch = stripPrototypePollution(req.body || {});
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const id = rawBatch.id || `batch-${Date.now()}`;

    const numericInvFields: Array<{ key: string; label: string }> = [
      { key: 'quantity', label: 'quantidade' },
      { key: 'costPrice', label: 'preço de custo' },
      { key: 'costPerUnit', label: 'custo unitário' },
      { key: 'minQuantity', label: 'quantidade mínima' },
    ];
    for (const { key, label } of numericInvFields) {
      if (rawBatch[key] !== undefined && rawBatch[key] !== null) {
        const val = Number(rawBatch[key]);
        if (!Number.isFinite(val) || val < 0) {
          return res.status(400).json({ error: `Valor inválido para ${label} (${key}): deve ser um número >= 0.` });
        }
      }
    }

    const cleanBatch = omitKeys(rawBatch, authenticatedUser.role === 'DEV_OWNER' ? ['id'] : ['id', 'tenantId']);

    const savedBatch = await db.runTransaction(async (transaction) => {
      const batchRef = db.collection('inventory_batches').doc(id);
      const existingSnap = await transaction.get(batchRef);
      if (existingSnap.exists && authenticatedUser.role !== 'DEV_OWNER') {
        if (existingSnap.data()?.tenantId !== authenticatedUser.tenantId) {
          const err: any = new Error('Acesso negado: Lote pertence a outra empresa/tenant.');
          err.statusCode = 403;
          throw err;
        }
        if (!hasUserStoreAccess(authenticatedUser, existingSnap.data()?.storeId)) {
          const err: any = new Error('Acesso negado: Lote pertence a outra filial.');
          err.statusCode = 403;
          throw err;
        }
      }

      const targetStoreId = rawBatch.storeId || existingSnap.data()?.storeId || authenticatedUser.storeId;
      if (targetStoreId && authenticatedUser.role !== 'DEV_OWNER') {
        const storeSnap = await transaction.get(db.collection('stores').doc(String(targetStoreId)));
        if (!storeSnap.exists || storeSnap.data()?._deleted) {
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
        ? (rawBatch.tenantId || existingSnap.data()?.tenantId || authenticatedUser.tenantId)
        : authenticatedUser.tenantId;

      const prevQty = existingSnap.exists ? (Number(existingSnap.data()?.quantity) || 0) : 0;
      const nextQty = rawBatch.quantity !== undefined && rawBatch.quantity !== null ? Number(rawBatch.quantity) : prevQty;
      const invHlc = generateHlcTimestamp('cloud_core');
      const nextDoc = {
        ...(existingSnap.exists ? existingSnap.data() : {}),
        ...cleanBatch,
        id,
        tenantId,
        ...(targetStoreId ? { storeId: targetStoreId } : {}),
        hlc: invHlc,
        updatedAt: new Date().toISOString()
      };

      transaction.set(batchRef, nextDoc, { merge: true });
      if (nextQty !== prevQty) {
        stageStockLedgerInTransaction(transaction, {
          tenantId: tenantId || 'tenant-1',
          storeId: nextDoc.storeId || 'CENTRAL_WAREHOUSE',
          itemType: 'RAW_BATCH',
          targetId: id,
          sku: nextDoc.sku,
          itemName: nextDoc.name || nextDoc.sku || id,
          deltaQty: Math.round((nextQty - prevQty) * 1000) / 1000,
          previousQty: prevQty,
          balanceAfter: nextQty,
          reason: nextQty > prevQty ? 'RESTOCK' : 'ADJUSTMENT',
          hlc: invHlc,
        });
      }
      stageSyncOutboxInTransaction(transaction, {
        entity: 'inventory_batches',
        entityId: id,
        operation: 'UPSERT',
        tenantId: tenantId || 'tenant-1',
        storeId: nextDoc.storeId || null,
        hlc: invHlc,
        payload: nextDoc,
      });

      return nextDoc;
    });

    res.json({ success: true, batch: savedBatch });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar lote de inventário.' });
  }
});

export default router;
