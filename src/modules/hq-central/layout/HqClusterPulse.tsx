import React from 'react';
import { Cpu, Zap, Activity, Database, Globe } from 'lucide-react';

interface HqClusterPulseProps {
  systemHealth?: {
    status?: string;
    cpuUsage?: string;
    memoryUsage?: string;
    activeConnections?: number;
    uptimeSeconds?: number;
    activeTenants?: number;
    totalOrdersProcessed?: number;
    persistenceDriver?: string;
    productionDatabaseReady?: boolean;
  };
}

export const HqClusterPulse: React.FC<HqClusterPulseProps> = ({ systemHealth }) => {
  const cpuText = systemHealth?.cpuUsage || '--';
  const cpuNumeric = Math.min(100, Math.max(0, parseFloat(cpuText) || 0));
  const memoryText = systemHealth?.memoryUsage || '--';
  const connections = systemHealth?.activeConnections ?? 0;
  const uptimeSeconds = systemHealth?.uptimeSeconds ?? 0;
  const uptimeMins = Math.floor(uptimeSeconds / 60);
  const persistenceLabel = systemHealth?.persistenceDriver || 'json-memory';
  const dbReady = Boolean(systemHealth?.productionDatabaseReady);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden relative group">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
        <Activity className="w-48 h-48 text-emerald-500 rotate-12" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
              <Zap className="w-5 h-5 fill-emerald-500" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Cluster Pulse</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                Telemetria Real (`/api/v1/health`) • Driver: {persistenceLabel} ({dbReady ? 'PROD DB' : 'LOCAL JSON'})
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Cpu className="w-3 h-3" />
                <span className="text-[9px] font-black uppercase tracking-wider">CPU Process</span>
              </div>
              <div className="flex items-end gap-1.5">
                <span className="text-xl font-black text-white font-mono">{cpuText}</span>
                <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1.5">
                  <div className="h-full bg-emerald-500" style={{ width: `${cpuNumeric}%` }} />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Database className="w-3 h-3" />
                <span className="text-[9px] font-black uppercase tracking-wider">RAM RSS</span>
              </div>
              <div className="flex items-end gap-1.5">
                <span className="text-xl font-black text-white font-mono">{memoryText}</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Globe className="w-3 h-3" />
                <span className="text-[9px] font-black uppercase tracking-wider">Conexões SSE</span>
              </div>
              <span className="text-xl font-black text-white font-mono block">{connections}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8 border-t md:border-t-0 md:border-l border-slate-800 pt-6 md:pt-0 md:pl-8">
          <div className="text-center space-y-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Tenants Ativos</span>
            <span className="text-2xl font-black text-amber-400 font-mono italic">
              {systemHealth?.activeTenants ?? 0}
            </span>
          </div>
          <div className="text-center space-y-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Uptime Instância</span>
            <span className="text-2xl font-black text-emerald-400 font-mono italic">
              {uptimeMins > 0 ? `${uptimeMins}m` : `${uptimeSeconds}s`}
            </span>
          </div>
          <div className="text-center space-y-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Pedidos DB</span>
            <span className="text-2xl font-black text-white font-mono italic">
              {systemHealth?.totalOrdersProcessed ?? 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
