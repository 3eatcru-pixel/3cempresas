import React from 'react';
import { ArrowUpRight, Plus } from 'lucide-react';

interface FinanceBalanceOverviewProps {
  finalCashCalculated: number;
  totalRevenue: number;
  totalExpense: number;
  hideDre?: boolean;
}

export const FinanceBalanceOverview: React.FC<FinanceBalanceOverviewProps> = ({
  finalCashCalculated,
  totalRevenue,
  totalExpense,
  hideDre = false,
}) => {
  return (
    <div className={`lg:col-span-2 grid grid-cols-1 ${hideDre ? '' : 'sm:grid-cols-2'} gap-4`}>
      <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
          <ArrowUpRight className="w-20 h-20 text-emerald-400" />
        </div>
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          Saldo em Caixa (Dinheiro)
        </div>
        <div className="text-3xl font-black text-white font-mono">
          R$ {finalCashCalculated.toFixed(2)}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase">
          <Plus className="w-3 h-3" /> Conciliado agora
        </div>
      </div>

      {!hideDre && (
        <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Resumo do Dia (Consolidado)
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-[10px] font-bold uppercase">Entradas:</span>
              <span className="text-emerald-400 font-mono font-black text-sm">
                R$ {totalRevenue.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-[10px] font-bold uppercase">
                Saídas/Sangrias:
              </span>
              <span className="text-red-400 font-mono font-black text-sm">
                R$ {totalExpense.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
