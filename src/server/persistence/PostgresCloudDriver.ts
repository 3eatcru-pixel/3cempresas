import pkg from 'pg';
const { Pool } = pkg;
import { PersistenceDriver, PersistenceDriverCapabilities, PERSISTENCE_DRIVERS_REGISTRY } from './PersistenceDriver.ts';
import {
  PostgresConnectionTarget,
  PgRlsContext,
  normalizePgContext,
  resolvePostgresConnectionTargetWithSsl,
} from './postgresConnectionConfig.ts';
import { createCloudHubTablesAndBaseIndexes } from './postgresSchemaTables.ts';
import { buildStoreDocumentsQuerySql, StoreDocumentQueryFilter } from './postgresQueryHelpers.ts';

export type { PostgresConnectionTarget, PgRlsContext };

function resolvePgSslOption(
  hostOrUrl: string,
  env: Record<string, string | undefined> = process.env
): boolean | { rejectUnauthorized: boolean } {
  const lower = hostOrUrl.toLowerCase();
  if (
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('sslmode=disable') ||
    lower.includes('/cloudsql/')
  ) {
    return false;
  }
  const rejectUnauthorized = env.PG_SSL_REJECT_UNAUTHORIZED !== 'false';
  return { rejectUnauthorized };
}

export function resolvePostgresConnectionTarget(
  env: Record<string, string | undefined> = process.env
): PostgresConnectionTarget {
  return resolvePostgresConnectionTargetWithSsl(resolvePgSslOption, env);
}

export class PostgresCloudDriver implements PersistenceDriver {
  public readonly capabilities: PersistenceDriverCapabilities = PERSISTENCE_DRIVERS_REGISTRY['postgres-cloud'];
  private pool: pkg.Pool;
  private initialized = false;
  private pgVersionNum = 0;
  private virtualGeneratedColumnsActive = false;
  private collectionCountCache = new Map<string, number>();

  constructor(
    connectionTarget: string | NonNullable<PostgresConnectionTarget['poolConfig']>,
    env: Record<string, string | undefined> = process.env
  ) {
    const poolBase =
      typeof connectionTarget === 'string'
        ? {
            connectionString: connectionTarget,
            ssl: resolvePgSslOption(connectionTarget, env),
          }
        : {
            host: connectionTarget.host,
            port: connectionTarget.port,
            user: connectionTarget.user,
            password: connectionTarget.password,
            database: connectionTarget.database,
            ssl: connectionTarget.ssl,
          };

    this.pool = new Pool({
      ...poolBase,
      max: Number(env.PG_POOL_MAX) || 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  public async runSchemaMigrations(): Promise<void> {
    if (this.initialized) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.bypass_rls', 'true', true)`);

      await createCloudHubTablesAndBaseIndexes(client);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sync_outbox_tenant_hlc
        ON sync_outbox_cloud (tenant_id, hlc);
      `);
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_outbox_idempotency
        ON sync_outbox_cloud (tenant_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_stock_ledger_tenant_store
        ON stock_ledger (tenant_id, store_id, created_at DESC);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_edge_nodes_tenant_store
        ON edge_nodes (tenant_id, store_id);
      `);

      // PostgreSQL 18+ Virtual Generated Columns over JSONB (zero storage overhead)
      const verRes = await client.query(`SHOW server_version_num`);
      this.pgVersionNum = Number(verRes.rows?.[0]?.server_version_num) || 0;
      if (this.pgVersionNum >= 180000) {
        try {
          await client.query(`
            ALTER TABLE store_documents
              ADD COLUMN IF NOT EXISTS status_v TEXT GENERATED ALWAYS AS (data->>'status') VIRTUAL,
              ADD COLUMN IF NOT EXISTS customer_email_v TEXT GENERATED ALWAYS AS (LOWER(data->>'customerEmail')) VIRTUAL,
              ADD COLUMN IF NOT EXISTS hlc_v TEXT GENERATED ALWAYS AS (data->>'hlc') VIRTUAL;
          `);
          this.virtualGeneratedColumnsActive = true;
        } catch {
          this.virtualGeneratedColumnsActive = false;
        }
      }

      // Multi-tenant Row-Level Security (RLS) enforcement (ENABLE + FORCE so even table owners respect policies unless app.bypass_rls='true')
      await client.query(`ALTER TABLE store_documents ENABLE ROW LEVEL SECURITY;`);
      await client.query(`ALTER TABLE store_documents FORCE ROW LEVEL SECURITY;`);
      await client.query(`ALTER TABLE sync_outbox_cloud ENABLE ROW LEVEL SECURITY;`);
      await client.query(`ALTER TABLE sync_outbox_cloud FORCE ROW LEVEL SECURITY;`);
      await client.query(`ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;`);
      await client.query(`ALTER TABLE stock_ledger FORCE ROW LEVEL SECURITY;`);
      await client.query(`ALTER TABLE edge_nodes ENABLE ROW LEVEL SECURITY;`);
      await client.query(`ALTER TABLE edge_nodes FORCE ROW LEVEL SECURITY;`);
      await client.query(`ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;`);
      await client.query(`ALTER TABLE audit_trail FORCE ROW LEVEL SECURITY;`);

      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'store_documents' AND policyname = 'tenant_isolation_store_documents'
          ) THEN
            CREATE POLICY tenant_isolation_store_documents ON store_documents
              USING (
                current_setting('app.bypass_rls', true) = 'true'
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
              )
              WITH CHECK (
                current_setting('app.bypass_rls', true) = 'true'
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
              );
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sync_outbox_cloud' AND policyname = 'tenant_isolation_sync_outbox_cloud'
          ) THEN
            CREATE POLICY tenant_isolation_sync_outbox_cloud ON sync_outbox_cloud
              USING (
                current_setting('app.bypass_rls', true) = 'true'
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
              )
              WITH CHECK (
                current_setting('app.bypass_rls', true) = 'true'
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
              );
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'stock_ledger' AND policyname = 'tenant_isolation_stock_ledger'
          ) THEN
            CREATE POLICY tenant_isolation_stock_ledger ON stock_ledger
              USING (
                current_setting('app.bypass_rls', true) = 'true'
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
              )
              WITH CHECK (
                current_setting('app.bypass_rls', true) = 'true'
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
              );
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'edge_nodes' AND policyname = 'tenant_isolation_edge_nodes'
          ) THEN
            CREATE POLICY tenant_isolation_edge_nodes ON edge_nodes
              USING (
                current_setting('app.bypass_rls', true) = 'true'
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
              )
              WITH CHECK (
                current_setting('app.bypass_rls', true) = 'true'
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
              );
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_trail' AND policyname = 'tenant_isolation_audit_trail'
          ) THEN
            CREATE POLICY tenant_isolation_audit_trail ON audit_trail
              USING (
                current_setting('app.bypass_rls', true) = 'true'
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
              )
              WITH CHECK (
                current_setting('app.bypass_rls', true) = 'true'
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')
              );
          END IF;
        END $$;
      `);

      await client.query('COMMIT');
      this.initialized = true;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[PostgresCloudDriver] Failed to initialize tables, indexes & RLS policies:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  private async ensureTable(): Promise<void> {
    await this.runSchemaMigrations();
  }

  /**
   * Executes work inside a PostgreSQL transaction with transaction-local RLS context (`SET LOCAL`).
   * Fail-closed: `bypassRls` is ONLY enabled when explicitly requested (`options?.bypassRls === true`).
   */
  public async runWithTenantContext<T>(
    tenantId: string | null,
    fn: (client: pkg.PoolClient) => Promise<T>,
    options?: { bypassRls?: boolean; readOnly?: boolean }
  ): Promise<T> {
    await this.ensureTable();
    const client = await this.pool.connect();
    const shouldBypass = options?.bypassRls === true;
    try {
      await client.query(options?.readOnly ? 'BEGIN READ ONLY' : 'BEGIN');
      await client.query(
        `SELECT set_config('app.tenant_id', $1, true), set_config('app.bypass_rls', $2, true)`,
        [tenantId || '', shouldBypass ? 'true' : 'false']
      );
      const res = await fn(client);
      await client.query('COMMIT');
      return res;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async getDoc<T = any>(collection: string, id: string, ctxOrTenantId?: string | PgRlsContext): Promise<T | null> {
    const ctx = normalizePgContext(ctxOrTenantId);
    return this.runWithTenantContext(
      ctx.tenantId,
      async (client) => {
        const res = await client.query(
          'SELECT data FROM store_documents WHERE collection_name = $1 AND doc_id = $2',
          [collection, id]
        );
        return res.rows.length === 0 ? null : (res.rows[0].data as T);
      },
      { bypassRls: ctx.bypassRls, readOnly: true }
    );
  }

  async setDoc<T = any>(
    collection: string,
    id: string,
    data: T,
    merge = true,
    ctxOrTenantId?: string | PgRlsContext
  ): Promise<T & { id: string }> {
    await this.ensureTable();
    const ctx = normalizePgContext(ctxOrTenantId);
    if (merge) {
      return await this.runTransaction(
        async (tx) => {
          const existing = await tx.get(collection, id);
          const merged = existing ? { ...existing, ...(data as any), id } : { ...(data as any), id };
          await tx.set(collection, id, merged);
          return merged as T & { id: string };
        },
        { tenantId: ctx.tenantId, bypassRls: ctx.bypassRls }
      );
    }

    const payload = { ...(data as any), id };
    const rowTenantId = String(
      payload?.tenantId || ctx.tenantId || (collection === 'tenants' ? id : undefined) || 'tenant-1'
    );
    const sessionTenantId = ctx.bypassRls ? null : (ctx.tenantId || '');
    const storeId = payload?.storeId ? String(payload.storeId) : null;
    const hlc = payload?.hlc ? String(payload.hlc) : null;
    await this.runWithTenantContext(
      sessionTenantId,
      async (client) => {
        await client.query(
          `INSERT INTO store_documents (collection_name, doc_id, tenant_id, store_id, hlc, data, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, doc_id)
           DO UPDATE SET tenant_id = $3, store_id = $4, hlc = COALESCE($5, store_documents.hlc), data = $6, updated_at = CURRENT_TIMESTAMP`,
          [collection, id, rowTenantId, storeId, hlc, JSON.stringify(payload)]
        );
      },
      { bypassRls: ctx.bypassRls }
    );
    this.collectionCountCache.delete(collection);
    return payload as T & { id: string };
  }

  /**
   * Atomic SQL-native Last-Write-Wins (LWW) upsert based on HLC lexicographical ordering.
   * Mirrors SqliteWalDriver.upsertIfNewerHlcSync() for symmetric Edge <-> Cloud Hub delta writes.
   */
  async upsertIfNewerHlc<T = any>(
    collection: string,
    id: string,
    data: T,
    ctxOrTenantId?: string | PgRlsContext
  ): Promise<boolean> {
    await this.ensureTable();
    const ctx = normalizePgContext(ctxOrTenantId);
    const payload = { ...(data as any), id };
    const rowTenantId = String(
      payload?.tenantId || ctx.tenantId || (collection === 'tenants' ? id : undefined) || 'tenant-1'
    );
    const sessionTenantId = ctx.bypassRls ? null : (ctx.tenantId || '');
    const storeId = payload?.storeId ? String(payload.storeId) : null;
    const hlc = payload?.hlc ? String(payload.hlc) : null;

    return this.runWithTenantContext(
      sessionTenantId,
      async (client) => {
        const res = await client.query(
          `INSERT INTO store_documents (collection_name, doc_id, tenant_id, store_id, hlc, data, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, doc_id)
           DO UPDATE SET
             tenant_id = EXCLUDED.tenant_id,
             store_id = EXCLUDED.store_id,
             hlc = EXCLUDED.hlc,
             data = EXCLUDED.data,
             updated_at = CURRENT_TIMESTAMP
           WHERE store_documents.hlc IS NULL
              OR EXCLUDED.hlc IS NULL
              OR EXCLUDED.hlc >= store_documents.hlc`,
          [collection, id, rowTenantId, storeId, hlc, JSON.stringify(payload)]
        );
        return (res.rowCount || 0) > 0;
      },
      { bypassRls: ctx.bypassRls }
    );
  }

  async updateDoc(
    collection: string,
    id: string,
    patch: Record<string, any>,
    ctxOrTenantId?: string | PgRlsContext
  ): Promise<any> {
    await this.ensureTable();
    const ctx = normalizePgContext(ctxOrTenantId);
    return await this.runTransaction(
      async (tx) => {
        const existing = await tx.get(collection, id);
        if (!existing) {
          throw new Error(`Document ${collection}/${id} does not exist`);
        }
        const updated = { ...existing, ...patch, id };
        await tx.set(collection, id, updated);
        return updated;
      },
      { tenantId: ctx.tenantId, bypassRls: ctx.bypassRls }
    );
  }

  async deleteDoc(collection: string, id: string, ctxOrTenantId?: string | PgRlsContext): Promise<void> {
    const ctx = normalizePgContext(ctxOrTenantId);
    await this.runWithTenantContext(
      ctx.tenantId,
      async (client) => {
        const res = await client.query(
          'DELETE FROM store_documents WHERE collection_name = $1 AND doc_id = $2',
          [collection, id]
        );
        if ((res.rowCount || 0) > 0 && this.collectionCountCache.has(collection)) {
          const prev = this.collectionCountCache.get(collection) || 0;
          this.collectionCountCache.set(collection, Math.max(0, prev - (res.rowCount || 0)));
        }
      },
      { bypassRls: ctx.bypassRls }
    );
  }

  async listDocs<T = any>(collection: string, ctxOrTenantId?: string | PgRlsContext): Promise<T[]> {
    const ctx = normalizePgContext(ctxOrTenantId);
    return this.runWithTenantContext(
      ctx.tenantId,
      async (client) => {
        const res = await client.query(
          'SELECT data FROM store_documents WHERE collection_name = $1',
          [collection]
        );
        if (ctx.bypassRls) {
          this.collectionCountCache.set(collection, res.rows.length);
        }
        return res.rows.map(r => r.data as T);
      },
      { bypassRls: ctx.bypassRls, readOnly: true }
    );
  }

  async queryDocs<T = any>(
    collection: string,
    filter: StoreDocumentQueryFilter,
    ctxOrTenantId?: string | PgRlsContext
  ): Promise<T[]> {
    const ctx = normalizePgContext(ctxOrTenantId);
    return this.runWithTenantContext(
      ctx.tenantId,
      async (client) => {
        const { sql, params } = buildStoreDocumentsQuerySql(collection, filter);
        const res = await client.query(sql, params);
        return res.rows.map((r) => r.data as T);
      },
      { bypassRls: ctx.bypassRls, readOnly: true }
    );
  }

  async loadAllDocuments(options?: { reason?: 'SYSTEM_BOOTSTRAP' | 'HQ_BACKUP' }): Promise<Record<string, any[]>> {
    if (!options?.reason) {
      throw new Error('[RLS Guard] loadAllDocuments() exige escopo explícito SYSTEM_BOOTSTRAP ou HQ_BACKUP.');
    }
    return this.runWithTenantContext(
      null,
      async (client) => {
        const res = await client.query('SELECT collection_name, data FROM store_documents');
        const grouped: Record<string, any[]> = {};
        for (const row of res.rows) {
          const col = String(row.collection_name);
          if (!grouped[col]) grouped[col] = [];
          grouped[col].push(row.data);
        }
        for (const [col, items] of Object.entries(grouped)) {
          this.collectionCountCache.set(col, items.length);
        }
        return grouped;
      },
      { bypassRls: true }
    );
  }

  async syncSnapshot(
    tables: Record<string, any[]>,
    options?: { replaceAll?: boolean; reason?: 'SYSTEM_BOOTSTRAP' | 'HQ_RESTORE' }
  ): Promise<void> {
    if (!options?.reason) {
      throw new Error('[RLS Guard] syncSnapshot() exige escopo explícito SYSTEM_BOOTSTRAP ou HQ_RESTORE.');
    }
    await this.runWithTenantContext(
      null,
      async (client) => {
        if (options?.replaceAll) {
          await client.query('DELETE FROM store_documents');
        }
        const BATCH_SIZE = 200;
        for (const [collection, items] of Object.entries(tables)) {
          if (!Array.isArray(items)) continue;
          const validItems = items.filter((item) => item && typeof item.id === 'string' && item.id.trim());
          for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
            const chunk = validItems.slice(i, i + BATCH_SIZE);
            const docIds: string[] = [];
            const tenantIds: string[] = [];
            const storeIds: Array<string | null> = [];
            const hlcs: Array<string | null> = [];
            const payloads: string[] = [];
            for (const item of chunk) {
              docIds.push(item.id);
              tenantIds.push(
                String(item.tenantId || (collection === 'tenants' ? item.id : undefined) || 'tenant-1')
              );
              storeIds.push(item.storeId ? String(item.storeId) : null);
              hlcs.push(item.hlc ? String(item.hlc) : null);
              payloads.push(JSON.stringify(item));
            }
            await client.query(
              `INSERT INTO store_documents (collection_name, doc_id, tenant_id, store_id, hlc, data, updated_at)
               SELECT $1, u.doc_id, u.tenant_id, u.store_id, u.hlc, u.data::jsonb, CURRENT_TIMESTAMP
               FROM UNNEST($2::text[], $3::text[], $4::text[], $5::text[], $6::text[])
                 AS u(doc_id, tenant_id, store_id, hlc, data)
               ON CONFLICT (collection_name, doc_id)
               DO UPDATE SET
                 tenant_id = EXCLUDED.tenant_id,
                 store_id = EXCLUDED.store_id,
                 hlc = COALESCE(EXCLUDED.hlc, store_documents.hlc),
                 data = EXCLUDED.data,
                 updated_at = CURRENT_TIMESTAMP`,
              [collection, docIds, tenantIds, storeIds, hlcs, payloads]
            );
          }
          this.collectionCountCache.set(collection, validItems.length);
        }
      },
      { bypassRls: true }
    );
  }

  async getCollectionSizeAsync(collection: string): Promise<number> {
    const count = await this.runWithTenantContext(
      null,
      async (client) => {
        const res = await client.query(
          'SELECT COUNT(*)::int AS cnt FROM store_documents WHERE collection_name = $1',
          [collection]
        );
        return Number(res.rows[0]?.cnt) || 0;
      },
      { bypassRls: true, readOnly: true }
    );
    this.collectionCountCache.set(collection, count);
    return count;
  }

  hasCachedCollectionSize(collection: string): boolean {
    return this.collectionCountCache.has(collection);
  }

  getCollectionSize(collection: string): number {
    if (!this.collectionCountCache.has(collection)) {
      return 0;
    }
    return this.collectionCountCache.get(collection) || 0;
  }

  async runTransaction<T>(
    fn: (tx: any) => Promise<T>,
    context?: PgRlsContext
  ): Promise<T> {
    await this.ensureTable();
    const client = await this.pool.connect();
    const touchedCollections = new Set<string>();
    const shouldBypass = context?.bypassRls === true;
    const activeTenantId = shouldBypass ? '' : (context?.tenantId ? String(context.tenantId) : '');
    try {
      await client.query('BEGIN');
      await client.query(
        `SELECT set_config('app.tenant_id', $1, true), set_config('app.bypass_rls', $2, true)`,
        [activeTenantId, shouldBypass ? 'true' : 'false']
      );
      const tx = {
        get: async (col: string, id: string) => {
          const res = await client.query(
            'SELECT data FROM store_documents WHERE collection_name = $1 AND doc_id = $2 FOR UPDATE',
            [col, id]
          );
          return res.rows.length > 0 ? res.rows[0].data : null;
        },
        set: async (col: string, id: string, data: any) => {
          touchedCollections.add(col);
          const payload = { ...data, id };
          const tenantId = String(
            payload?.tenantId || (col === 'tenants' ? id : undefined) || context?.tenantId || 'tenant-1'
          );
          const storeId = payload?.storeId ? String(payload.storeId) : null;
          const hlc = payload?.hlc ? String(payload.hlc) : null;
          await client.query(
            `INSERT INTO store_documents (collection_name, doc_id, tenant_id, store_id, hlc, data, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
             ON CONFLICT (collection_name, doc_id)
             DO UPDATE SET tenant_id = $3, store_id = $4, hlc = COALESCE($5, store_documents.hlc), data = $6, updated_at = CURRENT_TIMESTAMP`,
            [col, id, tenantId, storeId, hlc, JSON.stringify(payload)]
          );
        },
        delete: async (col: string, id: string) => {
          touchedCollections.add(col);
          await client.query('DELETE FROM store_documents WHERE collection_name = $1 AND doc_id = $2', [col, id]);
        }
      };
      const result = await fn(tx);
      await client.query('COMMIT');
      for (const col of touchedCollections) {
        this.collectionCountCache.delete(col);
      }
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  getSchemaOptimizationInfo(): {
    initialized: boolean;
    pgVersionNum: number;
    virtualGeneratedColumnsActive: boolean;
  } {
    return {
      initialized: this.initialized,
      pgVersionNum: this.pgVersionNum,
      virtualGeneratedColumnsActive: this.virtualGeneratedColumnsActive,
    };
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end().catch(() => {});
  }
}
