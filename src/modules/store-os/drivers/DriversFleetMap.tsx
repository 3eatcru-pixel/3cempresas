import React, { useEffect, useMemo, useState } from 'react';
import { Navigation } from 'lucide-react';
import { Driver, Order, Store } from '../../../types';
import { MapDisplay, MapMarkerData } from '../../../components/common/MapDisplay';
import {
  fetchStreetRouteOsrm,
  isValidLatLng,
  OsrmRouteResult,
} from '../../../components/common/map/mapUtils';

interface DriversFleetMapProps {
  currentStore: Store;
  storeLocation: [number, number];
  ownDrivers: Driver[];
  activeDriversCount: number;
  activeOrders?: Order[];
}

export const DriversFleetMap: React.FC<DriversFleetMapProps> = ({
  currentStore,
  storeLocation,
  ownDrivers,
  activeDriversCount,
  activeOrders = [],
}) => {
  const [fleetRoute, setFleetRoute] = useState<OsrmRouteResult>({
    coordinates: [],
    distanceKm: 0,
    durationMin: 0,
    isFallback: true,
  });

  const markers = useMemo<MapMarkerData[]>(() => {
    const list: MapMarkerData[] = [
      {
        position: storeLocation,
        title: currentStore.name,
        description: currentStore.address || 'Base Logística da Loja',
        icon: 'store',
        badgeText: 'Base Loja',
      },
    ];

    ownDrivers
      .filter((d) => d.status !== 'OFFLINE' && isValidLatLng(d.latitude, d.longitude))
      .forEach((drv) => {
        list.push({
          position: [drv.latitude as number, drv.longitude as number],
          title: drv.name,
          description: `${drv.status} • ${drv.vehicle}${drv.vehiclePlate ? ` (${drv.vehiclePlate})` : ''}`,
          icon: 'driver',
          badgeText: drv.name.split(' ')[0],
        });
      });

    activeOrders
      .filter((o) => isValidLatLng(o.deliveryLatitude, o.deliveryLongitude))
      .forEach((ord) => {
        list.push({
          position: [ord.deliveryLatitude as number, ord.deliveryLongitude as number],
          title: `${ord.code} • ${ord.customerName}`,
          description: ord.deliveryAddress || 'Destino de entrega',
          icon: 'customer',
          badgeText: ord.code,
        });
      });

    return list;
  }, [currentStore, storeLocation, ownDrivers, activeOrders]);

  const routeWaypoints = useMemo<[number, number][]>(() => {
    const validTargets = activeOrders
      .filter((o) => isValidLatLng(o.deliveryLatitude, o.deliveryLongitude))
      .slice(0, 4)
      .map((o) => [o.deliveryLatitude as number, o.deliveryLongitude as number] as [number, number]);
    if (validTargets.length === 0) return [];
    return [storeLocation, ...validTargets];
  }, [storeLocation, activeOrders]);

  const routeWaypointsKey = routeWaypoints.map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join('|');

  useEffect(() => {
    if (routeWaypoints.length < 2) {
      setFleetRoute({ coordinates: [], distanceKm: 0, durationMin: 0, isFallback: true });
      return;
    }
    const controller = new AbortController();
    fetchStreetRouteOsrm(routeWaypoints, { signal: controller.signal }).then((res) => {
      if (!controller.signal.aborted) {
        setFleetRoute(res);
      }
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeWaypointsKey]);

  return (
    <div className="absolute inset-0 z-0">
      <MapDisplay
        center={storeLocation}
        zoom={14}
        height="100%"
        styleName="dark"
        circleRadiusKm={5}
        autoFitBounds={markers.length > 1}
        routePolyline={fleetRoute.coordinates}
        interactiveControls={true}
        markers={markers}
      />

      {/* Floating Status Badge */}
      <div className="absolute top-14 right-4 z-[400] bg-slate-950/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800 shadow-xl flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">
            Frota em Campo
          </span>
          <span className="text-emerald-400 font-black text-xs tabular-nums">
            {activeDriversCount} Online · {activeOrders.length} Rota(s)
            {fleetRoute.distanceKm > 0 ? ` · ${fleetRoute.distanceKm.toFixed(1)} km` : ''}
          </span>
        </div>
      </div>

      {/* Footer Info Strip */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] w-full max-w-sm px-4 pointer-events-none">
        <div className="bg-slate-950/90 backdrop-blur-md p-3 rounded-2xl border border-slate-800 shadow-2xl flex items-center gap-3">
          <div className="p-2.5 bg-teal-500/20 border border-teal-500/30 rounded-xl text-teal-400 shrink-0">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <h5 className="text-xs font-black text-white">
              Roteamento OSRM & Geofence (5 km)
              {fleetRoute.durationMin > 0 ? ` • ~${fleetRoute.durationMin} min` : ''}
            </h5>
            <p className="text-[10px] text-slate-400">
              Posições reais dos entregadores e destinos ativos no OpenStreetMap.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
