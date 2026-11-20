import React, { useState } from 'react';
import { Activity, Database, KeyRound, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { apiClient } from '../../../core/api/apiClient';
import { PlatformGovernance } from '../../../types';

interface HqSupabaseServicesGridProps {
  governance: PlatformGovernance;
  supabaseEnabled: boolean;
  statusDetail?: string;
  isDevOwner: boolean;
  togglingFlag: string | null;
  onToggleFlag: (flagKey: keyof PlatformGovernance['featureFlags']) => void;
}

export const HqSupabaseServicesGrid: React.FC<HqSupabaseServicesGridProps> = ({
  governance,
  supabaseEnabled,
  statusDetail,
  isDevOwner,
  togglingFlag,
  onToggleFlag,
}) => {
  const { getIdToken } = useAuth();
  const [probingServer, setProbingServer] = useState(false);
  const [serverProbe, setServerProbe] = useState<{
    online: boolean;
    hasSecretKey: boolean;
    jwksReachable: boolean;
    latencyMs: number;
    detail: string;
    source: string;
  } | null>(null);

  const authEnabled = supabaseEnabled && governance?.featureFlags?.supabaseAuthEnabled !== false;
  const dbEnabled = supabaseEnabled && governance?.featureFlags?.supabaseDbEnabled !== false;

  const handleServerProbe = async () => {
    setProbingServer(true);
    try {
      const token = await getIdToken();
      const res = await apiClient.getSupabaseHealth(token);
      setServerProbe({
        online: res.online,
        hasSecretKey: res.hasSecretKey,
        jwksReachable: res.jwksReachable,
        latencyMs: res.latencyMs,
        detail: res.detail,
        source: res.source,
      });
    } catch (err: any) {
      setServerProbe({
        online: false,
        hasSecretKey: false,
        jwksReachable: false,
        latencyMs: 0,
        detail: err?.message || 'Erro ao sondar /api/v1/supabase/health.',
        source: 'ERROR',
      });
    } finally {
      setProbingServer(false);
    }
  };

  const services: Array<{
    id: string;
    flagKey?: keyof PlatformGovernance['featureFlags'];
    title: string;
    module: string;
    detail: string;
    enabled: boolean;
    icon: React.FC<{ className?: string }>;
  }> = [
    {
      id: 'supabase-auth-jwks',
      flagKey: 'supabaseAuthEnabled',
      title: 'Supabase Auth (JWKS Exchange)',
      module: 'POST /api/v1/auth/supabase-exchange',
      detail: 'Validação criptográfica JWKS via @supabase/server com isolamento estrito por produto e tenant.',
      enabled: authEnabled,
      icon: KeyRound,
    },
    {
      id: 'supabase-client-rls',
      flagKey: 'supabaseDbEnabled',
      title: 'Supabase Client RLS & PostgREST',
      module: 'src/utils/supabase.ts · createContextClient',
      detail: 'Cliente @supabase/supabase-js sob chave publishable e políticas RLS sem acesso direto a segredos.',
      enabled: dbEnabled,
      icon: Database,
    },
    {
      id: 'supabase-server-admin',
      title: 'Supabase Server Core & Postgres',
      module: '@supabase/server · PostgresCloudDriver',
      detail: 'SUPABASE_SECRET_KEY e SQL_PASSWORD residem exclusivamente no Server Core / Secret Manager.',
      enabled: Boolean(serverProbe?.hasSecretKey),
      icon: Server,
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Serviços do Provedor Secundário (Supabase Framework)
          </h3>
          <p className="text-[11px] text-slate-400">
            Segredos (`SUPABASE_SECRET_KEY` / senha Postgres) nunca são exibidos ou salvos pela interface.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
            {statusDetail || 'Pronto'}
          </span>
          <button
            type="button"
            disabled={probingServer}
            onClick={() => void handleServerProbe()}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${probingServer ? 'animate-spin' : ''}`} />
            {probingServer ? 'Sondando...' : 'Testar Server (@supabase/server)'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {services.map((svc) => {
          const Icon = svc.icon;
          const isToggling = Boolean(svc.flagKey && togglingFlag === String(svc.flagKey));
          return (
            <div
              key={svc.id}
              className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${
                svc.enabled
                  ? 'bg-slate-900/90 border-emerald-500/30'
                  : 'bg-slate-950/60 border-slate-800/80 opacity-85'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="p-1.5 rounded-lg bg-slate-800 text-emerald-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                      svc.enabled
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {svc.flagKey
                      ? svc.enabled
                        ? 'ATIVO'
                        : 'STANDBY'
                      : serverProbe
                      ? serverProbe.hasSecretKey
                        ? 'SECRET OK'
                        : 'SEM SECRET'
                      : 'SERVER ENV'}
                  </span>
                </div>
                <h4 className="text-xs font-black text-white leading-tight">{svc.title}</h4>
                <p className="text-[10px] font-mono text-cyan-400 break-all">{svc.module}</p>
                <p className="text-[10px] text-slate-400 leading-snug">{svc.detail}</p>
              </div>

              {svc.flagKey ? (
                <button
                  type="button"
                  disabled={!isDevOwner || !supabaseEnabled || isToggling}
                  onClick={() => onToggleFlag(svc.flagKey!)}
                  className={`w-full py-1.5 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    svc.enabled
                      ? 'bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-slate-700'
                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {isToggling ? 'Salvando...' : svc.enabled ? 'Desativar Serviço' : 'Ativar Serviço'}
                </button>
              ) : (
                <div className="w-full py-1.5 px-2.5 rounded-lg text-[10px] font-mono text-center bg-slate-900 text-slate-400 border border-slate-800 flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  Cofre / Secret Manager
                </div>
              )}
            </div>
          );
        })}
      </div>

      {serverProbe && (
        <div
          className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            serverProbe.online
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
              : 'bg-slate-900 border-slate-700 text-slate-300'
          }`}
        >
          <span>{serverProbe.detail}</span>
          <span className="font-mono text-[11px] shrink-0">
            JWKS: {serverProbe.jwksReachable ? 'OK' : 'N/D'} · Secret: {serverProbe.hasSecretKey ? 'ON' : 'OFF'} ·{' '}
            {serverProbe.latencyMs}ms
          </span>
        </div>
      )}
    </div>
  );
};
