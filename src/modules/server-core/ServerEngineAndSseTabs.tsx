import React, { useState } from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { Cpu, Radio, Database, Shield, RefreshCw, Trash2, Search } from 'lucide-react';

export const ServerEngineTab: React.FC = () => {
  const { triggerBillingReconciliation } = useEcosystem();

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Cpu className="w-6 h-6 text-amber-400" />
            <div>
              <h2 className="text-base font-black text-white uppercase italic tracking-wider">CommerceEngine Transaction Kernel</h2>
              <p className="text-xs text-slate-400">Processamento atômico de pedidos, baixa de estoque e liquidação transacional</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            Pipeline Commerce Engine v5.2.1
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="text-slate-400 font-bold uppercase">Validador de Esquema Payload</div>
            <div className="text-emerald-400 font-extrabold text-sm">✓ Ativo (Strict Types &amp; Limits)</div>
            <p className="text-[10px] text-slate-500 font-sans">Valida integridade do pedido antes do commit transacional no Server Core Persistence (WAL + ACID).</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="text-slate-400 font-bold uppercase">Baixa Atômica de Estoque (BOM)</div>
            <div className="text-emerald-400 font-extrabold text-sm">✓ Ativo (Batch Commit)</div>
            <p className="text-[10px] text-slate-500 font-sans">Abstrai baixas de insumos no Ledger sem gerar inconsistências entre caixa e estoque.</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="text-slate-400 font-bold uppercase">Auditoria de Transação SHA256</div>
            <div className="text-amber-400 font-extrabold text-sm">✓ Ativo (Hash Cryptographic)</div>
            <p className="text-[10px] text-slate-500 font-sans">Assinatura digital de audit log para prevenção de adulteração de histórico.</p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800">
          <div className="bg-gradient-to-r from-blue-900/20 to-slate-950 p-5 rounded-2xl border border-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" /> Background Task: SaaS Billing Engine
              </div>
              <p className="text-xs text-slate-300">
                Reconcilia faturas pendentes, aplica inadimplência após janela de carência e sincroniza cobranças SaaS no Server Core.
              </p>
            </div>
            <button
              onClick={() => triggerBillingReconciliation()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Forçar Reconciliação SaaS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ServerSseTabProps {
  sseLiveEvents: { id: string; time: string; type: string; payload: string }[];
  onClearEvents?: () => void;
}

export const ServerSseTab: React.FC<ServerSseTabProps> = ({ sseLiveEvents, onClearEvents }) => {
  const [typeFilter, setTypeFilter] = useState('');

  const filteredEvents = sseLiveEvents.filter(evt => {
    const q = typeFilter.trim().toLowerCase();
    if (!q) return true;
    return evt.type.toLowerCase().includes(q) || evt.payload.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Radio className="w-6 h-6 text-emerald-400" />
            <div>
              <h2 className="text-base font-black text-white uppercase italic tracking-wider">Stream Realtime SSE (Server-Sent Events)</h2>
              <p className="text-xs text-slate-400">Canal direto de atualização de eventos transacionais por tenant (`/api/v1/sse/stream`)</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono tabular-nums font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Stream Ativo ({filteredEvents.length}/{sseLiveEvents.length} eventos)
            </span>
            {onClearEvents && sseLiveEvents.length > 0 && (
              <button
                type="button"
                onClick={onClearEvents}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Limpar Buffer
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            placeholder="Filtrar eventos SSE por tipo ou payload (ex: ORDER, SYNC, HEALTH)..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="bg-[#05080e] p-4 rounded-2xl border border-slate-800 font-mono text-xs max-h-96 overflow-y-auto space-y-2">
          {filteredEvents.map(evt => (
            <div key={evt.id} className="p-3 bg-slate-950 rounded-xl border border-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-slate-500 text-[11px] tabular-nums">{evt.time}</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20 text-[10px]">
                  {evt.type}
                </span>
              </div>
              <span className="text-slate-300 truncate max-w-lg text-[11px]">{evt.payload}</span>
            </div>
          ))}

          {filteredEvents.length === 0 && (
            <div className="text-center py-12 text-slate-500 italic">
              {sseLiveEvents.length === 0
                ? 'Conectado ao canal SSE. Aguardando transmissão de novos eventos transacionais do cluster...'
                : 'Nenhum evento corresponde ao filtro informado.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const ServerInfraTab: React.FC = () => {
  return (
    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-6 shadow-xl animate-fadeIn">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-amber-400" />
          <div>
            <h2 className="text-base font-black text-white uppercase italic tracking-wider">Drivers de Persistência Server Core</h2>
            <p className="text-xs text-slate-400">Camada de abstração desacoplada (`StorageAdapter` &amp; `PersistenceDriver`)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="text-amber-400 font-bold uppercase text-sm">SqliteWalDriver</div>
          <p className="text-slate-400 text-xs font-sans leading-relaxed">
            Persistência transacional em arquivo local com Write-Ahead Logging (WAL) e commits ACID em nó único ou Edge LAN.
          </p>
          <div className="pt-2 text-emerald-400 font-bold">✓ Zero Dependência Externa</div>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="text-emerald-400 font-bold uppercase text-sm">LocalStorageAdapter</div>
          <p className="text-slate-400 text-xs font-sans leading-relaxed">
            Cache e outbox 100% offline-first no terminal do PDV para vendas contínuas mesmo durante queda de internet.
          </p>
          <div className="pt-2 text-emerald-400 font-bold">✓ Contingência Edge</div>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="text-blue-400 font-bold uppercase text-sm">PostgresStorageDriver</div>
          <p className="text-slate-400 text-xs font-sans leading-relaxed">
            Backend relacional distribuído para alta concorrência multi-região via `DATABASE_URL` no Server Core.
          </p>
          <div className="pt-2 text-blue-400 font-bold">✓ Escala Multi-Nó</div>
        </div>
      </div>
    </div>
  );
};
