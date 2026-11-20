import React from 'react';
import { Navigation, MapPin, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import { Order } from '../../../types';
import { formatDriverPaymentLabel } from './DriverAvailableOrdersList';

interface DriverActiveOrdersListProps {
  activeOrders: Order[];
  onNavigateToMap: () => void;
}

export const DriverActiveOrdersList: React.FC<DriverActiveOrdersListProps> = ({
  activeOrders,
  onNavigateToMap,
}) => {
  if (activeOrders.length === 0) {
    return (
      <div className="bg-[#111922] border border-slate-800 rounded-2xl p-8 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-[#00CCBC]/10 border border-[#00CCBC]/20 text-[#00CCBC] flex items-center justify-center mx-auto">
          <Navigation className="w-7 h-7" />
        </div>
        <h3 className="text-base font-extrabold text-white">Nenhuma corrida em andamento</h3>
        <p className="text-xs text-slate-400">
          Aceite uma entrega na aba &quot;Disponíveis&quot; para iniciar a rota GPS.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      {activeOrders.map((order) => {
        const payout =
          Math.round(((Number(order.deliveryFee) || 0) + (Number((order as any).courierTip) || 0)) * 100) / 100;
        const isPaid = order.paymentStatus === 'PAID';
        const paymentLabel = formatDriverPaymentLabel(order.paymentMethod);

        return (
          <div
            key={order.id}
            className="bg-[#111922] border-2 border-[#00CCBC] rounded-2xl p-4 space-y-3 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-[#00CCBC] text-slate-950 font-mono">
                {order.code} • Em Rota
              </span>
              <span className="text-sm font-black text-[#00CCBC] font-mono tabular-nums">
                R$ {payout.toFixed(2).replace('.', ',')}
              </span>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-sm font-extrabold text-white">{order.storeName}</h4>
              <p className="text-xs text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#00CCBC] shrink-0" />
                <span>{order.deliveryAddress}</span>
              </p>
              <p className="text-xs text-slate-400">
                Cliente: <strong className="text-white">{order.customerName}</strong>
                {order.customerPhone ? ` (${order.customerPhone})` : ''}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-300 bg-[#0B1117] px-2 py-0.5 rounded-md border border-slate-800">
                  <CreditCard className="w-3 h-3 text-[#00CCBC]" />
                  {paymentLabel}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md border ${
                    isPaid
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {isPaid ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> PAGO ONLINE
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3" /> COBRAR R$ {order.total.toFixed(2).replace('.', ',')}
                    </>
                  )}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onNavigateToMap}
              className="w-full h-12 bg-[#00CCBC] hover:bg-[#00b5a7] text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Navigation className="w-4 h-4" /> Abrir Navegação GPS &amp; PIN
            </button>
          </div>
        );
      })}
    </div>
  );
};
