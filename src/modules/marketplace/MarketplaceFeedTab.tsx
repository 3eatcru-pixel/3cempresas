import React from 'react';
import { Clock, ChevronRight } from 'lucide-react';
import { Store } from '../../types';
import { MarketplaceSortOption } from './hooks/useMarketplaceLogic';

// Modular Layout Components
import { MarketplaceFeedControls } from './layout/MarketplaceFeedControls';
import { AiDiscoverySection } from './layout/AiDiscoverySection';
import { StoreListView } from './layout/StoreListView';

interface MarketplaceFeedTabProps {
  geoAddress: string;
  setGeoAddress: (val: string) => void;
  maxRadiusKm: number;
  setMaxRadiusKm: (val: number) => void;
  modalities: any;
  toggleModality: (key: any) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  marketplaceViewMode: 'grid' | 'fichario' | 'livro-razao' | 'map';
  setMarketplaceViewMode: (mode: 'grid' | 'fichario' | 'livro-razao' | 'map') => void;
  filteredStores: Store[];
  cartCount: number;
  cartTotal: number;
  onOpenCheckout: () => void;
  onSelectStoreModal: (store: Store) => void;
  onOpenStoreShowcase: (slug: string) => void;
  onShowNotification: (msg: string) => void;
  onSmartSearch: () => void;
  aiDiscoveryLoading: boolean;
  aiDiscoveryResponse: string | null;
  activeOrders: any[];
  onTrackOrder: (id: string) => void;
  onRequestGeolocation?: () => void;
  onGeocodeAddress?: () => void;
  isGeocodingAddress?: boolean;
  userCoords?: [number, number];
  gpsCoords?: [number, number] | null;
  gpsAccuracyMeters?: number | null;
  locationSource?: 'GPS' | 'ADDRESS' | 'DEFAULT';
  sortBy?: MarketplaceSortOption;
  setSortBy?: (val: MarketplaceSortOption) => void;
  freeDeliveryOnly?: boolean;
  setFreeDeliveryOnly?: (val: boolean) => void;
  favoritesOnly?: boolean;
  setFavoritesOnly?: (val: boolean) => void;
}

export const MarketplaceFeedTab: React.FC<MarketplaceFeedTabProps> = ({
  geoAddress,
  setGeoAddress,
  maxRadiusKm,
  setMaxRadiusKm,
  modalities,
  toggleModality,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  marketplaceViewMode,
  setMarketplaceViewMode,
  filteredStores,
  onSelectStoreModal,
  onOpenStoreShowcase,
  onSmartSearch,
  aiDiscoveryLoading,
  aiDiscoveryResponse,
  activeOrders,
  onTrackOrder,
  onRequestGeolocation,
  onGeocodeAddress,
  isGeocodingAddress,
  userCoords,
  gpsCoords,
  gpsAccuracyMeters,
  locationSource,
  sortBy,
  setSortBy,
  freeDeliveryOnly,
  setFreeDeliveryOnly,
  favoritesOnly,
  setFavoritesOnly,
}) => {
  const hasActiveFilters =
    Boolean(searchQuery) ||
    selectedCategory !== 'Todos' ||
    Boolean(freeDeliveryOnly) ||
    Boolean(favoritesOnly) ||
    Boolean(modalities?.openNow) ||
    Boolean(modalities?.tableReservation);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('Todos');
    setFreeDeliveryOnly?.(false);
    setFavoritesOnly?.(false);
    setMaxRadiusKm(25);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {Array.isArray(activeOrders) && activeOrders.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-500/35 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-white uppercase tracking-wider truncate">
                {activeOrders.length === 1
                  ? `Pedido ${activeOrders[0]?.code || ''} em andamento`
                  : `${activeOrders.length} pedidos em andamento`}
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                {activeOrders[0]?.storeName || 'Estabelecimento'} • Toque para acompanhar status, rota GPS ou PIN de entrega.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onTrackOrder(activeOrders[0].id)}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer"
          >
            <span>Acompanhar</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <MarketplaceFeedControls
        geoAddress={geoAddress}
        setGeoAddress={setGeoAddress}
        maxRadiusKm={maxRadiusKm}
        setMaxRadiusKm={setMaxRadiusKm}
        modalities={modalities}
        toggleModality={toggleModality}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        marketplaceViewMode={marketplaceViewMode}
        setMarketplaceViewMode={setMarketplaceViewMode}
        onSmartSearch={onSmartSearch}
        aiDiscoveryLoading={aiDiscoveryLoading}
        onRequestGeolocation={onRequestGeolocation}
        onGeocodeAddress={onGeocodeAddress}
        isGeocodingAddress={isGeocodingAddress}
        userCoords={userCoords}
        gpsCoords={gpsCoords}
        gpsAccuracyMeters={gpsAccuracyMeters}
        locationSource={locationSource}
        sortBy={sortBy}
        setSortBy={setSortBy}
        freeDeliveryOnly={freeDeliveryOnly}
        setFreeDeliveryOnly={setFreeDeliveryOnly}
        favoritesOnly={favoritesOnly}
        setFavoritesOnly={setFavoritesOnly}
      />

      <AiDiscoverySection
        loading={aiDiscoveryLoading}
        response={aiDiscoveryResponse}
        onSelectStore={onOpenStoreShowcase}
      />

      {/* Main Feed Content */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-white uppercase tracking-widest italic">Explorar Estabelecimentos</h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-500 font-bold">
              {filteredStores.length} estabelecimentos em até {maxRadiusKm} km
            </span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[10px] font-bold text-amber-400 hover:text-amber-300 uppercase tracking-wider cursor-pointer"
            >
              Limpar Filtros Ativos
            </button>
          )}
        </div>

        <StoreListView
          viewMode={marketplaceViewMode}
          stores={filteredStores}
          onOpenStore={onOpenStoreShowcase}
          onOpenModal={onSelectStoreModal}
          onResetFilters={handleResetFilters}
        />
      </div>

    </div>
  );
};
