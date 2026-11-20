import { getPlatformAdapters } from '@3c/platform-adapters';
import { rawFetch, requestJson } from './httpClient.ts';

export const storeApi = {
  async exportSpedText(token?: string, storeId?: string): Promise<string> {
    const base = getPlatformAdapters().network.getApiBaseUrl();
    const qs = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
    const resp = await rawFetch(`${base}/store/export/sped${qs}`, {
      method: 'GET',
      token,
      appId: 'store-os',
      idempotency: false,
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data?.error || `Erro ao exportar SPED (HTTP ${resp.status})`);
    }
    return resp.text();
  },

  async listStoreStaff(storeId?: string, token?: string, filters?: { role?: string; status?: string }) {
    const qs = new URLSearchParams();
    if (storeId) qs.set('storeId', storeId);
    if (filters?.role) qs.set('role', filters.role);
    if (filters?.status) qs.set('status', filters.status);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return requestJson<any[]>(`/store/staff${query}`, {
      method: 'GET',
      token,
      appId: 'store-os',
    });
  },

  async createStoreStaff(
    payload: {
      name: string;
      email: string;
      password: string;
      role: string;
      storeId?: string;
      phone?: string;
      blockedApps?: string[];
      permissions?: string[];
    },
    token?: string
  ) {
    return requestJson<{ success: boolean; uid: string; user?: any }>('/store/staff', {
      method: 'POST',
      body: payload,
      token,
      appId: 'store-os',
    });
  },

  async updateStoreStaff(
    uid: string,
    payload: {
      role?: string;
      storeId?: string;
      status?: 'ACTIVE' | 'DISABLED';
      name?: string;
      phone?: string;
      blockedApps?: string[];
      permissions?: string[];
    },
    token?: string
  ) {
    return requestJson<{ success: boolean; user?: any }>(
      `/store/staff/${encodeURIComponent(uid)}`,
      {
        method: 'PUT',
        body: payload,
        token,
        appId: 'store-os',
      }
    );
  },

  async deleteStoreStaff(uid: string, token?: string) {
    return requestJson<{ success: boolean; deletedUid: string }>(
      `/store/staff/${encodeURIComponent(uid)}`,
      {
        method: 'DELETE',
        token,
        appId: 'store-os',
      }
    );
  },

  async revokeStoreStaffSessions(uid: string, token?: string) {
    return requestJson<{ success: boolean; tokenVersion?: number; revokedAt?: string }>(
      `/store/staff/${encodeURIComponent(uid)}/revoke-sessions`,
      {
        method: 'POST',
        body: {},
        token,
        appId: 'store-os',
      }
    );
  },

  async resetStoreStaffPassword(uid: string, payload?: { newPassword?: string }, token?: string) {
    return requestJson<{
      success: boolean;
      uid: string;
      temporaryPassword: string;
      mustChangePassword: boolean;
      tokenVersion: number;
      resetAt: string;
    }>(`/store/staff/${encodeURIComponent(uid)}/reset-password`, {
      method: 'POST',
      body: payload || {},
      token,
      appId: 'store-os',
    });
  },

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

  async saveStoreTable(tablePayload: Record<string, any>, token?: string) {
    return requestJson<{ success: boolean; table?: any }>('/store/tables', {
      method: 'POST',
      body: tablePayload,
      token,
      appId: 'store-os',
    });
  },

  async deleteStoreTable(tableId: string, token?: string) {
    return requestJson<{ success: boolean; deletedId?: string }>(
      `/store/tables/${encodeURIComponent(tableId)}`,
      {
        method: 'DELETE',
        token,
        appId: 'store-os',
      }
    );
  },

  async getStorePublicPaymentInfo(storeId: string) {
    return requestJson<{
      storeId: string;
      pixKey?: string;
      pixKeyType?: string;
      acceptsPix?: boolean;
      acceptsCard?: boolean;
      acceptsCash?: boolean;
      acceptedPaymentMethods?: string[];
    }>(`/store/payment-public-info/${encodeURIComponent(storeId)}`, {
      method: 'GET',
      appId: 'marketplace',
    });
  },

  async getStoreBillingConfig(token?: string) {
    return requestJson<{
      planPricing?: Record<
        string,
        {
          monthlyPrice: number;
          quarterlyPrice: number;
          annualPrice: number;
          maxDevices: number;
          maxBranches?: number;
        }
      >;
      billingConfig?: {
        pixEnabled: boolean;
        pixKey: string;
        pixKeyType: 'CNPJ' | 'CPF' | 'EMAIL' | 'PHONE' | 'EVP';
        beneficiaryName: string;
        beneficiaryCity: string;
        beneficiaryDocument?: string;
        creditCardEnabled: boolean;
        debitCardEnabled: boolean;
        boletoEnabled: boolean;
        bankTransferEnabled: boolean;
        paymentLinkEnabled: boolean;
        maxCreditInstallments?: number;
        bankName?: string;
        bankAgency?: string;
        bankAccount?: string;
        bankAccountType?: 'CORRENTE' | 'POUPANCA' | 'PAGAMENTO';
        pspProvider: 'DIRECT_PIX' | 'ASAAS' | 'MERCADO_PAGO' | 'STRIPE' | 'PAGARME' | 'CUSTOM';
        checkoutBaseUrl?: string;
        billingSupportWhatsapp?: string;
        billingSupportEmail?: string;
        paymentInstructions?: string;
        gracePeriodDays: number;
        autoSuspendOverdue: boolean;
        lateFeePercent: number;
        monthlyInterestPercent: number;
        sendDueReminderDaysBefore: number;
      };
      defaultTrialDays?: number;
      customPlatformName?: string;
    }>('/store/billing-config', {
      method: 'GET',
      token,
      appId: 'store-os',
    });
  },

  async requestStoreSubscriptionUpgrade(
    storeId: string,
    payload: {
      requestedPlan: string;
      billingCycle: string;
      paymentMethod?: string;
      couponCode?: string;
    },
    token?: string
  ) {
    return requestJson<{
      success: boolean;
      pendingUpgradeRequest?: any;
      requestRecord?: any;
      error?: string;
    }>(`/store/${encodeURIComponent(storeId)}/subscription-request`, {
      method: 'POST',
      body: payload,
      token,
      appId: 'store-os',
    });
  },

  async savePaymentGatewayConfig(
    payload: {
      storeId: string;
      pixKey: string;
      pixKeyType: string;
      gatewayProvider: string;
      autoTransfer: boolean;
      acceptedPaymentMethods?: string[];
    },
    token?: string
  ) {
    return requestJson<{ success: boolean }>('/store/payment-gateway-config', {
      method: 'POST',
      body: payload,
      token,
      appId: 'store-os',
    });
  },

  async emitSimulatedFiscal(
    payload: {
      storeId: string;
      nfeId: string;
      amount: number;
      itemsCount: number;
    },
    token?: string
  ) {
    return requestJson<any>('/store/fiscal/emit', {
      method: 'POST',
      body: payload,
      token,
      appId: 'store-os',
    });
  },

  async exportStoreSpedText(storeId: string, token?: string): Promise<string> {
    const base = getPlatformAdapters().network.getApiBaseUrl();
    const resp = await rawFetch(`${base}/store/export/sped?storeId=${encodeURIComponent(storeId)}`, {
      method: 'GET',
      token,
      appId: 'store-os',
      idempotency: false,
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data?.error || `Erro ao exportar SPED da loja (HTTP ${resp.status})`);
    }
    return resp.text();
  },

  async recordCashMovement(
    payload: {
      storeId: string;
      sessionId?: string;
      type: 'SANGRIA' | 'SUPRIMENTO';
      amount: number;
      reason?: string;
    },
    token?: string
  ) {
    return requestJson<{
      success: boolean;
      session: any;
      financialRecord: any;
    }>('/store/cash/movement', {
      method: 'POST',
      body: payload,
      token,
      appId: 'store-os',
    });
  },

  async getWaiterPairingPin(storeId: string, token?: string) {
    return requestJson<{ storeId: string; storeName: string; pin: string; updatedAt: string }>(
      `/store/${encodeURIComponent(storeId)}/waiter-pairing`,
      {
        method: 'GET',
        token,
        appId: 'store-os',
      }
    );
  },

  async regenerateWaiterPairingPin(storeId: string, token?: string) {
    return requestJson<{ success: boolean; storeId: string; pin: string; updatedAt: string }>(
      `/store/${encodeURIComponent(storeId)}/waiter-pairing/regenerate`,
      {
        method: 'POST',
        body: {},
        token,
        appId: 'store-os',
      }
    );
  },

  async verifyWaiterPairingPin(storeId: string, pin: string, token?: string) {
    return requestJson<{ success: boolean; verified: boolean; storeId: string; storeName: string }>(
      `/store/${encodeURIComponent(storeId)}/waiter-pairing/verify`,
      {
        method: 'POST',
        body: { pin },
        token,
        appId: 'waiter',
      }
    );
  },

  async loginWaiterByPin(payload: {
    storeId?: string;
    pin?: string;
    qrPayload?: string | Record<string, any>;
    operatorName?: string;
  }) {
    return requestJson<{
      success: boolean;
      token: string;
      user: any;
      store?: { id: string; name: string };
    }>('/store/waiter-pairing/login', {
      method: 'POST',
      body: payload,
      token: null,
      appId: 'waiter',
    });
  },

  async disconnectWaiterTerminal(token?: string) {
    return requestJson<{ success: boolean }>('/store/waiter-pairing/disconnect', {
      method: 'POST',
      body: {},
      token,
      appId: 'waiter',
    });
  },

  async getDriverPairingPin(storeId: string, token?: string) {
    return requestJson<{
      storeId: string;
      storeName: string;
      deliveryModality?: string;
      pin: string;
      updatedAt: string;
    }>(`/store/${encodeURIComponent(storeId)}/driver-pairing`, {
      method: 'GET',
      token,
      appId: 'store-os',
    });
  },

  async regenerateDriverPairingPin(storeId: string, token?: string) {
    return requestJson<{ success: boolean; storeId: string; pin: string; updatedAt: string }>(
      `/store/${encodeURIComponent(storeId)}/driver-pairing/regenerate`,
      {
        method: 'POST',
        body: {},
        token,
        appId: 'store-os',
      }
    );
  },

  async verifyDriverPairingPin(
    storeId: string,
    payload: { pin: string; vehicle?: string; vehiclePlate?: string },
    token?: string
  ) {
    return requestJson<{ success: boolean; verified: boolean; storeId: string; storeName: string }>(
      `/store/${encodeURIComponent(storeId)}/driver-pairing/verify`,
      {
        method: 'POST',
        body: payload,
        token,
        appId: 'driver',
      }
    );
  },

  async loginDriverByPin(payload: {
    storeId?: string;
    pin?: string;
    qrPayload?: string | Record<string, any>;
    driverName?: string;
    phone?: string;
    vehicle?: 'SCOOTER' | 'BIKE' | 'CAR';
    vehiclePlate?: string;
  }) {
    return requestJson<{
      success: boolean;
      token: string;
      user: any;
      driver?: any;
      store?: { id: string; name: string };
    }>('/store/driver-pairing/login', {
      method: 'POST',
      body: payload,
      token: null,
      appId: 'driver',
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
