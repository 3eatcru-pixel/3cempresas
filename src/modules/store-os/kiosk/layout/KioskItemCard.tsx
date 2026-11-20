import React from 'react';
import { Plus } from 'lucide-react';
import { MenuItem } from '../../../../types';

interface KioskItemCardProps {
  item: MenuItem;
  onOpenNotes: (item: MenuItem) => void;
  onAddToCart: (item: MenuItem) => void;
}

export const KioskItemCard: React.FC<KioskItemCardProps> = ({
  item,
  onOpenNotes,
  onAddToCart,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between hover:border-amber-500/40 transition-all shadow-md group relative">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-extrabold text-sm text-white line-clamp-2 leading-snug">
            {item.name}
          </h4>
          <span className="font-mono text-xs font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg shrink-0">
            R$ {item.price.toFixed(2)}
          </span>
        </div>
        {item.description && (
          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}
      </div>

      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-2">
        <button
          onClick={() => onOpenNotes(item)}
          className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
        >
          Observações
        </button>
        <button
          onClick={() => onAddToCart(item)}
          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1 shadow cursor-pointer active:scale-95 transition-transform"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>
    </div>
  );
};
