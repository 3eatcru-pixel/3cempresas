import express from 'express';
import { db } from '../../config.ts';
import { verifyAutonomousToken, requireRoles, hasUserStoreAccess } from '../../middleware/auth.ts';
import { broadcastSseEvent } from '../../state.ts';
import { generateHlcTimestamp } from '../../../utils/idGenerator.ts';
import { stageSyncOutboxInTransaction } from '../../persistence/PersistenceDriver.ts';
import { ORDER_STATUS_TRANSITIONS } from '@3c/contracts';
import {
  findLatestOpenCashSessionInTx,
  settleOpenCashSessionInTransaction,
} from './orderInventoryHelpers.ts';
import orderPaymentSettlementRoutes from './orderPaymentSettlementRoutes.ts';

const router = express.Router();
const ALLOWED_STATUS_TRANSITIONS = ORDER_STATUS_TRANSITIONS;

const handleStatusUpdate = async (req: express.Request, res: express.Response) => {
  const { orderId } = req.params;
  const { status, cancelReason, driverId, driverName, deliveryPin } = req.body;
  const authenticatedUser = (req as any).user;

  if (!orderId || !status) {
    return res.status(400).json({ error: 'orderId e status são obrigatórios.' });
  }

  try {
    const transactionResult = await db.runTransaction(async (transaction) => {
      const orderRef = db.collection('orders').doc(orderId);
      const orderSnap = await transaction.get(orderRef);

      if (!orderSnap.exists) {
        throw new Error('Pedido não encontrado.');
      }

      const orderData = orderSnap.data();
      const currentStatus = orderData?.status || 'PENDING';

      const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus];
      if (!allowedNext || !allowedNext.includes(status)) {
        throw new Error(
          `Transição de status inválida: não é permitido alterar de '${currentStatus}' para '${status}'. Transições permitidas: [${(allowedNext || []).join(', ') || 'NENHUMA'}].`
        );
      }

      if (authenticatedUser.role === 'COURIER') {
        const isSameTenant = orderData?.tenantId === authenticatedUser.tenantId;
        if (!isSameTenant && authenticatedUser.tenantId) {
          throw new Error('Acesso negado: Pedido pertence a outra empresa/tenant.');
        }

        const courierDocRef = db.collection('drivers').doc(authenticatedUser.uid);
        const courierDocSnap = await transaction.get(courierDocRef);
        const courierData = courierDocSnap.exists ? courierDocSnap.data() : null;
        if (courierData?.accountStatus === 'DISABLED') {
          throw new Error('Acesso negado: Conta de entregador temporariamente suspensa pela administração da plataforma.');
        }

        if (status === 'OUT_FOR_DELIVERY') {
          if (orderData?.driverId && orderData.driverId !== authenticatedUser.uid) {
            throw new Error(`Pedido já assumido pelo entregador '${orderData.driverName || orderData.driverId}'.`);
          }
          if (driverId && driverId !== authenticatedUser.uid) {
            throw new Error('Acesso negado: Entregador não pode atribuir entregas para outro identificador.');
          }
          if (orderData?.driverId !== authenticatedUser.uid) {
            const courierStoreId = courierData?.storeId ?? authenticatedUser.storeId ?? null;
            const fallbackFleet = courierData?.fleetType || (courierStoreId ? 'STORE_FLEET' : 'PLATFORM_FLEET');
            const allowedModes = new Set<string>(
              Array.isArray(courierData?.allowedFleetModes) && courierData.allowedFleetModes.length > 0
                ? courierData.allowedFleetModes
                : [fallbackFleet]
            );
            if (courierStoreId && !courierData?.allowedFleetModes) {
              allowedModes.add('STORE_FLEET');
            }
            const canStore = allowedModes.has('STORE_FLEET') && Boolean(courierStoreId);
            const canPlatform = allowedModes.has('PLATFORM_FLEET');
            if (orderData?.deliveryModality === 'STORE_FLEET') {
              if (!canStore || courierStoreId !== orderData?.storeId) {
                throw new Error('Acesso negado: Entrega exclusiva da frota vinculada à loja.');
              }
            } else if (!canPlatform && !(canStore && courierStoreId === orderData?.storeId)) {
              throw new Error('Acesso negado: Entregador sem autorização de Plataforma para este pedido.');
            }
          }
        } else if (status === 'DELIVERED') {
          if (orderData?.driverId !== authenticatedUser.uid) {
            throw new Error('Acesso negado: Apenas o entregador vinculado pode marcar o pedido como entregue.');
          }
        } else {
          throw new Error(`Acesso negado: Entregador não pode alterar pedido para o status '${status}'.`);
        }
      } else if (authenticatedUser.role !== 'DEV_OWNER') {
        if (orderData?.tenantId !== authenticatedUser.tenantId) {
          throw new Error('Acesso negado: Você não tem permissão para alterar este pedido.');
        }
        if (!hasUserStoreAccess(authenticatedUser, orderData?.storeId)) {
          throw new Error('Acesso negado: Pedido pertence a outra filial.');
        }
      }

      if (status === 'DELIVERED') {
        const expectedPin = orderData?.deliveryPin ? String(orderData.deliveryPin).trim() : '';
        const mustValidatePin =
          deliveryPin !== undefined ||
          (authenticatedUser.role === 'COURIER' && Boolean(expectedPin));
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

      const resolvedDriverId = authenticatedUser.role === 'COURIER'
        ? authenticatedUser.uid
        : (driverId || orderData?.driverId || null);
      const driverRef = status === 'DELIVERED' && resolvedDriverId
        ? db.collection('drivers').doc(String(resolvedDriverId))
        : null;
      const driverSnap = driverRef ? await transaction.get(driverRef) : null;

      const shouldSettleOnDelivery =
        status === 'DELIVERED' &&
        orderData?.paymentMethod !== 'TABLE_BILL' &&
        orderData?.paymentStatus !== 'PAID' &&
        (Number(orderData?.total) || 0) > 0;
      const finOrdRef = shouldSettleOnDelivery ? db.collection('financial_records').doc(`fin-ord-${orderId}`) : null;
      const finOrdSnap = finOrdRef ? await transaction.get(finOrdRef) : null;

      const openCashResult =
        shouldSettleOnDelivery && orderData?.storeId
          ? await findLatestOpenCashSessionInTx(transaction, orderData.storeId, orderData.tenantId)
          : null;

      const nowIso = new Date().toISOString();
      const statusHlc = generateHlcTimestamp('cloud_core');
      const updateData: any = { status, hlc: statusHlc, updatedAt: nowIso };
      if (cancelReason) updateData.cancelReason = cancelReason;
      if (shouldSettleOnDelivery) {
        updateData.paymentStatus = 'PAID';
        updateData.paymentConfirmationType = 'MANUAL_OPERATOR';
        updateData.settlementSource = 'ORDER_DELIVERY_SETTLEMENT';
        updateData.confirmedByUid = authenticatedUser.uid;
        updateData.confirmedByRole = authenticatedUser.role;
        updateData.confirmedAt = nowIso;
        updateData.paidAt = orderData?.paidAt || nowIso;
      }

      if (authenticatedUser.role === 'COURIER') {
        updateData.driverId = authenticatedUser.uid;
        updateData.driverName = authenticatedUser.name || driverName || 'Entregador Parceiro';
      } else {
        if (driverId) updateData.driverId = driverId;
        if (driverName) updateData.driverName = driverName;
      }

      transaction.update(orderRef, updateData);
      stageSyncOutboxInTransaction(transaction, {
        entity: 'orders',
        entityId: orderId,
        operation: 'UPSERT',
        tenantId: orderData?.tenantId || 'tenant-1',
        storeId: orderData?.storeId || null,
        hlc: statusHlc,
        payload: { ...orderData, ...updateData, id: orderId },
      });

      if (shouldSettleOnDelivery && finOrdRef && finOrdSnap?.exists && finOrdSnap.data()?.status === 'PENDING') {
        const settledFin = {
          ...finOrdSnap.data(),
          id: finOrdRef.id,
          status: 'PAID',
          paymentConfirmationType: 'MANUAL_OPERATOR',
          settlementSource: 'ORDER_DELIVERY_SETTLEMENT',
          confirmedByUid: authenticatedUser.uid,
          confirmedByRole: authenticatedUser.role,
          confirmedAt: nowIso,
          paidAt: nowIso,
          hlc: statusHlc,
          updatedAt: nowIso,
        };
        transaction.update(finOrdRef, {
          status: 'PAID',
          paymentConfirmationType: 'MANUAL_OPERATOR',
          settlementSource: 'ORDER_DELIVERY_SETTLEMENT',
          confirmedByUid: authenticatedUser.uid,
          confirmedByRole: authenticatedUser.role,
          confirmedAt: nowIso,
          paidAt: nowIso,
          hlc: statusHlc,
          updatedAt: nowIso,
        });
        stageSyncOutboxInTransaction(transaction, {
          entity: 'financial_records',
          entityId: finOrdRef.id,
          operation: 'UPSERT',
          tenantId: orderData?.tenantId || 'tenant-1',
          storeId: orderData?.storeId || null,
          hlc: statusHlc,
          payload: settledFin,
        });
      } else if (shouldSettleOnDelivery && finOrdRef && !finOrdSnap?.exists && (Number(orderData?.total) || 0) > 0) {
        const createdFin = {
          id: finOrdRef.id,
          tenantId: orderData?.tenantId || 'tenant-1',
          storeId: orderData?.storeId || 'CENTRAL_WAREHOUSE',
          type: 'RECEIVABLE',
          category: 'VENDAS',
          description: `Pedido ${orderData?.code || orderId} liquidado na entrega`,
          amount: Number(orderData?.total) || 0,
          dueDate: nowIso.split('T')[0],
          status: 'PAID',
          paymentMethod: orderData?.paymentMethod || 'CASH',
          paymentConfirmationType: 'MANUAL_OPERATOR',
          settlementSource: 'ORDER_DELIVERY_SETTLEMENT',
          confirmedByUid: authenticatedUser.uid,
          confirmedByRole: authenticatedUser.role,
          confirmedAt: nowIso,
          paidAt: nowIso,
          orderId,
          hlc: statusHlc,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        transaction.set(finOrdRef, createdFin);
        stageSyncOutboxInTransaction(transaction, {
          entity: 'financial_records',
          entityId: finOrdRef.id,
          operation: 'UPSERT',
          tenantId: orderData?.tenantId || 'tenant-1',
          storeId: orderData?.storeId || null,
          hlc: statusHlc,
          payload: createdFin,
        });
      }

      if (shouldSettleOnDelivery && openCashResult) {
        settleOpenCashSessionInTransaction(
          transaction,
          openCashResult.ref,
          openCashResult.snap,
          Number(orderData?.total) || 0,
          orderData?.tenantId || 'tenant-1',
          orderData?.storeId || null,
          statusHlc,
          nowIso
        );
      }

      if (status === 'DELIVERED' && driverRef && driverSnap?.exists) {
        const drv = driverSnap.data() || {};
        const driverEarning = Math.round(((Number(orderData?.deliveryFee) || 0) + (Number(orderData?.courierTip) || 0)) * 100) / 100;
        const nextBalance = Math.round(((Number(drv.walletBalance) || 0) + driverEarning) * 100) / 100;
        const nextDeliveries = (Number(drv.totalDeliveries) || 0) + 1;
        const driverPatch = {
          status: 'AVAILABLE',
          currentOrderId: null,
          totalDeliveries: nextDeliveries,
          walletBalance: nextBalance,
          hlc: statusHlc,
          updatedAt: nowIso,
        };
        transaction.update(driverRef, driverPatch);
        stageSyncOutboxInTransaction(transaction, {
          entity: 'drivers',
          entityId: driverRef.id,
          operation: 'UPSERT',
          tenantId: drv.tenantId || orderData?.tenantId || 'tenant-1',
          storeId: drv.storeId || orderData?.storeId || null,
          hlc: statusHlc,
          payload: { ...drv, ...driverPatch, id: driverRef.id },
        });
      }

      return { orderData, updateData };
    });

    broadcastSseEvent(
      'ORDER_STATUS_CHANGED',
      {
        orderId,
        orderCode: transactionResult.orderData?.code,
        status,
        storeId: transactionResult.orderData?.storeId,
        customerId: transactionResult.orderData?.customerId,
        driverId: transactionResult.updateData.driverId || transactionResult.orderData?.driverId,
      },
      transactionResult.orderData?.tenantId,
      true,
      {
        storeId: transactionResult.orderData?.storeId,
        customerId: transactionResult.orderData?.customerId,
        driverId: transactionResult.updateData.driverId || transactionResult.orderData?.driverId,
      }
    );

    return res.json({ success: true, orderId, status });
  } catch (err: any) {
    return res.status(err.message.includes('Acesso negado') ? 403 : 400).json({ error: err.message || 'Erro interno ao atualizar status.' });
  }
};

router.post(
  '/orders/:orderId/status',
  verifyAutonomousToken,
  requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER', 'WAITER', 'KITCHEN_STAFF', 'COURIER']),
  handleStatusUpdate
);
router.put(
  '/orders/:orderId/status',
  verifyAutonomousToken,
  requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER', 'WAITER', 'KITCHEN_STAFF', 'COURIER']),
  handleStatusUpdate
);

router.post(
  '/orders/:orderId/assign-driver',
  verifyAutonomousToken,
  requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER']),
  async (req, res) => {
    const { orderId } = req.params;
    const { driverId } = req.body || {};
    const authenticatedUser = (req as any).user;

    if (!orderId || !driverId || typeof driverId !== 'string') {
      return res.status(400).json({ error: 'orderId e driverId são obrigatórios.' });
    }

    try {
      const txResult = await db.runTransaction(async (transaction) => {
        const orderRef = db.collection('orders').doc(orderId);
        const driverRef = db.collection('drivers').doc(driverId);
        const [orderSnap, driverSnap] = await Promise.all([
          transaction.get(orderRef),
          transaction.get(driverRef),
        ]);

        if (!orderSnap.exists) {
          throw new Error(`Pedido '${orderId}' não encontrado.`);
        }
        if (!driverSnap.exists) {
          throw new Error(`Entregador '${driverId}' não encontrado no servidor.`);
        }

        const orderData = orderSnap.data() || {};
        const driverData = driverSnap.data() || {};

        if (authenticatedUser.role !== 'DEV_OWNER') {
          if (orderData.tenantId !== authenticatedUser.tenantId) {
            throw new Error('Acesso negado: Pedido pertence a outra empresa/tenant.');
          }
          if (!hasUserStoreAccess(authenticatedUser, orderData.storeId)) {
            throw new Error('Acesso negado: Pedido pertence a outra filial.');
          }
          if (driverData.tenantId && driverData.tenantId !== orderData.tenantId) {
            throw new Error('Acesso negado: Entregador pertence a outra empresa/tenant.');
          }
        }

        if (orderData.status === 'DELIVERED' || orderData.status === 'CANCELLED') {
          throw new Error(`Pedido em status '${orderData.status}' não aceita despacho de entregador.`);
        }
        if (driverData.accountStatus === 'DISABLED') {
          throw new Error('Entregador temporariamente suspenso pela administração da plataforma não pode receber despachos.');
        }

        const isStoreLinked = Boolean(driverData.storeId && driverData.storeId === orderData.storeId);
        const isPlatformEligible =
          driverData.fleetType === 'PLATFORM_FLEET' ||
          (Array.isArray(driverData.allowedFleetModes) && driverData.allowedFleetModes.includes('PLATFORM_FLEET'));
        if (!isStoreLinked && !isPlatformEligible) {
          throw new Error('Acesso negado: Entregador vinculado a outra loja sem habilitação de Plataforma.');
        }

        const nowIso = new Date().toISOString();
        const hlc = generateHlcTimestamp('cloud_core');
        const resolvedDriverName = driverData.name || 'Entregador Parceiro';
        const orderPatch = {
          driverId,
          driverName: resolvedDriverName,
          assignedByUid: authenticatedUser.uid,
          assignedAt: nowIso,
          hlc,
          updatedAt: nowIso,
        };

        transaction.update(orderRef, orderPatch);
        stageSyncOutboxInTransaction(transaction, {
          entity: 'orders',
          entityId: orderId,
          operation: 'UPSERT',
          tenantId: orderData.tenantId || 'tenant-1',
          storeId: orderData.storeId || null,
          hlc,
          payload: { ...orderData, ...orderPatch, id: orderId },
        });

        return {
          orderId,
          orderCode: orderData.code,
          storeId: orderData.storeId,
          tenantId: orderData.tenantId || 'tenant-1',
          driverId,
          driverName: resolvedDriverName,
        };
      });

      broadcastSseEvent(
        'ORDER_DRIVER_ASSIGNED',
        {
          orderId: txResult.orderId,
          orderCode: txResult.orderCode,
          storeId: txResult.storeId,
          driverId: txResult.driverId,
          driverName: txResult.driverName,
        },
        txResult.tenantId,
        true,
        {
          storeId: txResult.storeId,
          driverId: txResult.driverId,
        }
      );

      return res.json({ success: true, ...txResult });
    } catch (err: any) {
      const msg = err?.message || 'Erro ao despachar entregador.';
      const status = msg.includes('Acesso negado')
        ? 403
        : msg.includes('não encontrado')
          ? 404
          : 400;
      return res.status(status).json({ error: msg });
    }
  }
);

router.use(orderPaymentSettlementRoutes);

export default router;
