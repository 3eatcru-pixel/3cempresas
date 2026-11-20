import React, { useState, useMemo } from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { MapDisplay, MapMarkerData } from '../../components/common/MapDisplay';
import { isValidLatLng } from '../../components/common/map/mapUtils';
import { Signal, Bike, Radio } from 'lucide-react';
import { ServerGpsTelemetryHeader } from './telemetry/ServerGpsTelemetryHeader';

interface GpsSnapshot {
  id: string;
  driverName: string;
  vehicle: string;
  lat: number;
  lng: number;
  status: string;
  source: string;
  timestamp: string;
}

export const ServerGpsTelemetryTab: React.FC = () => {
  const { drivers, stores, showNotification } = useEcosystem();
  const [manualTestPings, setManualTestPings] = useState<GpsSnapshot[]>([]);

  const driverSnapshots = useMemo<GpsSnapshot[]>(() => {
    return drivers
      .filter((d) => isValidLatLng(d.latitude, d.longitude))
      .map((driver) => ({
        id: `db-${driver.id}`,
        driverName: driver.name,
        vehicle: driver.vehiclePlate ? `${driver.vehicle} (${driver.vehiclePlate})` : driver.vehicle,
        lat: driver.latitude as number,
        lng: driver.longitude as number,
        status: driver.status,
        source: 'Posição registrada no banco',
        timestamp: 'Snapshot DB',
      }));
  }, [drivers]);

  const allSnapshots = useMemo(
    () => [...manualTestPings, ...driverSnapshots],
    [manualTestPings, driverSnapshots]
  );

  const storeMarkers = useMemo<MapMarkerData[]>(() => {
    return stores
      .filter((s) => isValidLatLng(s.latitude, s.longitude))
      .map((s) => ({
        position: [s.latitude as number, s.longitude as number],
        title: s.name,
        description: `${s.category} • ${s.address || 'Hub Comercial'}`,
        icon: 'store' as const,
        badgeText: s.name.split(' ')[0],
      }));
  }, [stores]);

  const handleManualPingEmit = () => {
    const newPing: GpsSnapshot = {
      id: `ping-test-${Date.now()}`,
      driverName: 'Entregador Diagnóstico (Teste)',
      vehicle: 'SCOOTER',
      lat: -23.3105 + (Math.random() - 0.5) * 0.008,
      lng: -51.1628 + (Math.random() - 0.5) * 0.008,
      status: 'AVAILABLE',
      source: 'Ping de teste manual',
      timestamp: new Date().toLocaleTimeString('pt-BR'),
    };

    setManualTestPings((prev) => [newPing, ...prev.slice(0, 7)]);
    showNotification('Ping de teste GPS registrado localmente no inspetor.');
  };

  const mapMarkers = useMemo<MapMarkerData[]>(() => {
    const driverPins: MapMarkerData[] = allSnapshots.map((p) => ({
      position: [p.lat, p.lng],
      title: p.driverName,
      description: `${p.vehicle} • ${p.source}`,
      icon: 'driver',
      badgeText: p.driverName.split(' ')[0],
    }));
    return [...storeMarkers, ...driverPins];
  }, [storeMarkers, allSnapshots]);

  const mapCenter: [number, number] =
    allSnapshots.length > 0
      ? [allSnapshots[0].lat, allSnapshots[0].lng]
      : storeMarkers.length > 0
      ? storeMarkers[0].position
      : [-23.3105, -51.1628];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <ServerGpsTelemetryHeader
          onManualPing={handleManualPingEmit}
          pingCount={allSnapshots.length}
        />

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <span className="text-emerald-400 font-bold uppercase flex items-center gap-1.5">
              <Signal className="w-4 h-4" /> Posições Registradas da Frota & Lojas
            </span>
            <span className="text-slate-500 font-mono tabular-nums">
              {driverSnapshots.length} entregador(es) • {storeMarkers.length} loja(s) • {manualTestPings.length} teste(s)
            </span>
          </div>

          <MapDisplay
            center={mapCenter}
            zoom={13}
            height="360px"
            styleName="dark"
            autoFitBounds={mapMarkers.length > 1}
            interactiveControls={true}
            enableNominatimSearch={true}
            showHeatmap={false}
            markers={mapMarkers}
          />
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" /> Registro de Coordenadas GPS
          </h3>
          <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800">
            Sem simulação automática
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 font-mono">
            <thead className="bg-slate-950 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3">Entregador</th>
                <th className="p-3">Veículo</th>
                <th className="p-3">Coordenadas (Lat / Lng)</th>
                <th className="p-3">Status</th>
                <th className="p-3">Origem</th>
                <th className="p-3">Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {allSnapshots.map((ping) => (
                <tr key={ping.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-3 font-bold text-white flex items-center gap-2">
                    <Bike className="w-4 h-4 text-emerald-400" />
                    {ping.driverName}
                  </td>
                  <td className="p-3 text-slate-300">{ping.vehicle}</td>
                  <td className="p-3 text-slate-300 font-mono tabular-nums">
                    {ping.lat.toFixed(5)}, {ping.lng.toFixed(5)}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-bold text-emerald-400">
                      {ping.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400 text-[11px] font-sans">{ping.source}</td>
                  <td className="p-3 text-slate-400 text-[10px] tabular-nums">{ping.timestamp}</td>
                </tr>
              ))}
              {allSnapshots.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500 font-sans italic">
                    Nenhum entregador possui coordenadas persistidas no momento. Use &quot;Emitir Ping GPS de Teste&quot; para validar o mapa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
