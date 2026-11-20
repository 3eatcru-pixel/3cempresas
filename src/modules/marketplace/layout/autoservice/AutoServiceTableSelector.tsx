import React from 'react';
import { DiningTable } from '../../../../types';

interface AutoServiceTableSelectorProps {
  storeId: string;
  tables: DiningTable[];
  currentTable: number;
  sessionToken: string;
  isLightMode: boolean;
  onSelectTable: (n: number) => void;
}

export const AutoServiceTableSelector: React.FC<AutoServiceTableSelectorProps> = ({
  storeId,
  tables,
  currentTable,
  sessionToken,
  isLightMode,
  onSelectTable,
}) => {
  return (
    <div
      className={`p-5 rounded-2xl border space-y-3 ${
        isLightMode ? 'bg-stone-50 border-stone-200' : 'bg-slate-950 border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className={`text-xs font-bold uppercase tracking-wider ${isLightMode ? 'text-stone-700' : 'text-slate-300'}`}>
          Selecione o Número da Sua Mesa:
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-slate-500">TOKEN: {sessionToken}</span>
          <span className="text-xs font-mono font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
            MESA {String(currentTable).padStart(2, '0')} ATIVA
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => {
          const tableObj = tables.find(t => t.tableNumber === n && (!t.storeId || t.storeId === storeId));
          const isSelected = currentTable === n;
          const status = tableObj?.status || 'FREE';

          return (
            <button
              key={n}
              type="button"
              onClick={() => onSelectTable(n)}
              className={`p-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-between border ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg scale-105'
                  : status === 'OCCUPIED'
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:border-rose-400'
                  : status === 'BILL_REQUESTED'
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : isLightMode
                  ? 'bg-white text-stone-700 border-stone-200 hover:border-amber-400'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-amber-400'
              }`}
            >
              <span>Mesa {String(n).padStart(2, '0')}</span>
              <span className="text-[9px] font-mono mt-1 opacity-80">
                {status === 'OCCUPIED' ? 'EM USO' : status === 'BILL_REQUESTED' ? 'CONTA' : 'LIVRE'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
