import React, { useState } from 'react';
import { Truck, Send, CheckCircle2, MapPin, Package } from 'lucide-react';
import { Driver, Order, DeliveryFleetModality } from '../../../types';

interface DriversStatsViewProps {
  storeName: string;
  storeModality: DeliveryFleetModality;
  readyOrders: Order[];
  activeOrders: Order[];
  deliveredCount: number;
  eligibleDrivers: Driver[];
  onAssignDriver: (orderId: string, driverId: string) => Promise<boolean>;
}

export const DriversStatsView: React.FC<DriversStatsViewProps> = ({
  storeName,
  storeModality,
  readyOrders,
  activeOrders,
  deliveredCount,
  eligibleDrivers,
  onAssignDriver,
}) => {
  const [selectedDriverByOrder, setSelectedDriverByOrder] = useState<Record<string, string>>({});
  const [dispatchingOrderId, setDispatchingOrderId] = useState<string | null>(null);

  const onlineDrivers = eligibleDrivers.filter(d => d.status !== 'OFFLINE');

  const handleDispatch = async (orderId: string) => {
    const targetDriverId =
      selectedDriverByOrder[orderId] ||
      onlineDrivers[0]?.id ||
      eligibleDrivers[0]?.id;
    if (!targetDriverId) return;
    setDispatchingOrderId(orderId);
    try {
      await onAssignDriver(orderId, targetDriverId);
    } finally {
      setDispatchingOrderId(null);
    }
  };

  return (
    <div className="p-5 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div>
          <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-teal-500" />
            Central de Despacho — {storeName}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {storeModality === 'STORE_FLEET'
              ? 'Pedidos enviados diretamente para os motoristas da loja no App Driver compartilhado.'
              : 'Pedidos liberados na rede de entregadores parceiros (e disponíveis para despacho manual se necessário).'}
          </p>
        </div>
        <span className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 text-teal-500 shrink-0">
          {storeModality === 'STORE_FLEET' ? 'MODO: FROTA DA LOJA' : 'MODO: REDE PARCEIRA'}
        </span>
      </div>

      {/* Real-time KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Prontos p/ Coleta</p>
          <p className="text-2xl font-black text-teal-500 font-mono tabular-nums mt-1">{readyOrders.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Em Rota Agora</p>
          <p className="text-2xl font-black text-amber-500 font-mono tabular-nums mt-1">{activeOrders.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Entregas Concluídas</p>
          <p className="text-2xl font-black text-emerald-500 font-mono tabular-nums mt-1">{deliveredCount}</p>
        </div>
      </div>

      {/* Ready Orders Queue */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-teal-500" />
            Fila de Despacho ({readyOrders.length})
          </h5>
          <span className="text-[11px] text-slate-500 font-mono tabular-nums">
            {onlineDrivers.length} motorista(s) online
          </span>
        </div>

        {readyOrders.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            Nenhum pedido com status PRONTO PARA COLETA aguardando despacho nesta loja.
          </div>
        ) : (
          <div className="space-y-3">
            {readyOrders.map(order => {
              const assignedDriver = order.driverId
                ? eligibleDrivers.find(d => d.id === order.driverId || d.uid === order.driverId)
                : undefined;
              const defaultPick =
                selectedDriverByOrder[order.id] ||
                order.driverId ||
                onlineDrivers[0]?.id ||
                eligibleDrivers[0]?.id ||
                '';

              return (
                <div
                  key={order.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black font-mono text-teal-500">{order.code}</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {order.customerName}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        Taxa R$ {(Number(order.deliveryFee) || 0).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                      <span className="truncate">{order.deliveryAddress || 'Retirada / endereço padrão'}</span>
                    </p>
                    {order.driverId && (
                      <p className="text-[11px] font-bold text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Despachado no App Driver para: {order.driverName || assignedDriver?.name || order.driverId}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    <select
                      value={defaultPick}
                      onChange={e =>
                        setSelectedDriverByOrder(prev => ({ ...prev, [order.id]: e.target.value }))
                      }
                      disabled={eligibleDrivers.length === 0}
                      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                    >
                      {eligibleDrivers.length === 0 && (
                        <option value="">Sem entregadores habilitados</option>
                      )}
                      {eligibleDrivers.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.storeId === order.storeId ? 'Loja' : 'Plataforma'}) •{' '}
                          {d.status === 'OFFLINE' ? 'Offline' : 'Online'}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!defaultPick || dispatchingOrderId === order.id}
                      onClick={() => handleDispatch(order.id)}
                      className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {order.driverId ? 'Reatribuir' : 'Despachar App Driver'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Out-For-Delivery Orders */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="w-4 h-4 text-amber-500" />
            Entregas em Rota Agora ({activeOrders.length})
          </h5>
        </div>

        {activeOrders.length === 0 ? (
          <div className="p-5 text-center rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            Nenhuma entrega em trânsito no momento.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {activeOrders.map((order) => {
              const assignedDriver = order.driverId
                ? eligibleDrivers.find(
                    (d) => d.id === order.driverId || d.uid === order.driverId
                  )
                : undefined;

              return (
                <div
                  key={order.id}
                  className="p-3.5 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono tabular-nums font-bold text-amber-500">
                        {order.code}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                        {order.customerName}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="text-teal-500 font-semibold">
                        {order.driverName || assignedDriver?.name || 'Motorista atribuído'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                      <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="truncate">
                        {order.deliveryAddress || 'Endereço não informado'}
                      </span>
                    </p>
                  </div>
                  <div className="font-mono tabular-nums font-bold text-slate-900 dark:text-white shrink-0">
                    R$ {(Number(order.total) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

