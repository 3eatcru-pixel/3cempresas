import React from 'react';
import { Layers } from 'lucide-react';
import { MenuItemVariant } from '../../../types';

interface ItemVariantSelectorProps {
  variants: MenuItemVariant[];
  selectedVariantId: string;
  selectedVariant?: MenuItemVariant;
  onSelectVariant: (variantId: string) => void;
}

export const ItemVariantSelector: React.FC<ItemVariantSelectorProps> = ({
  variants,
  selectedVariantId,
  selectedVariant,
  onSelectVariant,
}) => {
  return (
    <div className="bg-stone-900/60 border border-pink-500/20 rounded-2xl p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-pink-400 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" /> Selecione Cor & Tamanho
        </span>
        {selectedVariant && (
          <span className="text-[10px] font-mono text-emerald-400">
            {selectedVariant.stock} em estoque
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => {
          const label = [v.color, v.size].filter(Boolean).join(' • ') || 'Padrão';
          const isSelected = v.id === selectedVariantId;
          const outOfStock = v.stock <= 0;
          return (
            <button
              key={v.id}
              type="button"
              disabled={outOfStock}
              onClick={() => onSelectVariant(v.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                outOfStock
                  ? 'bg-stone-950/40 border-stone-800 text-stone-600 line-through cursor-not-allowed'
                  : isSelected
                  ? 'bg-pink-500 text-white border-pink-400 shadow-lg shadow-pink-500/20'
                  : 'bg-stone-950 text-stone-300 border-stone-800 hover:border-pink-500/40'
              }`}
            >
              {label} {!outOfStock && <span className="text-[10px] opacity-75">({v.stock})</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};
