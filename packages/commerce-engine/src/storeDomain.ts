import {
  MenuItemVariant,
  PlatformGovernance,
  Reservation,
  Socials,
  Store,
  StoreCategory,
  SubscriptionPlanTier,
} from '../../shared-types/src/index.ts';

export const DINING_CATEGORIES: string[] = [
  'RESTAURANT',
  'BURGER',
  'PIZZA',
  'JAPANESE',
  'SUSHI',
  'BAKERY',
  'CAFE',
  'ICE_CREAM',
  'FOOD',
];

export const SERVICE_CATEGORIES: string[] = [
  'SERVICES',
  'SERVICE',
  'BEAUTY',
  'BARBER',
];

export const RETAIL_CATEGORIES: string[] = [
  'RETAIL',
  'FURNITURE',
  'ELECTRONICS',
  'FASHION',
  'HEALTH',
  'BEVERAGES',
  'GROCERY',
  'PHARMACY',
  'PETSHOP',
];

export type FulfillmentModality = 'DELIVERY' | 'PICKUP' | 'TABLE';
export type ShowcaseTabId = 'CARDAPIO' | 'PROMOCOES' | 'DESTAQUES' | 'AUTOATENDIMENTO' | 'RESERVAS' | 'SOBRE';

export const isMultiCommerceCategory = (category?: StoreCategory | string): boolean => {
  if (!category) return false;
  return String(category).toUpperCase() === 'MULTI_COMMERCE';
};

export const isMultiCommerceStore = (store?: Store | null): boolean => {
  if (!store) return false;
  return (
    isMultiCommerceCategory(store.category) ||
    store.showcaseTemplate?.templateId === 'MULTI_COMMERCE'
  );
};

export const isDiningCategory = (category?: StoreCategory | string): boolean => {
  if (!category) return false;
  return DINING_CATEGORIES.includes(String(category).toUpperCase());
};

export const isServiceCategory = (category?: StoreCategory | string): boolean => {
  if (!category) return false;
  return SERVICE_CATEGORIES.includes(String(category).toUpperCase());
};

export const isFoodOrBeverageCategory = (category?: StoreCategory | string): boolean => {
  if (!category) return false;
  const upper = String(category).toUpperCase();
  return DINING_CATEGORIES.includes(upper) || upper === 'BEVERAGES';
};

export const storeSupportsTableService = (store?: Store | null): boolean => {
  if (!store) return false;
  if (store.operationalSettings?.darkKitchenMode) return false;
  if (isMultiCommerceStore(store)) {
    return store.showcaseTemplate?.customSections?.showTablesSection !== false;
  }
  return isDiningCategory(store.category);
};

export const getAllowedModalities = (store?: Store | null): FulfillmentModality[] => {
  if (!store) return ['DELIVERY', 'PICKUP'];
  if (isServiceCategory(store.category)) {
    return [];
  }
  if (isMultiCommerceStore(store)) {
    const canTable = storeSupportsTableService(store);
    return canTable ? ['DELIVERY', 'PICKUP', 'TABLE'] : ['DELIVERY', 'PICKUP'];
  }
  if (storeSupportsTableService(store)) {
    return ['DELIVERY', 'PICKUP', 'TABLE'];
  }
  return ['DELIVERY', 'PICKUP'];
};

export const getAllowedShowcaseTabs = (store?: Store | null): ShowcaseTabId[] => {
  if (!store) return ['CARDAPIO', 'PROMOCOES', 'DESTAQUES', 'SOBRE'];
  if (isMultiCommerceStore(store)) {
    const sections = store.showcaseTemplate?.customSections;
    const tabs: ShowcaseTabId[] = ['CARDAPIO', 'PROMOCOES', 'DESTAQUES'];
    if (storeSupportsTableService(store)) {
      tabs.push('AUTOATENDIMENTO');
    }
    if (sections?.showServicesSection !== false || storeSupportsTableService(store)) {
      tabs.push('RESERVAS');
    }
    tabs.push('SOBRE');
    return tabs;
  }
  if (isServiceCategory(store.category)) {
    return ['CARDAPIO', 'PROMOCOES', 'RESERVAS', 'SOBRE'];
  }
  if (storeSupportsTableService(store)) {
    return ['CARDAPIO', 'PROMOCOES', 'DESTAQUES', 'AUTOATENDIMENTO', 'RESERVAS', 'SOBRE'];
  }
  return ['CARDAPIO', 'PROMOCOES', 'DESTAQUES', 'SOBRE'];
};

export const getStoreSocials = (store?: Store | null): Socials => {
  if (!store) return {};
  const templateSocials = store.showcaseTemplate?.socials || {};
  const rootSocials = store.socials || {};
  return {
    whatsapp: rootSocials.whatsapp || templateSocials.whatsapp || '',
    instagram: rootSocials.instagram || templateSocials.instagram || '',
    facebook: rootSocials.facebook || templateSocials.facebook || '',
    ifood: rootSocials.ifood || templateSocials.ifood || '',
    website: rootSocials.website || templateSocials.website || '',
  };
};

export const isRetailCategory = (category?: StoreCategory | string): boolean => {
  if (!category) return false;
  return RETAIL_CATEGORIES.includes(String(category).toUpperCase());
};

export const getStorePosMode = (store?: Store | null): 'FOOD' | 'RETAIL' | 'SERVICE' => {
  if (!store) return 'FOOD';
  if (isServiceCategory(store.category)) return 'SERVICE';
  if (isRetailCategory(store.category)) return 'RETAIL';
  if (isMultiCommerceStore(store)) {
    const sec = store.showcaseTemplate?.customSections;
    if (sec?.showFoodSection === false && sec?.showRetailSection !== false) return 'RETAIL';
    if (sec?.showFoodSection === false && sec?.showServicesSection !== false) return 'SERVICE';
    return 'FOOD';
  }
  return 'FOOD';
};

export const getDefaultEnabledModulesForCategory = (
  category?: StoreCategory | string,
  darkKitchenMode?: boolean
): string[] => {
  const baseModules = ['inventory', 'finance', 'crm', 'staff', 'fiscal', 'ai-assistant'];

  if (isMultiCommerceCategory(category)) {
    return [
      'pdv',
      'pdv-retail',
      'pdv-service',
      'kds',
      ...(darkKitchenMode ? [] : ['tables', 'qr-tables']),
      'appointments',
      'kiosk',
      'drivers',
      ...baseModules,
      'whatsapp-marketing',
      'cashback',
    ];
  }

  if (isServiceCategory(category)) {
    return [
      'pdv-service',
      'appointments',
      'pdv',
      ...baseModules,
      'whatsapp-marketing',
      'cashback',
    ];
  }

  if (isRetailCategory(category)) {
    return [
      'pdv-retail',
      'pdv',
      ...baseModules,
      'drivers',
      'kiosk',
      'cashback',
    ];
  }

  return [
    'pdv',
    'kds',
    ...(darkKitchenMode ? [] : ['tables', 'appointments', 'qr-tables']),
    'kiosk',
    'drivers',
    ...baseModules,
    'cashback',
  ];
};

export const isItemService = (
  item?: { specs?: { segment?: string } } | null,
  store?: Store | null
): boolean => {
  if (!item) return false;
  if (item.specs?.segment === 'SERVICE') return true;
  if (
    !item.specs?.segment &&
    store &&
    isServiceCategory(store.category)
  ) {
    return true;
  }
  return false;
};

export const getItemSegmentGroup = (
  item?: { specs?: { segment?: string } } | null,
  store?: Store | null
): 'FOOD' | 'RETAIL' | 'SERVICE' => {
  const seg = item?.specs?.segment;
  if (seg === 'SERVICE') return 'SERVICE';
  if (seg === 'FOOD') return 'FOOD';
  if (seg === 'FURNITURE' || seg === 'ELECTRONICS' || seg === 'FASHION' || seg === 'RETAIL_GENERAL') {
    return 'RETAIL';
  }
  if (store) {
    if (isServiceCategory(store.category)) return 'SERVICE';
    if (isRetailCategory(store.category)) return 'RETAIL';
  }
  return 'FOOD';
};

export const getDefaultDevicesForPlan = (plan?: SubscriptionPlanTier): number => {
  switch (plan) {
    case 'FREE':
      return 2;
    case 'PROMO':
      return 3;
    case 'BASIC':
      return 5;
    case 'PRO':
      return 15;
    case 'ENTERPRISE':
      return 999;
    default:
      return 2;
  }
};

export const getStoreMaxDevices = (
  store?: Store | null,
  governance?: PlatformGovernance | null
): number => {
  if (!store) return 2;
  const fromStore = Number(store.maxAllowedDevices);
  if (!isNaN(fromStore) && fromStore > 0) return fromStore;
  const fromGov = governance?.planPricing?.[store.subscriptionPlan]?.maxDevices;
  if (typeof fromGov === 'number' && fromGov > 0) return fromGov;
  return getDefaultDevicesForPlan(store.subscriptionPlan);
};

export const getDefaultBranchesForPlan = (plan?: SubscriptionPlanTier): number => {
  switch (plan) {
    case 'FREE':
    case 'PROMO':
    case 'BASIC':
      return 1;
    case 'PRO':
      return 2;
    case 'ENTERPRISE':
      return 5;
    default:
      return 1;
  }
};

export const getStoreMaxBranches = (
  store?: Store | null,
  governance?: PlatformGovernance | null
): number => {
  if (!store) return 1;
  const fromStore = Number(store.maxAllowedBranches);
  if (!isNaN(fromStore) && fromStore > 0) return fromStore;
  const fromGov = governance?.planPricing?.[store.subscriptionPlan]?.maxBranches;
  if (typeof fromGov === 'number' && fromGov > 0) return fromGov;
  return getDefaultBranchesForPlan(store.subscriptionPlan);
};

export const getTenantStores = (stores: Store[], currentStore?: Store | null): Store[] => {
  if (!currentStore) return [];
  const rootId = currentStore.parentStoreId || currentStore.id;
  if (currentStore.tenantId && currentStore.tenantId !== 'tenant-1') {
    return stores.filter(
      (s) => s.tenantId === currentStore.tenantId || s.id === rootId || s.parentStoreId === rootId
    );
  }
  return stores.filter((s) => s.id === rootId || s.parentStoreId === rootId);
};

const timeToMinutes = (hhmm: string): number => {
  const [hStr, mStr] = String(hhmm || '00:00').split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
};

function extractDateAndTime(input?: { date?: string; time?: string; dateTime?: string }): { date: string; time: string } {
  if (input?.date && input?.time) {
    return { date: String(input.date).trim(), time: String(input.time).trim() };
  }
  const dt = String(input?.dateTime || '').trim();
  if (!dt) return { date: '', time: '' };
  if (dt.includes('T')) {
    const [d, tPart] = dt.split('T');
    return { date: d, time: (tPart || '').slice(0, 5) };
  }
  const parts = dt.split(/\s+/);
  return { date: parts[0] || '', time: (parts[1] || '').slice(0, 5) };
}

export const hasReservationConflict = (
  existingReservations: Reservation[],
  candidate: {
    id?: string;
    storeId: string;
    date?: string;
    time?: string;
    dateTime?: string;
    professional?: string;
    tableNumber?: number | string;
    serviceOrTable?: string;
    durationMinutes?: number;
  }
): Reservation | null => {
  const candDT = extractDateAndTime(candidate);
  if (!candDT.date || !candDT.time || !candidate.storeId) return null;
  const candStart = timeToMinutes(candDT.time);
  const candDuration = Math.max(15, Number(candidate.durationMinutes) || 45);
  const candEnd = candStart + candDuration;
  const candProf = (candidate.professional || '').trim().toLowerCase();
  const candTable =
    candidate.tableNumber !== undefined && candidate.tableNumber !== null
      ? String(candidate.tableNumber).trim().toLowerCase()
      : (candidate.serviceOrTable || '').trim().toLowerCase();

  for (const r of existingReservations) {
    if (candidate.id && r.id === candidate.id) continue;
    if (r.storeId !== candidate.storeId) continue;
    if (r.status === 'CANCELLED') continue;
    const rDT = extractDateAndTime(r as any);
    if (rDT.date !== candDT.date) continue;

    const rProf = (r.professional || '').trim().toLowerCase();
    if (candProf && rProf && candProf !== rProf) continue;
    if (candProf && !rProf) continue;
    if (!candProf && rProf) continue;

    const rTableRaw = (r as any).tableNumber !== undefined && (r as any).tableNumber !== null
      ? String((r as any).tableNumber)
      : (r.serviceOrTable || '');
    const rTable = rTableRaw.trim().toLowerCase();
    if (candTable && rTable && candTable !== rTable) continue;

    const rStart = timeToMinutes(rDT.time);
    const rDuration = Math.max(15, Number(r.durationMinutes ?? (r as any).durationMin) || 45);
    const rEnd = rStart + rDuration;

    if (candStart < rEnd && candEnd > rStart) {
      return r;
    }
  }
  return null;
};

export const computeTotalVariantStock = (variants?: MenuItemVariant[]): number => {
  if (!variants || variants.length === 0) return 0;
  return variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0);
};

export const calculateHaversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
};

