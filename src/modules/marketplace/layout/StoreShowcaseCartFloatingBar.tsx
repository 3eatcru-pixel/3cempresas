import React from 'react';
import { ShoppingBag, Calendar, UtensilsCrossed } from 'lucide-react';

interface StoreShowcaseCartFloatingBarProps {
  cartTotal: number;
  onOpenCheckout: () => void;
  isService?: boolean;
  isStoreClosed?: boolean;
  isTableMode?: boolean;
  tableNumber?: number;
  onOpenReservations?: () => void;
}

export const StoreShowcaseCartFloatingBar: React.FC<StoreShowcaseCartFloatingBarProps> = ({
  cartTotal,
  onOpenCheckout,
  isService,
  isStoreClosed = false,
  isTableMode,
  tableNumber,
  onOpenReservations
}) => {
  if (isService) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-slideUp">
        <button
          onClick={onOpenReservations}
          className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-2xl flex items-center justify-between transition-all cursor-pointer border-2 border-slate-950"
        >
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-indigo-200" />
            <span className="text-xs uppercase tracking-wider">Agendar Atendimento / Horário</span>
          </div>
          <span className="text-[11px] font-bold text-indigo-200 underline">Selecionar Data →</span>
        </button>
      </div>
    );
  }

  if (isStoreClosed) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-slideUp">
        <div className="w-full py-3.5 px-6 bg-rose-950/95 text-rose-200 font-black rounded-2xl shadow-2xl flex items-center justify-between border border-rose-500/40">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-rose-400" />
            <span className="text-xs uppercase tracking-wider">Loja Fechada • Pedidos Pausados</span>
          </div>
          {cartTotal > 0 && (
            <span className="font-mono text-sm font-extrabold text-rose-300">R$ {cartTotal.toFixed(2)}</span>
          )}
        </div>
      </div>
    );
  }

  if (cartTotal <= 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-slideUp">
      <button
        onClick={onOpenCheckout}
        className={`w-full py-3.5 px-6 font-black rounded-2xl shadow-2xl flex items-center justify-between transition-all cursor-pointer border-2 border-slate-950 ${
          isTableMode
            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {isTableMode ? <UtensilsCrossed className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
          <span className="text-xs uppercase tracking-wider">
            {isTableMode
              ? `Enviar Pedido • Mesa ${String(tableNumber || 1).padStart(2, '0')}`
              : 'Ver Sacola & Pedir'}
          </span>
        </div>
        <span className="font-mono text-base font-extrabold">R$ {cartTotal.toFixed(2)}</span>
      </button>
    </div>
  );
};
