import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { MenuItem } from '../../../../types';

interface POSFoodViewProps {
  logic: any;
}

export const POSFoodView: React.FC<POSFoodViewProps> = ({ logic }) => {
  const [activeCat, setActiveCat] = useState('Todos');
  const categories = ['Todos', ...Array.from(new Set(logic.filteredItems.map((i: any) => i.category)))];

  const displayItems = activeCat === 'Todos' 
    ? logic.filteredItems 
    : logic.filteredItems.filter((i: any) => i.category === activeCat);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {categories.map((cat: any) => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap border-2 ${
              activeCat === cat 
                ? 'bg-amber-500 border-amber-500 text-slate-950' 
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {displayItems.map((item: MenuItem) => (
            <button
              key={item.id}
              onClick={() => logic.handleAddItem(item)}
              className="aspect-square bg-slate-900 hover:bg-slate-800 p-3 rounded-2xl border-2 border-slate-800 text-left transition-all flex flex-col justify-between group relative overflow-hidden active:scale-95 shadow-lg"
            >
              <div className="z-10">
                <div className="font-black text-[11px] text-white leading-tight uppercase group-hover:text-amber-400 transition-colors line-clamp-2">
                  {item.name}
                </div>
                <div className="mt-1 text-[9px] text-slate-500 font-bold uppercase">{item.category}</div>
              </div>
              
              <div className="flex items-end justify-between z-10">
                <span className="text-amber-400 font-black text-sm font-mono">R$ {item.price.toFixed(2)}</span>
                <div className="p-1.5 bg-amber-500 rounded-lg text-slate-950 shadow-md">
                  <Plus size={14} strokeWidth={3} />
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
