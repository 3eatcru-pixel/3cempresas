import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Plus, Save, Trash2, X } from 'lucide-react';
import { InventoryBatch, MenuItem, RecipeIngredient } from '../../../../types';

interface InventoryBomEditorModalProps {
  item: MenuItem;
  inventoryBatches: InventoryBatch[];
  onClose: () => void;
  onSave: (itemId: string, recipe: RecipeIngredient[], calculatedCost: number) => Promise<void>;
}

const UNITS: RecipeIngredient['unit'][] = ['KG', 'G', 'L', 'UN'];

export const InventoryBomEditorModal: React.FC<InventoryBomEditorModalProps> = ({
  item,
  inventoryBatches,
  onClose,
  onSave,
}) => {
  const [rows, setRows] = useState<RecipeIngredient[]>(
    item.recipe && item.recipe.length > 0
      ? item.recipe.map((r) => ({ ...r }))
      : []
  );
  const [selectedBatchSku, setSelectedBatchSku] = useState('');
  const [customSku, setCustomSku] = useState('');
  const [customName, setCustomName] = useState('');
  const [qtyInput, setQtyInput] = useState('0.15');
  const [unitInput, setUnitInput] = useState<RecipeIngredient['unit']>('KG');
  const [isSaving, setIsSaving] = useState(false);

  const uniqueBatchIngredients = useMemo(() => {
    const map = new Map<string, { sku: string; name: string; unitCost: number; qtyAvail: number }>();
    for (const b of inventoryBatches) {
      const sku = b.sku || b.itemId || b.id;
      if (!sku) continue;
      const prev = map.get(sku);
      const cost = Number(b.costPerUnit ?? b.costPrice) || 0;
      if (!prev) {
        map.set(sku, {
          sku,
          name: b.itemName || sku,
          unitCost: cost,
          qtyAvail: Number(b.quantity) || 0,
        });
      } else {
        prev.qtyAvail += Number(b.quantity) || 0;
        if (cost > 0 && prev.unitCost === 0) prev.unitCost = cost;
      }
    }
    return Array.from(map.values());
  }, [inventoryBatches]);

  const resolveUnitCost = (ingredientId: string): number => {
    const found = uniqueBatchIngredients.find((u) => u.sku === ingredientId);
    return found ? found.unitCost : 0;
  };

  const calculatedCmv = useMemo(() => {
    return Math.round(
      rows.reduce((sum, r) => sum + (Number(r.quantityRequired) || 0) * resolveUnitCost(r.ingredientId), 0) * 100
    ) / 100;
  }, [rows, uniqueBatchIngredients]);

  const cmvPercent = item.price > 0 ? (calculatedCmv / item.price) * 100 : 0;
  const marginValue = Math.max(0, item.price - calculatedCmv);

  const handleAddRow = () => {
    const qty = Math.max(0.001, parseFloat(qtyInput.replace(',', '.')) || 0);
    if (selectedBatchSku) {
      const batchRef = uniqueBatchIngredients.find((u) => u.sku === selectedBatchSku);
      if (!batchRef) return;
      setRows((prev) => [
        ...prev,
        {
          ingredientId: batchRef.sku,
          ingredientName: batchRef.name,
          quantityRequired: qty,
          unit: unitInput,
        },
      ]);
      setSelectedBatchSku('');
      setQtyInput('0.15');
      return;
    }

    if (!customSku.trim() || !customName.trim()) return;
    setRows((prev) => [
      ...prev,
      {
        ingredientId: customSku.trim().toUpperCase(),
        ingredientName: customName.trim(),
        quantityRequired: qty,
        unit: unitInput,
      },
    ]);
    setCustomSku('');
    setCustomName('');
    setQtyInput('0.15');
  };

  const handleUpdateRowQty = (idx: number, nextQty: number) => {
    setRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, quantityRequired: Math.max(0.001, nextQty) } : row))
    );
  };

  const handleUpdateRowUnit = (idx: number, nextUnit: RecipeIngredient['unit']) => {
    setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, unit: nextUnit } : row)));
  };

  const handleRemoveRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(item.id, rows, calculatedCmv);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-auto">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Ficha Técnica (BOM) · {item.name}</h3>
              <p className="text-xs text-slate-400">
                {item.category} · Preço de venda R$ {item.price.toFixed(2)} · Baixa automática FEFO no PDV
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Theoretical CMV Summary Strip */}
        <div className="grid grid-cols-3 gap-3 bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-center font-mono tabular-nums">
          <div>
            <p className="text-[10px] text-slate-400 font-sans font-semibold">CMV Teórico</p>
            <p className="text-base font-bold text-amber-400">R$ {calculatedCmv.toFixed(2)}</p>
          </div>
          <div className="border-x border-slate-800">
            <p className="text-[10px] text-slate-400 font-sans font-semibold">% sobre Venda</p>
            <p className={`text-base font-bold ${cmvPercent <= 35 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {cmvPercent.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-sans font-semibold">Margem Bruta</p>
            <p className="text-base font-bold text-emerald-400">R$ {marginValue.toFixed(2)}</p>
          </div>
        </div>

        {/* Ingredients Table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-[11px] font-semibold text-slate-400">
              <tr>
                <th className="px-3 py-2.5">Insumo / SKU</th>
                <th className="px-3 py-2.5 text-right">Consumo</th>
                <th className="px-3 py-2.5">Unid.</th>
                <th className="px-3 py-2.5 text-right">Custo Calc.</th>
                <th className="px-3 py-2.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((row, idx) => {
                const unitCost = resolveUnitCost(row.ingredientId);
                const lineCost = unitCost * (Number(row.quantityRequired) || 0);
                return (
                  <tr key={`${row.ingredientId}-${idx}`} className="hover:bg-slate-900/60">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-white">{row.ingredientName}</p>
                      <p className="text-[10px] font-mono text-slate-500">{row.ingredientId}</p>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={row.quantityRequired}
                        onChange={(e) => handleUpdateRowQty(idx, parseFloat(e.target.value) || 0.001)}
                        className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-right font-mono tabular-nums text-white"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.unit}
                        onChange={(e) => handleUpdateRowUnit(idx, e.target.value as RecipeIngredient['unit'])}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-300">
                      {unitCost > 0 ? `R$ ${lineCost.toFixed(2)}` : 'Sem lote'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                        title="Remover insumo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Nenhum insumo vinculado ainda. Adicione abaixo a partir dos lotes ou crie um novo SKU.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add Ingredient Form */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-slate-200">Adicionar Insumo à Composição</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400">Selecionar Lote Existente (Recomendado)</label>
              <select
                value={selectedBatchSku}
                onChange={(e) => setSelectedBatchSku(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="">-- Ou informar SKU manual abaixo --</option>
                {uniqueBatchIngredients.map((u) => (
                  <option key={u.sku} value={u.sku}>
                    {u.name} ({u.sku}) · Saldo {u.qtyAvail.toFixed(2)} · R$ {u.unitCost.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Qtd. por Porção</label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Unidade</label>
                <select
                  value={unitInput}
                  onChange={(e) => setUnitInput(e.target.value as RecipeIngredient['unit'])}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {!selectedBatchSku && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <input
                type="text"
                placeholder="SKU do Insumo (ex: RAW-CARNE-01)"
                value={customSku}
                onChange={(e) => setCustomSku(e.target.value.toUpperCase())}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                placeholder="Nome do Insumo (ex: Blend Bovino Angus)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleAddRow}
            disabled={!selectedBatchSku && (!customSku.trim() || !customName.trim())}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus size={14} /> Inserir Insumo na Ficha
          </button>
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="flex-[2] py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save size={15} /> {isSaving ? 'Salvando Ficha...' : 'Salvar Ficha Técnica & Atualizar CMV'}
          </button>
        </div>
      </div>
    </div>
  );
};
