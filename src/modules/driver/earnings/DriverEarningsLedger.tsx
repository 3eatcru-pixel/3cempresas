import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export interface DriverLedgerEntry {
  id: string;
  kind: 'PAYOUT' | 'EARNING';
  title: string;
  subtitle: string;
  amount: number;
  timestamp: number;
}

interface DriverEarningsLedgerProps {
  ledgerEntries: DriverLedgerEntry[];
  showAllHistory: boolean;
  onToggleShowAll: () => void;
  formatBRL: (val: number) => string;
}

export const DriverEarningsLedger: React.FC<DriverEarningsLedgerProps> = ({
  ledgerEntries,
  showAllHistory,
  onToggleShowAll,
  formatBRL,
}) => {
  const visibleLedger = showAllHistory ? ledgerEntries : ledgerEntries.slice(0, 6);

  return (
    <div className="bg-[#111922] border border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-white uppercase tracking-wider">Histórico de Repasses e Saques</h3>
        {ledgerEntries.length > 6 && (
          <button
            type="button"
            onClick={onToggleShowAll}
            className="text-[11px] text-[#00CCBC] font-bold hover:underline cursor-pointer"
          >
            {showAllHistory ? 'Mostrar menos' : `Ver tudo (${ledgerEntries.length})`}
          </button>
        )}
      </div>

      {visibleLedger.length === 0 ? (
        <div className="p-4 text-center text-xs text-slate-500 bg-[#0B1117] rounded-xl border border-slate-800">
          Nenhum repasse ou saque registrado ainda nesta conta.
        </div>
      ) : (
        <div className="space-y-2 text-xs">
          {visibleLedger.map((item) => {
            const isPayout = item.kind === 'PAYOUT';
            return (
              <div key={item.id} className="flex items-center justify-between p-2.5 bg-[#0B1117] rounded-xl border border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isPayout ? 'bg-amber-500/10 text-amber-400' : 'bg-[#00CCBC]/10 text-[#00CCBC]'
                    }`}
                  >
                    {isPayout ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-white block truncate">{item.title}</span>
                    <span className="text-[10px] text-slate-400">{item.subtitle}</span>
                  </div>
                </div>
                <span className={`font-bold font-mono tabular-nums shrink-0 ${isPayout ? 'text-amber-300' : 'text-[#00CCBC]'}`}>
                  {isPayout ? '- ' : '+ '}
                  {formatBRL(item.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
