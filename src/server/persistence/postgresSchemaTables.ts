import type pkg from 'pg';

export async function createCloudHubTablesAndBaseIndexes(client: pkg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id VARCHAR(128) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
      subscription_plan VARCHAR(32) NOT NULL DEFAULT 'FREE',
      billing_cycle VARCHAR(32) NOT NULL DEFAULT 'MONTHLY',
      max_allowed_branches INTEGER NOT NULL DEFAULT 1,
      max_allowed_devices INTEGER NOT NULL DEFAULT 2,
      saas_payment_status VARCHAR(32) NOT NULL DEFAULT 'TRIAL',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS store_documents (
      collection_name VARCHAR(128) NOT NULL,
      doc_id VARCHAR(255) NOT NULL,
      tenant_id VARCHAR(128) NOT NULL DEFAULT 'tenant-1',
      store_id VARCHAR(128),
      hlc VARCHAR(128),
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (collection_name, doc_id)
    );
  `);
  await client.query(`ALTER TABLE store_documents ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(128) NOT NULL DEFAULT 'tenant-1';`);
  await client.query(`ALTER TABLE store_documents ADD COLUMN IF NOT EXISTS store_id VARCHAR(128);`);
  await client.query(`ALTER TABLE store_documents ADD COLUMN IF NOT EXISTS hlc VARCHAR(128);`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS sync_outbox_cloud (
      id VARCHAR(128) PRIMARY KEY,
      tenant_id VARCHAR(128) NOT NULL,
      store_id VARCHAR(128),
      entity VARCHAR(64),
      entity_id VARCHAR(255),
      operation VARCHAR(16),
      hlc VARCHAR(128),
      node_id VARCHAR(128) DEFAULT 'cloud_core',
      idempotency_key VARCHAR(255),
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS stock_ledger (
      id VARCHAR(128) PRIMARY KEY,
      tenant_id VARCHAR(128) NOT NULL,
      store_id VARCHAR(128) NOT NULL,
      target_id VARCHAR(128) NOT NULL,
      delta_qty NUMERIC(14, 4) NOT NULL,
      balance_after NUMERIC(14, 4) NOT NULL,
      reason VARCHAR(64) NOT NULL,
      order_id VARCHAR(128),
      hlc VARCHAR(128) NOT NULL,
      node_id VARCHAR(128) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS edge_nodes (
      id VARCHAR(128) PRIMARY KEY,
      tenant_id VARCHAR(128) NOT NULL,
      store_id VARCHAR(128) NOT NULL,
      hostname VARCHAR(255),
      lan_ip VARCHAR(64),
      port INTEGER NOT NULL DEFAULT 3300,
      platform VARCHAR(32),
      app_version VARCHAR(32),
      last_hlc VARCHAR(128),
      status VARCHAR(32) NOT NULL DEFAULT 'ONLINE',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS audit_trail (
      id VARCHAR(128) PRIMARY KEY,
      source_collection VARCHAR(32) NOT NULL DEFAULT 'events',
      tenant_id VARCHAR(128) NOT NULL DEFAULT 'tenant-1',
      event_type VARCHAR(128) NOT NULL,
      channel VARCHAR(64) NOT NULL,
      actor_uid VARCHAR(128),
      actor_email VARCHAR(255),
      actor_role VARCHAR(64),
      source_ip VARCHAR(64),
      request_id VARCHAR(128),
      resource_type VARCHAR(64),
      resource_id VARCHAR(255),
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`CREATE INDEX IF NOT EXISTS idx_store_docs_collection_tenant ON store_documents (collection_name, tenant_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_store_docs_collection_store ON store_documents (collection_name, store_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_store_docs_json_tenant ON store_documents (collection_name, (data->>'tenantId'));`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_store_docs_json_store ON store_documents (collection_name, (data->>'storeId'));`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_store_docs_tenant_col_status ON store_documents (collection_name, tenant_id, (data->>'status'));`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_store_docs_store_col_status ON store_documents (collection_name, store_id, (data->>'status')) WHERE store_id IS NOT NULL;`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_store_docs_col_hlc ON store_documents (collection_name, hlc) WHERE hlc IS NOT NULL;`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_store_docs_data_gin ON store_documents USING GIN (data jsonb_path_ops);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_sync_outbox_tenant_date ON sync_outbox_cloud (tenant_id, created_at);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_trail_tenant_created ON audit_trail (tenant_id, created_at DESC);`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_trail_tenant_event_created ON audit_trail (tenant_id, event_type, created_at DESC);`);
}
