export type MapTileStyle = 'dark' | 'offline' | 'osm' | 'satellite' | 'topo';

export const VECTOR_STYLE_URLS: Record<'dark' | 'osm', string> = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  osm: 'https://tiles.openfreemap.org/styles/liberty',
};

export interface LocalPmtilesArchiveInfo {
  name: string;
  fileName: string;
  url: string;
  sizeBytes: number;
  updatedAt: string;
  etag: string;
  tileType: 'mvt' | 'png' | 'jpg' | 'webp' | 'avif' | 'unknown';
  minZoom: number;
  maxZoom: number;
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
  centerLon: number;
  centerLat: number;
  centerZoom: number;
  clustered: boolean;
}

export interface LocalPmtilesCatalogResponse {
  source?: 'CLOUD_HUB' | 'EDGE_NODE';
  available: boolean;
  archives: LocalPmtilesArchiveInfo[];
}

let pmtilesCatalogCache: { expiresAt: number; data: LocalPmtilesCatalogResponse } | null = null;
let pmtilesCatalogInflight: Promise<LocalPmtilesCatalogResponse> | null = null;

export const discoverLocalPmtilesCatalog = async (
  forceRefresh = false
): Promise<LocalPmtilesCatalogResponse> => {
  if (!forceRefresh && pmtilesCatalogCache && Date.now() < pmtilesCatalogCache.expiresAt) {
    return pmtilesCatalogCache.data;
  }
  if (!forceRefresh && pmtilesCatalogInflight) {
    return pmtilesCatalogInflight;
  }
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return { available: false, archives: [] };
  }

  pmtilesCatalogInflight = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1800);
      const resp = await fetch('/api/v1/maps/pmtiles/catalog', {
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!resp.ok) {
        const empty: LocalPmtilesCatalogResponse = { available: false, archives: [] };
        pmtilesCatalogCache = { expiresAt: Date.now() + 30_000, data: empty };
        return empty;
      }
      const json = (await resp.json()) as LocalPmtilesCatalogResponse;
      const normalized: LocalPmtilesCatalogResponse = {
        source: json?.source,
        available: Boolean(json?.available && Array.isArray(json?.archives) && json.archives.length > 0),
        archives: Array.isArray(json?.archives) ? json.archives : [],
      };
      pmtilesCatalogCache = { expiresAt: Date.now() + 60_000, data: normalized };
      return normalized;
    } catch {
      const empty: LocalPmtilesCatalogResponse = { available: false, archives: [] };
      pmtilesCatalogCache = { expiresAt: Date.now() + 15_000, data: empty };
      return empty;
    } finally {
      pmtilesCatalogInflight = null;
    }
  })();

  return pmtilesCatalogInflight;
};

export const buildOfflinePmtilesStyle = (
  archive: LocalPmtilesArchiveInfo,
  theme: 'dark' | 'light' = 'dark'
): Record<string, any> => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3000';
  const absoluteArchiveUrl = /^https?:\/\//i.test(archive.url)
    ? archive.url
    : `${origin}${archive.url.startsWith('/') ? '' : '/'}${archive.url}`;
  const pmtilesSourceUrl = `pmtiles://${absoluteArchiveUrl}`;

  if (archive.tileType !== 'mvt') {
    return {
      version: 8,
      name: `3C Offline Raster (${archive.name})`,
      sources: {
        'pmtiles-raster': {
          type: 'raster',
          url: pmtilesSourceUrl,
          tileSize: 256,
        },
      },
      layers: [
        {
          id: 'pmtiles-raster-layer',
          type: 'raster',
          source: 'pmtiles-raster',
        },
      ],
    };
  }

  const isDark = theme === 'dark';
  const palette = isDark
    ? {
        bg: '#020617',
        landuse: '#0b1222',
        park: '#06281e',
        water: '#0a192f',
        building: '#1e293b',
        minorRoad: '#334155',
        majorRoad: '#475569',
        highway: '#d97706',
        boundary: '#475569',
      }
    : {
        bg: '#f8fafc',
        landuse: '#f1f5f9',
        park: '#dcfce7',
        water: '#bfdbfe',
        building: '#cbd5e1',
        minorRoad: '#ffffff',
        majorRoad: '#e2e8f0',
        highway: '#f59e0b',
        boundary: '#94a3b8',
      };

  return {
    version: 8,
    name: `3C Offline Vector (${archive.name})`,
    sources: {
      protomaps: {
        type: 'vector',
        url: pmtilesSourceUrl,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': palette.bg },
      },
      {
        id: 'landuse-fill',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'landuse',
        paint: { 'fill-color': palette.landuse, 'fill-opacity': 0.8 },
      },
      {
        id: 'park-fill',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'park',
        paint: { 'fill-color': palette.park, 'fill-opacity': 0.7 },
      },
      {
        id: 'water-fill',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'water',
        paint: { 'fill-color': palette.water },
      },
      {
        id: 'waterway-line',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'water',
        filter: ['==', '$type', 'LineString'],
        paint: { 'line-color': palette.water, 'line-width': 2 },
      },
      {
        id: 'buildings-fill',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'buildings',
        minzoom: 13,
        paint: { 'fill-color': palette.building, 'fill-opacity': 0.75 },
      },
      {
        id: 'roads-minor',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        filter: ['!', ['in', 'pmap:kind', 'highway', 'major_road']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': palette.minorRoad,
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 16, 4],
        },
      },
      {
        id: 'roads-major',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        filter: ['==', 'pmap:kind', 'major_road'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': palette.majorRoad,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 16, 6],
        },
      },
      {
        id: 'roads-highway',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        filter: ['==', 'pmap:kind', 'highway'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': palette.highway,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 16, 7.5],
        },
      },
      {
        id: 'boundaries-line',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'boundaries',
        paint: {
          'line-color': palette.boundary,
          'line-width': 1,
          'line-dasharray': [3, 2],
        },
      },
    ],
  };
};
