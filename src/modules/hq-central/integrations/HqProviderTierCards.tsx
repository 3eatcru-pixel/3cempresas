import React from 'react';
import { CheckCircle2, Database, Flame, Power, Server, ShieldCheck } from 'lucide-react';
import { IntegrationProviderDescriptor } from '../../../infrastructure/providers/ProviderManager';

interface HqProviderTierCardsProps {
  primaryDescriptor?: IntegrationProviderDescriptor;
  secondaryDescriptor?: IntegrationProviderDescriptor;
  supabaseDescriptor?: IntegrationProviderDescriptor;
  firebaseEnabled: boolean;
  firebaseProjectId: string;
  supabaseEnabled: boolean;
  supabaseUrl: string;
  isDevOwner: boolean;
  togglingFlag: string | null;
  onToggleFirebaseEnabled: () => void;
  onToggleSupabaseEnabled: () => void;
}

export const HqProviderTierCards: React.FC<HqProviderTierCardsProps> = ({
  primaryDescriptor,
  secondaryDescriptor,
  supabaseDescriptor,
  firebaseEnabled,
  firebaseProjectId,
  supabaseEnabled,
  supabaseUrl,
  isDevOwner,
  togglingFlag,
  onToggleFirebaseEnabled,
  onToggleSupabaseEnabled,
}) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Provedor Principal: Server Core */}
      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/15 p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[9px] font-mono font-black uppercase">
                  PROVEDOR PRINCIPAL
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[9px] font-mono font-bold">
                  AUTORIDADE ÚNICA DE DADOS
                </span>
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-tight mt-1">
                {primaryDescriptor?.name || '3C Server Core & Edge Backbone'}
              </h3>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-black flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" />
            ONLINE {primaryDescriptor?.latencyMs ? `(${primaryDescriptor.latencyMs}ms)` : ''}
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Backbone tecnológico do ecossistema. Detém{' '}
          <strong className="text-white">autoridade exclusiva de gravação</strong> para estoque, vendas, pedidos,
          financeiro, regras de negócio, autenticação RBAC e sincronização Offline-First.
        </p>

        <div className="pt-2 border-t border-cyan-500/20 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5 text-cyan-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            Gravação comercial simultânea em duas bases bloqueada
          </span>
          <span>Falhas: {primaryDescriptor?.failureCount ?? 0}</span>
        </div>
      </div>

      {/* Provedor Secundário 1: Firebase Adapter */}
      <div
        className={`rounded-2xl border p-5 space-y-3 transition-colors ${
          firebaseEnabled
            ? 'bg-emerald-950/15 border-emerald-500/30'
            : 'bg-slate-950/90 border-slate-800'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2.5 rounded-xl border ${
                firebaseEnabled
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[9px] font-mono font-black uppercase">
                  SECUNDÁRIO · FIREBASE
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${
                    firebaseEnabled
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {firebaseEnabled ? 'ATIVO' : 'STANDBY'}
                </span>
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-tight mt-1">
                Firebase Provider Adapter
              </h3>
            </div>
          </div>

          <button
            type="button"
            disabled={!isDevOwner || togglingFlag === 'firebaseEnabled'}
            onClick={onToggleFirebaseEnabled}
            className={`px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all cursor-pointer disabled:opacity-50 ${
              firebaseEnabled
                ? 'bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/35'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {togglingFlag === 'firebaseEnabled'
              ? 'Salvando...'
              : firebaseEnabled
              ? 'Desativar'
              : 'Ativar'}
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Conector opcional para Google OAuth e Firestore Cores. Se desligado ou offline, o Server Core continua
          operando 100% autônomo.
        </p>

        <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
          <span>
            Projeto: <strong className="text-slate-200">{firebaseProjectId || 'N/D'}</strong>
            {secondaryDescriptor?.latencyMs ? ` • ${secondaryDescriptor.latencyMs}ms` : ''}
          </span>
          <span>Falhas isoladas: {secondaryDescriptor?.failureCount ?? 0}</span>
        </div>
      </div>

      {/* Provedor Secundário 2: Supabase Framework Adapter */}
      <div
        className={`rounded-2xl border p-5 space-y-3 transition-colors ${
          supabaseEnabled
            ? 'bg-emerald-950/15 border-emerald-500/30'
            : 'bg-slate-950/90 border-slate-800'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2.5 rounded-xl border ${
                supabaseEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[9px] font-mono font-black uppercase">
                  SECUNDÁRIO · SUPABASE
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${
                    supabaseEnabled
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {supabaseEnabled ? 'ATIVO' : 'STANDBY'}
                </span>
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-tight mt-1">
                Supabase Framework Adapter
              </h3>
            </div>
          </div>

          <button
            type="button"
            disabled={!isDevOwner || togglingFlag === 'supabaseEnabled'}
            onClick={onToggleSupabaseEnabled}
            className={`px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all cursor-pointer disabled:opacity-50 ${
              supabaseEnabled
                ? 'bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/35'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {togglingFlag === 'supabaseEnabled'
              ? 'Salvando...'
              : supabaseEnabled
              ? 'Desativar'
              : 'Ativar'}
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Conector opcional via <code className="text-emerald-300">@supabase/supabase-js</code> e{' '}
          <code className="text-cyan-300">@supabase/server</code> (JWKS + cliente RLS + Postgres Cloud opcional).
        </p>

        <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
          <span className="truncate max-w-[240px]" title={supabaseUrl || 'Não configurado'}>
            Endpoint: <strong className="text-slate-200">{supabaseUrl || 'Aguardando env/HQ'}</strong>
            {supabaseDescriptor?.latencyMs ? ` • ${supabaseDescriptor.latencyMs}ms` : ''}
          </span>
          <span>Falhas isoladas: {supabaseDescriptor?.failureCount ?? 0}</span>
        </div>
      </div>
    </div>
  );
};
