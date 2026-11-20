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
