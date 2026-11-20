import { db, runWithSystemDbContext } from '../config.ts';

export const FORBIDDEN_PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const TRANSACTIONAL_ONLY_COLLECTIONS = new Set([
  'orders',
  'drivers',
  'cash_sessions',
  'financial_records',
]);

export const CONSUMER_PRIVILEGED_FORBIDDEN_KEYS = new Set([
  'role',
  'status',
  'disabled',
  'tokenVersion',
  'tokenRevokedAtSec',
  'permissions',
  'blockedApps',
  'walletBalance',
  'allowedStoreIds',
  'storeId',
]);

export const CONSUMER_ALLOWED_WRITE_KEYS = new Set([
  'id',
  'uid',
  'tenantId',
  'email',
  'name',
  'phone',
  'avatar',
  'savedAddresses',
  'favoriteStoreIds',
  'preferences',
  'loyaltyRewards',
  'createdAt',
  'updatedAt',
]);

export function stripPrototypePollution(value: any): any {
  if (Array.isArray(value)) {
    return value.map(stripPrototypePollution);
  }
  if (value && typeof value === 'object') {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_PROTO_KEYS.has(k)) continue;
      clean[k] = stripPrototypePollution(v);
    }
    return clean;
  }
  return value;
}

export function validateGenericDomainPayload(collection: string, doc: Record<string, any>): string | null {
  const hasNonNeg = (keys: string[]) =>
    keys.every((k) => {
      if (doc[k] === undefined || doc[k] === null) return true;
      const n = Number(doc[k]);
      return Number.isFinite(n) && n >= 0;
    });

  if (collection === 'tables' && doc.status !== undefined) {
    if (!['FREE', 'OCCUPIED', 'RESERVED', 'BILL_REQUESTED', 'CLEANING'].includes(String(doc.status))) {
      return 'Status de mesa inválido.';
    }
  } else if (collection === 'menu_items') {
    if (!hasNonNeg(['price', 'costPrice', 'stock', 'minStockAlert'])) {
      return 'Valores numéricos negativos ou inválidos em item de catálogo.';
    }
  } else if (collection === 'inventory_batches') {
    if (!hasNonNeg(['quantity', 'costPrice', 'costPerUnit', 'minQuantity'])) {
      return 'Valores numéricos negativos ou inválidos em lote de estoque.';
    }
  } else if (collection === 'cash_sessions') {
    if (
      !hasNonNeg(['initialCash', 'totalSales', 'totalSangrias', 'totalSuprimentos', 'finalCashCalculated']) ||
      (doc.status !== undefined && !['OPEN', 'CLOSED'].includes(String(doc.status)))
    ) {
      return 'Dados de sessão de caixa inválidos.';
    }
  } else if (collection === 'financial_records') {
    const amt = Number(doc.amount);
    if (
      (doc.type !== undefined && !['RECEIVABLE', 'PAYABLE'].includes(String(doc.type))) ||
      (doc.amount !== undefined && (!Number.isFinite(amt) || amt <= 0))
    ) {
      return 'Lançamento financeiro inválido (tipo ou valor <= 0).';
    }
  } else if (collection === 'coupons') {
    if (
      !hasNonNeg(['discountValue', 'minOrderValue']) ||
      (doc.discountType === 'PERCENT' && Number(doc.discountValue) > 100)
    ) {
      return 'Cupom com valor de desconto inválido.';
    }
  }
  return null;
}

export async function getActiveCatalogContext() {
  const [storesSnap, tenantsSnap] = await runWithSystemDbContext('GENERIC_ACTIVE_CATALOG', () =>
    Promise.all([db.collection('stores').get(), db.collection('tenants').get()])
  );
  const suspendedTenants = new Set(
    tenantsSnap.docs
      .map((d) => d.data())
      .filter((t) => String(t?.status || 'ACTIVE').toUpperCase() === 'SUSPENDED')
      .map((t) => t.id)
  );
  const activeStoreIds = new Set<string>();
  const storeTenantById = new Map<string, string>();
  for (const d of storesSnap.docs) {
    const s = d.data();
    if (!s || s._deleted) continue;
    const storeTenant = s.tenantId;
    if (storeTenant) storeTenantById.set(d.id, storeTenant);
    if (String(s.status || 'ACTIVE').toUpperCase() === 'SUSPENDED') continue;
    if (storeTenant && suspendedTenants.has(storeTenant)) continue;
    activeStoreIds.add(d.id);
  }
  return { suspendedTenants, activeStoreIds, storeTenantById };
}

export function sanitizeReadDocument(collection: string, docData: any, isConsumer: boolean): any {
  if (!docData) return docData;

  if (collection === 'users') {
    const { passwordHash: _omitted, resetCodeHash: _omittedReset, ...safeUser } = docData;
    return safeUser;
  }

  if (isConsumer && collection === 'stores') {
    const {
      subscriptionPlan: _sp,
      commissionRate: _cr,
      saasMonthlyFee: _smf,
      saasPaymentMethod: _spm,
      saasPaymentStatus: _sps,
      saasNextDueDate: _snd,
      trialExpiresAt: _te,
      maxAllowedDevices: _mad,
      maxAllowedBranches: _mab,
      billingCycle: _bc,
      totalOrders: _to,
      monthlyRevenue: _mr,
      waiterPairingPin: _wpp,
      waiterPairingPinUpdatedAt: _wppu,
      ...publicStore
    } = docData;
    return publicStore;
  }

  if (isConsumer && collection === 'menu_items') {
    const {
      costPrice: _cp,
      supplierName: _sn,
      internalNotes: _in,
      recipe: _rc,
      ...publicItem
    } = docData;
    return publicItem;
  }

  return docData;
}

export function sanitizeConsumerWritePayload(params: {
  id: string;
  cleanInput: Record<string, any>;
  existingData: Record<string, any> | null;
  authenticatedUser: Record<string, any>;
  isHqAdmin: boolean;
}): { ok: true; data: Record<string, any> } | { ok: false; status: number; error: string } {
  const { id, cleanInput, existingData, authenticatedUser, isHqAdmin } = params;
  if (isHqAdmin) {
    return {
      ok: true,
      data: {
        ...cleanInput,
        id,
        uid: id,
        tenantId: 'tenant-1',
      },
    };
  }

  for (const key of Object.keys(cleanInput)) {
    if (CONSUMER_PRIVILEGED_FORBIDDEN_KEYS.has(key)) {
      return {
        ok: false,
        status: 403,
        error: `Acesso negado: Campo administrativo '${key}' não pode ser alterado pelo consumidor.`,
      };
    }
  }

  const filteredConsumerData: Record<string, any> = {};
  for (const [key, val] of Object.entries(cleanInput)) {
    if (CONSUMER_ALLOWED_WRITE_KEYS.has(key)) {
      filteredConsumerData[key] = val;
    }
  }

  if (cleanInput.loyaltyRewards !== undefined) {
    if (!Array.isArray(cleanInput.loyaltyRewards)) {
      return { ok: false, status: 400, error: 'Formato inválido de recompensas de fidelidade.' };
    }
    const existingRewards = Array.isArray(existingData?.loyaltyRewards) ? existingData.loyaltyRewards : [];
    const existingRewardsById = new Map<string, any>(
      existingRewards.filter((r: any) => r?.id).map((r: any) => [String(r.id), r])
    );
    const validatedRewards: any[] = [];
    for (const incoming of cleanInput.loyaltyRewards) {
      const incomingId = incoming?.id ? String(incoming.id) : '';
      const prevReward = incomingId ? existingRewardsById.get(incomingId) : null;
      if (!prevReward) {
        return {
          ok: false,
          status: 403,
          error: 'Acesso negado: Criação ou injeção manual de recompensas de fidelidade não é permitida.',
        };
      }
      validatedRewards.push({
        ...prevReward,
        isRedeemed: Boolean(prevReward.isRedeemed) || Boolean(incoming?.isRedeemed),
      });
    }
    filteredConsumerData.loyaltyRewards = validatedRewards;
  }

  filteredConsumerData.id = id;
  filteredConsumerData.uid = id;
  filteredConsumerData.tenantId = 'tenant-1';
  if (existingData?.email || authenticatedUser.email) {
    filteredConsumerData.email = existingData?.email || authenticatedUser.email;
  }
  return { ok: true, data: filteredConsumerData };
}
