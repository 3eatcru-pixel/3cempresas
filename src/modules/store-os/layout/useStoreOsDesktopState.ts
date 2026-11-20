import { useState, useEffect, useMemo } from 'react';
import { STORE_OS_WALLPAPERS, StoreOsWallpaperId } from '@3c/design-system';
import { Store, Order, MenuItem, UserRole } from '../../../types';
import { getTenantStores, isItemService } from '../../../utils/storeDomain';

export interface StoreOsNotification {
  id: string;
  msg: string;
  time: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
}

export function useStoreOsDesktopState({
  currentStore,
  stores,
  orders,
  menuItems,
  profile,
}: {
  currentStore: Store;
  stores: Store[];
  orders: Order[];
  menuItems: MenuItem[];
  profile?: {
    role?: string;
    storeId?: string;
    allowedStoreIds?: string[];
  } | null;
}) {
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNotificationTrayOpen, setIsNotificationTrayOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [notifications, setNotifications] = useState<StoreOsNotification[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  const [desktopTheme, setDesktopTheme] = useState<StoreOsWallpaperId>(() => {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('3c_store_os_theme') : null;
      if (saved && saved in STORE_OS_WALLPAPERS) return saved as StoreOsWallpaperId;
    } catch {
      // ignore storage failure
    }
    return 'neon-dark';
  });

  const handleChangeDesktopTheme = (theme: StoreOsWallpaperId) => {
    setDesktopTheme(theme);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('3c_store_os_theme', theme);
      }
    } catch {
      // ignore storage failure
    }
  };

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);

    const handleGlobalKeys = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleGlobalKeys);
    };
  }, []);

  useEffect(() => {
    setNotifications([
      {
        id: '1',
        msg: `Store OS conectado para ${currentStore.name}.`,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type: 'SUCCESS',
      },
      {
        id: '2',
        msg: 'Sincronização em nuvem e módulos operacionais ativos.',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type: 'INFO',
      },
    ]);
  }, [currentStore.id, currentStore.name]);

  const tenantStores = useMemo(() => getTenantStores(stores, currentStore), [stores, currentStore]);
  const accessibleTenantStores = useMemo(() => {
    if (['DEV_OWNER', 'SUPER_ADMIN'].includes(profile?.role || '') || !profile?.storeId) {
      return tenantStores;
    }
    const allowedSet = new Set([
      profile.storeId,
      ...(Array.isArray(profile.allowedStoreIds) ? profile.allowedStoreIds : []),
    ]);
    return tenantStores.filter((s) => allowedSet.has(s.id));
  }, [tenantStores, profile?.role, profile?.storeId, profile?.allowedStoreIds]);

  const canSwitchBranch =
    ['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER'].includes(profile?.role || '') &&
    (!profile?.storeId ||
      ['DEV_OWNER', 'SUPER_ADMIN'].includes(profile?.role || '') ||
      accessibleTenantStores.length > 1);

  const storeOrders = orders.filter((o) => o.storeId === currentStore.id);
  const kdsPreparationOrdersCount = storeOrders.filter(
    (o) => o.status === 'PENDING' || o.status === 'IN_PREPARATION' || o.status === 'CONFIRMED'
  ).length;
  const lowStockItemsExist = menuItems.some(
    (i) => i.storeId === currentStore.id && !isItemService(i, currentStore) && i.stock <= i.minStockAlert
  );

  const isFreeTrial = currentStore.subscriptionPlan === 'FREE';
  const trialExpires = currentStore.trialExpiresAt ? new Date(currentStore.trialExpiresAt) : null;
  const isTrialExpired = isFreeTrial && trialExpires ? new Date() > trialExpires : false;
  const trialDaysRemaining = trialExpires
    ? Math.max(0, Math.ceil((trialExpires.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 7;

  return {
    isStartMenuOpen,
    setIsStartMenuOpen,
    isQuickSettingsOpen,
    setIsQuickSettingsOpen,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    isNotificationTrayOpen,
    setIsNotificationTrayOpen,
    desktopTheme,
    handleChangeDesktopTheme,
    searchFilter,
    setSearchFilter,
    notifications,
    setNotifications,
    currentTime,
    currentDate,
    accessibleTenantStores,
    canSwitchBranch,
    kdsPreparationOrdersCount,
    lowStockItemsExist,
    isFreeTrial,
    isTrialExpired,
    trialDaysRemaining,
  };
}
