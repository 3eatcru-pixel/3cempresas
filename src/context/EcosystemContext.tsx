import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { MainSectionId, MenuItem, Order, Store } from '../types';
import { EMPTY_STORE_PLACEHOLDER } from '../constants/platformDefaults';
import { DEV_CONSOLE_ENDPOINTS } from '../modules/server-core/layout/serverPayloads';
import { useSystem } from '../hooks/ecosystem/useSystem';
import { useLogistics } from '../hooks/ecosystem/useLogistics';
import { useCommerce } from '../hooks/ecosystem/useCommerce';
import { useStoreManagement } from '../hooks/ecosystem/useStoreManagement';
import { useFinance } from '../hooks/ecosystem/useFinance';
import { useCRM } from '../hooks/ecosystem/useCRM';
import { useAdmin } from '../hooks/ecosystem/useAdmin';
import { EcosystemContextType } from './ecosystemTypes';
import { useEcosystemSyncListeners } from './useEcosystemSyncListeners';

const EcosystemContext = createContext<EcosystemContextType | undefined>(undefined);

export const EcosystemProvider: React.FC<{
  children: React.ReactNode;
  initialSection?: MainSectionId;
  lockedSection?: boolean;
}> = ({ children, initialSection, lockedSection }) => {
  const { user, profile, getIdToken, loading, isAuthenticated } = useAuth();

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('store-1');
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<
    { menuItem: MenuItem; quantity: number; notes?: string; variantId?: string; variantLabel?: string }[]
  >([]);
  const [dataStatus, setDataStatus] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [dataError, setDataError] = useState<string | null>(null);

  const system = useSystem(user, profile, loading, isAuthenticated, { initialSection, lockedSection });
  const wrappedGetIdToken = useCallback(async () => (await getIdToken()) || undefined, [getIdToken]);

  const logistics = useLogistics(
    user,
    profile,
    system.showNotification,
    system.logSystemEvent,
    wrappedGetIdToken,
    orders,
    loading,
    isAuthenticated,
    selectedStoreId,
    stores
  );
  const storeMgmt = useStoreManagement(
    user,
    profile,
    system.showNotification,
    system.logSystemEvent,
    wrappedGetIdToken,
    selectedStoreId,
    setSelectedStoreId,
    stores,
    setStores,
    loading,
    isAuthenticated
  );

  const finance = useFinance(
    user,
    profile,
    system.showNotification,
    system.logSystemEvent,
    selectedStoreId,
    loading,
    isAuthenticated,
    stores
  );
  const crm = useCRM(
    user,
    profile,
    system.showNotification,
    loading,
    isAuthenticated,
    selectedStoreId,
    stores
  );

  const cartTotal = useMemo(
    () => cart.reduce((acc, i) => acc + i.menuItem.price * i.quantity, 0),
    [cart]
  );
  const currentStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId) || stores[0] || EMPTY_STORE_PLACEHOLDER,
    [stores, selectedStoreId]
  );
  const admin = useAdmin(
    user,
    profile,
    system.showNotification,
    system.logSystemEvent,
    wrappedGetIdToken,
    stores,
    setStores,
    setOrders,
    setCart as any,
    crm.setCustomersCrm,
    finance.setFinancialRecords,
    finance.setCashSession,
    loading,
    isAuthenticated
  );
  const commerce = useCommerce(
    currentStore,
    admin.coupons,
    cartTotal,
    cart,
    setCart,
    system.showNotification,
    system.logSystemEvent,
    wrappedGetIdToken,
    orders,
    stores
  );

  useEcosystemSyncListeners({
    loading,
    isAuthenticated,
    profile,
    selectedStoreId,
    setSelectedStoreId,
    setStores,
    setOrders,
    setDataStatus,
    setDataError,
  });

  const toggleModality = useCallback(
    (k: any) => commerce.setModalities((prev: any) => ({ ...prev, [k]: !prev[k] })),
    [commerce.setModalities]
  );

  const contextValue = useMemo(
    () => ({
      ...system,
      ...logistics,
      ...storeMgmt,
      ...commerce,
      ...finance,
      ...crm,
      ...admin,
      dataStatus,
      dataError,
      stores,
      setStores,
      selectedStoreId,
      setSelectedStoreId,
      currentStore,
      orders,
      cart,
      cartTotal,
      setCustomersCrm: crm.setCustomersCrm,
      setFinancialRecords: finance.setFinancialRecords,
      setCashSession: finance.setCashSession,
      restEndpoints: DEV_CONSOLE_ENDPOINTS,
      serviceOrders: [],
      toggleModality,
    }),
    [
      system,
      logistics,
      storeMgmt,
      commerce,
      finance,
      crm,
      admin,
      dataStatus,
      dataError,
      stores,
      selectedStoreId,
      currentStore,
      orders,
      cart,
      cartTotal,
      toggleModality,
    ]
  );

  return (
    <EcosystemContext.Provider value={contextValue as any}>{children}</EcosystemContext.Provider>
  );
};

export const useOptionalEcosystem = () => {
  return useContext(EcosystemContext);
};

export const useEcosystem = () => {
  const ctx = useContext(EcosystemContext);
  if (!ctx) throw new Error('useEcosystem must be used within an EcosystemProvider');
  return ctx;
};
