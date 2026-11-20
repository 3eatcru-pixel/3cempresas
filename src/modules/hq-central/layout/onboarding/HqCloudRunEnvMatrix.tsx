import React from 'react';
import { Check, Copy, RefreshCw, ShieldCheck } from 'lucide-react';
import { EnvReadinessPayload, EnvReadinessVariable } from './hqDevOnboardingConstants';

interface HqCloudRunEnvMatrixProps {
  envReadiness: EnvReadinessPayload | null;
  displayedVars: EnvReadinessVariable[];
  isDevOwner: boolean;
  envLoading: boolean;
  envError: string | null;
  effectiveProbeError: string | null;
  copiedNotice: string | null;
  onReloadEnvReadiness: () => void;
  onCopyEnvTemplate: () => void;
}

export const HqCloudRunEnvMatrix: React.FC<HqCloudRunEnvMatrixProps> = ({
  envReadiness,
  displayedVars,
  isDevOwner,
  envLoading,
  envError,
  effectiveProbeError,
  copiedNotice,
  onReloadEnvReadiness,
  onCopyEnvTemplate,
}) => {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-0.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300 block">
            Diagnóstico Live · Variáveis Cloud Run / Server Core / Cloud SQL
          </span>
          <span className="text-[10px] font-mono text-slate-400 block">
            Serviço: {envReadiness?.serviceName || 'local'} · Driver DB:{' '}
            {envReadiness?.dbConnectionMode || 'missing'}
            {envReadiness?.sqlDbName ? ` · SQL_DB_NAME=${envReadiness.sqlDbName}` : ''}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isDevOwner && (
            <button
              type="button"
              onClick={onReloadEnvReadiness}
              disabled={envLoading}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${envLoading ? 'animate-spin' : ''}`} />
              <span>{envLoading ? 'Verificando...' : 'Revalidar Servidor'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onCopyEnvTemplate}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 text-[10px] font-bold text-indigo-200 inline-flex items-center gap-1.5 cursor-pointer"
          >
            {copiedNotice ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>Copiar Template Cloud Run (.env)</span>
          </button>
        </div>
      </div>

      {copiedNotice && (
        <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300">
          {copiedNotice}
        </div>
      )}

      {envError && (
        <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300">
          {envError}
        </div>
      )}

      {effectiveProbeError && (
        <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 font-mono">
          Sonda Cloud SQL/PostgreSQL: {effectiveProbeError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {displayedVars.map((v) => (
          <div
            key={v.key}
            className={`p-2.5 rounded-lg border space-y-1 ${
              v.configured
                ? 'bg-emerald-500/5 border-emerald-500/25'
                : v.requiredInProduction
                ? 'bg-slate-900/90 border-amber-500/30'
                : 'bg-slate-900/70 border-slate-800/80'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <code className="text-[11px] font-mono font-bold text-white truncate">{v.key}</code>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase shrink-0 border ${
                  v.configured
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : v.requiredInProduction
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {v.configured ? 'Configurado' : v.requiredInProduction ? 'Pendente' : 'Opcional'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-300">
                {v.scope}
              </span>
              {v.requiredInProduction && !v.configured && (
                <span className="text-[9px] font-mono text-amber-300">Obrigatório em produção</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">{v.note}</p>
          </div>
        ))}
      </div>

      <div className="px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-slate-300 leading-relaxed">
          <strong className="text-white">IAM do Cloud Run (app-3ccorp):</strong> mantenha{' '}
          <code className="px-1 py-0.5 rounded bg-slate-950 text-cyan-300 font-mono text-[10px]">
            invoker-iam-disabled: true
          </code>{' '}
          (ou papel{' '}
          <code className="px-1 py-0.5 rounded bg-slate-950 text-cyan-300 font-mono text-[10px]">
            roles/run.invoker
          </code>{' '}
          para{' '}
          <code className="px-1 py-0.5 rounded bg-slate-950 text-cyan-300 font-mono text-[10px]">
            allUsers
          </code>
          ) para acesso público ao Marketplace/Portal. A autorização interna continua protegida por JWT + RBAC do Server Core.
        </div>
      </div>
    </div>
  );
};
