import React, { useEffect, useMemo, useState } from 'react';
import { ChefHat, Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import { Order, Store } from '../../types';
import { useEcosystem } from '../../context/EcosystemContext';

interface WaiterKitchenTabProps {
  currentStore: Store;
  orders: Order[];
  waiterName: string;
}

type KitchenFilter = 'ACTIVE' | 'READY' | 'PREPARING' | 'SERVED';

export const WaiterKitchenTab: React.FC<WaiterKitchenTabProps> = ({
  currentStore,
  orders,
  waiterName,
}) => {
  const { updateOrderStatus, showNotification } = useEcosystem();
  const [filter, setFilter] = useState<KitchenFilter>('ACTIVE');
  const [servingOrderId, setServingOrderId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const waiterTableOrders = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            o.storeId === currentStore.id &&
            o.channel === 'TABLE' &&
            o.status !== 'CANCELLED'
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [orders, currentStore.id]
  );

  const counts = useMemo(() => {
    const ready = waiterTableOrders.filter(
      (o) => o.status === 'READY_FOR_PICKUP'
    ).length;
    const preparing = waiterTableOrders.filter(
      (o) =>
        o.status === 'PENDING' ||
        o.status === 'CONFIRMED' ||
        o.status === 'IN_PREPARATION'
    ).length;
    const served = waiterTableOrders.filter(
      (o) => o.status === 'DELIVERED'
    ).length;
    return { active: ready + preparing, ready, preparing, served };
  }, [waiterTableOrders]);

  const filteredOrders = useMemo(() => {
    if (filter === 'READY') {
      return waiterTableOrders.filter((o) => o.status === 'READY_FOR_PICKUP');
    }
    if (filter === 'PREPARING') {
      return waiterTableOrders.filter(
        (o) =>
          o.status === 'PENDING' ||
          o.status === 'CONFIRMED' ||
          o.status === 'IN_PREPARATION'
      );
    }
    if (filter === 'SERVED') {
      return waiterTableOrders.filter((o) => o.status === 'DELIVERED');
    }
    return waiterTableOrders.filter((o) => o.status !== 'DELIVERED');
  }, [waiterTableOrders, filter]);

  const handleMarkServed = async (orderId: string, tableNumber?: number) => {
    if (servingOrderId === orderId) return;
    setServingOrderId(orderId);
    try {
      await updateOrderStatus(orderId, 'DELIVERED');
      showNotification(`Pedido entregue na Mesa ${tableNumber || ''}!`);
    } finally {
      setServingOrderId(null);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-800 pb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Acompanhamento de Cozinha (KDS)
            </h2>
            <p className="text-xs text-slate-400">
              Sincronização em tempo real entre salão e produção da cozinha.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 overflow-x-auto">
          {(
            [
              { id: 'ACTIVE', label: `Em Aberto (${counts.active})` },
              { id: 'READY', label: `Prontos (${counts.ready})` },
              { id: 'PREPARING', label: `Em Preparo (${counts.preparing})` },
              { id: 'SERVED', label: `Servidos (${counts.served})` },
            ] as Array<{ id: KitchenFilter; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap tabular-nums cursor-pointer ${
                filter === tab.id
                  ? 'bg-blue-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOrders.map((order) => {
          const timeElapsed = Math.max(
            0,
            Math.floor((nowMs - new Date(order.createdAt).getTime()) / 60000)
          );
          const targetMin = Math.max(5, Number(order.prepTimeEstMin || 15));
          const isReady = order.status === 'READY_FOR_PICKUP';
          const isPreparing = order.status === 'IN_PREPARATION';
          const isServed = order.status === 'DELIVERED';
          const isDelayed = !isServed && timeElapsed >= targetMin;
          const isWarning = !isServed && !isDelayed && timeElapsed >= Math.floor(targetMin * 0.65);

          return (
            <div
              key={order.id}
              className={`p-4 rounded-2xl border flex flex-col justify-between space-y-4 transition-colors ${
                isReady
                  ? 'bg-emerald-950/35 border-emerald-500'
                  : isDelayed
                  ? 'bg-slate-900 border-rose-500/60'
                  : isPreparing
                  ? 'bg-slate-900 border-blue-500/50'
                  : isServed
                  ? 'bg-slate-950/60 border-slate-800 opacity-75'
                  : 'bg-slate-900 border-amber-500/40'
              }`}
            >
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2.5 gap-2">
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <span className="font-bold text-white text-sm">{order.code}</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-xs font-semibold text-amber-400">
                      Mesa #{order.tableNumber}
                    </span>
                  </div>

                  <span
                    className={`text-xs font-semibold shrink-0 ${
                      isReady
                        ? 'text-emerald-400'
                        : isPreparing
                        ? 'text-blue-400'
                        : isServed
                        ? 'text-slate-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {isReady
                      ? 'Pronto para servir'
                      : isPreparing
                      ? 'Em preparo'
                      : isServed
                      ? 'Servido'
                      : 'Na fila'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span
                    className={`flex items-center gap-1.5 font-mono tabular-nums ${
                      isDelayed
                        ? 'text-rose-400 font-semibold'
                        : isWarning
                        ? 'text-amber-400 font-semibold'
                        : !isServed
                        ? 'text-emerald-400'
                        : ''
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    {timeElapsed} / {targetMin} min
                  </span>
                  <span className="truncate">
                    Atendente: {(order as any).waiterName || waiterName}
                  </span>
                </div>

                <div className="space-y-1.5 pt-1 divide-y divide-slate-800/60">
                  {order.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="pt-1.5 flex justify-between items-start gap-2 text-xs"
                    >
                      <span className="text-slate-100 font-medium">
                        <span className="text-amber-400 font-mono tabular-nums font-bold mr-1.5">
                          {item.quantity}x
                        </span>
                        {item.name}
                        {item.variantLabel ? (
                          <span className="ml-1.5 text-[11px] font-semibold text-cyan-300">
                            [{item.variantLabel}]
                          </span>
                        ) : null}
                        {Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0 ? (
                          <span className="block text-[11px] text-slate-400 font-normal mt-0.5">
                            + {item.selectedOptions.join(', ')}
                          </span>
                        ) : null}
                        {item.notes ? (
                          <span className="block text-[11px] text-amber-300 italic font-normal mt-0.5">
                            Obs: {item.notes}
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

              <div className="pt-3 border-t border-slate-800">
                {isReady ? (
                  <button
                    type="button"
                    disabled={servingOrderId === order.id}
                    onClick={() => handleMarkServed(order.id, order.tableNumber)}
                    className="w-full min-h-[44px] py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {servingOrderId === order.id
                      ? 'Confirmando...'
                      : `Marcar Servido · Mesa #${order.tableNumber}`}
                  </button>
                ) : isServed ? (
                  <div className="text-xs font-medium text-slate-500 text-center">
                    Entregue na mesa
                  </div>
                ) : (
                  <div className="text-xs font-medium text-blue-400 text-center flex items-center justify-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Cozinha em produção
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="col-span-full py-14 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2">
            <ChefHat className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-xs font-semibold text-slate-300">
              Nenhum pedido encontrado nesta aba.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

