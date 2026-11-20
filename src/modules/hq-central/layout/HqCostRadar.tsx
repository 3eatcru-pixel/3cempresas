import React from 'react';
import { Zap, MapPin, CreditCard, Server } from 'lucide-react';

interface HqCostRadarProps {
  totalSaaSRevenue: number;
  totalCosts: number;
  storesCount: number;
  persistenceDriver: string;
}

export const HqCostRadar: React.FC<HqCostRadarProps> = ({
  totalSaaSRevenue,
  totalCosts,
  storesCount,
  persistenceDriver,
}) => {
  const realMarginPct = totalSaaSRevenue > 0
    ? (((totalSaaSRevenue - totalCosts) / totalSaaSRevenue) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-emerald-500/25 space-y-4 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-white flex items-center gap-2">
              <span>Arquitetura de Baixo Custo (Frugal SaaS)</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono tabular-nums font-bold">
                Margem Real: {realMarginPct}%
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Stack auto-hospedado sem intermediários pagos por requisição para {storesCount} tenant(s) ativos.
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">Custos Lançados no Ledger HQ</div>
          <div className="text-xl font-black text-emerald-400 font-mono tabular-nums">
            R$ {totalCosts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span>OpenFreeMaps + Leaflet</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Tiles open-source e Nominatim sem cobrança por carregamento de mapa na plataforma.
          </p>
          <div className="text-[10px] text-emerald-400 font-bold font-mono">Licença Maps: R$ 0,00</div>
        </div>

        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            <span>Modelo SaaS Assinatura Pura</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Receita da plataforma baseada em licenças mensais sem intermediação financeira custodiada.
          </p>
          <div className="text-[10px] text-emerald-400 font-bold font-mono">Take-rate Marketplace: 0%</div>
        </div>

        <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <span>Persistência Server Core ({persistenceDriver})</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Barramento SSE nativo, Edge WAL local e API Node unificada sem custos de middleware externo.
          </p>
          <div className="text-[10px] text-cyan-400 font-bold font-mono">Driver Ativo: {persistenceDriver}</div>
        </div>
      </div>
    </div>
  );
};
