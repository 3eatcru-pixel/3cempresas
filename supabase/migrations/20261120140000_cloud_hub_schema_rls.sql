-- =============================================================================
-- 3C Corp — Supabase / Cloud Hub Schema & Multi-Tenant Row-Level Security (RLS)
-- Migration: 20261120140000_cloud_hub_schema_rls.sql
-- Project Ref: ltubkbgdovshicenfuzr
-- Compatible with both Supabase CLI (`supabase db push`) & PostgresCloudDriver
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tenants (
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

CREATE TABLE IF NOT EXISTS public.store_documents (
  collection_name VARCHAR(128) NOT NULL,
  doc_id VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL DEFAULT 'tenant-1',
  store_id VARCHAR(128),
  hlc VARCHAR(128),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (collection_name, doc_id)
);

ALTER TABLE public.store_documents ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(128) NOT NULL DEFAULT 'tenant-1';
ALTER TABLE public.store_documents ADD COLUMN IF NOT EXISTS store_id VARCHAR(128);
ALTER TABLE public.store_documents ADD COLUMN IF NOT EXISTS hlc VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_store_docs_collection_tenant
  ON public.store_documents (collection_name, tenant_id);
CREATE INDEX IF NOT EXISTS idx_store_docs_collection_store
  ON public.store_documents (collection_name, store_id);
CREATE INDEX IF NOT EXISTS idx_store_docs_json_tenant
  ON public.store_documents (collection_name, (data->>'tenantId'));
CREATE INDEX IF NOT EXISTS idx_store_docs_json_store
  ON public.store_documents (collection_name, (data->>'storeId'));
CREATE INDEX IF NOT EXISTS idx_store_docs_tenant_col_status
  ON public.store_documents (collection_name, tenant_id, (data->>'status'));
CREATE INDEX IF NOT EXISTS idx_store_docs_store_col_status
  ON public.store_documents (collection_name, store_id, (data->>'status'))
  WHERE store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_docs_col_hlc
  ON public.store_documents (collection_name, hlc)
  WHERE hlc IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_docs_data_gin
  ON public.store_documents USING GIN (data jsonb_path_ops);

-- PostgreSQL 18+ Virtual Generated Columns (safe no-op on PG 15–17)
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 180000 THEN
    BEGIN
      ALTER TABLE public.store_documents
        ADD COLUMN IF NOT EXISTS status_v TEXT GENERATED ALWAYS AS (data->>'status') VIRTUAL;
      ALTER TABLE public.store_documents
        ADD COLUMN IF NOT EXISTS customer_email_v TEXT GENERATED ALWAYS AS (LOWER(data->>'customerEmail')) VIRTUAL;
      ALTER TABLE public.store_documents
        ADD COLUMN IF NOT EXISTS hlc_v TEXT GENERATED ALWAYS AS (data->>'hlc') VIRTUAL;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.sync_outbox_cloud (
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

CREATE INDEX IF NOT EXISTS idx_sync_outbox_tenant_date
  ON public.sync_outbox_cloud (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sync_outbox_tenant_hlc
  ON public.sync_outbox_cloud (tenant_id, hlc);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_outbox_idempotency
  ON public.sync_outbox_cloud (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.stock_ledger (
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
  ON public.stock_ledger (tenant_id, store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.edge_nodes (
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
  ON public.edge_nodes (tenant_id, store_id);

CREATE TABLE IF NOT EXISTS public.audit_trail (
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
  ON public.audit_trail (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_tenant_event_created
  ON public.audit_trail (tenant_id, event_type, created_at DESC);

-- =============================================================================
-- MULTI-TENANT ROW-LEVEL SECURITY (RLS)
-- =============================================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE public.store_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sync_outbox_cloud ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_outbox_cloud FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_ledger FORCE ROW LEVEL SECURITY;
ALTER TABLE public.edge_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_nodes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
  pol_name TEXT;
  supabase_pol_name TEXT;
  has_supabase_auth BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') INTO has_supabase_auth;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenants' AND policyname = 'tenant_isolation_tenants'
  ) THEN
    CREATE POLICY tenant_isolation_tenants ON public.tenants
      USING (current_setting('app.bypass_rls', true) = 'true' OR id = NULLIF(current_setting('app.tenant_id', true), ''))
      WITH CHECK (current_setting('app.bypass_rls', true) = 'true' OR id = NULLIF(current_setting('app.tenant_id', true), ''));
  END IF;

  IF has_supabase_auth AND NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenants' AND policyname = 'supabase_jwt_isolation_tenants'
  ) THEN
    CREATE POLICY supabase_jwt_isolation_tenants ON public.tenants
      TO authenticated, service_role
      USING (auth.role() = 'service_role' OR id = NULLIF(COALESCE(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id'), ''))
      WITH CHECK (auth.role() = 'service_role' OR id = NULLIF(COALESCE(auth.jwt() ->> 'tenant_id', auth.jwt() -> 'app_metadata' ->> 'tenant_id'), ''));
  END IF;

  FOREACH tbl IN ARRAY ARRAY['store_documents', 'sync_outbox_cloud', 'stock_ledger', 'edge_nodes', 'audit_trail']
  LOOP
    pol_name := 'tenant_isolation_' || tbl;
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl AND policyname = pol_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I USING (current_setting(''app.bypass_rls'', true) = ''true'' OR tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')) WITH CHECK (current_setting(''app.bypass_rls'', true) = ''true'' OR tenant_id = NULLIF(current_setting(''app.tenant_id'', true), ''''))',
        pol_name,
        tbl
      );
    END IF;

    IF has_supabase_auth THEN
      supabase_pol_name := 'supabase_jwt_isolation_' || tbl;
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl AND policyname = supabase_pol_name
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I TO authenticated, service_role USING (auth.role() = ''service_role'' OR tenant_id = NULLIF(COALESCE(auth.jwt() ->> ''tenant_id'', auth.jwt() -> ''app_metadata'' ->> ''tenant_id''), '''')) WITH CHECK (auth.role() = ''service_role'' OR tenant_id = NULLIF(COALESCE(auth.jwt() ->> ''tenant_id'', auth.jwt() -> ''app_metadata'' ->> ''tenant_id''), ''''))',
          supabase_pol_name,
          tbl
        );
      END IF;
    END IF;
  END LOOP;
END $$;
