import { CommerceService } from '../../../services/CommerceService';
import { MenuItem, Order, OrderStatus, Store } from '../../../types';

interface UseOrderExecutionAndPosParams {
  currentStore: Store;
  showNotification: (msg: string) => void;
  logSystemEvent: (type: string, payload: string, channel: string, tenantId?: string) => Promise<void>;
  getIdToken: () => Promise<string | undefined>;
}

export const useOrderExecutionAndPos = ({
  currentStore,
  showNotification,
  logSystemEvent,
  getIdToken,
}: UseOrderExecutionAndPosParams) => {
  const createPosOrder = async (
    customerName: string,
    items: {
      menuItem: MenuItem;
      qty: number;
      notes?: string;
      variantId?: string;
      variantLabel?: string;
      serialNumber?: string;
    }[],
    paymentMethod: any,
    discount: number = 0,
    couponCode: string = '',
    channelOverride: 'POS' | 'KIOSK' = 'POS',
    metadata?: {
      notes?: string;
      professionalId?: string;
      professionalName?: string;
      commissionRate?: number;
      commissionAmount?: number;
      reservationId?: string;
      scheduledDeliveryDate?: string;
      scheduledDeliveryPeriod?: 'MANHÃ' | 'TARDE' | 'NOITE';
      assemblyRequired?: boolean;
      paymentConfirmed?: boolean;
      providerTransactionId?: string;
      crmCustomerId?: string;
      customerPhone?: string;
    }
  ): Promise<Order | null> => {
    const store = currentStore;
    const token = await getIdToken();
    if (!token) {
      showNotification('Sessão expirada. Faça login novamente.');
      return null;
    }

    const subtotal = items.reduce((sum, i) => sum + i.menuItem.price * i.qty, 0);
    const finalTotal = Math.max(0, subtotal - discount);

    const orderData: any = {
      storeId: store.id,
      channel: channelOverride,
      crmCustomerId: metadata?.crmCustomerId,
      customerName: customerName || (channelOverride === 'KIOSK' ? 'Cliente Totem' : 'Cliente Balcão'),
      customerPhone: metadata?.customerPhone,
      notes: metadata?.notes || '',
      professionalId: metadata?.professionalId,
      professionalName: metadata?.professionalName,
      commissionRate: metadata?.commissionRate,
      commissionAmount: metadata?.commissionAmount,
      reservationId: metadata?.reservationId,
      scheduledDeliveryDate: metadata?.scheduledDeliveryDate,
      scheduledDeliveryPeriod: metadata?.scheduledDeliveryPeriod,
      assemblyRequired: metadata?.assemblyRequired,
      providerTransactionId: metadata?.providerTransactionId,
      items: items.map((i) => ({
        menuItemId: i.menuItem.id,
        name: i.variantLabel
          ? `${i.menuItem.name} [${i.variantLabel}]${i.notes ? ` (${i.notes})` : ''}`
          : i.notes
          ? `${i.menuItem.name} (${i.notes})`
          : i.menuItem.name,
        price: i.menuItem.price,
        quantity: i.qty,
        notes: i.notes || '',
        variantId: i.variantId,
        variantLabel: i.variantLabel,
        serialNumber: i.serialNumber,
      })),
      total: finalTotal,
      discount,
      couponCode,
      paymentMethod,
      paymentConfirmed:
        metadata?.paymentConfirmed !== undefined
          ? Boolean(metadata?.paymentConfirmed)
          : channelOverride !== 'KIOSK' &&
            (paymentMethod === 'CASH' || Boolean(metadata?.providerTransactionId)),
      token,
    };

    const result = await CommerceService.placeOrder(orderData);
    if (result.success) {
      void logSystemEvent(
        'ORDER_CREATED',
        `Pedido ${channelOverride} #${result.transaction.code} processado pelo Server Core.`,
        'commerce/orders'
      );
      showNotification(
        channelOverride === 'KIOSK'
          ? `Pedido ${result.transaction.code} enviado ao KDS!`
          : `Venda PDV ${result.transaction.code} concluída!`
      );
      return {
        id: result.transaction.orderId,
        code: result.transaction.code,
        ...orderData,
        ...result.transaction,
      };
    } else {
      showNotification(`Erro no ${channelOverride}: ${result.error || 'Falha ao processar venda.'}`);
      return null;
    }
  };

  const updateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    cancelReason?: string,
    driverId?: string,
    driverName?: string
  ) => {
    try {
      const token = await getIdToken();
      if (!token) {
        showNotification('Sessão expirada. Faça login novamente.');
        return;
      }

      const result = await CommerceService.updateOrderStatus(
        orderId,
        status,
        token,
        cancelReason,
        driverId,
        driverName
      );
      if (result.success) {
        showNotification(`Status do Pedido atualizado para ${status}`);
        void logSystemEvent(
          'ORDER_STATUS_UPDATE',
          `Pedido #${orderId} alterado para ${status}`,
          'commerce/orders'
        );
      } else {
        showNotification(`Erro ao atualizar pedido: ${result.error || 'Falha no servidor.'}`);
      }
    } catch {
      showNotification('Erro na comunicação com o servidor.');
    }
  };

  const cancelCustomerOrder = async (orderId: string, reason?: string): Promise<boolean> => {
    try {
      const token = await getIdToken();
      if (!token) {
        showNotification('Sessão expirada. Faça login novamente.');
        return false;
      }

      const result = await CommerceService.cancelOrder(orderId, reason, token);
      if (result.success) {
        showNotification('Pedido cancelado e estoque restaurado!');
        void logSystemEvent(
          'ORDER_CANCELLED_BY_CONSUMER',
          `Pedido #${orderId} cancelado pelo consumidor`,
          'commerce/orders'
        );
        return true;
      }
      showNotification(result.error || 'Não foi possível cancelar o pedido.');
      return false;
    } catch {
      showNotification('Erro na comunicação com o servidor ao cancelar pedido.');
      return false;
    }
  };

  const confirmOrderPayment = async (
    orderId: string,
    paymentMethod?: string,
    providerTransactionId?: string
  ): Promise<boolean> => {
    try {
      const token = await getIdToken();
      if (!token) {
        showNotification('Sessão expirada. Faça login novamente.');
        return false;
      }
      const result = await CommerceService.confirmOrderPayment(
        orderId,
        token,
        paymentMethod,
        providerTransactionId
      );
      if (result.success) {
        void logSystemEvent(
          'ORDER_PAYMENT_CONFIRMED',
          `Pagamento do pedido #${orderId} confirmado (${result.paymentMethod || paymentMethod || 'CASH'}).`,
          'commerce/payments'
        );
        return true;
      }
      showNotification(result.error || 'Erro ao confirmar pagamento do pedido.');
      return false;
    } catch {
      showNotification('Erro na comunicação ao confirmar pagamento.');
      return false;
    }
  };

  return {
    createPosOrder,
    updateOrderStatus,
    cancelCustomerOrder,
    confirmOrderPayment,
  };
};
