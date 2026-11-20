import React, { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Lock, Save, Wallet, Webhook } from 'lucide-react';
import { PlatformBillingPaymentConfig, PlatformGovernance } from '../../../types';
import { DEFAULT_PLATFORM_BILLING_CONFIG } from '../../../constants/platformDefaults';
import { generateEmvCoPixPayload } from '../../../utils/pix';
import { PAYMENT_METHOD_CARDS } from './billing-config/constants';
import { HqBillingMethodsGrid } from './billing-config/HqBillingMethodsGrid';
import { HqBillingPixAndBankSection } from './billing-config/HqBillingPixAndBankSection';
import { HqBillingPspAndRulesSection } from './billing-config/HqBillingPspAndRulesSection';

interface HqBillingPaymentConfigCardProps {
  governance: PlatformGovernance;
  canEdit: boolean;
  onSave: (updates: Partial<PlatformGovernance>) => Promise<void>;
  onNotify: (msg: string) => void;
}

export const HqBillingPaymentConfigCard: React.FC<HqBillingPaymentConfigCardProps> = ({
  governance,
  canEdit,
  onSave,
  onNotify,
}) => {
  const initialBilling = useMemo<PlatformBillingPaymentConfig>(
    () => ({
      ...DEFAULT_PLATFORM_BILLING_CONFIG,
      ...(governance.billingConfig || {}),
    }),
    [governance.billingConfig]
  );

  const [form, setForm] = useState<PlatformBillingPaymentConfig>(initialBilling);
  const [defaultTrialDays, setDefaultTrialDays] = useState<number>(
    Number(governance.defaultTrialDays ?? 7)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedPreviewPix, setCopiedPreviewPix] = useState(false);

  useEffect(() => {
    setForm({
      ...DEFAULT_PLATFORM_BILLING_CONFIG,
      ...(governance.billingConfig || {}),
    });
    setDefaultTrialDays(Number(governance.defaultTrialDays ?? 7));
  }, [governance.billingConfig, governance.defaultTrialDays]);

  const activeMethodsCount = useMemo(
    () => PAYMENT_METHOD_CARDS.filter((m) => Boolean(form[m.key])).length,
    [form]
  );

  const webhookUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/api/v1/admin/billing/webhook`;
    }
    return '/api/v1/admin/billing/webhook';
  }, []);

  const previewPixPayload = useMemo(() => {
    if (!form.pixEnabled || !form.pixKey.trim()) return '';
    return generateEmvCoPixPayload({
      pixKey: form.pixKey.trim(),
      amount: 149.0,
      merchantName: form.beneficiaryName.trim() || '3C CORP SAAS',
      merchantCity: form.beneficiaryCity.trim() || 'BRASIL',
      txid: 'TESTESAAS149',
      description: 'Teste Assinatura SaaS',
    });
  }, [form.pixEnabled, form.pixKey, form.beneficiaryName, form.beneficiaryCity]);

  const updateField = <K extends keyof PlatformBillingPaymentConfig>(
    key: K,
    value: PlatformBillingPaymentConfig[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const enableAllMethods = () => {
    if (!canEdit) return;
    setForm((prev) => ({
      ...prev,
      pixEnabled: true,
      creditCardEnabled: true,
      debitCardEnabled: true,
      boletoEnabled: true,
      bankTransferEnabled: true,
      paymentLinkEnabled: true,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      onNotify('Apenas o DEV_OWNER pode alterar as configurações de pagamento SaaS.');
      return;
    }
    if (activeMethodsCount === 0) {
      onNotify('Ative pelo menos um meio de pagamento para os lojistas.');
      return;
    }
    if (form.checkoutBaseUrl?.trim() && !/^https:\/\/.+/i.test(form.checkoutBaseUrl.trim())) {
      onNotify('A URL base de checkout/fatura deve iniciar com https://.');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        billingConfig: {
          ...form,
          pixKey: form.pixKey.trim(),
          beneficiaryName: form.beneficiaryName.trim() || '3C CORP SAAS',
          beneficiaryCity: form.beneficiaryCity.trim() || 'BRASIL',
          beneficiaryDocument: (form.beneficiaryDocument || '').trim(),
          bankName: (form.bankName || '').trim(),
          bankAgency: (form.bankAgency || '').trim(),
          bankAccount: (form.bankAccount || '').trim(),
          maxCreditInstallments: Math.min(12, Math.max(1, Math.floor(Number(form.maxCreditInstallments) || 12))),
          checkoutBaseUrl: (form.checkoutBaseUrl || '').trim(),
          billingSupportWhatsapp: (form.billingSupportWhatsapp || '').trim(),
          billingSupportEmail: (form.billingSupportEmail || '').trim(),
          paymentInstructions: (form.paymentInstructions || '').trim(),
        },
        defaultTrialDays: Math.min(365, Math.max(1, Math.floor(Number(defaultTrialDays) || 7))),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyText = (text: string, setter: (v: boolean) => void) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const webhookConfigured = Boolean(governance.pspWebhookConfigured);

  return (
    <form
      onSubmit={handleSave}
      className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-6 shadow-xl"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            Configuração de Pagamentos para Lojistas (Recebimento SaaS)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Libere e configure todos os meios de pagamento que os lojistas podem escolher no Store OS (PIX, Crédito, Débito, Boleto, TED/DOC e Link de Pagamento).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
            <CheckCheck className="w-3.5 h-3.5" />
            {activeMethodsCount}/{PAYMENT_METHOD_CARDS.length} Meios Liberados
          </span>
          <span
            className={`px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
              webhookConfigured
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                : 'bg-slate-950 border-slate-700 text-slate-400'
            }`}
          >
            <Webhook className="w-3.5 h-3.5" />
            {webhookConfigured ? 'Webhook HMAC Ativo' : 'Baixa Manual / Webhook Inativo'}
          </span>
        </div>
      </div>

      {!canEdit && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <Lock className="w-4 h-4 shrink-0" />
          <span>Visualização somente leitura. Apenas o perfil DEV_OWNER pode alterar dados bancários e regras de cobrança da plataforma.</span>
        </div>
      )}

      <HqBillingMethodsGrid
        form={form}
        canEdit={canEdit}
        activeMethodsCount={activeMethodsCount}
        onUpdateField={updateField}
        onEnableAllMethods={enableAllMethods}
      />

      <HqBillingPixAndBankSection
        form={form}
        canEdit={canEdit}
        previewPixPayload={previewPixPayload}
        copiedPreviewPix={copiedPreviewPix}
        onUpdateField={updateField}
        onCopyPreviewPix={() => copyText(previewPixPayload, setCopiedPreviewPix)}
      />

      <HqBillingPspAndRulesSection
        form={form}
        defaultTrialDays={defaultTrialDays}
        canEdit={canEdit}
        webhookUrl={webhookUrl}
        webhookConfigured={webhookConfigured}
        copiedWebhook={copiedWebhook}
        onUpdateField={updateField}
        onChangeTrialDays={setDefaultTrialDays}
        onCopyWebhook={() => copyText(webhookUrl, setCopiedWebhook)}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-800">
        <span className="text-[11px] text-slate-400">
          Alterações entram em vigor imediatamente no checkout de assinatura do Store OS e nas cobranças do HQ.
        </span>
        <button
          type="submit"
          disabled={!canEdit || isSaving}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Salvando...' : 'Salvar Configuração de Pagamentos'}</span>
        </button>
      </div>
    </form>
  );
};
