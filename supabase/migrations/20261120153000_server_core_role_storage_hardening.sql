-- =============================================================================
-- 3C Corp — Supabase Cloud Primary Hardening
-- Migration: 20261120153000_server_core_role_storage_hardening.sql
--
-- Objetivos:
-- 1. Role dedicada `server_core_app` (NOBYPASSRLS) dona das tabelas Cloud Hub,
--    para que o RLS multi-tenant (FORCE ROW LEVEL SECURITY + app.tenant_id)
--    seja REALMENTE aplicado. No Supabase o role `postgres` possui BYPASSRLS,
--    o que anulava silenciosamente as políticas tenant_isolation_*.
-- 2. Server Core é a autoridade única: remove o acesso da Data API (PostgREST)
--    para `anon`/`authenticated` nas tabelas comerciais (store_documents guarda
--    hashes de senha, pedidos, financeiro).
-- 3. Remove políticas legadas baseadas em `auth.role()` (deprecado no Supabase).
-- 4. Bucket privado `3c-objects` para o driver de Storage híbrido do Server Core.
--
-- A senha/LOGIN da role NÃO fica neste arquivo. Habilite fora do repositório:
--   ALTER ROLE server_core_app WITH LOGIN PASSWORD '<senha-forte>';
-- e conecte via pooler: postgresql://server_core_app.<project_ref>:<senha>@<pooler-host>:6543/postgres
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'server_core_app') THEN
    CREATE ROLE server_core_app NOLOGIN NOINHERIT NOBYPASSRLS NOCREATEROLE NOCREATEDB;
  END IF;
END $$;

ALTER ROLE server_core_app NOBYPASSRLS;
ALTER ROLE server_core_app SET statement_timeout = '30s';
ALTER ROLE server_core_app SET idle_in_transaction_session_timeout = '60s';

-- Permite que o role administrativo atual gerencie (ALTER OWNER) a role da aplicação.
GRANT server_core_app TO CURRENT_USER;

GRANT USAGE, CREATE ON SCHEMA public TO server_core_app;

ALTER TABLE public.tenants OWNER TO server_core_app;
ALTER TABLE public.store_documents OWNER TO server_core_app;
ALTER TABLE public.sync_outbox_cloud OWNER TO server_core_app;
ALTER TABLE public.stock_ledger OWNER TO server_core_app;
ALTER TABLE public.edge_nodes OWNER TO server_core_app;
ALTER TABLE public.audit_trail OWNER TO server_core_app;

-- Data API lockdown: Server Core é a única porta de entrada para dados comerciais.
REVOKE ALL ON public.tenants, public.store_documents, public.sync_outbox_cloud,
  public.stock_ledger, public.edge_nodes, public.audit_trail
  FROM anon, authenticated;

-- Novas tabelas criadas pela role da aplicação também não ficam expostas por padrão.
ALTER DEFAULT PRIVILEGES FOR ROLE server_core_app IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

-- Remove políticas legadas que usavam auth.role() (deprecado).
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['tenants', 'store_documents', 'sync_outbox_cloud', 'stock_ledger', 'edge_nodes', 'audit_trail']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'supabase_jwt_isolation_' || tbl, tbl);
  END LOOP;
END $$;

-- Bucket privado para blobs do Server Core (acesso somente via secret key no servidor).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      '3c-objects',
      '3c-objects',
      false,
      10485760,
      ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/csv', 'text/plain', 'application/json', 'application/octet-stream']
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
