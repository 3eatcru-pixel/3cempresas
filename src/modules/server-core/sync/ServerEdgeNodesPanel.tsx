import React from 'react';
import { Laptop, FileCheck2 } from 'lucide-react';

interface ServerEdgeNodesPanelProps {
  edgeNodes: any[];
  outboxItems: any[];
}

function formatHeartbeatAge(isoDate?: string): { label: string; isStale: boolean } {
  if (!isoDate) return { label: 'Sem heartbeat', isStale: true };
  const ts = Date.parse(isoDate);
  if (!Number.isFinite(ts)) return { label: '--', isStale: false };
  const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (diffMin < 1) return { label: 'Agora', isStale: false };
  if (diffMin < 60) return { label: `há ${diffMin}m`, isStale: diffMin > 15 };
  return { label: `há ${Math.round(diffMin / 60)}h`, isStale: true };
}

export const ServerEdgeNodesPanel: React.FC<ServerEdgeNodesPanelProps> = ({
  edgeNodes,
  outboxItems,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Laptop className="w-4 h-4 text-cyan-400" />
          Edge Nodes Ativos (/api/v1/sync/edge/nodes)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono text-slate-300">
            <thead className="bg-slate-950 text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2">Node ID</th>
                <th className="px-3 py-2">Store</th>
                <th className="px-3 py-2">Host / LAN</th>
                <th className="px-3 py-2">Lag / Fila</th>
                <th className="px-3 py-2">Versão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {edgeNodes.map((n) => {
                const hb = formatHeartbeatAge(n.lastHeartbeatAt);
                const isRevoked = n.status === 'REVOKED';
                return (
                  <tr key={n.nodeId || n.id} className="hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-amber-400 font-bold">{n.nodeId || n.id}</td>
                    <td className="px-3 py-2 text-white">{n.storeId}</td>
                    <td className="px-3 py-2 text-slate-400 tabular-nums">
                      {n.lanIp || n.hostname || '--'}:{n.port || 3300}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      <span
                        className={
                          isRevoked
                            ? 'text-rose-400 font-bold'
                            : hb.isStale
                            ? 'text-amber-400 font-bold'
                            : 'text-emerald-400'
                        }
                      >
                        {isRevoked ? 'REVOKED' : hb.label}
                      </span>
                      <span className="text-slate-500 ml-1.5">({n.pendingOutboxCount || 0} pend.)</span>
                    </td>
                    <td className="px-3 py-2 text-emerald-400 tabular-nums">v{n.appVersion || '5.2.1'}</td>
                  </tr>
                );
              })}
              {edgeNodes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500 italic">
                    Nenhum Edge Node pareado no momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-emerald-400" />
          Sync Outbox Delta (/api/v1/sync/pull)
        </h3>
        <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 max-h-60 overflow-y-auto space-y-2 font-mono text-[11px]">
          {outboxItems.map((item, idx) => (
            <div key={item.id || idx} className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
              <div className="truncate">
                <span className="text-amber-400 font-bold">[{item.entity}]</span>{' '}
                <span className="text-slate-200">{item.entityId}</span>{' '}
                <span className="text-slate-500">({item.operation})</span>
              </div>
              <span className="text-[10px] text-emerald-400 tabular-nums shrink-0">{item.hlc}</span>
            </div>
          ))}
          {outboxItems.length === 0 && (
            <div className="py-8 text-center text-slate-500 italic">
              Sem mutações recentes no Outbox.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
