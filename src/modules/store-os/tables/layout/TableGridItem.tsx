import React, { useState } from 'react';
import { Utensils, Trash2 } from 'lucide-react';
import { DiningTable, TableStatus } from '../../../../types';

interface TableGridItemProps {
  table: DiningTable;
  totalConsumption: number;
  openOrdersCount?: number;
  onTableAction: (tableId: string, currentStatus: TableStatus) => void;
  onDeleteTable?: (tableId: string) => void;
}

export const TableGridItem: React.FC<TableGridItemProps> = ({
  table,
  totalConsumption,
  openOrdersCount = 0,
  onTableAction,
  onDeleteTable,
}) => {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div
      onClick={() => {
        if (!confirmingDelete) onTableAction(table.id, table.status);
      }}
      className={`relative group cursor-pointer bg-slate-900/80 rounded-2xl border transition-colors overflow-hidden ${
        table.status === 'FREE'
          ? 'border-emerald-500/25 hover:border-emerald-500/50'
          : table.status === 'OCCUPIED'
          ? 'border-pink-500/40 hover:border-pink-400/70'
          : 'border-amber-500/60 hover:border-amber-400'
      }`}
    >
      {/* Table Delete button when FREE (2-step inline confirmation) */}
      {table.status === 'FREE' && onDeleteTable && (
        <div
          className="absolute top-2 left-2 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {confirmingDelete ? (
            <div className="flex items-center gap-1 bg-slate-950/95 p-1 rounded-lg border border-rose-500/40">
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  onDeleteTable(table.id);
                }}
                className="px-1.5 py-0.5 bg-rose-500 hover:bg-rose-400 text-slate-950 rounded text-[9px] font-black uppercase cursor-pointer"
              >
                Excluir
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px] font-bold cursor-pointer"
              >
                Não
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="p-1.5 rounded-lg bg-slate-950/80 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Remover mesa"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Table Status Indicator */}
      <div
        className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full ${
          table.status === 'FREE'
            ? 'bg-emerald-500'
            : table.status === 'OCCUPIED'
            ? 'bg-pink-500'
            : 'bg-amber-400'
        }`}
      />

      <div className="p-5 flex flex-col items-center text-center gap-2">
        <div
          className={`p-3 rounded-2xl ${
            table.status === 'FREE'
              ? 'bg-emerald-500/10 text-emerald-400'
              : table.status === 'OCCUPIED'
              ? 'bg-pink-500/10 text-pink-400'
              : 'bg-amber-500/15 text-amber-400'
          }`}
        >
          <Utensils className="w-6 h-6" />
        </div>
        <div className="flex flex-col">
          <span className="text-white font-black text-lg font-mono tabular-nums">
            #{table.tableNumber}
          </span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            {table.status === 'FREE'
              ? 'Livre'
              : table.status === 'OCCUPIED'
              ? 'Ocupada'
              : 'Conta Pedida'}
          </span>
        </div>
      </div>

      {(table.status === 'OCCUPIED' || table.status === 'BILL_REQUESTED' || totalConsumption > 0) && (
        <div className="px-4 pb-4 space-y-2">
          <div className="flex justify-between items-center text-[10px] font-mono tabular-nums">
            <span className="text-slate-500">
              {openOrdersCount > 0 ? `${openOrdersCount} PED:` : 'CONSUMO:'}
            </span>
            <span className="text-white font-black">R$ {totalConsumption.toFixed(2)}</span>
          </div>
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${table.status === 'BILL_REQUESTED' ? 'bg-amber-400' : 'bg-pink-500'}`}
              style={{ width: table.status === 'BILL_REQUESTED' ? '100%' : '65%' }}
            />
          </div>
        </div>
      )}

      <div
        className={`p-2 text-center text-[9px] font-black uppercase transition-colors ${
          table.status === 'FREE'
            ? 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950'
            : table.status === 'OCCUPIED'
            ? 'bg-pink-500/10 text-pink-300 group-hover:bg-pink-500 group-hover:text-slate-950'
            : 'bg-amber-500/20 text-amber-300 group-hover:bg-amber-500 group-hover:text-slate-950'
        }`}
      >
        {table.status === 'FREE'
          ? 'Abrir Mesa'
          : table.status === 'OCCUPIED'
          ? 'Solicitar Conta'
          : 'Fechar Conta & Receber'}
      </div>
    </div>
  );
};
