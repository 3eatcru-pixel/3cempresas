import React, { useState } from 'react';
import { FileText, PackagePlus, X } from 'lucide-react';
import { MenuItem, Supplier } from '../../../types';

interface SupplierPurchaseModalProps {
  supplier: Supplier;
  storeItems: MenuItem[];
  onClose: () => void;
  onConfirmPurchase: (payload: {
    mode: 'CATALOG_ITEM' | 'RAW_MATERIAL';
    menuItem?: MenuItem;
    sku: string;
    itemName: string;
    quantity: number;
    unitCost: number;
    expirationDate: string;
    invoiceNumber: string;
    launchPayable: boolean;
    payableDueDate: string;
  }) => Promise<void>;
}

export const SupplierPurchaseModal: React.FC<SupplierPurchaseModalProps> = ({
  supplier,
  storeItems,
  onClose,
  onConfirmPurchase,
}) => {
  const physicalItems = storeItems.filter((m) => m.specs?.segment !== 'SERVICE');
  const [mode, setMode] = useState<'CATALOG_ITEM' | 'RAW_MATERIAL'>(
    physicalItems.length > 0 ? 'CATALOG_ITEM' : 'RAW_MATERIAL'
  );
  const [selectedMenuItemId, setSelectedMenuItemId] = useState(physicalItems[0]?.id || '');
  const [rawSku, setRawSku] = useState('');
  const [rawName, setRawName] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [unitCost, setUnitCost] = useState(
    String(physicalItems[0]?.costPrice || 0)
  );
  const [expirationDate, setExpirationDate] = useState(
    new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]
  );
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [launchPayable, setLaunchPayable] = useState(true);
  const [payableDueDate, setPayableDueDate] = useState(
    new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedItem = physicalItems.find((i) => i.id === selectedMenuItemId);
  const numericQty = Math.max(0, parseFloat(quantity.replace(',', '.')) || 0);
  const numericCost = Math.max(0, parseFloat(unitCost.replace(',', '.')) || 0);
  const totalAmount = Math.round(numericQty * numericCost * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericQty <= 0) return;
    if (mode === 'CATALOG_ITEM' && !selectedItem) return;
    if (mode === 'RAW_MATERIAL' && (!rawSku.trim() || !rawName.trim())) return;

    setIsSubmitting(true);
    try {
      await onConfirmPurchase({
        mode,
        menuItem: mode === 'CATALOG_ITEM' ? selectedItem : undefined,
        sku:
          mode === 'CATALOG_ITEM'
            ? selectedItem!.sku || `SKU-${selectedItem!.id.slice(-4)}`
            : rawSku.trim().toUpperCase(),
        itemName: mode === 'CATALOG_ITEM' ? selectedItem!.name : rawName.trim(),
        quantity: numericQty,
        unitCost: numericCost,
        expirationDate,
        invoiceNumber: invoiceNumber.trim(),
        launchPayable,
        payableDueDate,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-auto"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Entrada de Nota / Compra</h3>
              <p className="text-[11px] text-slate-400 truncate max-w-xs">
                {supplier.companyName} · {supplier.cnpj}
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

        {/* Mode Segmented Toggle */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setMode('CATALOG_ITEM')}
            className={`py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              mode === 'CATALOG_ITEM' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Repor Produto do Catálogo
          </button>
          <button
            type="button"
            onClick={() => setMode('RAW_MATERIAL')}
            className={`py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              mode === 'RAW_MATERIAL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Insumo / Matéria-Prima (BOM)
          </button>
        </div>

        {mode === 'CATALOG_ITEM' ? (
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400">Produto do Catálogo *</label>
            <select
              value={selectedMenuItemId}
              onChange={(e) => {
                setSelectedMenuItemId(e.target.value);
                const found = physicalItems.find((i) => i.id === e.target.value);
                if (found?.costPrice) setUnitCost(String(found.costPrice));
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              {physicalItems.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} (Saldo atual: {it.stock} un)
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">SKU Insumo *</label>
              <input
                type="text"
                required
                placeholder="Ex: RAW-QUEIJO-01"
                value={rawSku}
                onChange={(e) => setRawSku(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Nome do Insumo *</label>
              <input
                type="text"
                required
                placeholder="Ex: Queijo Cheddar"
                value={rawName}
                onChange={(e) => setRawName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400">Qtd. Comprada *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-emerald-400 font-bold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400">Custo Unit. (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400">Validade Lote</label>
            <input
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-mono text-white"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400">Número da Nota Fiscal / Pedido</label>
          <input
            type="text"
            placeholder="Ex: NF-e 00045218"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white"
          />
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Total da Nota / Compra:</span>
            <span className="font-mono tabular-nums font-bold text-amber-400 text-sm">
              R$ {totalAmount.toFixed(2)}
            </span>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-1 border-t border-slate-800/80">
            <input
              type="checkbox"
              checked={launchPayable}
              onChange={(e) => setLaunchPayable(e.target.checked)}
              className="accent-amber-500 w-3.5 h-3.5"
            />
            <span>Gerar Conta a Pagar (Financeiro)</span>
          </label>
          {launchPayable && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">Vencimento:</span>
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
            className="flex-[2] py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <PackagePlus size={15} /> {isSubmitting ? 'Processando...' : 'Confirmar Entrada NF'}
          </button>
        </div>
      </form>
    </div>
  );
};
