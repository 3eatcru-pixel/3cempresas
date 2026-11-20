import React, { useState } from 'react';
import {
  Phone,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Store,
  PackageCheck,
  MapPin,
} from 'lucide-react';
import { Order } from '../../../types';
import { formatDriverPaymentLabel } from './DriverAvailableOrdersList';

interface DriverCustomerDetailsCardProps {
  order: Order;
  storePhone?: string;
  onShowNotification: (msg: string) => void;
  onOperationalCheckIn?: (stage: 'ARRIVED_AT_STORE' | 'PICKED_UP' | 'ARRIVED_AT_CUSTOMER') => void;
}

export const DriverCustomerDetailsCard: React.FC<DriverCustomerDetailsCardProps> = ({
  order,
  storePhone,
  onShowNotification,
  onOperationalCheckIn,
}) => {
  const [activeStage, setActiveStage] = useState<
    'ARRIVED_AT_STORE' | 'PICKED_UP' | 'ARRIVED_AT_CUSTOMER' | null
  >(null);

  const isPaid = order.paymentStatus === 'PAID';
  const paymentLabel = formatDriverPaymentLabel(order.paymentMethod);
  const changeFor = Number((order as any).changeFor) || 0;
  const changeAmount = Number((order as any).changeAmount) || 0;

  const handleStageClick = (
    stage: 'ARRIVED_AT_STORE' | 'PICKED_UP' | 'ARRIVED_AT_CUSTOMER',
    label: string
  ) => {
    setActiveStage(stage);
    if (onOperationalCheckIn) {
      onOperationalCheckIn(stage);
    } else {
      onShowNotification(`Status operacional enviado ao estabelecimento: ${label} (${order.code})`);
    }
  };

  return (
    <div className="bg-[#111922] border border-slate-800 rounded-2xl p-4 space-y-3.5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase">Cliente Final</span>
          <h4 className="text-sm font-extrabold text-white">{order.customerName}</h4>
        </div>
        <div className="flex items-center gap-2">
          {storePhone && (
            <a
              href={`tel:${storePhone}`}
              className="min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold text-xs transition-all"
              title="Ligar para o Estabelecimento"
            >
              <Store className="w-3.5 h-3.5 text-[#00CCBC]" /> Loja
            </a>
          )}
          {order.customerPhone ? (
            <a
              href={`tel:${order.customerPhone}`}
              className="min-h-[38px] flex items-center gap-1.5 px-3.5 py-1.5 bg-[#00CCBC]/10 text-[#00CCBC] border border-[#00CCBC]/30 rounded-xl font-bold text-xs hover:bg-[#00CCBC]/20 transition-all"
            >
              <Phone className="w-3.5 h-3.5" /> Cliente
            </a>
          ) : (
            <button
              type="button"
              onClick={() => onShowNotification('Cliente sem telefone informado neste pedido.')}
              className="min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/70 text-slate-400 border border-slate-700 rounded-xl font-bold text-xs cursor-not-allowed"
            >
              <Phone className="w-3.5 h-3.5" /> Sem Tel.
            </button>
          )}
        </div>
      </div>

      {/* Payment & Collection Status Banner */}
      <div
        className={`p-3 rounded-xl border flex flex-col gap-1.5 text-xs ${
          isPaid
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
            : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5" />
            Pagamento: <strong>{paymentLabel}</strong>
          </span>
          <span className="font-black uppercase text-[10px] flex items-center gap-1 font-mono tabular-nums">
            {isPaid ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> PAGO (NÃO COBRAR)
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> COBRAR R$ {order.total.toFixed(2).replace('.', ',')}
              </>
            )}
          </span>
        </div>
        {!isPaid && changeFor > 0 && (
          <div className="text-[11px] font-mono tabular-nums text-amber-300 border-t border-amber-500/20 pt-1">
            Troco para R$ {changeFor.toFixed(2).replace('.', ',')} (Devolver R$ {changeAmount.toFixed(2).replace('.', ',')})
          </div>
        )}
      </div>

      <div className="text-xs text-slate-300 space-y-1.5">
        <p>
          Endereço: <strong className="text-white">{order.deliveryAddress}</strong>
        </p>
        <p className="text-slate-400">
          Itens ({order.items.length}):{' '}
          {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
        </p>
        {order.notes && (
          <p className="text-amber-300 text-[11px] bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg">
            Observações: {order.notes}
          </p>
        )}
      </div>

      {/* Operational Communication Check-ins with Store OS */}
      <div className="pt-2 border-t border-slate-800 space-y-1.5">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
          Comunicação Operacional com a Loja (Tempo Real)
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => handleStageClick('ARRIVED_AT_STORE', 'Motorista na Loja')}
            className={`py-2 px-2 rounded-xl border text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeStage === 'ARRIVED_AT_STORE'
                ? 'bg-[#00CCBC]/20 border-[#00CCBC] text-[#00CCBC]'
                : 'bg-[#0B1117] border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Na Loja</span>
          </button>
          <button
            type="button"
            onClick={() => handleStageClick('PICKED_UP', 'Pedido Coletado / Em Deslocamento')}
            className={`py-2 px-2 rounded-xl border text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeStage === 'PICKED_UP'
                ? 'bg-[#00CCBC]/20 border-[#00CCBC] text-[#00CCBC]'
                : 'bg-[#0B1117] border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <PackageCheck className="w-3.5 h-3.5" />
            <span>Coletado</span>
          </button>
          <button
            type="button"
            onClick={() => handleStageClick('ARRIVED_AT_CUSTOMER', 'Motorista no Endereço do Cliente')}
            className={`py-2 px-2 rounded-xl border text-[10px] font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              activeStage === 'ARRIVED_AT_CUSTOMER'
                ? 'bg-[#00CCBC]/20 border-[#00CCBC] text-[#00CCBC]'
                : 'bg-[#0B1117] border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>No Cliente</span>
          </button>
        </div>
      </div>
    </div>
  );
};
