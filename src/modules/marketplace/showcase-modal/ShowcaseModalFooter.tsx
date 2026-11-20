import React from 'react';
import { ArrowRight, Calendar } from 'lucide-react';

interface ShowcaseModalFooterProps {
  onCheckout: () => void;
  isServiceStore?: boolean;
  isStoreClosed?: boolean;
  onSchedule?: () => void;
}

export const ShowcaseModalFooter: React.FC<ShowcaseModalFooterProps> = ({
  onCheckout,
  isServiceStore = false,
  isStoreClosed = false,
  onSchedule,
}) => {
  return (
    <div className="bg-[#fff9f2] border-t border-stone-200 px-5 py-3 flex flex-wrap items-center justify-between text-xs text-stone-700 font-medium gap-3 shrink-0">
      <div className="flex items-center gap-3">
        <span className="font-bold text-stone-800">Formas de Pagamento:</span>
        <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-stone-600">
          <span className="bg-white px-2 py-0.5 rounded border border-stone-200">PIX DIRETO</span>
          <span className="bg-white px-2 py-0.5 rounded border border-stone-200">CARTÃO</span>
          <span className="bg-white px-2 py-0.5 rounded border border-stone-200">DINHEIRO</span>
        </div>
      </div>

      {isServiceStore && onSchedule ? (
        <button
          type="button"
          onClick={onSchedule}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95"
        >
          <Calendar className="w-4 h-4" />
          <span>Agendar Horário</span>
        </button>
      ) : (
        <button
          type="button"
          disabled={isStoreClosed}
          onClick={onCheckout}
          className={`px-5 py-2.5 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all ${
            isStoreClosed
              ? 'bg-stone-300 text-stone-600 cursor-not-allowed'
              : 'bg-orange-500 hover:bg-orange-600 text-white cursor-pointer active:scale-95'
          }`}
        >
          <span>{isStoreClosed ? 'Estabelecimento Fechado' : 'Ver Sacola & Finalizar Pedido'}</span>
          {!isStoreClosed && <ArrowRight className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
};
