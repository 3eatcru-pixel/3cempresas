import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Route } from 'lucide-react';
import { Order, Driver } from '../../types';
import { MapMarkerData } from '../../components/common/MapDisplay';
import {
  fetchStreetRouteOsrm,
  geocodeAddressNominatim,
  optimizeMultiStopTripOsrm,
  isValidLatLng,
  getGeolocationPermissionState,
  GeolocationPermissionState,
  OsrmRouteResult,
} from '../../components/common/map/mapUtils';
import { DriverNoActiveOrderCard } from './layout/DriverNoActiveOrderCard';
import { DriverDeliveryConfirmationForm } from './layout/DriverDeliveryConfirmationForm';
import { DriverGpsConsentBanner } from './layout/DriverGpsConsentBanner';
import { DriverRouteMapCard } from './layout/DriverRouteMapCard';
import { DriverCustomerDetailsCard } from './layout/DriverCustomerDetailsCard';

interface DriverMapTabProps {
  activeOrder?: Order;
  activeOrders?: Order[];
  currentDriver: Driver;
  storeCoords?: [number, number];
  storePhone?: string;
  onCompleteDelivery: (driverId: string, orderId: string, deliveryPin?: string) => Promise<boolean> | void;
  onUpdateLocation?: (driverId: string, lat: number, lng: number) => void;
  onOperationalCheckIn?: (order: Order, stage: 'ARRIVED_AT_STORE' | 'PICKED_UP' | 'ARRIVED_AT_CUSTOMER') => void;
  onShowNotification: (msg: string) => void;
  onNavigateToOrders: () => void;
}

export const DriverMapTab: React.FC<DriverMapTabProps> = ({
  activeOrder,
  activeOrders = [],
  currentDriver,
  storeCoords,
  storePhone,
  onCompleteDelivery,
  onUpdateLocation,
  onOperationalCheckIn,
  onShowNotification,
  onNavigateToOrders,
}) => {
  const [routeStarted, setRouteStarted] = useState(false);
  const [submittingDelivery, setSubmittingDelivery] = useState(false);
  const [selectedStopOrderId, setSelectedStopOrderId] = useState<string | null>(null);
  const [liveCoords, setLiveCoords] = useState<[number, number] | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'live' | 'fallback'>('fallback');
  const [gpsPermState, setGpsPermState] = useState<GeolocationPermissionState>('prompt');
  const [gpsConsentActive, setGpsConsentActive] = useState(false);
  const [geocodedCustomerPos, setGeocodedCustomerPos] = useState<[number, number] | null>(null);
  const [orderedStopIds, setOrderedStopIds] = useState<string[]>([]);
  const [routeData, setRouteData] = useState<OsrmRouteResult>({
    coordinates: [],
    distanceKm: 0,
    durationMin: 0,
    isFallback: true,
  });
  const lastSyncAtRef = useRef<number>(0);

  const effectiveActiveOrders = useMemo(
    () => (activeOrders.length > 0 ? activeOrders : activeOrder ? [activeOrder] : []),
    [activeOrders, activeOrder]
  );
  const primaryOrder =
    effectiveActiveOrders.find((o) => o.id === selectedStopOrderId) ||
    activeOrder ||
    effectiveActiveOrders[0];

  useEffect(() => {
    let mounted = true;
    getGeolocationPermissionState().then((state) => {
      if (!mounted) return;
      setGpsPermState(state);
      if (state === 'granted') {
        setGpsConsentActive(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, [primaryOrder?.id]);

  const handleRequestDriverGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsPermState('unsupported');
      onShowNotification('GPS não disponível neste dispositivo/navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: [number, number] = [position.coords.latitude, position.coords.longitude];
        setLiveCoords(next);
        setGpsPermState('granted');
        setGpsConsentActive(true);
        setGpsStatus('live');
        if (onUpdateLocation) {
          lastSyncAtRef.current = Date.now();
          onUpdateLocation(currentDriver.id, next[0], next[1]);
        }
        onShowNotification('GPS real autorizado e ativo para rastreamento da entrega.');
      },
      (err) => {
        if (err?.code === 1) {
          setGpsPermState('denied');
          setGpsConsentActive(false);
          onShowNotification('Permissão de GPS negada. Libere a localização nas configurações do aparelho/navegador.');
        } else {
          onShowNotification('Não foi possível obter sinal GPS agora. Tente novamente em área aberta.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    if (!primaryOrder || !gpsConsentActive || typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('fallback');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const next: [number, number] = [position.coords.latitude, position.coords.longitude];
        setLiveCoords(next);
        setGpsStatus('live');
        setGpsPermState('granted');
        const now = Date.now();
        if (onUpdateLocation && now - lastSyncAtRef.current >= 10000) {
          lastSyncAtRef.current = now;
          onUpdateLocation(currentDriver.id, next[0], next[1]);
        }
      },
      (err) => {
        if (err?.code === 1) {
          setGpsPermState('denied');
          setGpsConsentActive(false);
        }
        setGpsStatus('fallback');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [primaryOrder?.id, gpsConsentActive, currentDriver.id, onUpdateLocation]);

  useEffect(() => {
    if (
      !primaryOrder ||
      isValidLatLng(primaryOrder.deliveryLatitude, primaryOrder.deliveryLongitude) ||
      !primaryOrder.deliveryAddress
    ) {
      setGeocodedCustomerPos(null);
      return;
    }

    const controller = new AbortController();
    geocodeAddressNominatim(primaryOrder.deliveryAddress, {
      countryCodes: 'br',
      signal: controller.signal,
    }).then((res) => {
      if (res && !controller.signal.aborted) {
        setGeocodedCustomerPos([res.lat, res.lng]);
      }
    });
    return () => controller.abort();
  }, [primaryOrder?.id, primaryOrder?.deliveryAddress, primaryOrder?.deliveryLatitude, primaryOrder?.deliveryLongitude]);

  const baseLat = isValidLatLng(storeCoords?.[0], storeCoords?.[1]) ? storeCoords![0] : -23.3105;
  const baseLng = isValidLatLng(storeCoords?.[0], storeCoords?.[1]) ? storeCoords![1] : -51.1628;
  const storePos: [number, number] = [baseLat, baseLng];
  const driverPos: [number, number] =
    liveCoords ||
    (isValidLatLng(currentDriver.latitude, currentDriver.longitude)
      ? [currentDriver.latitude as number, currentDriver.longitude as number]
      : storePos);

  const hasExactOrderCoords = Boolean(
    primaryOrder && isValidLatLng(primaryOrder.deliveryLatitude, primaryOrder.deliveryLongitude)
  );
  const customerPos: [number, number] = hasExactOrderCoords
    ? [primaryOrder!.deliveryLatitude as number, primaryOrder!.deliveryLongitude as number]
    : geocodedCustomerPos || [baseLat - 0.0085, baseLng - 0.0072];

  const extraStops = useMemo(
    () =>
      effectiveActiveOrders
        .filter((o) => isValidLatLng(o.deliveryLatitude, o.deliveryLongitude))
        .map((o) => ({
          id: o.id,
          order: o,
          position: [o.deliveryLatitude as number, o.deliveryLongitude as number] as [number, number],
        })),
    [effectiveActiveOrders]
  );

  const routeKey = `${driverPos[0].toFixed(4)},${driverPos[1].toFixed(4)}|${customerPos[0].toFixed(4)},${customerPos[1].toFixed(4)}|${extraStops.map((s) => `${s.id}:${s.position[0].toFixed(4)},${s.position[1].toFixed(4)}`).join(';')}`;

  useEffect(() => {
    if (!primaryOrder) return;
    const controller = new AbortController();

    if (extraStops.length > 1) {
      optimizeMultiStopTripOsrm(driverPos, extraStops, { signal: controller.signal }).then((res) => {
        if (!controller.signal.aborted) {
          setOrderedStopIds(res.orderedStops.map((s) => s.id));
          setRouteData(res.route);
        }
      });
    } else {
      setOrderedStopIds(primaryOrder ? [primaryOrder.id] : []);
      fetchStreetRouteOsrm([driverPos, customerPos], { signal: controller.signal }).then((res) => {
        if (!controller.signal.aborted) {
          setRouteData(res);
        }
      });
    }
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryOrder?.id, routeKey]);

  if (!primaryOrder) {
    return <DriverNoActiveOrderCard onNavigateToOrders={onNavigateToOrders} />;
  }

  const routePolyline: [number, number][] =
    routeData.coordinates.length > 1 ? routeData.coordinates : [storePos, driverPos, customerPos];
  const mapCenter: [number, number] = driverPos;
  const totalEarning =
    (Number(primaryOrder.deliveryFee) || 0) + (Number((primaryOrder as any).courierTip) || 0);
  const osmDirectionsUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${driverPos[0]},${driverPos[1]};${customerPos[0]},${customerPos[1]}`;

  const stopMarkers: MapMarkerData[] =
    extraStops.length > 1
      ? extraStops.map((s) => {
          const seqIdx = orderedStopIds.indexOf(s.id);
          const seqLabel = seqIdx >= 0 ? `#${seqIdx + 1}` : s.order.code;
          return {
            position: s.position,
            title: `Parada ${seqLabel} • ${s.order.customerName}`,
            description: s.order.deliveryAddress || 'Endereço do Cliente',
            icon: 'customer',
            badgeText: `${seqLabel} ${s.order.code}`,
          };
        })
      : [
          {
            position: customerPos,
            title: primaryOrder.customerName,
            description: `${primaryOrder.deliveryAddress || 'Endereço do Cliente'}${
              !hasExactOrderCoords && !geocodedCustomerPos ? ' (Aproximado)' : ''
            }`,
            icon: 'customer',
            badgeText: 'Destino',
          },
        ];

  const orderedActiveOrders = useMemo(() => {
    if (orderedStopIds.length === 0) return effectiveActiveOrders;
    return [...effectiveActiveOrders].sort((a, b) => {
      const idxA = orderedStopIds.indexOf(a.id);
      const idxB = orderedStopIds.indexOf(b.id);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  }, [effectiveActiveOrders, orderedStopIds]);

  const handleFinishDelivery = async (pinCode: string): Promise<boolean> => {
    setSubmittingDelivery(true);
    try {
      const res = await onCompleteDelivery(currentDriver.id, primaryOrder.id, pinCode);
      return res !== false;
    } finally {
      setSubmittingDelivery(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 animate-fadeIn">
      {/* Top Bar Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onNavigateToOrders}
          className="min-h-[44px] flex items-center gap-1.5 text-xs text-[#00CCBC] hover:text-white font-bold bg-[#111922] px-3.5 py-2 rounded-xl border border-slate-800 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar aos Pedidos
        </button>

        <div className="flex items-center gap-2">
          {effectiveActiveOrders.length > 1 && (
            <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-lg flex items-center gap-1 tabular-nums">
              <Route className="w-3 h-3" /> {effectiveActiveOrders.length} Paradas Otimizadas
            </span>
          )}
          <span className="text-xs font-mono font-black bg-[#00CCBC] text-slate-950 px-2.5 py-1 rounded-lg">
            {primaryOrder.code}
          </span>
          <span className="text-xs font-mono text-[#00CCBC] font-bold bg-[#00CCBC]/10 px-2.5 py-1 rounded-lg border border-[#00CCBC]/30 tabular-nums">
            + R$ {totalEarning.toFixed(2).replace('.', ',')}
          </span>
        </div>
      </div>

      <DriverGpsConsentBanner
        routeStarted={routeStarted}
        gpsPermState={gpsPermState}
        onRequestDriverGps={handleRequestDriverGps}
      />

      {orderedActiveOrders.length > 1 && (
        <div className="bg-[#111922] border border-slate-800 rounded-2xl p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Selecione a parada atual para ver detalhes e validar o PIN:
          </p>
          <div className="flex flex-wrap gap-2">
            {orderedActiveOrders.map((stopOrder, idx) => {
              const isSelected = stopOrder.id === primaryOrder.id;
              return (
                <button
                  key={stopOrder.id}
                  type="button"
                  onClick={() => setSelectedStopOrderId(stopOrder.id)}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#00CCBC] text-slate-950 border-[#00CCBC] shadow-md'
                      : 'bg-[#0B1117] text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="tabular-nums">Parada #{idx + 1}</span>
                  <span className="font-mono">{stopOrder.code}</span>
                  <span className="truncate max-w-[110px]">({stopOrder.customerName})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <DriverRouteMapCard
        storeName={primaryOrder.storeName}
        driverName={currentDriver.name}
        deliveryAddress={primaryOrder.deliveryAddress}
        gpsStatus={gpsStatus}
        routeStarted={routeStarted}
        routeData={routeData}
        mapCenter={mapCenter}
        routePolyline={routePolyline}
        storePos={storePos}
        driverPos={driverPos}
        stopMarkers={stopMarkers}
        osmDirectionsUrl={osmDirectionsUrl}
        onSyncGps={() => {
          if (liveCoords && onUpdateLocation) {
            onUpdateLocation(currentDriver.id, liveCoords[0], liveCoords[1]);
            setRouteStarted(true);
            onShowNotification('Posição GPS sincronizada com o trajeto.');
          } else {
            handleRequestDriverGps();
          }
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DriverCustomerDetailsCard
          key={`cust-${primaryOrder.id}`}
          order={primaryOrder}
          storePhone={storePhone}
          onOperationalCheckIn={
            onOperationalCheckIn ? (stage) => onOperationalCheckIn(primaryOrder, stage) : undefined
          }
          onShowNotification={onShowNotification}
        />

        <DriverDeliveryConfirmationForm
          key={`pin-${primaryOrder.id}`}
          routeStarted={routeStarted}
          submitting={submittingDelivery}
          onStartRoute={() => {
            setRouteStarted(true);
            onShowNotification('Rota GPS iniciada! Siga o trajeto até o cliente.');
          }}
          onFinishDelivery={handleFinishDelivery}
          onShowNotification={onShowNotification}
        />
      </div>
    </div>
  );
};
