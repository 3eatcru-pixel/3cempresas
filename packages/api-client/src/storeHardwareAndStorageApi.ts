import { requestJson } from './httpClient.ts';

export const storeHardwareAndStorageApi = {
  async listStoreDevices(storeId?: string, token?: string) {
    const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
    return requestJson<any[]>(`/store/devices${query}`, {
      method: 'GET',
      token,
      appId: 'store-os',
    });
  },

  async createStoreDevice(payload: Record<string, any>, token?: string) {
    return requestJson<{ success: boolean; device?: any }>('/store/devices', {
      method: 'POST',
      body: payload,
      token,
      appId: 'store-os',
    });
  },

  async pairStoreDevice(
    deviceId: string,
    payload?: { pairingCode?: string; ipAddress?: string; appVersion?: string },
    token?: string
  ) {
    return requestJson<{ success: boolean; deviceToken?: string; device?: any }>(
      `/store/devices/${encodeURIComponent(deviceId)}/pair`,
      {
        method: 'POST',
        body: payload || {},
        token,
        appId: 'store-os',
      }
    );
  },

  async regenerateStoreDevicePairing(deviceId: string, token?: string) {
    return requestJson<{ success: boolean; pairingCode: string; pairingCodeExpiresAt: string; device?: any }>(
      `/store/devices/${encodeURIComponent(deviceId)}/regenerate-pairing`,
      {
        method: 'POST',
        body: {},
        token,
        appId: 'store-os',
      }
    );
  },

  async revokeStoreDeviceToken(deviceId: string, token?: string) {
    return requestJson<{ success: boolean; device?: any }>(
      `/store/devices/${encodeURIComponent(deviceId)}/revoke-token`,
      {
        method: 'POST',
        body: {},
        token,
        appId: 'store-os',
      }
    );
  },

  async heartbeatStoreDevice(
    deviceId: string,
    payload?: { appVersion?: string },
    opts?: { deviceToken?: string; token?: string }
  ) {
    return requestJson<{ success: boolean; lastHeartbeatAt: string }>(
      `/store/devices/${encodeURIComponent(deviceId)}/heartbeat`,
      {
        method: 'POST',
        body: payload || {},
        deviceToken: opts?.deviceToken,
        token: opts?.token,
        appId: 'store-os',
      }
    );
  },

  async deleteStoreDevice(deviceId: string, token?: string) {
    return requestJson<{ success: boolean }>(`/store/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
      token,
      appId: 'store-os',
    });
  },

  async loginStoreDevice(payload: {
    deviceIdentifier: string;
    pairingCode: string;
    operatorName?: string;
    appVersion?: string;
  }) {
    return requestJson<{
      success: boolean;
      token: string;
      deviceToken?: string;
      device?: any;
      store?: { id: string; name: string };
      user: any;
    }>('/store/devices/pair-login', {
      method: 'POST',
      body: payload,
      token: null,
      appId: 'waiter',
    });
  },

  async listStorePeripherals(
    params?: { storeId?: string; kind?: string; station?: string },
    token?: string
  ) {
    const qs = new URLSearchParams();
    if (params?.storeId) qs.set('storeId', params.storeId);
    if (params?.kind) qs.set('kind', params.kind);
    if (params?.station) qs.set('station', params.station);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson<any[]>(`/store/peripherals${query}`, {
      method: 'GET',
      token,
      appId: 'store-os',
    });
  },

  async saveStorePeripheral(payload: Record<string, any>, token?: string) {
    return requestJson<{ success: boolean; peripheral: any }>('/store/peripherals', {
      method: 'POST',
      body: payload,
      token,
      appId: 'store-os',
    });
  },

  async heartbeatStorePeripheral(
    id: string,
    payload: { status: 'ONLINE' | 'OFFLINE' | 'PAPER_OUT' | 'ERROR'; lastError?: string; lastWeightKg?: number },
    token?: string
  ) {
    return requestJson<{ success: boolean; id: string; status: string; lastHeartbeatAt: string }>(
      `/store/peripherals/${encodeURIComponent(id)}/heartbeat`,
      {
        method: 'POST',
        body: payload,
        token,
        appId: 'store-os',
      }
    );
  },

  async deleteStorePeripheral(id: string, token?: string) {
    return requestJson<{ success: boolean; deletedId: string }>(
      `/store/peripherals/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        token,
        appId: 'store-os',
      }
    );
  },

  async listPrintJobs(params?: { storeId?: string; status?: string; peripheralId?: string }, token?: string) {
    const qs = new URLSearchParams();
    if (params?.storeId) qs.set('storeId', params.storeId);
    if (params?.status) qs.set('status', params.status);
    if (params?.peripheralId) qs.set('peripheralId', params.peripheralId);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson<any[]>(`/store/print-jobs${query}`, {
      method: 'GET',
      token,
      appId: 'store-os',
    });
  },

  async enqueuePrintJob(
    payload: {
      storeId: string;
      content: string;
      station?: string;
      peripheralId?: string;
      orderId?: string;
      requireRegisteredPrinter?: boolean;
    },
    token?: string
  ) {
    return requestJson<{ success: boolean; job: any }>('/store/print-jobs', {
      method: 'POST',
      body: payload,
      token,
      appId: 'store-os',
    });
  },

  async ackPrintJob(
    jobId: string,
    payload: { status: 'DISPATCHED' | 'PRINTED' | 'FAILED' | 'QUEUED'; error?: string },
    token?: string
  ) {
    return requestJson<{ success: boolean; job: any }>(
      `/store/print-jobs/${encodeURIComponent(jobId)}/ack`,
      {
        method: 'POST',
        body: payload,
        token,
        appId: 'store-os',
      }
    );
  },

  async listStorageObjects(
    params?: { appId?: string; storeId?: string; folder?: string },
    token?: string
  ) {
    const qs = new URLSearchParams();
    if (params?.appId) qs.set('appId', params.appId);
    if (params?.storeId) qs.set('storeId', params.storeId);
    if (params?.folder) qs.set('folder', params.folder);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson<{
      driver: string;
      quotaScope?: 'USER_PERSONAL' | 'TENANT';
      ownerUid?: string | null;
      tenantId: string;
      quotaBytes: number;
      usedBytes: number;
      folders?: string[];
      objectCount: number;
      objects: any[];
    }>(`/storage/objects${query}`, {
      method: 'GET',
      token,
      appId: (params?.appId as any) || 'store-os',
    });
  },

  async uploadStorageObject(
    payload: {
      appId: string;
      storeId?: string;
      folder?: string;
      filename: string;
      mimeType: string;
      visibility?: 'PRIVATE' | 'PUBLIC_READ';
      contentBase64?: string;
      contentUtf8?: string;
    },
    token?: string
  ) {
    return requestJson<{ success: boolean; object: any }>('/storage/objects', {
      method: 'POST',
      body: payload,
      token,
      appId: (payload.appId as any) || 'store-os',
    });
  },

  async updateStorageObject(
    id: string,
    payload: { folder?: string; filename?: string },
    token?: string
  ) {
    return requestJson<{ success: boolean; object: any }>(
      `/storage/objects/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: payload,
        token,
        appId: 'marketplace',
      }
    );
  },

  async deleteStorageObject(id: string, token?: string) {
    return requestJson<{ success: boolean; deletedId: string }>(
      `/storage/objects/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        token,
        appId: 'store-os',
      }
    );
  },
};
