import React from 'react';
import { BarChart3, X, FileText, Printer } from 'lucide-react';
import { FinancialRecord } from '../../../../types';
import { getPlatformAdapters } from '../../../../core/platform/PlatformAdapter';

interface FinanceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeRecords: FinancialRecord[];
  totalRevenue: number;
  totalExpense: number;
}

export const FinanceHistoryModal: React.FC<FinanceHistoryModalProps> = ({
  isOpen,
  onClose,
  storeRecords,
  totalRevenue,
  totalExpense,
}) => {
  if (!isOpen) return null;

  const handlePrintReport = () => {
    const lines = [
      '========================================',
      '       RELATORIO FINANCEIRO STORE       ',
      '========================================',
      `Data Emissao: ${new Date().toLocaleString('pt-BR')}`,
      `Total Entradas: R$ ${totalRevenue.toFixed(2)}`,
      `Total Saidas:   R$ ${totalExpense.toFixed(2)}`,
      `Saldo Liquido:  R$ ${(totalRevenue - totalExpense).toFixed(2)}`,
      '----------------------------------------',
      'REGISTROS RECENTES:',
      ...storeRecords.slice(0, 20).map((r) => {
        const sign = r.type === 'RECEIVABLE' ? '+' : '-';
        return `${sign} R$ ${Number(r.amount).toFixed(2).padStart(8)} | ${String(r.description || '').slice(0, 20)}`;
      }),
      '========================================',
    ];
    void getPlatformAdapters().printer.printEscPosText(lines.join('\n'));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-scaleIn">
        <div className="p-6 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase italic tracking-tighter">
                Histórico Financeiro Completo
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase">
                Auditoria de todas as movimentações e conciliações
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-950 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
              <tr>
                <th className="px-4 py-4">Data/Hora</th>
                <th className="px-4 py-4">Descrição</th>
                <th className="px-4 py-4">Categoria</th>
                <th className="px-4 py-4">Forma PGTO</th>
                <th className="px-4 py-4 text-right">Valor (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {storeRecords
                .sort((a, b) => b.id.localeCompare(a.id))
                .map((rec) => {
                  const rawDate = rec.createdAt || rec.dueDate;
                  const d = rawDate ? new Date(rawDate) : null;
                  const dateStr = d && !isNaN(d.getTime())
                    ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : (rec.dueDate || 'N/D');

                  return (
                    <tr key={rec.id} className="hover:bg-slate-850 transition-colors text-[11px]">
                      <td className="px-4 py-3 font-mono text-slate-400">{dateStr}</td>
                      <td className="px-4 py-3 font-bold text-white uppercase tracking-tighter">
                        {rec.description}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold uppercase text-[9px] border border-slate-700">
                          {rec.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-bold uppercase">
                        {rec.paymentMethod || 'OUTROS'}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-black ${
                          rec.type === 'RECEIVABLE' ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {rec.type === 'RECEIVABLE' ? '+' : '-'} {rec.amount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {storeRecords.length === 0 && (
            <div className="py-20 text-center opacity-20 flex flex-col items-center gap-4">
              <FileText className="w-16 h-16" />
              <p className="font-black uppercase tracking-widest">Nenhum registro encontrado</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-950/80 border-t border-slate-800 flex justify-between items-center">
          <div className="flex gap-4">
            <div className="text-center">
              <div className="text-[9px] text-slate-500 font-bold uppercase">Total Recebido</div>
              <div className="text-sm font-black text-emerald-400 font-mono">
                R$ {totalRevenue.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-slate-500 font-bold uppercase">Total Saídas</div>
              <div className="text-sm font-black text-red-400 font-mono">
                R$ {totalExpense.toFixed(2)}
              </div>
            </div>
            <div className="text-center border-l border-slate-800 pl-4">
              <div className="text-[9px] text-slate-500 font-bold uppercase">Saldo Líquido</div>
              <div className="text-sm font-black text-white font-mono">
                R$ {(totalRevenue - totalExpense).toFixed(2)}
              </div>
            </div>
          </div>
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-white text-slate-950 font-black text-xs uppercase rounded-xl transition-all active:scale-95 shadow-lg cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Imprimir Relatório
          </button>
        </div>
      </div>
    </div>
  );
};
