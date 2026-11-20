import type {
  DeliveryFleetModality,
  LondrinaRegion,
  StoreCategory,
  StorePaymentMethod,
} from './catalogAndCommerceTypes';

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
    supabaseEnabled?: boolean;
    supabaseAuthEnabled?: boolean;
    supabaseDbEnabled?: boolean;
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
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  supabaseJwksUrl?: string;
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
