import express from 'express';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { EdgeNodeRuntime as EdgeNodeRuntimeType } from '../../servers/edge-node/index.ts';
import { generateIdempotencyKey } from '../../src/utils/idGenerator.ts';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-edge-wan-'));
if (!process.env.SERVER_DB_PATH) {
  process.env.SERVER_DB_PATH = path.join(tempDir, 'cloud-wan-db.json');
}
if (!process.env.SERVER_SECRET_PATH) {
  process.env.SERVER_SECRET_PATH = path.join(tempDir, '.server-secret');
}
if (!process.env.SERVER_SECRET) {
  process.env.SERVER_SECRET = '3c_edge_wan_isolated_secret_2026';
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
  const { auth, db } = await import('../../src/server/config.ts');
  const {
    attachContractContext,
    idempotencyGuard,
    PLATFORM_CONTRACT_MANIFEST,
  } = await import('../../src/server/middleware/contracts.ts');
  const { default: commerceRoutes } = await import('../../src/server/routes/commerce.ts');
  const { default: storeRoutes } = await import('../../src/server/routes/store.ts');
  const { default: syncRoutes } = await import('../../src/server/routes/sync.ts');
  const { SqliteWalDriver } = await import('../../src/server/persistence/SqliteWalDriver.ts');
  const { EdgeNodeRuntime } = await import('../../servers/edge-node/index.ts');

  console.log('=================================================================');
  console.log('🌐 TESTE CROSS-PLATFORM FASE 4 — EDGE SQLITE WAL & QUEDA DE WAN');
  console.log('=================================================================\n');

  const sqliteFile = path.join(tempDir, 'edge-node-store.sqlite');

  // 1. Spin up Cloud Server Core (in-process Express over ephemeral port)
  const cloudApp = express();
  cloudApp.use(express.json());
  cloudApp.use(attachContractContext);
  cloudApp.get('/api/v1/system/contracts', (_req, res) => res.json(PLATFORM_CONTRACT_MANIFEST));
  cloudApp.use('/api/v1/commerce', idempotencyGuard, commerceRoutes);
  cloudApp.use('/api/v1/store', storeRoutes);
  cloudApp.use('/api/v1/sync', idempotencyGuard, syncRoutes);

  const cloudServer = http.createServer(cloudApp);
  await new Promise<void>((resolve) => cloudServer.listen(0, '127.0.0.1', () => resolve()));
  const cloudPort = (cloudServer.address() as { port: number }).port;
  const cloudBaseUrl = `http://127.0.0.1:${cloudPort}`;

  let edgeRuntime: EdgeNodeRuntimeType | null = null;

  try {
    const storeId = 'str_wan_phase4';
    const tenantId = 'tnt_wan_phase4';
    const productId = 'prd_wan_burger';
    const tableId = 'tbl_wan_01';

    await db.collection('tenants').doc('tenant-1').set({ id: 'tenant-1', name: '3C Platform', status: 'ACTIVE' });
    await db.collection('tenants').doc(tenantId).set({ id: tenantId, name: 'WAN Test Tenant', status: 'ACTIVE' });

    const wanUsers = [
      {
        uid: 'usr_wan_owner',
        email: 'owner@wan-test.local',
        name: 'Owner WAN Test',
        role: 'STORE_OWNER',
        tenantId,
        storeId,
        status: 'ACTIVE',
      },
      {
        uid: 'usr_wan_waiter',
        email: 'waiter@wan-test.local',
        name: 'Garçom LAN',
        role: 'WAITER',
        tenantId,
        storeId,
        status: 'ACTIVE',
      },
      {
        uid: 'usr_wan_consumer',
        email: 'consumer@wan-test.local',
        name: 'Consumidor Marketplace',
        role: 'CONSUMER',
        tenantId: 'tenant-1',
        status: 'ACTIVE',
      },
    ];
    for (const u of wanUsers) {
      await db.collection('users').doc(u.uid).set(u);
    }

    const storeOwnerToken = auth.generateDevToken({
      uid: 'usr_wan_owner',
      email: 'owner@wan-test.local',
      email_verified: true,
      name: 'Owner WAN Test',
      role: 'STORE_OWNER',
      tenantId,
      storeId,
    });

    const waiterToken = auth.generateDevToken({
      uid: 'usr_wan_waiter',
      email: 'waiter@wan-test.local',
      email_verified: true,
      name: 'Garçom LAN',
      role: 'WAITER',
      tenantId,
      storeId,
    });

    const consumerToken = auth.generateDevToken({
      uid: 'usr_wan_consumer',
      email: 'consumer@wan-test.local',
      email_verified: true,
      name: 'Consumidor Marketplace',
      role: 'CONSUMER',
      tenantId: 'tenant-1',
    });

    // Seed Cloud state (initial stock = 10)
    const storeDoc = {
      id: storeId,
      tenantId,
      name: 'Burger House Edge Test',
      category: 'RESTAURANT',
      deliveryFee: 5,
      isOpen: true,
    };
    const menuItemDoc = {
      id: productId,
      tenantId,
      storeId,
      name: 'X-Burger Edge',
      price: 35,
      stock: 10,
      isAvailable: true,
    };
    const tableDoc = {
      id: tableId,
      tenantId,
      storeId,
      tableNumber: 1,
      capacity: 4,
      status: 'AVAILABLE',
    };

    await db.collection('stores').doc(storeId).set(storeDoc);
    await db.collection('menu_items').doc(productId).set(menuItemDoc);
    await db.collection('tables').doc(tableId).set(tableDoc);

    // 2. Start Edge Node Runtime backed by native SQLite WAL on disk
    edgeRuntime = new EdgeNodeRuntime({
      storeId,
      tenantId,
      dbPath: sqliteFile,
      port: 0,
      cloudBaseUrl,
    });
    await edgeRuntime.seedFromCloudSnapshot({
      store: storeDoc,
      menuItems: [menuItemDoc],
      tables: [tableDoc],
      users: wanUsers.filter((u) => u.tenantId === tenantId),
    });
    const edgePort = await edgeRuntime.listen(0);
    const edgeBaseUrl = `http://127.0.0.1:${edgePort}`;

    const edgeHealthResp = await fetch(`${edgeBaseUrl}/api/v1/health`);
    const edgeHealth = await edgeHealthResp.json();
    const edgeSyncStatusResp = await fetch(`${edgeBaseUrl}/api/v1/sync/status`, {
      headers: { Authorization: `Bearer ${storeOwnerToken}` },
    });
    const edgeSyncStatus = await edgeSyncStatusResp.json();
    check(
      edgeHealthResp.status === 200 &&
        edgeHealth.walMode === 'WAL' &&
        edgeSyncStatusResp.status === 200 &&
        edgeSyncStatus.nodeId?.startsWith('edg_'),
      '1. Edge Node Runtime inicializado com SQLite nativo em modo WAL e prefixo edg_',
      JSON.stringify({ edgeHealth, edgeSyncStatus })
    );

    // Register Edge Node in Cloud while online before WAN drop
    const regResp = await fetch(`${cloudBaseUrl}/api/v1/sync/edge/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${storeOwnerToken}`,
      },
      body: JSON.stringify({
        nodeId: edgeRuntime.nodeId,
        storeId,
        hostname: 'edge-linux-01',
        lanIp: '127.0.0.1',
        port: edgePort,
        platform: 'linux',
      }),
    });
    const regJson = await regResp.json();
    check(
      regResp.status === 201 && regJson.edgeNode?.id === edgeRuntime.nodeId,
      '2. Edge Node registrado na 3C Cloud antes da simulação de queda de WAN'
    );

    // 3. Simulate WAN Drop:
    //    (a) Offline Store OS POS on Edge sells 2 units (local stock 10 -> 8)
    //    (b) Offline Waiter on LAN marks table 1 as OCCUPIED
    //    (c) Simultaneously on Cloud, Marketplace consumer buys 3 units (cloud stock 10 -> 7)
    const edgeOrderResp = await fetch(`${edgeBaseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${storeOwnerToken}`,
        'Idempotency-Key': generateIdempotencyKey(),
        'X-3C-App-Id': 'store-os',
        'X-3C-Platform': 'tauri-linux',
      },
      body: JSON.stringify({
        storeId,
        channel: 'POS',
        deliveryModality: 'PICKUP',
        customerName: 'Cliente Balcão Offline',
        items: [{ menuItemId: productId, quantity: 2 }],
      }),
    });
    const edgeOrderJson = await edgeOrderResp.json();
    const edgeLocalItemAfterSale = await edgeRuntime.driver.getDoc<any>('menu_items', productId);
    check(
      edgeOrderResp.status === 201 &&
        edgeOrderJson.transaction?.total === 70 &&
        edgeLocalItemAfterSale?.stock === 8,
      '3. Venda POS offline no Edge Node grava no SQLite WAL e baixa estoque local (10 -> 8)'
    );

    const waiterTableResp = await fetch(`${edgeBaseUrl}/api/v1/store/tables/${tableId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${waiterToken}`,
      },
      body: JSON.stringify({ status: 'OCCUPIED' }),
    });
    check(
      waiterTableResp.status === 200,
      '4. Garçom (Waiter LAN) atualiza status de mesa no Edge Node durante queda de WAN'
    );

    const cloudOrderResp = await fetch(`${cloudBaseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${consumerToken}`,
        'Idempotency-Key': generateIdempotencyKey(),
        'X-3C-App-Id': 'marketplace',
        'X-3C-Platform': 'capacitor-android',
      },
      body: JSON.stringify({
        storeId,
        channel: 'MARKETPLACE',
        deliveryModality: 'DELIVERY',
        customerName: 'Consumidor Marketplace Online',
        deliveryAddress: 'Rua Central, 100',
        items: [{ menuItemId: productId, quantity: 3 }],
      }),
    });
    const cloudOrderJson = await cloudOrderResp.json();
    const cloudItemBeforeSync = (await db.collection('menu_items').doc(productId).get()).data();
    check(
      cloudOrderResp.status === 201 && cloudItemBeforeSync?.stock === 7,
      '5. Pedido simultâneo no Marketplace Cloud baixa estoque na Cloud (10 -> 7)'
    );

    // Verify persistence across Edge restart before WAN recovery
    const savedNodeId = edgeRuntime.nodeId;
    await edgeRuntime.close();
    const diskProbe = new SqliteWalDriver(sqliteFile);
    const probeWalMode = diskProbe.getWalMode();
    const probeOrder = await diskProbe.getDoc<any>('orders', edgeOrderJson.transaction.orderId);
    const probeOutbox = await diskProbe.listDocs<any>('sync_outbox');
    diskProbe.close();
    check(
      probeWalMode === 'WAL' &&
        Boolean(probeOrder) &&
        probeOutbox.filter((o) => !o.syncedToCloudAt).length === 4,
      '6. Persistência ACID em arquivo SQLite WAL sobrevive ao reinício do Edge Node (4 eventos no outbox: estoque, pedido, financeiro e mesa)'
    );

    // Reopen EdgeNodeRuntime simulating process restart and WAN recovery
    edgeRuntime = new EdgeNodeRuntime({
      nodeId: savedNodeId,
      storeId,
      tenantId,
      dbPath: sqliteFile,
      port: 0,
      cloudBaseUrl,
    });
    const reopenedPort = await edgeRuntime.listen(0);

    // 4. Restore WAN -> Trigger bidirectional reconciliation via Edge endpoint /api/v1/edge/sync
    const syncHttpResp = await fetch(`http://127.0.0.1:${reopenedPort}/api/v1/edge/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${storeOwnerToken}`,
      },
      body: JSON.stringify({ cloudBaseUrl }),
    });
    const syncReport = await syncHttpResp.json();
    check(
      syncHttpResp.status === 200 &&
        syncReport.pushedAccepted === 4 &&
        syncReport.pulledEntries >= 4,
      '7. Reconciliação bidirecional pós-queda envia 4 mutações pendentes do Edge e puxa deltas da Cloud',
      JSON.stringify(syncReport)
    );

    // Trigger second sync to ensure strict idempotency (zero duplicate writes)
    const secondSyncReport = await edgeRuntime.syncWithCloud(cloudBaseUrl, storeOwnerToken);
    check(
      secondSyncReport.pushedAccepted === 0 && secondSyncReport.pushedDeduplicated === 0,
      '8. Segunda sincronização após convergência não reenvia nem duplica mutações já confirmadas'
    );

    // 5. Assert final convergence across BOTH Cloud & Edge (10 - 3 Cloud - 2 Edge = 5)
    const cloudFinalItem = (await db.collection('menu_items').doc(productId).get()).data();
    const edgeFinalItem = await edgeRuntime.driver.getDoc<any>('menu_items', productId);
    const cloudOrdersSnap = await db.collection('orders').get();
    const cloudStoreOrders = cloudOrdersSnap.docs.map((d) => d.data()).filter((o) => o.storeId === storeId);
    const edgeOrders = await edgeRuntime.driver.listDocs<any>('orders');
    const cloudTable = (await db.collection('tables').doc(tableId).get()).data();

    const ledgerResp = await fetch(
      `${cloudBaseUrl}/api/v1/sync/stock-ledger?storeId=${encodeURIComponent(storeId)}`,
      { headers: { Authorization: `Bearer ${storeOwnerToken}` } }
    );
    const ledger: any[] = await ledgerResp.json();
    const hasSaleMinus3 = ledger.some((l) => l.targetId === productId && l.reason === 'SALE' && l.deltaQty === -3);
    const hasReconcileMinus2 = ledger.some(
      (l) => l.targetId === productId && l.reason === 'SYNC_RECONCILE' && l.deltaQty === -2 && l.balanceAfter === 5
    );

    check(
      cloudFinalItem?.stock === 5 && edgeFinalItem?.stock === 5,
      `9. Estoque converge para exatamente 5 na Cloud (${cloudFinalItem?.stock}) e no Edge (${edgeFinalItem?.stock}) sem perda por sobrescrita`
    );

    check(
      cloudStoreOrders.length === 2 &&
        edgeOrders.length === 2 &&
        cloudTable?.status === 'OCCUPIED' &&
        hasSaleMinus3 &&
        hasReconcileMinus2,
      '10. Cloud e Edge possuem ambos os 2 pedidos, mesa OCCUPIED e Stock Ledger auditável (SALE -3 + SYNC_RECONCILE -2)'
    );
  } finally {
    if (edgeRuntime) {
      await edgeRuntime.close().catch(() => {});
    }
    cloudServer.closeAllConnections?.();
    await new Promise<void>((resolve) => cloudServer.close(() => resolve()));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log(`\nResultado Fase 4 Edge/WAN: ${passed} aprovados, ${failed} falhas.`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
