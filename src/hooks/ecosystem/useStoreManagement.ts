import React, { useState, useEffect } from 'react';
import { DatabaseAdapterManager } from '../../services/databaseAdapter';
import {
  MenuItem,
  DiningTable,
  InventoryBatch,
  Supplier,
  Reservation,
  Store,
} from '../../types';
import { useStoreCatalogAndSettings } from './store/useStoreCatalogAndSettings';
import { useStoreTablesAndWaiter } from './store/useStoreTablesAndWaiter';
import { useStoreInventoryAndReservations } from './store/useStoreInventoryAndReservations';

export const useStoreManagement = (
  _user: any,
  profile: any,
  showNotification: (msg: string) => void,
  logSystemEvent: (type: string, payload: string, channel: string, tenantId?: string) => Promise<void>,
  getIdToken: () => Promise<string | undefined>,
  selectedStoreId: string,
  _setSelectedStoreId: (id: string) => void,
  stores: Store[],
  _setStores: React.Dispatch<React.SetStateAction<Store[]>>,
  loading: boolean,
  isAuthenticated: boolean
) => {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [inventoryBatches, setInventoryBatches] = useState<InventoryBatch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const adapter = DatabaseAdapterManager.getAdapter();

  useEffect(() => {
    if (loading) return;
    const unsubs: (() => void)[] = [];

    // Subscribe to public menu items
    unsubs.push(
      adapter.subscribe<MenuItem>('menu_items', (list) => {
        setMenuItems(list);
      })
    );

    const roleUpper = String(profile?.role || '').toUpperCase();
    const isStoreOperationalRole = [
      'DEV_OWNER',
      'SUPER_ADMIN',
      'REGIONAL_MANAGER',
      'STORE_OWNER',
      'STORE_MANAGER',
      'CASHIER',
      'KITCHEN_STAFF',
      'WAITER',
    ].includes(roleUpper);

    if (!isAuthenticated || !isStoreOperationalRole) {
      setTables([]);
      setInventoryBatches([]);
      setSuppliers([]);
      setReservations([]);
      return () => unsubs.forEach((u) => u());
    }

    unsubs.push(
      adapter.subscribe<DiningTable>('tables', (list) => {
        setTables(list);
      })
    );

    const isBackofficeStoreRole = [
      'DEV_OWNER',
      'SUPER_ADMIN',
      'REGIONAL_MANAGER',
      'STORE_OWNER',
      'STORE_MANAGER',
      'CASHIER',
      'KITCHEN_STAFF',
    ].includes(roleUpper);

    if (isBackofficeStoreRole) {
      unsubs.push(
        adapter.subscribe<InventoryBatch>('inventory_batches', (list) => {
          setInventoryBatches(list);
        })
      );

      unsubs.push(
        adapter.subscribe<Supplier>('suppliers', (list) => {
          setSuppliers(list);
        })
      );

      unsubs.push(
        adapter.subscribe<Reservation>('reservations', (list) => {
          setReservations(list);
        })
      );
    } else {
      setInventoryBatches([]);
      setSuppliers([]);
      setReservations([]);
    }

    return () => unsubs.forEach((u) => u());
  }, [loading, isAuthenticated, profile?.role]);

  const resolveActiveTenantId = (targetStoreId?: string) => {
    const storeObj = stores.find((s) => s.id === (targetStoreId || selectedStoreId));
    return storeObj?.tenantId || profile?.tenantId || 'tenant-1';
  };

  const catalogActions = useStoreCatalogAndSettings({
    adapter,
    stores,
    menuItems,
    resolveActiveTenantId,
    showNotification,
    logSystemEvent,
  });

  const tablesAndWaiterActions = useStoreTablesAndWaiter({
    adapter,
    stores,
    selectedStoreId,
    profile,
    setTables,
    resolveActiveTenantId,
    getIdToken,
    showNotification,
  });

  const inventoryAndReservationActions = useStoreInventoryAndReservations({
    adapter,
    selectedStoreId,
    reservations,
    setSuppliers,
    resolveActiveTenantId,
    showNotification,
  });

  return {
    menuItems,
    tables,
    inventoryBatches,
    suppliers,
    reservations,
    ...catalogActions,
    ...tablesAndWaiterActions,
    ...inventoryAndReservationActions,
  };
};
