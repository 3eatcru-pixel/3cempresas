import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap, useMapEvents } from 'react-leaflet';
import {
  MapMarkerData,
  HeatPointData,
  LocalPmtilesArchiveInfo,
  MapTileStyle,
  TILE_PROVIDERS,
  SIGLON_QUADRAS_EXPORT_URL,
  isValidLatLng,
  isWebGlAvailable,
} from './mapUtils';
import { createCustomIcon } from './mapLeafletIcons';

const LazyVectorMapCanvas = lazy(() =>
  import('./VectorMapCanvas').then((m) => ({ default: m.VectorMapCanvas }))
);

interface MapCanvasProps {
  center: [number, number];
  zoom: number;
  currentStyle: MapTileStyle;
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
}

const MapUpdater: React.FC<{
  lat: number;
  lng: number;
  zoom: number;
  autoFitBounds?: boolean;
  boundsKey: string;
  boundsPoints: [number, number][];
  recenterTick?: number;
  fitBoundsTick?: number;
}> = ({ lat, lng, zoom, autoFitBounds, boundsKey, boundsPoints, recenterTick = 0, fitBoundsTick = 0 }) => {
  const map = useMap();
  const lastCenterRef = useRef<string>('');
  const lastBoundsRef = useRef<string>('');
  const lastRecenterTickRef = useRef<number>(recenterTick);
  const lastFitTickRef = useRef<number>(fitBoundsTick);

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    if (recenterTick !== lastRecenterTickRef.current && isValidLatLng(lat, lng)) {
      lastRecenterTickRef.current = recenterTick;
      lastCenterRef.current = `${lat.toFixed(6)},${lng.toFixed(6)}`;
      map.setView([lat, lng], zoom, { animate: true });
      return () => clearTimeout(timer);
    }

    if (fitBoundsTick !== lastFitTickRef.current && boundsPoints.length >= 2) {
      lastFitTickRef.current = fitBoundsTick;
      const bounds = L.latLngBounds(boundsPoints);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
      }
      return () => clearTimeout(timer);
    }

    if (autoFitBounds && boundsPoints.length >= 2) {
      if (lastBoundsRef.current !== boundsKey) {
        lastBoundsRef.current = boundsKey;
        const bounds = L.latLngBounds(boundsPoints);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
        }
      }
      return () => clearTimeout(timer);
    }

    const nextKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    if (lastCenterRef.current !== nextKey && isValidLatLng(lat, lng)) {
      lastCenterRef.current = nextKey;
      map.setView([lat, lng]);
    }

    return () => clearTimeout(timer);
  }, [lat, lng, zoom, autoFitBounds, boundsKey, boundsPoints, recenterTick, fitBoundsTick, map]);

  return null;
};

const MapClickHandler: React.FC<{ onMapClick?: (lat: number, lng: number) => void }> = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

const SiglonCadastreOverlay: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;

    const SiglonLayer = L.TileLayer.extend({
      getTileUrl(coords: L.Coords) {
        const bounds = (this as any)._tileCoordsToBounds(coords) as L.LatLngBounds;
        const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
        return `${SIGLON_QUADRAS_EXPORT_URL}?bbox=${bbox}&bboxSR=4326&imageSR=3857&size=256,256&format=png32&transparent=true&f=image`;
      },
    });

    const layer: L.TileLayer = new (SiglonLayer as any)('', {
      opacity: 0.78,
      minZoom: 13,
      maxZoom: 19,
      attribution: '&copy; Prefeitura de Londrina (SIGLON)',
    });
    layer.addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [enabled, map]);

  return null;
};

export const MapCanvas: React.FC<MapCanvasProps> = ({
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
}) => {
  const [vectorFallbackActive, setVectorFallbackActive] = useState(false);

  const isVectorStyle = currentStyle === 'dark' || currentStyle === 'osm' || currentStyle === 'offline';
  if (isVectorStyle && !vectorFallbackActive && isWebGlAvailable()) {
    return (
      <Suspense
        fallback={
          <div className="w-full h-full bg-slate-950 flex items-center justify-center text-xs text-slate-400">
            Carregando mapa vetorial...
          </div>
        }
      >
        <LazyVectorMapCanvas
          center={center}
          zoom={zoom}
          currentStyle={currentStyle}
          offlineArchive={offlineArchive}
          showSiglonLayer={showSiglonLayer}
          circleRadiusKm={circleRadiusKm}
          routePolyline={routePolyline}
          showHeatmap={showHeatmap}
          heatPoints={heatPoints}
          markers={markers}
          autoFitBounds={autoFitBounds}
          recenterTick={recenterTick}
          fitBoundsTick={fitBoundsTick}
          onMapClick={onMapClick}
          onFallbackToRaster={() => setVectorFallbackActive(true)}
        />
      </Suspense>
    );
  }

  const activeTile = TILE_PROVIDERS[currentStyle] || TILE_PROVIDERS.osm;
  const safeCenter: [number, number] = isValidLatLng(center[0], center[1])
    ? center
    : [-23.3105, -51.1628];

  const validMarkers = markers.filter((m) => isValidLatLng(m.position?.[0], m.position?.[1]));
  const validHeatPoints = heatPoints.filter((pt) => isValidLatLng(pt.position?.[0], pt.position?.[1]));
  const validRoute = (routePolyline || []).filter((p) => isValidLatLng(p?.[0], p?.[1]));

  const boundsPoints: [number, number][] = [
    ...validMarkers.map((m) => m.position),
    ...(validRoute.length >= 2 ? [validRoute[0], validRoute[validRoute.length - 1]] : []),
  ];
  const boundsKey = boundsPoints
    .map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`)
    .join('|');

  return (
    <MapContainer
      center={safeCenter}
      zoom={zoom}
      scrollWheelZoom={false}
      className={`w-full h-full relative z-0 ${
        currentStyle === 'dark' || currentStyle === 'offline' ? 'bg-slate-950' : ''
      }`}
    >
      <TileLayer
        key={activeTile.url}
        attribution={activeTile.attribution}
        url={activeTile.url}
        maxZoom={19}
      />

      <SiglonCadastreOverlay enabled={showSiglonLayer} />

      <MapClickHandler onMapClick={onMapClick} />

      {circleRadiusKm && circleRadiusKm > 0 && (
        <Circle
          center={safeCenter}
          radius={circleRadiusKm * 1000}
          pathOptions={{
            color: '#f59e0b',
            fillColor: '#f59e0b',
            fillOpacity: 0.12,
            weight: 2,
            dashArray: '6, 6',
          }}
        />
      )}

      {validRoute.length > 1 && (
        <Polyline
          positions={validRoute}
          pathOptions={{
            color: '#10b981',
            weight: 4,
            opacity: 0.9,
            dashArray: '8, 8',
          }}
        />
      )}

      {showHeatmap &&
        validHeatPoints.map((pt, idx) => {
          const w = pt.weight || 0.5;
          const heatColor = w > 0.7 ? '#ef4444' : w > 0.4 ? '#f97316' : '#eab308';
          return (
            <Circle
              key={`heat-${idx}`}
              center={pt.position}
              radius={800 * (0.5 + w * 0.8)}
              pathOptions={{
                color: heatColor,
                fillColor: heatColor,
                fillOpacity: 0.45,
                weight: 0,
              }}
            >
              {pt.label && (
                <Popup>
                  <div className="p-1 text-xs font-bold text-slate-950">
                    {pt.label} (Intensidade: {Math.round(w * 100)}%)
                  </div>
                </Popup>
              )}
            </Circle>
          );
        })}

      {!showHeatmap &&
        validMarkers.map((marker, idx) => (
          <Marker
            key={`${marker.icon || 'pin'}-${marker.title}-${idx}`}
            position={marker.position}
            icon={createCustomIcon(marker.icon, marker.badgeText || marker.title, marker.clusterCount)}
            eventHandlers={{
              click: () => {
                if (marker.onSelect) marker.onSelect();
              },
            }}
          >
            <Popup className="custom-leaflet-popup">
              <div className="p-1.5 min-w-[140px] space-y-1">
                <div className="font-extrabold text-slate-950 text-xs flex items-center gap-1">
                  {marker.title}
                </div>
                {marker.description && (
                  <div className="text-[10px] text-slate-600 leading-tight">{marker.description}</div>
                )}
                {marker.onSelect && (
                  <button
                    onClick={marker.onSelect}
                    className="w-full mt-1.5 py-1 bg-amber-500 text-slate-950 text-[10px] font-black rounded hover:bg-amber-400 transition-colors"
                  >
                    Ver Detalhes
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

      <MapUpdater
        lat={safeCenter[0]}
        lng={safeCenter[1]}
        zoom={zoom}
        autoFitBounds={autoFitBounds}
        boundsKey={boundsKey}
        boundsPoints={boundsPoints}
        recenterTick={recenterTick}
        fitBoundsTick={fitBoundsTick}
      />
    </MapContainer>
  );
};
