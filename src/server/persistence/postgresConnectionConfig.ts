export type PgSslOption = boolean | { rejectUnauthorized: boolean; ca?: string };

export type PostgresDatabaseProvider = 'supabase' | 'cloud-sql' | 'postgres' | 'none';

export interface PostgresConnectionTarget {
  configured: boolean;
  mode: 'url' | 'cloudsql_vars' | 'missing';
  connectionString?: string;
  poolConfig?: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl: PgSslOption;
  };
  sqlDbName?: string;
  missingReason?: string;
  provider?: PostgresDatabaseProvider;
  sourceEnvKey?: 'DATABASE_URL' | 'POSTGRES_URL' | 'SUPABASE_DB_URL' | 'SQL_HOST';
}

/**
 * Detecta o provedor PostgreSQL a partir do host/URL (sem expor credenciais).
 * - supabase: *.supabase.co / *.pooler.supabase.com
 * - cloud-sql: socket /cloudsql/ ou host Cloud SQL
 * - postgres: qualquer outro PostgreSQL nativo
 */
export function detectPostgresProvider(hostOrUrl: string | undefined | null): PostgresDatabaseProvider {
  const raw = String(hostOrUrl || '').trim().toLowerCase();
  if (!raw) return 'none';
  if (raw.includes('.supabase.co') || raw.includes('pooler.supabase.com') || raw.includes('.supabase.com')) {
    return 'supabase';
  }
  if (raw.includes('/cloudsql/') || raw.includes('cloudsql') || raw.includes('.sql.goog')) {
    return 'cloud-sql';
  }
  return 'postgres';
}

/**
 * Remove parâmetros `sslmode`/`sslrootcert`/... da connection string.
 * No node-postgres, os parâmetros da URL SOBRESCREVEM o objeto `ssl` do Pool
 * (e `sslmode=require` passou a significar verify-full), o que quebra a
 * configuração de CA/rejectUnauthorized governada pelo Server Core.
 */
export function sanitizePgConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) {
      url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return connectionString;
  }
}

export function hasSslDisabledInConnectionString(connectionString: string): boolean {
  return /[?&]sslmode=disable\b/i.test(connectionString);
}

export interface PgRlsContext {
  tenantId?: string | null;
  bypassRls?: boolean;
  reason?: string;
}

export function normalizePgContext(ctxOrTenantId?: string | PgRlsContext): { tenantId: string | null; bypassRls: boolean } {
  if (typeof ctxOrTenantId === 'string') {
    const trimmed = ctxOrTenantId.trim();
    return { tenantId: trimmed || null, bypassRls: false };
  }
  if (ctxOrTenantId && typeof ctxOrTenantId === 'object') {
    const trimmed = typeof ctxOrTenantId.tenantId === 'string' ? ctxOrTenantId.tenantId.trim() : '';
    return {
      tenantId: trimmed || null,
      bypassRls: ctxOrTenantId.bypassRls === true,
    };
  }
  return { tenantId: null, bypassRls: false };
}

export function resolvePostgresConnectionTargetWithSsl(
  resolveSslFn: (hostOrUrl: string, env: Record<string, string | undefined>) => PgSslOption,
  env: Record<string, string | undefined> = process.env
): PostgresConnectionTarget {
  const urlCandidates: Array<['DATABASE_URL' | 'POSTGRES_URL' | 'SUPABASE_DB_URL', string]> = [
    ['DATABASE_URL', (env.DATABASE_URL || '').trim()],
    ['POSTGRES_URL', (env.POSTGRES_URL || '').trim()],
    ['SUPABASE_DB_URL', (env.SUPABASE_DB_URL || '').trim()],
  ];
  const firstUrl = urlCandidates.find(([, value]) => Boolean(value));
  if (firstUrl) {
    const [sourceEnvKey, cloudUrl] = firstUrl;
    return {
      configured: true,
      mode: 'url',
      connectionString: cloudUrl,
      provider: detectPostgresProvider(cloudUrl),
      sourceEnvKey,
    };
  }

  const sqlHost = (env.SQL_HOST || '').trim();
  const sqlUser = (env.SQL_USER || '').trim();
  const sqlPassword = (env.SQL_PASSWORD || '').trim();
  const sqlDbName = (env.SQL_DB_NAME || '').trim();
  const sqlPort = Number(env.SQL_PORT) || 5432;

  if (sqlHost && sqlUser && sqlPassword && sqlDbName) {
    return {
      configured: true,
      mode: 'cloudsql_vars',
      sqlDbName,
      provider: detectPostgresProvider(sqlHost),
      sourceEnvKey: 'SQL_HOST',
      poolConfig: {
        host: sqlHost,
        port: sqlPort,
        user: sqlUser,
        password: sqlPassword,
        database: sqlDbName,
        ssl: resolveSslFn(sqlHost, env),
      },
    };
  }

  if (sqlDbName || sqlHost || sqlUser) {
    const missing = [
      !sqlHost ? 'SQL_HOST' : null,
      !sqlUser ? 'SQL_USER' : null,
      !sqlPassword ? 'SQL_PASSWORD' : null,
      !sqlDbName ? 'SQL_DB_NAME' : null,
    ].filter(Boolean);
    return {
      configured: false,
      mode: 'missing',
      sqlDbName: sqlDbName || undefined,
      missingReason: `${sqlDbName ? `SQL_DB_NAME (${sqlDbName}) detectado, mas ` : ''}falta DATABASE_URL ou ${missing.join('/')}.`,
    };
  }

  return {
    configured: false,
    mode: 'missing',
    missingReason: 'DATABASE_URL, SUPABASE_DB_URL ou variáveis SQL_HOST/SQL_USER/SQL_PASSWORD/SQL_DB_NAME não configuradas.',
    provider: 'none',
  };
}
