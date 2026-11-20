import React, { useMemo, useState } from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { useAuth } from '../../../context/AuthContext';
import { Star, Monitor, Power } from 'lucide-react';
import { MerchantKpiGrid } from '../dashboard/MerchantKpiGrid';
import { MerchantOrdersStream } from '../dashboard/MerchantOrdersStream';
import { MerchantStockAndActions } from '../dashboard/MerchantStockAndActions';
import { isItemService } from '../../../utils/storeDomain';
import { detectLocalTerminalInfo } from '../../../core/platform/PlatformAdapter';
import { useSyncStatus } from '../../../hooks/useSyncStatus';
import { WindowAppId } from './storeOsAppsList';

interface MerchantDashboardAppProps {
  onOpenApp?: (appId: WindowAppId, title: string) => void;
}

export const MerchantDashboardApp: React.FC<MerchantDashboardAppProps> = ({ onOpenApp }) => {
  const { currentStore, orders, menuItems, customersCrm, deviceLicenses, governance, updateStoreData } = useEcosystem();
  const { profile } = useAuth();
  const [isTogglingOpen, setIsTogglingOpen] = useState(false);
  const canToggleStoreOpen = !profile?.role || ['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER'].includes(String(profile.role).toUpperCase());
  const syncStatus = useSyncStatus();
  const localTerminal = useMemo(
    () =>
      detectLocalTerminalInfo({
        activeTransport: syncStatus.activeTransport,
        edgeBaseUrl: syncStatus.pairedEdge?.edgeBaseUrl,
      }),
    [syncStatus.activeTransport, syncStatus.pairedEdge?.edgeBaseUrl]
  );

  const storeOrders = orders.filter(o => o.storeId === currentStore.id);
  const todayStr = new Date().toLocaleDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toLocaleDateString();

  const todayOrders = storeOrders.filter(o => new Date(o.createdAt).toLocaleDateString() === todayStr);
  const yesterdayOrders = storeOrders.filter(o => new Date(o.createdAt).toLocaleDateString() === yesterdayStr);

  const todayRevenue = todayOrders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((acc, o) => acc + (o.total || 0), 0);
  const yesterdayRevenue = yesterdayOrders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((acc, o) => acc + (o.total || 0), 0);

  const pendingOrders = todayOrders.filter(
    o => o.status === 'PENDING' || o.status === 'CONFIRMED' || o.status === 'IN_PREPARATION'
  );
  const completedTodayCount = todayOrders.filter(o => o.status === 'DELIVERED').length;

  const storeCustomers = customersCrm.filter(c => c.storeId === currentStore.id);
  const lowStockItems = menuItems.filter(
    i => i.storeId === currentStore.id && !isItemService(i, currentStore) && i.stock <= i.minStockAlert
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Top Welcome & Store Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase flex flex-wrap items-center gap-3">
            Overview: {currentStore.name}
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-black tracking-widest ${
                currentStore.isOpen
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {currentStore.isOpen ? '● LOJA ABERTA' : '○ LOJA FECHADA'}
            </span>
            {canToggleStoreOpen && (
              <button
                type="button"
                disabled={isTogglingOpen}
                onClick={async () => {
                  setIsTogglingOpen(true);
                  try {
                    await updateStoreData(currentStore.id, { isOpen: !currentStore.isOpen });
                  } finally {
                    setIsTogglingOpen(false);
                  }
                }}
                title={currentStore.isOpen ? 'Fechar loja e recusar novos pedidos no Marketplace' : 'Abrir loja para receber pedidos no Marketplace'}
                className={`text-[10px] not-italic px-2.5 py-0.5 rounded-lg font-black uppercase tracking-wider inline-flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50 ${
                  currentStore.isOpen
                    ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                <Power className="w-3 h-3" />
                {currentStore.isOpen ? 'Fechar Loja' : 'Abrir Loja'}
              </button>
            )}
            {localTerminal.isLocalTerminal && (
              <span
                title={localTerminal.detailLabel}
                className="text-[10px] not-italic px-2.5 py-0.5 rounded-lg font-mono font-bold tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 inline-flex items-center gap-1.5"
              >
                <Monitor className="w-3 h-3 text-cyan-400" />
                {localTerminal.label}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            Dashboard Executivo do Lojista • Dados em tempo real sincronizados via Cloud.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-lg">
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase">Rating Loja</div>
              <div className="text-sm font-black text-white font-mono">{currentStore.rating.toFixed(1)} / 5.0</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main KPI Grid */}
      <MerchantKpiGrid
        currentStore={currentStore}
        todayRevenue={todayRevenue}
        yesterdayRevenue={yesterdayRevenue}
        todayOrdersCount={todayOrders.length}
        pendingOrdersCount={pendingOrders.length}
        completedTodayCount={completedTodayCount}
        customersCount={storeCustomers.length}
        deviceLicenses={deviceLicenses}
        governance={governance}
      />

      {/* Center Grid: Order Monitoring & Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MerchantOrdersStream todayOrders={todayOrders} onOpenApp={onOpenApp} />

        <MerchantStockAndActions
          currentStore={currentStore}
          lowStockItems={lowStockItems}
          todayOrders={todayOrders}
        />
      </div>
    </div>
  );
};
