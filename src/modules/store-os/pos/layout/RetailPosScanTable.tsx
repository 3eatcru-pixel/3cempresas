import React from 'react';
import { ShoppingCart, Plus, Minus, Hash, Layers } from 'lucide-react';
import { MenuItem } from '../../../../types';

export interface RetailCartLine {
  lineKey: string;
  menuItem: MenuItem;
  qty: number;
  variantId?: string;
  variantLabel?: string;
  serialNumber?: string;
}

interface RetailPosScanTableProps {
  selectedItems: RetailCartLine[];
  onUpdateQty: (lineKey: string, delta: number) => void;
  onUpdateSerial?: (lineKey: string, serialNumber: string) => void;
}

export const RetailPosScanTable: React.FC<RetailPosScanTableProps> = ({
  selectedItems,
  onUpdateQty,
  onUpdateSerial,
}) => {
  if (selectedItems.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center opacity-20 space-y-4">
        <ShoppingCart size={80} />
        <div className="text-center">
          <p className="text-xl font-black uppercase italic tracking-tighter">
            Frente de Caixa Pronta
          </p>
          <p className="text-xs font-bold uppercase tracking-widest">
            Aguardando bipe de produto ou busca...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-12 px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
        <div className="col-span-1">#</div>
        <div className="col-span-6">Descrição do Item</div>
        <div className="col-span-2 text-center">Quantidade</div>
        <div className="col-span-1 text-right">Unitário</div>
        <div className="col-span-2 text-right">Subtotal</div>
      </div>
      {selectedItems.map((it, idx) => (
        <div
          key={it.lineKey}
          className="grid grid-cols-12 items-center bg-slate-900/40 hover:bg-slate-900 p-4 rounded-xl border border-slate-800/50 group transition-all gap-y-2"
        >
          <div className="col-span-1 text-xs font-mono text-slate-600">
            {selectedItems.length - idx}
          </div>
          <div className="col-span-6 space-y-1">
            <p className="text-sm font-bold text-white uppercase">{it.menuItem.name}</p>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] text-slate-500 font-mono">
                SKU: {it.menuItem.sku || 'N/A'}
              </p>
              {it.variantLabel && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-pink-500/15 text-pink-300 border border-pink-500/30 text-[10px] font-bold">
                  <Layers size={10} /> {it.variantLabel}
                </span>
              )}
            </div>
            {it.menuItem.specs?.requiresSerialOrImei && onUpdateSerial && (
              <div className="flex items-center gap-1.5 pt-1">
                <Hash size={12} className="text-cyan-400 shrink-0" />
                <input
                  type="text"
                  value={it.serialNumber || ''}
                  onChange={e => onUpdateSerial(it.lineKey, e.target.value)}
                  placeholder="Informe Nº Série / IMEI obrigatório..."
                  className="w-full max-w-xs bg-slate-950 border border-cyan-500/40 rounded-lg px-2.5 py-1 text-[11px] font-mono text-cyan-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                />
              </div>
            )}
          </div>
          <div className="col-span-2 flex items-center justify-center gap-3">
            <button
              onClick={() => onUpdateQty(it.lineKey, -1)}
              className="p-1 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Minus size={14} />
            </button>
            <span className="text-sm font-black font-mono w-8 text-center bg-slate-950 rounded py-0.5 border border-slate-800">
              {it.qty}
            </span>
            <button
              onClick={() => onUpdateQty(it.lineKey, 1)}
              className="p-1 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="col-span-1 text-right text-xs font-mono text-slate-400">
            R$ {it.menuItem.price.toFixed(2)}
          </div>
          <div className="col-span-2 text-right text-sm font-black text-white font-mono">
            R$ {(it.menuItem.price * it.qty).toFixed(2)}
          </div>
        </div>
      ))}
    </div>
  );
};
