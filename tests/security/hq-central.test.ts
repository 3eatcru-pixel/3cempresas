import express from 'express';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-hq-sec-'));
if (!process.env.SERVER_DB_PATH) process.env.SERVER_DB_PATH = path.join(tempDir, 'hq-test-db.json');
if (!process.env.SERVER_SECRET_PATH) process.env.SERVER_SECRET_PATH = path.join(tempDir, '.server-secret');
if (!process.env.SERVER_SECRET) process.env.SERVER_SECRET = '3c_hq_sec_isolated_secret_2026';

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
  const { attachContractContext } = await import('../../src/server/middleware/contracts.ts');
  const { default: authRoutes } = await import('../../src/server/routes/auth.ts');
  const { default: adminRoutes } = await import('../../src/server/routes/admin.ts');
  const { default: storeRoutes } = await import('../../src/server/routes/store.ts');
  const { default: commerceRoutes } = await import('../../src/server/routes/commerce.ts');
  const { default: systemRoutes } = await import('../../src/server/routes/system.ts');
  const { default: genericRoutes } = await import('../../src/server/routes/generic.ts');
  const { default: syncRoutes } = await import('../../src/server/routes/sync.ts');

  console.log('======================================================================');
  console.log('🛡️  ETAPA 1 (HQ CENTRAL) — CRITÉRIOS OBJETIVOS DE APROVAÇÃO');
  console.log('======================================================================\n');

  const app = express();
  app.use(express.json());
  app.use(attachContractContext);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/store', storeRoutes);
  app.use('/api/v1/commerce', commerceRoutes);
  app.use('/api/v1/system', systemRoutes);
  app.use('/api/v1/generic', genericRoutes);
  app.use('/api/v1/sync', syncRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 0. Seed baseline DEV_OWNER
    const initialUsersSnap = await db.collection('users').get();
    for (const d of initialUsersSnap.docs) {
      const data = d.data();
      if (data?.role === 'DEV_OWNER' && data.uid !== 'usr-dev-master') {
        await db.collection('users').doc(d.id).delete();
      }
    }
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

    const tokDev = auth.generateDevToken({
      uid: 'usr-dev-master',
      email: '3eatcru@gmail.com',
      role: 'DEV_OWNER',
      tenantId: 'tenant-1',
      tokenVersion: 1,
    });

    // Baseline: Fail-closed token validation
    let fakeJwtRejected = false;
    try {
      await auth.verifyIdToken('eyJhbGciOiJSUzI1NiJ9.eyJ1aWQiOiJmYWtlIn0.invalid_sig');
    } catch {
      fakeJwtRejected = true;
    }
    let tamperedDevRejected = false;
    try {
      const tampered = `${tokDev.slice(0, -4)}AAAA`;
      await auth.verifyIdToken(tampered);
    } catch {
      tamperedDevRejected = true;
    }
    check(
      fakeJwtRejected && tamperedDevRejected,
      '0. Autenticação fail-closed: tokens adulterados ou forjados são rejeitados'
    );

    // =========================================================================
    // CRITÉRIO 1: Criar empresa pelo HQ (tenantId isolado)
    // =========================================================================
    const createStoreResp = await fetch(`${baseUrl}/api/v1/store/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        name: 'Pizzaria Matriz HQ',
        slug: 'pizzaria-matriz-hq',
        category: 'RESTAURANT',
        subscriptionPlan: 'PRO',
        maxAllowedBranches: 2,
        saasMonthlyFee: 299,
      }),
    });
    const createStoreJson: any = await createStoreResp.json();
    const primaryStore = createStoreJson?.store;
    const tenantAId = primaryStore?.tenantId;

    check(
      createStoreResp.status === 200 &&
        Boolean(primaryStore?.id) &&
        Boolean(tenantAId) &&
        tenantAId !== 'tenant-1',
      'Critério 1: Criar empresa pelo HQ com tenantId isolado',
      `status=${createStoreResp.status}, tenantId=${tenantAId}`
    );

    // =========================================================================
    // CRITÉRIO 2: Criar 1º admin da empresa
    // =========================================================================
    const createOwnerResp = await fetch(`${baseUrl}/api/v1/admin/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        name: 'Dono Matriz',
        email: 'dono@pizzariamatriz.com',
        password: 'SecurePassword!2026',
        role: 'STORE_OWNER',
        storeId: primaryStore.id,
      }),
    });
    const createOwnerJson: any = await createOwnerResp.json();
    const ownerAUid = createOwnerJson?.uid;
    const ownerADoc = (await db.collection('users').doc(ownerAUid).get()).data();

    check(
      createOwnerResp.status === 201 &&
        ownerADoc?.tenantId === tenantAId &&
        ownerADoc?.storeId === primaryStore.id &&
        ownerADoc?.role === 'STORE_OWNER' &&
        createOwnerJson?.user?.passwordHash === undefined,
      'Critério 2: Criar 1º admin da empresa vinculado ao tenant da loja',
      `status=${createOwnerResp.status}, role=${ownerADoc?.role}`
    );

    let tokOwnerA = auth.generateDevToken({
      uid: ownerAUid,
      email: 'dono@pizzariamatriz.com',
      role: 'STORE_OWNER',
      tenantId: tenantAId,
      storeId: primaryStore.id,
      tokenVersion: ownerADoc?.tokenVersion || 1,
    });

    // =========================================================================
    // CRITÉRIO 3: Atribuir acesso a filial
    // =========================================================================
    // 3a. Criar filial permitida (cota PRO é 2)
    const createBranchResp = await fetch(`${baseUrl}/api/v1/store/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerA}` },
      body: JSON.stringify({
        name: 'Pizzaria Filial Sul',
        slug: 'pizzaria-filial-sul',
        category: 'RESTAURANT',
        parentStoreId: primaryStore.id,
      }),
    });
    const createBranchJson: any = await createBranchResp.json();
    const branchStore = createBranchJson?.store;

    // 3b. Criar operador vinculado exclusivamente à filial
    const createBranchStaffResp = await fetch(`${baseUrl}/api/v1/admin/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        name: 'Gerente Filial Sul',
        email: 'gerente.sul@pizzariamatriz.com',
        password: 'SecurePassword!2026',
        role: 'STORE_MANAGER',
        storeId: branchStore?.id,
      }),
    });
    const branchStaffJson: any = await createBranchStaffResp.json();
    const branchStaffUid = branchStaffJson?.uid;
    const branchStaffDoc = (await db.collection('users').doc(branchStaffUid).get()).data();

    const tokBranchStaff = auth.generateDevToken({
      uid: branchStaffUid,
      email: 'gerente.sul@pizzariamatriz.com',
      role: 'STORE_MANAGER',
      tenantId: tenantAId,
      storeId: branchStore?.id,
      tokenVersion: branchStaffDoc?.tokenVersion || 1,
    });

    // Tentar acessar/modificar filial matriz sendo operador restrito à filial sul
    const crossBranchResp = await fetch(`${baseUrl}/api/v1/store/${primaryStore.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokBranchStaff}` },
      body: JSON.stringify({ name: 'Nome Invasor Matriz' }),
    });

    check(
      createBranchResp.status === 200 &&
        branchStore?.tenantId === tenantAId &&
        createBranchStaffResp.status === 201 &&
        branchStaffDoc?.storeId === branchStore?.id &&
        crossBranchResp.status === 403,
      'Critério 3: Atribuir acesso a filial com isolamento estrito entre filiais (403)',
      `branchStatus=${createBranchResp.status}, crossBranchStatus=${crossBranchResp.status}`
    );

    // =========================================================================
    // CRITÉRIO 4: Criar e alterar permissões RBAC
    // =========================================================================
    // STORE_OWNER tenta se auto-escalar a DEV_OWNER
    const escalateResp = await fetch(`${baseUrl}/api/v1/admin/users/${ownerAUid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerA}` },
      body: JSON.stringify({ role: 'DEV_OWNER' }),
    });

    // DEV_OWNER altera permissão do operador para CASHIER
    const changeRoleResp = await fetch(`${baseUrl}/api/v1/admin/users/${branchStaffUid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ role: 'CASHIER', storeId: branchStore.id }),
    });
    const changeRoleJson: any = await changeRoleResp.json();
    const updatedStaffDoc = (await db.collection('users').doc(branchStaffUid).get()).data();

    // Bloqueio de autoexclusão e rebaixamento do último DEV_OWNER
    const demoteLastDevResp = await fetch(`${baseUrl}/api/v1/admin/users/usr-dev-master`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ role: 'CUSTOMER' }),
    });

    check(
      escalateResp.status === 403 &&
        changeRoleResp.status === 200 &&
        changeRoleJson?.user?.role === 'CASHIER' &&
        updatedStaffDoc?.role === 'CASHIER' &&
        demoteLastDevResp.status === 400,
      'Critério 4: Criar e alterar permissões RBAC com bloqueio de auto-escalada (403) e proteção do DEV_OWNER (400)',
      `escalateStatus=${escalateResp.status}, changeStatus=${changeRoleResp.status}`
    );

    // =========================================================================
    // CRITÉRIO 5: Alterar plano e validar cotas de filiais no backend (bloqueio 403 ao exceder)
    // =========================================================================
    // O tenantA agora tem 2 lojas (matriz + filial sul).
    // Atualiza a assinatura da matriz para FREE (cota maxAllowedBranches: 1).
    const updateSubResp = await fetch(`${baseUrl}/api/v1/admin/stores/${primaryStore.id}/subscription`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        subscriptionPlan: 'FREE',
        billingCycle: 'MONTHLY',
        maxAllowedBranches: 1,
      }),
    });

    // Tentar criar 3ª filial (ou nova filial excedendo cota de 1)
    const exceedQuotaResp = await fetch(`${baseUrl}/api/v1/store/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerA}` },
      body: JSON.stringify({
        name: 'Pizzaria Filial Proibida',
        slug: 'pizzaria-filial-proibida',
        parentStoreId: primaryStore.id,
      }),
    });
    const exceedQuotaJson: any = await exceedQuotaResp.json();

    check(
      updateSubResp.status === 200 &&
        exceedQuotaResp.status === 403 &&
        typeof exceedQuotaJson?.error === 'string' &&
        exceedQuotaJson.error.includes('Limite de filiais'),
      'Critério 5: Alterar plano e bloquear criação de filiais além da cota no backend (HTTP 403)',
      `updateSubStatus=${updateSubResp.status}, exceedStatus=${exceedQuotaResp.status}`
    );

    // =========================================================================
    // CRITÉRIO 6: Impedir ativação de benefícios sem autorização comercial (bloqueio 403)
    // =========================================================================
    // STORE_OWNER tenta contornar e alterar sua própria assinatura no HQ
    const unauthorizedSubChange = await fetch(`${baseUrl}/api/v1/admin/stores/${primaryStore.id}/subscription`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerA}` },
      body: JSON.stringify({
        subscriptionPlan: 'ENTERPRISE',
        maxAllowedBranches: 99,
      }),
    });

    // STORE_OWNER tenta injetar subscriptionPlan, maxAllowedBranches e saasMonthlyFee via POST /store/save
    const bypassStoreSave = await fetch(`${baseUrl}/api/v1/store/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerA}` },
      body: JSON.stringify({
        id: primaryStore.id,
        name: 'Pizzaria Matriz Atualizada',
        subscriptionPlan: 'ENTERPRISE',
        maxAllowedBranches: 99,
        saasMonthlyFee: 500,
      }),
    });
    const refreshedMatriz = (await db.collection('stores').doc(primaryStore.id).get()).data();

    check(
      unauthorizedSubChange.status === 403 &&
        bypassStoreSave.status === 200 &&
        refreshedMatriz?.subscriptionPlan === 'FREE' &&
        refreshedMatriz?.maxAllowedBranches === 1 &&
        refreshedMatriz?.saasMonthlyFee === 0,
      'Critério 6: Impedir ativação de benefícios sem autorização comercial (403 e sanitização de campos)',
      `unauthStatus=${unauthorizedSubChange.status}, plan=${refreshedMatriz?.subscriptionPlan}, maxBranches=${refreshedMatriz?.maxAllowedBranches}, fee=${refreshedMatriz?.saasMonthlyFee}`
    );

    // =========================================================================
    // CRITÉRIO 7: Segurança de dispositivos (HQ bloqueado para lojista 403, storeId obrigatório, CSPRNG, pareamento e X-Device-Token no Store OS & HQ)
    // =========================================================================
    // 7a. STORE_OWNER é estritamente bloqueado de rotas administrativas /api/v1/admin/devices (403) e cadastro sem storeId retorna 400 no HQ e no Store OS
    const ownerBlockedAdminDevicesPost = await fetch(`${baseUrl}/api/v1/admin/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerA}` },
      body: JSON.stringify({ storeId: primaryStore.id, name: 'Tentativa Lojista no HQ', type: 'POS' }),
    });
    const ownerBlockedAdminDevicesGet = await fetch(`${baseUrl}/api/v1/admin/devices`, {
      headers: { Authorization: `Bearer ${tokOwnerA}` },
    });
    const devNoStoreHqResp = await fetch(`${baseUrl}/api/v1/admin/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ name: 'Terminal HQ Sem Filial', type: 'POS' }),
    });
    const ownerNoStoreResp = await fetch(`${baseUrl}/api/v1/store/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerA}` },
      body: JSON.stringify({ name: 'Terminal Loja Sem Filial', type: 'POS' }),
    });

    // 7b. Registro pelo HQ entra como PENDING_PAIRING com pairingCode CSPRNG (>=12 hex chars) e ignora campos forjados
    const regDevResp = await fetch(`${baseUrl}/api/v1/admin/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        storeId: primaryStore.id,
        name: 'Terminal PDV Auto',
        type: 'POS',
        status: 'ONLINE',
        paired: true,
        ipAddress: '192.168.1.100',
      }),
    });
    const regDevJson: any = await regDevResp.json();
    const newDev = regDevJson?.device;
    const hasStrongCode = typeof newDev?.pairingCode === 'string' && /^3C-[0-9A-F]{12}$/.test(newDev.pairingCode);

    // 7c. STORE_OWNER não pode parear via rota HQ /admin/devices/:id/pair (403), e na rota da loja /store/devices/:id/pair não pode parear sem código (401)
    const ownerBlockedAdminPair = await fetch(`${baseUrl}/api/v1/admin/devices/${newDev.id}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerA}` },
      body: JSON.stringify({ pairingCode: newDev.pairingCode, ipAddress: '10.0.0.5' }),
    });
    const pairNoCodeAsOwner = await fetch(`${baseUrl}/api/v1/store/devices/${newDev.id}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerA}` },
      body: JSON.stringify({ ipAddress: '10.0.0.5' }),
    });

    // 7d. Brute force de código incorreto dispara lockout (429 após 5 tentativas) e regeneração pelo lojista emite novo código
    const wrongAttemptsStatuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await fetch(`${baseUrl}/api/v1/store/devices/${newDev.id}/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairingCode: '3C-000000000000' }),
      });
      wrongAttemptsStatuses.push(r.status);
    }
    const regenResp = await fetch(`${baseUrl}/api/v1/store/devices/${newDev.id}/regenerate-pairing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerA}` },
      body: JSON.stringify({}),
    });
    const regenJson: any = await regenResp.json();
    const freshPairingCode = regenJson?.pairingCode;

    // 7e. Pareamento válido via Store OS com código de uso único emite deviceToken e impede reuso (409)
    const pairResp = await fetch(`${baseUrl}/api/v1/store/devices/${newDev.id}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerA}` },
      body: JSON.stringify({
        pairingCode: freshPairingCode,
        ipAddress: '192.168.0.50',
      }),
    });
    const pairJson: any = await pairResp.json();
    const issuedDeviceToken = pairJson?.deviceToken;
    const reusePairResp = await fetch(`${baseUrl}/api/v1/store/devices/${newDev.id}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairingCode: freshPairingCode }),
    });

    // 7f. Heartbeat SEM autenticação DEVE ser rejeitado (401) (HQ-03)
    const unauthHeartbeatResp = await fetch(`${baseUrl}/api/v1/admin/devices/${newDev.id}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ONLINE' }),
    });

    // 7g. Heartbeat COM X-Device-Token válido é aceito (200) e após revogação pelo lojista volta a retornar 401
    const authHeartbeatResp = await fetch(`${baseUrl}/api/v1/store/devices/${newDev.id}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Token': issuedDeviceToken || '' },
      body: JSON.stringify({ appVersion: '5.1.0' }),
    });
    const authHeartbeatJson: any = await authHeartbeatResp.json();

    const revokeDevTokResp = await fetch(`${baseUrl}/api/v1/store/devices/${newDev.id}/revoke-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerA}` },
      body: JSON.stringify({}),
    });
    const revokedHeartbeatResp = await fetch(`${baseUrl}/api/v1/admin/devices/${newDev.id}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Token': issuedDeviceToken || '' },
      body: JSON.stringify({ appVersion: '5.1.0' }),
    });

    // Re-pareia para manter consistência de auditoria no critério 10
    const regenAfterRevoke = await fetch(`${baseUrl}/api/v1/admin/devices/${newDev.id}/regenerate-pairing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({}),
    }).then((r) => r.json()) as any;
    await fetch(`${baseUrl}/api/v1/admin/devices/${newDev.id}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairingCode: regenAfterRevoke?.pairingCode }),
    });

    check(
      ownerBlockedAdminDevicesPost.status === 403 &&
        ownerBlockedAdminDevicesGet.status === 403 &&
        ownerBlockedAdminPair.status === 403 &&
        devNoStoreHqResp.status === 400 &&
        ownerNoStoreResp.status === 400 &&
        regDevResp.status === 200 &&
        newDev?.status === 'PENDING_PAIRING' &&
        newDev?.paired === false &&
        hasStrongCode &&
        Boolean(newDev?.pairingCodeExpiresAt) &&
        newDev?.pairingCodeHash === undefined &&
        newDev?.deviceTokenHash === undefined &&
        pairNoCodeAsOwner.status === 401 &&
        wrongAttemptsStatuses[5] === 429 &&
        regenResp.status === 200 &&
        Boolean(freshPairingCode) &&
        pairResp.status === 200 &&
        typeof issuedDeviceToken === 'string' &&
        issuedDeviceToken.startsWith('devtok_') &&
        pairJson?.device?.status === 'ONLINE' &&
        pairJson?.device?.paired === true &&
        reusePairResp.status === 409 &&
        unauthHeartbeatResp.status === 401 &&
        authHeartbeatResp.status === 200 &&
        Boolean(authHeartbeatJson?.lastHeartbeatAt) &&
        revokeDevTokResp.status === 200 &&
        revokedHeartbeatResp.status === 401,
      'Critério 7: Segurança de dispositivos (HQ bloqueado para lojista 403, storeId obrigatório, CSPRNG + TTL, anti-brute-force e heartbeat autenticado)',
      `ownerAdmin=${ownerBlockedAdminDevicesPost.status}/${ownerBlockedAdminDevicesGet.status}/${ownerBlockedAdminPair.status}, noStore=${devNoStoreHqResp.status}/${ownerNoStoreResp.status}, strongCode=${hasStrongCode}, noCodePair=${pairNoCodeAsOwner.status}, lockout=${wrongAttemptsStatuses[5]}, pair=${pairResp.status}, reuse=${reusePairResp.status}, unauthHb=${unauthHeartbeatResp.status}, authHb=${authHeartbeatResp.status}, revokedHb=${revokedHeartbeatResp.status}`
    );

    // =========================================================================
    // CRITÉRIO 8: Suspender empresa e bloquear acessos de lojista/equipe (403)
    // =========================================================================
    const suspendTenantResp = await fetch(`${baseUrl}/api/v1/admin/tenants/${tenantAId}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ reason: 'Inadimplência fatura SaaS' }),
    });

    const suspendedTenantDoc = (await db.collection('tenants').doc(tenantAId).get()).data();
    const suspendedStoreDoc = (await db.collection('stores').doc(primaryStore.id).get()).data();
    const ownerDocAfterSuspend = (await db.collection('users').doc(ownerAUid).get()).data();

    // Cria token sincronizado com a nova tokenVersion pós-suspensão para testar bloqueio 403 de tenant suspenso
    const tokOwnerSuspendedTenant = auth.generateDevToken({
      uid: ownerAUid,
      email: 'dono@pizzariamatriz.com',
      role: 'STORE_OWNER',
      tenantId: tenantAId,
      storeId: primaryStore.id,
      tokenVersion: ownerDocAfterSuspend?.tokenVersion || 1,
    });

    // Dono do tenant suspenso tenta operar loja
    const storeActionAfterSuspension = await fetch(`${baseUrl}/api/v1/store/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerSuspendedTenant}` },
      body: JSON.stringify({ id: primaryStore.id, name: 'Tentativa Invasão Loja Suspensa' }),
    });

    check(
      suspendTenantResp.status === 200 &&
        suspendedTenantDoc?.status === 'SUSPENDED' &&
        suspendedStoreDoc?.tenantStatus === 'SUSPENDED' &&
        suspendedStoreDoc?.isOpen === false &&
        storeActionAfterSuspension.status === 403,
      'Critério 8: Suspender empresa no HQ e bloquear imediatamente acessos operacionais (403)',
      `suspendStatus=${suspendTenantResp.status}, actionStatus=${storeActionAfterSuspension.status}`
    );

    // Reativa o tenant para testes subsequentes
    await fetch(`${baseUrl}/api/v1/admin/tenants/${tenantAId}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({}),
    });

    // =========================================================================
    // CRITÉRIO 9: Revogar usuário e invalidar sessões imediatamente (401)
    // =========================================================================
    // Gera novo token com tokenVersion atual
    const ownerFreshDoc = (await db.collection('users').doc(ownerAUid).get()).data();
    const tokOwnerValid = auth.generateDevToken({
      uid: ownerAUid,
      email: 'dono@pizzariamatriz.com',
      role: 'STORE_OWNER',
      tenantId: tenantAId,
      storeId: primaryStore.id,
      tokenVersion: ownerFreshDoc?.tokenVersion || 1,
    });

    // Confirma que o token atual responde com 200 em /auth/me
    const meBeforeRevoke = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${tokOwnerValid}` },
    });

    // DEV_OWNER executa revogação forçada de sessões
    const revokeResp = await fetch(`${baseUrl}/api/v1/admin/users/${ownerAUid}/revoke-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({}),
    });

    // Requisição com o token antigo agora DEVE falhar com 401
    const meAfterRevoke = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${tokOwnerValid}` },
    });

    check(
      meBeforeRevoke.status === 200 &&
        revokeResp.status === 200 &&
        meAfterRevoke.status === 401,
      'Critério 9: Revogar sessões de usuário e invalidar tokens ativos imediatamente (HTTP 401)',
      `before=${meBeforeRevoke.status}, revoke=${revokeResp.status}, after=${meAfterRevoke.status}`
    );

    // =========================================================================
    // CRITÉRIO 10: Registrar todas as ações administrativas em trilha de auditoria
    // =========================================================================
    const eventsSnap = await db.collection('events').get();
    const eventTypes = eventsSnap.docs.map((d: any) => d.data()?.type);

    const hasUserCreated = eventTypes.includes('USER_CREATED_BY_HQ');
    const hasUserUpdated = eventTypes.includes('USER_ROLE_UPDATE');
    const hasSessionRevoked = eventTypes.includes('USER_SESSION_REVOKED');
    const hasTenantSuspended = eventTypes.includes('TENANT_SUSPENDED');
    const hasDeviceRegistered = eventTypes.includes('DEVICE_REGISTERED');
    const hasDevicePaired = eventTypes.includes('DEVICE_PAIRED');
    const hasSubUpdated = eventTypes.includes('STORE_SUBSCRIPTION_UPDATE');

    check(
      hasUserCreated &&
        hasUserUpdated &&
        hasSessionRevoked &&
        hasTenantSuspended &&
        hasDeviceRegistered &&
        hasDevicePaired &&
        hasSubUpdated,
      'Critério 10: Registrar todas as ações administrativas na trilha de auditoria (events)',
      `eventsCount=${eventsSnap.docs.length}, types=${eventTypes.join(', ')}`
    );

    // =========================================================================
    // CRITÉRIO 11: Confirmar isolamento cross-tenant comprovado
    // =========================================================================
    // Cria Tenant B isolado
    const storeBResp = await fetch(`${baseUrl}/api/v1/store/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        name: 'Hamburgueria Tenant B',
        slug: 'hamburgueria-tenant-b',
        category: 'RESTAURANT',
        subscriptionPlan: 'PRO',
      }),
    });
    const storeB = (await storeBResp.json() as any)?.store;
    const tenantBId = storeB?.tenantId;

    // Cria admin do Tenant B
    const userBResp = await fetch(`${baseUrl}/api/v1/admin/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        name: 'Dono Hamburgueria B',
        email: 'dono@hamburgueriab.com',
        password: 'SecurePassword!2026',
        role: 'STORE_OWNER',
        storeId: storeB.id,
      }),
    });
    const userBUid = (await userBResp.json() as any)?.uid;
    const userBDoc = (await db.collection('users').doc(userBUid).get()).data();
    const tokOwnerB = auth.generateDevToken({
      uid: userBUid,
      email: 'dono@hamburgueriab.com',
      role: 'STORE_OWNER',
      tenantId: tenantBId,
      storeId: storeB.id,
      tokenVersion: userBDoc?.tokenVersion || 1,
    });

    // Owner B tenta modificar usuário de Tenant A via HQ e via Store OS
    const crossTenantUserEdit = await fetch(`${baseUrl}/api/v1/admin/users/${ownerAUid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerB}` },
      body: JSON.stringify({ name: 'Invasão Hacker' }),
    });
    const crossTenantStaffEdit = await fetch(`${baseUrl}/api/v1/store/staff/${branchStaffUid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerB}` },
      body: JSON.stringify({ name: 'Invasão Equipe Tenant A' }),
    });

    // Owner B tenta modificar loja de Tenant A
    const crossTenantStoreEdit = await fetch(`${baseUrl}/api/v1/store/${primaryStore.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerB}` },
      body: JSON.stringify({ name: 'Invasão Loja Tenant A' }),
    });

    check(
      crossTenantUserEdit.status === 403 &&
        crossTenantStaffEdit.status === 403 &&
        crossTenantStoreEdit.status === 403,
      'Critério 11: Isolamento estrito cross-tenant comprovado: Tenant B rejeitado em recursos de Tenant A (403)',
      `crossUser=${crossTenantUserEdit.status}, crossStaff=${crossTenantStaffEdit.status}, crossStore=${crossTenantStoreEdit.status}`
    );

    // =========================================================================
    // CRITÉRIO 12: Restaurar serviços após falha sem perda de dados (backup/restore)
    // =========================================================================
    // Aguarda o flush imediato para o arquivo de persistência
    db.saveImmediately?.();
    const dbFilePath = process.env.SERVER_DB_PATH!;
    const dbSnapshotRaw = fs.readFileSync(dbFilePath, 'utf-8');
    const dbSnapshotParsed = JSON.parse(dbSnapshotRaw);

    const hasTenantsInFile = Array.isArray(dbSnapshotParsed?.tenants) && dbSnapshotParsed.tenants.some((t: any) => t.id === tenantAId);
    const hasStoresInFile = Array.isArray(dbSnapshotParsed?.stores) && dbSnapshotParsed.stores.some((s: any) => s.id === primaryStore.id);
    const hasUsersInFile = Array.isArray(dbSnapshotParsed?.users) && dbSnapshotParsed.users.some((u: any) => u.id === ownerAUid || u.uid === ownerAUid);
    const hasEventsInFile = Array.isArray(dbSnapshotParsed?.events) && dbSnapshotParsed.events.length > 0;

    check(
      hasTenantsInFile && hasStoresInFile && hasUsersInFile && hasEventsInFile,
      'Critério 12: Persistência e restauração pós-falha sem perda de dados (tenants, stores, users e trilha)',
      `tenants=${hasTenantsInFile}, stores=${hasStoresInFile}, users=${hasUsersInFile}, events=${hasEventsInFile}`
    );

    // =========================================================================
    // CRITÉRIO 13: Isolamento HQ CRM vs Cupons do Lojista + SPED no Store OS
    // =========================================================================
    // Seed cupom global HQ (sem storeId) e cupom da loja Tenant B
    await db.collection('coupons').doc('cpn-hq-global').set({
      id: 'cpn-hq-global',
      code: 'HQGLOBAL20',
      discountPercent: 20,
      active: true,
      tenantId: 'tenant-1',
    });
    await db.collection('coupons').doc('cpn-store-b').set({
      id: 'cpn-store-b',
      code: 'LOJAB10',
      discountPercent: 10,
      active: true,
      storeId: storeB.id,
      tenantId: tenantBId,
    });

    // Store Owner B tenta editar cupom global do HQ -> 403
    const ownerEditHqCoupon = await fetch(`${baseUrl}/api/v1/commerce/coupons/cpn-hq-global`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerB}` },
      body: JSON.stringify({ active: false }),
    });
    // Store Owner B edita seu próprio cupom -> 200
    const ownerEditOwnCoupon = await fetch(`${baseUrl}/api/v1/commerce/coupons/cpn-store-b`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerB}` },
      body: JSON.stringify({ active: false }),
    });
    // DEV_OWNER remove cupom global -> 200
    const hqDeleteGlobalCoupon = await fetch(`${baseUrl}/api/v1/commerce/coupons/cpn-hq-global`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokDev}` },
    });

    // Store OS SPED export: Owner B exporta da própria loja (200), mas é barrado na loja do Tenant A (403)
    const spedOwnStore = await fetch(`${baseUrl}/api/v1/store/export/sped?storeId=${storeB.id}`, {
      headers: { Authorization: `Bearer ${tokOwnerB}` },
    });
    const spedOwnText = await spedOwnStore.text();
    const spedCrossTenant = await fetch(`${baseUrl}/api/v1/store/export/sped?storeId=${primaryStore.id}`, {
      headers: { Authorization: `Bearer ${tokOwnerB}` },
    });

    check(
      ownerEditHqCoupon.status === 403 &&
        ownerEditOwnCoupon.status === 200 &&
        hqDeleteGlobalCoupon.status === 200 &&
        spedOwnStore.status === 200 &&
        spedOwnText.includes('|0000|') &&
        spedCrossTenant.status === 403,
      'Critério 13: Isolamento de Cupons (HQ Global vs Lojista) e Exportação SPED isolada no Store OS',
      `editHq=${ownerEditHqCoupon.status}, editOwn=${ownerEditOwnCoupon.status}, spedOwn=${spedOwnStore.status}, spedCross=${spedCrossTenant.status}`
    );

    // =========================================================================
    // CRITÉRIO 14: Central do Dev (Release Manager, Contratos e Backup Protegido)
    // =========================================================================
    const relResp = await fetch(`${baseUrl}/api/v1/system/releases`);
    const relJson: any = await relResp.json();
    const contractsResp = await fetch(`${baseUrl}/api/v1/system/contracts`);
    const contractsJson: any = await contractsResp.json();
    const backupAsOwner = await fetch(`${baseUrl}/api/v1/admin/backup`, {
      headers: { Authorization: `Bearer ${tokOwnerB}` },
    });
    const backupAsDev = await fetch(`${baseUrl}/api/v1/admin/backup`, {
      headers: { Authorization: `Bearer ${tokDev}` },
    });
    const backupJson: any = await backupAsDev.json();
    const backupRedactsHashes =
      Array.isArray(backupJson?.tables?.users) &&
      backupJson.tables.users.every((u: any) => u.passwordHash === undefined) &&
      Array.isArray(backupJson?.tables?.device_licenses) &&
      backupJson.tables.device_licenses.every((d: any) => d.deviceTokenHash === undefined && d.pairingCodeHash === undefined);

    // Test restore validation: tampered checksum (400), disallowed table (400), broken FK (400), valid signed snapshot (200)
    const restoreTamperedResp = await fetch(`${baseUrl}/api/v1/admin/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        schemaVersion: backupJson?.schemaVersion,
        checksum: '0000000000000000000000000000000000000000000000000000000000000000',
        tables: backupJson?.tables,
      }),
    });
    const restoreBadTableResp = await fetch(`${baseUrl}/api/v1/admin/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        schemaVersion: '1.0.3',
        checksum: backupJson?.checksum,
        tables: { arbitrary_evil_table: [{ id: 'x' }] },
      }),
    });
    const restoreValidResp = await fetch(`${baseUrl}/api/v1/admin/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        schemaVersion: backupJson?.schemaVersion,
        checksum: backupJson?.checksum,
        tables: backupJson?.tables,
      }),
    });
    const restoreValidJson: any = await restoreValidResp.json();

    check(
      relResp.status === 200 &&
        Boolean(relJson?.products) &&
        contractsResp.status === 200 &&
        Boolean(contractsJson?.contractVersion) &&
        backupAsOwner.status === 403 &&
        backupAsDev.status === 200 &&
        Boolean(backupJson?.tables) &&
        Boolean(backupJson?.checksum) &&
        Boolean(backupJson?.schemaVersion) &&
        backupRedactsHashes &&
        restoreTamperedResp.status === 400 &&
        restoreBadTableResp.status === 400 &&
        restoreValidResp.status === 200 &&
        Boolean(restoreValidJson?.preRestoreBackupId),
      'Critério 14: Central do Dev — Releases, Contratos, Backup com redação/HMAC e Restore validado',
      `rel=${relResp.status}, ownerBackup=${backupAsOwner.status}, devBackup=${backupAsDev.status}, redacted=${backupRedactsHashes}, tampered=${restoreTamperedResp.status}, badTable=${restoreBadTableResp.status}, validRestore=${restoreValidResp.status}`
    );

    // =========================================================================
    // CRITÉRIO 15: Upgrade FREE->PRO recalcula mensalidade, valida allowlist/limites e sincroniza tenant
    // =========================================================================
    const invalidSubPlan = await fetch(`${baseUrl}/api/v1/admin/stores/${primaryStore.id}/subscription`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ subscriptionPlan: 'SUPER_VIP_INVALID' }),
    });
    const invalidSubNegBranches = await fetch(`${baseUrl}/api/v1/admin/stores/${primaryStore.id}/subscription`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ maxAllowedBranches: -2, saasMonthlyFee: -50 }),
    });
    const invalidSubFraction = await fetch(`${baseUrl}/api/v1/admin/stores/${primaryStore.id}/subscription`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ maxAllowedBranches: 1.5 }),
    });
    const upgradeFromFreeResp = await fetch(`${baseUrl}/api/v1/admin/stores/${primaryStore.id}/subscription`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        subscriptionPlan: 'PRO',
        billingCycle: 'MONTHLY',
      }),
    });
    const upgradeFromFreeJson: any = await upgradeFromFreeResp.json();
    const syncedTenantAfterUpgrade = (await db.collection('tenants').doc(tenantAId).get()).data();
    check(
      invalidSubPlan.status === 400 &&
        invalidSubNegBranches.status === 400 &&
        invalidSubFraction.status === 400 &&
        upgradeFromFreeResp.status === 200 &&
        upgradeFromFreeJson?.store?.subscriptionPlan === 'PRO' &&
        upgradeFromFreeJson?.store?.saasMonthlyFee === 299 &&
        upgradeFromFreeJson?.store?.maxAllowedDevices === 15 &&
        upgradeFromFreeJson?.store?.maxAllowedBranches === 2 &&
        upgradeFromFreeJson?.store?.saasPaymentStatus === 'PENDING' &&
        syncedTenantAfterUpgrade?.subscriptionPlan === 'PRO' &&
        syncedTenantAfterUpgrade?.maxAllowedBranches === 2,
      'Critério 15: Assinatura valida allowlist/limites (>=0/inteiros) e sincroniza store+tenant em transação (FREE->PRO)',
      `badPlan=${invalidSubPlan.status}, badNeg=${invalidSubNegBranches.status}, badFrac=${invalidSubFraction.status}, fee=${upgradeFromFreeJson?.store?.saasMonthlyFee}, tenantPlan=${syncedTenantAfterUpgrade?.subscriptionPlan}`
    );

    // =========================================================================
    // CRITÉRIO 16: Gestão de Contas do Marketplace pelo HQ (CUSTOMER + consumers)
    // =========================================================================
    // 16a. Auto-cadastro de consumidor no Marketplace cria users/{uid} + consumers/{uid}
    const consumerSignupResp = await fetch(`${baseUrl}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Maria Consumidora',
        email: 'maria.marketplace@cliente.com',
        password: 'CustomerPass!2026',
        role: 'CUSTOMER',
      }),
    });
    const consumerSignupJson: any = await consumerSignupResp.json();
    const consumerUid = consumerSignupJson?.user?.uid;
    const tokConsumer = consumerSignupJson?.token;

    // 16b. Consumidora lê seu próprio perfil /generic/consumers/{uid}, mas Store Owner é barrado (403)
    const ownConsumerDocResp = await fetch(`${baseUrl}/api/v1/generic/consumers/${consumerUid}`, {
      headers: { Authorization: `Bearer ${tokConsumer}` },
    });
    const storeOwnerReadConsumerDoc = await fetch(`${baseUrl}/api/v1/generic/consumers/${consumerUid}`, {
      headers: { Authorization: `Bearer ${tokOwnerB}` },
    });

    // 16c. Store Owner na mesma tenant-1 NÃO pode listar, suspender nem excluir consumidor global do Marketplace
    await db.collection('users').doc('usr-owner-t1').set({
      uid: 'usr-owner-t1',
      id: 'usr-owner-t1',
      email: 'owner.t1@loja.com',
      name: 'Owner Tenant 1',
      role: 'STORE_OWNER',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      tokenVersion: 1,
    });
    const tokOwnerT1 = auth.generateDevToken({
      uid: 'usr-owner-t1',
      email: 'owner.t1@loja.com',
      role: 'STORE_OWNER',
      tenantId: 'tenant-1',
      tokenVersion: 1,
    });
    const ownerT1AdminUsersResp = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: { Authorization: `Bearer ${tokOwnerT1}` },
    });
    const ownerT1StaffResp = await fetch(`${baseUrl}/api/v1/store/staff`, {
      headers: { Authorization: `Bearer ${tokOwnerT1}` },
    });
    const ownerT1StaffList = (await ownerT1StaffResp.json()) as any[];
    const ownerT1SeesCustomer = Array.isArray(ownerT1StaffList) && ownerT1StaffList.some(u => u.uid === consumerUid);
    const ownerT1SuspendCustomerAdmin = await fetch(`${baseUrl}/api/v1/admin/users/${consumerUid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerT1}` },
      body: JSON.stringify({ status: 'DISABLED' }),
    });
    const ownerT1SuspendCustomerStaff = await fetch(`${baseUrl}/api/v1/store/staff/${consumerUid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerT1}` },
      body: JSON.stringify({ status: 'DISABLED' }),
    });

    // 16d. HQ (DEV_OWNER) lista ?role=CUSTOMER, suspende (bloqueia /auth/me e login), reativa e exclui (cascade consumers/{uid})
    const hqListCustomers = await (
      await fetch(`${baseUrl}/api/v1/admin/users?role=CUSTOMER`, {
        headers: { Authorization: `Bearer ${tokDev}` },
      })
    ).json() as any[];
    const hqSeesCustomer = Array.isArray(hqListCustomers) && hqListCustomers.some(u => u.uid === consumerUid);

    const hqSuspendCustomer = await fetch(`${baseUrl}/api/v1/admin/users/${consumerUid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ status: 'DISABLED' }),
    });
    const customerMeWhenSuspended = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${tokConsumer}` },
    });
    const customerLoginWhenSuspended = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maria.marketplace@cliente.com', password: 'CustomerPass!2026' }),
    });

    const hqReactivateCustomer = await fetch(`${baseUrl}/api/v1/admin/users/${consumerUid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    const customerLoginWhenActive = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maria.marketplace@cliente.com', password: 'CustomerPass!2026' }),
    });

    // Mudar staff de loja para CUSTOMER limpa storeId automaticamente
    const demoteStaffToCustomer = await fetch(`${baseUrl}/api/v1/admin/users/${branchStaffUid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({ role: 'CUSTOMER' }),
    });
    const demotedStaffJson: any = await demoteStaffToCustomer.json();

    // Excluir consumidora no HQ apaga users/{uid} + consumers/{uid} e falha fechado
    const hqDeleteCustomer = await fetch(`${baseUrl}/api/v1/admin/users/${consumerUid}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokDev}` },
    });
    const deletedConsumerDocSnap = await db.collection('consumers').doc(consumerUid).get();
    const customerMeAfterDelete = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${tokConsumer}` },
    });

    check(
      consumerSignupResp.status === 201 &&
        consumerSignupJson?.user?.emailVerified === false &&
        ownConsumerDocResp.status === 200 &&
        storeOwnerReadConsumerDoc.status === 403 &&
        ownerT1AdminUsersResp.status === 403 &&
        ownerT1StaffResp.status === 200 &&
        !ownerT1SeesCustomer &&
        ownerT1SuspendCustomerAdmin.status === 403 &&
        ownerT1SuspendCustomerStaff.status === 403 &&
        hqSeesCustomer &&
        hqSuspendCustomer.status === 200 &&
        customerMeWhenSuspended.status === 403 &&
        customerLoginWhenSuspended.status === 403 &&
        hqReactivateCustomer.status === 200 &&
        customerLoginWhenActive.status === 200 &&
        demoteStaffToCustomer.status === 200 &&
        demotedStaffJson?.user?.storeId === null &&
        demotedStaffJson?.user?.tenantId === 'tenant-1' &&
        hqDeleteCustomer.status === 200 &&
        !deletedConsumerDocSnap.exists &&
        customerMeAfterDelete.status === 401,
      'Critério 16: HQ governa contas do Marketplace (signup emailVerified=false, suspensão, limpeza de storeId e exclusão cascade)',
      `signup=${consumerSignupResp.status}, ownerAdminUsers=${ownerT1AdminUsersResp.status}, ownerStaff=${ownerT1StaffResp.status}, seesCust=${ownerT1SeesCustomer}, suspCust=${ownerT1SuspendCustomerAdmin.status}/${ownerT1SuspendCustomerStaff.status}, suspMe=${customerMeWhenSuspended.status}, delMe=${customerMeAfterDelete.status}`
    );

    // =========================================================================
    // CRITÉRIO 17: Reset bloqueado em produção (HQ-04), SSRF em integrações (HQ-12) e Reconciliação honesta (HQ-08)
    // =========================================================================
    const prevNodeEnv = process.env.NODE_ENV;
    let resetProdRespStatus = 0;
    try {
      process.env.NODE_ENV = 'production';
      const resetProdResp = await fetch(`${baseUrl}/api/v1/admin/reset-sandbox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
        body: JSON.stringify({}),
      });
      resetProdRespStatus = resetProdResp.status;
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }

    // Seed SSRF & config-only integrations
    await db.collection('integrations').doc('int-ssrf-1').set({
      id: 'int-ssrf-1',
      name: 'SSRF Metadata Probe',
      category: 'API',
      endpointUrl: 'http://169.254.169.254/latest/meta-data',
    });
    await db.collection('integrations').doc('int-ssrf-2').set({
      id: 'int-ssrf-2',
      name: 'SSRF Localhost Probe',
      category: 'API',
      endpointUrl: 'http://127.0.0.1:3000/api/v1/health',
    });
    await db.collection('integrations').doc('int-cfg-only').set({
      id: 'int-cfg-only',
      name: 'WhatsApp Config Only',
      category: 'WHATSAPP',
      apiKeyMasked: 'wpp_••••',
    });

    const ssrfMetaResp = await fetch(`${baseUrl}/api/v1/admin/integrations/int-ssrf-1/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokDev}` },
    });
    const ssrfLocalResp = await fetch(`${baseUrl}/api/v1/admin/integrations/int-ssrf-2/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokDev}` },
    });
    const cfgOnlyResp = await fetch(`${baseUrl}/api/v1/admin/integrations/int-cfg-only/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokDev}` },
    });
    const cfgOnlyJson: any = await cfgOnlyResp.json();

    const billingReconcileResp = await fetch(`${baseUrl}/api/v1/admin/billing/reconcile`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({}),
    });
    const billingReconcileJson: any = await billingReconcileResp.json();

    check(
      resetProdRespStatus === 403 &&
        ssrfMetaResp.status === 400 &&
        ssrfLocalResp.status === 400 &&
        cfgOnlyResp.status === 200 &&
        cfgOnlyJson?.status === 'CONFIGURED' &&
        cfgOnlyJson?.liveVerified === false &&
        billingReconcileResp.status === 200 &&
        billingReconcileJson?.operationType === 'DELINQUENCY_STATUS_CHECK' &&
        billingReconcileJson?.gatewaySettlementVerified === false,
      'Critério 17: Reset-sandbox bloqueado em produção (403), anti-SSRF em integrações (400), CONFIGURED vs CONNECTED e billing honesto',
      `resetProd=${resetProdRespStatus}, ssrfMeta=${ssrfMetaResp.status}, ssrfLocal=${ssrfLocalResp.status}, cfgStatus=${cfgOnlyJson?.status}, opType=${billingReconcileJson?.operationType}`
    );

    // =========================================================================
    // CRITÉRIO 18: Separação DEV_OWNER vs SUPER_ADMIN (HQ Operacional) vs REGIONAL_MANAGER (Store OS Multi-Filial)
    // =========================================================================
    await db.collection('users').doc('usr-super-hq').set({
      uid: 'usr-super-hq',
      id: 'usr-super-hq',
      email: 'super@hq.com',
      name: 'Super Admin Operacional',
      role: 'SUPER_ADMIN',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      tokenVersion: 1,
    });
    await db.collection('users').doc('usr-regional-a').set({
      uid: 'usr-regional-a',
      id: 'usr-regional-a',
      email: 'regional@pizzariamatriz.com',
      name: 'Gerente Regional A',
      role: 'REGIONAL_MANAGER',
      tenantId: tenantAId,
      storeId: null,
      status: 'ACTIVE',
      tokenVersion: 1,
    });

    const tokSuperAdmin = auth.generateDevToken({
      uid: 'usr-super-hq',
      email: 'super@hq.com',
      role: 'SUPER_ADMIN',
      tenantId: 'tenant-1',
      tokenVersion: 1,
    });
    const tokRegional = auth.generateDevToken({
      uid: 'usr-regional-a',
      email: 'regional@pizzariamatriz.com',
      role: 'REGIONAL_MANAGER',
      tenantId: tenantAId,
      tokenVersion: 1,
    });

    const [
      superUsersGet,
      superDevicesGet,
      superIntegGet,
      superGovGet,
      superDriverCreate,
      superBillingStatus,
      superGovPutBlocked,
      superBackupBlocked,
      superRestoreBlocked,
      superResetBlocked,
      superReconcileBlocked,
      superMultiEmpresaBlocked,
      superEditDevBlocked,
      regAdminUsersBlocked,
      regAdminDevicesBlocked,
      regAdminIntegBlocked,
      regStoreStaffOk,
      regStoreSpedOk,
      regEditOwnerBlocked,
    ] = await Promise.all([
      fetch(`${baseUrl}/api/v1/admin/users`, { headers: { Authorization: `Bearer ${tokSuperAdmin}` } }),
      fetch(`${baseUrl}/api/v1/admin/devices`, { headers: { Authorization: `Bearer ${tokSuperAdmin}` } }),
      fetch(`${baseUrl}/api/v1/admin/integrations`, { headers: { Authorization: `Bearer ${tokSuperAdmin}` } }),
      fetch(`${baseUrl}/api/v1/admin/governance`, { headers: { Authorization: `Bearer ${tokSuperAdmin}` } }),
      fetch(`${baseUrl}/api/v1/commerce/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokSuperAdmin}` },
        body: JSON.stringify({ id: 'drv-hq-super-1', storeId: primaryStore.id, name: 'Motoboy HQ Frota' }),
      }),
      fetch(`${baseUrl}/api/v1/admin/stores/${primaryStore.id}/billing-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokSuperAdmin}` },
        body: JSON.stringify({ saasPaymentStatus: 'PAID' }),
      }),
      fetch(`${baseUrl}/api/v1/admin/governance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokSuperAdmin}` },
        body: JSON.stringify({ maintenanceMode: true }),
      }),
      fetch(`${baseUrl}/api/v1/admin/backup`, { headers: { Authorization: `Bearer ${tokSuperAdmin}` } }),
      fetch(`${baseUrl}/api/v1/admin/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokSuperAdmin}` },
        body: JSON.stringify({}),
      }),
      fetch(`${baseUrl}/api/v1/admin/reset-sandbox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokSuperAdmin}` },
        body: JSON.stringify({}),
      }),
      fetch(`${baseUrl}/api/v1/admin/billing/reconcile`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokSuperAdmin}` },
        body: JSON.stringify({}),
      }),
      fetch(`${baseUrl}/api/v1/admin/tenants/multi-empresa`, { headers: { Authorization: `Bearer ${tokSuperAdmin}` } }),
      fetch(`${baseUrl}/api/v1/admin/users/usr-dev-master`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokSuperAdmin}` },
        body: JSON.stringify({ name: 'Invasão Super Admin' }),
      }),
      fetch(`${baseUrl}/api/v1/admin/users`, { headers: { Authorization: `Bearer ${tokRegional}` } }),
      fetch(`${baseUrl}/api/v1/admin/devices`, { headers: { Authorization: `Bearer ${tokRegional}` } }),
      fetch(`${baseUrl}/api/v1/admin/integrations`, { headers: { Authorization: `Bearer ${tokRegional}` } }),
      fetch(`${baseUrl}/api/v1/store/staff`, { headers: { Authorization: `Bearer ${tokRegional}` } }),
      fetch(`${baseUrl}/api/v1/store/export/sped?storeId=${primaryStore.id}`, { headers: { Authorization: `Bearer ${tokRegional}` } }),
      fetch(`${baseUrl}/api/v1/store/staff/${ownerAUid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokRegional}` },
        body: JSON.stringify({ status: 'DISABLED' }),
      }),
    ]);

    check(
      superUsersGet.status === 200 &&
        superDevicesGet.status === 200 &&
        superIntegGet.status === 200 &&
        superGovGet.status === 200 &&
        superDriverCreate.status === 200 &&
        superBillingStatus.status === 200 &&
        superGovPutBlocked.status === 403 &&
        superBackupBlocked.status === 403 &&
        superRestoreBlocked.status === 403 &&
        superResetBlocked.status === 403 &&
        superReconcileBlocked.status === 403 &&
        superMultiEmpresaBlocked.status === 403 &&
        superEditDevBlocked.status === 403 &&
        regAdminUsersBlocked.status === 403 &&
        regAdminDevicesBlocked.status === 403 &&
        regAdminIntegBlocked.status === 403 &&
        regStoreStaffOk.status === 200 &&
        regStoreSpedOk.status === 200 &&
        regEditOwnerBlocked.status === 403,
      'Critério 18: Separação de responsabilidades DEV_OWNER vs SUPER_ADMIN (HQ Operacional) vs REGIONAL_MANAGER (Store OS)',
      `superOk=${superUsersGet.status}/${superDriverCreate.status}/${superBillingStatus.status}, superBlocked=${superGovPutBlocked.status}/${superBackupBlocked.status}/${superRestoreBlocked.status}/${superResetBlocked.status}/${superReconcileBlocked.status}/${superMultiEmpresaBlocked.status}/${superEditDevBlocked.status}, regAdmin=${regAdminUsersBlocked.status}/${regAdminDevicesBlocked.status}/${regAdminIntegBlocked.status}, regStore=${regStoreStaffOk.status}/${regStoreSpedOk.status}/${regEditOwnerBlocked.status}`
    );

    // =========================================================================
    // CRITÉRIO 19: Ferramentas Dev HQ (Golden Signals, Integridade DB, Dry-Run, Frota)
    // =========================================================================
    const [
      superDiagMetrics,
      superDiagIntegrity,
      superDiagRestorePreview,
      superDiagFleet,
      superDiagUnlock,
      devDiagMetrics,
      devDiagIntegrity,
      devDiagFleet,
      devBackupRes,
      devDiagUnlock,
    ] = await Promise.all([
      fetch(`${baseUrl}/api/v1/admin/diagnostics/metrics`, { headers: { Authorization: `Bearer ${tokSuperAdmin}` } }),
      fetch(`${baseUrl}/api/v1/admin/diagnostics/integrity`, { headers: { Authorization: `Bearer ${tokSuperAdmin}` } }),
      fetch(`${baseUrl}/api/v1/admin/diagnostics/restore-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokSuperAdmin}` },
        body: JSON.stringify({ tables: {} }),
      }),
      fetch(`${baseUrl}/api/v1/admin/diagnostics/fleet`, { headers: { Authorization: `Bearer ${tokSuperAdmin}` } }),
      fetch(`${baseUrl}/api/v1/admin/diagnostics/rate-limits/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokSuperAdmin}` },
        body: JSON.stringify({}),
      }),
      fetch(`${baseUrl}/api/v1/admin/diagnostics/metrics`, { headers: { Authorization: `Bearer ${tokDev}` } }),
      fetch(`${baseUrl}/api/v1/admin/diagnostics/integrity`, { headers: { Authorization: `Bearer ${tokDev}` } }),
      fetch(`${baseUrl}/api/v1/admin/diagnostics/fleet`, { headers: { Authorization: `Bearer ${tokDev}` } }),
      fetch(`${baseUrl}/api/v1/admin/backup`, { headers: { Authorization: `Bearer ${tokDev}` } }),
      fetch(`${baseUrl}/api/v1/admin/diagnostics/rate-limits/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
        body: JSON.stringify({ limiter: 'auth' }),
      }),
    ]);

    const metricsJson: any = await devDiagMetrics.json();
    const integrityJson: any = await devDiagIntegrity.json();
    const fleetJson: any = await devDiagFleet.json();
    const diagBackupJson: any = await devBackupRes.json();
    const unlockJson: any = await devDiagUnlock.json();

    const previewRes = await fetch(`${baseUrl}/api/v1/admin/diagnostics/restore-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        schemaVersion: diagBackupJson.schemaVersion,
        version: diagBackupJson.version,
        checksum: diagBackupJson.checksum,
        tables: diagBackupJson.tables,
      }),
    });
    const previewJson: any = await previewRes.json();

    const invalidPreviewRes = await fetch(`${baseUrl}/api/v1/admin/diagnostics/restore-preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        schemaVersion: '1.0.3',
        checksum: 'invalid_sig',
        tables: { governance: [], tenants: [], stores: [], users: [] },
      }),
    });
    const invalidPreviewJson: any = await invalidPreviewRes.json();

    check(
      superDiagMetrics.status === 403 &&
        superDiagIntegrity.status === 403 &&
        superDiagRestorePreview.status === 403 &&
        superDiagFleet.status === 403 &&
        superDiagUnlock.status === 403 &&
        devDiagMetrics.status === 200 &&
        typeof metricsJson?.summary?.totalRequests === 'number' &&
        Array.isArray(metricsJson?.rateLimits) &&
        Array.isArray(metricsJson?.sseSessions) &&
        devDiagIntegrity.status === 200 &&
        typeof integrityJson?.collectionCounts?.stores === 'number' &&
        Array.isArray(integrityJson?.anomalies) &&
        devDiagFleet.status === 200 &&
        typeof fleetJson?.latestTargetVersion === 'string' &&
        Array.isArray(fleetJson?.fleet) &&
        devDiagUnlock.status === 200 &&
        unlockJson?.success === true &&
        previewRes.status === 200 &&
        previewJson?.valid === true &&
        previewJson?.checksumValid === true &&
        Array.isArray(previewJson?.diffs) &&
        invalidPreviewRes.status === 200 &&
        invalidPreviewJson?.valid === false &&
        invalidPreviewJson?.checksumValid === false,
      'Critério 19: Ferramentas Dev HQ (Golden Signals, Integridade DB, Restore Dry-Run, Matriz de Frota e Unlock Rate-Limit restritos a DEV_OWNER)',
      `super=${superDiagMetrics.status}/${superDiagIntegrity.status}/${superDiagRestorePreview.status}/${superDiagFleet.status}/${superDiagUnlock.status}, dev=${devDiagMetrics.status}/${devDiagIntegrity.status}/${devDiagFleet.status}/${previewRes.status}, previewValid=${previewJson?.valid}, invalidValid=${invalidPreviewJson?.valid}`
    );

    // =========================================================================
    // CRITÉRIO 20: Probe History + Webhook HMAC SSRF + Edge Sync DLQ + Circuit Breaker
    // =========================================================================
    await db.collection('integrations').doc('int-test-webhook').set({
      id: 'int-test-webhook',
      name: 'Webhook Diagnostic Partner',
      category: 'API',
      endpointUrl: 'http://127.0.0.1:9999/hook',
      status: 'CONFIGURED',
      tenantId: 'tenant-1',
    });

    const [integProbeRes, superWebhookBlocked, devWebhookSsrf] = await Promise.all([
      fetch(`${baseUrl}/api/v1/admin/integrations/int-test-webhook/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
        body: JSON.stringify({}),
      }),
      fetch(`${baseUrl}/api/v1/admin/integrations/int-test-webhook/webhook-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokSuperAdmin}` },
        body: JSON.stringify({ eventType: 'PING' }),
      }),
      fetch(`${baseUrl}/api/v1/admin/integrations/int-test-webhook/webhook-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
        body: JSON.stringify({ eventType: 'ORDER_COMMITTED' }),
      }),
    ]);
    const integProbeJson: any = await integProbeRes.json();

    // Generate rejected sync push mutation to verify sync_conflicts DLQ persistence + triage
    const pushRes = await fetch(`${baseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        nodeId: 'edg-hq-diag-test',
        storeId: primaryStore.id,
        mutations: [
          {
            entity: 'audit_logs',
            entityId: 'log-tamper-test',
            operation: 'UPSERT',
            payload: { note: 'blocked mutation' },
          },
        ],
      }),
    });
    const pushJson: any = await pushRes.json();

    const [superConflictsBlocked, devConflictsOpenRes] = await Promise.all([
      fetch(`${baseUrl}/api/v1/admin/diagnostics/sync-conflicts`, {
        headers: { Authorization: `Bearer ${tokSuperAdmin}` },
      }),
      fetch(`${baseUrl}/api/v1/admin/diagnostics/sync-conflicts?status=OPEN`, {
        headers: { Authorization: `Bearer ${tokDev}` },
      }),
    ]);
    const devConflictsOpenJson: any = await devConflictsOpenRes.json();
    const targetConflictId = devConflictsOpenJson?.conflicts?.[0]?.id;

    let resolvedStatus = 0;
    let remainingOpenCount = -1;
    if (targetConflictId) {
      const resResolve = await fetch(
        `${baseUrl}/api/v1/admin/diagnostics/sync-conflicts/${encodeURIComponent(targetConflictId)}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
          body: JSON.stringify({ action: 'RESOLVED', resolutionNote: 'Triado via Critério 20' }),
        }
      );
      resolvedStatus = resResolve.status;
      const afterRes = await fetch(`${baseUrl}/api/v1/admin/diagnostics/sync-conflicts?status=OPEN`, {
        headers: { Authorization: `Bearer ${tokDev}` },
      });
      const afterJson: any = await afterRes.json();
      remainingOpenCount = afterJson?.totalOpen ?? -1;
    }

    // Circuit Breaker: marketplaceMaintenanceReadOnly blocks public consumer order with 503
    const custToken = auth.generateDevToken({
      uid: 'usr-cust-circuit-test',
      email: 'cliente.circuit@test.com',
      role: 'CUSTOMER',
      tenantId: 'tenant-1',
      tokenVersion: 1,
    });
    await db.collection('users').doc('usr-cust-circuit-test').set({
      id: 'usr-cust-circuit-test',
      uid: 'usr-cust-circuit-test',
      email: 'cliente.circuit@test.com',
      name: 'Cliente Circuit',
      role: 'CUSTOMER',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      tokenVersion: 1,
      passwordHash: hashPassword('CustPass!2026'),
    });
    await db.collection('stores').doc(primaryStore.id).update({ isOpen: true, status: 'ACTIVE' });
    await db.collection('menu_items').doc('itm-circuit-1').set({
      id: 'itm-circuit-1',
      storeId: primaryStore.id,
      tenantId: 'tenant-1',
      name: 'Item Circuit Breaker',
      price: 25,
      stock: 10,
      isAvailable: true,
    });

    await fetch(`${baseUrl}/api/v1/admin/governance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        featureFlags: {
          aiEngineEnabled: true,
          autoDispatchEnabled: true,
          aiMenuAssistantEnabled: true,
          dynamicSurgePricingEnabled: true,
          waiterTableSelfServiceEnabled: true,
          offlineSyncEngineEnabled: true,
          marketplaceMaintenanceReadOnly: true,
        },
      }),
    });

    const blockedOrderRes = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
      body: JSON.stringify({
        storeId: primaryStore.id,
        channel: 'MARKETPLACE',
        deliveryModality: 'DELIVERY',
        deliveryAddress: 'Rua Teste 123, Centro',
        paymentMethod: 'PIX',
        items: [{ menuItemId: 'itm-circuit-1', quantity: 1 }],
      }),
    });

    await fetch(`${baseUrl}/api/v1/admin/governance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        featureFlags: {
          aiEngineEnabled: true,
          autoDispatchEnabled: true,
          aiMenuAssistantEnabled: true,
          dynamicSurgePricingEnabled: true,
          waiterTableSelfServiceEnabled: true,
          offlineSyncEngineEnabled: true,
          marketplaceMaintenanceReadOnly: false,
        },
      }),
    });

    check(
      integProbeRes.status === 400 &&
        Array.isArray(integProbeJson?.probeHistory) &&
        typeof integProbeJson?.latencyMs === 'number' &&
        superWebhookBlocked.status === 403 &&
        devWebhookSsrf.status === 400 &&
        pushRes.status === 200 &&
        pushJson?.rejected?.length === 1 &&
        superConflictsBlocked.status === 403 &&
        devConflictsOpenRes.status === 200 &&
        Boolean(targetConflictId) &&
        resolvedStatus === 200 &&
        remainingOpenCount === 0 &&
        blockedOrderRes.status === 503,
      'Critério 20: Probe History + Webhook HMAC Anti-SSRF + Edge DLQ Conflict Triage + Circuit Breaker 503 no Marketplace',
      `probe=${integProbeRes.status}, superWh=${superWebhookBlocked.status}, ssrfWh=${devWebhookSsrf.status}, pushRej=${pushJson?.rejected?.length}, dlq=${superConflictsBlocked.status}/${devConflictsOpenRes.status}/${resolvedStatus}/rem=${remainingOpenCount}, breaker=${blockedOrderRes.status}`
    );

    // =========================================================================
    // CRITÉRIO 21: Separação de Cupons B2C (Consumidor) vs B2B (Lojista SaaS)
    // =========================================================================
    const { evaluateCheckoutCoupon, evaluateMerchantCoupon } = await import(
      '../../src/modules/marketplace/checkout/couponPricing.ts'
    );

    // 21a. STORE_OWNER não pode criar cupom MERCHANT (403)
    const ownerCreateMerchantCoupon = await fetch(`${baseUrl}/api/v1/commerce/coupons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerB}` },
      body: JSON.stringify({
        code: 'INVASAO_B2B',
        audience: 'MERCHANT',
        discountType: 'PERCENT',
        discountValue: 50,
      }),
    });

    // 21b. DEV_OWNER não pode vincular cupom MERCHANT a storeId específica (400)
    const devMerchantWithStore = await fetch(`${baseUrl}/api/v1/commerce/coupons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        code: 'MERCHANT_LOJA',
        audience: 'MERCHANT',
        storeId: storeB.id,
        discountType: 'PERCENT',
        discountValue: 20,
      }),
    });

    // 21c. DEV_OWNER cria cupom MERCHANT válido (PRO/ENTERPRISE) e cupom CONSUMER global
    const devCreateMerchantCoupon = await fetch(`${baseUrl}/api/v1/commerce/coupons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        id: 'cpn-merchant-saas-30',
        code: 'LOJAPRO30',
        audience: 'MERCHANT',
        discountType: 'PERCENT',
        discountValue: 30,
        applicablePlans: ['PRO', 'ENTERPRISE'],
        isActive: true,
      }),
    });
    const devCreateConsumerCoupon = await fetch(`${baseUrl}/api/v1/commerce/coupons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        id: 'cpn-consumer-b2c-15',
        code: 'BEMVINDO15',
        audience: 'CONSUMER',
        discountType: 'PERCENT',
        discountValue: 15,
        isActive: true,
      }),
    });

    // 21d. Isolamento de leitura pública/consumidor vs HQ
    const [
      pubCouponsRes,
      pubMerchantFilterRes,
      custMerchantFilterRes,
      custGenericListRes,
      custGenericGetMerchantRes,
      hqMerchantListRes,
      hqConsumerListRes,
    ] = await Promise.all([
      fetch(`${baseUrl}/api/v1/commerce/coupons`),
      fetch(`${baseUrl}/api/v1/commerce/coupons?audience=MERCHANT`),
      fetch(`${baseUrl}/api/v1/commerce/coupons?audience=MERCHANT`, {
        headers: { Authorization: `Bearer ${custToken}` },
      }),
      fetch(`${baseUrl}/api/v1/generic/coupons`, {
        headers: { Authorization: `Bearer ${custToken}` },
      }),
      fetch(`${baseUrl}/api/v1/generic/coupons/cpn-merchant-saas-30`, {
        headers: { Authorization: `Bearer ${custToken}` },
      }),
      fetch(`${baseUrl}/api/v1/commerce/coupons?audience=MERCHANT&includeInactive=true`, {
        headers: { Authorization: `Bearer ${tokDev}` },
      }),
      fetch(`${baseUrl}/api/v1/commerce/coupons?audience=CONSUMER&includeInactive=true`, {
        headers: { Authorization: `Bearer ${tokDev}` },
      }),
    ]);

    const pubCoupons = (await pubCouponsRes.json()) as any[];
    const custGenericList = (await custGenericListRes.json()) as any[];
    const hqMerchantList = (await hqMerchantListRes.json()) as any[];
    const hqConsumerList = (await hqConsumerListRes.json()) as any[];

    const publicHidesMerchant =
      Array.isArray(pubCoupons) &&
      !pubCoupons.some((c) => c.code === 'LOJAPRO30') &&
      pubCoupons.some((c) => c.code === 'BEMVINDO15');
    const genericHidesMerchant =
      Array.isArray(custGenericList) && !custGenericList.some((c) => c.code === 'LOJAPRO30');
    const hqSplitCorrect =
      Array.isArray(hqMerchantList) &&
      hqMerchantList.some((c) => c.code === 'LOJAPRO30') &&
      hqMerchantList.every((c) => c.audience === 'MERCHANT') &&
      Array.isArray(hqConsumerList) &&
      !hqConsumerList.some((c) => c.code === 'LOJAPRO30') &&
      hqConsumerList.some((c) => c.code === 'BEMVINDO15');

    // 21e. Checkout B2C ignora cupom MERCHANT (desconto = 0)
    const consumerOrderWithMerchantCoupon = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${custToken}` },
      body: JSON.stringify({
        storeId: primaryStore.id,
        channel: 'MARKETPLACE',
        deliveryModality: 'DELIVERY',
        deliveryAddress: 'Rua Cupom 456, Centro',
        paymentMethod: 'PIX',
        couponCode: 'LOJAPRO30',
        items: [{ menuItemId: 'itm-circuit-1', quantity: 2 }],
      }),
    });
    const orderMerchantCouponJson: any = await consumerOrderWithMerchantCoupon.json();

    // 21f. Billing SaaS B2B rejeita cupom CONSUMER (400), rejeita plano não elegível BASIC (400) e aplica cupom MERCHANT no plano PRO (200)
    const upgradeWithConsumerCoupon = await fetch(
      `${baseUrl}/api/v1/store/${storeB.id}/subscription-request`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerB}` },
        body: JSON.stringify({
          requestedPlan: 'PRO',
          billingCycle: 'MONTHLY',
          couponCode: 'BEMVINDO15',
        }),
      }
    );
    const upgradeWrongPlanCoupon = await fetch(
      `${baseUrl}/api/v1/store/${storeB.id}/subscription-request`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerB}` },
        body: JSON.stringify({
          requestedPlan: 'BASIC',
          billingCycle: 'MONTHLY',
          couponCode: 'LOJAPRO30',
        }),
      }
    );
    const upgradeValidMerchantCoupon = await fetch(
      `${baseUrl}/api/v1/store/${storeB.id}/subscription-request`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokOwnerB}` },
        body: JSON.stringify({
          requestedPlan: 'PRO',
          billingCycle: 'MONTHLY',
          couponCode: 'LOJAPRO30',
        }),
      }
    );
    const upgradeValidJson: any = await upgradeValidMerchantCoupon.json();
    const merchantCouponAfterUse = (
      await db.collection('coupons').doc('cpn-merchant-saas-30').get()
    ).data();

    // 21g. Validação dos helpers client-side (evaluateCheckoutCoupon vs evaluateMerchantCoupon)
    const clientCouponSample: any[] = [
      {
        id: 'cpn-m',
        code: 'LOJAPRO30',
        audience: 'MERCHANT',
        discountType: 'PERCENT',
        discountValue: 30,
        applicablePlans: ['PRO', 'ENTERPRISE'],
        isActive: true,
        usageCount: 0,
      },
      {
        id: 'cpn-c',
        code: 'BEMVINDO15',
        audience: 'CONSUMER',
        discountType: 'PERCENT',
        discountValue: 15,
        isActive: true,
        usageCount: 0,
      },
    ];
    const b2cEvalMerchant = evaluateCheckoutCoupon({
      coupons: clientCouponSample,
      couponCode: 'LOJAPRO30',
      storeId: primaryStore.id,
      cartTotal: 100,
    });
    const b2bEvalConsumer = evaluateMerchantCoupon({
      coupons: clientCouponSample,
      couponCode: 'BEMVINDO15',
      selectedPlan: 'PRO',
      subscriptionAmount: 299,
    });
    const b2bEvalWrongPlan = evaluateMerchantCoupon({
      coupons: clientCouponSample,
      couponCode: 'LOJAPRO30',
      selectedPlan: 'BASIC',
      subscriptionAmount: 149,
    });
    const b2bEvalValid = evaluateMerchantCoupon({
      coupons: clientCouponSample,
      couponCode: 'LOJAPRO30',
      selectedPlan: 'PRO',
      subscriptionAmount: 300,
    });

    check(
      ownerCreateMerchantCoupon.status === 403 &&
        devMerchantWithStore.status === 400 &&
        devCreateMerchantCoupon.status === 200 &&
        devCreateConsumerCoupon.status === 200 &&
        pubCouponsRes.status === 200 &&
        pubMerchantFilterRes.status === 403 &&
        custMerchantFilterRes.status === 403 &&
        custGenericGetMerchantRes.status === 403 &&
        publicHidesMerchant &&
        genericHidesMerchant &&
        hqSplitCorrect &&
        consumerOrderWithMerchantCoupon.status === 201 &&
        (orderMerchantCouponJson?.order?.discount ?? orderMerchantCouponJson?.discount ?? 0) === 0 &&
        upgradeWithConsumerCoupon.status === 400 &&
        upgradeWrongPlanCoupon.status === 400 &&
        upgradeValidMerchantCoupon.status === 200 &&
        upgradeValidJson?.pendingUpgradeRequest?.couponCode === 'LOJAPRO30' &&
        upgradeValidJson?.pendingUpgradeRequest?.couponDiscount > 0 &&
        upgradeValidJson?.pendingUpgradeRequest?.estimatedAmount <
          upgradeValidJson?.pendingUpgradeRequest?.originalAmount &&
        merchantCouponAfterUse?.usageCount === 1 &&
        b2cEvalMerchant.isInvalid === true &&
        b2cEvalMerchant.discount === 0 &&
        b2bEvalConsumer.isInvalid === true &&
        b2bEvalWrongPlan.isInvalid === true &&
        b2bEvalValid.isInvalid === false &&
        b2bEvalValid.discount === 90,
      'Critério 21: Separação estrita B2C (CONSUMER) vs B2B (MERCHANT) no HQ CRM, Checkout Marketplace e Billing Upgrade SaaS',
      `ownerMer=${ownerCreateMerchantCoupon.status}, merStore=${devMerchantWithStore.status}, pubFilter=${pubMerchantFilterRes.status}/${custMerchantFilterRes.status}, genMer=${custGenericGetMerchantRes.status}, hidePub=${publicHidesMerchant}/${genericHidesMerchant}, splitHq=${hqSplitCorrect}, ordStatus=${consumerOrderWithMerchantCoupon.status}, upgCons=${upgradeWithConsumerCoupon.status}, upgPlan=${upgradeWrongPlanCoupon.status}, upgOk=${upgradeValidMerchantCoupon.status}, uses=${merchantCouponAfterUse?.usageCount}`
    );

    // =========================================================================
    // CRITÉRIO 22: Governança Customizável, Explorador TBL com Redação e Radar de Contas HQ
    // =========================================================================
    const govCustomResp = await fetch(`${baseUrl}/api/v1/admin/governance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
      body: JSON.stringify({
        globalCommissionRate: 12.5,
        defaultTrialDays: 14,
        defaultPlatformDeliveryFee: 8.5,
        maxConcurrentOrdersPerStore: 120,
        customPlatformName: '3C Enterprise Cloud',
        supportWhatsapp: '+5511999990000',
        supportEmail: 'gov@3ccorp.com.br',
        globalAnnouncementBanner: 'Manutenção programada domingo 03h',
      }),
    });
    const govCustomJson: any = await govCustomResp.json();

    const storeCustomSubResp = await fetch(
      `${baseUrl}/api/v1/admin/stores/${primaryStore.id}/subscription`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokDev}` },
        body: JSON.stringify({
          subscriptionPlan: 'PRO',
          maxAllowedBranches: 4,
          maxAllowedDevices: 25,
          saasMonthlyFee: 349,
          commissionRate: 9.5,
          enabledModules: ['pos', 'kds', 'tables', 'finance', 'crm', 'analytics'],
        }),
      }
    );
    const storeCustomSubJson: any = await storeCustomSubResp.json();

    const [
      tblOwnerBlocked,
      tblInvalidTable,
      tblSuperUsersRes,
      tblDevStoresRes,
      secOwnerBlocked,
      secSuperRes,
    ] = await Promise.all([
      fetch(`${baseUrl}/api/v1/admin/diagnostics/tables?table=users`, {
        headers: { Authorization: `Bearer ${tokOwnerB}` },
      }),
      fetch(`${baseUrl}/api/v1/admin/diagnostics/tables?table=evil_sql_injection`, {
        headers: { Authorization: `Bearer ${tokDev}` },
      }),
      fetch(`${baseUrl}/api/v1/admin/diagnostics/tables?table=users&q=dono`, {
        headers: { Authorization: `Bearer ${tokSuperAdmin}` },
      }),
      fetch(`${baseUrl}/api/v1/admin/diagnostics/tables?table=stores&tenantId=${encodeURIComponent(tenantAId)}`, {
        headers: { Authorization: `Bearer ${tokDev}` },
      }),
      fetch(`${baseUrl}/api/v1/admin/diagnostics/account-security`, {
        headers: { Authorization: `Bearer ${tokOwnerB}` },
      }),
      fetch(`${baseUrl}/api/v1/admin/diagnostics/account-security`, {
        headers: { Authorization: `Bearer ${tokSuperAdmin}` },
      }),
    ]);

    const tblSuperUsersJson: any = await tblSuperUsersRes.json();
    const tblDevStoresJson: any = await tblDevStoresRes.json();
    const secSuperJson: any = await secSuperRes.json();

    const tblUsersRedacted =
      Array.isArray(tblSuperUsersJson?.rows) &&
      tblSuperUsersJson.rows.length > 0 &&
      tblSuperUsersJson.rows.every(
        (u: any) => u.passwordHash === undefined && u.passwordResetCodeHash === undefined
      );

    check(
      govCustomResp.status === 200 &&
        govCustomJson?.governance?.globalCommissionRate === 12.5 &&
        govCustomJson?.governance?.defaultTrialDays === 14 &&
        govCustomJson?.governance?.defaultPlatformDeliveryFee === 8.5 &&
        govCustomJson?.governance?.customPlatformName === '3C Enterprise Cloud' &&
        storeCustomSubResp.status === 200 &&
        storeCustomSubJson?.store?.maxAllowedBranches === 4 &&
        storeCustomSubJson?.store?.maxAllowedDevices === 25 &&
        storeCustomSubJson?.store?.commissionRate === 9.5 &&
        Array.isArray(storeCustomSubJson?.store?.enabledModules) &&
        storeCustomSubJson.store.enabledModules.length === 6 &&
        tblOwnerBlocked.status === 403 &&
        tblInvalidTable.status === 400 &&
        tblSuperUsersRes.status === 200 &&
        tblUsersRedacted &&
        Array.isArray(tblSuperUsersJson?.tablesCatalog) &&
        tblSuperUsersJson.tablesCatalog.length >= 20 &&
        tblDevStoresRes.status === 200 &&
        Array.isArray(tblDevStoresJson?.rows) &&
        tblDevStoresJson.rows.every((s: any) => s.tenantId === tenantAId) &&
        secOwnerBlocked.status === 403 &&
        secSuperRes.status === 200 &&
        typeof secSuperJson?.summary?.totalAccounts === 'number' &&
        Array.isArray(secSuperJson?.passwordRecoveryQueue),
      'Critério 22: Governança Customizável HQ, Override de Módulos/Cotas por Loja, Explorador TBL com Redação de Segredos e Radar de Contas',
      `gov=${govCustomResp.status}, sub=${storeCustomSubResp.status}, tblOwner=${tblOwnerBlocked.status}, tblBad=${tblInvalidTable.status}, tblSuper=${tblSuperUsersRes.status}, redacted=${tblUsersRedacted}, sec=${secOwnerBlocked.status}/${secSuperRes.status}`
    );

  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log(`\n======================================================================`);
  console.log(`Resultado Auditoria HQ Central: ${passed} verificações aprovadas, ${failed} falhas.`);
  console.log(`======================================================================`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
