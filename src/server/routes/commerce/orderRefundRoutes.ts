import express from 'express';
import { db, runWithSystemDbContext } from '../../config.ts';
import { verifyAutonomousToken, requireRoles, hasUserStoreAccess } from '../../middleware/auth.ts';
import { broadcastSseEvent } from '../../state.ts';
import { generateHlcTimestamp } from '../../../utils/idGenerator.ts';
import { stageSyncOutboxInTransaction } from '../../persistence/PersistenceDriver.ts';
import {
  restoreMenuItemStockInTransaction,
  VariantRestoreRequest,
} from './orderInventoryHelpers.ts';

const router = express.Router();

router.post('/orders/:orderId/cancel', verifyAutonomousToken, async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body || {};
  const authenticatedUser = (req as any).user;

  try {
    const isConsumerCaller = authenticatedUser.role === 'CUSTOMER' || authenticatedUser.role === 'CONSUMER';
    let targetTenantId: string | undefined;
    if (isConsumerCaller) {
      const preSnap = await runWithSystemDbContext('CONSUMER_ORDER_CANCEL_LOOKUP', () =>
        db.collection('orders').doc(orderId).get()
      );
      if (!preSnap.exists) {
        throw new Error(`Pedido '${orderId}' não encontrado.`);
      }
      const preData = preSnap.data() || {};
      if (preData.customerId !== authenticatedUser.uid) {
        throw new Error('Acesso negado: Pedido pertence a outro consumidor.');
      }
      targetTenantId = preData.tenantId ? String(preData.tenantId) : undefined;
    }

    const txResult = await db.runTransaction(async (transaction) => {
      const orderRef = db.collection('orders').doc(orderId);
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists) {
        throw new Error(`Pedido '${orderId}' não encontrado.`);
      }

      const orderData = orderSnap.data() || {};
      const isConsumer = authenticatedUser.role === 'CUSTOMER' || authenticatedUser.role === 'CONSUMER';

      if (isConsumer) {
        if (orderData.customerId !== authenticatedUser.uid) {
          throw new Error('Acesso negado: Pedido pertence a outro consumidor.');
        }
        if (orderData.status !== 'PENDING') {
          throw new Error(`Não é possível cancelar pelo Marketplace após confirmação pela loja (status atual: ${orderData.status}).`);
        }
      } else {
        if (!['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER', 'WAITER'].includes(authenticatedUser.role)) {
          throw new Error('Acesso negado: Perfil não autorizado a cancelar este pedido.');
        }
        if (orderData.tenantId !== authenticatedUser.tenantId) {
          throw new Error('Acesso negado: Pedido pertence a outra empresa/tenant.');
        }
        if (!hasUserStoreAccess(authenticatedUser, orderData.storeId)) {
          throw new Error('Acesso negado: Pedido pertence a outra filial.');
        }
      }

      if (orderData.status === 'DELIVERED' || orderData.status === 'CANCELLED') {
        throw new Error(`Pedido em estado final '${orderData.status}' não pode ser cancelado.`);
      }

      const itemsList: any[] = Array.isArray(orderData.items) ? orderData.items : [];
      const uniqueMenuIds = Array.from(new Set(itemsList.map((it: any) => it.menuItemId).filter(Boolean)));
      const finOrdRef = db.collection('financial_records').doc(`fin-ord-${orderId}`);
      const [finOrdSnap, ...menuSnaps] = await Promise.all([
        transaction.get(finOrdRef),
        ...uniqueMenuIds.map((id) => transaction.get(db.collection('menu_items').doc(id))),
      ]);
      const menuMap = new Map<string, any>();
      uniqueMenuIds.forEach((id, idx) => {
        if (menuSnaps[idx]?.exists) {
          menuMap.set(id, menuSnaps[idx].data());
        }
      });

      const nowIso = new Date().toISOString();
      const cancelHlc = generateHlcTimestamp('cloud_core');
      const tenantId = orderData.tenantId || authenticatedUser.tenantId || 'tenant-1';
      const storeId = orderData.storeId;

      const restoredByMenu = new Map<string, { qty: number; variants: Map<string, VariantRestoreRequest> }>();
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

      for (const [menuId, info] of restoredByMenu.entries()) {
        const menuData = menuMap.get(menuId);
        if (!menuData) continue;
        restoreMenuItemStockInTransaction({
          transaction,
          menuRef: db.collection('menu_items').doc(menuId),
          menuId,
          menuData,
          qtyToRestore: info.qty,
          variantsToRestore: info.variants,
          tenantId,
          storeId,
          orderId,
          orderCode: orderData.code,
          hlc: cancelHlc,
          nowIso,
        });
      }

      const cancelReasonText =
        typeof reason === 'string' && reason.trim()
          ? reason.trim().slice(0, 180)
          : isConsumer
          ? 'Cancelado pelo consumidor antes da confirmação'
          : 'Cancelado pela loja';

      const orderPatch = {
        status: 'CANCELLED',
        cancelReason: cancelReasonText,
        cancelledBy: authenticatedUser.uid,
        cancelledAt: nowIso,
        hlc: cancelHlc,
        updatedAt: nowIso,
      };
      transaction.update(orderRef, orderPatch);

      if (orderData.paymentMethod !== 'TABLE_BILL' && (Number(orderData.total) || 0) > 0) {
        if (finOrdSnap.exists && finOrdSnap.data()?.status === 'PENDING') {
          const cancelledFin = {
            ...finOrdSnap.data(),
            id: finOrdRef.id,
            status: 'CANCELLED',
            hlc: cancelHlc,
            updatedAt: nowIso,
          };
          transaction.update(finOrdRef, {
            status: 'CANCELLED',
            hlc: cancelHlc,
            updatedAt: nowIso,
          });
          stageSyncOutboxInTransaction(transaction, {
            entity: 'financial_records',
            entityId: finOrdRef.id,
            operation: 'UPSERT',
            tenantId,
            storeId,
            hlc: cancelHlc,
            payload: cancelledFin,
          });
        } else {
          const finId = `fin-can-${orderId}`;
          const finRecord = {
            id: finId,
            tenantId,
            storeId,
            type: 'PAYABLE',
            category: 'Estorno / Cancelamento',
            description: `Cancelamento ${orderData.code || orderId}: ${cancelReasonText}`,
            amount: Math.max(0, (Number(orderData.total) || 0) - (Number(orderData.refundedTotal) || 0)),
            dueDate: nowIso.slice(0, 10),
            status: 'PAID',
            orderId,
            hlc: cancelHlc,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          transaction.set(db.collection('financial_records').doc(finId), finRecord, { merge: true });
          stageSyncOutboxInTransaction(transaction, {
            entity: 'financial_records',
            entityId: finId,
            operation: 'UPSERT',
            tenantId,
            storeId,
            hlc: cancelHlc,
            payload: finRecord,
          });
        }
      }

      const nextOrder = { ...orderData, ...orderPatch, id: orderId };
      stageSyncOutboxInTransaction(transaction, {
        entity: 'orders',
        entityId: orderId,
        operation: 'UPSERT',
        tenantId,
        storeId,
        hlc: cancelHlc,
        payload: nextOrder,
      });

      return { order: nextOrder, tenantId, storeId };
    }, targetTenantId ? { tenantId: targetTenantId, bypassRls: false, reason: 'CONSUMER_ORDER_CANCEL' } : undefined);

    broadcastSseEvent(
      'ORDER_STATUS_CHANGED',
      {
        orderId,
        orderCode: txResult.order.code,
        status: 'CANCELLED',
        storeId: txResult.storeId,
        customerId: txResult.order.customerId || null,
      },
      txResult.tenantId,
      true,
      {
        storeId: txResult.storeId,
        customerId: txResult.order.customerId || null,
      }
    );

    res.json({ success: true, orderId, status: 'CANCELLED', order: txResult.order });
  } catch (err: any) {
    const msg = err?.message || 'Erro ao cancelar pedido.';
    const status = msg.includes('Acesso negado')
      ? 403
      : msg.includes('não encontrado')
      ? 404
      : 400;
    res.status(status).json({ error: msg });
  }
});

router.post(
  '/orders/:orderId/return',
  verifyAutonomousToken,
  requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER']),
  async (req, res) => {
    const { orderId } = req.params;
    const { itemIndex, menuItemId, variantId, quantity = 1, reason } = req.body || {};
    const authenticatedUser = (req as any).user;

    const qtyToReturn = Number(quantity);
    if (isNaN(qtyToReturn) || !Number.isInteger(qtyToReturn) || qtyToReturn <= 0 || qtyToReturn > 100) {
      return res.status(400).json({ error: 'Quantidade para devolução inválida: deve ser inteiro positivo entre 1 e 100.' });
    }

    try {
      const txResult = await db.runTransaction(async (transaction) => {
        const orderRef = db.collection('orders').doc(orderId);
        const orderSnap = await transaction.get(orderRef);

        if (!orderSnap.exists) {
          throw new Error(`Pedido '${orderId}' não encontrado.`);
        }

        const orderData = orderSnap.data() || {};
        if (authenticatedUser.role !== 'DEV_OWNER') {
          if (!orderData.tenantId || orderData.tenantId !== authenticatedUser.tenantId) {
            throw new Error('Acesso negado: Pedido pertence a outra empresa/tenant.');
          }
          if (!hasUserStoreAccess(authenticatedUser, orderData.storeId)) {
            throw new Error('Acesso negado: Pedido pertence a outra filial.');
          }
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
            (it: any) =>
              it.menuItemId === menuItemId &&
              (!variantId || it.variantId === variantId)
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
            `Quantidade solicitada para estorno (${qtyToReturn}) excede o saldo disponível do item (${Math.max(0, remainingReturnable)}).`
          );
        }

        const menuRef = targetItem.menuItemId ? db.collection('menu_items').doc(targetItem.menuItemId) : null;
        const menuSnap = menuRef ? await transaction.get(menuRef) : null;

        const nowIso = new Date().toISOString();
        const returnHlc = generateHlcTimestamp('cloud_core');
        const nextReturned = alreadyReturned + qtyToReturn;
        const rawRefundAmount = Math.round((Number(targetItem.price) || 0) * qtyToReturn * 100) / 100;
        const maxRefundRemaining = Math.max(
          0,
          Math.round(((Number(orderData.total) || 0) - (Number(orderData.refundedTotal) || 0)) * 100) / 100
        );
        const refundAmount = Math.min(rawRefundAmount, maxRefundRemaining);
        const tenantId = orderData.tenantId || authenticatedUser.tenantId || 'tenant-1';
        const storeId = orderData.storeId;

        targetItem.returnedQuantity = nextReturned;
        targetItem.returnedAt = nowIso;
        targetItem.returnReason = typeof reason === 'string' && reason.trim()
          ? reason.trim().slice(0, 180)
          : 'Devolução / Troca PDV';
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
        if (menuSnap && menuSnap.exists && menuRef) {
          const variantsMap = new Map<string, VariantRestoreRequest>();
          if (targetItem.variantId) {
            variantsMap.set(targetItem.variantId, {
              qty: qtyToReturn,
              label: targetItem.variantLabel,
            });
          }
          stockRestored = restoreMenuItemStockInTransaction({
            transaction,
            menuRef,
            menuId: targetItem.menuItemId,
            menuData: menuSnap.data() || {},
            fallbackItemName: targetItem.name,
            qtyToRestore: qtyToReturn,
            variantsToRestore: variantsMap,
            tenantId,
            storeId,
            orderId,
            orderCode: orderData.code,
            hlc: returnHlc,
            nowIso,
          });
        }

        const finId = `fin-ret-${orderId}-${resolvedIndex}-${nextReturned}`;
        const finRecord = {
          id: finId,
          storeId,
          tenantId,
          type: 'PAYABLE',
          description: `Estorno/Devolução (${orderData.code || orderId}): ${qtyToReturn}x ${targetItem.name}`,
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

        transaction.set(db.collection('financial_records').doc(finId), finRecord, { merge: true });
        transaction.update(orderRef, {
          items: itemsList,
          refundedTotal: nextRefundedTotal,
          hlc: returnHlc,
          updatedAt: nowIso,
        });

        stageSyncOutboxInTransaction(transaction, {
          entity: 'financial_records',
          entityId: finId,
          operation: 'UPSERT',
          tenantId,
          storeId,
          hlc: returnHlc,
          payload: finRecord,
        });
        stageSyncOutboxInTransaction(transaction, {
          entity: 'orders',
          entityId: orderId,
          operation: 'UPSERT',
          tenantId,
          storeId,
          hlc: returnHlc,
          payload: updatedOrder,
        });

        return {
          tenantId,
          storeId,
          resolvedIndex,
          returnedQuantity: nextReturned,
          refundAmount,
          stockRestored,
          financialRecord: finRecord,
          order: updatedOrder,
        };
      });

      broadcastSseEvent(
        'ORDER_RETURNED',
        {
          orderId,
          storeId: txResult.storeId,
          customerId: txResult.order?.customerId || null,
          itemIndex: txResult.resolvedIndex,
          returnedQuantity: txResult.returnedQuantity,
          refundAmount: txResult.refundAmount,
        },
        txResult.tenantId,
        true,
        {
          storeId: txResult.storeId,
          customerId: txResult.order?.customerId || null,
          allowedRoles: ['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER'],
        }
      );

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
      const msg = err?.message || 'Erro ao processar estorno do item.';
      const status = msg.includes('Acesso negado')
        ? 403
        : msg.includes('não encontrado')
          ? 404
          : 400;
      return res.status(status).json({ error: msg });
    }
  }
);

export default router;
