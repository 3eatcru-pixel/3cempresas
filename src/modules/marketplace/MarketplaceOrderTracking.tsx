import React, { useEffect, useState } from 'react';
import { Order } from '../../types';
import { ArrowLeft, XCircle, RotateCcw, FolderLock, CheckCircle2, Loader2, CreditCard, ExternalLink } from 'lucide-react';
import { TrackingProgressStepper } from './tracking/TrackingProgressStepper';
import { TrackingOrderSummary } from './tracking/TrackingOrderSummary';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../core/api/apiClient';

interface OrderTrackingProps {
  order: Order;
  onBack: () => void;
  onReorder?: (order: Order) => void;
}

export const MarketplaceOrderTracking: React.FC<OrderTrackingProps> = ({
  order,
  onBack,
  onReorder,
}) => {
  const { cancelCustomerOrder, showNotification } = useEcosystem();
  const { getIdToken } = useAuth();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [savingVault, setSavingVault] = useState(false);
  const [vaultSaved, setVaultSaved] = useState(false);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [storeAllowsOnlinePayment, setStoreAllowsOnlinePayment] = useState(false);
  const [creatingPaymentLink, setCreatingPaymentLink] = useState(false);
  const [stripePayUrl, setStripePayUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiClient.getStripeConfig().catch(() => null),
      order.storeId
        ? fetch(`/api/v1/store/payment-public-info/${encodeURIComponent(order.storeId)}`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        : Promise.resolve(null),
    ]).then(([cfg, payInfo]) => {
      if (!active) return;
      setStripeConfigured(Boolean(cfg?.configured));
      setStoreAllowsOnlinePayment(Boolean(payInfo?.platformOnlinePaymentsEnabled === true));
    });
    return () => {
      active = false;
    };
  }, [order.storeId]);

  const canPayOnlineNow =
    stripeConfigured &&
    storeAllowsOnlinePayment &&
    order.paymentStatus !== 'PAID' &&
    order.status !== 'CANCELLED' &&
    order.paymentMethod !== 'CASH' &&
    order.paymentMethod !== 'TABLE_BILL' &&
    Number(order.total || 0) >= 1;

  const handleCreateOrderStripeCheckout = async () => {
    setCreatingPaymentLink(true);
    try {
      const token = await getIdToken();
      if (!token) {
        showNotification('Faça login como consumidor para concluir o pagamento online.');
        return;
      }
      const res = await apiClient.createOrderStripeCheckout(order.id, undefined, token);
      if (res.url) {
        setStripePayUrl(res.url);
        showNotification('Checkout seguro gerado! Clique no link para concluir o pagamento.');
      }
    } catch (err: any) {
      showNotification(err?.message || 'Não foi possível iniciar o pagamento online agora.');
    } finally {
      setCreatingPaymentLink(false);
    }
  };

  const handleCancelOrder = async () => {
    setCancelling(true);
    try {
      const ok = await cancelCustomerOrder(order.id);
      if (ok) {
        setConfirmCancel(false);
        onBack();
      }
    } finally {
      setCancelling(false);
    }
  };

  const handleSaveReceiptToVault = async () => {
    setSavingVault(true);
    try {
      const lines = [
        `============================================`,
        `COMPROVANTE DE PEDIDO - 3C CORP MARKETPLACE`,
        `============================================`,
        `Pedido: ${order.code || order.id}`,
        `Estabelecimento: ${order.storeName || order.storeId}`,
        `Data: ${new Date(order.createdAt || Date.now()).toLocaleString('pt-BR')}`,
        `Modalidade: ${order.channel || 'DELIVERY'}`,
        `Status: ${order.status}`,
        `Pagamento: ${order.paymentMethod || 'PIX'}`,
        `--------------------------------------------`,
        `ITENS:`,
        ...(order.items || []).map(
          (it) =>
            `- ${it.quantity}x ${it.name}${it.variantLabel ? ` (${it.variantLabel})` : ''}: R$ ${(
              it.price * it.quantity
            ).toFixed(2)}`
        ),
        `--------------------------------------------`,
        `Total: R$ ${(order.total || 0).toFixed(2)}`,
        `============================================`,
      ];
      const textContent = lines.join('\n');
      await apiClient.uploadStorageObject({
        appId: 'marketplace',
        folder: 'comprovantes',
        filename: `recibo-${(order.code || order.id.slice(0, 6)).replace(/[^a-zA-Z0-9_-]/g, '')}.txt`,
        mimeType: 'text/plain',
        contentUtf8: textContent,
      });
      setVaultSaved(true);
      showNotification('Comprovante salvo na pasta "comprovantes" do seu Cofre Pessoal!');
    } catch (err: any) {
      showNotification(err?.message || 'Faça login como consumidor para salvar no Cofre Pessoal.');
    } finally {
      setSavingVault(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-bold group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={savingVault || vaultSaved}
            onClick={handleSaveReceiptToVault}
            className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              vaultSaved
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-amber-300'
            }`}
          >
            {savingVault ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : vaultSaved ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <FolderLock className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>{vaultSaved ? 'Salvo no Cofre Pessoal' : 'Salvar Recibo no Cofre'}</span>
          </button>

          {onReorder && (
            <button
              type="button"
              onClick={() => onReorder(order)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Repetir Pedido</span>
            </button>
          )}

          <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-widest ml-1">
            ID: {order.id.slice(-8).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Main Status Card & Map */}
      <TrackingProgressStepper
        status={order.status}
        storeId={order.storeId}
        storeName={order.storeName || 'Loja Parceira'}
        driverId={order.driverId}
        driverName={order.driverName}
        deliveryAddress={order.deliveryAddress}
        deliveryLatitude={order.deliveryLatitude}
        deliveryLongitude={order.deliveryLongitude}
        channel={order.channel}
        tableNumber={order.tableNumber}
      />

      {/* Order Details & Logistics */}
      <TrackingOrderSummary order={order} />

      {canPayOnlineNow && (
        <div className="bg-slate-900 p-4 rounded-2xl border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-indigo-400" />
              <span>Pagamento Online Seguro Disponível</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Conclua o pagamento de R$ {Number(order.total || 0).toFixed(2)} por cartão ou carteira digital.
            </p>
          </div>
          {stripePayUrl ? (
            <a
              href={stripePayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase rounded-xl flex items-center gap-1.5 shrink-0"
            >
              <span>Pagar Agora</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : (
            <button
              type="button"
              disabled={creatingPaymentLink}
              onClick={handleCreateOrderStripeCheckout}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase rounded-xl cursor-pointer disabled:opacity-50 shrink-0"
            >
              {creatingPaymentLink ? 'Gerando...' : 'Gerar Pagamento Online'}
            </button>
          )}
        </div>
      )}

      {order.status === 'PENDING' && (
        <div className="bg-slate-900 p-4 rounded-2xl border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-300">
            Pedido aguardando confirmação da loja. Você ainda pode cancelar sem custo.
          </div>
          {confirmCancel ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setConfirmCancel(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Manter Pedido
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCancelOrder}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl cursor-pointer disabled:opacity-50"
              >
                {cancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <XCircle className="w-3.5 h-3.5" /> Cancelar Pedido
            </button>
          )}
        </div>
      )}
    </div>
  );
};
