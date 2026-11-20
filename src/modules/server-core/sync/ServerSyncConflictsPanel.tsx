import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, XCircle } from 'lucide-react';

export interface SyncConflictItem {
  id: string;
  status: 'OPEN' | 'RESOLVED' | 'DISCARDED';
  kind: 'CONFLICT' | 'REJECTED';
  reason: string;
  nodeId: string;
  tenantId: string;
  storeId: string | null;
  actorUid: string | null;
  entity: string;
  entityId: string;
  idempotencyKey: string | null;
  incomingHlc: string;
  clientPayload: Record<string, any> | null;
  serverRecord: Record<string, any> | null;
  detectedAt: string;
  resolvedAt?: string;
  resolvedByEmail?: string | null;
  resolutionNote?: string;
}

interface ServerSyncConflictsPanelProps {
  conflicts: SyncConflictItem[];
  totalOpen: number;
  statusFilter: 'OPEN' | 'RESOLVED' | 'DISCARDED' | 'ALL';
  onChangeStatusFilter: (status: 'OPEN' | 'RESOLVED' | 'DISCARDED' | 'ALL') => void;
  resolvingId: string | null;
  onResolveConflict: (id: string, action: 'RESOLVED' | 'DISCARDED') => Promise<void>;
}

export const ServerSyncConflictsPanel: React.FC<ServerSyncConflictsPanelProps> = ({
  conflicts,
  totalOpen,
  statusFilter,
  onChangeStatusFilter,
  resolvingId,
  onResolveConflict,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className={`w-4 h-4 ${totalOpen > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
            Fila DLQ de Conflitos &amp; Rejeições Edge (/api/v1/admin/diagnostics/sync-conflicts)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Inspeção determinística de mutações rejeitadas ou em conflito HLC durante o push dos nós locais.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono tabular-nums text-slate-400 mr-1">
            {totalOpen} aberta(s)
          </span>
          <select
            aria-label="Filtrar conflitos Edge"
            value={statusFilter}
            onChange={(e) => onChangeStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 cursor-pointer"
          >
            <option value="OPEN">OPEN</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="DISCARDED">DISCARDED</option>
            <option value="ALL">TODOS</option>
          </select>
        </div>
      </div>

      {conflicts.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500 font-mono">
          Nenhum conflito ou rejeição Edge registrado para o filtro &quot;{statusFilter}&quot;.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-96 overflow-y-auto">
          {conflicts.map((item) => {
            const isExpanded = expandedId === item.id;
            const isResolving = resolvingId === item.id;
            return (
              <div
                key={item.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 font-mono text-xs"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-bold ${
                          item.kind === 'CONFLICT' ? 'text-amber-400' : 'text-rose-400'
                        }`}
                      >
                        [{item.kind}] {item.reason}
                      </span>
                      <span className="text-white font-bold">
                        {item.entity}/{item.entityId}
                      </span>
                      <span className="text-slate-500">
                        • node={item.nodeId} • store={item.storeId || '--'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 tabular-nums">
                      HLC: {item.incomingHlc} • Detectado em {new Date(item.detectedAt).toLocaleString('pt-BR')}
                      {item.resolvedAt ? ` • ${item.status} por ${item.resolvedByEmail || 'DEV'}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      Diff JSON
                    </button>
                    {item.status === 'OPEN' && (
                      <>
                        <button
                          type="button"
                          disabled={isResolving}
                          onClick={() => onResolveConflict(item.id, 'RESOLVED')}
                          className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Resolver
                        </button>
                        <button
                          type="button"
                          disabled={isResolving}
                          onClick={() => onResolveConflict(item.id, 'DISCARDED')}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-3 h-3" /> Descartar
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-[11px]">
                    <div className="space-y-1">
                      <div className="text-amber-400 font-bold">Payload Recebido (Edge / Client)</div>
                      <pre className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 overflow-x-auto max-h-40 text-slate-300">
                        {JSON.stringify(item.clientPayload ?? { empty: true }, null, 2)}
                      </pre>
                    </div>
                    <div className="space-y-1">
                      <div className="text-cyan-400 font-bold">Registro Autoritativo (Cloud Core)</div>
                      <pre className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 overflow-x-auto max-h-40 text-slate-300">
                        {JSON.stringify(item.serverRecord ?? { unavailable: true }, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
