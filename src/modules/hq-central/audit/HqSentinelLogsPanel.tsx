import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, History, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import type { SentinelLogsResponse } from '@3c/api-client';
import { apiClient } from '../../../core/api/apiClient';
import { useAuth } from '../../../context/AuthContext';

export const HqSentinelLogsPanel: React.FC = () => {
  const { getIdToken } = useAuth();
  const [data, setData] = useState<SentinelLogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'deficiencies' | 'improvements' | 'history'>('deficiencies');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const token = (await getIdToken()) || undefined;
      const res = await apiClient.getSentinelLogs(token);
      setData(res);
    } catch {
      // silent graceful degradation if sentinel logs haven't been generated yet
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const openCount = data?.deficiencies?.counts?.open ?? 0;
  const advisoryCount = data?.deficiencies?.counts?.advisory ?? 0;
  const verifiedCount = data?.improvements?.counts?.verified ?? 0;
  const recommendedCount = data?.improvements?.counts?.recommended ?? 0;

  return (
    <section className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-tight">
              3C Sentinel — Logs de Deficiências &amp; Melhorias
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Registro vivo gerado por <code className="text-cyan-300">npm run sentinel</code> (scanners SCAN-01..20, 20 suítes, 5 personas e dívida técnica).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setView('deficiencies')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
              view === 'deficiencies'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Deficiências ({openCount + advisoryCount})
          </button>
          <button
            type="button"
            onClick={() => setView('improvements')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
              view === 'improvements'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Melhorias ({verifiedCount + recommendedCount})
          </button>
          <button
            type="button"
            onClick={() => setView('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border inline-flex items-center gap-1.5 ${
              view === 'history'
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Histórico ({data?.history?.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => void loadLogs()}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {!data?.available ? (
        <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 text-xs text-slate-400">
          Nenhum log do Sentinel encontrado ainda. Execute <code className="text-cyan-300">npm run sentinel</code> no servidor para gerar{' '}
          <code>.sentinel/deficiencies-log.json</code> e <code>.sentinel/improvements-log.json</code>.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
              <div className="text-slate-400">Status Última Execução</div>
              <div className={`text-sm font-black mt-1 ${data.summary?.overallStatus === 'PASS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {data.summary?.overallStatus || '--'} ({data.summary?.totalAssertionsPassed ?? 0} ✓)
              </div>
            </div>
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
              <div className="text-slate-400">Deficiências Abertas / Consultivas</div>
              <div className="text-sm font-black text-amber-300 mt-1 tabular-nums">
                {openCount} aberta(s) · {advisoryCount} consultiva(s)
              </div>
            </div>
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
              <div className="text-slate-400">Melhorias Verificadas</div>
              <div className="text-sm font-black text-emerald-300 mt-1 tabular-nums">{verifiedCount}</div>
            </div>
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
              <div className="text-slate-400">Backlog Recomendado</div>
              <div className="text-sm font-black text-cyan-300 mt-1 tabular-nums">{recommendedCount}</div>
            </div>
          </div>

          {view === 'deficiencies' && (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {data.deficiencies.entries.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-2"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <AlertTriangle
                        className={`w-3.5 h-3.5 shrink-0 ${
                          item.status === 'OPEN' ? 'text-rose-400' : 'text-amber-400'
                        }`}
                      />
                      <span className="text-xs font-mono font-bold text-white">{item.id}</span>
                      <span className="text-[11px] font-mono text-amber-300">{item.severity}</span>
                      <span className="text-[11px] font-mono text-slate-400">{item.category}</span>
                    </div>
                    <p className="text-xs text-slate-200">{item.summary}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">
                      Alvo: {item.target} · Ação: {item.recommendedAction}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'improvements' && (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {Array.isArray(data.improvements.personaExperiences) &&
                data.improvements.personaExperiences.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {data.improvements.personaExperiences.map((p) => (
                      <div
                        key={p.personaId}
                        className="rounded-xl bg-slate-950 border border-slate-800 p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white">{p.personaLabel}</span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                              p.status === 'ISOLATED_OK'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {p.productAppId} · {p.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">{p.authIsolation}</p>
                        <p className="text-[10px] text-slate-500 font-mono truncate">{p.verifiedBy}</p>
                      </div>
                    ))}
                  </div>
                )}
              {data.improvements.entries.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-1"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {item.status === 'VERIFIED' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-white">{item.title}</span>
                    <span className="text-[11px] font-mono text-slate-400">[{item.priority}]</span>
                  </div>
                  <p className="text-xs text-slate-300">{item.detail}</p>
                  <p className="text-[11px] text-slate-400 font-mono truncate">
                    Alvo: {item.target}
                    {item.verifiedBy ? ` · Validado por: ${item.verifiedBy}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}

          {view === 'history' && (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {data.history.map((h, idx) => (
                <div
                  key={`${h.executedAt}-${idx}`}
                  className="rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums"
                >
                  <span className={h.overallStatus === 'PASS' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {h.overallStatus}
                  </span>
                  <span className="text-slate-300">{new Date(h.executedAt).toLocaleString('pt-BR')}</span>
                  <span className="text-slate-400">
                    Scanners {h.scannerPassed}/{h.scannerTotal} · Suítes {h.suitesPassed}/{h.suitesTotal} · {h.assertionsPassed} ✓
                  </span>
                  <span className="text-amber-300">
                    Deficiências: {h.deficienciesOpenCount} / {h.deficienciesAdvisoryCount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};
