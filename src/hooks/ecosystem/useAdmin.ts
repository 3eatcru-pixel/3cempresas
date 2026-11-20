import React, { useState, useEffect } from 'react';
import { DatabaseAdapterManager } from '../../services/databaseAdapter';
import {
  PlatformGovernance,
  Store,
  DeviceLicense,
  SystemIntegration,
  CouponCampaign,
} from '../../types';
import { DEFAULT_PLATFORM_GOVERNANCE } from '../../constants/platformDefaults';
import { apiClient } from '../../core/api/apiClient';
import { useAdminUsers } from './admin/useAdminUsers';
import { useAdminSubscriptions } from './admin/useAdminSubscriptions';
import { useAdminDevices } from './admin/useAdminDevices';
import { useAdminGovernanceIntegrations } from './admin/useAdminGovernanceIntegrations';

export const useAdmin = (
  user: any,
  profile: any,
  showNotification: (msg: string) => void,
  logSystemEvent: (
    type: string,
    payload: string,
    channel: string,
    tenantId?: string
  ) => Promise<void>,
  getIdToken: () => Promise<string | undefined>,
  stores: Store[],
  setStores: React.Dispatch<React.SetStateAction<Store[]>>,
  setOrders: React.Dispatch<React.SetStateAction<any[]>>,
  setCart: React.Dispatch<React.SetStateAction<any[]>>,
  setCustomersCrm: React.Dispatch<React.SetStateAction<any[]>>,
  setFinancialRecords: React.Dispatch<React.SetStateAction<any[]>>,
  setCashSession: React.Dispatch<React.SetStateAction<any>>,
  loading: boolean,
  isAuthenticated: boolean
) => {
  const [governance, setGovernance] = useState<PlatformGovernance>(DEFAULT_PLATFORM_GOVERNANCE);
  const [users, setUsers] = useState<any[]>([]);
  const [deviceLicenses, setDeviceLicenses] = useState<DeviceLicense[]>([]);
  const [integrations, setIntegrations] = useState<SystemIntegration[]>([]);
  const [coupons, setCoupons] = useState<CouponCampaign[]>([]);

  const adapter = DatabaseAdapterManager.getAdapter();

  const isHqRole = profile?.role === 'DEV_OWNER' || profile?.role === 'SUPER_ADMIN';
  const isStoreManagerialRole =
    profile?.role === 'STORE_OWNER' ||
    profile?.role === 'REGIONAL_MANAGER' ||
    profile?.role === 'STORE_MANAGER';

  useEffect(() => {
    if (loading) return;
    const unsubs: (() => void)[] = [];

    unsubs.push(
      adapter.subscribe<CouponCampaign>('coupons', cps => {
        setCoupons(cps);
      })
    );

    if (!isAuthenticated) {
      setUsers([]);
      setDeviceLicenses([]);
      setIntegrations([]);
      return () => unsubs.forEach(u => u());
    }

    if (isHqRole) {
      unsubs.push(
        adapter.subscribe<any>('users', userList => {
          setUsers(userList);
        })
      );
      unsubs.push(
        adapter.subscribe<DeviceLicense>('device_licenses', licenses => {
          setDeviceLicenses(licenses);
        })
      );
      unsubs.push(
        adapter.subscribe<SystemIntegration>('integrations', integs => {
          setIntegrations(integs);
        })
      );
      unsubs.push(
        adapter.subscribe<PlatformGovernance>('governance', govs => {
          if (govs && govs.length > 0) {
            setGovernance(govs[0]);
          }
        })
      );
    } else if (isStoreManagerialRole) {
      unsubs.push(
        adapter.subscribe<any>('store_staff', staffList => {
          setUsers(staffList);
        })
      );
      unsubs.push(
        adapter.subscribe<DeviceLicense>('store_devices', licenses => {
          setDeviceLicenses(licenses);
        })
      );
      setIntegrations([]);
    } else {
      setUsers([]);
      setDeviceLicenses([]);
      setIntegrations([]);
    }

    return () => unsubs.forEach(u => u());
  }, [loading, isAuthenticated, profile?.role, isHqRole, isStoreManagerialRole]);

  const syncHqData = async () => {
    try {
      const [health, freshStores, freshCoupons] = await Promise.all([
        apiClient.getHealth().catch(() => null),
        adapter.getStores().catch(() => null),
        adapter.getCoupons().catch(() => null),
      ]);
      if (Array.isArray(freshStores)) setStores(freshStores);
      if (Array.isArray(freshCoupons)) setCoupons(freshCoupons);

      if (isHqRole) {
        const [freshDevices, freshIntegrations, freshUsers] = await Promise.all([
          adapter.getDeviceLicenses().catch(() => null),
          adapter.getIntegrations().catch(() => null),
          adapter.queryDocuments<any>('users').catch(() => null),
        ]);
        if (Array.isArray(freshDevices)) setDeviceLicenses(freshDevices);
        if (Array.isArray(freshIntegrations)) setIntegrations(freshIntegrations);
        if (Array.isArray(freshUsers)) setUsers(freshUsers);
      } else if (isStoreManagerialRole) {
        const [freshStaff, freshDevices] = await Promise.all([
          adapter.queryDocuments<any>('store_staff').catch(() => null),
          adapter.queryDocuments<DeviceLicense>('store_devices').catch(() => null),
        ]);
        if (Array.isArray(freshStaff)) setUsers(freshStaff);
        if (Array.isArray(freshDevices)) setDeviceLicenses(freshDevices);
      }
      const driver = health?.persistenceDriver || 'json-memory';
      showNotification(
        `Cluster sincronizado (${driver}) — ${Array.isArray(freshStores) ? freshStores.length : stores.length} loja(s) ativas.`
      );
    } catch {
      showNotification('Falha ao sincronizar metadados do cluster.');
    }
  };

  const userActions = useAdminUsers({
    adapter,
    isHqRole,
    profile,
    stores,
    setUsers,
    getIdToken,
    showNotification,
    logSystemEvent,
  });

  const subscriptionActions = useAdminSubscriptions({
    adapter,
    isHqRole,
    profile,
    governance,
    stores,
    setStores,
    getIdToken,
    showNotification,
    logSystemEvent,
  });

  const deviceActions = useAdminDevices({
    adapter,
    isHqRole,
    profile,
    stores,
    setDeviceLicenses,
    getIdToken,
    showNotification,
    logSystemEvent,
  });

  const governanceActions = useAdminGovernanceIntegrations({
    adapter,
    governance,
    setGovernance,
    integrations,
    setIntegrations,
    coupons,
    setCoupons,
    setOrders,
    setCart,
    setCustomersCrm,
    setFinancialRecords,
    setCashSession,
    syncHqData,
    getIdToken,
    showNotification,
    logSystemEvent,
  });

  return {
    governance,
    users,
    adminUsers: users,
    deviceLicenses,
    integrations,
    coupons,
    syncHqData,
    ...subscriptionActions,
    ...userActions,
    ...deviceActions,
    ...governanceActions,
  };
};
