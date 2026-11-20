import React from 'react';
import { Building2, Laptop, Sparkles } from 'lucide-react';
import { Store, DeviceLicense, PlatformGovernance } from '../../../types';
import { getStoreMaxBranches, getStoreMaxDevices, getTenantStores } from '../../../utils/storeDomain';

interface BillingCurrentPlanCardProps {
  currentStore: Store;
  stores: Store[];
  deviceLicenses: DeviceLicense[];
  governance?: PlatformGovernance;
  isFree: boolean;
  onOpenUpgrade: () => void;
}

export const BillingCurrentPlanCard: React.FC<BillingCurrentPlanCardProps> = ({
  currentStore,
  stores,
  deviceLicenses,
  governance,
  isFree,
  onOpenUpgrade,
}) => {
  const storeDevices = deviceLicenses.filter((d) => d.storeId === currentStore.id);
  const tenantBranches = getTenantStores(stores, currentStore);
  const maxBranches = getStoreMaxBranches(currentStore, governance);
  const maxDevices = getStoreMaxDevices(currentStore, governance);
  const branchesUsed = Math.max(1, tenantBranches.length);
  const usagePct = Math.min(100, (branchesUsed / maxBranches) * 100);
  const devicesQuotaReached = maxDevices < 999 && storeDevices.length >= maxDevices;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-slate-900/80 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          Plano Atual
        </div>
        <div className="flex justify-between items-end">
          <div>
            <div className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
              <span>{currentStore.subscriptionPlan}</span>
              {isFree && (
                <span className="px-2 py-0.5 rounded-md text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  DEGUSTAÇÃO
                </span>
              )}
            </div>
            <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-0.5">
              {currentStore.saasPaymentStatus === 'PAID'
                ? '● Assinatura Ativa'
                : currentStore.pendingUpgradeRequest?.status === 'PENDING_PAYMENT_CONFIRMATION'
                ? '◐ Upgrade Solicitado'
                : '▲ Trial / Pendente'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-black text-white font-mono">
              {currentStore.saasMonthlyFee === 0
                ? 'R$ 0,00'
                : `R$ ${currentStore.saasMonthlyFee?.toFixed(2)}`}
            </div>
            <div className="text-[9px] text-slate-500 font-bold uppercase italic">
              / {currentStore.billingCycle}
            </div>
          </div>
        </div>

        <button
          onClick={onOpenUpgrade}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-black text-[10px] py-3 rounded-xl uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>SOLICITAR UPGRADE OU MAIS FILIAIS</span>
        </button>
      </div>

      <div className="bg-slate-900/80 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between">
          <span className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-amber-400" /> Cota de Filiais do Plano
          </span>
          <span className="text-white font-mono">
            {branchesUsed} / {maxBranches} {maxBranches === 1 ? 'Filial' : 'Filiais'}
          </span>
        </div>
        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/5">
          <div
            className={`h-full shadow-[0_0_10px_rgba(245,158,11,0.4)] ${
              branchesUsed >= maxBranches
                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                : 'bg-gradient-to-r from-amber-400 to-emerald-500'
            }`}
            style={{ width: `${usagePct}%` }}
          />
        </div>
        <div
          className={`flex items-center justify-between bg-slate-950/70 border rounded-xl px-3.5 py-2.5 ${
            devicesQuotaReached ? 'border-amber-500/40' : 'border-slate-800'
          }`}
        >
          <div className={`flex items-center gap-2 text-[11px] font-bold ${devicesQuotaReached ? 'text-amber-400' : 'text-emerald-400'}`}>
            <Laptop className="w-4 h-4" />
            <span>
              {maxDevices >= 999
                ? 'Terminais Ilimitados (Enterprise)'
                : `Cota de Terminais: ${storeDevices.length} / ${maxDevices}`}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {storeDevices.length} pareado(s) nesta loja
          </span>
        </div>
      </div>
    </div>
  );
};
