import { getPlatformAdapters } from '@3c/platform-adapters';
import { rawFetch, requestJson } from './httpClient.ts';
import { storeHardwareAndStorageApi } from './storeHardwareAndStorageApi.ts';

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

  ...storeHardwareAndStorageApi,
};
