import React, { useEffect, useState } from 'react';
import { apiClient } from '../../core/api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useEcosystem } from '../../context/EcosystemContext';
import { getPlatformAdapters } from '../../core/platform/PlatformAdapter';
import { Database, RefreshCw } from 'lucide-react';
import { ServerEdgeNodesPanel } from './sync/ServerEdgeNodesPanel';
import { RestorePreviewSummary, ServerBackupPanel } from './sync/ServerBackupPanel';
import { ServerSyncConflictsPanel, SyncConflictItem } from './sync/ServerSyncConflictsPanel';

export const ServerSyncBackupTab: React.FC = () => {
  const { getIdToken } = useAuth();
  const { showNotification, syncHqData } = useEcosystem();

  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [edgeNodes, setEdgeNodes] = useState<any[]>([]);
  const [outboxItems, setOutboxItems] = useState<any[]>([]);
  const [stockLedger, setStockLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isExporting, setIsExporting] = useState(false);
  const [restoreJson, setRestoreJson] = useState('');
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<RestorePreviewSummary | null>(null);
  const [syncConflicts, setSyncConflicts] = useState<SyncConflictItem[]>([]);
  const [totalOpenConflicts, setTotalOpenConflicts] = useState<number>(0);
  const [conflictStatusFilter, setConflictStatusFilter] = useState<'OPEN' | 'RESOLVED' | 'DISCARDED' | 'ALL'>('OPEN');
  const [resolvingConflictId, setResolvingConflictId] = useState<string | null>(null);

  const loadConflicts = async (status: 'OPEN' | 'RESOLVED' | 'DISCARDED' | 'ALL', token?: string) => {
    const authTok = token || (await getIdToken()) || undefined;
    const res = await apiClient.getSyncConflicts(status, authTok).catch(() => ({ total: 0, totalOpen: 0, conflicts: [] }));
    setSyncConflicts(Array.isArray(res?.conflicts) ? res.conflicts : []);
    setTotalOpenConflicts(typeof res?.totalOpen === 'number' ? res.totalOpen : 0);
  };

  const loadTelemetry = async () => {
    setLoading(true);
    try {
      const token = (await getIdToken()) || undefined;
      const [statusRes, nodesRes, deltaRes, ledgerRes] = await Promise.all([
        apiClient.getSyncStatus(token).catch(() => null),
        apiClient.listEdgeNodes(undefined, token).catch(() => []),
        apiClient.pullSyncDelta({ limit: 25 }, token).catch(() => ({ entries: [] })),
        apiClient.getStockLedger(undefined, token).catch(() => []),
        loadConflicts(conflictStatusFilter, token),
      ]);
      setSyncStatus(statusRes);
      setEdgeNodes(
        Array.isArray(nodesRes)
          ? nodesRes
          : Array.isArray((nodesRes as any)?.nodes)
          ? (nodesRes as any).nodes
          : []
      );
      setOutboxItems(
        Array.isArray((deltaRes as any)?.entries)
          ? (deltaRes as any).entries
          : Array.isArray((deltaRes as any)?.items)
          ? (deltaRes as any).items
          : []
      );
      setStockLedger(
        Array.isArray(ledgerRes)
          ? ledgerRes
          : Array.isArray((ledgerRes as any)?.entries)
          ? (ledgerRes as any).entries
          : []
      );
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao carregar telemetria de Sync & Persistence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTelemetry();
  }, []);

  const handleChangeConflictFilter = async (nextStatus: 'OPEN' | 'RESOLVED' | 'DISCARDED' | 'ALL') => {
    setConflictStatusFilter(nextStatus);
    await loadConflicts(nextStatus);
  };

  const handleResolveConflict = async (id: string, action: 'RESOLVED' | 'DISCARDED') => {
    setResolvingConflictId(id);
    try {
      const token = (await getIdToken()) || undefined;
      await apiClient.resolveSyncConflict(id, { action }, token);
      showNotification(`Conflito ${id} marcado como ${action}.`);
      await loadConflicts(conflictStatusFilter, token);
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao atualizar conflito Edge.');
    } finally {
      setResolvingConflictId(null);
    }
  };

  const handleDownloadBackup = async () => {
    setIsExporting(true);
    try {
      const token = (await getIdToken()) || undefined;
      const snapshot = await apiClient.exportDatabaseBackup(token);
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      getPlatformAdapters().links.downloadTextFile(
        `3C_SERVER_CORE_BACKUP_${dateStr}.json`,
        JSON.stringify(snapshot, null, 2),
        'application/json;charset=utf-8'
      );
      showNotification('Backup JSON exportado do Server Core!');
    } catch (e: any) {
      showNotification(e?.message || 'Falha ao exportar backup.');
    } finally {
      setIsExporting(false);
    }
  };

  const parseSnapshotInput = () => {
    const parsed = JSON.parse(restoreJson);
    const tables = parsed?.tables && typeof parsed.tables === 'object' ? parsed.tables : parsed;
    if (!tables || typeof tables !== 'object' || Array.isArray(tables)) {
      throw new Error('JSON inválido: informe um snapshot com campo "tables".');
    }
    return { parsed, tables };
  };

  const handlePreviewRestore = async () => {
    setIsPreviewing(true);
    try {
      const { parsed, tables } = parseSnapshotInput();
      const token = (await getIdToken()) || undefined;
      const preview = await apiClient.previewRestoreSnapshot(tables, token, {
        schemaVersion: parsed?.schemaVersion,
        version: parsed?.version,
        checksum: parsed?.checksum,
      });
      setPreviewResult(preview);
      showNotification(preview.valid ? 'Dry-Run concluído: snapshot válido.' : 'Dry-Run detectou bloqueios no snapshot.');
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao simular Dry-Run de restore.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleRestoreSnapshot = async () => {
    if (!confirmRestore) {
      showNotification('Marque a confirmação de segurança antes de restaurar.');
      return;
    }
    setIsRestoring(true);
    try {
      const { parsed, tables } = parseSnapshotInput();
      const token = (await getIdToken()) || undefined;
      const res = await apiClient.restoreDatabaseBackup(tables, token, {
        schemaVersion: parsed?.schemaVersion,
        version: parsed?.version,
        checksum: parsed?.checksum,
      });
      showNotification(`Snapshot restaurado: ${res.restoredDocs} documento(s) gravados.`);
      setConfirmRestore(false);
      setRestoreJson('');
      setPreviewResult(null);
      await Promise.all([loadTelemetry(), syncHqData()]);
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao restaurar snapshot.');
    } finally {
      setIsRestoring(false);
    }
  };

  const driverInfo =
    syncStatus?.driver && typeof syncStatus.driver === 'object' ? syncStatus.driver : null;
  const driverKind =
    driverInfo?.kind || (typeof syncStatus?.driver === 'string' ? syncStatus.driver : 'json-memory');
  const caps = driverInfo || syncStatus?.capabilities || {};

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
                Persistence Driver, Edge Sync & Backup
              </h2>
              <p className="text-xs text-slate-400">
                Estado real de armazenamento, relógio HLC, nós Edge LAN, outbox e estoque imutável.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadTelemetry}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar Dados
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono tabular-nums text-xs">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase">Driver Persistência</span>
            <div className="text-sm font-black text-amber-400">{driverKind}</div>
            <div className="text-[10px] text-slate-400">
              WAL: {caps.walMode ? 'Habilitado' : 'In-Memory'} • Cloud: {caps.cloudMultiRegionReady ? 'Sim' : 'Local'}
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase">Server HLC Clock</span>
            <div className="text-xs font-bold text-emerald-400 truncate">{syncStatus?.serverHlc || '--'}</div>
            <div className="text-[10px] text-slate-400">
              Outbox: {syncStatus?.outboxCount !== undefined || caps.acidTransactions ? 'Ativo' : 'Standby'}
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase">Edge Nodes Registrados</span>
            <div className="text-lg font-black text-white">{edgeNodes.length}</div>
            <div className="text-[10px] text-slate-400">Reconciliação LAN/WAN</div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase">Stock Ledger / Outbox</span>
            <div className="text-lg font-black text-cyan-400">{stockLedger.length} / {outboxItems.length}</div>
            <div className="text-[10px] text-slate-400">Movimentos auditáveis</div>
          </div>
        </div>
      </div>

      <ServerEdgeNodesPanel edgeNodes={edgeNodes} outboxItems={outboxItems} />

      <ServerSyncConflictsPanel
        conflicts={syncConflicts}
        totalOpen={totalOpenConflicts}
        statusFilter={conflictStatusFilter}
        onChangeStatusFilter={handleChangeConflictFilter}
        resolvingId={resolvingConflictId}
        onResolveConflict={handleResolveConflict}
      />

      <ServerBackupPanel
        isExporting={isExporting}
        onDownloadBackup={handleDownloadBackup}
        restoreJson={restoreJson}
        setRestoreJson={(v) => {
          setRestoreJson(v);
          setPreviewResult(null);
        }}
        confirmRestore={confirmRestore}
        setConfirmRestore={setConfirmRestore}
        isRestoring={isRestoring}
        isPreviewing={isPreviewing}
        previewResult={previewResult}
        onPreviewRestore={handlePreviewRestore}
        onRestoreSnapshot={handleRestoreSnapshot}
      />
    </div>
  );
};
