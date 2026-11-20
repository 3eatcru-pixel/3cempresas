import React from 'react';
import { X } from 'lucide-react';
import { MenuItem } from '../../../../types';

interface KioskItemNotesModalProps {
  item: MenuItem;
  customNotes: string;
  setCustomNotes: (notes: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export const KioskItemNotesModal: React.FC<KioskItemNotesModalProps> = ({
  item,
  customNotes,
  setCustomNotes,
  onClose,
  onSave,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
          <h4 className="font-bold text-sm text-white">Observação para o Preparo</h4>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-300">
          Personalize seu <span className="text-amber-400 font-bold">{item.name}</span>:
        </p>
        <textarea
          rows={3}
          value={customNotes}
          onChange={(e) => setCustomNotes(e.target.value)}
          placeholder="Ex: Sem cebola, carne bem passada, molho à parte..."
          className="w-full bg-slate-950 border border-slate-700 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-amber-400 resize-none"
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow"
          >
            Adicionar Item
          </button>
        </div>
      </div>
    </div>
  );
};
