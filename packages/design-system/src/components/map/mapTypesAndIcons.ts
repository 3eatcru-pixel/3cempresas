export const isValidLatLng = (lat: unknown, lng: unknown): lat is number =>
  typeof lat === 'number' &&
  typeof lng === 'number' &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;

export const escapeHtml = (input: string): string =>
  String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (!isValidLatLng(lat1, lon1) || !isValidLatLng(lat2, lon2)) return 0;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
};

export const estimateCourierEtaMin = (
  distanceKm: number,
  vehicle: 'SCOOTER' | 'BIKE' | 'CAR' = 'SCOOTER'
): number => {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 3;
  const avgSpeedKmh = vehicle === 'BIKE' ? 16 : vehicle === 'CAR' ? 24 : 30;
  return Math.max(3, Math.round((distanceKm / avgSpeedKmh) * 60 + 2));
};

export interface NominatimGeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  cep?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  houseNumber?: string;
  houseNumberPrecision?: 'EXACT_DOOR' | 'CEP_BLOCK_INTERPOLATED' | 'CEP_BLOCK' | 'STREET_CENTER' | 'AREA_FALLBACK';
  siglonQuadraLote?: string;
  source?: 'BRASILAPI' | 'PHOTON' | 'NOMINATIM' | 'VIACEP_OSM' | 'SIGLON_LONDRINA';
}

export const LONDRINA_CENTER_COORDS: [number, number] = [-23.3105, -51.1628];

export const isInsideLondrina = (lat: unknown, lng: unknown): boolean =>
  isValidLatLng(lat, lng) &&
  (lat as number) >= -23.52 &&
  (lat as number) <= -23.12 &&
  (lng as number) >= -51.35 &&
  (lng as number) <= -50.95;

export const SIGLON_QUADRAS_EXPORT_URL =
  'https://geo.londrina.pr.gov.br/server/rest/services/Portal_Publico/Base_Cartogr%C3%A1fica_P%C3%BAblica/MapServer/export';

export type GeolocationPermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported';

export const getGeolocationPermissionState = async (): Promise<GeolocationPermissionState> => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return 'unsupported';
  }
  try {
    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      if (status.state === 'granted' || status.state === 'prompt' || status.state === 'denied') {
        return status.state;
      }
    }
  } catch {
    // Fallback when Permissions API is unavailable (e.g. older iOS/WebView)
  }
  return 'prompt';
};

let webglSupportCached: boolean | null = null;

export function isWebGlAvailable(): boolean {
  if (webglSupportCached !== null) return webglSupportCached;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    webglSupportCached = false;
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: false });
    webglSupportCached = Boolean(gl);
    return webglSupportCached;
  } catch {
    webglSupportCached = false;
    return false;
  }
}

export const createMarkerElement = (
  type?: 'store' | 'driver' | 'customer' | 'cluster',
  label?: string,
  count?: number
): HTMLElement => {
  const root = document.createElement('div');
  root.className = 'flex flex-col items-center cursor-pointer select-none';

  const makeBadge = (text: string, cls: string) => {
    const badge = document.createElement('div');
    badge.className = cls;
    badge.textContent = text;
    return badge;
  };

  if (type === 'cluster') {
    const safeCount = Number.isFinite(count) && (count as number) > 0 ? Math.floor(count as number) : 1;
    const wrap = document.createElement('div');
    wrap.className = 'relative flex items-center justify-center';
    const ping = document.createElement('div');
    ping.className = 'absolute w-10 h-10 rounded-full bg-amber-500/30 animate-ping';
    const core = document.createElement('div');
    core.className =
      'relative w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 font-black flex items-center justify-center shadow-xl border-2 border-slate-900 text-xs';
    core.textContent = String(safeCount);
    wrap.appendChild(ping);
    wrap.appendChild(core);
    root.appendChild(wrap);
    return root;
  }

  if (type === 'driver') {
    if (label) {
      root.appendChild(
        makeBadge(
          label,
          'bg-slate-900 border border-emerald-500 text-emerald-300 px-1.5 py-0.5 rounded text-[9px] font-black shadow-md whitespace-nowrap mb-0.5'
        )
      );
    }
    const wrap = document.createElement('div');
    wrap.className = 'relative flex items-center justify-center';
    const ping = document.createElement('div');
    ping.className = 'absolute w-8 h-8 rounded-full bg-emerald-500/40 animate-ping';
    const core = document.createElement('div');
    core.className =
      'relative w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shadow-lg border-2 border-white text-xs';
    core.textContent = '🛵';
    wrap.appendChild(ping);
    wrap.appendChild(core);
    root.appendChild(wrap);
    return root;
  }

  if (type === 'store') {
    root.appendChild(
      makeBadge(
        label || 'Loja',
        'bg-slate-900 border-2 border-amber-500 text-amber-400 px-2 py-0.5 rounded-lg text-[10px] font-black shadow-md whitespace-nowrap mb-0.5'
      )
    );
    const core = document.createElement('div');
    core.className =
      'w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shadow-lg border border-slate-900 text-xs';
    core.textContent = '🏪';
    root.appendChild(core);
    return root;
  }

  if (type === 'customer') {
    root.appendChild(
      makeBadge(
        label || 'Cliente',
        'bg-slate-900 border border-emerald-500 text-emerald-400 px-2 py-0.5 rounded-lg text-[10px] font-black shadow-md whitespace-nowrap mb-0.5'
      )
    );
    const core = document.createElement('div');
    core.className =
      'w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center justify-center shadow-lg border border-slate-900 text-xs';
    core.textContent = '📍';
    root.appendChild(core);
    return root;
  }

  if (label) {
    root.appendChild(
      makeBadge(
        label,
        'bg-slate-900 border border-slate-600 text-white px-2 py-0.5 rounded text-[9px] font-bold shadow whitespace-nowrap mb-0.5'
      )
    );
  }
  const core = document.createElement('div');
  core.className =
    'w-6 h-6 rounded-full bg-amber-500 border-2 border-slate-950 shadow-lg flex items-center justify-center text-[10px] font-black text-slate-950';
  core.textContent = '•';
  root.appendChild(core);
  return root;
};

export interface MapMarkerData {
  position: [number, number];
  title: string;
  description?: string;
  icon?: 'store' | 'driver' | 'customer' | 'cluster';
  badgeText?: string;
  clusterCount?: number;
  onSelect?: () => void;
}

export interface HeatPointData {
  position: [number, number];
  weight?: number;
  label?: string;
}

import type { MapTileStyle } from './mapVectorAndPmtilesConfig';
export {
  VECTOR_STYLE_URLS,
  discoverLocalPmtilesCatalog,
  buildOfflinePmtilesStyle,
} from './mapVectorAndPmtilesConfig';
export type {
  MapTileStyle,
  LocalPmtilesArchiveInfo,
  LocalPmtilesCatalogResponse,
} from './mapVectorAndPmtilesConfig';

export const TILE_PROVIDERS: Record<MapTileStyle, { name: string; url: string; attribution: string }> = {
  dark: {
    name: 'OpenFreeMap Dark (Vector)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenFreeMap &copy; OpenStreetMap &copy; CARTO',
  },
  offline: {
    name: '3C Edge Offline (.pmtiles)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; 3C Edge Local PMTiles &copy; OpenStreetMap',
  },
  osm: {
    name: 'OpenFreeMap Liberty (Vector)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenFreeMap &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    name: 'Esri World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
  },
  topo: {
    name: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap & OpenStreetMap',
  },
};
