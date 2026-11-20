import React from 'react';
import { Database } from 'lucide-react';
import { CATEGORY_LABELS, InspectorResponse, TableCategory } from './telemetryTableUtils';

interface HqTablesCatalogSidebarProps {
  filteredCatalog: InspectorResponse['tablesCatalog'];
  selectedTable: string;
  onSelectTable: (tableName: string) => void;
  categoryFilter: TableCategory;
  onChangeCategory: (category: TableCategory) => void;
}

export const HqTablesCatalogSidebar: React.FC<HqTablesCatalogSidebarProps> = ({
  filteredCatalog,
  selectedTable,
  onSelectTable,
  categoryFilter,
  onChangeCategory,
}) => {
  return (
    <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col max-h-[760px]">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-400" />
            Catálogo de Tabelas (TBL)
          </h3>
          <p className="text-[11px] text-slate-400">
            Selecione uma coleção para inspecionar registros em tempo real
          </p>
        </div>
        <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-[10px] font-mono font-bold text-amber-400">
          {filteredCatalog.length} tbls
        </span>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(CATEGORY_LABELS) as TableCategory[]).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onChangeCategory(cat)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
              categoryFilter === cat
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Tables List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {filteredCatalog.map((tbl) => {
          const isSelected = selectedTable === tbl.name;
          return (
            <button
              key={tbl.name}
              type="button"
              onClick={() => onSelectTable(tbl.name)}
              className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-indigo-500/15 border-indigo-500/60 shadow-sm'
                  : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-white truncate">
                  tbl.{tbl.name}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums ${
                    isSelected
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-900 text-slate-300 border border-slate-800'
                  }`}
                >
                  {tbl.count} reg
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{tbl.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
