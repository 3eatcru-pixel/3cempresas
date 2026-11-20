import React from 'react';
import { Package, X, CheckCircle } from 'lucide-react';
import { MenuItem, Supplier } from '../../../../types';

interface InventoryAdjustModalProps {
  item: MenuItem;
  suppliers?: Supplier[];
  adjustQty: number;
  setAdjustQty: (qty: number) => void;
  adjustReason: string;
  setAdjustReason: (reason: string) => void;
  minStockAlert: number;
  setMinStockAlert: (min: number) => void;
  supplierName: string;
  setSupplierName: (s: string) => void;
  unitCost: number;
  setUnitCost: (cost: number) => void;
  expirationDate: string;
  setExpirationDate: (date: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const InventoryAdjustModal: React.FC<InventoryAdjustModalProps> = ({
  item,
  suppliers = [],
  adjustQty,
  setAdjustQty,
  adjustReason,
  setAdjustReason,
  minStockAlert,
  setMinStockAlert,
  supplierName,
  setSupplierName,
  unitCost,
  setUnitCost,
  expirationDate,
  setExpirationDate,
  onClose,
  onSubmit,
}) => {
  const isInbound = Number(adjustQty) > 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <form
        onSubmit={onSubmit}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl my-auto"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Ajuste de Estoque & Lote</h3>
              <p className="text-xs text-slate-400">
                {item.name} · Saldo Atual: {item.stock} un
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-semibold">Motivo da Movimentação</label>
            <select
              value={adjustReason}
              onChange={e => setAdjustReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none focus:border-indigo-500"
            >
              <option value="Entrada de Mercadoria">Entrada de Mercadoria (Nota Fiscal)</option>
              <option value="Inventário Físico">Ajuste de Balanço / Inventário Físico</option>
              <option value="Quebra / Perda">Baixa por Avaria / Quebra / Vencimento</option>
              <option value="Devolução">Devolução de Pedido</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-semibold">
                Quantidade (+ entrada / - perda)
              </label>
              <input
                type="number"
                required
                value={adjustQty}
                onChange={e => setAdjustQty(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 text-sm font-mono tabular-nums font-bold text-emerald-400 p-2.5 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-semibold">Alerta Mínimo (un)</label>
              <input
                type="number"
                min="0"
                value={minStockAlert}
                onChange={e => setMinStockAlert(Math.max(0, Number(e.target.value)))}
                className="w-full bg-slate-950 border border-slate-800 text-sm font-mono tabular-nums font-bold text-amber-400 p-2.5 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {isInbound && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <p className="text-[11px] font-semibold text-slate-300">Dados do Lote de Entrada (FEFO)</p>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Custo Unit. (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitCost}
                    onChange={e => setUnitCost(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono tabular-nums text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Validade</label>
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={e => setExpirationDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Fornecedor</label>
                {suppliers.length > 0 ? (
                  <select
                    value={supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="">Entrada Direta ({adjustReason})</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.companyName}>{s.companyName}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                )}
              </div>
            </div>
          )}

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Novo Saldo Projetado:</span>
            <span className="font-mono tabular-nums font-bold text-white text-sm">
              {Math.max(0, item.stock + Number(adjustQty))} un
            </span>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" /> Confirmar Ajuste
          </button>
        </div>
      </form>
    </div>
  );
};

