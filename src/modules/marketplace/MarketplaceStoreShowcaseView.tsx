import React, { useState, useEffect } from 'react';
import { Store, MenuItem } from '../../types';
import { useConsumer } from '../../context/ConsumerContext';
import { useEcosystem } from '../../context/EcosystemContext';
import {
  getAllowedModalities,
  getAllowedShowcaseTabs,
  isItemService,
  isMultiCommerceStore,
  isServiceCategory,
  storeSupportsTableService,
  ShowcaseTabId,
} from '../../utils/storeDomain';
import { getStoreCategoryPrimaryHex } from '@3c/design-system';

import { StoreShowcaseHeader } from './layout/StoreShowcaseHeader';
import { StoreShowcaseTabs } from './layout/StoreShowcaseTabs';
import { StoreShowcaseAbout } from './layout/StoreShowcaseAbout';
import { StoreShowcaseReservationForm } from './layout/StoreShowcaseReservationForm';
import { StoreShowcaseAutoService } from './layout/StoreShowcaseAutoService';
import { StoreShowcaseCategoryBar } from './layout/StoreShowcaseCategoryBar';
import { StoreShowcaseCartFloatingBar } from './layout/StoreShowcaseCartFloatingBar';
import { ShowcaseTableBanner } from './showcase/ShowcaseTableBanner';
import { ShowcaseMultivendasBar } from './showcase/ShowcaseMultivendasBar';
import { ShowcaseItemsGrid } from './showcase/ShowcaseItemsGrid';
import {
  buildShowcaseLayoutFlags,
  computeShowcaseDisplayedItems,
} from './showcase/showcaseSegmentUtils';

interface MarketplaceStoreShowcaseViewProps {
  store: Store;
  storeItems: MenuItem[];
  cartTotal: number;
  onBackToMarketplace: () => void;
  onOpenCheckout: () => void;
  onOpenItemModal: (item: MenuItem) => void;
  consumptionModality?: 'DELIVERY' | 'PICKUP' | 'TABLE';
  setConsumptionModality?: (m: 'DELIVERY' | 'PICKUP' | 'TABLE') => void;
  tableNumber?: number;
  setTableNumber?: (t: number) => void;
  requestedTab?: ShowcaseTabId | null;
  onClearRequestedTab?: () => void;
}

export const MarketplaceStoreShowcaseView: React.FC<MarketplaceStoreShowcaseViewProps> = ({
  store,
  storeItems,
  cartTotal,
  onBackToMarketplace,
  onOpenCheckout,
  onOpenItemModal,
  consumptionModality,
  setConsumptionModality,
  tableNumber,
  setTableNumber,
  requestedTab,
  onClearRequestedTab,
}) => {
  const { consumer, toggleFavoriteStore } = useConsumer();
  const { addToCart, showNotification, addReservation } = useEcosystem();

  const [internalModality, setInternalModality] = useState<'DELIVERY' | 'PICKUP' | 'TABLE'>('DELIVERY');
  const [internalTable, setInternalTable] = useState<number>(4);

  const activeModality = consumptionModality ?? internalModality;
  const updateModality = setConsumptionModality ?? setInternalModality;
  const currentTable = tableNumber ?? internalTable;
  const updateTable = setTableNumber ?? setInternalTable;

  const [activeTab, setActiveTab] = useState<ShowcaseTabId>('CARDAPIO');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [segmentFilter, setSegmentFilter] = useState<'ALL' | 'FOOD' | 'RETAIL' | 'SERVICE'>('ALL');
  const [showcaseSearch, setShowcaseSearch] = useState<string>('');
  const [showcaseSort, setShowcaseSort] = useState<'DEFAULT' | 'PRICE_ASC' | 'PRICE_DESC' | 'NAME'>('DEFAULT');
  const [availableOnly, setAvailableOnly] = useState<boolean>(false);
  const [isLightMode, setIsLightMode] = useState<boolean>(false);
  const [selectedServiceItem, setSelectedServiceItem] = useState<MenuItem | null>(null);

  const allowedTabs = getAllowedShowcaseTabs(store);
  const allowedModalities = getAllowedModalities(store);
  const supportsTable = storeSupportsTableService(store);
  const isServiceStore = isServiceCategory(store.category);
  const isMultiStore = isMultiCommerceStore(store);

  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab('CARDAPIO');
    }
    if (!isServiceStore && allowedModalities.length > 0 && !allowedModalities.includes(activeModality)) {
      updateModality(allowedModalities[0]);
    }
    setSelectedCategory('Todos');
    setSegmentFilter('ALL');
    setShowcaseSearch('');
    setShowcaseSort('DEFAULT');
    setAvailableOnly(false);
    setSelectedServiceItem(null);
  }, [store.id]);

  useEffect(() => {
    if (requestedTab && allowedTabs.includes(requestedTab)) {
      setActiveTab(requestedTab);
      onClearRequestedTab?.();
    }
  }, [requestedTab]);

  const config = store.showcaseTemplate;
  const primaryColor = config?.primaryColor || getStoreCategoryPrimaryHex(store.category);
  const isFavorite = consumer.favoriteStoreIds.includes(store.id);

  const layout = buildShowcaseLayoutFlags(store, isServiceStore, isMultiStore);
  const { categories, displayedItems: baseDisplayedItems } = computeShowcaseDisplayedItems({
    store,
    storeItems,
    isMultiStore,
    segmentFilter,
    selectedCategory,
    activeTab,
  });

  const searchLower = showcaseSearch.trim().toLowerCase();
  const displayedItems = baseDisplayedItems
    .filter((item) => {
      if (availableOnly && (item.stock <= 0 || item.isAvailable === false)) {
        return false;
      }
      if (!searchLower) return true;
      return (
        item.name.toLowerCase().includes(searchLower) ||
        (item.description || '').toLowerCase().includes(searchLower) ||
        (item.category || '').toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      const priceA = a.price;
      const priceB = b.price;
      if (showcaseSort === 'PRICE_ASC') return priceA - priceB;
      if (showcaseSort === 'PRICE_DESC') return priceB - priceA;
      if (showcaseSort === 'NAME') return a.name.localeCompare(b.name, 'pt-BR');
      return 0;
    });

  const isStoreClosed = store.isOpen === false;

  const handleDirectAdd = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    if (layout.isService || isItemService(item, store)) {
      setSelectedServiceItem(item);
      setActiveTab('RESERVAS');
      showNotification(`Escolha a data e horário para "${item.name}".`);
      return;
    }
    if (isStoreClosed) {
      showNotification(`Pedido recusado: "${store.name}" encontra-se fechado no momento.`);
      return;
    }
    addToCart(item);
    showNotification(
      activeModality === 'TABLE' && supportsTable
        ? `${item.name} adicionado à comanda da Mesa ${String(currentTable).padStart(2, '0')}!`
        : `${item.name} adicionado à sacola!`
    );
  };

  return (
    <div
      className={`min-h-screen font-sans pb-24 animate-fadeIn transition-colors ${
        isLightMode ? 'bg-stone-50 text-stone-900' : 'bg-slate-950 text-slate-100'
      }`}
    >
      <StoreShowcaseHeader
        store={store}
        config={config}
        primaryColor={primaryColor}
        isLightMode={isLightMode}
        setIsLightMode={setIsLightMode}
        isFavorite={isFavorite}
        onToggleFavorite={() => toggleFavoriteStore(store.id)}
        onBack={onBackToMarketplace}
        onOpenCheckout={onOpenCheckout}
        cartTotal={cartTotal}
        activeModality={activeModality}
        updateModality={updateModality}
        currentTable={currentTable}
        onTabChange={setActiveTab}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {isStoreClosed && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-lg">
            <div>
              <div className="font-black uppercase tracking-wider text-rose-400">
                Estabelecimento Fechado no Momento
              </div>
              <p className="text-[11px] opacity-90 mt-0.5">
                {store.name} não está recebendo pedidos agora. Novos pedidos são recusados automaticamente até a
                reabertura.
              </p>
            </div>
          </div>
        )}

        {supportsTable && activeModality === 'TABLE' && (
          <ShowcaseTableBanner
            storeName={store.name}
            currentTable={currentTable}
            onManageTable={() => setActiveTab('AUTOATENDIMENTO')}
          />
        )}

        <StoreShowcaseTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentTable={currentTable}
          storeCategory={store.category}
          store={store}
          isLightMode={isLightMode}
          primaryColor={primaryColor}
          displayedItemsCount={displayedItems.length}
        />

        {activeTab === 'CARDAPIO' && isMultiStore && (
          <ShowcaseMultivendasBar
            store={store}
            segmentFilter={segmentFilter}
            onSelectSegment={(seg) => {
              setSegmentFilter(seg);
              setSelectedCategory('Todos');
            }}
            isLightMode={isLightMode}
            primaryColor={primaryColor}
          />
        )}

        {activeTab === 'CARDAPIO' && (
          <StoreShowcaseCategoryBar
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            isLightMode={isLightMode}
          />
        )}

        {activeTab === 'AUTOATENDIMENTO' && supportsTable && (
          <StoreShowcaseAutoService
            store={store}
            currentTable={currentTable}
            onTableChange={updateTable}
            onTabChange={setActiveTab}
            onOpenCheckout={onOpenCheckout}
            showNotification={showNotification}
            isLightMode={isLightMode}
          />
        )}

        {activeTab === 'RESERVAS' && allowedTabs.includes('RESERVAS') && (
          <StoreShowcaseReservationForm
            store={store}
            consumer={consumer}
            isLightMode={isLightMode}
            selectedServiceItem={selectedServiceItem}
            onClearSelectedService={() => setSelectedServiceItem(null)}
            onSuccess={() => {
              showNotification(
                layout.isService || selectedServiceItem
                  ? 'Agendamento solicitado com sucesso!'
                  : 'Pedido de reserva enviado! Aguarde a confirmação do estabelecimento.'
              );
              setSelectedServiceItem(null);
              setActiveTab('CARDAPIO');
            }}
            onSubmitReservation={addReservation}
          />
        )}

        {activeTab === 'SOBRE' && <StoreShowcaseAbout store={store} isLightMode={isLightMode} />}

        {(activeTab === 'CARDAPIO' || activeTab === 'PROMOCOES' || activeTab === 'DESTAQUES') && (
          <ShowcaseItemsGrid
            store={store}
            displayedItems={displayedItems}
            showcaseSearch={showcaseSearch}
            setShowcaseSearch={setShowcaseSearch}
            showcaseSort={showcaseSort}
            setShowcaseSort={setShowcaseSort}
            availableOnly={availableOnly}
            setAvailableOnly={setAvailableOnly}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            isLightMode={isLightMode}
            primaryColor={primaryColor}
            isStoreClosed={isStoreClosed}
            layout={layout}
            onOpenItemModal={onOpenItemModal}
            onDirectAdd={handleDirectAdd}
            onSelectServiceItem={setSelectedServiceItem}
          />
        )}
      </div>

      <StoreShowcaseCartFloatingBar
        cartTotal={cartTotal}
        onOpenCheckout={onOpenCheckout}
        isService={layout.isService}
        isStoreClosed={isStoreClosed}
        isTableMode={supportsTable && activeModality === 'TABLE'}
        tableNumber={currentTable}
        onOpenReservations={() => setActiveTab('RESERVAS')}
      />
    </div>
  );
};
