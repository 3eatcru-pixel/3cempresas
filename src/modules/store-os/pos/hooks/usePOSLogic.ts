import { useState, useEffect } from 'react';
import { useEcosystem } from '../../../../context/EcosystemContext';
import { useAuth } from '../../../../context/AuthContext';
import { MenuItem } from '../../../../types';
import { StorageService } from '../../../../services/StorageService';
import { getPlatformAdapters } from '../../../../core/platform/PlatformAdapter';
import { syncEngine } from '../../../../core/sync/SyncEngine';
import { apiClient } from '../../../../core/api/apiClient';

export const usePOSLogic = () => {
  const platform = getPlatformAdapters();
  const { getIdToken, profile, user } = useAuth();
  const {
    currentStore,
    menuItems,
    coupons,
    customersCrm,
    cashSession,
    openCashRegister,
    createPosOrder,
    showNotification,
  } = useEcosystem();
  const [customerName, setCustomerName] = useState('');
  const [selectedCrmCustomer, setSelectedCrmCustomer] = useState<any | null>(null);
  const storeCustomers = customersCrm.filter((c) => c.storeId === currentStore.id);
  const operatorDefault =
    profile?.name || user?.displayName || user?.email?.split('@')[0] || 'Operador Caixa';
  const [selectedItems, setSelectedItems] = useState<
    { menuItem: MenuItem; qty: number; variantId?: string; variantLabel?: string }[]
  >([]);
  const [lastOrderForReceipt, setLastOrderForReceipt] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOffline, setIsOffline] = useState(!platform.network.isOnline());
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [selectedProfessionalName, setSelectedProfessionalName] = useState('');

  const total = selectedItems.reduce((acc, i) => acc + (i.menuItem.price * i.qty), 0);

  useEffect(() => {
    const unsubscribeNet = platform.network.subscribeNetworkChanges((online) => {
      setIsOffline(!online);
      if (online) syncOfflineOrders();
    });
    if (menuItems.length > 0) StorageService.cacheCatalog(menuItems.filter(m => m.storeId === currentStore.id));
    const saved = platform.storage.getItem(`last_pos_order_${currentStore.id}`);
    if (saved) { try { setLastOrderForReceipt(JSON.parse(saved)); } catch {} }
    return unsubscribeNet;
  }, [menuItems, currentStore.id]);

  const syncOfflineOrders = async () => {
    const pending = await StorageService.getPendingOrders();
    if (pending.length > 0) {
      showNotification(`Sincronizando ${pending.length} pedidos offline...`);
      try {
        const token = await getIdToken().catch(() => undefined);
        const flushResult = await syncEngine.flushAll({ token: token || undefined, storeId: currentStore.id });
        if (flushResult.syncedOrders > 0 || flushResult.syncedMutations > 0) {
          showNotification(`Sincronização concluída: ${flushResult.syncedOrders} pedidos sincronizados!`);
        }
      } catch (e) {
        console.warn("Failed to sync order notice:", e);
      }
      await syncEngine.refreshCounts();
    }
  };

  const handleApplyCoupon = () => {
    if (!couponCode) return;
    const normalized = couponCode.trim().toUpperCase();
    const c = coupons.find((cp) => {
      if (cp.code.toUpperCase() !== normalized || cp.isActive === false) return false;
      if (cp.storeId && cp.storeId !== currentStore.id) return false;
      const valDate = cp.validUntil;
      if (valDate && new Date(valDate).getTime() < Date.now()) return false;
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
    showNotification(`Cupom ${c.code} aplicado: R$ ${disc.toFixed(2)} de desconto!`);
  };

  const handleAddItem = (item: MenuItem, variant?: { id?: string; label?: string }) => {
    setSelectedItems(prev => {
      const existing = prev.find(
        i => i.menuItem.id === item.id && (i.variantId || '') === (variant?.id || '')
      );
      if (existing) {
        return prev.map(i =>
          i.menuItem.id === item.id && (i.variantId || '') === (variant?.id || '')
            ? { ...i, qty: i.qty + 1 }
            : i
        );
      }
      return [...prev, { menuItem: item, qty: 1, variantId: variant?.id, variantLabel: variant?.label }];
    });
  };

  const handleUpdateQty = (id: string, delta: number, variantId?: string) => {
    setSelectedItems(prev => prev.map(i => {
      if (i.menuItem.id === id && (i.variantId || '') === (variantId || '')) {
        return { ...i, qty: Math.max(0, i.qty + delta) };
      }
      return i;
    }).filter(i => i.qty > 0));
  };

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'BOLETO' | 'BANK_TRANSFER' | 'PAYMENT_LINK'
  >('PIX');
  const [cashTendered, setCashTendered] = useState('');

  const acceptedPaymentMethods: ('PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'BOLETO' | 'BANK_TRANSFER' | 'PAYMENT_LINK')[] =
    Array.isArray(currentStore.operationalSettings?.acceptedPaymentMethods) &&
    currentStore.operationalSettings!.acceptedPaymentMethods!.length > 0
      ? (currentStore.operationalSettings!.acceptedPaymentMethods as any)
      : ['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'BOLETO', 'BANK_TRANSFER', 'PAYMENT_LINK'];

  const getPaymentMethodReceiptLabel = (method: string) => {
    switch (method) {
      case 'PIX':
        return 'PIX DIRETO';
      case 'CREDIT_CARD':
      case 'CREDIT':
        return 'CARTÃO CRÉDITO';
      case 'DEBIT_CARD':
      case 'DEBIT':
        return 'CARTÃO DÉBITO';
      case 'CASH':
        return 'DINHEIRO';
      case 'BOLETO':
        return 'BOLETO BANCÁRIO';
      case 'BANK_TRANSFER':
        return 'TED / TRANSFERÊNCIA';
      case 'PAYMENT_LINK':
        return 'LINK DE PAGAMENTO';
      default:
        return method;
    }
  };

  const handleFinishOrder = async (
    paymentMethod:
      | 'PIX'
      | 'CREDIT_CARD'
      | 'DEBIT_CARD'
      | 'CASH'
      | 'BOLETO'
      | 'BANK_TRANSFER'
      | 'PAYMENT_LINK'
      | 'DEBIT'
      | 'CREDIT' = selectedPaymentMethod
  ) => {
    if (selectedItems.length === 0) return;
    const normalizedMethod =
      paymentMethod === 'DEBIT'
        ? 'DEBIT_CARD'
        : paymentMethod === 'CREDIT'
        ? 'CREDIT_CARD'
        : paymentMethod;
    const finalAmount = Math.max(0, total - appliedDiscount);
    const numericCash = parseFloat(cashTendered.replace(',', '.')) || 0;
    const changeAmount =
      normalizedMethod === 'CASH' && numericCash > finalAmount
        ? Math.round((numericCash - finalAmount) * 100) / 100
        : 0;
    const orderData: any = {
      storeId: currentStore.id,
      channel: 'POS',
      deliveryModality: 'PICKUP',
      code: `#OFF-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: customerName || 'Cliente Balcão',
      items: selectedItems.map(i => ({
        ...i.menuItem,
        menuItemId: i.menuItem.id,
        quantity: i.qty,
        variantId: i.variantId,
        variantLabel: i.variantLabel,
      })),
      subtotal: total,
      discount: appliedDiscount,
      couponCode: appliedDiscount > 0 ? couponCode : '',
      total: finalAmount,
      paymentMethod: normalizedMethod,
      ...(changeAmount > 0 ? { changeFor: numericCash, changeAmount } : {}),
      ...(selectedProfessionalName
        ? { professionalName: selectedProfessionalName, notes: `Profissional: ${selectedProfessionalName}` }
        : {}),
      createdAt: new Date().toISOString()
    };

    let fiscalAuthorization: any = null;
    let savedOffline = false;
    if (isOffline && !platform.network.getEdgeBaseUrl()) {
      savedOffline = true;
      await StorageService.saveOfflineOrder(orderData);
      await syncEngine.refreshCounts();
      showNotification('Sem internet! Pedido salvo na fila offline.');
    } else {
      try {
        const order = await createPosOrder(
          selectedCrmCustomer?.name || customerName || 'Cliente Balcão',
          selectedItems.map(i => ({
            menuItem: i.menuItem,
            qty: i.qty,
            variantId: i.variantId,
            variantLabel: i.variantLabel,
          })),
          normalizedMethod,
          appliedDiscount,
          couponCode,
          'POS',
          {
            ...(selectedProfessionalName
              ? { professionalName: selectedProfessionalName, notes: `Profissional: ${selectedProfessionalName}` }
              : {}),
            ...(selectedCrmCustomer
              ? { crmCustomerId: selectedCrmCustomer.id, customerPhone: selectedCrmCustomer.phone }
              : {}),
            paymentConfirmed: normalizedMethod !== 'BOLETO' && normalizedMethod !== 'PAYMENT_LINK',
          }
        );
        if (order) {
          orderData.code = order.code;
          orderData.id = order.id;
          if (typeof order.subtotal === 'number') orderData.subtotal = order.subtotal;
          if (typeof order.discount === 'number') orderData.discount = order.discount;
          if (typeof order.deliveryFee === 'number') orderData.deliveryFee = order.deliveryFee;
          if (typeof order.total === 'number') orderData.total = order.total;
          try {
            const token = await getIdToken().catch(() => undefined);
            fiscalAuthorization = await apiClient.emitSimulatedFiscal(
              {
                storeId: currentStore.id,
                nfeId: order.id || `nfe-${Date.now()}`,
                amount: finalAmount,
                itemsCount: selectedItems.reduce((acc, i) => acc + i.qty, 0),
              },
              token || undefined
            );
          } catch {
            // non-blocking fallback
          }
        } else {
          savedOffline = true;
          await StorageService.saveOfflineOrder(orderData);
          await syncEngine.refreshCounts();
          showNotification('Servidor indisponível: pedido salvo na fila offline.');
        }
      } catch {
        savedOffline = true;
        await StorageService.saveOfflineOrder(orderData);
        await syncEngine.refreshCounts();
        showNotification('Erro na rede! Pedido enfileirado offline.');
      }
    }
    const receiptOrder = {
      ...orderData,
      paymentMethod: getPaymentMethodReceiptLabel(normalizedMethod),
      fiscalProtocol: savedOffline
        ? 'CONTINGENCIA-OFFLINE-SANDBOX'
        : (fiscalAuthorization?.protocol || 'SEFAZ-SANDBOX-NAO-EMITIDO'),
      savedOffline,
    };
    setLastOrderForReceipt(receiptOrder);
    platform.storage.setItem(`last_pos_order_${currentStore.id}`, JSON.stringify(receiptOrder));
    setSelectedItems([]); setCustomerName(''); setSelectedCrmCustomer(null); setCouponCode(''); setAppliedDiscount(0); setSelectedProfessionalName(''); setCashTendered('');
    if (!savedOffline) {
      showNotification(
        fiscalAuthorization?.protocol
          ? `Venda PDV (${getPaymentMethodReceiptLabel(normalizedMethod)}) processada e NFC-e Sandbox emitida!`
          : `Venda PDV (${getPaymentMethodReceiptLabel(normalizedMethod)}) processada com sucesso!`
      );
    }
  };

  const filteredItems = menuItems.filter(m => m.storeId === currentStore.id && (m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.barcode?.includes(searchQuery)));

  return {
    currentStore, customerName, setCustomerName, selectedCrmCustomer, setSelectedCrmCustomer, storeCustomers,
    cashSession, openCashRegister, operatorDefault,
    selectedItems, 
    handleAddItem, handleUpdateQty, total, handleFinishOrder,
    lastOrderForReceipt, setLastOrderForReceipt, searchQuery, setSearchQuery, filteredItems, isOffline,
    couponCode, setCouponCode, appliedDiscount, handleApplyCoupon,
    selectedProfessionalName, setSelectedProfessionalName,
    selectedPaymentMethod, setSelectedPaymentMethod, acceptedPaymentMethods,
    cashTendered, setCashTendered
  };
};
