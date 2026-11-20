import React, { useState } from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { Bike, MapPin, Navigation, Clock, AlertTriangle, CheckCircle2, TrendingUp, Globe, Truck, QrCode } from 'lucide-react';
import { MapDisplay, MapMarkerData } from '../../../components/common/MapDisplay';
import { isValidLatLng } from '../../../components/common/map/mapUtils';
import { LondrinaRegion, LONDRINA_REGIONS } from '../../../types';
import { DriverQrPairingModal } from '../drivers/DriverQrPairingModal';

export const LogisticsMonitorApp: React.FC = () => {
  const { currentStore, drivers, orders } = useEcosystem();
  const [activeTab, setActiveTab] = useState<'MAP' | 'FLEET' | 'AREAS'>('MAP');
  const [selectedRegion, setSelectedRegion] = useState<LondrinaRegion | 'ALL'>('ALL');
  const [isQrPairingOpen, setIsQrPairingOpen] = useState(false);

  const storeLat = isValidLatLng(currentStore.latitude, currentStore.longitude)
    ? (currentStore.latitude as number)
    : -23.3105;
  const storeLng = isValidLatLng(currentStore.latitude, currentStore.longitude)
    ? (currentStore.longitude as number)
    : -51.1628;
  const isLondrinaStore =
    Boolean(currentStore.region) ||
    /londrina/i.test(currentStore.address || '');

  const storeDrivers = drivers.filter(d => d.storeId === currentStore.id || d.fleetType === 'PLATFORM_FLEET');
  const activeDeliveries = orders.filter(
    o => o.storeId === currentStore.id && (o.status === 'OUT_FOR_DELIVERY' || o.status === 'READY_FOR_PICKUP')
  );

  const dispatchSectors = [
    {
      name: `Raio Operacional (${currentStore.name})`,
      status: currentStore.isOpen ? 'ABERTO' : 'FECHADO',
      detail: `${currentStore.deliveryTimeMin || 30} min estimados`,
      color: currentStore.isOpen ? 'text-emerald-500' : 'text-slate-500',
    },
    {
      name: 'Frota Conectada',
      status: storeDrivers.filter(d => d.status === 'AVAILABLE').length > 0 ? 'DISPONÍVEL' : 'OCUPADA',
      detail: `${storeDrivers.filter(d => d.status === 'AVAILABLE').length} disponíveis / ${storeDrivers.length} total`,
      color: storeDrivers.filter(d => d.status === 'AVAILABLE').length > 0 ? 'text-emerald-500' : 'text-amber-500',
    },
    {
      name: 'Fila de Expedição',
      status: activeDeliveries.length > 0 ? 'ATIVO' : 'LIVRE',
      detail: `${activeDeliveries.length} pedidos em rota/coleta`,
      color: activeDeliveries.length > 0 ? 'text-orange-400' : 'text-slate-400',
    },
  ];

  const mapCenter: [number, number] =
    selectedRegion === 'ALL' || !isLondrinaStore
      ? [storeLat, storeLng]
      : [LONDRINA_REGIONS[selectedRegion].lat, LONDRINA_REGIONS[selectedRegion].lng];

  return (
    <div className="flex flex-col h-full space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 rounded-xl border border-orange-500/20 text-orange-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
              Monitor de Logística & Despacho
            </h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {currentStore.name} • {currentStore.address || 'Operação Local & Geofencing'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsQrPairingOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-[11px] uppercase rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>QR Code • Frota Própria</span>
          </button>

          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'MAP', label: 'Mapa Live', icon: Navigation },
              { id: 'FLEET', label: `Frota (${storeDrivers.length})`, icon: Bike },
              { id: 'AREAS', label: `Entregas (${activeDeliveries.length})`, icon: MapPin },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as 'MAP' | 'FLEET' | 'AREAS')}
                className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === t.id ? 'bg-orange-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Regional Selector Bar (only shown for Londrina regional zoning) */}
      {isLondrinaStore && (
        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[10px] font-mono text-slate-400 uppercase font-black px-2 flex items-center gap-1 shrink-0">
            <Globe className="w-3.5 h-3.5 text-orange-400" /> Região:
          </span>
          <button
            onClick={() => setSelectedRegion('ALL')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              selectedRegion === 'ALL' ? 'bg-orange-500 text-slate-950 shadow' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            Todas as Regiões
          </button>
          {(Object.keys(LONDRINA_REGIONS) as LondrinaRegion[]).map(rKey => {
            const spec = LONDRINA_REGIONS[rKey];
            const isSelected = selectedRegion === rKey;
            return (
              <button
                key={rKey}
                onClick={() => setSelectedRegion(rKey)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap shrink-0 border cursor-pointer ${
                  isSelected ? `${spec.badgeColor} border-white/40 shadow` : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                📍 {spec.fullName}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0">
        {/* Main View Area */}
        <div className="lg:col-span-3 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative shadow-inner">
          {activeTab === 'MAP' && (
            <>
              <MapDisplay
                center={mapCenter}
                zoom={selectedRegion === 'ALL' ? 14 : 15}
                height="100%"
                styleName="dark"
                circleRadiusKm={5}
                interactiveControls={true}
                markers={[
                  {
                    position: [storeLat, storeLng],
                    title: currentStore.name,
                    description: currentStore.address || 'Base da Loja',
                    icon: 'store',
                    badgeText: currentStore.name.split(' ')[0],
                  },
                  ...storeDrivers
                    .filter((d) => isValidLatLng(d.latitude, d.longitude))
                    .map((d): MapMarkerData => ({
                      position: [d.latitude as number, d.longitude as number],
                      title: d.name,
                      description: `Status: ${d.status} • Placa: ${d.vehiclePlate || 'N/A'}`,
                      icon: 'driver',
                      badgeText: d.name.split(' ')[0],
                    })),
                  ...activeDeliveries
                    .filter((o) => isValidLatLng(o.deliveryLatitude, o.deliveryLongitude))
                    .map((o): MapMarkerData => ({
                      position: [o.deliveryLatitude as number, o.deliveryLongitude as number],
                      title: `${o.code} • ${o.customerName}`,
                      description: o.deliveryAddress || 'Destino de Entrega',
                      icon: 'customer',
                      badgeText: o.code,
                    })),
                ]}
              />

              <div className="absolute top-4 left-4 z-[400] space-y-2">
                <div className="bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800 shadow-xl flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <div className="text-[10px] font-black text-white uppercase">
                    {isLondrinaStore && selectedRegion !== 'ALL'
                      ? LONDRINA_REGIONS[selectedRegion].fullName
                      : currentStore.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {storeDrivers.filter(d => d.status !== 'OFFLINE').length} entregadores ativos
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'FLEET' && (
            <div className="p-6 h-full overflow-y-auto space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-black uppercase text-white flex items-center gap-2">
                  <Truck className="w-4 h-4 text-orange-400" /> Motoristas Vinculados & Plataforma
                </h4>
                <button
                  type="button"
                  onClick={() => setIsQrPairingOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" /> Parear Motorista Próprio (QR / PIN)
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {storeDrivers.map(driver => (
                  <div
                    key={driver.id}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <img src={driver.avatar} alt={driver.name} className="w-10 h-10 rounded-xl object-cover" />
                      <div>
                        <div className="text-xs font-black text-white flex items-center gap-1.5">
                          <span>{driver.name}</span>
                          {driver.storeId === currentStore.id && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold">
                              PRÓPRIO
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {driver.vehicle} • {driver.vehiclePlate || 'Sem placa'} • {driver.totalDeliveries} ent.
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                        driver.status === 'AVAILABLE'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : driver.status === 'BUSY'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {driver.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'AREAS' && (
            <div className="p-6 h-full overflow-y-auto space-y-4">
              <h4 className="text-sm font-black uppercase text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-400" /> Despachos em Rota & Prontos para Coleta
              </h4>
              {activeDeliveries.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500 italic bg-slate-900/50 rounded-2xl border border-slate-800">
                  Nenhuma entrega ativa em deslocamento ou aguardando coleta neste momento.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeDeliveries.map(order => (
                    <div
                      key={order.id}
                      className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-black text-amber-400 font-mono">{order.code} • {order.customerName}</div>
                        <div className="text-[11px] text-slate-300 mt-0.5">{order.deliveryAddress || 'Retirada no Balcão'}</div>
                        {order.driverName && (
                          <div className="text-[10px] text-emerald-400 mt-1">Entregador: {order.driverName}</div>
                        )}
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 text-[9px] font-black uppercase">
                        {order.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: Transit & Quick Stats */}
        <div className="space-y-6 overflow-y-auto pr-1 custom-scrollbar">
          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 space-y-4">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-500" /> Operação de Despacho
            </h4>
            <div className="space-y-3">
              {dispatchSectors.map((sector, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800/60">
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                      <span>{sector.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase ${sector.color}`}>{sector.status}</span>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono font-bold text-slate-400">{sector.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 space-y-4">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Entregas em Andamento
            </h4>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div className="text-xl font-black text-white font-mono">{activeDeliveries.length}</div>
              <p className="text-[9px] text-slate-400 mt-0.5 leading-relaxed">
                Pedidos prontos para coleta ou em deslocamento para {currentStore.name}.
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-900/20 to-slate-900 p-4 rounded-2xl border border-indigo-500/20 space-y-3">
            <div className="flex items-center gap-2 text-indigo-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase">Modalidade Logística</span>
            </div>
            <div className="text-sm font-black text-white font-mono">
              {currentStore.deliveryModality === 'STORE_FLEET' ? 'FROTA PRÓPRIA' : 'FROTA PLATAFORMA'}
            </div>
            <p className="text-[9px] text-slate-500 font-medium">
              Taxa configurada: R$ {(currentStore.ownFleetCustomFee ?? currentStore.deliveryFee).toFixed(2)}
            </p>
            <button
              type="button"
              onClick={() => setIsQrPairingOpen(true)}
              className="w-full py-2 bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 font-black text-[10px] uppercase rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" /> Gerar QR Code Frota Própria
            </button>
          </div>
        </div>
      </div>

      {isQrPairingOpen && (
        <DriverQrPairingModal
          currentStore={currentStore}
          onClose={() => setIsQrPairingOpen(false)}
          isDriverClient={false}
        />
      )}
    </div>
  );
};
