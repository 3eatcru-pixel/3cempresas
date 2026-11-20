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
import { getPlatformAdapters } from '../../core/platform/PlatformAdapter';
import {
  CollectionFilter,
  StorageAdapter,
  SubscriptionCallback,
  UnsubscribeFn,
} from './StorageAdapterTypes';
import { RestSubscriptionCoordinator } from './restSubscriptionCoordinator';

/**
 * Server Core REST Storage Adapter
 * Source of Truth (SoT) — Persistência centralizada no servidor Node.js
 */
export class ServerCoreRESTAdapter implements StorageAdapter {
  id = 'server-core-rest';
  name = '3C Corp Server Core (SoT)';
  type = 'SERVER_CORE_REST' as const;

  private readonly coordinator: RestSubscriptionCoordinator;

  constructor() {
    this.coordinator = new RestSubscriptionCoordinator((collectionName, filter) =>
      this.queryDocuments(collectionName, filter)
    );
  }

  private request(path: string, method = 'GET', body?: any) {
    return this.coordinator.request(path, method, body);
  }

  private invalidateCollection(collectionName: string) {
    this.coordinator.invalidateCollection(collectionName);
  }

  subscribe<T = any>(
    collectionName: string,
    callback: SubscriptionCallback<T>,
    filter?: CollectionFilter
  ): UnsubscribeFn {
    return this.coordinator.subscribe(collectionName, callback, filter);
  }

  async getStores(tenantId?: string): Promise<Store[]> {
    return this.request(`/store/list${tenantId ? `?tenantId=${tenantId}` : ''}`);
  }

  async getStoreById(id: string): Promise<Store | null> {
    try {
      return await this.request(`/store/${id}`);
    } catch {
      return null;
    }
  }

  async saveStore(store: Store): Promise<void> {
    await this.request('/store/save', 'POST', store);
    this.invalidateCollection('stores');
  }

  async updateStore(id: string, updates: Partial<Store>): Promise<void> {
    await this.request(`/store/${id}`, 'PUT', updates);
    this.invalidateCollection('stores');
  }

  async getMenuItems(storeId?: string, tenantId?: string): Promise<MenuItem[]> {
    let query = '';
    if (storeId) query += `storeId=${storeId}`;
    if (tenantId) query += (query ? '&' : '') + `tenantId=${tenantId}`;
    return this.request(`/store/menu?${query}`);
  }

  async saveMenuItem(item: MenuItem): Promise<void> {
    await this.request('/store/menu', 'POST', item);
    this.invalidateCollection('menu_items');
  }

  async deleteMenuItem(id: string): Promise<void> {
    await this.request(`/store/menu/${id}`, 'DELETE');
    this.invalidateCollection('menu_items');
  }

  async updateMenuItem(id: string, updates: Partial<MenuItem>): Promise<void> {
    await this.request(`/store/menu/${id}`, 'PUT', updates);
    this.invalidateCollection('menu_items');
  }

  async getOrders(storeId?: string, tenantId?: string): Promise<Order[]> {
    let query = '';
    if (storeId) query += `storeId=${storeId}`;
    if (tenantId) query += (query ? '&' : '') + `tenantId=${tenantId}`;
    return this.request(`/commerce/orders?${query}`);
  }

  async getOrderById(id: string): Promise<Order | null> {
    try {
      return await this.request(`/commerce/orders/${id}`);
    } catch {
      return null;
    }
  }

  async createOrder(order: Partial<Order>): Promise<Order> {
    const res = await this.request('/commerce/orders', 'POST', order);
    this.invalidateCollection('orders');
    this.invalidateCollection('tables');
    this.invalidateCollection('inventory_batches');
    this.invalidateCollection('financial_records');
    return res;
  }

  async updateOrderStatus(orderId: string, status: OrderStatus, extra?: any): Promise<void> {
    await this.request(`/commerce/orders/${orderId}/status`, 'PUT', { status, ...extra });
    this.invalidateCollection('orders');
    this.invalidateCollection('tables');
  }

  async getTables(storeId?: string): Promise<DiningTable[]> {
    return this.request(`/store/tables${storeId ? `?storeId=${storeId}` : ''}`);
  }

  async saveTable(table: DiningTable): Promise<void> {
    await this.request('/store/tables', 'POST', table);
    this.invalidateCollection('tables');
  }

  async deleteTable(tableId: string): Promise<void> {
    await this.request(`/store/tables/${encodeURIComponent(tableId)}`, 'DELETE');
    this.invalidateCollection('tables');
  }

  async updateTableStatus(tableId: string, status: TableStatus): Promise<void> {
    await this.request(`/store/tables/${tableId}/status`, 'PUT', { status });
    this.invalidateCollection('tables');
  }

  async getInventoryBatches(storeId?: string, tenantId?: string): Promise<InventoryBatch[]> {
    return this.request(`/store/inventory?storeId=${storeId || ''}&tenantId=${tenantId || ''}`);
  }

  async saveInventoryBatch(batch: InventoryBatch): Promise<void> {
    await this.request('/store/inventory', 'POST', batch);
    this.invalidateCollection('inventory_batches');
  }

  async getCustomers(storeId?: string, tenantId?: string): Promise<CustomerCRM[]> {
    return this.request(`/store/customers?storeId=${storeId || ''}&tenantId=${tenantId || ''}`);
  }

  async saveCustomer(customer: CustomerCRM): Promise<void> {
    await this.request('/store/customers', 'POST', customer);
    this.invalidateCollection('customers_crm');
  }

  async updateCustomer(id: string, updates: Partial<CustomerCRM>): Promise<void> {
    await this.request(`/store/customers/${id}`, 'PUT', updates);
    this.invalidateCollection('customers_crm');
  }

  async getFinancialRecords(storeId?: string, tenantId?: string): Promise<FinancialRecord[]> {
    return this.request(`/store/finance?storeId=${storeId || ''}&tenantId=${tenantId || ''}`);
  }

  async saveFinancialRecord(record: FinancialRecord): Promise<void> {
    await this.request('/store/finance', 'POST', record);
    this.invalidateCollection('financial_records');
  }

  async getCashSession(storeId: string): Promise<CashRegisterSession | null> {
    try {
      return await this.request(`/store/cash/session?storeId=${storeId}`);
    } catch {
      return null;
    }
  }

  async saveCashSession(session: CashRegisterSession): Promise<void> {
    await this.request('/store/cash/session', 'POST', session);
    this.invalidateCollection('cash_sessions');
  }

  async getDrivers(tenantId?: string, storeId?: string): Promise<Driver[]> {
    return this.request(`/commerce/drivers?tenantId=${tenantId || ''}&storeId=${storeId || ''}`);
  }

  async saveDriver(driver: Driver): Promise<void> {
    await this.request('/commerce/drivers', 'POST', driver);
    this.invalidateCollection('drivers');
  }

  async updateDriver(id: string, updates: Partial<Driver>): Promise<void> {
    await this.request(`/commerce/drivers/${id}`, 'PUT', updates);
    this.invalidateCollection('drivers');
  }

  async getGovernance(): Promise<PlatformGovernance> {
    return this.request('/admin/governance');
  }

  async saveGovernance(gov: Partial<PlatformGovernance>): Promise<void> {
    await this.request('/admin/governance', 'PUT', gov);
    this.invalidateCollection('governance');
  }

  async getDeviceLicenses(storeId?: string, tenantId?: string): Promise<DeviceLicense[]> {
    return this.request(`/admin/devices?storeId=${storeId || ''}&tenantId=${tenantId || ''}`);
  }

  async saveDeviceLicense(license: DeviceLicense): Promise<any> {
    const res = await this.request('/admin/devices', 'POST', license);
    this.invalidateCollection('device_licenses');
    return res;
  }

  async deleteDeviceLicense(id: string): Promise<void> {
    await this.request(`/admin/devices/${id}`, 'DELETE');
    this.invalidateCollection('device_licenses');
  }

  async getCoupons(storeId?: string): Promise<CouponCampaign[]> {
    const token = getPlatformAdapters().storage.getItem('3ccorp_auth_token');
    const qs = new URLSearchParams();
    if (storeId) qs.set('storeId', storeId);
    if (token && !storeId) qs.set('includeInactive', 'true');
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request(`/commerce/coupons${suffix}`);
  }

  async saveCoupon(coupon: CouponCampaign): Promise<void> {
    await this.request('/commerce/coupons', 'POST', coupon);
    this.invalidateCollection('coupons');
  }

  async getIntegrations(tenantId?: string): Promise<SystemIntegration[]> {
    return this.request(`/admin/integrations${tenantId ? `?tenantId=${tenantId}` : ''}`);
  }

  async saveIntegration(integration: SystemIntegration & { apiKey?: string }): Promise<any> {
    const res = await this.request('/admin/integrations', 'POST', integration);
    this.invalidateCollection('integrations');
    return res;
  }

  async deleteIntegration(id: string): Promise<void> {
    await this.request(`/admin/integrations/${id}`, 'DELETE');
    this.invalidateCollection('integrations');
  }

  async getSuppliers(tenantId?: string): Promise<Supplier[]> {
    return this.request(`/store/suppliers${tenantId ? `?tenantId=${tenantId}` : ''}`);
  }

  async saveSupplier(supplier: Supplier): Promise<void> {
    await this.request('/store/suppliers', 'POST', supplier);
    this.invalidateCollection('suppliers');
  }

  async deleteSupplier(id: string): Promise<void> {
    await this.request(`/store/suppliers/${encodeURIComponent(id)}`, 'DELETE');
    this.invalidateCollection('suppliers');
  }

  async getReservations(storeId?: string): Promise<Reservation[]> {
    return this.request(`/store/reservations${storeId ? `?storeId=${storeId}` : ''}`);
  }

  async saveReservation(res: Reservation): Promise<void> {
    await this.request('/store/reservations', 'POST', res);
    this.invalidateCollection('reservations');
  }

  async deleteReservation(id: string): Promise<void> {
    await this.request(`/store/reservations/${id}`, 'DELETE');
    this.invalidateCollection('reservations');
  }

  async getDocument<T = any>(collection: string, docId: string): Promise<T | null> {
    try {
      return await this.request(`/generic/${collection}/${docId}`);
    } catch (err: any) {
      if (err?.status === 404) {
        return null;
      }
      console.warn(`[ServerCoreRESTAdapter] getDocument error for ${collection}/${docId}:`, err.message);
      throw err;
    }
  }

  async setDocument<T = any>(
    collection: string,
    docId: string,
    data: T,
    merge = true
  ): Promise<void> {
    await this.request(`/generic/${collection}/${docId}`, 'POST', { data, merge });
    this.invalidateCollection(collection);
  }

  async deleteDocument(collection: string, docId: string): Promise<void> {
    await this.request(`/generic/${collection}/${docId}`, 'DELETE');
    this.invalidateCollection(collection);
  }

  async queryDocuments<T = any>(collection: string, filter?: CollectionFilter): Promise<T[]> {
    const token = getPlatformAdapters().storage.getItem('3ccorp_auth_token');

    const isPublicCollection =
      collection === 'stores' || collection === 'menu_items' || collection === 'coupons';
    if (!token && !isPublicCollection) {
      return [];
    }

    try {
      switch (collection) {
        case 'stores':
          return (await this.getStores(filter?.tenantId)) as any;
        case 'menu_items':
          return (await this.getMenuItems(filter?.storeId, filter?.tenantId)) as any;
        case 'orders':
          return (await this.getOrders(filter?.storeId, filter?.tenantId)) as any;
        case 'tables':
          return (await this.getTables(filter?.storeId)) as any;
        case 'drivers':
          return (await this.getDrivers(filter?.tenantId, filter?.storeId)) as any;
        case 'customers_crm':
          return (await this.getCustomers(filter?.storeId, filter?.tenantId)) as any;
        case 'inventory_batches':
          return (await this.getInventoryBatches(filter?.storeId, filter?.tenantId)) as any;
        case 'financial_records':
          return (await this.getFinancialRecords(filter?.storeId, filter?.tenantId)) as any;
        case 'device_licenses':
          return (await this.getDeviceLicenses(filter?.storeId, filter?.tenantId)) as any;
        case 'coupons':
          return (await this.getCoupons(filter?.storeId)) as any;
        case 'integrations':
          return (await this.getIntegrations(filter?.tenantId)) as any;
        case 'suppliers':
          return (await this.getSuppliers(filter?.tenantId)) as any;
        case 'reservations':
          return (await this.getReservations(filter?.storeId)) as any;
        case 'cash_sessions': {
          if (!filter?.storeId) return [];
          const cs = await this.getCashSession(filter.storeId);
          return cs ? ([cs] as any) : [];
        }
        case 'governance': {
          const gov = await this.getGovernance();
          return gov ? ([gov] as any) : [];
        }
        case 'users': {
          const qs = filter?.storeId ? `?storeId=${encodeURIComponent(String(filter.storeId))}` : '';
          return await this.request(`/admin/users${qs}`);
        }
        case 'store_staff': {
          const qs = filter?.storeId ? `?storeId=${encodeURIComponent(String(filter.storeId))}` : '';
          return await this.request(`/store/staff${qs}`);
        }
        case 'store_devices': {
          const qs = filter?.storeId ? `?storeId=${encodeURIComponent(String(filter.storeId))}` : '';
          return await this.request(`/store/devices${qs}`);
        }
        default: {
          const queryParams = new URLSearchParams();
          if (filter) {
            for (const [k, v] of Object.entries(filter)) {
              if (v !== undefined) queryParams.append(k, String(v));
            }
          }
          return await this.request(`/generic/${collection}?${queryParams.toString()}`);
        }
      }
    } catch (err: any) {
      console.warn(`[ServerCoreRESTAdapter] queryDocuments notice for ${collection}:`, err.message);
      return [];
    }
  }
}
