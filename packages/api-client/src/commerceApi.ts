import { getPlatformAdapters } from '@3c/platform-adapters';
import { rawFetch, requestJson } from './httpClient.ts';

export const commerceApi = {
  async placeOrder(
    orderData: Record<string, any> & { token?: string; idempotencyKey?: string }
  ): Promise<{ success: boolean; transaction: any; error?: string }> {
    const base = getPlatformAdapters().network.getApiBaseUrl();
    const resp = await rawFetch(`${base}/commerce/orders`, {
      method: 'POST',
      body: orderData,
      token: orderData.token,
      idempotency: true,
      idempotencyKey: orderData.idempotencyKey,
    });
    return await resp.json();
  },

  async cancelCustomerOrder(orderId: string, reason?: string, token?: string) {
    return requestJson<{
      success: boolean;
      orderId: string;
      status: string;
      order?: any;
      error?: string;
    }>(`/commerce/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      body: reason ? { reason } : {},
      token,
      appId: 'marketplace',
    });
  },

  async confirmOrderPayment(
    orderId: string,
    payload?: { paymentMethod?: string; providerTransactionId?: string },
    token?: string
  ) {
    return requestJson<{
      success: boolean;
      orderId: string;
      paymentStatus: string;
      paymentMethod?: string;
      error?: string;
    }>(`/commerce/orders/${encodeURIComponent(orderId)}/confirm-payment`, {
      method: 'POST',
      body: payload || {},
      token,
      appId: 'store-os',
    });
  },

  async returnOrderItem(
    orderId: string,
    payload: {
      itemIndex?: number;
      menuItemId?: string;
      variantId?: string;
      quantity?: number;
      reason?: string;
    },
    token?: string
  ) {
    return requestJson<{
      success: boolean;
      orderId: string;
      itemIndex: number;
      returnedQuantity: number;
      refundAmount: number;
      stockRestored: number;
      financialRecord?: any;
      order?: any;
      error?: string;
    }>(`/commerce/orders/${encodeURIComponent(orderId)}/return`, {
      method: 'POST',
      body: payload,
      token,
      appId: 'store-os',
    });
  },

  async updateCoupon(id: string, updates: Record<string, any>, token?: string) {
    return requestJson<{ success: boolean; coupon?: any }>(
      `/commerce/coupons/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: updates,
        token,
        appId: 'hq',
      }
    );
  },

  async deleteCoupon(id: string, token?: string) {
    return requestJson<{ success: boolean; deletedId: string }>(
      `/commerce/coupons/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        token,
        appId: 'hq',
      }
    );
  },

  async listDriverPayouts(driverId: string, token?: string) {
    return requestJson<any[]>(
      `/commerce/drivers/${encodeURIComponent(driverId)}/payouts`,
      {
        method: 'GET',
        token,
        appId: 'driver',
      }
    );
  },

  async requestDriverWithdraw(driverId: string, payload: { amount: number; pixKey: string }, token?: string) {
    return requestJson<{ success: boolean; payout: any; walletBalance: number }>(
      `/commerce/drivers/${encodeURIComponent(driverId)}/withdraw`,
      {
        method: 'POST',
        body: payload,
        token,
        appId: 'driver',
      }
    );
  },

  async assignOrderDriver(orderId: string, driverId: string, token?: string) {
    return requestJson<{ success: boolean; orderId: string; driverId: string; driverName: string; error?: string }>(
      `/commerce/orders/${encodeURIComponent(orderId)}/assign-driver`,
      {
        method: 'POST',
        body: { driverId },
        token,
        appId: 'store-os',
      }
    );
  },
};
