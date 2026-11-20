import React, { useState } from 'react';
import { ConsumerProfileComponent } from '../common/ConsumerProfile';
import { isServiceCategory, ShowcaseTabId } from '../../utils/storeDomain';

import { MarketplaceItemModal } from '../../modules/marketplace/MarketplaceItemModal';
import { MarketplaceCheckoutModal } from '../../modules/marketplace/MarketplaceCheckoutModal';
import { StoreShowcaseModal } from '../../modules/marketplace/StoreShowcaseModal';
import { MarketplaceOrderTracking } from '../../modules/marketplace/MarketplaceOrderTracking';

import { MarketplaceStoreShowcaseView } from '../../modules/marketplace/MarketplaceStoreShowcaseView';
import { MarketplaceFeedTab } from '../../modules/marketplace/MarketplaceFeedTab';
import { MarketplaceInstitutionalTab } from '../../modules/marketplace/MarketplaceInstitutionalTab';
import { AiConciergeModal } from '../../modules/marketplace/AiConciergeModal';

import { useMarketplaceLogic } from '../../modules/marketplace/hooks/useMarketplaceLogic';
import { MarketplaceNavbar } from '../../modules/marketplace/layout/MarketplaceNavbar';
import { MarketplaceActiveOrders } from '../../modules/marketplace/layout/MarketplaceActiveOrders';
import { MarketplaceSpotlightSection } from '../../modules/marketplace/layout/MarketplaceSpotlightSection';
import { FloatingAiButton } from '../../modules/marketplace/layout/FloatingAiButton';

export const MarketplacePillar: React.FC = () => {
  const [requestedShowcaseTab, setRequestedShowcaseTab] = useState<ShowcaseTabId | null>(null);
  const {
    ecosystem,
    isConsumerAuthenticated,
    publicConfig,
    openAuthModal,
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
    consumerOrders,
    trackingOrder
  } = useMarketplaceLogic({
    onTableOrderSuccess: () => setRequestedShowcaseTab('AUTOATENDIMENTO')
  });

  const getEffectiveDeliveryFee = (targetStore?: any) => {
    if (!targetStore) return 0;
    return targetStore.deliveryModality === 'STORE_FLEET'
      ? (targetStore.ownFleetCustomFee ?? targetStore.deliveryFee)
      : targetStore.deliveryFee;
  };
  const cartStoreId = ecosystem.cart[0]?.menuItem?.storeId;
  const cartStore = ecosystem.stores.find((s) => s.id === cartStoreId) || ecosystem.currentStore;
  const activeDeliveryFee = getEffectiveDeliveryFee(cartStore || ecosystem.currentStore);

  if (trackingOrder) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <MarketplaceOrderTracking
          order={trackingOrder}
          onBack={() => setTrackingOrderId(null)}
          onReorder={handleReorder}
        />
      </div>
    );
  }

  if (ecosystem.selectedStoreSlugForShowcase) {
    const storeToShow = ecosystem.stores.find((s) => s.slug === ecosystem.selectedStoreSlugForShowcase);
    if (storeToShow) {
      const storeItems = ecosystem.menuItems.filter((m) => m.storeId === storeToShow.id);
      const isServiceStore = isServiceCategory(storeToShow.category);
      const checkoutTargetStore = cartStoreId ? cartStore : storeToShow;
      return (
        <>
          <MarketplaceStoreShowcaseView
            store={storeToShow}
            storeItems={storeItems}
            cartTotal={ecosystem.cartTotal}
            onBackToMarketplace={() => ecosystem.setSelectedStoreSlugForShowcase(null)}
            onOpenCheckout={() => setIsCheckoutOpen(true)}
            onOpenItemModal={handleOpenItemModal}
            consumptionModality={consumptionModality}
            setConsumptionModality={setConsumptionModality}
            tableNumber={tableNumber}
            setTableNumber={setTableNumber}
            requestedTab={requestedShowcaseTab}
            onClearRequestedTab={() => setRequestedShowcaseTab(null)}
          />
          <MarketplaceItemModal
            item={activeItemModal}
            onClose={() => setActiveItemModal(null)}
            quantity={itemQuantity}
            setQuantity={setItemQuantity}
            notes={itemNotes}
            setNotes={setItemNotes}
            onAddToCart={handleAddToCartSubmit}
            isServiceStore={isServiceStore}
            isStoreClosed={storeToShow.isOpen === false}
            onScheduleService={(serviceItem) => {
              setRequestedShowcaseTab('RESERVAS');
              ecosystem.showNotification(`Escolha data e horário para "${serviceItem.name}".`);
            }}
          />
          <MarketplaceCheckoutModal
            isOpen={isCheckoutOpen}
            onClose={() => setIsCheckoutOpen(false)}
            onSubmit={handleConfirmOrder}
            name={checkoutName}
            setName={setCheckoutName}
            phone={checkoutPhone}
            setPhone={setCheckoutPhone}
            address={checkoutAddress}
            setAddress={setCheckoutAddress}
            payment={checkoutPayment}
            setPayment={setCheckoutPayment}
            coupon={checkoutCoupon}
            setCoupon={setCheckoutCoupon}
            deliveryInstructions={checkoutNotes}
            setDeliveryInstructions={setCheckoutNotes}
            needCutlery={needCutlery}
            setNeedCutlery={setNeedCutlery}
            cartTotal={ecosystem.cartTotal}
            deliveryFee={getEffectiveDeliveryFee(checkoutTargetStore)}
            consumptionModality={consumptionModality}
            setConsumptionModality={setConsumptionModality}
            tableNumber={tableNumber}
            setTableNumber={setTableNumber}
            tableBillingMode={tableBillingMode}
            setTableBillingMode={setTableBillingMode}
            courierTip={courierTip}
            setCourierTip={setCourierTip}
            store={checkoutTargetStore}
            isSubmitting={isSubmittingOrder}
          />
        </>
      );
    }
  }

  const activeItemStore = activeItemModal
    ? ecosystem.stores.find((s) => s.id === activeItemModal.storeId)
    : undefined;

  const effectiveMarketplaceConfig =
    publicConfig?.marketplaceConfig || ecosystem.governance?.marketplaceConfig;
  const isMarketplaceReadOnly = Boolean(
    publicConfig?.marketplaceReadOnly ||
      ecosystem.governance?.featureFlags?.marketplaceMaintenanceReadOnly
  );
  const maintenanceNotice =
    publicConfig?.maintenanceMessage ||
    ecosystem.governance?.maintenanceMessage ||
    'Pedidos temporariamente pausados para manutenção programada. Você ainda pode explorar as vitrines.';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {isMarketplaceReadOnly && (
        <div className="bg-rose-500/15 border border-rose-500/35 text-rose-200 px-4 py-3 rounded-2xl text-xs font-semibold">
          {maintenanceNotice}
        </div>
      )}
      {(publicConfig?.globalAnnouncementBanner || ecosystem.governance?.globalAnnouncementBanner) && (
        <div className="bg-amber-500/15 border border-amber-500/40 text-amber-200 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-3">
          <span>
            {publicConfig?.globalAnnouncementBanner || ecosystem.governance?.globalAnnouncementBanner}
          </span>
          {ecosystem.governance?.supportWhatsapp && (
            <span className="text-[10px] font-mono text-amber-400 shrink-0">
              Suporte: {ecosystem.governance.supportWhatsapp}
            </span>
          )}
        </div>
      )}
      <MarketplaceNavbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeOrdersCount={activeOrders.length}
        onBackToPortal={() => ecosystem.setActiveSection('portal')}
        onOpenCheckout={() => setIsCheckoutOpen(true)}
        cartCount={ecosystem.cart.reduce((a, b) => a + b.quantity, 0)}
        cartTotal={ecosystem.cartTotal}
        isConsumerAuthenticated={isConsumerAuthenticated}
        onSignInConsumer={() => openAuthModal('login', 'CUSTOMER', 'marketplace')}
      />
      {activeTab === 'marketplace' && (
        <MarketplaceSpotlightSection
          stores={ecosystem.stores}
          marketplaceConfig={effectiveMarketplaceConfig}
          onOpenStoreShowcase={(slug) => ecosystem.setSelectedStoreSlugForShowcase(slug)}
        />
      )}

      {activeTab === 'marketplace' && (
        <MarketplaceFeedTab
          geoAddress={ecosystem.geoAddress}
          setGeoAddress={ecosystem.setGeoAddress}
          maxRadiusKm={ecosystem.maxRadiusKm}
          setMaxRadiusKm={ecosystem.setMaxRadiusKm}
          modalities={ecosystem.modalities}
          toggleModality={ecosystem.toggleModality}
          selectedCategory={ecosystem.selectedCategory}
          setSelectedCategory={ecosystem.setSelectedCategory}
          searchQuery={ecosystem.searchQuery}
          setSearchQuery={ecosystem.setSearchQuery}
          marketplaceViewMode={ecosystem.marketplaceViewMode}
          setMarketplaceViewMode={ecosystem.setMarketplaceViewMode}
          filteredStores={filteredStores}
          cartCount={ecosystem.cart.reduce((s, i) => s + i.quantity, 0)}
          cartTotal={ecosystem.cartTotal}
          onOpenCheckout={() => setIsCheckoutOpen(true)}
          onSelectStoreModal={(store) => setActiveStoreModal(store)}
          onOpenStoreShowcase={(slug) => ecosystem.setSelectedStoreSlugForShowcase(slug)}
          onShowNotification={ecosystem.showNotification}
          onSmartSearch={handleSmartSearch}
          aiDiscoveryLoading={aiDiscoveryLoading}
          aiDiscoveryResponse={aiDiscoveryResponse}
          activeOrders={activeOrders}
          onTrackOrder={setTrackingOrderId}
          onRequestGeolocation={ecosystem.requestUserGeolocation}
          onGeocodeAddress={ecosystem.geocodeUserAddress}
          isGeocodingAddress={ecosystem.isGeocodingAddress}
          userCoords={ecosystem.userCoords}
          gpsCoords={ecosystem.gpsCoords}
          gpsAccuracyMeters={ecosystem.gpsAccuracyMeters}
          locationSource={ecosystem.locationSource}
          sortBy={sortBy}
          setSortBy={setSortBy}
          freeDeliveryOnly={freeDeliveryOnly}
          setFreeDeliveryOnly={setFreeDeliveryOnly}
          favoritesOnly={favoritesOnly}
          setFavoritesOnly={setFavoritesOnly}
        />
      )}

      {activeTab === 'orders' && isConsumerAuthenticated && (
        <MarketplaceActiveOrders
          orders={consumerOrders}
          activeOrders={activeOrders}
          onTrackOrder={setTrackingOrderId}
          onExplore={() => setActiveTab('marketplace')}
          onReorder={handleReorder}
        />
      )}

      {activeTab === 'institutional' && <MarketplaceInstitutionalTab />}

      {activeTab === 'consumer-account' && isConsumerAuthenticated && <ConsumerProfileComponent />}

      <StoreShowcaseModal
        store={activeStoreModal}
        onClose={() => setActiveStoreModal(null)}
        menuItems={ecosystem.menuItems}
        onAddToCart={(item) => {
          ecosystem.addToCart(item, 1);
        }}
        onOpenCheckout={() => {
          setActiveStoreModal(null);
          setIsCheckoutOpen(true);
        }}
        onOpenFullShowcase={(slug) => {
          setActiveStoreModal(null);
          ecosystem.setSelectedStoreSlugForShowcase(slug);
        }}
        tableNumber={tableNumber}
        setTableNumber={setTableNumber}
        onActivateTableModality={() => setConsumptionModality('TABLE')}
      />

      <MarketplaceItemModal
        item={activeItemModal}
        onClose={() => setActiveItemModal(null)}
        quantity={itemQuantity}
        setQuantity={setItemQuantity}
        notes={itemNotes}
        setNotes={setItemNotes}
        onAddToCart={handleAddToCartSubmit}
        isServiceStore={isServiceCategory(activeItemStore?.category)}
        isStoreClosed={activeItemStore?.isOpen === false}
        onScheduleService={
          activeItemStore
            ? (serviceItem) => {
                ecosystem.setSelectedStoreSlugForShowcase(activeItemStore.slug);
                setRequestedShowcaseTab('RESERVAS');
                ecosystem.showNotification(`Escolha data e horário para "${serviceItem.name}".`);
              }
            : undefined
        }
      />

      <MarketplaceCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onSubmit={handleConfirmOrder}
        name={checkoutName}
        setName={setCheckoutName}
        phone={checkoutPhone}
        setPhone={setCheckoutPhone}
        address={checkoutAddress}
        setAddress={setCheckoutAddress}
        payment={checkoutPayment}
        setPayment={setCheckoutPayment}
        coupon={checkoutCoupon}
        setCoupon={setCheckoutCoupon}
        deliveryInstructions={checkoutNotes}
        setDeliveryInstructions={setCheckoutNotes}
        needCutlery={needCutlery}
        setNeedCutlery={setNeedCutlery}
        cartTotal={ecosystem.cartTotal}
        deliveryFee={activeDeliveryFee}
        consumptionModality={consumptionModality}
        setConsumptionModality={setConsumptionModality}
        tableNumber={tableNumber}
        setTableNumber={setTableNumber}
        tableBillingMode={tableBillingMode}
        setTableBillingMode={setTableBillingMode}
        courierTip={courierTip}
        setCourierTip={setCourierTip}
        store={cartStore}
        isSubmitting={isSubmittingOrder}
      />

      {publicConfig?.aiEngineEnabled && isConsumerAuthenticated && (
        <>
          <AiConciergeModal
            isOpen={isAiConciergeOpen}
            onClose={() => setIsAiConciergeOpen(false)}
            onSelectStore={(slug) => {
              ecosystem.setSelectedStoreSlugForShowcase(slug);
              setIsAiConciergeOpen(false);
            }}
            stores={ecosystem.stores}
          />
          <FloatingAiButton onClick={() => setIsAiConciergeOpen(true)} />
        </>
      )}
    </div>
  );
};
