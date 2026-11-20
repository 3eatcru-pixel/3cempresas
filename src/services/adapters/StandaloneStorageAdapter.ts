import {
  Store,
  MenuItem,
  Order,
  CustomerCRM,
  FinancialRecord,
  InventoryBatch,
  DeviceLicense,
  Driver,
  DiningTable,
  Supplier,
  Reservation,
  CouponCampaign,
  SystemIntegration,
  PlatformGovernance,
  CashRegisterSession,
  OrderStatus,
  TableStatus,
} from '../../types';
import { DEFAULT_PLATFORM_GOVERNANCE } from '../../constants/platformDefaults';
import {
  CollectionFilter,
  StorageAdapter,
  SubscriptionCallback,
  UnsubscribeFn,
} from './StorageAdapterTypes';
import { StandaloneLocalStoreEngine } from './standaloneLocalStoreEngine';

/**
 * Standalone Local Storage Adapter
 * Provê persistência multitenant resiliente em memória / localStorage com barramento de eventos pub/sub
 * Operação 100% autônoma e local, sem credenciais externas nem internet.
 */
export class StandaloneStorageAdapter implements StorageAdapter {
  id = 'standalone-local';
  name = '3C Corp Local Autonomous Engine';
  type = 'STANDALONE_LOCAL' as const;

  private readonly engine = new StandaloneLocalStoreEngine();

  private get cache() {
    return this.engine.cache;
  }

  private persistCollection(collectionName: string) {
    this.engine.persistCollection(collectionName);
  }

  private notifySubscribers(collectionName: string) {
    this.engine.notifySubscribers(collectionName);
  }

  subscribe<T = any>(
    collectionName: string,
    callback: SubscriptionCallback<T>,
    filter?: CollectionFilter
  ): UnsubscribeFn {
    return this.engine.subscribe(collectionName, callback, filter);
  }

  async getStores(tenantId?: string): Promise<Store[]> {
    const map = this.cache.get('stores') || new Map();
    const stores = (Array.from(map.values()) as Store[]).filter((s: any) => s && !s._deleted);
    return tenantId ? stores.filter((s) => s.tenantId === tenantId) : stores;
  }

  async getStoreById(id: string): Promise<Store | null> {
    const map = this.cache.get('stores');
    const item = map?.get(id);
    return item && !(item as any)._deleted ? item : null;
  }

  async saveStore(store: Store): Promise<void> {
    const map = this.cache.get('stores') || new Map();
    map.set(store.id, { ...store });
    this.cache.set('stores', map);
    this.persistCollection('stores');
    this.notifySubscribers('stores');
  }

  async updateStore(id: string, updates: Partial<Store>): Promise<void> {
    const map = this.cache.get('stores');
    const existing = map?.get(id);
    if (existing) {
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      map!.set(id, updated);
      this.persistCollection('stores');
      this.notifySubscribers('stores');
    }
  }

  async getMenuItems(storeId?: string, tenantId?: string): Promise<MenuItem[]> {
    const map = this.cache.get('menu_items') || new Map();
    let items = (Array.from(map.values()) as MenuItem[]).filter((i: any) => i && !i._deleted);
    if (storeId) items = items.filter((i) => i.storeId === storeId);
    if (tenantId) items = items.filter((i) => i.tenantId === tenantId);
    return items;
  }

  async saveMenuItem(item: MenuItem): Promise<void> {
    const map = this.cache.get('menu_items') || new Map();
    map.set(item.id, { ...item });
    this.cache.set('menu_items', map);
    this.persistCollection('menu_items');
    this.notifySubscribers('menu_items');
  }

  async deleteMenuItem(id: string): Promise<void> {
    const map = this.cache.get('menu_items');
    if (map) {
      map.delete(id);
      this.persistCollection('menu_items');
      this.notifySubscribers('menu_items');
    }
  }

  async updateMenuItem(id: string, updates: Partial<MenuItem>): Promise<void> {
    const map = this.cache.get('menu_items');
    const existing = map?.get(id);
    if (existing) {
      map!.set(id, { ...existing, ...updates, updatedAt: new Date().toISOString() });
      this.persistCollection('menu_items');
      this.notifySubscribers('menu_items');
    }
  }

  async getOrders(storeId?: string, tenantId?: string): Promise<Order[]> {
    const map = this.cache.get('orders') || new Map();
    let orders = (Array.from(map.values()) as Order[]).filter((o: any) => o && !o._deleted);
    if (storeId) orders = orders.filter((o) => o.storeId === storeId);
    if (tenantId) orders = orders.filter((o) => o.tenantId === tenantId);
    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getOrderById(id: string): Promise<Order | null> {
    const map = this.cache.get('orders');
    const item = map?.get(id);
    return item && !(item as any)._deleted ? item : null;
  }

  async createOrder(order: Partial<Order>): Promise<Order> {
    const map = this.cache.get('orders') || new Map();
    const id = order.id || `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const code = order.code || `#${Math.floor(1000 + Math.random() * 9000)}`;
    const completeOrder: Order = {
      id,
      code,
      storeId: order.storeId || 'store-1',
      tenantId: order.tenantId || 'tenant-1',
      channel: order.channel || 'MARKETPLACE',
      customerName: order.customerName || 'Cliente',
      items: order.items || [],
      subtotal: order.subtotal || 0,
      total: order.total || 0,
      paymentMethod: order.paymentMethod || 'PIX',
      status: order.status || 'PENDING',
      createdAt: order.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...order,
    } as Order;

    map.set(id, completeOrder);
    this.cache.set('orders', map);
    this.persistCollection('orders');
    this.notifySubscribers('orders');
    return completeOrder;
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    extra?: { cancelReason?: string; driverId?: string; driverName?: string }
  ): Promise<void> {
    const map = this.cache.get('orders');
    const order = map?.get(orderId);
    if (order) {
      order.status = status;
      order.updatedAt = new Date().toISOString();
      if (extra?.cancelReason) order.cancelReason = extra.cancelReason;
      if (extra?.driverId) order.driverId = extra.driverId;
      if (extra?.driverName) order.driverName = extra.driverName;
      this.persistCollection('orders');
      this.notifySubscribers('orders');
    }
  }

  async getTables(storeId?: string): Promise<DiningTable[]> {
    const map = this.cache.get('tables') || new Map();
    const tables = (Array.from(map.values()) as DiningTable[]).filter((t: any) => t && !t._deleted);
    return storeId ? tables.filter((t) => t.storeId === storeId) : tables;
  }

  async saveTable(table: DiningTable): Promise<void> {
    const map = this.cache.get('tables') || new Map();
    const id = table.id || `tbl-${Date.now()}`;
    map.set(id, { ...table, id });
    this.cache.set('tables', map);
    this.persistCollection('tables');
    this.notifySubscribers('tables');
  }

  async deleteTable(tableId: string): Promise<void> {
    const map = this.cache.get('tables');
    if (map) {
      map.delete(tableId);
      this.persistCollection('tables');
      this.notifySubscribers('tables');
    }
  }

  async updateTableStatus(tableId: string, status: TableStatus): Promise<void> {
    const map = this.cache.get('tables');
    const table = map?.get(tableId);
    if (table) {
      table.status = status;
      this.persistCollection('tables');
      this.notifySubscribers('tables');
    }
  }

  async getInventoryBatches(storeId?: string, tenantId?: string): Promise<InventoryBatch[]> {
    const map = this.cache.get('inventory_batches') || new Map();
    let batches = (Array.from(map.values()) as InventoryBatch[]).filter((b: any) => b && !b._deleted);
    if (storeId) batches = batches.filter((b) => b.storeId === storeId);
    if (tenantId) batches = batches.filter((b) => b.tenantId === tenantId);
    return batches;
  }

  async saveInventoryBatch(batch: InventoryBatch): Promise<void> {
    const map = this.cache.get('inventory_batches') || new Map();
    const id = batch.id || `batch-${Date.now()}`;
    map.set(id, { ...batch, id });
    this.cache.set('inventory_batches', map);
    this.persistCollection('inventory_batches');
    this.notifySubscribers('inventory_batches');
  }

  async getCustomers(storeId?: string, tenantId?: string): Promise<CustomerCRM[]> {
    const map = this.cache.get('customers_crm') || new Map();
    let custs = (Array.from(map.values()) as CustomerCRM[]).filter((c: any) => c && !c._deleted);
    if (storeId) custs = custs.filter((c) => c.storeId === storeId);
    if (tenantId) custs = custs.filter((c) => c.tenantId === tenantId);
    return custs;
  }

  async saveCustomer(customer: CustomerCRM): Promise<void> {
    const map = this.cache.get('customers_crm') || new Map();
    const id = customer.id || `cust-${Date.now()}`;
    map.set(id, { ...customer, id });
    this.cache.set('customers_crm', map);
    this.persistCollection('customers_crm');
    this.notifySubscribers('customers_crm');
  }

  async updateCustomer(id: string, updates: Partial<CustomerCRM>): Promise<void> {
    const map = this.cache.get('customers_crm');
    const cust = map?.get(id);
    if (cust) {
      map!.set(id, { ...cust, ...updates });
      this.persistCollection('customers_crm');
      this.notifySubscribers('customers_crm');
    }
  }

  async getFinancialRecords(storeId?: string, tenantId?: string): Promise<FinancialRecord[]> {
    const map = this.cache.get('financial_records') || new Map();
    let records = (Array.from(map.values()) as FinancialRecord[]).filter((r: any) => r && !r._deleted);
    if (storeId) records = records.filter((r) => r.storeId === storeId);
    if (tenantId) records = records.filter((r) => r.tenantId === tenantId);
    return records;
  }

  async saveFinancialRecord(record: FinancialRecord): Promise<void> {
    const map = this.cache.get('financial_records') || new Map();
    const id = record.id || `fin-${Date.now()}`;
    map.set(id, { ...record, id });
    this.cache.set('financial_records', map);
    this.persistCollection('financial_records');
    this.notifySubscribers('financial_records');
  }

  async getCashSession(storeId: string): Promise<CashRegisterSession | null> {
    const map = this.cache.get('cash_sessions');
    if (!map) return null;
    const sessions = (Array.from(map.values()) as CashRegisterSession[]).filter(
      (s: any) => s && !s._deleted
    );
    return sessions.find((s) => s.storeId === storeId && s.status === 'OPEN') || null;
  }

  async saveCashSession(session: CashRegisterSession): Promise<void> {
    const map = this.cache.get('cash_sessions') || new Map();
    map.set(session.id, { ...session });
    this.cache.set('cash_sessions', map);
    this.persistCollection('cash_sessions');
    this.notifySubscribers('cash_sessions');
  }

  async getDrivers(tenantId?: string, storeId?: string): Promise<Driver[]> {
    const map = this.cache.get('drivers') || new Map();
    let drivers = (Array.from(map.values()) as Driver[]).filter((d: any) => d && !d._deleted);
    if (tenantId) drivers = drivers.filter((d) => d.tenantId === tenantId);
    if (storeId) {
      drivers = drivers.filter((d) => d.storeId === storeId || d.fleetType === 'PLATFORM_FLEET');
    }
    return drivers;
  }

  async saveDriver(driver: Driver): Promise<void> {
    const map = this.cache.get('drivers') || new Map();
    map.set(driver.id, { ...driver });
    this.cache.set('drivers', map);
    this.persistCollection('drivers');
    this.notifySubscribers('drivers');
  }

  async updateDriver(id: string, updates: Partial<Driver>): Promise<void> {
    const map = this.cache.get('drivers');
    const drv = map?.get(id);
    if (drv) {
      map!.set(id, { ...drv, ...updates });
      this.persistCollection('drivers');
      this.notifySubscribers('drivers');
    }
  }

  async getGovernance(): Promise<PlatformGovernance> {
    const map = this.cache.get('governance');
    return map?.get('governance') || DEFAULT_PLATFORM_GOVERNANCE;
  }

  async saveGovernance(gov: Partial<PlatformGovernance>): Promise<void> {
    const map = this.cache.get('governance') || new Map();
    const curr = map.get('governance') || DEFAULT_PLATFORM_GOVERNANCE;
    const merged = { ...curr, ...gov };
    map.set('governance', merged);
    this.cache.set('governance', map);
    this.persistCollection('governance');
    this.notifySubscribers('governance');
  }

  async getDeviceLicenses(storeId?: string, tenantId?: string): Promise<DeviceLicense[]> {
    const map = this.cache.get('device_licenses') || new Map();
    let devs = (Array.from(map.values()) as DeviceLicense[]).filter((d: any) => d && !d._deleted);
    if (storeId) devs = devs.filter((d) => d.storeId === storeId);
    if (tenantId) devs = devs.filter((d) => d.tenantId === tenantId);
    return devs;
  }

  async saveDeviceLicense(license: DeviceLicense): Promise<void> {
    const map = this.cache.get('device_licenses') || new Map();
    map.set(license.id, { ...license });
    this.cache.set('device_licenses', map);
    this.persistCollection('device_licenses');
    this.notifySubscribers('device_licenses');
  }

  async deleteDeviceLicense(id: string): Promise<void> {
    const map = this.cache.get('device_licenses');
    if (map) {
      map.delete(id);
      this.persistCollection('device_licenses');
      this.notifySubscribers('device_licenses');
    }
  }

  async getCoupons(storeId?: string): Promise<CouponCampaign[]> {
    const map = this.cache.get('coupons') || new Map();
    const coupons = (Array.from(map.values()) as CouponCampaign[]).filter(
      (c: any) => c && !c._deleted
    );
    return storeId
      ? coupons.filter((c) => c.audience !== 'MERCHANT' && (!c.storeId || c.storeId === storeId))
      : coupons;
  }

  async saveCoupon(coupon: CouponCampaign): Promise<void> {
    const map = this.cache.get('coupons') || new Map();
    map.set(coupon.id, { ...coupon });
    this.cache.set('coupons', map);
    this.persistCollection('coupons');
    this.notifySubscribers('coupons');
  }

  async getIntegrations(tenantId?: string): Promise<SystemIntegration[]> {
    const map = this.cache.get('integrations') || new Map();
    let items = (Array.from(map.values()) as SystemIntegration[]).filter(
      (i: any) => i && !i._deleted
    );
    if (tenantId) items = items.filter((i) => !i.tenantId || i.tenantId === tenantId);
    return items;
  }

  async saveIntegration(
    integration: SystemIntegration & { apiKey?: string; token?: string }
  ): Promise<any> {
    const map = this.cache.get('integrations') || new Map();
    const rawSecret = integration.apiKey || integration.token || '';
    const { apiKey: _k, token: _t, ...rest } = integration;
    const sanitized: SystemIntegration = {
      ...rest,
      apiKeyMasked: rawSecret
        ? `${rawSecret.slice(0, 4)}••••••••`
        : rest.apiKeyMasked || 'NÃO CONFIGURADO',
    };
    map.set(sanitized.id, sanitized);
    this.cache.set('integrations', map);
    this.persistCollection('integrations');
    this.notifySubscribers('integrations');
    return { success: true, integration: sanitized };
  }

  async deleteIntegration(id: string): Promise<void> {
    const map = this.cache.get('integrations');
    if (map) {
      map.delete(id);
      this.persistCollection('integrations');
      this.notifySubscribers('integrations');
    }
  }

  async getSuppliers(tenantId?: string): Promise<Supplier[]> {
    const map = this.cache.get('suppliers') || new Map();
    const suppliers = (Array.from(map.values()) as Supplier[]).filter((s: any) => s && !s._deleted);
    return tenantId ? suppliers.filter((s) => s.tenantId === tenantId) : suppliers;
  }

  async saveSupplier(supplier: Supplier): Promise<void> {
    const map = this.cache.get('suppliers') || new Map();
    map.set(supplier.id, { ...supplier });
    this.cache.set('suppliers', map);
    this.persistCollection('suppliers');
    this.notifySubscribers('suppliers');
  }

  async deleteSupplier(id: string): Promise<void> {
    const map = this.cache.get('suppliers');
    if (map) {
      map.delete(id);
      this.persistCollection('suppliers');
      this.notifySubscribers('suppliers');
    }
  }

  async getReservations(storeId?: string): Promise<Reservation[]> {
    const map = this.cache.get('reservations') || new Map();
    const res = (Array.from(map.values()) as Reservation[]).filter((r: any) => r && !r._deleted);
    return storeId ? res.filter((r) => r.storeId === storeId) : res;
  }

  async saveReservation(res: Reservation): Promise<void> {
    const map = this.cache.get('reservations') || new Map();
    map.set(res.id, { ...res });
    this.cache.set('reservations', map);
    this.persistCollection('reservations');
    this.notifySubscribers('reservations');
  }

  async deleteReservation(id: string): Promise<void> {
    const map = this.cache.get('reservations');
    if (map) {
      map.delete(id);
      this.persistCollection('reservations');
      this.notifySubscribers('reservations');
    }
  }

  async getDocument<T = any>(collection: string, docId: string): Promise<T | null> {
    const collMap = this.cache.get(collection);
    const item = collMap?.get(docId);
    return item && !(item as any)._deleted ? item : null;
  }

  async setDocument<T = any>(
    collection: string,
    docId: string,
    data: T,
    merge = true
  ): Promise<void> {
    let collMap = this.cache.get(collection);
    if (!collMap) {
      collMap = new Map();
      this.cache.set(collection, collMap);
    }
    const existing = collMap.get(docId) || {};
    const finalData = merge ? { ...existing, ...data, id: docId } : { ...data, id: docId };
    collMap.set(docId, finalData);
    this.persistCollection(collection);
    this.notifySubscribers(collection);
  }

  async deleteDocument(collection: string, docId: string): Promise<void> {
    const collMap = this.cache.get(collection);
    if (collMap) {
      collMap.delete(docId);
      this.persistCollection(collection);
      this.notifySubscribers(collection);
    }
  }

  async queryDocuments<T = any>(collection: string, filter?: CollectionFilter): Promise<T[]> {
    const targetCollection =
      collection === 'store_staff'
        ? 'users'
        : collection === 'store_devices'
        ? 'device_licenses'
        : collection;
    const collMap = this.cache.get(targetCollection);
    if (!collMap) return [];
    let items = Array.from(collMap.values()).filter((item: any) => item && !item._deleted) as any[];
    if (collection === 'store_staff') {
      items = items.filter(
        (u) =>
          !['CUSTOMER', 'CONSUMER', 'COURIER', 'DRIVER', 'DEV_OWNER', 'SUPER_ADMIN'].includes(
            String(u.role || '').toUpperCase()
          )
      );
    }
    if (!filter) return items as T[];
    return items.filter((item: any) => {
      for (const [key, val] of Object.entries(filter)) {
        if (val !== undefined && item[key] !== val) return false;
      }
      return true;
    }) as T[];
  }

  resetToSeeds() {
    this.engine.resetToSeeds();
  }
}
