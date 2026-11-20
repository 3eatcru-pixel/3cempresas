import React from 'react';
import { Search, X, ArrowRight, Building2, Monitor } from 'lucide-react';
import { Store } from '../../../types';
import type { LocalTerminalInfo } from '../../../core/platform/PlatformAdapter';

interface StartMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentStore: Store;
  tenantStores?: Store[];
  canSwitchBranch?: boolean;
  onSelectStore?: (storeId: string) => void;
  searchFilter: string;
  setSearchFilter: (val: string) => void;
  visibleApps: any[];
  onOpenApp: (id: string, title: string) => void;
  onLogout: () => void;
  localTerminal?: LocalTerminalInfo;
}

export const StartMenu: React.FC<StartMenuProps> = ({
  isOpen,
  onClose,
  currentStore,
  tenantStores = [],
  canSwitchBranch = false,
  onSelectStore,
  searchFilter,
  setSearchFilter,
  visibleApps,
  onOpenApp,
  onLogout,
  localTerminal,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute left-4 bottom-16 w-80 sm:w-96 bg-slate-900/95 backdrop-blur-2xl rounded-3xl border border-slate-700/80 shadow-2xl p-5 z-50 animate-scaleIn space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <img src={currentStore.logo} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0" />
          <div className="min-w-0">
            <h4 className="text-sm font-black text-white truncate">{currentStore.name}</h4>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block truncate">
              {currentStore.branchLabel || currentStore.category} • {currentStore.address || 'Operação Local'}
            </span>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {localTerminal?.isLocalTerminal && (
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-[10px] font-mono">
          <span className="flex items-center gap-1.5 font-black uppercase tracking-wider text-cyan-300">
            <Monitor className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            {localTerminal.label}
          </span>
          <span className="text-slate-400 truncate">{localTerminal.detailLabel}</span>
        </div>
      )}

      {canSwitchBranch && tenantStores.length > 1 && onSelectStore && (
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-400">
            <Building2 className="w-3.5 h-3.5" /> Alternar Filial ({tenantStores.length})
          </div>
          <select
            value={currentStore.id}
            onChange={(e) => {
              onSelectStore(e.target.value);
              onClose();
            }}
            aria-label="Selecionar filial ativa"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-amber-500"
          >
            {tenantStores.map((st) => (
              <option key={st.id} value={st.id}>
                {st.branchLabel ? `${st.branchLabel} — ${st.name}` : st.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800 text-xs text-white">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input 
          type="text" placeholder="Pesquisar aplicativo..." value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full"
        />
      </div>

      <div className="space-y-1.5 max-h-60 overflow-y-auto no-scrollbar">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Aplicativos da Loja</span>
        <div className="grid grid-cols-3 gap-2">
          {visibleApps
            .filter(item => item.title.toLowerCase().includes(searchFilter.toLowerCase()))
            .map(item => (
              <button
                key={item.id}
                onClick={() => onOpenApp(item.id, item.title)}
                className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 flex flex-col items-center gap-1.5 text-slate-300 transition-all text-center"
              >
                <item.icon className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-bold truncate max-w-full">{item.title}</span>
              </button>
            ))}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-800">
         <button
           onClick={onLogout}
           className="w-full py-2.5 bg-slate-950 hover:bg-red-500/10 text-slate-400 hover:text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-800 transition-all flex items-center justify-center gap-2"
         >
           <ArrowRight className="w-3.5 h-3.5 rotate-180" />
           Encerrar Sessão & Voltar
         </button>
      </div>
    </div>
  );
};
