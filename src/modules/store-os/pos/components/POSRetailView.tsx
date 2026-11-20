import React, { useRef, useEffect } from 'react';
import { Barcode } from 'lucide-react';
import { MenuItem } from '../../../../types';

interface POSRetailViewProps {
  logic: any;
}

export const POSRetailView: React.FC<POSRetailViewProps> = ({ logic }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const item = logic.filteredItems.find((m: any) => m.barcode === logic.searchQuery);
    if (item) {
      logic.handleAddItem(item);
      logic.setSearchQuery('');
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
       <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
         <div className="relative flex-1">
            <input 
              ref={inputRef}
              type="text" 
              value={logic.searchQuery}
              onChange={(e) => logic.setSearchQuery(e.target.value)}
              placeholder="Escaneie o código de barras ou digite o nome..."
              className="w-full bg-slate-900 border-2 border-slate-800 focus:border-emerald-500 rounded-xl px-10 py-3 text-sm font-bold outline-none text-white transition-all"
            />
            <Barcode className="absolute left-3 top-3.5 text-slate-500 w-5 h-5" />
            <button type="submit" className="absolute right-3 top-3 text-emerald-500 font-black text-[10px] uppercase">Enter</button>
         </div>
       </form>

       <div className="flex-1 overflow-hidden flex flex-col bg-slate-900/40 rounded-2xl border border-slate-800 shadow-inner">
          <div className="p-3 bg-slate-950/50 border-b border-slate-800 text-[10px] font-black uppercase text-slate-500 tracking-widest flex justify-between">
            <span>Resultados de Busca</span>
            <span>{logic.filteredItems.length} SKUs encontrados</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            <div className="grid grid-cols-1 gap-1">
               {logic.filteredItems.map((item: MenuItem) => (
                 <button 
                   key={item.id}
                   onClick={() => logic.handleAddItem(item)}
                   className="flex items-center justify-between p-3 rounded-xl hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30 transition-all group"
                 >
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 font-mono text-[10px] group-hover:text-emerald-400">
                        {item.barcode?.slice(-4) || 'SKU'}
                     </div>
                     <div className="text-left">
                       <p className="text-xs font-bold text-white group-hover:text-emerald-400">{item.name}</p>
                       <p className="text-[10px] text-slate-500 font-mono">{item.sku}</p>
                     </div>
                   </div>
                   <div className="text-right">
                     <p className="text-sm font-black text-white">R$ {item.price.toFixed(2)}</p>
                     <p className={`text-[9px] font-bold ${item.stock <= 5 ? 'text-red-400' : 'text-slate-500'}`}>Qtd: {item.stock}</p>
                   </div>
                 </button>
               ))}
            </div>
          </div>
       </div>
    </div>
  );
};
