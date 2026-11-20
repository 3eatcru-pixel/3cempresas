import { requestJson } from './httpClient.ts';
import { hqDiagnosticsMethods } from './hqDiagnosticsMethods.ts';

export type {
  EcosystemTableInspectResponse,
  AccountSecurityOverviewResponse,
  SentinelLogsResponse,
} from './hqDiagnosticsTypes.ts';

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

  ...hqDiagnosticsMethods,
};
