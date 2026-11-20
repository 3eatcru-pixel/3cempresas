import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-cloud-hub-'));
if (!process.env.SERVER_DB_PATH) process.env.SERVER_DB_PATH = path.join(tempDir, 'cloud-hub-db.json');
if (!process.env.SERVER_SECRET_PATH) process.env.SERVER_SECRET_PATH = path.join(tempDir, '.server-secret');
if (!process.env.SERVER_SECRET) process.env.SERVER_SECRET = '3c_cloud_hub_readiness_secret_2026';

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

  console.log('======================================================================');
  console.log('☁️  3C CLOUD HUB — PRONTIDÃO POSTGRES/PROBES, SSE, AUDIT & HARDENING');
  console.log('======================================================================\n');

  const app = createServerCoreApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Seed base tenants, users, and governance
    await db.collection('tenants').doc('tenant-1').set({ id: 'tenant-1', name: '3C Matriz', status: 'ACTIVE' });
    await db.collection('stores').doc('store-1').set({
      id: 'store-1',
      tenantId: 'tenant-1',
      name: 'Loja Matriz 1',
      subscriptionPlan: 'PRO',
      isOpen: true,
    });

    await db.collection('users').doc('usr-dev-master').set({
      uid: 'usr-dev-master',
      id: 'usr-dev-master',
      email: 'devowner@3ccorp.com',
      name: 'Dev Owner',
      role: 'DEV_OWNER',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      tokenVersion: 1,
      passwordHash: hashPassword('MasterPass!2026'),
    });

    await db.collection('users').doc('usr-super-admin').set({
      uid: 'usr-super-admin',
      id: 'usr-super-admin',
      email: 'superadmin@3ccorp.com',
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      tokenVersion: 1,
      passwordHash: hashPassword('SuperPass!2026'),
    });

    await db.collection('users').doc('usr-store-mgr').set({
      uid: 'usr-store-mgr',
      id: 'usr-store-mgr',
      email: 'manager@loja1.com',
      name: 'Store Manager',
      role: 'STORE_MANAGER',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      status: 'ACTIVE',
      tokenVersion: 1,
    });

    const tokDev = auth.generateDevToken({
      uid: 'usr-dev-master',
      email: 'devowner@3ccorp.com',
      role: 'DEV_OWNER',
      tenantId: 'tenant-1',
      tokenVersion: 1,
    });
    const tokSuper = auth.generateDevToken({
      uid: 'usr-super-admin',
      email: 'superadmin@3ccorp.com',
      role: 'SUPER_ADMIN',
      tenantId: 'tenant-1',
      tokenVersion: 1,
    });
    const tokMgr = auth.generateDevToken({
      uid: 'usr-store-mgr',
      email: 'manager@loja1.com',
      role: 'STORE_MANAGER',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      tokenVersion: 1,
    });

    // 1. /healthz, /readyz and /api/v1/health honest readiness checks
    const healthzResp = await fetch(`${baseUrl}/healthz`);
    const healthzJson: any = await healthzResp.json();
    const readyzDevResp = await fetch(`${baseUrl}/readyz`);
    const readyzDevJson: any = await readyzDevResp.json();
    const apiHealthResp = await fetch(`${baseUrl}/api/v1/health`);
    const apiHealthJson: any = await apiHealthResp.json();

    check(
      healthzResp.status === 200 &&
        healthzJson?.status === 'ok' &&
        healthzJson?.service === '3c-cloud-hub' &&
        readyzDevResp.status === 200 &&
        readyzDevJson?.ready === true &&
        readyzDevJson?.cloudProbeVerified === false &&
        readyzDevJson?.persistenceDriver === 'json-memory' &&
        apiHealthResp.status === 200 &&
        apiHealthJson?.cloudProbeVerified === false &&
        apiHealthJson?.productionDatabaseReady === false &&
        apiHealthJson?.persistenceDriver === 'json-memory',
      '1. /healthz, /readyz e /api/v1/health reportam status honesto sem Postgres (cloudProbeVerified=false)',
      `readyz=${readyzDevResp.status}, driver=${apiHealthJson?.persistenceDriver}, probe=${apiHealthJson?.cloudProbeVerified}`
    );

    // 2. /readyz blocks in NODE_ENV=production without ALLOW_SANDBOX_IN_PRODUCTION
    const prevNodeEnv = process.env.NODE_ENV;
    const prevAllowSandbox = process.env.ALLOW_SANDBOX_IN_PRODUCTION;
    let readyzProdStatus = 0;
    let readyzProdJson: any = null;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_SANDBOX_IN_PRODUCTION;
      const rProd = await fetch(`${baseUrl}/readyz`);
      readyzProdStatus = rProd.status;
      readyzProdJson = await rProd.json();
    } finally {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
      if (prevAllowSandbox === undefined) delete process.env.ALLOW_SANDBOX_IN_PRODUCTION;
      else process.env.ALLOW_SANDBOX_IN_PRODUCTION = prevAllowSandbox;
    }
    check(
      readyzProdStatus === 503 &&
        readyzProdJson?.ready === false &&
        readyzProdJson?.reason === 'SANDBOX_BLOCKED_IN_PRODUCTION',
      '2. /readyz retorna 503 em NODE_ENV=production sem Postgres real ou ALLOW_SANDBOX_IN_PRODUCTION=true',
      `status=${readyzProdStatus}, reason=${readyzProdJson?.reason}`
    );

    // 3. Generic API denies RESTRICTED_COLLECTIONS and unwhitelisted collections even for DEV_OWNER
    const restrictedReads = await Promise.all([
      fetch(`${baseUrl}/api/v1/generic/users`, { headers: { Authorization: `Bearer ${tokDev}` } }),
      fetch(`${baseUrl}/api/v1/generic/governance`, { headers: { Authorization: `Bearer ${tokDev}` } }),
      fetch(`${baseUrl}/api/v1/generic/integrations`, { headers: { Authorization: `Bearer ${tokDev}` } }),
      fetch(`${baseUrl}/api/v1/generic/device_licenses`, { headers: { Authorization: `Bearer ${tokDev}` } }),
      fetch(`${baseUrl}/api/v1/generic/arbitrary_unlisted_col`, { headers: { Authorization: `Bearer ${tokDev}` } }),
    ]);
    const restrictedWrites = await Promise.all([
      fetch(`${baseUrl}/api/v1/generic/users/usr-hack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
        body: JSON.stringify({ data: { role: 'DEV_OWNER' } }),
      }),
      fetch(`${baseUrl}/api/v1/generic/governance/governance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
        body: JSON.stringify({ data: { maintenanceMode: true } }),
      }),
    ]);

    // Also test SUPER_ADMIN cannot overwrite SaaS billing fields on /generic/stores
    await fetch(`${baseUrl}/api/v1/generic/stores/store-1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokSuper}` },
      body: JSON.stringify({
        data: {
          name: 'Loja Matriz Atualizada',
          subscriptionPlan: 'ENTERPRISE',
          saasMonthlyFee: 0,
          saasPaymentStatus: 'PAID',
        },
        merge: true,
      }),
    });
    const storeAfterSuper = (await db.collection('stores').doc('store-1').get()).data();
    check(
      restrictedReads.every((r) => r.status === 403) &&
        restrictedWrites.every((r) => r.status === 403) &&
        storeAfterSuper?.name === 'Loja Matriz Atualizada' &&
        storeAfterSuper?.subscriptionPlan === 'PRO' &&
        storeAfterSuper?.saasMonthlyFee === undefined,
      '3. /api/v1/generic bloqueia coleções restritas até para DEV_OWNER e remove campos SaaS para não-DEV_OWNER',
      `reads=[${restrictedReads.map((r) => r.status).join(',')}], writes=[${restrictedWrites.map((r) => r.status).join(',')}], plan=${storeAfterSuper?.subscriptionPlan}`
    );

    // 4. POST /api/v1/admin/stores provisions tenant + store + sync_outbox + forensic audit
    const createStoreResp = await fetch(`${baseUrl}/api/v1/admin/stores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokSuper}`,
      },
      body: JSON.stringify({
        name: 'Bistrô Cloud Hub',
        category: 'Bistrô',
        subscriptionPlan: 'PRO',
        billingCycle: 'ANNUAL',
      }),
    });
    const createStoreJson: any = await createStoreResp.json();
    const createdStoreId = createStoreJson?.store?.id;
    const createdTenantId = createStoreJson?.store?.tenantId;
    const tenantDoc = createdTenantId ? await db.collection('tenants').doc(createdTenantId).get() : null;
    const outboxSnap = await db.collection('sync_outbox').get();
    const storeOutboxEntry = outboxSnap.docs
      .map((d) => d.data())
      .find((e) => e.entity === 'stores' && e.entityId === createdStoreId);
    // Non-HQ STORE_MANAGER cannot create stores via /admin/stores
    const mgrCreateStoreResp = await fetch(`${baseUrl}/api/v1/admin/stores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokMgr}`,
      },
      body: JSON.stringify({ name: 'Loja Não Autorizada' }),
    });
    check(
      createStoreResp.status === 201 &&
        Boolean(createdStoreId) &&
        Boolean(createdTenantId) &&
        tenantDoc?.exists === true &&
        tenantDoc?.data()?.status === 'ACTIVE' &&
        Boolean(storeOutboxEntry) &&
        mgrCreateStoreResp.status === 403,
      '4. POST /api/v1/admin/stores provisiona tenant isolado + loja + sync_outbox e bloqueia STORE_MANAGER (403)',
      `status=${createStoreResp.status}, mgr=${mgrCreateStoreResp.status}, outbox=${Boolean(storeOutboxEntry)}`
    );

    // 5. SSE single-use ticket flow + replay rejection
    const ticketResp = await fetch(`${baseUrl}/api/v1/sse/ticket`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokDev}` },
    });
    const ticketJson: any = await ticketResp.json();
    const ticket = ticketJson?.ticket;

    // Connect once via raw HTTP request and close once CONNECTED arrives
    const firstSseData = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.get(`${baseUrl}/api/v1/sse/stream?ticket=${encodeURIComponent(ticket)}`, (res) => {
        let buf = '';
        res.on('data', (chunk) => {
          buf += chunk.toString('utf8');
          if (buf.includes('CONNECTED')) {
            res.destroy();
            resolve({ status: res.statusCode || 0, body: buf });
          }
        });
        res.on('end', () => resolve({ status: res.statusCode || 0, body: buf }));
      });
      req.on('error', reject);
      setTimeout(() => {
        req.destroy();
        reject(new Error('SSE ticket stream timeout'));
      }, 3000);
    });

    // Replay same ticket -> must reject 401
    const replayResp = await fetch(`${baseUrl}/api/v1/sse/stream?ticket=${encodeURIComponent(ticket)}`);
    check(
      ticketResp.status === 200 &&
        typeof ticket === 'string' &&
        ticket.startsWith('sse_') &&
        firstSseData.status === 200 &&
        firstSseData.body.includes('"type":"CONNECTED"') &&
        replayResp.status === 401,
      '5. POST /api/v1/sse/ticket emite ticket único e bloqueia replay em GET /api/v1/sse/stream (401)',
      `ticketStatus=${ticketResp.status}, firstSse=${firstSseData.status}, replay=${replayResp.status}`
    );

    // 6. Forensic audit fields + unified GET /api/v1/admin/audit-logs (events + audit_logs)
    const govPutResp = await fetch(`${baseUrl}/api/v1/admin/governance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': 'req-forensic-gov-1',
        Authorization: `Bearer ${tokDev}`,
      },
      body: JSON.stringify({ platformName: '3C Cloud Hub Test' }),
    });
    const integPostResp = await fetch(`${baseUrl}/api/v1/admin/integrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': 'req-forensic-integ-1',
        Authorization: `Bearer ${tokDev}`,
      },
      body: JSON.stringify({
        id: 'int-cloud-test',
        name: 'Stripe Cloud Test',
        provider: 'STRIPE',
        category: 'PAYMENT',
        apiKey: 'sk_test_super_secret_1234',
        enabled: true,
      }),
    });
    const userCreateResp = await fetch(`${baseUrl}/api/v1/admin/users/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': 'req-forensic-usr-1',
        Authorization: `Bearer ${tokDev}`,
      },
      body: JSON.stringify({
        name: 'Operador Caixa Audit',
        email: 'caixa.audit@loja1.com',
        password: 'CaixaAudit!2026',
        role: 'CASHIER',
        tenantId: 'tenant-1',
        storeId: 'store-1',
      }),
    });
    await db.collection('audit_logs').doc('al-store-test-1').set({
      id: 'al-store-test-1',
      action: 'POS_DISCOUNT_APPLIED',
      details: 'Desconto manual aplicado no PDV 01',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      actorUid: 'usr-store-mgr',
      actorEmail: 'manager@loja1.com',
      actorRole: 'STORE_MANAGER',
      timestamp: new Date().toISOString(),
    });

    const auditResp = await fetch(`${baseUrl}/api/v1/admin/audit-logs?limit=100`, {
      headers: { Authorization: `Bearer ${tokDev}` },
    });
    const auditJson: any = await auditResp.json();
    const auditItems: any[] = Array.isArray(auditJson?.logs) ? auditJson.logs : [];
    const govAudit = auditItems.find((i) => i.type === 'HQ_GOVERNANCE_UPDATE' && i.requestId === 'req-forensic-gov-1');
    const integAudit = auditItems.find((i) => i.requestId === 'req-forensic-integ-1');
    const usrAudit = auditItems.find((i) => i.requestId === 'req-forensic-usr-1');
    const storeAudit = auditItems.find((i) => i.source === 'audit_logs' && i.id === 'al-store-test-1');

    check(
      govPutResp.status === 200 &&
        integPostResp.status === 200 &&
        userCreateResp.status === 201 &&
        auditResp.status === 200 &&
        govAudit?.actorUid === 'usr-dev-master' &&
        govAudit?.actorEmail === 'devowner@3ccorp.com' &&
        govAudit?.actorRole === 'DEV_OWNER' &&
        Boolean(govAudit?.sourceIp) &&
        integAudit?.actorUid === 'usr-dev-master' &&
        usrAudit?.actorUid === 'usr-dev-master' &&
        Boolean(storeAudit),
      '6. Trilha forense unificada (events + audit_logs) preenche actorUid/actorEmail/actorRole/sourceIp/requestId',
      `auditStatus=${auditResp.status}, total=${auditItems.length}, govActor=${govAudit?.actorEmail}, storeAudit=${Boolean(storeAudit)}`
    );

    // 7. POST /api/v1/admin/restore invariant: rejects snapshot without active DEV_OWNER, accepts valid snapshot
    const backupResp = await fetch(`${baseUrl}/api/v1/admin/backup`, {
      headers: { Authorization: `Bearer ${tokDev}` },
    });
    const backupJson: any = await backupResp.json();
    const { computeSnapshotChecksum } = await import('../../src/server/config.ts');

    const badTables = {
      ...backupJson.tables,
      users: (backupJson.tables.users || []).filter((u: any) => u.role !== 'DEV_OWNER'),
    };
    const badRestoreResp = await fetch(`${baseUrl}/api/v1/admin/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        schemaVersion: backupJson.schemaVersion,
        tables: badTables,
        checksum: computeSnapshotChecksum(badTables),
      }),
    });

    const goodRestoreResp = await fetch(`${baseUrl}/api/v1/admin/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        schemaVersion: backupJson.schemaVersion,
        tables: backupJson.tables,
        checksum: backupJson.checksum,
      }),
    });
    const goodRestoreJson: any = await goodRestoreResp.json();
    check(
      backupResp.status === 200 &&
        badRestoreResp.status === 400 &&
        goodRestoreResp.status === 200 &&
        goodRestoreJson?.success === true &&
        goodRestoreJson?.safetyBackupPersisted === true,
      '7. POST /api/v1/admin/restore rejeita snapshot sem DEV_OWNER ativo (400) e aceita snapshot válido',
      `bad=${badRestoreResp.status}, good=${goodRestoreResp.status}`
    );

    // 8. PostgresCloudDriver FORCE ROW LEVEL SECURITY & collection cache contract verification
    const { PostgresCloudDriver } = await import('../../src/server/persistence/PostgresCloudDriver.ts');
    const pgDriverSrc = fs.readFileSync(path.join(process.cwd(), 'src/server/persistence/PostgresCloudDriver.ts'), 'utf-8');
    const rlsForcedTables = ['store_documents', 'sync_outbox_cloud', 'stock_ledger', 'edge_nodes', 'audit_trail'].every((t) =>
      pgDriverSrc.includes(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY;`)
    );
    const schemaIndexesSynced = [
      'idx_sync_outbox_tenant_hlc',
      'idx_sync_outbox_idempotency',
      'idx_stock_ledger_tenant_store',
      'idx_edge_nodes_tenant_store',
    ].every((idx) => pgDriverSrc.includes(idx));
    const tenantsIdFallbackOk =
      pgDriverSrc.includes("collection === 'tenants' ? id : undefined") &&
      pgDriverSrc.includes("collection === 'tenants' ? item.id : undefined");
    const cloudSqlUnixSocketSslOff = pgDriverSrc.includes("lower.includes('/cloudsql/')");
    const offlinePgDriver = new PostgresCloudDriver('postgresql://invalid:invalid@127.0.0.1:1/nonexistent?sslmode=disable');
    const hasUnseededCache = offlinePgDriver.hasCachedCollectionSize('orders');
    const unseededSize = offlinePgDriver.getCollectionSize('orders');
    await offlinePgDriver.close();

    check(
      rlsForcedTables &&
        schemaIndexesSynced &&
        tenantsIdFallbackOk &&
        cloudSqlUnixSocketSslOff &&
        hasUnseededCache === false &&
        unseededSize === 0,
      '8. PostgresCloudDriver impõe FORCE ROW LEVEL SECURITY nas 5 tabelas multi-tenant, suporta socket /cloudsql/ e controla cache',
      `rlsForced=${rlsForcedTables}, indexes=${schemaIndexesSynced}, tenantsFallback=${tenantsIdFallbackOk}, cloudsql=${cloudSqlUnixSocketSslOff}, hasCache=${hasUnseededCache}, size=${unseededSize}`
    );

    // 9. Master HQ (3eatcru@gmail.com) SetPassword2026 first login + mandatory change + no hash bypass
    await db.collection('users').doc('usr-dev-master').delete();
    const firstLoginResp = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '3eatcru@gmail.com', password: 'SetPassword2026' }),
    });
    const firstLoginJson: any = await firstLoginResp.json();
    const firstToken = firstLoginJson?.token;

    const changePwdResp = await fetch(`${baseUrl}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${firstToken}`,
      },
      body: JSON.stringify({
        currentPassword: 'SetPassword2026',
        newPassword: 'DefinitiveMasterPassword!2026',
      }),
    });
    const changePwdJson: any = await changePwdResp.json();
    let rotatedToken = changePwdJson?.token;

    const meAfterChangeResp = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${rotatedToken}` },
    });
    const meAfterChangeJson: any = await meAfterChangeResp.json();

    // Even if mustChangePassword is set true on a user with existing hash, SetPassword2026 cannot bypass the real hash
    await db.collection('users').doc('usr-dev-master').update({ mustChangePassword: true });
    const bypassAttemptResp = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '3eatcru@gmail.com', password: 'SetPassword2026' }),
    });

    const changePwdSetCookie = changePwdResp.headers.get('set-cookie') || '';
    const rotatedCookiePair = changePwdSetCookie.split(';')[0] || '';
    const meWithRotatedCookieResp = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Cookie: rotatedCookiePair },
    });

    check(
      firstLoginResp.status === 200 &&
        firstLoginJson?.user?.role === 'DEV_OWNER' &&
        firstLoginJson?.user?.mustChangePassword === true &&
        changePwdResp.status === 200 &&
        Boolean(rotatedToken) &&
        rotatedCookiePair.startsWith('3ccorp_session=') &&
        meWithRotatedCookieResp.status === 200 &&
        meAfterChangeResp.status === 200 &&
        meAfterChangeJson?.mustChangePassword === false &&
        bypassAttemptResp.status === 401,
      '9. Master HQ (3eatcru@gmail.com) entra com SetPassword2026, renova cookie HttpOnly em change-password e bloqueia bypass de hash',
      `login=${firstLoginResp.status}, mustChange=${firstLoginJson?.user?.mustChangePassword}, change=${changePwdResp.status}, cookieMe=${meWithRotatedCookieResp.status}, meMustChange=${meAfterChangeJson?.mustChangePassword}, bypass=${bypassAttemptResp.status}`
    );

    // 9b. Production sealed Master HQ account unseals cleanly once INITIAL_DEV_PASSWORD is set in Secret Manager
    const { default: authRouterDirect } = await import('../../src/server/routes/auth.ts');
    const expressMod = (await import('express')).default;
    const directAuthApp = expressMod();
    directAuthApp.use(expressMod.json());
    directAuthApp.use('/api/v1/auth', authRouterDirect);
    const directAuthServer = await new Promise<any>((resolve) => {
      const s = directAuthApp.listen(0, '127.0.0.1', () => resolve(s));
    });
    const directAuthPort = directAuthServer.address().port;
    const directAuthBase = `http://127.0.0.1:${directAuthPort}`;

    const prevEnvNode9b = process.env.NODE_ENV;
    const prevEnvSandbox9b = process.env.ALLOW_SANDBOX_IN_PRODUCTION;
    const prevEnvInitPwd9b = process.env.INITIAL_DEV_PASSWORD;
    let sealed503NoEnv = 0;
    let sealed503DefaultEnv = 0;
    let unsealed200 = 0;
    let unsealedMustChange = false;
    let prodAfterChangeBlocked = 0;
    try {
      await db.collection('users').doc('usr-dev-master').update({
        passwordSealed: true,
        mustChangePassword: true,
      });
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_SANDBOX_IN_PRODUCTION;
      delete process.env.INITIAL_DEV_PASSWORD;

      const rNoEnv = await fetch(`${directAuthBase}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '3eatcru@gmail.com', password: 'SetPassword2026' }),
      });
      sealed503NoEnv = rNoEnv.status;

      process.env.INITIAL_DEV_PASSWORD = 'SetPassword2026';
      const rDefaultEnv = await fetch(`${directAuthBase}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '3eatcru@gmail.com', password: 'SetPassword2026' }),
      });
      sealed503DefaultEnv = rDefaultEnv.status;

      process.env.INITIAL_DEV_PASSWORD = 'ProdSecretBootstrap#2026';
      const rUnseal = await fetch(`${directAuthBase}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '3eatcru@gmail.com', password: 'ProdSecretBootstrap#2026' }),
      });
      unsealed200 = rUnseal.status;
      const unsealJson: any = await rUnseal.json();
      unsealedMustChange = unsealJson?.user?.mustChangePassword === true;

      const chPwd9b = await fetch(`${directAuthBase}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${unsealJson?.token}`,
        },
        body: JSON.stringify({
          currentPassword: 'ProdSecretBootstrap#2026',
          newPassword: 'FinalOwnerPassword#2026!',
        }),
      });
      const chPwd9bJson: any = await chPwd9b.json();
      if (chPwd9bJson?.token) {
        rotatedToken = chPwd9bJson.token;
      }

      const rReplayInit = await fetch(`${directAuthBase}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '3eatcru@gmail.com', password: 'ProdSecretBootstrap#2026' }),
      });
      prodAfterChangeBlocked = rReplayInit.status;
    } finally {
      directAuthServer.close();
      if (prevEnvNode9b === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevEnvNode9b;
      if (prevEnvSandbox9b === undefined) delete process.env.ALLOW_SANDBOX_IN_PRODUCTION;
      else process.env.ALLOW_SANDBOX_IN_PRODUCTION = prevEnvSandbox9b;
      if (prevEnvInitPwd9b === undefined) delete process.env.INITIAL_DEV_PASSWORD;
      else process.env.INITIAL_DEV_PASSWORD = prevEnvInitPwd9b;
    }

    check(
      sealed503NoEnv === 503 &&
        sealed503DefaultEnv === 503 &&
        unsealed200 === 200 &&
        unsealedMustChange &&
        prodAfterChangeBlocked === 401,
      '9b. Conta Master HQ selada em produção destrava com INITIAL_DEV_PASSWORD forte e revoga bootstrap após troca definitiva',
      `noEnv=${sealed503NoEnv}, defaultEnv=${sealed503DefaultEnv}, unseal=${unsealed200}, mustChange=${unsealedMustChange}, replayAfterChange=${prodAfterChangeBlocked}`
    );

    // 10. assertProductionSecretConfigured() (no-args and empty-arg) throws in production without SERVER_SECRET or ALLOW_SANDBOX_IN_PRODUCTION
    const { assertProductionSecretConfigured } = await import('../../src/server/config.ts');
    const prevNodeEnv2 = process.env.NODE_ENV;
    const prevSec2 = process.env.SERVER_SECRET;
    const prevSecPath2 = process.env.SERVER_SECRET_PATH;
    const prevAllowSandbox2 = process.env.ALLOW_SANDBOX_IN_PRODUCTION;
    let noArgThrew = false;
    let emptyArgThrew = false;
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.SERVER_SECRET;
      delete process.env.SERVER_SECRET_PATH;
      delete process.env.ALLOW_SANDBOX_IN_PRODUCTION;
      try {
        assertProductionSecretConfigured();
      } catch {
        noArgThrew = true;
      }
      try {
        assertProductionSecretConfigured('');
      } catch {
        emptyArgThrew = true;
      }
    } finally {
      if (prevNodeEnv2 === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv2;
      if (prevSec2 === undefined) delete process.env.SERVER_SECRET;
      else process.env.SERVER_SECRET = prevSec2;
      if (prevSecPath2 === undefined) delete process.env.SERVER_SECRET_PATH;
      else process.env.SERVER_SECRET_PATH = prevSecPath2;
      if (prevAllowSandbox2 === undefined) delete process.env.ALLOW_SANDBOX_IN_PRODUCTION;
      else process.env.ALLOW_SANDBOX_IN_PRODUCTION = prevAllowSandbox2;
    }
    check(
      noArgThrew && emptyArgThrew,
      '10. assertProductionSecretConfigured() (sem argumentos e com string vazia) bloqueia boot em produção sem SERVER_SECRET',
      `noArgThrew=${noArgThrew}, emptyArgThrew=${emptyArgThrew}`
    );

    // 11. resolvePostgresConnectionTarget supports DATABASE_URL, SQL_* Cloud SQL vars, and partial detection
    const { resolvePostgresConnectionTarget } = await import('../../src/server/persistence/PostgresCloudDriver.ts');
    const urlTarget = resolvePostgresConnectionTarget({
      DATABASE_URL: 'postgresql://app:secret@10.0.0.5:5432/cloud_sql_production_database',
    } as any);
    const cloudSqlSocketTarget = resolvePostgresConnectionTarget({
      SQL_HOST: '/cloudsql/proj:us-west1:inst',
      SQL_USER: 'postgres',
      SQL_PASSWORD: 'strong_password',
      SQL_DB_NAME: 'cloud_sql_production_database',
    } as any);
    const partialCloudSqlTarget = resolvePostgresConnectionTarget({
      SQL_DB_NAME: 'cloud_sql_production_database',
    } as any);
    check(
      urlTarget.configured === true &&
        urlTarget.mode === 'url' &&
        cloudSqlSocketTarget.configured === true &&
        cloudSqlSocketTarget.mode === 'cloudsql_vars' &&
        cloudSqlSocketTarget.poolConfig?.ssl === false &&
        cloudSqlSocketTarget.poolConfig?.database === 'cloud_sql_production_database' &&
        partialCloudSqlTarget.configured === false &&
        partialCloudSqlTarget.mode === 'missing' &&
        Boolean(partialCloudSqlTarget.missingReason?.includes('SQL_HOST')),
      '11. resolvePostgresConnectionTarget() suporta DATABASE_URL, variáveis SQL_* (/cloudsql/ sem SSL) e detecta configuração parcial',
      `url=${urlTarget.mode}, cloudsql=${cloudSqlSocketTarget.mode}/ssl=${String(cloudSqlSocketTarget.poolConfig?.ssl)}, partial=${partialCloudSqlTarget.missingReason}`
    );

    // 12. GET /api/v1/admin/diagnostics/env-readiness RBAC (DEV_OWNER only) and zero-secret leakage
    const envUnauthResp = await fetch(`${baseUrl}/api/v1/admin/diagnostics/env-readiness`);
    const envSuperResp = await fetch(`${baseUrl}/api/v1/admin/diagnostics/env-readiness`, {
      headers: { Authorization: `Bearer ${tokSuper}` },
    });
    const envMgrResp = await fetch(`${baseUrl}/api/v1/admin/diagnostics/env-readiness`, {
      headers: { Authorization: `Bearer ${tokMgr}` },
    });
    const envDevResp = await fetch(`${baseUrl}/api/v1/admin/diagnostics/env-readiness`, {
      headers: { Authorization: `Bearer ${rotatedToken || tokDev}` },
    });
    const envDevRaw = await envDevResp.text();
    const envDevJson: any = JSON.parse(envDevRaw);
    const serverSecretVar = Array.isArray(envDevJson?.variables)
      ? envDevJson.variables.find((v: any) => v.key === 'SERVER_SECRET')
      : null;

    check(
      envUnauthResp.status === 401 &&
        envSuperResp.status === 403 &&
        envMgrResp.status === 403 &&
        envDevResp.status === 200 &&
        serverSecretVar?.configured === true &&
        Array.isArray(envDevJson?.variables) &&
        envDevJson.variables.length >= 12 &&
        !envDevRaw.includes('3c_cloud_hub_readiness_secret_2026'),
      '12. GET /api/v1/admin/diagnostics/env-readiness restringe a DEV_OWNER e nunca vaza valores brutos de segredos',
      `unauth=${envUnauthResp.status}, super=${envSuperResp.status}, mgr=${envMgrResp.status}, dev=${envDevResp.status}, vars=${envDevJson?.variables?.length}`
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore temp cleanup
    }
  }

  console.log('\n======================================================================');
  console.log(`📊 RESULTADO CLOUD HUB READINESS: ${passed}/${passed + failed} verificações aprovadas`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
