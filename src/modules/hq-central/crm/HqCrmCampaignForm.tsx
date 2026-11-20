import React from 'react';
import { Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { CouponAudience, SubscriptionPlanTier } from '../../../types';

export const SAAS_ELIGIBLE_PLAN_OPTIONS: { id: SubscriptionPlanTier; label: string }[] = [
  { id: 'PROMO', label: 'Promo' },
  { id: 'BASIC', label: 'Basic' },
  { id: 'PRO', label: 'Pro' },
  { id: 'ENTERPRISE', label: 'Enterprise' },
];

interface HqCrmCampaignFormProps {
  activeAudienceTab: CouponAudience;
  campaignCode: string;
  onChangeCampaignCode: (val: string) => void;
  discountType: 'PERCENT' | 'FIXED';
  onChangeDiscountType: (val: 'PERCENT' | 'FIXED') => void;
  campaignDiscount: string;
  onChangeCampaignDiscount: (val: string) => void;
  maxDiscount: string;
  onChangeMaxDiscount: (val: string) => void;
  campaignMinOrder: string;
  onChangeCampaignMinOrder: (val: string) => void;
  validUntil: string;
  onChangeValidUntil: (val: string) => void;
  usageLimit: string;
  onChangeUsageLimit: (val: string) => void;
  description: string;
  onChangeDescription: (val: string) => void;
  applicablePlans: SubscriptionPlanTier[];
  onClearApplicablePlans: () => void;
  onToggleEligiblePlan: (plan: SubscriptionPlanTier) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const HqCrmCampaignForm: React.FC<HqCrmCampaignFormProps> = ({
  activeAudienceTab,
  campaignCode,
  onChangeCampaignCode,
  discountType,
  onChangeDiscountType,
  campaignDiscount,
  onChangeCampaignDiscount,
  maxDiscount,
  onChangeMaxDiscount,
  campaignMinOrder,
  onChangeCampaignMinOrder,
  validUntil,
  onChangeValidUntil,
  usageLimit,
  onChangeUsageLimit,
  description,
  onChangeDescription,
  applicablePlans,
  onClearApplicablePlans,
  onToggleEligiblePlan,
  onSubmit,
}) => {
  return (
    <form
      onSubmit={onSubmit}
      className={`bg-slate-950 p-4 rounded-xl border space-y-3 ${
        activeAudienceTab === 'MERCHANT' ? 'border-amber-500/30' : 'border-emerald-500/30'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-white flex items-center gap-2">
          <Sparkles
            className={`w-4 h-4 ${
              activeAudienceTab === 'MERCHANT' ? 'text-amber-400' : 'text-emerald-400'
            }`}
          />
          <span>
            {activeAudienceTab === 'MERCHANT'
              ? 'Novo Cupom para Lojistas (Planos, Upgrades & Assinaturas SaaS)'
              : 'Novo Cupom Global para Consumidores (Pedidos no Marketplace)'}
          </span>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1 ${
            activeAudienceTab === 'MERCHANT'
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
          }`}
        >
          <ShieldCheck className="w-3 h-3" />
          {activeAudienceTab === 'MERCHANT'
            ? 'BLOQUEADO NO CHECKOUT B2C'
            : 'BLOQUEADO EM FATURAS SAAS B2B'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <input
          type="text"
          placeholder={
            activeAudienceTab === 'MERCHANT'
              ? 'Código (ex: LOJISTAPRO20)'
              : 'Código (ex: BEMVINDO20)'
          }
          value={campaignCode}
          onChange={(e) => onChangeCampaignCode(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-xs text-white p-2.5 rounded-xl uppercase font-mono focus:outline-none focus:border-amber-500"
        />
        <select
          value={discountType}
          onChange={(e) => onChangeDiscountType(e.target.value as 'PERCENT' | 'FIXED')}
          className="bg-slate-900 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-mono focus:outline-none"
        >
          <option value="PERCENT">Percentual (%)</option>
          <option value="FIXED">Valor Fixo (R$)</option>
        </select>
        <input
          type="number"
          step="0.01"
          placeholder={discountType === 'PERCENT' ? '% Desconto (ex: 20)' : 'Valor R$ (ex: 50)'}
          value={campaignDiscount}
          onChange={(e) => onChangeCampaignDiscount(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-mono tabular-nums focus:outline-none"
        />
        <input
          type="number"
          step="0.01"
          disabled={discountType !== 'PERCENT'}
          placeholder={discountType === 'PERCENT' ? 'Teto R$ (opcional)' : 'Sem teto (Fixo)'}
          value={maxDiscount}
          onChange={(e) => onChangeMaxDiscount(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-mono tabular-nums focus:outline-none disabled:opacity-40"
          title="Desconto máximo em R$ para cupons percentuais"
        />
        <input
          type="number"
          step="0.01"
          placeholder={activeAudienceTab === 'MERCHANT' ? 'Fatura Mínima R$' : 'Pedido Mínimo R$'}
          value={campaignMinOrder}
          onChange={(e) => onChangeCampaignMinOrder(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-mono tabular-nums focus:outline-none"
          title={
            activeAudienceTab === 'MERCHANT'
              ? 'Valor mínimo da assinatura para aplicar'
              : 'Pedido mínimo do consumidor para aplicar'
          }
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={validUntil}
            onChange={(e) => onChangeValidUntil(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-mono focus:outline-none"
            title="Validade da Campanha"
          />
          <input
            type="number"
            placeholder="Limite"
            value={usageLimit}
            onChange={(e) => onChangeUsageLimit(e.target.value)}
            className="w-20 bg-slate-900 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-mono tabular-nums focus:outline-none"
            title="Limite máximo de usos"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-center">
        <input
          type="text"
          placeholder={
            activeAudienceTab === 'MERCHANT'
              ? 'Descrição interna (ex: Desconto de migração plano PRO/Enterprise)'
              : 'Descrição da campanha (ex: Frete/desconto 1ª compra no Marketplace)'
          }
          value={description}
          onChange={(e) => onChangeDescription(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none"
        />

        {activeAudienceTab === 'MERCHANT' && (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Planos elegíveis:</span>
            <button
              type="button"
              onClick={onClearApplicablePlans}
              className={`px-2.5 py-1 rounded-lg border font-mono text-[10px] cursor-pointer transition-colors ${
                applicablePlans.length === 0
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Todos os Planos
            </button>
            {SAAS_ELIGIBLE_PLAN_OPTIONS.map((p) => {
              const selected = applicablePlans.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onToggleEligiblePlan(p.id)}
                  className={`px-2.5 py-1 rounded-lg border font-mono text-[10px] cursor-pointer transition-colors ${
                    selected
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="submit"
        className={`w-full py-2.5 font-black text-xs rounded-xl shadow-md transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer ${
          activeAudienceTab === 'MERCHANT'
            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
        }`}
      >
        <Plus className="w-4 h-4" />
        {activeAudienceTab === 'MERCHANT'
          ? 'Emitir Cupom SaaS para Lojistas (B2B)'
          : 'Lançar Campanha Global para Consumidores (B2C)'}
      </button>
    </form>
  );
};
