import React, { useState } from 'react';
import { Order, Driver } from '../../types';
import { DriverOrderDetailsModal } from './layout/DriverOrderDetailsModal';
import { DriverAvailableOrdersList } from './layout/DriverAvailableOrdersList';
import { DriverActiveOrdersList } from './layout/DriverActiveOrdersList';
import { DriverCompletedOrdersList } from './layout/DriverCompletedOrdersList';

interface DriverOrdersTabProps {
  availableOrders: Order[];
  activeOrders: Order[];
  completedOrders: Order[];
  currentDriver: Driver;
  onAcceptDelivery: (driverId: string, orderId: string) => Promise<void> | void;
  onToggleDriverStatus?: () => void;
  onNavigateToMap: () => void;
  isOnline: boolean;
  operationMode: 'STORE' | 'PLATFORM';
  storeName?: string;
}

export const DriverOrdersTab: React.FC<DriverOrdersTabProps> = ({
  availableOrders,
  activeOrders,
  completedOrders,
  currentDriver,
  onAcceptDelivery,
  onToggleDriverStatus,
  onNavigateToMap,
  isOnline,
  operationMode,
  storeName,
}) => {
  const [subTab, setSubTab] = useState<'available' | 'active' | 'completed'>('available');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);

  const handleAcceptOrder = async (orderId: string) => {
    if (acceptingOrderId) return;
    setAcceptingOrderId(orderId);
    try {
      await onAcceptDelivery(currentDriver.id, orderId);
      setSelectedOrder(null);
      let shouldAutoOpenMap = true;
      try {
        const raw = localStorage.getItem(`3c_driver_prefs_${currentDriver.id}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.autoOpenMapOnAccept === 'boolean') {
            shouldAutoOpenMap = parsed.autoOpenMapOnAccept;
          }
        }
      } catch {
        // use default true
      }
      if (shouldAutoOpenMap) {
        onNavigateToMap();
      } else {
        setSubTab('active');
      }
    } finally {
      setAcceptingOrderId(null);
    }
  };

  return (
    <div className="space-y-4 pb-20 animate-fadeIn">
      {/* Top Section Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">Pedidos e Corridas</h2>
          <p className="text-xs text-slate-400">
            {operationMode === 'STORE'
              ? `Frota da Loja${storeName ? ` • ${storeName}` : ''}`
              : 'Plataforma Aberta • Ofertas disponíveis na rede'}
          </p>
        </div>
        <span
          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border shrink-0 ${
            isOnline
              ? 'bg-[#00CCBC]/10 text-[#00CCBC] border-[#00CCBC]/30'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          {isOnline ? 'GPS ONLINE' : 'GPS OFFLINE'}
        </span>
      </div>

      {/* Sub-tabs Navigation */}
      <div className="flex bg-[#111922] p-1 rounded-2xl border border-slate-800">
        {[
          { id: 'available', label: 'Disponíveis', count: availableOrders.length },
          { id: 'active', label: 'Em rota', count: activeOrders.length },
          { id: 'completed', label: 'Entregues', count: completedOrders.length },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id as any)}
            className={`min-h-[44px] flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              subTab === tab.id
                ? 'bg-[#00CCBC] text-slate-950 font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] tabular-nums font-mono ${
                subTab === tab.id
                  ? 'bg-slate-950/20 text-slate-950 font-black'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {!isOnline && subTab === 'available' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center space-y-2.5">
          <p className="text-xs font-bold text-amber-400">Você está offline no momento</p>
          <p className="text-xs text-slate-400">
            Ative seu turno para aceitar novas corridas e despachos da loja.
          </p>
          {onToggleDriverStatus && (
            <button
              type="button"
              onClick={onToggleDriverStatus}
              className="min-h-[40px] px-4 py-2 bg-[#00CCBC] hover:bg-[#00b5a7] text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer"
            >
              Ativar Turno Agora
            </button>
          )}
        </div>
      )}

      {subTab === 'available' && (
        <DriverAvailableOrdersList
          availableOrders={availableOrders}
          currentDriverId={currentDriver.id}
          isOnline={isOnline}
          acceptingOrderId={acceptingOrderId}
          onSelectOrder={setSelectedOrder}
          onAcceptDelivery={handleAcceptOrder}
        />
      )}

      {subTab === 'active' && (
        <DriverActiveOrdersList
          activeOrders={activeOrders}
          onNavigateToMap={onNavigateToMap}
        />
      )}

      {subTab === 'completed' && (
        <DriverCompletedOrdersList completedOrders={completedOrders} />
      )}

      {selectedOrder && (
        <DriverOrderDetailsModal
          order={selectedOrder}
          isOnline={isOnline}
          isAccepting={acceptingOrderId === selectedOrder.id}
          onClose={() => setSelectedOrder(null)}
          onAccept={handleAcceptOrder}
        />
      )}
    </div>
  );
};
