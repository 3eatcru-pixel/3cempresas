import React from 'react';
import { BookOpen, Search, Plus } from 'lucide-react';

interface CatalogHeaderBarProps {
  search: string;
  setSearch: (search: string) => void;
  onOpenAdd: () => void;
}

export const CatalogHeaderBar: React.FC<CatalogHeaderBarProps> = ({
  search,
  setSearch,
  onOpenAdd,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 shrink-0">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
            Gestão de Cardápio & Catálogo
          </h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            Sincronizado com Marketplace & PDV
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filtrar produtos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs pl-9 pr-4 py-2 rounded-xl text-white focus:outline-none focus:border-blue-500 w-48 transition-all"
          />
        </div>
        <button
          onClick={onOpenAdd}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>
    </div>
  );
};
