import React, { useEffect } from 'react';
import { DollarSign, CreditCard, Sparkles, Utensils, ShoppingBag, Wallet } from 'lucide-react';
import { StorePaymentMethod } from '../../../types';

interface PaymentSelectorProps {
  payment: StorePaymentMethod;
  setPayment: (p: StorePaymentMethod) => void;
  pixKey: string;
  acceptedPaymentMethods?: StorePaymentMethod[];
  cashChangeFor?: string;
  setCashChangeFor?: (val: string) => void;
}

const ALL_PAYMENT_OPTIONS: {
  id: StorePaymentMethod;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'PIX', label: 'PIX Instantâneo', icon: DollarSign },
  { id: 'CREDIT_CARD', label: 'Cartão de Crédito', icon: CreditCard },
  { id: 'DEBIT_CARD', label: 'Cartão de Débito', icon: CreditCard },
  { id: 'CASH', label: 'Dinheiro na Entrega', icon: DollarSign },
  { id: 'BOLETO', label: 'Vale-Refeição', icon: Utensils },
  { id: 'BANK_TRANSFER', label: 'Vale-Alimentação', icon: ShoppingBag },
  { id: 'PAYMENT_LINK', label: 'Carteira Digital', icon: Wallet },
];

export const PaymentSelector: React.FC<PaymentSelectorProps> = ({
  payment,
  setPayment,
  pixKey,
  acceptedPaymentMethods,
  cashChangeFor = '',
  setCashChangeFor,
}) => {
  const visibleOptions =
    Array.isArray(acceptedPaymentMethods) && acceptedPaymentMethods.length > 0
      ? ALL_PAYMENT_OPTIONS.filter((opt) => acceptedPaymentMethods.includes(opt.id))
      : ALL_PAYMENT_OPTIONS;

  const effectiveOptions = visibleOptions.length > 0 ? visibleOptions : ALL_PAYMENT_OPTIONS;

  useEffect(() => {
    if (effectiveOptions.length > 0 && !effectiveOptions.some((opt) => opt.id === payment)) {
      setPayment(effectiveOptions[0].id);
    }
  }, [effectiveOptions, payment, setPayment]);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-slate-400 font-bold uppercase">Forma de Pagamento:</label>
        {payment === 'PIX' && (
          <span className="text-[9px] font-mono text-emerald-400 font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> 0% de taxas bancárias
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {effectiveOptions.map((opt) => (
          <button
            type="button"
            key={opt.id}
            onClick={() => setPayment(opt.id)}
            className={`p-2.5 rounded-xl border flex items-center gap-2 font-bold transition-all cursor-pointer ${
              payment === opt.id
                ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-black'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <opt.icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{opt.label}</span>
          </button>
        ))}
      </div>

      {payment === 'PIX' && (
        <p className="text-[10px] text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800/80 font-mono">
          {pixKey ? (
            <>
              Chave PIX da loja: <span className="text-white font-bold">{pixKey}</span> (Cai direto na conta)
            </>
          ) : (
            <span className="text-amber-400">
              Chave PIX será confirmada pelo estabelecimento após o envio do pedido.
            </span>
          )}
        </p>
      )}

      {payment === 'CASH' && setCashChangeFor && (
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 space-y-1">
          <label className="block text-[10px] font-bold text-amber-300 uppercase">
            Precisa de troco para quanto? (Opcional)
          </label>
          <input
            type="text"
            value={cashChangeFor}
            onChange={(e) => setCashChangeFor(e.target.value)}
            placeholder="Ex: 50,00 ou 100,00 (deixe vazio se não precisar)"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      )}
    </div>
  );
};
