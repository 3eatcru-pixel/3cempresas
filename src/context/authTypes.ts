import { EcosystemSessionRole } from '../types';
import { getActiveClientAppId } from '../core/platform/PlatformAdapter';

export type AuthModalContextId =
  | 'store-os'
  | 'marketplace'
  | 'driver'
  | 'waiter'
  | 'hq'
  | 'server-core'
  | 'portal';

export interface UserProfile {
  uid: string;
  email: string;
  role: EcosystemSessionRole;
  tenantId?: string;
  storeId?: string;
  allowedStoreIds?: string[];
  name?: string;
  phone?: string;
  emailVerified?: boolean;
  mustChangePassword?: boolean;
  status?: string;
  authProvider?: string;
  deviceDocId?: string;
  deviceId?: string;
  terminalId?: string;
  permissions?: string[];
  blockedApps?: string[];
}

export const GUEST_CUSTOMER_PROFILE: UserProfile = {
  uid: 'guest-customer',
  email: '',
  role: 'CUSTOMER',
  name: 'Consumidor Visitante',
  tenantId: undefined,
  emailVerified: false,
};

export interface AuthContextType {
  user: any;
  profile: UserProfile | null;
  loading: boolean;
  authNotice: string | null;
  clearAuthNotice: () => void;
  signIn: (contextId?: AuthModalContextId) => void;
  signInManual: (name: string, email: string, role: EcosystemSessionRole, emailVerified?: boolean) => Promise<void>;
  loginWithPassword: (email: string, password: string, contextId?: AuthModalContextId) => Promise<void>;
  loginWithFirebaseGoogle: (contextId?: AuthModalContextId) => Promise<void>;
  loginWithSupabaseToken: (accessToken: string, contextId?: AuthModalContextId) => Promise<void>;
  firebaseEnabled: boolean;
  firebaseFirestoreEnabled: boolean;
  supabaseEnabled: boolean;
  loginWaiterWithPin: (payload: {
    storeId?: string;
    pin?: string;
    qrPayload?: string | Record<string, any>;
    operatorName?: string;
  }) => Promise<{ store?: { id: string; name: string } }>;
  loginDriverWithPin: (payload: {
    storeId?: string;
    pin?: string;
    qrPayload?: string | Record<string, any>;
    driverName?: string;
    phone?: string;
    vehicle?: 'SCOOTER' | 'BIKE' | 'CAR';
    vehiclePlate?: string;
  }) => Promise<{ store?: { id: string; name: string }; driver?: any }>;
  loginStoreDevice: (payload: {
    deviceIdentifier: string;
    pairingCode: string;
    operatorName?: string;
  }) => Promise<{ store?: { id: string; name: string }; device?: any }>;
  signUpManual: (
    name: string,
    email: string,
    password: string,
    role: EcosystemSessionRole,
    storeName?: string,
    storeLocation?: { city?: string; state?: string }
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateOwnProfile: (payload: { name?: string; phone?: string }) => Promise<UserProfile | null>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteOwnAccount: () => Promise<void>;
  switchRole: (role: EcosystemSessionRole) => void;
  isAdmin: boolean;
  isHqAdmin: boolean;
  isMerchant: boolean;
  isRealAdmin: boolean;
  isAuthenticated: boolean;
  getIdToken: () => Promise<string | undefined>;

  // Auth Modal Controls
  isAuthModalOpen: boolean;
  authModalDefaultTab: 'login' | 'signup';
  authModalDefaultRole: EcosystemSessionRole;
  authModalContext: AuthModalContextId;
  openAuthModal: (
    initialTab?: 'login' | 'signup',
    defaultRole?: EcosystemSessionRole,
    contextId?: AuthModalContextId
  ) => void;
  closeAuthModal: () => void;
  setAuthModalContext: (contextId: AuthModalContextId) => void;
}

export function resolveDefaultAuthContextFromApp(): AuthModalContextId {
  const activeApp = getActiveClientAppId();
  return activeApp === 'unified-portal' ? 'portal' : activeApp;
}

export function inferAuthContextFromRole(role: EcosystemSessionRole): AuthModalContextId {
  const activeApp = getActiveClientAppId();
  if (activeApp !== 'unified-portal') return activeApp;
  const upper = String(role || '').toUpperCase();
  if (upper === 'DEV_OWNER' || upper === 'SUPER_ADMIN') return 'hq';
  if (
    upper === 'STORE_OWNER' ||
    upper === 'STORE_MANAGER' ||
    upper === 'REGIONAL_MANAGER' ||
    upper === 'CASHIER' ||
    upper === 'KITCHEN_STAFF'
  ) {
    return 'store-os';
  }
  if (upper === 'COURIER' || upper === 'DRIVER') return 'driver';
  if (upper === 'WAITER') return 'waiter';
  return 'marketplace';
}
