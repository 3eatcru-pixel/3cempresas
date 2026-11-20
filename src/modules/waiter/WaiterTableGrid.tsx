import React, { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { DiningTable } from '../../types';

interface WaiterTableGridProps {
  tables: DiningTable[];
  onSelectTable: (table: DiningTable) => void;
}

type TableStatusFilter = 'ALL' | 'FREE' | 'OCCUPIED' | 'BILL_REQUESTED';

const TABLE_STATUS_META: Record<
  DiningTable['status'],
  { label: string; textClass: string; cardClass: string }
> = {
  FREE: {
    label: 'Livre',
    textClass: 'text-emerald-400',
    cardClass: 'bg-slate-950 border-emerald-500/40 hover:border-emerald-400',
  },
  OCCUPIED: {
    label: 'Ocupada',
    textClass: 'text-amber-400',
    cardClass: 'bg-amber-950/25 border-amber-500/70 hover:border-amber-400',
  },
  BILL_REQUESTED: {
    label: 'Pediu Conta',
    textClass: 'text-purple-400',
    cardClass: 'bg-purple-950/30 border-purple-500 hover:border-purple-400',
  },
  CLEANING: {
    label: 'Limpeza',
    textClass: 'text-slate-400',
    cardClass: 'bg-slate-950 border-slate-800 opacity-70',
  },
};

export const WaiterTableGrid: React.FC<WaiterTableGridProps> = ({
  tables,
  onSelectTable,
}) => {
  const [statusFilter, setStatusFilter] = useState<TableStatusFilter>('ALL');

  const counts = useMemo(
    () => ({
      all: tables.length,
      free: tables.filter((t) => t.status === 'FREE').length,
      occupied: tables.filter((t) => t.status === 'OCCUPIED').length,
      bill: tables.filter((t) => t.status === 'BILL_REQUESTED').length,
    }),
    [tables]
  );

  const visibleTables = useMemo(() => {
    if (statusFilter === 'ALL') return tables;
    return tables.filter((t) => t.status === statusFilter);
  }, [tables, statusFilter]);

  return (
    <div className="bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-400" />
          Mapa de Mesas do Salão
        </h2>

        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto">
          {(
            [
              { id: 'ALL', label: `Todas (${counts.all})` },
              { id: 'FREE', label: `Livres (${counts.free})` },
              { id: 'OCCUPIED', label: `Ocupadas (${counts.occupied})` },
              { id: 'BILL_REQUESTED', label: `Pediu Conta (${counts.bill})` },
            ] as Array<{ id: TableStatusFilter; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap tabular-nums cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {visibleTables.map((table) => {
          const isFree = table.status === 'FREE';
          const meta = TABLE_STATUS_META[table.status] || TABLE_STATUS_META.FREE;

          return (
            <button
              key={table.id}
              type="button"
              onClick={() => onSelectTable(table)}
              className={`p-4 sm:p-5 rounded-2xl border text-left transition-colors flex flex-col justify-between min-h-[136px] cursor-pointer ${meta.cardClass}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-bold text-white font-mono tabular-nums">
                  Mesa {table.tableNumber}
                </span>
                <span className={`text-xs font-semibold shrink-0 ${meta.textClass}`}>
                  {meta.label}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="text-slate-400 flex items-center justify-between font-mono tabular-nums">
                  <span className="font-sans">Capacidade: {table.capacity}p</span>
                  {table.openedAt && <span className="text-amber-400">{table.openedAt}</span>}
                </div>

                {!isFree && (
                  <div className="text-white font-mono tabular-nums font-bold flex justify-between pt-1.5 border-t border-slate-800">
                    <span className="font-sans font-normal text-slate-400">Consumo</span>
                    <span className="text-amber-400">
                      R$ {table.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}

        {visibleTables.length === 0 && (
          <div className="col-span-full py-12 text-center text-xs text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800">
            Nenhuma mesa com o status selecionado no momento.
          </div>
        )}
      </div>
    </div>
  );
};

