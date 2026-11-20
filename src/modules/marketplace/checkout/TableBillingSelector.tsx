import React from 'react';
import { Receipt, CreditCard } from 'lucide-react';

interface TableBillingSelectorProps {
  isOpenTableTab: boolean;
  onChangeMode: (mode: 'TABLE_BILL' | 'PAY_NOW') => void;
}

export const TableBillingSelector: React.FC<TableBillingSelectorProps> = ({
  isOpenTableTab,
  onChangeMode,
}) => {
  return (
    <div className="space-y-2">
      <label className="text-[10px] text-slate-400 font-bold uppercase">
        Acerto da Rodada na Mesa:
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChangeMode('TABLE_BILL')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            isOpenTableTab
              ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-black">
            <Receipt className="w-3.5 h-3.5" />
            <span>Comanda Aberta</span>
          </div>
          <p className="text-[10px] opacity-80 mt-1 leading-snug">
            Envia direto à cozinha. Pague tudo só ao fechar a mesa.
          </p>
        </button>
        <button
          type="button"
          onClick={() => onChangeMode('PAY_NOW')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            !isOpenTableTab
              ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300 shadow-sm'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-black">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Pagar Agora</span>
          </div>
          <p className="text-[10px] opacity-80 mt-1 leading-snug">
            Quitar esta rodada agora via PIX, Cartão ou Dinheiro.
          </p>
        </button>
      </div>
    </div>
  );
};
