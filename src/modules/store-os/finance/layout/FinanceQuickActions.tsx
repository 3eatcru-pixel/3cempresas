import React, { useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface FinanceQuickActionsProps {
  onAddSangria: (amount: number, reason: string) => void;
  onAddSuprimento: (amount: number, reason: string) => void;
  disabled?: boolean;
}

export const FinanceQuickActions: React.FC<FinanceQuickActionsProps> = ({
  onAddSangria,
  onAddSuprimento,
  disabled = false,
}) => {
  const [sangriaAmount, setSangriaAmount] = useState('');
  const [sangriaReason, setSangriaReason] = useState('');

  const [suprimentoAmount, setSuprimentoAmount] = useState('');
  const [suprimentoReason, setSuprimentoReason] = useState('');

  const handleSangria = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    const val = parseFloat(sangriaAmount);
    if (!val || val <= 0) return;
    onAddSangria(val, sangriaReason || 'Retirada de Caixa');
    setSangriaAmount('');
    setSangriaReason('');
  };

  const handleSuprimento = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    const val = parseFloat(suprimentoAmount);
    if (!val || val <= 0) return;
    onAddSuprimento(val, suprimentoReason || 'Reforço de Caixa');
    setSuprimentoAmount('');
    setSuprimentoReason('');
  };

  return (
    <div className="sm:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Sangria */}
      <div className={`bg-slate-950/50 p-5 rounded-3xl border border-slate-800 space-y-4 shadow-inner ${disabled ? 'opacity-50' : ''}`}>
        <div className="text-[11px] font-black text-white uppercase italic flex items-center gap-2">
          <ArrowDownRight className="w-4 h-4 text-red-400" /> Sangria (Saída)
        </div>
        <form onSubmit={handleSangria} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="number"
              min="0.01"
              step="0.01"
              disabled={disabled}
              placeholder="Valor (R$)"
              value={sangriaAmount}
              onChange={(e) => setSangriaAmount(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 text-xs px-3 py-2 rounded-xl text-white outline-none focus:border-red-500 disabled:cursor-not-allowed"
            />
            <input
              type="text"
              disabled={disabled}
              placeholder="Motivo"
              value={sangriaReason}
              onChange={(e) => setSangriaReason(e.target.value)}
              className="flex-[2] bg-slate-900 border border-slate-800 text-xs px-3 py-2 rounded-xl text-white outline-none focus:border-red-500 disabled:cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            disabled={disabled}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-black text-[9px] py-2 rounded-xl uppercase tracking-widest transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {disabled ? 'ABRA O CAIXA PARA OPERAR' : 'CONFIRMAR SAÍDA'}
          </button>
        </form>
      </div>

      {/* Suprimento */}
      <div className={`bg-slate-950/50 p-5 rounded-3xl border border-slate-800 space-y-4 shadow-inner ${disabled ? 'opacity-50' : ''}`}>
        <div className="text-[11px] font-black text-white uppercase italic flex items-center gap-2">
          <ArrowUpRight className="w-4 h-4 text-emerald-400" /> Suprimento (Entrada)
        </div>
        <form onSubmit={handleSuprimento} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="number"
              min="0.01"
              step="0.01"
              disabled={disabled}
              placeholder="Valor (R$)"
              value={suprimentoAmount}
              onChange={(e) => setSuprimentoAmount(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 text-xs px-3 py-2 rounded-xl text-white outline-none focus:border-emerald-500 disabled:cursor-not-allowed"
            />
            <input
              type="text"
              disabled={disabled}
              placeholder="Motivo"
              value={suprimentoReason}
              onChange={(e) => setSuprimentoReason(e.target.value)}
              className="flex-[2] bg-slate-900 border border-slate-800 text-xs px-3 py-2 rounded-xl text-white outline-none focus:border-emerald-500 disabled:cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            disabled={disabled}
            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-black text-[9px] py-2 rounded-xl uppercase tracking-widest transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {disabled ? 'ABRA O CAIXA PARA OPERAR' : 'CONFIRMAR ENTRADA'}
          </button>
        </form>
      </div>
    </div>
  );
};
