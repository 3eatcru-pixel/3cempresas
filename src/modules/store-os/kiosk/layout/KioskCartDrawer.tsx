import React, { useState } from 'react';
import {
  ShoppingBag,
  Minus,
  Plus,
  CheckCircle2,
  QrCode,
  CreditCard,
  Banknote,
  Link2,
} from 'lucide-react';
import { MenuItem, StorePaymentMethod } from '../../../../types';

export interface KioskCartItem {
  item: MenuItem;
  qty: number;
  notes?: string;
}

interface KioskCartDrawerProps {
  kioskCart: KioskCartItem[];
  totalAmount: number;
  acceptedPaymentMethods?: StorePaymentMethod[];
  onUpdateQty: (index: number, delta: number) => void;
  onFinishOrder: (paymentMethod?: StorePaymentMethod) => void;
}

const KIOSK_PAYMENT_OPTIONS: {
  id: StorePaymentMethod;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'PIX', label: 'PIX', icon: QrCode },
  { id: 'CREDIT_CARD', label: 'CRÉDITO', icon: CreditCard },
  { id: 'DEBIT_CARD', label: 'DÉBITO', icon: CreditCard },
  { id: 'CASH', label: 'CAIXA', icon: Banknote },
  { id: 'PAYMENT_LINK', label: 'LINK', icon: Link2 },
];

export const KioskCartDrawer: React.FC<KioskCartDrawerProps> = ({
  kioskCart,
  totalAmount,
  acceptedPaymentMethods,
  onUpdateQty,
  onFinishOrder,
}) => {
  const enabledIds: StorePaymentMethod[] =
    Array.isArray(acceptedPaymentMethods) && acceptedPaymentMethods.length > 0
      ? acceptedPaymentMethods
      : KIOSK_PAYMENT_OPTIONS.map((o) => o.id);
  const visibleOptions = KIOSK_PAYMENT_OPTIONS.filter((o) => enabledIds.includes(o.id));
  const [selectedMethod, setSelectedMethod] = useState<StorePaymentMethod>(
    visibleOptions[0]?.id || 'PIX'
  );

  return (
    <div className="w-80 sm:w-96 bg-slate-900/90 border-l border-slate-800 p-4 flex flex-col justify-between shrink-0 shadow-2xl">
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-sm text-white">Sua Comanda</span>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            {kioskCart.reduce((acc, c) => acc + c.qty, 0)} itens
          </span>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 custom-scrollbar pr-1">
          {kioskCart.map((cartItem, idx) => (
            <div
              key={idx}
              className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/90 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white truncate max-w-[65%]">
                  {cartItem.item.name}
                </span>
                <span className="font-mono text-xs text-amber-400 font-bold">
                  R$ {(cartItem.item.price * cartItem.qty).toFixed(2)}
                </span>
              </div>

              {cartItem.notes && (
                <div className="text-[10px] text-amber-400/80 italic font-mono bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/20">
                  Obs: {cartItem.notes}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => onUpdateQty(idx, -1)}
                  className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="font-mono text-xs font-black text-white px-1.5">
                  {cartItem.qty}
                </span>
                <button
                  onClick={() => onUpdateQty(idx, 1)}
                  className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          {kioskCart.length === 0 && (
            <div className="text-center py-16 text-slate-500 space-y-2">
              <ShoppingBag className="w-10 h-10 mx-auto text-slate-700" />
              <p className="text-xs">Seu carrinho está vazio.</p>
              <p className="text-[10px] text-slate-600">
                Toque nos itens ao lado para adicionar ao pedido.
              </p>
            </div>
          )}
        </div>

        {/* Total, Payment Method and Finish Button */}
        <div className="pt-3 border-t border-slate-800 space-y-3">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Total a Pagar:</span>
            <span className="text-lg font-mono font-black text-emerald-400">
              R$ {totalAmount.toFixed(2)}
            </span>
          </div>

          <div className="space-y-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
              Como deseja pagar?
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {visibleOptions.map((opt) => {
                const Icon = opt.icon;
                const active = selectedMethod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedMethod(opt.id)}
                    className={`py-2 px-1.5 rounded-xl border text-[9px] font-black uppercase flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            disabled={kioskCart.length === 0}
            onClick={() => onFinishOrder(selectedMethod)}
            className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
              kioskCart.length > 0
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 cursor-pointer active:scale-98'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" /> Finalizar Pedido ({KIOSK_PAYMENT_OPTIONS.find((o) => o.id === selectedMethod)?.label || selectedMethod})
          </button>
        </div>
      </div>
    </div>
  );
};
