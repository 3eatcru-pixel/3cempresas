import React, { useMemo, useState } from 'react';
import {
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Search,
} from 'lucide-react';
import { PlatformGovernance, Store } from '../../../types';
import { DEFAULT_PLATFORM_BILLING_CONFIG } from '../../../constants/platformDefaults';
import { generateEmvCoPixPayload } from '../../../utils/pix';
import { HqPixChargeModal, SelectedPixCharge } from './HqPixChargeModal';

interface HqStoresBillingTableProps {
  stores: Store[];
  governance: PlatformGovernance;
  canManageBilling?: boolean;
  onConfirmPayment?: (storeId: string, status: 'PAID' | 'PENDING' | 'OVERDUE') => Promise<void>;
  onApproveUpgrade?: (store: Store) => Promise<void>;
}

type BillingFilter = 'ALL' | 'UPGRADES' | 'OPEN' | 'PAID';

const getFinancialStatusBadge = (status?: string) => {
  switch (status) {
    case 'PAID':
      return {
        label: 'PAGO',
        cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      };
    case 'TRIAL':
      return {
        label: 'DEGUSTAÇÃO',
        cls: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
      };
    case 'OVERDUE':
      return {
        label: 'ATRASADO',
        cls: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
      };
    default:
      return {
        label: 'PENDENTE',
        cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      };
  }
};

export const HqStoresBillingTable: React.FC<HqStoresBillingTableProps> = ({
  stores,
  governance,
  canManageBilling = false,
  onConfirmPayment,
  onApproveUpgrade,
}) => {
  const [selectedPixStore, setSelectedPixStore] = useState<SelectedPixCharge | null>(null);
  const [busyStoreId, setBusyStoreId] = useState<string | null>(null);
  const [billingFilter, setBillingFilter] = useState<BillingFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const visibleStores = useMemo(() => stores.filter((s) => !s._deleted), [stores]);

  const counts = useMemo(() => {
    let upgrades = 0;
    let open = 0;
    let paid = 0;
    for (const s of visibleStores) {
      if (s.pendingUpgradeRequest?.status === 'PENDING_PAYMENT_CONFIRMATION') upgrades++;
      if (s.saasPaymentStatus === 'PAID') paid++;
      else if (s.saasPaymentStatus === 'OVERDUE' || s.saasPaymentStatus === 'PENDING') open++;
    }
    return { all: visibleStores.length, upgrades, open, paid };
  }, [visibleStores]);

  const filteredStores = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return visibleStores.filter((s) => {
      const hasPendingUpgrade = s.pendingUpgradeRequest?.status === 'PENDING_PAYMENT_CONFIRMATION';
      if (billingFilter === 'UPGRADES' && !hasPendingUpgrade) return false;
      if (billingFilter === 'OPEN' && s.saasPaymentStatus !== 'OVERDUE' && s.saasPaymentStatus !== 'PENDING') return false;
      if (billingFilter === 'PAID' && s.saasPaymentStatus !== 'PAID') return false;
      if (q) {
        const hay = `${s.name} ${s.slug} ${s.tenantId || ''} ${s.city || ''} ${s.subscriptionPlan || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [visibleStores, billingFilter, searchTerm]);

  const billingConfig = {
    ...DEFAULT_PLATFORM_BILLING_CONFIG,
    ...(governance.billingConfig || {}),
  };
  const hasRealPixKey = Boolean(billingConfig.pixEnabled && billingConfig.pixKey.trim());

  const handleOpenPixCharge = (store: Store) => {
    const pendingReq =
      store.pendingUpgradeRequest?.status === 'PENDING_PAYMENT_CONFIRMATION'
        ? store.pendingUpgradeRequest
        : undefined;
    const amount = Number(
      pendingReq?.estimatedAmount ?? store.saasMonthlyFee ?? 0
    );
    const planLabel = pendingReq
      ? `${pendingReq.requestedPlan} (${pendingReq.billingCycle})`
      : `${store.subscriptionPlan || 'BASIC'} (${store.billingCycle || 'MONTHLY'})`;

    const pixCode = hasRealPixKey
      ? generateEmvCoPixPayload({
          pixKey: billingConfig.pixKey.trim(),
          amount,
          merchantName: billingConfig.beneficiaryName || '3C CORP SAAS',
          merchantCity: billingConfig.beneficiaryCity || 'BRASIL',
          txid: `SAAS${store.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 18)}`,
          description: `Assinatura ${planLabel}`,
        })
      : '';

    setSelectedPixStore({ store, pixCode, amount, planLabel });
  };

  const runAction = async (storeId: string, fn: () => Promise<void>) => {
    setBusyStoreId(storeId);
    try {
      await fn();
    } finally {
      setBusyStoreId(null);
    }
  };

  const filterTabs: Array<{ id: BillingFilter; label: string; count: number }> = [
    { id: 'ALL', label: 'Todas', count: counts.all },
    { id: 'UPGRADES', label: 'Upgrades Pendentes', count: counts.upgrades },
    { id: 'OPEN', label: 'Pendentes / Atrasadas', count: counts.open },
    { id: 'PAID', label: 'Pagas', count: counts.paid },
  ];

  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-base font-bold text-white flex items-center gap-2 font-mono tabular-nums">
          <CreditCard className="w-5 h-5 text-blue-400" />
          Cobrança de Assinaturas &amp; Solicitações de Upgrade ({filteredStores.length} / {visibleStores.length} lojas)
        </h2>
        {!hasRealPixKey && (
          <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Configure a Chave PIX oficial acima para gerar cobranças EMV-Co reais
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="inline-flex flex-wrap p-1 bg-slate-950 rounded-xl border border-slate-800 gap-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setBillingFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                billingFilter === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums ${
                  billingFilter === tab.id
                    ? 'bg-slate-950/30 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar loja, plano ou cidade..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-950 text-slate-400 font-mono uppercase tracking-widest border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Loja / Localidade</th>
              <th className="px-4 py-3">Plano &amp; Valor</th>
              <th className="px-4 py-3">Status Financeiro</th>
              <th className="px-4 py-3">Próximo Venc.</th>
              <th className="px-4 py-3">Ações HQ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredStores.map((store) => {
              const pendingReq =
                store.pendingUpgradeRequest?.status === 'PENDING_PAYMENT_CONFIRMATION'
                  ? store.pendingUpgradeRequest
                  : undefined;
              const isPaid = store.saasPaymentStatus === 'PAID';
              const isBusy = busyStoreId === store.id;
              const statusBadge = getFinancialStatusBadge(store.saasPaymentStatus);
              const locationLabel =
                store.city && store.state
                  ? `${store.city}/${store.state}`
                  : store.city || `${store.slug}.3c-os.com`;

              return (
                <tr key={store.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <div className="font-bold text-white">{store.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {locationLabel} • {store.tenantId || store.id}
                    </div>
                  </td>
                  <td className="px-4 py-3 space-y-1">
                    <div>
                      <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800 font-mono tabular-nums text-amber-400">
                        {store.subscriptionPlan || 'BASIC'} • R$ {Number(store.saasMonthlyFee || 0).toFixed(2)}
                      </span>
                    </div>
                    {pendingReq && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[10px] font-mono tabular-nums text-amber-300">
                        <Sparkles className="w-3 h-3" />
                        <span>
                          Upgrade → {pendingReq.requestedPlan} ({pendingReq.billingCycle})
                          {pendingReq.paymentMethod
                            ? ` • ${
                                (
                                  {
                                    PIX: 'PIX',
                                    CREDIT_CARD: 'Cartão de Crédito',
                                    DEBIT_CARD: 'Cartão de Débito',
                                    BOLETO: 'Boleto',
                                    BANK_TRANSFER: 'TED/DOC',
                                    PAYMENT_LINK: 'Link/Carteira',
                                  } as Record<string, string>
                                )[String(pendingReq.paymentMethod)] || pendingReq.paymentMethod
                              }`
                            : ''}
                          {pendingReq.estimatedAmount !== undefined
                            ? ` • R$ ${Number(pendingReq.estimatedAmount).toFixed(2)}`
                            : ''}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${statusBadge.cls}`}
                    >
                      {statusBadge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-400">
                    {store.saasNextDueDate
                      ? new Date(store.saasNextDueDate + 'T12:00:00').toLocaleDateString('pt-BR')
                      : 'Ciclo Mensal'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenPixCharge(store)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Gerar PIX</span>
                      </button>

                      {canManageBilling && pendingReq && onApproveUpgrade && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => runAction(store.id, () => onApproveUpgrade(store))}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black rounded-lg shadow transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Aprovar Upgrade</span>
                        </button>
                      )}

                      {canManageBilling && onConfirmPayment && !isPaid && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => runAction(store.id, () => onConfirmPayment(store.id, 'PAID'))}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg shadow transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confirmar Pago</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredStores.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500 italic">
                  Nenhuma assinatura corresponde aos filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedPixStore && (
        <HqPixChargeModal
          selectedPixStore={selectedPixStore}
          billingConfig={billingConfig}
          onClose={() => setSelectedPixStore(null)}
        />
      )}
    </div>
  );
};
