import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  X,
  Building2,
  Tag,
  CheckCircle2,
  AlertCircle,
  QrCode,
  CreditCard,
  FileText,
  Landmark,
  Link2,
} from 'lucide-react';
import {
  SubscriptionPlanTier,
  BillingCycle,
  Store,
  PlatformGovernance,
  PlatformBillingPaymentConfig,
  SaasPaymentMethod,
} from '../../../types';
import {
  DEFAULT_PLATFORM_BILLING_CONFIG,
  SAAS_PLAN_TIERS,
} from '../../../constants/platformDefaults';
import { getDefaultBranchesForPlan, getDefaultDevicesForPlan } from '../../../utils/storeDomain';
import { BillingPixPaymentPanel } from './BillingPixPaymentPanel';
import { generateEmvCoPixPayload } from '../../../utils/pix';
import { useEcosystem } from '../../../context/EcosystemContext';
import { useAuth } from '../../../context/AuthContext';
import { apiClient } from '../../../core/api/apiClient';
import { evaluateMerchantCoupon } from '../../marketplace/checkout/couponPricing';

interface BillingUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStore: Store;
  governance: PlatformGovernance;
  onConfirmUpgrade: (
    plan: SubscriptionPlanTier,
    cycle: BillingCycle,
    maxBranches: number,
    couponCode?: string,
    paymentMethod?: SaasPaymentMethod
  ) => Promise<void>;
}

const METHOD_META: Record<
  SaasPaymentMethod,
  { label: string; shortDesc: string; ctaVerb: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PIX: { label: 'PIX', shortDesc: 'QR Code instantâneo', ctaVerb: 'Gerar PIX', icon: QrCode },
  CREDIT_CARD: { label: 'Cartão Crédito', shortDesc: 'Recorrente / Parcelado', ctaVerb: 'Pagar c/ Crédito', icon: CreditCard },
  DEBIT_CARD: { label: 'Cartão Débito', shortDesc: 'Débito online', ctaVerb: 'Pagar c/ Débito', icon: CreditCard },
  BOLETO: { label: 'Boleto', shortDesc: 'Fatura bancária', ctaVerb: 'Gerar Boleto', icon: FileText },
  BANK_TRANSFER: { label: 'TED / DOC', shortDesc: 'Transferência bancária', ctaVerb: 'Ver Dados Bancários', icon: Landmark },
  PAYMENT_LINK: { label: 'Link / Carteira', shortDesc: 'Portal PSP externo', ctaVerb: 'Abrir Link Pagamento', icon: Link2 },
};

const getAvailableMethods = (cfg: PlatformBillingPaymentConfig): SaasPaymentMethod[] => {
  const methods: SaasPaymentMethod[] = [];
  if (cfg.pixEnabled) methods.push('PIX');
  if (cfg.creditCardEnabled) methods.push('CREDIT_CARD');
  if (cfg.debitCardEnabled) methods.push('DEBIT_CARD');
  if (cfg.boletoEnabled) methods.push('BOLETO');
  if (cfg.bankTransferEnabled) methods.push('BANK_TRANSFER');
  if (cfg.paymentLinkEnabled) methods.push('PAYMENT_LINK');
  return methods.length > 0 ? methods : ['PIX'];
};

export const BillingUpgradeModal: React.FC<BillingUpgradeModalProps> = ({
  isOpen,
  onClose,
  currentStore,
  governance,
  onConfirmUpgrade,
}) => {
  const { coupons } = useEcosystem();
  const { getIdToken } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanTier>('PRO');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [paymentMethod, setPaymentMethod] = useState<SaasPaymentMethod>('PIX');
  const [couponInput, setCouponInput] = useState('');
  const [isPaymentStep, setIsPaymentStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [livePlanPricing, setLivePlanPricing] = useState<PlatformGovernance['planPricing'] | undefined>(
    governance.planPricing
  );
  const [liveBillingConfig, setLiveBillingConfig] = useState<PlatformBillingPaymentConfig>({
    ...DEFAULT_PLATFORM_BILLING_CONFIG,
    ...(governance.billingConfig || {}),
  });

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const remote = await apiClient.getStoreBillingConfig(token);
        if (cancelled || !remote) return;
        if (remote.planPricing) {
          setLivePlanPricing(remote.planPricing as PlatformGovernance['planPricing']);
        }
        if (remote.billingConfig) {
          const merged: PlatformBillingPaymentConfig = {
            ...DEFAULT_PLATFORM_BILLING_CONFIG,
            ...remote.billingConfig,
          };
          setLiveBillingConfig(merged);
          const allowed = getAvailableMethods(merged);
          setPaymentMethod((prev) => (allowed.includes(prev) ? prev : allowed[0]));
        }
      } catch {
        // Fallback to local governance snapshot when offline
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, getIdToken]);

  const effectivePlanPricing = livePlanPricing || governance.planPricing;
  const availableMethods = useMemo(() => getAvailableMethods(liveBillingConfig), [liveBillingConfig]);

  const customTier = effectivePlanPricing?.[selectedPlan];
  const defaultTier = SAAS_PLAN_TIERS.find(t => t.tier === selectedPlan);
  const baseMonthly = customTier?.monthlyPrice ?? defaultTier?.monthlyPrice ?? 299;
  const baseQuarterly = customTier?.quarterlyPrice ?? defaultTier?.quarterlyPrice ?? 269.1;
  const baseAnnual = customTier?.annualPrice ?? defaultTier?.annualPrice ?? 224.25;
  const maxBranches = customTier?.maxBranches ?? defaultTier?.maxBranches ?? getDefaultBranchesForPlan(selectedPlan);

  const currentPrice =
    billingCycle === 'ANNUAL' ? baseAnnual : billingCycle === 'QUARTERLY' ? baseQuarterly : baseMonthly;
  const baseTotalBilling =
    Math.round(
      (billingCycle === 'ANNUAL' ? currentPrice * 12 : billingCycle === 'QUARTERLY' ? currentPrice * 3 : currentPrice) *
        100
    ) / 100;

  const couponEval = useMemo(
    () =>
      evaluateMerchantCoupon({
        coupons,
        couponCode: couponInput,
        selectedPlan,
        subscriptionAmount: baseTotalBilling,
      }),
    [coupons, couponInput, selectedPlan, baseTotalBilling]
  );

  const totalBilling = Math.round(Math.max(0, baseTotalBilling - couponEval.discount) * 100) / 100;
  const maxInstallments = Math.max(1, Math.min(12, Number(liveBillingConfig.maxCreditInstallments ?? 12)));

  const pixPayload = useMemo(() => {
    if (!liveBillingConfig.pixEnabled || !liveBillingConfig.pixKey.trim()) return '';
    return generateEmvCoPixPayload({
      pixKey: liveBillingConfig.pixKey.trim(),
      amount: totalBilling,
      merchantName: liveBillingConfig.beneficiaryName || '3C CORP SAAS',
      merchantCity: liveBillingConfig.beneficiaryCity || currentStore.city || 'BRASIL',
      txid: `UPG${currentStore.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15)}`,
      description: `Upgrade ${selectedPlan} ${billingCycle}`,
    });
  }, [
    liveBillingConfig.pixEnabled,
    liveBillingConfig.pixKey,
    liveBillingConfig.beneficiaryName,
    liveBillingConfig.beneficiaryCity,
    totalBilling,
    currentStore.id,
    currentStore.city,
    selectedPlan,
    billingCycle,
  ]);

  if (!isOpen) return null;

  const handleConfirmPaymentDone = async () => {
    setIsSubmitting(true);
    try {
      await onConfirmUpgrade(
        selectedPlan,
        billingCycle,
        maxBranches,
        couponEval.matchedCoupon?.code,
        paymentMethod
      );
      setIsPaymentStep(false);
      setCouponInput('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextActionLabel = `${METHOD_META[paymentMethod].ctaVerb} • R$ ${totalBilling.toFixed(2)}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-scaleIn max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="font-black text-white text-base uppercase italic tracking-tighter">
              Solicitar Upgrade de Plano (Filiais &amp; Terminais)
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isPaymentStep ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center p-1 bg-slate-950 rounded-2xl border border-slate-800 max-w-xs mx-auto">
              {[
                { id: 'MONTHLY', label: 'Mensal' },
                { id: 'QUARTERLY', label: 'Trimestral (-10%)' },
                { id: 'ANNUAL', label: 'Anual (-25%)' },
              ].map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setBillingCycle(c.id as BillingCycle)}
                  className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer ${
                    billingCycle === c.id
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SAAS_PLAN_TIERS.filter(t => t.tier !== 'FREE').map(tierDef => {
                const tierId = tierDef.tier;
                const custom = effectivePlanPricing?.[tierId];
                const monthlyPrice = custom?.monthlyPrice ?? tierDef.monthlyPrice;
                const quarterlyPrice = custom?.quarterlyPrice ?? tierDef.quarterlyPrice;
                const annualPrice = custom?.annualPrice ?? tierDef.annualPrice;
                const branchesQuota = custom?.maxBranches ?? tierDef.maxBranches ?? getDefaultBranchesForPlan(tierId);
                const devicesQuota = custom?.maxDevices ?? tierDef.maxDevices ?? getDefaultDevicesForPlan(tierId);

                const priceToDisplay =
                  billingCycle === 'ANNUAL' ? annualPrice : billingCycle === 'QUARTERLY' ? quarterlyPrice : monthlyPrice;
                const isSelected = selectedPlan === tierId;

                return (
                  <div
                    key={tierId}
                    onClick={() => setSelectedPlan(tierId)}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer relative flex flex-col justify-between space-y-2 ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 text-white shadow-xl shadow-amber-500/10'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold uppercase text-slate-400">{tierDef.badge}</span>
                      <h5 className="font-black text-sm text-white uppercase">{tierDef.name}</h5>
                      <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        <span>
                          {branchesQuota >= 5 ? `Até ${branchesQuota} Filiais` : branchesQuota === 1 ? '1 Filial' : `Até ${branchesQuota} Filiais`} • {devicesQuota >= 999 ? 'Terminais Ilimitados' : `Até ${devicesQuota} Terminais`}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <div className="text-base font-black text-amber-400 font-mono">
                        R$ {priceToDisplay.toFixed(2)}
                        <span className="text-[9px] text-slate-400 font-normal"> /mês</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Payment Method Selector driven by HQ Billing Config */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Escolha o Modo de Pagamento ({availableMethods.length} opções)
                </span>
                {paymentMethod === 'CREDIT_CARD' && maxInstallments > 1 && totalBilling > 0 && (
                  <span className="text-[10px] font-mono text-blue-300">
                    Em até {maxInstallments}x de R$ {(totalBilling / maxInstallments).toFixed(2)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableMethods.map((method) => {
                  const active = paymentMethod === method;
                  const meta = METHOD_META[method];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-200 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-emerald-400' : 'text-slate-500'}`} />
                        <span className="truncate">{meta.label}</span>
                      </div>
                      <div className="text-[9px] text-slate-400 truncate mt-0.5">{meta.shortDesc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-400" /> Cupom Promocional SaaS p/ Lojista (Opcional)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={e => setCouponInput(e.target.value)}
                  placeholder="Ex: LOJISTAPRO20"
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono uppercase text-white focus:outline-none focus:border-amber-500"
                />
                {couponEval.matchedCoupon && (
                  <span className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold whitespace-nowrap flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> -R$ {couponEval.discount.toFixed(2)}
                  </span>
                )}
              </div>
              {couponEval.isInvalid && couponInput.trim() && (
                <p className="text-[10px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{couponEval.errorReason || 'Cupom SaaS inválido.'}</span>
                </p>
              )}
              {couponEval.discount > 0 && (
                <div className="flex justify-between text-[11px] font-mono text-slate-300 pt-1 border-t border-slate-800/80">
                  <span>Subtotal da assinatura: R$ {baseTotalBilling.toFixed(2)}</span>
                  <span className="text-emerald-400 font-bold">Total com cupom: R$ {totalBilling.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setIsPaymentStep(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                <span>{nextActionLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <BillingPixPaymentPanel
            storeId={currentStore.id}
            selectedPlan={selectedPlan}
            billingCycle={billingCycle}
            paymentMethod={paymentMethod}
            couponCode={couponEval.matchedCoupon?.code}
            totalBilling={totalBilling}
            pixPayload={pixPayload}
            billingConfig={liveBillingConfig}
            isSubmitting={isSubmitting}
            onBack={() => setIsPaymentStep(false)}
            onConfirmPayment={handleConfirmPaymentDone}
          />
        )}
      </div>
    </div>
  );
};
