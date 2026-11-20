import React from 'react';
import { KeyRound, Loader2 } from 'lucide-react';

interface DriverPixWithdrawModalProps {
  walletBalance: number;
  withdrawAmount: string;
  setWithdrawAmount: (val: string) => void;
  pixKey: string;
  setPixKey: (val: string) => void;
  submitting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const DriverPixWithdrawModal: React.FC<DriverPixWithdrawModalProps> = ({
  walletBalance,
  withdrawAmount,
  setWithdrawAmount,
  pixKey,
  setPixKey,
  submitting = false,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  const parsedAmount = Number(String(withdrawAmount).replace(',', '.'));
  const isAmountValid = Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= walletBalance;
  const isPixValid = pixKey.trim().length >= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#111922] border border-slate-700 rounded-2xl p-6 max-w-sm w-full space-y-4 text-white shadow-2xl">
        <h3 className="font-black text-base text-white">Solicitar Saque PIX</h3>
        <p className="text-xs text-slate-400">
          Solicitação processada com débito imediato do saldo disponível (
          <span className="text-[#00CCBC] font-mono font-bold tabular-nums">
            R$ {walletBalance.toFixed(2).replace('.', ',')}
          </span>
          ).
        </p>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-slate-300 block mb-1 flex items-center gap-1.5 font-bold">
              <KeyRound className="w-3.5 h-3.5 text-[#00CCBC]" /> Chave PIX de Destino
            </label>
            <input
              type="text"
              required
              placeholder="CPF, E-mail, Telefone ou Chave Aleatória"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              className="w-full bg-[#0B1117] border border-slate-700 text-white text-xs rounded-xl p-3 focus:outline-none focus:border-[#00CCBC]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-300 font-bold">Valor do Saque (R$)</label>
              {walletBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setWithdrawAmount(walletBalance.toFixed(2))}
                  className="text-[11px] font-bold text-[#00CCBC] hover:underline cursor-pointer"
                >
                  Usar saldo total
                </button>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={walletBalance > 0 ? walletBalance : undefined}
              required
              placeholder={walletBalance.toFixed(2)}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full bg-[#0B1117] border border-slate-700 text-white font-mono text-sm rounded-xl p-3 focus:outline-none focus:border-[#00CCBC] tabular-nums"
            />
          </div>

          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-medium">
              {errorMessage}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="min-h-[44px] flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !isAmountValid || !isPixValid}
              className="min-h-[44px] flex-1 py-2.5 bg-[#00CCBC] hover:bg-[#00b5a7] text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processando...
                </>
              ) : (
                'Confirmar Saque'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
