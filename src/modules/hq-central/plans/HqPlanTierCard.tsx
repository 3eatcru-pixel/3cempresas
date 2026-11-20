import React from 'react';
import { Building2, Edit3 } from 'lucide-react';
import { SubscriptionPlanTier } from '../../../types';
import { SAAS_PLAN_TIERS } from '../../../constants/platformDefaults';

interface HqPlanTierCardProps {
  planDef: typeof SAAS_PLAN_TIERS[number];
  monthly: number;
  quarterly: number;
  annual: number;
  branches: number;
  maxDevices: number;
  countActive: number;
  canEdit?: boolean;
  onEdit: (planTier: SubscriptionPlanTier) => void;
}

export const HqPlanTierCard: React.FC<HqPlanTierCardProps> = ({
  planDef,
  monthly,
  quarterly,
  annual,
  branches,
  maxDevices,
  countActive,
  canEdit = true,
  onEdit,
}) => {
  const planTier = planDef.tier;

  return (
    <div
      className={`p-6 rounded-2xl border-2 flex flex-col justify-between space-y-4 shadow-xl relative overflow-hidden transition-all ${
        planTier === 'PRO'
          ? 'bg-gradient-to-b from-slate-900 to-amber-950/40 border-amber-500'
          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
      }`}
    >
      {planTier === 'PRO' && (
        <div className="absolute top-3 right-3 bg-amber-500 text-slate-950 font-black text-[9px] uppercase px-2.5 py-0.5 rounded-full shadow">
          MAIS POPULAR
        </div>
      )}

      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{planDef.badge}</span>
            <h3 className="text-xl font-black text-white">{planDef.name}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{planDef.description}</p>
          </div>
        </div>

        <div className="space-y-1 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono">
          <div className="text-xs text-slate-400">Capacidade de Filiais & Terminais:</div>
          <div className="text-lg font-black text-amber-400 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{branches === 1 ? '1 Filial' : `Até ${branches} Filiais`}</span>
          </div>
          <div className="text-[10px] text-emerald-400 font-bold">
            Dispositivos &amp; Terminais: {maxDevices >= 999 ? 'Até 999 (Rede)' : `Até ${maxDevices} por loja`}
          </div>
        </div>

        <div className="space-y-2 pt-2 text-xs">
          <div className="flex justify-between items-center text-slate-300">
            <span>Plano Mensal:</span>
            <span className="font-mono font-bold text-white">R$ {monthly.toFixed(2)}/mês</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>Plano Trimestral (-10%):</span>
            <span className="font-mono font-bold text-emerald-400">R$ {quarterly.toFixed(2)}/mês</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>Plano Anual (-25%):</span>
            <span className="font-mono font-bold text-amber-400">R$ {annual.toFixed(2)}/mês</span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs">
        <span className="font-mono font-bold text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
          {countActive} lojas ativas
        </span>
        {canEdit ? (
          <button
            onClick={() => onEdit(planTier)}
            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" /> Customizar Preço
          </button>
        ) : (
          <span className="text-[10px] font-mono text-slate-500">Somente Leitura</span>
        )}
      </div>
    </div>
  );
};
