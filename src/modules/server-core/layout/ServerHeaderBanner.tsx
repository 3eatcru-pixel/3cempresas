import React from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { BrandMark } from '../../../components/common/BrandLogo';

interface ServerHeaderBannerProps {
  uptime: string;
  persistenceDriver?: string;
  status?: string;
  isLoading: boolean;
  onExecute: () => void;
}

export const ServerHeaderBanner: React.FC<ServerHeaderBannerProps> = ({
  uptime,
  persistenceDriver = 'json-memory',
  status = 'ONLINE',
  isLoading,
  onExecute,
}) => {
  return (
    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <BrandMark id="server-core" size="md" />
          <div>
            <h1 className="text-xl font-black text-white tracking-tight uppercase italic">
              Backbone • Server <span className="text-cyan-400">Core v5.2.2</span>
            </h1>
            <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">
              Conecta HQ (Governança) · Store OS · Marketplace · Driver &amp; Waiter · Driver: {persistenceDriver}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Server Uptime</span>
          <span className="text-sm font-mono tabular-nums font-black text-emerald-400">{uptime}</span>
        </div>
        <div className="h-10 w-px bg-slate-800 hidden md:block" />
        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold">
            Core: {status}
          </span>
          <button
            onClick={onExecute}
            disabled={isLoading}
            className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-2xl shadow-xl transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            EXECUTAR NO CONSOLE
          </button>
        </div>
      </div>
    </div>
  );
};
