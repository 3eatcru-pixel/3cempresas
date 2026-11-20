import type { SubscriptionPlanTier } from './storeAndGovernanceTypes';

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
