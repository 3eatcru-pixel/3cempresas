import React from 'react';
import { Radio, Unlock, WifiOff } from 'lucide-react';
import { DiagnosticsMetricsResponse } from './ServerBackboneTopologyCard';

interface ServerRateLimitAndSseGridProps {
  metrics: DiagnosticsMetricsResponse | null;
  onUnlockRateLimit: (limiter: string, ip?: string) => void;
  onDisconnectSse: (index: number) => void;
}

export const ServerRateLimitAndSseGrid: React.FC<ServerRateLimitAndSseGridProps> = ({
  metrics,
  onUnlockRateLimit,
  onDisconnectSse,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Unlock className="w-4 h-4 text-amber-400" />
            Rate Limiters &amp; Bloqueios (429)
          </h3>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {metrics?.rateLimits.length ?? 0} limitadores ativos
          </span>
        </div>

        <div className="space-y-2.5 text-xs">
          {(metrics?.rateLimits || []).map((rl) => (
            <div key={rl.name} className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-white">{rl.name}</span>
                  <span className="text-slate-500 font-mono ml-2 tabular-nums">
                    {rl.maxRequests} req/{Math.round(rl.windowMs / 1000)}s · {rl.trackedKeys} IPs rastreados
                  </span>
                </div>
                {rl.trackedKeys > 0 && (
                  <button
                    type="button"
                    onClick={() => onUnlockRateLimit(rl.name)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-[11px] cursor-pointer whitespace-nowrap"
                  >
                    Limpar Todos
                  </button>
                )}
              </div>

              {rl.blockedKeys.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-slate-900">
                  {rl.blockedKeys.map((blk) => (
                    <div
                      key={blk.ip}
                      className="flex items-center justify-between font-mono text-[11px] text-rose-300"
                    >
                      <span>
                        {blk.ip} · {blk.hits} reqs · expira em {blk.remainingSeconds}s
                      </span>
                      <button
                        type="button"
                        onClick={() => onUnlockRateLimit(rl.name, blk.ip)}
                        className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded cursor-pointer"
                      >
                        Desbloquear IP
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            Sessões SSE Conectadas ({metrics?.sseSessions.length ?? 0})
          </h3>
          <span className="text-xs font-mono text-slate-400">Canais isolados por tenant</span>
        </div>

        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-left text-xs font-mono text-slate-300">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">UID</th>
                <th className="px-3 py-2">Escopo Tenant</th>
                <th className="px-3 py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {(metrics?.sseSessions || []).map((sess) => (
                <tr key={`${sess.index}-${sess.uid}`} className="hover:bg-slate-800/30">
                  <td className="px-3 py-2 tabular-nums text-slate-500">{sess.index}</td>
                  <td className="px-3 py-2 text-white truncate max-w-[140px]">
                    {sess.uid}
                    {sess.isDev ? ' (DEV)' : ''}
                  </td>
                  <td className="px-3 py-2 text-amber-400">{sess.tenantId}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onDisconnectSse(sess.index)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-rose-600/80 text-slate-200 rounded-lg text-[11px] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <WifiOff className="w-3 h-3" />
                      Encerrar
                    </button>
                  </td>
                </tr>
              ))}
              {(!metrics || metrics.sseSessions.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500 font-sans">
                    Nenhuma sessão SSE registrada no inspetor.
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
