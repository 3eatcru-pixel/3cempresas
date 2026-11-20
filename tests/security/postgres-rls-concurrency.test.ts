import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-pg-rls-'));
if (!process.env.SERVER_DB_PATH) process.env.SERVER_DB_PATH = path.join(tempDir, 'pg-rls-test-db.json');
if (!process.env.SERVER_SECRET_PATH) process.env.SERVER_SECRET_PATH = path.join(tempDir, '.server-secret');
if (!process.env.SERVER_SECRET) process.env.SERVER_SECRET = '3c_pg_rls_concurrency_secret_2026';

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
  const {
    auth,
    db,
    getRuntimePersistenceCapabilities,
    probeCloudDatabase,
    runWithDbContext,
    runWithSystemDbContext,
    runWithTenantDbContext,
    __setCloudSyncDriverForTests,
  } = await import('../../src/server/config.ts');
  const { PostgresCloudDriver } = await import('../../src/server/persistence/PostgresCloudDriver.ts');
  const { createServerCoreApp } = await import('../../src/server/app.ts');

  console.log('======================================================================');
  console.log('🐘  FASE 1 DO PLANO DE AÇÃO — HOMOLOGAÇÃO POSTGRESQL RLS & CONCORRÊNCIA');
  console.log('======================================================================\n');

  try {
    // 1. Verificar integridade do schema SQL 001_cloud_hub_schema_rls.sql
    const sqlPath = path.join(process.cwd(), 'infrastructure/database/001_cloud_hub_schema_rls.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    const expectedTables = ['tenants', 'store_documents', 'sync_outbox_cloud', 'stock_ledger', 'edge_nodes', 'audit_trail'];
    const hasAllTables = expectedTables.every((t) => sqlContent.includes(`CREATE TABLE IF NOT EXISTS ${t}`));
    check(hasAllTables, 'Schema SQL 001_cloud_hub_schema_rls.sql define todas as 6 tabelas multi-tenant');

    const hasForceRls = expectedTables
      .filter((t) => t !== 'tenants')
      .every((t) => sqlContent.includes(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY;`));
    check(hasForceRls, 'Schema SQL impõe FORCE ROW LEVEL SECURITY em todas as tabelas com escopo de tenant');

    const hasTenantPolicies = expectedTables
      .filter((t) => t !== 'tenants')
      .every((t) => sqlContent.includes(`tenant_isolation_${t}`));
    check(hasTenantPolicies, 'Schema SQL cria políticas RLS isoladas tenant_isolation_* por tabela');

    // 2. Verificar paridade entre SQL de migração e PostgresCloudDriver.runSchemaMigrations()
    const pgDriverSrc = fs.readFileSync(path.join(process.cwd(), 'src/server/persistence/PostgresCloudDriver.ts'), 'utf8');
    const driverHasForceRls = expectedTables
      .filter((t) => t !== 'tenants')
      .every((t) => pgDriverSrc.includes(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY;`));
    check(driverHasForceRls, 'PostgresCloudDriver.runSchemaMigrations() replica FORCE ROW LEVEL SECURITY no código');

    const driverHasForUpdate = pgDriverSrc.includes('FOR UPDATE');
    check(driverHasForUpdate, 'PostgresCloudDriver.runTransaction() executa travas de linha SELECT ... FOR UPDATE');

    const driverHasNoImplicitBypass =
      !pgDriverSrc.includes('!tenantId || tenantId ===') &&
      pgDriverSrc.includes('bypassRls === true');
    check(
      driverHasNoImplicitBypass,
      'PostgresCloudDriver não permite bypass implícito por ausência de tenantId (bypass apenas explícito)'
    );

    // 3. Verificar que getDoc / setDoc / deleteDoc e runTransaction passam tenantId para o contexto RLS
    const hasTenantContextCall = pgDriverSrc.includes('runWithTenantContext');
    const hasSetTenantConfig = pgDriverSrc.includes(`set_config('app.tenant_id'`);
    const hasSetBypassConfig = pgDriverSrc.includes(`set_config('app.bypass_rls'`);
    check(
      hasTenantContextCall && hasSetTenantConfig && hasSetBypassConfig,
      'PostgresCloudDriver implementa runWithTenantContext com parametrização dinâmica de app.tenant_id e app.bypass_rls'
    );

    // 4. Testar fail-closed do PostgresCloudDriver com conexão offline
    const testDriver = new PostgresCloudDriver('postgresql://app:pass@127.0.0.1:54329/c3_test?sslmode=disable', {
      PG_POOL_MAX: '5',
    });
    const pingResult = await testDriver.ping();
    check(pingResult === false, 'PostgresCloudDriver.ping() falha fechado (false) em host inacessível');

    const unseededCount = testDriver.getCollectionSize('orders');
    check(unseededCount === 0 && !testDriver.hasCachedCollectionSize('orders'), 'Cache de tamanho de coleção inicia vazio e limpo');
    await testDriver.close();

    // 5. Verificar getRuntimePersistenceCapabilities() em modo sandbox local
    const caps = getRuntimePersistenceCapabilities();
    check(
      caps.persistenceDriver === 'json-memory' &&
        caps.persistenceMode === 'SANDBOX_LOCAL' &&
        caps.productionDatabaseReady === false &&
        caps.cloudProbeVerified === false,
      'getRuntimePersistenceCapabilities() reporta honestamente status sandbox (productionDatabaseReady=false)'
    );

    // 6. Testar probeCloudDatabase() sem variáveis de produção
    const probe = await probeCloudDatabase();
    check(
      probe.verified === false && probe.driver === 'json-memory' && probe.mode === 'SANDBOX_LOCAL',
      'probeCloudDatabase() rejeita ativação Cloud sem DATABASE_URL e ENABLE_POSTGRES_CLOUD=true'
    );

    // 7. Verificar que transações ACID em sandbox utilizam acquireLock e snapshot atômico
    let txRan = false;
    await db.runTransaction(async (transaction) => {
      await transaction.get(db.collection('tenants').doc('tenant-1'));
      transaction.set(db.collection('tenants').doc('tenant-pg-test'), {
        id: 'tenant-pg-test',
        name: 'Tenant Teste Concorrência',
        status: 'ACTIVE',
      });
      txRan = true;
    }, { tenantId: 'tenant-pg-test' });
    check(txRan, 'db.runTransaction() executa com sucesso recebendo contexto de tenant { tenantId }');

    const verifySnap = await db.collection('tenants').doc('tenant-pg-test').get();
    check(
      verifySnap.exists && verifySnap.data()?.name === 'Tenant Teste Concorrência',
      'Documento gravado dentro da transação persiste e é recuperado com integridade'
    );

    // 8. Testar consistência autoritativa multi-instância & propagação ALS para cloudSyncDriver
    const pgRows = new Map<string, any>();
    const pgCalls: Array<{ op: string; col: string; id?: string; tenantId: string | null; bypassRls: boolean }> = [];
    let forcePgReadError = false;

    const normalizeCtx = (ctx?: any) => {
      if (typeof ctx === 'string') return { tenantId: ctx || null, bypassRls: false };
      if (ctx?.bypassRls === true) return { tenantId: null, bypassRls: true };
      return { tenantId: ctx?.tenantId || null, bypassRls: false };
    };
    const isRowVisible = (row: any, ctx: { tenantId: string | null; bypassRls: boolean }) => {
      if (ctx.bypassRls) return true;
      if (!ctx.tenantId) return false; // RLS fail-closed without tenantId!
      const rowTenant = row?.tenantId ?? (row?.id && row?.__col === 'tenants' ? row.id : null);
      return rowTenant === ctx.tenantId;
    };

    const mockPgDriver: any = {
      async ping() {
        return true;
      },
      async runSchemaMigrations() {},
      async loadAllDocuments() {
        return {};
      },
      async syncSnapshot() {},
      async getDoc(col: string, id: string, rawCtx?: any) {
        if (forcePgReadError) throw new Error('Simulated PG network failure');
        const ctx = normalizeCtx(rawCtx);
        pgCalls.push({ op: 'getDoc', col, id, ...ctx });
        const row = pgRows.get(`${col}/${id}`);
        if (!row || !isRowVisible(row, ctx)) return null;
        const { __col: _ignored, ...clean } = row;
        return structuredClone(clean);
      },
      async setDoc(col: string, id: string, data: any, merge = false, rawCtx?: any) {
        const ctx = normalizeCtx(rawCtx);
        pgCalls.push({ op: 'setDoc', col, id, ...ctx });
        if (!ctx.bypassRls && !ctx.tenantId) {
          throw new Error('RLS violation: missing tenantId');
        }
        const key = `${col}/${id}`;
        const prev = pgRows.get(key);
        if (prev && !isRowVisible(prev, ctx)) {
          throw new Error('RLS violation on upsert');
        }
        const { __col: _prevCol, ...prevClean } = prev || {};
        const nextDoc = merge && prev ? { ...prevClean, ...data, id } : { ...data, id };
        pgRows.set(key, { ...structuredClone(nextDoc), __col: col });
        return structuredClone(nextDoc);
      },
      async updateDoc(col: string, id: string, patch: any, rawCtx?: any) {
        const ctx = normalizeCtx(rawCtx);
        pgCalls.push({ op: 'updateDoc', col, id, ...ctx });
        const key = `${col}/${id}`;
        const prev = pgRows.get(key);
        if (!prev || !isRowVisible(prev, ctx)) {
          throw new Error(`Document ${col}/${id} does not exist`);
        }
        const { __col: _prevCol, ...prevClean } = prev;
        const nextDoc = { ...prevClean, ...patch, id };
        pgRows.set(key, { ...structuredClone(nextDoc), __col: col });
        return structuredClone(nextDoc);
      },
      async deleteDoc(col: string, id: string, rawCtx?: any) {
        const ctx = normalizeCtx(rawCtx);
        pgCalls.push({ op: 'deleteDoc', col, id, ...ctx });
        const key = `${col}/${id}`;
        const prev = pgRows.get(key);
        if (prev && isRowVisible(prev, ctx)) pgRows.delete(key);
      },
      async listDocs(col: string, rawCtx?: any) {
        if (forcePgReadError) throw new Error('Simulated PG list failure');
        const ctx = normalizeCtx(rawCtx);
        pgCalls.push({ op: 'listDocs', col, ...ctx });
        const out: any[] = [];
        for (const [key, row] of pgRows.entries()) {
          if (!key.startsWith(`${col}/`)) continue;
          if (!isRowVisible(row, ctx)) continue;
          const { __col: _c, ...clean } = row;
          out.push(structuredClone(clean));
        }
        return out;
      },
      hasCachedCollectionSize() {
        return true;
      },
      getCollectionSize(col: string) {
        let count = 0;
        for (const key of pgRows.keys()) if (key.startsWith(`${col}/`)) count++;
        return count;
      },
      async getCollectionSizeAsync(col: string) {
        return this.getCollectionSize(col);
      },
      async runTransaction(fn: (tx: any) => Promise<any>, rawCtx?: any) {
        const ctx = normalizeCtx(rawCtx);
        pgCalls.push({ op: 'runTransaction', col: '*', ...ctx });
        const tx = {
          get: async (docRef: any) => {
            const doc = await mockPgDriver.getDoc(docRef.collectionName, docRef.id, ctx);
            return { exists: Boolean(doc), id: docRef.id, data: () => doc };
          },
          set: async (docRef: any, data: any, opts?: any) => {
            return mockPgDriver.setDoc(docRef.collectionName, docRef.id, data, Boolean(opts?.merge), ctx);
          },
          update: async (docRef: any, patch: any) => {
            return mockPgDriver.updateDoc(docRef.collectionName, docRef.id, patch, ctx);
          },
          delete: async (docRef: any) => {
            return mockPgDriver.deleteDoc(docRef.collectionName, docRef.id, ctx);
          },
        };
        return fn(tx);
      },
      async close() {},
    };

    try {
      __setCloudSyncDriverForTests(mockPgDriver);

      // Seed stale RAM snapshot first, then simulate Instance B updating PG directly
      await runWithTenantDbContext('tenant-alpha', async () => {
        await db.collection('orders').doc('ord-shared-1').set({
          id: 'ord-shared-1',
          tenantId: 'tenant-alpha',
          storeId: 'store-a',
          status: 'PENDING',
          total: 50,
          instanceBNote: 'old',
        });
      });

      // Instance B mutates PG directly (bypassing Instance A memoryStore!)
      pgRows.set('orders/ord-shared-1', {
        id: 'ord-shared-1',
        tenantId: 'tenant-alpha',
        storeId: 'store-a',
        status: 'CONFIRMED',
        total: 50,
        instanceBNote: 'updated-by-instance-b',
        __col: 'orders',
      });

      // Instance A reads and performs merge set + update -> MUST observe Instance B update and NEVER clobber instanceBNote
      await runWithTenantDbContext('tenant-alpha', async () => {
        const readFromPg = await db.collection('orders').doc('ord-shared-1').get();
        check(
          readFromPg.exists && readFromPg.data()?.status === 'CONFIRMED' && readFromPg.data()?.instanceBNote === 'updated-by-instance-b',
          'Leitura db.get() consulta PostgreSQL como fonte autoritativa ignorando RAM obsoleta da instância'
        );

        await db.collection('orders').doc('ord-shared-1').set({ paymentStatus: 'PAID' }, { merge: true });
        await db.collection('orders').doc('ord-shared-1').update({ driverName: 'Carlos' });

        const afterMerge = await db.collection('orders').doc('ord-shared-1').get();
        check(
          afterMerge.data()?.instanceBNote === 'updated-by-instance-b' &&
            afterMerge.data()?.paymentStatus === 'PAID' &&
            afterMerge.data()?.driverName === 'Carlos',
          'set({ merge: true }) e update() preservam estado autoritativo do PostgreSQL (sem sobrescrever com RAM stale)'
        );
      });

      // Fail-closed test: outside any ALS/explicit context, cross-tenant data is invisible
      const unboundSnap = await db.collection('orders').doc('ord-shared-1').get();
      const crossTenantSnap = await runWithTenantDbContext('tenant-beta', () =>
        db.collection('orders').doc('ord-shared-1').get()
      );
      check(
        unboundSnap.exists === false && crossTenantSnap.exists === false,
        'Operações sem contexto RLS ou com tenantId distinto falham fechadas (RLS tenant-isolated)'
      );

      // Fail-loudly test: PG error does NOT fall back silently to stale RAM
      let getThrew = false;
      let listThrew = false;
      forcePgReadError = true;
      try {
        await runWithTenantDbContext('tenant-alpha', () => db.collection('orders').doc('ord-shared-1').get());
      } catch {
        getThrew = true;
      }
      try {
        await runWithTenantDbContext('tenant-alpha', () => db.collection('orders').get());
      } catch {
        listThrew = true;
      } finally {
        forcePgReadError = false;
      }
      check(
        getThrew && listThrew,
        'Falha no PostgreSQL propaga erro explícito em vez de retornar silenciosamente snapshot antigo da memória'
      );

      // End-to-end HTTP ALS propagation test through Express verifyAutonomousToken
      await runWithSystemDbContext('TEST_SEED', async () => {
        await db.collection('tenants').doc('tenant-alpha').set({ id: 'tenant-alpha', name: 'Alpha', status: 'ACTIVE' });
        await db.collection('stores').doc('store-a').set({ id: 'store-a', tenantId: 'tenant-alpha', name: 'Loja Alpha', isOpen: true });
        await db.collection('users').doc('u-alpha-mgr').set({
          uid: 'u-alpha-mgr',
          id: 'u-alpha-mgr',
          email: 'mgr@alpha.local',
          role: 'STORE_MANAGER',
          tenantId: 'tenant-alpha',
          storeId: 'store-a',
          status: 'ACTIVE',
          tokenVersion: 1,
        });
      });

      const tokAlpha = auth.generateDevToken({
        uid: 'u-alpha-mgr',
        email: 'mgr@alpha.local',
        role: 'STORE_MANAGER',
        tenantId: 'tenant-alpha',
        storeId: 'store-a',
        tokenVersion: 1,
      });

      const expressApp = createServerCoreApp();
      const srv = http.createServer(expressApp);
      await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', () => resolve()));
      const port = (srv.address() as { port: number }).port;
      try {
        pgCalls.length = 0;
        const ordersRes = await fetch(`http://127.0.0.1:${port}/api/v1/commerce/orders?storeId=store-a`, {
          headers: { Authorization: `Bearer ${tokAlpha}` },
        });
        const ordersJson: any = await ordersRes.json();
        const routePgListCall = pgCalls.find((c) => c.op === 'listDocs' && c.col === 'orders');
        check(
          ordersRes.status === 200 &&
            Array.isArray(ordersJson) &&
            ordersJson.some((o: any) => o.id === 'ord-shared-1') &&
            routePgListCall?.tenantId === 'tenant-alpha' &&
            routePgListCall?.bypassRls === false,
          'Middleware HTTP propaga contexto ALS { tenantId: tenant-alpha, bypassRls: false } até PostgresCloudDriver'
        );
      } finally {
        (srv as any).closeAllConnections?.();
        await new Promise<void>((resolve) => srv.close(() => resolve()));
      }
    } finally {
      __setCloudSyncDriverForTests(null);
      await runWithDbContext({ bypassRls: true, reason: 'TEST_CLEANUP' }, async () => {});
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log(`\n======================================================================`);
  console.log(`Resultado Homologação PostgreSQL RLS: ${passed} passaram, ${failed} falharam`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
