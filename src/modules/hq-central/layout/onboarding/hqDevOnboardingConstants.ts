import React from 'react';
import { HqTabId } from '../HqSidebar';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  envHints: string[];
  completed: boolean;
  warningOnly?: boolean;
  statusLabel: string;
  actionLabel?: string;
  targetTab?: HqTabId;
  icon: React.ComponentType<{ className?: string }>;
}

export interface EnvReadinessVariable {
  key: string;
  scope: string;
  configured: boolean;
  requiredInProduction: boolean;
  note: string;
}

export interface EnvReadinessPayload {
  checkedAt: string;
  serviceName: string;
  region: string;
  environmentMode: 'production' | 'development';
  dbConnectionMode: 'url' | 'cloudsql_vars' | 'missing';
  sqlDbName: string | null;
  persistenceDriver: string;
  persistenceMode: string;
  productionDatabaseReady: boolean;
  cloudProbeVerified: boolean;
  cloudProbeError: string | null;
  allowSandboxInProduction: boolean;
  seedDemoData: boolean;
  variables: EnvReadinessVariable[];
}

export const FALLBACK_CLOUD_RUN_VARS: EnvReadinessVariable[] = [
  { key: 'SERVER_SECRET', scope: 'Segredo Server Core', configured: false, requiredInProduction: true, note: 'Segredo aleatório forte exclusivo do Server Core (HMAC/AES)' },
  { key: 'DATABASE_URL / SQL_*', scope: 'PostgreSQL (Secret Manager)', configured: false, requiredInProduction: true, note: 'String real do PostgreSQL ou SQL_HOST/SQL_USER/SQL_PASSWORD/SQL_DB_NAME' },
  { key: 'ENABLE_POSTGRES_CLOUD', scope: 'PostgreSQL (Runtime)', configured: false, requiredInProduction: true, note: 'true somente após provisionar o PostgreSQL Cloud' },
  { key: 'PG_SSL_REJECT_UNAUTHORIZED', scope: 'PostgreSQL (Runtime)', configured: true, requiredInProduction: false, note: 'true em produção com TLS confiável (desabilitado em /cloudsql/)' },
  { key: 'TRUST_PROXY', scope: 'Server Core Runtime', configured: false, requiredInProduction: true, note: 'true atrás do balanceador HTTPS' },
  { key: 'CLOUD_REGION', scope: 'Server Core Runtime', configured: false, requiredInProduction: false, note: 'us-west1 ou southamerica-east1 conforme serviço' },
  { key: 'APP_URL / ALLOWED_ORIGINS', scope: 'HQ + Server CORS', configured: false, requiredInProduction: true, note: 'URLs oficiais autorizadas via env ou runtimePolicy no HQ' },
  { key: 'GEMINI_API_KEY', scope: 'Segredo Server Core', configured: false, requiredInProduction: false, note: 'Chave server-side para busca inteligente no Marketplace' },
  { key: 'PSP_WEBHOOK_SECRET', scope: 'Cofre HQ / Segredo Server', configured: false, requiredInProduction: false, note: 'Segredo HMAC de pedidos (env ou cofre PAYMENT no HQ)' },
  { key: 'SAAS_PSP_WEBHOOK_SECRET', scope: 'Cofre HQ / Segredo Server', configured: false, requiredInProduction: false, note: 'Segredo HMAC de assinaturas SaaS (env ou cofre PAYMENT no HQ)' },
  { key: 'EMAIL_WEBHOOK_URL / SECRET', scope: 'HQ + Segredo Server', configured: false, requiredInProduction: false, note: 'Endpoint via HQ/Server e segredo HMAC no Secret Manager' },
  { key: 'SERVER_STORAGE_DIR', scope: 'Server Core Storage', configured: false, requiredInProduction: false, note: 'Diretório em volume persistente (cotas gerenciadas no HQ)' },
  { key: 'SUPABASE_URL / PUBLISHABLE_KEY', scope: 'HQ + Server Core (Opcional)', configured: false, requiredInProduction: false, note: 'Endpoint público e chave publishable para Auth JWKS e cliente RLS' },
  { key: 'SUPABASE_SECRET_KEY', scope: 'Segredo Server Core', configured: false, requiredInProduction: false, note: 'Chave secreta admin apenas no Secret Manager do Server Core' },
];

export const CLOUD_RUN_ENV_TEMPLATE = `# ===================================================================
# 3C CORP SAAS 5.2.2 — VARIÁVEIS DE AMBIENTE DO SERVER CORE (SECRET MANAGER)
# Preencha apenas com segredos reais no runtime do Server Core (nunca em CI Secrets)
# Configurações operacionais (planos, releases, CORS extra, cotas) residem no HQ Central
# ===================================================================
NODE_ENV="production"
PORT="3000"
TRUST_PROXY="true"
CLOUD_REGION="us-west1"
APP_URL="https://app-3ccorp-164281225843.us-west1.run.app"
ALLOWED_ORIGINS="https://app-3ccorp-164281225843.us-west1.run.app,https://app-3ccorp-2aj4z66sma-uw.a.run.app"

# Segurança & Primeiro Acesso Master HQ (3eatcru@gmail.com)
SERVER_SECRET="<GERAR_BASE64_48_BYTES>"
INITIAL_DEV_PASSWORD="<OPCIONAL_SENHA_INICIAL_PRIMEIRO_BOOT>"

# Banco PostgreSQL / Cloud SQL (opção A: DATABASE_URL OU opção B: SQL_*)
ENABLE_POSTGRES_CLOUD="true"
PG_SSL_REJECT_UNAUTHORIZED="true"
# DATABASE_URL="postgresql://<CLOUD_SQL_USER>:<CLOUD_SQL_PASSWORD>@localhost:5432/cloud_sql_production_database"
SQL_HOST="/cloudsql/<PROJECT_ID>:<REGION>:<CLOUD_SQL_INSTANCE>"
SQL_PORT="5432"
SQL_USER="<CLOUD_SQL_USER>"
SQL_PASSWORD="<CLOUD_SQL_PASSWORD>"
SQL_DB_NAME="cloud_sql_production_database"

# Pagamentos, E-mail Transacional, IA & Storage (Segredos exclusivamente no Server / Cofre)
GEMINI_API_KEY="<SUA_GEMINI_API_KEY>"
PSP_WEBHOOK_SECRET="<SEGREDO_HMAC_PSP_PEDIDOS>"
SAAS_PSP_WEBHOOK_SECRET="<SEGREDO_HMAC_PSP_SAAS>"
EMAIL_WEBHOOK_URL="<ENDPOINT_HTTPS_DISPARO_EMAIL>"
EMAIL_WEBHOOK_SECRET="<SEGREDO_HMAC_EMAIL>"
SERVER_STORAGE_DIR="/var/lib/3c-storage"

# Conector Opcional Supabase (@supabase/server + @supabase/supabase-js)
SUPABASE_URL="<HTTPS_URL_PROJETO_SUPABASE>"
SUPABASE_PUBLISHABLE_KEY="<SB_PUBLISHABLE_KEY>"
SUPABASE_JWKS_URL="<HTTPS_URL_PROJETO_SUPABASE>/auth/v1/.well-known/jwks.json"
SUPABASE_SECRET_KEY="<SB_SECRET_KEY_APENAS_SERVER>"
`;
