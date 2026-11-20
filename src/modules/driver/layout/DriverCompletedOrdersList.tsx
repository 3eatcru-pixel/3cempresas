import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Order } from '../../../types';

interface DriverCompletedOrdersListProps {
  completedOrders: Order[];
}

export const DriverCompletedOrdersList: React.FC<DriverCompletedOrdersListProps> = ({
  completedOrders,
}) => {
  if (completedOrders.length === 0) {
    return (
      <div className="bg-[#111922] border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400">
        Nenhuma entrega concluída ainda.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {completedOrders.map((order) => {
        const payout =
          Math.round(((Number(order.deliveryFee) || 0) + (Number((order as any).courierTip) || 0)) * 100) / 100;
        const displayCode = order.code.startsWith('#') ? order.code : `#${order.code}`;
        const ts = order.deliveredAt || order.updatedAt || order.createdAt;
        const formattedTime = ts
          ? new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          : 'Concluído';

        return (
          <div
            key={order.id}
            className="bg-[#111922] border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#00CCBC]/10 text-[#00CCBC] flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-extrabold text-white truncate">{order.storeName}</h4>
                <span className="text-[11px] text-slate-400 font-mono block truncate">
                  Pedido {displayCode}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-black text-[#00CCBC] font-mono tabular-nums block">
                + R$ {payout.toFixed(2).replace('.', ',')}
              </span>
              <span className="text-[10px] text-slate-400 font-mono tabular-nums">{formattedTime}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
