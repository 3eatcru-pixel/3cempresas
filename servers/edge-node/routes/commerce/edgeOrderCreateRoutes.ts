import express from 'express';
import { idempotencyGuard } from '../../../../src/server/middleware/contracts.ts';
import { buildSyncOutboxEntry } from '../../../../src/server/persistence/PersistenceDriver.ts';
import {
  generateHlcTimestamp,
  generateIdempotencyKey,
  generateOrderId,
} from '@3c/commerce-engine';
import {
  EDGE_POS_AND_TABLE_ROLES,
  stripEdgePrototypePollution,
} from '../../helpers.ts';
import { EdgeRouteContext } from '../types.ts';
import {
  applyEdgeOrderStockAndCouponWrites,
  computeEdgeDeliveryAndDiscount,
  consolidateEdgeOrderLines,
  prepareEdgeOrderStockAndBom,
} from './edgeOrderBomHelper.ts';
import { applyEdgeOrderPostEffects } from './edgeOrderPostEffectsHelper.ts';

export function registerEdgeOrderCreateRoutes(app: express.Express, ctx: EdgeRouteContext): void {
  const { nodeId, storeId, tenantId, driver, authenticateEdge, requireEdgeRoles } = ctx;

  app.get('/api/v1/commerce/coupons', async (_req, res) => {
    const coupons = await driver.listDocs<any>('coupons');
    const nowMs = Date.now();
    return res.json(
      coupons.filter((c) => {
        if (!c || c._deleted || c.isActive === false) return false;
        if (c.audience === 'MERCHANT') return false;
        if (c.storeId && c.storeId !== storeId) return false;
        const valDate = c.validUntil || c.expiresAt;
        if (valDate) {
          const expTs = new Date(valDate).getTime();
          if (!Number.isFinite(expTs) || expTs < nowMs) return false;
        }
        return true;
      })
    );
  });

  app.get('/api/v1/commerce/orders', authenticateEdge, async (req, res) => {
    const user = (req as any).user;
    const orders = await driver.listDocs<any>('orders');
    let scoped = orders.filter((o) => o.storeId === storeId && !o._deleted);
    if (user.role === 'CUSTOMER' || user.role === 'CONSUMER') {
      scoped = scoped.filter((o) => o.customerId === user.uid);
    }
    res.json(scoped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  });

  app.post(
    '/api/v1/commerce/orders',
    authenticateEdge,
    requireEdgeRoles(EDGE_POS_AND_TABLE_ROLES),
    idempotencyGuard,
    async (req, res) => {
      try {
        const authenticatedUser = (req as any).user;
        const cleanOrderBody = stripEdgePrototypePollution(req.body || {});
        const {
          storeId: bodyStoreId = storeId,
          items,
          crmCustomerId,
          customerName,
          customerPhone,
          deliveryAddress,
          notes,
          couponCode,
          paymentMethod = 'PIX',
          paymentConfirmed,
          providerTransactionId,
          channel = 'POS',
          deliveryModality = 'PICKUP',
          tableNumber,
          professionalId,
          professionalName,
          commissionRate,
          commissionAmount,
          reservationId,
          scheduledDeliveryDate,
          scheduledDeliveryPeriod,
          assemblyRequired,
        } = cleanOrderBody;

        if (bodyStoreId !== storeId) {
          return res.status(403).json({ error: 'Pedido não pertence à loja deste Edge Node.' });
        }
        if (!Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ error: 'Lista de itens obrigatória.' });
        }
        if (items.length > 50) {
          return res.status(400).json({ error: 'Limite de 50 itens distintos por pedido no Edge Node.' });
        }

        const rawHeaderIdemKey = (req as any).clientContext?.idempotencyKey || cleanOrderBody?.idempotencyKey;
        const explicitIdempotencyKey =
          typeof rawHeaderIdemKey === 'string' && rawHeaderIdemKey.trim().length > 0
            ? rawHeaderIdemKey.trim()
            : null;
        const callerScopedEdgeIdemId = explicitIdempotencyKey
          ? `${authenticatedUser?.uid || 'anon'}::${explicitIdempotencyKey}`
          : null;

        const result = await driver.runTransaction(async (tx) => {
          if (callerScopedEdgeIdemId) {
            const idemSnap = await tx.get({ collectionName: 'order_idempotency_keys', id: callerScopedEdgeIdemId });
            if (idemSnap.exists) {
              const cachedOrderId = idemSnap.data()?.orderId;
              const cachedOrderSnap = cachedOrderId
                ? await tx.get({ collectionName: 'orders', id: cachedOrderId })
                : null;
              if (cachedOrderSnap?.exists) {
                return { __deduplicated: true, order: cachedOrderSnap.data() };
              }
            }
          }

          const storeSnap = await tx.get({ collectionName: 'stores', id: storeId });
          const storeData = storeSnap.data() || { id: storeId, category: 'RESTAURANT', deliveryFee: 0 };
          const hlc = generateHlcTimestamp(nodeId);
          const nowIso = new Date().toISOString();
          const orderId = generateOrderId();
          const orderCode = `#E${Math.floor(1000 + Math.random() * 9000)}`;
          const idempotencyKey = explicitIdempotencyKey || generateIdempotencyKey();

          const { consolidatedLines, totalQtyByMenuItem } = consolidateEdgeOrderLines(items);
          const { productWorkingState, validatedItems, calculatedSubtotal, ingredientBatchDeductions } =
            await prepareEdgeOrderStockAndBom({
              tx,
              driver,
              storeId,
              storeData,
              consolidatedLines,
              totalQtyByMenuItem,
            });

          const subtotal = Math.round(calculatedSubtotal * 100) / 100;
          const { numDeliveryFee, numDiscount, couponUpdateTarget } = await computeEdgeDeliveryAndDiscount({
            driver,
            storeId,
            storeData,
            subtotal,
            deliveryModality,
            channel,
            couponCode,
          });

          const validatedTotal = Math.max(0, Math.round((subtotal + numDeliveryFee - numDiscount) * 100) / 100);
          if (commissionRate !== undefined && commissionRate !== null) {
            const parsedRate = Number(commissionRate);
            if (!Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 100) {
              throw new Error('Taxa de comissão (commissionRate) inválida: deve estar entre 0 e 100.');
            }
          }
          if (commissionAmount !== undefined && commissionAmount !== null) {
            const parsedCommAmt = Number(commissionAmount);
            if (!Number.isFinite(parsedCommAmt) || parsedCommAmt < 0 || parsedCommAmt > validatedTotal) {
              throw new Error('Valor de comissão (commissionAmount) inválido: deve estar entre 0 e o total do pedido.');
            }
          }

          applyEdgeOrderStockAndCouponWrites({
            tx,
            tenantId,
            storeId,
            nodeId,
            hlc,
            nowIso,
            orderId,
            orderCode,
            couponUpdateTarget,
            productWorkingState,
            ingredientBatchDeductions,
          });

          const COUNTER_SETTLEMENT_ROLES = new Set([
            'DEV_OWNER',
            'SUPER_ADMIN',
            'REGIONAL_MANAGER',
            'STORE_OWNER',
            'STORE_MANAGER',
            'CASHIER',
          ]);
          const rawEdgeOperatorRef =
            typeof providerTransactionId === 'string' ? providerTransactionId.trim() : '';
          const validEdgeOperatorRef =
            rawEdgeOperatorRef && !rawEdgeOperatorRef.toUpperCase().startsWith('POS-TX-')
              ? rawEdgeOperatorRef
              : undefined;
          const isExplicitEdgePaymentConfirmed =
            COUNTER_SETTLEMENT_ROLES.has(authenticatedUser.role) &&
            (paymentMethod === 'CASH' || paymentConfirmed === true);
          const isEdgeOrderPaid = paymentMethod !== 'TABLE_BILL' && isExplicitEdgePaymentConfirmed;

          const newOrder = {
            id: orderId,
            code: orderCode,
            storeId,
            tenantId,
            channel,
            deliveryModality,
            tableNumber: (channel === 'TABLE' || channel === 'WAITER_TABLE') ? (tableNumber ?? null) : null,
            customerId: authenticatedUser?.uid || null,
            customerName: customerName || 'Cliente Balcão Edge',
            customerPhone: customerPhone || null,
            deliveryAddress: deliveryAddress || null,
            notes: notes || null,
            couponCode: couponCode || null,
            items: validatedItems,
            subtotal,
            deliveryFee: numDeliveryFee,
            discount: numDiscount,
            total: validatedTotal,
            paymentMethod,
            paymentStatus: isEdgeOrderPaid ? 'PAID' : 'PENDING',
            ...(isEdgeOrderPaid
              ? {
                  paymentConfirmationType: 'MANUAL_OPERATOR',
                  settlementSource: 'POS_OPERATOR_COUNTER',
                  confirmedByUid: authenticatedUser.uid || null,
                  confirmedByRole: authenticatedUser.role || null,
                  confirmedAt: nowIso,
                  paidAt: nowIso,
                  ...(validEdgeOperatorRef ? { operatorReferenceId: validEdgeOperatorRef } : {}),
                }
              : {}),
            status: 'CONFIRMED',
            professionalId: professionalId || null,
            professionalName: professionalName || null,
            commissionRate:
              commissionRate !== undefined && commissionRate !== null
                ? Math.round(Number(commissionRate) * 100) / 100
                : null,
            commissionAmount:
              commissionAmount !== undefined && commissionAmount !== null
                ? Math.round(Number(commissionAmount) * 100) / 100
                : null,
            reservationId: reservationId || null,
            scheduledDeliveryDate: scheduledDeliveryDate || null,
            scheduledDeliveryPeriod: scheduledDeliveryPeriod || null,
            assemblyRequired: typeof assemblyRequired === 'boolean' ? assemblyRequired : null,
            originNodeId: nodeId,
            hlc,
            idempotencyKey,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          tx.set({ collectionName: 'orders', id: orderId }, newOrder, { merge: false });

          const orderOutbox = buildSyncOutboxEntry({
            entity: 'orders',
            entityId: orderId,
            operation: 'UPSERT',
            tenantId,
            storeId,
            nodeId,
            hlc,
            idempotencyKey,
            payload: newOrder,
          });
          tx.set({ collectionName: 'sync_outbox', id: orderOutbox.id }, orderOutbox, { merge: false });

          await applyEdgeOrderPostEffects({
            tx,
            driver,
            tenantId,
            storeId,
            nodeId,
            hlc,
            nowIso,
            orderId,
            orderCode,
            channel,
            paymentMethod,
            validatedTotal,
            isEdgeOrderPaid,
            tableNumber,
            reservationId,
            crmCustomerId,
            callerScopedEdgeIdemId,
            explicitIdempotencyKey,
            callerUid: authenticatedUser?.uid,
          });

          return { __deduplicated: false, order: newOrder };
        });

        if (result.__deduplicated) {
          res.setHeader('X-3C-Idempotent-Replay', 'true');
          return res.status(201).json({
            success: true,
            deduplicated: true,
            transaction: { orderId: result.order.id, ...result.order },
          });
        }

        res.status(201).json({ success: true, transaction: { orderId: result.order.id, ...result.order } });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || 'Erro ao processar pedido no Edge Node.' });
      }
    }
  );
}
