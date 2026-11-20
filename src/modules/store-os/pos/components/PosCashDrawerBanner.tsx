import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, LockOpen, X } from 'lucide-react';
import { CashRegisterSession } from '../../../../types';

interface PosCashDrawerBannerProps {
  cashSession: CashRegisterSession;
  operatorDefault: string;
  onOpenCashRegister: (initialCash: number, operator: string) => Promise<void>;
}

export const PosCashDrawerBanner: React.FC<PosCashDrawerBannerProps> = ({
  cashSession,
  operatorDefault,
  onOpenCashRegister,
}) => {
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [initialCash, setInitialCash] = useState('150');
  const [operatorName, setOperatorName] = useState(operatorDefault || 'Operador Caixa');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOpen = cashSession?.status === 'OPEN';

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericCash = Math.max(0, parseFloat(initialCash.replace(',', '.')) || 0);
    setIsSubmitting(true);
    try {
      await onOpenCashRegister(numericCash, operatorName.trim() || operatorDefault || 'Operador Caixa');
      setIsOpenModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {isOpen ? (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs whitespace-nowrap shrink-0">
          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
          <span className="font-bold text-emerald-300">Caixa Aberto</span>
          <span className="text-slate-500" aria-hidden="true">·</span>
          <span className="font-mono tabular-nums font-bold text-white">
            R$ {(Number(cashSession.finalCashCalculated) || 0).toFixed(2)}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpenModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-xs text-amber-300 font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          title="Nenhuma sessão de caixa aberta. Clique para abrir o turno."
        >
          <AlertTriangle size={14} className="text-amber-400 shrink-0" />
          <span>Caixa Fechado</span>
          <span className="text-amber-500/70" aria-hidden="true">·</span>
          <span className="underline underline-offset-2 text-amber-200">Abrir Turno</span>
        </button>
      )}

      {isOpenModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleOpenShift}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <LockOpen size={18} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Abrir Turno de Caixa</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpenModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Operador Responsável</label>
                <input
                  type="text"
                  required
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Fundo de Troco Inicial (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={initialCash}
                  onChange={(e) => setInitialCash(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono tabular-nums font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsOpenModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-[2] py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Abrindo...' : 'Confirmar Abertura'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
