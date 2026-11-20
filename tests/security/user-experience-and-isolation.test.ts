/**
 * Suite 20 — Experiência & Isolamento Estrito por Tipo de Usuário (5 Personas)
 * Valida fronteiras de autenticação (`x-3c-app-id` / `contextId`), privacidade (sem vazar HQ),
 * permissões operacionais e fluxos isolados para:
 * 1. Consumidor Final (Marketplace)
 * 2. Lojista & Equipe (Store OS)
 * 3. Dev Owner / Governança (HQ Central)
 * 4. Garçom (3C Waiter)
 * 5. Motorista / Entregador (3C Driver)
 */
import express from 'express';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-ux-persona-iso-'));
if (!process.env.SERVER_DB_PATH) process.env.SERVER_DB_PATH = path.join(tempDir, 'ux-persona-db.json');
if (!process.env.SERVER_SECRET_PATH) process.env.SERVER_SECRET_PATH = path.join(tempDir, '.server-secret');
if (!process.env.SERVER_SECRET) process.env.SERVER_SECRET = '3c_ux_persona_isolation_secret_2026';

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string, detail?: any) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`, detail !== undefined ? JSON.stringify(detail) : '');
  }
}

async function reqJson(
  baseUrl: string,
  urlPath: string,
  opts: { method?: string; token?: string; appId?: string; body?: any } = {}
) {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.appId ? { 'X-3C-App-Id': opts.appId } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  const { auth, db, hashPassword } = await import('../../src/server/config.ts');
  const { attachContractContext } = await import('../../src/server/middleware/contracts.ts');
  const { default: authRoutes } = await import('../../src/server/routes/auth.ts');
  const { default: adminRoutes } = await import('../../src/server/routes/admin.ts');
  const { default: storeRoutes } = await import('../../src/server/routes/store.ts');
  const { default: commerceRoutes } = await import('../../src/server/routes/commerce.ts');
  const { default: genericRoutes } = await import('../../src/server/routes/generic.ts');
  const { default: systemRoutes } = await import('../../src/server/routes/system.ts');

  const app = express();
  app.use(express.json());
  app.use(attachContractContext);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/store', storeRoutes);
  app.use('/api/v1/commerce', commerceRoutes);
  app.use('/api/v1/system', systemRoutes);
  app.use('/api/v1', genericRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    console.log('\n[Suite 20] Experiência & Isolamento Estrito por Persona (5 Produtos)');

    await db.collection('tenants').doc('tenant-1').set({
      id: 'tenant-1',
      name: 'Bistrô Central',
      status: 'ACTIVE',
    });
    await db.collection('tenants').doc('tenant-2').set({
      id: 'tenant-2',
      name: 'Empório Norte',
      status: 'ACTIVE',
    });
    await db.collection('stores').doc('store-1').set({
      id: 'store-1',
      tenantId: 'tenant-1',
      name: 'Bistrô Central',
      slug: 'bistro-central',
      status: 'ACTIVE',
      isOpen: true,
    });
    await db.collection('stores').doc('store-2').set({
      id: 'store-2',
      tenantId: 'tenant-2',
      name: 'Empório Norte',
      slug: 'emporio-norte',
      status: 'ACTIVE',
      isOpen: true,
    });

    const pwdHash = hashPassword('SenhaForte2026!');

    await db.collection('users').doc('usr-dev-20').set({
      uid: 'usr-dev-20',
      id: 'usr-dev-20',
      email: 'dev20@3ccorp.com',
      name: 'Dev Master',
      role: 'DEV_OWNER',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      emailVerified: true,
      passwordHash: pwdHash,
    });

    await db.collection('users').doc('usr-merchant-20').set({
      uid: 'usr-merchant-20',
      id: 'usr-merchant-20',
      email: 'lojista20@bistro.com',
      name: 'Lojista 20',
      role: 'STORE_OWNER',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      allowedStoreIds: ['store-1'],
      status: 'ACTIVE',
      emailVerified: true,
      passwordHash: pwdHash,
    });

    await db.collection('users').doc('usr-waiter-20').set({
      uid: 'usr-waiter-20',
      id: 'usr-waiter-20',
      email: 'garcom20@bistro.com',
      name: 'Garçom 20',
      role: 'WAITER',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      allowedStoreIds: ['store-1'],
      status: 'ACTIVE',
      emailVerified: true,
      passwordHash: pwdHash,
    });

    await db.collection('users').doc('usr-driver-20').set({
      uid: 'usr-driver-20',
      id: 'usr-driver-20',
      email: 'moto20@3cdriver.com',
      name: 'Entregador 20',
      role: 'COURIER',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      fleetType: 'STORE_FLEET',
      allowedFleetModes: ['STORE_FLEET', 'PLATFORM_FLEET'],
      status: 'ACTIVE',
      emailVerified: true,
      passwordHash: pwdHash,
    });

    await db.collection('users').doc('usr-customer-20').set({
      uid: 'usr-customer-20',
      id: 'usr-customer-20',
      email: 'cliente20@gmail.com',
      name: 'Cliente 20',
      role: 'CUSTOMER',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      emailVerified: true,
      passwordHash: pwdHash,
    });

    // 1. CONSUMIDOR FINAL (MARKETPLACE)
    const custLoginMkt = await reqJson(baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      appId: 'marketplace',
      body: { email: 'cliente20@gmail.com', password: 'SenhaForte2026!', contextId: 'marketplace' },
    });
    assert(custLoginMkt.status === 200 && Boolean(custLoginMkt.data?.token), 'Persona Consumidor autentica no Marketplace');

    const custToken = custLoginMkt.data.token;
    for (const forbiddenApp of ['store-os', 'hq', 'server-core', 'waiter', 'driver']) {
      const crossLogin = await reqJson(baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        appId: forbiddenApp,
        body: { email: 'cliente20@gmail.com', password: 'SenhaForte2026!', contextId: forbiddenApp },
      });
      assert(crossLogin.status === 403, `Consumidor bloqueado (403) ao tentar entrar em ${forbiddenApp}`);
    }

    const custMeWrongApp = await reqJson(baseUrl, '/api/v1/auth/me', {
      token: custToken,
      appId: 'store-os',
    });
    assert(custMeWrongApp.status === 403, 'Sessão de Consumidor bloqueada (403) ao restaurar em /auth/me do Store OS');

    const custAdminAccess = await reqJson(baseUrl, '/api/v1/admin/users', {
      token: custToken,
      appId: 'marketplace',
    });
    assert(custAdminAccess.status === 403, 'Consumidor bloqueado (403) em rotas de governança HQ');

    // 2. PRIVACIDADE: DEV_OWNER tentando login no Marketplace/Store OS/Waiter/Driver nunca vaza suggestedAppId:'hq'
    for (const nonHqApp of ['marketplace', 'store-os', 'waiter', 'driver']) {
      const devLeakAttempt = await reqJson(baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        appId: nonHqApp,
        body: { email: 'dev20@3ccorp.com', password: 'SenhaForte2026!', contextId: nonHqApp },
      });
      assert(
        devLeakAttempt.status === 403 &&
          !devLeakAttempt.data?.suggestedAppId &&
          !/hq/i.test(String(devLeakAttempt.data?.error || '')),
        `Login de Dev Owner em '${nonHqApp}' retorna 403 neutro sem vazar HQ nem suggestedAppId`
      );
    }

    // 3. LOJISTA (STORE OS)
    const merchantLogin = await reqJson(baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      appId: 'store-os',
      body: { email: 'lojista20@bistro.com', password: 'SenhaForte2026!', contextId: 'store-os' },
    });
    assert(merchantLogin.status === 200 && Boolean(merchantLogin.data?.token), 'Persona Lojista autentica no Store OS');
    const merchantToken = merchantLogin.data.token;

    for (const forbiddenApp of ['marketplace', 'hq', 'server-core', 'driver']) {
      const res = await reqJson(baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        appId: forbiddenApp,
        body: { email: 'lojista20@bistro.com', password: 'SenhaForte2026!', contextId: forbiddenApp },
      });
      assert(res.status === 403, `Lojista bloqueado (403) ao tentar logar no app '${forbiddenApp}'`);
    }

    const merchantGovBlocked = await reqJson(baseUrl, '/api/v1/admin/governance', {
      method: 'PUT',
      token: merchantToken,
      appId: 'store-os',
      body: { maintenanceMode: true },
    });
    assert(merchantGovBlocked.status === 403, 'Lojista bloqueado (403) ao tentar alterar governança HQ');

    // 4. DEV OWNER (HQ CENTRAL)
    const devLoginHq = await reqJson(baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      appId: 'hq',
      body: { email: 'dev20@3ccorp.com', password: 'SenhaForte2026!', contextId: 'hq' },
    });
    assert(devLoginHq.status === 200 && Boolean(devLoginHq.data?.token), 'Persona Dev Owner autentica no HQ Central');
    const devToken = devLoginHq.data.token;

    const devSentinelAccess = await reqJson(baseUrl, '/api/v1/admin/diagnostics/sentinel-logs', {
      token: devToken,
      appId: 'hq',
    });
    assert(devSentinelAccess.status === 200, 'Dev Owner acessa logs do Sentinel no HQ Central (200)');

    // 5. GARÇOM (3C WAITER)
    const waiterLogin = await reqJson(baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      appId: 'waiter',
      body: { email: 'garcom20@bistro.com', password: 'SenhaForte2026!', contextId: 'waiter' },
    });
    assert(waiterLogin.status === 200 && Boolean(waiterLogin.data?.token), 'Persona Garçom autentica no 3C Waiter');

    for (const forbiddenApp of ['store-os', 'hq', 'marketplace', 'driver']) {
      const res = await reqJson(baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        appId: forbiddenApp,
        body: { email: 'garcom20@bistro.com', password: 'SenhaForte2026!', contextId: forbiddenApp },
      });
      assert(res.status === 403, `Garçom bloqueado (403) ao tentar entrar no app '${forbiddenApp}'`);
    }

    // 6. ENTREGADOR (3C DRIVER)
    const driverLogin = await reqJson(baseUrl, '/api/v1/auth/login', {
      method: 'POST',
      appId: 'driver',
      body: { email: 'moto20@3cdriver.com', password: 'SenhaForte2026!', contextId: 'driver' },
    });
    assert(driverLogin.status === 200 && Boolean(driverLogin.data?.token), 'Persona Entregador autentica no 3C Driver');

    for (const forbiddenApp of ['store-os', 'hq', 'marketplace', 'waiter']) {
      const res = await reqJson(baseUrl, '/api/v1/auth/login', {
        method: 'POST',
        appId: forbiddenApp,
        body: { email: 'moto20@3cdriver.com', password: 'SenhaForte2026!', contextId: forbiddenApp },
      });
      assert(res.status === 403, `Entregador bloqueado (403) ao tentar entrar no app '${forbiddenApp}'`);
    }

    // 7. SANIDADE ESTÁTICA DAS TELAS & LOGIN POR PRODUTO
    const authModalSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/common/AuthModal.tsx'), 'utf8');
    const authBannersSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/common/auth/AuthModalBanners.tsx'),
      'utf8'
    );
    const onboardingSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules/store-os/layout/StoreOsOnboardingGate.tsx'),
      'utf8'
    );
    assert(
      authModalSrc.includes("getActiveClientAppId() === 'unified-portal' && authModalContext === 'portal'"),
      'AuthModal só libera alternador cross-produto no contexto genérico do portal unificado'
    );
    assert(
      !authBannersSrc.includes("if (ctx === 'hq') return 'HQ Central"),
      'AuthModalBanners não expõe rótulo nem salto para HQ Central aos usuários finais'
    );
    assert(
      !onboardingSrc.includes('desenvolvedores'),
      'StoreOsOnboardingGate não exibe termos de desenvolvedor ao lojista/equipe'
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore temp cleanup failure
    }
  }

  console.log(`\nResumo Suite 20: ${passed} ✓ aprovadas / ${failed} ✗ falhas`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[Suite 20 Error]', err);
  process.exit(1);
});
