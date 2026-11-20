import React from 'react';
import { Code, History } from 'lucide-react';
import { RestEndpointSpec } from '../../../types';
import { HttpMethodOption } from '../ServerConsoleTab';

export interface ConsoleHistoryEntry {
  id: string;
  method: HttpMethodOption;
  path: string;
  status: string;
  latencyMs: number;
  executedAt: string;
}

interface ServerRoutesSidebarProps {
  restEndpoints: RestEndpointSpec[];
  selectedEndpoint: string;
  selectedMethod: HttpMethodOption;
  history: ConsoleHistoryEntry[];
  onSelectEndpoint: (path: string, method?: HttpMethodOption) => void;
  onResetConfirmDestructive: () => void;
}

export const ServerRoutesSidebar: React.FC<ServerRoutesSidebarProps> = ({
  restEndpoints,
  selectedEndpoint,
  selectedMethod,
  history,
  onSelectEndpoint,
  onResetConfirmDestructive,
}) => {
  return (
    <div className="lg:col-span-4 space-y-6">
      <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h2 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
            <Code className="w-4 h-4 text-amber-400" /> Rotas Server Core v5.2.1
          </h2>
          <span className="text-[10px] font-mono tabular-nums text-slate-500 font-bold">
            {restEndpoints.length} Rotas
          </span>
        </div>

        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {restEndpoints.map((ep) => {
            const isSelected = selectedEndpoint === ep.path && selectedMethod === ep.method;
            const methodBg =
              ep.method === 'GET'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : ep.method === 'POST'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : ep.method === 'DELETE'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/20';

            return (
              <div
                key={`${ep.method}-${ep.path}`}
                onClick={() => {
                  onResetConfirmDestructive();
                  onSelectEndpoint(ep.path, ep.method as HttpMethodOption);
                }}
                className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-1 ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/60'
                    : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-950 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${methodBg}`}>
                    {ep.method}
                  </span>
                  <span className="text-[10px] font-mono tabular-nums text-slate-500">~{ep.latencyMs}ms</span>
                </div>
                <div className="font-mono text-xs text-white font-bold truncate">{ep.path}</div>
                <div className="text-[10px] text-slate-400 line-clamp-1">{ep.description}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Session Execution History */}
      <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" /> Histórico da Sessão
          </h3>
          <span className="text-[10px] font-mono text-slate-500 tabular-nums">{history.length}</span>
        </div>
        <div className="space-y-1.5 max-h-44 overflow-y-auto">
          {history.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onSelectEndpoint(h.path, h.method)}
              className="w-full text-left p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 font-mono text-[11px] flex items-center justify-between gap-2 cursor-pointer"
            >
              <span className="truncate text-slate-200">
                <span className="text-amber-400 font-bold mr-1.5">{h.method}</span>
                {h.path}
              </span>
              <span className="text-slate-500 shrink-0 tabular-nums">{h.executedAt}</span>
            </button>
          ))}
          {history.length === 0 && (
            <div className="text-[11px] text-slate-500 py-3 text-center">
              Nenhuma chamada executada nesta sessão.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
