import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Driver } from '../../../types';

interface DriversSidebarListProps {
  viewMode: 'list' | 'map';
  ownDrivers: Driver[];
  partnerDrivers: Driver[];
  currentStoreId: string;
  isPoolEnabled: boolean;
  canToggleStatus?: boolean;
  onToggleStatus: (driverId: string) => void;
}

function getDriverFleetBadge(drv: Driver, currentStoreId: string) {
  const isLinkedStore = drv.storeId === currentStoreId;
  const modes = Array.isArray(drv.allowedFleetModes) ? drv.allowedFleetModes : [drv.fleetType];
  const isHybrid = isLinkedStore && modes.includes('STORE_FLEET') && modes.includes('PLATFORM_FLEET');
  if (isHybrid) {
    return {
      label: drv.activeOperationMode === 'PLATFORM' ? 'Híbrido • Em Plataforma' : 'Híbrido • Modo Loja',
      className: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    };
  }
  if (isLinkedStore && drv.fleetType === 'STORE_FLEET') {
    return {
      label: 'Frota da Loja',
      className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    };
  }
  return {
    label: 'Rede Parceira',
    className: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  };
}

export const DriversSidebarList: React.FC<DriversSidebarListProps> = ({
  viewMode,
  ownDrivers,
  partnerDrivers,
  currentStoreId,
  isPoolEnabled,
  canToggleStatus = false,
  onToggleStatus,
}) => {
  return (
    <div
      className={`w-full md:w-80 border-r border-slate-200 dark:border-slate-800 overflow-y-auto bg-white dark:bg-slate-900 ${
        viewMode === 'map' ? 'hidden md:block' : 'block'
      }`}
    >
      <div className="p-4 space-y-4">
        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
          Entregadores Disponíveis ({ownDrivers.length})
        </h4>
        <div className="space-y-2.5">
          {ownDrivers.map(drv => {
            const fleetBadge = getDriverFleetBadge(drv, currentStoreId);
            return (
              <div
                key={drv.id}
                className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-teal-500/40 bg-slate-50 dark:bg-slate-950/60 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    {drv.avatar ? (
                      <img
                        src={drv.avatar}
                        alt={drv.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-800"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200">
                        {(drv.name || 'M').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div
                      className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                        drv.status === 'AVAILABLE'
                          ? 'bg-emerald-500'
                          : drv.status === 'BUSY'
                          ? 'bg-amber-500'
                          : 'bg-slate-500'
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">{drv.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase truncate">
                      {drv.vehicle} • {drv.vehiclePlate || 'Sem placa'}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${fleetBadge.className}`}>
                    {fleetBadge.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                    {drv.totalDeliveries} ent.
                  </span>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                    {drv.status === 'AVAILABLE' ? 'ONLINE' : drv.status === 'OFFLINE' ? 'OFFLINE' : 'EM ROTA'}
                  </span>
                  {canToggleStatus ? (
                    <button
                      type="button"
                      onClick={() => onToggleStatus(drv.id)}
                      className="text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                    >
                      Alterar Status
                    </button>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-500">
                      Gerido pelo App Driver
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isPoolEnabled && partnerDrivers.length > 0 && (
          <>
            <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest pt-4 border-t border-slate-100 dark:border-slate-800">
              Parceiros Bairro ({partnerDrivers.length})
            </h4>
            <div className="space-y-2">
              {partnerDrivers.map(drv => (
                <div
                  key={drv.id}
                  className="p-3 rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-500/5 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {drv.avatar ? (
                      <img
                        src={drv.avatar}
                        alt={drv.name}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-lg object-cover grayscale"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300">
                        {(drv.name || 'P').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{drv.name}</p>
                      <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-tight">
                        Frota Compartilhada Bairro
                      </p>
                    </div>
                    <CheckCircle2 size={14} className="text-emerald-500" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
