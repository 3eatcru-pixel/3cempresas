import React from 'react';
import {
  AdminUser,
  AutomatedMessage,
  BillingCycle,
  CashRegisterSession,
  CouponCampaign,
  CustomerCRM,
  DeliveryFleetModality,
  DeviceLicense,
  DiningTable,
  Driver,
  EcosystemSessionRole,
  FinancialRecord,
  InventoryBatch,
  MainSectionId,
  MenuItem,
  Order,
  OrderStatus,
  PlatformGovernance,
  Reservation,
  RestEndpointSpec,
  ServiceOrder,
  Store,
  StoreOperationalSettings,
  StoreTemplateConfig,
  SubscriptionPlanTier,
  Supplier,
  SystemIntegration,
  TableStatus,
} from '../types';

export interface EcosystemContextType {
  // From useSystem
  activeSection: MainSectionId;
  setActiveSection: (sec: MainSectionId) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  sessionRole: EcosystemSessionRole;
  setSessionRole: (role: EcosystemSessionRole) => void;
  selectedStoreSlugForShowcase: string | null;
  setSelectedStoreSlugForShowcase: (slug: string | null) => void;
  activeNotification: string | null;
  showNotification: (msg: string) => void;
  logSystemEvent: (type: string, payload: string, channel: string, tenantId?: string) => Promise<void>;
  eventLogs: any[];
  systemHealth: any;
  dataStatus: 'LOADING' | 'READY' | 'ERROR';
  dataError: string | null;

  // From useStoreManagement & main state
  stores: Store[];
  setStores: React.Dispatch<React.SetStateAction<Store[]>>;
  selectedStoreId: string;
  setSelectedStoreId: (id: string) => void;
  currentStore: Store;
  menuItems: MenuItem[];
  tables: DiningTable[];
  inventoryBatches: InventoryBatch[];
  suppliers: Supplier[];
  reservations: Reservation[];
  updateStoreTemplate: (storeId: string, template: Partial<StoreTemplateConfig>) => Promise<void>;
  updateEnabledModules: (storeId: string, modules: string[]) => Promise<void>;
  updateStoreOperationalSettings: (storeId: string, settings: Partial<StoreOperationalSettings>) => Promise<void>;
  updateStoreData: (storeId: string, data: Partial<Store>) => Promise<void>;
  addMenuItem: (newItem: Omit<MenuItem, 'id'>) => Promise<void>;
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => Promise<boolean>;
  deleteMenuItem: (id: string) => Promise<void>;
  toggleMenuItemAvailability: (id: string) => Promise<void>;
  updateTableStatus: (tableId: string, status: TableStatus) => Promise<void>;
  addTable: (tableNumber: number, capacity?: number) => Promise<void>;
  provisionDefaultTables: (count?: number) => Promise<void>;
  deleteTable: (tableId: string) => Promise<boolean>;
  createWaiterTableOrder: (
    tableNumber: number,
    items: { menuItem: MenuItem; qty: number }[],
    waiterName: string
  ) => Promise<Order | null>;
  addInventoryBatch: (batch: Omit<InventoryBatch, 'id'>) => Promise<boolean>;
  addSupplier: (sup: Omit<Supplier, 'id'>) => Promise<void>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<boolean>;
  deleteSupplier: (id: string) => Promise<void>;
  addReservation: (res: Omit<Reservation, 'id'>) => Promise<boolean>;
  updateReservationStatus: (id: string, status: Reservation['status']) => Promise<void>;
  deleteReservation: (id: string) => Promise<void>;

  // From useLogistics
  drivers: Driver[];
  currentDriverId: string;
  setCurrentDriverId: (id: string) => void;
  driverPayouts: any[];
  fetchDriverPayouts: (driverId: string) => Promise<void>;
  requestDriverWithdraw: (driverId: string, amount: number, pixKey: string) => Promise<boolean>;
  updateDriverLocation: (driverId: string, latitude: number, longitude: number) => Promise<void>;
  toggleDriverStatus: (id: string) => Promise<void>;
  switchDriverOperationMode: (driverId: string, mode: 'PLATFORM' | 'STORE') => Promise<boolean>;
  updateDriverProfile: (
    driverId: string,
    updates: {
      name?: string;
      phone?: string;
      vehicle?: 'SCOOTER' | 'BIKE' | 'CAR';
      vehiclePlate?: string;
      pixKey?: string;
    }
  ) => Promise<boolean>;
  assignOrderDriver: (orderId: string, driverId: string) => Promise<boolean>;
  acceptDelivery: (driverId: string, orderId: string) => Promise<void>;
  completeDelivery: (driverId: string, orderId: string, deliveryPin?: string) => Promise<boolean>;
  toggleStoreDeliveryModality: (storeId: string, modality: DeliveryFleetModality) => Promise<void>;
  updateStoreOwnFee: (storeId: string, fee: number) => Promise<void>;

  // From useCommerce & main state
  orders: Order[];
  geoAddress: string;
  setGeoAddress: (addr: string) => void;
  userCoords: [number, number];
  setUserCoords: (coords: [number, number]) => void;
  gpsCoords: [number, number] | null;
  gpsAccuracyMeters: number | null;
  locationSource: 'GPS' | 'ADDRESS' | 'DEFAULT';
  requestUserGeolocation: () => void;
  geocodeUserAddress: (queryOverride?: string) => Promise<boolean>;
  isGeocodingAddress: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  maxRadiusKm: number;
  setMaxRadiusKm: (radius: number) => void;
  marketplaceViewMode: 'grid' | 'fichario' | 'livro-razao' | 'map';
  setMarketplaceViewMode: (m: 'grid' | 'fichario' | 'livro-razao' | 'map') => void;
  modalities: { delivery: boolean; pickup: boolean; tableReservation: boolean; openNow: boolean };
  toggleModality: (k: keyof EcosystemContextType['modalities']) => void;
  cart: { menuItem: MenuItem; quantity: number; notes?: string; variantId?: string; variantLabel?: string }[];
  addToCart: (menuItem: MenuItem, quantity?: number, notes?: string, variant?: { id?: string; label?: string }) => void;
  removeFromCart: (id: string) => void;
  updateCartQuantity: (id: string, qty: number) => void;
  clearCart: () => void;
  cartTotal: number;
  placeMarketplaceOrder: (
    customerName: string,
    phone: string,
    address: string,
    paymentMethod:
      | 'PIX'
      | 'CREDIT_CARD'
      | 'DEBIT_CARD'
      | 'CASH'
      | 'BOLETO'
      | 'BANK_TRANSFER'
      | 'PAYMENT_LINK'
      | 'TABLE_BILL',
    couponCode?: string,
    notes?: string,
    orderModality?: 'DELIVERY' | 'PICKUP' | 'TABLE',
    tableNumber?: number,
    courierTip?: number,
    deliveryCoordsOverride?: [number, number]
  ) => Promise<Order | null>;
  createPosOrder: (
    name: string,
    items: { menuItem: MenuItem; qty: number; notes?: string; variantId?: string; variantLabel?: string; serialNumber?: string }[],
    payment: any,
    discount?: number,
    couponCode?: string,
    channelOverride?: 'POS' | 'KIOSK',
    metadata?: {
      notes?: string;
      professionalId?: string;
      professionalName?: string;
      commissionRate?: number;
      commissionAmount?: number;
      reservationId?: string;
      scheduledDeliveryDate?: string;
      scheduledDeliveryPeriod?: 'MANHÃ' | 'TARDE' | 'NOITE';
      assemblyRequired?: boolean;
      paymentConfirmed?: boolean;
      providerTransactionId?: string;
      crmCustomerId?: string;
      customerPhone?: string;
    }
  ) => Promise<Order | null>;
  updateOrderStatus: (orderId: string, status: OrderStatus, cancelReason?: string, driverId?: string, driverName?: string) => Promise<void>;
  cancelCustomerOrder: (orderId: string, reason?: string) => Promise<boolean>;
  confirmOrderPayment: (orderId: string, paymentMethod?: string, providerTransactionId?: string) => Promise<boolean>;
  requestTableBill: (storeId: string, tableNumber: number, includeServiceFee: boolean, splitCount: number, totalWithService: number) => Promise<boolean>;

  // From useFinance
  financialRecords: FinancialRecord[];
  cashSession: CashRegisterSession;
  addSangria: (amount: number, reason: string) => Promise<void>;
  addSuprimento: (amount: number, reason: string) => Promise<void>;
  openCashRegister: (initialCash: number, operator: string) => Promise<void>;
  closeCashRegister: (reconciliation?: {
    countedCash?: number;
    cashVariance?: number;
    closingNotes?: string;
    closedBy?: string;
    paymentBreakdown?: Record<string, number>;
  }) => Promise<void>;
  addFinancialRecord: (record: Omit<FinancialRecord, 'id'>) => Promise<void>;
  markFinancialPaid: (id: string) => Promise<void>;

  // From useCRM
  customersCrm: CustomerCRM[];
  automatedMessages: AutomatedMessage[];
  addCustomerToCrm: (customer: Omit<CustomerCRM, 'id' | 'storeId'>) => Promise<void>;
  updateCustomerNotes: (customerId: string, notes: string) => Promise<void>;
  updateCustomerProfile: (
    customerId: string,
    updates: Partial<Pick<CustomerCRM, 'name' | 'phone' | 'email' | 'notes' | 'loyaltyTier' | 'loyaltyPoints'>>
  ) => Promise<boolean>;
  deleteCustomerFromCrm: (customerId: string) => Promise<boolean>;
  toggleAutomatedMessage: (msgId: string) => void;
  updateAutomatedMessageContent: (msgId: string, content: string) => void;

  // From useAdmin
  governance: PlatformGovernance;
  users: any[];
  adminUsers: AdminUser[];
  deviceLicenses: DeviceLicense[];
  integrations: SystemIntegration[];
  coupons: CouponCampaign[];
  addStore: (store: Omit<Store, 'id'>) => Promise<string>;
  createBranchStore: (parentStore: Store, branchData: { name: string; branchLabel?: string; address: string; phone: string; category?: Store['category'] }) => Promise<string | null>;
  updateUserRole: (uid: string, role: EcosystemSessionRole, tenantId?: string, storeId?: string | null) => Promise<void>;
  updateCourierGovernance: (
    uid: string,
    updates: {
      fleetType?: 'PLATFORM_FLEET' | 'STORE_FLEET';
      allowedFleetModes?: ('PLATFORM_FLEET' | 'STORE_FLEET')[];
      storeId?: string | null;
      vehicle?: 'SCOOTER' | 'BIKE' | 'CAR';
      vehiclePlate?: string;
    }
  ) => Promise<void>;
  updateUserBlockedApps: (uid: string, blockedApps: string[]) => Promise<void>;
  updateUserAccountDetails: (
    uid: string,
    updates: {
      name?: string;
      phone?: string;
      storeId?: string | null;
      tenantId?: string;
      allowedStoreIds?: string[];
      blockedApps?: string[];
      role?: EcosystemSessionRole;
    }
  ) => Promise<void>;
  toggleUserStatus: (uid: string, nextStatus: 'ACTIVE' | 'DISABLED') => Promise<void>;
  createUserAccount: (
    name: string,
    email: string,
    role: any,
    storeId?: string,
    password?: string,
    phone?: string,
    blockedApps?: string[],
    courierOptions?: {
      fleetType?: 'PLATFORM_FLEET' | 'STORE_FLEET';
      allowedFleetModes?: ('PLATFORM_FLEET' | 'STORE_FLEET')[];
      vehicle?: 'SCOOTER' | 'BIKE' | 'CAR';
      vehiclePlate?: string;
    }
  ) => Promise<void>;
  deleteUserAccount: (uid: string) => Promise<void>;
  updateStoreSubscription: (
    storeId: string,
    plan: SubscriptionPlanTier,
    billingCycle?: BillingCycle,
    maxBranches?: number,
    trialExpiresAt?: string,
    couponCode?: string,
    customOverrides?: {
      maxAllowedDevices?: number;
      saasMonthlyFee?: number;
      commissionRate?: number;
      enabledModules?: string[];
      saasPaymentStatus?: 'TRIAL' | 'PENDING' | 'PAID' | 'OVERDUE';
      paymentMethod?: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO' | 'BANK_TRANSFER' | 'PAYMENT_LINK';
    }
  ) => Promise<void>;
  toggleStoreBillingStatus: (storeId: string, status: 'PAID' | 'PENDING' | 'OVERDUE') => Promise<void>;
  revokeDeviceLicense: (deviceId: string) => Promise<void>;
  registerNewDeviceLicense: (storeId: string, name: string, type: any, hardwareDeviceId?: string) => Promise<boolean>;
  regenerateDevicePairing: (deviceId: string) => Promise<string | null>;
  revokeDeviceToken: (deviceId: string) => Promise<void>;
  toggleFeatureFlag: (flagKey: keyof PlatformGovernance['featureFlags']) => Promise<void>;
  updatePlanPricing: (tier: SubscriptionPlanTier, pricing: any) => Promise<void>;
  updateGovernanceSettings: (updates: Partial<PlatformGovernance>) => Promise<void>;
  addCoupon: (coupon: Omit<CouponCampaign, 'id'>) => Promise<void>;
  toggleCouponStatus: (id: string, nextActive: boolean) => Promise<void>;
  deleteCoupon: (id: string) => Promise<void>;
  seedDatabaseToLocalCore: () => Promise<void>;
  resetEntirePlatformData: () => Promise<void>;
  addIntegration: (integ: Omit<SystemIntegration, 'id'> & { apiKey?: string }) => Promise<void>;
  updateIntegration: (id: string, updates: Partial<SystemIntegration>) => Promise<void>;
  deleteIntegration: (id: string) => Promise<void>;
  triggerBillingReconciliation: () => Promise<void>;
  syncHqData: () => Promise<void>;
  pairDevice: (deviceId: string, pairingCode?: string) => Promise<void>;
  heartbeatDevice: (deviceId: string) => Promise<void>;
  revokeUserSessions: (uid: string) => Promise<void>;
  resetUserPassword: (uid: string, newPassword?: string) => Promise<string | null>;
  suspendTenant: (tenantId: string) => Promise<void>;
  activateTenant: (tenantId: string) => Promise<void>;
  testIntegration: (id: string) => Promise<void>;
  dispatchIntegrationWebhookTest: (id: string, eventType?: 'PING' | 'ORDER_COMMITTED' | 'PAYMENT_CONFIRMED') => Promise<any>;
  suspendIntegration: (id: string) => Promise<void>;

  // Missing setters and microservices
  setCustomersCrm: React.Dispatch<React.SetStateAction<CustomerCRM[]>>;
  setFinancialRecords: React.Dispatch<React.SetStateAction<FinancialRecord[]>>;
  setCashSession: React.Dispatch<React.SetStateAction<CashRegisterSession>>;
  microservices: any[];
  simulateFailover: (serviceName: string) => void;
  sendClusterCommand: (command: 'FORCE_FAILOVER' | 'FLUSH_REDIS') => Promise<void>;

  // Legacy/Compatibility
  restEndpoints: RestEndpointSpec[];
  serviceOrders: ServiceOrder[];
}
