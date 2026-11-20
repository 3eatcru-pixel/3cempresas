import { requestJson } from './httpClient.ts';
import type {
  AccountSecurityOverviewResponse,
  EcosystemTableInspectResponse,
  SentinelLogsResponse,
} from './hqDiagnosticsTypes.ts';

export const hqDiagnosticsMethods = {
  async getDevDiagnosticsMetrics(token?: string) {
    return requestJson<{
      capturedAt: string;
      summary: {
        totalRequests: number;
        rpm: number;
        errors4xx: number;
        errors5xx: number;
        errorRatePercent: number;
        p50Ms: number;
        p95Ms: number;
        p99Ms: number;
      };
      domains: {
        domain: string;
        count: number;
        err4xx: number;
        err5xx: number;
        avgMs: number;
        p50Ms: number;
        p95Ms: number;
        p99Ms: number;
        maxMs: number;
      }[];
      topRoutes: {
        method: string;
        route: string;
        domain: string;
        count: number;
        errors: number;
        p95Ms: number;
        lastStatus: number;
        lastSeenAt: string;
      }[];
      rateLimits: {
        name: string;
        windowMs: number;
        maxRequests: number;
        trackedKeys: number;
        blockedKeys: { ip: string; hits: number; remainingSeconds: number }[];
      }[];
      sseSessions: {
        index: number;
        uid: string;
        tenantId: string;
        isDev: boolean;
        writableEnded: boolean;
      }[];
    }>('/admin/diagnostics/metrics', {
      method: 'GET',
      token,
      appId: 'hq',
    });
  },

  async getDevEnvReadiness(token?: string) {
    return requestJson<{
      checkedAt: string;
      serviceName: string;
      region: string;
      environmentMode: 'production' | 'development';
      dbConnectionMode: 'url' | 'cloudsql_vars' | 'missing';
      sqlDbName: string | null;
      persistenceDriver: string;
      persistenceMode: string;
      productionDatabaseReady: boolean;
      cloudProbeVerified: boolean;
      cloudProbeError: string | null;
      allowSandboxInProduction: boolean;
      seedDemoData: boolean;
      variables: {
        key: string;
        scope: string;
        configured: boolean;
        requiredInProduction: boolean;
        note: string;
      }[];
    }>('/admin/diagnostics/env-readiness', {
      method: 'GET',
      token,
      appId: 'hq',
    });
  },

  async unlockRateLimit(payload: { limiter?: string; ip?: string }, token?: string) {
    return requestJson<{ success: boolean; cleared: number }>('/admin/diagnostics/rate-limits/unlock', {
      method: 'POST',
      body: payload,
      token,
      appId: 'hq',
    });
  },

  async disconnectSseClient(payload: { index?: number; uid?: string; tenantId?: string }, token?: string) {
    return requestJson<{ success: boolean; disconnected: number }>('/admin/diagnostics/sse/disconnect', {
      method: 'POST',
      body: payload,
      token,
      appId: 'hq',
    });
  },

  async runIntegrityAudit(token?: string) {
    return requestJson<{
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
    }>('/admin/diagnostics/integrity', {
      method: 'GET',
      token,
      appId: 'hq',
    });
  },

  async previewRestoreSnapshot(
    tables: Record<string, any[]>,
    token?: string,
    meta?: { schemaVersion?: string; version?: string; checksum?: string }
  ) {
    return requestJson<{
      valid: boolean;
      schemaValid: boolean;
      checksumValid: boolean;
      hasActiveDevOwner: boolean;
      errors: string[];
      warnings: string[];
      lockoutRisks: {
        usersMissingPasswordHash: number;
        devicesMissingTokenHash: number;
        integrationsMissingSecret: number;
      };
      diffs: {
        collection: string;
        currentCount: number;
        snapshotCount: number;
        added: number;
        updated: number;
        removed: number;
      }[];
    }>('/admin/diagnostics/restore-preview', {
      method: 'POST',
      body: {
        tables,
        ...(meta?.schemaVersion ? { schemaVersion: meta.schemaVersion } : {}),
        ...(meta?.version ? { version: meta.version } : {}),
        ...(meta?.checksum ? { checksum: meta.checksum } : {}),
      },
      token,
      appId: 'hq',
    });
  },

  async getFleetAdoptionMatrix(token?: string) {
    return requestJson<{
      generatedAt: string;
      latestTargetVersion: string;
      minSupportedVersion: string;
      counts: {
        total: number;
        upToDate: number;
        outdated: number;
        unsupported: number;
      };
      fleet: {
        id: string;
        kind: string;
        name: string;
        type: string;
        storeId: string;
        storeName: string;
        appVersion: string;
        status: string;
        lastPing: string | null;
        compatibility: 'UP_TO_DATE' | 'OUTDATED' | 'UNSUPPORTED' | 'UNKNOWN';
      }[];
      observedHttpClients: {
        appId: string;
        platform: string;
        appVersion: string;
        requests: number;
        lastSeenAt: string;
      }[];
    }>('/admin/diagnostics/fleet', {
      method: 'GET',
      token,
      appId: 'hq',
    });
  },

  async getSyncConflicts(status?: 'OPEN' | 'RESOLVED' | 'DISCARDED' | 'ALL', token?: string) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return requestJson<{
      total: number;
      totalOpen: number;
      conflicts: {
        id: string;
        status: 'OPEN' | 'RESOLVED' | 'DISCARDED';
        kind: 'CONFLICT' | 'REJECTED';
        reason: string;
        nodeId: string;
        tenantId: string;
        storeId: string | null;
        actorUid: string | null;
        entity: string;
        entityId: string;
        idempotencyKey: string | null;
        incomingHlc: string;
        clientPayload: Record<string, any> | null;
        serverRecord: Record<string, any> | null;
        detectedAt: string;
        resolvedAt?: string;
        resolvedByEmail?: string | null;
        resolutionNote?: string;
      }[];
    }>(`/admin/diagnostics/sync-conflicts${qs}`, {
      method: 'GET',
      token,
      appId: 'hq',
    });
  },

  async resolveSyncConflict(
    id: string,
    payload: { action: 'RESOLVED' | 'DISCARDED'; resolutionNote?: string },
    token?: string
  ) {
    return requestJson<{ success: boolean; conflict: any }>(
      `/admin/diagnostics/sync-conflicts/${encodeURIComponent(id)}/resolve`,
      {
        method: 'POST',
        body: payload,
        token,
        appId: 'hq',
      }
    );
  },

  async inspectEcosystemTables(
    params?: {
      table?: string;
      tenantId?: string;
      storeId?: string;
      q?: string;
      limit?: number;
      includeDeleted?: boolean;
    },
    token?: string
  ) {
    const qs = new URLSearchParams();
    if (params?.table) qs.set('table', params.table);
    if (params?.tenantId) qs.set('tenantId', params.tenantId);
    if (params?.storeId) qs.set('storeId', params.storeId);
    if (params?.q) qs.set('q', params.q);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.includeDeleted) qs.set('includeDeleted', 'true');
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson<EcosystemTableInspectResponse>(`/admin/diagnostics/tables${query}`, {
      method: 'GET',
      token,
      appId: 'hq',
    });
  },

  async getAccountSecurityOverview(token?: string) {
    return requestJson<AccountSecurityOverviewResponse>('/admin/diagnostics/account-security', {
      method: 'GET',
      token,
      appId: 'hq',
    });
  },

  async getSentinelLogs(token?: string): Promise<SentinelLogsResponse> {
    return requestJson('/admin/diagnostics/sentinel-logs', {
      method: 'GET',
      token,
      appId: 'hq',
    });
  },
};
