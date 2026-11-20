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
    ssl: boolean | { rejectUnauthorized: boolean };
  };
  sqlDbName?: string;
  missingReason?: string;
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
  resolveSslFn: (hostOrUrl: string, env: Record<string, string | undefined>) => boolean | { rejectUnauthorized: boolean },
  env: Record<string, string | undefined> = process.env
): PostgresConnectionTarget {
  const cloudUrl = (env.DATABASE_URL || env.POSTGRES_URL || '').trim();
  if (cloudUrl) {
    return {
      configured: true,
      mode: 'url',
      connectionString: cloudUrl,
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
    missingReason: 'DATABASE_URL ou variáveis SQL_HOST/SQL_USER/SQL_PASSWORD/SQL_DB_NAME não configuradas.',
  };
}
