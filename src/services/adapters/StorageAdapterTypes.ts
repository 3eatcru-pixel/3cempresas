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

export type CollectionFilter = {
  tenantId?: string;
  storeId?: string;
  [key: string]: any;
};

export type SubscriptionCallback<T> = (data: T[]) => void;
export type UnsubscribeFn = () => void;

/**
 * StorageAdapter Interface — Contrato unificado de persistência independente de infraestrutura
 */
export interface StorageAdapter {
  id: string;
  name: string;
  type: 'STANDALONE_LOCAL' | 'SERVER_CORE_REST';

  // Subscriptions (Reatividade em tempo real independente do backend)
  subscribe<T = any>(
    collectionName: string,
    callback: SubscriptionCallback<T>,
    filter?: CollectionFilter
  ): UnsubscribeFn;

  // Stores
  getStores(tenantId?: string): Promise<Store[]>;
  getStoreById(id: string): Promise<Store | null>;
  saveStore(store: Store): Promise<void>;
  updateStore(id: string, updates: Partial<Store>): Promise<void>;

  // Menu Items
  getMenuItems(storeId?: string, tenantId?: string): Promise<MenuItem[]>;
  saveMenuItem(item: MenuItem): Promise<void>;
  deleteMenuItem(id: string): Promise<void>;
  updateMenuItem(id: string, updates: Partial<MenuItem>): Promise<void>;

  // Orders
  getOrders(storeId?: string, tenantId?: string): Promise<Order[]>;
  getOrderById(id: string): Promise<Order | null>;
  createOrder(order: Partial<Order>): Promise<Order>;
  updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    extra?: { cancelReason?: string; driverId?: string; driverName?: string }
  ): Promise<void>;

  // Tables
  getTables(storeId?: string): Promise<DiningTable[]>;
  saveTable(table: DiningTable): Promise<void>;
  deleteTable(tableId: string): Promise<void>;
  updateTableStatus(tableId: string, status: TableStatus): Promise<void>;

  // Inventory
  getInventoryBatches(storeId?: string, tenantId?: string): Promise<InventoryBatch[]>;
  saveInventoryBatch(batch: InventoryBatch): Promise<void>;

  // CRM
  getCustomers(storeId?: string, tenantId?: string): Promise<CustomerCRM[]>;
  saveCustomer(customer: CustomerCRM): Promise<void>;
  updateCustomer(id: string, updates: Partial<CustomerCRM>): Promise<void>;

  // Finance & Cash
  getFinancialRecords(storeId?: string, tenantId?: string): Promise<FinancialRecord[]>;
  saveFinancialRecord(record: FinancialRecord): Promise<void>;
  getCashSession(storeId: string): Promise<CashRegisterSession | null>;
  saveCashSession(session: CashRegisterSession): Promise<void>;

  // Drivers
  getDrivers(tenantId?: string, storeId?: string): Promise<Driver[]>;
  saveDriver(driver: Driver): Promise<void>;
  updateDriver(id: string, updates: Partial<Driver>): Promise<void>;

  // Governance & System
  getGovernance(): Promise<PlatformGovernance>;
  saveGovernance(gov: Partial<PlatformGovernance>): Promise<void>;

  // Device Licenses & Integrations
  getDeviceLicenses(storeId?: string, tenantId?: string): Promise<DeviceLicense[]>;
  saveDeviceLicense(license: DeviceLicense): Promise<any>;
  deleteDeviceLicense(id: string): Promise<void>;

  getCoupons(storeId?: string): Promise<CouponCampaign[]>;
  saveCoupon(coupon: CouponCampaign): Promise<void>;

  getIntegrations(tenantId?: string): Promise<SystemIntegration[]>;
  saveIntegration(integration: SystemIntegration & { apiKey?: string }): Promise<any>;
  deleteIntegration(id: string): Promise<void>;

  // Suppliers & Reservations
  getSuppliers(tenantId?: string): Promise<Supplier[]>;
  saveSupplier(supplier: Supplier): Promise<void>;
  deleteSupplier(id: string): Promise<void>;

  getReservations(storeId?: string): Promise<Reservation[]>;
  saveReservation(res: Reservation): Promise<void>;
  deleteReservation(id: string): Promise<void>;

  // Generic document operations for flexibility
  getDocument<T = any>(collection: string, docId: string): Promise<T | null>;
  setDocument<T = any>(collection: string, docId: string, data: T, merge?: boolean): Promise<void>;
  deleteDocument(collection: string, docId: string): Promise<void>;
  queryDocuments<T = any>(collection: string, filter?: CollectionFilter): Promise<T[]>;
}
