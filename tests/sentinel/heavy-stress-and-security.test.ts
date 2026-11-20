import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { EdgeNodeRuntime as EdgeNodeRuntimeType } from '../../servers/edge-node/index.ts';
import { generateIdempotencyKey } from '@3c/commerce-engine';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-sentinel-heavy-'));
process.env.NODE_ENV = 'test';
process.env.SERVER_SECRET = '3c_sentinel_heavy_isolated_secret_2026';
process.env.SERVER_SECRET_PATH = path.join(tempDir, '.server-secret');
process.env.SERVER_DB_PATH = path.join(tempDir, 'cloud-heavy-db.json');

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
  const { auth, db, hashPassword } = await import('../../src/server/config.ts');
  const { createServerCoreApp } = await import('../../src/server/app.ts');
  const { EdgeNodeRuntime } = await import('../../servers/edge-node/index.ts');

  console.log('======================================================================');
  console.log('⚡ 3C SENTINEL HEAVY — ESTRESSE CONCORRENTE, SEGURANÇA & EDGE WAL');
  console.log('======================================================================\n');

  const app = createServerCoreApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let edgeRuntime: EdgeNodeRuntimeType | null = null;
  let edgeRuntimeReopened: EdgeNodeRuntimeType | null = null;
  const edgeSqlitePath = path.join(tempDir, 'edge-heavy.sqlite');

  try {
    const devHash = hashPassword('SentinelDev#2026');
    const tenantActive = 'tnt_heavy_active';
    const tenantSuspended = 'tnt_heavy_suspended';
    const storeActive = 'str_heavy_active';
    const storeSuspended = 'str_heavy_susp';
    const storeQuota = 'str_heavy_quota';

    await db.collection('tenants').doc('tenant-1').set({ id: 'tenant-1', name: '3C Platform Root', status: 'ACTIVE' });
    await db.collection('tenants').doc(tenantActive).set({
      id: tenantActive,
      name: 'Heavy Active Group',
      status: 'ACTIVE',
      subscriptionPlan: 'FREE',
      maxAllowedBranches: 2,
      maxAllowedDevices: 2,
    });
    await db.collection('tenants').doc(tenantSuspended).set({
      id: tenantSuspended,
      name: 'Suspended Group',
      status: 'SUSPENDED',
    });

    await db.collection('stores').doc(storeActive).set({
      id: storeActive,
      tenantId: tenantActive,
      name: 'Burger Heavy Matriz',
      category: 'RESTAURANT',
      deliveryFee: 8,
      isOpen: true,
      status: 'ACTIVE',
      subscriptionPlan: 'FREE',
      maxAllowedBranches: 2,
      maxAllowedDevices: 2,
      waiterPairingPin: '4321',
      isParentStore: true,
    });
    await db.collection('stores').doc(storeQuota).set({
      id: storeQuota,
      tenantId: 'tnt_quota_race',
      name: 'Quota Race Store',
      category: 'RETAIL',
      deliveryFee: 0,
      isOpen: true,
      status: 'ACTIVE',
      subscriptionPlan: 'FREE',
      maxAllowedBranches: 2,
      maxAllowedDevices: 2,
      isParentStore: true,
    });
    await db.collection('tenants').doc('tnt_quota_race').set({
      id: 'tnt_quota_race',
      name: 'Quota Race Group',
      status: 'ACTIVE',
      maxAllowedBranches: 2,
      maxAllowedDevices: 2,
    });
    await db.collection('stores').doc(storeSuspended).set({
      id: storeSuspended,
      tenantId: tenantSuspended,
      name: 'Suspended Store Hidden',
      category: 'RESTAURANT',
      deliveryFee: 5,
      isOpen: true,
      status: 'SUSPENDED',
    });

    const seedUsers = [
      {
        uid: 'usr_heavy_dev',
        email: 'dev-heavy@3c.local',
        name: 'DEV Master',
        role: 'DEV_OWNER',
        tenantId: 'tenant-1',
        status: 'ACTIVE',
        passwordHash: devHash,
        tokenVersion: 1,
      },
      {
        uid: 'usr_heavy_owner',
        email: 'owner-heavy@3c.local',
        name: 'Owner Heavy',
        role: 'STORE_OWNER',
        tenantId: tenantActive,
        status: 'ACTIVE',
        passwordHash: devHash,
        tokenVersion: 1,
      },
      {
        uid: 'usr_quota_owner',
        email: 'owner-quota@3c.local',
        name: 'Quota Owner',
        role: 'STORE_OWNER',
        tenantId: 'tnt_quota_race',
        status: 'ACTIVE',
        passwordHash: devHash,
        tokenVersion: 1,
      },
      {
        uid: 'usr_heavy_staff',
        email: 'staff-heavy@3c.local',
        name: 'Cashier Heavy',
        role: 'CASHIER',
        tenantId: tenantActive,
        storeId: storeActive,
        status: 'ACTIVE',
        passwordHash: devHash,
        tokenVersion: 1,
        blockedApps: [],
      },
      {
        uid: 'usr_heavy_courier_a',
        email: 'courier-a@3c.local',
        name: 'Courier Alpha',
        role: 'COURIER',
        tenantId: tenantActive,
        status: 'ACTIVE',
        passwordHash: devHash,
        tokenVersion: 1,
      },
      {
        uid: 'usr_heavy_courier_b',
        email: 'courier-b@3c.local',
        name: 'Courier Beta',
        role: 'COURIER',
        tenantId: tenantActive,
        status: 'ACTIVE',
        passwordHash: devHash,
        tokenVersion: 1,
      },
      {
        uid: 'usr_heavy_consumer',
        email: 'consumer-heavy@3c.local',
        name: 'Consumer Heavy',
        role: 'CONSUMER',
        tenantId: 'tenant-1',
        status: 'ACTIVE',
        passwordHash: devHash,
        tokenVersion: 1,
      },
    ];
    for (const u of seedUsers) {
      await db.collection('users').doc(u.uid).set(u);
    }

    const tok = (u: (typeof seedUsers)[number]) =>
      auth.generateDevToken({
        uid: u.uid,
        email: u.email,
        email_verified: true,
        name: u.name,
        role: u.role,
        tenantId: u.tenantId,
        storeId: (u as any).storeId,
        tokenVersion: u.tokenVersion,
      });

    const devToken = tok(seedUsers[0]);
    const ownerToken = tok(seedUsers[1]);
    const quotaOwnerToken = tok(seedUsers[2]);
    const staffToken = tok(seedUsers[3]);
    const courierAToken = tok(seedUsers[4]);
    const courierBToken = tok(seedUsers[5]);
    const consumerToken = tok(seedUsers[6]);

    // Seed driver profiles
    await db.collection('drivers').doc('usr_heavy_courier_a').set({
      id: 'usr_heavy_courier_a',
      uid: 'usr_heavy_courier_a',
      name: 'Courier Alpha',
      tenantId: tenantActive,
      storeId: storeActive,
      status: 'AVAILABLE',
      walletBalance: 100,
      totalDeliveries: 0,
    });
    await db.collection('drivers').doc('usr_heavy_courier_b').set({
      id: 'usr_heavy_courier_b',
      uid: 'usr_heavy_courier_b',
      name: 'Courier Beta',
      tenantId: tenantActive,
      storeId: storeActive,
      status: 'AVAILABLE',
      walletBalance: 50,
      totalDeliveries: 0,
    });

    // Seed products, BOM raw batches, suspended catalog & coupons
    await db.collection('inventory_batches').doc('bat_heavy_bun').set({
      id: 'bat_heavy_bun',
      tenantId: tenantActive,
      storeId: storeActive,
      sku: 'INS-PAO-HEAVY',
      name: 'Pao Brioche Heavy',
      quantity: 4,
      unit: 'UN',
      costPrice: 1.5,
      expirationDate: '2030-12-31',
    });
    await db.collection('menu_items').doc('prd_heavy_combo').set({
      id: 'prd_heavy_combo',
      tenantId: tenantActive,
      storeId: storeActive,
      name: 'Combo BOM Variantes',
      price: 35,
      costPrice: 12,
      stock: 10,
      isAvailable: true,
      variants: [
        { id: 'v_m', label: 'Medio', stock: 5, priceDelta: 0 },
        { id: 'v_g', label: 'Grande', stock: 5, priceDelta: 10 },
      ],
      recipe: [{ sku: 'INS-PAO-HEAVY', ingredientName: 'Pao Brioche', qty: 1 }],
    });
    await db.collection('menu_items').doc('prd_heavy_return').set({
      id: 'prd_heavy_return',
      tenantId: tenantActive,
      storeId: storeActive,
      name: 'Item Devolucao',
      price: 35,
      costPrice: 10,
      stock: 5,
      isAvailable: true,
    });
    await db.collection('menu_items').doc('prd_susp_secret').set({
      id: 'prd_susp_secret',
      tenantId: tenantSuspended,
      storeId: storeSuspended,
      name: 'Item Loja Suspensa',
      price: 99,
      stock: 5,
      isAvailable: true,
    });
    await db.collection('coupons').doc('cup_expired_heavy').set({
      id: 'cup_expired_heavy',
      code: 'EXPIRADO10',
      tenantId: tenantActive,
      storeId: storeActive,
      discountType: 'PERCENT',
      discountValue: 10,
      isActive: true,
      validUntil: '2020-01-01T00:00:00.000Z',
    });
    await db.collection('coupons').doc('cup_active_heavy').set({
      id: 'cup_active_heavy',
      code: 'ATIVO10',
      tenantId: tenantActive,
      storeId: storeActive,
      discountType: 'PERCENT',
      discountValue: 10,
      isActive: true,
      validUntil: '2035-01-01T00:00:00.000Z',
    });

    // =========================================================================
    // GROUP 1: NEGATIVE SECURITY & MASS-ASSIGNMENT MATRIX
    // =========================================================================
    // SEC-01: COURIER omitting deliveryPin on DELIVERED order MUST be rejected
    const pinOrderResp = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${consumerToken}`,
        'Idempotency-Key': generateIdempotencyKey(),
      },
      body: JSON.stringify({
        storeId: storeActive,
        channel: 'MARKETPLACE',
        deliveryModality: 'PLATFORM_FLEET',
        deliveryAddress: 'Rua Augusta, 500',
        paymentMethod: 'PIX',
        items: [{ menuItemId: 'prd_heavy_return', quantity: 1 }],
      }),
    });
    const pinOrderJson = await pinOrderResp.json();
    const pinOrderId = pinOrderJson.transaction?.orderId;
    const realPin = pinOrderJson.transaction?.deliveryPin;

    for (const nextStatus of ['CONFIRMED', 'IN_PREPARATION', 'READY_FOR_PICKUP']) {
      await fetch(`${baseUrl}/api/v1/commerce/orders/${pinOrderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ status: nextStatus }),
      });
    }

    // CONC-02: Parallel Courier Claim Race on same order (Courier A vs Courier B)
    const claimRace = await Promise.all([
      ...Array.from({ length: 4 }, () =>
        fetch(`${baseUrl}/api/v1/commerce/orders/${pinOrderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${courierAToken}` },
          body: JSON.stringify({ status: 'OUT_FOR_DELIVERY' }),
        })
      ),
      ...Array.from({ length: 4 }, () =>
        fetch(`${baseUrl}/api/v1/commerce/orders/${pinOrderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${courierBToken}` },
          body: JSON.stringify({ status: 'OUT_FOR_DELIVERY' }),
        })
      ),
    ]);
    const claimedOrderSnap = (await db.collection('orders').doc(pinOrderId).get()).data();
    const winningCourierToken = claimedOrderSnap?.driverId === 'usr_heavy_courier_a' ? courierAToken : courierBToken;
    const losingStatuses = claimRace
      .filter((_, idx) =>
        claimedOrderSnap?.driverId === 'usr_heavy_courier_a' ? idx >= 4 : idx < 4
      )
      .map((r) => r.status);

    check(
      Boolean(claimedOrderSnap?.driverId) &&
        losingStatuses.every((st) => st === 403 || st === 400),
      `CONC-02: Corrida de 8 claims simultâneos entre 2 entregadores elege estritamente 1 dono (${claimedOrderSnap?.driverId})`
    );

    // SEC-01 checks: omit PIN, wrong PIN, valid PIN
    const omitPinResp = await fetch(`${baseUrl}/api/v1/commerce/orders/${pinOrderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${winningCourierToken}` },
      body: JSON.stringify({ status: 'DELIVERED' }),
    });
    const wrongPinResp = await fetch(`${baseUrl}/api/v1/commerce/orders/${pinOrderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${winningCourierToken}` },
      body: JSON.stringify({ status: 'DELIVERED', deliveryPin: '0000' }),
    });
    const validPinResp = await fetch(`${baseUrl}/api/v1/commerce/orders/${pinOrderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${winningCourierToken}` },
      body: JSON.stringify({ status: 'DELIVERED', deliveryPin: realPin }),
    });
    check(
      Boolean(realPin) && omitPinResp.status === 400 && wrongPinResp.status === 400 && validPinResp.status === 200,
      'SEC-01: COURIER impedido de concluir DELIVERED omitindo PIN (400) ou com PIN errado (400); aceita PIN real (200)'
    );

    // SEC-02: PUT /store/:id mass assignment protection
    await fetch(`${baseUrl}/api/v1/store/${storeActive}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        name: 'Burger Heavy Atualizado',
        waiterPairingPin: '9999',
        pendingUpgradeRequest: { status: 'APPROVED', requestedPlan: 'ENTERPRISE' },
        subscriptionPlan: 'ENTERPRISE',
        maxAllowedBranches: 99,
      }),
    });
    const storeAfterPut = (await db.collection('stores').doc(storeActive).get()).data();
    check(
      storeAfterPut?.name === 'Burger Heavy Atualizado' &&
        storeAfterPut?.waiterPairingPin === '4321' &&
        storeAfterPut?.pendingUpgradeRequest === undefined &&
        storeAfterPut?.subscriptionPlan === 'FREE' &&
        storeAfterPut?.maxAllowedBranches === 2,
      'SEC-02: PUT /store/:id bloqueia mass-assignment de waiterPairingPin, pendingUpgradeRequest e cotas SaaS'
    );

    // SEC-03: /generic consumer suspended filter, expired coupon filter, prototype pollution, domain bounds
    const [genStoresRes, genMenusRes, genCouponsRes, genSuspDetailRes, genActDetailRes, genExpCouponRes] =
      await Promise.all([
        fetch(`${baseUrl}/api/v1/generic/stores`, { headers: { Authorization: `Bearer ${consumerToken}` } }),
        fetch(`${baseUrl}/api/v1/generic/menu_items`, { headers: { Authorization: `Bearer ${consumerToken}` } }),
        fetch(`${baseUrl}/api/v1/generic/coupons`, { headers: { Authorization: `Bearer ${consumerToken}` } }),
        fetch(`${baseUrl}/api/v1/generic/stores/${storeSuspended}`, { headers: { Authorization: `Bearer ${consumerToken}` } }),
        fetch(`${baseUrl}/api/v1/generic/stores/${storeActive}`, { headers: { Authorization: `Bearer ${consumerToken}` } }),
        fetch(`${baseUrl}/api/v1/generic/coupons/cup_expired_heavy`, { headers: { Authorization: `Bearer ${consumerToken}` } }),
      ]);
    const genStores = await genStoresRes.json();
    const genMenus = await genMenusRes.json();
    const genCoupons = await genCouponsRes.json();
    const genActDetail = await genActDetailRes.json();

    const negPriceRes = await fetch(`${baseUrl}/api/v1/generic/menu_items/prd_bad_neg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ data: { name: 'Hacked Neg', price: -50, stock: 1, storeId: storeActive } }),
    });
    const negFinGenericRes = await fetch(`${baseUrl}/api/v1/generic/financial_records/fin_bad_neg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ data: { type: 'RECEIVABLE', amount: -100, storeId: storeActive } }),
    });
    const negFinStoreRes = await fetch(`${baseUrl}/api/v1/store/finance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ type: 'RECEIVABLE', amount: -100, storeId: storeActive }),
    });
    const badTableRes = await fetch(`${baseUrl}/api/v1/generic/tables/tbl_bad_status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ data: { tableNumber: 1, status: 'HACKED_STATE', storeId: storeActive } }),
    });
    const protoRes = await fetch(`${baseUrl}/api/v1/generic/tables/tbl_proto_clean`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: '{"data":{"tableNumber":8,"status":"FREE","__proto__":{"polluted":true},"nested":{"constructor":{"evil":1}}}}',
    });
    const protoDoc = (await db.collection('tables').doc('tbl_proto_clean').get()).data();
    const hasOwnProto = protoDoc ? Object.prototype.hasOwnProperty.call(protoDoc, '__proto__') : false;

    check(
      !genStores.some((s: any) => s.id === storeSuspended) &&
        !genMenus.some((m: any) => m.id === 'prd_susp_secret') &&
        !genCoupons.some((c: any) => c.id === 'cup_expired_heavy') &&
        genCoupons.some((c: any) => c.id === 'cup_active_heavy') &&
        genSuspDetailRes.status === 403 &&
        genExpCouponRes.status === 403 &&
        genActDetailRes.status === 200 &&
        genActDetail?.waiterPairingPin === undefined &&
        negPriceRes.status === 400 &&
        negFinGenericRes.status === 403 &&
        negFinStoreRes.status === 400 &&
        badTableRes.status === 400 &&
        protoRes.status === 200 &&
        !hasOwnProto &&
        protoDoc?.nested?.constructor === Object,
      'SEC-03: /generic bloqueia lojas suspensas/cupons expirados/financeiro direto (403), remove __proto__ e rejeita payloads numéricos negativos (400)'
    );

    // SEC-04: PUT /admin/users/:uid blockedApps change bumps tokenVersion and revokes old Bearer
    const beforeBlockedRes = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    await fetch(`${baseUrl}/api/v1/admin/users/usr_heavy_staff`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${devToken}` },
      body: JSON.stringify({ blockedApps: ['store-os'] }),
    });
    const afterBlockedRes = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const staffDocAfter = (await db.collection('users').doc('usr_heavy_staff').get()).data();
    check(
      beforeBlockedRes.status === 200 &&
        afterBlockedRes.status === 401 &&
        (staffDocAfter?.tokenVersion || 0) >= 2,
      'SEC-04: Alteração de blockedApps em /admin/users/:uid incrementa tokenVersion e revoga sessão ativa (401)'
    );

    // =========================================================================
    // GROUP 2: HEAVY PROMISE.ALL CONCURRENCY & CONSERVATION MATRIX
    // =========================================================================
    // CONC-01: 10 parallel orders racing variant stock (5) + shared BOM batch (4)
    const bomRaceResps = await Promise.all(
      Array.from({ length: 10 }, () =>
        fetch(`${baseUrl}/api/v1/commerce/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ownerToken}`,
            'Idempotency-Key': generateIdempotencyKey(),
          },
          body: JSON.stringify({
            storeId: storeActive,
            channel: 'POS',
            deliveryModality: 'PICKUP',
            paymentMethod: 'PIX',
            items: [{ menuItemId: 'prd_heavy_combo', variantId: 'v_m', quantity: 1 }],
          }),
        })
      )
    );
    const bomSuccess = bomRaceResps.filter((r) => r.status === 201).length;
    const bomRejected = bomRaceResps.filter((r) => r.status === 400).length;
    const finalBunBatch = (await db.collection('inventory_batches').doc('bat_heavy_bun').get()).data();
    const finalComboItem = (await db.collection('menu_items').doc('prd_heavy_combo').get()).data();
    const finalVmStock = finalComboItem?.variants?.find((v: any) => v.id === 'v_m')?.stock;
    const bunLedgerEntries = (await db.collection('stock_ledger').get()).docs
      .map((d) => d.data())
      .filter((l) => l.targetId === 'bat_heavy_bun');
    const netBunDelta = bunLedgerEntries.reduce((acc, l) => acc + Number(l.deltaQty || 0), 0);

    check(
      bomSuccess === 4 &&
        bomRejected === 6 &&
        finalBunBatch?.quantity === 0 &&
        finalVmStock === 1 &&
        netBunDelta === -4,
      `CONC-01: 10 vendas paralelas sobre gargalo BOM (4) & variante (5): ${bomSuccess} OK, ${bomRejected} rejeitadas, lote=${finalBunBatch?.quantity}, variante=${finalVmStock}, soma ledger=${netBunDelta}`
    );

    // CONC-03: 6 parallel PIX withdraws of R$ 40 on R$ 100 wallet
    const withdrawResps = await Promise.all(
      Array.from({ length: 6 }, () =>
        fetch(`${baseUrl}/api/v1/commerce/drivers/usr_heavy_courier_b/withdraw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${courierBToken}` },
          body: JSON.stringify({ amount: 20, pixKey: 'courier-b@pix.br' }),
        })
      )
    );
    const wdOk = withdrawResps.filter((r) => r.status === 201).length;
    const wdFail = withdrawResps.filter((r) => r.status === 400).length;
    const drvBAfter = (await db.collection('drivers').doc('usr_heavy_courier_b').get()).data();
    check(
      wdOk === 2 && wdFail === 4 && drvBAfter?.walletBalance === 10,
      `CONC-03: 6 saques PIX paralelos de R$20 em saldo R$50 -> estritamente 2 aprovados, 4 rejeitados, saldo final=R$${drvBAfter?.walletBalance}`
    );

    // CONC-04: 6 parallel return calls on 1-qty order
    const stockBeforeReturnSale = (await db.collection('menu_items').doc('prd_heavy_return').get()).data()?.stock;
    const retOrdResp = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
        'Idempotency-Key': generateIdempotencyKey(),
      },
      body: JSON.stringify({
        storeId: storeActive,
        channel: 'POS',
        deliveryModality: 'PICKUP',
        paymentMethod: 'PIX',
        items: [{ menuItemId: 'prd_heavy_return', quantity: 1 }],
      }),
    });
    const retOrdJson = await retOrdResp.json();
    const retOrdId = retOrdJson.transaction?.orderId;
    const retRace = await Promise.all(
      Array.from({ length: 6 }, () =>
        fetch(`${baseUrl}/api/v1/commerce/orders/${retOrdId}/return`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
          body: JSON.stringify({ itemIndex: 0, quantity: 1, reason: 'Defeito' }),
        })
      )
    );
    const retOk = retRace.filter((r) => r.status === 200).length;
    const retFail = retRace.filter((r) => r.status === 400).length;
    const retItemSnap = (await db.collection('menu_items').doc('prd_heavy_return').get()).data();
    const retOrderSnap = (await db.collection('orders').doc(retOrdId).get()).data();
    const retRefundCount = (await db.collection('financial_records').get()).docs
      .map((d) => d.data())
      .filter((f) => f.orderId === retOrdId && (f.category === 'Estorno / Troca PDV' || String(f.id || '').startsWith('fin-ret-'))).length;
    check(
      retOk === 1 &&
        retFail === 5 &&
        retOrderSnap?.items?.[0]?.returnedQuantity === 1 &&
        retItemSnap?.stock === stockBeforeReturnSale &&
        retRefundCount === 1,
      `CONC-04: 6 devoluções paralelas no mesmo item -> ${retOk} aceita, ${retFail} bloqueadas, estoque conservado (${retItemSnap?.stock} == ${stockBeforeReturnSale}), ${retRefundCount} estorno financeiro`
    );

    // CONC-05: 8 parallel identical Cloud reservations -> 1 success, 7 HTTP 409
    const cloudResRace = await Promise.all(
      Array.from({ length: 8 }, () =>
        fetch(`${baseUrl}/api/v1/store/reservations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
          body: JSON.stringify({
            storeId: storeActive,
            customerName: 'Cliente Concorrente',
            tableNumber: 12,
            date: '2028-06-15',
            time: '20:00',
            durationMinutes: 90,
          }),
        })
      )
    );
    const resOk = cloudResRace.filter((r) => r.status === 200).length;
    const res409 = cloudResRace.filter((r) => r.status === 409).length;
    check(
      resOk === 1 && res409 === 7,
      `CONC-05: 8 reservas simultâneas para mesma mesa/horário na Cloud -> 1 aprovada, ${res409} bloqueadas com 409`
    );

    // CONC-06: Parallel Branch Quota Race & Device Quota Race
    const branchRace = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        fetch(`${baseUrl}/api/v1/store/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${quotaOwnerToken}` },
          body: JSON.stringify({
            name: `Filial Corrida ${i}`,
            parentStoreId: storeQuota,
            category: 'RETAIL',
          }),
        })
      )
    );
    const deviceRace = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        fetch(`${baseUrl}/api/v1/store/devices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${quotaOwnerToken}` },
          body: JSON.stringify({
            storeId: storeQuota,
            name: `POS Race ${i}`,
            type: 'POS',
          }),
        })
      )
    );
    const brOk = branchRace.filter((r) => r.status === 200).length;
    const br403 = branchRace.filter((r) => r.status === 403).length;
    const dvOk = deviceRace.filter((r) => r.status === 200).length;
    const dv403 = deviceRace.filter((r) => r.status === 403).length;
    check(
      brOk === 1 && br403 === 4 && dvOk === 2 && dv403 === 4,
      `CONC-06: Corridas em cotas SaaS -> filiais (${brOk} OK / ${br403} bloqueadas 403), dispositivos (${dvOk} OK / ${dv403} bloqueados 403)`
    );

    // CONC-07: 10 parallel sync/push calls carrying identical idempotencyKey
    await db.collection('menu_items').doc('prd_sync_race').set({
      id: 'prd_sync_race',
      tenantId: tenantActive,
      storeId: storeActive,
      name: 'Item Sync Idempotente',
      price: 20,
      stock: 10,
      isAvailable: true,
    });
    await fetch(`${baseUrl}/api/v1/sync/edge/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ nodeId: 'edg_heavy_race', storeId: storeActive, hostname: 'heavy-race-node' }),
    });
    const sharedSyncIdemKey = generateIdempotencyKey();
    const syncRaceResps = await Promise.all(
      Array.from({ length: 10 }, () =>
        fetch(`${baseUrl}/api/v1/sync/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
          body: JSON.stringify({
            nodeId: 'edg_heavy_race',
            storeId: storeActive,
            mutations: [
              {
                idempotencyKey: sharedSyncIdemKey,
                entity: 'menu_items',
                entityId: 'prd_sync_race',
                operation: 'UPSERT',
                hlc: `${Date.now()}:0001:edg_heavy_race`,
                deltaQty: -3,
                payload: { id: 'prd_sync_race', name: 'Item Sync Idempotente' },
              },
            ],
          }),
        }).then((r) => r.json())
      )
    );
    const syncAccTotal = syncRaceResps.reduce((acc, r) => acc + (r.accepted?.length || 0), 0);
    const syncDupTotal = syncRaceResps.reduce((acc, r) => acc + (r.deduplicated?.length || 0), 0);
    const syncItemAfter = (await db.collection('menu_items').doc('prd_sync_race').get()).data();
    check(
      syncAccTotal === 1 && syncDupTotal === 9 && syncItemAfter?.stock === 7,
      `CONC-07: 10 sync/push paralelos com mesma idempotencyKey -> ${syncAccTotal} aceito, ${syncDupTotal} deduplicados, estoque=7 (${syncItemAfter?.stock})`
    );

    // =========================================================================
    // GROUP 3: EDGE NODE SQLITE WAL CONCURRENCY, COURIER/PIN & CRASH RECOVERY
    // =========================================================================
    const edgeItemSeed = {
      id: 'prd_edge_heavy',
      tenantId: tenantActive,
      storeId: storeActive,
      name: 'Burger Edge WAL',
      price: 30,
      stock: 4,
      isAvailable: true,
    };
    const edgeCashSeed = {
      id: 'cash_edge_heavy',
      tenantId: tenantActive,
      storeId: storeActive,
      status: 'OPEN',
      initialCash: 100,
      totalSales: 0,
      finalCashCalculated: 100,
      openedAt: new Date().toISOString(),
    };
    const edgeDriversSeed = [
      { id: 'usr_heavy_courier_a', uid: 'usr_heavy_courier_a', name: 'Courier Alpha', tenantId: tenantActive, storeId: storeActive, status: 'AVAILABLE', walletBalance: 10, totalDeliveries: 0 },
      { id: 'usr_heavy_courier_b', uid: 'usr_heavy_courier_b', name: 'Courier Beta', tenantId: tenantActive, storeId: storeActive, status: 'AVAILABLE', walletBalance: 10, totalDeliveries: 0 },
    ];

    await db.collection('menu_items').doc('prd_edge_heavy').set(edgeItemSeed);

    edgeRuntime = new EdgeNodeRuntime({
      storeId: storeActive,
      tenantId: tenantActive,
      dbPath: edgeSqlitePath,
      port: 0,
      cloudBaseUrl: baseUrl,
    });
    await edgeRuntime.seedFromCloudSnapshot({
      store: { id: storeActive, tenantId: tenantActive, name: 'Burger Heavy Matriz', category: 'RESTAURANT', deliveryFee: 8, isOpen: true },
      menuItems: [edgeItemSeed],
      users: seedUsers,
      cashSessions: [edgeCashSeed],
    });
    for (const d of edgeDriversSeed) {
      await edgeRuntime.driver.setDoc('drivers', d.id, d, false);
    }
    const edgePort = await edgeRuntime.listen(0);
    const edgeBaseUrl = `http://127.0.0.1:${edgePort}`;
    await edgeRuntime.registerWithCloud(baseUrl, ownerToken, 'edge-heavy-matriz');

    // EDGE-01: 10 parallel Edge orders with identical Idempotency-Key -> stock 4 -> 3
    const edgeSharedIdem = generateIdempotencyKey();
    const edgeIdemRace = await Promise.all(
      Array.from({ length: 10 }, () =>
        fetch(`${edgeBaseUrl}/api/v1/commerce/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ownerToken}`,
            'Idempotency-Key': edgeSharedIdem,
          },
          body: JSON.stringify({
            storeId: storeActive,
            channel: 'POS',
            deliveryModality: 'PICKUP',
            paymentMethod: 'PIX',
            items: [{ menuItemId: 'prd_edge_heavy', quantity: 1 }],
          }),
        })
      )
    );
    const edgeItemAfterIdem = await edgeRuntime.driver.getDoc<any>('menu_items', 'prd_edge_heavy');
    const edgeOrdersCountAfterIdem = (await edgeRuntime.driver.listDocs<any>('orders')).length;
    check(
      edgeIdemRace.every((r) => r.status === 201) && edgeItemAfterIdem?.stock === 3 && edgeOrdersCountAfterIdem === 1,
      `EDGE-01: 10 requisições paralelas Edge com mesma Idempotency-Key criam 1 pedido e baixam estoque 1x (4 -> ${edgeItemAfterIdem?.stock})`
    );

    // EDGE-02: 10 parallel Edge orders (distinct keys) racing remaining stock=3
    const edgeStockRace = await Promise.all(
      Array.from({ length: 10 }, () =>
        fetch(`${edgeBaseUrl}/api/v1/commerce/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ownerToken}`,
            'Idempotency-Key': generateIdempotencyKey(),
          },
          body: JSON.stringify({
            storeId: storeActive,
            channel: 'POS',
            deliveryModality: 'PICKUP',
            paymentMethod: 'PIX',
            items: [{ menuItemId: 'prd_edge_heavy', quantity: 1 }],
          }),
        })
      )
    );
    const edgeOk = edgeStockRace.filter((r) => r.status === 201).length;
    const edgeFail = edgeStockRace.filter((r) => r.status === 400).length;
    const edgeItemZero = await edgeRuntime.driver.getDoc<any>('menu_items', 'prd_edge_heavy');
    const edgeLedgers = (await edgeRuntime.driver.listDocs<any>('stock_ledger')).filter(
      (l) => l.targetId === 'prd_edge_heavy'
    );
    const edgeNetDelta = edgeLedgers.reduce((acc, l) => acc + Number(l.deltaQty || 0), 0);
    check(
      edgeOk === 3 && edgeFail === 7 && edgeItemZero?.stock === 0 && edgeNetDelta === -4,
      `EDGE-02: 10 vendas paralelas Edge sobre saldo 3 -> ${edgeOk} aprovadas, ${edgeFail} rejeitadas, estoque=0, soma ledger=${edgeNetDelta}`
    );

    // EDGE-03: 6 parallel identical reservations on Edge -> 1 success (201), 5 HTTP 409
    const edgeResRace = await Promise.all(
      Array.from({ length: 6 }, () =>
        fetch(`${edgeBaseUrl}/api/v1/store/reservations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
          body: JSON.stringify({
            customerName: 'Reserva Edge Concorrente',
            tableNumber: 4,
            date: '2028-07-01',
            time: '19:30',
            durationMinutes: 90,
          }),
        })
      )
    );
    const eRes201 = edgeResRace.filter((r) => r.status === 201).length;
    const eRes409 = edgeResRace.filter((r) => r.status === 409).length;
    check(
      eRes201 === 1 && eRes409 === 5,
      `EDGE-03: 6 reservas simultâneas no Edge WAL -> 1 criada (201), ${eRes409} bloqueadas (409)`
    );

    // EDGE-04: COURIER ownership race, deliveryPin enforcement & driver settlement on Edge
    const edgePinOrdId = 'ord_edge_pin_01';
    await edgeRuntime.driver.setDoc('orders', edgePinOrdId, {
      id: edgePinOrdId,
      code: '#E9001',
      storeId: storeActive,
      tenantId: tenantActive,
      channel: 'MARKETPLACE',
      deliveryModality: 'PLATFORM_FLEET',
      deliveryFee: 8,
      courierTip: 2,
      total: 38,
      paymentMethod: 'PIX',
      paymentStatus: 'PENDING',
      deliveryPin: '7788',
      status: 'READY_FOR_PICKUP',
      createdAt: new Date().toISOString(),
    });
    await edgeRuntime.driver.setDoc('financial_records', `fin-ord-${edgePinOrdId}`, {
      id: `fin-ord-${edgePinOrdId}`,
      tenantId: tenantActive,
      storeId: storeActive,
      type: 'RECEIVABLE',
      category: 'MARKETPLACE',
      amount: 38,
      status: 'PENDING',
      orderId: edgePinOrdId,
    });

    const edgeClaimRace = await Promise.all([
      ...Array.from({ length: 3 }, () =>
        fetch(`${edgeBaseUrl}/api/v1/commerce/orders/${edgePinOrdId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${courierAToken}` },
          body: JSON.stringify({ status: 'OUT_FOR_DELIVERY' }),
        })
      ),
      ...Array.from({ length: 3 }, () =>
        fetch(`${edgeBaseUrl}/api/v1/commerce/orders/${edgePinOrdId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${courierBToken}` },
          body: JSON.stringify({ status: 'OUT_FOR_DELIVERY' }),
        })
      ),
    ]);
    const edgeClaimedOrd = await edgeRuntime.driver.getDoc<any>('orders', edgePinOrdId);
    const edgeWinToken = edgeClaimedOrd?.driverId === 'usr_heavy_courier_a' ? courierAToken : courierBToken;
    const edgeLoseStatuses = edgeClaimRace
      .filter((_, idx) => (edgeClaimedOrd?.driverId === 'usr_heavy_courier_a' ? idx >= 3 : idx < 3))
      .map((r) => r.status);

    const eOmitPin = await fetch(`${edgeBaseUrl}/api/v1/commerce/orders/${edgePinOrdId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${edgeWinToken}` },
      body: JSON.stringify({ status: 'DELIVERED' }),
    });
    const eWrongPin = await fetch(`${edgeBaseUrl}/api/v1/commerce/orders/${edgePinOrdId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${edgeWinToken}` },
      body: JSON.stringify({ status: 'DELIVERED', deliveryPin: '1111' }),
    });
    const eValidPin = await fetch(`${edgeBaseUrl}/api/v1/commerce/orders/${edgePinOrdId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${edgeWinToken}` },
      body: JSON.stringify({ status: 'DELIVERED', deliveryPin: '7788' }),
    });
    const edgeWinDrv = await edgeRuntime.driver.getDoc<any>('drivers', edgeClaimedOrd.driverId);
    const edgeFinSettled = await edgeRuntime.driver.getDoc<any>('financial_records', `fin-ord-${edgePinOrdId}`);
    check(
      edgeLoseStatuses.every((s) => s === 403 || s === 400) &&
        eOmitPin.status === 400 &&
        eWrongPin.status === 400 &&
        eValidPin.status === 200 &&
        edgeWinDrv?.walletBalance === 20 &&
        edgeWinDrv?.totalDeliveries === 1 &&
        edgeFinSettled?.status === 'PAID',
      'EDGE-04: Edge bloqueia corrida de entregador e omissão/erro de deliveryPin (400), e liquida wallet + financeiro atomicamente'
    );

    // EDGE-06: Expired & inactive coupons hidden on Edge + atomic finance/bill outbox + proto stripping
    await edgeRuntime.driver.setDoc('coupons', 'cup_edge_active', {
      id: 'cup_edge_active',
      storeId: storeActive,
      code: 'EDGEACTIVE10',
      discountType: 'PERCENT',
      discountValue: 10,
      isActive: true,
      validUntil: '2030-01-01T00:00:00.000Z',
    });
    await edgeRuntime.driver.setDoc('coupons', 'cup_edge_expired', {
      id: 'cup_edge_expired',
      storeId: storeActive,
      code: 'EDGEEXPIRED',
      discountType: 'PERCENT',
      discountValue: 50,
      isActive: true,
      validUntil: '2020-01-01T00:00:00.000Z',
    });
    await edgeRuntime.driver.setDoc('coupons', 'cup_edge_inactive', {
      id: 'cup_edge_inactive',
      storeId: storeActive,
      code: 'EDGEINACTIVE',
      discountType: 'FIXED',
      discountValue: 99,
      isActive: false,
      validUntil: '2030-01-01T00:00:00.000Z',
    });
    const edgeCouponsResp = await fetch(`${edgeBaseUrl}/api/v1/commerce/coupons`);
    const edgeCouponsJson: any[] = await edgeCouponsResp.json();
    const edgeFinResp = await fetch(`${edgeBaseUrl}/api/v1/store/finance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        id: 'fin_edge_atomic_01',
        type: 'PAYABLE',
        category: 'DESPESA',
        amount: 42.5,
        description: 'Gelo e Embalagens',
        __proto__: { pollutedEdge: true },
      }),
    });
    const edgeOutboxAfterFin = (await edgeRuntime.driver.listDocs<any>('sync_outbox')).some(
      (o) => o.entity === 'financial_records' && o.entityId === 'fin_edge_atomic_01'
    );
    check(
      edgeCouponsResp.status === 200 &&
        edgeCouponsJson.some((c) => c.id === 'cup_edge_active') &&
        !edgeCouponsJson.some((c) => c.id === 'cup_edge_expired' || c.id === 'cup_edge_inactive') &&
        edgeFinResp.status === 200 &&
        edgeOutboxAfterFin &&
        ({} as any).pollutedEdge === undefined,
      'EDGE-06: Edge oculta cupons expirados/inativos, grava lançamento financeiro + outbox atomicamente e bloqueia __proto__'
    );

    // EDGE-05: WAL crash/close + reopen survival & sync convergence to Cloud
    const outboxCountBeforeClose = (await edgeRuntime.driver.listDocs<any>('sync_outbox')).length;
    await edgeRuntime.close();
    edgeRuntime = null;

    edgeRuntimeReopened = new EdgeNodeRuntime({
      storeId: storeActive,
      tenantId: tenantActive,
      dbPath: edgeSqlitePath,
      port: 0,
      cloudBaseUrl: baseUrl,
    });
    const outboxAfterReopen = (await edgeRuntimeReopened.driver.listDocs<any>('sync_outbox')).length;
    const stockAfterReopen = (await edgeRuntimeReopened.driver.getDoc<any>('menu_items', 'prd_edge_heavy'))?.stock;
    const edgeReopenedPort = await edgeRuntimeReopened.listen(0);
    const edgeReopenedBaseUrl = `http://127.0.0.1:${edgeReopenedPort}`;
    const syncOut = await edgeRuntimeReopened.syncWithCloud(baseUrl, ownerToken);
    const cloudEdgeItemAfterSync = (await db.collection('menu_items').doc('prd_edge_heavy').get()).data();
    check(
      outboxCountBeforeClose > 0 &&
        outboxAfterReopen === outboxCountBeforeClose &&
        stockAfterReopen === 0 &&
        syncOut.pushedAccepted >= 4 &&
        cloudEdgeItemAfterSync?.stock === 0,
      `EDGE-05: Restart SQLite WAL preserva ${outboxAfterReopen} eventos de outbox e converge saldo para 0 na Cloud`
    );

    // SEC-05: /sync/push mass-assignment & forbidden store DELETE guard
    const syncPushPrivEsc = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        nodeId: edgeRuntimeReopened.nodeId,
        storeId: storeActive,
        mutations: [
          {
            entity: 'stores',
            entityId: storeActive,
            operation: 'UPSERT',
            idempotencyKey: generateIdempotencyKey(),
            payload: {
              name: 'Loja Heavy Atualizada',
              subscriptionPlan: 'ENTERPRISE',
              maxAllowedBranches: 99,
              maxAllowedDevices: 999,
              saasPaymentStatus: 'FREE_FOREVER',
              waiterPairingPin: '999-999',
              pendingUpgradeRequest: { requestedPlan: 'ENTERPRISE', status: 'APPROVED' },
              __proto__: { syncPolluted: true },
            },
          },
          {
            entity: 'stores',
            entityId: storeActive,
            operation: 'DELETE',
            idempotencyKey: generateIdempotencyKey(),
          },
        ],
      }),
    });
    const syncPushJson: any = await syncPushPrivEsc.json();
    const storeAfterSyncPush = (await db.collection('stores').doc(storeActive).get()).data();
    check(
      syncPushPrivEsc.status === 200 &&
        storeAfterSyncPush?.subscriptionPlan === 'FREE' &&
        storeAfterSyncPush?.maxAllowedBranches === 2 &&
        storeAfterSyncPush?.waiterPairingPin === '4321' &&
        !storeAfterSyncPush?.pendingUpgradeRequest &&
        storeAfterSyncPush?._deleted !== true &&
        syncPushJson.rejected?.some((r: any) => r.entity === 'stores' && (r.reason === 'RBAC_DENIED' || r.reason === 'FORBIDDEN_DELETE')) &&
        ({} as any).syncPolluted === undefined,
      'SEC-05: /sync/push bloqueia escalonamento de plano/PIN/upgradeRequest, __proto__ e DELETE em stores'
    );

    // SEC-06: COURIER invalid status & non-finite coordinates rejection on PUT /commerce/drivers/:id
    const badCourierStatus = await fetch(`${baseUrl}/api/v1/commerce/drivers/usr_heavy_courier_a`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${courierAToken}` },
      body: JSON.stringify({ status: 'HACKED_STATUS' }),
    });
    const badCourierGeo = await fetch(`${baseUrl}/api/v1/commerce/drivers/usr_heavy_courier_a`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${courierAToken}` },
      body: JSON.stringify({ latitude: 'NaN' }),
    });
    check(
      badCourierStatus.status === 400 && badCourierGeo.status === 400,
      `SEC-06: PUT /commerce/drivers/:id rejeita status inválido (${badCourierStatus.status}) e coordenadas inválidas (${badCourierGeo.status})`
    );

    // =========================================================================
    // GROUP 4: ROUND 3 ATOMICITY, AUTH RACES & CROSS-CALLER ISOLATION
    // =========================================================================
    // CONC-08: Parallel signup & parallel store/staff with duplicate emails
    const signupRace = await Promise.all(
      Array.from({ length: 8 }, () =>
        fetch(`${baseUrl}/api/v1/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Race Consumer',
            email: 'race-signup@3c.local',
            password: 'StrongPassword#2026',
            role: 'CUSTOMER',
          }),
        })
      )
    );
    const signup201 = signupRace.filter((r) => r.status === 201).length;
    const signup400 = signupRace.filter((r) => r.status === 400).length;
    const signupMatches = (await db.collection('users').get()).docs.filter(
      (d) => d.data()?.email?.toLowerCase() === 'race-signup@3c.local'
    ).length;

    const staffRace = await Promise.all(
      Array.from({ length: 8 }, () =>
        fetch(`${baseUrl}/api/v1/store/staff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
          body: JSON.stringify({
            name: 'Staff Race',
            email: 'race-staff@3c.local',
            password: 'StaffPassword#2026',
            role: 'WAITER',
            storeId: storeActive,
          }),
        })
      )
    );
    const staff201 = staffRace.filter((r) => r.status === 201).length;
    const staff409 = staffRace.filter((r) => r.status === 409).length;
    const staffMatches = (await db.collection('users').get()).docs.filter(
      (d) => d.data()?.email?.toLowerCase() === 'race-staff@3c.local'
    ).length;

    check(
      signup201 === 1 &&
        signup400 === 7 &&
        signupMatches === 1 &&
        staff201 === 1 &&
        staff409 === 7 &&
        staffMatches === 1,
      `CONC-08: Corrida de e-mail duplicado -> signup (${signup201} OK / ${signup400} bloqueados, ${signupMatches} usuário), store/staff (${staff201} OK / ${staff409} bloqueados, ${staffMatches} usuário)`
    );

    // CONC-09: 8 parallel POST /store/inventory adjustments on the same batch -> atomic stock_ledger chain
    await db.collection('inventory_batches').doc('bat_race_chain').set({
      id: 'bat_race_chain',
      tenantId: tenantActive,
      storeId: storeActive,
      sku: 'INS-QUEIJO-RACE',
      name: 'Queijo Prato Race',
      quantity: 10,
      unit: 'KG',
      costPrice: 32,
    });
    const invRaceResps = await Promise.all(
      [11, 13, 16, 12, 18, 15, 19, 14].map((qty) =>
        fetch(`${baseUrl}/api/v1/store/inventory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
          body: JSON.stringify({
            id: 'bat_race_chain',
            storeId: storeActive,
            quantity: qty,
          }),
        })
      )
    );
    const batChainFinal = (await db.collection('inventory_batches').doc('bat_race_chain').get()).data();
    const batChainLedgers = (await db.collection('stock_ledger').get()).docs
      .map((d) => d.data())
      .filter((l) => l.targetId === 'bat_race_chain');
    const batChainNetDelta = batChainLedgers.reduce((acc, l) => acc + Number(l.deltaQty || 0), 0);
    const batChainConnected =
      batChainLedgers.length === 8 &&
      batChainLedgers[0].previousQty === 10 &&
      batChainLedgers.every((entry, idx) =>
        entry.balanceAfter === entry.previousQty + entry.deltaQty &&
        (idx === 0 || entry.previousQty === batChainLedgers[idx - 1].balanceAfter)
      ) &&
      batChainLedgers[batChainLedgers.length - 1].balanceAfter === batChainFinal?.quantity;

    check(
      invRaceResps.every((r) => r.status === 200) &&
        batChainConnected &&
        10 + batChainNetDelta === batChainFinal?.quantity,
      `CONC-09: 8 ajustes paralelos em lote de inventário mantêm cadeia atômica no stock_ledger (10 -> ${batChainFinal?.quantity}, ${batChainLedgers.length} registros encadeados)`
    );

    // CONC-10: 8 parallel wrong recovery-reset attempts enforce strict 5-attempt cap without race overshoot
    await db.collection('users').doc('usr_recover_race').set({
      uid: 'usr_recover_race',
      id: 'usr_recover_race',
      email: 'recover-race@3c.local',
      name: 'Recover Race',
      role: 'CUSTOMER',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      passwordHash: devHash,
      resetCodeHash: hashPassword('ABCD1234'),
      resetCodeExpiresAt: '2035-01-01T00:00:00.000Z',
      resetAttempts: 0,
      tokenVersion: 1,
    });
    const recRaceResps = await Promise.all(
      Array.from({ length: 8 }, () =>
        fetch(`${baseUrl}/api/v1/auth/recover-reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'recover-race@3c.local',
            code: 'WRONG999',
            newPassword: 'HackedPassword#99',
          }),
        })
      )
    );
    const rec400 = recRaceResps.filter((r) => r.status === 400).length;
    const rec429 = recRaceResps.filter((r) => r.status === 429).length;
    const recUserAfter = (await db.collection('users').doc('usr_recover_race').get()).data();
    const recEvenValidBlocked = await fetch(`${baseUrl}/api/v1/auth/recover-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'recover-race@3c.local',
        code: 'ABCD1234',
        newPassword: 'ValidAfterLock#99',
      }),
    });
    check(
      rec400 === 5 &&
        rec429 === 3 &&
        recUserAfter?.resetAttempts === 5 &&
        recEvenValidBlocked.status === 429,
      `CONC-10: 8 tentativas paralelas de recover-reset param estritamente em 5 (${rec400} x 400, ${rec429} x 429) e bloqueiam código real com 429`
    );

    // SEC-07: Cross-caller Idempotency-Key isolation + recursive prototype pollution strip on Store/Admin/Commerce
    const sharedCallerIdemKey = generateIdempotencyKey();
    const callerOrder1Res = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
        'Idempotency-Key': sharedCallerIdemKey,
      },
      body: `{"storeId":"${storeActive}","channel":"POS","deliveryModality":"PICKUP","paymentMethod":"PIX","items":[{"menuItemId":"prd_heavy_return","quantity":1}],"__proto__":{"pwnedHeavy":true}}`,
    });
    const callerOrder2Res = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${consumerToken}`,
        'Idempotency-Key': sharedCallerIdemKey,
      },
      body: JSON.stringify({
        storeId: storeActive,
        channel: 'MARKETPLACE',
        deliveryModality: 'PICKUP',
        paymentMethod: 'PIX',
        items: [{ menuItemId: 'prd_heavy_return', quantity: 1 }],
      }),
    });
    const callerOrder1Json = await callerOrder1Res.json();
    const callerOrder2Json = await callerOrder2Res.json();

    const [protoInvRes, protoGovRes, protoIntRes] = await Promise.all([
      fetch(`${baseUrl}/api/v1/store/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: `{"id":"bat_proto_safe","storeId":"${storeActive}","sku":"SKU-SAFE","name":"Lote Limpo","quantity":2,"__proto__":{"pwnedHeavy":true},"meta":{"constructor":{"evil":1}}}`,
      }),
      fetch(`${baseUrl}/api/v1/admin/governance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${devToken}` },
        body: '{"allowPublicRegistration":true,"__proto__":{"pwnedHeavy":true},"nested":{"prototype":{"evil":1}}}',
      }),
      fetch(`${baseUrl}/api/v1/admin/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${devToken}` },
        body: '{"id":"int_proto_safe","name":"Gateway Limpo","provider":"PAGARME","__proto__":{"pwnedHeavy":true},"config":{"constructor":{"evil":1}}}',
      }),
    ]);
    const batProtoDoc = (await db.collection('inventory_batches').doc('bat_proto_safe').get()).data();
    const intProtoDoc = (await db.collection('integrations').doc('int_proto_safe').get()).data();

    check(
      callerOrder1Res.status === 201 &&
        callerOrder2Res.status === 201 &&
        Boolean(callerOrder1Json.transaction?.orderId) &&
        Boolean(callerOrder2Json.transaction?.orderId) &&
        callerOrder1Json.transaction?.orderId !== callerOrder2Json.transaction?.orderId &&
        protoInvRes.status === 200 &&
        protoGovRes.status === 200 &&
        (protoIntRes.status === 200 || protoIntRes.status === 201) &&
        ({} as any).pwnedHeavy === undefined &&
        !Object.prototype.hasOwnProperty.call(batProtoDoc || {}, '__proto__') &&
        batProtoDoc?.meta?.constructor === Object &&
        !Object.prototype.hasOwnProperty.call(intProtoDoc || {}, '__proto__'),
      'SEC-07: Idempotency-Key isolada entre usuários distintos e sanitização recursiva de __proto__/constructor em Store/Admin/Commerce',
      `statuses=[${callerOrder1Res.status},${callerOrder2Res.status},${protoInvRes.status},${protoGovRes.status},${protoIntRes.status}]`
    );

    // SEC-08: Lazy waiter-pairing PIN generation race + regenerate event ID consistency + Store PUT outbox
    await db.collection('stores').doc('str_pin_race').set({
      id: 'str_pin_race',
      tenantId: tenantActive,
      name: 'Loja PIN Race',
      category: 'RESTAURANT',
      isOpen: true,
      status: 'ACTIVE',
    });
    const pinRaceResps = await Promise.all(
      Array.from({ length: 6 }, () =>
        fetch(`${baseUrl}/api/v1/store/str_pin_race/waiter-pairing`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        }).then((r) => r.json())
      )
    );
    const uniquePins = new Set(pinRaceResps.map((p) => p.pin).filter(Boolean));
    const regenResp = await fetch(`${baseUrl}/api/v1/store/str_pin_race/waiter-pairing/regenerate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const regenEvents = (await db.collection('events').get()).docs.filter(
      (d) => d.data()?.type === 'WAITER_PAIRING_PIN_REGENERATED' && String(d.data()?.payload || '').includes('str_pin_race')
    );
    const storePutOutbox = (await db.collection('sync_outbox').get()).docs
      .map((d) => d.data())
      .some((o) => o.entity === 'stores' && o.entityId === storeActive);

    check(
      pinRaceResps.length === 6 &&
        uniquePins.size === 1 &&
        regenResp.status === 200 &&
        regenEvents.length === 1 &&
        regenEvents[0].id === regenEvents[0].data()?.id &&
        storePutOutbox,
      `SEC-08: 6 leituras paralelas de PIN geram exatamente 1 código (${Array.from(uniquePins)[0]}), evento regen mantém ID consistente e PUT /store grava outbox`
    );

    // =========================================================================
    // GROUP 5: ROUND 4 DEVICE PAIRING ATOMICITY, EDGE HIJACKING & EDGE IDEMPOTENCY
    // =========================================================================
    // CONC-11: Device one-time pairing replay race + parallel wrong-PIN brute-force lockout race
    const devRegRes = await fetch(`${baseUrl}/api/v1/store/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        id: 'dev_heavy_pair_race',
        storeId: storeActive,
        name: 'PDV Pairing Race',
        type: 'POS',
      }),
    });
    const devRegJson = await devRegRes.json();
    const initialPairCode = devRegJson.device?.pairingCode;

    const pairReplayRace = await Promise.all(
      Array.from({ length: 8 }, () =>
        fetch(`${baseUrl}/api/v1/store/devices/dev_heavy_pair_race/pair`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pairingCode: initialPairCode }),
        })
      )
    );
    const pair200 = pairReplayRace.filter((r) => r.status === 200).length;
    const pair409 = pairReplayRace.filter((r) => r.status === 409).length;

    const devLockRegRes = await fetch(`${baseUrl}/api/v1/store/devices/dev_heavy_pair_race/regenerate-pairing`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const devLockRegJson = await devLockRegRes.json();
    const regeneratedPairCode = devLockRegJson.pairingCode;

    const wrongPairRace = await Promise.all(
      Array.from({ length: 8 }, () =>
        fetch(`${baseUrl}/api/v1/store/devices/dev_heavy_pair_race/pair`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pairingCode: '3C-WRONG999999' }),
        })
      )
    );
    const wrong401 = wrongPairRace.filter((r) => r.status === 401).length;
    const wrong429 = wrongPairRace.filter((r) => r.status === 429).length;
    const lockedDeviceDoc = (await db.collection('device_licenses').doc('dev_heavy_pair_race').get()).data();
    const pairAfterLockRes = await fetch(`${baseUrl}/api/v1/store/devices/dev_heavy_pair_race/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairingCode: regeneratedPairCode }),
    });

    check(
      devRegRes.status === 200 &&
        Boolean(initialPairCode) &&
        pair200 === 1 &&
        pair409 === 7 &&
        wrong401 === 4 &&
        wrong429 === 4 &&
        lockedDeviceDoc?.pairingAttempts === 5 &&
        pairAfterLockRes.status === 429,
      `CONC-11: Pareamento único paralelo (${pair200} OK / ${pair409} x 409) e brute-force paralelo bloqueado exatamente em 5 tentativas (${wrong401} x 401, ${wrong429} x 429)`
    );

    // SEC-09: Cross-tenant Edge Node register/heartbeat hijacking & /sync/push storeId tenant spoofing
    const ownerEdgeRegRes = await fetch(`${baseUrl}/api/v1/sync/edge/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        nodeId: 'edg_owned_heavy',
        storeId: storeActive,
        hostname: 'edge-matriz-heavy',
      }),
    });
    const hijackRegRes = await fetch(`${baseUrl}/api/v1/sync/edge/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${quotaOwnerToken}` },
      body: JSON.stringify({
        nodeId: 'edg_owned_heavy',
        storeId: storeQuota,
        hostname: 'hijacked-edge',
      }),
    });
    const hijackHbRes = await fetch(`${baseUrl}/api/v1/sync/edge/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${quotaOwnerToken}` },
      body: JSON.stringify({
        nodeId: 'edg_owned_heavy',
        storeId: storeQuota,
      }),
    });
    const spoofPushRes = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${quotaOwnerToken}` },
      body: JSON.stringify({
        nodeId: 'web_quota_local',
        mutations: [
          {
            entity: 'menu_items',
            entityId: 'prd_spoof_cross_store',
            operation: 'UPSERT',
            idempotencyKey: generateIdempotencyKey(),
            payload: { id: 'prd_spoof_cross_store', storeId: storeActive, name: 'Spoofed Store Item', price: 10 },
          },
        ],
      }),
    });
    const spoofPushJson: any = await spoofPushRes.json();
    const ownedEdgeDoc = (await db.collection('edge_nodes').doc('edg_owned_heavy').get()).data();

    check(
      ownerEdgeRegRes.status === 201 &&
        hijackRegRes.status === 403 &&
        hijackHbRes.status === 403 &&
        ownedEdgeDoc?.tenantId === tenantActive &&
        ownedEdgeDoc?.storeId === storeActive &&
        spoofPushJson.rejected?.some((r: any) => r.entityId === 'prd_spoof_cross_store' && r.reason === 'TENANT_MISMATCH'),
      'SEC-09: Bloqueia sequestro cross-tenant de Edge Node (/edge/register & /edge/heartbeat 403) e spoofing de storeId no /sync/push'
    );

    // EDGE-07: Edge caller-scoped order_idempotency_keys + prototype pollution sanitization on Edge orders & inventory
    await edgeRuntimeReopened.driver.updateDoc('menu_items', 'prd_edge_heavy', { stock: 4 });
    const sharedEdgeCallerKey = generateIdempotencyKey();
    const edgeCaller1Res = await fetch(`${edgeReopenedBaseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
        'Idempotency-Key': sharedEdgeCallerKey,
      },
      body: `{"storeId":"${storeActive}","channel":"POS","deliveryModality":"PICKUP","paymentMethod":"PIX","items":[{"menuItemId":"prd_edge_heavy","quantity":1}],"__proto__":{"pwnedEdgeHeavy":true}}`,
    });
    const edgeCaller2Res = await fetch(`${edgeReopenedBaseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${devToken}`,
        'Idempotency-Key': sharedEdgeCallerKey,
      },
      body: JSON.stringify({
        storeId: storeActive,
        channel: 'POS',
        deliveryModality: 'PICKUP',
        paymentMethod: 'PIX',
        items: [{ menuItemId: 'prd_edge_heavy', quantity: 1 }],
      }),
    });
    const edgeInvProtoRes = await fetch(`${edgeReopenedBaseUrl}/api/v1/store/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: '{"batchId":"bat_edge_proto_clean","sku":"SKU-EDGE-SAFE","name":"Insumo Edge Seguro","quantityDelta":5,"__proto__":{"pwnedEdgeHeavy":true}}',
    });
    const edgeCaller1Json = await edgeCaller1Res.json();
    const edgeCaller2Json = await edgeCaller2Res.json();
    const edgeProtoBatch = await edgeRuntimeReopened.driver.getDoc<any>('inventory_batches', 'bat_edge_proto_clean');

    check(
      edgeCaller1Res.status === 201 &&
        edgeCaller2Res.status === 201 &&
        Boolean(edgeCaller1Json.transaction?.orderId) &&
        Boolean(edgeCaller2Json.transaction?.orderId) &&
        edgeCaller1Json.transaction?.orderId !== edgeCaller2Json.transaction?.orderId &&
        edgeInvProtoRes.status === 200 &&
        ({} as any).pwnedEdgeHeavy === undefined &&
        !Object.prototype.hasOwnProperty.call(edgeProtoBatch || {}, '__proto__'),
      'EDGE-07: Edge isola Idempotency-Key por usuário e remove __proto__ em pedidos/inventário SQLite WAL'
    );

    // EDGE-08: Sincronização Edge ao atingir limite de 50 páginas com hasMore=true define PARTIAL_PENDING e agenda dreno
    let mockPageCounter = 0;
    const mockSyncServer = http.createServer((req, res) => {
      if (req.url?.startsWith('/api/v1/sync/pull')) {
        mockPageCounter++;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            entries: [
              {
                entity: 'menu_items',
                entityId: 'prd_mock_paginated',
                operation: 'UPSERT',
                payload: { id: 'prd_mock_paginated', name: 'Paginated Item', storeId: storeActive },
                hlc: `2026-01-01T00:00:00.${String(mockPageCounter).padStart(3, '0')}Z:001`,
              },
            ],
            hasMore: true,
            nextHlc: `2026-01-01T00:00:00.${String(mockPageCounter).padStart(3, '0')}Z:002`,
          })
        );
        return;
      }
      if (req.url?.startsWith('/api/v1/sync/push')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ accepted: [], rejected: [] }));
        return;
      }
      if (req.url?.startsWith('/api/v1/sync/edge/heartbeat')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => mockSyncServer.listen(0, '127.0.0.1', () => resolve()));
    const mockSyncPort = (mockSyncServer.address() as { port: number }).port;
    const mockSyncUrl = `http://127.0.0.1:${mockSyncPort}`;

    const edgePaginationRuntime = new EdgeNodeRuntime({
      storeId: storeActive,
      tenantId: tenantActive,
      dbPath: path.join(tempDir, 'edge-pagination.sqlite'),
      port: 0,
      cloudBaseUrl: mockSyncUrl,
    });
    const pagSyncRes = await edgePaginationRuntime.syncWithCloud(mockSyncUrl, ownerToken);
    const pagSyncStateAfter = edgePaginationRuntime.getSyncState();
    await edgePaginationRuntime.close();
    (mockSyncServer as any).closeAllConnections?.();
    await new Promise<void>((resolve) => mockSyncServer.close(() => resolve()));

    check(
      pagSyncRes.hasMore === true &&
        pagSyncRes.syncState === 'PARTIAL_PENDING' &&
        pagSyncStateAfter === 'PARTIAL_PENDING' &&
        mockPageCounter === 50,
      'EDGE-08: Sincronização Edge ao atingir limite de 50 páginas com hasMore=true define status PARTIAL_PENDING e agenda dreno'
    );

    // SEC-10: Redacted fields cannot be oracle-queried on /generic/:collection + STORE_OWNER cannot bypass branch quota via /generic/stores/:id
    await db.collection('stores').doc(storeActive).set({ waiterPairingPin: '4921' }, { merge: true });
    await db.collection('menu_items').doc('prd_heavy_return').set({ costPrice: 12.34 }, { merge: true });
    const [pinOracleRes, costOracleRes, protoFilterRes, bypassStoreRes, updateOwnStoreRes] = await Promise.all([
      fetch(`${baseUrl}/api/v1/generic/stores?waiterPairingPin=4921`, {
        headers: { Authorization: `Bearer ${consumerToken}` },
      }),
      fetch(`${baseUrl}/api/v1/generic/menu_items?costPrice=12.34`, {
        headers: { Authorization: `Bearer ${consumerToken}` },
      }),
      fetch(`${baseUrl}/api/v1/generic/stores?toString=foo`, {
        headers: { Authorization: `Bearer ${consumerToken}` },
      }),
      fetch(`${baseUrl}/api/v1/generic/stores/store_quota_bypass_01`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ data: { name: 'Bypass Store' }, merge: true }),
      }),
      fetch(`${baseUrl}/api/v1/generic/stores/${storeActive}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({ data: { deliveryFee: 9 }, merge: true }),
      }),
    ]);
    const [pinOracleJson, costOracleJson, protoFilterJson] = await Promise.all([
      pinOracleRes.json(),
      costOracleRes.json(),
      protoFilterRes.json(),
    ]);
    const bypassStoreDoc = await db.collection('stores').doc('store_quota_bypass_01').get();

    check(
      pinOracleRes.status === 200 &&
        Array.isArray(pinOracleJson) &&
        pinOracleJson.length === 0 &&
        costOracleRes.status === 200 &&
        Array.isArray(costOracleJson) &&
        costOracleJson.length === 0 &&
        protoFilterRes.status === 200 &&
        Array.isArray(protoFilterJson) &&
        protoFilterJson.length === 0 &&
        bypassStoreRes.status === 403 &&
        !bypassStoreDoc.exists &&
        updateOwnStoreRes.status === 200,
      'SEC-10: /generic filtra apenas após sanitizar campos privados (sem oracle de waiterPairingPin/costPrice) e bloqueia criação direta de lojas (403)'
    );
  } finally {
    if (edgeRuntime) await edgeRuntime.close();
    if (edgeRuntimeReopened) await edgeRuntimeReopened.close();
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore temp cleanup errors
    }
  }

  console.log(`\nResultado Sentinel Heavy: ${passed} aprovados, ${failed} falhas.`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
