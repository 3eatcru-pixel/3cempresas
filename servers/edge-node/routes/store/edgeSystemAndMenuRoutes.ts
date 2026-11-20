import express from 'express';
import { PLATFORM_CONTRACT_MANIFEST } from '../../../../src/server/middleware/contracts.ts';
import { buildSyncOutboxEntry } from '../../../../src/server/persistence/PersistenceDriver.ts';
import { generateHlcTimestamp, generateIdempotencyKey } from '@3c/commerce-engine';
import {
  EDGE_STAFF_ROLES,
  sanitizePublicEdgeMenuItem,
  stripEdgePrototypePollution,
  validateEdgeMenuNumericFields,
} from '../../helpers.ts';
import { verifyEdgeTokenAndUser } from '../../auth.ts';
import { EdgeRouteContext } from '../types.ts';

export function registerEdgeSystemAndMenuRoutes(app: express.Express, ctx: EdgeRouteContext): void {
  const { nodeId, storeId, tenantId, driver, syncClient, authenticateEdge, requireEdgeRoles } = ctx;

  app.get('/api/v1/health', async (_req, res) => {
    await syncClient.ensureCursorLoaded();
    res.json({
      status: 'EDGE_ONLINE',
      mode: '3C_EDGE_NODE_STANDARD',
      driver: driver.capabilities.kind,
      walMode: driver.getWalMode(),
      syncState: syncClient.syncState,
      cloudLinkStatus: syncClient.cloudLinkStatus,
      autoSyncActive: Boolean(syncClient.autoSyncTimer),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/v1/sync/status', authenticateEdge, requireEdgeRoles(EDGE_STAFF_ROLES), async (_req, res) => {
    await syncClient.ensureCursorLoaded();
    const outbox = await driver.listDocs<any>('sync_outbox');
    const unsynced = outbox.filter((o) => !o.syncedToCloudAt);
    const conflictDocs = outbox.filter((o) => Boolean(o.syncError));
    res.json({
      nodeId,
      storeId,
      tenantId,
      syncState: syncClient.syncState,
      cloudLinkStatus: syncClient.cloudLinkStatus,
      lastCloudSyncAt: syncClient.lastCloudSyncAt,
      lastPartialSyncAt: syncClient.lastPartialSyncAt,
      lastFullSyncAt: syncClient.lastFullSyncAt,
      lastSyncAttemptAt: syncClient.lastSyncAttemptAt,
      lastSyncError: syncClient.lastSyncError,
      pendingOutboxCount: unsynced.length,
      unresolvedConflictsCount: Math.max(syncClient.unresolvedConflictsCount, conflictDocs.length),
      lastPullHlc: syncClient.lastPullHlc || null,
      autoSyncActive: Boolean(syncClient.autoSyncTimer),
      recentConflicts: conflictDocs.slice(-20).map((c) => ({
        id: c.id,
        entity: c.entity,
        entityId: c.entityId,
        syncError: c.syncError,
        hlc: c.hlc,
      })),
    });
  });

  app.get('/api/v1/system/contracts', (_req, res) => {
    res.json({
      ...PLATFORM_CONTRACT_MANIFEST,
      activeNode: 'edge-node-standard',
      nodeId,
    });
  });

  app.get('/api/v1/store/menu', async (req, res) => {
    let verifiedStaff = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length).trim();
      if (token) {
        try {
          const user = await verifyEdgeTokenAndUser(driver, storeId, tenantId, token);
          verifiedStaff = EDGE_STAFF_ROLES.includes(user.role);
        } catch {
          verifiedStaff = false;
        }
      }
    }

    const items = await driver.listDocs<any>('menu_items');
    const storeItems = items.filter((i) => i.storeId === storeId && !i._deleted);
    res.json(verifiedStaff ? storeItems : storeItems.map(sanitizePublicEdgeMenuItem));
  });

  app.post(
    '/api/v1/store/menu',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']),
    async (req, res) => {
      try {
        const rawItem = stripEdgePrototypePollution(req.body || {});
        if (rawItem.storeId && rawItem.storeId !== storeId) {
          return res.status(403).json({ error: 'Acesso negado: Item pertence a outra filial.' });
        }
        const numericErr = validateEdgeMenuNumericFields(rawItem);
        if (numericErr) {
          return res.status(400).json({ error: numericErr });
        }
        const id = String(rawItem.id || `menu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
        const savedItem = await driver.runTransaction(async (tx) => {
          const snap = await tx.get({ collectionName: 'menu_items', id });
          const existing = snap.exists ? snap.data() : null;
          if (existing && existing.storeId && existing.storeId !== storeId) {
            const err: any = new Error('Acesso negado: Item pertence a outra filial.');
            err.statusCode = 403;
            throw err;
          }
          const hlc = generateHlcTimestamp(nodeId);
          const nextDoc = {
            ...(existing || {}),
            ...rawItem,
            id,
            tenantId,
            storeId,
            _deleted: false,
            hlc,
            updatedAt: new Date().toISOString(),
          };
          tx.set({ collectionName: 'menu_items', id }, nextDoc, { merge: true });
          const outbox = buildSyncOutboxEntry({
            entity: 'menu_items',
            entityId: id,
            operation: 'UPSERT',
            tenantId,
            storeId,
            nodeId,
            hlc,
            idempotencyKey: generateIdempotencyKey(),
            payload: nextDoc,
          });
          tx.set({ collectionName: 'sync_outbox', id: outbox.id }, outbox, { merge: false });
          return nextDoc;
        });
        return res.json({ success: true, item: savedItem });
      } catch (err: any) {
        return res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar item no Edge.' });
      }
    }
  );

  app.put(
    '/api/v1/store/menu/:id',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']),
    async (req, res) => {
      try {
        const { id } = req.params;
        const rawUpdates = stripEdgePrototypePollution(req.body || {});
        delete rawUpdates.id;
        delete rawUpdates.tenantId;
        delete rawUpdates.createdAt;
        if (rawUpdates.storeId && rawUpdates.storeId !== storeId) {
          return res.status(403).json({ error: 'Acesso negado: Item pertence a outra filial.' });
        }
        const numericErr = validateEdgeMenuNumericFields(rawUpdates);
        if (numericErr) {
          return res.status(400).json({ error: numericErr });
        }
        await driver.runTransaction(async (tx) => {
          const snap = await tx.get({ collectionName: 'menu_items', id });
          const existing = snap.exists ? snap.data() : null;
          if (!existing || existing._deleted) {
            const err: any = new Error('Item do cardápio não encontrado no Edge Node.');
            err.statusCode = 404;
            throw err;
          }
          if (existing.storeId && existing.storeId !== storeId) {
            const err: any = new Error('Acesso negado: Item pertence a outra filial.');
            err.statusCode = 403;
            throw err;
          }
          const hlc = generateHlcTimestamp(nodeId);
          const nextDoc = {
            ...existing,
            ...rawUpdates,
            id,
            tenantId,
            storeId,
            hlc,
            updatedAt: new Date().toISOString(),
          };
          tx.set({ collectionName: 'menu_items', id }, nextDoc, { merge: true });
          const outbox = buildSyncOutboxEntry({
            entity: 'menu_items',
            entityId: id,
            operation: 'UPSERT',
            tenantId,
            storeId,
            nodeId,
            hlc,
            idempotencyKey: generateIdempotencyKey(),
            payload: nextDoc,
          });
          tx.set({ collectionName: 'sync_outbox', id: outbox.id }, outbox, { merge: false });
        });
        return res.json({ success: true });
      } catch (err: any) {
        return res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao atualizar item no Edge.' });
      }
    }
  );

  app.delete(
    '/api/v1/store/menu/:id',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER']),
    async (req, res) => {
      try {
        const { id } = req.params;
        await driver.runTransaction(async (tx) => {
          const snap = await tx.get({ collectionName: 'menu_items', id });
          const existing = snap.exists ? snap.data() : null;
          if (!existing || existing._deleted) {
            const err: any = new Error('Item do cardápio não encontrado no Edge Node.');
            err.statusCode = 404;
            throw err;
          }
          if (existing.storeId && existing.storeId !== storeId) {
            const err: any = new Error('Acesso negado: Item pertence a outra filial.');
            err.statusCode = 403;
            throw err;
          }
          const hlc = generateHlcTimestamp(nodeId);
          const nowIso = new Date().toISOString();
          tx.set(
            { collectionName: 'menu_items', id },
            { ...existing, id, _deleted: true, deletedAt: nowIso, hlc, updatedAt: nowIso },
            { merge: true }
          );
          const outbox = buildSyncOutboxEntry({
            entity: 'menu_items',
            entityId: id,
            operation: 'DELETE',
            tenantId,
            storeId,
            nodeId,
            hlc,
            idempotencyKey: generateIdempotencyKey(),
            payload: { id, _deleted: true },
          });
          tx.set({ collectionName: 'sync_outbox', id: outbox.id }, outbox, { merge: false });
        });
        return res.json({ success: true });
      } catch (err: any) {
        return res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao deletar item no Edge.' });
      }
    }
  );
}
