import React from 'react';
import { Calculator } from 'lucide-react';

interface MrrSimulatorProps {
  storeCount: number;
  setStoreCount: (cnt: number) => void;
  planDistribution: 'conservative' | 'balanced' | 'pro';
  setPlanDistribution: (p: 'conservative' | 'balanced' | 'pro') => void;
  mrrData: {
    grossRevenue: number;
    infraCost: number;
    netProfit: number;
    margin: string;
    startStores: number;
    proStores: number;
    entStores: number;
  };
  totalStoresInDb: number;
  tierPrices?: { basic: number; pro: number; enterprise: number };
}

export const MrrSimulator: React.FC<MrrSimulatorProps> = ({
  storeCount,
  setStoreCount,
  planDistribution,
  setPlanDistribution,
  mrrData,
  totalStoresInDb,
  tierPrices = { basic: 149, pro: 299, enterprise: 499 }
}) => {
  return (
    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-base text-white">Simulador de Receita do Dono do SaaS (MRR)</h3>
            <p className="text-xs text-slate-400">Projeção de escala e lucro líquido baseado na expansão da base de lojistas credenciados.</p>
          </div>
        </div>
        <span className="text-xs font-mono text-amber-400 font-bold bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
          Escala Atual: {totalStoresInDb} Lojas no Banco
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="space-y-5 lg:col-span-1 bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-300">Número de Lojistas Credenciados:</span>
              <span className="text-amber-400 font-mono text-sm">{storeCount} lojas</span>
            </div>
            <input 
              type="range" 
              min={5} 
              max={500} 
              step={5}
              value={storeCount}
              onChange={(e) => setStoreCount(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>5 lojas</span>
              <span>100 lojas</span>
              <span>250 lojas</span>
              <span>500 lojas</span>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-2">
            {[15, 50, 100, 250].map(cnt => (
              <button
                key={cnt}
                onClick={() => setStoreCount(cnt)}
                className={`flex-1 py-1 text-[11px] font-bold rounded-lg border transition-all ${
                  storeCount === cnt 
                    ? 'bg-amber-500 text-slate-950 border-amber-500 font-black' 
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {cnt} lojas
              </button>
            ))}
          </div>

          {/* Distribution Presets */}
          <div className="space-y-1.5 pt-2">
            <label className="text-[11px] font-bold text-slate-400">Perfil de Adoção de Planos:</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'conservative', label: 'Econômico', desc: 'Mais Start' },
                { id: 'balanced', label: 'Equilibrado', desc: 'Misto' },
                { id: 'pro', label: 'Gourmet', desc: 'Mais Pro' },
              ].map(p => (
                <button
                  key={p.id}
                  onClick={() => setPlanDistribution(p.id as any)}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    planDistribution === p.id 
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="text-[11px] font-bold">{p.label}</div>
                  <div className="text-[9px] text-slate-500">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Visualizer */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Faturamento Bruto (MRR)</span>
              <div className="text-2xl font-black text-amber-400 font-mono">
                R$ {mrrData.grossRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400">Receita de assinaturas mensais recorrentes</div>
            </div>
            <div className="pt-3 border-t border-slate-800/60 text-[10px] font-mono tabular-nums text-slate-400 space-y-1">
              <div>• {mrrData.startStores} Lojas Basic (R$ {tierPrices.basic.toFixed(2)})</div>
              <div>• {mrrData.proStores} Lojas Pro (R$ {tierPrices.pro.toFixed(2)})</div>
              <div>• {mrrData.entStores} Lojas Enterprise (R$ {tierPrices.enterprise.toFixed(2)})</div>
            </div>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Custo de Nuvem (Estimado)</span>
              <div className="text-2xl font-black text-red-400 font-mono tabular-nums">
                R$ {mrrData.infraCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-slate-400">OpenFreeMaps (R$ 0) + Server Core SQLite/Postgres</div>
            </div>
            <div className="pt-3 border-t border-slate-800/60 text-[10px] font-mono text-emerald-400 space-y-1">
              <div>• Mapas: R$ 0,00 (OpenFreeMaps)</div>
              <div>• Gateways: R$ 0,00 (PIX Direto)</div>
              <div>• SSE: R$ 0,00 (Node nativo)</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-950/60 to-slate-950 p-5 rounded-2xl border border-emerald-500/40 space-y-2 flex flex-col justify-between shadow-xl">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider">LUCRO LÍQUIDO MENSAL</span>
              <div className="text-3xl font-black text-emerald-400 font-mono">
                R$ {mrrData.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-emerald-300 font-medium">Margem Líquida: {mrrData.margin}%</div>
            </div>
            <div className="pt-3 border-t border-emerald-500/20 text-[11px] text-slate-300">
              💰 <strong>R$ {(mrrData.netProfit * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> de lucro anual direto para você.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
