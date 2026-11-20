import React from 'react';
import { 
  Users, Utensils, DollarSign, ChefHat, Bell, Sparkles, QrCode
} from 'lucide-react';
import { DiningTable, Order, Store } from '../../types';
import { WaiterReadyDishesAlert } from './home/WaiterReadyDishesAlert';

interface WaiterHomeTabProps {
  currentStore: Store;
  waiterName: string;
  tables: DiningTable[];
  orders: Order[];
  onNavigateTab: (tab: string) => void;
  onSelectTable: (table: DiningTable) => void;
  onOpenQrPairing: () => void;
}

export const WaiterHomeTab: React.FC<WaiterHomeTabProps> = ({
  currentStore,
  waiterName,
  tables,
  orders,
  onNavigateTab,
  onOpenQrPairing,
}) => {
  const freeTables = tables.filter(t => t.status === 'FREE');
  const occupiedTables = tables.filter(t => t.status === 'OCCUPIED');
  const billRequestedTables = tables.filter(t => t.status === 'BILL_REQUESTED');

  const activeOrders = orders.filter(
    o => o.storeId === currentStore.id && 
    o.channel === 'TABLE' && 
    o.status !== 'DELIVERED' && 
    o.status !== 'CANCELLED'
  );

  const readyOrders = activeOrders.filter(o => o.status === 'READY_FOR_PICKUP');

  const totalOccupiedAmount = occupiedTables.reduce((acc, t) => acc + t.totalAmount, 0) + billRequestedTables.reduce((acc, t) => acc + t.totalAmount, 0);
  const estimatedTip10 = totalOccupiedAmount * 0.10;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-purple-950/60 p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-mono font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Turno Ativo • Salão {currentStore.name}
          </div>
          <h2 className="text-xl font-black text-white italic tracking-tighter">
            Olá, <span className="text-amber-400">{waiterName}</span>! 👋
          </h2>
          <p className="text-xs text-slate-400">
            Painel móvel touch para lançamento rápido, acompanhamento de pedidos e fechamento de comandas.
          </p>
        </div>

        <button
          onClick={onOpenQrPairing}
          className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-xs rounded-2xl transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <QrCode className="w-4 h-4" />
          <span>Parear Celular</span>
        </button>
      </div>

      {/* Realtime KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div 
          onClick={() => onNavigateTab('tables')}
          className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer space-y-1 shadow-lg"
        >
          <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider flex justify-between items-center">
            <span>Mesas Ocupadas</span>
            <Users className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{occupiedTables.length + billRequestedTables.length} <span className="text-xs font-normal text-slate-500">/ {tables.length}</span></div>
          <div className="text-[10px] text-amber-400 font-semibold">{freeTables.length} mesas livres agora</div>
        </div>

        <div 
          onClick={() => onNavigateTab('kitchen')}
          className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 hover:border-emerald-500/40 transition-all cursor-pointer space-y-1 shadow-lg"
        >
          <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider flex justify-between items-center">
            <span>Pratos Prontos</span>
            <ChefHat className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">{readyOrders.length}</div>
          <div className="text-[10px] text-slate-400 font-semibold">{activeOrders.length} pedidos em produção</div>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-1 shadow-lg">
          <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider flex justify-between items-center">
            <span>Vendas no Salão</span>
            <DollarSign className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-black text-white font-mono">R$ {totalOccupiedAmount.toFixed(2)}</div>
          <div className="text-[10px] text-slate-400 font-semibold">Consumo acumulado</div>
        </div>

        <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-1 shadow-lg">
          <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider flex justify-between items-center">
            <span>Gorjetas (10%)</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400 font-mono">R$ {estimatedTip10.toFixed(2)}</div>
          <div className="text-[10px] text-emerald-400 font-semibold">Comissão estimada</div>
        </div>
      </div>

      <WaiterReadyDishesAlert readyOrders={readyOrders} onNavigateTab={onNavigateTab} />

      {/* Quick Access Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Utensils className="w-4 h-4 text-amber-400" /> Ações Rápidas de Atendimento
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => onNavigateTab('tables')}
            className="p-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl text-left space-y-2 transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-extrabold text-white group-hover:text-amber-400 transition-colors">Minhas Mesas</h4>
            <p className="text-[11px] text-slate-400">Verificar status de mesas livres, ocupadas ou solicitar conta.</p>
          </button>

          <button
            onClick={() => onNavigateTab('kitchen')}
            className="p-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl text-left space-y-2 transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
              <ChefHat className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-extrabold text-white group-hover:text-blue-400 transition-colors">Monitor de Cozinha</h4>
            <p className="text-[11px] text-slate-400">Acompanhar preparo dos pedidos enviados para o KDS em tempo real.</p>
          </button>

          <button
            onClick={() => onNavigateTab('notifications')}
            className="p-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl text-left space-y-2 transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
              <Bell className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-extrabold text-white group-hover:text-purple-400 transition-colors">Notificações & Chamados</h4>
            <p className="text-[11px] text-slate-400">Receber chamados de clientes nas mesas e avisos da equipe.</p>
          </button>
        </div>
      </div>
    </div>
  );
};
