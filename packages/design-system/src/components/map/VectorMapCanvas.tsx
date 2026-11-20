import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerSource from 'maplibre-gl/dist/maplibre-gl-worker.mjs?raw';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import {
  HeatPointData,
  LocalPmtilesArchiveInfo,
  MapMarkerData,
  MapTileStyle,
  buildOfflinePmtilesStyle,
  createMarkerElement,
  isValidLatLng,
  isWebGlAvailable,
} from './mapTypesAndIcons';
import {
  createVectorMarkerPopupDom,
  resolveVectorStyleSpec,
  syncVectorRuntimeOverlays,
} from './vectorMapRuntimeOverlays';

export { isWebGlAvailable };

interface VectorMapCanvasProps {
  center: [number, number];
  zoom: number;
  currentStyle: Extract<MapTileStyle, 'dark' | 'osm' | 'offline'>;
  offlineArchive?: LocalPmtilesArchiveInfo | null;
  showSiglonLayer?: boolean;
  circleRadiusKm?: number;
  routePolyline?: [number, number][];
  showHeatmap: boolean;
  heatPoints: HeatPointData[];
  markers: MapMarkerData[];
  autoFitBounds?: boolean;
  recenterTick?: number;
  fitBoundsTick?: number;
  onMapClick?: (lat: number, lng: number) => void;
  onFallbackToRaster?: () => void;
}

let pmtilesProtocolRegistered = false;
let workerUrlConfigured = false;
let cachedWorkerBlobUrl: string | null = null;

export function ensureMapLibreWorkerConfigured(): void {
  if (workerUrlConfigured || typeof window === 'undefined') return;
  try {
    if (typeof maplibreWorkerSource === 'string' && maplibreWorkerSource.length > 0) {
      const sanitizedWorkerSource = maplibreWorkerSource.replace(
        /\/\/# sourceMappingURL=.*$/m,
        ''
      );
      const blob = new Blob([sanitizedWorkerSource], { type: 'text/javascript' });
      cachedWorkerBlobUrl = URL.createObjectURL(blob);
      maplibregl.setWorkerUrl(cachedWorkerBlobUrl);
    }
    workerUrlConfigured = true;
  } catch {
    workerUrlConfigured = true;
  }
}

export function ensurePmtilesProtocolRegistered(): void {
  ensureMapLibreWorkerConfigured();
  if (pmtilesProtocolRegistered || typeof window === 'undefined') return;
  try {
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
    pmtilesProtocolRegistered = true;
  } catch {
    // Ignore if protocol was already registered by another bundle chunk
    pmtilesProtocolRegistered = true;
  }
}

export const VectorMapCanvas: React.FC<VectorMapCanvasProps> = ({
  center,
  zoom,
  currentStyle,
  offlineArchive = null,
  showSiglonLayer = false,
  circleRadiusKm,
  routePolyline,
  showHeatmap,
  heatPoints,
  markers,
  autoFitBounds = false,
  recenterTick = 0,
  fitBoundsTick = 0,
  onMapClick,
  onFallbackToRaster,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const styleSignatureRef = useRef<string>('');
  const lastCenterKeyRef = useRef<string>('');
  const lastBoundsKeyRef = useRef<string>('');
  const lastRecenterTickRef = useRef<number>(recenterTick);
  const lastFitTickRef = useRef<number>(fitBoundsTick);
  const onMapClickRef = useRef(onMapClick);
  const onFallbackRef = useRef(onFallbackToRaster);

  onMapClickRef.current = onMapClick;
  onFallbackRef.current = onFallbackToRaster;

  const safeCenter: [number, number] = isValidLatLng(center[0], center[1])
    ? center
    : [-23.3105, -51.1628];

  const validMarkers = markers.filter((m) => isValidLatLng(m.position?.[0], m.position?.[1]));
  const validHeatPoints = heatPoints.filter((pt) => isValidLatLng(pt.position?.[0], pt.position?.[1]));
  const validRoute = (routePolyline || []).filter((p) => isValidLatLng(p?.[0], p?.[1]));

  const runOverlaySync = (map: maplibregl.Map) => {
    syncVectorRuntimeOverlays(map, {
      showSiglonLayer,
      circleRadiusKm,
      safeCenter,
      validRoute,
      showHeatmap,
      validHeatPoints,
    });
  };

  useEffect(() => {
    if (!containerRef.current) return;
    if (!isWebGlAvailable()) {
      onFallbackRef.current?.();
      return;
    }

    ensurePmtilesProtocolRegistered();
    const initialSig = `${currentStyle}:${offlineArchive?.fileName || ''}`;
    styleSignatureRef.current = initialSig;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: resolveVectorStyleSpec(currentStyle, offlineArchive),
        center: [safeCenter[1], safeCenter[0]],
        zoom,
        attributionControl: {},
        scrollZoom: false,
      });
    } catch {
      onFallbackRef.current?.();
      return;
    }

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-left');

    map.on('style.load', () => {
      runOverlaySync(map);
    });

    map.on('click', (e: maplibregl.MapMouseEvent) => {
      onMapClickRef.current?.(e.lngLat.lat, e.lngLat.lng);
    });

    map.on('error', (evt: maplibregl.ErrorEvent) => {
      const msg = String(evt?.error?.message || '').toLowerCase();
      if (
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('worker failed to load') ||
        msg.includes('webgl') ||
        msg.includes('context')
      ) {
        if (offlineArchive && currentStyle !== 'offline') {
          try {
            map.setStyle(
              buildOfflinePmtilesStyle(
                offlineArchive,
                currentStyle === 'osm' ? 'light' : 'dark'
              ) as maplibregl.StyleSpecification
            );
            return;
          } catch {
            // proceed to raster fallback
          }
        }
        onFallbackRef.current?.();
      }
    });

    mapRef.current = map;
    lastCenterKeyRef.current = `${safeCenter[0].toFixed(6)},${safeCenter[1].toFixed(6)}`;

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        try {
          map.resize();
        } catch {
          // ignore during teardown
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver?.disconnect();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // Intentionally mount once per WebGL instance; style/overlays sync via dedicated effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const nextSig = `${currentStyle}:${offlineArchive?.fileName || ''}`;
    if (styleSignatureRef.current === nextSig) return;
    styleSignatureRef.current = nextSig;
    try {
      map.setStyle(resolveVectorStyleSpec(currentStyle, offlineArchive));
    } catch {
      onFallbackRef.current?.();
    }
  }, [currentStyle, offlineArchive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    runOverlaySync(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showSiglonLayer,
    circleRadiusKm,
    safeCenter[0],
    safeCenter[1],
    showHeatmap,
    validHeatPoints.length,
    validRoute.length,
    routePolyline,
    heatPoints,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (showHeatmap) return;

    const created: maplibregl.Marker[] = validMarkers.map((marker) => {
      const el = createMarkerElement(marker.icon, marker.badgeText || marker.title, marker.clusterCount);
      const popup = new maplibregl.Popup({ offset: 22, closeButton: true }).setDOMContent(
        createVectorMarkerPopupDom(marker)
      );
      el.addEventListener('click', () => {
        if (marker.onSelect) marker.onSelect();
      });
      return new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([marker.position[1], marker.position[0]])
        .setPopup(popup)
        .addTo(map);
    });

    markersRef.current = created;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, showHeatmap]);

  const boundsPoints: [number, number][] = [
    ...validMarkers.map((m) => m.position),
    ...(validRoute.length >= 2 ? [validRoute[0], validRoute[validRoute.length - 1]] : []),
  ];
  const boundsKey = boundsPoints.map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join('|');

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (recenterTick !== lastRecenterTickRef.current && isValidLatLng(safeCenter[0], safeCenter[1])) {
      lastRecenterTickRef.current = recenterTick;
      lastCenterKeyRef.current = `${safeCenter[0].toFixed(6)},${safeCenter[1].toFixed(6)}`;
      map.flyTo({ center: [safeCenter[1], safeCenter[0]], zoom, duration: 550 });
      return;
    }

    if (fitBoundsTick !== lastFitTickRef.current && boundsPoints.length >= 2) {
      lastFitTickRef.current = fitBoundsTick;
      const bounds = new maplibregl.LngLatBounds();
      boundsPoints.forEach(([lat, lng]) => bounds.extend([lng, lat]));
      map.fitBounds(bounds, { padding: 40, maxZoom: 16, duration: 550 });
      return;
    }

    if (autoFitBounds && boundsPoints.length >= 2) {
      if (lastBoundsKeyRef.current !== boundsKey) {
        lastBoundsKeyRef.current = boundsKey;
        const bounds = new maplibregl.LngLatBounds();
        boundsPoints.forEach(([lat, lng]) => bounds.extend([lng, lat]));
        map.fitBounds(bounds, { padding: 40, maxZoom: 16 });
      }
      return;
    }

    const nextKey = `${safeCenter[0].toFixed(6)},${safeCenter[1].toFixed(6)}`;
    if (lastCenterKeyRef.current !== nextKey && isValidLatLng(safeCenter[0], safeCenter[1])) {
      lastCenterKeyRef.current = nextKey;
      map.jumpTo({ center: [safeCenter[1], safeCenter[0]] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeCenter[0], safeCenter[1], zoom, autoFitBounds, boundsKey, recenterTick, fitBoundsTick]);

  return (
    <div
      ref={containerRef}
      data-map-engine="maplibre-vector"
      data-map-style={currentStyle}
      className="w-full h-full relative z-0 bg-slate-950"
    />
  );
};
