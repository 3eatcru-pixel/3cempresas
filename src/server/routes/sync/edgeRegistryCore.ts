import express from 'express';
import { auth, db } from '../../config.ts';
import {
  hasUserStoreAccess,
  requireRoles,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import { broadcastSseEvent } from '../../state.ts';
import {
  generateEdgeNodeId,
  generateHlcTimestamp,
} from '../../../utils/idGenerator.ts';
import {
  activePersistenceDriver,
  compareHlcTimestamps,
  EdgeNodeRegistration,
  PERSISTENCE_DRIVERS_REGISTRY,
} from '../../persistence/PersistenceDriver.ts';
import {
  isBranchScopedSyncUser,
  SYNC_OPERATIONAL_ROLES,
  verifySyncCredentials,
} from './syncValidationCore.ts';

const router = express.Router();

router.get('/status', verifySyncCredentials, requireRoles(SYNC_OPERATIONAL_ROLES), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user;
    const isDev = authenticatedUser.role === 'DEV_OWNER';
    const tenantId = authenticatedUser.tenantId || 'tenant-1';
    const requestedStoreId = req.query.storeId ? String(req.query.storeId) : '';

    if (isBranchScopedSyncUser(authenticatedUser) && !authenticatedUser.storeId && !authenticatedUser.allowedStoreIds?.length) {
      return res.status(403).json({ error: 'Acesso negado: Operador sem filial vinculada.' });
    }
    if (!hasUserStoreAccess(authenticatedUser, requestedStoreId)) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }
    const isSingleLocked = Boolean(
      authenticatedUser.storeId &&
      !(Array.isArray(authenticatedUser.allowedStoreIds) && authenticatedUser.allowedStoreIds.length > 1)
    );
    const effectiveStoreId = isBranchScopedSyncUser(authenticatedUser)
      ? String(authenticatedUser.storeId || authenticatedUser.allowedStoreIds?.[0] || '')
      : (requestedStoreId || (isSingleLocked ? String(authenticatedUser.storeId) : ''));

    const [outboxDocs, ledgerDocs, edgeDocs] = await Promise.all([
      activePersistenceDriver.listDocs<any>('sync_outbox'),
      activePersistenceDriver.listDocs<any>('stock_ledger'),
      activePersistenceDriver.listDocs<EdgeNodeRegistration>('edge_nodes'),
    ]);

    let scopedOutbox = isDev ? outboxDocs : outboxDocs.filter(d => d.tenantId === tenantId);
    let scopedLedger = isDev ? ledgerDocs : ledgerDocs.filter(d => d.tenantId === tenantId);
    let scopedEdges = isDev ? edgeDocs : edgeDocs.filter(d => d.tenantId === tenantId);

    if (effectiveStoreId) {
      scopedOutbox = scopedOutbox.filter(d => !d.storeId || d.storeId === effectiveStoreId);
      scopedLedger = scopedLedger.filter(d => d.storeId === effectiveStoreId);
      scopedEdges = scopedEdges.filter(d => d.storeId === effectiveStoreId);
    } else if (!isDev) {
      scopedOutbox = scopedOutbox.filter(d => !d.storeId || hasUserStoreAccess(authenticatedUser, d.storeId));
      scopedLedger = scopedLedger.filter(d => hasUserStoreAccess(authenticatedUser, d.storeId));
      scopedEdges = scopedEdges.filter(d => hasUserStoreAccess(authenticatedUser, d.storeId));
    }

    const latestHlc =
      scopedOutbox.reduce((max, item) => (compareHlcTimestamps(item.hlc, max) > 0 ? item.hlc : max), '') ||
      generateHlcTimestamp('cloud_core');

    res.json({
      driver: activePersistenceDriver.capabilities,
      availableDrivers: PERSISTENCE_DRIVERS_REGISTRY,
      outboxCount: scopedOutbox.length,
      stockLedgerCount: scopedLedger.length,
      edgeNodesCount: scopedEdges.length,
      latestHlc,
      serverHlc: generateHlcTimestamp('cloud_core'),
    });
  } catch {
    res.status(500).json({ error: 'Erro ao consultar status de sincronização.' });
  }
});

router.post(
  '/edge/register',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']),
  async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { nodeId, storeId, hostname, lanIp, port = 3300, platform = 'linux', appVersion = '5.2.1', lastHlc } = req.body;

      if (!storeId || typeof storeId !== 'string') {
        return res.status(400).json({ error: 'storeId é obrigatório para parear um 3C Edge Node.' });
      }

      const storeDoc = await db.collection('stores').doc(storeId).get();
      if (!storeDoc.exists) {
        return res.status(404).json({ error: `Loja '${storeId}' não encontrada.` });
      }

      const storeData = storeDoc.data();
      if (authenticatedUser.role !== 'DEV_OWNER') {
        if (storeData.tenantId !== authenticatedUser.tenantId) {
          return res.status(403).json({ error: 'Acesso negado: Loja pertence a outra empresa/tenant.' });
        }
        if (!hasUserStoreAccess(authenticatedUser, storeId)) {
          return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
        }
      }

      const resolvedNodeId = typeof nodeId === 'string' && nodeId.startsWith('edg_') ? nodeId : generateEdgeNodeId();
      const nowIso = new Date().toISOString();
      const tenantId = storeData.tenantId || authenticatedUser.tenantId || 'tenant-1';

      const registration = await db.runTransaction(async (transaction) => {
        const nodeRef = db.collection('edge_nodes').doc(resolvedNodeId);
        const existingSnap = await transaction.get(nodeRef);
        const existingNode = existingSnap.exists ? existingSnap.data() : null;
        if (existingNode && authenticatedUser.role !== 'DEV_OWNER') {
          if (existingNode?.tenantId && existingNode.tenantId !== tenantId) {
            const err: any = new Error('Acesso negado: Edge Node pertence a outra empresa/tenant.');
            err.statusCode = 403;
            throw err;
          }
          if (existingNode?.storeId && existingNode.storeId !== storeId) {
            const err: any = new Error('Acesso negado: Edge Node já vinculado a outra filial.');
            err.statusCode = 403;
            throw err;
          }
        }

        const nextTokenVersion = typeof existingNode?.tokenVersion === 'number' ? existingNode.tokenVersion : 1;
        const nextReg: EdgeNodeRegistration & { tokenVersion: number } = {
          id: resolvedNodeId,
          tenantId,
          storeId,
          hostname: hostname || `edge-${storeId}`,
          lanIp: lanIp || undefined,
          port: Number(port) || 3300,
          platform,
          appVersion,
          lastHlc: lastHlc || generateHlcTimestamp(resolvedNodeId),
          status: 'ONLINE',
          pairedByUid: authenticatedUser.uid,
          tokenVersion: nextTokenVersion,
          lastHeartbeatAt: nowIso,
          createdAt: existingNode?.createdAt || nowIso,
        };
        transaction.set(nodeRef, nextReg, { merge: true });
        return nextReg;
      });

      const edgeCredential = auth.generateEdgeSyncToken({
        nodeId: resolvedNodeId,
        tenantId,
        storeId,
        tokenVersion: (registration as any).tokenVersion || 1,
      });

      broadcastSseEvent(
        'EDGE_NODE_HEARTBEAT',
        {
          nodeId: resolvedNodeId,
          storeId,
          hostname: registration.hostname,
          platform: registration.platform,
          status: registration.status,
        },
        tenantId,
        true
      );

      res.status(201).json({
        success: true,
        edgeNode: registration,
        edgeToken: edgeCredential.token,
        edgeTokenExpiresAt: edgeCredential.expiresAt,
      });
    } catch (err: any) {
      if (err?.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      res.status(500).json({ error: 'Falha ao registrar 3C Edge Node.' });
    }
  }
);

router.post('/edge/token/refresh', verifySyncCredentials, async (req, res) => {
  try {
    const authenticatedUser = (req as any).user;
    const edgeAuth = (req as any).edgeNode;
    const requestedNodeId = String(req.body?.nodeId || edgeAuth?.nodeId || '').trim();
    if (!requestedNodeId) {
      return res.status(400).json({ error: 'nodeId obrigatório para renovar credencial técnica Edge.' });
    }
    if (edgeAuth && edgeAuth.nodeId !== requestedNodeId) {
      return res.status(403).json({ error: 'Acesso negado: nodeId divergente da credencial Edge.' });
    }
    const nodeSnap = await db.collection('edge_nodes').doc(requestedNodeId).get();
    if (!nodeSnap.exists) {
      return res.status(404).json({ error: 'Nó Edge não encontrado.' });
    }
    const nodeDoc = nodeSnap.data() || {};
    if (nodeDoc.status === 'REVOKED' || nodeDoc.status === 'SUSPENDED') {
      return res.status(401).json({ error: 'Nó Edge revogado ou suspenso.' });
    }
    if (authenticatedUser.role !== 'DEV_OWNER') {
      if (nodeDoc.tenantId !== authenticatedUser.tenantId || !hasUserStoreAccess(authenticatedUser, nodeDoc.storeId)) {
        return res.status(403).json({ error: 'Acesso negado ao nó Edge solicitado.' });
      }
    }
    if (!edgeAuth && !['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER'].includes(authenticatedUser.role)) {
      return res.status(403).json({ error: 'Perfil sem autorização para emitir/renovar credencial Edge.' });
    }
    const credential = auth.generateEdgeSyncToken({
      nodeId: requestedNodeId,
      tenantId: nodeDoc.tenantId,
      storeId: nodeDoc.storeId,
      tokenVersion: typeof nodeDoc.tokenVersion === 'number' ? nodeDoc.tokenVersion : 1,
    });
    res.json({
      success: true,
      nodeId: requestedNodeId,
      edgeToken: credential.token,
      edgeTokenExpiresAt: credential.expiresAt,
    });
  } catch {
    res.status(500).json({ error: 'Falha ao renovar credencial técnica Edge.' });
  }
});

router.post(
  '/edge/:nodeId/revoke',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']),
  async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { nodeId } = req.params;
      const nodeRef = db.collection('edge_nodes').doc(nodeId);
      const nodeSnap = await nodeRef.get();
      if (!nodeSnap.exists) {
        return res.status(404).json({ error: 'Nó Edge não encontrado.' });
      }
      const nodeDoc = nodeSnap.data() || {};
      if (authenticatedUser.role !== 'DEV_OWNER') {
        if (nodeDoc.tenantId !== authenticatedUser.tenantId || !hasUserStoreAccess(authenticatedUser, nodeDoc.storeId)) {
          return res.status(403).json({ error: 'Acesso negado: Nó Edge pertence a outra empresa ou filial.' });
        }
      }
      const nextTokenVersion = (typeof nodeDoc.tokenVersion === 'number' ? nodeDoc.tokenVersion : 1) + 1;
      await nodeRef.update({
        status: 'REVOKED',
        tokenVersion: nextTokenVersion,
        revokedAt: new Date().toISOString(),
        revokedByUid: authenticatedUser.uid,
      });
      res.json({ success: true, nodeId, status: 'REVOKED', tokenVersion: nextTokenVersion });
    } catch {
      res.status(500).json({ error: 'Falha ao revogar credencial do Edge Node.' });
    }
  }
);

router.get('/edge/nodes', verifySyncCredentials, requireRoles(SYNC_OPERATIONAL_ROLES), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user;
    const requestedStoreId = req.query.storeId ? String(req.query.storeId) : '';

    if (isBranchScopedSyncUser(authenticatedUser) && !authenticatedUser.storeId && !authenticatedUser.allowedStoreIds?.length) {
      return res.status(403).json({ error: 'Acesso negado: Operador sem filial vinculada.' });
    }
    if (!hasUserStoreAccess(authenticatedUser, requestedStoreId)) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }
    const effectiveStoreId = isBranchScopedSyncUser(authenticatedUser)
      ? String(authenticatedUser.storeId || authenticatedUser.allowedStoreIds?.[0] || '')
      : requestedStoreId;

    const nodes = await activePersistenceDriver.listDocs<EdgeNodeRegistration>('edge_nodes');

    let filtered =
      authenticatedUser.role === 'DEV_OWNER'
        ? nodes
        : nodes.filter(n => n.tenantId === (authenticatedUser.tenantId || 'tenant-1'));

    if (effectiveStoreId) {
      filtered = filtered.filter(n => n.storeId === effectiveStoreId);
    } else if (authenticatedUser.role !== 'DEV_OWNER') {
      filtered = filtered.filter(n => hasUserStoreAccess(authenticatedUser, n.storeId));
    }

    res.json(filtered);
  } catch {
    res.status(500).json({ error: 'Erro ao listar nós Edge registrados.' });
  }
});

router.post(
  '/edge/heartbeat',
  verifySyncCredentials,
  requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'EDGE_NODE']),
  async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const edgeAuth = (req as any).edgeNode;
      const { nodeId, storeId, lastHlc, pendingOutboxCount = 0 } = req.body || {};
      if (!nodeId || !storeId) {
        return res.status(400).json({ error: 'nodeId e storeId são obrigatórios para heartbeat.' });
      }
      if (edgeAuth && (edgeAuth.nodeId !== String(nodeId) || edgeAuth.storeId !== String(storeId))) {
        return res.status(403).json({ error: 'Acesso negado: nodeId/storeId divergente da credencial Edge.' });
      }
      const storeSnap = await db.collection('stores').doc(String(storeId)).get();
      if (!storeSnap.exists) {
        return res.status(404).json({ error: `Loja '${storeId}' não encontrada.` });
      }
      const storeData = storeSnap.data();
      if (authenticatedUser.role !== 'DEV_OWNER') {
        if (storeData?.tenantId !== authenticatedUser.tenantId) {
          return res.status(403).json({ error: 'Acesso negado: Loja pertence a outro tenant.' });
        }
        if (!hasUserStoreAccess(authenticatedUser, String(storeId))) {
          return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
        }
      }
      const nowIso = new Date().toISOString();
      await db.runTransaction(async (transaction) => {
        const nodeRef = db.collection('edge_nodes').doc(String(nodeId));
        const existingSnap = await transaction.get(nodeRef);
        if (existingSnap.exists && authenticatedUser.role !== 'DEV_OWNER') {
          const existingNode = existingSnap.data();
          if (existingNode?.status === 'REVOKED') {
            const err: any = new Error('Acesso negado: Edge Node revogado.');
            err.statusCode = 403;
            throw err;
          }
          if (existingNode?.tenantId && existingNode.tenantId !== authenticatedUser.tenantId) {
            const err: any = new Error('Acesso negado: Edge Node pertence a outra empresa/tenant.');
            err.statusCode = 403;
            throw err;
          }
          if (existingNode?.storeId && existingNode.storeId !== String(storeId)) {
            const err: any = new Error('Acesso negado: Edge Node vinculado a outra filial.');
            err.statusCode = 403;
            throw err;
          }
        }
        transaction.set(nodeRef, {
          id: String(nodeId),
          storeId: String(storeId),
          tenantId: storeData?.tenantId || authenticatedUser.tenantId,
          lastHlc: lastHlc || generateHlcTimestamp(String(nodeId)),
          pendingOutboxCount: Number(pendingOutboxCount) || 0,
          status: 'ONLINE',
          lastHeartbeatAt: nowIso
        }, { merge: true });
      });
      res.json({ success: true, timestamp: nowIso });
    } catch (err: any) {
      if (err?.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      res.status(500).json({ error: 'Falha ao registrar heartbeat do Edge Node.' });
    }
  }
);

router.get(
  '/edge/bootstrap/:storeId',
  verifySyncCredentials,
  requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'EDGE_NODE']),
  async (req, res) => {
    try {
      const { storeId } = req.params;
      const authenticatedUser = (req as any).user;
      const edgeAuth = (req as any).edgeNode;
      if (edgeAuth && edgeAuth.storeId !== storeId) {
        return res.status(403).json({ error: 'Acesso negado: Credencial Edge pertence a outra filial.' });
      }
      const storeSnap = await db.collection('stores').doc(storeId).get();
      if (!storeSnap.exists) {
        return res.status(404).json({ error: `Loja '${storeId}' não encontrada.` });
      }
      const store = storeSnap.data();
      if (authenticatedUser.role !== 'DEV_OWNER') {
        if (store?.tenantId !== authenticatedUser.tenantId) {
          return res.status(403).json({ error: 'Acesso negado: Loja pertence a outro tenant.' });
        }
        if (!hasUserStoreAccess(authenticatedUser, storeId)) {
          return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
        }
      }

      const tenantId = store.tenantId;
      const [
        tenantSnap,
        menuSnap,
        tablesSnap,
        batchesSnap,
        resSnap,
        usersSnap,
        couponsSnap,
        cashSnap,
        ordersSnap,
        customersSnap,
        financeSnap,
        suppliersSnap,
      ] = await Promise.all([
        db.collection('tenants').doc(tenantId).get(),
        db.collection('menu_items').get(),
        db.collection('tables').get(),
        db.collection('inventory_batches').get(),
        db.collection('reservations').get(),
        db.collection('users').get(),
        db.collection('coupons').get(),
        db.collection('cash_sessions').get(),
        db.collection('orders').get(),
        db.collection('customers_crm').get(),
        db.collection('financial_records').get(),
        db.collection('suppliers').get(),
      ]);

      const tenant = tenantSnap.exists ? tenantSnap.data() : null;
      const menuItems = menuSnap.docs.map(d => d.data()).filter(m => !m._deleted && m.storeId === storeId && m.tenantId === tenantId);
      const tables = tablesSnap.docs.map(d => d.data()).filter(t => !t._deleted && t.storeId === storeId && t.tenantId === tenantId);
      const inventoryBatches = batchesSnap.docs.map(d => d.data()).filter(b => !b._deleted && b.storeId === storeId && b.tenantId === tenantId);
      const reservations = resSnap.docs.map(d => d.data()).filter(r => !r._deleted && r.storeId === storeId && r.tenantId === tenantId);
      const coupons = couponsSnap.docs
        .map(d => d.data())
        .filter(c => !c._deleted && c.audience !== 'MERCHANT' && c.tenantId === tenantId && (!c.storeId || c.storeId === storeId));
      const cashSessions = cashSnap.docs.map(d => d.data()).filter(s => !s._deleted && s.storeId === storeId && s.tenantId === tenantId);
      const orders = ordersSnap.docs.map(d => d.data()).filter(o => !o._deleted && o.storeId === storeId && o.tenantId === tenantId);
      const customersCrm = customersSnap.docs.map(d => d.data()).filter(c => !c._deleted && c.tenantId === tenantId && (!c.storeId || c.storeId === storeId));
      const financialRecords = financeSnap.docs.map(d => d.data()).filter(f => !f._deleted && f.storeId === storeId && f.tenantId === tenantId);
      const suppliers = suppliersSnap.docs.map(d => d.data()).filter(s => !s._deleted && s.tenantId === tenantId && (!s.storeId || s.storeId === storeId));
      const EDGE_ALLOWED_BOOT_ROLES = new Set([
        'DEV_OWNER',
        'SUPER_ADMIN',
        'REGIONAL_MANAGER',
        'STORE_OWNER',
        'STORE_MANAGER',
        'CASHIER',
        'WAITER',
        'KITCHEN_STAFF',
      ]);
      const users = usersSnap.docs
        .map(d => {
          const u = { ...d.data() };
          delete u.passwordHash;
          delete u.resetCodeHash;
          return u;
        })
        .filter(
          u =>
            u &&
            !u._deleted &&
            !u.disabled &&
            String(u.status || 'ACTIVE').toUpperCase() !== 'DISABLED' &&
            EDGE_ALLOWED_BOOT_ROLES.has(String(u.role || '').toUpperCase()) &&
            u.tenantId === tenantId &&
            (!u.storeId || u.storeId === storeId)
        );

      res.json({
        tenant,
        store,
        menuItems,
        tables,
        inventoryBatches,
        reservations,
        users,
        coupons,
        cashSessions,
        orders,
        customersCrm,
        financialRecords,
        suppliers,
        serverHlc: generateHlcTimestamp('cloud_core'),
      });
    } catch {
      res.status(500).json({ error: 'Erro ao gerar snapshot de bootstrap do Edge Node.' });
    }
  }
);

export default router;
