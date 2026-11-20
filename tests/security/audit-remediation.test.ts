import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-audit-rem-'));
const backupDir = path.join(tmpDir, 'durable-backups');
const prevBackupDir = process.env.SERVER_BACKUP_DIR;
process.env.SERVER_BACKUP_DIR = backupDir;
if (!process.env.SERVER_DB_PATH) process.env.SERVER_DB_PATH = path.join(tmpDir, 'rem-test-db.json');
if (!process.env.SERVER_SECRET_PATH) process.env.SERVER_SECRET_PATH = path.join(tmpDir, '.server-secret');
if (!process.env.SERVER_SECRET) process.env.SERVER_SECRET = '3c_audit_rem_isolated_secret_2026';

let passed = 0;
let failed = 0;

function check(condition: boolean, label: string, details?: string) {
  if (condition) {
    passed++;
    console.log(`✓ ${label}`);
  } else {
    failed++;
    console.error(`✗ ${label}${details ? ` -> ${details}` : ''}`);
  }
}

async function run() {
  const { createServerCoreApp } = await import('../../src/server/app.ts');
  const { auth, db, verifyPassword, computeSnapshotChecksum, assertProductionSecretConfigured, getRuntimePersistenceCapabilities } = await import('../../src/server/config.ts');
  const { resolvePersistenceDriver } = await import('../../src/server/persistence/PersistenceDriver.ts');
  const { assertSecureCloudUrl, EdgeNodeRuntime } = await import('../../servers/edge-node/index.ts');

  console.log('======================================================================');
  console.log('🛡️ 3C AUDIT REMEDIATION 5.2.1 — P0 / P1 / P2 NEGATIVE & REGRESSION SUITE');
  console.log('======================================================================');

  const app = createServerCoreApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;

  let edgeA: InstanceType<typeof EdgeNodeRuntime> | null = null;
  let edgePort = 0;

  try {
    // 1. P0 Persistence truthfulness & incomplete PG guard
    const pgBlockedDriver = resolvePersistenceDriver({
      DATABASE_URL: 'postgres://user:pass@localhost:5432/3cdb',
      ALLOW_INSECURE_HTTP: 'false',
    });
    const rtCaps = getRuntimePersistenceCapabilities();
    check(
      pgBlockedDriver.capabilities.kind === 'json-memory' &&
        rtCaps.persistenceDriver === 'json-memory' &&
        rtCaps.productionDatabaseReady === false,
      'P0-1. Driver PostgreSQL incompleto bloqueado por padrão e getRuntimePersistenceCapabilities permanece verdadeiro (json-memory)',
      JSON.stringify({ driverKind: pgBlockedDriver.capabilities.kind, rtCaps })
    );

    // Seed 2 companies x 2 branches
    await Promise.all([
      db.collection('tenants').doc('t-alpha').set({ id: 't-alpha', name: 'Empresa Alpha', status: 'ACTIVE', plan: 'ENTERPRISE' }),
      db.collection('tenants').doc('t-beta').set({ id: 't-beta', name: 'Empresa Beta', status: 'ACTIVE', plan: 'ENTERPRISE' }),
      db.collection('stores').doc('s-a1').set({ id: 's-a1', tenantId: 't-alpha', name: 'Alpha Matriz', category: 'RESTAURANT', deliveryFee: 5 }),
      db.collection('stores').doc('s-a2').set({ id: 's-a2', tenantId: 't-alpha', name: 'Alpha Filial 2', category: 'RESTAURANT', deliveryFee: 5 }),
      db.collection('stores').doc('s-b1').set({ id: 's-b1', tenantId: 't-beta', name: 'Beta Filial 1', category: 'RESTAURANT', deliveryFee: 5 }),
      db.collection('menu_items').doc('prd-a1').set({ id: 'prd-a1', tenantId: 't-alpha', storeId: 's-a1', name: 'Prato A1', price: 30, stock: 20, isAvailable: true }),
      db.collection('menu_items').doc('prd-a2').set({ id: 'prd-a2', tenantId: 't-alpha', storeId: 's-a2', name: 'Prato A2', price: 40, stock: 20, isAvailable: true }),
      db.collection('inventory_batches').doc('bat-a1').set({ id: 'bat-a1', tenantId: 't-alpha', storeId: 's-a1', sku: 'SKU-A1', name: 'Insumo A1', quantity: 50 }),
      db.collection('cash_sessions').doc('cash-a1').set({ id: 'cash-a1', tenantId: 't-alpha', storeId: 's-a1', status: 'OPEN', initialCash: 100, totalSales: 0, finalCashCalculated: 100, openedAt: new Date().toISOString() }),
      db.collection('users').doc('u-dev').set({ uid: 'u-dev', id: 'u-dev', email: 'dev@3c.local', role: 'DEV_OWNER', tenantId: 't-alpha', status: 'ACTIVE', tokenVersion: 1 }),
      db.collection('users').doc('u-mgr-a1').set({ uid: 'u-mgr-a1', id: 'u-mgr-a1', email: 'mgr@a1.local', role: 'STORE_MANAGER', tenantId: 't-alpha', storeId: 's-a1', status: 'ACTIVE', tokenVersion: 1 }),
      db.collection('users').doc('u-cash-a1').set({ uid: 'u-cash-a1', id: 'u-cash-a1', email: 'cash@a1.local', role: 'CASHIER', tenantId: 't-alpha', storeId: 's-a1', status: 'ACTIVE', tokenVersion: 1 }),
      db.collection('users').doc('u-waiter-a1').set({ uid: 'u-waiter-a1', id: 'u-waiter-a1', email: 'waiter@a1.local', role: 'WAITER', tenantId: 't-alpha', storeId: 's-a1', status: 'ACTIVE', tokenVersion: 1 }),
      db.collection('users').doc('u-kitchen-a1').set({ uid: 'u-kitchen-a1', id: 'u-kitchen-a1', email: 'kitchen@a1.local', role: 'KITCHEN_STAFF', tenantId: 't-alpha', storeId: 's-a1', status: 'ACTIVE', tokenVersion: 1 }),
      db.collection('users').doc('u-cash-nostore').set({ uid: 'u-cash-nostore', id: 'u-cash-nostore', email: 'cash.nostore@a1.local', role: 'CASHIER', tenantId: 't-alpha', status: 'ACTIVE', tokenVersion: 1 }),
      db.collection('users').doc('u-mgr-b1').set({ uid: 'u-mgr-b1', id: 'u-mgr-b1', email: 'mgr@b1.local', role: 'STORE_MANAGER', tenantId: 't-beta', storeId: 's-b1', status: 'ACTIVE', tokenVersion: 1 }),
      db.collection('users').doc('u-cust-1').set({ uid: 'u-cust-1', id: 'u-cust-1', email: 'cust@public.local', role: 'CONSUMER', status: 'ACTIVE', tokenVersion: 1 }),
    ]);

    const tokDev = auth.generateDevToken({ uid: 'u-dev', role: 'DEV_OWNER', tenantId: 't-alpha', tokenVersion: 1 });
    const tokMgrA1 = auth.generateDevToken({ uid: 'u-mgr-a1', role: 'STORE_MANAGER', tenantId: 't-alpha', storeId: 's-a1', tokenVersion: 1 });
    const tokCashA1 = auth.generateDevToken({ uid: 'u-cash-a1', role: 'CASHIER', tenantId: 't-alpha', storeId: 's-a1', tokenVersion: 1 });
    const tokWaiterA1 = auth.generateDevToken({ uid: 'u-waiter-a1', role: 'WAITER', tenantId: 't-alpha', storeId: 's-a1', tokenVersion: 1 });
    const tokKitchenA1 = auth.generateDevToken({ uid: 'u-kitchen-a1', role: 'KITCHEN_STAFF', tenantId: 't-alpha', storeId: 's-a1', tokenVersion: 1 });
    const tokCashNoStore = auth.generateDevToken({ uid: 'u-cash-nostore', role: 'CASHIER', tenantId: 't-alpha', tokenVersion: 1 });
    const tokMgrB1 = auth.generateDevToken({ uid: 'u-mgr-b1', role: 'STORE_MANAGER', tenantId: 't-beta', storeId: 's-b1', tokenVersion: 1 });
    const tokCust1 = auth.generateDevToken({ uid: 'u-cust-1', role: 'CONSUMER', tokenVersion: 1 });

    // 2. P0 Order creation channel allowlist + cross-branch / cross-tenant isolation
    const [unkChanRes, crossBranchMktRes, crossTenantMktRes, kitchenOrdRes, validCustRes] = await Promise.all([
      fetch(`${baseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCust1}` },
        body: JSON.stringify({ storeId: 's-a1', channel: 'GHOST_CHANNEL', paymentMethod: 'PIX', items: [{ menuItemId: 'prd-a1', quantity: 1 }] }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashA1}` },
        body: JSON.stringify({ storeId: 's-a2', channel: 'MARKETPLACE', paymentMethod: 'PIX', items: [{ menuItemId: 'prd-a2', quantity: 1 }] }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrB1}` },
        body: JSON.stringify({ storeId: 's-a2', channel: 'MARKETPLACE', paymentMethod: 'PIX', items: [{ menuItemId: 'prd-a2', quantity: 1 }] }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokKitchenA1}` },
        body: JSON.stringify({ storeId: 's-a1', channel: 'POS', paymentMethod: 'CASH', items: [{ menuItemId: 'prd-a1', quantity: 1 }] }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCust1}` },
        body: JSON.stringify({ storeId: 's-a1', channel: 'MARKETPLACE', paymentMethod: 'PIX', deliveryAddress: 'Rua 1', items: [{ menuItemId: 'prd-a1', quantity: 1 }] }),
      }),
    ]);

    const prdA2AfterCross = (await db.collection('menu_items').doc('prd-a2').get()).data();
    const prdA1AfterCust = (await db.collection('menu_items').doc('prd-a1').get()).data();
    check(
      unkChanRes.status === 400 &&
        crossBranchMktRes.status === 403 &&
        crossTenantMktRes.status === 403 &&
        kitchenOrdRes.status === 403 &&
        validCustRes.status === 201 &&
        prdA2AfterCross?.stock === 20 &&
        prdA1AfterCust?.stock === 19,
      'P0-2. Criação de pedido rejeita canal desconhecido (400), bloqueia cross-branch/cross-tenant via MARKETPLACE (403) e mantém estoque s-a2 intacto (0 mutações)',
      `unk=${unkChanRes.status}, xBr=${crossBranchMktRes.status}, xTen=${crossTenantMktRes.status}, kit=${kitchenOrdRes.status}, cust=${validCustRes.status}, stockA2=${prdA2AfterCross?.stock}`
    );

    // 3. P1 Fail-closed branch-locked user without storeId + No store-1 fallback in ledger
    const [noStoreStatusRes, noStoreInvRes, centralLedgerSyncRes] = await Promise.all([
      fetch(`${baseUrl}/api/v1/sync/status?storeId=s-a1`, {
        headers: { Authorization: `Bearer ${tokCashNoStore}` },
      }),
      fetch(`${baseUrl}/api/v1/store/inventory?storeId=s-a1`, {
        headers: { Authorization: `Bearer ${tokCashNoStore}` },
      }),
      fetch(`${baseUrl}/api/v1/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
        body: JSON.stringify({
          nodeId: 'web_central_erp',
          mutations: [
            {
              idempotencyKey: 'idm-central-wh-1',
              entity: 'inventory_batches',
              entityId: 'bat-central-01',
              operation: 'UPSERT',
              hlc: `${Date.now()}-0001-web_central_erp`,
              deltaQty: 10,
              payload: { id: 'bat-central-01', sku: 'SKU-CWH', name: 'Central Deposit' },
            },
          ],
        }),
      }),
    ]);

    const ledgersAll = (await db.collection('stock_ledger').get()).docs.map((d) => d.data());
    const centralLedger = ledgersAll.find((l) => l.targetId === 'bat-central-01');
    check(
      noStoreStatusRes.status === 403 &&
        noStoreInvRes.status === 403 &&
        centralLedgerSyncRes.status === 200 &&
        centralLedger?.storeId === 'CENTRAL_WAREHOUSE' &&
        !ledgersAll.some((l) => l.storeId === 'store-1' && l.targetId === 'bat-central-01'),
      'P1-3. Perfil de filial sem storeId falha fechado (403) e ledger sem filial usa CENTRAL_WAREHOUSE em vez de store-1',
      `noStSync=${noStoreStatusRes.status}, noStInv=${noStoreInvRes.status}, ledgerStore=${centralLedger?.storeId}`
    );

    // 4. P1 Sync Push hardening: Waiter protected fields, Order FSM, Unverified stock delta removal, Cashier financial_records RBAC
    const validOrdJson: any = await validCustRes.json();
    const targetOrdId = validOrdJson?.transaction?.orderId;
    const preSyncPushOrd = (await db.collection('orders').doc(targetOrdId).get()).data();
    const preSyncBatA1 = (await db.collection('inventory_batches').doc('bat-a1').get()).data();
    const preSyncLedgersCount = (await db.collection('stock_ledger').get()).docs.length;

    const regPushEdgeRes = await fetch(`${baseUrl}/api/v1/sync/edge/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrA1}` },
      body: JSON.stringify({ nodeId: 'edg_alpha_s1', storeId: 's-a1', hostname: 'alpha-s1-pdv' }),
    });
    const regPushEdgeJson: any = await regPushEdgeRes.json();
    const edgeAToken = regPushEdgeJson?.edgeToken;

    const maliciousPushRes = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokWaiterA1}` },
      body: JSON.stringify({
        nodeId: 'edg_alpha_s1',
        storeId: 's-a1',
        mutations: [
          {
            idempotencyKey: 'idm-waiter-tamper-price',
            entity: 'orders',
            entityId: targetOrdId,
            operation: 'UPSERT',
            hlc: `${Date.now()}-0001-edg_alpha_s1`,
            payload: { total: 0.01, paymentStatus: 'PAID', status: 'CONFIRMED' },
          },
          {
            idempotencyKey: 'idm-waiter-stock-boost',
            entity: 'inventory_batches',
            entityId: 'bat-a1',
            operation: 'UPSERT',
            hlc: `${Date.now()}-0002-edg_alpha_s1`,
            deltaQty: 500,
            payload: { id: 'bat-a1' },
          },
        ],
      }),
    });
    const maliciousPushJson: any = await maliciousPushRes.json();

    const cashierFinAndFsmRes = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashA1}` },
      body: JSON.stringify({
        nodeId: 'edg_alpha_s1',
        storeId: 's-a1',
        mutations: [
          {
            idempotencyKey: 'idm-cashier-fin-bypass',
            entity: 'financial_records',
            entityId: 'fin-forged-1',
            operation: 'UPSERT',
            hlc: `${Date.now()}-0003-edg_alpha_s1`,
            payload: { type: 'PAYABLE', amount: 9999, description: 'Desvio' },
          },
          {
            idempotencyKey: 'idm-cashier-menu-delta',
            entity: 'menu_items',
            entityId: 'prd-a1',
            operation: 'UPSERT',
            hlc: `${Date.now()}-0004-edg_alpha_s1`,
            deltaQty: 50,
            payload: { id: 'prd-a1' },
          },
          {
            idempotencyKey: 'idm-invalid-fsm-jump',
            entity: 'orders',
            entityId: targetOrdId,
            operation: 'UPSERT',
            hlc: `${Date.now()}-0005-edg_alpha_s1`,
            payload: { status: 'DELIVERED' },
          },
        ],
      }),
    });
    const cashierFinAndFsmJson: any = await cashierFinAndFsmRes.json();

    // Legitimate waiter status progression (PENDING -> CONFIRMED -> IN_PREPARATION) via sync
    await fetch(`${baseUrl}/api/v1/commerce/orders/${targetOrdId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrA1}` },
      body: JSON.stringify({ status: 'CONFIRMED' }),
    });
    const legitWaiterSyncRes = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokWaiterA1}` },
      body: JSON.stringify({
        nodeId: 'edg_alpha_s1',
        storeId: 's-a1',
        mutations: [
          {
            idempotencyKey: 'idm-waiter-legit-prep',
            entity: 'orders',
            entityId: targetOrdId,
            operation: 'UPSERT',
            hlc: `${Date.now() + 1000}:0006:edg_alpha_s1`,
            payload: { status: 'IN_PREPARATION' },
          },
        ],
      }),
    });
    const legitWaiterSyncJson: any = await legitWaiterSyncRes.json();

    const edgePositiveDeltaRes = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${edgeAToken}` },
      body: JSON.stringify({
        nodeId: 'edg_alpha_s1',
        storeId: 's-a1',
        mutations: [
          {
            idempotencyKey: 'idm-edge-positive-menu-delta',
            entity: 'menu_items',
            entityId: 'prd-a1',
            operation: 'UPSERT',
            hlc: `${Date.now() + 4}-0007-edg_alpha_s1`,
            deltaQty: 25,
            payload: { id: 'prd-a1' },
          },
        ],
      }),
    });
    const edgePositiveDeltaJson: any = await edgePositiveDeltaRes.json();

    const postOrdTamper = (await db.collection('orders').doc(targetOrdId).get()).data();
    const postBatA1 = (await db.collection('inventory_batches').doc('bat-a1').get()).data();
    const forgedFin = await db.collection('financial_records').doc('fin-forged-1').get();
    const postLedgersCount = (await db.collection('stock_ledger').get()).docs.length;

    check(
      maliciousPushJson?.rejected?.some((r: any) => r.reason === 'PROTECTED_ORDER_FIELDS') &&
        maliciousPushJson?.rejected?.some((r: any) => r.entity === 'inventory_batches' && (r.reason === 'RBAC_DENIED' || r.reason === 'UNVERIFIED_STOCK_DELTA')) &&
        cashierFinAndFsmJson?.rejected?.some((r: any) => r.entity === 'financial_records' && r.reason === 'RBAC_DENIED') &&
        cashierFinAndFsmJson?.rejected?.some((r: any) => r.entity === 'menu_items' && (r.reason === 'RBAC_DENIED' || r.reason === 'UNVERIFIED_STOCK_DELTA')) &&
        edgePositiveDeltaJson?.rejected?.some((r: any) => r.entity === 'menu_items' && r.reason === 'UNVERIFIED_STOCK_DELTA') &&
        cashierFinAndFsmJson?.conflicts?.some((c: any) => c.reason === 'INVALID_ORDER_TRANSITION') &&
        postOrdTamper?.total === preSyncPushOrd?.total &&
        postOrdTamper?.status === 'IN_PREPARATION' &&
        legitWaiterSyncJson?.accepted?.length === 1 &&
        postBatA1?.quantity === preSyncBatA1?.quantity &&
        !forgedFin.exists &&
        postLedgersCount === preSyncLedgersCount,
      'P1-4. Sync Push bloqueia alteração de campos protegidos (WAITER), salto FSM (INVALID_ORDER_TRANSITION), delta operacional de estoque e escrita direta em financial_records por CASHIER',
      `malRej=${JSON.stringify(maliciousPushJson?.rejected)}, cashRej=${JSON.stringify(cashierFinAndFsmJson?.rejected)}, edgePosRej=${JSON.stringify(edgePositiveDeltaJson?.rejected)}, fsmConf=${JSON.stringify(cashierFinAndFsmJson?.conflicts)}`
    );

    // 5. P1 Counter settlement separation: unconfirmed PIX stays PENDING & does not inflate cash drawer
    const cashBefore = (await db.collection('cash_sessions').doc('cash-a1').get()).data();
    const unconfirmedPixRes = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashA1}` },
      body: JSON.stringify({ storeId: 's-a1', channel: 'POS', deliveryModality: 'PICKUP', paymentMethod: 'PIX', items: [{ menuItemId: 'prd-a1', quantity: 1 }] }),
    });
    const unconfirmedPixJson: any = await unconfirmedPixRes.json();
    const unconfirmedOrdId = unconfirmedPixJson?.transaction?.orderId;
    const cashDuringPending = (await db.collection('cash_sessions').doc('cash-a1').get()).data();
    const finDuringPending = (await db.collection('financial_records').doc(`fin-ord-${unconfirmedOrdId}`).get()).data();

    const confirmPayRes = await fetch(`${baseUrl}/api/v1/commerce/orders/${unconfirmedOrdId}/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashA1}` },
      body: JSON.stringify({ paymentMethod: 'PIX', providerTransactionId: 'e2e-pix-tx-9988' }),
    });
    const cashAfterConfirm = (await db.collection('cash_sessions').doc('cash-a1').get()).data();
    const ordAfterConfirm = (await db.collection('orders').doc(unconfirmedOrdId).get()).data();
    const finAfterConfirm = (await db.collection('financial_records').doc(`fin-ord-${unconfirmedOrdId}`).get()).data();

    check(
      unconfirmedPixRes.status === 201 &&
        unconfirmedPixJson?.transaction?.paymentStatus === 'PENDING' &&
        finDuringPending?.status === 'PENDING' &&
        cashDuringPending?.totalSales === cashBefore?.totalSales &&
        confirmPayRes.status === 200 &&
        ordAfterConfirm?.paymentStatus === 'PAID' &&
        ordAfterConfirm?.paymentConfirmationType === 'MANUAL_OPERATOR' &&
        finAfterConfirm?.status === 'PAID' &&
        finAfterConfirm?.paymentConfirmationType === 'MANUAL_OPERATOR' &&
        finAfterConfirm?.confirmedByUid === 'u-cash-a1' &&
        cashAfterConfirm?.totalSales === (cashBefore?.totalSales || 0) + 30,
      'P1-5. Pedido PIX sem confirmação nasce PENDING sem inflar caixa e liquida como MANUAL_OPERATOR via /confirm-payment',
      `pendingStatus=${unconfirmedPixJson?.transaction?.paymentStatus}, ordType=${ordAfterConfirm?.paymentConfirmationType}, finType=${finAfterConfirm?.paymentConfirmationType}, cashBefore=${cashBefore?.totalSales}, cashPaid=${cashAfterConfirm?.totalSales}`
    );

    // 6. P1 Technical Edge identity (edg-tok:), refresh, revocation, HLC validation & nodeId registration guard
    const edgeOnHumanRoute = await fetch(`${baseUrl}/api/v1/store/staff?storeId=s-a1`, {
      headers: { Authorization: `Bearer ${edgeAToken}` },
    });
    const refreshEdgeRes = await fetch(`${baseUrl}/api/v1/sync/edge/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${edgeAToken}` },
      body: JSON.stringify({ nodeId: 'edg_alpha_s1' }),
    });
    const refreshEdgeJson: any = await refreshEdgeRes.json();
    const refreshedEdgeToken = refreshEdgeJson?.edgeToken;

    const badHlcAndNodeRes = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashA1}` },
      body: JSON.stringify({
        nodeId: 'edg_unregistered_rogue',
        storeId: 's-a1',
        mutations: [
          {
            idempotencyKey: 'idm-rogue-1',
            entity: 'tables',
            entityId: 'tbl-rogue',
            operation: 'UPSERT',
            hlc: `${Date.now()}-0001-edg_rogue`,
            payload: { tableNumber: 1, status: 'FREE' },
          },
        ],
      }),
    });
    const futureHlcRes = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${refreshedEdgeToken}` },
      body: JSON.stringify({
        nodeId: 'edg_alpha_s1',
        storeId: 's-a1',
        mutations: [
          {
            idempotencyKey: 'idm-future-hlc',
            entity: 'tables',
            entityId: 'tbl-future',
            operation: 'UPSERT',
            hlc: `${Date.now() + 600_000}-0001-edg_alpha_s1`,
            payload: { tableNumber: 2, status: 'FREE' },
          },
          {
            idempotencyKey: 'idm-malformed-hlc',
            entity: 'tables',
            entityId: 'tbl-badfmt',
            operation: 'UPSERT',
            hlc: 'invalid-hlc-string',
            payload: { tableNumber: 3, status: 'FREE' },
          },
        ],
      }),
    });
    const futureHlcJson: any = await futureHlcRes.json();

    await fetch(`${baseUrl}/api/v1/sync/edge/edg_alpha_s1/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrA1}` },
      body: JSON.stringify({}),
    });
    const postRevokeRefreshRes = await fetch(`${baseUrl}/api/v1/sync/edge/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${refreshedEdgeToken}` },
      body: JSON.stringify({ nodeId: 'edg_alpha_s1' }),
    });

    check(
      edgeOnHumanRoute.status === 401 &&
        refreshEdgeRes.status === 200 &&
        typeof refreshedEdgeToken === 'string' &&
        refreshedEdgeToken.startsWith('edg-tok:') &&
        badHlcAndNodeRes.status === 403 &&
        futureHlcJson?.rejected?.some((r: any) => r.reason === 'HLC_FUTURE_SKEW') &&
        futureHlcJson?.rejected?.some((r: any) => r.reason === 'INVALID_HLC') &&
        (postRevokeRefreshRes.status === 401 || postRevokeRefreshRes.status === 403),
      'P1-6. Identidade técnica Edge (edg-tok:) isolada de sessões humanas, renovável/revogável e com bloqueio de nodeId não pareado e HLC futuro/malformado',
      `humanRoute=${edgeOnHumanRoute.status}, refresh=${refreshEdgeRes.status}, rogueNode=${badHlcAndNodeRes.status}, postRevoke=${postRevokeRefreshRes.status}`
    );

    // 7. P1/P2 Edge persistent SQLite cursor across restart, minimal public /health, strict CORS, HTTPS check
    const edgeSqlite = path.join(tmpDir, 'edge-cursor.sqlite');
    edgeA = new EdgeNodeRuntime({
      nodeId: 'edg_persist_cursor',
      storeId: 's-a1',
      tenantId: 't-alpha',
      dbPath: edgeSqlite,
      port: 0,
    });
    const { edgeToken: tokPersistEdge } = await edgeA.registerWithCloud(baseUrl, tokMgrA1, 'edge-persist');
    await edgeA.bootstrapFromCloud(baseUrl, tokPersistEdge);
    edgePort = await edgeA.listen(0);
    const edgeUrl = `http://127.0.0.1:${edgePort}`;

    const [edgeCorsDeniedRes, edgeHealthMinRes, edgeSync1Res] = await Promise.all([
      fetch(`${edgeUrl}/api/v1/commerce/orders`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil-lan-sniffer.example', 'Access-Control-Request-Method': 'POST' },
      }),
      fetch(`${edgeUrl}/api/v1/health`),
      edgeA.syncWithCloud(baseUrl, tokPersistEdge),
    ]);
    const edgeHealthMin: any = await edgeHealthMinRes.json();
    const statusBeforeRestartRes = await fetch(`${edgeUrl}/api/v1/sync/status`, {
      headers: { Authorization: `Bearer ${tokMgrA1}` },
    });
    const statusBeforeRestart: any = await statusBeforeRestartRes.json();
    await edgeA.close();
    edgeA = null;

    // Restart Edge against same SQLite file
    edgeA = new EdgeNodeRuntime({
      nodeId: 'edg_persist_cursor',
      storeId: 's-a1',
      tenantId: 't-alpha',
      dbPath: edgeSqlite,
      port: 0,
    });
    const restartedPort = await edgeA.listen(0);
    const statusAfterRestartRes = await fetch(`http://127.0.0.1:${restartedPort}/api/v1/sync/status`, {
      headers: { Authorization: `Bearer ${tokMgrA1}` },
    });
    const statusAfterRestart: any = await statusAfterRestartRes.json();

    let remoteHttpBlocked = false;
    try {
      assertSecureCloudUrl('http://api.external-cloud.example.com:3000');
    } catch {
      remoteHttpBlocked = true;
    }

    check(
      edgeCorsDeniedRes.status === 403 &&
        edgeCorsDeniedRes.headers.get('access-control-allow-origin') === null &&
        !('nodeId' in edgeHealthMin) &&
        !('tenantId' in edgeHealthMin) &&
        typeof statusBeforeRestart.lastPullHlc === 'string' &&
        statusAfterRestart.lastPullHlc === statusBeforeRestart.lastPullHlc &&
        Boolean(statusAfterRestart.lastFullSyncAt) &&
        remoteHttpBlocked &&
        edgeSync1Res.syncState === 'OK',
      'P1/P2-7. Edge persiste lastPullHlc/lastFullSyncAt entre reinícios no SQLite WAL, minimiza /health, bloqueia CORS não-allowlisted e exige HTTPS remoto',
      `cors403=${edgeCorsDeniedRes.status}, beforeHlc=${statusBeforeRestart.lastPullHlc}, afterHlc=${statusAfterRestart.lastPullHlc}, remoteHttpBlk=${remoteHttpBlocked}`
    );

    // 8. P1/P2 Production secret check, PBKDF2 iteration upper-bound, token claims, durable backup, schema/table validation, AES integration vault
    const pbkdfDosStart = Date.now();
    const pbkdfHighIterRejected = verifyPassword('secret', 'pbkdf2$99999999$00112233$44556677');
    const pbkdfDosMs = Date.now() - pbkdfDosStart;

    let prodSecretThrew = false;
    const prevNodeEnv = process.env.NODE_ENV;
    const prevSec = process.env.SERVER_SECRET;
    const prevSecPath = process.env.SERVER_SECRET_PATH;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.SERVER_SECRET;
      delete process.env.SERVER_SECRET_PATH;
      delete process.env.ALLOW_SANDBOX_IN_PRODUCTION;
      assertProductionSecretConfigured('');
    } catch {
      prodSecretThrew = true;
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevSec !== undefined) process.env.SERVER_SECRET = prevSec;
      if (prevSecPath !== undefined) process.env.SERVER_SECRET_PATH = prevSecPath;
    }

    const decodedHuman = await auth.verifyIdToken(tokDev);

    // Save integration with secret & test WhatsApp honest diagnostics
    const saveWaRes = await fetch(`${baseUrl}/api/v1/admin/integrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        id: 'int-wa-audit',
        name: 'WhatsApp API',
        category: 'WHATSAPP',
        apiKey: 'wa_live_secret_token_xyz999',
        webhookUrl: 'https://hooks.3c.local/wa',
      }),
    });
    const saveWaJson: any = await saveWaRes.json();
    const testWaRes = await fetch(`${baseUrl}/api/v1/admin/integrations/int-wa-audit/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
    });
    const testWaJson: any = await testWaRes.json();
    const storedWaDoc = (await db.collection('integrations').doc('int-wa-audit').get()).data();

    // Backup redaction + Restore negative guards + durable on-disk pre-restore backup
    await db.collection('users').doc('u-reset-test').set({
      uid: 'u-reset-test',
      id: 'u-reset-test',
      email: 'reset@3c.local',
      role: 'CONSUMER',
      passwordHash: 'pbkdf2$100000$abcd$ef01',
      resetCodeHash: 'sha256:sensitive_reset_code_hash',
      resetCodeExpiresAt: Date.now() + 60000,
    });
    const backupRes = await fetch(`${baseUrl}/api/v1/admin/backup`, {
      headers: { Authorization: `Bearer ${tokDev}` },
    });
    const backupJson: any = await backupRes.json();
    const backedResetUser = (backupJson?.tables?.users || []).find((u: any) => u.id === 'u-reset-test');

    const badVerRestore = await fetch(`${baseUrl}/api/v1/admin/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ tables: backupJson.tables, schemaVersion: '9.9.9', checksum: backupJson.checksum }),
    });
    const missingTblTables = { ...backupJson.tables };
    delete missingTblTables.users;
    const missingTblChecksum = computeSnapshotChecksum(missingTblTables);
    const missingTblRestore = await fetch(`${baseUrl}/api/v1/admin/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ tables: missingTblTables, schemaVersion: backupJson.schemaVersion, checksum: missingTblChecksum }),
    });
    const missingTblJson: any = await missingTblRestore.json();
    const validRestore = await fetch(`${baseUrl}/api/v1/admin/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ tables: backupJson.tables, schemaVersion: backupJson.schemaVersion, version: backupJson.version, checksum: backupJson.checksum }),
    });
    const validRestoreJson: any = await validRestore.json();
    const durableFiles = fs.existsSync(backupDir) ? fs.readdirSync(backupDir) : [];

    // Cloud strict CORS rejects arbitrary .run.app origin
    const cloudWildcardOriginRes = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { Origin: 'https://evil-spoofed-service.run.app' },
    });

    check(
      pbkdfHighIterRejected === false &&
        pbkdfDosMs < 100 &&
        prodSecretThrew &&
        decodedHuman.iss === '3c-server-core' &&
        decodedHuman.aud === '3c-ecosystem' &&
        decodedHuman.typ === 'session' &&
        typeof decodedHuman.jti === 'string' &&
        storedWaDoc?.apiKey === undefined &&
        typeof storedWaDoc?.encryptedSecret === 'object' &&
        storedWaDoc?.encryptedSecret?.alg === 'aes-256-gcm' &&
        typeof storedWaDoc?.encryptedSecret?.data === 'string' &&
        saveWaJson?.integration?.encryptedSecret === undefined &&
        testWaJson?.status === 'CONFIGURED' &&
        !String(testWaJson?.message || '').includes('Webhook verificado') &&
        backedResetUser?.passwordHash === undefined &&
        backedResetUser?.resetCodeHash === undefined &&
        !(backupJson?.tables?.integrations || []).some((i: any) => i?.encryptedSecret !== undefined) &&
        badVerRestore.status === 400 &&
        missingTblRestore.status === 400 &&
        String(missingTblJson?.error || '').includes('users') &&
        validRestore.status === 200 &&
        durableFiles.length >= 1 &&
        Boolean(validRestoreJson?.safetyBackupId) &&
        validRestoreJson?.safetyBackupPersisted === true &&
        cloudWildcardOriginRes.headers.get('access-control-allow-origin') === null,
      'P1/P2-8. Segredo produção obrigatório, PBKDF2 protegido contra DoS, claims iss/aud/typ/jti, cofre AES integrações, WhatsApp honesto, backup durável/redigido e CORS estrito',
      `pbkdfMs=${pbkdfDosMs}, prodThrew=${prodSecretThrew}, waStatus=${testWaJson?.status}, badVer=${badVerRestore.status}, missTbl=${missingTblRestore.status}, validRestore=${validRestore.status} (${validRestoreJson?.error || ''}), durableFiles=${durableFiles.length}`
    );
    // 9. P1 Signed PSP Webhook (HMAC-SHA256 + idempotency), legacy /api/admin prod guard, HttpOnly cookie auth, and honest simulated cluster commands
    const pspOrdRes = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashA1}` },
      body: JSON.stringify({ storeId: 's-a1', channel: 'POS', deliveryModality: 'PICKUP', paymentMethod: 'PIX', items: [{ menuItemId: 'prd-a1', quantity: 2 }] }),
    });
    const pspOrdJson: any = await pspOrdRes.json();
    const pspOrdId = pspOrdJson?.transaction?.orderId;
    const cashBeforePsp = (await db.collection('cash_sessions').doc('cash-a1').get()).data();

    const prevPspSecret = process.env.PSP_WEBHOOK_SECRET;
    process.env.PSP_WEBHOOK_SECRET = 'psp_hmac_secret_audit_2026';
    let badSigResStatus = 0;
    let mismatchAmtResStatus = 0;
    let validPspResJson: any = null;
    let replayPspResJson: any = null;
    try {
      const pspPayload = {
        orderId: pspOrdId,
        providerTransactionId: 'psp-tx-hmac-001',
        provider: 'ASAAS_PIX',
        status: 'PAID',
        paymentMethod: 'PIX',
        paidAmount: 60,
      };
      const badSigRes = await fetch(`${baseUrl}/api/v1/commerce/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PSP-Signature': 'sha256=deadbeef' },
        body: JSON.stringify(pspPayload),
      });
      badSigResStatus = badSigRes.status;

      const mismatchPayload = { ...pspPayload, paidAmount: 10 };
      const mismatchSig = crypto
        .createHmac('sha256', process.env.PSP_WEBHOOK_SECRET)
        .update(JSON.stringify(mismatchPayload))
        .digest('hex');
      const mismatchRes = await fetch(`${baseUrl}/api/v1/commerce/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PSP-Signature': `sha256=${mismatchSig}` },
        body: JSON.stringify(mismatchPayload),
      });
      mismatchAmtResStatus = mismatchRes.status;

      const validSig = crypto
        .createHmac('sha256', process.env.PSP_WEBHOOK_SECRET)
        .update(JSON.stringify(pspPayload))
        .digest('hex');
      const validPspRes = await fetch(`${baseUrl}/api/v1/commerce/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PSP-Signature': `sha256=${validSig}` },
        body: JSON.stringify(pspPayload),
      });
      validPspResJson = await validPspRes.json();

      const replayPspRes = await fetch(`${baseUrl}/api/v1/commerce/payments/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PSP-Signature': `sha256=${validSig}` },
        body: JSON.stringify(pspPayload),
      });
      replayPspResJson = await replayPspRes.json();
    } finally {
      if (prevPspSecret === undefined) delete process.env.PSP_WEBHOOK_SECRET;
      else process.env.PSP_WEBHOOK_SECRET = prevPspSecret;
    }

    const pspOrderAfter = (await db.collection('orders').doc(pspOrdId).get()).data();
    const pspFinAfter = (await db.collection('financial_records').doc(`fin-ord-${pspOrdId}`).get()).data();
    const cashAfterPsp = (await db.collection('cash_sessions').doc('cash-a1').get()).data();

    // Legacy /api/admin route guard in NODE_ENV=production without Cloud DB
    let legacyAdminProdStatus = 0;
    const prevEnvForLegacy = process.env.NODE_ENV;
    const prevAllowSandboxLegacy = process.env.ALLOW_SANDBOX_IN_PRODUCTION;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_SANDBOX_IN_PRODUCTION;
      const legacyAdminRes = await fetch(`${baseUrl}/api/admin/governance`, {
        headers: { Authorization: `Bearer ${tokDev}` },
      });
      legacyAdminProdStatus = legacyAdminRes.status;
    } finally {
      if (prevEnvForLegacy === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevEnvForLegacy;
      if (prevAllowSandboxLegacy === undefined) delete process.env.ALLOW_SANDBOX_IN_PRODUCTION;
      else process.env.ALLOW_SANDBOX_IN_PRODUCTION = prevAllowSandboxLegacy;
    }

    // HttpOnly Cookie Session + Logout + Honest Simulated Cluster Command
    const { hashPassword } = await import('../../src/server/config.ts');
    await db.collection('users').doc('u-cookie-test').set({
      uid: 'u-cookie-test',
      id: 'u-cookie-test',
      email: 'cookie@3c.local',
      name: 'Cookie Tester',
      role: 'CONSUMER',
      tenantId: 't-alpha',
      status: 'ACTIVE',
      tokenVersion: 1,
      passwordHash: hashPassword('CookiePass!2026'),
    });
    const cookieLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'cookie@3c.local', password: 'CookiePass!2026' }),
    });
    const setCookieHeader = cookieLoginRes.headers.get('set-cookie') || '';
    const cookiePair = setCookieHeader.split(';')[0] || '';
    const cookieMeRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: cookiePair },
    });
    const cookieMeJson: any = await cookieMeRes.json();
    const clusterSimRes = await fetch(`${baseUrl}/api/v1/sse/cluster/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ command: 'FLUSH_REDIS' }),
    });
    const clusterSimJson: any = await clusterSimRes.json();

    check(
      badSigResStatus === 401 &&
        mismatchAmtResStatus === 400 &&
        validPspResJson?.paymentConfirmationType === 'AUTOMATED_PSP' &&
        validPspResJson?.deduplicated === false &&
        replayPspResJson?.deduplicated === true &&
        pspOrderAfter?.paymentStatus === 'PAID' &&
        pspOrderAfter?.paymentConfirmationType === 'AUTOMATED_PSP' &&
        pspFinAfter?.paymentConfirmationType === 'AUTOMATED_PSP' &&
        cashAfterPsp?.totalSales === (cashBeforePsp?.totalSales || 0) + 60 &&
        legacyAdminProdStatus === 503 &&
        setCookieHeader.includes('HttpOnly') &&
        cookieMeRes.status === 200 &&
        cookieMeJson?.uid === 'u-cookie-test' &&
        clusterSimJson?.simulated === true,
      'P1-9. Webhook PSP HMAC-SHA256 com idempotência/conciliação, bloqueio /api/admin em produção, sessão cookie HttpOnly e comando cluster marcado como simulado',
      `badSig=${badSigResStatus}, mismatch=${mismatchAmtResStatus}, replay=${replayPspResJson?.deduplicated}, legacyProd=${legacyAdminProdStatus}, cookieMe=${cookieMeRes.status}, sim=${clusterSimJson?.simulated}`
    );

    // 10. P2 Peripheral / Printer registry + Station Routing + Print Spooler ACK + Cross-Tenant Isolation
    const savePrinterRes = await fetch(`${baseUrl}/api/v1/store/peripherals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrA1}` },
      body: JSON.stringify({
        id: 'periph-kitchen-a1',
        storeId: 's-a1',
        name: 'Impressora Cozinha Térmica 80mm',
        kind: 'PRINTER',
        connectionType: 'LAN_RAW_9100',
        station: 'KITCHEN',
        host: '192.168.10.55',
        port: 9100,
        paperWidthMm: 80,
        isDefault: true,
      }),
    });
    const savePrinterJson: any = await savePrinterRes.json();

    const enqueueJobRes = await fetch(`${baseUrl}/api/v1/store/print-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashA1}` },
      body: JSON.stringify({
        storeId: 's-a1',
        station: 'KITCHEN',
        orderId: targetOrdId,
        content: 'COMANDA COZINHA #001\n1x Prato A1\n',
        requireRegisteredPrinter: true,
      }),
    });
    const enqueueJobJson: any = await enqueueJobRes.json();
    const jobId = enqueueJobJson?.job?.id;

    const crossAckRes = await fetch(`${baseUrl}/api/v1/store/print-jobs/${jobId}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrB1}` },
      body: JSON.stringify({ status: 'PRINTED' }),
    });
    const validAckRes = await fetch(`${baseUrl}/api/v1/store/print-jobs/${jobId}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashA1}` },
      body: JSON.stringify({ status: 'PRINTED' }),
    });
    const validAckJson: any = await validAckRes.json();
    const genericPeripheralsDenied = await fetch(`${baseUrl}/api/v1/generic/peripherals`, {
      headers: { Authorization: `Bearer ${tokDev}` },
    });

    check(
      savePrinterRes.status === 200 &&
        savePrinterJson?.peripheral?.status === 'CONFIGURED_OFFLINE' &&
        enqueueJobRes.status === 201 &&
        enqueueJobJson?.job?.peripheralId === 'periph-kitchen-a1' &&
        enqueueJobJson?.job?.routingMode === 'STATION_DEFAULT' &&
        crossAckRes.status === 403 &&
        validAckRes.status === 200 &&
        validAckJson?.job?.status === 'PRINTED' &&
        validAckJson?.job?.attempts === 1 &&
        genericPeripheralsDenied.status === 403,
      'P2-10. Gerenciamento de impressoras/periféricos, roteamento por estação, fila de impressão com ACK, isolamento multi-tenant e bloqueio na API genérica',
      `save=${savePrinterRes.status}, job=${enqueueJobRes.status}, crossAck=${crossAckRes.status}, validAck=${validAckRes.status}, generic=${genericPeripheralsDenied.status}`
    );

    // 11. P2 Object/File Storage per Application (MIME allowlist, path containment, tenant privacy, deletion)
    const prevStorageDir = process.env.SERVER_STORAGE_DIR;
    process.env.SERVER_STORAGE_DIR = path.join(tmpDir, 'storage-vault');
    let htmlBlockedStatus = 0;
    let uploadOkStatus = 0;
    let uploadedObjId = '';
    let crossTenantReadStatus = 0;
    let ownerReadStatus = 0;
    let ownerReadHeadersNosniff = false;
    let deleteStatus = 0;
    let postDeleteReadStatus = 0;
    try {
      const htmlUploadRes = await fetch(`${baseUrl}/api/v1/storage/objects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrA1}` },
        body: JSON.stringify({
          appId: 'store-os',
          storeId: 's-a1',
          filename: '../../../evil.html',
          mimeType: 'text/html',
          contentUtf8: '<script>alert(1)</script>',
        }),
      });
      htmlBlockedStatus = htmlUploadRes.status;

      const validUploadRes = await fetch(`${baseUrl}/api/v1/storage/objects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrA1}` },
        body: JSON.stringify({
          appId: 'store-os',
          storeId: 's-a1',
          folder: 'fiscal-exports',
          filename: '../../relatorio_caixa.csv',
          mimeType: 'text/csv',
          visibility: 'PRIVATE',
          contentUtf8: 'id,valor\n1,60.00\n',
        }),
      });
      uploadOkStatus = validUploadRes.status;
      const validUploadJson: any = await validUploadRes.json();
      uploadedObjId = validUploadJson?.object?.id || '';

      const crossReadRes = await fetch(`${baseUrl}/api/v1/storage/objects/${uploadedObjId}/content`, {
        headers: { Authorization: `Bearer ${tokMgrB1}` },
      });
      crossTenantReadStatus = crossReadRes.status;

      const ownerReadRes = await fetch(`${baseUrl}/api/v1/storage/objects/${uploadedObjId}/content`, {
        headers: { Authorization: `Bearer ${tokMgrA1}` },
      });
      ownerReadStatus = ownerReadRes.status;
      ownerReadHeadersNosniff = ownerReadRes.headers.get('x-content-type-options') === 'nosniff';

      const delRes = await fetch(`${baseUrl}/api/v1/storage/objects/${uploadedObjId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokMgrA1}` },
      });
      deleteStatus = delRes.status;

      const postDelRes = await fetch(`${baseUrl}/api/v1/storage/objects/${uploadedObjId}/content`, {
        headers: { Authorization: `Bearer ${tokMgrA1}` },
      });
      postDeleteReadStatus = postDelRes.status;
    } finally {
      if (prevStorageDir === undefined) delete process.env.SERVER_STORAGE_DIR;
      else process.env.SERVER_STORAGE_DIR = prevStorageDir;
    }

    check(
      htmlBlockedStatus === 415 &&
        uploadOkStatus === 201 &&
        Boolean(uploadedObjId) &&
        crossTenantReadStatus === 403 &&
        ownerReadStatus === 200 &&
        ownerReadHeadersNosniff &&
        deleteStatus === 200 &&
        postDeleteReadStatus === 404,
      'P2-11. Storage por aplicação bloqueia MIME HTML (415), neutraliza path traversal, isola leitura privada cross-tenant (403) e remove blob físico',
      `html=${htmlBlockedStatus}, up=${uploadOkStatus}, cross=${crossTenantReadStatus}, own=${ownerReadStatus}, del=${deleteStatus}, postDel=${postDeleteReadStatus}`
    );

    // 12. P2 Signed SaaS Billing PSP Webhook + Monorepo 5.2.1 Version Alignment & Sidecar Manifest
    await db.collection('stores').doc('s-a1').update({ saasMonthlyFee: 299, saasPaymentStatus: 'PENDING' });
    const prevSaasSecret = process.env.SAAS_PSP_WEBHOOK_SECRET;
    process.env.SAAS_PSP_WEBHOOK_SECRET = 'saas_psp_hmac_secret_2026';
    let saasBadSig = 0;
    let saasUnderpay = 0;
    let saasOkJson: any = null;
    let saasReplayJson: any = null;
    try {
      const saasPayload = {
        storeId: 's-a1',
        providerTransactionId: 'saas-pix-tx-521',
        provider: 'EFI_PIX_SAAS',
        status: 'PAID',
        paidAmount: 299,
      };
      const badSaasRes = await fetch(`${baseUrl}/api/v1/admin/billing/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PSP-Signature': 'sha256=0000' },
        body: JSON.stringify(saasPayload),
      });
      saasBadSig = badSaasRes.status;

      const underPayload = { ...saasPayload, paidAmount: 50 };
      const underSig = crypto
        .createHmac('sha256', process.env.SAAS_PSP_WEBHOOK_SECRET)
        .update(JSON.stringify(underPayload))
        .digest('hex');
      const underRes = await fetch(`${baseUrl}/api/v1/admin/billing/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PSP-Signature': `sha256=${underSig}` },
        body: JSON.stringify(underPayload),
      });
      saasUnderpay = underRes.status;

      const okSaasSig = crypto
        .createHmac('sha256', process.env.SAAS_PSP_WEBHOOK_SECRET)
        .update(JSON.stringify(saasPayload))
        .digest('hex');
      const okSaasRes = await fetch(`${baseUrl}/api/v1/admin/billing/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PSP-Signature': `sha256=${okSaasSig}` },
        body: JSON.stringify(saasPayload),
      });
      saasOkJson = await okSaasRes.json();

      const replaySaasRes = await fetch(`${baseUrl}/api/v1/admin/billing/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PSP-Signature': `sha256=${okSaasSig}` },
        body: JSON.stringify(saasPayload),
      });
      saasReplayJson = await replaySaasRes.json();
    } finally {
      if (prevSaasSecret === undefined) delete process.env.SAAS_PSP_WEBHOOK_SECRET;
      else process.env.SAAS_PSP_WEBHOOK_SECRET = prevSaasSecret;
    }

    const saasStoreAfter = (await db.collection('stores').doc('s-a1').get()).data();
    const rootPkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
    const edgePkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'servers/edge-node/package.json'), 'utf-8'));
    const contractsPkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'packages/contracts/package.json'), 'utf-8'));
    const storeAndroidPkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'apps/store-android/package.json'), 'utf-8'));
    const sidecarManifestPath = path.join(process.cwd(), 'apps/store-desktop/src-tauri/binaries/sidecar-manifest.json');
    const sidecarManifestExists = fs.existsSync(sidecarManifestPath);
    const sidecarManifest = sidecarManifestExists ? JSON.parse(fs.readFileSync(sidecarManifestPath, 'utf-8')) : null;
    const expectedSidecarBinPath = sidecarManifest?.expectedNativeBinary
      ? path.resolve(process.cwd(), 'apps/store-desktop', sidecarManifest.expectedNativeBinary)
      : '';
    const sidecarManifestHonest =
      Boolean(sidecarManifest) &&
      sidecarManifest.nativeBinaryPresent === (expectedSidecarBinPath ? fs.existsSync(expectedSidecarBinPath) : false);

    check(
      saasBadSig === 401 &&
        saasUnderpay === 400 &&
        saasOkJson?.paymentConfirmationType === 'AUTOMATED_PSP' &&
        saasReplayJson?.deduplicated === true &&
        saasStoreAfter?.saasPaymentStatus === 'PAID' &&
        saasStoreAfter?.saasSettlementType === 'AUTOMATED_PSP' &&
        rootPkg.version === '5.2.1' &&
        edgePkg.version === '5.2.1' &&
        contractsPkg.version === '5.2.1' &&
        Boolean(storeAndroidPkg.dependencies?.['@capacitor/core']) &&
        sidecarManifestExists &&
        sidecarManifestHonest,
      'P2-12. Webhook PSP de cobrança SaaS (HMAC + idempotência), alinhamento de versões 5.2.1 (packages + edge-node), manifesto Capacitor e sidecar-manifest honesto',
      `badSig=${saasBadSig}, under=${saasUnderpay}, saasPaid=${saasStoreAfter?.saasPaymentStatus}, sidecarManifest=${sidecarManifestExists}, honest=${sidecarManifestHonest}`
    );

    // 13. P2 Global Coupon RBAC (generic & commerce) + Edge Node MERCHANT isolation & maxDiscount parity
    await db.collection('users').doc('u-own-a1').set({
      uid: 'u-own-a1',
      id: 'u-own-a1',
      email: 'owner@a1.local',
      role: 'STORE_OWNER',
      tenantId: 't-alpha',
      storeId: 's-a1',
      status: 'ACTIVE',
      tokenVersion: 1,
    });
    const tokOwnA1 = auth.generateDevToken({
      uid: 'u-own-a1',
      role: 'STORE_OWNER',
      tenantId: 't-alpha',
      storeId: 's-a1',
      tokenVersion: 1,
    });

    await Promise.all([
      db.collection('coupons').doc('cpn-hq-cons').set({
        id: 'cpn-hq-cons',
        code: 'GLOBAL50CAP',
        audience: 'CONSUMER',
        discountType: 'PERCENT',
        discountValue: 50,
        maxDiscount: 10,
        isActive: true,
        tenantId: 't-alpha',
      }),
      db.collection('coupons').doc('cpn-saas-b2b').set({
        id: 'cpn-saas-b2b',
        code: 'SAAS20PRO',
        audience: 'MERCHANT',
        applicablePlans: ['PRO'],
        discountType: 'PERCENT',
        discountValue: 20,
        maxDiscount: 50,
        usageCount: 0,
        usageLimit: 5,
        isActive: true,
        tenantId: 'PLATFORM_HQ',
      }),
    ]);

    const tokRegA = auth.generateDevToken({
      uid: 'u-reg-a',
      role: 'REGIONAL_MANAGER',
      tenantId: 't-alpha',
      allowedStoreIds: ['s-a1', 's-a2'],
      tokenVersion: 1,
    });
    await db.collection('users').doc('u-reg-a').set({
      uid: 'u-reg-a',
      id: 'u-reg-a',
      email: 'reg@a.local',
      role: 'REGIONAL_MANAGER',
      tenantId: 't-alpha',
      allowedStoreIds: ['s-a1', 's-a2'],
      status: 'ACTIVE',
      tokenVersion: 1,
    });

    const [
      ownGenOverwriteGlobal,
      ownGenDelGlobal,
      ownComOverwriteGlobal,
      ownComDelGlobal,
      ownComDelMerchant,
      ownComCreateAutoScoped,
      regComCreateNoStore,
    ] = await Promise.all([
      fetch(`${baseUrl}/api/v1/generic/coupons/cpn-hq-cons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnA1}` },
        body: JSON.stringify({ data: { discountValue: 99 } }),
      }),
      fetch(`${baseUrl}/api/v1/generic/coupons/cpn-hq-cons`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokOwnA1}` },
      }),
      fetch(`${baseUrl}/api/v1/commerce/coupons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnA1}` },
        body: JSON.stringify({ id: 'cpn-hq-cons', code: 'GLOBAL50CAP', discountType: 'PERCENT', discountValue: 99 }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/coupons/cpn-hq-cons`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokOwnA1}` },
      }),
      fetch(`${baseUrl}/api/v1/commerce/coupons/cpn-saas-b2b`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokOwnA1}` },
      }),
      fetch(`${baseUrl}/api/v1/commerce/coupons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnA1}` },
        body: JSON.stringify({ code: 'SELFAUTO5', discountType: 'FIXED', discountValue: 5 }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/coupons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokRegA}` },
        body: JSON.stringify({ code: 'REGGLOBAL5', discountType: 'FIXED', discountValue: 5 }),
      }),
    ]);
    const ownComCreateAutoJson: any = await ownComCreateAutoScoped.json();

    // Sync/seed coupons + menu item onto edgeA and verify Edge Node enforces MERCHANT exclusion and maxDiscount
    await edgeA.driver.setDoc('menu_items', 'prd-a1', {
      id: 'prd-a1',
      tenantId: 't-alpha',
      storeId: 's-a1',
      name: 'Prato A1',
      price: 30,
      stock: 50,
      isAvailable: true,
    });
    await edgeA.driver.setDoc('coupons', 'cpn-hq-cons', {
      id: 'cpn-hq-cons',
      code: 'GLOBAL50CAP',
      audience: 'CONSUMER',
      discountType: 'PERCENT',
      discountValue: 50,
      maxDiscount: 10,
      isActive: true,
      tenantId: 't-alpha',
    });
    await edgeA.driver.setDoc('coupons', 'cpn-saas-b2b', {
      id: 'cpn-saas-b2b',
      code: 'SAAS20PRO',
      audience: 'MERCHANT',
      discountType: 'PERCENT',
      discountValue: 20,
      isActive: true,
      tenantId: 'PLATFORM_HQ',
    });

    const edgeCouponsListRes = await fetch(`http://127.0.0.1:${restartedPort}/api/v1/commerce/coupons`);
    const edgeCouponsListJson: any = await edgeCouponsListRes.json();

    const edgeB2bCouponOrderRes = await fetch(`http://127.0.0.1:${restartedPort}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrA1}` },
      body: JSON.stringify({
        storeId: 's-a1',
        channel: 'POS',
        deliveryModality: 'PICKUP',
        paymentMethod: 'PIX',
        couponCode: 'SAAS20PRO',
        items: [{ menuItemId: 'prd-a1', quantity: 2 }],
      }),
    });
    const edgeB2bCouponOrderJson: any = await edgeB2bCouponOrderRes.json();

    const edgeCapCouponOrderRes = await fetch(`http://127.0.0.1:${restartedPort}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrA1}` },
      body: JSON.stringify({
        storeId: 's-a1',
        channel: 'POS',
        deliveryModality: 'PICKUP',
        paymentMethod: 'PIX',
        couponCode: 'GLOBAL50CAP',
        items: [{ menuItemId: 'prd-a1', quantity: 2 }],
      }),
    });
    const edgeCapCouponOrderJson: any = await edgeCapCouponOrderRes.json();

    check(
      ownGenOverwriteGlobal.status === 403 &&
        ownGenDelGlobal.status === 403 &&
        ownComOverwriteGlobal.status === 403 &&
        ownComDelGlobal.status === 403 &&
        ownComDelMerchant.status === 403 &&
        ownComCreateAutoScoped.status === 200 &&
        ownComCreateAutoJson?.coupon?.storeId === 's-a1' &&
        regComCreateNoStore.status === 403 &&
        Array.isArray(edgeCouponsListJson) &&
        !edgeCouponsListJson.some((c: any) => c.code === 'SAAS20PRO') &&
        edgeCouponsListJson.some((c: any) => c.code === 'GLOBAL50CAP') &&
        edgeB2bCouponOrderRes.status === 201 &&
        edgeB2bCouponOrderJson?.transaction?.discount === 0 &&
        edgeCapCouponOrderRes.status === 201 &&
        edgeCapCouponOrderJson?.transaction?.discount === 10 &&
        edgeCapCouponOrderJson?.transaction?.total === 50,
      'P2-13. RBAC de cupons globais/MERCHANT bloqueia lojista em /generic e /commerce (403) e Edge Node isola MERCHANT + aplica teto maxDiscount',
      `gen=${ownGenOverwriteGlobal.status}/${ownGenDelGlobal.status}, com=${ownComOverwriteGlobal.status}/${ownComDelGlobal.status}/${ownComDelMerchant.status}/${ownComCreateAutoScoped.status}/${regComCreateNoStore.status}, edgeB2bDisc=${edgeB2bCouponOrderJson?.transaction?.discount}, edgeCapDisc=${edgeCapCouponOrderJson?.transaction?.discount}`
    );

    // 14. P2 Billing Reconcile (_deleted skip + tenant OVERDUE sync), Atomic Upgrade Approval, Soft-delete Filtering & Proto Sanitization
    const expiredDateIso = new Date(Date.now() - 86400000).toISOString();
    await Promise.all([
      db.collection('tenants').doc('t-ovd-sync').set({ id: 't-ovd-sync', name: 'Tenant Overdue Sync', status: 'ACTIVE', saasPaymentStatus: 'TRIAL' }),
      db.collection('stores').doc('s-ovd-sync').set({
        id: 's-ovd-sync',
        tenantId: 't-ovd-sync',
        name: 'Loja Vencida Sync',
        subscriptionPlan: 'FREE',
        saasPaymentStatus: 'TRIAL',
        trialExpiresAt: expiredDateIso,
      }),
      db.collection('stores').doc('s-del-skip').set({
        id: 's-del-skip',
        tenantId: 't-alpha',
        name: 'Loja Deletada',
        subscriptionPlan: 'FREE',
        saasPaymentStatus: 'TRIAL',
        trialExpiresAt: expiredDateIso,
        _deleted: true,
      }),
    ]);

    const reconcileRes = await fetch(`${baseUrl}/api/v1/admin/billing/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({}),
    });
    const reconcileJson: any = await reconcileRes.json();
    const tenantOvdAfter = (await db.collection('tenants').doc('t-ovd-sync').get()).data();
    const storeDelAfter = (await db.collection('stores').doc('s-del-skip').get()).data();

    // Atomic upgrade request + HQ subscription approval clearing pendingUpgradeRequest
    const badPlanSubReq = await fetch(`${baseUrl}/api/v1/store/s-a1/subscription-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnA1}` },
      body: JSON.stringify({ requestedPlan: 'BASIC', billingCycle: 'MONTHLY', couponCode: 'SAAS20PRO' }),
    });
    const saasCouponAfterFail = (await db.collection('coupons').doc('cpn-saas-b2b').get()).data();

    const okPlanSubReq = await fetch(`${baseUrl}/api/v1/store/s-a1/subscription-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnA1}` },
      body: JSON.stringify({ requestedPlan: 'PRO', billingCycle: 'MONTHLY', couponCode: 'SAAS20PRO' }),
    });
    const saasCouponAfterOk = (await db.collection('coupons').doc('cpn-saas-b2b').get()).data();
    const storePendingAfterReq = (await db.collection('stores').doc('s-a1').get()).data();

    const hqApproveSubRes = await fetch(`${baseUrl}/api/v1/admin/stores/s-a1/subscription`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ subscriptionPlan: 'PRO', saasPaymentStatus: 'PAID' }),
    });
    const storeAfterHqApprove = (await db.collection('stores').doc('s-a1').get()).data();

    // Soft-deleted document exclusion across Cloud REST queries + prototype pollution sanitization
    await Promise.all([
      db.collection('orders').doc('ord-soft-del').set({ id: 'ord-soft-del', storeId: 's-a1', tenantId: 't-alpha', _deleted: true, createdAt: new Date().toISOString() }),
      db.collection('customers_crm').doc('cust-soft-del').set({ id: 'cust-soft-del', storeId: 's-a1', tenantId: 't-alpha', name: 'Ghost', _deleted: true }),
      db.collection('customers_crm').doc('cust-proto-ok').set({ id: 'cust-proto-ok', storeId: 's-a1', tenantId: 't-alpha', name: 'Normal' }),
      db.collection('tables').doc('tbl-soft-del').set({ id: 'tbl-soft-del', storeId: 's-a1', tenantId: 't-alpha', tableNumber: 99, _deleted: true }),
      db.collection('inventory_batches').doc('bat-soft-del').set({ id: 'bat-soft-del', storeId: 's-a1', tenantId: 't-alpha', sku: 'DEL', _deleted: true }),
      db.collection('drivers').doc('drv-soft-del').set({ id: 'drv-soft-del', storeId: 's-a1', tenantId: 't-alpha', name: 'DelDriver', _deleted: true }),
      db.collection('suppliers').doc('sup-soft-del').set({ id: 'sup-soft-del', storeId: 's-a1', tenantId: 't-alpha', name: 'DelSup', _deleted: true }),
      db.collection('reservations').doc('res-soft-del').set({ id: 'res-soft-del', storeId: 's-a1', tenantId: 't-alpha', _deleted: true }),
    ]);

    const [
      ordersListRes,
      orderDelGetRes,
      custsListRes,
      tablesListRes,
      invListRes,
      driversListRes,
      supListRes,
      resListRes,
      genDelGetRes,
      putCustProtoRes,
      postTableProtoRes,
      postResProtoRes,
    ] = await Promise.all([
      fetch(`${baseUrl}/api/v1/commerce/orders?storeId=s-a1`, { headers: { Authorization: `Bearer ${tokMgrA1}` } }),
      fetch(`${baseUrl}/api/v1/commerce/orders/ord-soft-del`, { headers: { Authorization: `Bearer ${tokMgrA1}` } }),
      fetch(`${baseUrl}/api/v1/store/customers?storeId=s-a1`, { headers: { Authorization: `Bearer ${tokMgrA1}` } }),
      fetch(`${baseUrl}/api/v1/store/tables?storeId=s-a1`, { headers: { Authorization: `Bearer ${tokMgrA1}` } }),
      fetch(`${baseUrl}/api/v1/store/inventory?storeId=s-a1`, { headers: { Authorization: `Bearer ${tokMgrA1}` } }),
      fetch(`${baseUrl}/api/v1/commerce/drivers?storeId=s-a1`, { headers: { Authorization: `Bearer ${tokMgrA1}` } }),
      fetch(`${baseUrl}/api/v1/store/suppliers?storeId=s-a1`, { headers: { Authorization: `Bearer ${tokMgrA1}` } }),
      fetch(`${baseUrl}/api/v1/store/reservations?storeId=s-a1`, { headers: { Authorization: `Bearer ${tokMgrA1}` } }),
      fetch(`${baseUrl}/api/v1/generic/customers_crm/cust-soft-del`, { headers: { Authorization: `Bearer ${tokMgrA1}` } }),
      fetch(`${baseUrl}/api/v1/store/customers/cust-proto-ok`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrA1}` },
        body: '{"name":"Cust Limpo","__proto__":{"pollutedCust":true}}',
      }),
      fetch(`${baseUrl}/api/v1/store/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrA1}` },
        body: '{"storeId":"s-a1","tableNumber":18,"capacity":4,"__proto__":{"pollutedTbl":true}}',
      }),
      fetch(`${baseUrl}/api/v1/store/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrA1}` },
        body: '{"storeId":"s-a1","customerName":"Ana","date":"2030-05-01","time":"19:00","__proto__":{"pollutedRes":true}}',
      }),
    ]);

    const [ordersList, custsList, tablesList, invList, driversList, supList, resList]: any[] = await Promise.all([
      ordersListRes.json(),
      custsListRes.json(),
      tablesListRes.json(),
      invListRes.json(),
      driversListRes.json(),
      supListRes.json(),
      resListRes.json(),
    ]);

    const protoPolluted =
      ({} as any).pollutedCust === true ||
      ({} as any).pollutedTbl === true ||
      ({} as any).pollutedRes === true;

    check(
      reconcileRes.status === 200 &&
        tenantOvdAfter?.saasPaymentStatus === 'OVERDUE' &&
        storeDelAfter?.saasPaymentStatus === 'TRIAL' &&
        !reconcileJson?.stores?.some((s: any) => s.id === 's-del-skip') &&
        badPlanSubReq.status === 400 &&
        saasCouponAfterFail?.usageCount === 0 &&
        okPlanSubReq.status === 200 &&
        saasCouponAfterOk?.usageCount === 1 &&
        storePendingAfterReq?.pendingUpgradeRequest?.status === 'PENDING_PAYMENT_CONFIRMATION' &&
        hqApproveSubRes.status === 200 &&
        storeAfterHqApprove?.pendingUpgradeRequest === null &&
        orderDelGetRes.status === 404 &&
        genDelGetRes.status === 404 &&
        !ordersList.some((x: any) => x.id === 'ord-soft-del') &&
        !custsList.some((x: any) => x.id === 'cust-soft-del') &&
        !tablesList.some((x: any) => x.id === 'tbl-soft-del') &&
        !invList.some((x: any) => x.id === 'bat-soft-del') &&
        !driversList.some((x: any) => x.id === 'drv-soft-del') &&
        !supList.some((x: any) => x.id === 'sup-soft-del') &&
        !resList.some((x: any) => x.id === 'res-soft-del') &&
        putCustProtoRes.status === 200 &&
        postTableProtoRes.status === 200 &&
        postResProtoRes.status === 200 &&
        !protoPolluted,
      'P2-14. Reconcile ignora deletadas/sincroniza tenant OVERDUE, upgrade+cupom atômico+clear HQ, filtro _deleted global e sanitização __proto__',
      `ovd=${tenantOvdAfter?.saasPaymentStatus}, delSt=${storeDelAfter?.saasPaymentStatus}, reqs=${badPlanSubReq.status}/${okPlanSubReq.status}, hqPend=${String(storeAfterHqApprove?.pendingUpgradeRequest)}, del404=${orderDelGetRes.status}/${genDelGetRes.status}, proto=${protoPolluted}`
    );

    // 15. P2 Waiter-pairing _deleted/SUSPENDED guards (Cloud & Edge), Edge /confirm-payment audit parity, _deleted users filter, Tauri ESC/POS validation
    await Promise.all([
      db.collection('stores').doc('s-susp-pair').set({
        id: 's-susp-pair',
        tenantId: 't-alpha',
        name: 'Loja Suspensa Pair',
        status: 'SUSPENDED',
        waiterPairingPin: '123-456',
      }),
      db.collection('users').doc('u-del-staff').set({
        uid: 'u-del-staff',
        id: 'u-del-staff',
        email: 'delstaff@a1.local',
        role: 'CASHIER',
        tenantId: 't-alpha',
        storeId: 's-a1',
        _deleted: true,
      }),
    ]);

    const [
      cloudWaiterSuspGet,
      cloudWaiterSuspRegen,
      cloudWaiterDelGet,
      adminUsersAfterDel,
      storeStaffAfterDel,
    ] = await Promise.all([
      fetch(`${baseUrl}/api/v1/store/s-susp-pair/waiter-pairing`, { headers: { Authorization: `Bearer ${tokDev}` } }),
      fetch(`${baseUrl}/api/v1/store/s-susp-pair/waiter-pairing/regenerate`, { method: 'POST', headers: { Authorization: `Bearer ${tokDev}` } }),
      fetch(`${baseUrl}/api/v1/store/s-del-skip/waiter-pairing`, { headers: { Authorization: `Bearer ${tokDev}` } }),
      fetch(`${baseUrl}/api/v1/admin/users`, { headers: { Authorization: `Bearer ${tokDev}` } }).then((r) => r.json()),
      fetch(`${baseUrl}/api/v1/store/staff?storeId=s-a1`, { headers: { Authorization: `Bearer ${tokMgrA1}` } }).then((r) => r.json()),
    ]);

    // Edge confirm-payment audit parity
    const edgePayOrdRes = await fetch(`http://127.0.0.1:${restartedPort}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrA1}` },
      body: JSON.stringify({
        storeId: 's-a1',
        channel: 'POS',
        deliveryModality: 'PICKUP',
        paymentMethod: 'PIX',
        items: [{ menuItemId: 'prd-a1', quantity: 1 }],
      }),
    });
    const edgePayOrdJson: any = await edgePayOrdRes.json();
    const edgePayOrdId = edgePayOrdJson?.transaction?.orderId;
    const edgeConfirmRes = await fetch(`http://127.0.0.1:${restartedPort}/api/v1/commerce/orders/${edgePayOrdId}/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashA1}` },
      body: JSON.stringify({ paymentMethod: 'PIX', providerTransactionId: 'edge-pix-ref-521' }),
    });
    const edgeConfirmJson: any = await edgeConfirmRes.json();
    const edgePaidOrdDoc = await edgeA.driver.getDoc<any>('orders', edgePayOrdId);
    const edgePaidFinDoc = await edgeA.driver.getDoc<any>('financial_records', `fin-ord-${edgePayOrdId}`);

    // Edge waiter-pairing SUSPENDED guard
    await edgeA.driver.setDoc('stores', 's-a1', {
      id: 's-a1',
      tenantId: 't-alpha',
      name: 'Alpha Matriz Suspensa Edge',
      status: 'SUSPENDED',
    });
    const edgeWaiterSuspRes = await fetch(`http://127.0.0.1:${restartedPort}/api/v1/store/s-a1/waiter-pairing`, {
      headers: { Authorization: `Bearer ${tokMgrA1}` },
    });

    const tauriMainRs = fs.readFileSync(path.join(process.cwd(), 'apps/store-desktop/src-tauri/src/main.rs'), 'utf-8');
    const tauriHardened =
      tauriMainRs.includes('fn is_allowed_escpos_socket') &&
      tauriMainRs.includes('fn is_allowed_printer_device_path') &&
      tauriMainRs.includes('!is_allowed_escpos_socket(&socket_addr') &&
      tauriMainRs.includes('!is_allowed_printer_device_path(trimmed)');

    check(
      cloudWaiterSuspGet.status === 403 &&
        cloudWaiterSuspRegen.status === 403 &&
        cloudWaiterDelGet.status === 404 &&
        Array.isArray(adminUsersAfterDel) &&
        !adminUsersAfterDel.some((u: any) => u.uid === 'u-del-staff') &&
        Array.isArray(storeStaffAfterDel) &&
        !storeStaffAfterDel.some((u: any) => u.uid === 'u-del-staff') &&
        edgeConfirmRes.status === 200 &&
        edgeConfirmJson?.paymentConfirmationType === 'MANUAL_OPERATOR' &&
        edgeConfirmJson?.settlementSource === 'OPERATOR_CONSOLE' &&
        edgeConfirmJson?.confirmedByUid === 'u-cash-a1' &&
        edgePaidOrdDoc?.paymentConfirmationType === 'MANUAL_OPERATOR' &&
        edgePaidOrdDoc?.operatorReferenceId === 'edge-pix-ref-521' &&
        edgePaidFinDoc?.confirmedByUid === 'u-cash-a1' &&
        edgeWaiterSuspRes.status === 403 &&
        tauriHardened,
      'P2-15. Pareamento bloqueia loja suspensa/deletada (Cloud & Edge), Edge /confirm-payment grava trilha MANUAL_OPERATOR, filtro _deleted em usuários e IPC Tauri restrito à LAN/dispositivo',
      `cloudWaiter=${cloudWaiterSuspGet.status}/${cloudWaiterSuspRegen.status}/${cloudWaiterDelGet.status}, edgeConfirm=${edgeConfirmRes.status}/${edgeConfirmJson?.paymentConfirmationType}, edgeWaiter=${edgeWaiterSuspRes.status}, tauri=${tauriHardened}`
    );
  } finally {
    if (edgeA) await edgeA.close().catch(() => {});
    (server as any).closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevBackupDir !== undefined) process.env.SERVER_BACKUP_DIR = prevBackupDir;
    else delete process.env.SERVER_BACKUP_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log('----------------------------------------------------------------------');
  console.log(`Resultado Remediação 5.2.1: ${passed} ✓ / ${failed} ✗`);
  console.log('======================================================================');
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Erro fatal em audit-remediation.test.ts:', err);
  process.exit(1);
});
