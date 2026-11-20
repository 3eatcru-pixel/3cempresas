-- =============================================================================
-- 3C Corp — RLS InitPlan & Permissive Policy Consolidation
-- Migration: 20261120170000_optimize_rls_initplan_policies.sql
--
-- Corrige 12 alertas `auth_rls_initplan` (envolve current_setting/auth.jwt em
-- subselect escalar avaliado 1x por query) e 24 alertas `multiple_permissive_policies`
-- (separa explicitamente `TO server_core_app, postgres` vs `TO authenticated` e
-- remove o uso deprecado de `auth.role()`).
-- =============================================================================

ALTER POLICY tenant_isolation_tenants ON public.tenants
  TO server_core_app, postgres
  USING ((SELECT current_setting('app.bypass_rls', true)) = 'true' OR id = NULLIF((SELECT current_setting('app.tenant_id', true)), ''))
  WITH CHECK ((SELECT current_setting('app.bypass_rls', true)) = 'true' OR id = NULLIF((SELECT current_setting('app.tenant_id', true)), ''));

ALTER POLICY supabase_jwt_isolation_tenants ON public.tenants
  TO authenticated
  USING (id = NULLIF(COALESCE((SELECT auth.jwt()) ->> 'tenant_id', (SELECT auth.jwt()) -> 'app_metadata' ->> 'tenant_id'), ''))
  WITH CHECK (id = NULLIF(COALESCE((SELECT auth.jwt()) ->> 'tenant_id', (SELECT auth.jwt()) -> 'app_metadata' ->> 'tenant_id'), ''));

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['store_documents', 'sync_outbox_cloud', 'stock_ledger', 'edge_nodes', 'audit_trail']
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON public.%I TO server_core_app, postgres USING ((SELECT current_setting(''app.bypass_rls'', true)) = ''true'' OR tenant_id = NULLIF((SELECT current_setting(''app.tenant_id'', true)), '''')) WITH CHECK ((SELECT current_setting(''app.bypass_rls'', true)) = ''true'' OR tenant_id = NULLIF((SELECT current_setting(''app.tenant_id'', true)), ''''))',
      'tenant_isolation_' || tbl, tbl
    );
    EXECUTE format(
      'ALTER POLICY %I ON public.%I TO authenticated USING (tenant_id = NULLIF(COALESCE((SELECT auth.jwt()) ->> ''tenant_id'', (SELECT auth.jwt()) -> ''app_metadata'' ->> ''tenant_id''), '''')) WITH CHECK (tenant_id = NULLIF(COALESCE((SELECT auth.jwt()) ->> ''tenant_id'', (SELECT auth.jwt()) -> ''app_metadata'' ->> ''tenant_id''), ''''))',
      'supabase_jwt_isolation_' || tbl, tbl
    );
  END LOOP;
END $$;
