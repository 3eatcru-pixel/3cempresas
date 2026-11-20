import express from 'express';
import { buildSyncOutboxEntry } from '../../../../src/server/persistence/PersistenceDriver.ts';
import { generateHlcTimestamp, generateIdempotencyKey } from '@3c/commerce-engine';
import { isValidOrderStatusTransition } from '@3c/contracts';
import { EDGE_STAFF_ROLES } from '../../helpers.ts';
import { EdgeRouteContext } from '../types.ts';

export function registerEdgeOrderStatusRoutes(app: express.Express, ctx: EdgeRouteContext): void {
  const { nodeId, storeId, tenantId, driver, authenticateEdge, requireEdgeRoles } = ctx;

  const handleEdgeOrderStatus = async (req: express.Request, res: express.Response) => {
    try {
      const { orderId } = req.params;
      const { status, cancelReason, driverId, driverName, deliveryPin } = req.body || {};
      const authenticatedUser = (req as any).user || {};
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ error: 'Novo status obrigatório.' });
      }

      const updatedOrder = await driver.runTransaction(async (tx) => {
        const orderSnap = await tx.get({ collectionName: 'orders', id: orderId });
        if (!orderSnap.exists) {
          const err: any = new Error(`Pedido '${orderId}' não encontrado no Edge Node.`);
          err.statusCode = 404;
          throw err;
        }
        const existing = orderSnap.data() || {};
        if (existing.storeId !== storeId) {
          const err: any = new Error('Pedido pertence a outra filial.');
          err.statusCode = 403;
          throw err;
        }
        if (existing.status !== status && !isValidOrderStatusTransition(existing.status, status)) {
          throw new Error(`Transição inválida no Edge Node: '${existing.status}' -> '${status}'.`);
        }

        if (authenticatedUser.role === 'COURIER') {
          if (status === 'OUT_FOR_DELIVERY') {
            if (existing.driverId && existing.driverId !== authenticatedUser.uid) {
              const err: any = new Error(`Acesso negado: Pedido já assumido pelo entregador '${existing.driverName || existing.driverId}'.`);
              err.statusCode = 403;
              throw err;
            }
            if (driverId && driverId !== authenticatedUser.uid) {
              const err: any = new Error('Acesso negado: Entregador não pode atribuir entregas para outro identificador.');
              err.statusCode = 403;
              throw err;
            }
          } else if (status === 'DELIVERED') {
            if (existing.driverId !== authenticatedUser.uid) {
              const err: any = new Error('Acesso negado: Apenas o entregador vinculado pode marcar o pedido como entregue.');
              err.statusCode = 403;
              throw err;
            }
          } else {
            const err: any = new Error(`Acesso negado: Entregador não pode alterar pedido para o status '${status}'.`);
            err.statusCode = 403;
            throw err;
          }
        }

        if (status === 'DELIVERED') {
          const expectedPin = existing.deliveryPin ? String(existing.deliveryPin).trim() : '';
          const mustValidatePin =
            deliveryPin !== undefined || (authenticatedUser.role === 'COURIER' && Boolean(expectedPin));
          if (mustValidatePin) {
            const submittedPin = String(deliveryPin ?? '').trim();
            if (expectedPin) {
              if (submittedPin !== expectedPin) {
                throw new Error('Código PIN de entrega inválido. Confirme os 4 dígitos com o cliente.');
              }
            } else if (!/^\d{4}$/.test(submittedPin)) {
              throw new Error('Código PIN de entrega inválido (informe 4 dígitos).');
            }
          }
        }

        const nowIso = new Date().toISOString();
        const hlc = generateHlcTimestamp(nodeId);
        const shouldSettleOnDelivery =
          status === 'DELIVERED' &&
          existing.paymentMethod !== 'TABLE_BILL' &&
          existing.paymentStatus !== 'PAID' &&
          (Number(existing.total) || 0) > 0;

        const nextOrder: Record<string, any> = {
          ...existing,
          status,
          hlc,
          updatedAt: nowIso,
          ...(cancelReason ? { cancelReason } : {}),
          ...(shouldSettleOnDelivery
            ? {
                paymentStatus: 'PAID',
                paymentConfirmationType: 'MANUAL_OPERATOR',
                settlementSource: 'ORDER_DELIVERY_SETTLEMENT',
                confirmedByUid: authenticatedUser.uid || null,
                confirmedByRole: authenticatedUser.role || null,
                confirmedAt: nowIso,
                paidAt: existing.paidAt || nowIso,
              }
            : {}),
        };

        if (authenticatedUser.role === 'COURIER') {
          nextOrder.driverId = authenticatedUser.uid;
          nextOrder.driverName = authenticatedUser.name || driverName || 'Entregador Parceiro';
        } else {
          if (driverId) nextOrder.driverId = driverId;
          if (driverName) nextOrder.driverName = driverName;
        }

        tx.set({ collectionName: 'orders', id: orderId }, nextOrder, { merge: true });
        const outbox = buildSyncOutboxEntry({
          entity: 'orders',
          entityId: orderId,
          operation: 'UPSERT',
          tenantId,
          storeId,
          nodeId,
          hlc,
          idempotencyKey: generateIdempotencyKey(),
          payload: nextOrder,
        });
        tx.set({ collectionName: 'sync_outbox', id: outbox.id }, outbox, { merge: false });

        if (shouldSettleOnDelivery) {
          const finSnap = await tx.get({ collectionName: 'financial_records', id: `fin-ord-${orderId}` });
          if (finSnap.exists && finSnap.data()?.status === 'PENDING') {
            const settledFin = {
              ...finSnap.data(),
              id: `fin-ord-${orderId}`,
              status: 'PAID',
              paymentConfirmationType: 'MANUAL_OPERATOR',
              settlementSource: 'ORDER_DELIVERY_SETTLEMENT',
              confirmedByUid: authenticatedUser.uid || null,
              confirmedByRole: authenticatedUser.role || null,
              confirmedAt: nowIso,
              paidAt: nowIso,
              hlc,
              updatedAt: nowIso,
            };
            tx.set({ collectionName: 'financial_records', id: settledFin.id }, settledFin, { merge: true });
            const finOutbox = buildSyncOutboxEntry({
              entity: 'financial_records',
              entityId: settledFin.id,
              operation: 'UPSERT',
              tenantId,
              storeId,
              nodeId,
              hlc,
              idempotencyKey: generateIdempotencyKey(),
              payload: settledFin,
            });
            tx.set({ collectionName: 'sync_outbox', id: finOutbox.id }, finOutbox, { merge: false });
          } else if (!finSnap.exists && (Number(existing.total) || 0) > 0) {
            const createdFin = {
              id: `fin-ord-${orderId}`,
              tenantId,
              storeId,
              type: 'RECEIVABLE',
              category: 'VENDAS',
              description: `Pedido Edge ${existing.code || orderId} liquidado na entrega`,
              amount: Number(existing.total) || 0,
              dueDate: nowIso.split('T')[0],
              status: 'PAID',
              paymentMethod: existing.paymentMethod || 'CASH',
              paymentConfirmationType: 'MANUAL_OPERATOR',
              settlementSource: 'ORDER_DELIVERY_SETTLEMENT',
              confirmedByUid: authenticatedUser.uid || null,
              confirmedByRole: authenticatedUser.role || null,
              confirmedAt: nowIso,
              paidAt: nowIso,
              orderId,
              hlc,
              createdAt: nowIso,
              updatedAt: nowIso,
            };
            tx.set({ collectionName: 'financial_records', id: createdFin.id }, createdFin, { merge: false });
            const finOutbox = buildSyncOutboxEntry({
              entity: 'financial_records',
              entityId: createdFin.id,
              operation: 'UPSERT',
              tenantId,
              storeId,
              nodeId,
              hlc,
              idempotencyKey: generateIdempotencyKey(),
              payload: createdFin,
            });
            tx.set({ collectionName: 'sync_outbox', id: finOutbox.id }, finOutbox, { merge: false });
          }

          const openCashSession = (await driver.listDocs<any>('cash_sessions'))
            .filter((s) => s.storeId === storeId && s.status === 'OPEN' && !s._deleted)
            .sort((a, b) => new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime())[0];
          if (openCashSession) {
            const orderTotal = Number(existing.total) || 0;
            const nextTotalSales = Math.round(((Number(openCashSession.totalSales) || 0) + orderTotal) * 100) / 100;
            const nextFinalCash = Math.round(((Number(openCashSession.finalCashCalculated) || 0) + orderTotal) * 100) / 100;
            const updatedCash = {
              ...openCashSession,
              totalSales: nextTotalSales,
              finalCashCalculated: nextFinalCash,
              hlc,
              updatedAt: nowIso,
            };
            tx.update({ collectionName: 'cash_sessions', id: openCashSession.id }, {
              totalSales: nextTotalSales,
              finalCashCalculated: nextFinalCash,
              hlc,
              updatedAt: nowIso,
            });
            const cashOutbox = buildSyncOutboxEntry({
              entity: 'cash_sessions',
              entityId: openCashSession.id,
              operation: 'UPSERT',
              tenantId,
              storeId,
              nodeId,
              hlc,
              idempotencyKey: generateIdempotencyKey(),
              payload: updatedCash,
            });
            tx.set({ collectionName: 'sync_outbox', id: cashOutbox.id }, cashOutbox, { merge: false });
          }
        }

        const resolvedDriverId =
          authenticatedUser.role === 'COURIER' ? authenticatedUser.uid : driverId || existing.driverId || null;
        if (status === 'DELIVERED' && resolvedDriverId) {
          const drvSnap = await tx.get({ collectionName: 'drivers', id: String(resolvedDriverId) });
          if (drvSnap.exists) {
            const drv = drvSnap.data() || {};
            const driverEarning = Math.round(((Number(existing.deliveryFee) || 0) + (Number(existing.courierTip) || 0)) * 100) / 100;
            const updatedDriver = {
              ...drv,
              status: 'AVAILABLE',
              currentOrderId: null,
              totalDeliveries: (Number(drv.totalDeliveries) || 0) + 1,
              walletBalance: Math.round(((Number(drv.walletBalance) || 0) + driverEarning) * 100) / 100,
              hlc,
              updatedAt: nowIso,
            };
            tx.set({ collectionName: 'drivers', id: String(resolvedDriverId) }, updatedDriver, { merge: true });
            const drvOutbox = buildSyncOutboxEntry({
              entity: 'drivers',
              entityId: String(resolvedDriverId),
              operation: 'UPSERT',
              tenantId,
              storeId,
              nodeId,
              hlc,
              idempotencyKey: generateIdempotencyKey(),
              payload: updatedDriver,
            });
            tx.set({ collectionName: 'sync_outbox', id: drvOutbox.id }, drvOutbox, { merge: false });
          }
        }

        return nextOrder;
      });

      return res.json({ success: true, order: updatedOrder });
    } catch (err: any) {
      const statusCode = err?.statusCode || (err?.message?.includes('Acesso negado') ? 403 : 400);
      return res.status(statusCode).json({ error: err?.message || 'Erro ao atualizar status no Edge Node.' });
    }
  };

  app.post('/api/v1/commerce/orders/:orderId/status', authenticateEdge, requireEdgeRoles([...EDGE_STAFF_ROLES, 'COURIER']), handleEdgeOrderStatus);
  app.put('/api/v1/commerce/orders/:orderId/status', authenticateEdge, requireEdgeRoles([...EDGE_STAFF_ROLES, 'COURIER']), handleEdgeOrderStatus);
}
