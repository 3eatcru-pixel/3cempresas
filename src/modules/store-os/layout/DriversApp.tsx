import React, { useState, useEffect } from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { useAuth } from '../../../context/AuthContext';
import { Truck, Navigation, Share2, ShieldCheck, QrCode } from 'lucide-react';
import { DriversFleetMap } from '../drivers/DriversFleetMap';
import { DriversSidebarList } from '../drivers/DriversSidebarList';
import { DriversStatsView } from '../drivers/DriversStatsView';
import { DriverQrPairingModal } from '../drivers/DriverQrPairingModal';
import { isValidLatLng } from '../../../components/common/map/mapUtils';

export const DriversApp: React.FC = () => {
  const {
    drivers,
    orders,
    currentStore,
    toggleDriverStatus,
    toggleStoreDeliveryModality,
    assignOrderDriver,
    updateStoreOperationalSettings,
    showNotification,
  } = useEcosystem();
  const { profile } = useAuth();
  const canToggleDriverStatus = profile?.role === 'DEV_OWNER' || profile?.role === 'SUPER_ADMIN';
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [isQrPairingOpen, setIsQrPairingOpen] = useState(false);
  const [isPoolEnabled, setIsPoolEnabled] = useState(
    currentStore.operationalSettings?.sharedNeighborhoodFleet ?? false
  );

  useEffect(() => {
    setIsPoolEnabled(currentStore.operationalSettings?.sharedNeighborhoodFleet ?? false);
  }, [currentStore.id, currentStore.operationalSettings?.sharedNeighborhoodFleet]);

  const ownDrivers = drivers.filter(
    d =>
      d.storeId === currentStore.id ||
      d.fleetType === 'PLATFORM_FLEET' ||
      (Array.isArray(d.allowedFleetModes) && d.allowedFleetModes.includes('PLATFORM_FLEET'))
  );

  const partnerDrivers = drivers.filter(
    d => d.storeId !== currentStore.id && d.fleetType === 'STORE_FLEET'
  );

  const storeOrders = orders.filter(o => o.storeId === currentStore.id);
  const readyOrders = storeOrders.filter(o => o.status === 'READY_FOR_PICKUP');
  const activeDeliveryOrders = storeOrders.filter(o => o.status === 'OUT_FOR_DELIVERY');
  const deliveredOrdersCount = storeOrders.filter(o => o.status === 'DELIVERED').length;

  const activeDriversCount = ownDrivers.filter(d => d.status !== 'OFFLINE').length;
  const partnerDriversCount = partnerDrivers.filter(d => d.status === 'AVAILABLE').length;
  const currentModality = currentStore.deliveryModality || 'PLATFORM_FLEET';

  const storeLocation: [number, number] = isValidLatLng(currentStore.latitude, currentStore.longitude)
    ? [currentStore.latitude as number, currentStore.longitude as number]
    : [-23.3105, -51.1628];

  const handleTogglePool = async () => {
    const next = !isPoolEnabled;
    setIsPoolEnabled(next);
    await updateStoreOperationalSettings(currentStore.id, {
      sharedNeighborhoodFleet: next,
    });
    showNotification(
      next
        ? 'Pool de Motoboys ativado! Configuração salva.'
        : 'Pool de Motoboys desativado.'
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0a0e17] text-slate-900 dark:text-slate-100 animate-fadeIn">
      {/* Header */}
      <header className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 rounded-2xl border border-teal-500/20">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight leading-none">
              Logística & Frota Compartilhada
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center gap-2">
              <Navigation className="w-3 h-3 text-teal-500" />
              Mesma infraestrutura do App Driver • Frota da loja e rede parceira
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => toggleStoreDeliveryModality(currentStore.id, 'STORE_FLEET')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                currentModality === 'STORE_FLEET'
                  ? 'bg-teal-500 text-slate-950 shadow-sm font-black'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Frota Própria da Loja
            </button>
            <button
              type="button"
              onClick={() => toggleStoreDeliveryModality(currentStore.id, 'PLATFORM_FLEET')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                currentModality === 'PLATFORM_FLEET'
                  ? 'bg-teal-500 text-slate-950 shadow-sm font-black'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Rede Parceira
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsQrPairingOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            title="Gerar QR Code e PIN de 6 dígitos para parear motoristas próprios da loja"
          >
            <QrCode className="w-4 h-4" />
            <span>QR Code • Motorista Próprio</span>
          </button>

          <span
            title="Entregadores parceiros são habilitados pela plataforma logística 3C"
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            {currentModality === 'STORE_FLEET' ? 'Frota Própria Ativa' : 'Rede Parceira'}
          </span>

          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-teal-600 dark:text-teal-400'
                  : 'text-slate-500'
              }`}
            >
              Despacho
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-teal-600 dark:text-teal-400'
                  : 'text-slate-500'
              }`}
            >
              Mapa GPS
            </button>
          </div>
        </div>
      </header>

      {/* Own Fleet QR Banner & Shared Fleet / Pool Banner */}
      <div
        className={`px-4 py-2 transition-all border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 ${
          currentModality === 'STORE_FLEET' ? 'bg-teal-500/10' : isPoolEnabled ? 'bg-emerald-500/5' : 'bg-slate-50 dark:bg-slate-900/50'
        }`}
      >
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
          {currentModality === 'STORE_FLEET' && (
            <div className="flex items-center gap-2 text-teal-400">
              <QrCode className="w-3.5 h-3.5" />
              <span>Frota Própria Ativa: pareie seus motoboys via QR Code / PIN direto no App 3C Driver</span>
              <button
                type="button"
                onClick={() => setIsQrPairingOpen(true)}
                className="px-2.5 py-0.5 rounded-lg bg-teal-500 text-slate-950 font-black text-[10px] uppercase tracking-wider hover:bg-teal-400 transition-colors cursor-pointer"
              >
                Exibir QR Code da Frota
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Share2 className={`w-3.5 h-3.5 ${isPoolEnabled ? 'text-emerald-500' : 'text-slate-400'}`} />
            <span className={isPoolEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>
              Pool de Motoboys Bairro: {isPoolEnabled ? 'ATIVADO' : 'DESATIVADO'}
            </span>
            {isPoolEnabled && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-black text-[10px] tabular-nums">
                {partnerDriversCount} PARCEIROS DISPONÍVEIS
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleTogglePool}
          className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
            isPoolEnabled
              ? 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
              : 'border-slate-300 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {isPoolEnabled ? 'DESATIVAR POOL' : 'ATIVAR POOL'}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Panel: Drivers List */}
        <DriversSidebarList
          viewMode={viewMode}
          ownDrivers={ownDrivers}
          partnerDrivers={partnerDrivers}
          currentStoreId={currentStore.id}
          isPoolEnabled={isPoolEnabled}
          canToggleStatus={canToggleDriverStatus}
          onToggleStatus={toggleDriverStatus}
        />

        {/* Right Panel: Map or Dispatch Queue */}
        <div className="flex-1 relative bg-slate-100 dark:bg-slate-950 overflow-y-auto">
          {viewMode === 'map' ? (
            <DriversFleetMap
              currentStore={currentStore}
              storeLocation={storeLocation}
              ownDrivers={ownDrivers}
              activeDriversCount={activeDriversCount}
              activeOrders={activeDeliveryOrders}
            />
          ) : (
            <DriversStatsView
              storeName={currentStore.name}
              storeModality={currentModality}
              readyOrders={readyOrders}
              activeOrders={activeDeliveryOrders}
              deliveredCount={deliveredOrdersCount}
              eligibleDrivers={ownDrivers}
              onAssignDriver={assignOrderDriver}
            />
          )}
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
