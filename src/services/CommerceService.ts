import { OrderStatus, DeliveryFleetModality } from '../types';
import { buildStandardContractHeaders, getPlatformAdapters } from '../core/platform/PlatformAdapter';

export const CommerceService = {
  async placeOrder(orderData: {
    storeId: string;
    customerName: string;
    customerPhone?: string;
    deliveryAddress?: string;
    notes?: string;
    couponCode?: string;
    deliveryFee?: number;
    discount?: number;
    courierTip?: number;
    channel?: string;
    tableNumber?: number;
    items: { menuItemId: string; name?: string; price: number; quantity: number }[];
    total: number;
    paymentMethod: string;
    deliveryModality?: DeliveryFleetModality;
    token: string; // Autonomous HMAC Session Token
    idempotencyKey?: string;
  }): Promise<{ success: boolean; transaction: any; error?: string }> {
    try {
      const baseUrl = getPlatformAdapters().network.getApiBaseUrl();
      const response = await fetch(`${baseUrl}/commerce/orders`, {
        method: 'POST',
        headers: buildStandardContractHeaders({
          token: orderData.token,
          includeIdempotencyKey: true,
          existingIdempotencyKey: orderData.idempotencyKey,
        }),
        body: JSON.stringify(orderData),
      });

      return await response.json();
    } catch (error) {
      console.warn('CommerceService.placeOrder warning:', error);
      return { success: false, transaction: null, error: 'Erro ao processar pedido no Server Core.' };
    }
  },

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    token: string,
    cancelReason?: string,
    driverId?: string,
    driverName?: string,
    deliveryPin?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const baseUrl = getPlatformAdapters().network.getApiBaseUrl();
      const response = await fetch(`${baseUrl}/commerce/orders/${orderId}/status`, {
        method: 'POST',
        headers: buildStandardContractHeaders({ token, includeIdempotencyKey: true }),
        body: JSON.stringify({
          status,
          cancelReason,
          driverId,
          driverName,
          ...(deliveryPin !== undefined ? { deliveryPin } : {}),
        }),
      });

      return await response.json();
    } catch (error) {
      console.warn('CommerceService.updateOrderStatus warning:', error);
      return { success: false, error: 'Erro ao atualizar status do pedido no Server Core.' };
    }
  },

  async cancelOrder(
    orderId: string,
    reason: string | undefined,
    token: string
  ): Promise<{ success: boolean; status?: string; order?: any; error?: string }> {
    try {
      const baseUrl = getPlatformAdapters().network.getApiBaseUrl();
      const response = await fetch(`${baseUrl}/commerce/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
        headers: buildStandardContractHeaders({ token, includeIdempotencyKey: true }),
        body: JSON.stringify(reason ? { reason } : {}),
      });

      return await response.json();
    } catch (error) {
      console.warn('CommerceService.cancelOrder warning:', error);
      return { success: false, error: 'Erro ao cancelar pedido no Server Core.' };
    }
  },

  async confirmOrderPayment(
    orderId: string,
    token: string,
    paymentMethod?: string,
    providerTransactionId?: string
  ): Promise<{ success: boolean; paymentStatus?: string; paymentMethod?: string; error?: string }> {
    try {
      const baseUrl = getPlatformAdapters().network.getApiBaseUrl();
      const response = await fetch(`${baseUrl}/commerce/orders/${encodeURIComponent(orderId)}/confirm-payment`, {
        method: 'POST',
        headers: buildStandardContractHeaders({ token, includeIdempotencyKey: true }),
        body: JSON.stringify({
          ...(paymentMethod ? { paymentMethod } : {}),
          ...(providerTransactionId ? { providerTransactionId } : {}),
        }),
      });
      return await response.json();
    } catch (error) {
      console.warn('CommerceService.confirmOrderPayment warning:', error);
      return { success: false, error: 'Erro ao confirmar pagamento do pedido no servidor.' };
    }
  },

  async requestTableBill(payload: {
    storeId: string;
    tableNumber: number;
    includeServiceFee: boolean;
    splitCount: number;
    totalWithService: number;
    token: string;
  }): Promise<{ success: boolean; tableId?: string | null; error?: string }> {
    try {
      const baseUrl = getPlatformAdapters().network.getApiBaseUrl();
      const response = await fetch(`${baseUrl}/store/tables/request-bill`, {
        method: 'POST',
        headers: buildStandardContractHeaders({ token: payload.token, includeIdempotencyKey: true }),
        body: JSON.stringify({
          storeId: payload.storeId,
          tableNumber: payload.tableNumber,
          includeServiceFee: payload.includeServiceFee,
          splitCount: payload.splitCount,
          totalWithService: payload.totalWithService,
        }),
      });
      return await response.json();
    } catch (error) {
      console.warn('CommerceService.requestTableBill warning:', error);
      return { success: false, error: 'Erro ao solicitar fechamento de mesa.' };
    }
  },

  async returnOrderItem(payload: {
    orderId: string;
    itemIndex?: number;
    menuItemId?: string;
    variantId?: string;
    quantity?: number;
    reason?: string;
    token: string;
  }): Promise<{
    success: boolean;
    returnedQuantity?: number;
    refundAmount?: number;
    stockRestored?: number;
    financialRecord?: any;
    order?: any;
    error?: string;
  }> {
    try {
      const baseUrl = getPlatformAdapters().network.getApiBaseUrl();
      const response = await fetch(`${baseUrl}/commerce/orders/${encodeURIComponent(payload.orderId)}/return`, {
        method: 'POST',
        headers: buildStandardContractHeaders({ token: payload.token, includeIdempotencyKey: true }),
        body: JSON.stringify({
          itemIndex: payload.itemIndex,
          menuItemId: payload.menuItemId,
          variantId: payload.variantId,
          quantity: payload.quantity ?? 1,
          reason: payload.reason,
        }),
      });
      return await response.json();
    } catch (error) {
      console.warn('CommerceService.returnOrderItem warning:', error);
      return { success: false, error: 'Erro ao processar estorno/troca no Server Core.' };
    }
  },
};
