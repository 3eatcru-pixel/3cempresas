import express from 'express';
import { auth, db, runWithSystemDbContext, runWithTenantDbContext } from '../../config.ts';
import {
  BRANCH_LOCKED_ROLES,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import { stripPrototypePollution } from '../../utils/requestSanitizer.ts';

export const PROTECTED_SYNC_STORE_FIELDS = new Set([
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
  'waiterPairingPin',
  'waiterPairingPinUpdatedAt',
  'pendingUpgradeRequest',
  'status',
]);

export const PROTECTED_WAITER_KITCHEN_ORDER_FIELDS = new Set([
  'items',
  'subtotal',
  'discount',
  'deliveryFee',
  'courierTip',
  'total',
  'paymentStatus',
  'paymentMethod',
  'paidAt',
  'providerTransactionId',
  'deliveryPin',
  'commissionRate',
  'commissionAmount',
  'driverId',
  'refundedTotal',
  'customerId',
  'couponCode',
]);

export const EDGE_TECHNICAL_ALLOWED_ENTITIES = new Set([
  'orders',
  'tables',
  'reservations',
  'cash_sessions',
  'customers_crm',
  'suppliers',
  'financial_records',
  'menu_items',
  'inventory_batches',
]);

export const MAX_HLC_FUTURE_SKEW_MS = 60_000;

export const SYNC_OPERATIONAL_ROLES = [
  'DEV_OWNER',
  'SUPER_ADMIN',
  'REGIONAL_MANAGER',
  'STORE_OWNER',
  'STORE_MANAGER',
  'CASHIER',
  'KITCHEN_STAFF',
  'WAITER',
  'EDGE_NODE',
];

export function sanitizeSyncPayload(entity: string, rawPayload: any, userRole: string): Record<string, any> {
  const clean = stripPrototypePollution(rawPayload && typeof rawPayload === 'object' ? rawPayload : {});
  const isHqAdmin = userRole === 'DEV_OWNER' || userRole === 'SUPER_ADMIN';
  if (entity === 'stores' && !isHqAdmin) {
    for (const protectedKey of PROTECTED_SYNC_STORE_FIELDS) {
      delete clean[protectedKey];
    }
  }
  return clean;
}

export function validateHlcTimestamp(
  rawHlc: unknown,
  maxFutureMs = MAX_HLC_FUTURE_SKEW_MS
): { ok: true; hlc: string } | { ok: false; reason: 'INVALID_HLC' | 'HLC_FUTURE_SKEW' } {
  if (typeof rawHlc !== 'string') {
    return { ok: false, reason: 'INVALID_HLC' };
  }
  const hlc = rawHlc.trim();
  if (!hlc || hlc.length > 128) {
    return { ok: false, reason: 'INVALID_HLC' };
  }

  let tsMs = NaN;
  let counter = -1;
  let normalizedHlc = hlc;

  const isoMatch = hlc.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)[:|-](\d+)(?:[:|-]([A-Za-z0-9_.-]+))?$/
  );
  if (isoMatch) {
    tsMs = Date.parse(isoMatch[1]);
    counter = Number(isoMatch[2]);
    if (Number.isFinite(tsMs) && tsMs >= 0) {
      normalizedHlc = `${tsMs}:${String(counter).padStart(4, '0')}:${isoMatch[3] || 'node'}`;
    }
  } else {
    const epochMatch = hlc.match(/^(\d{1,15})[:|-](\d+)(?:[:|-]([A-Za-z0-9_.-]+))?$/);
    if (epochMatch) {
      tsMs = Number(epochMatch[1]);
      counter = Number(epochMatch[2]);
      normalizedHlc = `${tsMs}:${String(counter).padStart(4, '0')}:${epochMatch[3] || 'node'}`;
    }
  }

  if (!Number.isFinite(tsMs) || tsMs < 0 || !Number.isInteger(counter) || counter < 0 || counter > 1_000_000) {
    return { ok: false, reason: 'INVALID_HLC' };
  }
  if (tsMs > Date.now() + maxFutureMs) {
    return { ok: false, reason: 'HLC_FUTURE_SKEW' };
  }
  return { ok: true, hlc: normalizedHlc };
}

export function isBranchScopedSyncUser(user: any): boolean {
  return Boolean(
    user &&
    user.role !== 'DEV_OWNER' &&
    BRANCH_LOCKED_ROLES.has(user.role)
  );
}

export const verifySyncCredentials = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado: Cabeçalho Authorization Bearer ausente ou inválido.' });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Não autorizado: Token não informado.' });
  }
  if (token.startsWith('edg-tok:')) {
    let edgeResult:
      | { ok: true; decoded: Awaited<ReturnType<typeof auth.verifyEdgeSyncToken>> }
      | { ok: false; status: number; error: string };
    try {
      edgeResult = await runWithSystemDbContext('EDGE_AUTH_VERIFY', async () => {
        const decoded = await auth.verifyEdgeSyncToken(token);
        const nodeSnap = await db.collection('edge_nodes').doc(decoded.nodeId).get();
        if (!nodeSnap.exists) {
          return { ok: false as const, status: 401, error: 'Credencial Edge não reconhecida: nó Edge não registrado.' };
        }
        const nodeDoc = nodeSnap.data() || {};
        if (nodeDoc.status === 'REVOKED' || nodeDoc.status === 'SUSPENDED') {
          return { ok: false as const, status: 401, error: 'Credencial técnica Edge revogada ou suspensa pelo HQ/Loja.' };
        }
        if (nodeDoc.tenantId !== decoded.tenantId || nodeDoc.storeId !== decoded.storeId) {
          return { ok: false as const, status: 403, error: 'Acesso negado: Escopo de empresa/filial do Edge divergente.' };
        }
        if (typeof nodeDoc.tokenVersion === 'number' && decoded.tokenVersion !== nodeDoc.tokenVersion) {
          return { ok: false as const, status: 401, error: 'Credencial técnica Edge expirada/rotacionada.' };
        }
        const tenantSnap = await db.collection('tenants').doc(decoded.tenantId).get();
        if (!tenantSnap.exists || String(tenantSnap.data()?.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') {
          return { ok: false as const, status: 403, error: 'Acesso bloqueado: Empresa inativa ou suspensa.' };
        }
        return { ok: true as const, decoded };
      });
    } catch (err: any) {
      return res.status(401).json({ error: err?.message || 'Credencial técnica Edge inválida ou expirada.' });
    }
    if (!edgeResult.ok) {
      return res.status(edgeResult.status).json({ error: edgeResult.error });
    }
    const decoded = edgeResult.decoded;
    (req as any).edgeNode = decoded;
    (req as any).user = {
      uid: `edge:${decoded.nodeId}`,
      email: '',
      name: `Edge Node ${decoded.nodeId}`,
      role: 'EDGE_NODE',
      tenantId: decoded.tenantId,
      storeId: decoded.storeId,
      allowedStoreIds: [decoded.storeId],
      isEdgeTechnicalCredential: true,
    };
    return runWithTenantDbContext(decoded.tenantId, () => next(), 'EDGE_NODE_SYNC');
  }
  return verifyAutonomousToken(req, res, next);
};
