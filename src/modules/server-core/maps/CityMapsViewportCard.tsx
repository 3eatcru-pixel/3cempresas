import React from 'react';
import { MapPin } from 'lucide-react';
import { MapDisplay, MapMarkerData } from '../../../components/common/MapDisplay';
import { NominatimGeocodeResult } from '../../../components/common/map/mapUtils';

interface CityMapsViewportCardProps {
  mapCenter: [number, number];
  mapMarkers: MapMarkerData[];
  selectedCity: string;
  selectedUf: string;
  resolvedPin: NominatimGeocodeResult | null;
  onLocationFound: (lat: number, lng: number, addressName: string) => void;
  onMapClick: (lat: number, lng: number) => void;
}

export const CityMapsViewportCard: React.FC<CityMapsViewportCardProps> = ({
  mapCenter,
  mapMarkers,
  selectedCity,
  selectedUf,
  resolvedPin,
  onLocationFound,
  onMapClick,
}) => {
  return (
    <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <span>Visualização Cartográfica</span>
        </h3>
        <span className="text-xs font-mono tabular-nums text-slate-400">
          {mapMarkers.length} marcador(es)
        </span>
      </div>

      <MapDisplay
        center={mapCenter}
        zoom={15}
        height="340px"
        styleName="dark"
        regionBias={`${selectedCity}, ${selectedUf}`}
        enableNominatimSearch={true}
        interactiveControls={true}
        markers={mapMarkers}
        onLocationFound={onLocationFound}
        onMapClick={onMapClick}
      />

      {resolvedPin && (
        <div className="border-t border-slate-800 pt-3 space-y-1.5 text-xs">
          <p className="font-medium text-white">{resolvedPin.displayName}</p>
          <div className="flex flex-wrap items-center gap-2 text-slate-400 font-mono tabular-nums">
            <span>
              {resolvedPin.lat.toFixed(6)}, {resolvedPin.lng.toFixed(6)}
            </span>
            {resolvedPin.cep && (
              <>
                <span aria-hidden="true">·</span>
                <span>CEP {resolvedPin.cep}</span>
              </>
            )}
            {resolvedPin.houseNumberPrecision && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400">{resolvedPin.houseNumberPrecision}</span>
              </>
            )}
          </div>
          {resolvedPin.siglonQuadraLote && (
            <p className="text-xs text-amber-400 font-mono">
              Cadastro SIGLON: {resolvedPin.siglonQuadraLote}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
