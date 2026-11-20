import React, { useMemo } from 'react';
import { BarChart3, AlertTriangle } from 'lucide-react';
import { MenuItem } from '../../../../types';

interface InventoryStatsProps {
  storeItems: MenuItem[];
  lowStockItems: MenuItem[];
}

export const InventoryStats: React.FC<InventoryStatsProps> = ({ storeItems, lowStockItems }) => {
  const valuation = useMemo(() => {
    let totalUnits = 0;
    let totalCostValue = 0;
    let totalRetailValue = 0;
    for (const item of storeItems) {
      if (item.specs?.segment === 'SERVICE') continue;
      const qty = Math.max(0, Number(item.stock) || 0);
      totalUnits += qty;
      totalCostValue += qty * (Number(item.costPrice) || 0);
      totalRetailValue += qty * (Number(item.price) || 0);
    }
    return { totalUnits, totalCostValue, totalRetailValue };
  }, [storeItems]);

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" /> Métricas de Saldo
        </div>
        <div className="space-y-2.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-400">Total SKUs</span>
            <span className="text-white font-mono tabular-nums font-bold">{storeItems.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Unidades físicas</span>
            <span className="text-slate-200 font-mono tabular-nums font-semibold">
              {valuation.totalUnits.toLocaleString('pt-BR')} un
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Itens críticos</span>
            <span className="text-rose-400 font-mono tabular-nums font-bold">{lowStockItems.length}</span>
          </div>
          <div className="pt-2.5 border-t border-slate-800 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Valor em custo</span>
              <span className="text-slate-200 font-mono tabular-nums font-semibold">
                R$ {valuation.totalCostValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Potencial venda</span>
              <span className="text-emerald-400 font-mono tabular-nums font-bold">
                R$ {valuation.totalRetailValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 p-5 rounded-2xl border border-rose-500/20 space-y-3">
        <div className="text-xs font-semibold text-rose-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Alertas de Ruptura
        </div>
        {lowStockItems.slice(0, 4).map((it) => {
          const min = Math.max(1, it.minStockAlert || 5);
          const pct = Math.min(100, Math.max(4, Math.round((Math.max(0, it.stock) / min) * 100)));
          return (
            <div key={it.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-white truncate">{it.name}</span>
                <span className="font-mono tabular-nums text-rose-400 shrink-0">
                  {it.stock}/{min}
                </span>
              </div>
              <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {lowStockItems.length === 0 && (
          <p className="text-xs text-slate-500">Nenhum item abaixo do estoque mínimo.</p>
        )}
      </div>
    </div>
  );
};

