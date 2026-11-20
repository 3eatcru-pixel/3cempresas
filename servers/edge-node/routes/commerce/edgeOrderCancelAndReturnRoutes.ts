import express from 'express';
import {
  buildStockLedgerEntry,
  buildSyncOutboxEntry,
} from '../../../../src/server/persistence/PersistenceDriver.ts';
import { generateHlcTimestamp, generateIdempotencyKey } from '@3c/commerce-engine';
import { EdgeRouteContext } from '../types.ts';

export function registerEdgeOrderCancelAndReturnRoutes(app: express.Express, ctx: EdgeRouteContext): void {
  const { nodeId, storeId, tenantId, driver, authenticateEdge, requireEdgeRoles } = ctx;

  app.post('/api/v1/commerce/orders/:orderId/cancel', authenticateEdge, async (req, res) => {
    try {
      const { orderId } = req.params;
      const { reason } = req.body || {};
      const authenticatedUser = (req as any).user || {};

      const txResult = await driver.runTransaction(async (tx) => {
        const orderSnap = await tx.get({ collectionName: 'orders', id: orderId });
        if (!orderSnap.exists) {
          const err: any = new Error(`Pedido '${orderId}' não encontrado no Edge Node.`);
          err.statusCode = 404;
          throw err;
        }
        const orderData = orderSnap.data() || {};
        const isConsumer = authenticatedUser.role === 'CUSTOMER' || authenticatedUser.role === 'CONSUMER';

        if (isConsumer) {
          if (orderData.customerId !== authenticatedUser.uid) {
            const err: any = new Error('Acesso negado: Pedido pertence a outro consumidor.');
            err.statusCode = 403;
            throw err;
          }
          if (orderData.status !== 'PENDING') {
            throw new Error(`Não é possível cancelar após confirmação pela loja (status atual: ${orderData.status}).`);
          }
        } else if (authenticatedUser.role !== 'DEV_OWNER') {
          if (!['SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER', 'WAITER'].includes(authenticatedUser.role)) {
            const err: any = new Error('Acesso negado: Perfil não autorizado a cancelar este pedido.');
            err.statusCode = 403;
            throw err;
          }
          if (orderData.storeId !== storeId) {
            const err: any = new Error('Acesso negado: Pedido pertence a outra filial.');
            err.statusCode = 403;
            throw err;
          }
        }

        if (orderData.status === 'DELIVERED' || orderData.status === 'CANCELLED') {
          throw new Error(`Pedido em estado final '${orderData.status}' não pode ser cancelado.`);
        }

        const itemsList: any[] = Array.isArray(orderData.items) ? orderData.items : [];
        const restoredByMenu = new Map<string, { qty: number; variants: Map<string, { qty: number; label?: string }> }>();
        for (const it of itemsList) {
          if (!it.menuItemId) continue;
          const alreadyReturned = Number(it.returnedQuantity) || 0;
          const qtyToRestore = Math.max(0, (Number(it.quantity) || 0) - alreadyReturned);
          if (qtyToRestore <= 0) continue;
          const entry = restoredByMenu.get(it.menuItemId) || { qty: 0, variants: new Map() };
          entry.qty += qtyToRestore;
          if (it.variantId) {
            const prevV = entry.variants.get(it.variantId) || { qty: 0, label: it.variantLabel };
            prevV.qty += qtyToRestore;
            entry.variants.set(it.variantId, prevV);
          }
          restoredByMenu.set(it.menuItemId, entry);
        }

        const nowIso = new Date().toISOString();
        const cancelHlc = generateHlcTimestamp(nodeId);

        for (const [menuId, info] of restoredByMenu.entries()) {
          const menuSnap = await tx.get({ collectionName: 'menu_items', id: menuId });
          if (!menuSnap.exists) continue;
          const menuData = menuSnap.data() || {};
          const isServiceItem = menuData.specs?.segment === 'SERVICE';
          if (isServiceItem || typeof menuData.stock !== 'number') continue;

          const prevStock = Number(menuData.stock) || 0;
          const nextStock = prevStock + info.qty;
          const menuPatch: Record<string, any> = {
            stock: nextStock,
            hlc: cancelHlc,
            updatedAt: nowIso,
          };

          const clonedVariants = Array.isArray(menuData.variants)
            ? menuData.variants.map((v: any) => ({ ...v }))
            : null;
          const variantDeltas: Array<{ variantId: string; deltaQty: number }> = [];

          for (const [variantId, vInfo] of info.variants.entries()) {
            if (!clonedVariants) break;
            const vIdx = clonedVariants.findIndex((v: any) => v.id === variantId);
            if (vIdx >= 0) {
              const prevVarStock = Number(clonedVariants[vIdx].stock) || 0;
              const nextVarStock = prevVarStock + vInfo.qty;
              clonedVariants[vIdx].stock = nextVarStock;
              variantDeltas.push({ variantId, deltaQty: vInfo.qty });
              const vLedger = buildStockLedgerEntry({
                tenantId,
                storeId,
                itemType: 'VARIANT',
                targetId: `${menuId}::${variantId}`,
                itemName: `${menuData.name || menuId} [${vInfo.label || variantId}]`,
                deltaQty: vInfo.qty,
                previousQty: prevVarStock,
                balanceAfter: nextVarStock,
                reason: 'RETURN',
                orderId,
                orderCode: orderData.code,
                nodeId,
                hlc: cancelHlc,
              });
              tx.set({ collectionName: 'stock_ledger', id: vLedger.id }, vLedger, { merge: false });
            }
          }
          if (clonedVariants) {
            menuPatch.variants = clonedVariants;
          }

          tx.update({ collectionName: 'menu_items', id: menuId }, menuPatch);
          const mLedger = buildStockLedgerEntry({
            tenantId,
            storeId,
            itemType: 'MENU_ITEM',
            targetId: menuId,
            itemName: menuData.name || menuId,
            deltaQty: info.qty,
            previousQty: prevStock,
            balanceAfter: nextStock,
            reason: 'RETURN',
            orderId,
            orderCode: orderData.code,
            nodeId,
            hlc: cancelHlc,
          });
          tx.set({ collectionName: 'stock_ledger', id: mLedger.id }, mLedger, { merge: false });
          const menuOutbox = {
            ...buildSyncOutboxEntry({
              entity: 'menu_items',
              entityId: menuId,
              operation: 'UPSERT',
              tenantId,
              storeId,
              nodeId,
              hlc: cancelHlc,
              idempotencyKey: generateIdempotencyKey(),
              payload: { id: menuId, name: menuData.name },
            }),
            deltaQty: info.qty,
            ...(variantDeltas.length > 0 ? { variantDeltas } : {}),
          };
          tx.set({ collectionName: 'sync_outbox', id: menuOutbox.id }, menuOutbox, { merge: false });
        }

        const cancelReasonText =
          typeof reason === 'string' && reason.trim()
            ? reason.trim().slice(0, 180)
            : isConsumer
            ? 'Cancelado pelo consumidor antes da confirmação'
            : 'Cancelado pela loja no Edge';

        const orderPatch = {
          status: 'CANCELLED',
          cancelReason: cancelReasonText,
          cancelledBy: authenticatedUser.uid,
          cancelledAt: nowIso,
          hlc: cancelHlc,
          updatedAt: nowIso,
        };
        tx.update({ collectionName: 'orders', id: orderId }, orderPatch);

        const finOrdId = `fin-ord-${orderId}`;
        const finOrdSnap = await tx.get({ collectionName: 'financial_records', id: finOrdId });
        if (orderData.paymentMethod !== 'TABLE_BILL' && (Number(orderData.total) || 0) > 0) {
          if (finOrdSnap.exists && finOrdSnap.data()?.status === 'PENDING') {
            const cancelledFin = {
              ...finOrdSnap.data(),
              id: finOrdId,
              status: 'CANCELLED',
              hlc: cancelHlc,
              updatedAt: nowIso,
            };
            tx.update({ collectionName: 'financial_records', id: finOrdId }, {
              status: 'CANCELLED',
              hlc: cancelHlc,
              updatedAt: nowIso,
            });
            const finOutbox = buildSyncOutboxEntry({
              entity: 'financial_records',
              entityId: finOrdId,
              operation: 'UPSERT',
              tenantId,
              storeId,
              nodeId,
              hlc: cancelHlc,
              idempotencyKey: generateIdempotencyKey(),
              payload: cancelledFin,
            });
            tx.set({ collectionName: 'sync_outbox', id: finOutbox.id }, finOutbox, { merge: false });
          } else {
            const finId = `fin-can-${orderId}`;
            const finRecord = {
              id: finId,
              tenantId,
              storeId,
              type: 'PAYABLE',
              category: 'Estorno / Cancelamento',
              description: `Cancelamento Edge ${orderData.code || orderId}: ${cancelReasonText}`,
              amount: Math.max(0, (Number(orderData.total) || 0) - (Number(orderData.refundedTotal) || 0)),
              dueDate: nowIso.slice(0, 10),
              status: 'PAID',
              orderId,
              hlc: cancelHlc,
              createdAt: nowIso,
              updatedAt: nowIso,
            };
            tx.set({ collectionName: 'financial_records', id: finId }, finRecord, { merge: true });
            const finOutbox = buildSyncOutboxEntry({
              entity: 'financial_records',
              entityId: finId,
              operation: 'UPSERT',
              tenantId,
              storeId,
              nodeId,
              hlc: cancelHlc,
              idempotencyKey: generateIdempotencyKey(),
              payload: finRecord,
            });
            tx.set({ collectionName: 'sync_outbox', id: finOutbox.id }, finOutbox, { merge: false });
          }
        }

        const nextOrder = { ...orderData, ...orderPatch, id: orderId };
        const ordOutbox = buildSyncOutboxEntry({
          entity: 'orders',
          entityId: orderId,
          operation: 'UPSERT',
          tenantId,
          storeId,
          nodeId,
          hlc: cancelHlc,
          idempotencyKey: generateIdempotencyKey(),
          payload: nextOrder,
        });
        tx.set({ collectionName: 'sync_outbox', id: ordOutbox.id }, ordOutbox, { merge: false });

        return { order: nextOrder };
      });

      return res.json({ success: true, orderId, status: 'CANCELLED', order: txResult.order });
    } catch (err: any) {
      return res.status(err?.statusCode || 400).json({ error: err?.message || 'Erro ao cancelar pedido no Edge Node.' });
    }
  });

  app.post(
    '/api/v1/commerce/orders/:orderId/return',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER']),
    async (req, res) => {
      const { orderId } = req.params;
      const { itemIndex, menuItemId, variantId, quantity = 1, reason } = req.body || {};
      const qtyToReturn = Number(quantity);
      if (isNaN(qtyToReturn) || !Number.isInteger(qtyToReturn) || qtyToReturn <= 0 || qtyToReturn > 100) {
        return res.status(400).json({ error: 'Quantidade para devolução inválida: inteiro entre 1 e 100.' });
      }

      try {
        const txResult = await driver.runTransaction(async (tx) => {
          const orderSnap = await tx.get({ collectionName: 'orders', id: orderId });
          if (!orderSnap.exists) {
            const err: any = new Error(`Pedido '${orderId}' não encontrado no Edge Node.`);
            err.statusCode = 404;
            throw err;
          }
          const orderData = orderSnap.data() || {};
          if (orderData.storeId !== storeId) {
            const err: any = new Error('Acesso negado: Pedido pertence a outra filial.');
            err.statusCode = 403;
            throw err;
          }
          if (orderData.status === 'CANCELLED') {
            throw new Error('Pedido cancelado não permite devolução individual de item.');
          }

          const itemsList: any[] = Array.isArray(orderData.items) ? orderData.items.map((it: any) => ({ ...it })) : [];
          let resolvedIndex = -1;
          if (typeof itemIndex === 'number' && Number.isInteger(itemIndex) && itemIndex >= 0 && itemIndex < itemsList.length) {
            resolvedIndex = itemIndex;
          } else if (menuItemId) {
            resolvedIndex = itemsList.findIndex(
              (it: any) => it.menuItemId === menuItemId && (!variantId || it.variantId === variantId)
            );
          }
          if (resolvedIndex < 0 || !itemsList[resolvedIndex]) {
            throw new Error('Item especificado não localizado neste pedido.');
          }

          const targetItem = itemsList[resolvedIndex];
          const purchasedQty = Number(targetItem.quantity) || 0;
          const alreadyReturned = Number(targetItem.returnedQuantity) || 0;
          const remainingReturnable = purchasedQty - alreadyReturned;
          if (remainingReturnable <= 0 || qtyToReturn > remainingReturnable) {
            throw new Error(
              `Quantidade solicitada para estorno (${qtyToReturn}) excede o saldo disponível (${Math.max(0, remainingReturnable)}).`
            );
          }

          const menuSnap = targetItem.menuItemId
            ? await tx.get({ collectionName: 'menu_items', id: targetItem.menuItemId })
            : null;

          const nowIso = new Date().toISOString();
          const returnHlc = generateHlcTimestamp(nodeId);
          const nextReturned = alreadyReturned + qtyToReturn;
          const rawRefundAmount = Math.round((Number(targetItem.price) || 0) * qtyToReturn * 100) / 100;
          const maxRefundRemaining = Math.max(
            0,
            Math.round(((Number(orderData.total) || 0) - (Number(orderData.refundedTotal) || 0)) * 100) / 100
          );
          const refundAmount = Math.min(rawRefundAmount, maxRefundRemaining);

          targetItem.returnedQuantity = nextReturned;
          targetItem.returnedAt = nowIso;
          targetItem.returnReason = typeof reason === 'string' && reason.trim()
            ? reason.trim().slice(0, 180)
            : 'Devolução / Troca PDV Edge';
          itemsList[resolvedIndex] = targetItem;

          const nextRefundedTotal = Math.round(((Number(orderData.refundedTotal) || 0) + refundAmount) * 100) / 100;
          const updatedOrder = {
            ...orderData,
            id: orderId,
            items: itemsList,
            refundedTotal: nextRefundedTotal,
            hlc: returnHlc,
            updatedAt: nowIso,
          };

          let stockRestored = 0;
          if (menuSnap && menuSnap.exists) {
            const menuData = menuSnap.data() || {};
            const isServiceItem = menuData.specs?.segment === 'SERVICE';
            if (!isServiceItem && typeof menuData.stock === 'number') {
              const prevStock = Number(menuData.stock) || 0;
              const nextStock = prevStock + qtyToReturn;
              stockRestored = qtyToReturn;
              const menuPatch: Record<string, any> = { stock: nextStock, hlc: returnHlc, updatedAt: nowIso };
              if (targetItem.variantId && Array.isArray(menuData.variants)) {
                const clonedVariants = menuData.variants.map((v: any) => ({ ...v }));
                const vIdx = clonedVariants.findIndex((v: any) => v.id === targetItem.variantId);
                if (vIdx >= 0) {
                  const prevVar = Number(clonedVariants[vIdx].stock) || 0;
                  const nextVar = prevVar + qtyToReturn;
                  clonedVariants[vIdx].stock = nextVar;
                  menuPatch.variants = clonedVariants;
                  const vLedger = buildStockLedgerEntry({
                    tenantId,
                    storeId,
                    itemType: 'VARIANT',
                    targetId: `${targetItem.menuItemId}::${targetItem.variantId}`,
                    itemName: `${menuData.name || targetItem.name} [${targetItem.variantLabel || targetItem.variantId}]`,
                    deltaQty: qtyToReturn,
                    previousQty: prevVar,
                    balanceAfter: nextVar,
                    reason: 'RETURN',
                    orderId,
                    orderCode: orderData.code,
                    nodeId,
                    hlc: returnHlc,
                  });
                  tx.set({ collectionName: 'stock_ledger', id: vLedger.id }, vLedger, { merge: false });
                }
              }
              tx.update({ collectionName: 'menu_items', id: targetItem.menuItemId }, menuPatch);
              const mLedger = buildStockLedgerEntry({
                tenantId,
                storeId,
                itemType: 'MENU_ITEM',
                targetId: targetItem.menuItemId,
                itemName: menuData.name || targetItem.name,
                deltaQty: qtyToReturn,
                previousQty: prevStock,
                balanceAfter: nextStock,
                reason: 'RETURN',
                orderId,
                orderCode: orderData.code,
                nodeId,
                hlc: returnHlc,
              });
              tx.set({ collectionName: 'stock_ledger', id: mLedger.id }, mLedger, { merge: false });
              const menuOutbox = buildSyncOutboxEntry({
                entity: 'menu_items',
                entityId: targetItem.menuItemId,
                operation: 'UPSERT',
                tenantId,
                storeId,
                nodeId,
                hlc: returnHlc,
                idempotencyKey: generateIdempotencyKey(),
                payload: { ...menuData, ...menuPatch, id: targetItem.menuItemId },
              });
              tx.set({ collectionName: 'sync_outbox', id: menuOutbox.id }, menuOutbox, { merge: false });
            }
          }

          const finId = `fin-ret-${orderId}-${resolvedIndex}-${nextReturned}`;
          const finRecord = {
            id: finId,
            storeId,
            tenantId,
            type: 'PAYABLE',
            description: `Estorno/Devolução Edge (${orderData.code || orderId}): ${qtyToReturn}x ${targetItem.name}`,
            category: 'Estorno / Troca PDV',
            amount: refundAmount,
            dueDate: nowIso.slice(0, 10),
            status: 'PAID',
            entityName: orderData.customerName || 'Cliente Balcão',
            paymentMethod: orderData.paymentMethod || 'CASH',
            orderId,
            hlc: returnHlc,
            createdAt: nowIso,
          };

          tx.set({ collectionName: 'financial_records', id: finId }, finRecord, { merge: true });
          tx.update({ collectionName: 'orders', id: orderId }, {
            items: itemsList,
            refundedTotal: nextRefundedTotal,
            hlc: returnHlc,
            updatedAt: nowIso,
          });
          const finOutbox = buildSyncOutboxEntry({
            entity: 'financial_records',
            entityId: finId,
            operation: 'UPSERT',
            tenantId,
            storeId,
            nodeId,
            hlc: returnHlc,
            idempotencyKey: generateIdempotencyKey(),
            payload: finRecord,
          });
          const ordOutbox = buildSyncOutboxEntry({
            entity: 'orders',
            entityId: orderId,
            operation: 'UPSERT',
            tenantId,
            storeId,
            nodeId,
            hlc: returnHlc,
            idempotencyKey: generateIdempotencyKey(),
            payload: updatedOrder,
          });
          tx.set({ collectionName: 'sync_outbox', id: finOutbox.id }, finOutbox, { merge: false });
          tx.set({ collectionName: 'sync_outbox', id: ordOutbox.id }, ordOutbox, { merge: false });

          return {
            resolvedIndex,
            returnedQuantity: nextReturned,
            refundAmount,
            stockRestored,
            financialRecord: finRecord,
            order: updatedOrder,
          };
        });

        return res.json({
          success: true,
          orderId,
          itemIndex: txResult.resolvedIndex,
          returnedQuantity: txResult.returnedQuantity,
          refundAmount: txResult.refundAmount,
          stockRestored: txResult.stockRestored,
          financialRecord: txResult.financialRecord,
          order: txResult.order,
        });
      } catch (err: any) {
        return res.status(err?.statusCode || 400).json({ error: err?.message || 'Erro ao processar estorno no Edge.' });
      }
    }
  );
}
