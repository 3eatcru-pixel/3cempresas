import React, { useState, useMemo } from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { CouponAudience, SubscriptionPlanTier } from '../../types';
import { Building2, Search, ShoppingBag, Tag } from 'lucide-react';
import { HqCrmCampaignForm } from './crm/HqCrmCampaignForm';
import { HqCrmCouponsTable } from './crm/HqCrmCouponsTable';
import { HqStorePrivateCouponsAudit } from './crm/HqStorePrivateCouponsAudit';

export const HqCrmTab: React.FC = () => {
  const { coupons, stores, addCoupon, toggleCouponStatus, deleteCoupon, showNotification } = useEcosystem();

  const [activeAudienceTab, setActiveAudienceTab] = useState<CouponAudience>('CONSUMER');
  const [searchTerm, setSearchTerm] = useState('');
  const [showStoreCouponsAudit, setShowStoreCouponsAudit] = useState(false);

  // Creation form state
  const [campaignCode, setCampaignCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [campaignDiscount, setCampaignDiscount] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [campaignMinOrder, setCampaignMinOrder] = useState('50');
  const [usageLimit, setUsageLimit] = useState('1000');
  const [description, setDescription] = useState('');
  const [applicablePlans, setApplicablePlans] = useState<SubscriptionPlanTier[]>([]);
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().slice(0, 10);
  });

  // Strict domain separation:
  // 1) Merchant B2B SaaS coupons (issued by HQ for store owners on plans/upgrades)
  // 2) Consumer B2C Global HQ coupons (issued by HQ for end-consumers across Marketplace)
  // 3) Store-owned private B2C coupons (created inside each Store OS for its own storefront consumers)
  const merchantSaasCoupons = useMemo(
    () => coupons.filter((c) => !c._deleted && c.audience === 'MERCHANT' && !c.storeId),
    [coupons]
  );
  const consumerGlobalCoupons = useMemo(
    () => coupons.filter((c) => !c._deleted && c.audience !== 'MERCHANT' && !c.storeId),
    [coupons]
  );
  const storePrivateCoupons = useMemo(
    () => coupons.filter((c) => !c._deleted && Boolean(c.storeId)),
    [coupons]
  );

  const normalizedSearch = searchTerm.trim().toUpperCase();
  const filteredConsumerGlobal = useMemo(
    () =>
      normalizedSearch
        ? consumerGlobalCoupons.filter(
            (c) =>
              c.code?.toUpperCase().includes(normalizedSearch) ||
              c.description?.toUpperCase().includes(normalizedSearch)
          )
        : consumerGlobalCoupons,
    [consumerGlobalCoupons, normalizedSearch]
  );
  const filteredMerchantSaas = useMemo(
    () =>
      normalizedSearch
        ? merchantSaasCoupons.filter(
            (c) =>
              c.code?.toUpperCase().includes(normalizedSearch) ||
              c.description?.toUpperCase().includes(normalizedSearch)
          )
        : merchantSaasCoupons,
    [merchantSaasCoupons, normalizedSearch]
  );

  const handleSwitchAudienceTab = (nextAudience: CouponAudience) => {
    setActiveAudienceTab(nextAudience);
    if (nextAudience === 'MERCHANT') {
      setCampaignMinOrder('0');
      setUsageLimit('200');
    } else {
      setCampaignMinOrder('50');
      setUsageLimit('1000');
      setApplicablePlans([]);
    }
  };

  const toggleEligiblePlan = (plan: SubscriptionPlanTier) => {
    setApplicablePlans((prev) =>
      prev.includes(plan) ? prev.filter((p) => p !== plan) : [...prev, plan]
    );
  };

  const handleCreateCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = campaignCode.trim().toUpperCase();
    const numericVal = parseFloat(campaignDiscount);
    if (!cleanCode || cleanCode.length < 2 || isNaN(numericVal) || numericVal <= 0) {
      showNotification('Informe um código (mín. 2 caracteres) e valor de desconto válido.');
      return;
    }
    if (discountType === 'PERCENT' && numericVal > 100) {
      showNotification('Desconto percentual não pode exceder 100%.');
      return;
    }

    const parsedMaxDiscount =
      discountType === 'PERCENT' && maxDiscount.trim() ? parseFloat(maxDiscount) : undefined;
    const isMerchant = activeAudienceTab === 'MERCHANT';

    await addCoupon({
      code: cleanCode,
      audience: activeAudienceTab,
      discountType,
      discountValue: numericVal,
      ...(parsedMaxDiscount && parsedMaxDiscount > 0 ? { maxDiscount: parsedMaxDiscount } : {}),
      minOrderValue: parseFloat(campaignMinOrder) || 0,
      validUntil: validUntil || '2026-12-31',
      usageCount: 0,
      usageLimit: parseInt(usageLimit, 10) || (isMerchant ? 200 : 1000),
      isActive: true,
      ...(isMerchant && applicablePlans.length > 0 ? { applicablePlans } : {}),
      ...(isMerchant ? { tenantId: 'PLATFORM_HQ' } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
    });

    setCampaignCode('');
    setCampaignDiscount('');
    setMaxDiscount('');
    setDescription('');
    setApplicablePlans([]);
  };

  const activeMerchantCount = merchantSaasCoupons.filter((c) => c.isActive !== false).length;
  const activeConsumerCount = consumerGlobalCoupons.filter((c) => c.isActive !== false).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Overview & Audience Separation Header */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-400" /> Gestão de Cupons &amp; Campanhas HQ (B2C vs B2B)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Separação estrita entre cupons para <strong className="text-emerald-400">Consumidores</strong> (Marketplace/Pedidos) e cupons para <strong className="text-amber-400">Lojistas</strong> (Assinaturas e Upgrades SaaS).
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full lg:w-auto text-[11px] font-mono tabular-nums">
            <div className="px-3 py-2 rounded-xl bg-slate-950 border border-emerald-500/20">
              <div className="text-[10px] text-slate-400 uppercase">Consumidores HQ</div>
              <div className="text-emerald-400 font-bold">
                {activeConsumerCount}/{consumerGlobalCoupons.length} ativos
              </div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/20">
              <div className="text-[10px] text-slate-400 uppercase">Lojistas SaaS</div>
              <div className="text-amber-400 font-bold">
                {activeMerchantCount}/{merchantSaasCoupons.length} ativos
              </div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Privados Lojas</div>
              <div className="text-slate-300 font-bold">{storePrivateCoupons.length} B2C</div>
            </div>
          </div>
        </div>

        {/* Segmented Audience Switcher + Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="inline-flex p-1 bg-slate-950 rounded-xl border border-slate-800 gap-1">
            <button
              type="button"
              onClick={() => handleSwitchAudienceTab('CONSUMER')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeAudienceTab === 'CONSUMER'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Para Consumidores (B2C Marketplace)</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  activeAudienceTab === 'CONSUMER'
                    ? 'bg-slate-950/20 text-slate-950'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {consumerGlobalCoupons.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchAudienceTab('MERCHANT')}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeAudienceTab === 'MERCHANT'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Para Lojistas (SaaS B2B)</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  activeAudienceTab === 'MERCHANT'
                    ? 'bg-slate-950/20 text-slate-950'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {merchantSaasCoupons.length}
              </span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filtrar código ou campanha..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <HqCrmCampaignForm
          activeAudienceTab={activeAudienceTab}
          campaignCode={campaignCode}
          onChangeCampaignCode={setCampaignCode}
          discountType={discountType}
          onChangeDiscountType={setDiscountType}
          campaignDiscount={campaignDiscount}
          onChangeCampaignDiscount={setCampaignDiscount}
          maxDiscount={maxDiscount}
          onChangeMaxDiscount={setMaxDiscount}
          campaignMinOrder={campaignMinOrder}
          onChangeCampaignMinOrder={setCampaignMinOrder}
          validUntil={validUntil}
          onChangeValidUntil={setValidUntil}
          usageLimit={usageLimit}
          onChangeUsageLimit={setUsageLimit}
          description={description}
          onChangeDescription={setDescription}
          applicablePlans={applicablePlans}
          onClearApplicablePlans={() => setApplicablePlans([])}
          onToggleEligiblePlan={toggleEligiblePlan}
          onSubmit={handleCreateCampaignSubmit}
        />

        <HqCrmCouponsTable
          activeAudienceTab={activeAudienceTab}
          consumerCoupons={filteredConsumerGlobal}
          merchantCoupons={filteredMerchantSaas}
          onToggleCouponStatus={(id, nextStatus) => void toggleCouponStatus(id, nextStatus)}
          onDeleteCoupon={(id) => void deleteCoupon(id)}
        />
      </div>

      <HqStorePrivateCouponsAudit
        storePrivateCoupons={storePrivateCoupons}
        stores={stores}
        isOpen={showStoreCouponsAudit}
        onToggleOpen={() => setShowStoreCouponsAudit(!showStoreCouponsAudit)}
      />
    </div>
  );
};
