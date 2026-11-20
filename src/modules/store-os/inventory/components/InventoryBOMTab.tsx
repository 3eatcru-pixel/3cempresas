import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, CheckCircle, Edit3, PackagePlus, Layers } from 'lucide-react';
import { MenuItem, InventoryBatch } from '../../../../types';

interface InventoryBOMTabProps {
  storeItems: MenuItem[];
  inventoryBatches: InventoryBatch[];
  onRecalculate: (item: MenuItem, calculatedCost: number) => void;
  onEditBom: (item: MenuItem) => void;
  onOpenNewBatch: () => void;
}

export const InventoryBOMTab: React.FC<InventoryBOMTabProps> = ({
  storeItems,
  inventoryBatches,
  onRecalculate,
  onEditBom,
  onOpenNewBatch,
}) => {
  const [batchFilter, setBatchFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRING'>('ALL');

  const resolveIngredientUnitCost = (ingredientId: string): number => {
    const matches = inventoryBatches.filter(
      (b) => b.sku === ingredientId || b.itemId === ingredientId
    );
    if (matches.length === 0) return 0;
    const active = matches.find((b) => b.status === 'ACTIVE' && b.quantity > 0) || matches[0];
    return Number(active.costPerUnit ?? active.costPrice) || 0;
  };

  const sortedBatches = useMemo(() => {
    const nowMs = Date.now();
    const soonMs = nowMs + 15 * 86400000;
    return [...inventoryBatches]
      .filter((b) => {
        const expMs = b.expirationDate ? new Date(b.expirationDate).getTime() : NaN;
        if (batchFilter === 'ACTIVE') return b.quantity > 0 && (!Number.isFinite(expMs) || expMs >= nowMs);
        if (batchFilter === 'EXPIRING') return b.quantity > 0 && Number.isFinite(expMs) && expMs <= soonMs;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(a.expirationDate || '2099-12-31').getTime() -
          new Date(b.expirationDate || '2099-12-31').getTime()
      );
  }, [inventoryBatches, batchFilter]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-slate-900/90 p-5 rounded-2xl border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="font-bold text-white text-base flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-400" />
            <span>Engenharia de Cardápio · Ficha Técnica (BOM) & CMV</span>
          </h4>
          <p className="text-xs text-slate-400">
            Configure os insumos de cada item para baixa automática FEFO a cada venda no PDV e controle real do CMV.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenNewBatch}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <PackagePlus size={15} /> Novo Lote de Insumo
          </button>
        </div>
      </div>

      {/* Product BOM Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {storeItems.map((item) => {
          const hasRecipe = Boolean(item.recipe && item.recipe.length > 0);
          const recipeCost = hasRecipe
            ? item.recipe!.reduce((sum, ing) => {
                const unitCost = resolveIngredientUnitCost(ing.ingredientId);
                return sum + ing.quantityRequired * unitCost;
              }, 0)
            : 0;
          const totalCost = hasRecipe && recipeCost > 0
            ? Math.round(recipeCost * 100) / 100
            : Number(item.costPrice) || 0;
          const cmvPercent = item.price > 0 ? (totalCost / item.price) * 100 : 0;

          return (
            <div key={item.id} className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-amber-400 truncate">{item.category}</p>
                    <h4 className="font-bold text-white text-sm mt-0.5 truncate">{item.name}</h4>
                  </div>
                  <span className={`text-xs font-mono tabular-nums font-bold shrink-0 ${
                    cmvPercent <= 35 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    CMV {cmvPercent.toFixed(1)}%
                  </span>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                  <div className="text-[10px] font-semibold text-slate-500 pb-1 border-b border-slate-800 flex justify-between">
                    <span>Insumos ({item.recipe?.length || 0})</span>
                    <span>Custo Lote</span>
                  </div>
                  {hasRecipe ? (
                    item.recipe!.map((ing, i) => {
                      const unitCost = resolveIngredientUnitCost(ing.ingredientId);
                      const cost = ing.quantityRequired * unitCost;
                      return (
                        <div key={i} className="flex justify-between items-center text-[11px] text-slate-300">
                          <span className="truncate pr-2">
                            {ing.ingredientName} ({ing.quantityRequired} {ing.unit.toLowerCase()})
                          </span>
                          <span className="font-mono tabular-nums text-slate-400 shrink-0">
                            {unitCost > 0 ? `R$ ${cost.toFixed(2)}` : 'Sem lote'}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-2 text-[11px] text-slate-500 flex justify-between items-center">
                      <span>Sem ficha técnica cadastrada</span>
                      <span className="font-mono tabular-nums text-slate-300">
                        CMV: R$ {(Number(item.costPrice) || 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono tabular-nums">
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <div className="text-[10px] font-sans text-slate-500">CMV</div>
                    <div className="font-bold text-rose-400">R$ {totalCost.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <div className="text-[10px] font-sans text-slate-500">Venda</div>
                    <div className="font-bold text-white">R$ {item.price.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                    <div className="text-[10px] font-sans text-slate-500">Margem</div>
                    <div className="font-bold text-emerald-400">+R$ {(item.price - totalCost).toFixed(2)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onEditBom(item)}
                    className="py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar Ficha</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRecalculate(item, totalCost)}
                    className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Aplicar CMV</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FEFO Batches & Expirations Control Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-emerald-400" />
            <div>
              <h4 className="text-sm font-bold text-white">Controle de Lotes & Validades (FEFO)</h4>
              <p className="text-[11px] text-slate-400">
                {inventoryBatches.length} lote(s) rastreados · Ordenados do vencimento mais próximo ao mais distante
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
            {(
              [
                { id: 'ALL', label: 'Todos' },
                { id: 'ACTIVE', label: 'Ativos' },
                { id: 'EXPIRING', label: 'Vencendo (15d)' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setBatchFilter(f.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  batchFilter === f.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-950/40 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Insumo / SKU</th>
                <th className="px-4 py-3">Lote / Origem</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-right">Custo Unit.</th>
                <th className="px-4 py-3">Validade</th>
                <th className="px-4 py-3">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {sortedBatches.map((batch) => {
                const expMs = batch.expirationDate ? new Date(batch.expirationDate).getTime() : NaN;
                const isExpired = Number.isFinite(expMs) && expMs < Date.now();
                const isExpiringSoon = !isExpired && Number.isFinite(expMs) && expMs <= Date.now() + 15 * 86400000;
                const isDepleted = Number(batch.quantity) <= 0;
                const cost = Number(batch.costPerUnit ?? batch.costPrice) || 0;
                return (
                  <tr key={batch.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{batch.itemName || batch.sku}</p>
                      <p className="text-[10px] font-mono text-slate-500">{batch.sku}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-slate-200">{batch.batchNumber}</p>
                      <p className="text-[10px] text-slate-500 truncate max-w-[180px]">{batch.supplierName || 'Manual'}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-white">
                      {Number(batch.quantity).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-300">
                      R$ {cost.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-300">
                      {batch.expirationDate || '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {isDepleted ? (
                        <span className="text-slate-500">Esgotado</span>
                      ) : isExpired ? (
                        <span className="text-rose-400">Vencido</span>
                      ) : isExpiringSoon ? (
                        <span className="text-amber-400">Vence em breve</span>
                      ) : (
                        <span className="text-emerald-400">Ativo</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sortedBatches.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Nenhum lote encontrado para este filtro. Clique em "Novo Lote de Insumo" para registrar uma entrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

