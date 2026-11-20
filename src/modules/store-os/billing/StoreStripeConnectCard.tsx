import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, FileText, Landmark, RefreshCw } from 'lucide-react';
import { Store } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { apiClient, StripeInvoiceSummary } from '../../../core/api/apiClient';

interface StoreStripeConnectCardProps {
  currentStore: Store;
  onNotify: (msg: string) => void;
}

export const StoreStripeConnectCard: React.FC<StoreStripeConnectCardProps> = ({
  currentStore,
  onNotify,
}) => {
  const isFreeOrTrial =
    String(currentStore.subscriptionPlan || 'FREE').toUpperCase() === 'FREE' ||
    String(currentStore.saasPaymentStatus || '').toUpperCase() === 'TRIAL';
  const { getIdToken } = useAuth();
  const [connectStatus, setConnectStatus] = useState<{
    connected: boolean;
    accountId?: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  }>({
    connected: Boolean(currentStore.stripeConnectAccountId),
    accountId: currentStore.stripeConnectAccountId,
    chargesEnabled: Boolean(currentStore.stripeConnectChargesEnabled),
    payoutsEnabled: Boolean(currentStore.stripeConnectPayoutsEnabled),
  });
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<StripeInvoiceSummary[]>([]);
  const [invoiceAmount, setInvoiceAmount] = useState('149.00');
  const [invoiceDesc, setInvoiceDesc] = useState('Fatura de serviços / pedido corporativo');
  const [busy, setBusy] = useState(false);

  const syncStripeState = useCallback(async () => {
    setBusy(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const [statusRes, invRes] = await Promise.all([
        apiClient.getStoreConnectStatus(currentStore.id, token),
        apiClient.listStripeInvoices(currentStore.id, token),
      ]);
      setConnectStatus(statusRes);
      setInvoices(invRes.invoices || []);
    } catch {
      // Offline or not provisioned yet
    } finally {
      setBusy(false);
    }
  }, [currentStore.id, getIdToken]);

  useEffect(() => {
    if (isFreeOrTrial) return;
    void syncStripeState();
  }, [isFreeOrTrial, syncStripeState]);

  const handleGenerateOnboarding = async () => {
    setBusy(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const link = await apiClient.createStoreConnectOnboardingLink(currentStore.id, undefined, token);
      setOnboardingUrl(link.url);
      setConnectStatus((prev) => ({ ...prev, connected: true, accountId: link.accountId }));
      onNotify('Link de ativação Stripe Connect gerado! Conclua seu cadastro bancário abaixo.');
    } catch (err: any) {
      onNotify(err?.message || 'Erro ao gerar onboarding Stripe Connect.');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenPortal = async () => {
    setBusy(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await apiClient.createStoreBillingPortal(currentStore.id, undefined, token);
      setPortalUrl(res.url);
      onNotify('Portal de assinatura Stripe pronto para acesso.');
    } catch (err: any) {
      onNotify(err?.message || 'Erro ao gerar portal de assinatura Stripe.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(invoiceAmount.replace(',', '.'));
    if (!Number.isFinite(numericAmount) || numericAmount < 1) {
      onNotify('Informe um valor mínimo de R$ 1,00 para a fatura.');
      return;
    }
    setBusy(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await apiClient.createStripeInvoice(
        {
          storeId: currentStore.id,
          amount: numericAmount,
          description: invoiceDesc.trim() || `Fatura ${currentStore.name}`,
          daysUntilDue: 7,
        },
        token
      );
      setInvoices((prev) => [res.invoice, ...prev]);
      onNotify('Fatura Stripe Invoicing emitida com sucesso!');
    } catch (err: any) {
      onNotify(err?.message || 'Erro ao emitir fatura Stripe Invoicing.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-900/80 rounded-3xl border border-slate-800 p-6 space-y-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Landmark className="w-4 h-4 text-indigo-400" />
            <span>Recebimentos Online, Stripe Connect &amp; Faturas (Invoicing)</span>
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Receba pagamentos online diretamente na conta do estabelecimento e emita faturas corporativas.
          </p>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void syncStripeState()}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
          <span>Atualizar Status</span>
        </button>
      </div>

      {isFreeOrTrial ? (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs text-amber-100">
          <p className="font-bold text-amber-300">
            Plano Free (7 dias grátis) — Recebimento apenas via PIX direto, dinheiro ou maquininha externa
          </p>
          <p className="text-slate-300 leading-relaxed">
            Durante os 7 dias gratuitos, o recebimento online via Stripe (cartão pela plataforma e Stripe Invoicing) permanece bloqueado.
            No Marketplace e no PDV, utilize sua chave PIX direta ou pagamento manual/equipamento externo (maquininha física).
            A plataforma cobra apenas a assinatura SaaS (0% sobre vendas); faça upgrade para um plano pago para liberar o Stripe Connect.
          </p>
        </div>
      ) : null}

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isFreeOrTrial ? 'opacity-50 pointer-events-none select-none' : ''}`}>
        {/* Connect Onboarding */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="text-xs font-bold text-white flex items-center justify-between">
            <span>Conta Recebedora (Stripe Connect)</span>
            <span
              className={`text-[10px] font-mono font-bold ${
                connectStatus.chargesEnabled ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {connectStatus.chargesEnabled
                ? 'ATIVA PARA RECEBIMENTOS'
                : connectStatus.connected
                ? 'PENDENTE VERIFICAÇÃO'
                : 'NÃO VINCULADA'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {connectStatus.accountId ? `Conta Connect: ${connectStatus.accountId}` : 'Vincule sua conta para repasses automáticos de pedidos online.'}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleGenerateOnboarding}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
            >
              {connectStatus.connected ? 'Continuar Verificação Bancária' : 'Ativar Conta Recebedora'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleOpenPortal}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
            >
              Portal da Assinatura
            </button>
          </div>
          {onboardingUrl && (
            <a
              href={onboardingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-300 hover:text-indigo-200 underline"
            >
              <span>Abrir Cadastro Seguro Stripe Connect</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {portalUrl && (
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:text-emerald-200 underline ml-4"
            >
              <span>Acessar Portal de Assinatura</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Commercial Invoicing */}
        <form onSubmit={handleCreateInvoice} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Emitir Cobrança / Fatura (Stripe Invoicing)</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={invoiceAmount}
              onChange={(e) => setInvoiceAmount(e.target.value)}
              placeholder="149.00"
              className="col-span-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
            />
            <input
              type="text"
              value={invoiceDesc}
              onChange={(e) => setInvoiceDesc(e.target.value)}
              placeholder="Descrição da fatura"
              className="col-span-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase rounded-xl cursor-pointer disabled:opacity-50"
          >
            Emitir &amp; Finalizar Fatura
          </button>
        </form>
      </div>

      {invoices.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="text-[11px] font-bold uppercase text-slate-400">
            Faturas Recentes ({invoices.length})
          </div>
          <div className="space-y-1.5">
            {invoices.slice(0, 5).map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-white truncate">
                    {inv.number || inv.id} · {inv.description || 'Fatura'}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    R$ {Number(inv.amountBrl || 0).toFixed(2)} · {inv.status.toUpperCase()}
                    {inv.dueDate ? ` · Venc. ${inv.dueDate}` : ''}
                  </div>
                </div>
                {inv.hostedInvoiceUrl && (
                  <a
                    href={inv.hostedInvoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-amber-300 flex items-center gap-1 shrink-0"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Ver Fatura</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
