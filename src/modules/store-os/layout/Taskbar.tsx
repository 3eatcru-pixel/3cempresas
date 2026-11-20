import React from 'react';
import { Sparkles, Bell, Wifi, WifiOff, Monitor } from 'lucide-react';
import { BrandMark } from '../../../components/common/BrandLogo';
import type { LocalTerminalInfo } from '../../../core/platform/PlatformAdapter';

interface WindowState {
  id: string;
  title: string;
  isMinimized: boolean;
  zIndex: number;
}

interface TaskbarProps {
  onStartClick: () => void;
  kdsPreparationOrdersCount: number;
  lowStockItemsExist: boolean;
  openWindows: WindowState[];
  activeWindowId: string | null;
  onWindowClick: (id: any) => void;
  onNotificationsClick: () => void;
  onQuickSettingsClick: () => void;
  notificationsCount: number;
  currentTime: string;
  currentDate: string;
  localTerminal?: LocalTerminalInfo;
  activeTransport?: 'CLOUD' | 'EDGE_LAN' | 'OFFLINE';
}

export const Taskbar: React.FC<TaskbarProps> = ({
  onStartClick,
  kdsPreparationOrdersCount,
  lowStockItemsExist,
  openWindows,
  activeWindowId,
  onWindowClick,
  onNotificationsClick,
  onQuickSettingsClick,
  notificationsCount,
  currentTime,
  currentDate,
  localTerminal,
  activeTransport = 'CLOUD',
}) => {
  return (
    <div className="h-14 bg-slate-950/80 backdrop-blur-2xl border-t border-slate-800 flex items-center justify-between px-4 z-50">
      <div className="flex items-center gap-3">
        <button 
          onClick={onStartClick}
          className="px-2.5 py-2 bg-gradient-to-tr from-amber-500 to-orange-400 hover:brightness-110 rounded-2xl text-slate-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          title="Menu Iniciar Store OS"
        >
          <BrandMark id="store-os" size="sm" tone="plain" className="text-slate-950" />
        </button>
        <div className="h-8 w-px bg-slate-800" />
        
        {/* AI Contextual Pill */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-amber-500/20 shadow-lg animate-pulse hover:animate-none transition-all cursor-help" title="IA Sugestão Contextual">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter italic">
            {kdsPreparationOrdersCount > 0 
              ? `${kdsPreparationOrdersCount} PEDIDOS PENDENTES: ABRIR KDS?` 
              : (lowStockItemsExist ? 'ESTOQUE BAIXO: REPOR?' : 'SISTEMA OTIMIZADO')}
          </span>
        </div>

        {/* TASKBAR WINDOW TABS */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[40vw]">
          {openWindows.map(win => (
            <button
              key={win.id}
              onClick={() => onWindowClick(win.id)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-2 whitespace-nowrap shadow-md ${
                activeWindowId === win.id 
                  ? 'bg-amber-500 text-slate-950 font-black shadow-amber-500/20' 
                  : 'bg-slate-900/90 text-slate-400 border border-slate-800 hover:text-white hover:bg-slate-800'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${win.isMinimized ? 'bg-slate-500' : 'bg-emerald-400'}`} />
              {win.title}
            </button>
          ))}
        </div>
      </div>

      {/* SYSTEM TRAY */}
      <div className="flex items-center gap-2 sm:gap-3">
        {localTerminal?.isLocalTerminal && (
          <button
            type="button"
            onClick={onQuickSettingsClick}
            title={localTerminal.detailLabel}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-xl border border-cyan-500/30 text-cyan-300 transition-all font-mono text-[10px] font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
          >
            <Monitor className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{localTerminal.label}</span>
          </button>
        )}

        <button
          onClick={onNotificationsClick}
          className="p-2 text-slate-400 hover:text-white transition-colors relative"
          title="Notificações"
        >
          <Bell className="w-4 h-4" />
          {notificationsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-slate-950" />
          )}
        </button>

        <button
          onClick={onQuickSettingsClick}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 rounded-xl border border-slate-800 text-slate-300 transition-all font-mono text-[10px] cursor-pointer"
        >
          {activeTransport === 'OFFLINE' ? (
            <WifiOff className="w-3.5 h-3.5 text-rose-400" />
          ) : (
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span className="hidden sm:inline">
            {activeTransport === 'EDGE_LAN'
              ? 'EDGE LAN'
              : activeTransport === 'OFFLINE'
              ? 'OFFLINE'
              : 'ONLINE'}
          </span>
        </button>

        <div className="flex flex-col items-end font-mono text-[11px] text-white font-bold leading-tight">
          <span>{currentTime || '12:00:00'}</span>
          <span className="text-[9px] text-slate-400 font-normal">{currentDate || 'Brasil'}</span>
        </div>
      </div>
    </div>
  );
};
