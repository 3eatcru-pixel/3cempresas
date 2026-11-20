import { useState, useEffect } from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { getPlatformAdapters } from '../../../core/platform/PlatformAdapter';
import { Store } from '../../../types';
import {
  getAllowedModalities,
  isFoodOrBeverageCategory,
  isServiceCategory,
  FulfillmentModality,
} from '../../../utils/storeDomain';
import {
  calculateDistanceKm,
  geocodeAddressNominatim,
  reverseGeocodeNominatim,
  isValidLatLng,
} from '../../../components/common/map/mapUtils';
import { evaluateCheckoutCoupon } from './couponPricing';

interface UseCheckoutModalControllerParams {
  isOpen: boolean;
  address: string;
  setAddress: (address: string) => void;
  coupon: string;
  cartTotal: number;
  deliveryFee: number;
  consumptionModality?: FulfillmentModality;
  setConsumptionModality?: (m: FulfillmentModality) => void;
  tableNumber?: number;
  setTableNumber?: (t: number) => void;
  tableBillingMode?: 'TABLE_BILL' | 'PAY_NOW';
  setTableBillingMode?: (m: 'TABLE_BILL' | 'PAY_NOW') => void;
  needCutleryProp?: boolean;
  setNeedCutleryProp?: (v: boolean) => void;
  courierTipProp?: number;
  setCourierTipProp?: (t: number) => void;
  storeProp?: Store;
}

export function useCheckoutModalController({
  isOpen,
  address,
  setAddress,
  coupon,
  cartTotal,
  deliveryFee,
  consumptionModality,
  setConsumptionModality,
  tableNumber,
  setTableNumber,
  tableBillingMode,
  setTableBillingMode,
  needCutleryProp,
  setNeedCutleryProp,
  courierTipProp,
  setCourierTipProp,
  storeProp,
}: UseCheckoutModalControllerParams) {
  const {
    currentStore,
    stores,
    cart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    selectedStoreSlugForShowcase,
    coupons,
    gpsCoords,
    userCoords,
  } = useEcosystem();

  const resolvedStore =
    storeProp ||
    (cart[0]?.menuItem?.storeId ? stores.find((s) => s.id === cart[0].menuItem.storeId) : undefined) ||
    (selectedStoreSlugForShowcase ? stores.find((s) => s.slug === selectedStoreSlugForShowcase) : undefined) ||
    currentStore;

  const isServiceStore = isServiceCategory(resolvedStore.category);
  const allowedModalities = getAllowedModalities(resolvedStore);
  const isFoodStore = isFoodOrBeverageCategory(resolvedStore.category);

  const [internalModality, setInternalModality] = useState<FulfillmentModality>('DELIVERY');
  const [internalTable, setInternalTable] = useState<number>(4);
  const [internalTableBillingMode, setInternalTableBillingMode] = useState<'TABLE_BILL' | 'PAY_NOW'>('TABLE_BILL');
  const [publicPixKey, setPublicPixKey] = useState<string>('');
  const [internalNeedCutlery, setInternalNeedCutlery] = useState(false);
  const [internalCourierTip, setInternalCourierTip] = useState(0);
  const [resolvedDeliveryCoords, setResolvedDeliveryCoords] = useState<[number, number] | null>(null);
  const [confirmRemoteOrder, setConfirmRemoteOrder] = useState(false);

  const activeModality = consumptionModality ?? internalModality;
  const updateModality = setConsumptionModality ?? setInternalModality;
  const activeTable = tableNumber ?? internalTable;
  const updateTable = setTableNumber ?? setInternalTable;
  const activeTableBillingMode = tableBillingMode ?? internalTableBillingMode;
  const updateTableBillingMode = setTableBillingMode ?? setInternalTableBillingMode;
  const needCutlery = needCutleryProp ?? internalNeedCutlery;
  const setNeedCutlery = setNeedCutleryProp ?? setInternalNeedCutlery;
  const courierTip = courierTipProp ?? internalCourierTip;
  const setCourierTip = setCourierTipProp ?? setInternalCourierTip;

  const allowedModalitiesKey = allowedModalities.join('|');
  useEffect(() => {
    if (!isServiceStore && allowedModalities.length > 0 && !allowedModalities.includes(activeModality)) {
      updateModality(allowedModalities[0]);
    }
  }, [resolvedStore.id, isServiceStore, allowedModalitiesKey, activeModality]);

  useEffect(() => {
    setPublicPixKey('');
    if (!isOpen || !resolvedStore?.id) return;
    let active = true;
    const baseUrl = getPlatformAdapters().network.getApiBaseUrl();
    fetch(`${baseUrl}/store/payment-public-info/${encodeURIComponent(resolvedStore.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((info) => {
        if (active) {
          setPublicPixKey(info?.pixKey ? String(info.pixKey) : '');
        }
      })
      .catch(() => {
        if (active) setPublicPixKey('');
      });
    return () => {
      active = false;
    };
  }, [isOpen, resolvedStore?.id]);

  useEffect(() => {
    setConfirmRemoteOrder(false);
    if (!isOpen || activeModality !== 'DELIVERY' || !address || address.trim().length < 5) {
      setResolvedDeliveryCoords(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const result = await geocodeAddressNominatim(address.trim(), {
        countryCodes: 'br',
        biasCoords: isValidLatLng(userCoords[0], userCoords[1]) ? userCoords : undefined,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        if (result && isValidLatLng(result.lat, result.lng)) {
          setResolvedDeliveryCoords([result.lat, result.lng]);
        } else {
          setResolvedDeliveryCoords(null);
        }
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, activeModality, address, userCoords]);

  const ops = resolvedStore.operationalSettings || {};
  const allowCutlery = ops.allowCutleryOptIn ?? true;
  const allowTip = ops.allowCourierTip ?? true;
  const pixKey = publicPixKey || ops.pixKey || resolvedStore.phone || '';

  const isStoreClosed = resolvedStore.isOpen === false;
  const isCartEmpty = cart.length === 0;
  const effectiveDeliveryFee = activeModality === 'DELIVERY' ? deliveryFee : 0;
  const effectiveCourierTip = activeModality === 'DELIVERY' ? courierTip : 0;
  const { matchedCoupon, discount, isInvalid: couponInvalid } = evaluateCheckoutCoupon({
    coupons,
    couponCode: coupon,
    storeId: resolvedStore.id,
    cartTotal,
  });
  const total = Math.max(0, cartTotal + effectiveDeliveryFee + effectiveCourierTip - discount);

  const eligibleCoupons = coupons.filter(
    (c) =>
      c.isActive !== false &&
      c.audience !== 'MERCHANT' &&
      (!c.storeId || c.storeId === resolvedStore.id)
  );

  const isOpenTableTab = activeModality === 'TABLE' && activeTableBillingMode === 'TABLE_BILL';

  const distanceFromGpsKm =
    activeModality === 'DELIVERY' &&
    gpsCoords &&
    resolvedDeliveryCoords &&
    isValidLatLng(gpsCoords[0], gpsCoords[1]) &&
    isValidLatLng(resolvedDeliveryCoords[0], resolvedDeliveryCoords[1])
      ? calculateDistanceKm(
          gpsCoords[0],
          gpsCoords[1],
          resolvedDeliveryCoords[0],
          resolvedDeliveryCoords[1]
        )
      : 0;
  const isFarFromGps = distanceFromGpsKm > 2.0;

  const distanceToStoreKm =
    activeModality === 'DELIVERY' &&
    resolvedDeliveryCoords &&
    isValidLatLng(resolvedDeliveryCoords[0], resolvedDeliveryCoords[1]) &&
    isValidLatLng(resolvedStore.latitude, resolvedStore.longitude)
      ? calculateDistanceKm(
          resolvedStore.latitude as number,
          resolvedStore.longitude as number,
          resolvedDeliveryCoords[0],
          resolvedDeliveryCoords[1]
        )
      : null;

  const handleUseCurrentGpsAddress = async () => {
    if (!gpsCoords) return;
    const rev = await reverseGeocodeNominatim(gpsCoords[0], gpsCoords[1]);
    if (rev?.displayName) {
      setAddress(rev.displayName);
      setResolvedDeliveryCoords(gpsCoords);
      setConfirmRemoteOrder(false);
    }
  };

  return {
    resolvedStore,
    isServiceStore,
    allowedModalities,
    isFoodStore,
    cart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    activeModality,
    updateModality,
    activeTable,
    updateTable,
    updateTableBillingMode,
    needCutlery,
    setNeedCutlery,
    courierTip,
    setCourierTip,
    allowCutlery,
    allowTip,
    pixKey,
    isStoreClosed,
    isCartEmpty,
    effectiveDeliveryFee,
    effectiveCourierTip,
    matchedCoupon,
    discount,
    couponInvalid,
    total,
    eligibleCoupons,
    isOpenTableTab,
    distanceFromGpsKm,
    distanceToStoreKm,
    isFarFromGps,
    confirmRemoteOrder,
    setConfirmRemoteOrder,
    resolvedDeliveryCoords,
    setResolvedDeliveryCoords,
    handleUseCurrentGpsAddress,
  };
}
