import React from 'react';
import { Radio } from 'lucide-react';

interface ServerGpsTelemetryHeaderProps {
  onManualPing: () => void;
  pingCount: number;
}

export const ServerGpsTelemetryHeader: React.FC<ServerGpsTelemetryHeaderProps> = ({
  onManualPing,
  pingCount,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400">
          <Radio className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-black text-white uppercase tracking-tight italic">
            Telemetria GPS &amp; Rastreamento de Frotas <span className="text-emerald-400">DEV CORE</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            Snapshots GPS persistidos por entregador ({pingCount} registros)
          </p>
        </div>
      </div>

      <button
        onClick={onManualPing}
        className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
      >
        <Radio className="w-4 h-4" /> Emitir Ping GPS de Teste
      </button>
    </div>
  );
};
