import React, { useEffect, useState } from 'react';
import { apiClient } from '../../core/api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useEcosystem } from '../../context/EcosystemContext';
import { getPlatformAdapters } from '../../core/platform/PlatformAdapter';
import { CheckCircle2, Database, Download, RefreshCw, ShieldAlert } from 'lucide-react';

interface IntegrityAuditReport {
  checkedAt: string;
  totalAnomalies: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  collectionCounts: Record<string, number>;
  anomalies: {
    id: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    collection: string;
    recordId: string;
    code: string;
    message: string;
  }[];
}

export const ServerIntegrityTab: React.FC = () => {
  const { getIdToken } = useAuth();
  const { showNotification } = useEcosystem();
  const [report, setReport] = useState<IntegrityAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');
  const [collectionFilter, setCollectionFilter] = useState<string>('ALL');

  const runAudit = async () => {
    setLoading(true);
    try {
      const token = (await getIdToken()) || undefined;
      const res = await apiClient.runIntegrityAudit(token);
      setReport(res);
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao executar auditoria de integridade.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runAudit();
  }, []);

  const handleExportReport = () => {
    if (!report) return;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    getPlatformAdapters().links.downloadTextFile(
      `3C_INTEGRITY_AUDIT_${dateStr}.json`,
      JSON.stringify(report, null, 2),
      'application/json;charset=utf-8'
    );
    showNotification('Relatório de integridade exportado!');
  };

  const filteredAnomalies = (report?.anomalies || []).filter((a) => {
    if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
    if (collectionFilter !== 'ALL' && a.collection !== collectionFilter) return false;
    return true;
  });

  const collectionNames = Object.keys(report?.collectionCounts || {});

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-tight">
                Auditoria de Integridade & Referências do Banco
              </h2>
              <p className="text-xs text-slate-400">
                Varredura determinística de referências órfãs, hashes ausentes, estoque negativo e nós estagnados.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportReport}
              disabled={!report}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 cursor-pointer disabled:opacity-40 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar JSON
            </button>
            <button
              type="button"
              onClick={runAudit}
              disabled={loading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Auditando...' : 'Executar Varredura'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono tabular-nums text-xs">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400">Total de Anomalias</span>
            <div className="text-xl font-black text-white">{report?.totalAnomalies ?? '--'}</div>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400">Críticas</span>
            <div className={`text-xl font-black ${(report?.criticalCount || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {report?.criticalCount ?? '--'}
            </div>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400">Avisos</span>
            <div className={`text-xl font-black ${(report?.warningCount || 0) > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
              {report?.warningCount ?? '--'}
            </div>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[11px] text-slate-400">Informativos</span>
            <div className="text-xl font-black text-cyan-400">{report?.infoCount ?? '--'}</div>
          </div>
        </div>

        {/* Collection Counts Grid */}
        {collectionNames.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-bold text-slate-400">Registros Ativos por Coleção</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 font-mono tabular-nums text-xs">
              {collectionNames.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setCollectionFilter((prev) => (prev === col ? 'ALL' : col))}
                  className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    collectionFilter === col
                      ? 'bg-amber-500/10 border-amber-500/60 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-[10px] text-slate-400 truncate">{col}</div>
                  <div className="text-sm font-bold text-white mt-0.5">{report?.collectionCounts[col]}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Anomalies Table */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Ocorrências Detectadas ({filteredAnomalies.length})</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {(['ALL', 'CRITICAL', 'WARNING', 'INFO'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  severityFilter === sev
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sev === 'ALL' ? 'Todos' : sev}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="px-3 py-2.5">Severidade</th>
                <th className="px-3 py-2.5">Coleção</th>
                <th className="px-3 py-2.5">Código</th>
                <th className="px-3 py-2.5">Registro ID</th>
                <th className="px-3 py-2.5">Diagnóstico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredAnomalies.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/30">
                  <td className="px-3 py-2.5 font-mono font-bold whitespace-nowrap">
                    <span
                      className={
                        item.severity === 'CRITICAL'
                          ? 'text-rose-400'
                          : item.severity === 'WARNING'
                          ? 'text-amber-400'
                          : 'text-cyan-400'
                      }
                    >
                      {item.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-300 whitespace-nowrap">{item.collection}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-400 whitespace-nowrap">{item.code}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-200 whitespace-nowrap">{item.recordId}</td>
                  <td className="px-3 py-2.5 text-slate-300">{item.message}</td>
                </tr>
              ))}
              {!loading && filteredAnomalies.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-emerald-400 font-medium">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Nenhuma inconsistência encontrada para o filtro selecionado.
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
