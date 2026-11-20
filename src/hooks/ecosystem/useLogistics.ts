import { useState, useEffect, useCallback } from 'react';
import { DatabaseAdapterManager } from '../../services/databaseAdapter';
import { CommerceService } from '../../services/CommerceService';
import { Driver, DriverPayout, DeliveryFleetModality, Order, Store } from '../../types';
import { apiClient } from '@3c/api-client';

export const useLogistics = (
  user: any,
  profile: any,
  showNotification: (msg: string) => void,
  logSystemEvent: (type: string, payload: string, channel: string, tenantId?: string) => Promise<void>,
  getIdToken: () => Promise<string | undefined>,
  orders: Order[],
  loading: boolean,
  isAuthenticated: boolean,
  selectedStoreId?: string,
  stores: Store[] = []
) => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [currentDriverId, setCurrentDriverId] = useState<string>('drv-1');
  const [driverPayouts, setDriverPayouts] = useState<DriverPayout[]>([]);

  const adapter = DatabaseAdapterManager.getAdapter();
  const normalizedRole = String(profile?.role || '').toUpperCase();
  const isCourierRole = normalizedRole === 'COURIER' || normalizedRole === 'DRIVER';

  useEffect(() => {
    if (loading || !isAuthenticated) {
      if (!loading && !isAuthenticated) {
        setDrivers([]);
        setDriverPayouts([]);
      }
      return;
    }
    const canReadDrivers = [
      'DEV_OWNER',
      'SUPER_ADMIN',
      'REGIONAL_MANAGER',
      'STORE_OWNER',
      'STORE_MANAGER',
      'CASHIER',
      'COURIER',
      'DRIVER',
    ].includes(normalizedRole);
    if (!canReadDrivers) {
      setDrivers([]);
      setDriverPayouts([]);
      return;
    }
    const unsub = adapter.subscribe<Driver>('drivers', (list) => {
      setDrivers(list);
    });
    return () => unsub();
  }, [loading, isAuthenticated, normalizedRole]);

  useEffect(() => {
    if (isCourierRole && profile?.uid) {
      setCurrentDriverId(profile.uid);
    } else if (!isCourierRole && drivers.length > 0 && !drivers.some(d => d.id === currentDriverId)) {
      setCurrentDriverId(drivers[0].id);
    }
  }, [isCourierRole, profile?.uid, drivers]);

  const fetchDriverPayouts = useCallback(async (driverId: string) => {
    if (!driverId || !isAuthenticated) return;
    try {
      const token = await getIdToken();
      if (!token) return;
      const list = await apiClient.listDriverPayouts(driverId, token);
      setDriverPayouts(Array.isArray(list) ? list : []);
    } catch {
      // keep existing state on transient error
    }
  }, [isAuthenticated, getIdToken]);

  const toggleDriverStatus = async (id: string) => {
    try {
      const drv = drivers.find(d => d.id === id || d.uid === id);
      const newStatus = drv?.status === 'OFFLINE' ? 'AVAILABLE' : 'OFFLINE';
      await adapter.updateDriver(id, { status: newStatus });
      setDrivers(prev => {
        const idx = prev.findIndex(d => d.id === id || d.uid === id);
        if (idx >= 0) {
          return prev.map((d, i) => (i === idx ? { ...d, status: newStatus } : d));
        }
        return prev;
      });
      logSystemEvent('DRIVER_STATUS_CHANGE', `Motorista ${drv?.name || profile?.name || id} está agora ${newStatus}`, 'fleet/delivery');
    } catch {
      showNotification('Erro ao alterar status do motorista.');
    }
  };

  const switchDriverOperationMode = async (driverId: string, mode: 'PLATFORM' | 'STORE'): Promise<boolean> => {
    try {
      const nextFleet = mode === 'STORE' ? 'STORE_FLEET' : 'PLATFORM_FLEET';
      await adapter.updateDriver(driverId, {
        activeOperationMode: mode,
        fleetType: nextFleet,
      });
      setDrivers(prev => {
        const idx = prev.findIndex(d => d.id === driverId || d.uid === driverId);
        if (idx >= 0) {
          return prev.map((d, i) =>
            i === idx ? { ...d, activeOperationMode: mode, fleetType: nextFleet } : d
          );
        }
        return prev;
      });
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('3c:collection-hint', { detail: { collections: ['orders', 'drivers'] } }));
      }
      showNotification(
        mode === 'STORE'
          ? 'Modo Frota da Loja ativado: você receberá despachos e pedidos da sua loja.'
          : 'Modo Plataforma Aberta ativado: corridas abertas de toda a rede.'
      );
      logSystemEvent('DRIVER_MODE_CHANGE', `Entregador ${driverId} alternou para modo ${mode}`, 'fleet/delivery');
      return true;
    } catch (err: any) {
      showNotification(err?.message || 'Não foi possível alternar a modalidade do entregador.');
      return false;
    }
  };

  const updateDriverProfile = async (
    driverId: string,
    updates: {
      name?: string;
      phone?: string;
      vehicle?: 'SCOOTER' | 'BIKE' | 'CAR';
      vehiclePlate?: string;
      pixKey?: string;
    }
  ): Promise<boolean> => {
    try {
      await adapter.updateDriver(driverId, updates as any);
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === driverId || d.uid === driverId ? { ...d, ...updates } : d
        )
      );
      showNotification('Dados operacionais do motorista atualizados com sucesso!');
      logSystemEvent(
        'DRIVER_PROFILE_UPDATED',
        `Motorista ${driverId} atualizou cadastro (${updates.vehicle || ''})`,
        'fleet/delivery'
      );
      return true;
    } catch (err: any) {
      showNotification(err?.message || 'Erro ao atualizar dados do motorista.');
      return false;
    }
  };

  const assignOrderDriver = async (orderId: string, driverId: string): Promise<boolean> => {
    try {
      const token = await getIdToken();
      if (!token) {
        showNotification('Sessão expirada. Faça login novamente para despachar entregador.');
        return false;
      }
      const res = await apiClient.assignOrderDriver(orderId, driverId, token);
      if (res?.success) {
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('3c:collection-hint', { detail: { collections: ['orders', 'drivers'] } }));
        }
        showNotification(`Pedido despachado para ${res.driverName || 'entregador'} no App Driver!`);
        logSystemEvent('ORDER_DRIVER_DISPATCHED', `Pedido ${orderId} despachado para ${driverId}`, 'fleet/dispatch');
        return true;
      }
      showNotification(res?.error || 'Falha ao despachar entregador para o pedido.');
      return false;
    } catch (err: any) {
      showNotification(err?.message || 'Erro ao despachar entregador.');
      return false;
    }
  };

  const updateDriverLocation = useCallback(async (driverId: string, latitude: number, longitude: number) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    try {
      await adapter.updateDriver(driverId, { latitude, longitude });
      setDrivers(prev =>
        prev.map(d => (d.id === driverId || d.uid === driverId ? { ...d, latitude, longitude } : d))
      );
    } catch {
      // ignore transient telemetry failures
    }
  }, []);

  const acceptDelivery = async (driverId: string, orderId: string) => {
    try {
      const token = await getIdToken();
      if (!token) {
        showNotification('Sessão expirada. Faça login novamente para aceitar entregas.');
        return;
      }
      const effectiveDriverId = isCourierRole && profile?.uid ? profile.uid : driverId;
      const drv = drivers.find(d => d.id === effectiveDriverId || d.uid === effectiveDriverId);
      const effectiveDriverName = drv?.name || (isCourierRole ? profile?.name : undefined);
      const result = await CommerceService.updateOrderStatus(
        orderId,
        'OUT_FOR_DELIVERY',
        token,
        undefined,
        effectiveDriverId,
        effectiveDriverName
      );

      if (result.success) {
        await adapter.updateDriver(effectiveDriverId, { status: 'BUSY' });
        await adapter.updateOrderStatus(orderId, 'OUT_FOR_DELIVERY', {
          driverId: effectiveDriverId,
          driverName: effectiveDriverName
        });
        showNotification('Entrega Aceita pelo Motorista!');
        logSystemEvent('COURIER_ASSIGNED', `Pedido #${orderId} atribuído ao motorista ${effectiveDriverId}`, 'fleet/delivery');
      } else {
        showNotification(`Erro ao aceitar entrega: ${result.error}`);
      }
    } catch {
      showNotification('Erro ao aceitar entrega.');
    }
  };

  const completeDelivery = async (driverId: string, orderId: string, deliveryPin?: string): Promise<boolean> => {
    try {
      const token = await getIdToken();
      if (!token) {
        showNotification('Sessão expirada. Faça login novamente para concluir entregas.');
        return false;
      }
      const effectiveDriverId = isCourierRole && profile?.uid ? profile.uid : driverId;
      const result = await CommerceService.updateOrderStatus(
        orderId,
        'DELIVERED',
        token,
        undefined,
        effectiveDriverId,
        undefined,
        deliveryPin
      );

      if (result.success) {
        const order = orders.find(o => o.id === orderId);
        const driver = drivers.find(d => d.id === effectiveDriverId || d.uid === effectiveDriverId);
        const deliveryFeeEarned = Math.round(((Number(order?.deliveryFee) || 0) + (Number((order as any)?.courierTip) || 0)) * 100) / 100;

        setDrivers(prev =>
          prev.map(d =>
            d.id === effectiveDriverId || d.uid === effectiveDriverId
              ? {
                  ...d,
                  status: 'AVAILABLE',
                  currentOrderId: undefined,
                  totalDeliveries: (d.totalDeliveries || 0) + 1,
                  walletBalance: Math.round(((d.walletBalance || 0) + deliveryFeeEarned) * 100) / 100,
                }
              : d
          )
        );
        await adapter.updateOrderStatus(orderId, 'DELIVERED');

        logSystemEvent('DELIVERY_COMPLETED', `Pedido #${orderId} entregue com sucesso.`, 'fleet/delivery');
        showNotification(
          deliveryFeeEarned > 0
            ? `Entrega concluída! R$ ${deliveryFeeEarned.toFixed(2)} creditados na carteira.`
            : 'Entrega concluída com sucesso!'
        );
        return true;
      } else {
        showNotification(`Erro ao concluir entrega: ${result.error}`);
        return false;
      }
    } catch {
      showNotification('Erro ao concluir entrega.');
      return false;
    }
  };

  const requestDriverWithdraw = async (driverId: string, amount: number, pixKey: string): Promise<boolean> => {
    try {
      const token = await getIdToken();
      if (!token) {
        showNotification('Sessão expirada. Faça login novamente para solicitar saque.');
        return false;
      }
      const effectiveDriverId = isCourierRole && profile?.uid ? profile.uid : driverId;
      const res = await apiClient.requestDriverWithdraw(effectiveDriverId, { amount, pixKey }, token);
      if (res?.success) {
        setDrivers(prev =>
          prev.map(d =>
            d.id === effectiveDriverId || d.uid === effectiveDriverId
              ? { ...d, walletBalance: res.walletBalance }
              : d
          )
        );
        if (res.payout) {
          setDriverPayouts(prev => [res.payout, ...prev]);
        }
        logSystemEvent(
          'DRIVER_PAYOUT_REQUESTED',
          `Saque PIX de R$ ${amount.toFixed(2)} solicitado para chave ${pixKey}`,
          'fleet/payouts'
        );
        showNotification(`Solicitação de saque PIX de R$ ${amount.toFixed(2).replace('.', ',')} registrada com sucesso!`);
        return true;
      }
      return false;
    } catch (err: any) {
      showNotification(err?.message || 'Erro ao solicitar saque PIX.');
      return false;
    }
  };

  const toggleStoreDeliveryModality = async (storeId: string, modality: DeliveryFleetModality) => {
    try {
      await adapter.updateStore(storeId, { deliveryModality: modality });
      showNotification(`Modalidade logística alterada para ${modality}`);
      logSystemEvent('STORE_CONFIG_CHANGE', `Modalidade logística alterada para ${modality}`, 'store/config');
    } catch {
      showNotification('Erro ao alterar modalidade.');
    }
  };

  const updateStoreOwnFee = async (storeId: string, fee: number) => {
    try {
      await adapter.updateStore(storeId, { ownFleetCustomFee: fee, deliveryFee: fee });
      showNotification(`Taxa de entrega atualizada.`);
    } catch {
      showNotification('Erro ao atualizar taxa.');
    }
  };

  return {
    drivers,
    currentDriverId,
    setCurrentDriverId,
    driverPayouts,
    fetchDriverPayouts,
    requestDriverWithdraw,
    updateDriverLocation,
    toggleDriverStatus,
    switchDriverOperationMode,
    updateDriverProfile,
    assignOrderDriver,
    acceptDelivery,
    completeDelivery,
    toggleStoreDeliveryModality,
    updateStoreOwnFee
  };
};
