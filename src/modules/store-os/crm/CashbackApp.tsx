import React, { useState, useEffect } from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { DollarSign, MessageSquare, Users, Sparkles, TrendingUp, Ticket } from 'lucide-react';
import { CustomerCRM } from '../../../types';
import { StoreCouponsManager } from './layout/StoreCouponsManager';

export const CashbackApp: React.FC = () => {
  const {
    customersCrm,
    orders,
    coupons,
    currentStore,
    showNotification,
    updateStoreOperationalSettings,
    addCoupon,
    toggleCouponStatus,
    deleteCoupon,
  } = useEcosystem();
  const [cashbackPercent, setCashbackPercent] = useState(
    currentStore.operationalSettings?.cashbackPercent || 5
  );
  const [minOrderValue, setMinOrderValue] = useState(
    currentStore.operationalSettings?.cashbackMinOrderValue || 50
  );
  const [isSaving, setIsSaving] = useState(false);
  const [creatingCouponForId, setCreatingCouponForId] = useState<string | null>(null);

  useEffect(() => {
    setCashbackPercent(currentStore.operationalSettings?.cashbackPercent || 5);
    setMinOrderValue(currentStore.operationalSettings?.cashbackMinOrderValue || 50);
  }, [currentStore.id, currentStore.operationalSettings?.cashbackPercent, currentStore.operationalSettings?.cashbackMinOrderValue]);

  const storeCustomers = customersCrm.filter((c) => c.storeId === currentStore.id);
  const storeOrders = orders.filter((o) => o.storeId === currentStore.id && o.status !== 'CANCELLED');
  const storeCoupons = coupons.filter(
    (cp) => !cp._deleted && cp.audience !== 'MERCHANT' && cp.storeId === currentStore.id
  );
  const reengageList = storeCustomers.filter((c) => (c.totalOrders || 0) > 1).slice(0, 6);

  const recurringCustomersCount = storeCustomers.filter((c) => (c.totalOrders || 0) > 1).length;
  const retentionRate =
    storeCustomers.length > 0
      ? Math.round((recurringCustomersCount / storeCustomers.length) * 100)
      : 0;
  const walletBalance = storeCustomers.reduce(
    (sum, c) => sum + (c.totalSpent || 0) * (cashbackPercent / 100),
    0
  );
  const discountedOrdersCount = storeOrders.filter((o) => (o.discount || 0) > 0).length;
  const averageLtv =
    storeCustomers.length > 0
      ? storeCustomers.reduce((sum, c) => sum + (c.totalSpent || 0), 0) / storeCustomers.length
      : 0;

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await updateStoreOperationalSettings(currentStore.id, {
        cashbackPercent,
        cashbackMinOrderValue: minOrderValue,
      });
      showNotification('Configurações de Cashback salvas!');
    } catch {
      showNotification('Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const buildCustomerVoucherCode = (customer: CustomerCRM) => {
    const suffix = String(customer.id.split('-')[1] || customer.id.slice(-4))
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(-6)
      .toUpperCase();
    return `LOYALTY${suffix || 'VIP'}`;
  };

  const handleGenerateVoucherCoupon = async (customer: CustomerCRM) => {
    const voucherCode = buildCustomerVoucherCode(customer);
    const existing = storeCoupons.find((cp) => cp.code.toUpperCase() === voucherCode);
    if (existing) {
      showNotification(`Cupom ${voucherCode} já está ativo para ${customer.name}.`);
      return;
    }
    const cashbackAmount = Math.max(
      1,
      Math.round((customer.totalSpent || 0) * (cashbackPercent / 100) * 100) / 100
    );
    setCreatingCouponForId(customer.id);
    try {
      await addCoupon({
        code: voucherCode,
        audience: 'CONSUMER',
        discountType: 'FIXED',
        discountValue: cashbackAmount,
        minOrderValue,
        validUntil: new Date(Date.now() + 15 * 86400000).toISOString(),
        usageCount: 0,
        usageLimit: 1,
        isActive: true,
        storeId: currentStore.id,
        tenantId: currentStore.tenantId,
        description: `Cashback fidelidade (${customer.name})`,
      });
    } finally {
      setCreatingCouponForId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0a0e17] animate-fadeIn">
      <header className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-500/20">
            <DollarSign size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none">
              Motor de Recompra, Cashback & Cupons
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Fidelização nativa, emissão de cupons reais da filial e disparos via WhatsApp
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {/* Strategy Config */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase text-sm">
                <Sparkles size={16} className="text-amber-500" /> Configurar Campanha de Cashback
              </h3>
              <span className="text-[10px] font-mono text-emerald-500 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                ESTRATÉGIA ATIVA
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  % de Cashback sobre o histórico
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={1}
                    max={25}
                    value={cashbackPercent}
                    onChange={(e) => setCashbackPercent(Number(e.target.value))}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-xl font-black text-purple-600 dark:text-purple-400 font-mono tabular-nums w-12 text-right">
                    {cashbackPercent}%
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Valor Mínimo do Pedido (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    value={minOrderValue}
                    onChange={(e) => setMinOrderValue(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm font-mono tabular-nums font-bold focus:ring-1 focus:ring-purple-500 outline-none text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-purple-500/5 border border-purple-500/15 rounded-xl">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed flex-1">
                Ao gerar o voucher de retenção para um cliente recorrente, um cupom nominal real (uso único, 15 dias) é ativado automaticamente na loja para resgate no Marketplace ou PDV.
              </p>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={isSaving}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer shrink-0 ${
                  isSaving
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-500'
                }`}
              >
                {isSaving ? 'Salvando...' : 'Salvar Regras'}
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-purple-500/30 p-5 rounded-2xl text-white flex flex-col justify-between">
            <div className="space-y-1">
              <TrendingUp size={26} className="mb-1.5 text-purple-400" />
              <h4 className="text-sm font-black uppercase tracking-tight">Taxa de Recorrência</h4>
              <p className="text-[11px] text-slate-400">
                Base atual: {storeCustomers.length} clientes
              </p>
            </div>
            <div className="py-4">
              <div className="text-4xl font-black font-mono tabular-nums text-purple-400">
                {retentionRate}%
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {recurringCustomersCount}{' '}
                {recurringCustomersCount === 1 ? 'cliente recorrente' : 'clientes recorrentes'}
              </p>
            </div>
            <div className="text-[11px] font-mono bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-slate-300">
              Cupons próprios ativos: {storeCoupons.filter((c) => c.isActive).length}
            </div>
          </div>
        </div>

        {/* Store Coupons Manager (Owned by Current Store) */}
        <StoreCouponsManager
          currentStore={currentStore}
          coupons={coupons}
          onCreateCoupon={addCoupon}
          onToggleStatus={toggleCouponStatus}
          onDeleteCoupon={deleteCoupon}
        />

        {/* Actionable List */}
        <div className="space-y-3">
          <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase text-sm px-1">
            <Users size={16} className="text-blue-500" /> Gatilhos de Retenção (Clientes Recorrentes)
          </h3>
          {reengageList.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500">
              Nenhum cliente com mais de 1 pedido registrado nesta loja ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reengageList.map((customer) => {
                const voucherCode = buildCustomerVoucherCode(customer);
                const existingVoucher = storeCoupons.find(
                  (cp) => cp.code.toUpperCase() === voucherCode && cp.isActive
                );
                const cashbackValue = Math.max(
                  1,
                  Math.round((customer.totalSpent || 0) * (cashbackPercent / 100) * 100) / 100
                );
                const phoneDigits = String(customer.phone || '').replace(/\D/g, '');
                const waMsg = `Olá ${customer.name}! Notamos que você já é cliente fiel do ${currentStore.name}.\n\nLiberamos R$ ${cashbackValue.toFixed(2)} de CASHBACK para seu próximo pedido acima de R$ ${minOrderValue}!\n\nUse o cupom: ${voucherCode}`;
                const waUrl = `https://wa.me/${phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`}?text=${encodeURIComponent(waMsg)}`;

                return (
                  <div
                    key={customer.id}
                    className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-purple-500/40 transition-colors space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-400">
                        {customer.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {customer.name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {customer.totalOrders} pedidos · Último: {customer.lastOrderDate || 'Recente'}
                        </p>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">Cashback ({voucherCode})</p>
                        <p className="text-xs font-black font-mono tabular-nums text-emerald-500">
                          R$ {cashbackValue.toFixed(2)}
                        </p>
                      </div>
                      {existingVoucher ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() =>
                            showNotification(
                              `Enviando cupom ativo ${voucherCode} via WhatsApp para ${customer.name}`
                            )
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-bold transition-colors"
                        >
                          <MessageSquare size={12} /> Enviar WhatsApp
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled={creatingCouponForId === customer.id}
                          onClick={() => handleGenerateVoucherCoupon(customer)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Ticket size={12} />
                          {creatingCouponForId === customer.id ? 'Gerando...' : 'Ativar Cupom'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Global Stats */}
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-5">
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Cashback Elegível
            </p>
            <p className="text-lg font-black text-white font-mono tabular-nums mt-0.5">
              R$ {walletBalance.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Pedidos c/ Desconto
            </p>
            <p className="text-lg font-black text-amber-400 font-mono tabular-nums mt-0.5">
              {discountedOrdersCount}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              LTV Médio da Loja
            </p>
            <p className="text-lg font-black text-emerald-400 font-mono tabular-nums mt-0.5">
              R$ {averageLtv.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Pedidos Válidos
            </p>
            <p className="text-lg font-black text-blue-400 font-mono tabular-nums mt-0.5">
              {storeOrders.length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
