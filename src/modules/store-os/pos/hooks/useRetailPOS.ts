import { useState, useRef, useEffect } from 'react';
import { MenuItem, MenuItemVariant, Order, Store, CouponCampaign, CustomerCRM } from '../../../../types';
import { RetailCartLine } from '../layout/RetailPosScanTable';
import { getPlatformAdapters } from '../../../../core/platform/PlatformAdapter';
import { StorageService } from '../../../../services/StorageService';
import { syncEngine } from '../../../../core/sync/SyncEngine';
import { useRetailExchangeAndReturn } from './useRetailExchangeAndReturn';

interface UseRetailPOSParams {
  currentStore: Store;
  menuItems: MenuItem[];
  orders: Order[];
  coupons: CouponCampaign[];
  createPosOrder: (
    customerName: string,
    items: any[],
    paymentMethod: any,
    discount?: number,
    couponCode?: string,
    channel?: 'POS' | 'KIOSK',
    options?: any
  ) => Promise<any>;
  showNotification: (msg: string) => void;
  getIdToken: () => Promise<string | null | undefined>;
}

export function useRetailPOS({
  currentStore,
  menuItems,
  orders,
  coupons,
  createPosOrder,
  showNotification,
  getIdToken,
}: UseRetailPOSParams) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<RetailCartLine[]>([]);
  const [lastOrderForReceipt, setLastOrderForReceipt] = useState<any | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [selectedCrmCustomer, setSelectedCrmCustomer] = useState<CustomerCRM | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [variantPickerItem, setVariantPickerItem] = useState<MenuItem | null>(null);
  const [scheduledDeliveryDate, setScheduledDeliveryDate] = useState('');
  const [scheduledDeliveryPeriod, setScheduledDeliveryPeriod] = useState<'MANHÃ' | 'TARDE' | 'NOITE'>('TARDE');
  const [assemblyRequired, setAssemblyRequired] = useState(false);

  const exchangeState = useRetailExchangeAndReturn({
    currentStore,
    orders,
    showNotification,
    getIdToken,
  });

  const filteredItems = menuItems.filter(
    (m) =>
      m.storeId === currentStore.id &&
      (m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.barcode?.includes(searchQuery))
  );

  const pushCartLine = (item: MenuItem, variant?: MenuItemVariant) => {
    const lineKey = variant ? `${item.id}::${variant.id}` : item.id;
    const variantLabel = variant
      ? [variant.color, variant.size].filter(Boolean).join(' • ')
      : undefined;
    setSelectedItems((prev) => {
      const existing = prev.find((i) => i.lineKey === lineKey);
      if (existing) {
        return prev.map((i) => (i.lineKey === lineKey ? { ...i, qty: i.qty + 1 } : i));
      }
      return [
        { lineKey, menuItem: item, qty: 1, variantId: variant?.id, variantLabel, serialNumber: '' },
        ...prev,
      ];
    });
    if (item.specs?.segment === 'FURNITURE' || item.specs?.defaultDeliveryLeadDays) {
      if (!scheduledDeliveryDate) {
        const days = Math.max(1, Number(item.specs?.defaultDeliveryLeadDays) || 3);
        const targetDate = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
        setScheduledDeliveryDate(targetDate);
      }
      if (item.specs?.assemblyRequired) {
        setAssemblyRequired(true);
      }
    }
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  const addItem = (item: MenuItem) => {
    if (item.variants && item.variants.length > 0) {
      setVariantPickerItem(item);
      return;
    }
    pushCartLine(item);
  };

  const total = selectedItems.reduce((acc, i) => acc + i.menuItem.price * i.qty, 0);

  const handleApplyCoupon = () => {
    if (!couponCode) return;
    const normalized = couponCode.trim().toUpperCase();
    const c = coupons.find((cp) => {
      if (cp.code.toUpperCase() !== normalized || cp.isActive === false) return false;
      if (cp.storeId && cp.storeId !== currentStore.id) return false;
      if (cp.validUntil && new Date(cp.validUntil).getTime() < Date.now()) return false;
      if ((cp.usageCount || 0) >= (cp.usageLimit || 999999)) return false;
      return true;
    });
    if (!c) {
      showNotification('Cupom inválido, expirado ou não aplicável a esta filial.');
      setAppliedDiscount(0);
      return;
    }
    if (total < (c.minOrderValue || 0)) {
      showNotification(`Cupom exige pedido mínimo de R$ ${(c.minOrderValue || 0).toFixed(2)}.`);
      setAppliedDiscount(0);
      return;
    }
    const disc =
      c.discountType === 'PERCENT'
        ? Math.round(((total * c.discountValue) / 100) * 100) / 100
        : Math.min(total, Math.max(0, c.discountValue));
    setAppliedDiscount(disc);
    showNotification(`Cupom ${c.code} aplicado!`);
  };

  const updateQty = (lineKey: string, delta: number) => {
    setSelectedItems((prev) =>
      prev
        .map((i) => (i.lineKey === lineKey ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const updateSerial = (lineKey: string, serialNumber: string) => {
    setSelectedItems((prev) =>
      prev.map((i) => (i.lineKey === lineKey ? { ...i, serialNumber } : i))
    );
  };

  const showDeliverySchedule =
    currentStore.category === 'FURNITURE' ||
    selectedItems.some(
      (i) => i.menuItem.specs?.segment === 'FURNITURE' || Boolean(i.menuItem.specs?.defaultDeliveryLeadDays)
    );

  const handleFinish = async (
    method:
      | 'PIX'
      | 'CREDIT_CARD'
      | 'DEBIT_CARD'
      | 'CASH'
      | 'BOLETO'
      | 'BANK_TRANSFER'
      | 'PAYMENT_LINK'
  ) => {
    if (selectedItems.length === 0) return;

    const missingSerial = selectedItems.find(
      (i) => i.menuItem.specs?.requiresSerialOrImei && !i.serialNumber?.trim()
    );
    if (missingSerial) {
      showNotification(
        `Informe o Número de Série / IMEI para "${missingSerial.menuItem.name}" antes de finalizar.`
      );
      return;
    }

    const getMethodLabel = (m: string) => {
      switch (m) {
        case 'PIX':
          return 'PIX DINÂMICO';
        case 'CREDIT_CARD':
          return 'CARTÃO DE CRÉDITO';
        case 'DEBIT_CARD':
          return 'CARTÃO DE DÉBITO';
        case 'CASH':
          return 'DINHEIRO';
        case 'BOLETO':
          return 'BOLETO BANCÁRIO';
        case 'BANK_TRANSFER':
          return 'TED / TRANSFERÊNCIA';
        case 'PAYMENT_LINK':
          return 'LINK DE PAGAMENTO';
        default:
          return m;
      }
    };

    setIsFinishing(true);
    try {
      const platform = getPlatformAdapters();
      const resolvedCustomerName =
        selectedCrmCustomer?.name || customerName.trim() || 'Cliente Varejo';
      const offlineOrderFallback = {
        storeId: currentStore.id,
        channel: 'POS',
        deliveryModality: 'PICKUP',
        code: `#OFF-${Math.floor(1000 + Math.random() * 9000)}`,
        customerName: resolvedCustomerName,
        ...(selectedCrmCustomer
          ? { crmCustomerId: selectedCrmCustomer.id, customerPhone: selectedCrmCustomer.phone }
          : {}),
        items: selectedItems.map((i) => ({
          ...i.menuItem,
          menuItemId: i.menuItem.id,
          quantity: i.qty,
          variantId: i.variantId,
          variantLabel: i.variantLabel,
          serialNumber: i.serialNumber?.trim() || undefined,
        })),
        discount: appliedDiscount,
        couponCode,
        total: Math.max(0, total - appliedDiscount),
        paymentMethod: method,
        ...(showDeliverySchedule && scheduledDeliveryDate
          ? {
              scheduledDeliveryDate,
              scheduledDeliveryPeriod,
              assemblyRequired,
            }
          : {}),
        createdAt: new Date().toISOString(),
      };

      let order: any = null;
      let usedOfflineFallback = false;
      if (!platform.network.isOnline() && !platform.network.getEdgeBaseUrl()) {
        usedOfflineFallback = true;
        await StorageService.saveOfflineOrder(offlineOrderFallback);
        await syncEngine.refreshCounts();
        order = offlineOrderFallback;
        showNotification('Sem internet! Venda varejo salva na fila offline.');
      } else {
        try {
          order = await createPosOrder(
            resolvedCustomerName,
            selectedItems.map((i) => ({
              menuItem: i.menuItem,
              qty: i.qty,
              variantId: i.variantId,
              variantLabel: i.variantLabel,
              serialNumber: i.serialNumber?.trim() || undefined,
            })),
            method,
            appliedDiscount,
            couponCode,
            'POS',
            {
              ...(showDeliverySchedule && scheduledDeliveryDate
                ? {
                     scheduledDeliveryDate,
                     scheduledDeliveryPeriod,
                     assemblyRequired,
                  }
                : {}),
              ...(selectedCrmCustomer
                ? { crmCustomerId: selectedCrmCustomer.id, customerPhone: selectedCrmCustomer.phone }
                : {}),
              paymentConfirmed: method !== 'BOLETO' && method !== 'PAYMENT_LINK',
              providerTransactionId: `RETAIL-TX-${Date.now().toString(36).toUpperCase()}`,
            }
          );
          if (!order) {
            usedOfflineFallback = true;
            await StorageService.saveOfflineOrder(offlineOrderFallback);
            await syncEngine.refreshCounts();
            order = offlineOrderFallback;
            showNotification('Venda salva na fila offline para sincronização.');
          }
        } catch {
          usedOfflineFallback = true;
          await StorageService.saveOfflineOrder(offlineOrderFallback);
          await syncEngine.refreshCounts();
          order = offlineOrderFallback;
          showNotification('Erro na rede! Venda varejo salva na fila offline.');
        }
      }

      if (order) {
        setLastOrderForReceipt({
          ...order,
          items: order.items.map((i: any) => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            variantLabel: i.variantLabel,
            serialNumber: i.serialNumber,
          })),
          paymentMethod: getMethodLabel(method),
        });
        setSelectedItems([]);
        setCustomerName('');
        setSelectedCrmCustomer(null);
        setCouponCode('');
        setAppliedDiscount(0);
        setScheduledDeliveryDate('');
        setAssemblyRequired(false);
        if (!usedOfflineFallback) {
          showNotification(`Venda varejo (${getMethodLabel(method)}) registrada!`);
        }
      }
    } finally {
      setIsFinishing(false);
    }
  };

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const hasLowStock = menuItems.some(
    (i) => i.storeId === currentStore.id && i.stock !== undefined && i.stock <= 10
  );

  return {
    searchQuery,
    setSearchQuery,
    filteredItems,
    selectedItems,
    pushCartLine,
    addItem,
    updateQty,
    updateSerial,
    total,
    couponCode,
    setCouponCode,
    appliedDiscount,
    handleApplyCoupon,
    customerName,
    setCustomerName,
    selectedCrmCustomer,
    setSelectedCrmCustomer,
    isFinishing,
    handleFinish,
    lastOrderForReceipt,
    setLastOrderForReceipt,
    searchInputRef,
    variantPickerItem,
    setVariantPickerItem,
    showDeliverySchedule,
    scheduledDeliveryDate,
    setScheduledDeliveryDate,
    scheduledDeliveryPeriod,
    setScheduledDeliveryPeriod,
    assemblyRequired,
    setAssemblyRequired,
    hasLowStock,
    ...exchangeState,
  };
}
