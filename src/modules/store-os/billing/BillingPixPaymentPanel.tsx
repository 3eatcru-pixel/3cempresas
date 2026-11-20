import React, { useState } from 'react';
import {
  Check,
  Copy,
  CreditCard,
  FileText,
  ExternalLink,
  AlertTriangle,
  Mail,
  MessageCircle,
  Landmark,
  Link2,
} from 'lucide-react';
import { LocalQrCode } from '../../../components/common/LocalQrCode';
import { PlatformBillingPaymentConfig, SaasPaymentMethod } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { apiClient } from '../../../core/api/apiClient';

interface BillingPixPaymentPanelProps {
  storeId: string;
  selectedPlan: string;
  billingCycle: string;
  paymentMethod: SaasPaymentMethod;
  couponCode?: string;
  totalBilling: number;
  pixPayload: string;
  billingConfig: PlatformBillingPaymentConfig;
  isSubmitting?: boolean;
  onBack: () => void;
  onConfirmPayment: () => void;
}

const METHOD_TITLES: Record<SaasPaymentMethod, string> = {
  PIX: 'PIX Instantâneo',
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  BOLETO: 'Boleto Bancário',
  BANK_TRANSFER: 'Transferência Bancária (TED / DOC)',
  PAYMENT_LINK: 'Link de Pagamento / Carteira Digital',
};

export const BillingPixPaymentPanel: React.FC<BillingPixPaymentPanelProps> = ({
  storeId,
  selectedPlan,
  billingCycle,
  paymentMethod,
  couponCode,
  totalBilling,
  pixPayload,
  billingConfig,
  isSubmitting = false,
  onBack,
  onConfirmPayment,
}) => {
  const { getIdToken } = useAuth();
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);
  const [stripeSessionUrl, setStripeSessionUrl] = useState<string | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [creatingStripeSession, setCreatingStripeSession] = useState(false);

  const handleCreateStripeCheckout = async () => {
    setCreatingStripeSession(true);
    setStripeError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Autentique-se para gerar checkout Stripe.');
      const res = await apiClient.createStoreSubscriptionCheckout(
        {
          storeId,
          requestedPlan: selectedPlan,
          billingCycle: billingCycle as 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
          ...(couponCode ? { couponCode } : {}),
        },
        token
      );
      if (res.url) {
        setStripeSessionUrl(res.url);
      }
    } catch (err: any) {
      setStripeError(err?.message || 'Erro ao gerar checkout Stripe Billing.');
    } finally {
      setCreatingStripeSession(false);
    }
  };

  const methodLabel = METHOD_TITLES[paymentMethod] || paymentMethod;
  const maxInstallments = Math.max(1, Math.min(12, Number(billingConfig.maxCreditInstallments ?? 12)));

  const hasSafeCheckoutUrl = Boolean(
    billingConfig.checkoutBaseUrl && /^https:\/\/.+/i.test(billingConfig.checkoutBaseUrl)
  );

  const hasBankTransferDetails = Boolean(
    billingConfig.bankName?.trim() || billingConfig.bankAgency?.trim() || billingConfig.bankAccount?.trim()
  );

  const bankSummaryText = [
    billingConfig.beneficiaryName ? `Favorecido: ${billingConfig.beneficiaryName}` : '',
    billingConfig.beneficiaryDocument ? `CNPJ/CPF: ${billingConfig.beneficiaryDocument}` : '',
    billingConfig.bankName ? `Banco: ${billingConfig.bankName}` : '',
    billingConfig.bankAgency ? `Agência: ${billingConfig.bankAgency}` : '',
    billingConfig.bankAccount ? `Conta (${billingConfig.bankAccountType || 'CORRENTE'}): ${billingConfig.bankAccount}` : '',
    `Valor: R$ ${totalBilling.toFixed(2)}`,
  ]
    .filter(Boolean)
    .join('\n');

  const renderNonPixIcon = () => {
    if (paymentMethod === 'CREDIT_CARD' || paymentMethod === 'DEBIT_CARD') {
      return <CreditCard className="w-4 h-4 text-blue-400" />;
    }
    if (paymentMethod === 'BOLETO') {
      return <FileText className="w-4 h-4 text-amber-400" />;
    }
    if (paymentMethod === 'BANK_TRANSFER') {
      return <Landmark className="w-4 h-4 text-amber-400" />;
    }
    return <Link2 className="w-4 h-4 text-emerald-400" />;
  };

  return (
    <div className="space-y-4 text-center py-2">
      <div className="space-y-1">
        <div className="text-[10px] text-slate-400 font-bold uppercase">
          Solicitação de Upgrade: {selectedPlan} ({billingCycle}) • {methodLabel}
        </div>
        <div className="text-2xl font-black text-amber-400 font-mono">
          R$ {totalBilling.toFixed(2)}
        </div>
        {paymentMethod === 'CREDIT_CARD' && maxInstallments > 1 && totalBilling > 0 && (
          <div className="text-[11px] font-mono text-blue-300">
            Parcelamento disponível em até {maxInstallments}x de R$ {(totalBilling / maxInstallments).toFixed(2)}
          </div>
        )}
        {billingConfig.beneficiaryName && (
          <div className="text-[10px] text-slate-400">
            Beneficiário: <span className="text-slate-200 font-bold">{billingConfig.beneficiaryName}</span>
            {billingConfig.beneficiaryDocument ? ` • ${billingConfig.beneficiaryDocument}` : ''}
          </div>
        )}
      </div>

      {paymentMethod === 'PIX' ? (
        pixPayload ? (
          <>
            <div className="w-40 h-40 bg-white p-2.5 rounded-2xl mx-auto flex items-center justify-center shadow-lg border-2 border-slate-800">
              <LocalQrCode
                value={pixPayload}
                size={140}
                alt="QR Code PIX"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="text-[10px] font-mono text-slate-400">
              Chave ({billingConfig.pixKeyType}):{' '}
              <span className="text-emerald-300 select-all">{billingConfig.pixKey}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(pixPayload);
                setCopiedPix(true);
                setTimeout(() => setCopiedPix(false), 2000);
              }}
              className="w-full max-w-xs mx-auto py-2 bg-slate-950 hover:bg-slate-800 text-white font-mono text-[10px] font-bold rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {copiedPix ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPix ? 'Copiado!' : 'Copiar Código PIX Copia e Cola'}</span>
            </button>
          </>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs text-left space-y-1.5">
            <div className="font-black uppercase flex items-center gap-1.5 text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Chave PIX da plataforma ainda não configurada</span>
            </div>
            <p className="text-[11px] text-slate-300">
              Você ainda pode registrar a solicitação de upgrade agora e combinar o pagamento com o financeiro da plataforma pelos canais abaixo.
            </p>
          </div>
        )
      ) : paymentMethod === 'BANK_TRANSFER' ? (
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-left">
          <div className="flex items-center gap-2 text-xs font-black text-white uppercase">
            <Landmark className="w-4 h-4 text-amber-400" />
            <span>Dados Bancários Oficiais para TED / DOC</span>
          </div>
          {hasBankTransferDetails ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/90 p-3 rounded-xl border border-slate-800 font-mono">
                {billingConfig.bankName && (
                  <div className="col-span-2">
                    <span className="text-slate-500">Banco: </span>
                    <span className="text-white font-bold">{billingConfig.bankName}</span>
                  </div>
                )}
                {billingConfig.bankAgency && (
                  <div>
                    <span className="text-slate-500">Agência: </span>
                    <span className="text-white">{billingConfig.bankAgency}</span>
                  </div>
                )}
                {billingConfig.bankAccount && (
                  <div>
                    <span className="text-slate-500">Conta ({billingConfig.bankAccountType || 'CORRENTE'}): </span>
                    <span className="text-white">{billingConfig.bankAccount}</span>
                  </div>
                )}
                {billingConfig.beneficiaryDocument && (
                  <div className="col-span-2">
                    <span className="text-slate-500">CNPJ/CPF: </span>
                    <span className="text-emerald-300">{billingConfig.beneficiaryDocument}</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(bankSummaryText);
                  setCopiedBank(true);
                  setTimeout(() => setCopiedBank(false), 2000);
                }}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-[10px] font-bold text-white flex items-center gap-1.5 cursor-pointer"
              >
                {copiedBank ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedBank ? 'Dados Bancários Copiados!' : 'Copiar Dados Bancários'}</span>
              </button>
            </>
          ) : (
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Registre sua solicitação de upgrade abaixo para receber os dados bancários atualizados pelo financeiro da plataforma.
            </p>
          )}
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-left">
          <div className="flex items-center gap-2 text-xs font-black text-white uppercase">
            {renderNonPixIcon()}
            <span>{methodLabel}</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {hasSafeCheckoutUrl
              ? 'Acesse o portal seguro de faturamento abaixo para concluir o pagamento e em seguida clique em "Registrar Pagamento" para vincular o upgrade à sua loja.'
              : 'Registre sua solicitação de upgrade abaixo com este modo de pagamento para que o financeiro da plataforma envie a cobrança e libere suas novas cotas.'}
          </p>
          {hasSafeCheckoutUrl && (
            <a
              href={billingConfig.checkoutBaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider transition-colors"
            >
              <span>Abrir Portal de Pagamento ({billingConfig.pspProvider})</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <button
              type="button"
              disabled={creatingStripeSession || totalBilling < 1}
              onClick={handleCreateStripeCheckout}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{creatingStripeSession ? 'Gerando Checkout Stripe...' : 'Pagar Online via Stripe Billing'}</span>
            </button>
            {stripeError && <p className="text-[11px] text-rose-400">{stripeError}</p>}
            {stripeSessionUrl && (
              <div>
                <a
                  href={stripeSessionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:text-emerald-200 underline"
                >
                  <span>Abrir Sessão Segura Stripe Checkout</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {billingConfig.paymentInstructions && (
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 text-left">
          {billingConfig.paymentInstructions}
        </div>
      )}

      {(billingConfig.billingSupportWhatsapp || billingConfig.billingSupportEmail) && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-slate-400">
          {billingConfig.billingSupportWhatsapp && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
              <MessageCircle className="w-3 h-3 text-emerald-400" />
              <span>Financeiro: {billingConfig.billingSupportWhatsapp}</span>
            </span>
          )}
          {billingConfig.billingSupportEmail && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
              <Mail className="w-3 h-3 text-blue-400" />
              <span>{billingConfig.billingSupportEmail}</span>
            </span>
          )}
        </div>
      )}

      <div className="flex justify-center gap-3 pt-3 border-t border-slate-800">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onBack}
          className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
        >
          Voltar
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onConfirmPayment}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer"
        >
          {isSubmitting ? 'Registrando...' : 'Registrar Pagamento'}
        </button>
      </div>
    </div>
  );
};
