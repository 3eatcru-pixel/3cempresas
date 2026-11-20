import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Database, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { apiClient } from '../../../core/api/apiClient';
import { getSupabaseRuntimeMetadata } from '../../../services/supabaseClient';

interface ServerSupabaseBackboneCardProps {
  supabaseEnabled: boolean;
  supabaseAuthEnabled?: boolean;
  supabaseDbEnabled?: boolean;
  runtimeSupabaseUrl?: string;
}

export const ServerSupabaseBackboneCard: React.FC<ServerSupabaseBackboneCardProps> = ({
  supabaseEnabled,
  supabaseAuthEnabled = supabaseEnabled,
  supabaseDbEnabled = supabaseEnabled,
  runtimeSupabaseUrl,
}) => {
  const { getIdToken } = useAuth();
  const meta = getSupabaseRuntimeMetadata();
  const displayUrl = runtimeSupabaseUrl || meta.url || 'Não configurado';

  const [probing, setProbing] = useState(false);
  const [probe, setProbe] = useState<{
    online: boolean;
    configured: boolean;
    hasSecretKey: boolean;
    jwksReachable: boolean;
    latencyMs: number;
    detail: string;
  } | null>(null);

  const handleProbe = useCallback(async () => {
    if (!supabaseEnabled) {
      setProbe({
        online: false,
        configured: meta.configured,
        hasSecretKey: false,
        jwksReachable: false,
        latencyMs: 0,
        detail: 'Conector Supabase está em modo STANDBY na governança do HQ Central.',
      });
      return;
    }
    setProbing(true);
    try {
      const token = await getIdToken();
      const res = await apiClient.getSupabaseHealth(token);
      setProbe({
        online: res.online,
        configured: res.configured,
        hasSecretKey: res.hasSecretKey,
        jwksReachable: res.jwksReachable,
        latencyMs: res.latencyMs,
        detail: res.detail,
      });
    } catch (err: any) {
      setProbe({
        online: false,
        configured: meta.configured,
        hasSecretKey: false,
        jwksReachable: false,
        latencyMs: 0,
        detail: err?.message || 'Erro ao consultar /api/v1/supabase/health.',
      });
    } finally {
      setProbing(false);
    }
  }, [supabaseEnabled, meta.configured, getIdToken]);

  useEffect(() => {
    if (supabaseEnabled) {
      void handleProbe();
    } else {
      setProbe(null);
    }
  }, [supabaseEnabled, handleProbe]);

  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-tight">
              Server Core Backbone — Adaptador Opcional Supabase (@supabase/server)
            </h2>
            <p className="text-xs text-slate-400">
              Executa verificação JWT via JWKS (<code className="text-cyan-300">/api/v1/auth/supabase-exchange</code>) e mantém chave secreta isolada no servidor.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border ${
              supabaseEnabled
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {supabaseEnabled ? 'HQ: ATIVO' : 'HQ: DESATIVADO (STANDBY)'}
          </span>
          <button
            type="button"
            disabled={probing || !supabaseEnabled}
            onClick={() => void handleProbe()}
            className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${probing ? 'animate-spin' : ''}`} />
            {probing ? 'Sondando...' : 'Testar Supabase'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            Endpoint &amp; Client RLS
          </div>
          <div className="font-mono font-bold text-white truncate" title={displayUrl}>
            {displayUrl}
          </div>
          <div className="text-[11px] font-mono text-slate-400 truncate">
            DB/PostgREST: {supabaseDbEnabled ? 'ATIVO' : 'STANDBY'} · Auth: {supabaseAuthEnabled ? 'ATIVO' : 'STANDBY'}
          </div>
        </div>

        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            Bridge JWT &amp; JWKS
          </div>
          <div className="font-mono font-bold text-cyan-300">POST /api/v1/auth/supabase-exchange</div>
          <div className="text-[11px] text-slate-400">
            Verifica JWT via JWKS e aplica isolamento estrito de appId, tenant e RBAC.
          </div>
        </div>

        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Segredo &amp; Postgres Cloud
          </div>
          <div className="font-mono font-bold text-white">
            {probe
              ? probe.hasSecretKey
                ? 'SUPABASE_SECRET_KEY ativa'
                : 'SUPABASE_SECRET_KEY pendente'
              : 'Gerenciado no Secret Manager'}
          </div>
          <div className="text-[11px] text-slate-400">
            Secret Key e senha Postgres nunca trafegam pelo frontend.
          </div>
        </div>
      </div>

      {probe && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            probe.online
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
              : 'bg-slate-950 border-slate-700 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {probe.online ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <WifiOff className="w-4 h-4 text-slate-400 shrink-0" />
            )}
            <span>{probe.detail}</span>
          </div>
          <span className="font-mono text-[11px] shrink-0">
            {probe.online ? `ONLINE · ${probe.latencyMs}ms` : `OFFLINE · ${probe.latencyMs}ms`}
          </span>
        </div>
      )}
    </div>
  );
};
