import React, { useState, useEffect, useMemo } from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { useConsumer } from '../../../context/ConsumerContext';
import { useAuth } from '../../../context/AuthContext';
import {
  MarketplaceGovernanceConfig,
  MenuItem,
  Order,
  Store,
  StorePaymentMethod,
} from '../../../types';
import { smartDiscoveryAI } from '../../../services/gemini';
import { apiClient } from '../../../core/api/apiClient';
import { isFoodOrBeverageCategory } from '../../../utils/storeDomain';
import {
  filterAndSortMarketplaceStores,
  MarketplaceSortOption,
} from './marketplaceStoreFilter';

export type { MarketplaceSortOption };

export const useMarketplaceLogic = (options?: { onTableOrderSuccess?: () => void }) => {
  const ecosystem = useEcosystem();
  const { consumer } = useConsumer();
  const { isAuthenticated, profile, openAuthModal } = useAuth();
  const roleUpper = String(profile?.role || '').toUpperCase();
  const isConsumerAuthenticated = Boolean(
    isAuthenticated && (roleUpper === 'CUSTOMER' || roleUpper === 'CONSUMER')
  );

  const [activeTab, setActiveTab] = useState<'marketplace' | 'orders' | 'institutional' | 'consumer-account'>('marketplace');
  const [consumptionModality, setConsumptionModality] = useState<'DELIVERY' | 'PICKUP' | 'TABLE'>('DELIVERY');
  const [tableNumber, setTableNumber] = useState<number>(4);

  const [sortBy, setSortBy] = useState<MarketplaceSortOption>('RECOMMENDED');
  const [freeDeliveryOnly, setFreeDeliveryOnly] = useState<boolean>(false);
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);

  const [activeStoreModal, setActiveStoreModal] = useState<Store | null>(null);
  const [activeItemModal, setActiveItemModal] = useState<MenuItem | null>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState('');

  // AI Discovery State
  const [aiDiscoveryLoading, setAiDiscoveryLoading] = useState(false);
  const [aiDiscoveryResponse, setAiDiscoveryResponse] = useState<string | null>(null);
  const [isAiConciergeOpen, setIsAiConciergeOpen] = useState(false);

  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);

  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutName, setCheckoutName] = useState(consumer.name || '');
  const [checkoutPhone, setCheckoutPhone] = useState(consumer.phone || '');
  const [checkoutAddress, setCheckoutAddress] = useState(ecosystem.geoAddress);
  const [checkoutPayment, setCheckoutPayment] = useState<StorePaymentMethod>(
    (consumer.preferences?.defaultPaymentMethod as StorePaymentMethod) || 'PIX'
  );
  const [tableBillingMode, setTableBillingMode] = useState<'TABLE_BILL' | 'PAY_NOW'>('TABLE_BILL');
  const [checkoutCoupon, setCheckoutCoupon] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [needCutlery, setNeedCutlery] = useState(false);
  const [courierTip, setCourierTip] = useState(0);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const [publicConfig, setPublicConfig] = useState<{
    globalAnnouncementBanner: string;
    aiEngineEnabled: boolean;
    maintenanceMode: boolean;
    marketplaceReadOnly?: boolean;
    maintenanceMessage?: string;
    marketplaceConfig?: MarketplaceGovernanceConfig;
  }>({
    globalAnnouncementBanner: '',
    aiEngineEnabled: false,
    maintenanceMode: false,
    marketplaceReadOnly: false,
    maintenanceMessage: '',
  });

  useEffect(() => {
    let active = true;
    apiClient
      .getPublicConfig()
      .then((cfg) => {
        if (!active || !cfg) return;
        setPublicConfig(cfg);
        const configuredRadius = cfg.marketplaceConfig?.defaultDiscoveryRadiusKm;
        if (typeof configuredRadius === 'number' && configuredRadius >= 1 && configuredRadius <= 100) {
          ecosystem.setMaxRadiusKm(configuredRadius);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Sync state if consumer profile loads later
  useEffect(() => {
    if (consumer.name && !checkoutName) setCheckoutName(consumer.name);
    if (consumer.phone && !checkoutPhone) setCheckoutPhone(consumer.phone);
    if (ecosystem.geoAddress && (!checkoutAddress || checkoutAddress.includes('Higienópolis') || checkoutAddress.includes('Londrina'))) {
      setCheckoutAddress(ecosystem.geoAddress);
    }
  }, [consumer, ecosystem.geoAddress]);

  useEffect(() => {
    if (!isConsumerAuthenticated && (activeTab === 'orders' || activeTab === 'consumer-account')) {
      setActiveTab('marketplace');
    }
  }, [isConsumerAuthenticated, activeTab]);

  const handleSmartSearch = async () => {
    if (!publicConfig.aiEngineEnabled) {
      setAiDiscoveryResponse('Busca Inteligente indisponível no momento.');
      return;
    }
    if (!ecosystem.searchQuery || ecosystem.searchQuery.length < 3) return;
    setAiDiscoveryLoading(true);
    try {
      const response = await smartDiscoveryAI(
        ecosystem.searchQuery,
        ecosystem.stores.map((s) => ({ name: s.name, category: s.category, rating: s.rating }))
      );
      setAiDiscoveryResponse(response);
    } catch (err) {
      console.warn('[Discovery AI] Notice:', err);
    } finally {
      setAiDiscoveryLoading(false);
    }
  };

  const effectiveMarketplaceConfig =
    publicConfig.marketplaceConfig || ecosystem.governance?.marketplaceConfig;

  const filteredStores = useMemo(
    () =>
      filterAndSortMarketplaceStores({
        stores: ecosystem.stores,
        menuItems: ecosystem.menuItems,
        searchQuery: ecosystem.searchQuery,
        selectedCategory: ecosystem.selectedCategory,
        modalities: ecosystem.modalities,
        freeDeliveryOnly,
        favoritesOnly,
        favoriteStoreIds: consumer.favoriteStoreIds,
        userCoords: ecosystem.userCoords,
        maxRadiusKm: ecosystem.maxRadiusKm,
        sortBy,
        featuredStoreIds: effectiveMarketplaceConfig?.featuredStoreIds || [],
        hiddenStoreIds: effectiveMarketplaceConfig?.hiddenStoreIds || [],
      }),
    [
      ecosystem.stores,
      ecosystem.menuItems,
      ecosystem.searchQuery,
      ecosystem.selectedCategory,
      ecosystem.modalities,
      freeDeliveryOnly,
      favoritesOnly,
      consumer.favoriteStoreIds,
      ecosystem.userCoords,
      ecosystem.maxRadiusKm,
      sortBy,
      effectiveMarketplaceConfig?.featuredStoreIds,
      effectiveMarketplaceConfig?.hiddenStoreIds,
    ]
  );

  const handleOpenItemModal = (item: MenuItem) => {
    setActiveItemModal(item);
    setItemQuantity(1);
    setItemNotes('');
  };

  const handleAddToCartSubmit = (variant?: { id?: string; label?: string }) => {
    if (!activeItemModal) return;
    ecosystem.addToCart(activeItemModal, itemQuantity, itemNotes, variant);
    setActiveItemModal(null);
    setItemNotes('');
  };

  const handleConfirmOrder = async (
    e: React.FormEvent,
    deliveryCoordsOverride?: [number, number],
    extraNotes?: string
  ) => {
    e.preventDefault();
    if (ecosystem.cart.length === 0 || isSubmittingOrder) return;
    setIsSubmittingOrder(true);
    try {
      const isTableOpenTab = consumptionModality === 'TABLE' && tableBillingMode === 'TABLE_BILL';
      const effectivePayment = isTableOpenTab ? 'TABLE_BILL' : checkoutPayment;
      const customerLabel =
        checkoutName.trim() ||
        (consumptionModality === 'TABLE' ? `Mesa ${tableNumber}` : 'Cliente');

      const cartStoreId = ecosystem.cart[0]?.menuItem?.storeId;
      const targetStore =
        (cartStoreId ? ecosystem.stores.find((s) => s.id === cartStoreId) : undefined) ||
        ecosystem.currentStore;
      const includeCutleryTag =
        consumptionModality === 'DELIVERY' &&
        isFoodOrBeverageCategory(targetStore?.category) &&
        (targetStore?.operationalSettings?.allowCutleryOptIn ?? true);
      const cutleryTag = includeCutleryTag
        ? needCutlery
          ? '[Com talheres descartáveis]'
          : '[Sem talheres descartáveis]'
        : '';
      const composedNotes = [checkoutNotes.trim(), extraNotes?.trim() || '', cutleryTag]
        .filter(Boolean)
        .join(' ');

      const order = await ecosystem.placeMarketplaceOrder(
        customerLabel,
        checkoutPhone,
        checkoutAddress,
        effectivePayment,
        checkoutCoupon,
        composedNotes,
        consumptionModality,
        tableNumber,
        consumptionModality === 'DELIVERY' ? courierTip : 0,
        deliveryCoordsOverride
      );
      if (order) {
        setIsCheckoutOpen(false);
        setCourierTip(0);
        setNeedCutlery(false);
        if (consumptionModality === 'TABLE') {
          options?.onTableOrderSuccess?.();
        } else {
          ecosystem.setSelectedStoreSlugForShowcase(null);
          setTrackingOrderId(order.id);
        }
      }
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleReorder = (order: Order) => {
    const store = ecosystem.stores.find((s) => s.id === order.storeId);
    if (store && store.isOpen === false) {
      ecosystem.showNotification(`"${store.name}" encontra-se fechado no momento.`);
      return;
    }
    ecosystem.clearCart();
    let addedCount = 0;
    for (const item of order.items || []) {
      const catalogItem: MenuItem =
        ecosystem.menuItems.find(
          (m) => m.storeId === order.storeId && (m.id === item.id || m.name === item.name)
        ) || ({
          id: item.id || `reorder-${Date.now()}-${addedCount}`,
          storeId: order.storeId,
          name: item.name,
          description: '',
          price: item.price,
          costPrice: 0,
          category: 'Geral',
          image: '',
          isAvailable: true,
          sku: `REORDER-${addedCount}`,
          barcode: '',
          stock: 99,
          minStockAlert: 5,
        } as MenuItem);
      ecosystem.addToCart(
        catalogItem,
        item.quantity || 1,
        item.notes,
        item.variantId ? { id: item.variantId, label: item.variantLabel } : undefined
      );
      addedCount++;
    }
    if (addedCount > 0) {
      setTrackingOrderId(null);
      setIsCheckoutOpen(true);
      ecosystem.showNotification(`${addedCount} item(ns) do pedido ${order.code || ''} adicionados à sacola!`);
    }
  };

  const consumerOrders = useMemo(
    () =>
      ecosystem.orders.filter((o: any) => {
        if (consumer && consumer.id && consumer.id !== 'guest') {
          return (
            o.customerId === consumer.id ||
            (consumer.email && o.customerEmail?.toLowerCase() === consumer.email.toLowerCase())
          );
        }
        return o.customerId === 'guest';
      }),
    [ecosystem.orders, consumer?.id, consumer?.email]
  );

  const activeOrders = useMemo(
    () => consumerOrders.filter((o: any) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'),
    [consumerOrders]
  );
  const trackingOrder = useMemo(
    () => consumerOrders.find((o: any) => o.id === trackingOrderId),
    [consumerOrders, trackingOrderId]
  );

  return {
    publicConfig,
    ecosystem,
    consumer,
    isConsumerAuthenticated,
    openAuthModal,
    consumerOrders,
    activeTab, setActiveTab,
    consumptionModality, setConsumptionModality,
    tableNumber, setTableNumber,
    sortBy, setSortBy,
    freeDeliveryOnly, setFreeDeliveryOnly,
    favoritesOnly, setFavoritesOnly,
    activeStoreModal, setActiveStoreModal,
    activeItemModal, setActiveItemModal,
    itemQuantity, setItemQuantity,
    itemNotes, setItemNotes,
    aiDiscoveryLoading,
    aiDiscoveryResponse,
    isAiConciergeOpen, setIsAiConciergeOpen,
    trackingOrderId, setTrackingOrderId,
    isCheckoutOpen, setIsCheckoutOpen,
    checkoutName, setCheckoutName,
    checkoutPhone, setCheckoutPhone,
    checkoutAddress, setCheckoutAddress,
    checkoutPayment, setCheckoutPayment,
    tableBillingMode, setTableBillingMode,
    checkoutCoupon, setCheckoutCoupon,
    checkoutNotes, setCheckoutNotes,
    needCutlery, setNeedCutlery,
    courierTip, setCourierTip,
    handleSmartSearch,
    filteredStores,
    handleOpenItemModal,
    handleAddToCartSubmit,
    handleConfirmOrder,
    isSubmittingOrder,
    handleReorder,
    activeOrders,
    trackingOrder,
  };
};
