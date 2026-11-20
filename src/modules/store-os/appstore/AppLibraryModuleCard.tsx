import React from 'react';
import { AppStoreModule } from './moduleCatalog';

interface AppLibraryModuleCardProps {
  module: AppStoreModule;
  onToggle: (mod: AppStoreModule) => void;
}

export const AppLibraryModuleCard: React.FC<AppLibraryModuleCardProps> = ({
  module: mod,
  onToggle,
}) => {
  const Icon = mod.icon;

  return (
    <div
      className={`p-4 rounded-2xl border flex flex-col justify-between space-y-4 transition-colors ${
        mod.isEnabled
          ? 'bg-slate-900/90 border-blue-500/40'
          : 'bg-slate-950/70 border-slate-800/80 opacity-85'
      }`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                mod.isEnabled
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono text-slate-500 uppercase font-bold block truncate">
                {mod.category}
              </span>
              <h4 className="font-bold text-white text-sm tracking-tight truncate">{mod.name}</h4>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">{mod.description}</p>
      </div>

      <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
        <span
          className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
            mod.kind === 'OPERATIONAL_FLAG'
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
              : 'bg-slate-900 text-slate-400 border-slate-800'
          }`}
        >
          {mod.priceTag}
        </span>
        <button
          type="button"
          onClick={() => onToggle(mod)}
          className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
            mod.isEnabled
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
          }`}
        >
          {mod.isEnabled ? 'Ativo' : 'Ativar'}
        </button>
      </div>
    </div>
  );
};
