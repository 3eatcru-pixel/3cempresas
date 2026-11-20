import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, CreditCard, RefreshCw, ShieldCheck, Webhook } from 'lucide-react';
import { apiClient, StripeHealthResponse } from '../../../core/api/apiClient';
import { useAuth } from '../../../context/AuthContext';

export const HqStripePlatformCard: React.FC = () => {
  const { getIdToken } = useAuth();
  const [health, setHealth] = useState<StripeHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await apiClient.getStripeHealth(token);
      setHealth(res);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível verificar o gateway Stripe.');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const webhookUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/api/v1/stripe/webhook`
      : '/api/v1/stripe/webhook';

  const copyWebhook = () => {
    navigator.clipboard?.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-400" />
            Stripe Platform (Payments, Billing, Connect &amp; Invoicing)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitoramento em tempo real da conta plataforma Stripe no Server Core (chaves secretas isoladas em servidor).
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadHealth()}
          disabled={loading}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Verificando...' : 'Verificar Stripe'}</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
          {error}
        </div>
      )}

      {health && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[10px] font-bold uppercase text-slate-500">Status &amp; Modo</div>
            <div className={`font-black font-mono ${health.healthy ? 'text-emerald-400' : 'text-amber-400'}`}>
              {health.healthy ? `CONECTADO (${health.mode.toUpperCase()})` : 'AGUARDANDO CHAVE'}
            </div>
            <div className="text-[11px] text-slate-400 font-mono truncate">
              {health.accountId || health.businessDomain}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[10px] font-bold uppercase text-slate-500">Capacidades</div>
            <div className="font-bold text-white">
              Cobrança: {health.chargesEnabled ? 'Ativa' : 'Pendente'} · Repasses: {health.payoutsEnabled ? 'Ativo' : 'Pendente'}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              País: {health.country || 'BR'} · Moeda: {health.currency.toUpperCase()}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[10px] font-bold uppercase text-slate-500">Produtos Habilitados</div>
            <div className="font-bold text-indigo-300">
              Payments · Billing · Connect · Invoicing
            </div>
            <div className="text-[11px] text-slate-400 font-mono truncate">
              {health.publishableKey ? `${health.publishableKey.slice(0, 18)}...` : 'Publishable key ausente'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
              <Webhook className="w-3 h-3 text-cyan-400" />
              Webhook Stripe
            </div>
            <div className={`font-bold ${health.webhookSecretConfigured ? 'text-emerald-400' : 'text-amber-300'}`}>
              {health.webhookSecretConfigured ? 'whsec_ Configurado' : 'Defina STRIPE_WEBHOOK_SECRET'}
            </div>
            <button
              type="button"
              onClick={copyWebhook}
              className="text-[11px] font-mono text-cyan-300 hover:text-cyan-200 flex items-center gap-1 cursor-pointer"
            >
              {copiedWebhook ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedWebhook ? 'Copiado!' : 'Copiar endpoint /stripe/webhook'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          Split automático via Stripe Connect nos pedidos do Marketplace e liquidação instantânea por webhook assinado.
        </span>
      </div>
    </div>
  );
};
