import {
  configureSupabaseClientRuntime,
  getSupabaseClient,
  getSupabaseRuntimeMetadata,
  isSupabaseClientConfigured,
  type SupabaseRuntimeMetadata,
} from '../utils/supabase';

export {
  configureSupabaseClientRuntime,
  getSupabaseClient,
  getSupabaseRuntimeMetadata,
  isSupabaseClientConfigured,
  type SupabaseRuntimeMetadata,
};

export interface SupabaseConnectionProbeResult {
  online: boolean;
  latencyMs: number;
  url: string;
  configured: boolean;
  detail: string;
}

/**
 * Valida conectividade HTTP do cliente Supabase contra /auth/v1/health ou SDK session.
 * Nunca lança erro fatal: em caso de falha ou standby, o Server Core continua 100% operacional.
 */
export async function testSupabaseConnection(): Promise<SupabaseConnectionProbeResult> {
  const started = performance.now();
  const meta = getSupabaseRuntimeMetadata();

  if (!meta.configured) {
    return {
      online: false,
      latencyMs: 0,
      url: meta.url || 'não configurado',
      configured: false,
      detail:
        'Variáveis VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY ausentes. Server Core segue como autoridade única.',
    };
  }

  try {
    const client = getSupabaseClient();
    const res = await fetch(`${meta.url}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: meta.publishableKey,
      },
    });
    const latencyMs = Math.max(1, Math.round(performance.now() - started));

    if (res.ok) {
      return {
        online: true,
        latencyMs,
        url: meta.url,
        configured: true,
        detail: 'Supabase Auth & REST acessíveis online (health probe respondeu HTTP 200).',
      };
    }

    if (client) {
      const { error } = await client.auth.getSession();
      if (!error) {
        return {
          online: true,
          latencyMs,
          url: meta.url,
          configured: true,
          detail: `Supabase Client operacional (HTTP ${res.status} no health endpoint).`,
        };
      }
    }

    return {
      online: false,
      latencyMs,
      url: meta.url,
      configured: true,
      detail: `Supabase respondeu HTTP ${res.status}. Operação principal preservada no Server Core.`,
    };
  } catch (err: any) {
    return {
      online: false,
      latencyMs: Math.max(1, Math.round(performance.now() - started)),
      url: meta.url,
      configured: true,
      detail: err?.message || 'Falha de rede ao sondar Supabase.',
    };
  }
}
