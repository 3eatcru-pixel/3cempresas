import React from 'react';
import { Wifi, WifiOff, RefreshCw, Settings, CreditCard, X, Monitor, Palette } from 'lucide-react';
import {
  STATUS_COLORS,
  TRANSPORT_COLORS,
  STORE_OS_WALLPAPERS,
  StoreOsWallpaperId,
} from '@3c/design-system';
import { LocalTerminalInfo } from '../../../core/platform/PlatformAdapter';
import { SyncTransport } from '../../../hooks/useSyncStatus';
import { WindowAppId } from './storeOsAppsList';

interface StoreOsQuickSettingsPopoverProps {
  activeTransport: SyncTransport;
  totalPendingCount: number;
  localTerminal: LocalTerminalInfo;
  isSyncingQuick: boolean;
  desktopTheme: StoreOsWallpaperId;
  onChangeTheme: (theme: StoreOsWallpaperId) => void;
  onSyncNow: () => Promise<void>;
  onOpenApp: (appId: WindowAppId, title: string) => void;
  onClose: () => void;
}

export const StoreOsQuickSettingsPopover: React.FC<StoreOsQuickSettingsPopoverProps> = ({
  activeTransport,
  totalPendingCount,
  localTerminal,
  isSyncingQuick,
  desktopTheme,
  onChangeTheme,
  onSyncNow,
  onOpenApp,
  onClose,
}) => {
  const transportToken = TRANSPORT_COLORS[activeTransport] || TRANSPORT_COLORS.CLOUD;
  const pendingToken = totalPendingCount > 0 ? STATUS_COLORS.WARNING : STATUS_COLORS.SUCCESS;
  const wallpapers = Object.values(STORE_OS_WALLPAPERS);

  return (
    <div className="absolute bottom-14 right-4 z-50 w-72 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-3 animate-fadeIn">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          {activeTransport === 'OFFLINE' ? (
            <WifiOff className={`w-4 h-4 ${transportToken.textClass}`} />
          ) : (
            <Wifi className={`w-4 h-4 ${transportToken.textClass}`} />
          )}
          <span className="text-[11px] font-black uppercase text-white tracking-wider">
            Transporte: {activeTransport}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          aria-label="Fechar configurações rápidas"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {localTerminal.isLocalTerminal && (
        <div className={`${TRANSPORT_COLORS.EDGE.bgClass} border ${TRANSPORT_COLORS.EDGE.borderClass} rounded-xl p-2.5 flex items-center justify-between gap-2 text-[10px]`}>
          <span className={`flex items-center gap-1.5 ${TRANSPORT_COLORS.EDGE.textClass} font-black uppercase tracking-wider`}>
            <Monitor className={`w-3.5 h-3.5 ${TRANSPORT_COLORS.EDGE.textClass} shrink-0`} />
            {localTerminal.label}
          </span>
          <span className="font-mono text-slate-300 truncate">{localTerminal.detailLabel}</span>
        </div>
      )}

      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between text-[10px]">
        <span className="text-slate-400 font-bold uppercase">Fila Offline Pendente</span>
        <span className={`font-mono font-black ${pendingToken.textClass}`}>
          {totalPendingCount} {totalPendingCount === 1 ? 'mutação' : 'mutações'}
        </span>
      </div>

      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 space-y-2">
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
          <span className="flex items-center gap-1.5">
            <Palette className="w-3 h-3 text-amber-400" /> Tema do Desktop
          </span>
          <span className="font-mono text-[9px] text-slate-300">
            {STORE_OS_WALLPAPERS[desktopTheme]?.label}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {wallpapers.map((wp) => {
            const active = wp.id === desktopTheme;
            return (
              <button
                key={wp.id}
                type="button"
                onClick={() => onChangeTheme(wp.id)}
                title={wp.label}
                aria-label={`Selecionar tema ${wp.label}`}
                className={`h-6 rounded-lg ${wp.swatchClass} transition-all cursor-pointer border-2 ${
                  active ? 'border-white scale-105 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              />
            );
          })}
        </div>
      </div>

      <button
        type="button"
        disabled={isSyncingQuick}
        onClick={onSyncNow}
        className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingQuick ? 'animate-spin' : ''}`} />
        <span>{isSyncingQuick ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
      </button>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenApp('settings', 'Configurações');
          }}
          className="py-2 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5 text-amber-400" /> Ajustes
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenApp('saas-billing', 'Minha Assinatura');
          }}
          className="py-2 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <CreditCard className="w-3.5 h-3.5 text-amber-400" /> Plano
        </button>
      </div>
    </div>
  );
};
