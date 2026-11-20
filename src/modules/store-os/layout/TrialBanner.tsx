import React from 'react';
import { Clock } from 'lucide-react';
import { SubscriptionPlanTier } from '../../../types';

interface TrialBannerProps {
  isFreeTrial: boolean;
  isTrialExpired: boolean;
  trialDaysRemaining: number;
  onOpenBilling: () => void;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({
  isFreeTrial,
  isTrialExpired,
  trialDaysRemaining,
  onOpenBilling
}) => {
  if (!isFreeTrial) return null;

  return (
    <div className={`absolute top-2 left-24 right-4 z-20 px-4 py-2 rounded-2xl backdrop-blur-xl border flex items-center justify-between shadow-xl transition-all ${
      isTrialExpired 
        ? 'bg-rose-950/90 border-rose-500/50 text-rose-200 shadow-rose-950/50' 
        : 'bg-slate-950/85 border-amber-500/40 text-amber-200 shadow-slate-950/50'
    }`}>
      <div className="flex items-center gap-2.5">
        <div className={`p-1.5 rounded-xl ${isTrialExpired ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
            <span>{isTrialExpired ? 'Período de Degustação Expirado' : 'Período de Degustação Gratuito (Free Trial)'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 font-mono font-bold text-white border border-white/10">
              {isTrialExpired ? '0 dias restantes' : `${trialDaysRemaining} dias restantes`}
            </span>
          </div>
          <p className="text-[10px] opacity-80 mt-0.5 hidden sm:block">
            {isTrialExpired 
              ? 'Seu período de teste encerrou. Regularize via PIX direto para manter suas operações, PDV e comandas ativas.'
              : 'Você está no plano de degustação. Teste livremente o PDV, comanda de mesas e vitrine comercial na sua cidade.'}
          </p>
        </div>
      </div>

      <button
        onClick={onOpenBilling}
        className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md ${
          isTrialExpired 
            ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:brightness-110 text-white animate-pulse' 
            : 'bg-gradient-to-r from-amber-500 to-orange-400 hover:brightness-110 text-slate-950'
        }`}
      >
        {isTrialExpired ? 'Regularizar via PIX' : 'Fazer Upgrade Definitivo'}
      </button>
    </div>
  );
};
