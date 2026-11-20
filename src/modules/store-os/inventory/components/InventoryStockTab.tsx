import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { MenuItem } from '../../../../types';

interface InventoryStockTabProps {
  storeItems: MenuItem[];
  onAdjust: (item: MenuItem) => void;
}

export const InventoryStockTab: React.FC<InventoryStockTabProps> = ({ storeItems, onAdjust }) => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CRITICAL' | 'OK'>('ALL');

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return storeItems.filter((item) => {
      const isSvc = item.specs?.segment === 'SERVICE';
      const isCritical = !isSvc && item.stock <= (item.minStockAlert ?? 5);
      if (statusFilter === 'CRITICAL' && !isCritical) return false;
      if (statusFilter === 'OK' && (isCritical || isSvc)) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    });
  }, [storeItems, query, statusFilter]);

  return (
    <div className="lg:col-span-3 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por nome, SKU ou categoria..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
          {(
            [
              { id: 'ALL', label: 'Todos' },
              { id: 'CRITICAL', label: 'Críticos' },
              { id: 'OK', label: 'Estáveis' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-950/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-5 py-3.5">Item / SKU</th>
              <th className="px-5 py-3.5">Categoria</th>
              <th className="px-5 py-3.5 text-right">Saldo Atual</th>
              <th className="px-5 py-3.5 text-right">Mínimo</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filteredItems.map(item => {
              const isSvc = item.specs?.segment === 'SERVICE';
              const minAlert = item.minStockAlert ?? 5;
              const isCritical = !isSvc && item.stock <= minAlert;
              return (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{item.name}</span>
                      <span className="text-[10px] font-mono text-slate-500">{item.sku || '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-400">{item.category}</td>
                  <td className="px-5 py-3.5 text-right font-mono tabular-nums">
                    {isSvc ? (
                      <span className="text-xs font-bold text-indigo-400">Ilimitado</span>
                    ) : (
                      <span className={`text-xs font-bold ${isCritical ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {item.stock} un
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono tabular-nums text-xs text-slate-400">
                    {isSvc ? '—' : `${minAlert} un`}
                  </td>
                  <td className="px-5 py-3.5 text-xs font-semibold">
                    {isSvc ? (
                      <span className="text-indigo-400">Serviço</span>
                    ) : isCritical ? (
                      <span className="text-rose-400">Crítico</span>
                    ) : (
                      <span className="text-emerald-400">Estável</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {isSvc ? (
                      <span className="text-[11px] text-slate-500">Via Agenda</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAdjust(item)}
                        className="px-2.5 py-1 text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Ajustar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-xs text-slate-500">
                  Nenhum item corresponde ao filtro atual.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

