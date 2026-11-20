import React from 'react';
import { Activity, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { Store } from '../../../types';

interface HqTenantHealthProps {
  stores: Store[];
}

export const HqTenantHealth: React.FC<HqTenantHealthProps> = ({ stores }) => {
  const overdueCount = stores.filter(s => s.saasPaymentStatus === 'OVERDUE' || s.tenantStatus === 'SUSPENDED').length;
  const activeCount = stores.filter(s => s.tenantStatus !== 'SUSPENDED' && s.saasPaymentStatus !== 'OVERDUE').length;
  const highRevenueCount = stores.filter(s => (s.monthlyRevenue || 0) > 50000).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4 shadow-lg">
        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 border border-emerald-500/20">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Empresas &amp; Assinaturas Regulares</div>
          <div className="text-xl font-black text-white font-mono tabular-nums">{activeCount} / {stores.length} Ativas</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4 shadow-lg">
        <div className="p-3 bg-rose-500/10 rounded-xl text-rose-500 border border-rose-500/20">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Risco de Churn / Inadimplência</div>
          <div className="text-xl font-black text-rose-400 font-mono tabular-nums">{overdueCount} Tenants</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4 shadow-lg">
        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 border border-blue-500/20">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Alta Performance (GMV)</div>
          <div className="text-xl font-black text-blue-400 font-mono tabular-nums">{highRevenueCount} Estabelecimentos</div>
        </div>
      </div>
    </div>
  );
};
