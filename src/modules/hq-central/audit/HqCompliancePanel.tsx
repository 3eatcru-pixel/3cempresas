import React from 'react';
import { ShieldCheck, CheckCircle2, AlertCircle, Terminal, Cpu } from 'lucide-react';
import { STATUS_COLORS, PILLAR_THEMES, getStatusColorToken } from '@3c/design-system';

interface ComplianceItem {
  id: string;
  title: string;
  action: string;
  status: string;
}

interface HqCompliancePanelProps {
  compliance?: {
    lastAuditDate?: string;
    homologationPassed?: boolean;
    p0Resolutions?: ComplianceItem[];
    p1Resolutions?: ComplianceItem[];
  } | null;
  systemHealth?: {
    persistenceMode?: string;
    persistenceDriver?: string;
    environmentMode?: string;
    cloudProbeVerified?: boolean;
    productionDatabaseReady?: boolean;
  } | null;
}

export const HqCompliancePanel: React.FC<HqCompliancePanelProps> = ({ compliance, systemHealth }) => {
  const isCloudReady = Boolean(systemHealth?.productionDatabaseReady && systemHealth?.cloudProbeVerified);
  const isHomologated = Boolean(isCloudReady && compliance?.homologationPassed);
  const cloudBannerToken = isCloudReady ? STATUS_COLORS.SUCCESS : STATUS_COLORS.WARNING;
  const badgeToken = isCloudReady ? STATUS_COLORS.SUCCESS : STATUS_COLORS.DANGER;
  const homologToken = isHomologated ? STATUS_COLORS.SUCCESS : STATUS_COLORS.WARNING;
  const coreTheme = PILLAR_THEMES['server-core'];

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500 rounded-lg text-slate-950">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white italic tracking-tighter uppercase">
              Governança de Segurança & Controles P0/P1
            </h2>
            <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest">
              Baseline v5.2.1 • Auditoria Arquitetural por Pilar
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-400 font-mono">Status de Prontidão</div>
          <div className={`text-xs font-bold font-mono tabular-nums ${homologToken.textClass}`}>
            {isHomologated ? (compliance?.lastAuditDate || 'HOMOLOGADO') : 'NÃO HOMOLOGADO (VERIFICAÇÃO PENDENTE)'}
          </div>
        </div>
      </div>

      <div className="px-6 pt-5">
        <div className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${cloudBannerToken.bgClass} ${cloudBannerToken.borderClass}`}>
          <div>
            <div className={`text-[11px] font-black uppercase tracking-wider ${cloudBannerToken.textClass}`}>
              Telemetria Real de Persistência ({systemHealth?.persistenceMode || 'UNKNOWN'})
            </div>
            <div className="text-[11px] text-slate-300 font-mono mt-0.5">
              Driver: {systemHealth?.persistenceDriver || 'unknown'} • Env: {systemHealth?.environmentMode || 'development'} • Probe Cloud: {systemHealth?.cloudProbeVerified ? 'VERIFICADO' : 'NÃO VERIFICADO'}
            </div>
          </div>
          <span className={`px-3 py-1 rounded-lg text-[10px] font-black font-mono uppercase ${badgeToken.badgeClass}`}>
            {isCloudReady ? 'CLOUD PRIMARY READY' : 'SANDBOX / NÃO PRONTO PARA PRODUÇÃO'}
          </span>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Cpu className={`w-4 h-4 ${STATUS_COLORS.SUCCESS.textClass}`} /> Bloqueadores Críticos (P0)
          </h3>
          <div className="space-y-3">
            {compliance?.p0Resolutions?.map(res => {
              const token = getStatusColorToken(res.status);
              return (
                <div key={res.id} className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 flex items-start gap-3">
                  <div className="mt-0.5">
                    {res.status === 'RESOLVED' ? (
                      <CheckCircle2 className={`w-4 h-4 ${STATUS_COLORS.SUCCESS.textClass}`} />
                    ) : (
                      <AlertCircle className={`w-4 h-4 ${STATUS_COLORS.WARNING.textClass}`} />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-500 font-mono">{res.id}</span>
                      <span className="text-xs font-bold text-white uppercase tracking-tight">{res.title}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${token.badgeClass}`}>
                        {res.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">{res.action}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Terminal className={`w-4 h-4 ${coreTheme.accentTextClass}`} /> Endurecimento Operacional (P1)
          </h3>
          <div className="space-y-3">
            {compliance?.p1Resolutions?.map(res => {
              const token = res.status === 'RESOLVED' ? STATUS_COLORS.INFO : STATUS_COLORS.WARNING;
              return (
                <div key={res.id} className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 flex items-start gap-3">
                  <div className="mt-0.5">
                    {res.status === 'RESOLVED' ? (
                      <CheckCircle2 className={`w-4 h-4 ${coreTheme.accentTextClass}`} />
                    ) : (
                      <AlertCircle className={`w-4 h-4 ${STATUS_COLORS.WARNING.textClass}`} />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-500 font-mono">{res.id}</span>
                      <span className="text-xs font-bold text-white uppercase tracking-tight">{res.title}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${token.badgeClass}`}>
                        {res.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">{res.action}</p>
                  </div>
                </div>
              );
            })}
            <div className={`p-4 border rounded-xl mt-4 ${homologToken.bgClass} ${homologToken.borderClass}`}>
              <div className={`text-[11px] font-black uppercase mb-1 ${homologToken.textClass}`}>
                {isHomologated
                  ? 'Homologação Cloud & Controles Verificados'
                  : 'Homologação Pendente — Não Aprovado para Produção sem CI & Cloud Probe'}
              </div>
              <div className="text-sm font-black text-white font-mono tabular-nums tracking-tight">
                {(compliance?.p0Resolutions?.length || 0) + (compliance?.p1Resolutions?.length || 0)} CONTROLES RASTREADOS
              </div>
              <div className={`text-[9px] font-mono uppercase tracking-wider mt-0.5 ${homologToken.textClass} opacity-80`}>
                Requer Cloud Primary Probe (/api/v1/health) e suítes tests/security + tests/cross-platform
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
