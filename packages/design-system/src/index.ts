export { OSWindow } from './components/OSWindow.tsx';
export type { OSWindowProps } from './components/OSWindow.tsx';

export { BrandLogo, BrandMark, BRAND_LOGO_SPECS } from './components/BrandLogo.tsx';
export type {
  BrandLogoId,
  BrandLogoSpec,
  BrandLogoProps,
  BrandMarkProps,
  BrandMarkSize,
  BrandMarkTone,
} from './components/BrandLogo.tsx';

export { CommandPalette } from './components/CommandPalette.tsx';
export type { CommandPaletteProps } from './components/CommandPalette.tsx';

export { MaturityBadge } from './components/MaturityBadge.tsx';
export type { MaturityBadgeProps, MaturityLevel } from './components/MaturityBadge.tsx';

export { MapDisplay, calculateDistanceKm } from './components/MapDisplay.tsx';
export type { MapDisplayProps, MapMarkerData, HeatPointData, MapTileStyle } from './components/MapDisplay.tsx';
export {
  MapControlsToolbar,
  GeofenceBadge,
  DistanceRulerBadge,
  NominatimSearchBar,
} from './components/map/MapOverlays.tsx';
export {
  isWebGlAvailable,
  createMarkerElement,
  TILE_PROVIDERS,
  VECTOR_STYLE_URLS,
  discoverLocalPmtilesCatalog,
  buildOfflinePmtilesStyle,
  isValidLatLng,
  lookupBrazilianCep,
  searchAddressSuggestions,
  geocodeAddressNominatim,
  reverseGeocodeNominatim,
  fetchStreetRouteOsrm,
  optimizeMultiStopTripOsrm,
  estimateCourierEtaMin,
  getGeolocationPermissionState,
  LONDRINA_CENTER_COORDS,
  isInsideLondrina,
} from './components/map/mapUtils.ts';
export type {
  NominatimGeocodeResult,
  OsrmRouteResult,
  OptimizedStopResult,
  GeolocationPermissionState,
  LocalPmtilesArchiveInfo,
  LocalPmtilesCatalogResponse,
} from './components/map/mapUtils.ts';

export {
  PILLAR_THEMES,
  SURFACE_TOKENS,
  STATUS_COLORS,
  TRANSPORT_COLORS,
  ROLE_COLORS,
  COMMERCE_SEGMENT_COLORS,
  ORDER_STATUS_COLORS,
  STORE_OS_WALLPAPERS,
  getPillarTheme,
  getStatusColorToken,
  getStoreCategoryPrimaryHex,
} from './tokens/colors.ts';
export type {
  PillarId,
  PillarColorTheme,
  SemanticStatus,
  StatusColorToken,
  StoreOsWallpaperId,
} from './tokens/colors.ts';
