import React from 'react';
import { Users, X } from 'lucide-react';
import { DiningTable, Order } from '../../../../types';

interface TableHeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  tables: DiningTable[];
  orders: Order[];
}

export const TableHeatmapModal: React.FC<TableHeatmapModalProps> = ({
  isOpen,
  onClose,
  tables,
  orders,
}) => {
  if (!isOpen) return null;

  const occupiedCount = tables.filter((t) => t.status !== 'FREE').length;
  const occupancyRate = tables.length ? Math.round((occupiedCount / tables.length) * 100) : 0;

  const tableOrders = orders.filter((o) => o.channel === 'TABLE' && o.status !== 'CANCELLED');
  const avgTableTicket = (
    tableOrders.length > 0
      ? tableOrders.reduce((sum, o) => sum + o.total, 0) / tableOrders.length
      : 0
  ).toFixed(2);

  const halfIdx = Math.ceil(tables.length / 2);
  const zoneATables = tables.slice(0, halfIdx);
  const zoneBTables = tables.slice(halfIdx);
  const zoneAOccupied = zoneATables.filter((t) => t.status !== 'FREE').length;
  const zoneBOccupied = zoneBTables.filter((t) => t.status !== 'FREE').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-base">
                Mapa de Calor & Ocupação do Salão
              </h3>
              <p className="text-xs text-slate-400">
                Análise em tempo real de ocupação e faturamento por mesa.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <div className="text-[10px] text-slate-500 font-bold uppercase">Taxa de Ocupação</div>
            <div className="text-xl font-black text-pink-400 font-mono mt-1">{occupancyRate}%</div>
          </div>
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <div className="text-[10px] text-slate-500 font-bold uppercase">Comandas Salão</div>
            <div className="text-xl font-black text-amber-400 font-mono mt-1">{tableOrders.length}</div>
          </div>
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <div className="text-[10px] text-slate-500 font-bold uppercase">Ticket Médio Mesa</div>
            <div className="text-xl font-black text-emerald-400 font-mono mt-1">
              R$ {avgTableTicket}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Status das Zonas do Salão
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-300">Setor Principal ({zoneATables.length} mesas)</span>
              <span className="text-emerald-400 font-mono font-bold">
                {zoneAOccupied}/{zoneATables.length} ocupadas
              </span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-300">Setor Secundário ({zoneBTables.length} mesas)</span>
              <span className="text-blue-400 font-mono font-bold">
                {zoneBOccupied}/{zoneBTables.length} ocupadas
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Fechar Mapa
          </button>
        </div>
      </div>
    </div>
  );
};
