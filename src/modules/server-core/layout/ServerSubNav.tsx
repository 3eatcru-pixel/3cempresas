import React from 'react';
import { Activity, Code, Cpu, Navigation, Radio, Package, HardDrive, ShieldAlert, Globe2 } from 'lucide-react';

export type ServerCoreTabId =
  | 'health'
  | 'console'
  | 'integrity'
  | 'releases'
  | 'sync'
  | 'engine'
  | 'sse'
  | 'gps-telemetry'
  | 'city-maps';

interface ServerSubNavProps {
  activeTab: ServerCoreTabId;
  onSelectTab: (tab: ServerCoreTabId) => void;
}

const TABS: { id: ServerCoreTabId; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'health', label: 'Saúde & Telemetria', icon: Activity },
  { id: 'console', label: 'Console REST API', icon: Code },
  { id: 'integrity', label: 'Integridade DB', icon: ShieldAlert },
  { id: 'releases', label: 'Releases & Frota', icon: Package },
  { id: 'sync', label: 'Sync, Edge & Backup', icon: HardDrive },
  { id: 'engine', label: 'Kernel & Billing', icon: Cpu },
  { id: 'sse', label: 'Event Stream (SSE)', icon: Radio },
  { id: 'gps-telemetry', label: 'Telemetria GPS', icon: Navigation },
  { id: 'city-maps', label: 'City Maps Data', icon: Globe2 },
];

export const ServerSubNav: React.FC<ServerSubNavProps> = ({ activeTab, onSelectTab }) => {
  return (
    <div className="flex items-center gap-2 p-1.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 overflow-x-auto no-scrollbar shadow-xl sticky top-20 z-10">
      {TABS.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`px-3.5 py-2.5 text-[11px] font-black rounded-xl transition-all flex items-center gap-2 whitespace-nowrap uppercase tracking-wider cursor-pointer ${
              isActive
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
