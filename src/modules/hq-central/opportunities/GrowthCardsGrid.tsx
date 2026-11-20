import React from 'react';
import { Sparkles, Building2, QrCode, Users, ShieldCheck, Globe, Zap, Layers } from 'lucide-react';

export const GrowthCardsGrid: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-lg text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" /> Alavancas de Expansão SaaS (Plataforma v5.2.1)
        </h3>
        <span className="text-xs text-slate-400">Capacidades licenciáveis por plano no ecossistema</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between hover:border-blue-500/40 transition-colors relative">
          <span className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-mono font-black rounded uppercase">v5.2.1</span>
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-sm">1. Expansão Multi-Filial (PRO & Enterprise)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upgrade natural de planos à medida que a rede do cliente cresce. Cotas de filiais validadas no backend com isolamento por unidade e tenant.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Gatilho Upgrade</span>
            <span className="text-blue-400 font-bold">PRO / ENTERPRISE</span>
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between hover:border-amber-500/40 transition-colors relative">
          <span className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-mono font-black rounded uppercase">v5.2.1</span>
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-sm">2. Terminais Ilimitados (BYOD)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cada loja pareia múltiplos PDVs, KDS, Totens e Garçons com código seguro emitido pelo HQ sem custo marginal de hardware proprietário.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Pareamento</span>
            <span className="text-amber-400 font-bold">Devices Ilimitados</span>
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between hover:border-orange-500/40 transition-colors relative">
          <span className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-mono font-black rounded uppercase">v5.2.1</span>
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-sm">3. Rede Logística Regional Compartilhada</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Zonas regionais geridas no HQ permitem cobertura eficiente de entregas combinando frotas locais e entregadores credenciados.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Clusters</span>
            <span className="text-orange-400 font-bold">Multi-Zona</span>
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between hover:border-emerald-500/40 transition-colors relative">
          <span className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-mono font-black rounded uppercase">v5.2.1</span>
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-sm">4. Marketplace Público 0% Comissão</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Canal de descoberta unificado para atrair novas empresas ao SaaS sem cobrar taxa percentual sobre cada venda realizada.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Take-rate</span>
            <span className="text-emerald-400 font-bold">0% Comissão</span>
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between hover:border-cyan-500/40 transition-colors relative">
          <span className="absolute top-3 right-3 px-2 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[9px] font-mono font-black rounded uppercase">ENTERPRISE</span>
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center font-bold">
              <Globe className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-sm">5. White-Label: Domínio Próprio & DNS</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Contas Enterprise operam com subdomínio ou domínio customizado mapeado para a vitrine pública do ecossistema.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Tier Elegível</span>
            <span className="text-cyan-400 font-bold">ENTERPRISE</span>
          </div>
        </div>

        <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between hover:border-emerald-500/40 transition-colors relative">
          <span className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[9px] font-mono font-black rounded uppercase">CORE REAL</span>
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-white text-sm">6. Contingência Local-First (Edge WAL + HLC)</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Operação offline no Edge Node com gravação WAL local e reconciliação idempotente com o Server Core v5.2.1 assim que a conexão retorna.
            </p>
          </div>
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Sync Protocol</span>
            <span className="text-emerald-400 font-bold">HLC + Outbox</span>
          </div>
        </div>
      </div>
    </div>
  );
};
