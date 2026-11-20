import React, { useState } from 'react';
import { Calendar, CheckCircle, PackagePlus, X } from 'lucide-react';
import { InventoryBatch, Supplier } from '../../../../types';

interface InventoryBatchModalProps {
  storeId: string;
  tenantId?: string;
  suppliers: Supplier[];
  onClose: () => void;
  onSaveBatch: (
    batch: Omit<InventoryBatch, 'id'>,
    createPayable?: { dueDate: string; totalAmount: number; supplierName: string; invoiceNumber?: string }
  ) => Promise<void>;
}

export const InventoryBatchModal: React.FC<InventoryBatchModalProps> = ({
  storeId,
  tenantId,
  suppliers,
  onClose,
  onSaveBatch,
}) => {
  const [sku, setSku] = useState('');
  const [itemName, setItemName] = useState('');
  const [batchNumber, setBatchNumber] = useState(`LOT-${Date.now().toString().slice(-6)}`);
  const [quantity, setQuantity] = useState('10');
  const [costPerUnit, setCostPerUnit] = useState('0');
  const [expirationDate, setExpirationDate] = useState(
    new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]
  );
  const [supplierName, setSupplierName] = useState(suppliers[0]?.companyName || '');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [launchPayable, setLaunchPayable] = useState(false);
  const [payableDueDate, setPayableDueDate] = useState(
    new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const numericQty = Math.max(0, parseFloat(quantity.replace(',', '.')) || 0);
  const numericCost = Math.max(0, parseFloat(costPerUnit.replace(',', '.')) || 0);
  const totalCost = Math.round(numericQty * numericCost * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !itemName.trim() || numericQty <= 0) return;

    setIsSubmitting(true);
    try {
      const resolvedSupplier = supplierName.trim() || 'Entrada Manual';
      await onSaveBatch(
        {
          storeId,
          tenantId,
          itemId: sku.trim().toUpperCase(),
          sku: sku.trim().toUpperCase(),
          itemName: itemName.trim(),
          batchNumber: batchNumber.trim() || `LOT-${Date.now().toString().slice(-6)}`,
          quantity: numericQty,
          costPrice: numericCost,
          costPerUnit: numericCost,
          expirationDate,
          supplierName: invoiceNumber.trim()
            ? `${resolvedSupplier} (NF ${invoiceNumber.trim()})`
            : resolvedSupplier,
          status: 'ACTIVE',
        },
        launchPayable && totalCost > 0
          ? {
              dueDate: payableDueDate,
              totalAmount: totalCost,
              supplierName: resolvedSupplier,
              invoiceNumber: invoiceNumber.trim() || undefined,
            }
          : undefined
      );
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-auto"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <PackagePlus size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Registrar Lote de Insumo (FEFO)</h3>
              <p className="text-[11px] text-slate-400">
                Controle de matéria-prima por lote, custo unitário e data de validade
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400">SKU do Insumo *</label>
            <input
              type="text"
              required
              placeholder="Ex: RAW-CARNE-01"
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400">Nome do Insumo *</label>
            <input
              type="text"
              required
              placeholder="Ex: Carne Bovina Blend"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400">Qtd. Entrada *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400">Custo Unit. (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={costPerUnit}
              onChange={(e) => setCostPerUnit(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
              <Calendar size={11} /> Validade
            </label>
            <input
              type="date"
              required
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400">Número do Lote</label>
            <input
              type="text"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400">Fornecedor</label>
            {suppliers.length > 0 ? (
              <select
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">Entrada Direta / Avulsa</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.companyName}>
                    {s.companyName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Nome do fornecedor"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            )}
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400">Nº NF-e (Opcional)</label>
            <input
              type="text"
              placeholder="Ex: 001482"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Custo Total do Lote:</span>
            <span className="font-mono tabular-nums font-bold text-white text-sm">
              R$ {totalCost.toFixed(2)}
            </span>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1 border-t border-slate-800/80">
            <input
              type="checkbox"
              checked={launchPayable}
              onChange={(e) => setLaunchPayable(e.target.checked)}
              className="accent-emerald-500 w-3.5 h-3.5"
            />
            <span>Lançar Conta a Pagar no Financeiro automaticamente</span>
          </label>
          {launchPayable && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-400">Vencimento do Título:</span>
              <input
                type="date"
                value={payableDueDate}
                onChange={(e) => setPayableDueDate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-white"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-[2] py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle size={15} /> {isSubmitting ? 'Registrando...' : 'Confirmar Entrada do Lote'}
          </button>
        </div>
      </form>
    </div>
  );
};
