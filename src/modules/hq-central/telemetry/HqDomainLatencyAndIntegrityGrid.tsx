import React from 'react';
import { Activity, CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';
import { InspectorResponse, IntegrityReportResponse } from './telemetryTableUtils';

interface HqDomainLatencyAndIntegrityGridProps {
  telemetry: InspectorResponse['telemetrySummary'] | undefined;
  isDevOwner: boolean;
  integrityReport: IntegrityReportResponse | null;
  loadingIntegrity: boolean;
  onRunIntegrityScan: () => void;
}

export const HqDomainLatencyAndIntegrityGrid: React.FC<HqDomainLatencyAndIntegrityGridProps> = ({
  telemetry,
  isDevOwner,
  integrityReport,
  loadingIntegrity,
  onRunIntegrityScan,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Domain Telemetry Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Telemetria de Latência por Domínio API
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            {(telemetry?.domains || []).length} domínios monitorados
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono tabular-nums text-slate-300">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-3 py-2">Domínio</th>
                <th className="px-3 py-2 text-right">Chamadas</th>
                <th className="px-3 py-2 text-right">p50</th>
                <th className="px-3 py-2 text-right">p95</th>
                <th className="px-3 py-2 text-right">4xx/5xx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {(telemetry?.domains || []).map((d) => (
                <tr key={d.domain} className="hover:bg-slate-800/30">
                  <td className="px-3 py-2 font-bold text-white">/{d.domain}</td>
                  <td className="px-3 py-2 text-right">{d.count}</td>
                  <td className="px-3 py-2 text-right text-emerald-400">{d.p50Ms}ms</td>
                  <td className="px-3 py-2 text-right text-amber-400">{d.p95Ms}ms</td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={
                        d.err5xx > 0
                          ? 'text-rose-400 font-bold'
                          : d.err4xx > 0
                          ? 'text-amber-400'
                          : 'text-slate-500'
                      }
                    >
                      {d.err4xx}/{d.err5xx}
                    </span>
                  </td>
                </tr>
              ))}
              {(!telemetry || telemetry.domains.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500 font-sans">
                    Aguardando tráfego HTTP nas rotas da API.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Referential Integrity Scanner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Auditoria Determinística de Integridade (FKs &amp; Saldos)
            </h3>
            <p className="text-[11px] text-slate-400">
              Verifica referências órfãs entre tenants, lojas, usuários, lotes e fila DLQ
            </p>
          </div>
          {isDevOwner && (
            <button
              type="button"
              onClick={onRunIntegrityScan}
              disabled={loadingIntegrity}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingIntegrity ? 'animate-spin' : ''}`} />
              Varredura
            </button>
          )}
        </div>

        {integrityReport ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 font-mono text-xs tabular-nums">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Críticas</span>
                <span
                  className={`text-lg font-black ${
                    integrityReport.criticalCount > 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {integrityReport.criticalCount}
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Avisos</span>
                <span
                  className={`text-lg font-black ${
                    integrityReport.warningCount > 0 ? 'text-amber-400' : 'text-slate-200'
                  }`}
                >
                  {integrityReport.warningCount}
                </span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Informativos</span>
                <span className="text-lg font-black text-cyan-400">
                  {integrityReport.infoCount}
                </span>
              </div>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {integrityReport.anomalies.length === 0 ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  100% íntegro — Nenhuma referência órfã ou saldo negativo detectado nas tabelas.
                </div>
              ) : (
                integrityReport.anomalies.slice(0, 8).map((anom) => (
                  <div
                    key={anom.id}
                    className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs flex items-start justify-between gap-2"
                  >
                    <div>
                      <span
                        className={`font-mono font-bold mr-2 ${
                          anom.severity === 'CRITICAL'
                            ? 'text-rose-400'
                            : anom.severity === 'WARNING'
                            ? 'text-amber-400'
                            : 'text-cyan-400'
                        }`}
                      >
                        [{anom.severity}]
                      </span>
                      <span className="font-mono text-slate-400 mr-1.5">
                        tbl.{anom.collection}:
                      </span>
                      <span className="text-slate-200">{anom.message}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-950 rounded-xl border border-slate-800">
            {isDevOwner
              ? 'Clique em "Varredura" para auditar a integridade referencial de todas as tabelas.'
              : 'Varredura profunda de integridade disponível para o perfil Master DEV_OWNER.'}
          </div>
        )}
      </div>
    </div>
  );
};
