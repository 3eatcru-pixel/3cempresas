import React, { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../core/api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useEcosystem } from '../../context/EcosystemContext';
import {
  exportInspectorTableCsv,
  exportInspectorTableJson,
  InspectorResponse,
  IntegrityReportResponse,
  TableCategory,
} from './telemetry/telemetryTableUtils';
import { HqTelemetryGoldenSignalsStrip } from './telemetry/HqTelemetryGoldenSignalsStrip';
import { HqTablesCatalogSidebar } from './telemetry/HqTablesCatalogSidebar';
import { HqTableInspectorPanel } from './telemetry/HqTableInspectorPanel';
import { HqDomainLatencyAndIntegrityGrid } from './telemetry/HqDomainLatencyAndIntegrityGrid';

export const HqTelemetryTablesTab: React.FC = () => {
  const { profile, getIdToken } = useAuth();
  const { stores, showNotification } = useEcosystem();
  const isDevOwner = profile?.role === 'DEV_OWNER';

  const [selectedTable, setSelectedTable] = useState<string>('stores');
  const [categoryFilter, setCategoryFilter] = useState<TableCategory>('ALL');
  const [tenantFilter, setTenantFilter] = useState<string>('ALL');
  const [storeFilter, setStoreFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [includeDeleted, setIncludeDeleted] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [inspectorData, setInspectorData] = useState<InspectorResponse | null>(null);
  const [integrityReport, setIntegrityReport] = useState<IntegrityReportResponse | null>(null);
  const [loadingIntegrity, setLoadingIntegrity] = useState<boolean>(false);

  const loadTableTelemetry = async (tableOverride?: string) => {
    setLoading(true);
    try {
      const token = (await getIdToken()) || undefined;
      const targetTable = tableOverride || selectedTable;
      const res = await apiClient.inspectEcosystemTables(
        {
          table: targetTable,
          tenantId: tenantFilter !== 'ALL' ? tenantFilter : undefined,
          storeId: storeFilter !== 'ALL' ? storeFilter : undefined,
          q: searchQuery.trim() || undefined,
          limit: 150,
          includeDeleted,
        },
        token
      );
      setInspectorData(res);
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao carregar telemetria e tabelas do ecossistema.');
    } finally {
      setLoading(false);
    }
  };

  const runIntegrityScan = async () => {
    if (!isDevOwner) return;
    setLoadingIntegrity(true);
    try {
      const token = (await getIdToken()) || undefined;
      const report = await apiClient.runIntegrityAudit(token);
      setIntegrityReport(report);
      showNotification(
        `Varredura concluída: ${report.totalAnomalies} anomalia(s) (${report.criticalCount} crítica(s)).`
      );
    } catch (e: any) {
      showNotification(e?.message || 'Falha ao executar varredura de integridade.');
    } finally {
      setLoadingIntegrity(false);
    }
  };

  useEffect(() => {
    void loadTableTelemetry();
  }, [selectedTable, tenantFilter, storeFilter, includeDeleted]);

  useEffect(() => {
    if (isDevOwner) {
      void runIntegrityScan();
    }
  }, [isDevOwner]);

  const handleUnlockRateLimit = async (limiter?: string, ip?: string) => {
    if (!isDevOwner) return;
    try {
      const token = (await getIdToken()) || undefined;
      const res = await apiClient.unlockRateLimit({ limiter, ip }, token);
      showNotification(`Rate limiter desbloqueado (${res.cleared} registro(s) limpo(s)).`);
      await loadTableTelemetry();
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao desbloquear rate limit.');
    }
  };

  const distinctTenants = useMemo(() => {
    const set = new Set<string>(['tenant-1']);
    stores.forEach((s) => {
      if (s.tenantId) set.add(s.tenantId);
    });
    return Array.from(set);
  }, [stores]);

  const filteredCatalog = useMemo(() => {
    const list = inspectorData?.tablesCatalog || [];
    if (categoryFilter === 'ALL') return list;
    return list.filter((t) => t.category === categoryFilter);
  }, [inspectorData, categoryFilter]);

  const totalEcosystemRecords = useMemo(() => {
    return (inspectorData?.tablesCatalog || []).reduce((acc, t) => acc + t.count, 0);
  }, [inspectorData]);

  const telemetry = inspectorData?.telemetrySummary;
  const activeTableMeta = inspectorData?.tablesCatalog.find(
    (t) => t.name === inspectorData.selectedTable
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      <HqTelemetryGoldenSignalsStrip
        telemetry={telemetry}
        totalEcosystemRecords={totalEcosystemRecords}
        tablesCount={inspectorData?.tablesCatalog.length ?? 21}
        isDevOwner={isDevOwner}
        onUnlockRateLimit={() => void handleUnlockRateLimit()}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <HqTablesCatalogSidebar
          filteredCatalog={filteredCatalog}
          selectedTable={selectedTable}
          onSelectTable={setSelectedTable}
          categoryFilter={categoryFilter}
          onChangeCategory={setCategoryFilter}
        />

        <HqTableInspectorPanel
          selectedTable={selectedTable}
          inspectorData={inspectorData}
          activeTableDescription={activeTableMeta?.description}
          loading={loading}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          tenantFilter={tenantFilter}
          onTenantFilterChange={setTenantFilter}
          distinctTenants={distinctTenants}
          storeFilter={storeFilter}
          onStoreFilterChange={setStoreFilter}
          stores={stores}
          includeDeleted={includeDeleted}
          onIncludeDeletedChange={setIncludeDeleted}
          onRefresh={() => void loadTableTelemetry()}
          onExportCsv={() => exportInspectorTableCsv(inspectorData, showNotification)}
          onExportJson={() => {
            if (inspectorData) exportInspectorTableJson(inspectorData, showNotification);
          }}
        />
      </div>

      <HqDomainLatencyAndIntegrityGrid
        telemetry={telemetry}
        isDevOwner={isDevOwner}
        integrityReport={integrityReport}
        loadingIntegrity={loadingIntegrity}
        onRunIntegrityScan={() => void runIntegrityScan()}
      />
    </div>
  );
};
