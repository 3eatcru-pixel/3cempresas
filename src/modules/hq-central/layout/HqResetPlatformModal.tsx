import React from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';

interface HqResetPlatformModalProps {
  isOpen: boolean;
  resetConfirmText: string;
  setResetConfirmText: (value: string) => void;
  isResetting: boolean;
  onClose: () => void;
  onConfirmReset: () => void;
}

export const HqResetPlatformModal: React.FC<HqResetPlatformModalProps> = ({
  isOpen,
  resetConfirmText,
  setResetConfirmText,
  isResetting,
  onClose,
  onConfirmReset,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-3xl p-6 space-y-6 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-950/50 rounded-full"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-3">
          <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto text-rose-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-white tracking-tight">Resetar Toda a Plataforma?</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Esta ação apagará todos os pedidos, extratos financeiros, comandas e logs de teste, restaurando as lojas, produtos e configurações para o estado inicial demonstrativo.
          </p>
        </div>

        <div className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl text-[11px] text-rose-300 font-mono space-y-1">
          <div>⚠️ Reset controlado das tabelas do Server Core</div>
          <div>⚠️ Restauração de lojas e catálogo inicial</div>
          <div>⚠️ Reinício de métricas operacionais de teste</div>
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-mono text-slate-400">
            Digite <span className="text-rose-400 font-black">RESET</span> para confirmar:
          </label>
          <input
            type="text"
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            placeholder="RESET"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmReset}
            disabled={isResetting || resetConfirmText.trim().toUpperCase() !== 'RESET'}
            className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
            <span>{isResetting ? 'Resetando...' : 'Confirmar Reset'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
