import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import {
  calculateDistanceKm,
  discoverLocalPmtilesCatalog,
  geocodeAddressNominatim,
  searchAddressSuggestions,
  isValidLatLng,
  isInsideLondrina,
  isWebGlAvailable,
  LocalPmtilesArchiveInfo,
  MapMarkerData,
  HeatPointData,
  MapTileStyle,
  NominatimGeocodeResult,
} from './map/mapUtils';
import {
  MapControlsToolbar,
  GeofenceBadge,
  DistanceRulerBadge,
  NominatimSearchBar,
} from './map/MapOverlays';

const LazyVectorMapCanvas = lazy(() =>
  import('./map/VectorMapCanvas').then((m) => ({ default: m.VectorMapCanvas }))
);
const LazyRasterMapCanvas = lazy(() =>
  import('./map/MapCanvas').then((m) => ({ default: m.MapCanvas }))
);

export { calculateDistanceKm };
export type { MapMarkerData, HeatPointData, MapTileStyle };

export interface MapDisplayProps {
  center: [number, number];
  zoom?: number;
  markers?: MapMarkerData[];
  heatPoints?: HeatPointData[];
  showHeatmap?: boolean;
  height?: string;
  className?: string;
  styleName?: MapTileStyle;
  circleRadiusKm?: number;
  routePolyline?: [number, number][];
  interactiveControls?: boolean;
  enableNominatimSearch?: boolean;
  regionBias?: string;
  searchPlaceholder?: string;
  autoFitBounds?: boolean;
  onLocationFound?: (lat: number, lng: number, addressName: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
}

export const MapDisplay: React.FC<MapDisplayProps> = ({
  center,
  zoom = 13,
  markers = [],
  heatPoints = [],
  showHeatmap: initialShowHeatmap = false,
  height = '400px',
  className = '',
  styleName = 'dark',
  circleRadiusKm,
  routePolyline,
  interactiveControls = true,
  enableNominatimSearch = false,
  regionBias,
  searchPlaceholder,
  autoFitBounds = false,
  onLocationFound,
  onMapClick,
}) => {
  const safeCenter: [number, number] = isValidLatLng(center[0], center[1])
    ? center
    : [-23.3105, -51.1628];
  const [currentStyle, setCurrentStyle] = useState<MapTileStyle>(styleName);
  const [activeCenter, setActiveCenter] = useState<[number, number]>(safeCenter);
  const [showHeatmap, setShowHeatmap] = useState(initialShowHeatmap);
  const [clusteringEnabled, setClusteringEnabled] = useState(false);
  const [showSiglonLayer, setShowSiglonLayer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimGeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedDistance, setSelectedDistance] = useState<number | null>(null);
  const [recenterTick, setRecenterTick] = useState<number>(0);
  const [fitBoundsTick, setFitBoundsTick] = useState<number>(0);
  const [offlineArchive, setOfflineArchive] = useState<LocalPmtilesArchiveInfo | null>(null);
  const [vectorFallbackActive, setVectorFallbackActive] = useState(false);

  const isLondrinaArea = isInsideLondrina(activeCenter[0], activeCenter[1]);
  const effectiveRegionBias = regionBias || (isLondrinaArea ? 'Londrina, PR' : undefined);

  const centerLat = safeCenter[0];
  const centerLng = safeCenter[1];
  useEffect(() => {
    setActiveCenter([centerLat, centerLng]);
  }, [centerLat, centerLng]);

  useEffect(() => {
    let active = true;
    discoverLocalPmtilesCatalog().then((catalog) => {
      if (!active || !catalog.available || catalog.archives.length === 0) return;
      const vectorFirst =
        catalog.archives.find((a) => a.tileType === 'mvt') || catalog.archives[0];
      setOfflineArchive(vectorFirst);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!enableNominatimSearch) return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3 || /^\d{5}-?\d{3}$/.test(trimmed)) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const results = await searchAddressSuggestions(trimmed, {
        regionBias: effectiveRegionBias,
        limit: 4,
        biasCoords: activeCenter,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setSuggestions(results);
      }
    }, 320);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, enableNominatimSearch, effectiveRegionBias, activeCenter]);

  const cycleStyle = () => {
    const styles: MapTileStyle[] = offlineArchive
      ? ['dark', 'offline', 'osm', 'satellite', 'topo']
      : ['dark', 'osm', 'satellite', 'topo'];
    const currentIdx = styles.indexOf(currentStyle);
    const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % styles.length : 0;
    setCurrentStyle(styles[nextIdx]);
  };

  const handleNominatimSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setSuggestions([]);

    try {
      const result = await geocodeAddressNominatim(searchQuery, {
        regionBias: effectiveRegionBias,
        countryCodes: 'br',
        biasCoords: activeCenter,
      });
      if (result) {
        const newPos: [number, number] = [result.lat, result.lng];
        setActiveCenter(newPos);
        if (onLocationFound) {
          onLocationFound(result.lat, result.lng, result.displayName);
        }
      } else {
        setSearchError('Endereço ou CEP não localizado.');
      }
    } catch {
      setSearchError('Falha ao consultar mapa.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSuggestion = (item: NominatimGeocodeResult) => {
    const newPos: [number, number] = [item.lat, item.lng];
    setActiveCenter(newPos);
    setSearchQuery(item.displayName);
    setSuggestions([]);
    setSearchError(null);
    if (onLocationFound) {
      onLocationFound(item.lat, item.lng, item.displayName);
    }
  };

  const handleInternalMapClick = (lat: number, lng: number) => {
    const dist = calculateDistanceKm(activeCenter[0], activeCenter[1], lat, lng);
    setSelectedDistance(dist);
    if (onMapClick) {
      onMapClick(lat, lng);
    }
  };

  const clusteredMarkers = useMemo(() => {
    if (!clusteringEnabled || markers.length <= 2) return markers;

    const clusters: { center: [number, number]; items: MapMarkerData[] }[] = [];
    const thresholdKm = 1.2;

    markers.forEach((m) => {
      if (!isValidLatLng(m.position?.[0], m.position?.[1])) return;
      let added = false;
      for (const c of clusters) {
        const dist = calculateDistanceKm(c.center[0], c.center[1], m.position[0], m.position[1]);
        if (dist <= thresholdKm) {
          c.items.push(m);
          added = true;
          break;
        }
      }
      if (!added) {
        clusters.push({ center: m.position, items: [m] });
      }
    });

    return clusters.map((c) => {
      if (c.items.length === 1) return c.items[0];
      return {
        position: c.center,
        title: `${c.items.length} Pontos Agrupados`,
        description: c.items.map((it) => it.title).join(' • '),
        icon: 'cluster' as const,
        clusterCount: c.items.length,
        badgeText: `${c.items.length} Pontos`,
        onSelect: () => {
          setActiveCenter(c.center);
        },
      };
    });
  }, [markers, clusteringEnabled]);

  return (
    <div
      className={`isolate rounded-2xl overflow-hidden border border-slate-800 shadow-xl relative z-0 ${className}`}
      style={{ height }}
    >
      <Suspense
        fallback={
          <div className="w-full h-full bg-slate-950 flex items-center justify-center text-xs font-mono text-slate-400">
            Carregando mapa interativo...
          </div>
        }
      >
        {(currentStyle === 'dark' || currentStyle === 'osm' || currentStyle === 'offline') &&
        !vectorFallbackActive &&
        isWebGlAvailable() ? (
          <LazyVectorMapCanvas
            center={activeCenter}
            zoom={zoom}
            currentStyle={currentStyle}
            offlineArchive={offlineArchive}
            showSiglonLayer={isLondrinaArea && showSiglonLayer}
            circleRadiusKm={circleRadiusKm}
            routePolyline={routePolyline}
            showHeatmap={showHeatmap}
            heatPoints={heatPoints}
            markers={clusteredMarkers}
            autoFitBounds={autoFitBounds}
            recenterTick={recenterTick}
            fitBoundsTick={fitBoundsTick}
            onMapClick={handleInternalMapClick}
            onFallbackToRaster={() => setVectorFallbackActive(true)}
          />
        ) : (
          <LazyRasterMapCanvas
            center={activeCenter}
            zoom={zoom}
            currentStyle={currentStyle}
            offlineArchive={offlineArchive}
            showSiglonLayer={isLondrinaArea && showSiglonLayer}
            circleRadiusKm={circleRadiusKm}
            routePolyline={routePolyline}
            showHeatmap={showHeatmap}
            heatPoints={heatPoints}
            markers={clusteredMarkers}
            autoFitBounds={autoFitBounds}
            recenterTick={recenterTick}
            fitBoundsTick={fitBoundsTick}
            onMapClick={handleInternalMapClick}
          />
        )}
      </Suspense>

      {interactiveControls && (
        <MapControlsToolbar
          markersCount={markers.length}
          clusteringEnabled={clusteringEnabled}
          onToggleClustering={() => setClusteringEnabled(!clusteringEnabled)}
          heatPointsCount={heatPoints.length}
          showHeatmap={showHeatmap}
          onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
          currentStyle={currentStyle}
          onCycleStyle={cycleStyle}
          isLondrinaArea={isLondrinaArea}
          showSiglonLayer={showSiglonLayer}
          onToggleSiglonLayer={() => setShowSiglonLayer(!showSiglonLayer)}
          onRecenter={() => {
            setActiveCenter([centerLat, centerLng]);
            setRecenterTick((t) => t + 1);
          }}
          onFitAllMarkers={
            markers.length > 1
              ? () => {
                  setFitBoundsTick((t) => t + 1);
                }
              : undefined
          }
        />
      )}

      {circleRadiusKm && circleRadiusKm > 0 && <GeofenceBadge radiusKm={circleRadiusKm} />}

      {selectedDistance !== null && (
        <DistanceRulerBadge
          distanceKm={selectedDistance}
          onClose={() => setSelectedDistance(null)}
        />
      )}

      {enableNominatimSearch && (
        <NominatimSearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isSearching={isSearching}
          searchError={searchError}
          onSearch={handleNominatimSearch}
          placeholder={searchPlaceholder}
          suggestions={suggestions}
          onSelectSuggestion={handleSelectSuggestion}
        />
      )}
    </div>
  );
};
