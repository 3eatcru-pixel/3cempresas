import { requestJson } from './httpClient.ts';

export const hqAdminApi = {
  async createHqStore(payload: Record<string, any>, token?: string) {
    return requestJson<{ success: boolean; store: any }>('/admin/stores', {
      method: 'POST',
      body: payload,
      token,
      appId: 'hq',
    });
  },

  async listAdminAuditLogs(
    params?: { type?: string; tenantId?: string; actorUid?: string; channel?: string; q?: string; limit?: number },
    token?: string
  ) {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.tenantId) qs.set('tenantId', params.tenantId);
    if (params?.actorUid) qs.set('actorUid', params.actorUid);
    if (params?.channel) qs.set('channel', params.channel);
    if (params?.q) qs.set('q', params.q);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson<{ logs: any[]; total: number }>(`/admin/audit-logs${query}`, {
      method: 'GET',
      token,
      appId: 'hq',
    });
  },

  async listUsers(storeId?: string, token?: string, filters?: { role?: string; status?: string }) {
    const qs = new URLSearchParams();
    if (storeId) qs.set('storeId', storeId);
    if (filters?.role) qs.set('role', filters.role);
    if (filters?.status) qs.set('status', filters.status);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson<any[]>(`/admin/users${query}`, {
      method: 'GET',
      token,
      appId: 'hq',
    });
  },

  async createHqUser(
    payload: {
      name: string;
      email: string;
      password?: string;
      role: string;
      storeId?: string;
      tenantId?: string;
      phone?: string;
      blockedApps?: string[];
      allowedStoreIds?: string[];
      permissions?: string[];
      fleetType?: 'PLATFORM_FLEET' | 'STORE_FLEET';
      allowedFleetModes?: ('PLATFORM_FLEET' | 'STORE_FLEET')[];
      vehicle?: 'SCOOTER' | 'BIKE' | 'CAR';
      vehiclePlate?: string;
    },
    token?: string
  ) {
    return requestJson<{ uid?: string; user?: any; success?: boolean }>('/admin/users/create', {
      method: 'POST',
      body: payload,
      token,
      appId: 'hq',
    });
  },

  async updateHqUser(
    uid: string,
    payload: {
      role?: string;
      tenantId?: string;
      storeId?: string | null;
      status?: 'ACTIVE' | 'DISABLED' | 'PENDING_ACTIVATION';
      name?: string;
      phone?: string;
      blockedApps?: string[];
      allowedStoreIds?: string[];
      permissions?: string[];
      fleetType?: 'PLATFORM_FLEET' | 'STORE_FLEET';
      allowedFleetModes?: ('PLATFORM_FLEET' | 'STORE_FLEET')[];
      vehicle?: 'SCOOTER' | 'BIKE' | 'CAR';
      vehiclePlate?: string;
    },
    token?: string
  ) {
    return requestJson<{ success: boolean; user?: any }>(`/admin/users/${encodeURIComponent(uid)}`, {
      method: 'PUT',
      body: payload,
      token,
      appId: 'hq',
    });
  },

  async deleteHqUser(uid: string, token?: string) {
    return requestJson<{ success: boolean }>(`/admin/users/${encodeURIComponent(uid)}`, {
      method: 'DELETE',
      token,
      appId: 'hq',
    });
  },

  async revokeHqUserSessions(uid: string, token?: string) {
    return requestJson<{ success: boolean; tokenVersion?: number; revokedAt?: string }>(
      `/admin/users/${encodeURIComponent(uid)}/revoke-sessions`,
      {
        method: 'POST',
        body: {},
        token,
        appId: 'hq',
      }
    );
  },

  async resetHqUserPassword(
    uid: string,
    payload?: { newPassword?: string },
    token?: string
  ) {
    return requestJson<{
      success: boolean;
      uid: string;
      temporaryPassword: string;
      mustChangePassword: boolean;
      tokenVersion: number;
      resetAt: string;
    }>(`/admin/users/${encodeURIComponent(uid)}/reset-password`, {
      method: 'POST',
      body: payload || {},
      token,
      appId: 'hq',
    });
  },

  async suspendHqTenant(tenantId: string, token?: string) {
    return requestJson<{ success: boolean; status: string; tenantId: string }>(
      `/admin/tenants/${encodeURIComponent(tenantId)}/suspend`,
      {
        method: 'POST',
        body: {},
        token,
        appId: 'hq',
      }
    );
  },

  async activateHqTenant(tenantId: string, token?: string) {
    return requestJson<{ success: boolean; status: string; tenantId: string }>(
      `/admin/tenants/${encodeURIComponent(tenantId)}/activate`,
      {
        method: 'POST',
        body: {},
        token,
        appId: 'hq',
      }
    );
  },

  async updateHqStoreSubscription(storeId: string, payload: any, token?: string) {
    return requestJson<{ success: boolean; store?: any }>(
      `/admin/stores/${encodeURIComponent(storeId)}/subscription`,
      {
        method: 'PUT',
        body: payload,
        token,
        appId: 'hq',
      }
    );
  },

  async updateHqStoreBillingStatus(
    storeId: string,
    saasPaymentStatus: 'PAID' | 'PENDING' | 'OVERDUE',
    token?: string
  ) {
    return requestJson<{ success: boolean; store?: any }>(
      `/admin/stores/${encodeURIComponent(storeId)}/billing-status`,
      {
        method: 'POST',
        body: { saasPaymentStatus },
        token,
        appId: 'hq',
      }
    );
  },

  async pairHqDevice(
    deviceId: string,
    payload?: { pairingCode?: string; ipAddress?: string; appVersion?: string },
    token?: string
  ) {
    return requestJson<{ success: boolean; deviceToken?: string; device?: any }>(
      `/admin/devices/${encodeURIComponent(deviceId)}/pair`,
      {
        method: 'POST',
        body: payload || {},
        token,
        appId: 'hq',
      }
    );
  },

  async regenerateDevicePairing(deviceId: string, token?: string) {
    return requestJson<{ success: boolean; pairingCode: string; pairingCodeExpiresAt: string; device?: any }>(
      `/admin/devices/${encodeURIComponent(deviceId)}/regenerate-pairing`,
      {
        method: 'POST',
        body: {},
        token,
        appId: 'hq',
      }
    );
  },

  async revokeDeviceToken(deviceId: string, token?: string) {
    return requestJson<{ success: boolean; device?: any }>(
      `/admin/devices/${encodeURIComponent(deviceId)}/revoke-token`,
      {
        method: 'POST',
        body: {},
        token,
        appId: 'hq',
      }
    );
  },

  async heartbeatHqDevice(
    deviceId: string,
    payload?: { appVersion?: string },
    opts?: { deviceToken?: string; token?: string }
  ) {
    return requestJson<{ success: boolean; lastHeartbeatAt: string }>(
      `/admin/devices/${encodeURIComponent(deviceId)}/heartbeat`,
      {
        method: 'POST',
        body: payload || {},
        deviceToken: opts?.deviceToken,
        token: opts?.token,
        appId: 'store-os',
      }
    );
  },

  async testHqIntegration(id: string, token?: string) {
    return requestJson<{
      success: boolean;
      status: string;
      liveVerified?: boolean;
      diagnosticMessage: string;
      latencyMs?: number;
      lastHttpStatus?: number | null;
      probeHistory?: any[];
      lastSync: string;
    }>(`/admin/integrations/${encodeURIComponent(id)}/test`, {
      method: 'POST',
      body: {},
      token,
      appId: 'hq',
    });
  },

  async testHqIntegrationWebhook(
    id: string,
    payload: { eventType?: 'PING' | 'ORDER_COMMITTED' | 'PAYMENT_CONFIRMED'; targetUrl?: string },
    token?: string
  ) {
    return requestJson<{
      success: boolean;
      deliveryId: string;
      eventType: string;
      httpStatus: number | null;
      latencyMs: number;
      signatureHeader: string;
      signaturePreview: string;
      signatureMode: string;
      diagnosticMessage: string;
      lastSync: string;
      probeHistory?: any[];
    }>(`/admin/integrations/${encodeURIComponent(id)}/webhook-test`, {
      method: 'POST',
      body: payload,
      token,
      appId: 'hq',
    });
  },

  async suspendHqIntegration(id: string, token?: string) {
    return requestJson<{ success: boolean; status: string }>(
      `/admin/integrations/${encodeURIComponent(id)}/suspend`,
      {
        method: 'POST',
        body: {},
        token,
        appId: 'hq',
      }
    );
  },

  async reconcileHqBilling(token?: string) {
    return requestJson<{
      success: boolean;
      checkedStores: number;
      reconciledCount: number;
      overdueCount: number;
      stores: any[];
      reconciledAt: string;
    }>('/admin/billing/reconcile', {
      method: 'POST',
      body: {},
      token,
      appId: 'hq',
    });
  },

  async resetSandboxPlatform(token?: string) {
    return requestJson<{ success: boolean; resetAt: string }>('/admin/reset-sandbox', {
      method: 'POST',
      body: {},
      token,
      appId: 'hq',
    });
  },

  async getBaselineDoc(token?: string) {
    return requestJson<{ filename: string; content: string }>('/admin/baseline', {
      method: 'GET',
      token,
      appId: 'hq',
    });
  },

  async exportDatabaseBackup(token?: string) {
    return requestJson<{
      exportedAt: string;
      version: string;
      schemaVersion?: string;
      checksum?: string;
      tables: Record<string, any[]>;
    }>('/admin/backup', {
      method: 'GET',
      token,
      appId: 'hq',
    });
  },

  async restoreDatabaseBackup(
    tables: Record<string, any[]>,
    token?: string,
    meta?: { schemaVersion?: string; version?: string; checksum?: string }
  ) {
    return requestJson<{
      success: boolean;
      restoredDocs: number;
      restoredAt: string;
      preRestoreBackupId?: string;
    }>('/admin/restore', {
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

export interface EcosystemTableInspectResponse {
  inspectedAt: string;
  selectedTable: string;
  totalRows: number;
  rows: Record<string, any>[];
  tablesCatalog: {
    name: string;
    category: 'GOVERNANCE' | 'COMMERCE' | 'FINANCE_STOCK' | 'HARDWARE_SYNC';
    description: string;
    count: number;
  }[];
  telemetrySummary: {
    uptimeSeconds: number;
    memoryRssMb: number;
    heapUsedMb: number;
    persistenceDriver: string;
    persistenceMode: string;
    productionDatabaseReady: boolean;
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
    rateLimits: {
      name: string;
      windowMs: number;
      maxRequests: number;
      trackedKeys: number;
      blockedKeys: { ip: string; hits: number; remainingSeconds: number }[];
    }[];
    sseSessionsCount: number;
  };
}

export interface AccountSecurityOverviewResponse {
  checkedAt: string;
  summary: {
    totalAccounts: number;
    activeCount: number;
    disabledCount: number;
    mustChangePasswordCount: number;
    customBlockedAppsCount: number;
    multiBranchAccountsCount: number;
    roleBreakdown: Record<string, number>;
  };
  totalAccounts: number;
  activeCount: number;
  disabledCount: number;
  mustChangePasswordCount: number;
  customBlockedAppsCount: number;
  multiBranchAccountsCount: number;
  roleBreakdown: Record<string, number>;
  passwordRecoveryQueue: {
    uid: string;
    name: string;
    email: string;
    role: string;
    tenantId: string;
    storeId: string | null;
    mustChangePassword: boolean;
    hasPendingSupportCode: boolean;
    expiresAt: string | null;
    requestedAt: string | null;
  }[];
}

export interface SentinelLogsResponse {
  available: boolean;
  executedAt: string | null;
  summary: {
    scannerPassed: number;
    scannerFailed: number;
    suitesPassed: number;
    suitesFailed: number;
    totalAssertionsPassed: number;
    totalAssertionsFailed: number;
    overallStatus: 'PASS' | 'FAIL';
  } | null;
  deficiencies: {
    counts: { open: number; advisory: number; total: number };
    entries: Array<{
      id: string;
      severity: 'P0' | 'P1' | 'P2' | 'P3';
      status: 'OPEN' | 'ADVISORY';
      category: string;
      target: string;
      summary: string;
      impact: string;
      recommendedAction: string;
      detectedAt: string;
    }>;
  };
  improvements: {
    counts: { verified: number; recommended: number };
    personaExperiences?: Array<{
      personaId: string;
      personaLabel: string;
      productAppId: string;
      status: 'ISOLATED_OK' | 'ATTENTION';
      authIsolation: string;
      uxHighlights: string;
      verifiedBy: string;
    }>;
    entries: Array<{
      id: string;
      status: 'VERIFIED' | 'RECOMMENDED';
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      category: string;
      title: string;
      target: string;
      detail: string;
      verifiedBy?: string;
    }>;
  };
  history: Array<{
    executedAt: string;
    mode: string;
    overallStatus: 'PASS' | 'FAIL';
    scannerPassed: number;
    scannerTotal: number;
    suitesPassed: number;
    suitesTotal: number;
    assertionsPassed: number;
    assertionsFailed: number;
    deficienciesOpenCount: number;
    deficienciesAdvisoryCount: number;
  }>;
}
