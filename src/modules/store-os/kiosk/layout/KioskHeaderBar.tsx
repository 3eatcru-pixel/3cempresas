import React from 'react';
import { Laptop } from 'lucide-react';

interface KioskHeaderBarProps {
  storeName: string;
  hasCartItems: boolean;
  onClearCart: () => void;
}

export const KioskHeaderBar: React.FC<KioskHeaderBarProps> = ({
  storeName,
  hasCartItems,
  onClearCart,
}) => {
  return (
    <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/30 text-amber-400">
          <Laptop className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider flex items-center gap-2">
            <span>Totem Autoatendimento BYOD</span>
            <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">
              Modo Balcão
            </span>
          </div>
          <h2 className="text-base font-black text-white">{storeName}</h2>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-slate-400 hidden sm:inline">
          Toque nos itens para fazer seu pedido
        </span>
        {hasCartItems && (
          <button
            onClick={onClearCart}
            className="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 transition-colors"
          >
            Limpar Pedido
          </button>
        )}
      </div>
    </div>
  );
};
