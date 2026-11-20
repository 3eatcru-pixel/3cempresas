export {
  isValidLatLng,
  escapeHtml,
  calculateDistanceKm,
  estimateCourierEtaMin,
  LONDRINA_CENTER_COORDS,
  isInsideLondrina,
  SIGLON_QUADRAS_EXPORT_URL,
  getGeolocationPermissionState,
  isWebGlAvailable,
  createMarkerElement,
  TILE_PROVIDERS,
  VECTOR_STYLE_URLS,
  discoverLocalPmtilesCatalog,
  buildOfflinePmtilesStyle,
} from './mapTypesAndIcons';

export type {
  NominatimGeocodeResult,
  GeolocationPermissionState,
  MapMarkerData,
  HeatPointData,
  MapTileStyle,
  LocalPmtilesArchiveInfo,
  LocalPmtilesCatalogResponse,
} from './mapTypesAndIcons';

export {
  formatShortBrazilianAddress,
  expandBrazilianAbbreviations,
  parseBrazilianAddressParts,
  candidateMatchesCityAndState,
  scoreGeocodeCandidate,
  parseViaCepComplementRangeLocal,
  interpolatePointOnStreetGeometry,
  inferRegionDefaults,
} from './mapBrazilianAddressParser';

export type {
  ParsedBrazilianAddress,
  ParsedViaCepRange,
  ViaCepStreetBlock,
} from './mapBrazilianAddressParser';

export {
  lookupBrazilianCep,
  searchAddressSuggestions,
  geocodeAddressNominatim,
  reverseGeocodeNominatim,
} from './mapGeocodingEngine';

export {
  fetchStreetRouteOsrm,
  optimizeMultiStopTripOsrm,
} from './mapOsrmRouting';

export type {
  OsrmRouteResult,
  OptimizedStopResult,
} from './mapOsrmRouting';
