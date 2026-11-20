import React from 'react';
import { Layers, X } from 'lucide-react';
import { MenuItem, MenuItemVariant } from '../../../../types';

interface RetailVariantPickerModalProps {
  item: MenuItem;
  onSelectVariant: (item: MenuItem, variant: MenuItemVariant) => void;
  onClose: () => void;
}

export const RetailVariantPickerModal: React.FC<RetailVariantPickerModalProps> = ({
  item,
  onSelectVariant,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-[110] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-pink-500/30 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleIn">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-pink-400" />
            <div>
              <h4 className="text-sm font-black uppercase text-white">Selecionar Grade</h4>
              <p className="text-[11px] text-slate-400">{item.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto custom-scrollbar">
          {(item.variants || []).map((v) => {
            const disabled = v.stock <= 0;
            return (
              <button
                key={v.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelectVariant(item, v)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  disabled
                    ? 'bg-slate-950/40 border-slate-800 opacity-40 cursor-not-allowed'
                    : 'bg-slate-950 border-slate-800 hover:border-pink-500'
                }`}
              >
                <div className="text-xs font-black text-white">
                  {v.color || 'Padrão'} • Tam {v.size || 'Único'}
                </div>
                <div className="text-[10px] font-mono text-emerald-400 mt-1">
                  {disabled ? 'Esgotado' : `${v.stock} un disponíveis`}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
