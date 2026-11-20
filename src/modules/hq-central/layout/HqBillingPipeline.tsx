import React, { useState } from 'react';
import { CreditCard, CheckCircle2, Clock, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { PlatformGovernance, Store } from '../../../types';
import { DEFAULT_PLATFORM_BILLING_CONFIG } from '../../../constants/platformDefaults';
import { getPlatformAdapters } from '../../../core/platform/PlatformAdapter';

interface HqBillingPipelineProps {
  stores: Store[];
  governance?: PlatformGovernance;
  onReconcile: () => Promise<void>;
  onNotify?: (msg: string) => void;
}

export const HqBillingPipeline: React.FC<HqBillingPipelineProps> = ({
  stores,
  governance,
  onReconcile,
  onNotify,
}) => {
  const [isReconciling, setIsReconciling] = useState(false);

  const billingConfig = {
    ...DEFAULT_PLATFORM_BILLING_CONFIG,
    ...(governance?.billingConfig || {}),
  };
  const webhookActive = Boolean(governance?.pspWebhookConfigured);
  const pipelineBadgeText = webhookActive
    ? `${billingConfig.pspProvider} • Webhook HMAC Ativo • Carência ${billingConfig.gracePeriodDays}d`
    : billingConfig.pixKey?.trim()
    ? `${billingConfig.pspProvider} (PIX Oficial) • Baixa Manual HQ • Carência ${billingConfig.gracePeriodDays}d`
    : 'Chave PIX SaaS Pendente • Baixa Manual HQ';

  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      await onReconcile();
    } finally {
      setIsReconciling(false);
    }
  };

  const handleExportCsv = () => {
    const header = 'store_id,tenant_id,store_name,plan,billing_cycle,monthly_fee,status,next_due_date';
    const rows = stores.map((s) =>
      [
        s.id,
        s.tenantId || '',
        `"${String(s.name || '').replace(/"/g, '""')}"`,
        s.subscriptionPlan || 'FREE',
        s.billingCycle || 'MONTHLY',
        Number(s.saasMonthlyFee || 0).toFixed(2),
        s.saasPaymentStatus || 'PENDING',
        s.saasNextDueDate || '',
      ].join(',')
    );
    const dateStr = new Date().toISOString().slice(0, 10);
    getPlatformAdapters().links.downloadTextFile(
      `3c-saas-billing-${dateStr}.csv`,
      [header, ...rows].join('\n'),
      'text/csv;charset=utf-8'
    );
    onNotify?.('Relatório CSV de faturamento SaaS exportado!');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
      <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-amber-500" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest italic">
            Pipeline de Faturamento SaaS ({stores.length} lojas)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 border rounded text-[8px] font-black uppercase ${
              webhookActive
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}
          >
            {pipelineBadgeText}
          </span>
          <button
            type="button"
            onClick={handleReconcile}
            disabled={isReconciling}
            className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded text-[9px] font-black text-emerald-400 uppercase flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isReconciling ? 'animate-spin' : ''}`} />
            {isReconciling ? 'Reconciliando...' : 'Reconciliar Agora'}
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-800/50">
        {stores.length > 0 ? (
          stores.map(store => {
            const status = store.saasPaymentStatus || 'PENDING';
            const isPaid = status === 'PAID';
            const isOverdue = status === 'OVERDUE';
            return (
              <div key={store.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-all group">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl bg-slate-950 border border-slate-800 ${
                    isPaid ? 'text-emerald-500' : isOverdue ? 'text-rose-500' : 'text-amber-500'
                  }`}>
                    {isPaid && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {!isPaid && !isOverdue && <Clock className="w-3.5 h-3.5" />}
                    {isOverdue && <AlertTriangle className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-white uppercase tracking-tight">{store.name}</div>
                    <div className="text-[9px] text-slate-500 font-medium uppercase tracking-wider font-mono">
                      {store.tenantId} • Plano {store.subscriptionPlan} ({store.billingCycle || 'MONTHLY'})
                      {store.pendingUpgradeRequest?.status === 'PENDING_PAYMENT_CONFIRMATION' && store.pendingUpgradeRequest.couponCode ? (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300">
                          UPGRADE {store.pendingUpgradeRequest.requestedPlan} • CUPOM {store.pendingUpgradeRequest.couponCode}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-black text-white font-mono">
                    R$ {Number(store.saasMonthlyFee || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className={`text-[8px] font-black uppercase tracking-tighter ${
                    isPaid ? 'text-emerald-500' : isOverdue ? 'text-rose-500' : 'text-amber-500'
                  }`}>
                    {status}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-6 text-center text-xs text-slate-500 italic">
            Nenhuma loja cadastrada para faturamento.
          </div>
        )}
      </div>

      <div className="p-3 bg-slate-950/50 border-t border-slate-800">
        <button
          type="button"
          onClick={handleExportCsv}
          className="w-full py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-white flex items-center justify-center gap-2 group cursor-pointer"
        >
          Exportar Relatório de Faturamento Completo (.CSV)
          <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};
