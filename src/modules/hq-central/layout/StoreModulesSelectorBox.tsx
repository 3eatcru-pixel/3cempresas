import React from 'react';
import { Layers, ShieldCheck } from 'lucide-react';

export const STORE_OS_MODULES_CATALOG: { id: string; label: string }[] = [
  { id: 'pos', label: 'PDV & Frente de Caixa' },
  { id: 'kds', label: 'KDS Cozinha & Produção' },
  { id: 'tables', label: 'Mapa de Mesas & Comandas' },
  { id: 'waiter', label: 'Terminal Garçom / QR' },
  { id: 'catalog', label: 'Catálogo & Fichas Técnicas' },
  { id: 'inventory', label: 'Estoque PEPS & Ledger' },
  { id: 'suppliers', label: 'Fornecedores & Compras' },
  { id: 'finance', label: 'Financeiro, Caixa & DRE' },
  { id: 'crm', label: 'Fidelidade, Cupons & CRM' },
  { id: 'couriers', label: 'Frota Própria & Despacho' },
  { id: 'analytics', label: 'BI & Relatórios Fiscais' },
  { id: 'settings', label: 'Configurações & Hardware' },
];

interface StoreModulesSelectorBoxProps {
  enabledModules: string[];
  onToggleModule: (modId: string) => void;
  onSelectAll: () => void;
}

export const StoreModulesSelectorBox: React.FC<StoreModulesSelectorBoxProps> = ({
  enabledModules,
  onToggleModule,
  onSelectAll,
}) => {
  return (
    <>
      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            Módulos Habilitados no Store OS ({enabledModules.length})
          </span>
          <button
            type="button"
            onClick={onSelectAll}
            className="text-[10px] font-bold text-emerald-400 hover:underline cursor-pointer"
          >
            Marcar Todos
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {STORE_OS_MODULES_CATALOG.map((mod) => {
            const active = enabledModules.includes(mod.id);
            return (
              <label
                key={mod.id}
                className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                  active
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-white font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => onToggleModule(mod.id)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-500"
                />
                <span className="truncate">{mod.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 text-[11px] text-slate-400">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          As cotas de filiais, terminais, comissão e módulos são sincronizadas imediatamente no Tenant e no Store OS.
        </span>
      </div>
    </>
  );
};
