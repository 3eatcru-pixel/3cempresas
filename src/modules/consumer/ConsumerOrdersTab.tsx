import React from 'react';
import { useConsumer } from '../../context/ConsumerContext';
import { Order } from '../../types';
import { Clock, RefreshCw, FileText, Bike } from 'lucide-react';

interface ConsumerOrdersTabProps {
  orders: Order[];
  onOpenReceipt: (orderId: string) => void;
  onTrackOrder: (orderId: string) => void;
}

export const ConsumerOrdersTab: React.FC<ConsumerOrdersTabProps> = ({
  orders,
  onOpenReceipt,
  onTrackOrder
}) => {
  const { reorderOrder } = useConsumer();

  return (
    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-6 shadow-xl animate-fadeIn">
      <div className="border-b border-slate-800 pb-4 flex justify-between items-center">
        <div>
          <h3 className="font-black text-white italic uppercase tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" /> Histórico de Pedidos Realizados
          </h3>
          <p className="text-xs text-slate-400">Acompanhe o status e emita comprovantes digitais de suas compras</p>
        </div>
        <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
          {orders.length} Pedidos Cadastrados
        </span>
      </div>

      <div className="space-y-4">
        {orders.map(order => (
          <div key={order.id} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3 hover:border-slate-700 transition-all">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-900 pb-3">
              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-amber-400 text-sm bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                  {order.code}
                </span>
                <div>
                  <div className="font-bold text-white text-sm">{order.storeName}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{order.createdAt}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full font-mono text-[10px] font-bold uppercase ${
                  order.status === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  order.status === 'CANCELLED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                }`}>
                  {order.status === 'DELIVERED' ? '● ENTREGUE' : order.status === 'CANCELLED' ? '✕ CANCELADO' : `⏳ ${order.status}`}
                </span>
                <span className="font-mono font-black text-white text-sm pl-2">
                  R$ {order.total.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-xs font-mono text-slate-400">
              {order.items.map(item => (
                <div key={item.id} className="flex justify-between">
                  <span>{item.quantity}x {item.name}</span>
                  <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-900 text-xs">
              <button
                onClick={() => onOpenReceipt(order.id)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" /> Ver Comprovante
              </button>

              {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                <button
                  onClick={() => onTrackOrder(order.id)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 animate-pulse"
                >
                  <Bike className="w-3.5 h-3.5" /> Rastrear Pedido
                </button>
              )}

              <button
                onClick={() => reorderOrder(order.id)}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Pedir Novamente
              </button>
            </div>
          </div>
        ))}

        {orders.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-xs font-mono">
            Nenhum pedido realizado até o momento.
          </div>
        )}
      </div>
    </div>
  );
};
