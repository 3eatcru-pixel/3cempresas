import React, { useState } from 'react';
import { CreditCard as BillingIcon, Clock, Building2, Plus, ArrowRight } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { SubscriptionPlanTier, BillingCycle, StoreCategory } from '../../../types';
import { getStoreMaxBranches, getTenantStores } from '../../../utils/storeDomain';
import { BillingCurrentPlanCard } from '../billing/BillingCurrentPlanCard';
import { BillingUpgradeModal } from '../billing/BillingUpgradeModal';
import { StoreDevicesManager } from '../billing/StoreDevicesManager';
import { StorePeripheralsManager } from '../billing/StorePeripheralsManager';

export const BillingApp: React.FC = () => {
  const {
    currentStore,
    stores,
    setSelectedStoreId,
    deviceLicenses,
    governance,
    updateStoreSubscription,
    createBranchStore,
    registerNewDeviceLicense,
    revokeDeviceLicense,
    pairDevice,
    regenerateDevicePairing,
    revokeDeviceToken,
    showNotification,
  } = useEcosystem();

  const isFree = currentStore.subscriptionPlan === 'FREE';
  const trialExpires = currentStore.trialExpiresAt ? new Date(currentStore.trialExpiresAt) : null;
  const now = new Date();
  const daysLeft = trialExpires ? Math.max(0, Math.ceil((trialExpires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 7;
  const isExpired = trialExpires ? now > trialExpires : false;

  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchLabel, setBranchLabel] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchCategory, setBranchCategory] = useState<StoreCategory>(currentStore.category);

  const tenantBranches = getTenantStores(stores, currentStore);
  const maxBranches = getStoreMaxBranches(currentStore, governance);
  const branchQuotaReached = tenantBranches.length >= maxBranches;

  const handleConfirmUpgrade = async (
    plan: SubscriptionPlanTier,
    cycle: BillingCycle,
    nextMaxBranches: number,
    couponCode?: string,
    paymentMethod?: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO' | 'BANK_TRANSFER' | 'PAYMENT_LINK'
  ) => {
    await updateStoreSubscription(currentStore.id, plan, cycle, nextMaxBranches, undefined, couponCode, {
      ...(paymentMethod ? { paymentMethod } : {}),
    });
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) return;
    const createdId = await createBranchStore(currentStore, {
      name: branchName,
      branchLabel,
      address: branchAddress || currentStore.address,
      phone: branchPhone || currentStore.phone,
      category: branchCategory,
    });
    if (createdId) {
      setIsCreatingBranch(false);
      setBranchName('');
      setBranchLabel('');
      setBranchAddress('');
      setBranchPhone('');
      setSelectedStoreId(createdId);
    }
  };

  return (
    <div className="space-y-6 h-full overflow-y-auto pr-2 custom-scrollbar animate-fadeIn text-slate-100">
      {/* Trial Countdown Alert Banner */}
      {isFree && (
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            isExpired
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isExpired ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-xs uppercase tracking-wider flex items-center gap-2">
                <span>{isExpired ? 'PERÍODO DE DEGUSTAÇÃO EXPIRADO' : 'PERÍODO DE TESTE GRATUITO (FREE TRIAL)'}</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] bg-slate-950 font-mono font-bold">
                  {isExpired ? '0 dias restantes' : `${daysLeft} dias restantes`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isExpired
                  ? 'Seu período de teste terminou. Faça o upgrade para manter suas operações, PDV e filiais ativas.'
                  : `Aproveite para cadastrar itens e testar vendas. A sua degustação expira em ${trialExpires ? trialExpires.toLocaleDateString('pt-BR') : '7 dias'}.`}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsUpgradeOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-transform active:scale-95 shrink-0 cursor-pointer"
          >
            Fazer Upgrade Definitivo
          </button>
        </div>
      )}

      {currentStore.pendingUpgradeRequest?.status === 'PENDING_PAYMENT_CONFIRMATION' && (
        <div className="p-4 rounded-2xl border bg-amber-500/10 border-amber-500/30 text-amber-200 flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-black uppercase tracking-wider">
              Solicitação de Upgrade Pendente ({currentStore.pendingUpgradeRequest.requestedPlan} • {currentStore.pendingUpgradeRequest.billingCycle}
              {currentStore.pendingUpgradeRequest.paymentMethod ? ` • ${currentStore.pendingUpgradeRequest.paymentMethod}` : ''})
            </div>
            <p className="text-[11px] text-slate-300">
              Pedido registrado em {new Date(currentStore.pendingUpgradeRequest.requestedAt).toLocaleString('pt-BR')}. As novas cotas serão liberadas após confirmação do pagamento.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-amber-500/30 text-[10px] font-mono text-amber-400 shrink-0">
            AGUARDANDO CONFIRMAÇÃO
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <BillingIcon className="w-6 h-6 text-amber-400" />
        <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
          Minha Assinatura, Filiais & Cotas de Dispositivos
        </h3>
      </div>

      <BillingCurrentPlanCard
        currentStore={currentStore}
        stores={stores}
        deviceLicenses={deviceLicenses}
        governance={governance}
        isFree={isFree}
        onOpenUpgrade={() => setIsUpgradeOpen(true)}
      />

      {/* Branch Management Section */}
      <div className="bg-slate-900/80 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h4 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" />
              <span>Minhas Unidades & Filiais ({tenantBranches.length} / {maxBranches})</span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Gerencie sua cota de filiais e terminais pareados conforme os limites do plano contratado.
            </p>
          </div>

          {branchQuotaReached ? (
            <button
              type="button"
              onClick={() => setIsUpgradeOpen(true)}
              className="px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer"
            >
              Ampliar Plano p/ Nova Filial
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreatingBranch(!isCreatingBranch)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Abrir Nova Filial
            </button>
          )}
        </div>

        {isCreatingBranch && !branchQuotaReached && (
          <form onSubmit={handleCreateBranch} className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Nome da Filial *</label>
              <input
                type="text"
                required
                placeholder="Ex: Loja 02 - Zona Sul"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Identificação / Setor</label>
              <select
                value={branchCategory}
                onChange={(e) => setBranchCategory(e.target.value as StoreCategory)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
              >
                <option value={currentStore.category}>Mesmo setor ({currentStore.category})</option>
                <option value="MULTI_COMMERCE">Multivendas Híbrido (Tudo + Comida)</option>
                <option value="RESTAURANT">Restaurante / Gastronomia</option>
                <option value="RETAIL">Varejo / Mercado</option>
                <option value="FASHION">Moda & Vestuário</option>
                <option value="ELECTRONICS">Eletrônicos & Tech</option>
                <option value="FURNITURE">Móveis & Decoração</option>
                <option value="SERVICES">Serviços & Clínica</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Endereço da Filial</label>
              <input
                type="text"
                placeholder={currentStore.address}
                value={branchAddress}
                onChange={(e) => setBranchAddress(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingBranch(false)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl cursor-pointer"
              >
                Criar Filial
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tenantBranches.map((branch) => {
            const isCurrent = branch.id === currentStore.id;
            return (
              <div
                key={branch.id}
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                  isCurrent ? 'bg-amber-500/10 border-amber-500/40' : 'bg-slate-950/70 border-slate-800'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white truncate">{branch.name}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[9px] font-mono text-amber-400">
                      {branch.branchLabel || (branch.parentStoreId ? 'Filial' : 'Matriz')}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5">{branch.address}</div>
                </div>
                {isCurrent ? (
                  <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                    Em Operação
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectedStoreId(branch.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold rounded-xl flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <span>Operar</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <StoreDevicesManager
        currentStore={currentStore}
        deviceLicenses={deviceLicenses}
        governance={governance}
        onRegisterDevice={registerNewDeviceLicense}
        onRevokeDevice={revokeDeviceLicense}
        onPairDevice={pairDevice}
        onRegeneratePairing={regenerateDevicePairing}
        onRevokeToken={revokeDeviceToken}
        onOpenUpgrade={() => setIsUpgradeOpen(true)}
      />

      <StorePeripheralsManager currentStore={currentStore} />

      <BillingUpgradeModal
        isOpen={isUpgradeOpen}
        onClose={() => setIsUpgradeOpen(false)}
        currentStore={currentStore}
        governance={governance}
        onConfirmUpgrade={handleConfirmUpgrade}
      />
    </div>
  );
};
