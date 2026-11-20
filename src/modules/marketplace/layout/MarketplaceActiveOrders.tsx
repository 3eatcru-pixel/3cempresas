import React, { useState } from 'react';
import { ShoppingBag, Clock, UtensilsCrossed, Truck, XCircle, RotateCcw } from 'lucide-react';
import { Order } from '../../../types';
import { useEcosystem } from '../../../context/EcosystemContext';

interface MarketplaceActiveOrdersProps {
  orders: Order[];
  activeOrders: Order[];
  onTrackOrder: (id: string) => void;
  onExplore: () => void;
  onReorder?: (order: Order) => void;
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Aguardando Confirmação',
  CONFIRMED: 'Confirmado',
  IN_PREPARATION: 'Em Preparo',
  READY_FOR_PICKUP: 'Pronto p/ Retirada',
  AWAITING_DRIVER: 'Aguardando Entregador',
  OUT_FOR_DELIVERY: 'Saiu para Entrega',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

export const MarketplaceActiveOrders: React.FC<MarketplaceActiveOrdersProps> = ({
  orders,
  activeOrders,
  onTrackOrder,
  onExplore,
  onReorder,
}) => {
  const { cancelCustomerOrder } = useEcosystem();
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const pastOrders = orders.filter((o: any) => o.status === 'DELIVERED' || o.status === 'CANCELLED');

  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-6 shadow-xl animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-400" /> Meus Pedidos &amp; Acompanhamento
          </h2>
          <p className="text-xs text-slate-400">
            Acompanhe o preparo e a entrega em tempo real dos seus pedidos.
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums font-bold px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 w-fit">
          {orders.length} pedido(s)
        </span>
      </div>

      {/* Active Orders Section */}
      {activeOrders.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-400" /> Pedidos em Andamento ({activeOrders.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeOrders.map((o: any) => (
              <div key={o.id} className="bg-slate-950 border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-lg hover:border-amber-500/60 transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-amber-400 text-sm">{o.code || `#${o.id.slice(0, 6)}`}</span>
                      <span className="text-xs font-bold text-white">{o.storeName || 'Restaurante'}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                      {o.channel === 'TABLE' ? (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <UtensilsCrossed className="w-3 h-3" /> Mesa {o.tableNumber || 1} (Autoatendimento)
                        </span>
                      ) : (
                        <span>{o.deliveryAddress || 'Endereço informado'}</span>
                      )}
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider font-mono ${
                    o.status === 'IN_PREPARATION' || o.status === 'PENDING'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : o.status === 'OUT_FOR_DELIVERY'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {ORDER_STATUS_LABELS[String(o.status)] || o.status}
                  </span>
                </div>

                <div className="text-xs text-slate-300 font-medium border-t border-slate-900 pt-2 space-y-1">
                  {o.items?.map((it: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span>{it.quantity}x {it.name}</span>
                      <span className="font-mono tabular-nums text-slate-400">R$ {(it.price * it.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-900 gap-2 flex-wrap">
                  <div className="font-mono tabular-nums text-xs">
                    <span className="text-slate-500">Total: </span>
                    <strong className="text-emerald-400 font-black">R$ {(o.total || 0).toFixed(2)}</strong>
                  </div>

                  <div className="flex items-center gap-2">
                    {o.status === 'PENDING' && (
                      confirmCancelId === o.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={cancellingId === o.id}
                            onClick={() => setConfirmCancelId(null)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold rounded-xl cursor-pointer"
                          >
                            Voltar
                          </button>
                          <button
                            type="button"
                            disabled={cancellingId === o.id}
                            onClick={async () => {
                              setCancellingId(o.id);
                              try {
                                await cancelCustomerOrder(o.id);
                                setConfirmCancelId(null);
                              } finally {
                                setCancellingId(null);
                              }
                            }}
                            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black rounded-xl cursor-pointer disabled:opacity-50"
                          >
                            {cancellingId === o.id ? 'Cancelando...' : 'Confirmar'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmCancelId(o.id)}
                          className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Cancelar
                        </button>
                      )
                    )}

                    <button
                      onClick={() => onTrackOrder(o.id)}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all hover:brightness-110 flex items-center gap-1.5 cursor-pointer"
                    >
                      {o.channel === 'TABLE' ? (
                        <>
                          <UtensilsCrossed className="w-3.5 h-3.5" />
                          <span>Ver Comanda</span>
                        </>
                      ) : o.channel === 'PICKUP' ? (
                        <>
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Acompanhar</span>
                        </>
                      ) : (
                        <>
                          <Truck className="w-3.5 h-3.5" />
                          <span>Rastrear</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Orders Section */}
      <div className="space-y-3">
        <div className="text-xs font-black uppercase tracking-wider text-slate-400">
          Histórico de Pedidos Concluídos
        </div>
        {pastOrders.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 text-slate-500 space-y-2">
            <ShoppingBag className="w-10 h-10 mx-auto opacity-40 text-amber-500" />
            <p className="text-xs">Nenhum pedido finalizado anteriormente.</p>
            <button
              onClick={onExplore}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl uppercase tracking-wider transition-all cursor-pointer"
            >
              Explorar Restaurantes e Fazer um Pedido
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
            {pastOrders.map((o: any) => (
              <div key={o.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/40 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-xs">{o.code || `#${o.id.slice(0, 6)}`}</span>
                    <span className="text-xs font-bold text-slate-300">{o.storeName}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                        o.status === 'CANCELLED'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}
                    >
                      {o.status === 'CANCELLED' ? 'Cancelado' : 'Entregue'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {o.items?.map((it: any) => `${it.quantity}x ${it.name}`).join(', ')}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-mono tabular-nums text-emerald-400 font-bold text-sm mr-2">
                    R$ {(o.total || 0).toFixed(2)}
                  </div>
                  {onReorder && (
                    <button
                      type="button"
                      onClick={() => onReorder(o)}
                      className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Pedir Novamente
                    </button>
                  )}
                  <button
                    onClick={() => onTrackOrder(o.id)}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Ver Detalhes
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
