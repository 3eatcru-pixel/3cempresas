import { fromSupabaseUrl } from '@supabase/server';
import {
  createAdminClient,
  createContextClient,
  verifyCredentials,
} from '@supabase/server/core';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseServerRuntimeInfo {
  url: string;
  publishableKey: string;
  jwksUrl: string;
  hasSecretKey: boolean;
  configured: boolean;
  source: 'HQ_GOVERNANCE' | 'SERVER_ENV' | 'UNCONFIGURED';
}

export interface VerifiedSupabaseTokenClaims {
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export interface SupabaseServerHealthProbeResult {
  online: boolean;
  configured: boolean;
  hasSecretKey: boolean;
  url: string;
  jwksUrl: string;
  jwksReachable: boolean;
  authHealthStatus: number | null;
  latencyMs: number;
  source: SupabaseServerRuntimeInfo['source'];
  detail: string;
}

function readFirstSecretKeyFromEnv(): string {
  const singular = (process.env.SUPABASE_SECRET_KEY || '').trim();
  if (singular) return singular;
  const pluralRaw = (process.env.SUPABASE_SECRET_KEYS || '').trim();
  if (!pluralRaw) return '';
  if (pluralRaw.startsWith('{')) {
    try {
      const parsed = JSON.parse(pluralRaw) as Record<string, unknown>;
      if (typeof parsed.default === 'string' && parsed.default.trim()) {
        return parsed.default.trim();
      }
      for (const val of Object.values(parsed)) {
        if (typeof val === 'string' && val.trim()) {
          return val.trim();
        }
      }
    } catch {
      // ignore malformed JSON secret map
    }
  }
  return pluralRaw.split(',')[0]?.trim() || '';
}

function readFirstPublishableKeyFromEnv(): string {
  const candidates = [
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
  ];
  for (const cand of candidates) {
    if (typeof cand === 'string' && cand.trim()) {
      return cand.trim();
    }
  }
  const pluralRaw = (process.env.SUPABASE_PUBLISHABLE_KEYS || '').trim();
  if (pluralRaw.startsWith('{')) {
    try {
      const parsed = JSON.parse(pluralRaw) as Record<string, unknown>;
      if (typeof parsed.default === 'string' && parsed.default.trim()) {
        return parsed.default.trim();
      }
      for (const val of Object.values(parsed)) {
        if (typeof val === 'string' && val.trim()) {
          return val.trim();
        }
      }
    } catch {
      // ignore
    }
  }
  return pluralRaw.split(',')[0]?.trim() || '';
}

export function resolveSupabaseServerRuntime(govData?: any): SupabaseServerRuntimeInfo {
  const policy = govData?.runtimePolicy || {};
  const hqUrl = typeof policy.supabaseUrl === 'string' ? policy.supabaseUrl.trim().replace(/\/+$/, '') : '';
  const envUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const url = hqUrl || envUrl;

  const hqPubKey =
    typeof policy.supabasePublishableKey === 'string' ? policy.supabasePublishableKey.trim() : '';
  const envPubKey = readFirstPublishableKeyFromEnv();
  const publishableKey = hqPubKey || envPubKey;

  const hqJwks = typeof policy.supabaseJwksUrl === 'string' ? policy.supabaseJwksUrl.trim() : '';
  const envJwks = (process.env.SUPABASE_JWKS_URL || '').trim();
  const jwksUrl = hqJwks || envJwks || (url ? `${url}/auth/v1/.well-known/jwks.json` : '');

  const hasSecretKey = Boolean(readFirstSecretKeyFromEnv());
  const configured = Boolean(url && publishableKey);
  const source: SupabaseServerRuntimeInfo['source'] = hqUrl
    ? 'HQ_GOVERNANCE'
    : envUrl
    ? 'SERVER_ENV'
    : 'UNCONFIGURED';

  return {
    url,
    publishableKey,
    jwksUrl,
    hasSecretKey,
    configured,
    source,
  };
}

export function buildSupabaseEnvOverride(govData?: any) {
  const runtime = resolveSupabaseServerRuntime(govData);
  const secretKey = readFirstSecretKeyFromEnv();
  return {
    ...(runtime.url ? { url: runtime.url } : {}),
    ...(runtime.publishableKey ? { publishableKeys: { default: runtime.publishableKey } } : {}),
    ...(secretKey ? { secretKeys: { default: secretKey } } : {}),
    ...(runtime.jwksUrl ? { jwksUrl: runtime.jwksUrl } : {}),
  };
}

export function getSupabaseAdminClient(govData?: any): SupabaseClient {
  const runtime = resolveSupabaseServerRuntime(govData);
  if (!runtime.url || !runtime.hasSecretKey) {
    throw new Error(
      'SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórios no Server Core para operar o cliente administrativo.'
    );
  }
  return createAdminClient({
    env: buildSupabaseEnvOverride(govData),
  });
}

export function getSupabaseContextClient(accessToken: string, govData?: any): SupabaseClient {
  const runtime = resolveSupabaseServerRuntime(govData);
  if (!runtime.url || !runtime.publishableKey) {
    throw new Error('SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY não estão configurados.');
  }
  return createContextClient({
    auth: { token: accessToken, keyName: 'default' },
    env: buildSupabaseEnvOverride(govData),
  });
}

/**
 * Cryptographically validates a Supabase Auth JWT on the Server Core using @supabase/server JWKS verification.
 */
export async function verifySupabaseAccessToken(
  accessToken: string,
  govData?: any
): Promise<VerifiedSupabaseTokenClaims> {
  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('Token Supabase ausente.');
  }

  const runtime = resolveSupabaseServerRuntime(govData);
  if (!runtime.url) {
    throw new Error('Projeto Supabase não configurado no HQ Central ou Server Core.');
  }

  const envOverride = buildSupabaseEnvOverride(govData);
  const result = await verifyCredentials(
    { token: accessToken.trim(), apikey: null },
    {
      auth: 'user',
      issuer: fromSupabaseUrl(runtime.url),
      env: envOverride,
    }
  );

  if (result.error || !result.data?.userClaims) {
    throw new Error(result.error?.message || 'Token Supabase inválido ou expirado.');
  }

  const claims = result.data.userClaims as Record<string, any>;
  const uid = String(claims.id || claims.sub || '').trim();
  const email = typeof claims.email === 'string' ? claims.email.toLowerCase().trim() : '';

  if (!uid || !email || !email.includes('@')) {
    throw new Error('Token Supabase sem identificador (sub) ou e-mail válido.');
  }

  const emailVerified =
    claims.emailVerified === true ||
    claims.email_verified === true ||
    Boolean(claims.confirmed_at) ||
    Boolean(claims.user_metadata?.email_verified);

  if (!emailVerified) {
    throw new Error('E-mail Supabase ainda não verificado.');
  }

  const rawName =
    claims.user_metadata?.full_name ||
    claims.user_metadata?.name ||
    claims.name ||
    email.split('@')[0];

  return {
    uid,
    email,
    emailVerified: true,
    name: String(rawName || email.split('@')[0]).trim().slice(0, 120),
  };
}

export async function probeSupabaseServerHealth(
  govData?: any
): Promise<SupabaseServerHealthProbeResult> {
  const startedAt = Date.now();
  const runtime = resolveSupabaseServerRuntime(govData);

  if (!runtime.configured) {
    return {
      online: false,
      configured: false,
      hasSecretKey: runtime.hasSecretKey,
      url: runtime.url,
      jwksUrl: runtime.jwksUrl,
      jwksReachable: false,
      authHealthStatus: null,
      latencyMs: 0,
      source: runtime.source,
      detail:
        'Supabase não configurado (defina SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY ou configure no HQ). Server Core operando autônomo.',
    };
  }

  try {
    const [jwksRes, healthRes] = await Promise.all([
      fetch(runtime.jwksUrl, { method: 'GET', headers: { Accept: 'application/json' } }),
      fetch(`${runtime.url}/auth/v1/health`, {
        method: 'GET',
        headers: { apikey: runtime.publishableKey },
      }),
    ]);

    const latencyMs = Math.max(1, Date.now() - startedAt);
    const jwksReachable = jwksRes.ok;
    const authHealthStatus = healthRes.status;
    const online = jwksReachable || healthRes.ok;

    return {
      online,
      configured: true,
      hasSecretKey: runtime.hasSecretKey,
      url: runtime.url,
      jwksUrl: runtime.jwksUrl,
      jwksReachable,
      authHealthStatus,
      latencyMs,
      source: runtime.source,
      detail: online
        ? `Supabase operacional via @supabase/server (${latencyMs}ms · JWKS ${jwksRes.status} · Auth ${healthRes.status}).`
        : `Supabase respondeu JWKS ${jwksRes.status} / Auth ${healthRes.status}. Server Core segue autônomo.`,
    };
  } catch (err: any) {
    return {
      online: false,
      configured: true,
      hasSecretKey: runtime.hasSecretKey,
      url: runtime.url,
      jwksUrl: runtime.jwksUrl,
      jwksReachable: false,
      authHealthStatus: null,
      latencyMs: Math.max(1, Date.now() - startedAt),
      source: runtime.source,
      detail: err?.message || 'Erro de rede ao sondar endpoints JWKS/Health do Supabase.',
    };
  }
}
