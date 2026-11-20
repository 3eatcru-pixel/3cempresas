import React from 'react';
import { Bell } from 'lucide-react';
import { Order } from '../../../types';

interface WaiterReadyDishesAlertProps {
  readyOrders: Order[];
  onNavigateTab: (tab: string) => void;
}

export const WaiterReadyDishesAlert: React.FC<WaiterReadyDishesAlertProps> = ({
  readyOrders,
  onNavigateTab,
}) => {
  if (readyOrders.length === 0) return null;

  return (
    <div className="bg-emerald-500/10 border border-emerald-500/40 p-4 rounded-2xl space-y-3">
      <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
        <span className="flex items-center gap-2">
          <Bell className="w-4 h-4" /> Pratos prontos na cozinha
        </span>
        <button
          type="button"
          onClick={() => onNavigateTab('kitchen')}
          className="underline text-xs hover:text-white cursor-pointer tabular-nums"
        >
          Ver todos ({readyOrders.length})
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {readyOrders.map((o) => (
          <div
            key={o.id}
            className="bg-slate-950 p-3 rounded-xl border border-emerald-500/35 flex justify-between items-center gap-3"
          >
            <div className="min-w-0">
              <div className="text-xs font-bold text-white font-mono tabular-nums">
                Mesa #{o.tableNumber} · Pedido {o.code}
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                {o.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('kitchen')}
              className="min-h-[40px] px-3.5 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl hover:bg-emerald-400 transition-colors cursor-pointer shrink-0"
            >
              Servir
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

