import React from 'react';
import { Sparkles, Trash2, ArrowRight, Plus, Minus } from 'lucide-react';
import { MenuItem } from '../../../../types';

interface ServicePosCartSidebarProps {
  step: 'SERVICES' | 'CHECKOUT';
  selectedServices: { menuItem: MenuItem; qty: number }[];
  total: number;
  onUpdateQty?: (id: string, delta: number) => void;
  onRemoveService: (id: string) => void;
  onToggleStep: () => void;
}

export const ServicePosCartSidebar: React.FC<ServicePosCartSidebarProps> = ({
  step,
  selectedServices,
  total,
  onUpdateQty,
  onRemoveService,
  onToggleStep,
}) => {
  return (
    <div className="w-80 bg-slate-950 border-l border-slate-800 flex flex-col justify-between">
      <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Carrinho de Atendimento</h4>
        <div className="space-y-2">
          {selectedServices.map(it => (
            <div
              key={it.menuItem.id}
              className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center gap-2 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{it.menuItem.name}</p>
                <p className="text-[10px] text-emerald-400 font-mono">
                  R$ {(it.menuItem.price * it.qty).toFixed(2)}
                </p>
              </div>
              {onUpdateQty && (
                <div className="flex items-center gap-1.5 bg-slate-950 px-1.5 py-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => onUpdateQty(it.menuItem.id, -1)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="text-[11px] font-mono font-bold text-white w-4 text-center">
                    {it.qty}
                  </span>
                  <button
                    onClick={() => onUpdateQty(it.menuItem.id, 1)}
                    className="text-slate-400 hover:text-emerald-400 cursor-pointer"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              )}
              <button
                onClick={() => onRemoveService(it.menuItem.id)}
                className="p-1.5 text-slate-600 hover:text-red-400 opacity-70 group-hover:opacity-100 transition-all cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {selectedServices.length === 0 && (
            <div className="py-12 text-center opacity-20">
              <Sparkles size={32} className="mx-auto mb-2" />
              <p className="text-[10px] font-bold uppercase">Aguardando Serviços</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-4">
        <div className="flex justify-between items-end">
          <span className="text-[10px] font-black text-slate-500 uppercase">Subtotal</span>
          <span className="text-xl font-mono font-black text-white">R$ {total.toFixed(2)}</span>
        </div>
        <button
          disabled={selectedServices.length === 0}
          onClick={onToggleStep}
          className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-slate-950 font-black py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
        >
          <span>{step === 'SERVICES' ? 'AVANÇAR' : 'VOLTAR'}</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
