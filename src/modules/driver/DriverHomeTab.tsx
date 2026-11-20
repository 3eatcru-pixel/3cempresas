import React from 'react';
import { Package, Clock, Truck, Star, Lightbulb, ArrowRight, QrCode } from 'lucide-react';
import { Driver, Order } from '../../types';
import { DriverNotebookHeader } from './home/DriverNotebookHeader';
import { DriverEarningsChartCard } from './home/DriverEarningsChartCard';

interface DriverHomeTabProps {
  currentDriver: Driver;
  drivers: Driver[];
  currentDriverId: string;
  canSwitchDriver?: boolean;
  onSelectDriverId: (id: string) => void;
  onToggleDriverStatus: (id: string) => void;
  operationMode: 'STORE' | 'PLATFORM';
  onOpenModeModal: () => void;
  onOpenQrPairing?: () => void;
  onNavigateToOrders: () => void;
  onNavigateToMap?: () => void;
  completedOrders: Order[];
  totalAvailableCount: number;
  totalActiveCount: number;
  totalTodayCount: number;
  storeName?: string;
}

export const DriverHomeTab: React.FC<DriverHomeTabProps> = ({
  currentDriver,
  drivers,
  currentDriverId,
  canSwitchDriver = true,
  onSelectDriverId,
  onToggleDriverStatus,
  operationMode,
  onOpenModeModal,
  onOpenQrPairing,
  onNavigateToOrders,
  onNavigateToMap,
  completedOrders,
  totalAvailableCount,
  totalActiveCount,
  totalTodayCount,
  storeName,
}) => {
  const isOnline = currentDriver.status !== 'OFFLINE';

  return (
    <div className="space-y-4 pb-20 animate-fadeIn">
      <DriverNotebookHeader
        currentDriver={currentDriver}
        drivers={drivers}
        currentDriverId={currentDriverId}
        canSwitchDriver={canSwitchDriver}
        onSelectDriverId={onSelectDriverId}
        onToggleDriverStatus={onToggleDriverStatus}
        operationMode={operationMode}
        onOpenModeModal={onOpenModeModal}
        onOpenQrPairing={onOpenQrPairing}
        isOnline={isOnline}
        storeName={storeName}
      />

      {/* Summary KPI Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#111922] border border-slate-800 p-3.5 rounded-2xl text-center flex flex-col items-center justify-center">
          <div className="w-9 h-9 rounded-xl bg-[#00CCBC]/10 text-[#00CCBC] flex items-center justify-center mb-1.5">
            <Package className="w-4 h-4" />
          </div>
          <span className="text-xl font-black text-white tabular-nums">{totalTodayCount}</span>
          <span className="text-[11px] text-slate-400 font-medium">Pedidos Hoje</span>
        </div>

        <div className="bg-[#111922] border border-slate-800 p-3.5 rounded-2xl text-center flex flex-col items-center justify-center">
          <div className="w-9 h-9 rounded-xl bg-[#00CCBC] text-slate-950 flex items-center justify-center mb-1.5">
            <Truck className="w-4 h-4" />
          </div>
          <span className="text-xl font-black text-white tabular-nums">{totalActiveCount}</span>
          <span className="text-[11px] text-slate-400 font-medium">Em Rota</span>
        </div>

        <div className="bg-[#111922] border border-slate-800 p-3.5 rounded-2xl text-center flex flex-col items-center justify-center">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-1.5">
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-xl font-black text-white tabular-nums">{totalAvailableCount}</span>
          <span className="text-[11px] text-slate-400 font-medium">Aguardando</span>
        </div>
      </div>

      {/* Primary Action CTA */}
      <button
        type="button"
        onClick={totalActiveCount > 0 && onNavigateToMap ? onNavigateToMap : onNavigateToOrders}
        className="w-full h-12 bg-[#00CCBC] hover:bg-[#00b5a7] text-slate-950 font-black text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer tabular-nums"
      >
        <span>
          {totalActiveCount > 0
            ? `Continuar entrega em rota (${totalActiveCount})`
            : `Ver pedidos disponíveis (${totalAvailableCount})`}
        </span>
        <ArrowRight className="w-5 h-5" />
      </button>

      {/* Responsive Two-Column Desktop Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DriverEarningsChartCard
          walletBalance={currentDriver.walletBalance}
          completedOrders={completedOrders}
        />

        <div className="space-y-4">
          {/* Rider Score & Deliveries Card */}
          <div className="bg-[#111922] border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#00CCBC]/10 border border-[#00CCBC]/30 text-[#00CCBC] flex items-center justify-center font-bold">
                <Star className="w-6 h-6 fill-[#00CCBC]" />
              </div>
              <div>
                <span className="text-xs text-slate-400">Desempenho Geral</span>
                <div className="text-lg font-black text-white flex items-center gap-2 tabular-nums">
                  <span>{currentDriver.rating.toFixed(1)}</span>
                  <span className="text-[11px] font-bold text-[#00CCBC] bg-[#00CCBC]/10 px-2 py-0.5 rounded-md border border-[#00CCBC]/20">
                    {operationMode === 'STORE' ? 'Frota Própria' : 'Parceiro Verificado'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-slate-400 font-mono tabular-nums">
              <span className="text-white font-bold text-sm block">{currentDriver.totalDeliveries}</span>
              <span>entregas</span>
            </div>
          </div>

          {/* Own-Fleet QR Code Pairing & Safety Protocol Card */}
          <div className="bg-[#111922] border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-[#00CCBC]/15 text-[#00CCBC] border border-[#00CCBC]/30 rounded-xl mt-0.5 shrink-0">
                <Lightbulb className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-white">Protocolo de Coleta &amp; Entrega PIN</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Confira o código do pedido e o modo de pagamento na retirada, e solicite o PIN de 4 dígitos ao cliente para liberar o repasse imediato na carteira.
                </p>
              </div>
            </div>
            {onOpenQrPairing && (
              <button
                type="button"
                onClick={onOpenQrPairing}
                className="w-full py-2.5 bg-[#0B1117] hover:bg-slate-900 border border-[#00CCBC]/30 text-[#00CCBC] font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                Vincular / Trocar Loja de Frota Própria (QR Code ou PIN)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
