import React, { useState, useEffect } from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { PillarEntrance } from '../common/PillarEntrance';
import { Bike, QrCode } from 'lucide-react';
import { PILLAR_THEMES } from '@3c/design-system';
import { DriverBottomNav, DriverTab } from '../../modules/driver/DriverBottomNav';
import { DriverHomeTab } from '../../modules/driver/DriverHomeTab';
import { DriverOrdersTab } from '../../modules/driver/DriverOrdersTab';
import { DriverMapTab } from '../../modules/driver/DriverMapTab';
import { DriverEarningsTab } from '../../modules/driver/DriverEarningsTab';
import { DriverProfileTab } from '../../modules/driver/DriverProfileTab';
import { DriverOperationModeModal } from '../../modules/driver/DriverOperationModeModal';
import { DriverQrPairingModal } from '../../modules/store-os/drivers/DriverQrPairingModal';
import { isValidLatLng } from '../common/map/mapUtils';
import heroCourierRiderImg from '../../assets/images/hero_courier_rider_1794350796124.webp';
import { Driver } from '../../types';

export const DriverPillar: React.FC = () => {
  const { profile, logout } = useAuth();
  const {
    drivers,
    currentDriverId,
    setCurrentDriverId,
    driverPayouts,
    fetchDriverPayouts,
    requestDriverWithdraw,
    updateDriverLocation,
    updateDriverProfile,
    toggleDriverStatus,
    switchDriverOperationMode,
    orders,
    stores,
    currentStore,
    setSelectedStoreId,
    acceptDelivery,
    completeDelivery,
    logSystemEvent,
    showNotification
  } = useEcosystem();

  const [activeTab, setActiveTab] = useState<DriverTab>('home');
  const [operationMode, setOperationMode] = useState<'STORE' | 'PLATFORM'>('PLATFORM');
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);
  const [isQrPairingOpen, setIsQrPairingOpen] = useState(false);

  const normalizedRole = String(profile?.role || '').toUpperCase();
  const isCourierRole = normalizedRole === 'COURIER' || normalizedRole === 'DRIVER';
  const canSwitchDriver = false;
  const isAuthorized = isCourierRole;

  const matchedDriver = isCourierRole && profile?.uid
    ? drivers.find(d => d.id === profile.uid || d.uid === profile.uid)
    : drivers.find(d => d.id === currentDriverId) || drivers[0];

  const resolvedMatchedAvatar =
    matchedDriver?.avatar && !matchedDriver.avatar.startsWith('/src/assets/')
      ? matchedDriver.avatar
      : heroCourierRiderImg;

  const currentDriver: Driver = matchedDriver
    ? { ...matchedDriver, avatar: resolvedMatchedAvatar }
    : {
        id: isCourierRole && profile?.uid ? profile.uid : (currentDriverId || 'drv-1'),
        uid: isCourierRole ? profile?.uid : undefined,
        name: profile?.name || 'Entregador Parceiro',
        phone: profile?.phone || '',
        vehicle: 'SCOOTER',
        rating: 5.0,
        status: 'AVAILABLE',
        fleetType: profile?.storeId ? 'STORE_FLEET' : 'PLATFORM_FLEET',
        allowedFleetModes: profile?.storeId ? ['STORE_FLEET', 'PLATFORM_FLEET'] : ['PLATFORM_FLEET'],
        activeOperationMode: profile?.storeId ? 'STORE' : 'PLATFORM',
        storeId: profile?.storeId,
        totalDeliveries: 0,
        walletBalance: 0,
        avatar: heroCourierRiderImg,
        tenantId: profile?.tenantId || 'tenant-1',
      };

  const rawAllowedModes: ('PLATFORM_FLEET' | 'STORE_FLEET')[] =
    Array.isArray(currentDriver.allowedFleetModes) && currentDriver.allowedFleetModes.length > 0
      ? currentDriver.allowedFleetModes
      : [currentDriver.fleetType || (currentDriver.storeId ? 'STORE_FLEET' : 'PLATFORM_FLEET')];

  const canOperatePlatform = !isCourierRole || rawAllowedModes.includes('PLATFORM_FLEET');
  const canOperateStore =
    !isCourierRole || (rawAllowedModes.includes('STORE_FLEET') && Boolean(currentDriver.storeId));

  useEffect(() => {
    const preferredMode: 'STORE' | 'PLATFORM' =
      currentDriver.activeOperationMode === 'STORE' || currentDriver.activeOperationMode === 'PLATFORM'
        ? currentDriver.activeOperationMode
        : currentDriver.fleetType === 'STORE_FLEET' && currentDriver.storeId
        ? 'STORE'
        : 'PLATFORM';

    if (preferredMode === 'STORE' && canOperateStore) {
      setOperationMode('STORE');
    } else if (canOperatePlatform) {
      setOperationMode('PLATFORM');
    } else if (canOperateStore) {
      setOperationMode('STORE');
    }
  }, [currentDriver.id, currentDriver.activeOperationMode, currentDriver.fleetType, currentDriver.storeId, canOperatePlatform, canOperateStore]);

  const handleSelectMode = async (nextMode: 'STORE' | 'PLATFORM') => {
    if (nextMode === 'PLATFORM' && !canOperatePlatform) {
      showNotification('Conta restrita à frota da loja pela administração da plataforma.');
      return;
    }
    if (nextMode === 'STORE' && !canOperateStore) {
      showNotification('Conta sem vínculo de loja habilitado no momento.');
      return;
    }
    setOperationMode(nextMode);
    if (isCourierRole || matchedDriver) {
      await switchDriverOperationMode(currentDriver.id, nextMode);
    }
  };

  const isOnline = currentDriver.status !== 'OFFLINE';

  useEffect(() => {
    if (isAuthorized && activeTab === 'earnings' && currentDriver.id) {
      fetchDriverPayouts(currentDriver.id);
    }
  }, [isAuthorized, activeTab, currentDriver.id, fetchDriverPayouts]);

  if (!isAuthorized) {
    return (
      <>
        <PillarEntrance
          title="App do Entregador — 3C Logística"
          subtitle="Aplicativo único para entregadores da Plataforma Aberta e frotas próprias vinculadas aos estabelecimentos. Gerencie corridas, rotas GPS e repasses PIX."
          icon={<Bike className={`w-8 h-8 ${PILLAR_THEMES.driver.accentTextClass}`} />}
          requiredRole="COURIER"
          pillarId="driver"
          colorClass={PILLAR_THEMES.driver.accentTextClass}
          secondaryAction={
            <button
              type="button"
              onClick={() => setIsQrPairingOpen(true)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white border border-teal-500/40 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-teal-400" />
              Parear Frota Própria da Loja (QR Code / PIN)
            </button>
          }
          features={[
            "Modalidade Frota Própria da Loja com pareamento instantâneo via QR Code / PIN",
            "Modalidade Plataforma Aberta com corridas de toda a rede",
            "Navegação GPS em tempo real com coleta -> rota -> PIN",
            "Confirmação de entrega por código PIN de 4 dígitos",
            "Carteira digital unificada com repasses e saques via PIX"
          ]}
        />
        {isQrPairingOpen && (
          <DriverQrPairingModal
            currentStore={currentStore}
            onClose={() => setIsQrPairingOpen(false)}
            isDriverClient={true}
            onPairSuccess={(info) => {
              if (info.storeId) {
                setSelectedStoreId(info.storeId);
              }
              setOperationMode('STORE');
              showNotification(
                `Motorista ${info.driverName} vinculado à Frota Própria de ${info.storeName}!`
              );
            }}
          />
        )}
      </>
    );
  }

  const availableOrders = orders
    .filter(o => {
      if (o.status !== 'READY_FOR_PICKUP') return false;
      const isDirectAssignedToMe = o.driverId === currentDriver.id;
      if (o.driverId && !isDirectAssignedToMe) return false;
      if (isDirectAssignedToMe) return true;

      if (operationMode === 'PLATFORM') {
        return o.deliveryModality !== 'STORE_FLEET';
      }

      if (currentDriver.storeId) {
        return o.storeId === currentDriver.storeId;
      }

      return false;
    })
    .sort((a, b) => {
      const aMine = a.driverId === currentDriver.id ? 0 : 1;
      const bMine = b.driverId === currentDriver.id ? 0 : 1;
      return aMine - bMine;
    });

  const activeOrders = orders.filter(
    o =>
      (o.id === currentDriver?.currentOrderId || o.driverId === currentDriver?.id) &&
      o.status === 'OUT_FOR_DELIVERY'
  );

  const completedOrders = orders.filter(
    o => o.driverId === currentDriver?.id && o.status === 'DELIVERED'
  );

  const primaryActiveOrder = activeOrders[0];
  const linkedDriverStore = stores.find(s => s.id === (primaryActiveOrder?.storeId || currentDriver?.storeId)) || currentStore;
  const defaultCenterCoords: [number, number] = [-15.7801, -47.9292];
  const storeCoords: [number, number] = isValidLatLng(linkedDriverStore?.latitude, linkedDriverStore?.longitude)
    ? [linkedDriverStore!.latitude as number, linkedDriverStore!.longitude as number]
    : defaultCenterCoords;

  return (
    <div className="min-h-screen bg-[#0B1117] text-slate-100 flex flex-col justify-between selection:bg-[#00CCBC] selection:text-slate-950">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 pt-4 pb-24 relative flex-1">

        {activeTab === 'home' && (
          <DriverHomeTab
            currentDriver={currentDriver}
            drivers={drivers}
            currentDriverId={currentDriver.id}
            canSwitchDriver={canSwitchDriver}
            onSelectDriverId={setCurrentDriverId}
            onToggleDriverStatus={toggleDriverStatus}
            operationMode={operationMode}
            onOpenModeModal={() => setIsModeModalOpen(true)}
            onOpenQrPairing={() => setIsQrPairingOpen(true)}
            onNavigateToOrders={() => setActiveTab('orders')}
            completedOrders={completedOrders}
            totalAvailableCount={availableOrders.length}
            totalActiveCount={activeOrders.length}
            totalTodayCount={completedOrders.length + activeOrders.length + availableOrders.length}
            storeName={linkedDriverStore?.name}
          />
        )}

        {activeTab === 'orders' && (
          <DriverOrdersTab
            availableOrders={availableOrders}
            activeOrders={activeOrders}
            completedOrders={completedOrders}
            currentDriver={currentDriver}
            onAcceptDelivery={acceptDelivery}
            onToggleDriverStatus={() => toggleDriverStatus(currentDriver.id)}
            onNavigateToMap={() => setActiveTab('map')}
            isOnline={isOnline}
            operationMode={operationMode}
            storeName={linkedDriverStore?.name}
          />
        )}

        {activeTab === 'map' && (
          <DriverMapTab
            activeOrder={primaryActiveOrder}
            activeOrders={activeOrders}
            currentDriver={currentDriver}
            storeCoords={storeCoords}
            storePhone={linkedDriverStore?.phone}
            onCompleteDelivery={completeDelivery}
            onUpdateLocation={updateDriverLocation}
            onOperationalCheckIn={(order, stage) => {
              const stageLabels: Record<'ARRIVED_AT_STORE' | 'PICKED_UP' | 'ARRIVED_AT_CUSTOMER', string> = {
                ARRIVED_AT_STORE: 'Chegou na loja para coleta',
                PICKED_UP: 'Pedido coletado e em deslocamento',
                ARRIVED_AT_CUSTOMER: 'Chegou no endereço do cliente',
              };
              logSystemEvent(
                'DRIVER_CHECKIN',
                `[${order.code}] Motorista ${currentDriver.name}: ${stageLabels[stage]}`,
                'INFO'
              );
              showNotification(`Status operacional enviado à loja: ${stageLabels[stage]}`);
            }}
            onShowNotification={showNotification}
            onNavigateToOrders={() => setActiveTab('orders')}
          />
        )}

        {activeTab === 'earnings' && (
          <DriverEarningsTab
            currentDriver={currentDriver}
            completedOrders={completedOrders}
            payouts={driverPayouts}
            onRequestWithdraw={requestDriverWithdraw}
            onShowNotification={showNotification}
          />
        )}

        {activeTab === 'profile' && (
          <DriverProfileTab
            currentDriver={currentDriver}
            operationMode={operationMode}
            canOperatePlatform={canOperatePlatform}
            canOperateStore={canOperateStore}
            storeName={linkedDriverStore?.name}
            storePhone={linkedDriverStore?.phone}
            hasActiveDelivery={activeOrders.length > 0}
            onOpenModeModal={() => setIsModeModalOpen(true)}
            onOpenQrPairing={() => setIsQrPairingOpen(true)}
            onUpdateDriverProfile={updateDriverProfile}
            onReportOccurrence={(summary, kind) => {
              logSystemEvent(
                kind === 'TICKET' ? 'DRIVER_SUPPORT_TICKET' : 'DRIVER_SUPPORT_OCCURRENCE',
                `Motorista ${currentDriver.name}${primaryActiveOrder ? ` [${primaryActiveOrder.code}]` : ''}: ${summary}`,
                'fleet/support'
              );
            }}
            onShowNotification={showNotification}
            onLogout={logout}
          />
        )}

        <DriverOperationModeModal
          isOpen={isModeModalOpen}
          onClose={() => setIsModeModalOpen(false)}
          currentMode={operationMode}
          onSelectMode={handleSelectMode}
          storeName={linkedDriverStore?.name || currentStore.name}
          canOperatePlatform={canOperatePlatform}
          canOperateStore={canOperateStore}
          onOpenQrPairing={() => setIsQrPairingOpen(true)}
        />

        {isQrPairingOpen && (
          <DriverQrPairingModal
            currentStore={linkedDriverStore || currentStore}
            onClose={() => setIsQrPairingOpen(false)}
            isDriverClient={true}
            onPairSuccess={(info) => {
              if (info.storeId) {
                setSelectedStoreId(info.storeId);
              }
              setOperationMode('STORE');
              showNotification(
                `Vínculo com a Frota Própria de ${info.storeName} confirmado!`
              );
            }}
          />
        )}
      </div>

      <DriverBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        availableCount={availableOrders.length}
        activeCount={activeOrders.length}
      />
    </div>
  );
};
