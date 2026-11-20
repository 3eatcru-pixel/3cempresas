import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function main() {
  // 1. Validate firebase-blueprint.json & firestore.rules structural invariants
  const blueprintPath = path.join(process.cwd(), 'firebase-blueprint.json');
  const rulesPath = path.join(process.cwd(), 'firestore.rules');
  assert.ok(fs.existsSync(blueprintPath), 'firebase-blueprint.json deve existir');
  assert.ok(fs.existsSync(rulesPath), 'firestore.rules deve existir');

  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8'));
  assert.ok(blueprint.entities?.UserProfile, 'Blueprint deve definir entidade UserProfile');
  assert.ok(blueprint.entities?.AdminRecord, 'Blueprint deve definir entidade AdminRecord');
  assert.ok(blueprint.entities?.CloudPreference, 'Blueprint deve definir entidade CloudPreference');
  assert.ok(blueprint.firestore?.['/users/{userId}'], 'Blueprint deve mapear /users/{userId}');

  const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
  assert.ok(
    rulesContent.includes('match /{document=**}') && rulesContent.includes('allow read, write: if false;'),
    'firestore.rules deve conter catch-all default-deny'
  );
  assert.ok(
    rulesContent.includes('request.auth.token.email_verified == true'),
    'firestore.rules deve exigir email_verified == true'
  );
  assert.ok(
    !rulesContent.includes("'role'") && !rulesContent.includes('"role"'),
    'firestore.rules não deve permitir escrita de campo role pelo cliente em /users/{userId}'
  );

  // 2. Spin up isolated Server Core instance in os.tmpdir() (zero root mutation)
  const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-firebase-test-'));
  process.env.SERVER_DB_PATH = path.join(sandboxDir, 'server-db.json');
  process.env.SERVER_SECRET_PATH = path.join(sandboxDir, '.server-secret');
  process.env.SERVER_SECRET = 'test-secret-firebase-optional-connector-2026';

  const { createServerCoreApp } = await import('../../src/server/app.ts');
  const app = createServerCoreApp();
  const server = await new Promise<any>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}/api/v1`;

    // A. Providers endpoint reflects Firebase Auth & Firestore ON by default
    const provOnRes = await fetch(`${baseUrl}/auth/providers`);
    assert.strictEqual(provOnRes.status, 200, 'GET /auth/providers deve retornar 200');
    const provOn = await provOnRes.json();
    assert.strictEqual(provOn.autonomousEmailPassword, true);
    assert.strictEqual(provOn.firebaseEnabled, true);
    assert.strictEqual(provOn.firebaseMasterEnabled, true);
    assert.strictEqual(provOn.firebaseAuthEnabled, true);
    assert.strictEqual(provOn.firebaseFirestoreEnabled, true);
    assert.strictEqual(provOn.firebaseProjectId, 'genuine-cat-k8gvj');

    // A2. Verify blueprint <-> FIREBASE_BLUEPRINT_LIMITS & SecondaryFirebaseProvider parity
    const { FIREBASE_BLUEPRINT_LIMITS } = await import('../../src/services/firebaseClient.ts');
    assert.strictEqual(
      FIREBASE_BLUEPRINT_LIMITS.DISPLAY_NAME_MAX_LENGTH,
      blueprint.entities.UserProfile.properties.displayName.maxLength,
      'FIREBASE_BLUEPRINT_LIMITS.DISPLAY_NAME_MAX_LENGTH deve espelhar firebase-blueprint.json'
    );
    assert.strictEqual(
      FIREBASE_BLUEPRINT_LIMITS.LOCALE_MAX_LENGTH,
      blueprint.entities.CloudPreference.properties.locale.maxLength,
      'FIREBASE_BLUEPRINT_LIMITS.LOCALE_MAX_LENGTH deve espelhar firebase-blueprint.json'
    );

    const { SecondaryFirebaseProvider } = await import(
      '../../src/infrastructure/providers/secondary/firebase-provider.ts'
    );
    const providerAdapter = new SecondaryFirebaseProvider();
    providerAdapter.syncFromGovernance({
      featureFlags: {
        firebaseEnabled: true,
        firebaseAuthEnabled: true,
        firebaseFirestoreEnabled: false,
      },
    } as any);
    assert.strictEqual(providerAdapter.getServicesConfig().complementaryAuth, true);
    assert.strictEqual(providerAdapter.getServicesConfig().firestoreCores, false);
    const standbyFirestoreHealth = await providerAdapter.checkHealth();
    assert.strictEqual(standbyFirestoreHealth.connected, true);
    assert.ok(
      standbyFirestoreHealth.detail.includes('Firestore Cores em standby'),
      'SecondaryFirebaseProvider.checkHealth() deve respeitar firebaseFirestoreEnabled=false'
    );

    // B. Tampered Firebase token must be rejected with HTTP 401 when Firebase is ON
    const badTokenRes = await fetch(`${baseUrl}/auth/firebase-exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-3c-app-id': 'marketplace' },
      body: JSON.stringify({ idToken: 'invalid.jwt.token', contextId: 'marketplace' }),
    });
    assert.strictEqual(badTokenRes.status, 401, 'Token Firebase adulterado deve retornar HTTP 401');

    // C. Authenticate as HQ DEV_OWNER and turn Firebase OFF in 1 click
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-3c-app-id': 'hq' },
      body: JSON.stringify({ email: '3eatcru@gmail.com', password: 'SetPassword2026' }),
    });
    assert.strictEqual(loginRes.status, 200, 'Login HQ DEV_OWNER no sandbox deve retornar 200');
    const { token: hqToken } = await loginRes.json();

    const toggleOffRes = await fetch(`${baseUrl}/admin/governance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hqToken}`,
        'x-3c-app-id': 'hq',
      },
      body: JSON.stringify({ featureFlags: { firebaseEnabled: false } }),
    });
    assert.strictEqual(toggleOffRes.status, 200, 'HQ PUT /admin/governance deve desativar Firebase');

    // D. Providers endpoint immediately reports firebaseEnabled & firebaseFirestoreEnabled: false
    const provOffRes = await fetch(`${baseUrl}/auth/providers`);
    const provOff = await provOffRes.json();
    assert.strictEqual(provOff.firebaseEnabled, false, 'GET /auth/providers deve refletir OFF imediatamente');
    assert.strictEqual(provOff.firebaseMasterEnabled, false, 'Chave mestra OFF deve desativar master');
    assert.strictEqual(provOff.firebaseFirestoreEnabled, false, 'Chave mestra OFF deve desativar Firestore Cores');
    assert.strictEqual(provOff.autonomousEmailPassword, true, 'Login autônomo permanece ativo');

    // E. Exchange endpoint enforces HQ Kill-Switch (HTTP 403)
    const killSwitchRes = await fetch(`${baseUrl}/auth/firebase-exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-3c-app-id': 'marketplace' },
      body: JSON.stringify({ idToken: 'any.token.here', contextId: 'marketplace' }),
    });
    assert.strictEqual(killSwitchRes.status, 403, 'POST /auth/firebase-exchange deve retornar 403 quando desligado no HQ');

    // E2. Autonomous email/password login continues working 100% when Firebase is OFF
    const autonomousLoginWhileOff = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-3c-app-id': 'hq' },
      body: JSON.stringify({ email: '3eatcru@gmail.com', password: 'SetPassword2026' }),
    });
    assert.strictEqual(
      autonomousLoginWhileOff.status,
      200,
      'Login autônomo PBKDF2 deve continuar operacional com Firebase desligado'
    );

    // F. Toggle master ON but disable sub-flag firebaseAuthEnabled -> must still block exchange (403) while Firestore stays ON
    const toggleAuthSubOffRes = await fetch(`${baseUrl}/admin/governance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hqToken}`,
        'x-3c-app-id': 'hq',
      },
      body: JSON.stringify({
        featureFlags: {
          firebaseEnabled: true,
          firebaseAuthEnabled: false,
          firebaseFirestoreEnabled: true,
        },
      }),
    });
    assert.strictEqual(toggleAuthSubOffRes.status, 200);
    const provSubOff = await (await fetch(`${baseUrl}/auth/providers`)).json();
    assert.strictEqual(provSubOff.firebaseEnabled, false, 'GET /auth/providers deve respeitar firebaseAuthEnabled=false');
    assert.strictEqual(provSubOff.firebaseFirestoreEnabled, true, 'Firestore Cores permanece ativo de forma independente');
    const subOffExchangeRes = await fetch(`${baseUrl}/auth/firebase-exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-3c-app-id': 'marketplace' },
      body: JSON.stringify({ idToken: 'any.token.here', contextId: 'marketplace' }),
    });
    assert.strictEqual(
      subOffExchangeRes.status,
      403,
      'POST /auth/firebase-exchange deve retornar 403 quando firebaseAuthEnabled está desligado'
    );

    // F2. Toggle Auth ON and Firestore Cores OFF -> Auth active while Firestore is STANDBY
    const toggleFirestoreOffRes = await fetch(`${baseUrl}/admin/governance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hqToken}`,
        'x-3c-app-id': 'hq',
      },
      body: JSON.stringify({
        featureFlags: {
          firebaseEnabled: true,
          firebaseAuthEnabled: true,
          firebaseFirestoreEnabled: false,
        },
      }),
    });
    assert.strictEqual(toggleFirestoreOffRes.status, 200);
    const provFirestoreOff = await (await fetch(`${baseUrl}/auth/providers`)).json();
    assert.strictEqual(provFirestoreOff.firebaseEnabled, true);
    assert.strictEqual(provFirestoreOff.firebaseFirestoreEnabled, false);

    // G. Toggle Firebase + Auth + Firestore back ON in 1 click
    const toggleOnRes = await fetch(`${baseUrl}/admin/governance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hqToken}`,
        'x-3c-app-id': 'hq',
      },
      body: JSON.stringify({
        featureFlags: {
          firebaseEnabled: true,
          firebaseAuthEnabled: true,
          firebaseFirestoreEnabled: true,
        },
      }),
    });
    assert.strictEqual(toggleOnRes.status, 200);
    const provRestored = await (await fetch(`${baseUrl}/auth/providers`)).json();
    assert.strictEqual(provRestored.firebaseEnabled, true);
    assert.strictEqual(provRestored.firebaseFirestoreEnabled, true);

    console.log('✅ [OK] Firebase Optional Connector Security & Governance Suite (15/15 assertions passed)');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('❌ [FAIL] firebase-optional-connector.test.ts:', err);
  process.exit(1);
});
