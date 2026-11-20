import React, { useState } from 'react';
import { MapPin, Compass, Search, Loader2, Sparkles, X } from 'lucide-react';
import { MarketplaceSortOption } from '../hooks/useMarketplaceLogic';
import {
  getGeolocationPermissionState,
  GeolocationPermissionState,
  calculateDistanceKm,
  isValidLatLng,
} from '../../../components/common/map/mapUtils';
import { MarketplaceGpsPrompts } from './feed/MarketplaceGpsPrompts';
import { MarketplaceFiltersToolbar } from './feed/MarketplaceFiltersToolbar';

interface FeedControlsProps {
  geoAddress: string;
  setGeoAddress: (val: string) => void;
  maxRadiusKm: number;
  setMaxRadiusKm: (val: number) => void;
  modalities: any;
  toggleModality: (key: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  marketplaceViewMode: string;
  setMarketplaceViewMode: (mode: any) => void;
  onSmartSearch: () => void;
  aiDiscoveryLoading: boolean;
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

export const MarketplaceFeedControls: React.FC<FeedControlsProps> = ({
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
  onSmartSearch,
  aiDiscoveryLoading,
  onRequestGeolocation,
  onGeocodeAddress,
  isGeocodingAddress = false,
  userCoords,
  gpsCoords,
  gpsAccuracyMeters,
  locationSource = 'DEFAULT',
  sortBy = 'RECOMMENDED',
  setSortBy,
  freeDeliveryOnly = false,
  setFreeDeliveryOnly,
  favoritesOnly = false,
  setFavoritesOnly,
}) => {
  const [gpsPromptState, setGpsPromptState] = useState<GeolocationPermissionState | null>(null);

  const gpsVsAddressDistanceKm =
    gpsCoords &&
    userCoords &&
    isValidLatLng(gpsCoords[0], gpsCoords[1]) &&
    isValidLatLng(userCoords[0], userCoords[1])
      ? calculateDistanceKm(gpsCoords[0], gpsCoords[1], userCoords[0], userCoords[1])
      : 0;
  const showReconciliationHint =
    locationSource === 'ADDRESS' && gpsCoords !== null && gpsVsAddressDistanceKm > 2.0;

  const handleGpsButtonClick = async () => {
    if (!onRequestGeolocation) return;
    const perm = await getGeolocationPermissionState();
    if (perm === 'granted') {
      setGpsPromptState(null);
      onRequestGeolocation();
      return;
    }
    setGpsPromptState(perm);
  };

  const handleConfirmGpsPermission = () => {
    setGpsPromptState(null);
    onRequestGeolocation?.();
  };

  return (
    <div className="space-y-4 relative z-20">
      {/* Search & Location Bar */}
      <div className="flex flex-col lg:flex-row gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onGeocodeAddress?.();
          }}
          className="relative z-10 flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex items-center gap-2 shadow-inner group focus-within:border-amber-500/50 transition-all"
        >
          <div className="p-2 bg-slate-950 rounded-xl text-slate-500 group-focus-within:text-amber-500">
            <MapPin className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Seu endereço ou CEP para entrega..."
            value={geoAddress}
            onChange={(e) => setGeoAddress(e.target.value)}
            className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full font-medium"
          />
          {onGeocodeAddress && (
            <button
              type="submit"
              disabled={isGeocodingAddress}
              title="Localizar endereço no OpenStreetMap para calcular raio"
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold uppercase rounded-xl transition-colors shrink-0 flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {isGeocodingAddress ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Search className="w-3 h-3 text-amber-400" />
              )}
              <span>Localizar</span>
            </button>
          )}
          <div className="h-8 w-px bg-slate-800" />
          <button
            type="button"
            onClick={handleGpsButtonClick}
            title="Solicitar permissão para usar seu GPS real"
            className="px-3 py-1.5 flex items-center gap-1.5 shrink-0 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-tighter">Usar GPS</span>
          </button>
        </form>

        <div className="flex-[1.5] bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex items-center gap-2 shadow-inner group focus-within:border-amber-500/50 transition-all">
          <div className="p-2 bg-slate-950 rounded-xl text-slate-500 group-focus-within:text-amber-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Busque por loja, prato ou produto (ex: Burger, Sushi, Picanha, Farmácia...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1.5 text-slate-500 hover:text-white rounded-lg cursor-pointer"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onSmartSearch}
            disabled={aiDiscoveryLoading}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase rounded-xl transition-all flex items-center gap-2 disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {aiDiscoveryLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
            )}
            <span>Descoberta IA</span>
          </button>
        </div>
      </div>

      <MarketplaceGpsPrompts
        gpsPromptState={gpsPromptState}
        setGpsPromptState={setGpsPromptState}
        onConfirmGpsPermission={handleConfirmGpsPermission}
        showReconciliationHint={showReconciliationHint}
        gpsVsAddressDistanceKm={gpsVsAddressDistanceKm}
        gpsAccuracyMeters={gpsAccuracyMeters}
        onRequestGeolocation={onRequestGeolocation}
        onGpsButtonClick={handleGpsButtonClick}
      />

      <MarketplaceFiltersToolbar
        maxRadiusKm={maxRadiusKm}
        setMaxRadiusKm={setMaxRadiusKm}
        modalities={modalities}
        toggleModality={toggleModality}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        marketplaceViewMode={marketplaceViewMode}
        setMarketplaceViewMode={setMarketplaceViewMode}
        sortBy={sortBy}
        setSortBy={setSortBy}
        freeDeliveryOnly={freeDeliveryOnly}
        setFreeDeliveryOnly={setFreeDeliveryOnly}
        favoritesOnly={favoritesOnly}
        setFavoritesOnly={setFavoritesOnly}
      />
    </div>
  );
};
