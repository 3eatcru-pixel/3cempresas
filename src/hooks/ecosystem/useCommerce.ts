import React from 'react';
import { CommerceService } from '../../services/CommerceService';
import { DatabaseAdapterManager } from '../../services/databaseAdapter';
import {
  MenuItem,
  Order,
  OrderChannel,
  DeliveryFleetModality,
  Store,
  CouponCampaign,
} from '../../types';
import { evaluateCheckoutCoupon } from '../../modules/marketplace/checkout/couponPricing';
import { geocodeAddressNominatim, isValidLatLng } from '../../components/common/map/mapUtils';
import { useMarketplaceGeoAndFilters } from './commerce/useMarketplaceGeoAndFilters';
import { useOrderExecutionAndPos } from './commerce/useOrderExecutionAndPos';

export interface CartItemEntry {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
  variantId?: string;
  variantLabel?: string;
}

export const useCommerce = (
  currentStore: Store,
  coupons: CouponCampaign[],
  cartTotal: number,
  cart: CartItemEntry[],
  setCart: React.Dispatch<React.SetStateAction<CartItemEntry[]>>,
  showNotification: (msg: string) => void,
  logSystemEvent: (type: string, payload: string, channel: string, tenantId?: string) => Promise<void>,
  getIdToken: () => Promise<string | undefined>,
  _orders: Order[],
  stores: Store[] = []
) => {
  const geoAndFilters = useMarketplaceGeoAndFilters(showNotification);
  const { geoAddress, userCoords } = geoAndFilters;

  const orderExecution = useOrderExecutionAndPos({
    currentStore,
    showNotification,
    logSystemEvent,
    getIdToken,
  });

  const clearCart = () => setCart([]);

  const addToCart = (
    menuItem: MenuItem,
    quantity = 1,
    notes?: string,
    variant?: { id?: string; label?: string }
  ) => {
    const targetStore =
      stores.find((s) => s.id === menuItem.storeId) ||
      (currentStore?.id === menuItem.storeId ? currentStore : undefined);
    if (targetStore?.isOpen === false) {
      showNotification(`Pedido recusado: "${targetStore.name}" encontra-se fechado no momento.`);
      return;
    }
    setCart((prev) => {
      if (prev.length > 0 && prev[0].menuItem.storeId !== menuItem.storeId) {
        showNotification('Sua sacola anterior foi atualizada para o novo estabelecimento.');
        return [{ menuItem, quantity, notes, variantId: variant?.id, variantLabel: variant?.label }];
      }
      const idx = prev.findIndex(
        (ci) =>
          ci.menuItem.id === menuItem.id &&
          (ci.notes || '') === (notes || '') &&
          (ci.variantId || '') === (variant?.id || '')
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx].quantity += quantity;
        return updated;
      }
      return [...prev, { menuItem, quantity, notes, variantId: variant?.id, variantLabel: variant?.label }];
    });
    showNotification(`Adicionado ao carrinho: ${menuItem.name}${variant?.label ? ` (${variant.label})` : ''}`);
  };

  const getCartEntryKey = (ci: CartItemEntry) =>
    `${ci.menuItem.id}::${ci.variantId || ''}::${ci.notes || ''}`;

  const removeFromCart = (idOrKey: string) =>
    setCart((prev) => prev.filter((c) => getCartEntryKey(c) !== idOrKey && c.menuItem.id !== idOrKey));

  const updateCartQuantity = (idOrKey: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(idOrKey);
      return;
    }
    setCart((prev) =>
      prev.map((c) =>
        getCartEntryKey(c) === idOrKey || c.menuItem.id === idOrKey ? { ...c, quantity: qty } : c
      )
    );
  };

  const placeMarketplaceOrder = async (
    customerName: string,
    phone: string,
    address: string,
    paymentMethod: any,
    couponCode?: string,
    notes?: string,
    orderModality: 'DELIVERY' | 'PICKUP' | 'TABLE' = 'DELIVERY',
    tableNumber?: number,
    courierTip: number = 0,
    deliveryCoordsOverride?: [number, number]
  ): Promise<Order | null> => {
    if (!cart || cart.length === 0) {
      showNotification('Sua sacola está vazia. Adicione itens antes de finalizar.');
      return null;
    }
    if (orderModality === 'DELIVERY' && (!address || address.trim().length < 5)) {
      showNotification('Informe um endereço de entrega válido.');
      return null;
    }
    const cartStoreId = cart[0]?.menuItem?.storeId;
    const store = (cartStoreId ? stores.find((s) => s.id === cartStoreId) : null) || currentStore;
    if (store?.isOpen === false) {
      showNotification(`Pedido recusado automaticamente: "${store.name}" encontra-se fechado no momento.`);
      return null;
    }
    const token = await getIdToken();
    if (!token) {
      showNotification('Você precisa estar logado para finalizar o pedido.');
      return null;
    }

    let discount = 0;
    if (couponCode) {
      const evalResult = evaluateCheckoutCoupon({
        coupons,
        couponCode,
        storeId: store.id,
        cartTotal,
      });
      discount = evalResult.discount;
    }

    const modality: DeliveryFleetModality = store.deliveryModality || 'PLATFORM_FLEET';
    const effectiveDeliveryFee =
      orderModality === 'TABLE' || orderModality === 'PICKUP'
        ? 0
        : modality === 'STORE_FLEET'
        ? store.ownFleetCustomFee ?? store.deliveryFee
        : store.deliveryFee;
    const effectiveCourierTip =
      orderModality === 'DELIVERY' && Number.isFinite(courierTip) && courierTip >= 0
        ? Math.min(500, Math.round(courierTip * 100) / 100)
        : 0;
    const finalTotal = Math.max(0, cartTotal + effectiveDeliveryFee + effectiveCourierTip - discount);
    const channel: OrderChannel =
      orderModality === 'TABLE' ? 'TABLE' : orderModality === 'PICKUP' ? 'PICKUP' : 'MARKETPLACE';
    const finalDeliveryAddress =
      orderModality === 'TABLE'
        ? `Mesa ${tableNumber || 1} (Autoatendimento no Salão)`
        : orderModality === 'PICKUP'
        ? `Retirada no Balcão (${store.name})`
        : address;

    let resolvedDeliveryLatLng: [number, number] | null = null;
    if (orderModality === 'DELIVERY') {
      if (deliveryCoordsOverride && isValidLatLng(deliveryCoordsOverride[0], deliveryCoordsOverride[1])) {
        resolvedDeliveryLatLng = deliveryCoordsOverride;
      } else if (
        address.trim().toLowerCase() === geoAddress.trim().toLowerCase() &&
        isValidLatLng(userCoords[0], userCoords[1])
      ) {
        resolvedDeliveryLatLng = userCoords;
      } else {
        const geocodedDelivery = await geocodeAddressNominatim(address, {
          countryCodes: 'br',
          biasCoords: isValidLatLng(userCoords[0], userCoords[1]) ? userCoords : undefined,
        });
        if (geocodedDelivery && isValidLatLng(geocodedDelivery.lat, geocodedDelivery.lng)) {
          resolvedDeliveryLatLng = [geocodedDelivery.lat, geocodedDelivery.lng];
        } else if (isValidLatLng(userCoords[0], userCoords[1])) {
          resolvedDeliveryLatLng = userCoords;
        }
      }
    }

    const newOrderData: any = {
      storeId: store.id,
      channel,
      tableNumber: orderModality === 'TABLE' ? tableNumber || 1 : undefined,
      customerName: customerName || (orderModality === 'TABLE' ? `Mesa ${tableNumber || 1}` : 'Cliente'),
      customerPhone: phone || '',
      deliveryAddress: finalDeliveryAddress,
      ...(orderModality === 'DELIVERY' &&
      resolvedDeliveryLatLng &&
      isValidLatLng(resolvedDeliveryLatLng[0], resolvedDeliveryLatLng[1])
        ? { deliveryLatitude: resolvedDeliveryLatLng[0], deliveryLongitude: resolvedDeliveryLatLng[1] }
        : {}),
      notes: notes || '',
      couponCode: couponCode || '',
      deliveryFee: effectiveDeliveryFee,
      courierTip: effectiveCourierTip,
      discount,
      items: cart.map((ci) => ({
        menuItemId: ci.menuItem.id,
        name: ci.variantLabel
          ? `${ci.menuItem.name} [${ci.variantLabel}]${ci.notes ? ` (${ci.notes})` : ''}`
          : ci.notes
          ? `${ci.menuItem.name} (${ci.notes})`
          : ci.menuItem.name,
        price: ci.menuItem.price,
        quantity: ci.quantity,
        notes: ci.notes || '',
        variantId: ci.variantId,
        variantLabel: ci.variantLabel,
      })),
      total: finalTotal,
      paymentMethod,
      deliveryModality: modality,
      token,
    };

    const result = await CommerceService.placeOrder(newOrderData);

    if (result.success) {
      const channelLabel =
        orderModality === 'TABLE' ? `Autoatendimento Mesa #${tableNumber || 1}` : 'Marketplace';
      void logSystemEvent(
        'ORDER_CREATED',
        `Pedido #${result.transaction.code} (${channelLabel}) recebido.`,
        'commerce/orders'
      );
      clearCart();
      if (orderModality === 'TABLE' && paymentMethod === 'TABLE_BILL') {
        showNotification(
          `Rodada ${result.transaction.code} enviada para a cozinha • Comanda Mesa ${String(
            tableNumber || 1
          ).padStart(2, '0')}!`
        );
      } else {
        showNotification(`Pedido ${result.transaction.code} enviado com sucesso!`);
      }
      return {
        id: result.transaction.orderId,
        code: result.transaction.code,
        ...newOrderData,
        ...result.transaction,
      };
    } else {
      showNotification(result.error || 'Erro ao enviar pedido.');
      return null;
    }
  };

  const requestTableBill = async (
    storeId: string,
    tableNumber: number,
    includeServiceFee: boolean,
    splitCount: number,
    totalWithService: number
  ): Promise<boolean> => {
    try {
      const token = await getIdToken();
      if (!token) {
        const adapter = DatabaseAdapterManager.getAdapter();
        const tables = await adapter.getTables(storeId);
        const target = tables.find((t) => t.tableNumber === tableNumber);
        if (target) {
          await adapter.updateTableStatus(target.id, 'BILL_REQUESTED');
        }
        showNotification(`Fechamento da Mesa ${String(tableNumber).padStart(2, '0')} solicitado!`);
        return true;
      }

      const result = await CommerceService.requestTableBill({
        storeId,
        tableNumber,
        includeServiceFee,
        splitCount,
        totalWithService,
        token,
      });

      if (result.success) {
        void logSystemEvent(
          'BILL_REQUESTED',
          `Solicitação de fechamento de conta para Mesa ${tableNumber} (Total: R$ ${totalWithService.toFixed(
            2
          )}, ${splitCount}x)`,
          'service/billing'
        );
        showNotification(
          `Fechamento da Mesa ${String(tableNumber).padStart(2, '0')} solicitado ao garçom/caixa!`
        );
        return true;
      }
      showNotification(result.error || 'Erro ao solicitar fechamento da mesa.');
      return false;
    } catch {
      showNotification('Erro ao solicitar fechamento da mesa.');
      return false;
    }
  };

  return {
    ...geoAndFilters,
    ...orderExecution,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    placeMarketplaceOrder,
    requestTableBill,
  };
};
