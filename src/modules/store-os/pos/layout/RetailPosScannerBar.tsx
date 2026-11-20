import React, { RefObject } from 'react';
import { Barcode, Search, Tag } from 'lucide-react';
import { MenuItem } from '../../../../types';

interface RetailPosScannerBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredItems: MenuItem[];
  onAddItem: (item: MenuItem) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
}

export const RetailPosScannerBar: React.FC<RetailPosScannerBarProps> = ({
  searchQuery,
  setSearchQuery,
  filteredItems,
  onAddItem,
  searchInputRef,
}) => {
  return (
    <div className="bg-slate-900 border-b border-slate-800 p-3 flex items-center gap-4">
      <div className="bg-emerald-500 p-2 rounded-lg text-slate-950">
        <Barcode size={24} />
      </div>
      <div className="flex-1 relative">
        <Search size={18} className="absolute left-4 top-3 text-slate-500" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ESCANEAR CÓDIGO DE BARRAS OU BUSCAR SKU (F1)..."
          className="w-full bg-slate-950 border-2 border-slate-800 focus:border-emerald-500 rounded-xl py-2.5 pl-12 pr-4 text-sm font-mono font-bold outline-none transition-all"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filteredItems.length === 1) {
              onAddItem(filteredItems[0]);
            }
          }}
        />
        {searchQuery && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-[100] max-h-60 overflow-y-auto">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onAddItem(item)}
                className="p-3 hover:bg-slate-800 cursor-pointer flex justify-between items-center border-b border-slate-800 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center text-[10px] font-bold">
                    {item.sku?.slice(-4)}
                  </div>
                  <div>
                    <p className="text-xs font-bold">{item.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {item.barcode || 'S/ BARRAS'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-emerald-400">
                    R$ {item.price.toFixed(2)}
                  </p>
                  <p className="text-[9px] text-slate-500 uppercase">Estoque: {item.stock}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl">
        <Tag size={16} className="text-amber-500" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          PDV Varejo v2.6
        </span>
      </div>
    </div>
  );
};
