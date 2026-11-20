import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { DiagnosticsMetricsResponse, LiveHealthSnapshot } from './ServerBackboneTopologyCard';

interface ServerGoldenSignalsCardProps {
  metrics: DiagnosticsMetricsResponse | null;
  liveHealth: LiveHealthSnapshot | null;
  loadingMetrics: boolean;
  onRefresh: () => void;
}

export const ServerGoldenSignalsCard: React.FC<ServerGoldenSignalsCardProps> = ({
  metrics,
  liveHealth,
  loadingMetrics,
  onRefresh,
}) => {
  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-base font-black text-white uppercase tracking-tight">
              Golden Signals HTTP &amp; Latência Real por Domínio
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono tabular-nums mt-0.5">
              <span>Total: {metrics?.summary.totalRequests ?? 0} reqs</span>
              <span aria-hidden="true">·</span>
              <span>p50: {metrics?.summary.p50Ms ?? 0}ms</span>
              <span aria-hidden="true">·</span>
              <span>p95: {metrics?.summary.p95Ms ?? 0}ms</span>
              <span aria-hidden="true">·</span>
              <span>p99: {metrics?.summary.p99Ms ?? 0}ms</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  (metrics?.summary.errors5xx || 0) > 0
                    ? 'text-rose-400 font-bold'
                    : 'text-slate-300'
                }
              >
                4xx: {metrics?.summary.errors4xx ?? 0} / 5xx: {metrics?.summary.errors5xx ?? 0}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">
            Mem: {liveHealth?.memoryUsage || '--'} · Driver:{' '}
            {liveHealth?.persistenceDriver || 'json-memory'}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loadingMetrics}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingMetrics ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Domain Breakdown */}
        <div className="overflow-x-auto">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Latência por Domínio API
          </h3>
          <table className="w-full text-left text-xs font-mono tabular-nums text-slate-300">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-3 py-2">Domínio</th>
                <th className="px-3 py-2 text-right">Reqs</th>
                <th className="px-3 py-2 text-right">p50</th>
                <th className="px-3 py-2 text-right">p95</th>
                <th className="px-3 py-2 text-right">Max</th>
                <th className="px-3 py-2 text-right">4xx/5xx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {(metrics?.domains || []).map((d) => (
                <tr key={d.domain} className="hover:bg-slate-800/30">
                  <td className="px-3 py-2 font-bold text-white">/{d.domain}</td>
                  <td className="px-3 py-2 text-right">{d.count}</td>
                  <td className="px-3 py-2 text-right text-emerald-400">{d.p50Ms}ms</td>
                  <td className="px-3 py-2 text-right text-amber-400">{d.p95Ms}ms</td>
                  <td className="px-3 py-2 text-right text-slate-400">{d.maxMs}ms</td>
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
              {(!metrics || metrics.domains.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500 font-sans">
                    Aguardando amostras HTTP no processo atual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Top Slowest Routes */}
        <div className="overflow-x-auto">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Rotas Mais Críticas (p95)
          </h3>
          <table className="w-full text-left text-xs font-mono tabular-nums text-slate-300">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-3 py-2">Rota</th>
                <th className="px-3 py-2 text-right">Reqs</th>
                <th className="px-3 py-2 text-right">p95</th>
                <th className="px-3 py-2 text-right">Último</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {(metrics?.topRoutes || []).slice(0, 8).map((r) => (
                <tr key={`${r.method}-${r.route}`} className="hover:bg-slate-800/30">
                  <td className="px-3 py-2 max-w-[260px] truncate">
                    <span className="text-amber-400 font-bold mr-1.5">{r.method}</span>
                    <span className="text-slate-200">{r.route}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{r.count}</td>
                  <td className="px-3 py-2 text-right text-amber-300">{r.p95Ms}ms</td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={
                        r.lastStatus >= 500
                          ? 'text-rose-400 font-bold'
                          : r.lastStatus >= 400
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }
                    >
                      {r.lastStatus}
                    </span>
                  </td>
                </tr>
              ))}
              {(!metrics || metrics.topRoutes.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500 font-sans">
                    Nenhuma rota registrada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
