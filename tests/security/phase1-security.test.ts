import express from 'express';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { EdgeNodeRuntime as EdgeNodeRuntimeType } from '../../servers/edge-node/index.ts';
import { generateIdempotencyKey } from '@3c/commerce-engine';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-sec-suite-'));
if (!process.env.SERVER_DB_PATH) process.env.SERVER_DB_PATH = path.join(tempDir, 'sec-test-db.json');
if (!process.env.SERVER_SECRET_PATH) process.env.SERVER_SECRET_PATH = path.join(tempDir, '.server-secret');
if (!process.env.SERVER_SECRET) process.env.SERVER_SECRET = '3c_phase1_sec_isolated_secret_2026';

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
  const { attachContractContext, idempotencyGuard } = await import('../../src/server/middleware/contracts.ts');
  const { default: authRoutes } = await import('../../src/server/routes/auth.ts');
  const { default: adminRoutes } = await import('../../src/server/routes/admin.ts');
  const { default: storeRoutes } = await import('../../src/server/routes/store.ts');
  const { default: commerceRoutes } = await import('../../src/server/routes/commerce.ts');
  const { default: genericRoutes } = await import('../../src/server/routes/generic.ts');
  const { default: sseRoutes } = await import('../../src/server/routes/sse.ts');
  const { default: syncRoutes } = await import('../../src/server/routes/sync.ts');
  const { default: systemRoutes } = await import('../../src/server/routes/system.ts');
  const { EdgeNodeRuntime } = await import('../../servers/edge-node/index.ts');

  console.log('======================================================================');
  console.log('🛡️  SUÍTE NEGATIVA DE SEGURANÇA P0 (P0-01 a P0-09) — HTTP REAL');
  console.log('======================================================================\n');

  const app = express();
  app.use(express.json());
  app.use(attachContractContext);
  app.use('/api/v1/system', systemRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/store', storeRoutes);
  app.use('/api/v1/commerce', idempotencyGuard, commerceRoutes);
  app.use('/api/v1/generic', genericRoutes);
  app.use('/api/v1/sse', sseRoutes);
  app.use('/api/v1/sync', idempotencyGuard, syncRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let edgeRuntime: EdgeNodeRuntimeType | null = null;

  try {
    // Seed active Tenants
    await db.collection('tenants').doc('tenant-1').set({ id: 'tenant-1', name: '3C Corp Matriz', status: 'ACTIVE' });
    await db.collection('tenants').doc('tnt_alpha').set({ id: 'tnt_alpha', name: 'Alpha Group', status: 'ACTIVE' });
    await db.collection('tenants').doc('tnt_beta').set({ id: 'tnt_beta', name: 'Beta Group', status: 'ACTIVE' });

    // Seed Tenant Alpha (2 branches: str_alpha_1, str_alpha_2) and Tenant Beta
    await db.collection('stores').doc('str_alpha_1').set({
      id: 'str_alpha_1',
      tenantId: 'tnt_alpha',
      name: 'Alpha Matriz',
      category: 'RESTAURANT',
      isOpen: true,
      subscriptionPlan: 'PRO',
      saasMonthlyFee: 499,
      maxAllowedBranches: 2,
      maxAllowedDevices: 999,
      commissionRate: 0.08,
    });
    await db.collection('stores').doc('str_alpha_2').set({
      id: 'str_alpha_2',
      tenantId: 'tnt_alpha',
      name: 'Alpha Filial 2',
      category: 'RESTAURANT',
      isOpen: true,
      subscriptionPlan: 'PRO',
    });
    await db.collection('stores').doc('str_beta_1').set({
      id: 'str_beta_1',
      tenantId: 'tnt_beta',
      name: 'Beta Store',
      category: 'RETAIL',
      isOpen: true,
      subscriptionPlan: 'BASIC',
      saasMonthlyFee: 199,
    });

    await db.collection('inventory_batches').doc('bat_alpha_branch2').set({
      id: 'bat_alpha_branch2',
      tenantId: 'tnt_alpha',
      storeId: 'str_alpha_2',
      sku: 'INSUMO-CARNE',
      name: 'Carne Filial 2',
      quantity: 50,
      unit: 'KG',
    });

    await db.collection('menu_items').doc('item_alpha_burger').set({
      id: 'item_alpha_burger',
      tenantId: 'tnt_alpha',
      storeId: 'str_alpha_1',
      name: 'Burger Ficha Técnica',
      price: 42,
      costPrice: 14.5,
      stock: 10,
      isAvailable: true,
      supplierName: 'Frigorífico Secreto',
      recipe: [{ sku: 'INSUMO-CARNE', quantityRequired: 1, unit: 'KG' }],
    });

    // Seed Users
    const usersToSeed = [
      {
        uid: 'usr_owner_alpha',
        email: 'owner.alpha@sec.local',
        name: 'Owner Alpha',
        role: 'STORE_OWNER',
        tenantId: 'tnt_alpha',
        storeId: 'str_alpha_1',
        status: 'ACTIVE',
        passwordHash: hashPassword('StrongPass!2026'),
      },
      {
        uid: 'usr_owner_beta',
        email: 'owner.beta@sec.local',
        name: 'Owner Beta',
        role: 'STORE_OWNER',
        tenantId: 'tnt_beta',
        storeId: 'str_beta_1',
        status: 'ACTIVE',
      },
      {
        uid: 'usr_consumer_1',
        email: 'c1@sec.local',
        name: 'Consumer 1',
        role: 'CUSTOMER',
        tenantId: 'tnt_alpha',
        status: 'ACTIVE',
      },
      {
        uid: 'usr_consumer_2',
        email: 'c2@sec.local',
        name: 'Consumer 2',
        role: 'CUSTOMER',
        tenantId: 'tenant-1',
        status: 'ACTIVE',
      },
      {
        uid: 'usr_disabled',
        email: 'disabled@sec.local',
        name: 'Disabled Account',
        role: 'STORE_OWNER',
        tenantId: 'tnt_alpha',
        status: 'DISABLED',
      },
      {
        uid: 'usr_pending_dev',
        email: 'pending@sec.local',
        name: 'Pending Activation',
        role: 'DEV_OWNER',
        tenantId: 'tenant-1',
        status: 'PENDING_ACTIVATION',
      },
      {
        uid: 'usr_dev_sec',
        email: 'dev@sec.local',
        name: 'Dev Admin',
        role: 'DEV_OWNER',
        tenantId: 'tenant-1',
        status: 'ACTIVE',
      },
    ];
    for (const u of usersToSeed) {
      await db.collection('users').doc(u.uid).set(u);
    }

    const tokOwnerAlpha = auth.generateDevToken({ uid: 'usr_owner_alpha', email: 'owner.alpha@sec.local', role: 'STORE_OWNER', tenantId: 'tnt_alpha', storeId: 'str_alpha_1' });
    const tokOwnerBeta = auth.generateDevToken({ uid: 'usr_owner_beta', email: 'owner.beta@sec.local', role: 'STORE_OWNER', tenantId: 'tnt_beta', storeId: 'str_beta_1' });
    const tokConsumer1 = auth.generateDevToken({ uid: 'usr_consumer_1', email: 'c1@sec.local', role: 'CUSTOMER', tenantId: 'tenant-1' });
    const tokConsumer2 = auth.generateDevToken({ uid: 'usr_consumer_2', email: 'c2@sec.local', role: 'CUSTOMER', tenantId: 'tenant-1' });
    const tokDeletedUser = auth.generateDevToken({ uid: 'usr_nonexistent_deleted', email: 'ghost@sec.local', role: 'DEV_OWNER', tenantId: 'tnt_alpha' });
    const tokDisabledUser = auth.generateDevToken({ uid: 'usr_disabled', email: 'disabled@sec.local', role: 'STORE_OWNER', tenantId: 'tnt_alpha' });
    const tokPendingUser = auth.generateDevToken({ uid: 'usr_pending_dev', email: 'pending@sec.local', role: 'DEV_OWNER', tenantId: 'tenant-1' });

    // P0-01: gitignore covers .server-secret & server-db.json
    const gitignore = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf-8');
    check(
      gitignore.includes('.server-secret') && gitignore.includes('server-db.json'),
      'P0-01: .gitignore protege .server-secret e server-db.json contra commit acidental'
    );

    // P0-02: Fail-closed auth middleware & SSE stream
    const deletedResp = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${tokDeletedUser}` } });
    const disabledResp = await fetch(`${baseUrl}/api/v1/commerce/orders`, { headers: { Authorization: `Bearer ${tokDisabledUser}` } });
    const pendingResp = await fetch(`${baseUrl}/api/v1/admin/governance`, { headers: { Authorization: `Bearer ${tokPendingUser}` } });
    const badSseResp = await fetch(`${baseUrl}/api/v1/sse/stream?token=invalid.token.payload`);
    check(
      deletedResp.status === 401 &&
        disabledResp.status === 403 &&
        pendingResp.status === 403 &&
        badSseResp.status === 401,
      'P0-02: Auth fail-closed rejeita usuário ausente no banco (401), desativado/pendente (403) e token inválido no SSE (401)',
      `statuses=${deletedResp.status},${disabledResp.status},${pendingResp.status},${badSseResp.status}`
    );

    // P0-03: Arbitrary Bearer string cannot bypass public sanitization; payment config isolated
    const spoofListResp = await fetch(`${baseUrl}/api/v1/store/list`, {
      headers: { Authorization: 'Bearer fake-token-for-bypass' },
    });
    const spoofList: any[] = await spoofListResp.json();
    const alphaPublic = spoofList.find((s) => s.id === 'str_alpha_1');
    const crossPayConfigResp = await fetch(`${baseUrl}/api/v1/store/payment-gateway-config/str_beta_1`, {
      headers: { Authorization: `Bearer ${tokOwnerAlpha}` },
    });
    check(
      spoofListResp.status === 200 &&
        alphaPublic &&
        alphaPublic.subscriptionPlan === undefined &&
        alphaPublic.saasMonthlyFee === undefined &&
        alphaPublic.commissionRate === undefined &&
        crossPayConfigResp.status === 403,
      'P0-03: Bearer falso não libera campos privados em /store/list e gateway config cross-tenant retorna 403'
    );

    // P0-04: Consumer order isolation
    await db.collection('orders').doc('ord_c1_secret').set({
      id: 'ord_c1_secret',
      tenantId: 'tnt_alpha',
      storeId: 'str_alpha_1',
      customerId: 'usr_consumer_1',
      customerName: 'C1',
      total: 42,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
    });
    const c2ReadC1Resp = await fetch(`${baseUrl}/api/v1/commerce/orders/ord_c1_secret`, {
      headers: { Authorization: `Bearer ${tokConsumer2}` },
    });
    const c2ListResp = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      headers: { Authorization: `Bearer ${tokConsumer2}` },
    });
    const c2List: any[] = await c2ListResp.json();
    const c2GenericResp = await fetch(`${baseUrl}/api/v1/generic/orders/ord_c1_secret`, {
      headers: { Authorization: `Bearer ${tokConsumer2}` },
    });
    check(
      c2ReadC1Resp.status === 403 &&
        !c2List.some((o) => o.id === 'ord_c1_secret') &&
        c2GenericResp.status === 403,
      'P0-04: Consumidor 2 é bloqueado de ler ou listar pedido do Consumidor 1 (403 / filtrado)'
    );

    // P0-05: Branch B raw inventory batch CANNOT be consumed by Branch A BOM order
    const crossBranchBomOrderResp = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokOwnerAlpha}`,
        'Idempotency-Key': generateIdempotencyKey(),
      },
      body: JSON.stringify({
        storeId: 'str_alpha_1',
        channel: 'POS',
        deliveryModality: 'PICKUP',
        items: [{ menuItemId: 'item_alpha_burger', quantity: 1 }],
      }),
    });
    const branch2BatchAfter = (await db.collection('inventory_batches').doc('bat_alpha_branch2').get()).data();
    check(
      crossBranchBomOrderResp.status === 400 && branch2BatchAfter?.quantity === 50,
      'P0-05: Baixa BOM em str_alpha_1 NÃO consome lote de str_alpha_2 (400 e saldo da filial 2 preservado em 50)'
    );

    // P0-06: Immutable tenantId, SaaS quota tamper protection, and 404 on missing store/item
    const tamperStoreResp = await fetch(`${baseUrl}/api/v1/store/str_alpha_1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerAlpha}` },
      body: JSON.stringify({
        tenantId: 'tnt_beta',
        subscriptionPlan: 'ENTERPRISE',
        maxAllowedBranches: 99,
        maxAllowedDevices: 9999,
        name: 'Alpha Matriz Atualizada',
      }),
    });
    const updatedAlphaStore = (await db.collection('stores').doc('str_alpha_1').get()).data();
    const missingStorePutResp = await fetch(`${baseUrl}/api/v1/store/str_does_not_exist`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerAlpha}` },
      body: JSON.stringify({ name: 'Ghost' }),
    });
    const crossMenuHijackResp = await fetch(`${baseUrl}/api/v1/store/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerBeta}` },
      body: JSON.stringify({ id: 'item_alpha_burger', storeId: 'str_beta_1', name: 'Hijacked', price: 1 }),
    });
    check(
      tamperStoreResp.status === 200 &&
        updatedAlphaStore?.tenantId === 'tnt_alpha' &&
        updatedAlphaStore?.maxAllowedBranches === 2 &&
        missingStorePutResp.status === 404 &&
        crossMenuHijackResp.status === 403,
      'P0-06: tenantId e cotas SaaS são imutáveis via store PUT; ID inexistente retorna 404 e sequestro de ID retorna 403'
    );

    // P0-07: No hardcoded admin123 login and no default password in admin user creation
    const admin123LoginResp = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '3eatcru@gmail.com', password: 'admin123' }),
    });
    const tokDev = auth.generateDevToken({ uid: 'usr_dev_sec', email: 'dev@sec.local', role: 'DEV_OWNER', tenantId: 'tenant-1' });
    const createUserNoPassResp = await fetch(`${baseUrl}/api/v1/admin/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ name: 'Operador Sem Senha', email: 'nopass@sec.local', role: 'CASHIER' }),
    });
    check(
      (admin123LoginResp.status === 401 || admin123LoginResp.status === 403) &&
        createUserNoPassResp.status === 400,
      'P0-07: Login admin123 bloqueado e /admin/users/create exige senha explícita >= 8 caracteres (400)'
    );

    // P0-08: Self-service STORE_OWNER signup gets FREE trial only
    const signupResp = await fetch(`${baseUrl}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Novo Lojista',
        email: 'novo.lojista@sec.local',
        password: 'MySecurePassword123',
        role: 'STORE_OWNER',
      }),
    });
    const signupJson: any = await signupResp.json();
    const createdStore = (await db.collection('stores').doc(signupJson?.user?.storeId).get()).data();
    check(
      signupResp.status === 201 &&
        createdStore?.subscriptionPlan === 'FREE' &&
        createdStore?.maxAllowedBranches === 1 &&
        createdStore?.maxAllowedDevices === 2 &&
        createdStore?.saasPaymentStatus === 'TRIAL',
      'P0-08: Cadastro STORE_OWNER self-service provisiona plano FREE/TRIAL (1 filial, 2 dispositivos), nunca PRO gratuito'
    );

    // P0-09: Edge Node RBAC + public menu sanitization + Cloud sync role/branch blocking
    const edgeSqlite = path.join(tempDir, 'edge-sec.sqlite');
    edgeRuntime = new EdgeNodeRuntime({
      storeId: 'str_alpha_1',
      tenantId: 'tnt_alpha',
      dbPath: edgeSqlite,
      port: 0,
    });
    await edgeRuntime.seedFromCloudSnapshot({
      store: updatedAlphaStore,
      menuItems: [(await db.collection('menu_items').doc('item_alpha_burger').get()).data()],
      users: usersToSeed.filter((u) => u.tenantId === 'tnt_alpha'),
    });
    const edgePort = await edgeRuntime.listen(0);
    const edgeUrl = `http://127.0.0.1:${edgePort}`;

    const publicEdgeMenuResp = await fetch(`${edgeUrl}/api/v1/store/menu`);
    const publicEdgeMenu: any[] = await publicEdgeMenuResp.json();
    const customerEdgeOrderResp = await fetch(`${edgeUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokConsumer1}` },
      body: JSON.stringify({ storeId: 'str_alpha_1', items: [{ menuItemId: 'item_alpha_burger', quantity: 1 }] }),
    });
    const customerCloudSyncPushResp = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokConsumer1}`,
        'Idempotency-Key': generateIdempotencyKey(),
      },
      body: JSON.stringify({ nodeId: 'edg_rogue', storeId: 'str_alpha_1', mutations: [] }),
    });
    const unsignedTauriUpdate = await fetch(`${baseUrl}/api/v1/system/releases/tauri/linux/x86_64/5.0.0`).then((r) => r.json());
    check(
      publicEdgeMenuResp.status === 200 &&
        publicEdgeMenu[0]?.costPrice === undefined &&
        publicEdgeMenu[0]?.recipe === undefined &&
        publicEdgeMenu[0]?.supplierName === undefined &&
        customerEdgeOrderResp.status === 403 &&
        customerCloudSyncPushResp.status === 403 &&
        unsignedTauriUpdate.signed === false &&
        unsignedTauriUpdate.releaseChannel === 'UNSIGNED_SANDBOX_MANIFEST',
      'P0-09: Edge Node sanitiza menu público, bloqueia CUSTOMER (403), Cloud /sync/push bloqueia CUSTOMER (403) e Tauri updater sinaliza manifesto não assinado',
      `menuStatus=${publicEdgeMenuResp.status}, edgeCust=${customerEdgeOrderResp.status}, cloudPush=${customerCloudSyncPushResp.status}, tauri=${unsignedTauriUpdate?.releaseChannel}`
    );
  } finally {
    if (edgeRuntime) await edgeRuntime.close().catch(() => {});
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log(`\nResultado Suíte de Segurança P0: ${passed} aprovados, ${failed} falhas.`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
