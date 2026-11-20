import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseRuntimeMetadata {
  url: string;
  publishableKey: string;
  jwksUrl: string;
  oauthAuthorizeUrl: string;
  oauthTokenUrl: string;
  oidcDiscoveryUrl: string;
  configured: boolean;
  source: 'VITE_ENV' | 'HQ_SERVER_RUNTIME' | 'UNCONFIGURED';
}

let dynamicOverride: {
  url?: string;
  publishableKey?: string;
  jwksUrl?: string;
} = {};

let cachedClient: SupabaseClient | null = null;
let cachedSignature = '';

function readViteEnv(key: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_PUBLISHABLE_KEY'): string {
  try {
    const metaEnv = (import.meta as any)?.env;
    if (metaEnv && typeof metaEnv[key] === 'string') {
      return metaEnv[key].trim();
    }
  } catch {
    // ignore non-Vite contexts
  }
  if (typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string') {
    return String(process.env[key]).trim();
  }
  return '';
}

export function configureSupabaseClientRuntime(next: {
  url?: string | null;
  publishableKey?: string | null;
  jwksUrl?: string | null;
}): void {
  const nextUrl = typeof next.url === 'string' ? next.url.trim().replace(/\/+$/, '') : '';
  const nextKey = typeof next.publishableKey === 'string' ? next.publishableKey.trim() : '';
  const nextJwks = typeof next.jwksUrl === 'string' ? next.jwksUrl.trim() : '';

  dynamicOverride = {
    url: nextUrl || undefined,
    publishableKey: nextKey || undefined,
    jwksUrl: nextJwks || undefined,
  };

  if (!nextUrl || !nextKey) {
    cachedClient = null;
    cachedSignature = '';
  }
}

export function getSupabaseRuntimeMetadata(): SupabaseRuntimeMetadata {
  const envUrl = readViteEnv('VITE_SUPABASE_URL').replace(/\/+$/, '');
  const envKey = readViteEnv('VITE_SUPABASE_PUBLISHABLE_KEY');

  const url = dynamicOverride.url || envUrl;
  const publishableKey = dynamicOverride.publishableKey || envKey;
  const jwksUrl =
    dynamicOverride.jwksUrl || (url ? `${url}/auth/v1/.well-known/jwks.json` : '');
  const oauthAuthorizeUrl = url ? `${url}/auth/v1/oauth/authorize` : '';
  const oauthTokenUrl = url ? `${url}/auth/v1/oauth/token` : '';
  const oidcDiscoveryUrl = url ? `${url}/auth/v1/.well-known/openid-configuration` : '';
  const configured = Boolean(url && publishableKey);

  const source: SupabaseRuntimeMetadata['source'] =
    dynamicOverride.url || dynamicOverride.publishableKey
      ? 'HQ_SERVER_RUNTIME'
      : envUrl && envKey
      ? 'VITE_ENV'
      : 'UNCONFIGURED';

  return {
    url,
    publishableKey,
    jwksUrl,
    oauthAuthorizeUrl,
    oauthTokenUrl,
    oidcDiscoveryUrl,
    configured,
    source,
  };
}

export function isSupabaseClientConfigured(): boolean {
  return getSupabaseRuntimeMetadata().configured;
}

export function getSupabaseClient(): SupabaseClient | null {
  const meta = getSupabaseRuntimeMetadata();
  if (!meta.configured) {
    return null;
  }
  const sig = `${meta.url}::${meta.publishableKey}`;
  if (!cachedClient || cachedSignature !== sig) {
    cachedClient = createClient(meta.url, meta.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    cachedSignature = sig;
  }
  return cachedClient;
}

/**
 * Compatibilidade direta com import `{ supabase } from './utils/supabase'`.
 * Retorna instância ativa do SupabaseClient ou null quando o conector estiver sem configuração.
 */
export const supabase: SupabaseClient | null = getSupabaseClient();
