import React from 'react';
import { X, Store, MapPin, Phone, ShieldCheck, CreditCard, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Order } from '../../../types';
import { formatDriverPaymentLabel } from './DriverAvailableOrdersList';

interface DriverOrderDetailsModalProps {
  order: Order;
  isOnline?: boolean;
  isAccepting?: boolean;
  onClose: () => void;
  onAccept: (orderId: string) => void;
}

export const DriverOrderDetailsModal: React.FC<DriverOrderDetailsModalProps> = ({
  order,
  isOnline = true,
  isAccepting = false,
  onClose,
  onAccept,
}) => {
  const deliveryFee = Number(order.deliveryFee) || 0;
  const courierTip = Number((order as any).courierTip) || 0;
  const payout = Math.round((deliveryFee + courierTip) * 100) / 100;
  const isPaid = order.paymentStatus === 'PAID';
  const paymentLabel = formatDriverPaymentLabel(order.paymentMethod);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#111922] border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl text-white relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="w-12 h-12 rounded-2xl bg-[#00CCBC]/10 text-[#00CCBC] flex items-center justify-center">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-black text-base text-white">{order.storeName}</h3>
            <span className="text-xs text-slate-400 font-mono">Pedido {order.code}</span>
          </div>
        </div>

        <div className="space-y-2.5">
          <h4 className="text-xs font-bold text-[#00CCBC]">Itens do Pedido:</h4>
          <div className="bg-[#0B1117] rounded-2xl p-3.5 border border-slate-800 space-y-2 text-xs">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-slate-200">
                <span>
                  {item.quantity}x {item.name}
                </span>
                <span className="font-mono text-slate-400 tabular-nums">
                  R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}
                </span>
              </div>
            ))}

            <div className="border-t border-slate-800 pt-2 flex justify-between items-center font-bold">
              <span className="text-slate-400">
                Repasse da Entrega{courierTip > 0 ? ' (Taxa + Gorjeta)' : ''}:
              </span>
              <span className="text-[#00CCBC] font-mono tabular-nums">
                R$ {payout.toFixed(2).replace('.', ',')}
              </span>
            </div>

            <div className="border-t border-slate-800 pt-2 flex justify-between items-center font-extrabold text-sm">
              <span>Total do Pedido:</span>
              <span className="text-white font-mono tabular-nums">R$ {order.total.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>
        </div>

        {/* Payment Method & Settlement Instruction */}
        <div className="bg-[#0B1117] p-3.5 rounded-2xl border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1.5 font-bold">
              <CreditCard className="w-3.5 h-3.5 text-[#00CCBC]" /> Forma de Pagamento:
            </span>
            <span className="font-black text-white">{paymentLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-bold">Instrução na Entrega:</span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-black text-[10px] border ${
                isPaid
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              {isPaid ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> PAGO (APENAS VALIDAR PIN)
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3" /> COBRAR R$ {order.total.toFixed(2).replace('.', ',')}
                </>
              )}
            </span>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <h4 className="font-bold text-slate-400">Destino de Entrega:</h4>
          <div className="flex items-start gap-2.5 bg-[#0B1117] p-3.5 rounded-2xl border border-slate-800">
            <MapPin className="w-4 h-4 text-[#00CCBC] mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-bold text-white">{order.customerName}</p>
              <p className="text-slate-400 text-xs">{order.deliveryAddress}</p>
              {order.customerPhone && (
                <p className="text-slate-400 text-xs flex items-center gap-1 mt-1 font-mono">
                  <Phone className="w-3 h-3 text-[#00CCBC]" /> {order.customerPhone}
                </p>
              )}
              {order.notes && (
                <p className="text-amber-300 text-[11px] bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg mt-1">
                  Obs: {order.notes}
                </p>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={!isOnline || isAccepting}
          onClick={() => onAccept(order.id)}
          className="w-full h-12 bg-[#00CCBC] hover:bg-[#00b5a7] disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-black text-xs rounded-2xl shadow-xl flex items-center justify-center gap-2 cursor-pointer"
        >
          {isAccepting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Aceitando Corrida...
            </>
          ) : !isOnline ? (
            'Ative seu turno (Online) para aceitar'
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" /> Aceitar Corrida Agora
            </>
          )}
        </button>
      </div>
    </div>
  );
};
