import React from 'react';
import { Layers, Compass, Search, Flame, MapPin, Loader2, Ruler, Crosshair, LocateFixed, Maximize2 } from 'lucide-react';
import { MapTileStyle } from './mapUtils';

interface MapControlsToolbarProps {
  markersCount: number;
  clusteringEnabled: boolean;
  onToggleClustering: () => void;
  heatPointsCount: number;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  currentStyle: MapTileStyle;
  onCycleStyle: () => void;
  isLondrinaArea?: boolean;
  showSiglonLayer?: boolean;
  onToggleSiglonLayer?: () => void;
  onRecenter?: () => void;
  onFitAllMarkers?: () => void;
}

export const MapControlsToolbar: React.FC<MapControlsToolbarProps> = ({
  markersCount,
  clusteringEnabled,
  onToggleClustering,
  heatPointsCount,
  showHeatmap,
  onToggleHeatmap,
  currentStyle,
  onCycleStyle,
  isLondrinaArea = false,
  showSiglonLayer = false,
  onToggleSiglonLayer,
  onRecenter,
  onFitAllMarkers,
}) => {
  return (
    <div className="absolute top-3 right-3 z-[1001] flex flex-wrap items-center gap-1.5 bg-slate-950/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-lg text-xs">
      {onRecenter && (
        <button
          type="button"
          onClick={onRecenter}
          className="flex items-center gap-1 px-2 py-1 rounded-lg border bg-slate-900 text-slate-300 border-slate-700 hover:text-amber-400 hover:border-amber-500/40 font-bold transition-colors text-[11px] cursor-pointer"
          title="Recentralizar mapa na coordenada base"
        >
          <LocateFixed className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Centro</span>
        </button>
      )}

      {markersCount > 1 && onFitAllMarkers && (
        <button
          type="button"
          onClick={onFitAllMarkers}
          className="flex items-center gap-1 px-2 py-1 rounded-lg border bg-slate-900 text-slate-300 border-slate-700 hover:text-emerald-400 hover:border-emerald-500/40 font-bold transition-colors text-[11px] cursor-pointer"
          title="Enquadrar todos os pontos visíveis no mapa"
        >
          <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Enquadrar</span>
        </button>
      )}

      {markersCount > 2 && (
        <button
          type="button"
          onClick={onToggleClustering}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg border font-bold transition-colors text-[11px] cursor-pointer ${
            clusteringEnabled
              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
              : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
          }`}
          title="Agrupamento dinâmico de marcadores próximos"
        >
          <Crosshair className="w-3.5 h-3.5 text-amber-500" />
          <span>{clusteringEnabled ? 'Cluster ON' : 'Cluster OFF'}</span>
        </button>
      )}

      {heatPointsCount > 0 && (
        <button
          type="button"
          onClick={onToggleHeatmap}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg border font-bold transition-colors text-[11px] cursor-pointer ${
            showHeatmap
              ? 'bg-red-600 text-white border-red-500 shadow-md font-black'
              : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
          }`}
          title="Alternar Mapa de Calor de Vendas/Demandas"
        >
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span>{showHeatmap ? 'Calor ON' : 'Calor OFF'}</span>
        </button>
      )}

      {isLondrinaArea && onToggleSiglonLayer && (
        <button
          type="button"
          onClick={onToggleSiglonLayer}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg border font-bold transition-colors text-[11px] cursor-pointer ${
            showSiglonLayer
              ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-black'
              : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
          }`}
          title="Camada pública SIGLON Prefeitura de Londrina (Quadras e Lotes)"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>SIGLON</span>
        </button>
      )}

      <button
        type="button"
        onClick={onCycleStyle}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold rounded-lg border border-slate-700 transition-colors text-[11px] cursor-pointer"
        title="Alternar Camada Cartográfica (Vetorial Dark / Offline .pmtiles / Liberty / Satélite / Topo)"
      >
        <Layers className="w-3.5 h-3.5 text-amber-400" />
        <span className="uppercase">
          {currentStyle === 'dark'
            ? 'VECTOR'
            : currentStyle === 'offline'
            ? 'OFFLINE'
            : currentStyle === 'osm'
            ? 'LIBERTY'
            : currentStyle}
        </span>
      </button>
    </div>
  );
};

export const GeofenceBadge: React.FC<{ radiusKm: number }> = ({ radiusKm }) => {
  return (
    <div className="absolute top-3 left-14 z-[1001] bg-slate-950/90 backdrop-blur-md px-3 py-1 rounded-xl border border-slate-800 text-[11px] font-mono font-bold text-amber-400 flex items-center gap-1.5 shadow-lg">
      <Compass className="w-3.5 h-3.5 text-amber-500 animate-spin" style={{ animationDuration: '8s' }} />
      <span>Raio: {radiusKm} km</span>
    </div>
  );
};

export const DistanceRulerBadge: React.FC<{ distanceKm: number; onClose: () => void }> = ({
  distanceKm,
  onClose,
}) => {
  return (
    <div className="absolute top-12 left-14 z-[1001] bg-slate-950/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-2 shadow-xl animate-fadeIn">
      <Ruler className="w-3.5 h-3.5 text-emerald-500" />
      <span>Distância Geodésica: {distanceKm} km</span>
      <button onClick={onClose} className="text-slate-500 hover:text-white ml-1 font-bold">
        ✕
      </button>
    </div>
  );
};

interface NominatimSearchProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  isSearching: boolean;
  searchError: string | null;
  onSearch: (e: React.FormEvent) => void;
  placeholder?: string;
  suggestions?: { lat: number; lng: number; displayName: string }[];
  onSelectSuggestion?: (s: { lat: number; lng: number; displayName: string }) => void;
}

export const NominatimSearchBar: React.FC<NominatimSearchProps> = ({
  searchQuery,
  setSearchQuery,
  isSearching,
  searchError,
  onSearch,
  placeholder = 'Rua, nº da casa, bairro ou CEP...',
  suggestions = [],
  onSelectSuggestion,
}) => {
  return (
    <div className="absolute bottom-3 left-3 z-[1001] max-w-xs w-[calc(100%-1.5rem)] sm:w-full">
      {suggestions.length > 0 && onSelectSuggestion && (
        <div className="mb-1.5 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-800/70">
          {suggestions.map((item, idx) => (
            <button
              key={`${item.lat}-${item.lng}-${idx}`}
              type="button"
              onClick={() => onSelectSuggestion(item)}
              className="w-full text-left px-3 py-2 text-[11px] text-slate-200 hover:bg-slate-800 hover:text-amber-400 transition-colors flex items-start gap-2 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{item.displayName}</span>
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={onSearch}
        className="bg-slate-950/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-2xl flex items-center gap-1.5"
      >
        <MapPin className="w-4 h-4 text-amber-400 ml-1.5 shrink-0" />
        <input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full font-mono"
        />
        <button
          type="submit"
          disabled={isSearching}
          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] rounded-lg shadow transition-all shrink-0 flex items-center gap-1"
        >
          {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
          <span>BUSCAR</span>
        </button>
      </form>
      {searchError && (
        <div className="mt-1 text-[9px] font-mono text-red-400 bg-slate-950/90 px-2 py-0.5 rounded border border-red-500/20">
          {searchError}
        </div>
      )}
    </div>
  );
};
