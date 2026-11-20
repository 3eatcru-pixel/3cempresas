import { db } from '../../config.ts';
import { AuthenticatedRequestUser, hasUserStoreAccess } from '../../middleware/auth.ts';
export { stripPrototypePollution, omitKeys, sanitizeStringList } from '../../utils/requestSanitizer.ts';

export const PROTECTED_STORE_SAAS_FIELDS = [
  'subscriptionPlan',
  'billingCycle',
  'maxAllowedDevices',
  'maxAllowedBranches',
  'commissionRate',
  'saasMonthlyFee',
  'saasPaymentMethod',
  'saasPaymentStatus',
  'saasNextDueDate',
  'trialExpiresAt',
];

export function isSingleBranchLocked(user: AuthenticatedRequestUser): boolean {
  if (!user.storeId) return false;
  if (Array.isArray(user.allowedStoreIds) && user.allowedStoreIds.length > 1) return false;
  return true;
}

export function canViewPrivateStoreFields(callerUser: AuthenticatedRequestUser | null, store: any): boolean {
  if (!callerUser || !store) return false;
  if (callerUser.role === 'DEV_OWNER' || callerUser.role === 'SUPER_ADMIN') return true;
  if (
    ['STORE_OWNER', 'STORE_MANAGER', 'REGIONAL_MANAGER'].includes(callerUser.role) &&
    callerUser.tenantId === store.tenantId &&
    hasUserStoreAccess(callerUser, store.id)
  ) {
    return true;
  }
  return false;
}

// Helper to sanitize menu items for public/unauthenticated catalog view
export function sanitizeMenuItemForPublic(item: any) {
  const sanitized = { ...item };
  delete sanitized.costPrice;
  delete sanitized.supplierName;
  delete sanitized.internalNotes;
  delete sanitized.recipe;
  return sanitized;
}

// Helper to sanitize stores for public view (remove SaaS/billing details)
export function sanitizeStoreForPublic(store: any) {
  const sanitized = { ...store };
  delete sanitized.subscriptionPlan;
  delete sanitized.commissionRate;
  delete sanitized.saasMonthlyFee;
  delete sanitized.saasPaymentMethod;
  delete sanitized.saasPaymentStatus;
  delete sanitized.saasNextDueDate;
  delete sanitized.trialExpiresAt;
  delete sanitized.maxAllowedDevices;
  delete sanitized.maxAllowedBranches;
  delete sanitized.billingCycle;
  delete sanitized.totalOrders;
  delete sanitized.monthlyRevenue;
  delete sanitized.waiterPairingPin;
  delete sanitized.waiterPairingPinUpdatedAt;
  return sanitized;
}

export async function verifyStoreTenantAccess(
  storeId: string,
  callerUser: AuthenticatedRequestUser
): Promise<{ ok: true; store: any } | { ok: false; status: number; error: string }> {
  const storeSnap = await db.collection('stores').doc(storeId).get();
  if (!storeSnap.exists || storeSnap.data()?._deleted) {
    return { ok: false, status: 404, error: `Loja '${storeId}' não encontrada.` };
  }
  const storeData = storeSnap.data();
  if (callerUser.role !== 'DEV_OWNER') {
    if (storeData?.tenantId !== callerUser.tenantId) {
      return { ok: false, status: 403, error: 'Acesso negado: Loja pertence a outra empresa/tenant.' };
    }
    if (!hasUserStoreAccess(callerUser, storeId)) {
      return { ok: false, status: 403, error: 'Acesso negado: Perfil restrito a outra filial.' };
    }
  }
  return { ok: true, store: storeData };
}

export function validateMenuNumericFields(payload: Record<string, any>): string | null {
  const numericFields: Array<{ key: string; label: string }> = [
    { key: 'price', label: 'preço de venda' },
    { key: 'costPrice', label: 'custo' },
    { key: 'stock', label: 'estoque' },
    { key: 'minStockAlert', label: 'estoque mínimo' },
  ];
  for (const { key, label } of numericFields) {
    if (payload[key] !== undefined && payload[key] !== null) {
      const val = Number(payload[key]);
      if (!Number.isFinite(val) || val < 0) {
        return `Valor inválido para ${label} (${key}): deve ser um número >= 0.`;
      }
    }
  }
  if (Array.isArray(payload.variants)) {
    for (const v of payload.variants) {
      if (v && v.stock !== undefined && v.stock !== null) {
        const vStock = Number(v.stock);
        if (!Number.isFinite(vStock) || vStock < 0) {
          return 'Estoque de variação inválido: deve ser um número >= 0.';
        }
      }
    }
  }
  return null;
}
