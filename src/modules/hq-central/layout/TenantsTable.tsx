import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import { Store, DeviceLicense } from '../../../types';
import { getStoreMaxBranches, getTenantStores } from '../../../utils/storeDomain';

interface TenantsTableProps {
  stores: Store[];
  allStores?: Store[];
  deviceLicenses: DeviceLicense[];
  onEditPlan: (id: string) => void;
  onToggleBilling: (id: string, status: any) => void;
  onSuspendTenant?: (tenantId: string) => void;
  onActivateTenant?: (tenantId: string) => void;
}

const getBillingStatusMeta = (status?: string) => {
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
    case 'PENDING':
      return {
        label: 'PENDENTE',
        cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      };
    default:
      return {
        label: 'ATRASADO',
        cls: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
      };
  }
};

export const TenantsTable: React.FC<TenantsTableProps> = ({
  stores,
  allStores,
  deviceLicenses,
  onEditPlan,
  onToggleBilling,
  onSuspendTenant,
  onActivateTenant,
}) => {
  const [confirmSuspendId, setConfirmSuspendId] = useState<string | null>(null);
  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({});
  const branchPool = allStores || stores;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-left text-xs text-slate-300">
        <thead className="bg-slate-950 text-slate-400 uppercase font-mono">
          <tr>
            <th className="px-4 py-3">Tenant / Empresa</th>
            <th className="px-4 py-3">Plano SaaS</th>
            <th className="px-4 py-3">Subdomínio / DNS</th>
            <th className="px-4 py-3">Ciclo &amp; Valor</th>
            <th className="px-4 py-3">Cota de Filiais</th>
            <th className="px-4 py-3">Status Fatura</th>
            <th className="px-4 py-3 text-center">Governança HQ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {stores.map(store => {
            const usedDevices = deviceLicenses.filter(d => d.storeId === store.id).length;
            const usedBranches = Math.max(1, getTenantStores(branchPool, store).length);
            const maxBranches = getStoreMaxBranches(store);
            const isNearQuota = usedBranches >= maxBranches;

            const isFree = store.subscriptionPlan === 'FREE';
            const trialExp = store.trialExpiresAt ? new Date(store.trialExpiresAt) : null;
            const isExpired = isFree && trialExp ? new Date() > trialExp : false;
            const daysRemaining = trialExp ? Math.max(0, Math.ceil((trialExp.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 7;
            const initials = (store.name || '3C').slice(0, 2).toUpperCase();
            const billingMeta = getBillingStatusMeta(store.saasPaymentStatus);
            const showLogoImg = Boolean(store.logo && !failedLogos[store.id]);
            const isConfirmingSuspend = confirmSuspendId === store.id;

            return (
              <tr key={store.id} className="hover:bg-slate-800/40">
                <td className="px-4 py-3 font-bold text-white flex items-center gap-3">
                  {showLogoImg ? (
                    <img
                      src={store.logo}
                      alt={store.name}
                      referrerPolicy="no-referrer"
                      onError={() => setFailedLogos((prev) => ({ ...prev, [store.id]: true }))}
                      className="w-9 h-9 rounded-xl object-cover border border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black font-mono text-amber-400 shrink-0">
                      {initials}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                      <span>{store.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-mono">{store.category}</span>
                      {store.isDemo && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-black uppercase tracking-wider">
                          Demo / Seed
                        </span>
                      )}
                      {store.tenantStatus === 'SUSPENDED' && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded font-black uppercase tracking-wider">
                          SUSPENSO
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal font-mono">
                      tenant: {store.tenantId || 'tenant-1'} • {store.address}
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1 items-start">
                    <span className={`px-2.5 py-1 rounded-lg border font-bold text-xs font-mono ${
                      isFree 
                        ? (isExpired ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30')
                        : (store.subscriptionPlan === 'PROMO' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/20')
                    }`}>
                      {store.subscriptionPlan}
                    </span>
                    {isFree && (
                      <span className={`text-[9px] font-mono tabular-nums font-bold px-1.5 py-0.5 rounded ${
                        isExpired 
                          ? 'bg-rose-950 text-rose-400 border border-rose-800' 
                          : 'bg-slate-950 text-amber-400 border border-slate-800'
                      }`}>
                        {isExpired ? 'DEGUSTAÇÃO EXPIRADA' : `Degustação: ${daysRemaining}d`}
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <div className="text-[10px] font-mono text-blue-400 font-bold flex items-center gap-1">
                      <Globe size={10} /> {store.slug}.3c-os.com
                    </div>
                    <div className={`text-[9px] font-bold ${store.subscriptionPlan === 'ENTERPRISE' ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {store.subscriptionPlan === 'ENTERPRISE' ? 'Domínio Custom Elegível' : 'Subdomínio Padrão'}
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3 font-mono tabular-nums">
                  <div className="font-bold text-emerald-400">
                    R$ {(store.saasMonthlyFee ?? 0).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {store.billingCycle === 'ANNUAL' ? 'Anual (-25%)' : store.billingCycle === 'QUARTERLY' ? 'Trimestral (-10%)' : 'Mensal'}
                  </div>
                </td>

                <td className="px-4 py-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono tabular-nums">
                      <span className={isNearQuota ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                        {usedBranches} / {maxBranches} {maxBranches === 1 ? 'Filial' : 'Filiais'}
                      </span>
                      <span className="text-emerald-400 text-[10px]">{usedDevices} dev</span>
                    </div>
                    <div className="w-28 bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                      <div 
                        className={`h-full rounded-full ${isNearQuota ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.min(100, (usedBranches / maxBranches) * 100)}%` }}
                      />
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onToggleBilling(store.id, store.saasPaymentStatus === 'PAID' ? 'OVERDUE' : 'PAID')}
                    title="Alternar status de pagamento da fatura"
                    className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono transition-all cursor-pointer ${billingMeta.cls}`}
                  >
                    {billingMeta.label}
                  </button>
                </td>

                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onEditPlan(store.id)}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                    >
                      Licença
                    </button>
                    {store.tenantStatus === 'SUSPENDED' ? (
                      <button
                        type="button"
                        onClick={() => onActivateTenant?.(store.tenantId || store.id)}
                        className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold rounded-lg text-[10px] border border-emerald-500/30 transition-colors cursor-pointer"
                        title="Reativar Tenant"
                      >
                        Reativar
                      </button>
                    ) : isConfirmingSuspend ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onSuspendTenant?.(store.tenantId || store.id);
                            setConfirmSuspendId(null);
                          }}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-lg text-[10px] transition-colors cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmSuspendId(null)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                        >
                          Voltar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmSuspendId(store.id)}
                        className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-lg text-[10px] border border-rose-500/20 transition-colors cursor-pointer"
                        title="Suspender Tenant e revogar acessos"
                      >
                        Suspender
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {stores.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-slate-500 italic">
                Nenhum estabelecimento corresponde aos filtros aplicados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
