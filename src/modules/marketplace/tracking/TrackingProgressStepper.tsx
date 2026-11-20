import React, { useEffect, useState } from 'react';
import { ShoppingBag, ShieldCheck, Package, CheckCircle2, Bike, Navigation, UtensilsCrossed } from 'lucide-react';
import { OrderStatus } from '../../../types';
import { MapDisplay } from '../../../components/common/MapDisplay';
import {
  fetchStreetRouteOsrm,
  geocodeAddressNominatim,
  isValidLatLng,
  OsrmRouteResult,
} from '../../../components/common/map/mapUtils';
import { useEcosystem } from '../../../context/EcosystemContext';

interface TrackingProgressStepperProps {
  status: OrderStatus;
  storeId?: string;
  storeName: string;
  driverId?: string;
  driverName?: string;
  deliveryAddress?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  channel?: string;
  tableNumber?: number;
}

export const TrackingProgressStepper: React.FC<TrackingProgressStepperProps> = ({
  status,
  storeId,
  storeName,
  driverId,
  driverName,
  deliveryAddress,
  deliveryLatitude,
  deliveryLongitude,
  channel = 'MARKETPLACE',
  tableNumber,
}) => {
  const { stores, drivers, userCoords } = useEcosystem();
  const isTableOrder = channel === 'TABLE' || channel === 'WAITER_TABLE';
  const isPickupOrder = channel === 'PICKUP';

  const getStatusStep = (st: OrderStatus) => {
    if (isTableOrder || isPickupOrder) {
      switch (st) {
        case 'PENDING': return 1;
        case 'CONFIRMED': return 2;
        case 'IN_PREPARATION': return 3;
        case 'READY_FOR_PICKUP': return 4;
        case 'OUT_FOR_DELIVERY':
        case 'DELIVERED': return 5;
        default: return 1;
      }
    }
    switch (st) {
      case 'PENDING': return 1;
      case 'CONFIRMED': return 2;
      case 'IN_PREPARATION': return 3;
      case 'READY_FOR_PICKUP': return 4;
      case 'OUT_FOR_DELIVERY': return 5;
      case 'DELIVERED': return 6;
      default: return 1;
    }
  };

  const currentStep = getStatusStep(status);

  const steps = isTableOrder
    ? [
        { id: 1, label: 'Rodada Enviada', icon: UtensilsCrossed },
        { id: 2, label: 'Confirmado', icon: ShieldCheck },
        { id: 3, label: 'Na Cozinha', icon: Package },
        { id: 4, label: 'Pronto p/ Servir', icon: CheckCircle2 },
        { id: 5, label: 'Servido / Encerrado', icon: CheckCircle2 },
      ]
    : isPickupOrder
    ? [
        { id: 1, label: 'Pedido Recebido', icon: ShoppingBag },
        { id: 2, label: 'Confirmado', icon: ShieldCheck },
        { id: 3, label: 'Em Preparo', icon: Package },
        { id: 4, label: 'Pronto no Balcão', icon: CheckCircle2 },
        { id: 5, label: 'Retirado', icon: CheckCircle2 },
      ]
    : [
        { id: 1, label: 'Pedido Recebido', icon: ShoppingBag },
        { id: 2, label: 'Confirmado', icon: ShieldCheck },
        { id: 3, label: 'Em Preparo', icon: Package },
        { id: 4, label: 'Pronto p/ Envio', icon: CheckCircle2 },
        { id: 5, label: 'Saiu p/ Entrega', icon: Bike },
        { id: 6, label: 'Entregue', icon: CheckCircle2 },
      ];

  const totalStepsCount = steps.length;

  const store = stores.find((s) => s.id === storeId || s.name === storeName);
  const assignedDriver = drivers.find(
    (d) => (driverId && d.id === driverId) || (driverName && d.name === driverName)
  );

  const storePos: [number, number] = isValidLatLng(store?.latitude, store?.longitude)
    ? [store!.latitude as number, store!.longitude as number]
    : [-23.3105, -51.1628];

  const [geocodedDest, setGeocodedDest] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (isValidLatLng(deliveryLatitude, deliveryLongitude) || !deliveryAddress) {
      setGeocodedDest(null);
      return;
    }
    const controller = new AbortController();
    geocodeAddressNominatim(deliveryAddress, {
      countryCodes: 'br',
      signal: controller.signal,
    }).then((res) => {
      if (res) setGeocodedDest([res.lat, res.lng]);
    });
    return () => controller.abort();
  }, [deliveryAddress, deliveryLatitude, deliveryLongitude]);

  const customerPos: [number, number] = isValidLatLng(deliveryLatitude, deliveryLongitude)
    ? [deliveryLatitude as number, deliveryLongitude as number]
    : geocodedDest ||
      (isValidLatLng(userCoords?.[0], userCoords?.[1])
        ? userCoords
        : [storePos[0] - 0.0085, storePos[1] - 0.0072]);

  const hasLiveDriverGps = Boolean(
    assignedDriver && isValidLatLng(assignedDriver.latitude, assignedDriver.longitude)
  );

  const driverPos: [number, number] = hasLiveDriverGps
    ? [assignedDriver!.latitude as number, assignedDriver!.longitude as number]
    : status === 'DELIVERED'
    ? customerPos
    : [(storePos[0] + customerPos[0]) / 2, (storePos[1] + customerPos[1]) / 2];

  const [routeData, setRouteData] = useState<OsrmRouteResult>({
    coordinates: [storePos, driverPos, customerPos],
    distanceKm: 0,
    durationMin: 0,
    isFallback: true,
  });

  const routeKey = `${storePos[0].toFixed(4)},${storePos[1].toFixed(4)}|${driverPos[0].toFixed(4)},${driverPos[1].toFixed(4)}|${customerPos[0].toFixed(4)},${customerPos[1].toFixed(4)}`;

  useEffect(() => {
    if (isTableOrder || isPickupOrder || (status !== 'OUT_FOR_DELIVERY' && status !== 'DELIVERED')) {
      return;
    }
    const controller = new AbortController();
    const waypoints: [number, number][] =
      status === 'DELIVERED' ? [storePos, customerPos] : [driverPos, customerPos];
    fetchStreetRouteOsrm(waypoints, { signal: controller.signal }).then((res) => {
      if (!controller.signal.aborted) {
        setRouteData(res);
      }
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, status, isTableOrder, isPickupOrder]);

  const titleText = isTableOrder
    ? status === 'DELIVERED'
      ? `Comanda Mesa ${String(tableNumber || 1).padStart(2, '0')} Encerrada`
      : `Acompanhando Mesa ${String(tableNumber || 1).padStart(2, '0')}`
    : isPickupOrder
    ? status === 'DELIVERED'
      ? 'Pedido Retirado!'
      : 'Acompanhando Retirada no Balcão'
    : status === 'DELIVERED'
    ? 'Pedido Entregue!'
    : 'Rastreando seu Delivery';

  return (
    <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 p-8 space-y-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-5">
        {isTableOrder ? (
          <UtensilsCrossed className="w-32 h-32 text-amber-500" />
        ) : isPickupOrder ? (
          <ShoppingBag className="w-32 h-32 text-blue-500" />
        ) : (
          <Bike className="w-32 h-32 text-amber-500" />
        )}
      </div>

      <div className="text-center space-y-2 relative">
        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
          {titleText}
        </h2>
        <p className="text-slate-400 text-sm">
          Status atual: <span className="text-amber-400 font-bold uppercase">{status.replace(/_/g, ' ')}</span>
        </p>
      </div>

      {/* Visual Progress Line */}
      <div className="relative pt-4">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-800 -translate-y-1/2 rounded-full" />
        <div
          className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-amber-500 to-emerald-500 -translate-y-1/2 rounded-full transition-all duration-1000"
          style={{ width: `${((currentStep - 1) / Math.max(1, totalStepsCount - 1)) * 100}%` }}
        />

        <div className="relative flex justify-between">
          {steps.map(step => {
            const Icon = step.icon;
            const isCompleted = step.id < currentStep;
            const isCurrent = step.id === currentStep;
            return (
              <div key={step.id} className="flex flex-col items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 z-10 ${
                    isCompleted
                      ? 'bg-emerald-500 text-slate-950 scale-90'
                      : isCurrent
                      ? 'bg-amber-500 text-slate-950 scale-110 shadow-lg shadow-amber-500/20'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-[9px] font-black uppercase tracking-tighter text-center max-w-[68px] leading-tight ${
                    isCurrent ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-time Tracking Map (Strictly for Delivery) */}
      {!isTableOrder && !isPickupOrder && (status === 'OUT_FOR_DELIVERY' || status === 'DELIVERED') && (
        <div className="pt-4 animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
              <Navigation className="w-3 h-3" />
              {status === 'DELIVERED'
                ? 'Trajeto Concluído no Mapa'
                : 'Localização do Entregador no Mapa'}
            </span>
            <div className="flex items-center gap-3 text-[10px] font-mono tabular-nums">
              {routeData.distanceKm > 0 && (
                <span className="text-slate-300 font-bold">
                  {routeData.distanceKm.toFixed(1)} km · ~{routeData.durationMin} min
                </span>
              )}
              <span className={hasLiveDriverGps ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                {hasLiveDriverGps ? 'GPS AO VIVO' : 'POSIÇÃO ESTIMADA'}
              </span>
            </div>
          </div>
          <MapDisplay
            center={driverPos}
            zoom={14}
            height="260px"
            styleName="dark"
            autoFitBounds={true}
            routePolyline={routeData.coordinates}
            markers={[
              {
                position: storePos,
                title: storeName,
                description: store?.address || 'Ponto de Saída da Loja',
                icon: 'store',
                badgeText: 'Loja',
              },
              {
                position: driverPos,
                title: driverName || assignedDriver?.name || 'Entregador Credenciado',
                description: hasLiveDriverGps
                  ? 'Posição GPS recebida em tempo real'
                  : 'Em deslocamento com o seu pedido',
                icon: 'driver',
                badgeText: status === 'DELIVERED' ? 'Entregue' : 'Em Trânsito',
              },
              {
                position: customerPos,
                title: 'Seu Endereço',
                description: deliveryAddress || 'Destino Final',
                icon: 'customer',
                badgeText: 'Você',
              },
            ]}
          />
        </div>
      )}
    </div>
  );
};
