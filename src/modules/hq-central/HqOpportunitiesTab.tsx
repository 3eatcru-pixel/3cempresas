import React, { useState } from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { SAAS_PLAN_TIERS } from '../../constants/platformDefaults';
import { Zap } from 'lucide-react';

import { MrrSimulator } from './opportunities/MrrSimulator';
import { GrowthCardsGrid } from './opportunities/GrowthCardsGrid';

export const HqOpportunitiesTab: React.FC = () => {
  const { profile } = useAuth();
  const { stores, governance } = useEcosystem();

  // MRR Simulator State
  const [storeCount, setStoreCount] = useState<number>(50);
  const [planDistribution, setPlanDistribution] = useState<'conservative' | 'balanced' | 'pro'>('balanced');

  const resolvePrice = (tier: 'BASIC' | 'PRO' | 'ENTERPRISE', fallback: number) => {
    return governance?.planPricing?.[tier]?.monthlyPrice ?? SAAS_PLAN_TIERS.find(t => t.tier === tier)?.monthlyPrice ?? fallback;
  };

  const basicPrice = resolvePrice('BASIC', 149);
  const proPrice = resolvePrice('PRO', 299);
  const enterprisePrice = resolvePrice('ENTERPRISE', 499);

  // Calculate projected MRR strictly from official 3C SaaS plan tiers
  const calculateMRR = () => {
    let basicRatio = 0.5;
    let proRatio = 0.35;
    let enterpriseRatio = 0.15;

    if (planDistribution === 'conservative') {
      basicRatio = 0.7;
      proRatio = 0.25;
      enterpriseRatio = 0.05;
    } else if (planDistribution === 'pro') {
      basicRatio = 0.3;
      proRatio = 0.5;
      enterpriseRatio = 0.2;
    }

    const startStores = Math.round(storeCount * basicRatio);
    const proStores = Math.round(storeCount * proRatio);
    const entStores = Math.max(0, storeCount - startStores - proStores);

    const grossRevenue = (startStores * basicPrice) + (proStores * proPrice) + (entStores * enterprisePrice);
    const infraCost = Math.max(45, storeCount * 1.80);
    const netProfit = grossRevenue - infraCost;
    const margin = grossRevenue > 0 ? ((netProfit / grossRevenue) * 100).toFixed(1) : '0.0';

    return { grossRevenue, infraCost, netProfit, margin, startStores, proStores, entStores };
  };

  const mrrData = calculateMRR();
  const activePortfolioStores = stores.filter(
    (s) =>
      !s._deleted &&
      s.tenantStatus !== 'SUSPENDED' &&
      String((s as any).status || 'ACTIVE').toUpperCase() !== 'SUSPENDED'
  );
  const activePaidMrr = activePortfolioStores.reduce((acc, s) => acc + (s.saasMonthlyFee || 0), 0);

  return (
    <div className="space-y-8 animate-fadeIn text-slate-100">
      {/* Top SaaS Economics Header */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-emerald-500/25 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> SaaS Unit Economics • v5.2.1
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-xs text-slate-400 font-mono">Operador HQ: {profile?.email}</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Modelagem de Crescimento & Receita Recorrente (MRR)
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Projeção comercial baseada nos preços reais configurados em Planos & Billing (Basic R$ {basicPrice.toFixed(0)} • Pro R$ {proPrice.toFixed(0)} • Enterprise R$ {enterprisePrice.toFixed(0)}).
          </p>
        </div>

        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-right min-w-[220px]">
          <div className="text-[10px] text-slate-400 font-mono uppercase">MRR Atual em Carteira</div>
          <div className="text-2xl font-black text-emerald-400 font-mono tabular-nums">
            R$ {activePaidMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 font-mono tabular-nums">Margem projetada: {mrrData.margin}%</div>
        </div>
      </div>

      {/* SECTION 1: Interactive MRR Simulator */}
      <MrrSimulator
        storeCount={storeCount}
        setStoreCount={setStoreCount}
        planDistribution={planDistribution}
        setPlanDistribution={setPlanDistribution}
        mrrData={mrrData}
        totalStoresInDb={activePortfolioStores.length}
        tierPrices={{ basic: basicPrice, pro: proPrice, enterprise: enterprisePrice }}
      />

      {/* SECTION 2: SaaS Platform Drivers */}
      <GrowthCardsGrid />
    </div>
  );
};
