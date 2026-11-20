import React from 'react';
import { DollarSign, Sparkles, Image as ImageIcon } from 'lucide-react';
import { MenuItem } from '../../../../types';

interface CatalogItemPricingFieldsProps {
  newItem: Partial<MenuItem>;
  setNewItem: React.Dispatch<React.SetStateAction<Partial<MenuItem>>>;
  onAiPrice: () => void;
  isPricingLoading: boolean;
  pricingJustification: string | null;
}

export const CatalogItemPricingFields: React.FC<CatalogItemPricingFieldsProps> = ({
  newItem,
  setNewItem,
  onAiPrice,
  isPricingLoading,
  pricingJustification,
}) => {
  const estimatedMargin =
    newItem.price && newItem.costPrice
      ? ((newItem.price - newItem.costPrice) / newItem.price) * 100
      : null;

  const isServiceItem = newItem.specs?.segment === 'SERVICE';

  return (
    <div className="space-y-4">
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4 shadow-inner">
        <div className="flex items-center gap-2 text-blue-400 mb-1">
          <DollarSign className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase italic">Engenharia de Preço</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[9px] text-slate-500 font-bold uppercase">
              {isServiceItem ? 'Custo Operacional / Insumos' : 'Custo Produção (CMV)'}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={newItem.costPrice ?? 0}
              onChange={e => setNewItem({ ...newItem, costPrice: Math.max(0, Number(e.target.value)) })}
              className="w-full bg-slate-900 border border-slate-800 text-xs text-emerald-400 font-mono p-2 rounded-lg outline-none"
            />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[9px] text-slate-500 font-bold uppercase">Preço Venda</label>
              <button
                type="button"
                onClick={onAiPrice}
                disabled={isPricingLoading}
                className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-2 h-2 ${isPricingLoading ? 'animate-spin' : ''}`} />
                SUGERIR
              </button>
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={newItem.price ?? 0}
              onChange={e => setNewItem({ ...newItem, price: Math.max(0, Number(e.target.value)) })}
              className="w-full bg-slate-900 border border-amber-500/50 text-xs text-amber-400 font-mono font-bold p-2 rounded-lg outline-none"
            />
          </div>
        </div>

        {pricingJustification && (
          <div className="text-[9px] text-emerald-400/80 bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10 italic">
            💡 <strong>IA diz:</strong> {pricingJustification}
          </div>
        )}

        {estimatedMargin !== null && (
          <div className="bg-slate-900/50 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <span className="text-[9px] text-slate-500 font-bold uppercase">Margem Bruta Estimada:</span>
            <span
              className={`text-[10px] font-mono font-black ${
                estimatedMargin > 60 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {estimatedMargin.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
          <ImageIcon className="w-3 h-3 text-blue-400" /> URL da Imagem (Unsplash/CDN)
        </label>
        <input
          type="text"
          value={newItem.image || ''}
          onChange={e => setNewItem({ ...newItem, image: e.target.value })}
          className="w-full bg-slate-950 border border-slate-800 text-[10px] text-slate-300 p-2.5 rounded-xl focus:outline-none"
        />
      </div>

      {isServiceItem ? (
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl text-[10px] text-indigo-300 font-bold flex items-center justify-between">
          <span>Disponibilidade por Agenda (Serviço)</span>
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 font-mono text-[9px] uppercase">
            Sem baixa de estoque
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase">Estoque Atual</label>
            <input
              type="number"
              min="0"
              value={newItem.stock ?? 10}
              onChange={e => setNewItem({ ...newItem, stock: Math.max(0, Number(e.target.value)) })}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase">Alerta Mínimo</label>
            <input
              type="number"
              min="0"
              value={newItem.minStockAlert ?? 5}
              onChange={e => setNewItem({ ...newItem, minStockAlert: Math.max(0, Number(e.target.value)) })}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-rose-400 p-2.5 rounded-xl font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
};
