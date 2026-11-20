import React from 'react';
import { Check, Clock, Copy, Globe, ShieldCheck } from 'lucide-react';
import { PlatformBillingPaymentConfig, SaasPspProvider } from '../../../../types';
import { PSP_PROVIDER_OPTIONS } from './constants';

interface HqBillingPspAndRulesSectionProps {
  form: PlatformBillingPaymentConfig;
  defaultTrialDays: number;
  canEdit: boolean;
  webhookUrl: string;
  webhookConfigured: boolean;
  copiedWebhook: boolean;
  onUpdateField: <K extends keyof PlatformBillingPaymentConfig>(
    key: K,
    value: PlatformBillingPaymentConfig[K]
  ) => void;
  onChangeTrialDays: (days: number) => void;
  onCopyWebhook: () => void;
}

export const HqBillingPspAndRulesSection: React.FC<HqBillingPspAndRulesSectionProps> = ({
  form,
  defaultTrialDays,
  canEdit,
  webhookUrl,
  webhookConfigured,
  copiedWebhook,
  onUpdateField,
  onChangeTrialDays,
  onCopyWebhook,
}) => {
  return (
    <>
      {/* Section 3: Gateway PSP, Checkout & Suporte Financeiro */}
      <div className="space-y-4 pt-4 border-t border-slate-800/80">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-blue-400" />
          3. Gateway PSP, Portal de Checkout &amp; Atendimento Financeiro
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">
              Provedor de Pagamentos SaaS (PSP)
            </label>
            <select
              disabled={!canEdit}
              value={form.pspProvider}
              onChange={(e) => onUpdateField('pspProvider', e.target.value as SaasPspProvider)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-blue-500 disabled:opacity-60"
            >
              {PSP_PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500">
              {PSP_PROVIDER_OPTIONS.find((o) => o.id === form.pspProvider)?.hint}
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">
              URL Base de Checkout / Link de Pagamento (https://)
            </label>
            <input
              type="url"
              disabled={!canEdit}
              value={form.checkoutBaseUrl || ''}
              onChange={(e) => onUpdateField('checkoutBaseUrl', e.target.value)}
              placeholder="https://pay.suaempresa.com.br/assinaturas"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-blue-300 focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
            <p className="text-[10px] text-slate-500">
              Usada no Store OS para Cartão de Crédito, Débito, Boleto e Link de Pagamento.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">
              WhatsApp do Financeiro (Comprovantes &amp; Suporte)
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={form.billingSupportWhatsapp || ''}
              onChange={(e) => onUpdateField('billingSupportWhatsapp', e.target.value)}
              placeholder="Ex: (43) 99999-0000"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">
              E-mail do Financeiro
            </label>
            <input
              type="email"
              disabled={!canEdit}
              value={form.billingSupportEmail || ''}
              onChange={(e) => onUpdateField('billingSupportEmail', e.target.value)}
              placeholder="financeiro@suaempresa.com.br"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-slate-400">
            Instruções de Pagamento Exibidas aos Lojistas no Store OS
          </label>
          <textarea
            rows={2}
            disabled={!canEdit}
            maxLength={500}
            value={form.paymentInstructions || ''}
            onChange={(e) => onUpdateField('paymentInstructions', e.target.value)}
            placeholder="Informe prazo de compensação, envio de comprovante ou orientações fiscais..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-60 resize-none"
          />
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              Endpoint Oficial de Webhook PSP (Assinatura HMAC-SHA256)
            </div>
            <div className="text-[11px] font-mono text-cyan-300 truncate">{webhookUrl}</div>
            <p className="text-[10px] text-slate-500">
              {webhookConfigured
                ? 'Segredo HMAC ativo no servidor: liquidações enviadas pelo PSP baixam faturas automaticamente com idempotência.'
                : 'Configure a variável de ambiente SAAS_PSP_WEBHOOK_SECRET no servidor para habilitar baixa automática via PSP.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCopyWebhook}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-bold text-slate-200 flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedWebhook ? 'Copiado!' : 'Copiar Endpoint'}
          </button>
        </div>
      </div>

      {/* Section 4: Regras de Trial, Vencimento e Inadimplência */}
      <div className="space-y-4 pt-4 border-t border-slate-800/80">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          4. Política de Trial, Vencimento, Multa &amp; Inadimplência
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">Trial Padrão (dias)</label>
            <input
              type="number"
              min={1}
              max={365}
              disabled={!canEdit}
              value={defaultTrialDays}
              onChange={(e) => onChangeTrialDays(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">Carência (dias)</label>
            <input
              type="number"
              min={0}
              max={90}
              disabled={!canEdit}
              value={form.gracePeriodDays}
              onChange={(e) => onUpdateField('gracePeriodDays', Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">Aviso Antes (dias)</label>
            <input
              type="number"
              min={0}
              max={30}
              disabled={!canEdit}
              value={form.sendDueReminderDaysBefore}
              onChange={(e) => onUpdateField('sendDueReminderDaysBefore', Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">Multa Atraso (%)</label>
            <input
              type="number"
              step="0.1"
              min={0}
              max={20}
              disabled={!canEdit}
              value={form.lateFeePercent}
              onChange={(e) => onUpdateField('lateFeePercent', Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">Juros/Mês (%)</label>
            <input
              type="number"
              step="0.1"
              min={0}
              max={20}
              disabled={!canEdit}
              value={form.monthlyInterestPercent}
              onChange={(e) => onUpdateField('monthlyInterestPercent', Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>
        </div>

        <label className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
          <div>
            <div className="text-xs font-bold text-white">
              Suspender automaticamente lojas inadimplentes após o período de carência
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Quando ativado, o motor de reconciliação marca lojas vencidas além de {form.gracePeriodDays} dia(s) como SUSPENDED no banco.
            </p>
          </div>
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={form.autoSuspendOverdue}
            onChange={(e) => onUpdateField('autoSuspendOverdue', e.target.checked)}
            className="w-4 h-4 accent-amber-500 cursor-pointer disabled:cursor-not-allowed"
          />
        </label>
      </div>
    </>
  );
};
