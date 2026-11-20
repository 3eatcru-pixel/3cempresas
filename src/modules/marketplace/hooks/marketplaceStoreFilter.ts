import { MenuItem, Store } from '../../../types';
import {
  calculateHaversineKm,
  getAllowedModalities,
  isMultiCommerceStore,
  isServiceCategory,
  storeSupportsTableService,
} from '../../../utils/storeDomain';

export type MarketplaceSortOption =
  | 'RECOMMENDED'
  | 'RATING'
  | 'DELIVERY_TIME'
  | 'DELIVERY_FEE'
  | 'DISTANCE';

export interface MarketplaceFilterParams {
  stores: Store[];
  menuItems: MenuItem[];
  searchQuery: string;
  selectedCategory: string;
  modalities: {
    delivery: boolean;
    pickup: boolean;
    tableReservation: boolean;
    openNow: boolean;
  };
  freeDeliveryOnly: boolean;
  favoritesOnly: boolean;
  favoriteStoreIds: string[];
  userCoords: [number, number];
  maxRadiusKm: number;
  sortBy: MarketplaceSortOption;
  featuredStoreIds?: string[];
  hiddenStoreIds?: string[];
}

export const getStoreEffectiveFee = (store: Store) =>
  store.deliveryModality === 'STORE_FLEET'
    ? store.ownFleetCustomFee ?? store.deliveryFee ?? 0
    : store.deliveryFee ?? 0;

export const getStoreDistanceKm = (store: Store, userCoords: [number, number]) =>
  typeof store.latitude === 'number' && typeof store.longitude === 'number'
    ? calculateHaversineKm(userCoords[0], userCoords[1], store.latitude, store.longitude)
    : 0;

export function filterAndSortMarketplaceStores({
  stores,
  menuItems,
  searchQuery,
  selectedCategory,
  modalities,
  freeDeliveryOnly,
  favoritesOnly,
  favoriteStoreIds,
  userCoords,
  maxRadiusKm,
  sortBy,
  featuredStoreIds = [],
  hiddenStoreIds = [],
}: MarketplaceFilterParams): Store[] {
  const queryLower = searchQuery.trim().toLowerCase();
  const hiddenSet = new Set(hiddenStoreIds);
  const featuredSet = new Set(featuredStoreIds);

  return stores
    .filter((store) => {
      if ((store as any).status === 'SUSPENDED') return false;
      if (hiddenSet.has(store.id)) return false;

      const matchesStoreText =
        !queryLower ||
        store.name.toLowerCase().includes(queryLower) ||
        store.category.toLowerCase().includes(queryLower) ||
        (store.showcaseTemplate?.tagline || '').toLowerCase().includes(queryLower) ||
        (store.address || '').toLowerCase().includes(queryLower);

      const matchesMenuCatalog =
        Boolean(queryLower) &&
        menuItems.some(
          (item) =>
            item.storeId === store.id &&
            item.isAvailable !== false &&
            (item.name.toLowerCase().includes(queryLower) ||
              (item.description || '').toLowerCase().includes(queryLower) ||
              (item.category || '').toLowerCase().includes(queryLower))
        );

      const matchesSearch = matchesStoreText || matchesMenuCatalog;

      const catStr = (store.category as string).toUpperCase();
      const selected = selectedCategory;
      const selectedUpper = selected.toUpperCase();
      const matchesCategory =
        selected === 'Todos' ||
        (selectedUpper === 'MULTI_COMMERCE' && isMultiCommerceStore(store)) ||
        ((selected === 'Gastronomia' ||
          selected === 'Restaurantes' ||
          selectedUpper === 'RESTAURANT') &&
          [
            'BURGER',
            'PIZZA',
            'RESTAURANT',
            'JAPANESE',
            'SUSHI',
            'BAKERY',
            'CAFE',
            'ICE_CREAM',
            'FOOD',
            'MULTI_COMMERCE',
          ].includes(catStr)) ||
        ((selected === 'Móveis & Decoração' || selectedUpper === 'FURNITURE') &&
          ['FURNITURE', 'DECOR', 'HOME'].includes(catStr)) ||
        ((selected === 'Eletrônicos & Tech' || selectedUpper === 'ELECTRONICS') &&
          ['ELECTRONICS', 'TECH', 'INFORMATICA'].includes(catStr)) ||
        ((selected === 'Moda & Vestuário' || selectedUpper === 'FASHION') &&
          ['FASHION', 'CLOTHING'].includes(catStr)) ||
        ((selected === 'Serviços' || selectedUpper === 'SERVICES') &&
          ['SERVICES', 'SERVICE', 'BARBER', 'BEAUTY'].includes(catStr)) ||
        ((selected === 'Varejo & Empório' ||
          selected === 'Varejo' ||
          selectedUpper === 'RETAIL') &&
          ['RETAIL', 'GROCERY', 'PHARMACY', 'PETSHOP', 'MULTI_COMMERCE'].includes(catStr)) ||
        (selected === 'Bebidas' || selectedUpper === 'BEVERAGES' ? catStr === 'BEVERAGES' : false) ||
        ((selected === 'Saúde' || selectedUpper === 'HEALTH') &&
          ['PHARMACY', 'HEALTH'].includes(catStr)) ||
        (selectedUpper === 'BEAUTY' && ['BEAUTY', 'BARBER'].includes(catStr)) ||
        catStr === selectedUpper;

      const matchesOpenNow = !modalities.openNow || store.isOpen !== false;
      const matchesTableModality =
        !modalities.tableReservation || storeSupportsTableService(store);

      const allowed = getAllowedModalities(store);
      const isService = isServiceCategory(store.category);
      const wantsDelivery = Boolean(modalities.delivery);
      const wantsPickup = Boolean(modalities.pickup);
      const matchesFulfillmentModality =
        isService ||
        (!wantsDelivery && !wantsPickup) ||
        (wantsDelivery && wantsPickup
          ? allowed.includes('DELIVERY') || allowed.includes('PICKUP')
          : wantsDelivery
          ? allowed.includes('DELIVERY')
          : allowed.includes('PICKUP'));

      const matchesFreeDelivery = !freeDeliveryOnly || getStoreEffectiveFee(store) === 0;
      const matchesFavorites = !favoritesOnly || favoriteStoreIds.includes(store.id);

      const matchesRadius =
        typeof store.latitude === 'number' && typeof store.longitude === 'number'
          ? getStoreDistanceKm(store, userCoords) <= maxRadiusKm
          : true;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesOpenNow &&
        matchesTableModality &&
        matchesFulfillmentModality &&
        matchesFreeDelivery &&
        matchesFavorites &&
        matchesRadius
      );
    })
    .sort((a, b) => {
      if (sortBy === 'RATING') {
        return (b.rating || 0) - (a.rating || 0);
      }
      if (sortBy === 'DELIVERY_TIME') {
        return (a.deliveryTimeMin || 30) - (b.deliveryTimeMin || 30);
      }
      if (sortBy === 'DELIVERY_FEE') {
        return getStoreEffectiveFee(a) - getStoreEffectiveFee(b);
      }
      if (sortBy === 'DISTANCE') {
        return getStoreDistanceKm(a, userCoords) - getStoreDistanceKm(b, userCoords);
      }
      const aOpen = a.isOpen !== false ? 1 : 0;
      const bOpen = b.isOpen !== false ? 1 : 0;
      if (aOpen !== bOpen) return bOpen - aOpen;
      const aFeatured = featuredSet.has(a.id) ? 1 : 0;
      const bFeatured = featuredSet.has(b.id) ? 1 : 0;
      if (aFeatured !== bFeatured) return bFeatured - aFeatured;
      const aFav = favoriteStoreIds.includes(a.id) ? 1 : 0;
      const bFav = favoriteStoreIds.includes(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return (b.rating || 0) - (a.rating || 0);
    });
}
