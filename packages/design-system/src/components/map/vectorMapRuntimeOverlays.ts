import * as maplibregl from 'maplibre-gl';
import {
  HeatPointData,
  LocalPmtilesArchiveInfo,
  MapMarkerData,
  MapTileStyle,
  SIGLON_QUADRAS_EXPORT_URL,
  VECTOR_STYLE_URLS,
  buildOfflinePmtilesStyle,
} from './mapTypesAndIcons';

const SRC_GEOFENCE = '3c-geofence-src';
const LYR_GEOFENCE_FILL = '3c-geofence-fill';
const LYR_GEOFENCE_LINE = '3c-geofence-line';
const SRC_ROUTE = '3c-route-src';
const LYR_ROUTE_LINE = '3c-route-line';
const SRC_HEAT = '3c-heat-src';
const LYR_HEAT = '3c-heat-layer';
const LYR_HEAT_POINTS = '3c-heat-points';
const SRC_SIGLON = '3c-siglon-src';
const LYR_SIGLON = '3c-siglon-layer';

export function buildGeodesicCircleRing(
  lat: number,
  lng: number,
  radiusKm: number,
  steps = 64
): [number, number][] {
  const earthRadiusKm = 6371;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const angularDistance = radiusKm / earthRadiusKm;
  const ring: [number, number][] = [];

  for (let i = 0; i <= steps; i += 1) {
    const bearing = (i * 2 * Math.PI) / steps;
    const destLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
        Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const destLng =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
        Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(destLat)
      );
    ring.push([(destLng * 180) / Math.PI, (destLat * 180) / Math.PI]);
  }
  return ring;
}

export function createVectorMarkerPopupDom(marker: MapMarkerData): HTMLElement {
  const container = document.createElement('div');
  container.className = 'p-1.5 min-w-[140px] space-y-1 text-slate-950';

  const title = document.createElement('div');
  title.className = 'font-extrabold text-slate-950 text-xs flex items-center gap-1';
  title.textContent = marker.title;
  container.appendChild(title);

  if (marker.description) {
    const desc = document.createElement('div');
    desc.className = 'text-[10px] text-slate-600 leading-tight';
    desc.textContent = marker.description;
    container.appendChild(desc);
  }

  if (marker.onSelect) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'w-full mt-1.5 py-1 bg-amber-500 text-slate-950 text-[10px] font-black rounded hover:bg-amber-400 transition-colors cursor-pointer';
    btn.textContent = 'Ver Detalhes';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      marker.onSelect?.();
    });
    container.appendChild(btn);
  }

  return container;
}

export function resolveVectorStyleSpec(
  styleName: Extract<MapTileStyle, 'dark' | 'osm' | 'offline'>,
  offlineArchive?: LocalPmtilesArchiveInfo | null
): string | maplibregl.StyleSpecification {
  const navigatorOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if ((styleName === 'offline' || navigatorOffline) && offlineArchive) {
    return buildOfflinePmtilesStyle(
      offlineArchive,
      styleName === 'osm' ? 'light' : 'dark'
    ) as maplibregl.StyleSpecification;
  }
  return styleName === 'osm' ? VECTOR_STYLE_URLS.osm : VECTOR_STYLE_URLS.dark;
}

export function syncVectorRuntimeOverlays(
  map: maplibregl.Map,
  params: {
    showSiglonLayer: boolean;
    circleRadiusKm?: number;
    safeCenter: [number, number];
    validRoute: [number, number][];
    showHeatmap: boolean;
    validHeatPoints: HeatPointData[];
  }
): void {
  if (!map.isStyleLoaded()) return;
  const { showSiglonLayer, circleRadiusKm, safeCenter, validRoute, showHeatmap, validHeatPoints } = params;

  // 1. SIGLON Londrina Raster Cadastre Overlay
  if (showSiglonLayer) {
    if (!map.getSource(SRC_SIGLON)) {
      map.addSource(SRC_SIGLON, {
        type: 'raster',
        tiles: [
          `${SIGLON_QUADRAS_EXPORT_URL}?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image`,
        ],
        tileSize: 256,
        attribution: '&copy; Prefeitura de Londrina (SIGLON)',
      });
    }
    if (!map.getLayer(LYR_SIGLON)) {
      map.addLayer({
        id: LYR_SIGLON,
        type: 'raster',
        source: SRC_SIGLON,
        minzoom: 13,
        maxzoom: 19,
        paint: { 'raster-opacity': 0.78 },
      });
    }
  } else {
    if (map.getLayer(LYR_SIGLON)) map.removeLayer(LYR_SIGLON);
    if (map.getSource(SRC_SIGLON)) map.removeSource(SRC_SIGLON);
  }

  // 2. Geofence Circle
  if (circleRadiusKm && circleRadiusKm > 0) {
    const ring = buildGeodesicCircleRing(safeCenter[0], safeCenter[1], circleRadiusKm);
    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [ring] },
        },
      ],
    };
    const existingSrc = map.getSource(SRC_GEOFENCE) as maplibregl.GeoJSONSource | undefined;
    if (existingSrc) {
      existingSrc.setData(geojson);
    } else {
      map.addSource(SRC_GEOFENCE, { type: 'geojson', data: geojson });
      map.addLayer({
        id: LYR_GEOFENCE_FILL,
        type: 'fill',
        source: SRC_GEOFENCE,
        paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.12 },
      });
      map.addLayer({
        id: LYR_GEOFENCE_LINE,
        type: 'line',
        source: SRC_GEOFENCE,
        paint: { 'line-color': '#f59e0b', 'line-width': 2, 'line-dasharray': [4, 4] },
      });
    }
  } else {
    if (map.getLayer(LYR_GEOFENCE_LINE)) map.removeLayer(LYR_GEOFENCE_LINE);
    if (map.getLayer(LYR_GEOFENCE_FILL)) map.removeLayer(LYR_GEOFENCE_FILL);
    if (map.getSource(SRC_GEOFENCE)) map.removeSource(SRC_GEOFENCE);
  }

  // 3. Route Polyline
  if (validRoute.length > 1) {
    const routeGeoJson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: validRoute.map(([lat, lng]) => [lng, lat]),
          },
        },
      ],
    };
    const existingSrc = map.getSource(SRC_ROUTE) as maplibregl.GeoJSONSource | undefined;
    if (existingSrc) {
      existingSrc.setData(routeGeoJson);
    } else {
      map.addSource(SRC_ROUTE, { type: 'geojson', data: routeGeoJson });
      map.addLayer({
        id: LYR_ROUTE_LINE,
        type: 'line',
        source: SRC_ROUTE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#10b981',
          'line-width': 4,
          'line-opacity': 0.92,
          'line-dasharray': [2, 2],
        },
      });
    }
  } else {
    if (map.getLayer(LYR_ROUTE_LINE)) map.removeLayer(LYR_ROUTE_LINE);
    if (map.getSource(SRC_ROUTE)) map.removeSource(SRC_ROUTE);
  }

  // 4. Native WebGL Heatmap Layer
  if (showHeatmap && validHeatPoints.length > 0) {
    const heatGeoJson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: validHeatPoints.map((pt) => ({
        type: 'Feature',
        properties: {
          weight: typeof pt.weight === 'number' ? Math.max(0.1, Math.min(1, pt.weight)) : 0.5,
          label: pt.label || '',
        },
        geometry: {
          type: 'Point',
          coordinates: [pt.position[1], pt.position[0]],
        },
      })),
    };
    const existingSrc = map.getSource(SRC_HEAT) as maplibregl.GeoJSONSource | undefined;
    if (existingSrc) {
      existingSrc.setData(heatGeoJson);
    } else {
      map.addSource(SRC_HEAT, { type: 'geojson', data: heatGeoJson });
      map.addLayer({
        id: LYR_HEAT,
        type: 'heatmap',
        source: SRC_HEAT,
        paint: {
          'heatmap-weight': ['get', 'weight'],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 2.5],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(0, 0, 0, 0)',
            0.25,
            'rgba(234, 179, 8, 0.55)',
            0.6,
            'rgba(249, 115, 22, 0.75)',
            1,
            'rgba(239, 68, 68, 0.9)',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 18, 15, 34],
          'heatmap-opacity': 0.85,
        },
      });
      map.addLayer({
        id: LYR_HEAT_POINTS,
        type: 'circle',
        source: SRC_HEAT,
        minzoom: 12,
        paint: {
          'circle-radius': 7,
          'circle-color': '#f59e0b',
          'circle-opacity': 0.35,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fef3c7',
        },
      });
    }
  } else {
    if (map.getLayer(LYR_HEAT_POINTS)) map.removeLayer(LYR_HEAT_POINTS);
    if (map.getLayer(LYR_HEAT)) map.removeLayer(LYR_HEAT);
    if (map.getSource(SRC_HEAT)) map.removeSource(SRC_HEAT);
  }
}
