import React, { useMemo, useState } from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { Building2, Plus, Search } from 'lucide-react';

// Modular Layout Components
import { TenantsTable } from './layout/TenantsTable';
import { CreateStoreModal } from './layout/CreateStoreModal';
import { EditStorePlanModal } from './layout/EditStorePlanModal';
import { HqTenantHealth } from './layout/HqTenantHealth';
import {
  getDefaultBranchesForPlan,
  getDefaultDevicesForPlan,
  getDefaultEnabledModulesForCategory,
} from '../../utils/storeDomain';

type TenantStatusFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'OVERDUE' | 'TRIAL';

export const HqTenantsTab: React.FC = () => {
  const { 
    stores, deviceLicenses, governance, updateStoreSubscription, toggleStoreBillingStatus, 
    addStore, suspendTenant, activateTenant
  } = useEcosystem();

  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [isCreatingStore, setIsCreatingStore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenantStatusFilter>('ALL');

  const visibleStores = useMemo(() => stores.filter((s) => !s._deleted), [stores]);

  const filterCounts = useMemo(() => {
    let active = 0;
    let suspended = 0;
    let overdue = 0;
    let trial = 0;
    for (const s of visibleStores) {
      if (s.tenantStatus === 'SUSPENDED') suspended++;
      else active++;
      if (s.saasPaymentStatus === 'OVERDUE') overdue++;
      if (s.saasPaymentStatus === 'TRIAL' || s.subscriptionPlan === 'FREE') trial++;
    }
    return { all: visibleStores.length, active, suspended, overdue, trial };
  }, [visibleStores]);

  const filteredStores = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return visibleStores.filter((s) => {
      if (statusFilter === 'ACTIVE' && s.tenantStatus === 'SUSPENDED') return false;
      if (statusFilter === 'SUSPENDED' && s.tenantStatus !== 'SUSPENDED') return false;
      if (statusFilter === 'OVERDUE' && s.saasPaymentStatus !== 'OVERDUE') return false;
      if (statusFilter === 'TRIAL' && s.saasPaymentStatus !== 'TRIAL' && s.subscriptionPlan !== 'FREE') return false;
      if (q) {
        const hay = `${s.name} ${s.slug} ${s.tenantId || ''} ${s.category || ''} ${s.address || ''} ${s.city || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [visibleStores, searchTerm, statusFilter]);

  const activeEditingStore = visibleStores.find(s => s.id === editingStoreId) || null;

  const handleCreateStore = async (data: any) => {
    const planTier = (data.subscriptionPlan || 'FREE') as keyof NonNullable<typeof governance.planPricing>;
    const customPricing = governance.planPricing?.[planTier];
    const maxAllowedDevices = customPricing?.maxDevices ?? getDefaultDevicesForPlan(data.subscriptionPlan);
    const maxAllowedBranches = customPricing?.maxBranches ?? getDefaultBranchesForPlan(data.subscriptionPlan);

    const storeId = await addStore({
      ...data,
      rating: 5.0,
      deliveryTimeMin: 30,
      deliveryFee: 7.00,
      minOrder: 30.00,
      commissionRate: 0,
      maxAllowedDevices,
      maxAllowedBranches,
      saasPaymentStatus: data.subscriptionPlan === 'FREE' ? 'TRIAL' : 'PENDING',
      isOpen: false,
      totalOrders: 0,
      monthlyRevenue: 0,
      enabledModules: getDefaultEnabledModulesForCategory(data.category),
    });
    if (storeId) setIsCreatingStore(false);
  };

  const filterButtons: Array<{ id: TenantStatusFilter; label: string; count: number }> = [
    { id: 'ALL', label: 'Todos', count: filterCounts.all },
    { id: 'ACTIVE', label: 'Ativos', count: filterCounts.active },
    { id: 'OVERDUE', label: 'Inadimplentes', count: filterCounts.overdue },
    { id: 'TRIAL', label: 'Degustação', count: filterCounts.trial },
    { id: 'SUSPENDED', label: 'Suspensos', count: filterCounts.suspended },
  ];

  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 animate-fadeIn">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" /> Gestão de Tenants &amp; Licenças SaaS
          </h2>
          <p className="text-xs text-slate-400">
            Governança de empresas, planos SaaS, cotas de filiais, faturamento e suspensão de acesso.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono tabular-nums px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 font-bold">
            {filteredStores.length} / {visibleStores.length} Lojas
          </span>
          <button
            onClick={() => setIsCreatingStore(true)}
            className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-amber-400 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> NOVO LOJISTA
          </button>
        </div>
      </div>

      <HqTenantHealth stores={visibleStores} />

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="inline-flex flex-wrap p-1 bg-slate-950 rounded-xl border border-slate-800 gap-1">
          {filterButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setStatusFilter(btn.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                statusFilter === btn.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{btn.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums ${
                  statusFilter === btn.id
                    ? 'bg-slate-950/20 text-slate-950'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {btn.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar empresa, slug, tenant ou cidade..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      <TenantsTable
        stores={filteredStores}
        allStores={visibleStores}
        deviceLicenses={deviceLicenses}
        onEditPlan={setEditingStoreId}
        onToggleBilling={toggleStoreBillingStatus}
        onSuspendTenant={suspendTenant}
        onActivateTenant={activateTenant}
      />

      <CreateStoreModal
        isOpen={isCreatingStore}
        onClose={() => setIsCreatingStore(false)}
        onSubmit={handleCreateStore}
      />

      <EditStorePlanModal
        store={activeEditingStore}
        isOpen={!!editingStoreId}
        onClose={() => setEditingStoreId(null)}
        onSave={(tier, cycle, maxBranches, trialExp, customOverrides) => {
          if (editingStoreId) {
            void updateStoreSubscription(
              editingStoreId,
              tier,
              cycle,
              maxBranches,
              trialExp,
              undefined,
              customOverrides
            );
            setEditingStoreId(null);
          }
        }}
      />
    </div>
  );
};
