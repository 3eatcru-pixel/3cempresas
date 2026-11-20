import React from 'react';
import { Plus, Utensils, Calculator } from 'lucide-react';

export type WaiterModalSubTab = 'consumption' | 'new_order' | 'bill';

interface WaiterModalSubNavProps {
  activeSubTab: WaiterModalSubTab;
  onSelectTab: (tab: WaiterModalSubTab) => void;
  orderItemsCount: number;
  existingItemsCount: number;
}

export const WaiterModalSubNav: React.FC<WaiterModalSubNavProps> = ({
  activeSubTab,
  onSelectTab,
  orderItemsCount,
  existingItemsCount,
}) => {
  return (
    <div className="grid grid-cols-3 bg-slate-950 p-1.5 border-b border-slate-800 gap-1 shrink-0">
      <button
        onClick={() => onSelectTab('new_order')}
        className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
          activeSubTab === 'new_order' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
        }`}
      >
        <Plus className="w-4 h-4" />
        <span>+ Pedido</span>
        {orderItemsCount > 0 && (
          <span className="w-4 h-4 rounded-full bg-slate-950 text-amber-400 font-mono text-[9px] flex items-center justify-center">
            {orderItemsCount}
          </span>
        )}
      </button>

      <button
        onClick={() => onSelectTab('consumption')}
        className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
          activeSubTab === 'consumption' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
        }`}
      >
        <Utensils className="w-4 h-4" />
        <span>Consumo ({existingItemsCount})</span>
      </button>

      <button
        onClick={() => onSelectTab('bill')}
        className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
          activeSubTab === 'bill' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
        }`}
      >
        <Calculator className="w-4 h-4" />
        <span>Conta</span>
      </button>
    </div>
  );
};
