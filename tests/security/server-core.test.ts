import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-core-sec-'));
if (!process.env.SERVER_DB_PATH) process.env.SERVER_DB_PATH = path.join(tempDir, 'core-test-db.json');
if (!process.env.SERVER_SECRET_PATH) process.env.SERVER_SECRET_PATH = path.join(tempDir, '.server-secret');
if (!process.env.SERVER_SECRET) process.env.SERVER_SECRET = '3c_core_sec_isolated_secret_2026';

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
  console.log('⚙️  PILAR 4 (SERVER CORE) — CONTRATOS, SEGURANÇA, QUOTAS & EDGE');
  console.log('======================================================================\n');

  const app = createServerCoreApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const edgeSqlitePath = path.join(tempDir, 'edge-core-test.sqlite');
  let edgeRuntime: any = null;

  try {
    // Seed active tenants, users & stores
    await db.collection('tenants').doc('tenant-1').set({ id: 'tenant-1', name: '3C Matriz', status: 'ACTIVE' });
    await db.collection('tenants').doc('tenant-rival').set({ id: 'tenant-rival', name: 'Rival S.A.', status: 'ACTIVE' });

    await db.collection('users').doc('usr-dev-master').set({
      uid: 'usr-dev-master',
      id: 'usr-dev-master',
      email: '3eatcru@gmail.com',
      name: 'Master HQ',
      role: 'DEV_OWNER',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      tokenVersion: 1,
      passwordHash: hashPassword('MasterPass!2026'),
    });

    await db.collection('users').doc('usr-cust-1').set({
      uid: 'usr-cust-1',
      id: 'usr-cust-1',
      email: 'cliente@teste.com',
      name: 'Cliente Teste',
      role: 'CUSTOMER',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      tokenVersion: 1,
    });

    await db.collection('users').doc('usr-mgr-b1').set({
      uid: 'usr-mgr-b1',
      id: 'usr-mgr-b1',
      email: 'gerente.b1@teste.com',
      name: 'Gerente Filial 1',
      role: 'STORE_MANAGER',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      status: 'ACTIVE',
      tokenVersion: 1,
    });

    await db.collection('users').doc('usr-staff-t2').set({
      uid: 'usr-staff-t2',
      id: 'usr-staff-t2',
      email: 'staff.t2@teste.com',
      name: 'Staff Rival',
      role: 'STORE_MANAGER',
      tenantId: 'tenant-rival',
      storeId: 'store-rival',
      status: 'ACTIVE',
      tokenVersion: 1,
    });

    await db.collection('stores').doc('store-1').set({
      id: 'store-1',
      tenantId: 'tenant-1',
      name: 'Loja Matriz',
      slug: 'loja-matriz',
      category: 'RESTAURANT',
      isOpen: true,
    });

    await db.collection('stores').doc('store-2').set({
      id: 'store-2',
      tenantId: 'tenant-1',
      name: 'Loja Filial 2',
      slug: 'loja-filial-2',
      category: 'RESTAURANT',
      isOpen: true,
    });

    await db.collection('menu_items').doc('item-1').set({
      id: 'item-1',
      storeId: 'store-1',
      tenantId: 'tenant-1',
      name: 'Burger Teste',
      price: 25,
      isAvailable: true,
    });

    await db.collection('stores').doc('store-quota-test').set({
      id: 'store-quota-test',
      tenantId: 'tenant-1',
      name: 'Loja Quota Teste',
      slug: 'loja-quota-teste',
      category: 'RESTAURANT',
      subscriptionPlan: 'FREE',
      maxAllowedDevices: 2,
      maxAllowedBranches: 2,
      isOpen: true,
    });

    await db.collection('stores').doc('store-rival').set({
      id: 'store-rival',
      tenantId: 'tenant-rival',
      name: 'Loja Rival',
      slug: 'loja-rival',
      category: 'RESTAURANT',
      isOpen: true,
    });

    const tokDev = auth.generateDevToken({
      uid: 'usr-dev-master',
      email: '3eatcru@gmail.com',
      role: 'DEV_OWNER',
      tenantId: 'tenant-1',
      tokenVersion: 1,
    });
    const tokCustomer = auth.generateDevToken({
      uid: 'usr-cust-1',
      email: 'cliente@teste.com',
      role: 'CUSTOMER',
      tenantId: 'tenant-1',
      tokenVersion: 1,
    });
    const tokMgrStore1 = auth.generateDevToken({
      uid: 'usr-mgr-b1',
      email: 'gerente.b1@teste.com',
      role: 'STORE_MANAGER',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      tokenVersion: 1,
    });
    const tokStaffRival = auth.generateDevToken({
      uid: 'usr-staff-t2',
      email: 'staff.t2@teste.com',
      role: 'STORE_MANAGER',
      tenantId: 'tenant-rival',
      storeId: 'store-rival',
      tokenVersion: 1,
    });

    // 1. CORS Preflight must allow RFC-001 X-3C-* and Idempotency-Key headers
    const preflightResp = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'tauri://localhost',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization, X-3C-Contract-Version, X-3C-App-Id, X-3C-Platform, Idempotency-Key',
      },
    });
    const allowHeaders = preflightResp.headers.get('access-control-allow-headers') || '';
    const allowOrigin = preflightResp.headers.get('access-control-allow-origin') || '';
    check(
      preflightResp.status === 204 &&
        allowOrigin === 'tauri://localhost' &&
        allowHeaders.includes('X-3C-Contract-Version') &&
        allowHeaders.includes('X-3C-App-Id') &&
        allowHeaders.includes('Idempotency-Key'),
      '1. CORS Preflight libera headers RFC-001 (X-3C-*, Idempotency-Key) para Web/Tauri/Capacitor',
      `status=${preflightResp.status}, allowOrigin=${allowOrigin}`
    );

    // 2. Honest persistence reporting on /api/v1/health when mirror is isolated/disabled
    const healthResp = await fetch(`${baseUrl}/api/v1/health`);
    const healthJson: any = await healthResp.json();
    check(
      healthResp.status === 200 &&
        healthJson.productionDatabaseReady === false &&
        healthJson.cloudProbeVerified === false &&
        healthJson.persistenceMode === 'SANDBOX_LOCAL' &&
        healthJson.persistenceDriver === 'json-memory',
      '2. Health reporta estado honesto de persistência local (SANDBOX_LOCAL / json-memory sem falso-positivo Cloud)',
      `driver=${healthJson.persistenceDriver}, mode=${healthJson.persistenceMode}, prodReady=${healthJson.productionDatabaseReady}`
    );

    // 3. CUSTOMER blocked from internal staff POS channel even within tenant-1
    const posSpoofResp = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCustomer}` },
      body: JSON.stringify({
        storeId: 'store-1',
        channel: 'POS',
        items: [{ menuItemId: 'item-1', quantity: 1 }],
      }),
    });
    check(
      posSpoofResp.status === 403,
      '3. CUSTOMER bloqueado ao tentar forjar canal interno POS (HTTP 403)',
      `status=${posSpoofResp.status}`
    );

    // 4. CUSTOMER blocked from operational listings (/drivers, /devices, /sync/edge/nodes, /sync/stock-ledger)
    const [drvCust, devCust, edgCust, ldgCust] = await Promise.all([
      fetch(`${baseUrl}/api/v1/commerce/drivers`, { headers: { Authorization: `Bearer ${tokCustomer}` } }),
      fetch(`${baseUrl}/api/v1/admin/devices`, { headers: { Authorization: `Bearer ${tokCustomer}` } }),
      fetch(`${baseUrl}/api/v1/sync/edge/nodes`, { headers: { Authorization: `Bearer ${tokCustomer}` } }),
      fetch(`${baseUrl}/api/v1/sync/stock-ledger`, { headers: { Authorization: `Bearer ${tokCustomer}` } }),
    ]);
    check(
      drvCust.status === 403 && devCust.status === 403 && edgCust.status === 403 && ldgCust.status === 403,
      '4. CUSTOMER bloqueado em listagens operacionais (/drivers, /devices, /sync/edge/nodes, /sync/stock-ledger)',
      `statuses=${drvCust.status}/${devCust.status}/${edgCust.status}/${ldgCust.status}`
    );

    // 5. Branch-scoped STORE_MANAGER blocked from querying sibling branch on /sync/*, /store/devices & /admin/devices
    const [syncStatusCross, syncNodesCross, syncLedgerCross, syncRegCross, storeDevCross, adminDevCross] = await Promise.all([
      fetch(`${baseUrl}/api/v1/sync/status?storeId=store-2`, { headers: { Authorization: `Bearer ${tokMgrStore1}` } }),
      fetch(`${baseUrl}/api/v1/sync/edge/nodes?storeId=store-2`, { headers: { Authorization: `Bearer ${tokMgrStore1}` } }),
      fetch(`${baseUrl}/api/v1/sync/stock-ledger?storeId=store-2`, { headers: { Authorization: `Bearer ${tokMgrStore1}` } }),
      fetch(`${baseUrl}/api/v1/sync/edge/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrStore1}` },
        body: JSON.stringify({ storeId: 'store-2', hostname: 'rogue-edge' }),
      }),
      fetch(`${baseUrl}/api/v1/store/devices?storeId=store-2`, { headers: { Authorization: `Bearer ${tokMgrStore1}` } }),
      fetch(`${baseUrl}/api/v1/admin/devices?storeId=store-2`, { headers: { Authorization: `Bearer ${tokMgrStore1}` } }),
    ]);
    check(
      syncStatusCross.status === 403 &&
        syncNodesCross.status === 403 &&
        syncLedgerCross.status === 403 &&
        syncRegCross.status === 403 &&
        storeDevCross.status === 403 &&
        adminDevCross.status === 403,
      '5. STORE_MANAGER restrito à própria filial bloqueado ao consultar/parear filial irmã (HTTP 403)',
      `statuses=${syncStatusCross.status}/${syncNodesCross.status}/${syncLedgerCross.status}/${syncRegCross.status}/${storeDevCross.status}/${adminDevCross.status}`
    );

    // 6. Device quota enforcement & tier-based maxAllowedDevices on /admin/stores/:id/subscription
    const subFreeResp = await fetch(`${baseUrl}/api/v1/admin/stores/store-quota-test/subscription`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ subscriptionPlan: 'FREE' }),
    });
    const subFreeJson: any = await subFreeResp.json();
    const dev1 = await fetch(`${baseUrl}/api/v1/admin/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ storeId: 'store-quota-test', name: 'POS-01', type: 'POS' }),
    });
    const dev2 = await fetch(`${baseUrl}/api/v1/admin/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ storeId: 'store-quota-test', name: 'POS-02', type: 'POS' }),
    });
    const dev3 = await fetch(`${baseUrl}/api/v1/admin/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ storeId: 'store-quota-test', name: 'POS-03', type: 'POS' }),
    });
    check(
      subFreeResp.status === 200 &&
        subFreeJson?.store?.maxAllowedDevices === 2 &&
        dev1.status === 200 &&
        dev2.status === 200 &&
        dev3.status === 403,
      '6. Cota de dispositivos por plano aplicada no backend (FREE=2 permite 2 e bloqueia 3º com 403)',
      `maxDev=${subFreeJson?.store?.maxAllowedDevices}, statuses=${dev1.status}/${dev2.status}/${dev3.status}`
    );

    // 7. STORE_OWNER signup syncs tenants collection with FREE/TRIAL defaults
    const signupResp = await fetch(`${baseUrl}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Novo Lojista Core',
        email: 'lojista.core@teste.com',
        password: 'StrongPassword!2026',
        role: 'STORE_OWNER',
      }),
    });
    const signupJson: any = await signupResp.json();
    const createdTenantDoc = (await db.collection('tenants').doc(signupJson?.user?.tenantId).get()).data();
    const createdStoreDoc = (await db.collection('stores').doc(signupJson?.user?.storeId).get()).data();
    check(
      signupResp.status === 201 &&
        createdTenantDoc?.subscriptionPlan === 'FREE' &&
        createdTenantDoc?.maxAllowedDevices === 2 &&
        createdStoreDoc?.maxAllowedDevices === 2,
      '7. Signup de STORE_OWNER cria registro sincronizado em tenants/{id} com limites FREE/TRIAL',
      `status=${signupResp.status}, tenantPlan=${createdTenantDoc?.subscriptionPlan}, maxDev=${createdTenantDoc?.maxAllowedDevices}`
    );

    // 8. Audit trail (events) cannot be forged or deleted via /generic/events (even by DEV_OWNER) or /sync/push
    const forgeEvtResp = await fetch(`${baseUrl}/api/v1/generic/events/evt-forged-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrStore1}` },
      body: JSON.stringify({ type: 'FAKE_AUDIT', message: 'Forjado' }),
    });
    const forgeEvtDevResp = await fetch(`${baseUrl}/api/v1/generic/events/evt-forged-2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ type: 'FAKE_AUDIT', message: 'Forjado DEV' }),
    });
    const delEvtResp = await fetch(`${baseUrl}/api/v1/generic/events/evt-1`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokDev}` },
    });
    const syncEventsResp = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrStore1}` },
      body: JSON.stringify({
        nodeId: 'web_client_audit',
        storeId: 'store-1',
        mutations: [
          {
            idempotencyKey: 'idm-audit-tamper-1',
            entity: 'events',
            entityId: 'evt-sync-forged',
            operation: 'UPSERT',
            hlc: `${Date.now()}-0001-web_client`,
            payload: { type: 'FORGED' },
          },
        ],
      }),
    });
    const syncEventsJson: any = await syncEventsResp.json();
    check(
      forgeEvtResp.status === 403 &&
        forgeEvtDevResp.status === 403 &&
        delEvtResp.status === 403 &&
        syncEventsJson?.rejected?.some((r: any) => r.entity === 'events' && r.reason === 'IMMUTABLE_AUDIT_COLLECTION'),
      '8. Trilha de auditoria (events) imutável em /generic/events (403) e /sync/push (IMMUTABLE_AUDIT_COLLECTION)',
      `post=${forgeEvtResp.status}/${forgeEvtDevResp.status}, delete=${delEvtResp.status}`
    );

    // 9. Cross-tenant staff blocked from calling /store/tables/request-bill on another tenant's store
    const crossBillResp = await fetch(`${baseUrl}/api/v1/store/tables/request-bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokStaffRival}` },
      body: JSON.stringify({ storeId: 'store-1', tableNumber: 1 }),
    });
    check(
      crossBillResp.status === 403,
      '9. Staff de tenant rival bloqueado em /store/tables/request-bill de outra empresa (403)',
      `status=${crossBillResp.status}`
    );

    // 10. Edge Node rejects negative/fractional/zero quantities with HTTP 400
    edgeRuntime = new EdgeNodeRuntime({
      storeId: 'store-edge-sec',
      tenantId: 'tenant-1',
      nodeId: 'edg_sec_test',
      dbPath: edgeSqlitePath,
      port: 0,
    });
    await edgeRuntime.seedFromCloudSnapshot({
      store: {
        id: 'store-edge-sec',
        tenantId: 'tenant-1',
        name: 'Edge Sec Store',
        category: 'RESTAURANT',
      },
      menuItems: [
        {
          id: 'prd-edge-1',
          tenantId: 'tenant-1',
          storeId: 'store-edge-sec',
          name: 'Café Teste',
          price: 10,
          stock: 10,
          isAvailable: true,
        },
      ],
      tables: [],
      users: [
        {
          uid: 'usr-mgr-edge',
          id: 'usr-mgr-edge',
          email: 'mgr@edge.local',
          name: 'Mgr Edge',
          role: 'STORE_MANAGER',
          tenantId: 'tenant-1',
          storeId: 'store-edge-sec',
          status: 'ACTIVE',
        },
      ],
    });
    const edgePort = await edgeRuntime.listen(0);
    const edgeBaseUrl = `http://127.0.0.1:${edgePort}`;

    const tokEdgeMgr = auth.generateDevToken({
      uid: 'usr-mgr-edge',
      email: 'mgr@edge.local',
      role: 'STORE_MANAGER',
      tenantId: 'tenant-1',
      storeId: 'store-edge-sec',
    });

    const [negQtyResp, zeroQtyResp, floatQtyResp] = await Promise.all([
      fetch(`${edgeBaseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokEdgeMgr}` },
        body: JSON.stringify({ items: [{ menuItemId: 'prd-edge-1', quantity: -5 }] }),
      }),
      fetch(`${edgeBaseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokEdgeMgr}` },
        body: JSON.stringify({ items: [{ menuItemId: 'prd-edge-1', quantity: 0 }] }),
      }),
      fetch(`${edgeBaseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokEdgeMgr}` },
        body: JSON.stringify({ items: [{ menuItemId: 'prd-edge-1', quantity: 1.5 }] }),
      }),
    ]);

    check(
      negQtyResp.status === 400 && zeroQtyResp.status === 400 && floatQtyResp.status === 400,
      '10. Edge Node rejeita quantidades negativas, zero ou fracionárias (HTTP 400 em todas)',
      `statuses=${negQtyResp.status}/${zeroQtyResp.status}/${floatQtyResp.status}`
    );

    // 11. SSE stream rejects query ?token= (401), requires ticket/Bearer for non-PUBLIC tenantId, and blocks cross-tenant access
    const sseNoToken = await fetch(`${baseUrl}/api/v1/sse/stream?tenantId=tenant-1`);
    const sseQueryTokenBlocked = await fetch(
      `${baseUrl}/api/v1/sse/stream?token=${encodeURIComponent(tokMgrStore1)}&tenantId=tenant-1`
    );
    const sseTicketCrossJson: any = await fetch(`${baseUrl}/api/v1/sse/ticket`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokMgrStore1}` },
    }).then((r) => r.json());
    const sseCrossTenant = await fetch(
      `${baseUrl}/api/v1/sse/stream?ticket=${encodeURIComponent(sseTicketCrossJson.ticket)}&tenantId=tenant-rival`
    );
    const sseTicketValidJson: any = await fetch(`${baseUrl}/api/v1/sse/ticket`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokMgrStore1}` },
    }).then((r) => r.json());
    const sseAuthController = new AbortController();
    const sseValidResp = await fetch(
      `${baseUrl}/api/v1/sse/stream?ticket=${encodeURIComponent(sseTicketValidJson.ticket)}&tenantId=tenant-1`,
      { signal: sseAuthController.signal }
    );
    const sseValidType = sseValidResp.headers.get('content-type') || '';
    sseAuthController.abort();
    check(
      sseNoToken.status === 403 &&
        sseQueryTokenBlocked.status === 401 &&
        sseCrossTenant.status === 403 &&
        sseValidResp.status === 200 &&
        sseValidType.includes('text/event-stream'),
      '11. SSE stream rejeita ?token= na URL (401), aceita ticket de uso único para tenant próprio (200) e bloqueia sem credencial ou cross-tenant (403)',
      `noTok=${sseNoToken.status}, queryTok=${sseQueryTokenBlocked.status}, cross=${sseCrossTenant.status}, valid=${sseValidResp.status}`
    );

    // 12. Integrations endpoint strips raw apiKey and persists only masked token
    const saveIntegResp = await fetch(`${baseUrl}/api/v1/admin/integrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        id: 'int-mask-test',
        name: 'Gateway Secreto Teste',
        category: 'PAYMENT',
        apiKey: 'sk_live_super_secret_12345',
      }),
    });
    const saveIntegJson: any = await saveIntegResp.json();
    const storedIntegDoc = (await db.collection('integrations').doc('int-mask-test').get()).data();
    check(
      saveIntegResp.status === 200 &&
        saveIntegJson?.integration?.apiKey === undefined &&
        saveIntegJson?.integration?.apiKeyMasked === 'sk_l••••••••' &&
        storedIntegDoc?.apiKey === undefined &&
        storedIntegDoc?.apiKeyMasked === 'sk_l••••••••',
      '12. Integração remove apiKey em texto puro da resposta e do banco, mantendo apenas apiKeyMasked',
      `respMasked=${saveIntegJson?.integration?.apiKeyMasked}, dbHasRaw=${storedIntegDoc?.apiKey !== undefined}`
    );

    // 13. Strict corporate tenant validation (no 'tenant-1' fallback, nonexistent tenant rejected)
    await db.collection('users').doc('usr-ghost-tenant').set({
      uid: 'usr-ghost-tenant',
      id: 'usr-ghost-tenant',
      email: 'ghost.tenant@teste.com',
      name: 'Ghost Tenant Owner',
      role: 'STORE_OWNER',
      tenantId: 'tenant-inexistente',
      status: 'ACTIVE',
      tokenVersion: 1,
    });
    await db.collection('users').doc('usr-no-tenant').set({
      uid: 'usr-no-tenant',
      id: 'usr-no-tenant',
      email: 'notenant@teste.com',
      name: 'No Tenant Owner',
      role: 'STORE_OWNER',
      status: 'ACTIVE',
      tokenVersion: 1,
    });
    const tokGhostTenant = auth.generateDevToken({
      uid: 'usr-ghost-tenant',
      email: 'ghost.tenant@teste.com',
      role: 'STORE_OWNER',
      tenantId: 'tenant-inexistente',
      tokenVersion: 1,
    });
    const tokNoTenant = auth.generateDevToken({
      uid: 'usr-no-tenant',
      email: 'notenant@teste.com',
      role: 'STORE_OWNER',
      tokenVersion: 1,
    });
    const [ghostTenantResp, noTenantResp, ghostStaffResp] = await Promise.all([
      fetch(`${baseUrl}/api/v1/store/list`, {
        headers: { Authorization: `Bearer ${tokGhostTenant}` },
      }).then(async () =>
        fetch(`${baseUrl}/api/v1/store/devices`, { headers: { Authorization: `Bearer ${tokGhostTenant}` } })
      ),
      fetch(`${baseUrl}/api/v1/store/devices`, { headers: { Authorization: `Bearer ${tokNoTenant}` } }),
      fetch(`${baseUrl}/api/v1/store/staff`, { headers: { Authorization: `Bearer ${tokGhostTenant}` } }),
    ]);
    check(
      ghostTenantResp.status === 403 && noTenantResp.status === 403 && ghostStaffResp.status === 403,
      '13. Validação estrita de tenant bloqueia usuário corporativo sem tenant ou com tenant inexistente (403)',
      `ghost=${ghostTenantResp.status}, missing=${noTenantResp.status}, staff=${ghostStaffResp.status}`
    );

    // 14. Production sandbox blocker (503 on API when NODE_ENV=production without Cloud Primary) + resetToSeeds block
    const prevNodeEnv = process.env.NODE_ENV;
    let prodBlockedStatus = 0;
    let resetThrewInProd = false;
    try {
      process.env.NODE_ENV = 'production';
      const prodBlockedResp = await fetch(`${baseUrl}/api/v1/admin/governance`, {
        headers: { Authorization: `Bearer ${tokDev}` },
      });
      prodBlockedStatus = prodBlockedResp.status;
      try {
        await db.resetToSeeds();
      } catch {
        resetThrewInProd = true;
      }
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }
    check(
      prodBlockedStatus === 503 && resetThrewInProd,
      '14. Bloqueio de SANDBOX_LOCAL em produção retorna HTTP 503 na API e bloqueia db.resetToSeeds()',
      `prodStatus=${prodBlockedStatus}, resetBlocked=${resetThrewInProd}`
    );

    // 15. Edge Node sync observability (minimal public /health + full telemetry on authenticated /sync/status)
    const edgeHealthResp = await fetch(`${edgeBaseUrl}/api/v1/health`);
    const edgeHealthJson: any = await edgeHealthResp.json();
    const edgeSyncStatusResp = await fetch(`${edgeBaseUrl}/api/v1/sync/status`, {
      headers: { Authorization: `Bearer ${tokEdgeMgr}` },
    });
    const edgeSyncStatusJson: any = await edgeSyncStatusResp.json();
    check(
      edgeHealthResp.status === 200 &&
        typeof edgeHealthJson.syncState === 'string' &&
        typeof edgeHealthJson.cloudLinkStatus === 'string' &&
        !('nodeId' in edgeHealthJson) &&
        !('tenantId' in edgeHealthJson) &&
        !('lastSyncError' in edgeHealthJson) &&
        edgeSyncStatusResp.status === 200 &&
        'lastSyncAttemptAt' in edgeSyncStatusJson &&
        'lastSyncError' in edgeSyncStatusJson &&
        typeof edgeSyncStatusJson.unresolvedConflictsCount === 'number' &&
        edgeSyncStatusJson.nodeId === 'edg_sec_test',
      '15. Edge Node expõe /health público mínimo e telemetria completa em /sync/status autenticado',
      `syncState=${edgeHealthJson.syncState}, link=${edgeHealthJson.cloudLinkStatus}, statusCode=${edgeSyncStatusResp.status}`
    );

    // 16. Zero-Firebase verification (/api/v1/auth/firebase removed -> 404, governance uses databaseStatus/serverCollections)
    const fbRouteResp = await fetch(`${baseUrl}/api/v1/auth/firebase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'fake' }),
    });
    const govResp = await fetch(`${baseUrl}/api/v1/admin/governance`, {
      headers: { Authorization: `Bearer ${tokDev}` },
    });
    const govJson: any = await govResp.json();
    check(
      fbRouteResp.status === 404 &&
        !('firebaseAuthReady' in healthJson) &&
        !('firestoreCredentialsReady' in healthJson) &&
        govResp.status === 200 &&
        govJson?.databaseStatus === 'CONNECTED' &&
        Array.isArray(govJson?.serverCollections) &&
        !('firestoreStatus' in govJson) &&
        !('firestoreCollections' in govJson),
      '16. Zero Firebase em rotas (/auth/firebase=404), /health e /admin/governance (databaseStatus/serverCollections)',
      `fbStatus=${fbRouteResp.status}, govStatus=${govResp.status}, dbStatus=${govJson?.databaseStatus}`
    );

    // 17. Gemini proxy auth + feature flag guard + offline deterministic fallback
    const prevGeminiKey = process.env.GEMINI_API_KEY;
    let aiUnauthStatus = 0;
    let aiDescRespStatus = 0;
    let aiDescJson: any = null;
    let aiPricingRespStatus = 0;
    let aiPricingParsed: any = null;
    let aiDisabledStatus = 0;
    try {
      delete process.env.GEMINI_API_KEY;
      const rUnauth = await fetch(`${baseUrl}/api/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Teste sem token' }),
      });
      aiUnauthStatus = rUnauth.status;

      const r1 = await fetch(`${baseUrl}/api/gemini`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokDev}`,
        },
        body: JSON.stringify({ prompt: 'Gere uma descrição curta para o prato "Burger Artesanal"' }),
      });
      aiDescRespStatus = r1.status;
      aiDescJson = await r1.json();

      const r2 = await fetch(`${baseUrl}/api/gemini`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokDev}`,
        },
        body: JSON.stringify({ prompt: 'Engenharia de Menu e Precificação Custo de Produção (CMV): R$ 20.00' }),
      });
      aiPricingRespStatus = r2.status;
      const r2Json: any = await r2.json();
      aiPricingParsed = JSON.parse(r2Json?.text || '{}');

      // Disable AI engine via governance and assert 403
      await fetch(`${baseUrl}/api/v1/admin/governance`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokDev}`,
        },
        body: JSON.stringify({
          featureFlags: {
            ...(govJson?.featureFlags || {}),
            aiEngineEnabled: false,
          },
        }),
      });
      const rDisabled = await fetch(`${baseUrl}/api/gemini`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokDev}`,
        },
        body: JSON.stringify({ prompt: 'Gere uma descrição curta para o prato "Burger Artesanal"' }),
      });
      aiDisabledStatus = rDisabled.status;

      // Restore AI engine governance flag
      await fetch(`${baseUrl}/api/v1/admin/governance`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokDev}`,
        },
        body: JSON.stringify({
          featureFlags: {
            ...(govJson?.featureFlags || {}),
            aiEngineEnabled: true,
          },
        }),
      });
    } finally {
      if (prevGeminiKey !== undefined) {
        process.env.GEMINI_API_KEY = prevGeminiKey;
      }
    }
    check(
      aiUnauthStatus === 401 &&
        aiDescRespStatus === 200 &&
        aiDescJson?.source === 'OFFLINE_DETERMINISTIC_FALLBACK' &&
        typeof aiDescJson?.text === 'string' &&
        aiDescJson.text.includes('Burger Artesanal') &&
        aiPricingRespStatus === 200 &&
        Number(aiPricingParsed?.suggestedPrice) > 0 &&
        typeof aiPricingParsed?.justification === 'string' &&
        aiDisabledStatus === 403,
      '17. Gemini /api/gemini exige autenticação (401), respeita feature flag (403) e opera offline autenticado (200)',
      `unauth=${aiUnauthStatus}, statuses=${aiDescRespStatus}/${aiPricingRespStatus}, disabled=${aiDisabledStatus}, price=${aiPricingParsed?.suggestedPrice}`
    );

    // 18. City Maps Data & Maps Geo API (/city-index RBAC, /nominatim/reverse guard, /city-directory)
    const [revBadResp, idxUnauthResp, idxCustResp, idxMgrResp] = await Promise.all([
      fetch(`${baseUrl}/api/v1/maps/nominatim/reverse?lat=999&lon=999`),
      fetch(`${baseUrl}/api/v1/maps/city-index`),
      fetch(`${baseUrl}/api/v1/maps/city-index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCustomer}` },
        body: JSON.stringify({ stateUf: 'PR', city: 'Londrina', street: 'Av. Higienópolis' }),
      }),
      fetch(`${baseUrl}/api/v1/maps/city-index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrStore1}` },
        body: JSON.stringify({ stateUf: 'PR', city: 'Londrina', street: 'Av. Higienópolis' }),
      }),
    ]);

    const idxCreateResp = await fetch(`${baseUrl}/api/v1/maps/city-index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        id: 'cmd-sec-test-londrina',
        stateUf: 'PR',
        city: 'Londrina',
        region: 'CENTRO',
        neighborhood: 'Jardim Higienópolis',
        street: 'Avenida Higienópolis',
        houseNumber: '1200',
        cep: '86015-010',
        lat: -23.314409,
        lng: -51.165572,
      }),
    });
    const idxCreateJson: any = await idxCreateResp.json();

    const dirResp = await fetch(`${baseUrl}/api/v1/maps/city-directory?uf=PR&city=Londrina&number=1200`);
    const dirJson: any = await dirResp.json();
    const hasCreatedRow = Array.isArray(dirJson?.rows) && dirJson.rows.some((r: any) => r.id === 'cmd-sec-test-londrina');

    const idxDeleteResp = await fetch(`${baseUrl}/api/v1/maps/city-index/cmd-sec-test-londrina`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokDev}` },
    });
    const idxDeleteJson: any = await idxDeleteResp.json();

    check(
      revBadResp.status === 400 &&
        idxUnauthResp.status === 401 &&
        idxCustResp.status === 403 &&
        idxMgrResp.status === 403 &&
        idxCreateResp.status === 201 &&
        idxCreateJson?.item?.id === 'cmd-sec-test-londrina' &&
        dirResp.status === 200 &&
        hasCreatedRow &&
        idxDeleteResp.status === 200 &&
        idxDeleteJson?.deleted === true,
      '18. City Maps Data protege /city-index (401/403/DEV_OWNER CRUD), valida coordenadas (400) e filtra /city-directory',
      `revBad=${revBadResp.status}, unauth=${idxUnauthResp.status}, rbac=${idxCustResp.status}/${idxMgrResp.status}, create=${idxCreateResp.status}, dir=${dirResp.status}/${hasCreatedRow}, del=${idxDeleteResp.status}`
    );

    // 19. Auditoria P0 (C1-C5): Generic bypass, SSE isolation, HQ boundary, App-Id/blockedApps/logout & AI Kill Switch
    // C1: Generic route blocks transactional collections & consumer privilege/reward forgery
    const [
      genOrdersResp,
      genDriversResp,
      genCashResp,
      genFinResp,
      genCustPrivResp,
      genCustRewardResp,
      genCustOkResp,
    ] = await Promise.all([
      fetch(`${baseUrl}/api/v1/generic/orders/hack-ord-1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCustomer}` },
        body: JSON.stringify({ id: 'hack-ord-1', total: 0.01 }),
      }),
      fetch(`${baseUrl}/api/v1/generic/drivers/hack-drv-1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrStore1}` },
        body: JSON.stringify({ id: 'hack-drv-1', name: 'Forjado' }),
      }),
      fetch(`${baseUrl}/api/v1/generic/cash_sessions/hack-cs-1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrStore1}` },
        body: JSON.stringify({ id: 'hack-cs-1', openingBalance: 9999 }),
      }),
      fetch(`${baseUrl}/api/v1/generic/financial_records/hack-fin-1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrStore1}` },
        body: JSON.stringify({ id: 'hack-fin-1', type: 'RECEIVABLE', amount: 100 }),
      }),
      fetch(`${baseUrl}/api/v1/generic/consumers/usr-cust-1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCustomer}` },
        body: JSON.stringify({ data: { role: 'DEV_OWNER', walletBalance: 99999 }, merge: true }),
      }),
      fetch(`${baseUrl}/api/v1/generic/consumers/usr-cust-1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCustomer}` },
        body: JSON.stringify({
          data: {
            loyaltyRewards: [{ id: 'forged-free-meal', title: 'R$ 500 grátis', pointsCost: 0 }],
          },
          merge: true,
        }),
      }),
      fetch(`${baseUrl}/api/v1/generic/consumers/usr-cust-1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCustomer}` },
        body: JSON.stringify({
          data: {
            name: 'Cliente Teste',
            savedAddresses: [{ id: 'addr-p0', label: 'Casa', street: 'Rua Central, 10' }],
          },
          merge: true,
        }),
      }),
    ]);

    // C2: Customer SSE stream does NOT receive store CASH_MOVEMENT or another customer's ORDER_COMMITTED
    const custSseTicketJson: any = await fetch(`${baseUrl}/api/v1/sse/ticket`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokCustomer}` },
    }).then((r) => r.json());
    let custSseRaw = '';
    const custSseReqRef: { current: http.ClientRequest | null } = { current: null };
    await new Promise<void>((resolveReady) => {
      custSseReqRef.current = http.get(
        `${baseUrl}/api/v1/sse/stream?ticket=${encodeURIComponent(custSseTicketJson.ticket)}&tenantId=tenant-1`,
        (res) => {
          res.setEncoding('utf-8');
          res.on('data', (chunk: string) => {
            custSseRaw += chunk;
            if (custSseRaw.includes('"CONNECTED"')) {
              resolveReady();
            }
          });
        }
      );
      custSseReqRef.current.on('error', () => resolveReady());
    });

    await db.collection('menu_items').doc('item-sse-p0').set({
      id: 'item-sse-p0',
      storeId: 'store-1',
      tenantId: 'tenant-1',
      name: 'Burger SSE P0',
      price: 25,
      stock: 50,
      isAvailable: true,
    });

    // Trigger internal financial event + third-party POS order + own consumer order
    const [finEmitResp, otherOrdResp, ownOrdResp] = await Promise.all([
      fetch(`${baseUrl}/api/v1/store/finance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrStore1}` },
        body: JSON.stringify({
          id: 'fin-sse-p0',
          storeId: 'store-1',
          type: 'RECEIVABLE',
          amount: 120,
          description: 'Segredo de Caixa Interno P0',
        }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrStore1}` },
        body: JSON.stringify({
          storeId: 'store-1',
          channel: 'POS',
          customerId: 'usr-other-customer-p0',
          customerName: 'Outro Cliente Secreto',
          items: [{ menuItemId: 'item-sse-p0', quantity: 1 }],
        }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCustomer}` },
        body: JSON.stringify({
          storeId: 'store-1',
          channel: 'MARKETPLACE',
          deliveryAddress: 'Rua das Flores, 123 - Centro',
          items: [{ menuItemId: 'item-sse-p0', quantity: 1 }],
        }),
      }),
    ]);
    await new Promise((r) => setTimeout(r, 80));
    custSseReqRef.current?.destroy();

    const leakedCashEvent = custSseRaw.includes('CASH_MOVEMENT') || custSseRaw.includes('fin-sse-p0');
    const leakedOtherOrder = custSseRaw.includes('usr-other-customer-p0') || custSseRaw.includes('Outro Cliente Secreto');
    const receivedOwnOrder = custSseRaw.includes('ORDER_COMMITTED') && custSseRaw.includes('usr-cust-1');

    // C3: HQ roles (DEV_OWNER / SUPER_ADMIN) blocked from daily Store OS endpoints
    await db.collection('users').doc('usr-super-p0').set({
      uid: 'usr-super-p0',
      id: 'usr-super-p0',
      email: 'super.p0@3c.com',
      name: 'Super Admin P0',
      role: 'SUPER_ADMIN',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      tokenVersion: 1,
    });
    const tokSuperAdmin = auth.generateDevToken({
      uid: 'usr-super-p0',
      email: 'super.p0@3c.com',
      role: 'SUPER_ADMIN',
      tenantId: 'tenant-1',
      tokenVersion: 1,
    });
    const [
      hqFinGetResp,
      hqCashResp,
      hqMenuPostResp,
      hqPosOrdResp,
      superFinGetResp,
      superPosOrdResp,
    ] = await Promise.all([
      fetch(`${baseUrl}/api/v1/store/finance?storeId=store-1`, { headers: { Authorization: `Bearer ${tokDev}` } }),
      fetch(`${baseUrl}/api/v1/store/cash/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
        body: JSON.stringify({ storeId: 'store-1', action: 'OPEN', amount: 100 }),
      }),
      fetch(`${baseUrl}/api/v1/store/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
        body: JSON.stringify({ storeId: 'store-1', name: 'Prato HQ Forjado', price: 10 }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
        body: JSON.stringify({ storeId: 'store-1', channel: 'POS', items: [{ menuItemId: 'item-1', quantity: 1 }] }),
      }),
      fetch(`${baseUrl}/api/v1/store/finance?storeId=store-1`, { headers: { Authorization: `Bearer ${tokSuperAdmin}` } }),
      fetch(`${baseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokSuperAdmin}` },
        body: JSON.stringify({ storeId: 'store-1', channel: 'POS', items: [{ menuItemId: 'item-1', quantity: 1 }] }),
      }),
    ]);

    // C4: Standalone X-3C-App-Id isolation, blockedApps module enforcement & /auth/logout cookie clearing
    await db.collection('users').doc('usr-owner-p0').set({
      uid: 'usr-owner-p0',
      id: 'usr-owner-p0',
      email: 'owner.p0@teste.com',
      name: 'Lojista Bloqueado Finance',
      role: 'STORE_OWNER',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      status: 'ACTIVE',
      tokenVersion: 1,
      blockedApps: ['finance'],
      passwordHash: hashPassword('OwnerPass!2026'),
    });
    const loginWrongAppResp = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-3C-App-Id': 'marketplace' },
      body: JSON.stringify({ email: 'owner.p0@teste.com', password: 'OwnerPass!2026' }),
    });
    const loginRightAppResp = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-3C-App-Id': 'store-os' },
      body: JSON.stringify({ email: 'owner.p0@teste.com', password: 'OwnerPass!2026' }),
    });
    const loginRightAppJson: any = await loginRightAppResp.json();
    const loginSetCookie = loginRightAppResp.headers.get('set-cookie') || '';
    const ownerTokP0 = loginRightAppJson?.token || '';
    const blockedFinanceResp = await fetch(`${baseUrl}/api/v1/store/finance?storeId=store-1`, {
      headers: { Authorization: `Bearer ${ownerTokP0}`, 'X-3C-App-Id': 'store-os' },
    });
    const allowedMenuResp = await fetch(`${baseUrl}/api/v1/store/menu?storeId=store-1`, {
      headers: { Authorization: `Bearer ${ownerTokP0}`, 'X-3C-App-Id': 'store-os' },
    });
    const logoutResp = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerTokP0}` },
    });
    const logoutSetCookie = logoutResp.headers.get('set-cookie') || '';

    // C5: AI kill-switch enforces 403 for non-admin operational callers inside System DB context
    await fetch(`${baseUrl}/api/v1/admin/governance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ featureFlags: { ...(govJson?.featureFlags || {}), aiEngineEnabled: false } }),
    });
    const aiMgrDisabledResp = await fetch(`${baseUrl}/api/gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrStore1}` },
      body: JSON.stringify({ prompt: 'Teste kill switch P0 para lojista' }),
    });
    await fetch(`${baseUrl}/api/v1/admin/governance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ featureFlags: { ...(govJson?.featureFlags || {}), aiEngineEnabled: true } }),
    });

    check(
      genOrdersResp.status === 403 &&
        genDriversResp.status === 403 &&
        genCashResp.status === 403 &&
        genFinResp.status === 403 &&
        genCustPrivResp.status === 403 &&
        genCustRewardResp.status === 403 &&
        genCustOkResp.status === 200 &&
        finEmitResp.status === 200 &&
        otherOrdResp.status === 201 &&
        ownOrdResp.status === 201 &&
        !leakedCashEvent &&
        !leakedOtherOrder &&
        receivedOwnOrder &&
        hqFinGetResp.status === 403 &&
        hqCashResp.status === 403 &&
        hqMenuPostResp.status === 403 &&
        hqPosOrdResp.status === 403 &&
        superFinGetResp.status === 403 &&
        superPosOrdResp.status === 403 &&
        loginWrongAppResp.status === 403 &&
        loginRightAppResp.status === 200 &&
        loginSetCookie.includes('3ccorp_session=') &&
        blockedFinanceResp.status === 403 &&
        allowedMenuResp.status === 200 &&
        logoutResp.status === 200 &&
        logoutSetCookie.includes('Max-Age=0') &&
        aiMgrDisabledResp.status === 403,
      '19. Regressão P0 (C1-C5): Generic protegido, SSE isolado por role/uid, HQ bloqueado no OS, App-Id/blockedApps/logout e AI kill-switch ativos',
      `gen=${genOrdersResp.status}/${genDriversResp.status}/${genCashResp.status}/${genFinResp.status}/${genCustPrivResp.status}/${genCustRewardResp.status}/${genCustOkResp.status}, sseLeak=${leakedCashEvent}/${leakedOtherOrder}/own=${receivedOwnOrder}/st=${finEmitResp.status}:${otherOrdResp.status}:${ownOrdResp.status}/raw=${custSseRaw.replace(/\n/g, '|')}, hq=${hqFinGetResp.status}/${hqCashResp.status}/${hqMenuPostResp.status}/${hqPosOrdResp.status}/${superFinGetResp.status}/${superPosOrdResp.status}, appId=${loginWrongAppResp.status}/${loginRightAppResp.status}/blk=${blockedFinanceResp.status}/menu=${allowedMenuResp.status}/out=${logoutResp.status}, aiOff=${aiMgrDisabledResp.status}`
    );

    // 20. Regressão P1 (A2-A4): Cupom Edge offline deltaUsage sync + delivery settlement metadata + _deleted filter + rate-limit headers + Edge PIN lockout + senha >= 8 chars
    await db.collection('stores').doc('store-edge-sec').set({
      id: 'store-edge-sec',
      tenantId: 'tenant-1',
      name: 'Edge Sec Store',
      category: 'RESTAURANT',
      isOpen: true,
    });
    const couponSeed = {
      id: 'cpn-edge-p1',
      tenantId: 'tenant-1',
      storeId: 'store-edge-sec',
      code: 'EDGE10',
      audience: 'CONSUMER',
      discountType: 'FIXED',
      discountValue: 3,
      minOrderValue: 5,
      usageCount: 0,
      usageLimit: 10,
      isActive: true,
    };
    await db.collection('coupons').doc('cpn-edge-p1').set(couponSeed);
    await edgeRuntime.driver.setDoc('coupons', 'cpn-edge-p1', couponSeed);
    await db.collection('coupons').doc('cpn-merch-p1').set({
      id: 'cpn-merch-p1',
      tenantId: 'tenant-1',
      storeId: 'store-edge-sec',
      code: 'MERCHP1',
      audience: 'MERCHANT',
      discountType: 'FIXED',
      discountValue: 10,
      usageCount: 0,
      usageLimit: 5,
      isActive: true,
    });

    const edgeRegResult = await edgeRuntime.registerWithCloud(baseUrl, tokDev, 'edge-p1-host');
    const edgeOrdWithCpnResp = await fetch(`${edgeBaseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokEdgeMgr}` },
      body: JSON.stringify({
        storeId: 'store-edge-sec',
        items: [{ menuItemId: 'prd-edge-1', quantity: 1 }],
        couponCode: 'EDGE10',
      }),
    });
    const edgeOutboxAfterCpn: any[] = await edgeRuntime.driver.listDocs('sync_outbox');
    const cpnOutboxEntry = edgeOutboxAfterCpn.find(
      (o: any) => o.entity === 'coupons' && o.entityId === 'cpn-edge-p1' && o.deltaUsage === 1
    );
    await edgeRuntime.syncWithCloud(baseUrl, edgeRegResult.edgeToken);
    const cloudCpnAfterSync = (await db.collection('coupons').doc('cpn-edge-p1').get()).data();

    // Direct Edge push trying to abuse coupons (MERCHANT audience or missing deltaUsage) must still be RBAC_DENIED
    const abuseEdgePushResp = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${edgeRegResult.edgeToken}` },
      body: JSON.stringify({
        nodeId: 'edg_sec_test',
        storeId: 'store-edge-sec',
        mutations: [
          {
            idempotencyKey: 'idm-edge-merch-abuse-1',
            entity: 'coupons',
            entityId: 'cpn-merch-p1',
            operation: 'UPSERT',
            hlc: `${Date.now()}-0001-edg_sec_test`,
            deltaUsage: 1,
            payload: { id: 'cpn-merch-p1', usageCount: 1 },
          },
          {
            idempotencyKey: 'idm-edge-nodelta-abuse-2',
            entity: 'coupons',
            entityId: 'cpn-edge-p1',
            operation: 'UPSERT',
            hlc: `${Date.now()}-0002-edg_sec_test`,
            payload: { id: 'cpn-edge-p1', discountValue: 999 },
          },
        ],
      }),
    });
    const abuseEdgePushJson: any = await abuseEdgePushResp.json();
    const merchAbuseDenied = abuseEdgePushJson?.rejected?.some(
      (r: any) => r.entityId === 'cpn-merch-p1' && r.reason === 'RBAC_DENIED'
    );
    const noDeltaDenied = abuseEdgePushJson?.rejected?.some(
      (r: any) => r.entityId === 'cpn-edge-p1' && r.reason === 'RBAC_DENIED'
    );

    // Delivery settlement audit metadata + deleted financial record filtering
    const delivOrdCreateResp = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCustomer}` },
      body: JSON.stringify({
        storeId: 'store-1',
        channel: 'MARKETPLACE',
        deliveryAddress: 'Rua das Flores, 123 - Centro',
        deliveryModality: 'STORE_FLEET',
        paymentMethod: 'CASH',
        items: [{ menuItemId: 'item-sse-p0', quantity: 1 }],
      }),
    });
    const delivOrdJson: any = await delivOrdCreateResp.json();
    const delivOrdId = delivOrdJson?.transaction?.orderId || delivOrdJson?.order?.id || delivOrdJson?.id;
    for (const nextSt of ['CONFIRMED', 'IN_PREPARATION', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
      await fetch(`${baseUrl}/api/v1/commerce/orders/${delivOrdId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrStore1}` },
        body: JSON.stringify({ status: nextSt }),
      });
    }
    const settledCloudOrder = delivOrdId ? (await db.collection('orders').doc(delivOrdId).get()).data() : null;
    const settledFinDoc = delivOrdId
      ? (await db.collection('financial_records').doc(`fin-ord-${delivOrdId}`).get()).data()
      : null;

    await db.collection('financial_records').doc('fin-deleted-p1').set({
      id: 'fin-deleted-p1',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      type: 'RECEIVABLE',
      amount: 99,
      description: 'Registro removido tombstone',
      _deleted: true,
    });
    const storeFinList = await fetch(`${baseUrl}/api/v1/store/finance?storeId=store-1`, {
      headers: { Authorization: `Bearer ${tokMgrStore1}` },
    }).then((r) => r.json());
    const excludesDeletedFin =
      Array.isArray(storeFinList) && !storeFinList.some((r: any) => r.id === 'fin-deleted-p1');

    // Rate-limiter headers + Edge waiter pairing 5-attempt lockout
    const rlCheckResp = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'naoexiste@teste.com', password: 'WrongPassword123!' }),
    });
    const hasRateLimitHeaders =
      Boolean(rlCheckResp.headers.get('x-ratelimit-limit')) &&
      Boolean(rlCheckResp.headers.get('x-ratelimit-remaining'));

    const pairingInitJson: any = await fetch(`${edgeBaseUrl}/api/v1/store/store-edge-sec/waiter-pairing`, {
      headers: { Authorization: `Bearer ${tokEdgeMgr}` },
    }).then((r) => r.json());
    const validPin = pairingInitJson?.pin;
    const pinStatuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await fetch(`${edgeBaseUrl}/api/v1/store/store-edge-sec/waiter-pairing/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokEdgeMgr}` },
        body: JSON.stringify({ pin: '000000' }),
      });
      pinStatuses.push(r.status);
    }
    const pinLockedEvenValid = await fetch(`${edgeBaseUrl}/api/v1/store/store-edge-sec/waiter-pairing/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokEdgeMgr}` },
      body: JSON.stringify({ pin: validPin }),
    });
    const regenPinJson: any = await fetch(`${edgeBaseUrl}/api/v1/store/store-edge-sec/waiter-pairing/regenerate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokEdgeMgr}` },
    }).then((r) => r.json());
    const pinAfterRegen = await fetch(`${edgeBaseUrl}/api/v1/store/store-edge-sec/waiter-pairing/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokEdgeMgr}` },
      body: JSON.stringify({ pin: regenPinJson?.pin }),
    });

    // A4: Minimum 8-char password policy + strict production bootstrap guard
    const shortSignupResp = await fetch(`${baseUrl}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Senha Curta', email: 'curta.p1@teste.com', password: 'Abc123!' }),
    });
    const shortChPwdResp = await fetch(`${baseUrl}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokMgrStore1}` },
      body: JSON.stringify({ newPassword: 'Abc123!' }),
    });

    check(
      edgeOrdWithCpnResp.status === 201 &&
        Boolean(cpnOutboxEntry) &&
        cloudCpnAfterSync?.usageCount === 1 &&
        merchAbuseDenied &&
        noDeltaDenied &&
        settledCloudOrder?.paymentStatus === 'PAID' &&
        settledCloudOrder?.paymentConfirmationType === 'MANUAL_OPERATOR' &&
        settledCloudOrder?.settlementSource === 'ORDER_DELIVERY_SETTLEMENT' &&
        settledFinDoc?.status === 'PAID' &&
        excludesDeletedFin &&
        hasRateLimitHeaders &&
        pinStatuses[0] === 401 &&
        pinStatuses[4] === 429 &&
        pinLockedEvenValid.status === 429 &&
        pinAfterRegen.status === 200 &&
        shortSignupResp.status === 400 &&
        shortChPwdResp.status === 400,
      '20. Regressão P1 (A2-A4): Cupom Edge deltaUsage sync + RBAC, delivery settlement, _deleted filter, RateLimit headers, Edge PIN lockout e senha >= 8 chars',
      `edgeOrd=${edgeOrdWithCpnResp.status}, cpnUsage=${cloudCpnAfterSync?.usageCount}, abuse=${merchAbuseDenied}/${noDeltaDenied}, setl=${settledCloudOrder?.paymentConfirmationType}/${settledFinDoc?.status}, delFin=${excludesDeletedFin}, rl=${hasRateLimitHeaders}, pin=${pinStatuses.join(',')}/${pinLockedEvenValid.status}/${pinAfterRegen.status}, pwd=${shortSignupResp.status}/${shortChPwdResp.status}`
    );

    // 21. Regressão P2 (M1/M2/M5): Edge bootstrap filtra inativos/CUSTOMER & remove resetCodeHash, admin/users ignora pedidos _deleted e erros públicos omitem 'HQ Central'
    await db.collection('users').doc('usr-p2-op').set({
      id: 'usr-p2-op',
      tenantId: 'tenant-1',
      storeId: 'store-edge-sec',
      name: 'Operador P2',
      email: 'op.p2@teste.com',
      role: 'CASHIER',
      status: 'ACTIVE',
      passwordHash: 'secret-pw-hash',
      resetCodeHash: 'secret-reset-hash',
    });
    await db.collection('users').doc('usr-p2-del').set({
      id: 'usr-p2-del',
      tenantId: 'tenant-1',
      storeId: 'store-edge-sec',
      name: 'Removido P2',
      email: 'del.p2@teste.com',
      role: 'CASHIER',
      _deleted: true,
    });
    await db.collection('users').doc('usr-p2-dis').set({
      id: 'usr-p2-dis',
      tenantId: 'tenant-1',
      storeId: 'store-edge-sec',
      name: 'Desativado P2',
      email: 'dis.p2@teste.com',
      role: 'CASHIER',
      disabled: true,
      status: 'DISABLED',
    });
    await db.collection('users').doc('usr-p2-cust').set({
      id: 'usr-p2-cust',
      tenantId: 'tenant-1',
      name: 'Cliente P2',
      email: 'cust.p2@teste.com',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });

    const bootResp = await fetch(`${baseUrl}/api/v1/sync/edge/bootstrap/store-edge-sec`, {
      headers: { Authorization: `Bearer ${edgeRegResult.edgeToken}` },
    });
    const bootJson: any = await bootResp.json();
    const bootUsers: any[] = Array.isArray(bootJson?.users) ? bootJson.users : [];
    const bootOpUser = bootUsers.find((u: any) => u.id === 'usr-p2-op');
    const bootExcludesInvalid =
      !bootUsers.some((u: any) => ['usr-p2-del', 'usr-p2-dis', 'usr-p2-cust'].includes(u.id)) &&
      Boolean(bootOpUser) &&
      bootOpUser?.passwordHash === undefined &&
      bootOpUser?.resetCodeHash === undefined;

    const genUsersResp = await fetch(`${baseUrl}/api/v1/generic/users`, {
      headers: { Authorization: `Bearer ${tokDev}` },
    });

    await db.collection('orders').doc('ord-deleted-p2').set({
      id: 'ord-deleted-p2',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      customerId: 'usr-cust-1',
      total: 5000,
      status: 'DELIVERED',
      _deleted: true,
    });
    const adminUsersResp = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: { Authorization: `Bearer ${tokDev}` },
    });
    const adminUsersJson: any = await adminUsersResp.json();
    const custAdminRow = Array.isArray(adminUsersJson)
      ? adminUsersJson.find((u: any) => u.uid === 'usr-cust-1' || u.id === 'usr-cust-1')
      : null;
    const opAdminRow = Array.isArray(adminUsersJson)
      ? adminUsersJson.find((u: any) => u.uid === 'usr-p2-op' || u.id === 'usr-p2-op')
      : null;
    const adminStripsSecrets =
      Boolean(opAdminRow) && opAdminRow?.passwordHash === undefined && opAdminRow?.resetCodeHash === undefined;
    const adminUsersExcludesDeletedOrder =
      adminUsersResp.status === 200 &&
      Boolean(custAdminRow) &&
      Number(custAdminRow?.marketplaceTotalSpent || 0) < 5000;

    // Suspended tenant checkout error must not leak 'HQ Central'
    await db.collection('tenants').doc('tenant-1').update({ status: 'SUSPENDED' });
    let suspOrderStatus = 0;
    let suspOrderErr = '';
    try {
      const suspOrdResp = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokCustomer}` },
        body: JSON.stringify({
          storeId: 'store-1',
          channel: 'MARKETPLACE',
          deliveryAddress: 'Rua das Flores, 123 - Centro',
          paymentMethod: 'CASH',
          items: [{ menuItemId: 'item-sse-p0', quantity: 1 }],
        }),
      });
      suspOrderStatus = suspOrdResp.status;
      const suspOrdJson: any = await suspOrdResp.json();
      suspOrderErr = String(suspOrdJson?.error || '');
    } finally {
      await db.collection('tenants').doc('tenant-1').update({ status: 'ACTIVE' });
    }
    const cleanSuspendedMsg =
      (suspOrderStatus === 400 || suspOrderStatus === 403) && !/hq/i.test(suspOrderErr) && suspOrderErr.length > 0;

    check(
      bootResp.status === 200 &&
        bootExcludesInvalid &&
        genUsersResp.status === 403 &&
        adminStripsSecrets &&
        adminUsersExcludesDeletedOrder &&
        cleanSuspendedMsg,
      '21. Regressão P2 (M1/M2/M5): Edge bootstrap sanitizado sem CUSTOMER/inativos/resetCodeHash, generic/users bloqueado (403), admin/users sem _deleted/secrets e erro público sem "HQ Central"',
      `boot=${bootResp.status}/${bootExcludesInvalid}, gen=${genUsersResp.status}, admSec=${adminStripsSecrets}, admDel=${adminUsersExcludesDeletedOrder}/${custAdminRow?.marketplaceTotalSpent}, susp=${suspOrderStatus}("${suspOrderErr}")`
    );
  } finally {
    if (edgeRuntime) {
      await edgeRuntime.close().catch(() => {});
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore temp cleanup
    }
  }

  console.log('\n======================================================================');
  console.log(`📊 RESULTADO SERVER CORE: ${passed}/${passed + failed} verificações aprovadas`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
