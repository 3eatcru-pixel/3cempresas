export const STORE_SCOPED_ROLES = new Set([
  'REGIONAL_MANAGER',
  'STORE_OWNER',
  'STORE_MANAGER',
  'CASHIER',
  'KITCHEN_STAFF',
  'WAITER',
]);

export const HQ_ROLES = new Set(['DEV_OWNER', 'SUPER_ADMIN']);

export type AccountSegment = 'ALL' | 'MARKETPLACE' | 'MERCHANTS' | 'COURIERS' | 'HQ';
export type StatusFilter = 'ALL' | 'ACTIVE' | 'DISABLED' | 'PENDING_ACTIVATION';

export function getUserEffectiveStatus(u: any): 'ACTIVE' | 'DISABLED' | 'PENDING_ACTIVATION' {
  if (u?.disabled === true || u?.status === 'DISABLED') return 'DISABLED';
  if (u?.status === 'PENDING_ACTIVATION') return 'PENDING_ACTIVATION';
  return 'ACTIVE';
}

export function normalizeRoleLabel(role?: string): string {
  const upper = String(role || 'CUSTOMER').toUpperCase();
  if (upper === 'CONSUMER') return 'CUSTOMER';
  if (upper === 'DRIVER') return 'COURIER';
  return upper;
}
