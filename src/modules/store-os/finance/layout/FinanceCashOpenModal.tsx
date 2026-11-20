import React, { useState } from 'react';

interface FinanceCashOpenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (initialCash: number) => void;
}

export const FinanceCashOpenModal: React.FC<FinanceCashOpenModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [initialCash, setInitialCash] = useState('0.00');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(parseFloat(initialCash) || 0);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-6 space-y-5 shadow-2xl animate-scaleIn"
      >
        <div className="text-center space-y-1">
          <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
            Abrir Novo Turno
          </h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase">
            Informe o saldo inicial em dinheiro no caixa
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 font-bold uppercase">
            Saldo Inicial (R$)
          </label>
          <input
            type="number"
            step="0.01"
            required
            autoFocus
            value={initialCash}
            onChange={(e) => setInitialCash(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-xl font-mono text-emerald-400 p-3 rounded-xl focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-slate-800 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-750 transition-all cursor-pointer"
          >
            CANCELAR
          </button>
          <button
            type="submit"
            className="flex-[2] py-3 bg-amber-500 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            CONFIRMAR ABERTURA
          </button>
        </div>
      </form>
    </div>
  );
};
