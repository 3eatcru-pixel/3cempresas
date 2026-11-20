import React from 'react';
import { CreditCard, Server, DollarSign, Laptop } from 'lucide-react';

interface HqMetricCardsProps {
  totalSaaSRevenue: number;
  paidSaaSRevenue?: number;
  totalCosts: number;
  netPlatformProfit: number;
  storesCount: number;
  suspendedStoresCount?: number;
  deviceLicensesCount: number;
}

export const HqMetricCards: React.FC<HqMetricCardsProps> = ({
  totalSaaSRevenue,
  paidSaaSRevenue = 0,
  totalCosts,
  netPlatformProfit,
  storesCount,
  suspendedStoresCount = 0,
  deviceLicensesCount
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-1">
        <div className="text-slate-400 text-xs flex justify-between">
          <span>MRR Contratado (Ativo)</span>
          <CreditCard className="w-4 h-4 text-amber-400" />
        </div>
        <div className="text-2xl font-black text-amber-400 font-mono tabular-nums">
          R$ {totalSaaSRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
        <div className="text-[11px] text-emerald-400 font-medium font-mono tabular-nums">
          Pago confirmado: R$ {paidSaaSRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
      </div>

      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-1">
        <div className="text-slate-400 text-xs flex justify-between">
          <span>Custos de Infraestrutura (Ledger)</span>
          <Server className="w-4 h-4 text-red-400" />
        </div>
        <div className="text-2xl font-black text-red-400 font-mono tabular-nums">
          R$ {totalCosts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
        <div className="text-[11px] text-slate-400">Despesas de infra do HQ • Stack OSS</div>
      </div>

      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-1">
        <div className="text-slate-400 text-xs flex justify-between">
          <span>Resultado Operacional (SaaS)</span>
          <DollarSign className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-2xl font-black text-emerald-400 font-mono tabular-nums">
          R$ {netPlatformProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
        <div className="text-[11px] text-emerald-400 font-medium font-mono tabular-nums">
          Margem: {totalSaaSRevenue > 0 ? ((netPlatformProfit / totalSaaSRevenue) * 100).toFixed(1) : '0.0'}%
        </div>
      </div>

      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-1">
        <div className="text-slate-400 text-xs flex justify-between">
          <span>Lojas &amp; Terminais Ativos</span>
          <Laptop className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="text-2xl font-black text-white font-mono tabular-nums">
          {storesCount} Ativa(s) • {deviceLicensesCount} Term.
        </div>
        <div className="text-[11px] text-cyan-400 font-mono tabular-nums">
          {suspendedStoresCount > 0 ? `${suspendedStoresCount} suspensa(s) • Isolamento ativo` : 'Governança multi-tenant ativa'}
        </div>
      </div>
    </div>
  );
};
