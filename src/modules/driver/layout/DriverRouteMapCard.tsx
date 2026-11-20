import React from 'react';
import { Clock, ExternalLink, MapPin, Radio, RotateCcw, Store } from 'lucide-react';
import { MapDisplay, MapMarkerData } from '../../../components/common/MapDisplay';
import { OsrmRouteResult } from '../../../components/common/map/mapUtils';

interface DriverRouteMapCardProps {
  storeName?: string;
  driverName: string;
  deliveryAddress?: string;
  gpsStatus: 'live' | 'fallback';
  routeStarted: boolean;
  routeData: OsrmRouteResult;
  mapCenter: [number, number];
  routePolyline: [number, number][];
  storePos: [number, number];
  driverPos: [number, number];
  stopMarkers: MapMarkerData[];
  osmDirectionsUrl: string;
  onSyncGps: () => void;
}

export const DriverRouteMapCard: React.FC<DriverRouteMapCardProps> = ({
  storeName,
  driverName,
  deliveryAddress,
  gpsStatus,
  routeStarted,
  routeData,
  mapCenter,
  routePolyline,
  storePos,
  driverPos,
  stopMarkers,
  osmDirectionsUrl,
  onSyncGps,
}) => {
  return (
    <div className="relative rounded-2xl border border-[#00CCBC]/40 overflow-hidden shadow-2xl bg-[#111922]">
      <div className="absolute top-3 left-3 right-3 z-[400] flex items-center justify-between pointer-events-none gap-2">
        <div className="bg-[#0B1117]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2 text-xs text-white pointer-events-auto shadow-lg">
          <Store className="w-4 h-4 text-[#00CCBC]" />
          <span className="font-bold truncate max-w-[160px]">{storeName}</span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <div
            className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-black flex items-center gap-1 shadow-lg ${
              gpsStatus === 'live'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
                : 'bg-[#0B1117]/90 border-slate-700 text-slate-300'
            }`}
          >
            <Radio className="w-3 h-3" /> {gpsStatus === 'live' ? 'GPS REAL' : 'COORD. LOJA'}
          </div>
          <div className="bg-[#00CCBC] text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-lg tabular-nums">
            <Clock className="w-3.5 h-3.5" />
            {routeData.distanceKm > 0
              ? `${routeData.distanceKm.toFixed(1)}km · ${routeData.durationMin}m`
              : routeStarted
              ? 'Em Rota'
              : 'Coleta'}
          </div>
        </div>
      </div>

      <MapDisplay
        center={mapCenter}
        zoom={15}
        height="300px"
        styleName="dark"
        autoFitBounds={true}
        routePolyline={routePolyline}
        interactiveControls={true}
        markers={[
          {
            position: storePos,
            title: storeName || 'Loja Parceira',
            description: 'Coleta: Retirar Pedido Embalado',
            icon: 'store',
            badgeText: 'Coleta',
          },
          {
            position: driverPos,
            title: driverName,
            description:
              gpsStatus === 'live' ? 'Sua Posição GPS Real' : 'Posição Inicial do Entregador',
            icon: 'driver',
            badgeText: 'Você',
          },
          ...stopMarkers,
        ]}
      />

      {/* Bottom Destination Strip */}
      <div className="bg-[#0B1117]/95 p-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <MapPin className="w-4 h-4 text-[#00CCBC] shrink-0" />
          <span className="truncate text-xs font-mono">
            {deliveryAddress || 'Endereço não informado'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={osmDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 bg-[#00CCBC]/15 hover:bg-[#00CCBC]/25 text-[#00CCBC] text-xs font-bold rounded-lg border border-[#00CCBC]/30 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Rota OSM
          </a>
          <button
            type="button"
            onClick={onSyncGps}
            className="min-h-[36px] flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-[#00CCBC] text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer"
            title="Sincronizar Rota GPS"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Atualizar GPS
          </button>
        </div>
      </div>
    </div>
  );
};
