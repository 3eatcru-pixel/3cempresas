import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';

function pass(msg: string) {
  console.log(`✓ ${msg}`);
}

async function main() {
  const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-supabase-test-'));
  process.env.SERVER_DB_PATH = path.join(sandboxDir, 'server-db.json');
  process.env.SERVER_SECRET_PATH = path.join(sandboxDir, '.server-secret');
  process.env.SERVER_SECRET = 'test-secret-supabase-optional-connector-2026';
  process.env.SUPABASE_URL = '';
  process.env.SUPABASE_PUBLISHABLE_KEY = '';
  process.env.SUPABASE_PUBLISHABLE_KEYS = '';
  process.env.SUPABASE_SECRET_KEY = '';
  process.env.SUPABASE_SECRET_KEYS = '';
  process.env.SUPABASE_JWKS_URL = '';
  process.env.VITE_SUPABASE_URL = '';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = '';

  // 1. Validate client & provider boundary without env configured
  const {
    configureSupabaseClientRuntime,
    getSupabaseClient,
    getSupabaseRuntimeMetadata,
  } = await import('../../src/utils/supabase.ts');
  assert.strictEqual(getSupabaseClient(), null);
  assert.strictEqual(getSupabaseRuntimeMetadata().configured, false);
  pass('Cliente Supabase retorna null de forma segura quando sem env');

  configureSupabaseClientRuntime({
    url: 'https://demo-project.supabase.co',
    publishableKey: 'sb_publishable_demo_public_key_12345',
  });
  const dynamicMeta = getSupabaseRuntimeMetadata();
  assert.strictEqual(dynamicMeta.configured, true);
  assert.strictEqual(dynamicMeta.jwksUrl, 'https://demo-project.supabase.co/auth/v1/.well-known/jwks.json');
  pass('configureSupabaseClientRuntime atualiza URL/JWKS dinamicamente via HQ/Server');

  // 2. Validate SecondarySupabaseProvider & ProviderManager descriptors
  const { SecondarySupabaseProvider } = await import(
    '../../src/infrastructure/providers/secondary/supabase-provider.ts'
  );
  const { providerManager } = await import('../../src/infrastructure/providers/ProviderManager.ts');
  const sbProvider = new SecondarySupabaseProvider();
  assert.strictEqual(sbProvider.isAuthoritativeForCommercialData, false);
  sbProvider.syncFromGovernance({
    featureFlags: { supabaseEnabled: false, supabaseAuthEnabled: true, supabaseDbEnabled: true },
  } as any);
  const standbyHealth = await sbProvider.checkHealth();
  assert.strictEqual(standbyHealth.connected, false);
  assert.ok(standbyHealth.detail.includes('standby pelo HQ Central'));
  const descriptors = providerManager.getProviderDescriptors();
  assert.ok(descriptors.some((d) => d.id === 'SECONDARY_SUPABASE_PROVIDER'));
  pass('SecondarySupabaseProvider respeita kill-switch do HQ e integra ProviderManager');

  // Reset dynamic client config before spinning up Server Core
  configureSupabaseClientRuntime({ url: null, publishableKey: null, jwksUrl: null });

  const { createServerCoreApp } = await import('../../src/server/app.ts');
  const app = createServerCoreApp();
  const server = await new Promise<any>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}/api/v1`;

    // 3. Unconfigured providers response preserves Server Core autonomy
    const provInit = await (await fetch(`${baseUrl}/auth/providers`)).json();
    assert.strictEqual(provInit.autonomousEmailPassword, true);
    assert.strictEqual(provInit.supabaseConfigured, false);
    assert.strictEqual(provInit.supabaseEnabled, false);
    assert.strictEqual((provInit as any).supabaseSecretKey, undefined);
    pass('GET /auth/providers reporta supabaseConfigured=false sem vazar segredos');

    // 4. Authenticate as DEV_OWNER
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-3c-app-id': 'hq' },
      body: JSON.stringify({ email: '3eatcru@gmail.com', password: 'SetPassword2026' }),
    });
    assert.strictEqual(loginRes.status, 200);
    const { token: hqToken } = await loginRes.json();
    pass('Login DEV_OWNER obtido com sucesso');

    // 5. Governance MUST reject secret keys (sb_secret_ / service_role) in runtimePolicy
    const rejectSecretRes = await fetch(`${baseUrl}/admin/governance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hqToken}`,
        'x-3c-app-id': 'hq',
      },
      body: JSON.stringify({
        runtimePolicy: {
          supabaseUrl: 'https://demo-project.supabase.co',
          supabasePublishableKey: 'sb_secret_MUST_BE_REJECTED',
        },
      }),
    });
    assert.strictEqual(rejectSecretRes.status, 400);
    pass('PUT /admin/governance bloqueia sb_secret_ em runtimePolicy (HTTP 400)');

    // 6. Governance accepts non-secret URL + publishable key and updates /auth/providers
    const saveValidPolicyRes = await fetch(`${baseUrl}/admin/governance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hqToken}`,
        'x-3c-app-id': 'hq',
      },
      body: JSON.stringify({
        runtimePolicy: {
          supabaseUrl: 'https://demo-project.supabase.co',
          supabasePublishableKey: 'sb_publishable_safe_public_key',
          supabaseJwksUrl: 'https://demo-project.supabase.co/auth/v1/.well-known/jwks.json',
        },
      }),
    });
    assert.strictEqual(saveValidPolicyRes.status, 200);
    const provAfterPolicy = await (await fetch(`${baseUrl}/auth/providers`)).json();
    assert.strictEqual(provAfterPolicy.supabaseConfigured, true);
    assert.strictEqual(provAfterPolicy.supabaseEnabled, true);
    assert.strictEqual(provAfterPolicy.supabaseUrl, 'https://demo-project.supabase.co');
    pass('PUT /admin/governance hidrata runtimePolicy Supabase e reflete em /auth/providers');

    // 7. Tampered Supabase JWT must be rejected (HTTP 401)
    const badJwtRes = await fetch(`${baseUrl}/auth/supabase-exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-3c-app-id': 'marketplace' },
      body: JSON.stringify({ accessToken: 'forged.jwt.token', contextId: 'marketplace' }),
    });
    assert.strictEqual(badJwtRes.status, 401);
    pass('POST /auth/supabase-exchange rejeita JWT adulterado com HTTP 401');

    // 8. HQ 1-click kill-switch turns Supabase OFF across /auth/providers, /supabase-exchange & /supabase/health
    const toggleOffRes = await fetch(`${baseUrl}/admin/governance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hqToken}`,
        'x-3c-app-id': 'hq',
      },
      body: JSON.stringify({ featureFlags: { supabaseEnabled: false } }),
    });
    assert.strictEqual(toggleOffRes.status, 200);

    const provOff = await (await fetch(`${baseUrl}/auth/providers`)).json();
    assert.strictEqual(provOff.supabaseEnabled, false);

    const blockedExchangeRes = await fetch(`${baseUrl}/auth/supabase-exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-3c-app-id': 'marketplace' },
      body: JSON.stringify({ accessToken: 'any.jwt.here', contextId: 'marketplace' }),
    });
    assert.strictEqual(blockedExchangeRes.status, 403);

    const standbyHealthRes = await fetch(`${baseUrl}/supabase/health`, {
      headers: { Authorization: `Bearer ${hqToken}`, 'x-3c-app-id': 'hq' },
    });
    assert.strictEqual(standbyHealthRes.status, 200);
    const standbyJson = await standbyHealthRes.json();
    assert.strictEqual(standbyJson.standbyByHq, true);
    assert.strictEqual(standbyJson.migrationsReady, true);
    assert.ok(standbyJson.migrationsCount >= 1);
    assert.ok(String(standbyJson.latestMigration || '').endsWith('.sql'));
    pass('Kill-switch 1-clique HQ bloqueia /supabase-exchange (403) e coloca /supabase/health em STANDBY (com migrations SQL detectadas)');

    // 9. Unauthorized public/consumer access to /supabase/health must be rejected
    const unauthHealthRes = await fetch(`${baseUrl}/supabase/health`);
    assert.strictEqual(unauthHealthRes.status, 401);
    pass('GET /supabase/health exige autenticação administrativa (401 sem token)');

    console.log('✅ [OK] Supabase Optional Connector Security & Governance Suite (9/9 assertions passed)');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('❌ [FAIL] supabase-optional-connector.test.ts:', err);
  process.exit(1);
});
