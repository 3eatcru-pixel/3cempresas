import React, { useEffect, useState, useMemo } from 'react';
import {
  Activity,
  CheckCircle2,
  Cloud,
  HardDrive,
  RefreshCw,
  Server,
  Unlink,
  Wifi,
  WifiOff,
  Monitor,
  AlertTriangle,
} from 'lucide-react';
import { Store } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { useEcosystem } from '../../../context/EcosystemContext';
import { useSyncStatus } from '../../../hooks/useSyncStatus';
import { syncEngine } from '../../../core/sync/SyncEngine';
import { apiClient } from '../../../core/api/apiClient';
import { detectLocalTerminalInfo } from '../../../core/platform/PlatformAdapter';
import { TRANSPORT_COLORS, SURFACE_TOKENS } from '@3c/design-system';
import { EdgeQrPairingCard } from './edge/EdgeQrPairingCard';
import { EdgeConflictsPanel } from './edge/EdgeConflictsPanel';

interface SettingsEdgeSyncTabProps {
  currentStore: Store;
}

interface LanProbeResult {
  ok: boolean;
  latencyMs: number;
  message: string;
  checkedAt: string;
}

export const SettingsEdgeSyncTab: React.FC<SettingsEdgeSyncTabProps> = ({ currentStore }) => {
  const { getIdToken } = useAuth();
  const { showNotification } = useEcosystem();
  const syncStatus = useSyncStatus();
  const surface = SURFACE_TOKENS.dark;
  const transportToken = TRANSPORT_COLORS[syncStatus.activeTransport] || TRANSPORT_COLORS.CLOUD;

  const localTerminal = useMemo(
    () =>
      detectLocalTerminalInfo({
        activeTransport: syncStatus.activeTransport,
        edgeBaseUrl: syncStatus.pairedEdge?.edgeBaseUrl,
      }),
    [syncStatus.activeTransport, syncStatus.pairedEdge?.edgeBaseUrl]
  );

  const [edgeUrlInput, setEdgeUrlInput] = useState(
    syncStatus.pairedEdge?.edgeBaseUrl || 'http://127.0.0.1:3300'
  );
  const [hostnameInput, setHostnameInput] = useState(
    syncStatus.pairedEdge?.hostname || `edge-${currentStore.id}`
  );
  const [preferLan, setPreferLan] = useState(Boolean(syncStatus.pairedEdge?.preferLan));
  const [registeredNodes, setRegisteredNodes] = useState<any[]>([]);
  const [isPairing, setIsPairing] = useState(false);
  const [isProbingLan, setIsProbingLan] = useState(false);
  const [lanProbe, setLanProbe] = useState<LanProbeResult | null>(null);

  const loadEdgeNodes = async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const list = await apiClient.listEdgeNodes(currentStore.id, token);
      if (Array.isArray(list)) {
        setRegisteredNodes(list);
      }
    } catch {
      // ignore if offline
    }
  };

  useEffect(() => {
    void loadEdgeNodes();
  }, [currentStore.id]);

  const handleProbeEdgeLan = async () => {
    const cleanBase = edgeUrlInput.trim().replace(/\/+$/, '');
    if (!cleanBase) {
      showNotification('Informe o endereço do Edge Node antes de testar.');
      return;
    }
    setIsProbingLan(true);
    const started = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`${cleanBase}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      const latencyMs = Math.max(1, Math.round(performance.now() - started));
      const payload = await res.json().catch(() => null);
      if (res.ok) {
        const versionInfo = payload?.version ? ` • v${payload.version}` : '';
        const modeInfo = payload?.status ? ` (${payload.status})` : '';
        setLanProbe({
          ok: true,
          latencyMs,
          message: `Edge LAN acessível em ${latencyMs}ms${modeInfo}${versionInfo}`,
          checkedAt: new Date().toLocaleTimeString('pt-BR'),
        });
      } else {
        setLanProbe({
          ok: false,
          latencyMs,
          message: `Endpoint respondeu HTTP ${res.status} (${latencyMs}ms)`,
          checkedAt: new Date().toLocaleTimeString('pt-BR'),
        });
      }
    } catch (err: any) {
      const latencyMs = Math.max(1, Math.round(performance.now() - started));
      const isAbort = err?.name === 'AbortError';
      setLanProbe({
        ok: false,
        latencyMs,
        message: isAbort
          ? 'Timeout (4s): Edge Node não respondeu neste IP/porta.'
          : 'Inacessível na rede local (verifique se o 3C Edge Node está em execução).',
        checkedAt: new Date().toLocaleTimeString('pt-BR'),
      });
    } finally {
      clearTimeout(timer);
      setIsProbingLan(false);
    }
  };

  const handlePairEdge = async () => {
    setIsPairing(true);
    try {
      const token = await getIdToken();
      const parsed = new URL(edgeUrlInput.trim());
      const paired = await syncEngine.pairEdgeNode(
        {
          storeId: currentStore.id,
          storeName: currentStore.name,
          edgeBaseUrl: edgeUrlInput.trim(),
          hostname: hostnameInput.trim() || `edge-${currentStore.id}`,
          lanIp: parsed.hostname,
          port: Number(parsed.port) || 3300,
          preferLan,
        },
        token || undefined
      );
      showNotification(`3C Edge Node pareado (${paired.nodeId}) em ${paired.edgeBaseUrl}!`);
      await loadEdgeNodes();
    } catch (err: any) {
      showNotification(err?.message || 'Não foi possível parear o 3C Edge Node.');
    } finally {
      setIsPairing(false);
    }
  };

  const handleUnpairEdge = () => {
    syncEngine.unpairEdgeNode();
    setLanProbe(null);
    showNotification('Terminal desconectado do Edge Node local (modo Cloud ativo).');
  };

  const handleManualFlush = async () => {
    const token = await getIdToken();
    const res = await syncEngine.flushAll({ token: token || undefined, storeId: currentStore.id });
    showNotification(
      `Sincronização concluída: ${res.syncedOrders} pedidos e ${res.syncedMutations} mutações enviados.`
    );
  };

  const qrPayload = JSON.stringify({
    type: '3C_EDGE_PAIR',
    storeId: currentStore.id,
    storeName: currentStore.name,
    edgeNodeId: syncStatus.pairedEdge?.nodeId || null,
    edgeBaseUrl: syncStatus.pairedEdge?.edgeBaseUrl || edgeUrlInput,
  });

  return (
    <div className={`${surface.elevatedBg} p-5 rounded-2xl border ${surface.border} space-y-5`}>
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${surface.border} pb-3`}>
        <div className="flex items-center gap-2.5">
          <Server className="w-4 h-4 text-emerald-400" />
          <div>
            <h4 className="font-bold text-sm text-white">
              3C Edge Node Padrão &amp; Sincronização Offline (RFC-001)
            </h4>
            <p className="text-[11px] text-slate-400">
              Operação contínua em rede local (SQLite WAL + HLC outbox). Requer Edge Node em execução na LAN ou empacotamento desktop configurado.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {localTerminal.isLocalTerminal && (
            <span
              title={localTerminal.detailLabel}
              className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase flex items-center gap-1.5 border bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
            >
              <Monitor className="w-3 h-3 text-cyan-400" />
              {localTerminal.label}
            </span>
          )}
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase flex items-center gap-1.5 ${transportToken.badgeClass}`}>
            {syncStatus.activeTransport === 'EDGE_LAN' ? (
              <>
                <Wifi className="w-3 h-3" /> EDGE LAN ATIVO
              </>
            ) : syncStatus.activeTransport === 'OFFLINE' ? (
              <>
                <WifiOff className="w-3 h-3" /> MODO OFFLINE
              </>
            ) : (
              <>
                <Cloud className="w-3 h-3" /> 3C CLOUD CORE
              </>
            )}
          </span>

          <button
            type="button"
            onClick={handleManualFlush}
            disabled={syncStatus.isSyncing}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
            Sincronizar (<span className="font-mono tabular-nums">{syncStatus.totalPendingCount}</span>)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form Pareamento LAN */}
        <div className="lg:col-span-2 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">
                Endpoint LAN do 3C Edge Node
              </label>
              <input
                type="url"
                value={edgeUrlInput}
                onChange={(e) => setEdgeUrlInput(e.target.value)}
                placeholder="http://192.168.1.50:3300"
                className={`w-full ${surface.canvasBg} border border-slate-700 text-xs px-3 py-2 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-400`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">
                Identificação do Host / Balcão
              </label>
              <input
                type="text"
                value={hostnameInput}
                onChange={(e) => setHostnameInput(e.target.value)}
                placeholder="edge-balcao-principal"
                className={`w-full ${surface.canvasBg} border border-slate-700 text-xs px-3 py-2 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-400`}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={preferLan}
              onChange={(e) => setPreferLan(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-emerald-500"
            />
            <span>Priorizar roteamento pela LAN local do Edge Node mesmo quando houver internet</span>
          </label>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handlePairEdge}
              disabled={isPairing}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {syncStatus.pairedEdge ? 'Atualizar Pareamento Edge' : 'Parear 3C Edge Node'}
            </button>

            <button
              type="button"
              onClick={() => void handleProbeEdgeLan()}
              disabled={isProbingLan}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-300 border border-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Activity className={`w-3.5 h-3.5 ${isProbingLan ? 'animate-spin' : ''}`} />
              {isProbingLan ? 'Testando LAN...' : 'Testar Conexão LAN'}
            </button>

            {syncStatus.pairedEdge && (
              <button
                type="button"
                onClick={handleUnpairEdge}
                className="px-3.5 py-2 bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Unlink className="w-3.5 h-3.5" /> Desparear LAN
              </button>
            )}
          </div>

          {lanProbe && (
            <div
              className={`px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                lanProbe.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <span className="flex items-center gap-2 font-medium">
                {lanProbe.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                {lanProbe.message}
              </span>
              <span className="font-mono tabular-nums text-[10px] opacity-80 shrink-0">
                {lanProbe.checkedAt}
              </span>
            </div>
          )}

          {/* Telemetria de Fila & Nós Pareados */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
            <div className={`${surface.canvasBg} p-3 rounded-xl border ${surface.border}`}>
              <div className="text-[10px] text-slate-500 uppercase font-mono">Fila Offline</div>
              <div className="text-sm font-black text-white font-mono tabular-nums">
                {syncStatus.totalPendingCount} itens
              </div>
            </div>
            <div className={`${surface.canvasBg} p-3 rounded-xl border ${surface.border}`}>
              <div className="text-[10px] text-slate-500 uppercase font-mono">Último HLC</div>
              <div className="text-[11px] font-bold text-emerald-400 font-mono truncate">
                {syncStatus.lastHlc || 'Aguardando sync'}
              </div>
            </div>
            <div className={`${surface.canvasBg} p-3 rounded-xl border ${surface.border} col-span-2 sm:col-span-1`}>
              <div className="text-[10px] text-slate-500 uppercase font-mono">Nós Edge Loja</div>
              <div className="text-sm font-black text-cyan-400 font-mono tabular-nums">
                {registeredNodes.length} registrado(s)
              </div>
            </div>
          </div>

          {registeredNodes.length > 0 && (
            <div className={`${surface.canvasBg} border ${surface.border} rounded-xl p-3 space-y-1.5`}>
              <div className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                <HardDrive className="w-3 h-3 text-emerald-400" /> Nós Edge Registrados para {currentStore.name}
              </div>
              {registeredNodes.slice(0, 3).map((node) => (
                <div
                  key={node.id}
                  className="flex items-center justify-between text-[11px] font-mono text-slate-300 border-t border-slate-900 pt-1.5"
                >
                  <span className="truncate">
                    {node.hostname} ({node.id})
                  </span>
                  <span className="text-emerald-400">
                    {node.lanIp ? `${node.lanIp}:${node.port}` : node.platform}
                  </span>
                </div>
              ))}
            </div>
          )}

          <EdgeConflictsPanel
            conflictsCount={syncStatus.conflictsCount}
            conflicts={syncStatus.conflicts}
            onClearAll={() => syncEngine.clearConflicts()}
            onDismiss={(id) => syncEngine.dismissConflict(id)}
          />
        </div>

        {/* QR Code Pareamento Waiter / Tablet */}
        <EdgeQrPairingCard payload={qrPayload} />
      </div>
    </div>
  );
};
