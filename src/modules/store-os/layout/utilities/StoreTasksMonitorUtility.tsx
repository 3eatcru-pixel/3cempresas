import React from 'react';
import {
  Cpu,
  Activity,
  Package,
  ShoppingBag,
} from 'lucide-react';
import { WindowAppId } from '../storeOsAppsList';
import { Store, MenuItem } from '../../../../types';
import { useEcosystem } from '../../../../context/EcosystemContext';
import { getStorePosMode, isItemService } from '../../../../utils/storeDomain';

interface StoreTasksMonitorUtilityProps {
  currentStore: Store;
  menuItems: MenuItem[];
  onOpenApp?: (appId: WindowAppId, title: string) => void;
}

export const StoreTasksMonitorUtility: React.FC<StoreTasksMonitorUtilityProps> = ({
  currentStore,
  menuItems,
  onOpenApp,
}) => {
  const { orders, reservations, cashSession } = useEcosystem();
  const mode = getStorePosMode(currentStore);
  const openOrders = orders.filter(
    (o) =>
      o.storeId === currentStore.id &&
      (o.status === 'PENDING' || o.status === 'CONFIRMED' || o.status === 'IN_PREPARATION')
  );
  const lowStock = menuItems.filter(
    (i) => i.storeId === currentStore.id && !isItemService(i, currentStore) && i.stock <= i.minStockAlert
  );
  const pendingReservations = reservations.filter(
    (r) => r.storeId === currentStore.id && (r.status === 'PENDING' || r.status === 'CONFIRMED')
  );
  const activeCash =
    cashSession && cashSession.storeId === currentStore.id && cashSession.status === 'OPEN'
      ? cashSession
      : null;

  return (
    <div className="h-full p-6 space-y-5 overflow-y-auto text-slate-200 animate-fadeIn">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/30 text-amber-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
              Monitor de Processos da Loja
            </h3>
            <p className="text-[11px] text-slate-400">
              {currentStore.name} • Modo Operacional: <span className="text-amber-400 font-bold">{mode}</span>
            </p>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
            currentStore.isOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
          }`}
        >
          {currentStore.isOpen ? 'Operação Online' : 'Loja Fechada'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-amber-400" /> Fila Ativa
          </div>
          <div className="text-2xl font-black font-mono text-white">{openOrders.length}</div>
          <div className="text-[10px] text-slate-400">Pedidos em andamento</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-cyan-400" /> Estoque Crítico
          </div>
          <div className="text-2xl font-black font-mono text-white">{lowStock.length}</div>
          <div className="text-[10px] text-slate-400">Itens físicos abaixo do mínimo</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-pink-400" /> Agenda Ativa
          </div>
          <div className="text-2xl font-black font-mono text-white">{pendingReservations.length}</div>
          <div className="text-[10px] text-slate-400">Agendamentos pendentes/confirmados</div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="text-[10px] text-slate-500 font-bold uppercase">Caixa Atual</div>
          <div className={`text-sm font-black ${activeCash ? 'text-emerald-400' : 'text-amber-400'}`}>
            {activeCash ? `ABERTO (${activeCash.openedBy})` : 'FECHADO'}
          </div>
          <div className="text-[10px] text-slate-400">
            Módulos ativos: {(currentStore.enabledModules || []).length}
          </div>
        </div>
      </div>

      {onOpenApp && (
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={() => onOpenApp('pdv', 'PDV Balcão')}
            className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-[10px] font-black uppercase cursor-pointer"
          >
            Abrir PDV ({mode})
          </button>
          <button
            onClick={() => onOpenApp('reservations', 'Reservas & Agendamento')}
            className="px-4 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase cursor-pointer"
          >
            Abrir Agenda
          </button>
          <button
            onClick={() => onOpenApp('appstore', 'App Store / Módulos')}
            className="px-4 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase cursor-pointer"
          >
            Gerenciar Módulos
          </button>
        </div>
      )}
    </div>
  );
};
