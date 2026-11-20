import React from 'react';
import { Cpu, Radio, MapPin, Server, Terminal } from 'lucide-react';

interface HqInfrastructureCostsProps {
  infrastructureCosts: {
    openFreeMaps: number;
    autonomousEngine: number;
    platformCouriers: number;
    smsWhatsappApi: number;
  };
  activeConnections: number;
  persistenceDriver: string;
}

export const HqInfrastructureCosts: React.FC<HqInfrastructureCostsProps> = ({
  infrastructureCosts,
  activeConnections,
  persistenceDriver,
}) => {
  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base text-white flex items-center gap-2">
          <Cpu className="w-5 h-5 text-amber-400" /> Custos Reais de Infraestrutura do SaaS
        </h3>
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-widest mb-1 border border-emerald-500/20">
            Driver: {persistenceDriver}
          </span>
          <span className="text-[10px] font-mono text-slate-400">Apurado via Financeiro & Telemetria</span>
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Custos operacionais registrados no financeiro da plataforma e conexões SSE ativas em tempo real.
      </p>
      
      <div className="space-y-3 text-xs">
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="font-bold text-white">SSE Active Data Streams</div>
              <div className="text-[10px] text-slate-400">Conexões reais abertas no barramento Server Core</div>
            </div>
          </div>
          <span className="font-mono font-bold text-emerald-400">{activeConnections} Ativas</span>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-blue-400" />
            <div>
              <div className="font-bold text-white">OpenFreeMaps Tiles & Leaflet</div>
              <div className="text-[10px] text-slate-400">Servidor de mapas open-source sem taxas de API</div>
            </div>
          </div>
          <span className="font-mono font-bold text-red-400">R$ {infrastructureCosts.openFreeMaps.toFixed(2)}</span>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <Server className="w-4 h-4 text-amber-400" />
            <div>
              <div className="font-bold text-white">Autonomous Server Engine (Node.js)</div>
              <div className="text-[10px] text-slate-400">Motor de persistência SoT e processamento transacional</div>
            </div>
          </div>
          <span className="font-mono font-bold text-red-400">R$ {infrastructureCosts.autonomousEngine.toFixed(2)}</span>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-purple-400" />
            <div>
              <div className="font-bold text-white">Subsídios da Frota da Plataforma</div>
              <div className="text-[10px] text-slate-400">Repasses e incentivos a motoboys da modalidade HQ</div>
            </div>
          </div>
          <span className="font-mono font-bold text-red-400">R$ {infrastructureCosts.platformCouriers.toFixed(2)}</span>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="font-bold text-white">WhatsApp Cloud API & SMS Transacional</div>
              <div className="text-[10px] text-slate-400">Notificações automáticas de status de pedidos</div>
            </div>
          </div>
          <span className="font-mono font-bold text-red-400">R$ {infrastructureCosts.smsWhatsappApi.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};
