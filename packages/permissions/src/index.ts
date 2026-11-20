/**
 * 3C Corp SaaS - Shared RBAC / Collection Governance Matrix (@3c/permissions)
 * Level 1 Shared Core — Zero duplication between Server Core, Edge Node, and Clients.
 */

export const ALLOWED_GENERIC_COLLECTIONS: string[] = [
  'stores',
  'menu_items',
  'orders',
  'tables',
  'inventory_batches',
  'customers_crm',
  'consumers',
  'financial_records',
  'cash_sessions',
  'drivers',
  'coupons',
  'suppliers',
  'reservations',
  'events',
  'automated_messages',
];

export const RESTRICTED_COLLECTIONS: string[] = [
  'users',
  'governance',
  'payment_configs',
  'audit_logs',
  'integrations',
  'device_licenses',
  'peripherals',
  'print_jobs',
  'storage_objects',
  'payment_webhook_events',
  'saas_billing_webhook_events',
];

export const PRODUCT_ALLOWED_ROLES: Record<string, string[]> = {
  marketplace: ['CUSTOMER', 'CONSUMER'],
  'store-os': [
    'STORE_OWNER',
    'STORE_MANAGER',
    'REGIONAL_MANAGER',
    'CASHIER',
    'KITCHEN_STAFF',
  ],
  waiter: ['WAITER', 'STORE_OWNER', 'STORE_MANAGER', 'REGIONAL_MANAGER'],
  driver: ['COURIER', 'DRIVER'],
  hq: ['DEV_OWNER', 'SUPER_ADMIN'],
  'server-core': ['DEV_OWNER'],
};

export interface RolePermissions {
  read: string[];
  write: string[];
  delete: string[];
}

export const RBAC_PERMISSIONS: Record<string, RolePermissions> = {
  DEV_OWNER: { read: ['*'], write: ['*'], delete: ['*'] },
  SUPER_ADMIN: { read: ['*'], write: ['*'], delete: ['*'] },
  REGIONAL_MANAGER: {
    read: [
      'stores',
      'menu_items',
      'orders',
      'tables',
      'inventory_batches',
      'customers_crm',
      'financial_records',
      'cash_sessions',
      'drivers',
      'coupons',
      'suppliers',
      'reservations',
      'automated_messages',
    ],
    write: [
      'stores',
      'menu_items',
      'orders',
      'tables',
      'inventory_batches',
      'customers_crm',
      'financial_records',
      'cash_sessions',
      'coupons',
      'suppliers',
      'reservations',
      'automated_messages',
    ],
    delete: [
      'menu_items',
      'tables',
      'inventory_batches',
      'customers_crm',
      'coupons',
      'suppliers',
      'reservations',
    ],
  },
  STORE_OWNER: {
    read: [...ALLOWED_GENERIC_COLLECTIONS.filter(c => c !== 'consumers')],
    write: [...ALLOWED_GENERIC_COLLECTIONS.filter(c => c !== 'consumers' && c !== 'events' && c !== 'drivers')],
    delete: [
      'menu_items',
      'tables',
      'inventory_batches',
      'customers_crm',
      'coupons',
      'suppliers',
      'reservations',
    ],
  },
  STORE_MANAGER: {
    read: [
      'stores',
      'menu_items',
      'orders',
      'tables',
      'inventory_batches',
      'customers_crm',
      'financial_records',
      'cash_sessions',
      'drivers',
      'coupons',
      'suppliers',
      'reservations',
    ],
    write: [
      'menu_items',
      'orders',
      'tables',
      'inventory_batches',
      'customers_crm',
      'financial_records',
      'cash_sessions',
      'coupons',
      'suppliers',
      'reservations',
    ],
    delete: ['reservations'],
  },
  CASHIER: {
    read: ['menu_items', 'orders', 'tables', 'reservations', 'cash_sessions', 'coupons', 'customers_crm'],
    write: ['orders', 'tables', 'cash_sessions', 'reservations'],
    delete: [],
  },
  KITCHEN_STAFF: {
    read: ['orders', 'menu_items', 'inventory_batches'],
    write: [],
    delete: [],
  },
  WAITER: {
    read: ['menu_items', 'orders', 'tables', 'reservations'],
    write: ['orders', 'tables', 'reservations'],
    delete: [],
  },
  COURIER: {
    read: ['orders', 'drivers'],
    write: [],
    delete: [],
  },
  CUSTOMER: {
    read: ['menu_items', 'orders', 'coupons', 'stores', 'consumers'],
    write: ['consumers'],
    delete: [],
  },
  CONSUMER: {
    read: ['menu_items', 'orders', 'coupons', 'stores', 'consumers'],
    write: ['consumers'],
    delete: [],
  },
};

export function isActionAllowed(
  role: string,
  collection: string,
  action: 'read' | 'write' | 'delete'
): boolean {
  const perms = RBAC_PERMISSIONS[role];
  if (!perms) return false;
  const list = perms[action] || [];
  if (list.includes('*')) return true;
  return list.includes(collection);
}

export function isRestrictedCollection(collection: string): boolean {
  return RESTRICTED_COLLECTIONS.includes(collection);
}
