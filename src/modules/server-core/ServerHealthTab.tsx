import React, { useEffect, useState } from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../core/api/apiClient';
import {
  DiagnosticsMetricsResponse,
  LiveHealthSnapshot,
  ServerBackboneTopologyCard,
} from './health/ServerBackboneTopologyCard';
import { ServerGoldenSignalsCard } from './health/ServerGoldenSignalsCard';
import { ServerRateLimitAndSseGrid } from './health/ServerRateLimitAndSseGrid';
import { ServerFirebaseBackboneCard } from './health/ServerFirebaseBackboneCard';

export const ServerHealthTab: React.FC = () => {
  const { governance, stores, orders, drivers, tables, deviceLicenses, showNotification } = useEcosystem();
  const { getIdToken } = useAuth();
  const [liveHealth, setLiveHealth] = useState<LiveHealthSnapshot | null>(null);
  const [healthLatencyMs, setHealthLatencyMs] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<DiagnosticsMetricsResponse | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const loadTelemetry = async () => {
    setLoadingMetrics(true);
    const started = performance.now();
    try {
      const token = (await getIdToken()) || undefined;
      const [healthRes, diagRes] = await Promise.all([
        apiClient.getHealth(),
        token ? apiClient.getDevDiagnosticsMetrics(token).catch(() => null) : Promise.resolve(null),
      ]);
      setLiveHealth(healthRes);
      setHealthLatencyMs(Math.max(1, Math.round(performance.now() - started)));
      if (diagRes) setMetrics(diagRes);
    } catch {
      setHealthLatencyMs(null);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    void loadTelemetry();
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void loadTelemetry();
      }
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleUnlockRateLimit = async (limiter: string, ip?: string) => {
    try {
      const token = (await getIdToken()) || undefined;
      const res = await apiClient.unlockRateLimit({ limiter, ip }, token);
      showNotification(`Rate limiter "${limiter}" desbloqueado (${res.cleared} registro(s)).`);
      await loadTelemetry();
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao desbloquear rate limit.');
    }
  };

  const handleDisconnectSse = async (index: number) => {
    try {
      const token = (await getIdToken()) || undefined;
      const res = await apiClient.disconnectSseClient({ index }, token);
      showNotification(`Conexão SSE encerrada (${res.disconnected}).`);
      await loadTelemetry();
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao encerrar sessão SSE.');
    }
  };

  const liveOrdersGMV = orders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const liveSaaSMrr = stores.reduce((acc, s) => acc + (s.saasMonthlyFee || 0), 0);
  const firebaseEnabled = governance?.featureFlags?.firebaseEnabled !== false;
  const firebaseAuthEnabled =
    firebaseEnabled && governance?.featureFlags?.firebaseAuthEnabled !== false;
  const firebaseFirestoreEnabled =
    firebaseEnabled && governance?.featureFlags?.firebaseFirestoreEnabled !== false;

  return (
    <div className="space-y-6 animate-fadeIn">
      <ServerBackboneTopologyCard
        liveOrdersGMV={liveOrdersGMV}
        ordersCount={orders.length}
        liveSaaSMrr={liveSaaSMrr}
        storesCount={stores.length}
        driversCount={drivers.length}
        tablesCount={tables.length}
        deviceLicensesCount={deviceLicenses?.length ?? 0}
        liveHealth={liveHealth}
        healthLatencyMs={healthLatencyMs}
        metrics={metrics}
      />

      <ServerFirebaseBackboneCard
        firebaseEnabled={firebaseEnabled}
        firebaseAuthEnabled={firebaseAuthEnabled}
        firebaseFirestoreEnabled={firebaseFirestoreEnabled}
      />

      <ServerGoldenSignalsCard
        metrics={metrics}
        liveHealth={liveHealth}
        loadingMetrics={loadingMetrics}
        onRefresh={() => void loadTelemetry()}
      />

      <ServerRateLimitAndSseGrid
        metrics={metrics}
        onUnlockRateLimit={(limiter, ip) => void handleUnlockRateLimit(limiter, ip)}
        onDisconnectSse={(index) => void handleDisconnectSse(index)}
      />
    </div>
  );
};
