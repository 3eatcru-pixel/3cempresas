import React, { useMemo, useState } from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { Users, Search, Plus } from 'lucide-react';
import { CustomerCard } from './layout/CustomerCard';
import { NewCustomerModal } from './layout/NewCustomerModal';
import { CustomerDetailModal } from './layout/CustomerDetailModal';

type TierFilter = 'ALL' | 'VIP' | 'SILVER' | 'BRONZE';

export const CRMApp: React.FC = () => {
  const {
    currentStore,
    customersCrm,
    orders,
    addCustomerToCrm,
    updateCustomerProfile,
    deleteCustomerFromCrm,
    showNotification,
  } = useEcosystem();
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('ALL');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const storeCustomers = useMemo(
    () => customersCrm.filter((c) => c.storeId === currentStore.id),
    [customersCrm, currentStore.id]
  );

  const selectedCustomer = useMemo(
    () => storeCustomers.find((c) => c.id === selectedCustomerId) || null,
    [storeCustomers, selectedCustomerId]
  );

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    return storeCustomers.filter((c) => {
      const tier = c.loyaltyTier || 'BRONZE';
      if (tierFilter === 'VIP' && tier !== 'GOLD' && tier !== 'PLATINUM') return false;
      if (tierFilter === 'SILVER' && tier !== 'SILVER') return false;
      if (tierFilter === 'BRONZE' && tier !== 'BRONZE') return false;

      if (!q) return true;
      const matchName = (c.name || '').toLowerCase().includes(q);
      const matchEmail = (c.email || '').toLowerCase().includes(q);
      const matchPhone =
        (c.phone || '').toLowerCase().includes(q) ||
        (qDigits.length > 0 && String(c.phone || '').replace(/\D/g, '').includes(qDigits));
      return matchName || matchEmail || matchPhone;
    });
  }, [storeCustomers, searchTerm, tierFilter]);

  const vipCount = storeCustomers.filter(
    (c) => c.loyaltyTier === 'GOLD' || c.loyaltyTier === 'PLATINUM'
  ).length;
  const totalPoints = storeCustomers.reduce((sum, c) => sum + (c.loyaltyPoints || 0), 0);
  const averageLtv =
    storeCustomers.length > 0
      ? storeCustomers.reduce((sum, c) => sum + (c.totalSpent || 0), 0) / storeCustomers.length
      : 0;

  return (
    <div className="space-y-5 h-full overflow-y-auto pr-2 custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4 sticky top-0 bg-[#0a0e17] z-10 py-2">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-blue-400" />
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight leading-none">
              CRM & Diretório de Clientes
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Perfil 360°, pontuação de fidelidade e histórico de pedidos da filial
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative flex-1 sm:flex-none">
            <input
              type="text"
              placeholder="Buscar nome, telefone ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-xs pl-3.5 pr-9 py-2 rounded-xl text-white outline-none focus:border-blue-500 w-full sm:w-64"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5" />
          </div>
          <button
            type="button"
            onClick={() => setIsAddingCustomer(true)}
            className="px-3.5 py-2 bg-blue-500 text-slate-950 font-black text-xs rounded-xl hover:bg-blue-400 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Novo Cliente
          </button>
        </div>
      </div>

      {/* KPI Strip + Tier Filter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="text-[10px] font-bold uppercase text-slate-500">Base de Clientes</div>
          <div className="text-lg font-black font-mono tabular-nums text-white mt-0.5">
            {storeCustomers.length}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="text-[10px] font-bold uppercase text-slate-500">VIPs (Gold / Plat)</div>
          <div className="text-lg font-black font-mono tabular-nums text-amber-400 mt-0.5">
            {vipCount}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="text-[10px] font-bold uppercase text-slate-500">LTV Médio</div>
          <div className="text-lg font-black font-mono tabular-nums text-emerald-400 mt-0.5">
            R$ {averageLtv.toFixed(2)}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
          <div className="text-[10px] font-bold uppercase text-slate-500">Pontos Acumulados</div>
          <div className="text-lg font-black font-mono tabular-nums text-blue-400 mt-0.5">
            {totalPoints.toLocaleString('pt-BR')} pts
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-xl gap-1">
          {(
            [
              { id: 'ALL', label: `Todos (${storeCustomers.length})` },
              { id: 'VIP', label: `VIPs (${vipCount})` },
              {
                id: 'SILVER',
                label: `Silver (${storeCustomers.filter((c) => c.loyaltyTier === 'SILVER').length})`,
              },
              {
                id: 'BRONZE',
                label: `Bronze (${
                  storeCustomers.filter((c) => !c.loyaltyTier || c.loyaltyTier === 'BRONZE').length
                })`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTierFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                tierFilter === tab.id
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-500 font-mono">
          Exibindo {filtered.length} de {storeCustomers.length} clientes
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
        {filtered.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            currentStore={currentStore}
            onShowNotification={showNotification}
            onOpenDetails={(c) => setSelectedCustomerId(c.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl gap-3">
            <Users className="w-12 h-12 text-slate-600" />
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider text-center">
              Nenhum cliente encontrado com os filtros atuais.
            </p>
          </div>
        )}
      </div>

      <NewCustomerModal
        isOpen={isAddingCustomer}
        onClose={() => setIsAddingCustomer(false)}
        onSubmitCustomer={addCustomerToCrm}
      />

      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          currentStore={currentStore}
          orders={orders}
          onClose={() => setSelectedCustomerId(null)}
          onUpdateProfile={updateCustomerProfile}
          onDeleteCustomer={deleteCustomerFromCrm}
          onShowNotification={showNotification}
        />
      )}
    </div>
  );
};
