import React from 'react';
import { X } from 'lucide-react';
import { DiningTable } from '../../../types';

interface WaiterModalHeaderProps {
  selectedTable: DiningTable;
  waiterName: string;
  onClose: () => void;
}

export const WaiterModalHeader: React.FC<WaiterModalHeaderProps> = ({
  selectedTable,
  waiterName,
  onClose,
}) => {
  return (
    <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-black font-mono text-base">
          #{selectedTable.tableNumber}
        </div>
        <div>
          <h3 className="font-extrabold text-base text-white flex items-center gap-2">
            Atendimento Mesa {selectedTable.tableNumber}
            <span
              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                selectedTable.status === 'FREE'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : selectedTable.status === 'OCCUPIED'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-purple-500/20 text-purple-400'
              }`}
            >
              {selectedTable.status}
            </span>
          </h3>
          <p className="text-[11px] text-slate-400">
            Atendente: <span className="text-amber-400 font-semibold">{waiterName}</span> • Consumo:{' '}
            <span className="font-mono text-white font-bold">R$ {selectedTable.totalAmount.toFixed(2)}</span>
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};
