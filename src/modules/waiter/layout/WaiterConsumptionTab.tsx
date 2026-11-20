import React from 'react';
import { Utensils } from 'lucide-react';

interface WaiterConsumptionTabProps {
  tableNumber: number;
  totalAmount: number;
  tableOrders: any[];
}

export const WaiterConsumptionTab: React.FC<WaiterConsumptionTabProps> = ({
  tableNumber,
  totalAmount,
  tableOrders,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
        <span className="text-xs font-bold text-white">
          Extrato de Pedidos · Mesa #{tableNumber}
        </span>
        <span className="text-xs font-mono tabular-nums font-bold text-amber-400">
          Total: R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>

      {tableOrders.length > 0 ? (
        <div className="space-y-3">
          {tableOrders.map((order) => (
            <div
              key={order.id}
              className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-2 text-xs gap-2">
                <div className="flex items-center gap-2 font-mono tabular-nums">
                  <span className="font-bold text-amber-400">{order.code}</span>
                  <span className="text-slate-500">
                    {new Date(order.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <span
                  className={`text-xs font-semibold shrink-0 ${
                    order.status === 'READY_FOR_PICKUP'
                      ? 'text-emerald-400'
                      : order.status === 'IN_PREPARATION'
                      ? 'text-blue-400'
                      : 'text-amber-400'
                  }`}
                >
                  {order.status === 'READY_FOR_PICKUP'
                    ? 'Pronto para servir'
                    : order.status === 'IN_PREPARATION'
                    ? 'Em preparo'
                    : 'Na fila'}
                </span>
              </div>

              <div className="space-y-1.5">
                {order.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between gap-2 text-xs text-slate-300">
                    <span>
                      <span className="font-mono tabular-nums font-bold text-amber-400 mr-1.5">
                        {item.quantity}x
                      </span>
                      {item.name}
                      {item.notes ? (
                        <span className="text-[11px] text-amber-300 italic ml-1.5">
                          ({item.notes})
                        </span>
                      ) : null}
                    </span>
                    <span className="font-mono tabular-nums text-slate-400 shrink-0">
                      R$ {(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-xs text-slate-500 space-y-2">
          <Utensils className="w-8 h-8 text-slate-600 mx-auto" />
          <p>Nenhum pedido ativo na mesa no momento.</p>
        </div>
      )}
    </div>
  );
};

