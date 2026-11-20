import React, { useEffect, useState } from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Terminal, X, Database } from 'lucide-react';
import { PILLAR_THEMES } from '@3c/design-system';
import { getPlatformAdapters } from '../../core/platform/PlatformAdapter';
import { apiClient } from '../../core/api/apiClient';
import { HqCompliancePanel } from './audit/HqCompliancePanel';
import { HqAuditEventsTable } from './audit/HqAuditEventsTable';
import { HqSentinelLogsPanel } from './audit/HqSentinelLogsPanel';

export const HqAuditTab: React.FC = () => {
  const { profile, getIdToken } = useAuth();
  const { eventLogs, governance, systemHealth, showNotification } = useEcosystem();
  const isDevOwner = profile?.role === 'DEV_OWNER';
  const isHqAdmin = isDevOwner || profile?.role === 'SUPER_ADMIN';
  const compliance = governance?.seniorAuditCompliance;

  const coreTheme = PILLAR_THEMES['server-core'];
  const hqTheme = PILLAR_THEMES.hq;

  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isLoadingBaseline, setIsLoadingBaseline] = useState(false);
  const [baselineModal, setBaselineModal] = useState<{ filename: string; content: string } | null>(null);
  const [logFilter, setLogFilter] = useState('');
  const [unifiedLogs, setUnifiedLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const loadUnifiedAuditLogs = async () => {
    if (!isHqAdmin) return;
    setIsLoadingLogs(true);
    try {
      const token = (await getIdToken()) || undefined;
      const res = await apiClient.listAdminAuditLogs({ limit: 150 }, token);
      if (Array.isArray(res?.logs)) {
        setUnifiedLogs(res.logs);
      }
    } catch {
      // fallback to subscribed eventLogs
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    void loadUnifiedAuditLogs();
  }, [isHqAdmin]);

  const effectiveLogs = unifiedLogs.length > 0 ? unifiedLogs : eventLogs;

  const filteredLogs = effectiveLogs.filter((log: any) => {
    if (!logFilter.trim()) return true;
    const term = logFilter.toLowerCase();
    return (
      String(log.type || '').toLowerCase().includes(term) ||
      String(log.payload || '').toLowerCase().includes(term) ||
      String(log.channel || '').toLowerCase().includes(term) ||
      String(log.tenantId || '').toLowerCase().includes(term) ||
      String(log.actorEmail || '').toLowerCase().includes(term) ||
      String(log.requestId || '').toLowerCase().includes(term)
    );
  });

  const handleExportSnapshot = async () => {
    setIsExportingBackup(true);
    try {
      const token = (await getIdToken()) || undefined;
      const snapshot = await apiClient.exportDatabaseBackup(token);
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      getPlatformAdapters().links.downloadTextFile(
        `3C_CORP_SNAPSHOT_${dateStr}.json`,
        JSON.stringify(snapshot, null, 2),
        'application/json;charset=utf-8'
      );
      showNotification('Snapshot JSON completo do Server Core exportado!');
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao exportar snapshot do banco.');
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleOpenBaseline = async () => {
    setIsLoadingBaseline(true);
    try {
      const token = (await getIdToken()) || undefined;
      const doc = await apiClient.getBaselineDoc(token);
      setBaselineModal(doc);
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao carregar baseline técnica.');
    } finally {
      setIsLoadingBaseline(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <HqCompliancePanel compliance={compliance} systemHealth={systemHealth} />

      <HqSentinelLogsPanel />

      <HqAuditEventsTable
        logs={filteredLogs}
        logFilter={logFilter}
        setLogFilter={setLogFilter}
        isLoadingLogs={isLoadingLogs}
        onRefresh={loadUnifiedAuditLogs}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 bg-cyan-500/10 rounded-lg ${coreTheme.accentTextClass} border ${coreTheme.accentBorderClass}`}>
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Snapshot & Backup Global</h3>
                <p className="text-[10px] text-slate-400">Exportação integral das tabelas do Server Core (exige DEV_OWNER).</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Gera um arquivo JSON estruturado via <span className="font-mono text-slate-300">/api/v1/admin/backup</span> contendo tenants, lojas, usuários, licenças e registros para contingência ou migração.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportSnapshot}
            disabled={isExportingBackup || !isDevOwner}
            title={!isDevOwner ? 'Backup integral disponível exclusivamente para DEV_OWNER na Central do Dev' : undefined}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Database className="w-4 h-4" />
            {!isDevOwner
              ? 'Exclusivo DEV_OWNER'
              : isExportingBackup
              ? 'Gerando Snapshot...'
              : 'Exportar Snapshot JSON'}
          </button>
        </div>

        <div className={`bg-slate-900 p-6 rounded-2xl border ${hqTheme.accentBorderClass} space-y-4 flex flex-col justify-between`}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 bg-indigo-500/10 rounded-lg ${hqTheme.accentTextClass} border ${hqTheme.accentBorderClass}`}>
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Baseline Arquitetural (v5.2.1)</h3>
                <p className="text-[10px] text-slate-400">Especificação técnica oficial do ecossistema 3C Corp.</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Contratos REST, regras de isolamento multitenant, protocolos de segurança (PBKDF2/HMAC) e arquitetura dos 4 pilares. Nota: exportação fiscal SPED e baixa FIFO operam agora exclusivamente no Store OS.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenBaseline}
            disabled={isLoadingBaseline}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            {isLoadingBaseline ? 'Carregando...' : 'Visualizar Baseline Técnica'}
          </button>
        </div>
      </div>

      {baselineModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 max-w-3xl w-full max-h-[85vh] rounded-2xl flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="text-xs font-black text-white uppercase tracking-wider font-mono">
                {baselineModal.filename}
              </div>
              <button
                type="button"
                onClick={() => setBaselineModal(null)}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-950 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="p-5 overflow-auto text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
              {baselineModal.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
