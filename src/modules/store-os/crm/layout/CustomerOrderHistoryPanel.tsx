import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react';
import { Order } from '../../../../types';

const ORDER_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendente', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  PREPARING: { label: 'Preparando', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  READY: { label: 'Pronto', cls: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  OUT_FOR_DELIVERY: { label: 'Em Rota', cls: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  DELIVERED: { label: 'Entregue', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  COMPLETED: { label: 'Concluído', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  CANCELLED: { label: 'Cancelado', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
};

interface CustomerOrderHistoryPanelProps {
  customerOrders: Order[];
  effectiveTotalSpent: number;
  effectiveOrdersCount: number;
  averageTicket: number;
  loyaltyPoints: number;
}

export const CustomerOrderHistoryPanel: React.FC<CustomerOrderHistoryPanelProps> = ({
  customerOrders,
  effectiveTotalSpent,
  effectiveOrdersCount,
  averageTicket,
  loyaltyPoints,
}) => {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  return (
    <div className="lg:col-span-7 space-y-4">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
        Visão 360° de Consumo &amp; Histórico
      </h4>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Gasto</div>
          <div className="text-sm font-black font-mono tabular-nums text-emerald-400 mt-1">
            R$ {effectiveTotalSpent.toFixed(2)}
          </div>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-slate-500 uppercase">Pedidos</div>
          <div className="text-sm font-black font-mono tabular-nums text-white mt-1">
            {effectiveOrdersCount}
          </div>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-slate-500 uppercase">Ticket Médio</div>
          <div className="text-sm font-black font-mono tabular-nums text-blue-400 mt-1">
            R$ {averageTicket.toFixed(2)}
          </div>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
          <div className="text-[10px] font-semibold text-slate-500 uppercase">Pontos</div>
          <div className="text-sm font-black font-mono tabular-nums text-amber-400 mt-1">
            {loyaltyPoints} pts
          </div>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <ShoppingBag size={14} className="text-blue-400" />
            Histórico de Compras na Loja ({customerOrders.length})
          </span>
        </div>

        {customerOrders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Nenhum pedido detalhado vinculado a este cliente nesta filial até o momento.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80 max-h-80 overflow-y-auto custom-scrollbar">
            {customerOrders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const st = ORDER_STATUS_LABEL[order.status] || {
                label: order.status,
                cls: 'bg-slate-800 text-slate-300 border-slate-700',
              };
              return (
                <div key={order.id} className="p-3.5 hover:bg-slate-900/50 transition-colors">
                  <button
                    type="button"
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-white">
                          #{order.code || order.id.slice(-6)}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${st.cls}`}>
                          {st.label}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          {order.channel} · {order.paymentMethod}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {new Date(order.createdAt).toLocaleString('pt-BR')} · {order.items?.length || 0}{' '}
                        {(order.items?.length || 0) === 1 ? 'item' : 'itens'}
                        {order.couponCode ? ` · Cupom ${order.couponCode}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono tabular-nums font-black text-emerald-400">
                        R$ {(order.total || 0).toFixed(2)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp size={14} className="text-slate-500" />
                      ) : (
                        <ChevronDown size={14} className="text-slate-500" />
                      )}
                    </div>
                  </button>

                  {isExpanded && order.items && order.items.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-800/70 space-y-1.5">
                      {order.items.map((item, idx) => (
                        <div
                          key={`${order.id}-item-${idx}`}
                          className="flex items-center justify-between text-[11px] text-slate-300"
                        >
                          <span className="truncate pr-2">
                            <span className="font-mono text-slate-500 mr-1.5">{item.quantity}x</span>
                            {item.name}
                          </span>
                          <span className="font-mono tabular-nums text-slate-400 shrink-0">
                            R$ {((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {(order.discount || 0) > 0 && (
                        <div className="flex items-center justify-between text-[11px] text-amber-400 pt-1">
                          <span>Desconto aplicado</span>
                          <span className="font-mono tabular-nums">
                            - R$ {(order.discount || 0).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
