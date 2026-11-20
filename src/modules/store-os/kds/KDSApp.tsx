import React, { useEffect, useMemo, useState } from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { ChefHat, Clock, Printer, Layers, AlertTriangle } from 'lucide-react';
import { OrderStatus } from '../../../types';
import { ThermalReceiptModal } from '../common/ThermalReceiptModal';

type KdsFilter = 'ALL' | 'QUEUED' | 'IN_PREPARATION' | 'LATE';

export const KDSApp: React.FC = () => {
  const { currentStore, orders, updateOrderStatus } = useEcosystem();
  const [printOrder, setPrintOrder] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<KdsFilter>('ALL');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  const kdsOrders = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            o.storeId === currentStore.id &&
            (o.status === 'PENDING' || o.status === 'IN_PREPARATION' || o.status === 'CONFIRMED')
        )
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [orders, currentStore.id]
  );

  const enrichedOrders = useMemo(
    () =>
      kdsOrders.map((order) => {
        const elapsedMin = Math.max(
          0,
          Math.floor((nowMs - new Date(order.createdAt).getTime()) / 60000)
        );
        const isLate = elapsedMin > (order.prepTimeEstMin || 15);
        return { order, elapsedMin, isLate };
      }),
    [kdsOrders, nowMs]
  );

  const visibleOrders = useMemo(() => {
    if (statusFilter === 'QUEUED') {
      return enrichedOrders.filter(
        ({ order }) => order.status === 'PENDING' || order.status === 'CONFIRMED'
      );
    }
    if (statusFilter === 'IN_PREPARATION') {
      return enrichedOrders.filter(({ order }) => order.status === 'IN_PREPARATION');
    }
    if (statusFilter === 'LATE') {
      return enrichedOrders.filter(({ isLate }) => isLate);
    }
    return enrichedOrders;
  }, [enrichedOrders, statusFilter]);

  const allDayItems = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { order } of enrichedOrders) {
      for (const item of order.items || []) {
        const key = item.name;
        counts.set(key, (counts.get(key) || 0) + Number(item.quantity || 1));
      }
    }
    return Array.from(counts.entries())
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty);
  }, [enrichedOrders]);

  const lateCount = enrichedOrders.filter((e) => e.isLate).length;
  const queuedCount = enrichedOrders.filter(
    (e) => e.order.status === 'PENDING' || e.order.status === 'CONFIRMED'
  ).length;
  const prepCount = enrichedOrders.filter((e) => e.order.status === 'IN_PREPARATION').length;

  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    await updateOrderStatus(orderId, nextStatus);
  };

  const handlePrintTicket = (order: any) => {
    const receiptData = {
      code: order.code,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      deliveryAddress: order.deliveryAddress,
      items: order.items,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      discount: order.discount,
      total: order.total,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
      notes: order.notes,
      tableNumber: order.tableNumber,
    };
    setPrintOrder(receiptData);
  };

  return (
    <div className="space-y-5 h-full overflow-y-auto pr-2 custom-scrollbar">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 sticky top-0 bg-[#0a0e17] z-10 py-2">
        <div className="flex items-center gap-3">
          <ChefHat className="w-6 h-6 text-purple-400" />
          <div>
            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
              Fila de Produção KDS
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              Atualização automática de cronômetro •{' '}
              <span className="font-mono tabular-nums text-slate-200">{kdsOrders.length}</span> ticket(s) em cozinha
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'ALL', label: `Todos (${kdsOrders.length})` },
              { id: 'QUEUED', label: `Na Fila (${queuedCount})` },
              { id: 'IN_PREPARATION', label: `Em Preparo (${prepCount})` },
              { id: 'LATE', label: `Atrasados (${lateCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer font-mono tabular-nums ${
                statusFilter === tab.id
                  ? tab.id === 'LATE'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-purple-500/20 text-purple-200 border border-purple-500/40'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* All-Day Production Summary Strip */}
      {allDayItems.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span className="flex items-center gap-1.5 text-purple-300">
              <Layers className="w-3.5 h-3.5" /> Resumo de Produção (All-Day)
            </span>
            <span className="font-mono tabular-nums">
              {allDayItems.reduce((sum, i) => sum + i.qty, 0)} itens totais na fila
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {allDayItems.slice(0, 12).map((item) => (
              <div
                key={item.name}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] flex items-center gap-1.5"
              >
                <span className="font-mono tabular-nums font-black text-purple-400">
                  {item.qty}x
                </span>
                <span className="text-slate-200 font-medium">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleOrders.map(({ order, elapsedMin, isLate }) => (
          <div
            key={order.id}
            className={`bg-slate-900/80 rounded-2xl border ${
              isLate ? 'border-rose-500/50' : 'border-slate-800'
            } overflow-hidden flex flex-col`}
          >
            <div
              className={`p-3 flex justify-between items-center ${
                isLate ? 'bg-rose-500/10' : 'bg-slate-950/60'
              }`}
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-black text-sm font-mono">{order.code}</span>
                  {order.tableNumber && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase font-mono tabular-nums">
                      MESA {String(order.tableNumber).padStart(2, '0')}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handlePrintTicket(order)}
                    className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                    title="Imprimir Ticket Cozinha"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase truncate">
                  {order.customerName}
                </span>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span
                  className={`text-[11px] font-mono tabular-nums font-black flex items-center gap-1 ${
                    isLate ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {isLate ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {elapsedMin} min
                </span>
                <span className="text-[9px] text-slate-500 font-bold uppercase">
                  {order.paymentMethod === 'TABLE_BILL' ? 'COMANDA ABERTA' : order.channel}
                </span>
              </div>
            </div>

            <div className="p-4 flex-1 space-y-3">
              <div className="space-y-1.5">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-2 text-[11px]">
                    <span className="text-slate-100 font-bold leading-tight">
                      <span className="text-purple-400 font-mono tabular-nums mr-1.5">
                        {item.quantity}x
                      </span>
                      {item.name}
                    </span>
                  </div>
                ))}
              </div>
              {order.notes && (
                <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 text-[10px] text-amber-200">
                  Obs: {order.notes}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-950/40 border-t border-slate-800 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleUpdateStatus(order.id, 'READY_FOR_PICKUP')}
                className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-colors cursor-pointer"
              >
                PRONTO
              </button>
              <button
                type="button"
                onClick={() => void handleUpdateStatus(order.id, 'IN_PREPARATION')}
                className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-colors cursor-pointer border ${
                  order.status === 'IN_PREPARATION'
                    ? 'bg-blue-500/25 text-blue-200 border-blue-400/40'
                    : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20'
                }`}
              >
                {order.status === 'IN_PREPARATION' ? 'EM PREPARO' : 'INICIAR PREPARO'}
              </button>
            </div>
          </div>
        ))}
        {visibleOrders.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-40 gap-3">
            <ChefHat className="w-14 h-14 text-slate-500" />
            <div className="text-center">
              <p className="text-base font-black text-white uppercase italic">
                {kdsOrders.length === 0 ? 'Cozinha Limpa!' : 'Nenhum pedido neste filtro'}
              </p>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                {kdsOrders.length === 0
                  ? 'Nenhum pedido em produção no momento.'
                  : 'Alterne o filtro acima para visualizar os demais pedidos.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {printOrder && (
        <ThermalReceiptModal
          isOpen={!!printOrder}
          onClose={() => setPrintOrder(null)}
          order={printOrder}
          store={currentStore}
        />
      )}
    </div>
  );
};
