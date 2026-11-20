/**
 * 3C Corp SaaS - Enterprise Shared Domain Models (@3c/shared-types)
 * Level 1 Shared Core — Zero runtime dependencies.
 */

export type MainSectionId =
  | 'portal'         // Portal de Entrada / Seleção de Perfil
  | 'hq-central'     // 1. HQ Central — Governança da Plataforma
  | 'store-os'       // 2. Store OS — Sistema Operacional da Loja
  | 'marketplace'    // 3. Público / Marketplace — Consumidores e Descoberta
  | 'server-core'    // 4. Server Core — Backend e Motor Transacional
  | 'driver'         // 5. Driver App — Entregas
  | 'waiter';        // 6. Waiter App — Comandas e Salão

export type UserRole =
  | 'SUPER_ADMIN'
  | 'REGIONAL_MANAGER'
  | 'STORE_OWNER'
  | 'STORE_MANAGER'
  | 'CASHIER'
  | 'KITCHEN_STAFF'
  | 'WAITER'
  | 'COURIER'
  | 'CUSTOMER'
  | 'DEV_OWNER';

export interface AdminUser {
  id: string;
  uid?: string;
  name: string;
  email: string;
  role: UserRole;
  storeId?: string;
  tenantId?: string;
  permissions: string[];
  blockedApps?: string[];
  status: 'ACTIVE' | 'SUSPENDED';
  lastLogin: string;
}

export interface DeviceLicense {
  id: string;
  deviceId: string;
  name: string;
  storeId: string;
  tenantId?: string;
  type: 'POS_TERMINAL' | 'KDS_MONITOR' | 'WAITER_TABLET' | 'BARCODE_SCANNER' | 'PRINTER_80MM';
  status: 'ONLINE' | 'OFFLINE' | 'PENDING_PAIRING';
  paired?: boolean;
  pairingCode?: string;
  ipAddress: string;
  lastPing: string;
  lastHeartbeatAt?: string | null;
  appVersion?: string;
  createdAt?: string;
}

export type CouponAudience = 'CONSUMER' | 'MERCHANT';

export interface CouponCampaign {
  id: string;
  code: string;
  audience?: CouponAudience;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  minOrderValue: number;
  maxDiscount?: number;
  validUntil: string;
  usageCount: number;
  usageLimit: number;
  isActive: boolean;
  storeId?: string;
  tenantId?: string;
  applicablePlans?: SubscriptionPlanTier[];
  description?: string;
  _deleted?: boolean;
}

export interface IntegrationProbeEntry {
  timestamp: string;
  kind: 'HEALTH_PROBE' | 'WEBHOOK_TEST';
  status: string;
  httpStatus?: number | null;
  latencyMs?: number;
  message: string;
  eventType?: string;
}

export interface SystemIntegration {
  id: string;
  name: string;
  category: 'PAYMENT' | 'MAPS' | 'WHATSAPP' | 'DELIVERY_AGGREGATOR' | 'FISCAL_NFE' | 'AI' | 'API' | 'CLOUD' | 'SECURITY';
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'STANDBY' | 'ONLINE' | 'CONFIGURED' | 'SUSPENDED' | 'VALIDATING' | 'REACHABLE' | 'OPERATIONAL' | 'AUTH_FAILED' | 'ABSENT';
  apiKeyMasked: string;
  lastSync: string;
  diagnosticMessage?: string;
  endpointUrl?: string;
  latencyMs?: number;
  lastHttpStatus?: number | null;
  probeHistory?: IntegrationProbeEntry[];
  tenantId?: string;
  isDemo?: boolean;
}

export type StoreCategory =
  | 'RESTAURANT'
  | 'BURGER'
  | 'PIZZA'
  | 'JAPANESE'
  | 'RETAIL'
  | 'BEVERAGES'
  | 'BEAUTY'
  | 'SERVICES'
  | 'FURNITURE'
  | 'ELECTRONICS'
  | 'FASHION'
  | 'HEALTH'
  | 'MULTI_COMMERCE';

export const BRAZILIAN_STATES = [
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
] as const;

export type BrazilianUf = (typeof BRAZILIAN_STATES)[number]['uf'];

export type LondrinaRegion = 'CENTRO' | 'NORTE' | 'SUL' | 'LESTE' | 'OESTE';

export interface LondrinaRegionSpec {
  id: LondrinaRegion;
  name: string;
  fullName: string;
  badgeColor: string;
  lat: number;
  lng: number;
  neighborhoods: string[];
  description: string;
}

export const LONDRINA_REGIONS: Record<LondrinaRegion, LondrinaRegionSpec> = {
  CENTRO: {
    id: 'CENTRO',
    name: 'Centro',
    fullName: 'Zona Central',
    badgeColor: 'bg-amber-500 text-slate-950',
    lat: -23.3105,
    lng: -51.1628,
    neighborhoods: ['Centro', 'Av. Higienópolis', 'Vila Ipiranga', 'Calçadão', 'Jd. Bellas Artes'],
    description: 'Coração comercial e financeiro de Londrina.',
  },
  NORTE: {
    id: 'NORTE',
    name: 'Norte',
    fullName: 'Zona Norte',
    badgeColor: 'bg-blue-500 text-white',
    lat: -23.2650,
    lng: -51.1450,
    neighborhoods: ['Av. Saul Elkind', 'Cinco Conjuntos', 'Jd. Violim', 'Parigot de Souza', 'Vila Recreio'],
    description: 'Polo populacional vibrante e centro de consumo da Zona Norte.',
  },
  SUL: {
    id: 'SUL',
    name: 'Sul',
    fullName: 'Zona Sul',
    badgeColor: 'bg-emerald-500 text-slate-950',
    lat: -23.3360,
    lng: -51.1890,
    neighborhoods: ['Gleba Palhano', 'Lago Igapó', 'Catuaí Shopping', 'Jd. Botânico', 'Vivian'],
    description: 'Região nobre de gastronomia premium e condomínios de alto padrão.',
  },
  LESTE: {
    id: 'LESTE',
    name: 'Leste',
    fullName: 'Zona Leste',
    badgeColor: 'bg-purple-500 text-white',
    lat: -23.3310,
    lng: -51.1390,
    neighborhoods: ['Aeroporto Governador José Richa', 'Hospital Universitário (HU)', 'Marco Zero', 'Jd. Tokio', 'Santos Dumont'],
    description: 'Hub universitário, hospitalar e logístico próximo ao aeroporto.',
  },
  OESTE: {
    id: 'OESTE',
    name: 'Oeste',
    fullName: 'Zona Oeste',
    badgeColor: 'bg-rose-500 text-white',
    lat: -23.3180,
    lng: -51.1950,
    neighborhoods: ['Campus UEL', 'Av. Maringá', 'Jd. Shangri-Lá', 'Parque Arthur Thomas', 'Bandeirantes'],
    description: 'Polo universitário da UEL, gastronomia alternativa e parques de lazer.',
  },
};

export interface RecipeIngredient {
  ingredientId: string;
  ingredientName: string;
  quantityRequired: number;
  unit: 'KG' | 'UN' | 'L' | 'G';
}

export interface InventoryBatch {
  id: string;
  storeId?: string;
  tenantId?: string;
  itemId?: string;
  sku: string;
  batchNumber: string;
  quantity: number;
  costPrice: number;
  costPerUnit?: number;
  expirationDate: string;
  supplierName: string;
  itemName?: string;
  status?: string;
}

export interface MenuItemOption {
  id: string;
  name: string;
  price: number;
}

export interface MenuItemVariant {
  id: string;
  size?: string;
  color?: string;
  sku?: string;
  stock: number;
}

export interface ProductSpecifications {
  segment?: 'FOOD' | 'FURNITURE' | 'ELECTRONICS' | 'FASHION' | 'SERVICE' | 'RETAIL_GENERAL';
  dimensions?: string | { widthCm?: number; heightCm?: number; depthCm?: number; weightKg?: number };
  material?: string;
  assemblyRequired?: boolean;
  warrantyMonths?: number;
  defaultDeliveryLeadDays?: number;
  technicalSpecs?: string;
  voltage?: '110V' | '220V' | 'BIVOLT' | 'BATERIA' | string;
  modelNumber?: string;
  requiresSerialOrImei?: boolean;
  sizes?: string[];
  colors?: string[];
  gender?: 'UNISSEX' | 'MASCULINO' | 'FEMININO' | 'INFANTIL' | string;
  durationMinutes?: number;
  professionalName?: string;
  serviceLocation?: 'PRESENCIAL' | 'DOMICILIO' | 'REMOTO' | string;
}

export interface MenuItem {
  id: string;
  storeId: string;
  tenantId?: string;
  sku: string;
  barcode: string;
  name: string;
  description: string;
  price: number;
  costPrice: number;
  category: string;
  image: string;
  isAvailable: boolean;
  stock: number;
  minStockAlert: number;
  options?: MenuItemOption[];
  variants?: MenuItemVariant[];
  recipe?: RecipeIngredient[];
  prepTimeMin?: number;
  specs?: ProductSpecifications;
}

export interface CashRegisterSession {
  id: string;
  storeId: string;
  openedBy: string;
  openedAt: string;
  closedAt?: string;
  closedBy?: string;
  initialCash: number;
  totalSales: number;
  totalSangrias: number;
  totalSuprimentos: number;
  finalCashCalculated: number;
  countedCash?: number;
  cashVariance?: number;
  closingNotes?: string;
  paymentBreakdown?: Record<string, number>;
  status: 'OPEN' | 'CLOSED';
  createdAt?: string;
}

export interface FinancialRecord {
  id: string;
  storeId: string;
  tenantId?: string;
  type: 'PAYABLE' | 'RECEIVABLE';
  description: string;
  category: string;
  amount: number;
  dueDate: string;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  entityName: string;
  paymentMethod?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Supplier {
  id: string;
  cnpj: string;
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  category: string;
  storeId?: string;
  tenantId?: string;
}

export interface CustomerCRM {
  id: string;
  storeId: string;
  tenantId?: string;
  name: string;
  phone: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  loyaltyPoints: number;
  loyaltyTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  lastOrderDate: string;
  notes?: string;
  tags?: string[];
}

export interface AutomatedMessage {
  id: string;
  storeId: string;
  trigger: 'ORDER_PLACED' | 'ORDER_READY' | 'ORDER_OUT_FOR_DELIVERY' | 'ORDER_COMPLETED';
  content: string;
  isActive: boolean;
}

export interface ServiceOrder {
  id: string;
  code: string;
  customerName: string;
  deviceOrTable: string;
  serviceType: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
  technicianOrAttendant: string;
  totalAmount: number;
  createdAt: string;
}

export interface Reservation {
  id: string;
  storeId: string;
  tenantId?: string;
  clientName: string;
  clientPhone: string;
  serviceOrTable: string;
  professional?: string;
  date: string;
  time: string;
  durationMinutes?: number;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  guestsCount: number;
  notes?: string;
  clientPreferences?: string;
  returnReminderDate?: string;
  createdAt?: any;
}

export interface StaffTask {
  id: string;
  title: string;
  assignedTo: string;
  shift: 'MORNING' | 'EVENING' | 'NIGHT';
  isCompleted: boolean;
}

export type OrderChannel = 'MARKETPLACE' | 'POS' | 'WAITER_TABLE' | 'TABLE' | 'KIOSK' | 'PICKUP';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PREPARATION'
  | 'READY_FOR_PICKUP'
  | 'DRIVER_ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface OrderItem {
  id: string;
  menuItemId: string;
  sku?: string;
  name: string;
  price: number;
  quantity: number;
  selectedOptions?: string[];
  notes?: string;
  variantId?: string;
  variantLabel?: string;
  serialNumber?: string;
  returnedQuantity?: number;
  returnedAt?: string;
  returnReason?: string;
}

export type DeliveryFleetModality = 'STORE_FLEET' | 'PLATFORM_FLEET';

export type StorePaymentMethod =
  | 'PIX'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'CASH'
  | 'BOLETO'
  | 'BANK_TRANSFER'
  | 'PAYMENT_LINK';

export interface Order {
  id: string;
  code: string;
  storeId: string;
  storeName?: string;
  tenantId?: string;
  channel: OrderChannel;
  customerName: string;
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  tableNumber?: number;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  couponCode?: string;
  total: number;
  paymentMethod: StorePaymentMethod | 'TABLE_BILL' | string;
  paymentStatus?: 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED' | string;
  paidAt?: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  prepTimeEstMin?: number;
  notes?: string;
  driverId?: string;
  driverName?: string;
  courierProgress?: number;
  deliveryModality?: DeliveryFleetModality;
  platformCommissionCut?: number;
  merchantNetReceived?: number;
  cancelReason?: string;
  scheduledDeliveryDate?: string;
  scheduledDeliveryPeriod?: 'MANHÃ' | 'TARDE' | 'NOITE';
  assemblyRequired?: boolean;
  exchangeReturnNote?: string;
  refundedTotal?: number;
  courierTip?: number;
  deliveredAt?: string;
  deliveryPin?: string;
}

export type DriverOperationMode = 'PLATFORM' | 'STORE';

export interface Driver {
  id: string;
  uid?: string;
  name: string;
  phone: string;
  vehicle: 'SCOOTER' | 'BIKE' | 'CAR';
  vehiclePlate?: string;
  rating: number;
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  fleetType: DeliveryFleetModality;
  allowedFleetModes?: DeliveryFleetModality[];
  activeOperationMode?: DriverOperationMode;
  accountStatus?: 'ACTIVE' | 'DISABLED' | 'PENDING_ACTIVATION';
  hqManaged?: boolean;
  storeId?: string | null;
  currentOrderId?: string;
  totalDeliveries: number;
  walletBalance: number;
  avatar: string;
  tenantId?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  zone?: string;
}

export interface DriverPayout {
  id: string;
  driverId: string;
  driverName?: string;
  tenantId: string;
  storeId?: string | null;
  amount: number;
  pixKey: string;
  status: 'REQUESTED' | 'PAID' | 'FAILED';
  requestedByUid?: string;
  createdAt: string;
}

export type TableStatus = 'FREE' | 'OCCUPIED' | 'BILL_REQUESTED' | 'CLEANING';

export interface DiningTable {
  id: string;
  tableNumber: number;
  capacity: number;
  status: TableStatus;
  storeId?: string;
  tenantId?: string;
  currentOrderId?: string;
  activeItemsCount: number;
  totalAmount: number;
  openedAt?: string;
  assignedWaiter?: string;
}

export type EcosystemSessionRole =
  | 'DEV_OWNER'
  | 'SUPER_ADMIN'
  | 'REGIONAL_MANAGER'
  | 'STORE_OWNER'
  | 'STORE_MANAGER'
  | 'CASHIER'
  | 'KITCHEN_STAFF'
  | 'WAITER'
  | 'COURIER'
  /** @deprecated Alias legado — consolidado em 'COURIER'. */
  | 'DRIVER'
  | 'CUSTOMER';

export type StoreShowcaseTemplate =
  | 'BURGER_MODERN'
  | 'PIZZA_TRATTORIA'
  | 'RETAIL_EMPORIO'
  | 'CAFE_CONFEITARIA'
  | 'JAPANESE_SUSHI'
  | 'FURNITURE_SHOWROOM'
  | 'TECH_ELECTRONICS'
  | 'FASHION_BOUTIQUE'
  | 'SERVICES_APPOINTMENT'
  | 'MULTI_COMMERCE';

export interface Socials {
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  ifood?: string;
  website?: string;
}

export interface MultiCommerceCustomSections {
  title?: string;
  showFoodSection?: boolean;
  showRetailSection?: boolean;
  showServicesSection?: boolean;
  showTablesSection?: boolean;
  cardDensity?: 'COMFORT' | 'COMPACT';
  highlightPromo?: boolean;
}

export interface StoreTemplateConfig {
  templateId: StoreShowcaseTemplate;
  primaryColor: string;
  tagline: string;
  announcementBanner?: string;
  whatsappOrderNumber?: string;
  showCategoryPills: boolean;
  showReviews: boolean;
  layoutStyle:
    | 'GRID_CARDS'
    | 'DENSE_SHELVES'
    | 'ELEGANT_MENU'
    | 'SHOWROOM_GALLERY'
    | 'TECH_SPECS'
    | 'SERVICES_LIST'
    | 'HYBRID_MIXED';
  customSections?: MultiCommerceCustomSections;
  socials?: Socials;
}

export type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
export type SubscriptionPlanTier = 'FREE' | 'PROMO' | 'BASIC' | 'PRO' | 'ENTERPRISE';

export interface PlanPricingTier {
  tier: SubscriptionPlanTier;
  name: string;
  badge: string;
  maxDevices: number;
  maxBranches?: number;
  description: string;
  allFeaturesIncluded: boolean;
  monthlyPrice: number;
  quarterlyPrice: number;
  annualPrice: number;
}

export interface StoreOperationalSettings {
  darkKitchenMode?: boolean;
  serviceFee10?: boolean;
  requireCpfOnCheckout?: boolean;
  autoNfce?: boolean;
  autoDispatch?: boolean;
  kdsAudioAlert?: boolean;
  pixKey?: string;
  acceptedPaymentMethods?: StorePaymentMethod[];
  allowCutleryOptIn?: boolean;
  allowCourierTip?: boolean;
  kioskSelfService?: boolean;
  sharedNeighborhoodFleet?: boolean;
  sharedWarehouseMode?: boolean;
  aiMenuAssistantEnabled?: boolean;
  cashbackPercent?: number;
  cashbackMinOrderValue?: number;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  code?: string;
  category: StoreCategory;
  rating: number;
  deliveryTimeMin: number;
  deliveryFee: number;
  minOrder: number;
  minOrderValue?: number;
  logo: string;
  banner: string;
  isOpen: boolean;
  commissionRate: number;
  subscriptionPlan: SubscriptionPlanTier;
  billingCycle: BillingCycle;
  maxAllowedDevices: number;
  maxAllowedBranches?: number;
  parentStoreId?: string;
  branchLabel?: string;
  saasMonthlyFee?: number;
  saasPaymentMethod?: SaasPaymentMethod;
  saasPaymentStatus?: 'TRIAL' | 'PAID' | 'PENDING' | 'OVERDUE' | 'SUSPENDED';
  saasNextDueDate?: string;
  trialExpiresAt?: string;
  isTrialExpired?: boolean;
  phone: string;
  address: string;
  city?: string;
  state?: string;
  neighborhood?: string;
  zipCode?: string;
  totalOrders: number;
  monthlyRevenue: number;
  deliveryModality?: DeliveryFleetModality;
  ownFleetCustomFee?: number;
  ownFleetDriverDailyRate?: number;
  showcaseTemplate?: StoreTemplateConfig;
  socials?: Socials;
  enabledModules?: string[];
  operationalSettings?: StoreOperationalSettings;
  latitude?: number;
  longitude?: number;
  region?: LondrinaRegion;
  tenantId?: string;
  tenantStatus?: 'ACTIVE' | 'SUSPENDED';
  pendingUpgradeRequest?: {
    requestedPlan: SubscriptionPlanTier;
    billingCycle: BillingCycle;
    paymentMethod?: SaasPaymentMethod | string;
    requestedAt: string;
    status: 'PENDING_PAYMENT_CONFIRMATION' | 'APPROVED' | 'REJECTED';
    estimatedAmount?: number;
    originalAmount?: number;
    couponCode?: string;
    couponDiscount?: number;
  };
  isDemo?: boolean;
  _deleted?: boolean;
}

export type SaasPaymentMethod =
  | 'PIX'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'BOLETO'
  | 'BANK_TRANSFER'
  | 'PAYMENT_LINK';

export type SaasPspProvider =
  | 'DIRECT_PIX'
  | 'ASAAS'
  | 'MERCADO_PAGO'
  | 'STRIPE'
  | 'PAGARME'
  | 'CUSTOM';

export interface PlatformBillingPaymentConfig {
  pixEnabled: boolean;
  pixKey: string;
  pixKeyType: 'CNPJ' | 'CPF' | 'EMAIL' | 'PHONE' | 'EVP';
  beneficiaryName: string;
  beneficiaryCity: string;
  beneficiaryDocument?: string;
  creditCardEnabled: boolean;
  debitCardEnabled: boolean;
  boletoEnabled: boolean;
  bankTransferEnabled: boolean;
  paymentLinkEnabled: boolean;
  maxCreditInstallments?: number;
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  bankAccountType?: 'CORRENTE' | 'POUPANCA' | 'PAGAMENTO';
  pspProvider: SaasPspProvider;
  checkoutBaseUrl?: string;
  billingSupportWhatsapp?: string;
  billingSupportEmail?: string;
  paymentInstructions?: string;
  gracePeriodDays: number;
  autoSuspendOverdue: boolean;
  lateFeePercent: number;
  monthlyInterestPercent: number;
  sendDueReminderDaysBefore: number;
}

export interface RestEndpointSpec {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  authRequired: boolean;
  latencyMs: number;
}

export interface PlatformGovernance {
  totalGMV: number;
  totalSaaSRevenue: number;
  globalCommissionRate: number;
  activeStoresCount: number;
  activeCouriersCount: number;
  databaseStatus: 'CONNECTED' | 'SYNCING';
  seniorAuditCompliance?: {
    p0Resolutions: { id: string; title: string; status: 'RESOLVED' | 'PENDING' | 'PENDING_VERIFICATION' | 'SANDBOX_BASELINE'; action: string }[];
    p1Resolutions: { id: string; title: string; status: 'RESOLVED' | 'PENDING' | 'PENDING_VERIFICATION' | 'SANDBOX_BASELINE'; action: string }[];
    homologationPassed: boolean;
    lastAuditDate: string;
  };
  serverCollections?: { name: string; docCount: number; lastWrite: string }[];
  auditLogs?: { id: string; timestamp: string; user: string; action: string; target: string }[];
  featureFlags: {
    aiEngineEnabled: boolean;
    autoDispatchEnabled: boolean;
    aiMenuAssistantEnabled: boolean;
    dynamicSurgePricingEnabled: boolean;
    waiterTableSelfServiceEnabled: boolean;
    offlineSyncEngineEnabled: boolean;
    marketplaceMaintenanceReadOnly?: boolean;
    firebaseEnabled?: boolean;
    firebaseFcmEnabled?: boolean;
    firebaseAnalyticsEnabled?: boolean;
    firebaseCrashlyticsEnabled?: boolean;
    firebaseAuthEnabled?: boolean;
    firebaseFirestoreEnabled?: boolean;
    firebaseMirrorSyncEnabled?: boolean;
  };
  planPricing?: {
    [key in SubscriptionPlanTier]?: {
      monthlyPrice: number;
      quarterlyPrice: number;
      annualPrice: number;
      maxDevices: number;
      maxBranches?: number;
    };
  };
  billingConfig?: PlatformBillingPaymentConfig;
  releaseConfig?: ReleaseDistributionConfig;
  marketplaceConfig?: MarketplaceGovernanceConfig;
  runtimePolicy?: PlatformRuntimePolicy;
  pspWebhookConfigured?: boolean;
  defaultTrialDays?: number;
  defaultPlatformDeliveryFee?: number;
  maxConcurrentOrdersPerStore?: number;
  globalAnnouncementBanner?: string;
  supportWhatsapp?: string;
  supportEmail?: string;
  customPlatformName?: string;
  maintenanceMessage?: string;
}

export type MarketplacePlacementType =
  | 'HERO_BANNER'
  | 'RECOMMENDED_CAROUSEL'
  | 'CATEGORY_TOP';

export interface MarketplaceSponsoredPlacement {
  id: string;
  storeId: string;
  placementType: MarketplacePlacementType;
  badgeText: string;
  bannerTitle?: string;
  bannerSubtitle?: string;
  ctaLabel?: string;
  monthlyFee: number;
  active: boolean;
  status?: 'PENDING_APPROVAL' | 'ACTIVE' | 'PAUSED' | 'REJECTED';
  requestedByUid?: string;
  requestedAt?: string;
  startsAt?: string;
  endsAt?: string;
}

export type ExternalDeliveryProviderId =
  | 'IFOOD'
  | 'UBER_EATS'
  | 'DELIVEROO'
  | 'RAPPI'
  | 'NINETY_NINE_FOOD';

export interface ExternalDeliveryChannelConfig {
  provider: ExternalDeliveryProviderId;
  label: string;
  enabled: boolean;
  monthlyAddonFee: number;
  revenueSharePercent: number;
  syncCatalog: boolean;
  syncOrders: boolean;
}

export interface MarketplaceSpotlightPricing {
  heroBannerMonthlyFee: number;
  recommendedSlotMonthlyFee: number;
  categoryTopMonthlyFee: number;
}

export interface MarketplaceGovernanceConfig {
  marketplaceName: string;
  heroHeadline: string;
  heroSubtitle: string;
  recommendationsTitle: string;
  featuredStoreIds: string[];
  hiddenStoreIds: string[];
  defaultDiscoveryRadiusKm: number;
  allowGuestBrowsing: boolean;
  enabledVerticals: string[];
  spotlightPricing: MarketplaceSpotlightPricing;
  sponsoredPlacements: MarketplaceSponsoredPlacement[];
  externalChannelConnectors: ExternalDeliveryChannelConfig[];
  updatedAt?: string;
}

export interface PlatformRuntimePolicy {
  storageMaxObjectBytes: number;
  storageTenantQuotaBytes: number;
  storageConsumerQuotaBytes: number;
  edgeAutoSyncMs: number;
  extraAllowedOrigins: string[];
  firebaseProjectIdOverride?: string;
  emailWebhookUrl?: string;
  updatedAt?: string;
}

export interface PlatformGovernanceExtensionFields {
  runtimePolicy?: PlatformRuntimePolicy;
}

export interface ReleaseDistributionConfig {
  releaseBaseUrl: string;
  channel: 'stable' | 'beta' | 'canary';
  minSupportedVersionOverride?: string;
  releaseNotesOverride?: string;
  disabledProducts: string[];
  artifactSignatures?: Record<string, string>;
  updatedAt?: string;
}

export interface SavedAddress {
  id: string;
  label: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault: boolean;
  latitude?: number;
  longitude?: number;
}

export interface ConsumerPreferences {
  dietaryRestrictions: string[];
  favoriteCategories: string[];
  defaultPaymentMethod: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH';
  emailNotifications: boolean;
  whatsappNotifications: boolean;
}

export interface LoyaltyReward {
  id: string;
  storeId: string;
  storeName: string;
  rewardTitle: string;
  pointsRequired: number;
  discountValue: number;
  couponCode: string;
  isRedeemed: boolean;
}

export interface ConsumerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar?: string;
  savedAddresses: SavedAddress[];
  preferences: ConsumerPreferences;
  loyaltyRewards: LoyaltyReward[];
  favoriteStoreIds: string[];
}
