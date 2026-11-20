import {
  advanceHlcTimestamp,
  generateHlcTimestamp,
} from '../../../utils/idGenerator.ts';
import {
  compareHlcTimestamps,
  stageStockLedgerInTransaction,
  stageSyncOutboxInTransaction,
} from '../../persistence/PersistenceDriver.ts';
import { isActionAllowed } from '@3c/permissions';

export function summarizeRecordForDlq(record: any): Record<string, any> | null {
  if (!record || typeof record !== 'object') return null;
  const copy: Record<string, any> = {};
  for (const [k, v] of Object.entries(record)) {
    if (/password|hash|secret|token|key/i.test(k)) continue;
    copy[k] = v;
  }
  return copy;
}

export function validateSyncMergedPayload(entity: string, mergedDoc: Record<string, any>): boolean {
  const hasNonNeg = (obj: Record<string, any>, keys: string[]) =>
    keys.every((k) => {
      if (obj[k] === undefined || obj[k] === null) return true;
      const n = Number(obj[k]);
      return Number.isFinite(n) && n >= 0;
    });

  if (entity === 'tables' && mergedDoc.status !== undefined) {
    return ['FREE', 'OCCUPIED', 'RESERVED', 'BILL_REQUESTED', 'CLEANING'].includes(String(mergedDoc.status));
  }
  if (entity === 'menu_items') {
    return hasNonNeg(mergedDoc, ['price', 'costPrice', 'stock', 'minStockAlert']);
  }
  if (entity === 'inventory_batches') {
    return hasNonNeg(mergedDoc, ['quantity', 'costPrice', 'costPerUnit', 'minQuantity']);
  }
  if (entity === 'cash_sessions') {
    return (
      hasNonNeg(mergedDoc, ['initialCash', 'totalSales', 'totalSangrias', 'totalSuprimentos', 'finalCashCalculated']) &&
      (mergedDoc.status === undefined || ['OPEN', 'CLOSED'].includes(String(mergedDoc.status)))
    );
  }
  if (entity === 'financial_records') {
    const amt = Number(mergedDoc.amount);
    return (
      (mergedDoc.type === undefined || ['RECEIVABLE', 'PAYABLE'].includes(String(mergedDoc.type))) &&
      (mergedDoc.amount === undefined || (Number.isFinite(amt) && amt > 0))
    );
  }
  if (entity === 'coupons') {
    return (
      hasNonNeg(mergedDoc, ['discountValue', 'minOrderValue']) &&
      !(mergedDoc.discountType === 'PERCENT' && Number(mergedDoc.discountValue) > 100)
    );
  }
  return true;
}

export function applySyncDeleteTombstoneTx(params: {
  tx: any;
  docRef: any;
  entity: string;
  entityId: string;
  existing: any;
  targetTenantId: string;
  targetStoreId: string | null;
  nodeId: string;
  incomingHlc: string;
  idempotencyKey: string;
}): { status: 'CONFLICT'; reason: string; serverRecord: any } | null {
  const { tx, docRef, entity, entityId, existing, targetTenantId, targetStoreId, nodeId, incomingHlc, idempotencyKey } =
    params;

  if (existing && existing.hlc && compareHlcTimestamps(incomingHlc, existing.hlc) < 0) {
    return { status: 'CONFLICT' as const, reason: 'STALE_HLC', serverRecord: existing };
  }

  const tombstone = {
    ...(existing || {}),
    id: entityId,
    tenantId: targetTenantId,
    storeId: targetStoreId,
    _deleted: true,
    hlc: incomingHlc,
    updatedAt: new Date().toISOString(),
  };
  tx.set(docRef, tombstone, { merge: true });
  stageSyncOutboxInTransaction(tx, {
    entity,
    entityId,
    operation: 'DELETE',
    tenantId: targetTenantId,
    storeId: targetStoreId,
    nodeId: String(nodeId),
    hlc: incomingHlc,
    idempotencyKey: idempotencyKey || undefined,
    payload: { id: entityId, _deleted: true },
  });
  return null;
}

export function applyMenuItemStockDeltaTx(params: {
  tx: any;
  docRef: any;
  entityId: string;
  existing: any;
  mut: any;
  sanitizedIncomingPayload: Record<string, any>;
  callerRole: string;
  targetTenantId: string;
  targetStoreId: string | null;
  nodeId: string;
  incomingHlc: string;
  idempotencyKey: string;
}): void {
  const {
    tx,
    docRef,
    entityId,
    existing,
    mut,
    sanitizedIncomingPayload,
    callerRole,
    targetTenantId,
    targetStoreId,
    nodeId,
    incomingHlc,
    idempotencyKey,
  } = params;

  const prevStock = Number(existing?.stock) || 0;
  const nextStock = Math.max(0, Math.round((prevStock + Number(mut.deltaQty)) * 1000) / 1000);
  const maxObserved = compareHlcTimestamps(existing?.hlc, incomingHlc) >= 0 ? existing?.hlc : incomingHlc;
  const reconciledHlc = advanceHlcTimestamp(maxObserved, 'cloud_core');
  const safePayload = isActionAllowed(callerRole, 'menu_items', 'write') ? sanitizedIncomingPayload : {};

  const incomingVariantDeltas: Array<{ variantId: string; deltaQty: number }> = Array.isArray(mut?.variantDeltas)
    ? mut.variantDeltas
        .filter(
          (vd: any) =>
            vd && typeof vd.variantId === 'string' && typeof vd.deltaQty === 'number' && Number.isFinite(vd.deltaQty)
        )
        .map((vd: any) => ({ variantId: String(vd.variantId), deltaQty: Number(vd.deltaQty) }))
    : [];

  const reconciledVariants = existing?.variants
    ? existing.variants.map((v: any) => ({ ...v }))
    : Array.isArray(safePayload?.variants)
    ? safePayload.variants.map((v: any) => ({ ...v }))
    : undefined;

  const appliedVariantLedgers: Array<{
    variantId: string;
    label?: string;
    previousQty: number;
    deltaQty: number;
    balanceAfter: number;
  }> = [];

  if (incomingVariantDeltas.length > 0 && Array.isArray(reconciledVariants)) {
    for (const vd of incomingVariantDeltas) {
      const vIdx = reconciledVariants.findIndex((v: any) => v.id === vd.variantId);
      if (vIdx >= 0) {
        const prevVar = Number(reconciledVariants[vIdx].stock) || 0;
        const nextVar = Math.max(0, Math.round((prevVar + vd.deltaQty) * 1000) / 1000);
        reconciledVariants[vIdx].stock = nextVar;
        appliedVariantLedgers.push({
          variantId: vd.variantId,
          label: reconciledVariants[vIdx].label || reconciledVariants[vIdx].name,
          previousQty: prevVar,
          deltaQty: Math.round((nextVar - prevVar) * 1000) / 1000,
          balanceAfter: nextVar,
        });
      }
    }
  }

  const mergedDoc = {
    ...(existing || {}),
    ...safePayload,
    ...(reconciledVariants ? { variants: reconciledVariants } : {}),
    id: entityId,
    tenantId: targetTenantId,
    ...(targetStoreId ? { storeId: targetStoreId } : {}),
    stock: nextStock,
    hlc: reconciledHlc,
    updatedAt: new Date().toISOString(),
  };
  tx.set(docRef, mergedDoc, { merge: true });

  stageStockLedgerInTransaction(tx, {
    tenantId: targetTenantId,
    storeId: targetStoreId || 'CENTRAL_WAREHOUSE',
    itemType: 'MENU_ITEM',
    targetId: entityId,
    itemName: mergedDoc.name || entityId,
    deltaQty: Math.round((nextStock - prevStock) * 1000) / 1000,
    previousQty: prevStock,
    balanceAfter: nextStock,
    reason: 'SYNC_RECONCILE',
    nodeId: String(nodeId),
    hlc: reconciledHlc,
  });

  for (const vl of appliedVariantLedgers) {
    stageStockLedgerInTransaction(tx, {
      tenantId: targetTenantId,
      storeId: targetStoreId || 'CENTRAL_WAREHOUSE',
      itemType: 'VARIANT',
      targetId: `${entityId}::${vl.variantId}`,
      itemName: `${mergedDoc.name || entityId} [${vl.label || vl.variantId}]`,
      deltaQty: vl.deltaQty,
      previousQty: vl.previousQty,
      balanceAfter: vl.balanceAfter,
      reason: 'SYNC_RECONCILE',
      nodeId: String(nodeId),
      hlc: reconciledHlc,
    });
  }

  stageSyncOutboxInTransaction(tx, {
    entity: 'menu_items',
    entityId,
    operation: 'UPSERT',
    tenantId: targetTenantId,
    storeId: targetStoreId,
    nodeId: 'cloud_core',
    hlc: reconciledHlc,
    idempotencyKey: idempotencyKey || undefined,
    payload: mergedDoc,
  });
}

export function applyInventoryBatchDeltaTx(params: {
  tx: any;
  docRef: any;
  entityId: string;
  existing: any;
  mut: any;
  sanitizedIncomingPayload: Record<string, any>;
  callerRole: string;
  targetTenantId: string;
  targetStoreId: string | null;
  nodeId: string;
  incomingHlc: string;
  idempotencyKey: string;
}): void {
  const {
    tx,
    docRef,
    entityId,
    existing,
    mut,
    sanitizedIncomingPayload,
    callerRole,
    targetTenantId,
    targetStoreId,
    nodeId,
    incomingHlc,
    idempotencyKey,
  } = params;

  const prevQty = Number(existing?.quantity) || 0;
  const nextQty = Math.max(0, Math.round((prevQty + Number(mut.deltaQty)) * 1000) / 1000);
  const maxObserved = compareHlcTimestamps(existing?.hlc, incomingHlc) >= 0 ? existing?.hlc : incomingHlc;
  const reconciledHlc = advanceHlcTimestamp(maxObserved, 'cloud_core');
  const safePayload = isActionAllowed(callerRole, 'inventory_batches', 'write') ? sanitizedIncomingPayload : {};
  const mergedDoc = {
    ...(existing || {}),
    ...safePayload,
    id: entityId,
    tenantId: targetTenantId,
    storeId: targetStoreId,
    quantity: nextQty,
    hlc: reconciledHlc,
    updatedAt: new Date().toISOString(),
  };
  tx.set(docRef, mergedDoc, { merge: true });
  stageStockLedgerInTransaction(tx, {
    tenantId: targetTenantId,
    storeId: targetStoreId || 'CENTRAL_WAREHOUSE',
    itemType: 'RAW_BATCH',
    targetId: entityId,
    sku: mergedDoc.sku,
    itemName: mergedDoc.name || mergedDoc.sku || entityId,
    deltaQty: Math.round((nextQty - prevQty) * 1000) / 1000,
    previousQty: prevQty,
    balanceAfter: nextQty,
    reason: 'SYNC_RECONCILE',
    nodeId: String(nodeId),
    hlc: reconciledHlc,
  });
  stageSyncOutboxInTransaction(tx, {
    entity: 'inventory_batches',
    entityId,
    operation: 'UPSERT',
    tenantId: targetTenantId,
    storeId: targetStoreId,
    nodeId: 'cloud_core',
    hlc: reconciledHlc,
    idempotencyKey: idempotencyKey || undefined,
    payload: mergedDoc,
  });
}

export function applyCouponUsageDeltaTx(params: {
  tx: any;
  docRef: any;
  entityId: string;
  existing: any;
  mut: any;
  targetTenantId: string;
  incomingHlc: string;
  idempotencyKey: string;
}): { status: 'REJECTED'; reason: string } | null {
  const { tx, docRef, entityId, existing, mut, targetTenantId, incomingHlc, idempotencyKey } = params;
  const delta = Math.floor(Number(mut.deltaUsage));
  if (!Number.isFinite(delta) || delta < 1 || delta > 10) {
    return { status: 'REJECTED' as const, reason: 'INVALID_PAYLOAD' };
  }
  if (!existing || existing._deleted || existing.audience === 'MERCHANT') {
    return { status: 'REJECTED' as const, reason: 'RBAC_DENIED' };
  }
  const prevUsage = Number(existing.usageCount) || 0;
  const usageLimit = Number(existing.usageLimit);
  const nextUsage =
    Number.isFinite(usageLimit) && usageLimit > 0 ? Math.min(usageLimit, prevUsage + delta) : prevUsage + delta;
  const maxObserved = compareHlcTimestamps(existing.hlc, incomingHlc) >= 0 ? existing.hlc : incomingHlc;
  const reconciledHlc = advanceHlcTimestamp(maxObserved, 'cloud_core');
  const mergedDoc = {
    ...existing,
    id: entityId,
    usageCount: nextUsage,
    hlc: reconciledHlc,
    updatedAt: new Date().toISOString(),
  };
  tx.set(docRef, mergedDoc, { merge: true });
  stageSyncOutboxInTransaction(tx, {
    entity: 'coupons',
    entityId,
    operation: 'UPSERT',
    tenantId: existing.tenantId || targetTenantId,
    storeId: existing.storeId || null,
    nodeId: 'cloud_core',
    hlc: reconciledHlc,
    idempotencyKey: idempotencyKey || undefined,
    payload: mergedDoc,
  });
  return null;
}

export { generateHlcTimestamp };
