import React, { useState, useEffect, useMemo } from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { Server } from 'lucide-react';
import { PILLAR_THEMES } from '@3c/design-system';
import { PillarEntrance } from '../common/PillarEntrance';
import { apiClient } from '../../core/api/apiClient';
import { buildSseStreamUrl } from '../../core/platform/PlatformAdapter';

// Submodules
import { ServerHealthTab } from '../../modules/server-core/ServerHealthTab';
import { ServerConsoleTab, HttpMethodOption } from '../../modules/server-core/ServerConsoleTab';
import { ServerReleasesTab } from '../../modules/server-core/ServerReleasesTab';
import { ServerSyncBackupTab } from '../../modules/server-core/ServerSyncBackupTab';
import { ServerEngineTab, ServerSseTab } from '../../modules/server-core/ServerEngineAndSseTabs';
import { ServerGpsTelemetryTab } from '../../modules/server-core/ServerGpsTelemetryTab';
import { ServerIntegrityTab } from '../../modules/server-core/ServerIntegrityTab';
import { ServerCityMapsDataTab } from '../../modules/server-core/ServerCityMapsDataTab';

// Layout & Constants
import { ServerHeaderBanner } from '../../modules/server-core/layout/ServerHeaderBanner';
import { ServerSubNav, ServerCoreTabId } from '../../modules/server-core/layout/ServerSubNav';
import { DEFAULT_SERVER_PAYLOADS, DEV_CONSOLE_ENDPOINTS } from '../../modules/server-core/layout/serverPayloads';

function formatUptimeSeconds(totalSeconds?: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds || 0));
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const rem = sec % 60;
  return [days, hours, mins, rem].map(v => String(v).padStart(2, '0')).join(':');
}

interface ServerCorePillarProps {
  embedded?: boolean;
}

export const ServerCorePillar: React.FC<ServerCorePillarProps> = ({ embedded = false }) => {
  const { profile, getIdToken } = useAuth();
  const { restEndpoints, showNotification, systemHealth, stores } = useEcosystem();

  const isAuthorized = profile?.role === 'DEV_OWNER';

  const mergedEndpoints = useMemo(() => {
    const seen = new Set<string>();
    const combined = [...DEV_CONSOLE_ENDPOINTS, ...restEndpoints];
    return combined.filter(ep => {
      const key = `${ep.method}:${ep.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [restEndpoints]);

  const [activeTab, setActiveTab] = useState<ServerCoreTabId>('health');
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('/api/v1/health');
  const [selectedMethod, setSelectedMethod] = useState<HttpMethodOption>('GET');
  const [simulatedPayload, setSimulatedPayload] = useState<string>(DEFAULT_SERVER_PAYLOADS['/api/v1/health'] || '{}');

  const [executionResponse, setExecutionResponse] = useState<any>(null);
  const [executionStatus, setExecutionStatus] = useState<string>('AGUARDANDO');
  const [executionLatency, setExecutionLatency] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasAuthToken, setHasAuthToken] = useState<boolean>(false);

  const [sseLiveEvents, setSseLiveEvents] = useState<{ id: string; time: string; type: string; payload: string }[]>([]);

  const handleSelectEndpoint = (path: string, method?: HttpMethodOption) => {
    setSelectedEndpoint(path);
    if (method) {
      setSelectedMethod(method);
    } else {
      const matched = mergedEndpoints.find(e => e.path === path);
      if (matched) setSelectedMethod(matched.method as HttpMethodOption);
    }
    if (DEFAULT_SERVER_PAYLOADS[path]) {
      setSimulatedPayload(DEFAULT_SERVER_PAYLOADS[path]);
    }
  };

  useEffect(() => {
    if (!isAuthorized) return;

    let sse: EventSource | null = null;
    let cancelled = false;
    const connect = async () => {
      try {
        const token = await getIdToken();
        setHasAuthToken(Boolean(token));
        let sseUrl: string;
        if (token) {
          const ticketRes = await apiClient.createSseTicket(token).catch(() => null);
          if (cancelled) return;
          sseUrl = ticketRes?.ticket
            ? buildSseStreamUrl({ ticket: ticketRes.ticket })
            : buildSseStreamUrl();
        } else {
          sseUrl = buildSseStreamUrl();
        }
        if (cancelled) return;
        sse = new EventSource(sseUrl);
        sse.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setSseLiveEvents(prev => [
              {
                id: `sse-${Date.now()}-${Math.random()}`,
                time: new Date().toLocaleTimeString('pt-BR'),
                type: data.type || 'STREAM',
                payload: JSON.stringify(data)
              },
              ...prev.slice(0, 49)
            ]);
          } catch {
            // ignore parsing error
          }
        };
      } catch {
        // ignore
      }
    };
    connect();
    return () => {
      cancelled = true;
      if (sse) sse.close();
    };
  }, [isAuthorized, getIdToken]);

  if (!isAuthorized) {
    return (
      <PillarEntrance
        title="Central do Dev • Server Core"
        subtitle="Infraestrutura e Kernel Transacional. Monitore o barramento de eventos, gerencie releases, backup/sync e execute testes de API."
        icon={<Server className="w-8 h-8" />}
        requiredRole="DEV_OWNER"
        pillarId="server-core"
        colorClass={PILLAR_THEMES['server-core'].accentTextClass}
        features={[
          'Console REST API v5.2.1 com cURL e JWT real',
          'Release Manager & Contratos de Domínio',
          'Sync Outbox, Nós Edge LAN e Backup/Restore JSON',
          'Stream de Eventos SSE em Tempo Real',
          'Kernel Transacional & Telemetria GPS da Frota'
        ]}
      />
    );
  }

  const handleExecuteApiCall = async () => {
    setIsLoading(true);
    const start = performance.now();

    try {
      const token = await getIdToken();
      setHasAuthToken(Boolean(token));
      const result = await apiClient.executeEndpoint(selectedEndpoint, {
        method: selectedMethod,
        token,
        appId: 'hq',
        rawBody: selectedMethod === 'GET' || selectedMethod === 'DELETE' ? undefined : simulatedPayload,
      });

      const elapsed = Math.round(performance.now() - start);
      setExecutionLatency(elapsed);
      setExecutionStatus(`HTTP/1.1 ${result.status} ${result.statusText}`);
      setExecutionResponse(result.data);
      setActiveTab('console');
      showNotification(`[HTTP ${result.status}] Resposta recebida em ${elapsed}ms!`);
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      setExecutionLatency(elapsed);
      setExecutionStatus('HTTP/1.1 500 Connection Error');
      setExecutionResponse({ error: err.message || 'Falha ao conectar no endpoint' });
      showNotification(`Erro ao executar chamada: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const uptimeFormatted = formatUptimeSeconds(systemHealth?.uptimeSeconds);

  return (
    <div className={embedded ? 'space-y-6' : 'max-w-7xl mx-auto px-4 py-6 space-y-6 animate-fadeIn'}>
      <ServerHeaderBanner
        uptime={uptimeFormatted}
        persistenceDriver={systemHealth?.persistenceDriver}
        status={systemHealth?.status}
        isLoading={isLoading}
        onExecute={handleExecuteApiCall}
      />

      <ServerSubNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {activeTab === 'health' && <ServerHealthTab />}
      {activeTab === 'console' && (
        <ServerConsoleTab
          restEndpoints={mergedEndpoints}
          selectedEndpoint={selectedEndpoint}
          selectedMethod={selectedMethod}
          onSelectEndpoint={handleSelectEndpoint}
          onChangePath={setSelectedEndpoint}
          onChangeMethod={setSelectedMethod}
          simulatedPayload={simulatedPayload}
          setSimulatedPayload={setSimulatedPayload}
          onExecute={handleExecuteApiCall}
          isLoading={isLoading}
          executionStatus={executionStatus}
          executionLatency={executionLatency}
          executionResponse={executionResponse}
          hasAuthToken={hasAuthToken}
          quickStores={stores.map((s) => ({ id: s.id, name: s.name }))}
        />
      )}
      {activeTab === 'integrity' && <ServerIntegrityTab />}
      {activeTab === 'releases' && <ServerReleasesTab />}
      {activeTab === 'sync' && <ServerSyncBackupTab />}
      {activeTab === 'engine' && <ServerEngineTab />}
      {activeTab === 'sse' && (
        <ServerSseTab
          sseLiveEvents={sseLiveEvents}
          onClearEvents={() => setSseLiveEvents([])}
        />
      )}
      {activeTab === 'gps-telemetry' && <ServerGpsTelemetryTab />}
      {activeTab === 'city-maps' && <ServerCityMapsDataTab />}
    </div>
  );
};
