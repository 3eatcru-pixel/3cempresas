import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-store-os-sec-'));
if (!process.env.SERVER_DB_PATH) process.env.SERVER_DB_PATH = path.join(tempDir, 'store-os-test-db.json');
if (!process.env.SERVER_SECRET_PATH) process.env.SERVER_SECRET_PATH = path.join(tempDir, '.server-secret');
if (!process.env.SERVER_SECRET) process.env.SERVER_SECRET = '3c_store_os_sec_isolated_secret_2026';

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
  const { createServerCoreApp } = await import('../../src/server/app.ts');
  const { EdgeNodeRuntime } = await import('../../servers/edge-node/index.ts');
  const { registerPlatformAdapters, getPlatformAdapters } = await import('@3c/platform-adapters');
  const { syncEngine, StorageService } = await import('@3c/sync-engine');
  const {
    getVisibleApps,
    isAppAllowedForRole,
    getDefaultAppForRole,
  } = await import('../../src/modules/store-os/layout/storeOsAppsList.ts');

  console.log('======================================================================');
  console.log('🏪  ETAPA 2 (STORE OS / LOJISTA) — AUDITORIA FUNCIONAL, RBAC & EDGE');
  console.log('======================================================================\n');

  const app = createServerCoreApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // Point PlatformAdapters network resolver at our isolated Cloud Core HTTP server
  const baseAdapters = getPlatformAdapters();
  registerPlatformAdapters({
    network: {
      ...baseAdapters.network,
      getRootBaseUrl: () => baseUrl,
      getApiBaseUrl: () => `${baseUrl}/api/v1`,
      isOnline: () => true,
    },
  });

  const edgeSqlitePath = path.join(tempDir, 'edge-store-os.sqlite');
  let edgeRuntime: any = null;

  try {
    // =========================================================================
    // 0. Seed Tenant, Branches (Matriz store-1 + Filial store-2 + Rival store), Users, Catalog, BOM, Tables, Coupon
    // =========================================================================
    await db.collection('tenants').doc('tenant-1').set({
      id: 'tenant-1',
      name: 'Grupo 3C Gastronomia',
      status: 'ACTIVE',
      subscriptionPlan: 'PRO',
      maxAllowedBranches: 2,
      maxAllowedDevices: 10,
    });
    await db.collection('tenants').doc('tenant-rival').set({
      id: 'tenant-rival',
      name: 'Concorrente S.A.',
      status: 'ACTIVE',
      subscriptionPlan: 'BASIC',
      maxAllowedBranches: 1,
      maxAllowedDevices: 5,
    });

    const store1Data = {
      id: 'store-1',
      tenantId: 'tenant-1',
      name: 'Burger Matriz Store OS',
      slug: 'burger-matriz-store-os',
      category: 'RESTAURANT',
      address: 'Av. Higienópolis, 100',
      branchLabel: 'Matriz',
      subscriptionPlan: 'PRO',
      maxAllowedBranches: 2,
      maxAllowedDevices: 10,
      deliveryFee: 8.5,
      isOpen: true,
      enabledModules: ['pdv', 'pdv-retail', 'kds', 'tables', 'inventory', 'finance', 'crm', 'reservations', 'kiosk'],
    };
    await db.collection('stores').doc('store-1').set(store1Data);

    await db.collection('stores').doc('store-2').set({
      id: 'store-2',
      tenantId: 'tenant-1',
      name: 'Burger Filial Sul',
      slug: 'burger-filial-sul',
      category: 'RESTAURANT',
      subscriptionPlan: 'PRO',
      isOpen: true,
    });

    await db.collection('stores').doc('store-rival').set({
      id: 'store-rival',
      tenantId: 'tenant-rival',
      name: 'Concorrente S.A.',
      slug: 'concorrente-sa',
      category: 'RETAIL',
      isOpen: true,
    });

    const usersSeed = [
      { uid: 'usr-owner-1', id: 'usr-owner-1', email: 'owner1@store.com', name: 'Dono Loja 1', role: 'STORE_OWNER', tenantId: 'tenant-1', status: 'ACTIVE', tokenVersion: 1 },
      { uid: 'usr-mgr-1', id: 'usr-mgr-1', email: 'mgr1@store.com', name: 'Gerente Matriz', role: 'STORE_MANAGER', tenantId: 'tenant-1', storeId: 'store-1', status: 'ACTIVE', tokenVersion: 1 },
      { uid: 'usr-cash-1', id: 'usr-cash-1', email: 'cash1@store.com', name: 'Caixa Matriz', role: 'CASHIER', tenantId: 'tenant-1', storeId: 'store-1', status: 'ACTIVE', tokenVersion: 1 },
      { uid: 'usr-waiter-1', id: 'usr-waiter-1', email: 'waiter1@store.com', name: 'Garçom Matriz', role: 'WAITER', tenantId: 'tenant-1', storeId: 'store-1', status: 'ACTIVE', tokenVersion: 1 },
      { uid: 'usr-kitchen-1', id: 'usr-kitchen-1', email: 'kitchen1@store.com', name: 'Cozinha Matriz', role: 'KITCHEN_STAFF', tenantId: 'tenant-1', storeId: 'store-1', status: 'ACTIVE', tokenVersion: 1 },
      { uid: 'usr-rival-mgr', id: 'usr-rival-mgr', email: 'rival@other.com', name: 'Gerente Rival', role: 'STORE_MANAGER', tenantId: 'tenant-rival', storeId: 'store-rival', status: 'ACTIVE', tokenVersion: 1 },
    ];
    for (const u of usersSeed) {
      await db.collection('users').doc(u.uid).set(u);
    }

    const tokOwner = auth.generateDevToken({ uid: 'usr-owner-1', email: 'owner1@store.com', role: 'STORE_OWNER', tenantId: 'tenant-1', tokenVersion: 1 });
    const tokMgr1 = auth.generateDevToken({ uid: 'usr-mgr-1', email: 'mgr1@store.com', role: 'STORE_MANAGER', tenantId: 'tenant-1', storeId: 'store-1', tokenVersion: 1 });
    const tokCashier1 = auth.generateDevToken({ uid: 'usr-cash-1', email: 'cash1@store.com', role: 'CASHIER', tenantId: 'tenant-1', storeId: 'store-1', tokenVersion: 1 });
    const tokRival = auth.generateDevToken({ uid: 'usr-rival-mgr', email: 'rival@other.com', role: 'STORE_MANAGER', tenantId: 'tenant-rival', storeId: 'store-rival', tokenVersion: 1 });

    // Catalog item with variants + BOM recipe
    await db.collection('menu_items').doc('prd-burger-bom').set({
      id: 'prd-burger-bom',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      name: 'Burger Artesanal BOM',
      price: 40,
      costPrice: 15,
      stock: 20,
      isAvailable: true,
      variants: [
        { id: 'var-duplo', label: 'Duplo', stock: 10, priceDelta: 0 },
        { id: 'var-triplo', label: 'Triplo', stock: 5, priceDelta: 0 },
      ],
      recipe: [
        { ingredientId: 'SKU-CARNE', ingredientName: 'Blend Bovino 180g', quantityRequired: 2 },
      ],
    });

    // Two FIFO raw batches for SKU-CARNE (earliest expiration first)
    await db.collection('inventory_batches').doc('batch-fifo-1').set({
      id: 'batch-fifo-1',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      sku: 'SKU-CARNE',
      name: 'Blend Bovino Lote Antigo',
      quantity: 3,
      unit: 'UN',
      costPerUnit: 5.5,
      expirationDate: '2026-11-20T00:00:00.000Z',
    });
    await db.collection('inventory_batches').doc('batch-fifo-2').set({
      id: 'batch-fifo-2',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      sku: 'SKU-CARNE',
      name: 'Blend Bovino Lote Novo',
      quantity: 10,
      unit: 'UN',
      costPerUnit: 6.0,
      expirationDate: '2026-12-20T00:00:00.000Z',
    });

    // Dining Table #10
    await db.collection('tables').doc('tbl-store1-10').set({
      id: 'tbl-store1-10',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      tableNumber: 10,
      capacity: 4,
      status: 'FREE',
    });

    // Active Store Coupon
    await db.collection('coupons').doc('cpn-loja10').set({
      id: 'cpn-loja10',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      code: 'LOJA10',
      discountType: 'PERCENT',
      discountValue: 10,
      minOrderValue: 30,
      isActive: true,
      usageCount: 0,
      usageLimit: 50,
    });

    // =========================================================================
    // 1. CASH SESSION LIFECYCLE, ANTI-DOUBLE-OPEN (409) & RBAC ON FINANCE / SPED
    // =========================================================================
    const negCashResp = await fetch(`${baseUrl}/api/v1/store/cash/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({ id: 'cash-neg', storeId: 'store-1', initialCash: -100, status: 'OPEN' }),
    });

    const openCashResp = await fetch(`${baseUrl}/api/v1/store/cash/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({
        id: 'cash-s1-open',
        storeId: 'store-1',
        operatorName: 'Caixa Matriz',
        openedAt: new Date().toISOString(),
        initialCash: 200,
        totalSales: 0,
        totalSangrias: 0,
        totalSuprimentos: 0,
        finalCashCalculated: 200,
        status: 'OPEN',
      }),
    });

    const dupCashResp = await fetch(`${baseUrl}/api/v1/store/cash/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({
        id: 'cash-s1-duplicate',
        storeId: 'store-1',
        initialCash: 100,
        status: 'OPEN',
      }),
    });

    const crossCashResp = await fetch(`${baseUrl}/api/v1/store/cash/session?storeId=store-2`, {
      headers: { Authorization: `Bearer ${tokCashier1}` },
    });

    check(
      negCashResp.status === 400 &&
        openCashResp.status === 200 &&
        dupCashResp.status === 409 &&
        crossCashResp.status === 403,
      '1. Caixa PDV valida valores (>=0), abre turno único, bloqueia dupla abertura (409) e isola filial (403)',
      `neg=${negCashResp.status}, open=${openCashResp.status}, dup=${dupCashResp.status}, cross=${crossCashResp.status}`
    );

    // Financial RBAC & SPED Isolation
    const [cashierFinGet, cashierFinPost, mgrFinValid, mgrFinBadAmt, mgrCrossBranchFin, mgrSpedCross] = await Promise.all([
      fetch(`${baseUrl}/api/v1/store/finance?storeId=store-1`, { headers: { Authorization: `Bearer ${tokCashier1}` } }),
      fetch(`${baseUrl}/api/v1/store/finance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
        body: JSON.stringify({ storeId: 'store-1', type: 'PAYABLE', amount: 50, description: 'Tentativa caixa' }),
      }),
      fetch(`${baseUrl}/api/v1/store/finance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
        body: JSON.stringify({ id: 'fin-mgr-1', storeId: 'store-1', type: 'PAYABLE', category: 'ALUGUEL', description: 'Conta Energia', amount: 150, status: 'PAID' }),
      }),
      fetch(`${baseUrl}/api/v1/store/finance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
        body: JSON.stringify({ storeId: 'store-1', type: 'PAYABLE', amount: -20, description: 'Invalido' }),
      }),
      fetch(`${baseUrl}/api/v1/store/finance?storeId=store-2`, { headers: { Authorization: `Bearer ${tokMgr1}` } }),
      fetch(`${baseUrl}/api/v1/store/export/sped?storeId=store-2`, { headers: { Authorization: `Bearer ${tokMgr1}` } }),
    ]);

    const mgrSpedOwn = await fetch(`${baseUrl}/api/v1/store/export/sped?storeId=store-1`, {
      headers: { Authorization: `Bearer ${tokMgr1}` },
    });
    const spedTxt = await mgrSpedOwn.text();
    check(
      cashierFinGet.status === 403 &&
        cashierFinPost.status === 403 &&
        mgrFinValid.status === 200 &&
        mgrFinBadAmt.status === 400 &&
        mgrCrossBranchFin.status === 403 &&
        mgrSpedOwn.status === 200 &&
        spedTxt.includes('|0000|015|') &&
        spedTxt.includes('fin-mgr-1') &&
        mgrSpedCross.status === 403,
      '2. Financeiro & SPED aplicam RBAC (STORE_MANAGER permitido na filial; CASHIER bloqueado; cross-branch 403; valor <= 0 400)',
      `cashGet=${cashierFinGet.status}, mgrFin=${mgrFinValid.status}, badAmt=${mgrFinBadAmt.status}, sped=${mgrSpedOwn.status}, cross=${mgrSpedCross.status}`
    );

    // =========================================================================
    // 2. CLOUD POS ORDER: STOCK + VARIANT + BOM FIFO + COUPON + TABLE + FINANCIAL LEDGER + CASH SESSION + OUTBOX
    // =========================================================================
    // Order 2x Burger Artesanal BOM (Var: Duplo) -> Subtotal = 80, Coupon LOJA10 = -8 => Total = 72
    // Consumes 4x SKU-CARNE: 3 from batch-fifo-1 (0 left) + 1 from batch-fifo-2 (9 left)
    const cloudPosOrderResp = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({
        storeId: 'store-1',
        channel: 'WAITER_TABLE',
        tableNumber: 10,
        customerName: 'Mesa 10',
        paymentMethod: 'PIX',
        paymentConfirmed: true,
        deliveryModality: 'PICKUP',
        couponCode: 'LOJA10',
        items: [{ menuItemId: 'prd-burger-bom', variantId: 'var-duplo', variantLabel: 'Duplo', quantity: 2 }],
      }),
    });
    const cloudPosJson: any = await cloudPosOrderResp.json();
    const orderId = cloudPosJson?.transaction?.orderId;

    const [itemAfterOrder, b1After, b2After, tblAfter, cpnAfter, cashAfter, finOrdDoc, ledgerDocs, outboxDocs] = await Promise.all([
      db.collection('menu_items').doc('prd-burger-bom').get(),
      db.collection('inventory_batches').doc('batch-fifo-1').get(),
      db.collection('inventory_batches').doc('batch-fifo-2').get(),
      db.collection('tables').doc('tbl-store1-10').get(),
      db.collection('coupons').doc('cpn-loja10').get(),
      db.collection('cash_sessions').doc('cash-s1-open').get(),
      db.collection('financial_records').doc(`fin-ord-${orderId}`).get(),
      db.collection('stock_ledger').get(),
      db.collection('sync_outbox').get(),
    ]);

    const itemData = itemAfterOrder.data() || {};
    const duploVarAfter = (itemData.variants || []).find((v: any) => v.id === 'var-duplo');
    const orderLedger = ledgerDocs.docs.map((d) => d.data()).filter((l) => l.orderId === orderId);
    const hasSaleLedger = orderLedger.some((l) => l.itemType === 'MENU_ITEM' && l.deltaQty === -2);
    const hasVariantLedger = orderLedger.some((l) => l.itemType === 'VARIANT' && l.deltaQty === -2);
    const hasBomLedger = orderLedger.some((l) => l.itemType === 'RAW_BATCH' && l.reason === 'BOM_FIFO' && l.targetId === 'batch-fifo-1' && l.deltaQty === -3);
    const hasFinOutbox = outboxDocs.docs.some((d) => d.data()?.entity === 'financial_records' && d.data()?.entityId === `fin-ord-${orderId}`);
    const hasCashOutbox = outboxDocs.docs.some((d) => d.data()?.entity === 'cash_sessions' && d.data()?.entityId === 'cash-s1-open');

    check(
      cloudPosOrderResp.status === 201 &&
        cloudPosJson?.transaction?.subtotal === 80 &&
        cloudPosJson?.transaction?.discount === 8 &&
        cloudPosJson?.transaction?.total === 72 &&
        itemData.stock === 18 &&
        duploVarAfter?.stock === 8 &&
        b1After.data()?.quantity === 0 &&
        b2After.data()?.quantity === 9 &&
        tblAfter.data()?.status === 'OCCUPIED' &&
        cpnAfter.data()?.usageCount === 1 &&
        finOrdDoc.exists &&
        finOrdDoc.data()?.type === 'RECEIVABLE' &&
        finOrdDoc.data()?.amount === 72 &&
        cashAfter.data()?.totalSales === 72 &&
        cashAfter.data()?.finalCashCalculated === 272 &&
        hasSaleLedger &&
        hasVariantLedger &&
        hasBomLedger &&
        hasFinOutbox &&
        hasCashOutbox,
      '3. Pedido Cloud PDV/Mesa executa baixa atômica (produto, variação, BOM FIFO), aplica cupom, ocupa mesa, lança RECEIVABLE e atualiza caixa + outbox',
      `status=${cloudPosOrderResp.status}, total=${cloudPosJson?.transaction?.total}, stock=${itemData.stock}, var=${duploVarAfter?.stock}, b1=${b1After.data()?.quantity}, b2=${b2After.data()?.quantity}, cashSales=${cashAfter.data()?.totalSales}`
    );

    // =========================================================================
    // 3. POS / RETAIL RETURN & ANTI-DOUBLE-RETURN
    // =========================================================================
    const retOkResp = await fetch(`${baseUrl}/api/v1/commerce/orders/${orderId}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({ itemIndex: 0, quantity: 1, reason: 'Troca balcão' }),
    });
    const retOkJson: any = await retOkResp.json();

    // Try returning 2 more when only 1 remains (purchased=2, returned=1) -> must reject 400
    const retExcessResp = await fetch(`${baseUrl}/api/v1/commerce/orders/${orderId}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({ itemIndex: 0, quantity: 2, reason: 'Estorno duplicado' }),
    });

    const itemAfterRet = (await db.collection('menu_items').doc('prd-burger-bom').get()).data() || {};
    const duploAfterRet = (itemAfterRet.variants || []).find((v: any) => v.id === 'var-duplo');
    const finReturnDoc = await db.collection('financial_records').doc(`fin-ret-${orderId}-0-1`).get();

    check(
      retOkResp.status === 200 &&
        retOkJson.stockRestored === 1 &&
        retOkJson.refundAmount === 40 &&
        itemAfterRet.stock === 19 &&
        duploAfterRet?.stock === 9 &&
        finReturnDoc.exists &&
        finReturnDoc.data()?.type === 'PAYABLE' &&
        retExcessResp.status === 400,
      '4. Devolução PDV/Varejo restaura estoque/variação, gera estorno PAYABLE e bloqueia devolução em excesso (400)',
      `retOk=${retOkResp.status}, stock=${itemAfterRet.stock}, var=${duploAfterRet?.stock}, excess=${retExcessResp.status}`
    );

    // =========================================================================
    // 4. MENU NUMERIC VALIDATION & CRM BRANCH ISOLATION
    // =========================================================================
    const [badMenuPost, badVariantPost, crossCrmPost, okCrmPost] = await Promise.all([
      fetch(`${baseUrl}/api/v1/store/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
        body: JSON.stringify({ storeId: 'store-1', name: 'Item Negativo', price: -5, stock: 10 }),
      }),
      fetch(`${baseUrl}/api/v1/store/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
        body: JSON.stringify({ storeId: 'store-1', name: 'Variação Negativa', price: 10, stock: 10, variants: [{ id: 'v1', label: 'P', stock: -3 }] }),
      }),
      fetch(`${baseUrl}/api/v1/store/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
        body: JSON.stringify({ id: 'crm-cross', storeId: 'store-2', name: 'Cliente Invasor' }),
      }),
      fetch(`${baseUrl}/api/v1/store/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
        body: JSON.stringify({ id: 'crm-s1-ok', storeId: 'store-1', name: 'Cliente Matriz', phone: '43999990000' }),
      }),
    ]);

    const crmCrossPut = await fetch(`${baseUrl}/api/v1/store/customers/crm-s1-ok`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokRival}` },
      body: JSON.stringify({ name: 'Adulterado Rival' }),
    });

    check(
      badMenuPost.status === 400 &&
        badVariantPost.status === 400 &&
        crossCrmPost.status === 403 &&
        okCrmPost.status === 200 &&
        crmCrossPut.status === 403,
      '5. Cardápio rejeita preço/estoque negativos (400) e CRM isola clientes por filial e tenant (403)',
      `badMenu=${badMenuPost.status}, badVar=${badVariantPost.status}, crossCrm=${crossCrmPost.status}, okCrm=${okCrmPost.status}, rivalPut=${crmCrossPut.status}`
    );

    // =========================================================================
    // 5. EDGE NODE SQLITE WAL PARITY, RESERVATION CONFLICT, COUPON + CASH + BOM & CLOUD SYNC
    // =========================================================================
    edgeRuntime = new EdgeNodeRuntime({
      storeId: 'store-1',
      tenantId: 'tenant-1',
      nodeId: 'edg_store_os_test',
      dbPath: edgeSqlitePath,
      port: 0,
    });
    await edgeRuntime.bootstrapFromCloud(baseUrl, tokOwner);
    const edgePort = await edgeRuntime.listen(0);
    const edgeUrl = `http://127.0.0.1:${edgePort}`;

    const [bootCoupons, bootCash] = await Promise.all([
      edgeRuntime.driver.listDocs('coupons'),
      edgeRuntime.driver.listDocs('cash_sessions'),
    ]);

    // Edge Table status validation (400 invalid enum, 404 missing table)
    const [badTblStatus, missingTblStatus] = await Promise.all([
      fetch(`${edgeUrl}/api/v1/store/tables/tbl-store1-10/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
        body: JSON.stringify({ status: 'HACKED_STATE' }),
      }),
      fetch(`${edgeUrl}/api/v1/store/tables/tbl-inexistente/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
        body: JSON.stringify({ status: 'FREE' }),
      }),
    ]);

    // Edge Reservation overlap detection (409)
    const resTime = '2026-12-24T20:00:00.000Z';
    const res1Resp = await fetch(`${edgeUrl}/api/v1/store/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({ id: 'res-edge-1', customerName: 'Ana', tableNumber: 10, partySize: 4, dateTime: resTime, durationMinutes: 90 }),
    });
    const resOverlapResp = await fetch(`${edgeUrl}/api/v1/store/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({ id: 'res-edge-2', customerName: 'Beto', tableNumber: 10, partySize: 2, dateTime: '2026-12-24T20:30:00.000Z', durationMinutes: 60 }),
    });

    // Edge POS order: 1x Burger BOM (var-triplo) with LOJA10 coupon (40 - 4 = 36)
    const edgeOrderResp = await fetch(`${edgeUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({
        channel: 'POS',
        customerName: 'Cliente Offline Edge',
        paymentMethod: 'CASH',
        deliveryModality: 'PICKUP',
        couponCode: 'LOJA10',
        items: [{ menuItemId: 'prd-burger-bom', variantId: 'var-triplo', variantLabel: 'Triplo', quantity: 1 }],
      }),
    });
    const edgeOrderJson: any = await edgeOrderResp.json();
    const edgeOrderId = edgeOrderJson?.transaction?.orderId;

    const [edgeItemAfter, edgeBatch2After, edgeCashAfter, edgeFinDoc] = await Promise.all([
      edgeRuntime.driver.getDoc('menu_items', 'prd-burger-bom'),
      edgeRuntime.driver.getDoc('inventory_batches', 'batch-fifo-2'),
      edgeRuntime.driver.getDoc('cash_sessions', 'cash-s1-open'),
      edgeRuntime.driver.getDoc('financial_records', `fin-ord-${edgeOrderId}`),
    ]);
    const triploVarEdge = (edgeItemAfter?.variants || []).find((v: any) => v.id === 'var-triplo');

    // Register Edge Node technical identity (edg-tok:) and push Edge outbox to Cloud without using Cashier financial permissions
    const { edgeToken: regEdgeToken } = await edgeRuntime.registerWithCloud(baseUrl, tokMgr1, 'edge-store-os-test');
    const syncReport = await edgeRuntime.syncWithCloud(baseUrl, regEdgeToken);
    const outboxAfterSync = await edgeRuntime.driver.listDocs('sync_outbox');
    const syncErrors = outboxAfterSync.filter((o: any) => Boolean(o.syncError));
    const cloudSyncedFin = await db.collection('financial_records').doc(`fin-ord-${edgeOrderId}`).get();
    const cloudSyncedCash = await db.collection('cash_sessions').doc('cash-s1-open').get();

    check(
      bootCoupons.length >= 1 &&
        bootCash.length >= 1 &&
        badTblStatus.status === 400 &&
        missingTblStatus.status === 404 &&
        res1Resp.status === 201 &&
        resOverlapResp.status === 409 &&
        edgeOrderResp.status === 201 &&
        edgeOrderJson?.transaction?.total === 36 &&
        edgeItemAfter?.stock === 18 &&
        triploVarEdge?.stock === 4 &&
        edgeBatch2After?.quantity === 7 &&
        edgeFinDoc?.type === 'RECEIVABLE' &&
        edgeFinDoc?.amount === 36 &&
        edgeCashAfter?.totalSales === 108 &&
        syncReport.pushedAccepted >= 5 &&
        syncErrors.length === 0 &&
        cloudSyncedFin.exists &&
        cloudSyncedCash.data()?.totalSales === 108,
      '6. Edge Node SQLite WAL: bootstrap (cupons/caixa), validação mesa (400/404), conflito reserva (409), pedido BOM+cupom+caixa e push ao Cloud sem erros RBAC',
      `bootCpn=${bootCoupons.length}, badTbl=${badTblStatus.status}, resOverlap=${resOverlapResp.status}, edgeOrd=${edgeOrderResp.status}, edgeTotal=${edgeOrderJson?.transaction?.total}, batch2=${edgeBatch2After?.quantity}, pushed=${syncReport.pushedAccepted}, errs=${syncErrors.length}`
    );

    // =========================================================================
    // 6. OFFLINE SYNC ENGINE PRESERVES CONFLICTS & REJECTED MUTATIONS
    // =========================================================================
    // Seed a terminal DELIVERED order on Cloud so trying to mutate its status back to PENDING triggers CONFLICT (TERMINAL_ORDER_STATE)
    await db.collection('orders').doc('ord-terminal-test').set({
      id: 'ord-terminal-test',
      storeId: 'store-1',
      tenantId: 'tenant-1',
      status: 'DELIVERED',
      total: 50,
      hlc: '2026-11-10T00:00:00.000Z:0000:cloud_core',
    });

    await StorageService.clearSyncConflicts();
    await syncEngine.enqueueMutation({
      entity: 'orders',
      entityId: 'ord-terminal-test',
      operation: 'UPSERT',
      storeId: 'store-1',
      appId: 'store-os',
      payload: { status: 'PENDING' },
    });
    // CASHIER trying to write to another branch triggers REJECTED (STORE_MISMATCH)
    await syncEngine.enqueueMutation({
      entity: 'orders',
      entityId: 'ord-cross-reject',
      operation: 'UPSERT',
      storeId: 'store-2',
      appId: 'store-os',
      payload: { storeId: 'store-2', status: 'CONFIRMED' },
    });

    await syncEngine.flushAll({ token: tokCashier1, storeId: 'store-1' });
    const [remainingQueue, preservedConflicts] = await Promise.all([
      StorageService.getPendingMutations(),
      StorageService.getSyncConflicts(),
    ]);
    const hasTerminalConflict = preservedConflicts.some((c) => c.kind === 'CONFLICT' && c.reason === 'TERMINAL_ORDER_STATE');
    const hasRejectedMutation = preservedConflicts.some((c) => c.kind === 'REJECTED' && c.reason === 'STORE_MISMATCH');

    await syncEngine.clearConflicts();
    const afterClear = await StorageService.getSyncConflicts();

    check(
      remainingQueue.length === 0 &&
        preservedConflicts.length === 2 &&
        hasTerminalConflict &&
        hasRejectedMutation &&
        afterClear.length === 0,
      '7. SyncEngine preserva conflitos (CONFLICT) e mutações rejeitadas (REJECTED) no StorageService em vez de descartá-los',
      `queue=${remainingQueue.length}, conflicts=${preservedConflicts.length}, term=${hasTerminalConflict}, rej=${hasRejectedMutation}`
    );

    // =========================================================================
    // 8. STORE OS RBAC UI MATRIX (getVisibleApps, isAppAllowedForRole, getDefaultAppForRole, WAITER excluído e blockedApps)
    // =========================================================================
    const kitchenApps = getVisibleApps(store1Data as any, 0, 'KITCHEN_STAFF').map((a) => a.id);
    const cashierApps = getVisibleApps(store1Data as any, 0, 'CASHIER').map((a) => a.id);
    const waiterApps = getVisibleApps(store1Data as any, 0, 'WAITER').map((a) => a.id);
    const managerApps = getVisibleApps(store1Data as any, 0, 'STORE_MANAGER').map((a) => a.id);
    const regionalApps = getVisibleApps(store1Data as any, 0, 'REGIONAL_MANAGER').map((a) => a.id);
    const ownerApps = getVisibleApps(store1Data as any, 0, 'STORE_OWNER').map((a) => a.id);
    const mgrWithBlocked = getVisibleApps(store1Data as any, 0, 'STORE_MANAGER', ['finance', 'pdv']).map((a) => a.id);
    const ownerWithBlocked = getVisibleApps(store1Data as any, 0, 'STORE_OWNER', ['staff', 'settings']).map((a) => a.id);

    check(
      kitchenApps.includes('kds') &&
        kitchenApps.includes('inventory') &&
        !kitchenApps.includes('pdv') &&
        !kitchenApps.includes('finance') &&
        !kitchenApps.includes('staff') &&
        getDefaultAppForRole('KITCHEN_STAFF')?.id === 'kds' &&
        cashierApps.includes('pdv') &&
        cashierApps.includes('finance') &&
        !cashierApps.includes('staff') &&
        !cashierApps.includes('settings') &&
        !cashierApps.includes('saas-billing') &&
        waiterApps.length === 0 &&
        getDefaultAppForRole('WAITER') === null &&
        !isAppAllowedForRole('tables', 'WAITER') &&
        !managerApps.includes('staff') &&
        !managerApps.includes('settings') &&
        !managerApps.includes('saas-billing') &&
        !isAppAllowedForRole('staff', 'STORE_MANAGER') &&
        regionalApps.includes('staff') &&
        regionalApps.includes('finance') &&
        !regionalApps.includes('saas-billing') &&
        !mgrWithBlocked.includes('finance') &&
        !mgrWithBlocked.includes('pdv') &&
        getDefaultAppForRole('CASHIER', ['pdv'])?.id === 'pdv-retail' &&
        ownerWithBlocked.includes('staff') &&
        ownerApps.includes('staff') &&
        ownerApps.includes('settings') &&
        ownerApps.includes('saas-billing'),
      '8. Matriz RBAC do Store OS exclui WAITER (QR-only), libera REGIONAL_MANAGER, aplica blockedApps e dá controle total ao STORE_OWNER',
      `kitchen=[${kitchenApps.join(',')}], waiterLen=${waiterApps.length}, regionalHasStaff=${regionalApps.includes('staff')}, mgrBlocked=${mgrWithBlocked.includes('finance')}/${mgrWithBlocked.includes('pdv')}, ownerHasStaff=${ownerApps.includes('staff')}`
    );

    // =========================================================================
    // 9. CLOUD STORE VALIDATIONS: TABLE ENUM, NEGATIVE INVENTORY, FISCAL BOUNDS, RESERVATION 400/409
    // =========================================================================
    const [badCloudTblStatus, negInvPost, badFiscalEmit, missingResDate, resCloud1, resCloudOverlap] = await Promise.all([
      fetch(`${baseUrl}/api/v1/store/tables/tbl-store1-10/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
        body: JSON.stringify({ status: 'TAMPERED_STATUS' }),
      }),
      fetch(`${baseUrl}/api/v1/store/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
        body: JSON.stringify({ storeId: 'store-1', sku: 'SKU-NEG', name: 'Insumo Negativo', quantity: -5 }),
      }),
      fetch(`${baseUrl}/api/v1/store/fiscal/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwner}` },
        body: JSON.stringify({ storeId: 'store-1', amount: 0, itemsCount: 1 }),
      }),
      fetch(`${baseUrl}/api/v1/store/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
        body: JSON.stringify({ storeId: 'store-1', customerName: 'Sem Data', tableNumber: 10 }),
      }),
      fetch(`${baseUrl}/api/v1/store/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
        body: JSON.stringify({ id: 'res-cloud-1', storeId: 'store-1', customerName: 'Carlos', tableNumber: 10, date: '2026-12-25', time: '19:00', durationMinutes: 90 }),
      }),
      Promise.resolve(null),
    ]);
    const resCloudConflictResp = await fetch(`${baseUrl}/api/v1/store/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
      body: JSON.stringify({ id: 'res-cloud-2', storeId: 'store-1', customerName: 'Conflito', tableNumber: 10, date: '2026-12-25', time: '19:30', durationMinutes: 60 }),
    });
    void resCloudOverlap;

    check(
      badCloudTblStatus.status === 400 &&
        negInvPost.status === 400 &&
        badFiscalEmit.status === 400 &&
        missingResDate.status === 400 &&
        resCloud1.status === 200 &&
        resCloudConflictResp.status === 409,
      '9. Cloud Store rejeita status mesa inválido (400), lote negativo (400), fiscal <= 0 (400), reserva sem data (400) e choque de horário (409)',
      `tbl=${badCloudTblStatus.status}, inv=${negInvPost.status}, fisc=${badFiscalEmit.status}, resNoDate=${missingResDate.status}, res1=${resCloud1.status}, resConf=${resCloudConflictResp.status}`
    );

    // =========================================================================
    // 10. CLOUD COMMERCE VALIDATIONS: UNBOUNDED COMMISSION, INVALID COUPON, DRIVER HQ-ONLY GOVERNANCE
    // =========================================================================
    await db.collection('users').doc('usr-hq-super-store').set({
      uid: 'usr-hq-super-store',
      id: 'usr-hq-super-store',
      email: 'super.store@hq.com',
      name: 'Super Admin HQ',
      role: 'SUPER_ADMIN',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      tokenVersion: 1,
    });
    const tokSuperAdmin = auth.generateDevToken({
      uid: 'usr-hq-super-store',
      email: 'super.store@hq.com',
      role: 'SUPER_ADMIN',
      tenantId: 'tenant-1',
      tokenVersion: 1,
    });

    const [badCommRateResp, badCommAmtResp, badCouponPctResp, storeOwnerDriverPost] = await Promise.all([
      fetch(`${baseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
        body: JSON.stringify({
          storeId: 'store-1',
          channel: 'POS',
          paymentMethod: 'PIX',
          commissionRate: 150,
          items: [{ menuItemId: 'prd-burger-bom', variantId: 'var-duplo', quantity: 1 }],
        }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
        body: JSON.stringify({
          storeId: 'store-1',
          channel: 'POS',
          paymentMethod: 'PIX',
          commissionAmount: 9999,
          items: [{ menuItemId: 'prd-burger-bom', variantId: 'var-duplo', quantity: 1 }],
        }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/coupons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwner}` },
        body: JSON.stringify({ storeId: 'store-1', code: 'ABSURDO', discountType: 'PERCENT', discountValue: 150 }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwner}` },
        body: JSON.stringify({ id: 'drv-store-blocked', storeId: 'store-1', name: 'Tentativa Lojista' }),
      }),
    ]);

    // Somente HQ (DEV_OWNER / SUPER_ADMIN) cadastra e edita contas de motoristas; lojista apenas consulta/despacha
    const hqDriverPost = await fetch(`${baseUrl}/api/v1/commerce/drivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokSuperAdmin}` },
      body: JSON.stringify({ id: 'drv-s2-only', storeId: 'store-2', name: 'Motoboy Filial 2' }),
    });
    const tokBranchOwner = auth.generateDevToken({ uid: 'usr-owner-branch1', email: 'b1@store.com', role: 'STORE_OWNER', tenantId: 'tenant-1', storeId: 'store-1', tokenVersion: 1 });
    await db.collection('users').doc('usr-owner-branch1').set({ uid: 'usr-owner-branch1', id: 'usr-owner-branch1', email: 'b1@store.com', role: 'STORE_OWNER', tenantId: 'tenant-1', storeId: 'store-1', status: 'ACTIVE', tokenVersion: 1 });
    const [branchOwnerCrossDrv, mgrCrossDriverPut, hqDriverPut, ownerDriverListGet] = await Promise.all([
      fetch(`${baseUrl}/api/v1/commerce/drivers/drv-s2-only`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokBranchOwner}` },
        body: JSON.stringify({ name: 'Invasão Filial' }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/drivers/drv-s2-only`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
        body: JSON.stringify({ name: 'Adulterado Filial 1' }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/drivers/drv-s2-only`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokSuperAdmin}` },
        body: JSON.stringify({ name: 'Motoboy Filial 2 Atualizado' }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/drivers`, {
        headers: { Authorization: `Bearer ${tokOwner}` },
      }),
    ]);

    check(
      badCommRateResp.status === 400 &&
        badCommAmtResp.status === 400 &&
        badCouponPctResp.status === 400 &&
        storeOwnerDriverPost.status === 403 &&
        hqDriverPost.status === 200 &&
        branchOwnerCrossDrv.status === 403 &&
        mgrCrossDriverPut.status === 403 &&
        hqDriverPut.status === 200 &&
        ownerDriverListGet.status === 200,
      '10. Cloud Commerce rejeita comissão > total/100%, cupom > 100%, bloqueia cadastro de motorista por lojista (403) e libera leitura/despacho',
      `rate=${badCommRateResp.status}, amt=${badCommAmtResp.status}, cpn=${badCouponPctResp.status}, ownerDrvPost=${storeOwnerDriverPost.status}, hqPost=${hqDriverPost.status}, drvCross=${branchOwnerCrossDrv.status}/${mgrCrossDriverPut.status}, hqPut=${hqDriverPut.status}, list=${ownerDriverListGet.status}`
    );

    // =========================================================================
    // 11. ATOMIC CASHIER MOVEMENT (/store/cash/movement): SANGRIA & SUPRIMENTO FOR CASHIER ROLE
    // =========================================================================
    const supResp = await fetch(`${baseUrl}/api/v1/store/cash/movement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({ storeId: 'store-1', type: 'SUPRIMENTO', amount: 50, reason: 'Troco notas' }),
    });
    const supJson: any = await supResp.json();
    const sangResp = await fetch(`${baseUrl}/api/v1/store/cash/movement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({ storeId: 'store-1', type: 'SANGRIA', amount: 30, reason: 'Retirada cofre' }),
    });
    const sangJson: any = await sangResp.json();
    const overSangResp = await fetch(`${baseUrl}/api/v1/store/cash/movement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({ storeId: 'store-1', type: 'SANGRIA', amount: 999999, reason: 'Excessivo' }),
    });
    const cashierFinStillBlocked = await fetch(`${baseUrl}/api/v1/store/finance?storeId=store-1`, {
      headers: { Authorization: `Bearer ${tokCashier1}` },
    });

    check(
      supResp.status === 200 &&
        supJson?.session?.totalSuprimentos === 50 &&
        supJson?.financialRecord?.type === 'RECEIVABLE' &&
        sangResp.status === 200 &&
        sangJson?.session?.totalSangrias === 30 &&
        sangJson?.financialRecord?.type === 'PAYABLE' &&
        overSangResp.status === 400 &&
        cashierFinStillBlocked.status === 403,
      '11. Endpoint atômico /store/cash/movement permite Sangria/Suprimento ao CASHIER com guarda de saldo (400) mantendo DRE /store/finance bloqueado (403)',
      `sup=${supResp.status}, sang=${sangResp.status}, over=${overSangResp.status}, fin=${cashierFinStillBlocked.status}`
    );

    // =========================================================================
    // 12. EDGE NODE EXTENDED OFFLINE PARITY: CASH, FINANCE RBAC, CRM, COUPONS, REQUEST-BILL, RETURN & SUPPLIERS
    // =========================================================================
    const [
      edgeCashGet,
      edgeCashMov,
      edgeFinBlocked,
      edgeFinOk,
      edgeCrmPost,
      edgeSupPost,
      edgeCouponsGet,
      edgeReqBill,
      edgeRetOk,
      edgeRetExcess,
    ] = await Promise.all([
      fetch(`${edgeUrl}/api/v1/store/cash/session?storeId=store-1`, { headers: { Authorization: `Bearer ${tokCashier1}` } }),
      fetch(`${edgeUrl}/api/v1/store/cash/movement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
        body: JSON.stringify({ storeId: 'store-1', type: 'SANGRIA', amount: 10, reason: 'Caixa offline' }),
      }),
      fetch(`${edgeUrl}/api/v1/store/finance?storeId=store-1`, { headers: { Authorization: `Bearer ${tokCashier1}` } }),
      fetch(`${edgeUrl}/api/v1/store/finance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
        body: JSON.stringify({ id: 'fin-edge-1', storeId: 'store-1', type: 'PAYABLE', amount: 45, description: 'Despesa offline' }),
      }),
      fetch(`${edgeUrl}/api/v1/store/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
        body: JSON.stringify({ id: 'crm-edge-1', storeId: 'store-1', name: 'Cliente Edge Offline' }),
      }),
      fetch(`${edgeUrl}/api/v1/store/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
        body: JSON.stringify({ id: 'sup-edge-1', storeId: 'store-1', name: 'Fornecedor Edge' }),
      }),
      fetch(`${edgeUrl}/api/v1/commerce/coupons`),
      fetch(`${edgeUrl}/api/v1/store/tables/request-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
        body: JSON.stringify({ storeId: 'store-1', tableNumber: 10 }),
      }),
      fetch(`${edgeUrl}/api/v1/commerce/orders/${edgeOrderId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
        body: JSON.stringify({ itemIndex: 0, quantity: 1, reason: 'Troca offline' }),
      }),
      Promise.resolve(null),
    ]);
    void edgeRetExcess;
    const edgeRetDup = await fetch(`${edgeUrl}/api/v1/commerce/orders/${edgeOrderId}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({ itemIndex: 0, quantity: 1, reason: 'Duplicado offline' }),
    });
    const edgeSyncParityReport = await edgeRuntime.syncWithCloud(baseUrl, tokMgr1);
    const [cloudCrmFromEdge, cloudSupFromEdge, cloudEdgeFin] = await Promise.all([
      db.collection('customers_crm').doc('crm-edge-1').get(),
      db.collection('suppliers').doc('sup-edge-1').get(),
      db.collection('financial_records').doc('fin-edge-1').get(),
    ]);

    check(
      edgeCashGet.status === 200 &&
        edgeCashMov.status === 200 &&
        edgeFinBlocked.status === 403 &&
        edgeFinOk.status === 200 &&
        edgeCrmPost.status === 200 &&
        edgeSupPost.status === 200 &&
        edgeCouponsGet.status === 200 &&
        edgeReqBill.status === 200 &&
        edgeRetOk.status === 200 &&
        edgeRetDup.status === 400 &&
        edgeSyncParityReport.pushedAccepted >= 5 &&
        cloudCrmFromEdge.exists &&
        cloudSupFromEdge.exists &&
        cloudEdgeFin.exists,
      '12. Edge Node Offline completa paridade (caixa, movimentação, RBAC financeiro 403, CRM, fornecedores, cupons, pedir conta, estorno anti-duplo) e sincroniza com Cloud',
      `cash=${edgeCashGet.status}, mov=${edgeCashMov.status}, finBlk=${edgeFinBlocked.status}, finOk=${edgeFinOk.status}, crm=${edgeCrmPost.status}, sup=${edgeSupPost.status}, ret=${edgeRetOk.status}, retDup=${edgeRetDup.status}, pushed=${edgeSyncParityReport.pushedAccepted}`
    );

    // =========================================================================
    // 13. SYNC/PUSH SCHEMA INVARIANT REJECTION (INVALID_PAYLOAD)
    // =========================================================================
    const invalidPushResp = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
      body: JSON.stringify({
        nodeId: 'web_bad_payload_test',
        storeId: 'store-1',
        mutations: [
          { entity: 'tables', entityId: 'tbl-store1-10', operation: 'UPSERT', payload: { status: 'BROKEN_STATUS' } },
          { entity: 'menu_items', entityId: 'prd-burger-bom', operation: 'UPSERT', payload: { price: -99 } },
          { entity: 'financial_records', entityId: 'fin-bad-sync', operation: 'UPSERT', payload: { type: 'PAYABLE', amount: -10 } },
        ],
      }),
    });
    const invalidPushJson: any = await invalidPushResp.json();
    const rejectedReasons = (invalidPushJson.rejected || []).map((r: any) => r.reason);

    check(
      invalidPushResp.status === 200 &&
        (invalidPushJson.accepted || []).length === 0 &&
        rejectedReasons.length === 3 &&
        rejectedReasons.every((r: string) => r === 'INVALID_PAYLOAD'),
      '13. Endpoint /sync/push rejeita mutações com payload corrompido (status mesa inválido, preço negativo, financeiro <= 0)',
      `accepted=${invalidPushJson.accepted?.length}, rejected=${JSON.stringify(rejectedReasons)}`
    );

    // =========================================================================
    // 14. STORE OS /store/staff (blockedApps + RBAC) + /store/devices + EDGE NODE CORS
    // =========================================================================
    const createCashierResp = await fetch(`${baseUrl}/api/v1/store/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwner}` },
      body: JSON.stringify({
        name: 'Caixa Restrito Teste',
        email: 'caixa.blocked@store.com',
        password: 'StaffPassword!2026',
        role: 'CASHIER',
        storeId: 'store-1',
        blockedApps: ['finance', 'kds'],
      }),
    });
    const createCashierJson: any = await createCashierResp.json();
    const newStaffUid = createCashierJson?.uid;
    const tokNewCashier = auth.generateDevToken({
      uid: newStaffUid,
      email: 'caixa.blocked@store.com',
      role: 'CASHIER',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      tokenVersion: 1,
    });
    const meBlockedResp = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${tokNewCashier}` },
    });
    const meBlockedJson: any = await meBlockedResp.json();

    const updateBlockedResp = await fetch(`${baseUrl}/api/v1/store/staff/${newStaffUid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwner}` },
      body: JSON.stringify({ blockedApps: ['finance'] }),
    });
    const updateBlockedJson: any = await updateBlockedResp.json();

    const [blockedCourierStaff, blockedSuperStaff, storeRegDevResp] = await Promise.all([
      fetch(`${baseUrl}/api/v1/store/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwner}` },
        body: JSON.stringify({
          name: 'Motoboy Indevido',
          email: 'motoboy.indevido@store.com',
          password: 'StaffPassword!2026',
          role: 'COURIER',
          storeId: 'store-1',
        }),
      }),
      fetch(`${baseUrl}/api/v1/store/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwner}` },
        body: JSON.stringify({
          name: 'Super Admin Indevido',
          email: 'super.indevido@store.com',
          password: 'StaffPassword!2026',
          role: 'SUPER_ADMIN',
          storeId: 'store-1',
        }),
      }),
      fetch(`${baseUrl}/api/v1/store/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwner}` },
        body: JSON.stringify({ storeId: 'store-1', name: 'POS Balcão Loja', type: 'POS' }),
      }),
    ]);
    const storeRegDevJson: any = await storeRegDevResp.json();
    const storeDev = storeRegDevJson?.device;

    const storePairDevResp = await fetch(`${baseUrl}/api/v1/store/devices/${storeDev.id}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwner}` },
      body: JSON.stringify({ pairingCode: storeDev.pairingCode }),
    });
    const storeRevokeDevResp = await fetch(`${baseUrl}/api/v1/store/devices/${storeDev.id}/revoke-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwner}` },
      body: JSON.stringify({}),
    });

    const edgeCorsResp = await fetch(`${edgeUrl}/api/v1/commerce/orders`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'tauri://localhost',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization, X-3C-Contract-Version, Idempotency-Key',
      },
    });
    const edgeAllowOrigin = edgeCorsResp.headers.get('access-control-allow-origin') || '';
    const edgeAllowHeaders = edgeCorsResp.headers.get('access-control-allow-headers') || '';

    check(
      createCashierResp.status === 201 &&
        meBlockedResp.status === 200 &&
        Array.isArray(meBlockedJson?.blockedApps) &&
        meBlockedJson.blockedApps.includes('finance') &&
        meBlockedJson.blockedApps.includes('kds') &&
        updateBlockedResp.status === 200 &&
        Array.isArray(updateBlockedJson?.user?.blockedApps) &&
        updateBlockedJson.user.blockedApps.length === 1 &&
        blockedCourierStaff.status === 403 &&
        blockedSuperStaff.status === 403 &&
        storeRegDevResp.status === 200 &&
        storePairDevResp.status === 200 &&
        storeRevokeDevResp.status === 200 &&
        edgeAllowOrigin === 'tauri://localhost' &&
        edgeAllowHeaders.includes('X-3C-Contract-Version') &&
        edgeAllowHeaders.includes('Idempotency-Key'),
      '14. Store OS gerencia staff (/store/staff com blockedApps, bloqueia COURIER/SUPER_ADMIN), dispositivos (/store/devices) e CORS no Edge Node',
      `create=${createCashierResp.status}, meBlocked=${JSON.stringify(meBlockedJson?.blockedApps)}, upd=${updateBlockedResp.status}, blkRoles=${blockedCourierStaff.status}/${blockedSuperStaff.status}, dev=${storeRegDevResp.status}/${storePairDevResp.status}/${storeRevokeDevResp.status}, cors=${edgeCorsResp.status}/${edgeAllowOrigin}`
    );

    // =========================================================================
    // 15. EDGE NODE TENANT SUSPENSION ENFORCEMENT AFTER CLOUD BOOTSTRAP
    // =========================================================================
    await db.collection('users').doc('usr-dev-owner').set({
      uid: 'usr-dev-owner',
      id: 'usr-dev-owner',
      email: 'dev@3ccorp.com',
      name: 'Dev Owner',
      role: 'DEV_OWNER',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      tokenVersion: 1,
    });
    const tokDev = auth.generateDevToken({ uid: 'usr-dev-owner', email: 'dev@3ccorp.com', role: 'DEV_OWNER', tenantId: 'tenant-1', tokenVersion: 1 });
    await db.collection('tenants').doc('tenant-1').update({ status: 'SUSPENDED' });
    await edgeRuntime.bootstrapFromCloud(baseUrl, tokDev);
    const edgeSuspendedCall = await fetch(`${edgeUrl}/api/v1/store/tables`, {
      headers: { Authorization: `Bearer ${tokMgr1}` },
    });

    check(
      edgeSuspendedCall.status === 403,
      '15. Edge Node recebe estado do tenant no bootstrap e bloqueia operação offline (403) quando tenant está SUSPENDED',
      `edgeSuspStatus=${edgeSuspendedCall.status}`
    );

    // =========================================================================
    // 16. WAITER BYOD PAIRING PIN (SERVER-BACKED, NO EMPTY-STORAGE BYPASS, SANITIZED PUBLIC STORE)
    // =========================================================================
    await db.collection('tenants').doc('tenant-1').update({ status: 'ACTIVE' });
    const tokWaiter1 = auth.generateDevToken({
      uid: 'usr-waiter-1',
      email: 'waiter1@store.com',
      role: 'WAITER',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      tokenVersion: 1,
    });

    const mgrReadPinRes = await fetch(`${baseUrl}/api/v1/store/store-1/waiter-pairing`, {
      headers: { Authorization: `Bearer ${tokMgr1}` },
    });
    const mgrReadPinJson: any = await mgrReadPinRes.json();
    const activePairingPin = String(mgrReadPinJson?.pin || '');

    const [pubStoresRes, pubStoreDetailRes, waiterReadPinRes] = await Promise.all([
      fetch(`${baseUrl}/api/v1/store/list`),
      fetch(`${baseUrl}/api/v1/store/store-1`),
      fetch(`${baseUrl}/api/v1/store/store-1/waiter-pairing`, {
        headers: { Authorization: `Bearer ${tokWaiter1}` },
      }),
    ]);
    const pubStoresJson: any = await pubStoresRes.json();
    const pubStoreDetailJson: any = await pubStoreDetailRes.json();
    const pubStore1 = Array.isArray(pubStoresJson) ? pubStoresJson.find((s: any) => s.id === 'store-1') : null;

    const wrongWaiterPinRes = await fetch(`${baseUrl}/api/v1/store/store-1/waiter-pairing/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokWaiter1}` },
      body: JSON.stringify({ pin: activePairingPin === '000-000' ? '111-111' : '000-000' }),
    });
    const validWaiterPinRes = await fetch(`${baseUrl}/api/v1/store/store-1/waiter-pairing/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokWaiter1}` },
      body: JSON.stringify({ pin: activePairingPin }),
    });
    const regenPinRes = await fetch(`${baseUrl}/api/v1/store/store-1/waiter-pairing/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
    });
    const regenPinJson: any = await regenPinRes.json();
    const newPairingPin = String(regenPinJson?.pin || '');
    const verifyNewPinRes = await fetch(`${baseUrl}/api/v1/store/store-1/waiter-pairing/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokWaiter1}` },
      body: JSON.stringify({ pin: newPairingPin }),
    });

    check(
      mgrReadPinRes.status === 200 &&
        /^\d{3}-\d{3}$/.test(activePairingPin) &&
        pubStore1?.waiterPairingPin === undefined &&
        pubStoreDetailJson?.waiterPairingPin === undefined &&
        waiterReadPinRes.status === 403 &&
        wrongWaiterPinRes.status === 401 &&
        validWaiterPinRes.status === 200 &&
        regenPinRes.status === 200 &&
        /^\d{3}-\d{3}$/.test(newPairingPin) &&
        verifyNewPinRes.status === 200,
      '16. Garçom BYOD: PIN 6 dígitos protegido no servidor, omitido do público, bloqueia leitura por WAITER (403), rejeita PIN inválido (401) e regenera com sucesso',
      `read=${mgrReadPinRes.status} (${activePairingPin}), waiterRead=${waiterReadPinRes.status}, wrong=${wrongWaiterPinRes.status}, ok=${validWaiterPinRes.status}, regen=${regenPinRes.status} (${newPairingPin}), newOk=${verifyNewPinRes.status}`
    );

    // =========================================================================
    // 17. TABLE_BILL ACCOUNTING INTEGRITY (WAITER ORDER + CONFIRM-PAYMENT)
    // =========================================================================
    const waiterTblOrderRes = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokWaiter1}` },
      body: JSON.stringify({
        storeId: 'store-1',
        channel: 'TABLE',
        tableNumber: 10,
        customerName: 'Mesa 10',
        paymentMethod: 'TABLE_BILL',
        items: [{ menuItemId: 'prd-burger-bom', quantity: 1 }],
      }),
    });
    const waiterTblOrderJson: any = await waiterTblOrderRes.json();
    const tableOrderId = waiterTblOrderJson?.transaction?.orderId;
    const finBeforeSettle = await db.collection('financial_records').doc(`fin-ord-${tableOrderId}`).get();
    const cashBeforeSettle = (await db.collection('cash_sessions').doc('cash-s1-open').get()).data();

    const settleTableRes = await fetch(`${baseUrl}/api/v1/commerce/orders/${tableOrderId}/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokWaiter1}` },
      body: JSON.stringify({ paymentMethod: 'PIX' }),
    });
    const settleTableJson: any = await settleTableRes.json();
    const settledOrderDoc = (await db.collection('orders').doc(tableOrderId).get()).data();
    const finAfterSettle = (await db.collection('financial_records').doc(`fin-ord-${tableOrderId}`).get()).data();
    const cashAfterSettle = (await db.collection('cash_sessions').doc('cash-s1-open').get()).data();

    check(
      waiterTblOrderRes.status === 201 &&
        waiterTblOrderJson?.transaction?.paymentStatus === 'PENDING' &&
        !finBeforeSettle.exists &&
        settleTableRes.status === 200 &&
        settleTableJson?.paymentStatus === 'PAID' &&
        settleTableJson?.paymentMethod === 'PIX' &&
        settledOrderDoc?.paymentStatus === 'PAID' &&
        finAfterSettle?.type === 'RECEIVABLE' &&
        finAfterSettle?.status === 'PAID' &&
        Number(cashAfterSettle?.totalSales) > Number(cashBeforeSettle?.totalSales || 0),
      '17. Comanda TABLE_BILL inicia PENDING sem duplicar caixa e liquida RECEIVABLE/PAID + caixa aberto via confirm-payment (inclusive pelo WAITER)',
      `ord=${waiterTblOrderRes.status}, finPre=${finBeforeSettle.exists}, settle=${settleTableRes.status}, finPost=${finAfterSettle?.status}`
    );

    // =========================================================================
    // 18. MULTI-BRANCH UNLOCK VS SINGLE-BRANCH LOCK + BLOCKED APPS GUARD
    // =========================================================================
    const existingTenant1Stores = (await db.collection('stores').get()).docs
      .map((d) => d.data())
      .filter((s) => s.tenantId === 'tenant-1' && !s._deleted).length;
    const unlockedBranchQuota = existingTenant1Stores + 2;
    await db.collection('tenants').doc('tenant-1').update({ maxAllowedBranches: unlockedBranchQuota });
    await db.collection('stores').doc('store-1').update({ maxAllowedBranches: unlockedBranchQuota });
    await db.collection('users').doc('usr-owner-multi').set({
      uid: 'usr-owner-multi',
      id: 'usr-owner-multi',
      email: 'multi@store.com',
      name: 'Dono Multi-Filial',
      role: 'STORE_OWNER',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      allowedStoreIds: ['store-1'],
      status: 'ACTIVE',
      tokenVersion: 1,
    });
    const tokMultiOwner = auth.generateDevToken({
      uid: 'usr-owner-multi',
      email: 'multi@store.com',
      role: 'STORE_OWNER',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      allowedStoreIds: ['store-1'],
      tokenVersion: 1,
    });
    const createBranchRes = await fetch(`${baseUrl}/api/v1/store/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMultiOwner}` },
      body: JSON.stringify({
        id: 'store-branch-unlock',
        name: 'Filial Nova Multi',
        slug: 'filial-nova-multi',
        category: 'RESTAURANT',
        parentStoreId: 'store-1',
        branchLabel: 'Filial 3',
      }),
    });
    const createBranchJson: any = await createBranchRes.json().catch(() => ({}));
    const refreshedMultiUser = (await db.collection('users').doc('usr-owner-multi').get()).data();
    const [multiTablePost, lockedOwnerCrossTables] = await Promise.all([
      fetch(`${baseUrl}/api/v1/store/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMultiOwner}` },
        body: JSON.stringify({ storeId: 'store-branch-unlock', tableNumber: 3, capacity: 4 }),
      }),
      fetch(`${baseUrl}/api/v1/store/tables?storeId=store-2`, {
        headers: { Authorization: `Bearer ${tokBranchOwner}` },
      }),
    ]);
    const multiTableJson: any = await multiTablePost.json().catch(() => ({}));
    const blockedPosUiCheck = isAppAllowedForRole('pdv', 'CASHIER', ['pdv']);

    check(
      createBranchRes.status === 200 &&
        Array.isArray(refreshedMultiUser?.allowedStoreIds) &&
        refreshedMultiUser.allowedStoreIds.includes('store-branch-unlock') &&
        multiTablePost.status === 200 &&
        multiTableJson?.table?.storeId === 'store-branch-unlock' &&
        lockedOwnerCrossTables.status === 403 &&
        blockedPosUiCheck === false,
      '18. STORE_OWNER multi-filial recebe acesso imediato à nova filial sem quebrar bloqueio 403 de usr-owner-branch1 e blockedApps barra app na UI',
      `save=${createBranchRes.status} (${createBranchJson?.error || ''}), allowed=${JSON.stringify(refreshedMultiUser?.allowedStoreIds)}, tbl=${multiTablePost.status}/${multiTableJson?.table?.storeId}, locked403=${lockedOwnerCrossTables.status}, uiBlk=${blockedPosUiCheck}`
    );

    // =========================================================================
    // 19. VARIANT DELTAS SYNC RECONCILE + EDGE NODE FULL PARITY (MENU, TABLES, INV, CONFIRM-PAYMENT, CANCEL)
    // =========================================================================
    const preSyncItem = (await db.collection('menu_items').doc('prd-burger-bom').get()).data();
    const preTriploVar = (preSyncItem?.variants || []).find((v: any) => v.id === 'var-triplo');
    const variantPushRes = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
      body: JSON.stringify({
        nodeId: 'web_var_delta_test',
        storeId: 'store-1',
        mutations: [
          {
            idempotencyKey: `idm-vardelta-${Date.now()}`,
            entity: 'menu_items',
            entityId: 'prd-burger-bom',
            operation: 'UPSERT',
            deltaQty: -2,
            variantDeltas: [{ variantId: 'var-triplo', deltaQty: -2 }],
            payload: { id: 'prd-burger-bom' },
          },
        ],
      }),
    });
    const postSyncItem = (await db.collection('menu_items').doc('prd-burger-bom').get()).data();
    const postTriploVar = (postSyncItem?.variants || []).find((v: any) => v.id === 'var-triplo');

    await edgeRuntime.bootstrapFromCloud(baseUrl, tokDev);
    const [edgeMenuPost, edgeTablePost, edgeInvBatchPost, edgeWaiterPinGet] = await Promise.all([
      fetch(`${edgeUrl}/api/v1/store/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
        body: JSON.stringify({
          id: 'prd-edge-parity',
          name: 'Produto Edge Paridade',
          price: 25,
          stock: 5,
          variants: [{ id: 'var-p', label: 'P', stock: 5 }],
          isAvailable: true,
        }),
      }),
      fetch(`${edgeUrl}/api/v1/store/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
        body: JSON.stringify({ id: 'tbl-edge-parity', tableNumber: 99, capacity: 2 }),
      }),
      fetch(`${edgeUrl}/api/v1/store/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
        body: JSON.stringify({
          id: 'bat-edge-full',
          itemId: 'prd-edge-parity',
          itemName: 'Produto Edge Paridade',
          sku: 'SKU-EDGE-PARITY',
          batchNumber: 'LOT-001',
          quantity: 12,
          costPrice: 10,
          status: 'ACTIVE',
        }),
      }),
      fetch(`${edgeUrl}/api/v1/store/store-1/waiter-pairing`, {
        headers: { Authorization: `Bearer ${tokMgr1}` },
      }),
    ]);

    const edgeTableOrdRes = await fetch(`${edgeUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokWaiter1}` },
      body: JSON.stringify({
        storeId: 'store-1',
        channel: 'TABLE',
        tableNumber: 99,
        paymentMethod: 'TABLE_BILL',
        items: [{ menuItemId: 'prd-edge-parity', variantId: 'var-p', variantLabel: 'P', quantity: 2 }],
      }),
    });
    const edgeTableOrdJson: any = await edgeTableOrdRes.json();
    const edgeParityOrdId = edgeTableOrdJson?.transaction?.orderId;

    const edgeSettleRes = await fetch(`${edgeUrl}/api/v1/commerce/orders/${edgeParityOrdId}/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokWaiter1}` },
      body: JSON.stringify({ paymentMethod: 'CASH' }),
    });

    const edgeCancelOrdRes = await fetch(`${edgeUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({
        storeId: 'store-1',
        channel: 'POS',
        paymentMethod: 'PIX',
        items: [{ menuItemId: 'prd-edge-parity', variantId: 'var-p', variantLabel: 'P', quantity: 1 }],
      }),
    });
    const edgeCancelOrdJson: any = await edgeCancelOrdRes.json();
    const edgeCancelId = edgeCancelOrdJson?.transaction?.orderId;
    const edgeCancelExecRes = await fetch(`${edgeUrl}/api/v1/commerce/orders/${edgeCancelId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({ reason: 'Desistência cliente balcão Edge' }),
    });
    const edgeItemAfterCancel = await edgeRuntime.driver.getDoc('menu_items', 'prd-edge-parity');
    const edgeVarAfterCancel = (edgeItemAfterCancel?.variants || []).find((v: any) => v.id === 'var-p');

    check(
      variantPushRes.status === 200 &&
        postSyncItem?.stock === (preSyncItem?.stock || 0) - 2 &&
        postTriploVar?.stock === (preTriploVar?.stock || 0) - 2 &&
        edgeMenuPost.status === 200 &&
        edgeTablePost.status === 200 &&
        edgeInvBatchPost.status === 200 &&
        edgeWaiterPinGet.status === 200 &&
        edgeTableOrdRes.status === 201 &&
        edgeTableOrdJson?.transaction?.paymentStatus === 'PENDING' &&
        edgeSettleRes.status === 200 &&
        edgeCancelOrdRes.status === 201 &&
        edgeCancelExecRes.status === 200 &&
        edgeItemAfterCancel?.stock === 3 &&
        edgeVarAfterCancel?.stock === 3,
      '19. Sync /push reconcilia variantDeltas atomicamente e Edge Node executa paridade total (menu, mesas, lote full, pairing, confirm-payment e cancel com estorno de variação)',
      `varPush=${variantPushRes.status} (${preTriploVar?.stock}->${postTriploVar?.stock}), edgeCrud=${edgeMenuPost.status}/${edgeTablePost.status}/${edgeInvBatchPost.status}/${edgeWaiterPinGet.status}, settle=${edgeSettleRes.status}, cancel=${edgeCancelExecRes.status}, stockAfter=${edgeItemAfterCancel?.stock}/${edgeVarAfterCancel?.stock}`
    );

    // =========================================================================
    // 20. KDS & SALÃO STATE MACHINE INTEGRITY: PENDING -> IN_PREPARATION & CONFIRMED -> READY_FOR_PICKUP
    // =========================================================================
    const kdsPendingOrderRes = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokWaiter1}` },
      body: JSON.stringify({
        storeId: 'store-1',
        channel: 'TABLE',
        tableNumber: 10,
        customerName: 'Mesa 10 KDS Teste',
        paymentMethod: 'TABLE_BILL',
        items: [{ menuItemId: 'prd-burger-bom', quantity: 1 }],
      }),
    });
    const kdsPendingJson: any = await kdsPendingOrderRes.json();
    const kdsOrderId = kdsPendingJson?.transaction?.orderId;

    // Kitchen clicks PREPARAR directly on PENDING ticket
    const prepareDirectRes = await fetch(`${baseUrl}/api/v1/commerce/orders/${kdsOrderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
      body: JSON.stringify({ status: 'IN_PREPARATION' }),
    });

    // Kitchen clicks PRONTO on item in preparation -> READY_FOR_PICKUP
    const readyDirectRes = await fetch(`${baseUrl}/api/v1/commerce/orders/${kdsOrderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
      body: JSON.stringify({ status: 'READY_FOR_PICKUP' }),
    });

    // Fast order: from CONFIRMED straight to READY_FOR_PICKUP
    const fastOrderRes = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({
        storeId: 'store-1',
        channel: 'POS',
        customerName: 'Bebida Balcão',
        paymentMethod: 'CASH',
        items: [{ menuItemId: 'prd-burger-bom', quantity: 1 }],
      }),
    });
    const fastOrderJson: any = await fastOrderRes.json();
    const fastOrderId = fastOrderJson?.transaction?.orderId;

    const fastReadyRes = await fetch(`${baseUrl}/api/v1/commerce/orders/${fastOrderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
      body: JSON.stringify({ status: 'READY_FOR_PICKUP' }),
    });

    check(
      kdsPendingOrderRes.status === 201 &&
        kdsPendingJson?.transaction?.status === 'PENDING' &&
        prepareDirectRes.status === 200 &&
        readyDirectRes.status === 200 &&
        fastOrderRes.status === 201 &&
        fastOrderJson?.transaction?.status === 'CONFIRMED' &&
        fastReadyRes.status === 200,
      '20. KDS & Salão: Transições ágeis PENDING -> IN_PREPARATION e CONFIRMED -> READY_FOR_PICKUP respeitam FSM do pedido sem erro 400',
      `pend=${kdsPendingOrderRes.status}, prep=${prepareDirectRes.status}, rdy=${readyDirectRes.status}, fastOrd=${fastOrderRes.status}, fastRdy=${fastReadyRes.status}`
    );

    // =========================================================================
    // 21. STORE OS REMEDIATION: RESERVATION RBAC/CROSS-STORE, FISCAL EMIT CASHIER + DB, INVENTORY KITCHEN & SUPPLIERS DELETE
    // =========================================================================
    await db.collection('users').doc('usr-courier-test').set({
      uid: 'usr-courier-test',
      id: 'usr-courier-test',
      email: 'courier@test.com',
      role: 'COURIER',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      tokenVersion: 1,
    });
    await db.collection('users').doc('usr-mgr-2').set({
      uid: 'usr-mgr-2',
      id: 'usr-mgr-2',
      email: 'mgr2@store.com',
      role: 'STORE_MANAGER',
      tenantId: 'tenant-1',
      storeId: 'store-2',
      status: 'ACTIVE',
      tokenVersion: 1,
    });

    const { generateEmvCoPixPayload } = await import('../../packages/commerce-engine/src/pix.ts');
    const tokKitchen1 = auth.generateDevToken({ uid: 'usr-kitchen-1', email: 'kitchen1@store.com', role: 'KITCHEN_STAFF', tenantId: 'tenant-1', storeId: 'store-1', tokenVersion: 1 });
    const tokCourier = auth.generateDevToken({ uid: 'usr-courier-test', email: 'courier@test.com', role: 'COURIER', tenantId: 'tenant-1', tokenVersion: 1 });
    const tokMgr2 = auth.generateDevToken({ uid: 'usr-mgr-2', email: 'mgr2@store.com', role: 'STORE_MANAGER', tenantId: 'tenant-1', storeId: 'store-2', tokenVersion: 1 });

    // A. Reservation DELETE: Cross-Store & Role Guards
    await db.collection('reservations').doc('res-guard-test').set({
      id: 'res-guard-test',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      customerName: 'Cliente Protegido',
      tableNumber: 10,
      dateTime: '2026-12-30T19:00:00.000Z',
    });

    const [delResCourier, delResCrossMgr] = await Promise.all([
      fetch(`${baseUrl}/api/v1/store/reservations/res-guard-test`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokCourier}` },
      }),
      fetch(`${baseUrl}/api/v1/store/reservations/res-guard-test`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokMgr2}` },
      }),
    ]);
    const delResOk = await fetch(`${baseUrl}/api/v1/store/reservations/res-guard-test`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokMgr1}` },
    });

    // B. Fiscal Emit with CASHIER & Database Persistence
    const fiscalCashierResp = await fetch(`${baseUrl}/api/v1/store/fiscal/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({ storeId: 'store-1', amount: 99.50, itemsCount: 3 }),
    });
    const fiscalJson: any = await fiscalCashierResp.json();
    const fiscalDoc = fiscalJson?.chNFe ? await db.collection('fiscal_notes').doc(fiscalJson.chNFe).get() : null;

    // C. Inventory POST by KITCHEN_STAFF
    const invKitchenResp = await fetch(`${baseUrl}/api/v1/store/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokKitchen1}` },
      body: JSON.stringify({ id: 'batch-kitchen-test', storeId: 'store-1', sku: 'SKU-KITCHEN', name: 'Tempero Especial', quantity: 15, costPrice: 10 }),
    });

    // D. Suppliers DELETE: Cross-Store & Authorized Deletion
    await db.collection('suppliers').doc('sup-guard-test').set({
      id: 'sup-guard-test',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      name: 'Distribuidora Carnes',
    });

    const delSupCross = await fetch(`${baseUrl}/api/v1/store/suppliers/sup-guard-test`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokMgr2}` },
    });
    const delSupOk = await fetch(`${baseUrl}/api/v1/store/suppliers/sup-guard-test`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokMgr1}` },
    });
    const supAfterDel = await db.collection('suppliers').doc('sup-guard-test').get();

    // E. BACEN EMVCo BR Code (PIX) Generator Verification
    const pixPayload = generateEmvCoPixPayload({
      pixKey: 'lojista@3ccorp.com.br',
      merchantName: 'Burger Matriz',
      merchantCity: 'LONDRINA',
      amount: 45.90,
      txId: 'PED12345',
    });
    const isValidEmvCoPix =
      pixPayload.startsWith('000201') &&
      pixPayload.includes('0014br.gov.bcb.pix') &&
      pixPayload.includes('lojista@3ccorp.com.br') &&
      pixPayload.includes('540545.90') &&
      pixPayload.includes('5802BR') &&
      pixPayload.includes('5913BURGER MATRIZ') &&
      pixPayload.includes('6008LONDRINA') &&
      pixPayload.includes('62120508PED12345') &&
      pixPayload.includes('6304') &&
      pixPayload.length >= 100;

    check(
      delResCourier.status === 403 &&
        delResCrossMgr.status === 403 &&
        delResOk.status === 200 &&
        fiscalCashierResp.status === 200 &&
        fiscalDoc !== null &&
        fiscalDoc.exists &&
        fiscalDoc.data()?.amount === 99.50 &&
        invKitchenResp.status === 200 &&
        delSupCross.status === 403 &&
        delSupOk.status === 200 &&
        !supAfterDel.exists &&
        isValidEmvCoPix,
      '21. Store OS Remediation: DELETE /reservations/:id isola filiais e RBAC (403), fiscal emite com CASHIER e grava em fiscal_notes, inventário aceita KITCHEN_STAFF, DELETE /suppliers/:id funciona com isolamento e gerador PIX EMVCo produz payload BACEN válido',
      `resCourier=${delResCourier.status}, resCross=${delResCrossMgr.status}, resOk=${delResOk.status}, fiscCashier=${fiscalCashierResp.status}, fiscDocExists=${fiscalDoc?.exists}, invKitchen=${invKitchenResp.status}, supCross=${delSupCross.status}, supOk=${delSupOk.status}, supDeleted=${!supAfterDel.exists}, pixLen=${pixPayload.length}`
    );

    // =========================================================================
    // 22. GARÇOM: LOGIN INDIVIDUAL DA LISTA DA LOJA + PDQ/DISPOSITIVO DA LOJA + QR/PIN SALÃO
    // =========================================================================
    await db.collection('tenants').doc('tenant-1').update({ maxAllowedDevices: 25 });
    await db.collection('stores').doc('store-1').update({ maxAllowedDevices: 25 });

    // A. Waiter individual account provisioned by Store Manager & login via /auth/login
    const staffWaiterRes = await fetch(`${baseUrl}/api/v1/store/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
      body: JSON.stringify({
        name: 'Garçom Individual Lista',
        email: 'garcom.individual@store.com',
        password: 'Garcom@2026',
        role: 'WAITER',
        storeId: 'store-1',
      }),
    });
    const waiterLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'garcom.individual@store.com',
        password: 'Garcom@2026',
      }),
    });
    const waiterLoginJson: any = await waiterLoginRes.json();
    const individualWaiterToken = waiterLoginJson?.token;
    const [indWaiterTables1, indWaiterTables2, indWaiterStaffBlock] = await Promise.all([
      fetch(`${baseUrl}/api/v1/store/tables?storeId=store-1`, {
        headers: { Authorization: `Bearer ${individualWaiterToken}` },
      }),
      fetch(`${baseUrl}/api/v1/store/tables?storeId=store-2`, {
        headers: { Authorization: `Bearer ${individualWaiterToken}` },
      }),
      fetch(`${baseUrl}/api/v1/store/staff?storeId=store-1`, {
        headers: { Authorization: `Bearer ${individualWaiterToken}` },
      }),
    ]);

    // B. Store-owned PDQ / Tablet device pairing login (/store/devices/pair-login)
    const [regTabletRes, regPrinterRes] = await Promise.all([
      fetch(`${baseUrl}/api/v1/store/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
        body: JSON.stringify({
          id: 'dev-pdq-waiter-1',
          deviceId: 'TAB-PDQ-01',
          name: 'PDQ Garçom Salão 01',
          type: 'WAITER_TABLET',
          storeId: 'store-1',
        }),
      }),
      fetch(`${baseUrl}/api/v1/store/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgr1}` },
        body: JSON.stringify({
          id: 'dev-printer-block-1',
          deviceId: 'IMP-PDQ-01',
          name: 'Impressora Balcão',
          type: 'PRINTER_80MM',
          storeId: 'store-1',
        }),
      }),
    ]);
    const regTabletJson: any = await regTabletRes.json();
    const regPrinterJson: any = await regPrinterRes.json();

    const printerLoginAttempt = await fetch(`${baseUrl}/api/v1/store/devices/pair-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceIdentifier: 'IMP-PDQ-01',
        pairingCode: regPrinterJson?.device?.pairingCode || '3C-00000000',
      }),
    });
    const pdqWrongCodeRes = await fetch(`${baseUrl}/api/v1/store/devices/pair-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceIdentifier: 'TAB-PDQ-01',
        pairingCode: '3C-ERRADO99',
      }),
    });
    const pdqOkRes = await fetch(`${baseUrl}/api/v1/store/devices/pair-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceIdentifier: 'TAB-PDQ-01',
        pairingCode: regTabletJson?.device?.pairingCode,
        operatorName: 'Garçom PDQ Noite',
      }),
    });
    const pdqOkJson: any = await pdqOkRes.json();
    const pdqToken = pdqOkJson?.token;
    const [pdqMeRes, pdqTables1, pdqTables2, pdqStaffBlock] = await Promise.all([
      fetch(`${baseUrl}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${pdqToken}` } }),
      fetch(`${baseUrl}/api/v1/store/tables?storeId=store-1`, { headers: { Authorization: `Bearer ${pdqToken}` } }),
      fetch(`${baseUrl}/api/v1/store/tables?storeId=store-2`, { headers: { Authorization: `Bearer ${pdqToken}` } }),
      fetch(`${baseUrl}/api/v1/store/staff?storeId=store-1`, { headers: { Authorization: `Bearer ${pdqToken}` } }),
    ]);

    const pdqRevokeRes = await fetch(`${baseUrl}/api/v1/store/devices/dev-pdq-waiter-1/revoke-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokMgr1}` },
    });
    const pdqAfterRevokeMe = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${pdqToken}` },
    });

    // C. Salon QR / PIN login (/store/waiter-pairing/login) + disconnect + lockout reset on regenerate
    const regenPinForLoginRes = await fetch(`${baseUrl}/api/v1/store/store-1/waiter-pairing/regenerate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokMgr1}` },
    });
    const regenPinForLoginJson: any = await regenPinForLoginRes.json();
    const validSalonPin = regenPinForLoginJson?.pin;

    const pinWrongRes = await fetch(`${baseUrl}/api/v1/store/waiter-pairing/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: 'store-1', pin: '000-000' }),
    });
    const pinQrOkRes = await fetch(`${baseUrl}/api/v1/store/waiter-pairing/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qrPayload: JSON.stringify({ storeId: 'store-1', pin: validSalonPin }),
        operatorName: 'Garçom QR Turno',
      }),
    });
    const pinQrOkJson: any = await pinQrOkRes.json();
    const pinToken = pinQrOkJson?.token;
    const [pinMeBefore, pinTables1, pinTables2] = await Promise.all([
      fetch(`${baseUrl}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${pinToken}` } }),
      fetch(`${baseUrl}/api/v1/store/tables?storeId=store-1`, { headers: { Authorization: `Bearer ${pinToken}` } }),
      fetch(`${baseUrl}/api/v1/store/tables?storeId=store-2`, { headers: { Authorization: `Bearer ${pinToken}` } }),
    ]);
    const pinDisconnectRes = await fetch(`${baseUrl}/api/v1/store/waiter-pairing/disconnect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pinToken}` },
    });
    const pinMeAfterDisconnect = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${pinToken}` },
    });

    // Lockout after 5 wrong attempts, cleared upon regenerate
    let lockStatus = 0;
    for (let i = 0; i < 5; i++) {
      const att = await fetch(`${baseUrl}/api/v1/store/waiter-pairing/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: 'burger-matriz-store-os', pin: '999-999' }),
      });
      lockStatus = att.status;
    }
    const afterRegenPinJson: any = await (
      await fetch(`${baseUrl}/api/v1/store/store-1/waiter-pairing/regenerate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokMgr1}` },
      })
    ).json();
    const pinAfterRegenOkRes = await fetch(`${baseUrl}/api/v1/store/waiter-pairing/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: 'burger-matriz-store-os', pin: afterRegenPinJson?.pin }),
    });

    check(
      staffWaiterRes.status === 201 &&
        waiterLoginRes.status === 200 &&
        waiterLoginJson?.user?.role === 'WAITER' &&
        indWaiterTables1.status === 200 &&
        indWaiterTables2.status === 403 &&
        indWaiterStaffBlock.status === 403 &&
        regTabletRes.status === 200 &&
        printerLoginAttempt.status === 403 &&
        pdqWrongCodeRes.status === 401 &&
        pdqOkRes.status === 200 &&
        pdqOkJson?.user?.authProvider === 'STORE_DEVICE_PDQ' &&
        pdqMeRes.status === 200 &&
        pdqTables1.status === 200 &&
        pdqTables2.status === 403 &&
        pdqStaffBlock.status === 403 &&
        pdqRevokeRes.status === 200 &&
        pdqAfterRevokeMe.status === 401 &&
        pinWrongRes.status === 401 &&
        pinQrOkRes.status === 200 &&
        pinQrOkJson?.user?.authProvider === 'WAITER_PIN_TERMINAL' &&
        pinMeBefore.status === 200 &&
        pinTables1.status === 200 &&
        pinTables2.status === 403 &&
        pinDisconnectRes.status === 200 &&
        pinMeAfterDisconnect.status === 401 &&
        lockStatus === 429 &&
        pinAfterRegenOkRes.status === 200,
      '22. Garçom suporta login individual da equipe, PDQ/Tablet próprio da loja com revogação imediata e QR/PIN do salão com lockout',
      `ind=${staffWaiterRes.status}/${waiterLoginRes.status}/${indWaiterTables1.status}/${indWaiterTables2.status}/${indWaiterStaffBlock.status}, pdq=${printerLoginAttempt.status}/${pdqWrongCodeRes.status}/${pdqOkRes.status}/${pdqMeRes.status}/${pdqTables1.status}/${pdqTables2.status}/${pdqStaffBlock.status}/rev=${pdqAfterRevokeMe.status}, pin=${pinWrongRes.status}/${pinQrOkRes.status}/${pinMeBefore.status}/${pinTables1.status}/${pinTables2.status}/disc=${pinMeAfterDisconnect.status}/lock=${lockStatus}/regenOk=${pinAfterRegenOkRes.status}`
    );

    // =========================================================================
    // 23. REGRESSION CHECKS: EDGE WAITER_DEVICE PARITY, INVALID VARIANT_ID, _DELETED BOM BATCH & COUPON EXPIRY
    // =========================================================================
    const { evaluateCheckoutCoupon } = await import('../../src/modules/marketplace/checkout/couponPricing.ts');
    const pinAfterRegenJson: any = await pinAfterRegenOkRes.json();
    const edgeWaiterPinTok = pinAfterRegenJson?.token;
    await edgeRuntime.bootstrapFromCloud(baseUrl, tokOwner);

    const [edgeWaiterTablesRes, edgeBadBillRes, cloudInvalidVarRes] = await Promise.all([
      fetch(`${edgeUrl}/api/v1/store/tables?storeId=store-1`, {
        headers: { Authorization: `Bearer ${edgeWaiterPinTok}` },
      }),
      fetch(`${edgeUrl}/api/v1/store/tables/request-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${edgeWaiterPinTok}` },
        body: JSON.stringify({ storeId: 'store-1', tableNumber: -2 }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
        body: JSON.stringify({
          storeId: 'store-1',
          channel: 'POS',
          paymentMethod: 'CASH',
          items: [{ menuItemId: 'prd-burger-bom', variantId: 'var-inexistente', quantity: 1 }],
        }),
      }),
    ]);

    await db.collection('menu_items').doc('prd-deleted-batch-test').set({
      id: 'prd-deleted-batch-test',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      name: 'Prato Insumo Excluído',
      price: 25,
      stock: 10,
      isAvailable: true,
      recipe: [{ ingredientId: 'SKU-SOFTDEL', ingredientName: 'Insumo Apagado', quantityRequired: 1 }],
    });
    await db.collection('inventory_batches').doc('bat-softdel-1').set({
      id: 'bat-softdel-1',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      sku: 'SKU-SOFTDEL',
      name: 'Lote Soft Deleted',
      quantity: 50,
      _deleted: true,
    });
    const deletedBatchOrdRes = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({
        storeId: 'store-1',
        channel: 'POS',
        paymentMethod: 'CASH',
        items: [{ menuItemId: 'prd-deleted-batch-test', quantity: 1 }],
      }),
    });

    const expiredCpn = evaluateCheckoutCoupon({
      coupons: [{ id: 'c1', code: 'EXP10', discountType: 'PERCENT', discountValue: 10, isActive: true, validUntil: '', expiresAt: '2020-01-01T00:00:00Z' } as any],
      couponCode: 'EXP10',
      storeId: 'store-1',
      cartTotal: 100,
    });
    const badDateCpn = evaluateCheckoutCoupon({
      coupons: [{ id: 'c2', code: 'BADDATE', discountType: 'FIXED', discountValue: 15, isActive: true, validUntil: 'data-invalida' } as any],
      couponCode: 'BADDATE',
      storeId: 'store-1',
      cartTotal: 100,
    });
    const okCpn = evaluateCheckoutCoupon({
      coupons: [{ id: 'c3', code: 'OK20', discountType: 'PERCENT', discountValue: 20, isActive: true, validUntil: '2099-01-01T00:00:00Z' } as any],
      couponCode: 'ok20',
      storeId: 'store-1',
      cartTotal: 100,
    });

    const putOpsPixRes = await fetch(`${baseUrl}/api/v1/store/store-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwner}` },
      body: JSON.stringify({
        operationalSettings: { pixKey: 'pix.lojista@loja1.com', serviceFee10: true },
      }),
    });
    const pubPayInfoRes = await fetch(`${baseUrl}/api/v1/store/payment-public-info/store-1`);
    const pubPayInfoBody = await pubPayInfoRes.json();

    const edgeCreateSupRes = await fetch(`${edgeUrl}/api/v1/store/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwner}` },
      body: JSON.stringify({ id: 'sup-edge-del-1', companyName: 'Fornecedor Edge Delete', cnpj: '11.111.111/0001-11' }),
    });
    const edgeDelSupRes = await fetch(`${edgeUrl}/api/v1/store/suppliers/sup-edge-del-1`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokOwner}` },
    });
    const edgeListSupRes = await fetch(`${edgeUrl}/api/v1/store/suppliers`, {
      headers: { Authorization: `Bearer ${tokOwner}` },
    });
    const edgeSuppliersAfterDel = await edgeListSupRes.json();

    const edgeCreatePeriphRes = await fetch(`${edgeUrl}/api/v1/store/peripherals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwner}` },
      body: JSON.stringify({
        id: 'periph-edge-1',
        name: 'Impressora Caixa Edge',
        kind: 'PRINTER',
        station: 'CASHIER',
        connectionType: 'LAN_RAW_9100',
        host: '192.168.1.210',
        port: 9100,
        paperWidthMm: 80,
        isDefault: true,
      }),
    });
    const edgeHeartbeatRes = await fetch(`${edgeUrl}/api/v1/store/peripherals/periph-edge-1/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({ status: 'ONLINE' }),
    });
    const edgePrintJobRes = await fetch(`${edgeUrl}/api/v1/store/print-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({ station: 'CASHIER', content: 'TESTE EDGE ESC/POS' }),
    });
    const edgePrintJobBody = await edgePrintJobRes.json();
    const edgeAckJobRes = await fetch(`${edgeUrl}/api/v1/store/print-jobs/${edgePrintJobBody.job?.id}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCashier1}` },
      body: JSON.stringify({ status: 'PRINTED' }),
    });

    check(
      edgeWaiterTablesRes.status === 200 &&
        edgeBadBillRes.status === 400 &&
        cloudInvalidVarRes.status === 400 &&
        deletedBatchOrdRes.status === 400 &&
        expiredCpn.isInvalid === true &&
        expiredCpn.discount === 0 &&
        badDateCpn.isInvalid === true &&
        okCpn.isInvalid === false &&
        okCpn.discount === 20 &&
        putOpsPixRes.status === 200 &&
        pubPayInfoRes.status === 200 &&
        pubPayInfoBody.pixKey === 'pix.lojista@loja1.com' &&
        pubPayInfoBody.acceptsPix === true &&
        edgeCreateSupRes.status === 200 &&
        edgeDelSupRes.status === 200 &&
        Array.isArray(edgeSuppliersAfterDel) &&
        !edgeSuppliersAfterDel.some((s: any) => s.id === 'sup-edge-del-1') &&
        edgeCreatePeriphRes.status === 200 &&
        edgeHeartbeatRes.status === 200 &&
        edgePrintJobRes.status === 201 &&
        edgePrintJobBody.job?.peripheralId === 'periph-edge-1' &&
        edgeAckJobRes.status === 200,
      '23. Regressões & Paridade Lojista: Edge waiter_device (200), request-bill, variantId, lote _deleted, cupom, sync pixKey operacional e paridade Edge de fornecedores/periféricos/impressão',
      `edgeWaiter=${edgeWaiterTablesRes.status}, pix=${pubPayInfoBody.pixKey}, edgeSupDel=${edgeDelSupRes.status}, edgePeriph=${edgeCreatePeriphRes.status}/${edgeHeartbeatRes.status}/${edgePrintJobRes.status}/${edgeAckJobRes.status}`
    );
  } finally {
    if (edgeRuntime) {
      await edgeRuntime.close().catch(() => {});
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore temp cleanup
    }
  }

  console.log('\n======================================================================');
  console.log(`📊 RESULTADO STORE OS (ETAPA 2): ${passed}/${passed + failed} verificações aprovadas`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
