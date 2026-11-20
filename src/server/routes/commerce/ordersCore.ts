import express from 'express';
import crypto from 'crypto';
import { db, runWithSystemDbContext } from '../../config.ts';
import { verifyAutonomousToken, hasUserStoreAccess } from '../../middleware/auth.ts';
import { clusterState, broadcastSseEvent } from '../../state.ts';
import { generateHlcTimestamp } from '../../../utils/idGenerator.ts';
import { stageSyncOutboxInTransaction } from '../../persistence/PersistenceDriver.ts';
import { stripPrototypePollution } from '../../utils/requestSanitizer.ts';
import orderQueryRoutes from './orderQueryRoutes.ts';
import {
  consolidateOrderLines,
  calculateOrderCouponInTx,
  planBomFifoBatchDeductions,
} from './orderCreationHelpers.ts';
import { findLatestOpenCashSessionInTx } from './orderInventoryHelpers.ts';
import {
  stageOrderFinancialTableAndCrmInTx,
  stageOrderStockAndBomLedgersInTx,
} from './orderCommitLedgersAndCrm.ts';
import {
  allocateAndPriceOrderItemsInTx,
  validateDeliveryCoordinates,
} from './orderProductAllocation.ts';

const router = express.Router();

router.use('/', orderQueryRoutes);

const INTERNAL_STAFF_CHANNELS = new Set(['POS', 'WAITER_TABLE', 'KIOSK', 'WAITER', 'PDV']);
const PUBLIC_ORDER_CHANNELS = new Set(['MARKETPLACE', 'PICKUP', 'TABLE']);
const INTERNAL_STAFF_ROLES = new Set([
  'REGIONAL_MANAGER',
  'STORE_OWNER',
  'STORE_MANAGER',
  'CASHIER',
  'WAITER',
]);
const COUNTER_SETTLEMENT_ROLES = new Set([
  'REGIONAL_MANAGER',
  'STORE_OWNER',
  'STORE_MANAGER',
  'CASHIER',
]);
const COUNTER_CHANNELS = new Set(['POS', 'PDV', 'KIOSK', 'WAITER_TABLE', 'TABLE', 'WAITER', 'PICKUP']);

// Order Pipeline Endpoint with Anti-Tampering, Atomic Stock & State Validation
router.post('/orders', verifyAutonomousToken, async (req, res) => {
  const {
    storeId,
    crmCustomerId,
    customerName,
    customerPhone,
    deliveryAddress,
    deliveryLatitude,
    deliveryLongitude,
    notes,
    items,
    paymentMethod,
    deliveryModality,
    couponCode,
    channel = 'MARKETPLACE',
    tableNumber,
    courierTip = 0,
    professionalId,
    professionalName,
    commissionRate,
    commissionAmount,
    reservationId,
    scheduledDeliveryDate,
    scheduledDeliveryPeriod,
    assemblyRequired,
    paymentConfirmed,
    providerTransactionId,
  } = stripPrototypePollution(req.body || {});
  const authenticatedUser = (req as any).user;

  if (!storeId || typeof storeId !== 'string' || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Payload de pedido inválido: storeId e lista não-vazia de itens são obrigatórios.' });
  }

  if (items.length > 50) {
    return res.status(400).json({ error: 'Limite de itens por pedido excedido (máximo 50 itens distintos).' });
  }

  const { hasDeliveryLat, hasDeliveryLng, error: coordError } = validateDeliveryCoordinates(
    deliveryLatitude,
    deliveryLongitude
  );
  if (coordError) {
    return res.status(400).json({ error: coordError });
  }

  try {
    const preflight = await runWithSystemDbContext('ORDER_CREATE_PREFLIGHT', async () => {
      const storeSnap = await db.collection('stores').doc(storeId).get();
      if (!storeSnap.exists) {
        return { found: false as const, tenantId: null as string | null, govReadOnly: false };
      }
      const sData = storeSnap.data() || {};
      const resolvedTenantId = String(sData.tenantId || authenticatedUser?.tenantId || 'tenant-1');
      const govSnap = await db.collection('governance').doc('governance').get();
      const govReadOnly = Boolean(
        govSnap.exists && govSnap.data()?.featureFlags?.marketplaceMaintenanceReadOnly === true
      );
      return { found: true as const, tenantId: resolvedTenantId, govReadOnly };
    });

    if (!preflight.found) {
      throw new Error(`Loja '${storeId}' não encontrada no sistema.`);
    }

    const txContextTenantId = preflight.tenantId!;

    const transactionResult = await db.runTransaction(async (transaction) => {
      const storeRef = db.collection('stores').doc(storeId);
      const storeSnap = await transaction.get(storeRef);

      if (!storeSnap.exists) {
        throw new Error(`Loja '${storeId}' não encontrada no sistema.`);
      }

      const storeData = storeSnap.data() || {};
      const tenantId = storeData.tenantId || authenticatedUser.tenantId || 'tenant-1';

      const tenantRef = db.collection('tenants').doc(String(tenantId));
      const tenantSnap = await transaction.get(tenantRef);
      if (
        (tenantSnap.exists && String(tenantSnap.data()?.status || 'ACTIVE').toUpperCase() === 'SUSPENDED') ||
        String(storeData.status || 'ACTIVE').toUpperCase() === 'SUSPENDED'
      ) {
        throw new Error('Estabelecimento temporariamente indisponível na plataforma.');
      }

      const govSnap = {
        exists: true,
        data: () => ({ featureFlags: { marketplaceMaintenanceReadOnly: preflight.govReadOnly } }),
      };

      const clientIdempotencyKeyEarly = (req as any).clientContext?.idempotencyKey;
      const idemKeyDocRef = clientIdempotencyKeyEarly
        ? db.collection('order_idempotency_keys').doc(`${authenticatedUser?.uid || 'anon'}::${storeId}::${clientIdempotencyKeyEarly}`)
        : null;
      if (idemKeyDocRef) {
        const existingIdemSnap = await transaction.get(idemKeyDocRef);
        if (existingIdemSnap.exists) {
          const prevOrderId = existingIdemSnap.data()?.orderId;
          if (prevOrderId) {
            const prevOrderSnap = await transaction.get(db.collection('orders').doc(prevOrderId));
            if (prevOrderSnap.exists) {
              return {
                orderId: prevOrderId,
                order: prevOrderSnap.data(),
                tenantId,
                deduplicated: true,
              };
            }
          }
        }
      }

      const normalizedChannel = String(channel || 'MARKETPLACE').trim().toUpperCase();
      const isInternalStaffChannel = INTERNAL_STAFF_CHANNELS.has(normalizedChannel);
      const isPublicOrderChannel = PUBLIC_ORDER_CHANNELS.has(normalizedChannel);
      if (!isInternalStaffChannel && !isPublicOrderChannel) {
        throw new Error(`Canal de pedido '${normalizedChannel}' inválido ou não suportado.`);
      }

      if (authenticatedUser.role === 'KITCHEN_STAFF' || authenticatedUser.role === 'COURIER') {
        throw new Error(`Acesso negado: Perfil '${authenticatedUser.role}' não possui permissão para criar pedidos.`);
      }

      const isConsumerOrderCaller = authenticatedUser.role === 'CUSTOMER' || authenticatedUser.role === 'CONSUMER';
      if (isConsumerOrderCaller) {
        if (
          normalizedChannel === 'MARKETPLACE' &&
          govSnap.exists &&
          govSnap.data()?.featureFlags?.marketplaceMaintenanceReadOnly === true
        ) {
          const maintenanceErr = new Error(
            'Marketplace temporariamente em modo manutenção (somente leitura) pela governança HQ.'
          );
          (maintenanceErr as any).statusCode = 503;
          throw maintenanceErr;
        }
        if (isInternalStaffChannel) {
          throw new Error('Acesso negado: Canal operacional interno restrito à equipe da loja.');
        }
        if (storeData.isOpen === false) {
          throw new Error(`Estabelecimento '${storeData.name || storeId}' encontra-se fechado no momento.`);
        }
        if (String(paymentMethod || '').toUpperCase() === 'TABLE_BILL' && normalizedChannel !== 'TABLE') {
          throw new Error('Pagamento em comanda aberta (TABLE_BILL) só é permitido em pedidos na mesa.');
        }
        if (
          normalizedChannel === 'MARKETPLACE' &&
          String(deliveryModality || '').toUpperCase() !== 'PICKUP' &&
          String(deliveryModality || '').toUpperCase() !== 'TABLE' &&
          (!deliveryAddress || typeof deliveryAddress !== 'string' || deliveryAddress.trim().length < 5)
        ) {
          throw new Error('Endereço de entrega obrigatório para pedidos Delivery.');
        }
      } else {
        if (!INTERNAL_STAFF_ROLES.has(authenticatedUser.role)) {
          throw new Error('Acesso negado: Perfil sem permissão para emissão de pedidos.');
        }
        if (storeData.tenantId !== authenticatedUser.tenantId) {
          throw new Error('Acesso negado: Loja pertence a outra empresa/tenant.');
        }
        if (!hasUserStoreAccess(authenticatedUser, storeId)) {
          throw new Error(`Acesso negado: Perfil não autorizado para operar na loja '${storeId}'.`);
        }
        if (normalizedChannel === 'MARKETPLACE' && storeData.isOpen === false) {
          throw new Error(`Estabelecimento '${storeData.name || storeId}' encontra-se fechado no momento.`);
        }
      }

      const { consolidatedLines, totalQtyByMenuItem } = consolidateOrderLines(items);
      const {
        itemSnapMap,
        itemReads,
        validatedItems,
        stockUpdates,
        subtotal,
      } = await allocateAndPriceOrderItemsInTx({
        transaction,
        storeId,
        storeData,
        consolidatedLines,
        totalQtyByMenuItem,
      });
      let numDeliveryFee = 0;
      if (deliveryModality !== 'PICKUP' && normalizedChannel !== 'PICKUP' && normalizedChannel !== 'WAITER_TABLE' && normalizedChannel !== 'TABLE') {
        const useOwnFleetFee =
          storeData.deliveryModality === 'STORE_FLEET' &&
          typeof storeData.ownFleetCustomFee === 'number' &&
          Number.isFinite(storeData.ownFleetCustomFee);
        const configuredFee = useOwnFleetFee ? storeData.ownFleetCustomFee : (Number(storeData.deliveryFee) || 0);
        numDeliveryFee = Math.max(0, configuredFee);
      }

      const { numDiscount, couponUpdateTask } = await calculateOrderCouponInTx({
        transaction,
        couponCode,
        tenantId,
        storeId,
        subtotal,
      });

      const ingredientBatchDeductions = await planBomFifoBatchDeductions({
        itemReads,
        itemSnapMap,
        tenantId,
        storeId,
        allowSharedWarehouse: Boolean(storeData?.operationalSettings?.sharedWarehouseMode),
      });

      const resRef = reservationId && typeof reservationId === 'string'
        ? db.collection('reservations').doc(reservationId)
        : null;
      const resSnap = resRef ? await transaction.get(resRef) : null;
      if (resSnap?.exists) {
        const resData = resSnap.data();
        if (resData?.tenantId !== tenantId || (resData?.storeId && resData.storeId !== storeId)) {
          throw new Error('Reserva informada não pertence a esta loja/tenant.');
        }
      }

      let matchingTableDoc: any = null;
      if ((normalizedChannel === 'TABLE' || normalizedChannel === 'WAITER_TABLE') && tableNumber) {
        const tablesSnap = await db.collection('tables').get();
        matchingTableDoc =
          tablesSnap.docs.find((d) => {
            const td = d.data();
            return !td._deleted && td.tableNumber === Number(tableNumber) && td.storeId === storeId && td.tenantId === tenantId;
          }) || null;
      }

      const effectivePaymentMethod = paymentMethod || 'PIX';
      const openCashResult =
        effectivePaymentMethod !== 'TABLE_BILL'
          ? await findLatestOpenCashSessionInTx(transaction, storeId, tenantId)
          : null;

      const requestedCrmId =
        typeof crmCustomerId === 'string' && crmCustomerId.trim().length > 0
          ? crmCustomerId.trim()
          : '';
      const isPublicCrmChannel = Boolean(
        authenticatedUser?.uid &&
        ['MARKETPLACE', 'PICKUP', 'TABLE'].includes(normalizedChannel)
      );
      const isPosCrmChannel = Boolean(
        requestedCrmId &&
        ['POS', 'PDV', 'KIOSK', 'WAITER_TABLE', 'WAITER'].includes(normalizedChannel)
      );
      let crmDocId = isPublicCrmChannel
        ? `crm-${storeId}-${authenticatedUser.uid}`
        : isPosCrmChannel
        ? requestedCrmId
        : '';
      let crmRef = crmDocId ? db.collection('customers_crm').doc(crmDocId) : null;
      let crmSnap = crmRef ? await transaction.get(crmRef) : null;
      if (isPosCrmChannel) {
        const crmData = crmSnap?.exists ? crmSnap.data() : null;
        if (
          !crmData ||
          (crmData.storeId && crmData.storeId !== storeId) ||
          (crmData.tenantId && crmData.tenantId !== tenantId)
        ) {
          crmDocId = '';
          crmRef = null;
          crmSnap = null;
        }
      }

      // --- END OF TRANSACTION READS, BEGIN TRANSACTION WRITES ---
      const nowIso = new Date().toISOString();

      if (couponUpdateTask) {
        const couponHlc = generateHlcTimestamp('cloud_core');
        transaction.update(couponUpdateTask.ref, {
          usageCount: couponUpdateTask.nextUsageCount,
          hlc: couponHlc,
          updatedAt: nowIso,
        });
        stageSyncOutboxInTransaction(transaction, {
          entity: 'coupons',
          entityId: couponUpdateTask.ref.id,
          operation: 'UPSERT',
          tenantId,
          storeId: couponUpdateTask.data?.storeId || storeId,
          hlc: couponHlc,
          payload: {
            ...couponUpdateTask.data,
            id: couponUpdateTask.ref.id,
            usageCount: couponUpdateTask.nextUsageCount,
            hlc: couponHlc,
            updatedAt: nowIso,
          },
        });
      }

      for (const lotDeduc of ingredientBatchDeductions) {
        transaction.update(db.collection('inventory_batches').doc(lotDeduc.batchId), {
          quantity: lotDeduc.newQty,
          updatedAt: nowIso,
        });
      }

      const parsedCourierTip = courierTip !== undefined && courierTip !== null ? Number(courierTip) : 0;
      if (!Number.isFinite(parsedCourierTip) || parsedCourierTip < 0 || parsedCourierTip > 500) {
        throw new Error('Valor de gorjeta (courierTip) inválido: deve estar entre R$ 0 e R$ 500.');
      }
      const effectiveCourierTip =
        deliveryModality !== 'PICKUP' && normalizedChannel !== 'PICKUP' && normalizedChannel !== 'WAITER_TABLE' && normalizedChannel !== 'TABLE'
          ? Math.round(parsedCourierTip * 100) / 100
          : 0;

      const validatedTotal = Math.max(0, Math.round((subtotal + numDeliveryFee + effectiveCourierTip - numDiscount) * 100) / 100);
      if (!isConsumerOrderCaller) {
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
      }

      const hasStorePermission =
        storeData.tenantId === authenticatedUser?.tenantId && hasUserStoreAccess(authenticatedUser, storeId);
      const isStoreStaff =
        ['STORE_OWNER', 'STORE_MANAGER', 'CASHIER', 'WAITER', 'REGIONAL_MANAGER'].includes(authenticatedUser?.role) &&
        hasStorePermission;
      const isCounterSettler = COUNTER_SETTLEMENT_ROLES.has(authenticatedUser?.role) && hasStorePermission;
      const rawClientOperatorRef =
        typeof providerTransactionId === 'string' ? providerTransactionId.trim() : '';
      const validOperatorRef =
        rawClientOperatorRef && !rawClientOperatorRef.startsWith('POS-TX-')
          ? rawClientOperatorRef
          : undefined;
      const hasExplicitPaymentConfirmation = paymentConfirmed === true;
      const isPaymentSettledAtCreation =
        effectivePaymentMethod !== 'TABLE_BILL' &&
        isCounterSettler &&
        COUNTER_CHANNELS.has(normalizedChannel) &&
        (effectivePaymentMethod === 'CASH' || hasExplicitPaymentConfirmation);
      const initialStatus = effectivePaymentMethod === 'TABLE_BILL' || !isStoreStaff ? 'PENDING' : 'CONFIRMED';

      const orderHlc = generateHlcTimestamp('cloud_core');
      const clientIdempotencyKey = (req as any).clientContext?.idempotencyKey;
      const orderCode = `#${Math.floor(1000 + Math.random() * 9000)}`;
      const orderDocRef = db.collection('orders').doc();

      stageOrderStockAndBomLedgersInTx({
        transaction,
        stockUpdates,
        ingredientBatchDeductions,
        tenantId,
        storeId,
        orderId: orderDocRef.id,
        orderCode,
        orderHlc,
        nowIso,
      });

      const isDeliveryPinOrder =
        !['POS', 'KIOSK', 'TABLE', 'WAITER_TABLE', 'PICKUP'].includes(normalizedChannel) &&
        deliveryModality !== 'PICKUP';
      const deliveryPin = isDeliveryPinOrder ? String(crypto.randomInt(1000, 9999)) : null;

      const newOrder = {
        code: orderCode,
        storeId,
        tenantId,
        channel,
        tableNumber: normalizedChannel === 'TABLE' || normalizedChannel === 'WAITER_TABLE' ? (tableNumber || null) : null,
        customerId: authenticatedUser?.uid || null,
        customerName: customerName || authenticatedUser?.name || 'Cliente Marketplace',
        customerPhone: customerPhone || null,
        customerEmail: authenticatedUser?.email || null,
        deliveryAddress: deliveryAddress || null,
        ...(isDeliveryPinOrder && hasDeliveryLat && hasDeliveryLng
          ? { deliveryLatitude, deliveryLongitude }
          : {}),
        notes: notes || null,
        couponCode: couponCode || null,
        items: validatedItems,
        subtotal,
        deliveryFee: numDeliveryFee,
        courierTip: effectiveCourierTip,
        discount: numDiscount,
        total: validatedTotal,
        paymentMethod: effectivePaymentMethod,
        paymentStatus: isPaymentSettledAtCreation ? 'PAID' : 'PENDING',
        ...(isPaymentSettledAtCreation
          ? {
               paymentConfirmationType: 'MANUAL_OPERATOR',
               settlementSource: 'POS_OPERATOR_COUNTER',
               confirmedByUid: authenticatedUser.uid,
               confirmedByRole: authenticatedUser.role,
               confirmedAt: nowIso,
               paidAt: nowIso,
               ...(validOperatorRef ? { operatorReferenceId: validOperatorRef } : {}),
             }
          : {}),
        deliveryModality:
          deliveryModality === 'PICKUP' || deliveryModality === 'TABLE'
            ? deliveryModality
            : deliveryModality === 'STORE_FLEET' || deliveryModality === 'PLATFORM_FLEET'
            ? deliveryModality
            : storeData.deliveryModality === 'STORE_FLEET'
            ? 'STORE_FLEET'
            : 'PLATFORM_FLEET',
        ...(deliveryPin ? { deliveryPin } : {}),
        status: initialStatus,
        prepTimeEstMin: 15,
        professionalId: isConsumerOrderCaller ? null : (professionalId || null),
        professionalName: isConsumerOrderCaller ? null : (professionalName || null),
        commissionRate:
          !isConsumerOrderCaller && commissionRate !== undefined && commissionRate !== null
            ? Math.round(Number(commissionRate) * 100) / 100
            : null,
        commissionAmount:
          !isConsumerOrderCaller && commissionAmount !== undefined && commissionAmount !== null
            ? Math.round(Number(commissionAmount) * 100) / 100
            : null,
        reservationId: reservationId || null,
        scheduledDeliveryDate: scheduledDeliveryDate || null,
        scheduledDeliveryPeriod: scheduledDeliveryPeriod || null,
        assemblyRequired: typeof assemblyRequired === 'boolean' ? assemblyRequired : null,
        hlc: orderHlc,
        idempotencyKey: clientIdempotencyKey || null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      transaction.set(orderDocRef, newOrder);

      if (idemKeyDocRef) {
        transaction.set(idemKeyDocRef, {
          id: idemKeyDocRef.id,
          orderId: orderDocRef.id,
          storeId,
          tenantId,
          customerId: authenticatedUser?.uid || null,
          idempotencyKey: clientIdempotencyKey,
          createdAt: nowIso,
        });
      }

      stageSyncOutboxInTransaction(transaction, {
        entity: 'orders',
        entityId: orderDocRef.id,
        operation: 'UPSERT',
        tenantId,
        storeId,
        hlc: orderHlc,
        idempotencyKey: clientIdempotencyKey,
        payload: { ...newOrder, id: orderDocRef.id },
      });

      stageOrderFinancialTableAndCrmInTx({
        transaction,
        orderId: orderDocRef.id,
        orderCode,
        tenantId,
        storeId,
        channel,
        effectivePaymentMethod,
        validatedTotal,
        isPaymentSettledAtCreation,
        authenticatedUser,
        openCashResult,
        resRef,
        resSnap,
        matchingTableDoc,
        crmRef,
        crmDocId,
        crmSnap,
        isPosCrmLink: isPosCrmChannel,
        customerName,
        customerPhone,
        orderHlc,
        nowIso,
      });

      return { orderId: orderDocRef.id, order: newOrder, tenantId, deduplicated: false, validatedTotal, nowIso };
    }, { tenantId: txContextTenantId, bypassRls: false, reason: 'ORDER_CREATE_TX' });

    const addedGmv = Number(transactionResult.validatedTotal || 0);
    if (!transactionResult.deduplicated && addedGmv > 0) {
      await runWithSystemDbContext('ORDER_CREATE_GOV_GMV', async () => {
        await db.runTransaction(async (govTx) => {
          const govRef = db.collection('governance').doc('governance');
          const govSnap = await govTx.get(govRef);
          if (govSnap.exists) {
            const govData = govSnap.data() || {};
            govTx.update(govRef, {
              totalGMV: (Number(govData.totalGMV) || 0) + addedGmv,
              updatedAt: transactionResult.nowIso,
            });
          }
        });
      }).catch(() => undefined);
    }

    if (transactionResult.deduplicated) {
      return res.status(200).json({
        success: true,
        deduplicated: true,
        message: `Pedido ${transactionResult.order?.code || transactionResult.orderId} recuperado via idempotência.`,
        transaction: { orderId: transactionResult.orderId, ...transactionResult.order },
      });
    }

    clusterState.ordersProcessed++;
    clusterState.lastEvent = `Pedido ${transactionResult.order.code} confirmado para a loja ${storeId}`;

    broadcastSseEvent('ORDER_COMMITTED', {
      orderId: transactionResult.orderId,
      orderCode: transactionResult.order.code,
      storeId,
      customerId: transactionResult.order.customerId,
      total: transactionResult.order.total,
      itemsCount: transactionResult.order.items.length,
    }, transactionResult.tenantId, true, {
      storeId,
      customerId: transactionResult.order.customerId,
    });

    broadcastSseEvent('WHATSAPP_NOTIFICATION', {
      storeId,
      customerId: transactionResult.order.customerId,
      to: transactionResult.order.customerPhone || 'N/A',
      message: `Olá ${transactionResult.order.customerName}! Seu pedido ${transactionResult.order.code} foi recebido e já está em nossa cozinha.`,
      status: 'SENT_SANDBOX',
    }, transactionResult.tenantId, true, {
      storeId,
      customerId: transactionResult.order.customerId,
    });

    return res.status(201).json({
      success: true,
      message: `Pedido ${transactionResult.order.code} validado e gravado com integridade matemática, estoque atômico e baixa de insumos FIFO.`,
      transaction: { orderId: transactionResult.orderId, ...transactionResult.order },
    });
  } catch (error: any) {
    const status =
      typeof error?.statusCode === 'number'
        ? error.statusCode
        : error?.message?.includes('Acesso negado')
        ? 403
        : 400;
    return res.status(status).json({ error: error.message || 'Falha ao processar pedido.' });
  }
});

export default router;
