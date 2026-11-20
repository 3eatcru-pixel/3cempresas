import React from 'react';
import { X, MessageSquare } from 'lucide-react';
import { MenuItem } from '../../../types';

interface ItemNotesModalProps {
  item: MenuItem;
  input: string;
  setInput: (val: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export const ItemNotesModal: React.FC<ItemNotesModalProps> = ({
  item,
  input,
  setInput,
  onSave,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/90 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
        <div className="flex justify-between items-center">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            Observação: {item.name}
          </h4>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <textarea
          rows={3}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ex: Sem cebola, ponto da carne bem passado, servir molho à parte..."
          className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-3 rounded-xl outline-none focus:border-amber-500 font-medium"
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex-1 py-2.5 bg-amber-500 text-slate-950 text-xs font-black uppercase rounded-xl shadow"
          >
            Salvar Obs
          </button>
        </div>
      </div>
    </div>
  );
};
