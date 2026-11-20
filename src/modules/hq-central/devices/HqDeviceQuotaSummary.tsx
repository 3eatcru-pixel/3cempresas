import React from 'react';
import { Building2 } from 'lucide-react';
import { PILLAR_THEMES, STATUS_COLORS, SURFACE_TOKENS } from '@3c/design-system';
import type { DeviceLicense, PlatformGovernance, Store } from '../../../types';
import { getStoreMaxBranches, getStoreMaxDevices, getTenantStores } from '../../../utils/storeDomain';

interface HqDeviceQuotaSummaryProps {
  stores: Store[];
  deviceLicenses: DeviceLicense[];
  governance: PlatformGovernance;
  selectedStoreFilter: string;
  onSelectStoreFilter: (value: string) => void;
}

export const HqDeviceQuotaSummary: React.FC<HqDeviceQuotaSummaryProps> = ({
  stores,
  deviceLicenses,
  governance,
  selectedStoreFilter,
  onSelectStoreFilter,
}) => {
  const storeTheme = PILLAR_THEMES['store-os'];
  const surface = SURFACE_TOKENS.dark;
  const warningToken = STATUS_COLORS.WARNING;
  const successToken = STATUS_COLORS.SUCCESS;

  return (
    <div className={`${surface.elevatedBg} p-6 rounded-2xl border ${surface.border} space-y-4`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className={`w-5 h-5 ${storeTheme.accentTextClass}`} /> Uso de Filiais & Terminais Conectados
          </h2>
          <p className="text-xs text-slate-400">
            Cota de filiais por assinatura e contagem em tempo real de dispositivos pareados.
          </p>
        </div>
        <select
          value={selectedStoreFilter}
          onChange={(e) => onSelectStoreFilter(e.target.value)}
          className={`${surface.canvasBg} border ${surface.border} text-xs text-white px-3 py-2 rounded-xl font-bold focus:outline-none`}
        >
          <option value="ALL">Todas as Lojas ({stores.length})</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stores
          .filter((s) => selectedStoreFilter === 'ALL' || s.id === selectedStoreFilter)
          .map((store) => {
            const usedDevices = deviceLicenses.filter((d) => d.storeId === store.id).length;
            const maxDevices = getStoreMaxDevices(store, governance);
            const atDeviceLimit = usedDevices >= maxDevices;
            const usedBranches = Math.max(1, getTenantStores(stores, store).length);
            const maxBranches = getStoreMaxBranches(store, governance);
            const atBranchLimit = usedBranches >= maxBranches;

            return (
              <div
                key={store.id}
                className={`${surface.canvasBg} border ${surface.border} rounded-xl p-4 space-y-2`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-white truncate">{store.name}</span>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${surface.elevatedBg} border ${surface.border} ${storeTheme.accentTextClass}`}>
                    {store.subscriptionPlan}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Filiais Ativas</span>
                  <span className={atBranchLimit ? `${warningToken.textClass} font-black` : `${successToken.textClass} font-bold`}>
                    {usedBranches} / {maxBranches} {maxBranches === 1 ? 'Filial' : 'Filiais'}
                  </span>
                </div>
                <div className={`w-full h-1.5 ${surface.elevatedBg} rounded-full overflow-hidden`}>
                  <div
                    className={`h-full ${atBranchLimit ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, (usedBranches / maxBranches) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono pt-1">
                  <span className="text-slate-400">Terminais / Devices</span>
                  <span className={atDeviceLimit ? `${warningToken.textClass} font-bold` : `${successToken.textClass} font-bold`}>
                    {usedDevices} / {maxDevices >= 999 ? '999' : maxDevices} conectado(s)
                  </span>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
