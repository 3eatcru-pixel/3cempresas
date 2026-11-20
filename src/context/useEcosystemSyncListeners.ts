import React, { useEffect, useRef } from 'react';
import { DatabaseAdapterManager } from '../services/databaseAdapter';
import { Order, Store } from '../types';
import { UserProfile } from './authTypes';

interface UseEcosystemSyncListenersParams {
  loading: boolean;
  isAuthenticated: boolean;
  profile: UserProfile | null;
  selectedStoreId: string;
  setSelectedStoreId: (id: string) => void;
  setStores: React.Dispatch<React.SetStateAction<Store[]>>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setDataStatus: React.Dispatch<React.SetStateAction<'LOADING' | 'READY' | 'ERROR'>>;
  setDataError: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useEcosystemSyncListeners(params: UseEcosystemSyncListenersParams): void {
  const {
    loading,
    isAuthenticated,
    profile,
    selectedStoreId,
    setSelectedStoreId,
    setStores,
    setOrders,
    setDataStatus,
    setDataError,
  } = params;

  const adapter = DatabaseAdapterManager.getAdapter();

  useEffect(() => {
    if (loading || !isAuthenticated || !profile) return;
    const isPlatformAdmin = ['DEV_OWNER', 'SUPER_ADMIN'].includes(profile.role || '');
    if (isPlatformAdmin) return;
    if (profile.storeId) {
      const allowed = new Set([
        profile.storeId,
        ...(Array.isArray(profile.allowedStoreIds) ? profile.allowedStoreIds : []),
      ]);
      if (!allowed.has(selectedStoreId)) {
        setSelectedStoreId(profile.storeId);
      }
    }
  }, [profile?.storeId, profile?.allowedStoreIds, profile?.role, loading, isAuthenticated, selectedStoreId, setSelectedStoreId]);

  const selectedStoreIdRef = useRef(selectedStoreId);
  selectedStoreIdRef.current = selectedStoreId;

  useEffect(() => {
    if (loading) return;
    try {
      const unsub = adapter.subscribe<Store>('stores', (list) => {
        setStores(list);
        if (list.length > 0) {
          const currentSelectedId = selectedStoreIdRef.current;
          const isPlatformAdmin = ['DEV_OWNER', 'SUPER_ADMIN'].includes(profile?.role || '');
          const allowedSet =
            !isPlatformAdmin && (profile?.storeId || profile?.allowedStoreIds)
              ? new Set([profile?.storeId, ...(profile?.allowedStoreIds || [])].filter(Boolean) as string[])
              : null;

          if (allowedSet && !allowedSet.has(currentSelectedId)) {
            const fallback = list.find((s) => allowedSet.has(s.id)) || list[0];
            setSelectedStoreId(fallback.id);
          } else if (!list.some((s) => s.id === currentSelectedId)) {
            setSelectedStoreId(list[0].id);
          }
        }
        setDataStatus('READY');
      });
      return () => unsub();
    } catch (err: any) {
      setDataStatus('ERROR');
      setDataError(err.message || 'Falha na conexão com o Adaptador de Dados.');
    }
  }, [loading, profile?.storeId, profile?.allowedStoreIds, profile?.role, adapter, setStores, setSelectedStoreId, setDataStatus, setDataError]);

  useEffect(() => {
    if (loading || !isAuthenticated) {
      if (!loading && !isAuthenticated) {
        setOrders([]);
      }
      return;
    }
    const roleUpper = String(profile?.role || '').toUpperCase();
    const isDev = roleUpper === 'DEV_OWNER';
    const isConsumer = roleUpper === 'CUSTOMER' || roleUpper === 'CONSUMER';
    const tId = profile?.tenantId;

    const filter = isDev || isConsumer ? undefined : tId ? { tenantId: tId } : undefined;
    try {
      const unsub = adapter.subscribe<Order>(
        'orders',
        (list) => {
          setOrders(list);
        },
        filter
      );
      return () => unsub();
    } catch (err: any) {
      console.warn('Order subscription notice:', err);
    }
  }, [profile?.role, profile?.tenantId, profile?.uid, loading, isAuthenticated, adapter, setOrders]);
}
