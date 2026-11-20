import { requestJson } from './httpClient.ts';

export interface StripePublicConfigResponse {
  configured: boolean;
  secretConfigured: boolean;
  webhookSecretConfigured: boolean;
  mode: 'test' | 'live' | 'unconfigured';
  publishableKey: string | null;
  currency: string;
  businessDomain: string;
  products: {
    payments: boolean;
    billing: boolean;
    connect: boolean;
    invoicing: boolean;
  };
}

export interface StripeHealthResponse extends StripePublicConfigResponse {
  healthy: boolean;
  accountId?: string;
  country?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  availableBalances?: Array<{ currency: string; amountMajor: number }>;
  pendingBalances?: Array<{ currency: string; amountMajor: number }>;
  checkedAt?: string;
  reason?: string;
  error?: string;
}

export interface StripeInvoiceSummary {
  id: string;
  number: string | null;
  status: string;
  amountBrl: number;
  amountPaidBrl?: number;
  currency: string;
  description: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  dueDate: string | null;
  createdAt: string;
}

export const stripeApi = {
  async getStripeConfig() {
    return requestJson<StripePublicConfigResponse>('/stripe/config', {
      method: 'GET',
    });
  },

  async getStripeHealth(token?: string) {
    return requestJson<StripeHealthResponse>('/stripe/health', {
      method: 'GET',
      token,
      appId: 'hq',
    });
  },

  async createOrderStripeIntent(orderId: string, token?: string) {
    return requestJson<{
      success: boolean;
      orderId: string;
      paymentIntentId: string;
      clientSecret: string | null;
      amountMinor: number;
      currency: string;
      status: string;
      connectSplitApplied: boolean;
      applicationFeeAmount: number;
    }>('/stripe/payments/intent', {
      method: 'POST',
      body: { orderId },
      token,
      appId: 'marketplace',
    });
  },

  async createOrderStripeCheckout(
    orderId: string,
    urls?: { successUrl?: string; cancelUrl?: string },
    token?: string
  ) {
    return requestJson<{
      success: boolean;
      orderId: string;
      sessionId: string;
      url: string | null;
      amountMinor: number;
      currency: string;
      connectSplitApplied: boolean;
      applicationFeeAmount: number;
    }>('/stripe/payments/checkout-session', {
      method: 'POST',
      body: { orderId, ...(urls || {}) },
      token,
      appId: 'marketplace',
    });
  },

  async createStoreConnectAccount(storeId: string, email?: string, token?: string) {
    return requestJson<{
      success: boolean;
      storeId: string;
      accountId: string;
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
      detailsSubmitted: boolean;
      created: boolean;
    }>('/stripe/connect/account', {
      method: 'POST',
      body: { storeId, ...(email ? { email } : {}) },
      token,
      appId: 'store-os',
    });
  },

  async createStoreConnectOnboardingLink(
    storeId: string,
    urls?: { refreshUrl?: string; returnUrl?: string },
    token?: string
  ) {
    return requestJson<{
      success: boolean;
      storeId: string;
      accountId: string;
      url: string;
      expiresAt: number;
    }>('/stripe/connect/onboarding-link', {
      method: 'POST',
      body: { storeId, ...(urls || {}) },
      token,
      appId: 'store-os',
    });
  },

  async getStoreConnectStatus(storeId: string, token?: string) {
    return requestJson<{
      connected: boolean;
      storeId: string;
      accountId?: string;
      chargesEnabled: boolean;
      payoutsEnabled: boolean;
      detailsSubmitted: boolean;
      requirementsDue?: string[];
    }>(`/stripe/connect/status/${encodeURIComponent(storeId)}`, {
      method: 'GET',
      token,
      appId: 'store-os',
    });
  },

  async createStoreSubscriptionCheckout(
    payload: {
      storeId: string;
      requestedPlan: string;
      billingCycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
      couponCode?: string;
      successUrl?: string;
      cancelUrl?: string;
    },
    token?: string
  ) {
    return requestJson<{
      success: boolean;
      storeId: string;
      sessionId: string;
      url: string | null;
      customerId: string;
      amountMinor: number;
      currency: string;
    }>('/stripe/billing/subscription-checkout', {
      method: 'POST',
      body: payload,
      token,
      appId: 'store-os',
    });
  },

  async createStoreBillingPortal(storeId: string, returnUrl?: string, token?: string) {
    return requestJson<{
      success: boolean;
      storeId: string;
      url: string;
      customerId: string;
    }>('/stripe/billing/portal', {
      method: 'POST',
      body: { storeId, ...(returnUrl ? { returnUrl } : {}) },
      token,
      appId: 'store-os',
    });
  },

  async createStripeInvoice(
    payload: {
      storeId: string;
      amount: number;
      description: string;
      customerEmail?: string;
      daysUntilDue?: number;
      sendNow?: boolean;
    },
    token?: string
  ) {
    return requestJson<{
      success: boolean;
      invoice: StripeInvoiceSummary;
    }>('/stripe/invoices', {
      method: 'POST',
      body: payload,
      token,
      appId: 'store-os',
    });
  },

  async listStripeInvoices(storeId: string, token?: string) {
    return requestJson<{
      storeId: string;
      invoices: StripeInvoiceSummary[];
    }>(`/stripe/invoices?storeId=${encodeURIComponent(storeId)}`, {
      method: 'GET',
      token,
      appId: 'store-os',
    });
  },
};
