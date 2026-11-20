import React, { useState } from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { SAAS_PLAN_TIERS } from '../../constants/platformDefaults';
import { CreditCard } from 'lucide-react';
import { SubscriptionPlanTier } from '../../types';
import { getDefaultBranchesForPlan, getDefaultDevicesForPlan } from '../../utils/storeDomain';
import { HqPlanTierCard } from './plans/HqPlanTierCard';
import { HqPlanPricingModal } from './plans/HqPlanPricingModal';
import { HqBillingPaymentConfigCard } from './plans/HqBillingPaymentConfigCard';
import { HqStoresBillingTable } from './plans/HqStoresBillingTable';
import { HqBillingPipeline } from './layout/HqBillingPipeline';

export const HqPlansTab: React.FC = () => {
  const { profile } = useAuth();
  const {
    stores,
    governance,
    updatePlanPricing,
    updateGovernanceSettings,
    updateStoreSubscription,
    toggleStoreBillingStatus,
    triggerBillingReconciliation,
    showNotification,
  } = useEcosystem();
  const [editingTier, setEditingTier] = useState<SubscriptionPlanTier | null>(null);
  const isDevOwner = profile?.role === 'DEV_OWNER';
  const isHqAdmin = profile?.role === 'DEV_OWNER' || profile?.role === 'SUPER_ADMIN';

  const handleSavePricing = async (
    tier: SubscriptionPlanTier,
    pricing: { monthlyPrice: number; quarterlyPrice: number; annualPrice: number; maxDevices: number; maxBranches: number }
  ) => {
    if (!isDevOwner) {
      showNotification('Apenas o DEV_OWNER pode alterar a tabela global de preços SaaS.');
      return;
    }
    await updatePlanPricing(tier, pricing);
    setEditingTier(null);
    showNotification(`Preços do plano ${tier} atualizados!`);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-400" /> Tabela Oficial de Planos SaaS (Filiais &amp; Dispositivos)
            </h2>
            <p className="text-xs text-slate-400">
              Cotas de filiais e terminais (PDV, KDS, Garçom) aplicadas e validadas pelo Server Core.
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
            0% de Comissão em Vendas Diretas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {SAAS_PLAN_TIERS.map(defaultPlan => {
            const planTier = defaultPlan.tier;
            const custom = governance.planPricing?.[planTier];
            const monthly = custom?.monthlyPrice ?? defaultPlan.monthlyPrice;
            const quarterly = custom?.quarterlyPrice ?? defaultPlan.quarterlyPrice;
            const annual = custom?.annualPrice ?? defaultPlan.annualPrice;
            const branches = custom?.maxBranches ?? defaultPlan.maxBranches ?? getDefaultBranchesForPlan(planTier);
            const maxDevices = custom?.maxDevices ?? defaultPlan.maxDevices ?? getDefaultDevicesForPlan(planTier);
            const countActive = stores.filter(s => s.subscriptionPlan === planTier).length;

            return (
              <HqPlanTierCard
                key={planTier}
                planDef={defaultPlan}
                monthly={monthly}
                quarterly={quarterly}
                annual={annual}
                branches={branches}
                maxDevices={maxDevices}
                countActive={countActive}
                canEdit={isDevOwner}
                onEdit={(t) => isDevOwner && setEditingTier(t)}
              />
            );
          })}
        </div>
      </div>

      {isDevOwner && (
        <HqPlanPricingModal
          editingTier={editingTier}
          governance={governance}
          onClose={() => setEditingTier(null)}
          onSave={handleSavePricing}
        />
      )}

      <HqBillingPaymentConfigCard
        governance={governance}
        canEdit={isDevOwner}
        onSave={updateGovernanceSettings}
        onNotify={showNotification}
      />

      <HqBillingPipeline
        stores={stores}
        governance={governance}
        onReconcile={
          isDevOwner
            ? triggerBillingReconciliation
            : async () => {
                showNotification('Reconciliação em lote do motor de faturamento é restrita ao DEV_OWNER.');
              }
        }
        onNotify={showNotification}
      />

      <HqStoresBillingTable
        stores={stores}
        governance={governance}
        canManageBilling={isHqAdmin}
        onConfirmPayment={async (storeId, nextStatus) => {
          await toggleStoreBillingStatus(storeId, nextStatus);
        }}
        onApproveUpgrade={async (store) => {
          const req = store.pendingUpgradeRequest;
          if (!req) return;
          await updateStoreSubscription(
            store.id,
            req.requestedPlan,
            req.billingCycle,
            undefined,
            undefined,
            undefined,
            {
              saasPaymentStatus: 'PAID',
              ...(typeof req.estimatedAmount === 'number' && Number.isFinite(req.estimatedAmount)
                ? { saasMonthlyFee: req.estimatedAmount }
                : {}),
            }
          );
        }}
      />
    </div>
  );
};
