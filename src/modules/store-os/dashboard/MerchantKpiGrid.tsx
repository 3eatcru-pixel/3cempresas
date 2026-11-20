import React from 'react';
import { DollarSign, TrendingUp, ShoppingBag, Users, Zap } from 'lucide-react';
import { Store, DeviceLicense, PlatformGovernance } from '../../../types';
import { getStoreMaxDevices } from '../../../utils/storeDomain';

interface MerchantKpiGridProps {
  currentStore: Store;
  todayRevenue: number;
  yesterdayRevenue: number;
  todayOrdersCount: number;
  pendingOrdersCount: number;
  completedTodayCount: number;
  customersCount: number;
  deviceLicenses: DeviceLicense[];
  governance?: PlatformGovernance;
}

export const MerchantKpiGrid: React.FC<MerchantKpiGridProps> = ({
  currentStore,
  todayRevenue,
  yesterdayRevenue,
  todayOrdersCount,
  pendingOrdersCount,
  completedTodayCount,
  customersCount,
  deviceLicenses,
  governance,
}) => {
  const storeDevices = deviceLicenses.filter(d => d.storeId === currentStore.id);
  const onlineDevicesCount = storeDevices.filter(d => d.status === 'ONLINE').length;
  const maxDevices = getStoreMaxDevices(currentStore, governance);

  const revenueDelta =
    yesterdayRevenue > 0
      ? (((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1)
      : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-2 hover:border-slate-700 transition-colors">
        <div className="flex justify-between items-center text-slate-400">
          <span className="text-xs font-semibold">Vendas de Hoje</span>
          <DollarSign className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
          R$ {todayRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-1.5 font-mono tabular-nums">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="font-sans">
            {revenueDelta !== null
              ? `${Number(revenueDelta) >= 0 ? '+' : ''}${revenueDelta}% em relação a ontem`
              : `${completedTodayCount} pedido(s) concluído(s) hoje`}
          </span>
        </div>
      </div>

      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-2 hover:border-slate-700 transition-colors">
        <div className="flex justify-between items-center text-slate-400">
          <span className="text-xs font-semibold">Pedidos Ativos</span>
          <ShoppingBag className="w-4 h-4 text-amber-400" />
        </div>
        <div className="text-2xl font-bold text-white font-mono tabular-nums">
          {pendingOrdersCount}{' '}
          <span className="text-xs text-slate-400 font-sans font-normal">em andamento</span>
        </div>
        <div className="text-xs text-amber-400 font-mono tabular-nums">
          Ticket médio: R$ {(todayOrdersCount > 0 ? todayRevenue / todayOrdersCount : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-2 hover:border-slate-700 transition-colors">
        <div className="flex justify-between items-center text-slate-400">
          <span className="text-xs font-semibold">Base de Clientes</span>
          <Users className="w-4 h-4 text-blue-400" />
        </div>
        <div className="text-2xl font-bold text-white font-mono tabular-nums">
          {customersCount}{' '}
          <span className="text-xs text-slate-400 font-sans font-normal">cadastrados</span>
        </div>
        <div className="text-xs text-slate-400 truncate">
          CRM exclusivo de {currentStore.name}
        </div>
      </div>

      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-2 hover:border-slate-700 transition-colors">
        <div className="flex justify-between items-center text-slate-400">
          <span className="text-xs font-semibold">Terminais Online</span>
          <Zap className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="text-2xl font-bold text-white font-mono tabular-nums">
          {onlineDevicesCount}{' '}
          <span className="text-xs text-cyan-400 font-semibold">
            / {maxDevices >= 999 ? 'Ilimitados' : `${maxDevices} (${currentStore.subscriptionPlan})`}
          </span>
        </div>
        <div className="text-xs text-slate-400 font-mono tabular-nums">
          {storeDevices.length} pareado(s) nesta unidade
        </div>
      </div>
    </div>
  );
};
