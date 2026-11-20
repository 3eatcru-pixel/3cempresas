import express from 'express';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { StorageService } from '../src/services/StorageService.ts';
import { generateHlcTimestamp, generateIdempotencyKey } from '../src/utils/idGenerator.ts';
import { getPlatformAdapters, registerPlatformAdapters } from '../src/core/platform/PlatformAdapter.ts';
import { syncEngine } from '../src/core/sync/SyncEngine.ts';

const ownTempDir = !process.env.SERVER_DB_PATH ? fs.mkdtempSync(path.join(os.tmpdir(), '3c-phase3-sync-')) : null;
if (ownTempDir) {
  process.env.SERVER_DB_PATH = path.join(ownTempDir, 'phase3-sync-db.json');
}
if (!process.env.SERVER_SECRET_PATH && ownTempDir) {
  process.env.SERVER_SECRET_PATH = path.join(ownTempDir, '.server-secret');
}
if (!process.env.SERVER_SECRET) {
  process.env.SERVER_SECRET = '3c_phase3_sync_isolated_secret_2026';
}

let passed = 0;
let failed = 0;

function check(cond: boolean, name: string, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function run() {
  const { auth, db } = await import('../src/server/config.ts');
  const { attachContractContext, idempotencyGuard, PLATFORM_CONTRACT_MANIFEST } = await import('../src/server/middleware/contracts.ts');
  const { default: commerceRoutes } = await import('../src/server/routes/commerce.ts');
  const { default: storeRoutes } = await import('../src/server/routes/store.ts');
  const { default: syncRoutes } = await import('../src/server/routes/sync.ts');

  console.log('=================================================================');
  console.log('🔄 SUÍTE DE VALIDAÇÃO FASE 3 — PERSISTÊNCIA, LEDGER & EDGE SYNC');
  console.log('=================================================================\n');

  const app = express();
  app.use(express.json());
  app.use(attachContractContext);
  app.get('/api/v1/system/contracts', (_req, res) => res.json(PLATFORM_CONTRACT_MANIFEST));
  app.use('/api/v1/commerce', idempotencyGuard, commerceRoutes);
  app.use('/api/v1/store', storeRoutes);
  app.use('/api/v1/sync', idempotencyGuard, syncRoutes);

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await db.collection('tenants').doc('tenant-1').set({ id: 'tenant-1', name: 'Platform Root', status: 'ACTIVE' });
    await db.collection('tenants').doc('tnt_phase3_alpha').set({ id: 'tnt_phase3_alpha', name: 'Alpha Phase 3', status: 'ACTIVE' });
    await db.collection('tenants').doc('tnt_beta_phase3').set({ id: 'tnt_beta_phase3', name: 'Beta Phase 3', status: 'ACTIVE' });

    await db.collection('users').doc('usr-dev-master').set({
      uid: 'usr-dev-master',
      id: 'usr-dev-master',
      email: '3eatcru@gmail.com',
      name: 'Master HQ',
      role: 'DEV_OWNER',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      tokenVersion: 1,
    });
    await db.collection('users').doc('usr_tenant_b_owner').set({
      uid: 'usr_tenant_b_owner',
      id: 'usr_tenant_b_owner',
      email: 'owner-b@example.com',
      name: 'Tenant B Owner',
      role: 'STORE_OWNER',
      tenantId: 'tnt_beta_phase3',
      storeId: 'str_beta_phase3',
      status: 'ACTIVE',
      tokenVersion: 1,
    });
    await db.collection('users').doc('usr_phase3_alpha').set({
      uid: 'usr_phase3_alpha',
      id: 'usr_phase3_alpha',
      email: 'alpha@phase3.test',
      name: 'Alpha Owner',
      role: 'STORE_OWNER',
      tenantId: 'tnt_phase3_alpha',
      storeId: 'str_phase3_store',
      status: 'ACTIVE',
      tokenVersion: 1,
    });

    const devToken = auth.generateDevToken({
      uid: 'usr-dev-master',
      email: '3eatcru@gmail.com',
      email_verified: true,
      name: 'Master HQ',
      role: 'DEV_OWNER',
      tenantId: 'tenant-1',
      tokenVersion: 1,
    });

    const tenantBToken = auth.generateDevToken({
      uid: 'usr_tenant_b_owner',
      email: 'owner-b@example.com',
      email_verified: true,
      name: 'Tenant B Owner',
      role: 'STORE_OWNER',
      tenantId: 'tnt_beta_phase3',
      storeId: 'str_beta_phase3',
      tokenVersion: 1,
    });

    // 1. Contract Manifest check
    const manifestResp = await fetch(`${baseUrl}/api/v1/system/contracts`);
    const manifest = await manifestResp.json();
    check(
      manifestResp.status === 200 && manifest.edgeMode === 'standard' && manifest.desktopRuntime === 'tauri-2',
      '1. Manifesto /api/v1/system/contracts reflete Edge Padrão e Tauri 2'
    );

    // 2. Seed isolated test store, raw batch & BOM product
    const testStoreId = 'str_phase3_store';
    const testTenantId = 'tnt_phase3_alpha';
    const testProductId = 'prd_phase3_burger';
    const testBatchId = 'bat_phase3_beef';

    const alphaOwnerToken = auth.generateDevToken({
      uid: 'usr_phase3_alpha',
      email: 'alpha@phase3.test',
      email_verified: true,
      name: 'Alpha Owner',
      role: 'STORE_OWNER',
      tenantId: testTenantId,
      storeId: testStoreId,
      tokenVersion: 1,
    });

    await db.collection('stores').doc(testStoreId).set({
      id: testStoreId,
      tenantId: testTenantId,
      name: 'Loja Teste Phase 3',
      category: 'RESTAURANT',
      deliveryFee: 5,
      isOpen: true,
    });

    await db.collection('inventory_batches').doc(testBatchId).set({
      id: testBatchId,
      tenantId: testTenantId,
      storeId: testStoreId,
      sku: 'SKU-BEEF-P3',
      name: 'Carne Bovina Phase 3',
      quantity: 10,
      expirationDate: '2026-12-31',
    });

    await db.collection('menu_items').doc(testProductId).set({
      id: testProductId,
      tenantId: testTenantId,
      storeId: testStoreId,
      name: 'Burger Phase 3',
      price: 30,
      stock: 10,
      isAvailable: true,
      recipe: [
        { ingredientId: 'SKU-BEEF-P3', ingredientName: 'Carne Bovina Phase 3', quantityRequired: 0.25 },
      ],
    });

    // 3. Idempotent Order Commit + Stock Ledger (SALE + BOM_FIFO) + Outbox
    const idmKey = generateIdempotencyKey();
    const orderPayload = {
      storeId: testStoreId,
      channel: 'POS',
      deliveryModality: 'PICKUP',
      customerName: 'Cliente Phase 3',
      items: [{ menuItemId: testProductId, quantity: 2 }],
    };

    const orderResp1 = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alphaOwnerToken}`,
        'Idempotency-Key': idmKey,
        'X-3C-App-Id': 'store-os',
        'X-3C-Platform': 'tauri-windows',
      },
      body: JSON.stringify(orderPayload),
    });
    const orderJson1 = await orderResp1.json();
    check(
      orderResp1.status === 201 && orderJson1.success === true && orderJson1.transaction?.total === 60,
      '2. Pedido POS com Idempotency-Key criado e validado matematicamente (total 60)'
    );

    const orderResp2 = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alphaOwnerToken}`,
        'Idempotency-Key': idmKey,
      },
      body: JSON.stringify(orderPayload),
    });
    const orderJson2 = await orderResp2.json();
    check(
      orderResp2.headers.get('x-3c-idempotent-replay') === 'true' &&
        orderJson2.transaction?.orderId === orderJson1.transaction?.orderId,
      '3. Replay com mesma Idempotency-Key retorna resposta cacheada sem duplicar venda ou baixar estoque 2x'
    );

    // 4. Verify Stock Ledger (stk_) has both SALE (-2 -> 8) and BOM_FIFO (-0.5 -> 9.5)
    const ledgerResp = await fetch(
      `${baseUrl}/api/v1/sync/stock-ledger?orderId=${encodeURIComponent(orderJson1.transaction.orderId)}`,
      { headers: { Authorization: `Bearer ${alphaOwnerToken}` } }
    );
    const ledgerEntries: any[] = await ledgerResp.json();
    const saleEntry = ledgerEntries.find(e => e.reason === 'SALE' && e.targetId === testProductId);
    const fifoEntry = ledgerEntries.find(e => e.reason === 'BOM_FIFO' && e.targetId === testBatchId);
    check(
      Boolean(saleEntry?.id?.startsWith('stk_')) &&
        saleEntry?.deltaQty === -2 &&
        saleEntry?.balanceAfter === 8 &&
        Boolean(fifoEntry?.id?.startsWith('stk_')) &&
        fifoEntry?.deltaQty === -0.5 &&
        fifoEntry?.balanceAfter === 9.5,
      '4. Stock Ledger (stk_) registra movimentos imutáveis de produto (SALE) e insumo FIFO (BOM_FIFO)'
    );

    // 5. Edge Node Registration + Tenant Isolation
    const regResp = await fetch(`${baseUrl}/api/v1/sync/edge/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alphaOwnerToken}`,
      },
      body: JSON.stringify({
        storeId: testStoreId,
        hostname: 'caixas-balcao-01',
        lanIp: '192.168.10.45',
        port: 3300,
        platform: 'linux',
      }),
    });
    const regJson = await regResp.json();
    check(
      regResp.status === 201 && regJson.edgeNode?.id?.startsWith('edg_'),
      '5. Registro de 3C Edge Node gera identificador canônico edg_ e persiste heartbeat'
    );

    const crossTenantEdgeResp = await fetch(`${baseUrl}/api/v1/sync/edge/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantBToken}`,
      },
      body: JSON.stringify({ storeId: testStoreId, hostname: 'attacker-edge' }),
    });
    check(
      crossTenantEdgeResp.status === 403,
      '6. Bloqueio 403 ao tentar parear Edge Node em loja de outro tenant'
    );

    // 6. Sync Push (valid upsert, delta inventory reconcile, deduplication, and restricted collection block)
    const pushKey1 = generateIdempotencyKey();
    const pushKey2 = generateIdempotencyKey();
    const hlcPush = generateHlcTimestamp(regJson.edgeNode.id);

    const pushResp = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alphaOwnerToken}`,
      },
      body: JSON.stringify({
        nodeId: regJson.edgeNode.id,
        storeId: testStoreId,
        mutations: [
          {
            idempotencyKey: pushKey1,
            entity: 'tables',
            entityId: 'tbl_phase3_01',
            operation: 'UPSERT',
            hlc: hlcPush,
            payload: { tableNumber: 12, status: 'OCCUPIED', capacity: 4 },
          },
          {
            idempotencyKey: pushKey2,
            entity: 'inventory_batches',
            entityId: testBatchId,
            operation: 'UPSERT',
            hlc: hlcPush,
            deltaQty: 5, // 9.5 + 5 = 14.5
            payload: { sku: 'SKU-BEEF-P3' },
          },
          {
            idempotencyKey: generateIdempotencyKey(),
            entity: 'users',
            entityId: 'usr-dev-master',
            operation: 'UPSERT',
            hlc: hlcPush,
            payload: { role: 'DEV_OWNER' },
          },
        ],
      }),
    });
    const pushJson = await pushResp.json();
    const updatedBatch = (await db.collection('inventory_batches').doc(testBatchId).get()).data();
    check(
      pushResp.status === 200 &&
        pushJson.accepted?.length === 2 &&
        pushJson.rejected?.some((r: any) => r.entity === 'users' && r.reason === 'FORBIDDEN_COLLECTION') &&
        updatedBatch?.quantity === 14.5,
      '7. Sync Push reconcilia deltas de estoque (9.5 + 5 = 14.5) e bloqueia coleções sensíveis (users)'
    );

    // Push replay deduplication check
    const pushReplayResp = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alphaOwnerToken}`,
      },
      body: JSON.stringify({
        nodeId: regJson.edgeNode.id,
        storeId: testStoreId,
        mutations: [
          {
            idempotencyKey: pushKey2,
            entity: 'inventory_batches',
            entityId: testBatchId,
            operation: 'UPSERT',
            hlc: generateHlcTimestamp(regJson.edgeNode.id),
            deltaQty: 5,
            payload: {},
          },
        ],
      }),
    });
    const pushReplayJson = await pushReplayResp.json();
    const batchAfterReplay = (await db.collection('inventory_batches').doc(testBatchId).get()).data();
    check(
      pushReplayJson.deduplicated?.length === 1 && batchAfterReplay?.quantity === 14.5,
      '8. Sync Push deduplica idempotencyKey repetida sem reaplicar delta no estoque'
    );

    // 7. Sync Pull delta check & tenant isolation
    const pullAlphaResp = await fetch(`${baseUrl}/api/v1/sync/pull`, {
      headers: { Authorization: `Bearer ${alphaOwnerToken}` },
    });
    const pullAlphaJson = await pullAlphaResp.json();
    const pullBetaResp = await fetch(`${baseUrl}/api/v1/sync/pull`, {
      headers: { Authorization: `Bearer ${tenantBToken}` },
    });
    const pullBetaJson = await pullBetaResp.json();

    check(
      pullAlphaJson.cursorId?.startsWith('cur_') &&
        pullAlphaJson.entries.length >= 4 &&
        pullAlphaJson.entries.every((e: any) => e.tenantId === testTenantId) &&
        pullBetaJson.entries.length === 0,
      '9. Sync Pull retorna outbox ordenado com cursor cur_ e isolamento estrito por tenantId'
    );

    // 8. StorageService generalized offline mutation queue (Node fallback test)
    const offlineMut = await StorageService.enqueueOfflineMutation({
      entity: 'tables',
      entityId: 'tbl_offline_1',
      storeId: testStoreId,
      appId: 'waiter',
      payload: { status: 'OCCUPIED' },
    });
    const queued = await StorageService.getPendingMutations();
    await StorageService.removeSyncedMutation(offlineMut.id);
    const afterRemove = await StorageService.getPendingMutations();
    check(
      offlineMut.id.startsWith('idm_') && queued.length === 1 && afterRemove.length === 0,
      '10. StorageService v2 gerencia fila genérica pending-mutations com idm_ e HLC'
    );

    // 9. Sync status capability check
    const statusResp = await fetch(`${baseUrl}/api/v1/sync/status`, {
      headers: { Authorization: `Bearer ${devToken}` },
    });
    const statusJson = await statusResp.json();
    check(
      statusJson.driver?.kind === 'json-memory' &&
        Boolean(statusJson.availableDrivers?.['postgres-cloud']) &&
        Boolean(statusJson.availableDrivers?.['sqlite-wal-edge']),
      '11. Endpoint /api/v1/sync/status expõe driver ativo e registry PG/SQLite WAL'
    );

    // 10. SyncEngine end-to-end (pair -> enqueue offline table update -> flushAll -> verify server updated)
    const defaultNet = getPlatformAdapters().network;
    registerPlatformAdapters({
      network: {
        ...defaultNet,
        getRootBaseUrl: () => baseUrl,
        getApiBaseUrl: () => `${baseUrl}/api/v1`,
        isOnline: () => true,
      },
    });
    const pairedEdge = await syncEngine.pairEdgeNode(
      {
        storeId: testStoreId,
        storeName: 'Loja Teste Phase 3',
        edgeBaseUrl: baseUrl,
        hostname: 'edge-client-e2e',
      },
      alphaOwnerToken
    );
    await syncEngine.enqueueMutation({
      entity: 'tables',
      entityId: 'tbl_sync_engine_01',
      storeId: testStoreId,
      appId: 'waiter',
      payload: { tableNumber: 7, status: 'BILL_REQUESTED', storeId: testStoreId },
    });
    const flushRes = await syncEngine.flushAll(alphaOwnerToken, testStoreId);
    const syncedTableSnap = await db.collection('tables').doc('tbl_sync_engine_01').get();
    syncEngine.unpairEdgeNode();
    check(
      pairedEdge.nodeId.startsWith('edg_') &&
        flushRes.syncedMutations === 1 &&
        syncedTableSnap.exists &&
        syncedTableSnap.data()?.status === 'BILL_REQUESTED',
      '12. SyncEngine realiza pareamento edg_, enfileira offline e executa flushAll para o servidor'
    );
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (ownTempDir) {
      try {
        fs.rmSync(ownTempDir, { recursive: true, force: true });
      } catch {}
    }
  }

  console.log(`\nResultado Fase 3: ${passed} aprovados, ${failed} falhas.`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
