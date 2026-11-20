import React, { useState } from 'react';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { MenuItem } from '../../../types';

export interface CheckoutCartEntry {
  menuItem: MenuItem;
  quantity: number;
  variantId?: string;
  variantLabel?: string;
  notes?: string;
}

interface CheckoutInteractiveCartBagProps {
  cart: CheckoutCartEntry[];
  onClearCart: () => void;
  onUpdateQuantity: (entryKey: string, nextQuantity: number) => void;
  onRemoveItem: (entryKey: string) => void;
}

export const getCartEntryKey = (ci: CheckoutCartEntry) =>
  `${ci.menuItem.id}::${ci.variantId || ''}::${ci.notes || ''}`;

export const CheckoutInteractiveCartBag: React.FC<CheckoutInteractiveCartBagProps> = ({
  cart,
  onClearCart,
  onUpdateQuantity,
  onRemoveItem,
}) => {
  const isCartEmpty = cart.length === 0;
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5 font-mono tabular-nums">
          <ShoppingBag className="w-3.5 h-3.5" /> Itens na Sacola (
          {cart.reduce((s, c) => s + c.quantity, 0)})
        </span>
        {cart.length > 0 && (
          confirmClear ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onClearCart();
                  setConfirmClear(false);
                }}
                className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black cursor-pointer"
              >
                Limpar Tudo
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold cursor-pointer"
              >
                Voltar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" /> Limpar Sacola
            </button>
          )
        )}
      </div>

      {isCartEmpty ? (
        <div className="py-4 text-center text-xs text-slate-500">
          Sua sacola está vazia. Adicione produtos da vitrine para continuar.
        </div>
      ) : (
        <div className="space-y-2 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
          {cart.map((ci) => {
            const entryKey = getCartEntryKey(ci);
            const unitPrice = ci.menuItem.price;
            return (
              <div
                key={entryKey}
                className="flex items-center justify-between gap-2 bg-slate-900/80 border border-slate-800/80 rounded-xl p-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">
                    {ci.menuItem.name}
                    {ci.variantLabel ? (
                      <span className="text-amber-400 font-normal"> ({ci.variantLabel})</span>
                    ) : null}
                  </div>
                  {ci.notes && (
                    <div className="text-[10px] text-slate-400 truncate italic">
                      Obs: {ci.notes}
                    </div>
                  )}
                  <div className="text-[11px] font-mono text-emerald-400 font-bold">
                    R$ {(unitPrice * ci.quantity).toFixed(2)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(entryKey, ci.quantity - 1)}
                    className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                    title="Diminuir quantidade"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-mono font-bold text-white w-5 text-center">
                    {ci.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(entryKey, ci.quantity + 1)}
                    className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
                    title="Aumentar quantidade"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(entryKey)}
                    className="w-6 h-6 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center ml-0.5 cursor-pointer"
                    title="Remover item"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
