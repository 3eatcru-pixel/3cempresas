import React, { useState, useEffect } from 'react';
import { CreditCard, Clock, X } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { SAAS_PLAN_TIERS } from '../../../constants/platformDefaults';
import { Store, SubscriptionPlanTier, BillingCycle } from '../../../types';
import {
  getDefaultBranchesForPlan,
  getDefaultDevicesForPlan,
  getDefaultEnabledModulesForCategory,
  getStoreMaxBranches,
  getStoreMaxDevices,
} from '../../../utils/storeDomain';
import { STORE_OS_MODULES_CATALOG, StoreModulesSelectorBox } from './StoreModulesSelectorBox';

export interface StoreCustomOverrides {
  maxAllowedDevices?: number;
  saasMonthlyFee?: number;
  commissionRate?: number;
  enabledModules?: string[];
  saasPaymentStatus?: 'TRIAL' | 'PENDING' | 'PAID' | 'OVERDUE';
}

interface EditStorePlanModalProps {
  store: Store | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    tier: SubscriptionPlanTier,
    cycle: BillingCycle,
    maxBranches: number,
    trialExpiresAt?: string,
    customOverrides?: StoreCustomOverrides
  ) => void;
}

export const EditStorePlanModal: React.FC<EditStorePlanModalProps> = ({
  store,
  isOpen,
  onClose,
  onSave,
}) => {
  const { governance } = useEcosystem();
  const [selectedPlanTier, setSelectedPlanTier] = useState<SubscriptionPlanTier>('FREE');
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('MONTHLY');
  const [customMaxBranches, setCustomMaxBranches] = useState<number>(1);
  const [customMaxDevices, setCustomMaxDevices] = useState<number>(2);
  const [customMonthlyFee, setCustomMonthlyFee] = useState<number>(0);
  const [customCommissionRate, setCustomCommissionRate] = useState<number>(12);
  const [paymentStatus, setPaymentStatus] = useState<'TRIAL' | 'PENDING' | 'PAID' | 'OVERDUE'>('PAID');
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [trialDays, setTrialDays] = useState<number>(7);

  useEffect(() => {
    if (store) {
      const tier = store.subscriptionPlan || 'FREE';
      setSelectedPlanTier(tier);
      setSelectedCycle(store.billingCycle || 'MONTHLY');
      setCustomMaxBranches(getStoreMaxBranches(store));
      setCustomMaxDevices(getStoreMaxDevices(store));
      setCustomMonthlyFee(Number(store.saasMonthlyFee ?? 0));
      setCustomCommissionRate(Number(store.commissionRate ?? 12));
      setPaymentStatus(
        (store.saasPaymentStatus as 'TRIAL' | 'PENDING' | 'PAID' | 'OVERDUE') ||
          (tier === 'FREE' ? 'TRIAL' : 'PAID')
      );
      setEnabledModules(
        Array.isArray(store.enabledModules) && store.enabledModules.length > 0
          ? store.enabledModules
          : getDefaultEnabledModulesForCategory(store.category)
      );
      if (store.trialExpiresAt) {
        const days = Math.max(
          1,
          Math.ceil(
            (new Date(store.trialExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
        );
        setTrialDays(days);
      } else {
        setTrialDays(7);
      }
    }
  }, [store]);

  if (!isOpen || !store) return null;

  const computeDefaultFee = (tier: SubscriptionPlanTier, cycle: BillingCycle) => {
    const customPricing = governance.planPricing?.[tier];
    const catalogPlan = SAAS_PLAN_TIERS.find((p) => p.tier === tier);
    const baseMonthly = customPricing?.monthlyPrice ?? catalogPlan?.monthlyPrice ?? 0;
    if (cycle === 'QUARTERLY') {
      return Number((customPricing?.quarterlyPrice ?? catalogPlan?.quarterlyPrice ?? baseMonthly * 0.9).toFixed(2));
    }
    if (cycle === 'ANNUAL') {
      return Number((customPricing?.annualPrice ?? catalogPlan?.annualPrice ?? baseMonthly * 0.75).toFixed(2));
    }
    return Number(baseMonthly.toFixed(2));
  };

  const toggleModule = (modId: string) => {
    setEnabledModules((prev) =>
      prev.includes(modId) ? prev.filter((id) => id !== modId) : [...prev, modId]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trialExpiresAt =
      selectedPlanTier === 'FREE'
        ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined;
    onSave(selectedPlanTier, selectedCycle, customMaxBranches, trialExpiresAt, {
      maxAllowedDevices: customMaxDevices,
      saasMonthlyFee: customMonthlyFee,
      commissionRate: customCommissionRate,
      saasPaymentStatus: paymentStatus,
      enabledModules,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleSave}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl"
      >
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-amber-400" />
              Customizar Licença &amp; Módulos: {store.name}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              Tenant: {store.tenantId || 'tenant-1'} • Loja ID: {store.id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto max-h-[72vh] pr-2 custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-bold">Nível do Plano SaaS</label>
              <select
                value={selectedPlanTier}
                onChange={(e) => {
                  const tier = e.target.value as SubscriptionPlanTier;
                  setSelectedPlanTier(tier);
                  setCustomMaxBranches(getDefaultBranchesForPlan(tier));
                  setCustomMaxDevices(getDefaultDevicesForPlan(tier));
                  setCustomMonthlyFee(computeDefaultFee(tier, selectedCycle));
                  if (tier === 'FREE') setPaymentStatus('TRIAL');
                }}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-bold focus:outline-none"
              >
                <option value="FREE">GRATUITO (1 Filial • Até 2 Dispositivos)</option>
                <option value="PROMO">PROMO (1 Filial • Até 3 Dispositivos)</option>
                <option value="BASIC">UNIDADE ÚNICA (1 Filial • Até 5 Dispositivos)</option>
                <option value="PRO">MULTI-UNIDADE (Até 2 Filiais • Até 15 Dispositivos)</option>
                <option value="ENTERPRISE">REDE &amp; FRANQUIAS (Até 5 Filiais • 999 Dispositivos)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-bold">Ciclo de Faturamento</label>
              <select
                value={selectedCycle}
                onChange={(e) => {
                  const nextCycle = e.target.value as BillingCycle;
                  setSelectedCycle(nextCycle);
                  setCustomMonthlyFee(computeDefaultFee(selectedPlanTier, nextCycle));
                }}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-bold focus:outline-none"
              >
                <option value="MONTHLY">Mensal</option>
                <option value="QUARTERLY">Trimestral (-10%)</option>
                <option value="ANNUAL">Anual (-25%)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-slate-300 font-bold">Cota de Filiais</label>
              <input
                type="number"
                min={1}
                max={500}
                value={customMaxBranches}
                onChange={(e) => setCustomMaxBranches(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-mono tabular-nums focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-300 font-bold">Cota Terminais</label>
              <input
                type="number"
                min={1}
                max={9999}
                value={customMaxDevices}
                onChange={(e) => setCustomMaxDevices(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-mono tabular-nums focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-300 font-bold">Mensalidade (R$)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={100000}
                value={customMonthlyFee}
                onChange={(e) => setCustomMonthlyFee(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-emerald-400 font-bold p-2.5 rounded-xl font-mono tabular-nums focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-300 font-bold">Comissão Mkt (%)</label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={100}
                value={customCommissionRate}
                onChange={(e) => setCustomCommissionRate(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-amber-400 font-bold p-2.5 rounded-xl font-mono tabular-nums focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-bold">Status Financeiro SaaS</label>
              <select
                value={paymentStatus}
                onChange={(e) =>
                  setPaymentStatus(e.target.value as 'TRIAL' | 'PENDING' | 'PAID' | 'OVERDUE')
                }
                className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-bold focus:outline-none"
              >
                <option value="TRIAL">TRIAL (Degustação)</option>
                <option value="PAID">PAID (Adimplente)</option>
                <option value="PENDING">PENDING (Aguardando Fatura)</option>
                <option value="OVERDUE">OVERDUE (Em Atraso)</option>
              </select>
            </div>

            {selectedPlanTier === 'FREE' && (
              <div className="space-y-1">
                <label className="text-xs text-amber-400 font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Duração Degustação (Dias)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={trialDays}
                  onChange={(e) => setTrialDays(Math.max(1, parseInt(e.target.value, 10) || 7))}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-mono tabular-nums focus:outline-none"
                />
              </div>
            )}
          </div>

          <StoreModulesSelectorBox
            enabledModules={enabledModules}
            onToggleModule={toggleModule}
            onSelectAll={() => setEnabledModules(STORE_OS_MODULES_CATALOG.map((m) => m.id))}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase rounded-xl shadow-lg cursor-pointer"
          >
            Salvar Licença &amp; Customizações
          </button>
        </div>
      </form>
    </div>
  );
};
