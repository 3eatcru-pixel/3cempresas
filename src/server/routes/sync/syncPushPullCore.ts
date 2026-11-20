import express from 'express';
import crypto from 'crypto';
import { db } from '../../config.ts';
import { hasUserStoreAccess, requireRoles } from '../../middleware/auth.ts';
import {
  advanceHlcTimestamp,
  generateHlcTimestamp,
} from '../../../utils/idGenerator.ts';
import {
  compareHlcTimestamps,
  stageStockLedgerInTransaction,
  stageSyncOutboxInTransaction,
} from '../../persistence/PersistenceDriver.ts';
import { ALLOWED_GENERIC_COLLECTIONS, isActionAllowed } from '@3c/permissions';
import { isValidOrderStatusTransition, TERMINAL_ORDER_STATES } from '@3c/contracts';
import {
  EDGE_TECHNICAL_ALLOWED_ENTITIES,
  isBranchScopedSyncUser,
  PROTECTED_WAITER_KITCHEN_ORDER_FIELDS,
  sanitizeSyncPayload,
  SYNC_OPERATIONAL_ROLES,
  validateHlcTimestamp,
  verifySyncCredentials,
} from './syncValidationCore.ts';
import syncPullAndLedgerRoutes from './syncPullAndLedgerRoutes.ts';

const router = express.Router();

function summarizeRecordForDlq(record: any): Record<string, any> | null {
  if (!record || typeof record !== 'object') return null;
  const copy: Record<string, any> = {};
  for (const [k, v] of Object.entries(record)) {
    if (/password|hash|secret|token|key/i.test(k)) continue;
    copy[k] = v;
  }
  return copy;
}

router.post(
  '/push',
  verifySyncCredentials,
  requireRoles(SYNC_OPERATIONAL_ROLES),
  async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const edgeAuth = (req as any).edgeNode;
      const { nodeId = 'edge_unknown', storeId, mutations } = req.body;

      if (!Array.isArray(mutations)) {
        return res.status(400).json({ error: 'Campo mutations deve ser um array.' });
      }
      if (mutations.length > 200) {
        return res.status(400).json({ error: 'Lote máximo de 200 mutações por push.' });
      }

      const callerTenant = authenticatedUser.tenantId || 'tenant-1';

      if (isBranchScopedSyncUser(authenticatedUser) && !authenticatedUser.storeId && !authenticatedUser.allowedStoreIds?.length) {
        return res.status(403).json({ error: 'Acesso negado: Operador sem filial vinculada.' });
      }

      if (edgeAuth) {
        if (String(nodeId) !== edgeAuth.nodeId) {
          return res.status(403).json({ error: 'Acesso negado: nodeId não corresponde à credencial técnica Edge.' });
        }
        if (storeId && String(storeId) !== edgeAuth.storeId) {
          return res.status(403).json({ error: 'Acesso negado: storeId divergente da credencial técnica Edge.' });
        }
      }

      if (nodeId && String(nodeId) !== 'edge_unknown') {
        const nodeSnap = await db.collection('edge_nodes').doc(String(nodeId)).get();
        if (!nodeSnap.exists && String(nodeId).startsWith('edg_')) {
          return res.status(403).json({ error: `Acesso negado: Edge Node '${nodeId}' não está registrado/pareado para esta filial.` });
        }
        if (nodeSnap.exists) {
          const nodeDoc = nodeSnap.data() || {};
          if (nodeDoc.status === 'REVOKED') {
            return res.status(403).json({ error: `Acesso negado: Edge Node '${nodeId}' foi revogado.` });
          }
          if (authenticatedUser.role !== 'DEV_OWNER') {
            if (nodeDoc.tenantId && nodeDoc.tenantId !== callerTenant) {
              return res.status(403).json({ error: `Acesso negado: Edge Node '${nodeId}' pertence a outro tenant.` });
            }
            if (storeId && nodeDoc.storeId && nodeDoc.storeId !== String(storeId)) {
              return res.status(403).json({ error: `Acesso negado: Edge Node '${nodeId}' vinculado a outra filial.` });
            }
            if (nodeDoc.storeId && !hasUserStoreAccess(authenticatedUser, nodeDoc.storeId)) {
              return res.status(403).json({ error: `Acesso negado: Perfil sem permissão para a filial do Edge Node '${nodeId}'.` });
            }
          }
        }
      }

      if (authenticatedUser.role !== 'DEV_OWNER' && storeId && !hasUserStoreAccess(authenticatedUser, String(storeId))) {
        return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
      }

      if (storeId && authenticatedUser.role !== 'DEV_OWNER') {
        const storeSnap = await db.collection('stores').doc(String(storeId)).get();
        if (storeSnap.exists && storeSnap.data()?.tenantId !== callerTenant) {
          return res.status(403).json({ error: 'Acesso negado: Loja pertence a outra empresa/tenant.' });
        }
      }

      const accepted: any[] = [];
      const deduplicated: any[] = [];
      const conflicts: any[] = [];
      const rejected: any[] = [];

      for (const mut of mutations) {
        const entity = String(mut?.entity || '');
        const entityId = String(mut?.entityId || '');
        const operation: 'UPSERT' | 'DELETE' = mut?.operation === 'DELETE' ? 'DELETE' : 'UPSERT';
        const idempotencyKey = mut?.idempotencyKey ? String(mut.idempotencyKey) : '';
        let incomingHlc: string;
        if (mut?.hlc !== undefined && mut?.hlc !== null) {
          const hlcCheck = validateHlcTimestamp(mut.hlc);
          if (!hlcCheck.ok) {
            if (entity === 'events' || entity === 'audit_logs') {
              rejected.push({ entity, entityId, idempotencyKey, reason: 'IMMUTABLE_AUDIT_COLLECTION' });
            } else {
              rejected.push({ entity, entityId, idempotencyKey, reason: hlcCheck.reason });
            }
            continue;
          }
          incomingHlc = hlcCheck.hlc;
        } else {
          incomingHlc = generateHlcTimestamp(String(nodeId));
        }

        if (!entity || !entityId) {
          rejected.push({ entity, entityId, reason: 'INVALID_MUTATION_FIELDS' });
          continue;
        }

        if (entity === 'events' || entity === 'audit_logs') {
          rejected.push({ entity, entityId, idempotencyKey, reason: 'IMMUTABLE_AUDIT_COLLECTION' });
          continue;
        }

        if (!ALLOWED_GENERIC_COLLECTIONS.includes(entity)) {
          rejected.push({ entity, entityId, idempotencyKey, reason: 'FORBIDDEN_COLLECTION' });
          continue;
        }

        const requiredAction = operation === 'DELETE' ? 'delete' : 'write';
        const isAuthorizedEdgeCouponUsage = Boolean(
          edgeAuth &&
          entity === 'coupons' &&
          operation !== 'DELETE' &&
          typeof mut?.deltaUsage === 'number' &&
          Number.isInteger(mut.deltaUsage) &&
          mut.deltaUsage >= 1 &&
          mut.deltaUsage <= 10
        );
        const isAuthorizedEdgeOutbox = Boolean(
          (edgeAuth &&
            EDGE_TECHNICAL_ALLOWED_ENTITIES.has(entity) &&
            operation !== 'DELETE') ||
          isAuthorizedEdgeCouponUsage
        );

        if (!isAuthorizedEdgeOutbox && !isActionAllowed(authenticatedUser.role, entity, requiredAction)) {
          rejected.push({ entity, entityId, idempotencyKey, reason: 'RBAC_DENIED' });
          continue;
        }

        if (typeof mut?.deltaQty === 'number') {
          const hasStockWriteRole = isActionAllowed(authenticatedUser.role, entity, 'write');
          const variantDeltasPositive = Array.isArray(mut?.variantDeltas) && mut.variantDeltas.some((vd: any) => Number(vd?.deltaQty) > 0);
          if (!hasStockWriteRole) {
            if (!edgeAuth) {
              rejected.push({ entity, entityId, idempotencyKey, reason: 'UNVERIFIED_STOCK_DELTA' });
              continue;
            }
            if (entity === 'menu_items' && (mut.deltaQty >= 0 || variantDeltasPositive)) {
              rejected.push({ entity, entityId, idempotencyKey, reason: 'UNVERIFIED_STOCK_DELTA' });
              continue;
            }
          }
        }

        const outcome = await db.runTransaction(async (tx: any) => {
          if (idempotencyKey) {
            const keyDocId = `${callerTenant}::${idempotencyKey}`;
            const seenSnap = await tx.get(db.collection('sync_processed_keys').doc(keyDocId));
            if (seenSnap.exists) {
              return { status: 'DEDUPLICATED' as const };
            }
          }
          const docRef = db.collection(entity).doc(entityId);
          const existingSnap = await tx.get(docRef);
          const existing = existingSnap.exists ? existingSnap.data() : null;

          if (existing && authenticatedUser.role !== 'DEV_OWNER') {
            const isSharedPlatformConsumerCouponUsage = Boolean(
              isAuthorizedEdgeCouponUsage &&
              existing.audience !== 'MERCHANT' &&
              !existing.storeId &&
              existing.tenantId === 'PLATFORM_HQ'
            );
            if (!isSharedPlatformConsumerCouponUsage && existing.tenantId !== callerTenant) {
              return { status: 'REJECTED' as const, reason: 'TENANT_MISMATCH' };
            }
            if (existing.storeId && !hasUserStoreAccess(authenticatedUser, existing.storeId)) {
              return { status: 'REJECTED' as const, reason: 'STORE_MISMATCH' };
            }
          }

          if (
            authenticatedUser.role !== 'DEV_OWNER' &&
            mut?.payload?.storeId &&
            !hasUserStoreAccess(authenticatedUser, String(mut.payload.storeId))
          ) {
            return { status: 'REJECTED' as const, reason: 'STORE_MISMATCH' };
          }

          if (
            entity === 'stores' &&
            authenticatedUser.role !== 'DEV_OWNER' &&
            authenticatedUser.role !== 'SUPER_ADMIN' &&
            !hasUserStoreAccess(authenticatedUser, entityId)
          ) {
            return { status: 'REJECTED' as const, reason: 'STORE_MISMATCH' };
          }

          if (
            operation === 'DELETE' &&
            (entity === 'stores' || entity === 'consumers') &&
            authenticatedUser.role !== 'DEV_OWNER' &&
            authenticatedUser.role !== 'SUPER_ADMIN'
          ) {
            return { status: 'REJECTED' as const, reason: 'FORBIDDEN_DELETE' };
          }

          const sanitizedIncomingPayload = sanitizeSyncPayload(entity, mut?.payload, authenticatedUser.role);

          const targetTenantId =
            authenticatedUser.role === 'DEV_OWNER'
              ? existing?.tenantId || sanitizedIncomingPayload?.tenantId || callerTenant
              : callerTenant;
          const targetStoreId = existing?.storeId || sanitizedIncomingPayload?.storeId || storeId || authenticatedUser.storeId || null;

          if (targetStoreId && authenticatedUser.role !== 'DEV_OWNER') {
            const targetStoreSnap = await tx.get(db.collection('stores').doc(String(targetStoreId)));
            if (targetStoreSnap.exists && targetStoreSnap.data()?.tenantId !== callerTenant) {
              return { status: 'REJECTED' as const, reason: 'TENANT_MISMATCH' };
            }
          }

          if (operation === 'DELETE') {
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
          } else if (entity === 'menu_items' && typeof mut?.deltaQty === 'number') {
            const prevStock = Number(existing?.stock) || 0;
            const nextStock = Math.max(0, Math.round((prevStock + Number(mut.deltaQty)) * 1000) / 1000);
            const maxObserved = compareHlcTimestamps(existing?.hlc, incomingHlc) >= 0 ? existing?.hlc : incomingHlc;
            const reconciledHlc = advanceHlcTimestamp(maxObserved, 'cloud_core');
            const safePayload = isActionAllowed(authenticatedUser.role, 'menu_items', 'write')
              ? sanitizedIncomingPayload
              : {};

            const incomingVariantDeltas: Array<{ variantId: string; deltaQty: number }> = Array.isArray(mut?.variantDeltas)
              ? mut.variantDeltas
                  .filter((vd: any) => vd && typeof vd.variantId === 'string' && typeof vd.deltaQty === 'number' && Number.isFinite(vd.deltaQty))
                  .map((vd: any) => ({ variantId: String(vd.variantId), deltaQty: Number(vd.deltaQty) }))
              : [];

            let reconciledVariants = existing?.variants
              ? existing.variants.map((v: any) => ({ ...v }))
              : (Array.isArray(safePayload?.variants) ? safePayload.variants.map((v: any) => ({ ...v })) : undefined);

            const appliedVariantLedgers: Array<{ variantId: string; label?: string; previousQty: number; deltaQty: number; balanceAfter: number }> = [];
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
              entity,
              entityId,
              operation: 'UPSERT',
              tenantId: targetTenantId,
              storeId: targetStoreId,
              nodeId: 'cloud_core',
              hlc: reconciledHlc,
              idempotencyKey: idempotencyKey || undefined,
              payload: mergedDoc,
            });
          } else if (entity === 'inventory_batches' && typeof mut?.deltaQty === 'number') {
            const prevQty = Number(existing?.quantity) || 0;
            const nextQty = Math.max(0, Math.round((prevQty + Number(mut.deltaQty)) * 1000) / 1000);
            const maxObserved = compareHlcTimestamps(existing?.hlc, incomingHlc) >= 0 ? existing?.hlc : incomingHlc;
            const reconciledHlc = advanceHlcTimestamp(maxObserved, 'cloud_core');
            const safePayload = isActionAllowed(authenticatedUser.role, 'inventory_batches', 'write')
              ? sanitizedIncomingPayload
              : {};
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
              entity,
              entityId,
              operation: 'UPSERT',
              tenantId: targetTenantId,
              storeId: targetStoreId,
              nodeId: 'cloud_core',
              hlc: reconciledHlc,
              idempotencyKey: idempotencyKey || undefined,
              payload: mergedDoc,
            });
          } else if (entity === 'coupons' && typeof mut?.deltaUsage === 'number') {
            const delta = Math.floor(Number(mut.deltaUsage));
            if (!Number.isFinite(delta) || delta < 1 || delta > 10) {
              return { status: 'REJECTED' as const, reason: 'INVALID_PAYLOAD' };
            }
            if (!existing || existing._deleted || existing.audience === 'MERCHANT') {
              return { status: 'REJECTED' as const, reason: 'RBAC_DENIED' };
            }
            const prevUsage = Number(existing.usageCount) || 0;
            const usageLimit = Number(existing.usageLimit);
            const nextUsage = Number.isFinite(usageLimit) && usageLimit > 0
              ? Math.min(usageLimit, prevUsage + delta)
              : prevUsage + delta;
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
          } else {
            if (entity === 'orders') {
              if (!edgeAuth && (authenticatedUser.role === 'WAITER' || authenticatedUser.role === 'KITCHEN_STAFF')) {
                if (!existing) {
                  return { status: 'REJECTED' as const, reason: 'PROTECTED_ORDER_FIELDS' };
                }
                for (const protectedField of PROTECTED_WAITER_KITCHEN_ORDER_FIELDS) {
                  if (
                    Object.prototype.hasOwnProperty.call(sanitizedIncomingPayload, protectedField) &&
                    JSON.stringify(sanitizedIncomingPayload[protectedField]) !== JSON.stringify(existing[protectedField])
                  ) {
                    return { status: 'REJECTED' as const, reason: 'PROTECTED_ORDER_FIELDS' };
                  }
                }
              }
              if (existing) {
                if (TERMINAL_ORDER_STATES.has(existing.status)) {
                  if (mut?.payload?.status && mut.payload.status !== existing.status) {
                    return { status: 'CONFLICT' as const, reason: 'TERMINAL_ORDER_STATE', serverRecord: existing };
                  }
                } else if (
                  sanitizedIncomingPayload.status !== undefined &&
                  sanitizedIncomingPayload.status !== existing.status &&
                  !isValidOrderStatusTransition(existing.status, String(sanitizedIncomingPayload.status))
                ) {
                  return { status: 'CONFLICT' as const, reason: 'INVALID_ORDER_TRANSITION', serverRecord: existing };
                }
              }
            }

            if (existing && existing.hlc && compareHlcTimestamps(incomingHlc, existing.hlc) < 0) {
              return { status: 'CONFLICT' as const, reason: 'STALE_HLC', serverRecord: existing };
            }

            const mergedDoc = {
              ...(existing || {}),
              ...sanitizedIncomingPayload,
              id: entityId,
              tenantId: targetTenantId,
              ...(targetStoreId ? { storeId: targetStoreId } : {}),
              hlc: incomingHlc,
              updatedAt: new Date().toISOString(),
            };

            const hasNonNeg = (obj: Record<string, any>, keys: string[]) =>
              keys.every((k) => {
                if (obj[k] === undefined || obj[k] === null) return true;
                const n = Number(obj[k]);
                return Number.isFinite(n) && n >= 0;
              });

            if (entity === 'tables' && mergedDoc.status !== undefined) {
              if (!['FREE', 'OCCUPIED', 'RESERVED', 'BILL_REQUESTED', 'CLEANING'].includes(String(mergedDoc.status))) {
                return { status: 'REJECTED' as const, reason: 'INVALID_PAYLOAD' };
              }
            } else if (entity === 'menu_items') {
              if (!hasNonNeg(mergedDoc, ['price', 'costPrice', 'stock', 'minStockAlert'])) {
                return { status: 'REJECTED' as const, reason: 'INVALID_PAYLOAD' };
              }
            } else if (entity === 'inventory_batches') {
              if (!hasNonNeg(mergedDoc, ['quantity', 'costPrice', 'costPerUnit', 'minQuantity'])) {
                return { status: 'REJECTED' as const, reason: 'INVALID_PAYLOAD' };
              }
            } else if (entity === 'cash_sessions') {
              if (
                !hasNonNeg(mergedDoc, ['initialCash', 'totalSales', 'totalSangrias', 'totalSuprimentos', 'finalCashCalculated']) ||
                (mergedDoc.status !== undefined && !['OPEN', 'CLOSED'].includes(String(mergedDoc.status)))
              ) {
                return { status: 'REJECTED' as const, reason: 'INVALID_PAYLOAD' };
              }
            } else if (entity === 'financial_records') {
              const amt = Number(mergedDoc.amount);
              if (
                (mergedDoc.type !== undefined && !['RECEIVABLE', 'PAYABLE'].includes(String(mergedDoc.type))) ||
                (mergedDoc.amount !== undefined && (!Number.isFinite(amt) || amt <= 0))
              ) {
                return { status: 'REJECTED' as const, reason: 'INVALID_PAYLOAD' };
              }
            } else if (entity === 'coupons') {
              if (
                !hasNonNeg(mergedDoc, ['discountValue', 'minOrderValue']) ||
                (mergedDoc.discountType === 'PERCENT' && Number(mergedDoc.discountValue) > 100)
              ) {
                return { status: 'REJECTED' as const, reason: 'INVALID_PAYLOAD' };
              }
            }

            tx.set(docRef, mergedDoc, { merge: true });
            stageSyncOutboxInTransaction(tx, {
              entity,
              entityId,
              operation: 'UPSERT',
              tenantId: targetTenantId,
              storeId: targetStoreId,
              nodeId: String(nodeId),
              hlc: incomingHlc,
              idempotencyKey: idempotencyKey || undefined,
              payload: mergedDoc,
            });
          }

          if (idempotencyKey) {
            const keyDocId = `${callerTenant}::${idempotencyKey}`;
            tx.set(
              db.collection('sync_processed_keys').doc(keyDocId),
              {
                id: keyDocId,
                tenantId: targetTenantId,
                nodeId: String(nodeId),
                entity,
                entityId,
                hlc: incomingHlc,
                processedAt: new Date().toISOString(),
              },
              { merge: false }
            );
          }

          return { status: 'ACCEPTED' as const };
        }, authenticatedUser.role !== 'DEV_OWNER' && entity !== 'consumers' && callerTenant ? { tenantId: callerTenant } : undefined);

        if (outcome.status === 'DEDUPLICATED') {
          deduplicated.push({ entity, entityId, idempotencyKey });
        } else if (outcome.status === 'ACCEPTED') {
          accepted.push({ entity, entityId, idempotencyKey, hlc: incomingHlc });
        } else if (outcome.status === 'CONFLICT') {
          conflicts.push({
            entity,
            entityId,
            idempotencyKey,
            reason: outcome.reason,
            incomingHlc,
            clientPayload: summarizeRecordForDlq(mut?.payload),
            serverRecord: outcome.serverRecord,
          });
        } else {
          rejected.push({
            entity,
            entityId,
            idempotencyKey,
            reason: outcome.reason,
            incomingHlc,
            clientPayload: summarizeRecordForDlq(mut?.payload),
          });
        }
      }

      const detectedAt = new Date().toISOString();
      const dlqItems = [
        ...conflicts.map((c) => ({
          kind: 'CONFLICT' as const,
          entity: c.entity,
          entityId: c.entityId,
          idempotencyKey: c.idempotencyKey || null,
          reason: c.reason,
          incomingHlc: c.incomingHlc,
          clientPayload: c.clientPayload || null,
          serverRecord: summarizeRecordForDlq(c.serverRecord),
        })),
        ...rejected.map((r) => ({
          kind: 'REJECTED' as const,
          entity: r.entity,
          entityId: r.entityId,
          idempotencyKey: r.idempotencyKey || null,
          reason: r.reason,
          incomingHlc: r.incomingHlc,
          clientPayload: r.clientPayload || null,
          serverRecord: null,
        })),
      ];

      for (const item of dlqItems.slice(0, 50)) {
        const conflictId = `scfl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        await db.collection('sync_conflicts').doc(conflictId).set({
          id: conflictId,
          status: 'OPEN',
          kind: item.kind,
          reason: item.reason,
          nodeId: String(nodeId),
          tenantId: callerTenant,
          storeId: storeId ? String(storeId) : null,
          actorUid: authenticatedUser?.uid || null,
          entity: item.entity,
          entityId: item.entityId,
          idempotencyKey: item.idempotencyKey,
          incomingHlc: item.incomingHlc,
          clientPayload: item.clientPayload,
          serverRecord: item.serverRecord,
          detectedAt,
        });
      }

      res.json({
        success: true,
        accepted,
        deduplicated,
        conflicts: conflicts.map(({ entity, entityId, idempotencyKey, reason, serverRecord }) => ({
          entity,
          entityId,
          idempotencyKey,
          reason,
          serverRecord,
        })),
        rejected: rejected.map(({ entity, entityId, idempotencyKey, reason }) => ({
          entity,
          entityId,
          idempotencyKey,
          reason,
        })),
        serverHlc: generateHlcTimestamp('cloud_core'),
      });
    } catch {
      res.status(500).json({ error: 'Erro ao processar lote de sincronização push.' });
    }
  }
);

router.use(syncPullAndLedgerRoutes);

export default router;
