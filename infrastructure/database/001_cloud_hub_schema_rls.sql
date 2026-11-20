-- =============================================================================
-- 3C Corp — 3C Cloud Hub PostgreSQL 18 Schema & Row-Level Security (RLS)
-- Architecture Baseline: Pool Multi-Tenant with Strict Tenant Isolation
-- =============================================================================
-- SECURITY NOTE ON DATABASE ROLE:
-- The application runtime role MUST NOT be a SUPERUSER and MUST NOT have BYPASSRLS.
-- Example provisioning for Cloud SQL / Managed PostgreSQL:
--   CREATE ROLE c3_app_user WITH LOGIN PASSWORD '<STRONG_PASSWORD>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
--   GRANT CONNECT ON DATABASE c3_cloud_hub TO c3_app_user;
--   GRANT USAGE ON SCHEMA public TO c3_app_user;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO c3_app_user;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO c3_app_user;
-- =============================================================================

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

CREATE TABLE IF NOT EXISTS store_documents (
  collection_name VARCHAR(128) NOT NULL,
  doc_id VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL DEFAULT 'tenant-1',
  store_id VARCHAR(128),
  hlc VARCHAR(128),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_name, doc_id)
);

ALTER TABLE store_documents ADD COLUMN IF NOT EXISTS hlc VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_store_docs_collection_tenant
  ON store_documents (collection_name, tenant_id);
CREATE INDEX IF NOT EXISTS idx_store_docs_collection_store
  ON store_documents (collection_name, store_id);
CREATE INDEX IF NOT EXISTS idx_store_docs_json_tenant
  ON store_documents (collection_name, (data->>'tenantId'));
CREATE INDEX IF NOT EXISTS idx_store_docs_json_store
  ON store_documents (collection_name, (data->>'storeId'));
CREATE INDEX IF NOT EXISTS idx_store_docs_tenant_col_status
  ON store_documents (collection_name, tenant_id, (data->>'status'));
CREATE INDEX IF NOT EXISTS idx_store_docs_store_col_status
  ON store_documents (collection_name, store_id, (data->>'status'))
  WHERE store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_docs_col_hlc
  ON store_documents (collection_name, hlc)
  WHERE hlc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_docs_data_gin
  ON store_documents USING GIN (data jsonb_path_ops);

-- PostgreSQL 18+ Virtual Generated Columns (zero disk overhead on PG 18+, safe no-op on PG < 18)
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 180000 THEN
    BEGIN
      ALTER TABLE store_documents
        ADD COLUMN IF NOT EXISTS status_v TEXT GENERATED ALWAYS AS (data->>'status') VIRTUAL;
      ALTER TABLE store_documents
        ADD COLUMN IF NOT EXISTS customer_email_v TEXT GENERATED ALWAYS AS (LOWER(data->>'customerEmail')) VIRTUAL;
      ALTER TABLE store_documents
        ADD COLUMN IF NOT EXISTS hlc_v TEXT GENERATED ALWAYS AS (data->>'hlc') VIRTUAL;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS sync_outbox_cloud (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  store_id VARCHAR(128),
  entity VARCHAR(64) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  operation VARCHAR(16) NOT NULL,
  hlc VARCHAR(128) NOT NULL,
  node_id VARCHAR(128) NOT NULL DEFAULT 'cloud_core',
  idempotency_key VARCHAR(255),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_tenant_hlc
  ON sync_outbox_cloud (tenant_id, hlc);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_outbox_idempotency
  ON sync_outbox_cloud (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

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

CREATE INDEX IF NOT EXISTS idx_stock_ledger_tenant_store
  ON stock_ledger (tenant_id, store_id, created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_edge_nodes_tenant_store
  ON edge_nodes (tenant_id, store_id);

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

CREATE INDEX IF NOT EXISTS idx_audit_trail_tenant_created
  ON audit_trail (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_tenant_event_created
  ON audit_trail (tenant_id, event_type, created_at DESC);

-- =============================================================================
-- ROW-LEVEL SECURITY (RLS) ENFORCEMENT
-- =============================================================================
ALTER TABLE store_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE sync_outbox_cloud ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_outbox_cloud FORCE ROW LEVEL SECURITY;
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ledger FORCE ROW LEVEL SECURITY;
ALTER TABLE edge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edge_nodes FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail FORCE ROW LEVEL SECURITY;

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
