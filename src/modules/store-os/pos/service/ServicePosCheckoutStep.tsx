import React from 'react';
import {
  User,
  CreditCard,
  QrCode,
  Banknote,
  FileText,
  Landmark,
  Link2,
} from 'lucide-react';
import { MenuItem, AdminUser, StorePaymentMethod } from '../../../../types';

interface ServicePosCheckoutStepProps {
  selectedProfessional: AdminUser | null;
  clientName?: string;
  selectedServices: { menuItem: MenuItem; qty: number }[];
  total: number;
  commissionRate?: number;
  setCommissionRate?: (rate: number) => void;
  commissionAmount?: number;
  acceptedPaymentMethods?: StorePaymentMethod[];
  onFinish: (method: StorePaymentMethod) => void;
}

const SERVICE_PAYMENT_METHODS: {
  id: StorePaymentMethod;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  primary?: boolean;
}[] = [
  { id: 'PIX', label: 'PIX', icon: QrCode, primary: true },
  { id: 'CREDIT_CARD', label: 'CARTÃO CRÉDITO', icon: CreditCard, primary: true },
  { id: 'DEBIT_CARD', label: 'CARTÃO DÉBITO', icon: CreditCard },
  { id: 'CASH', label: 'DINHEIRO', icon: Banknote },
  { id: 'BOLETO', label: 'BOLETO BANCÁRIO', icon: FileText },
  { id: 'BANK_TRANSFER', label: 'TED / TRANSFERÊNCIA', icon: Landmark },
  { id: 'PAYMENT_LINK', label: 'LINK DE PAGAMENTO', icon: Link2 },
];

export const ServicePosCheckoutStep: React.FC<ServicePosCheckoutStepProps> = ({
  selectedProfessional,
  clientName,
  selectedServices,
  total,
  commissionRate = 10,
  setCommissionRate,
  commissionAmount = Number(((total * commissionRate) / 100).toFixed(2)),
  acceptedPaymentMethods,
  onFinish,
}) => {
  const enabledIds: StorePaymentMethod[] =
    Array.isArray(acceptedPaymentMethods) && acceptedPaymentMethods.length > 0
      ? acceptedPaymentMethods
      : SERVICE_PAYMENT_METHODS.map((m) => m.id);
  const visibleMethods = SERVICE_PAYMENT_METHODS.filter((m) => enabledIds.includes(m.id));

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-black uppercase tracking-tight">Resumo do Atendimento</h2>
        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
          Confirme os valores, comissão e forma de pagamento ({visibleMethods.length} modos)
        </p>
      </div>

      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <User size={14} className="text-indigo-400" />
            <div>
              <span className="text-xs font-black text-white uppercase block">
                {selectedProfessional?.name}
              </span>
              {clientName && (
                <span className="text-[10px] text-slate-400">Cliente: {clientName}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400">COMISSÃO:</span>
            {setCommissionRate ? (
              <select
                value={commissionRate}
                onChange={(e) => setCommissionRate(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[10px] font-mono font-bold text-indigo-300 outline-none"
              >
                {[0, 5, 10, 15, 20, 25, 30, 40, 50].map((pct) => (
                  <option key={pct} value={pct}>
                    {pct}% (R$ {((total * pct) / 100).toFixed(2)})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[10px] font-mono text-indigo-300 font-bold">
                {commissionRate}% (R$ {commissionAmount.toFixed(2)})
              </span>
            )}
          </div>
        </div>
        <div className="p-4 space-y-3">
          {selectedServices.map(it => (
            <div key={it.menuItem.id} className="flex justify-between items-center">
              <div className="text-xs font-bold text-slate-300">
                {it.qty > 1 ? `${it.qty}x ` : ''}{it.menuItem.name}
              </div>
              <div className="text-xs font-mono font-black text-white">
                R$ {(it.menuItem.price * it.qty).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-2">
          {commissionAmount > 0 && (
            <div className="flex justify-between items-center text-[10px] font-mono text-indigo-400">
              <span>Repasse Profissional ({commissionRate}%)</span>
              <span>R$ {commissionAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-slate-400 uppercase">Total a Pagar</span>
            <span className="text-2xl font-mono font-black text-emerald-400">R$ {total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {visibleMethods.map((method) => {
          const Icon = method.icon;
          return (
            <button
              key={method.id}
              onClick={() => onFinish(method.id)}
              className={`${
                method.id === 'CREDIT_CARD'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black'
                  : 'bg-slate-800 hover:bg-slate-700 text-white font-bold border border-slate-700'
              } py-3.5 px-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow transition-all active:scale-95 cursor-pointer`}
            >
              <Icon size={15} />
              <span>{method.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
