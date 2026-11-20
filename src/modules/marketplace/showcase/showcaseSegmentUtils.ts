import { MenuItem, Store } from '../../../types';
import { getItemSegmentGroup, ShowcaseTabId } from '../../../utils/storeDomain';

export interface ShowcaseLayoutFlags {
  isPizza: boolean;
  isRetail: boolean;
  isBurger: boolean;
  isSushi: boolean;
  isCafe: boolean;
  isFurniture: boolean;
  isTech: boolean;
  isFashion: boolean;
  isService: boolean;
}

export function buildShowcaseLayoutFlags(store: Store, isServiceStore: boolean, isMultiStore: boolean): ShowcaseLayoutFlags {
  const config = store.showcaseTemplate;
  const customSections = config?.customSections;
  const templateId = config?.templateId || 'BURGER_MODERN';

  return {
    isPizza: store.category === 'PIZZA' || templateId === 'PIZZA_TRATTORIA',
    isRetail: store.category === 'RETAIL' || templateId === 'RETAIL_EMPORIO' || (isMultiStore && customSections?.cardDensity === 'COMPACT'),
    isBurger: store.category === 'BURGER' || templateId === 'BURGER_MODERN',
    isSushi: store.category === 'JAPANESE' || templateId === 'JAPANESE_SUSHI',
    isCafe: store.category === 'BEVERAGES' || templateId === 'CAFE_CONFEITARIA',
    isFurniture: store.category === 'FURNITURE' || templateId === 'FURNITURE_SHOWROOM',
    isTech: store.category === 'ELECTRONICS' || templateId === 'TECH_ELECTRONICS',
    isFashion: store.category === 'FASHION' || templateId === 'FASHION_BOUTIQUE',
    isService: isServiceStore || templateId === 'SERVICES_APPOINTMENT',
  };
}

export function computeShowcaseDisplayedItems(params: {
  store: Store;
  storeItems: MenuItem[];
  isMultiStore: boolean;
  segmentFilter: 'ALL' | 'FOOD' | 'RETAIL' | 'SERVICE';
  selectedCategory: string;
  activeTab: ShowcaseTabId;
}) {
  const { store, storeItems, isMultiStore, segmentFilter, selectedCategory, activeTab } = params;
  const customSections = store.showcaseTemplate?.customSections;

  const sectionVisibleItems = isMultiStore
    ? storeItems.filter((item) => {
        const grp = getItemSegmentGroup(item, store);
        if (grp === 'FOOD' && customSections?.showFoodSection === false) return false;
        if (grp === 'RETAIL' && customSections?.showRetailSection === false) return false;
        if (grp === 'SERVICE' && customSections?.showServicesSection === false) return false;
        return true;
      })
    : storeItems;

  const segmentScopedItems =
    isMultiStore && segmentFilter !== 'ALL'
      ? sectionVisibleItems.filter((item) => getItemSegmentGroup(item, store) === segmentFilter)
      : sectionVisibleItems;

  const categories = ['Todos', ...Array.from(new Set(segmentScopedItems.map((i) => i.category || 'Geral')))];

  let displayedItems = segmentScopedItems;
  if (activeTab === 'CARDAPIO') {
    if (selectedCategory !== 'Todos') {
      displayedItems = segmentScopedItems.filter((i) => (i.category || 'Geral') === selectedCategory);
    }
  } else if (activeTab === 'PROMOCOES') {
    const availableItems = sectionVisibleItems.filter((i) => i.isAvailable !== false);
    const promoItems = availableItems.filter(
      (i) =>
        (i.category && /promo|combo|oferta|econ|pacote/i.test(i.category)) ||
        (i.description && /combo especial|leve 2|desconto|preço promocional|pacote/i.test(i.description))
    );
    const avgPrice =
      availableItems.length > 0
        ? availableItems.reduce((acc, it) => acc + it.price, 0) / availableItems.length
        : 30;
    displayedItems = promoItems.length > 0 ? promoItems : availableItems.filter((i) => i.price <= avgPrice * 0.85);
  } else if (activeTab === 'DESTAQUES') {
    displayedItems = [...sectionVisibleItems]
      .filter((i) => i.isAvailable !== false)
      .sort((a, b) => (b.stock || 0) - (a.stock || 0))
      .slice(0, 6);
  }

  return { categories, displayedItems };
}
