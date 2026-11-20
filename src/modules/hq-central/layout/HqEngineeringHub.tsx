import React from 'react';
import { Terminal, Database, HardDrive, Layers } from 'lucide-react';

interface HqEngineeringHubProps {
  eventLogs?: any[];
  systemHealth?: {
    status?: string;
    persistenceDriver?: string;
    productionDatabaseReady?: boolean;
  };
}

export const HqEngineeringHub: React.FC<HqEngineeringHubProps> = ({
  eventLogs = [],
  systemHealth,
}) => {
  const recentLogs = eventLogs.slice(0, 12);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Event Stream Terminal */}
      <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[400px]">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest italic">
              Event Stream Real (DB / SSE)
            </span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-slate-800" />
            <div className="w-2 h-2 rounded-full bg-slate-800" />
            <div className="w-2 h-2 rounded-full bg-slate-800" />
          </div>
        </div>
        <div className="flex-1 p-4 font-mono text-[10px] space-y-2 overflow-y-auto custom-scrollbar">
          {recentLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 italic">
              Nenhum evento registrado na fila do servidor até o momento.
            </div>
          ) : (
            recentLogs.map((log, idx) => (
              <div key={log.id || idx} className="flex gap-4 animate-fadeIn border-b border-slate-900/50 pb-1.5 last:border-0">
                <span className="text-slate-600 shrink-0">[{log.timeStr || '--:--:--'}]</span>
                <span className="font-bold shrink-0 w-32 truncate text-amber-400">{log.type || 'SYSTEM'}</span>
                <span className="text-slate-300 flex-1 truncate">{log.payload}</span>
                <span className="font-black shrink-0 text-slate-500">{log.channel || 'core'}</span>
              </div>
            ))
          )}
        </div>
        <div className="p-3 bg-slate-900/30 border-t border-slate-800 flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter">
              {systemHealth?.status || 'PROBING'}
            </span>
          </div>
          <span className="text-[9px] text-slate-500 font-medium">
            Server Core Express (Driver: {systemHealth?.persistenceDriver || 'json-memory'})
          </span>
        </div>
      </div>

      {/* Cluster Nodes & Topology */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <Layers className="w-5 h-5 text-amber-500" />
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-widest">Topologia do Nó</h4>
            <p className="text-[9px] text-slate-500 font-bold">Server Core & Persistência Atual</p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            {
              label: 'Server Core Node (Port 3000)',
              status: systemHealth?.status === 'ONLINE_HEALTHY' ? 'ACTIVE' : 'PROBING',
              health: systemHealth?.status === 'ONLINE_HEALTHY' ? 100 : 50,
              icon: HardDrive,
              color: 'text-emerald-500',
            },
            {
              label: `Storage (${systemHealth?.persistenceDriver || 'json-memory'})`,
              status: systemHealth?.productionDatabaseReady ? 'PROD_DB' : 'LOCAL_JSON',
              health: systemHealth?.productionDatabaseReady ? 100 : 75,
              icon: Database,
              color: 'text-amber-500',
            },
          ].map(node => (
            <div key={node.label} className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-2xl flex items-center gap-3 group hover:border-amber-500/20 transition-all">
              <div className={`p-2 rounded-xl bg-slate-900 border border-slate-800 ${node.color}`}>
                <node.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white truncate uppercase tracking-tight">{node.label}</span>
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${
                    node.status === 'ACTIVE' || node.status === 'PROD_DB'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}>{node.status}</span>
                </div>
                <div className="mt-1.5 w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                  <div className={`h-full ${node.color.replace('text-', 'bg-')}`} style={{ width: `${node.health}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 text-center">
          <span className="text-[10px] text-slate-500 font-medium">
            Telemetria técnica detalhada e orquestração de banco gerenciadas no Server Core.
          </span>
        </div>
      </div>
    </div>
  );
};
