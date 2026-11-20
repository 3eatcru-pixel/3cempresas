import express from 'express';
import crypto from 'crypto';
import { db, decryptIntegrationSecret, runWithSystemDbContext } from '../../config.ts';
import { verifyAutonomousToken, requireRoles, hasUserStoreAccess } from '../../middleware/auth.ts';
import { broadcastSseEvent } from '../../state.ts';
import { generateHlcTimestamp } from '../../../utils/idGenerator.ts';
import { stageSyncOutboxInTransaction } from '../../persistence/PersistenceDriver.ts';
import {
  findLatestOpenCashSessionInTx,
  settleOpenCashSessionInTransaction,
} from './orderInventoryHelpers.ts';

const router = express.Router();

router.post(
  '/orders/:orderId/confirm-payment',
  verifyAutonomousToken,
  requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER', 'WAITER']),
  async (req, res) => {
    const { orderId } = req.params;
    const { providerTransactionId, paymentMethod } = req.body || {};
    const authenticatedUser = (req as any).user;

    try {
      const result = await db.runTransaction(async (transaction) => {
        const orderRef = db.collection('orders').doc(orderId);
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) {
          throw new Error(`Pedido '${orderId}' não encontrado.`);
        }
        const orderData = orderSnap.data() || {};
        if (authenticatedUser.role !== 'DEV_OWNER') {
          if (orderData.tenantId !== authenticatedUser.tenantId) {
            throw new Error('Acesso negado: Pedido pertence a outra empresa/tenant.');
          }
          if (!hasUserStoreAccess(authenticatedUser, orderData.storeId)) {
            throw new Error('Acesso negado: Pedido pertence a outra filial.');
          }
        }
        if (orderData.status === 'CANCELLED') {
          throw new Error('Pedido cancelado não permite confirmação de pagamento.');
        }

        const VALID_SETTLEMENT_METHODS = [
          'PIX',
          'CREDIT_CARD',
          'DEBIT_CARD',
          'CASH',
          'BOLETO',
          'BANK_TRANSFER',
          'PAYMENT_LINK',
        ];
        const requestedMethod = typeof paymentMethod === 'string' ? paymentMethod.trim().toUpperCase() : '';
        const resolvedPaymentMethod = VALID_SETTLEMENT_METHODS.includes(requestedMethod)
          ? requestedMethod
          : (orderData.paymentMethod && orderData.paymentMethod !== 'TABLE_BILL' ? orderData.paymentMethod : 'CASH');

        const finOrdRef = db.collection('financial_records').doc(`fin-ord-${orderId}`);
        const finOrdSnap = await transaction.get(finOrdRef);

        const openCashResult =
          orderData.paymentStatus !== 'PAID' && orderData.storeId
            ? await findLatestOpenCashSessionInTx(transaction, orderData.storeId, orderData.tenantId)
            : null;

        const confirmationType = 'MANUAL_OPERATOR';
        const settlementSource = 'OPERATOR_CONSOLE';

        const nowIso = new Date().toISOString();
        const hlc = generateHlcTimestamp('cloud_core');
        const wasPaid = orderData.paymentStatus === 'PAID';
        const rawOperatorRef =
          typeof providerTransactionId === 'string' ? providerTransactionId.trim() : '';
        const operatorRef =
          rawOperatorRef && !rawOperatorRef.toUpperCase().startsWith('POS-TX-')
            ? rawOperatorRef
            : undefined;
        const orderPatch: Record<string, any> = {
          paymentStatus: 'PAID',
          paymentMethod: resolvedPaymentMethod,
          paymentConfirmationType: confirmationType,
          settlementSource,
          confirmedByUid: authenticatedUser.uid,
          confirmedByRole: authenticatedUser.role,
          confirmedAt: nowIso,
          paidAt: orderData.paidAt || nowIso,
          ...(operatorRef
            ? { operatorReferenceId: operatorRef }
            : {}),
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

        const orderTotal = Number(orderData.total) || 0;
        if (finOrdSnap.exists) {
          if (finOrdSnap.data()?.status !== 'PAID') {
            const finPatch = {
              status: 'PAID',
              paymentMethod: resolvedPaymentMethod,
              paymentConfirmationType: confirmationType,
              settlementSource,
              confirmedByUid: authenticatedUser.uid,
              confirmedByRole: authenticatedUser.role,
              confirmedAt: nowIso,
              paidAt: nowIso,
              hlc,
              updatedAt: nowIso,
            };
            transaction.update(finOrdRef, finPatch);
            stageSyncOutboxInTransaction(transaction, {
              entity: 'financial_records',
              entityId: finOrdRef.id,
              operation: 'UPSERT',
              tenantId: orderData.tenantId || 'tenant-1',
              storeId: orderData.storeId || null,
              hlc,
              payload: {
                ...finOrdSnap.data(),
                ...finPatch,
              },
            });
          }
        } else if (orderTotal > 0) {
          const finRecord = {
            id: finOrdRef.id,
            tenantId: orderData.tenantId || 'tenant-1',
            storeId: orderData.storeId || 'CENTRAL_WAREHOUSE',
            type: 'RECEIVABLE',
            category: 'VENDAS',
            description: `Venda ${orderData.channel || 'TABLE'} ${orderData.code || orderId} (${resolvedPaymentMethod})`,
            amount: orderTotal,
            dueDate: nowIso.split('T')[0],
            status: 'PAID',
            paymentMethod: resolvedPaymentMethod,
            paymentConfirmationType: confirmationType,
            settlementSource,
            confirmedByUid: authenticatedUser.uid,
            confirmedByRole: authenticatedUser.role,
            confirmedAt: nowIso,
            paidAt: nowIso,
            orderId,
            hlc,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          transaction.set(finOrdRef, finRecord);
          stageSyncOutboxInTransaction(transaction, {
            entity: 'financial_records',
            entityId: finOrdRef.id,
            operation: 'UPSERT',
            tenantId: finRecord.tenantId,
            storeId: finRecord.storeId,
            hlc,
            payload: finRecord,
          });
        }

        if (!wasPaid && openCashResult) {
          settleOpenCashSessionInTransaction(
            transaction,
            openCashResult.ref,
            openCashResult.snap,
            orderTotal,
            orderData.tenantId || 'tenant-1',
            orderData.storeId || null,
            hlc,
            nowIso
          );
        }

        return {
          orderId,
          paymentStatus: 'PAID',
          paymentMethod: resolvedPaymentMethod,
          paymentConfirmationType: confirmationType,
          confirmationType,
          settlementSource,
        };
      }, authenticatedUser.role === 'DEV_OWNER' ? { bypassRls: true } : { tenantId: authenticatedUser.tenantId });

      res.json({ success: true, ...result });
    } catch (err: any) {
      const msg = err?.message || 'Erro ao confirmar pagamento.';
      const status = msg.includes('Acesso negado') ? 403 : msg.includes('não encontrado') ? 404 : 400;
      res.status(status).json({ error: msg });
    }
  }
);

function timingSafeHexMatch(providedRaw: string, expectedHex: string): boolean {
  const normalized = providedRaw.trim().replace(/^sha256=/i, '').toLowerCase();
  if (!/^[a-f0-9]+$/.test(normalized) || normalized.length !== expectedHex.length) {
    return false;
  }
  const a = Buffer.from(normalized, 'hex');
  const b = Buffer.from(expectedHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Signed Automated PSP Payment Webhook (HMAC-SHA256 + Idempotency + Amount Reconciliation)
 * Separated strictly from manual operator confirmation.
 */
router.post('/payments/webhook', async (req, res) => {
  try {
    const signatureHeader = String(
      req.headers['x-psp-signature'] || req.headers['x-3c-signature'] || ''
    ).trim();
    const {
      orderId,
      providerTransactionId,
      provider = 'PIX_PSP',
      status,
      paymentMethod = 'PIX',
      paidAmount,
      integrationId,
    } = req.body || {};

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'orderId é obrigatório no webhook PSP.' });
    }
    if (!providerTransactionId || typeof providerTransactionId !== 'string') {
      return res.status(400).json({ error: 'providerTransactionId é obrigatório no webhook PSP.' });
    }

    const preflight = await runWithSystemDbContext('PSP_WEBHOOK_PREFLIGHT', async () => {
      const orderPreviewSnap = await db.collection('orders').doc(orderId).get();
      if (!orderPreviewSnap.exists) {
        return { found: false as const, orderPreview: null as any, resolvedSecret: '' };
      }
      const preview = orderPreviewSnap.data() || {};
      let secret = (process.env.PSP_WEBHOOK_SECRET || '').trim();
      if (!secret) {
        const integrationsSnap = await db.collection('integrations').get();
        const matchingInteg = integrationsSnap.docs
          .map((d) => d.data())
          .find((integ) => {
            if (!integ || integ._deleted || integ.status === 'SUSPENDED') return false;
            if (integrationId && integ.id === integrationId) return true;
            return integ.category === 'PAYMENT' && (!integ.tenantId || integ.tenantId === preview.tenantId);
          });
        const decrypted = matchingInteg ? decryptIntegrationSecret(matchingInteg.encryptedSecret) : null;
        if (decrypted) {
          secret = decrypted.trim();
        }
      }
      return { found: true as const, orderPreview: preview, resolvedSecret: secret };
    });

    if (!preflight.found) {
      return res.status(404).json({ error: `Pedido '${orderId}' não encontrado.` });
    }
    const orderPreview = preflight.orderPreview;
    const resolvedSecret = preflight.resolvedSecret;

    if (!resolvedSecret) {
      return res.status(503).json({
        error: 'Webhook PSP não configurado: defina PSP_WEBHOOK_SECRET ou credencial PAYMENT no cofre de integrações.',
      });
    }

    if (!signatureHeader) {
      return res.status(401).json({ error: 'Cabeçalho X-PSP-Signature ausente.' });
    }

    const bodyPayload = JSON.stringify(req.body || {});
    const expectedHmac = crypto.createHmac('sha256', resolvedSecret).update(bodyPayload).digest('hex');
    if (!timingSafeHexMatch(signatureHeader, expectedHmac)) {
      return res.status(401).json({ error: 'Assinatura HMAC-SHA256 do webhook PSP inválida.' });
    }

    const normalizedEventStatus = String(status || 'PAID').trim().toUpperCase();
    if (!['PAID', 'CONFIRMED', 'APPROVED', 'SETTLED', 'PAYMENT_CONFIRMED'].includes(normalizedEventStatus)) {
      return res.status(202).json({
        success: true,
        ignored: true,
        reason: `Evento PSP '${normalizedEventStatus}' não representa liquidação confirmada.`,
      });
    }

    const normalizedProvider = String(provider || 'PIX_PSP').trim().toUpperCase();
    const webhookEventDocId = `psp-${normalizedProvider}-${providerTransactionId.trim()}`.replace(/[^a-zA-Z0-9_-]/g, '_');

    const txOutcome = await db.runTransaction(async (transaction) => {
      const eventRef = db.collection('payment_webhook_events').doc(webhookEventDocId);
      const eventSnap = await transaction.get(eventRef);
      if (eventSnap.exists) {
        return {
          deduplicated: true as const,
          orderId,
          providerTransactionId: providerTransactionId.trim(),
        };
      }

      const orderRef = db.collection('orders').doc(orderId);
      const orderSnap = await transaction.get(orderRef);
      if (!orderSnap.exists) {
        throw new Error(`Pedido '${orderId}' não encontrado.`);
      }
      const orderData = orderSnap.data() || {};
      if (orderData.status === 'CANCELLED') {
        throw new Error('Pedido cancelado não aceita conciliação automática de pagamento.');
      }

      const orderTotal = Number(orderData.total) || 0;
      if (paidAmount !== undefined && paidAmount !== null) {
        const numericPaid = Number(paidAmount);
        if (!Number.isFinite(numericPaid) || Math.abs(numericPaid - orderTotal) > 0.01) {
          throw new Error(
            `Divergência de valor na conciliação PSP: esperado R$ ${orderTotal.toFixed(2)}, recebido R$ ${Number(paidAmount).toFixed(2)}.`
          );
        }
      }

      const resolvedMethod = [
        'PIX',
        'CREDIT_CARD',
        'DEBIT_CARD',
        'CASH',
        'BOLETO',
        'BANK_TRANSFER',
        'PAYMENT_LINK',
      ].includes(String(paymentMethod).toUpperCase())
        ? String(paymentMethod).toUpperCase()
        : (orderData.paymentMethod || 'PIX');

      const finOrdRef = db.collection('financial_records').doc(`fin-ord-${orderId}`);
      const finOrdSnap = await transaction.get(finOrdRef);

      const wasPaid = orderData.paymentStatus === 'PAID';
      const openCashResult =
        !wasPaid && orderData.storeId
          ? await findLatestOpenCashSessionInTx(transaction, orderData.storeId, orderData.tenantId)
          : null;

      const nowIso = new Date().toISOString();
      const hlc = generateHlcTimestamp('cloud_core');
      const confirmationType = 'AUTOMATED_PSP';
      const settlementSource = 'VERIFIED_PSP_WEBHOOK';

      const orderPatch: Record<string, any> = {
        paymentStatus: 'PAID',
        paymentMethod: resolvedMethod,
        paymentConfirmationType: confirmationType,
        settlementSource,
        pspProvider: normalizedProvider,
        providerTransactionId: providerTransactionId.trim(),
        confirmedByUid: `psp:${normalizedProvider}`,
        confirmedByRole: 'PSP_WEBHOOK',
        confirmedAt: nowIso,
        paidAt: orderData.paidAt || nowIso,
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

      if (finOrdSnap.exists) {
        if (finOrdSnap.data()?.status !== 'PAID') {
          const finPatch = {
            status: 'PAID',
            paymentMethod: resolvedMethod,
            paymentConfirmationType: confirmationType,
            settlementSource,
            pspProvider: normalizedProvider,
            providerTransactionId: providerTransactionId.trim(),
            confirmedByUid: `psp:${normalizedProvider}`,
            confirmedByRole: 'PSP_WEBHOOK',
            confirmedAt: nowIso,
            paidAt: nowIso,
            hlc,
            updatedAt: nowIso,
          };
          transaction.update(finOrdRef, finPatch);
          stageSyncOutboxInTransaction(transaction, {
            entity: 'financial_records',
            entityId: finOrdRef.id,
            operation: 'UPSERT',
            tenantId: orderData.tenantId || 'tenant-1',
            storeId: orderData.storeId || null,
            hlc,
            payload: { ...finOrdSnap.data(), ...finPatch },
          });
        }
      } else if (orderTotal > 0) {
        const finRecord = {
          id: finOrdRef.id,
          tenantId: orderData.tenantId || 'tenant-1',
          storeId: orderData.storeId || 'CENTRAL_WAREHOUSE',
          type: 'RECEIVABLE',
          category: 'VENDAS',
          description: `Venda ${orderData.channel || 'MARKETPLACE'} ${orderData.code || orderId} (${resolvedMethod} via ${normalizedProvider})`,
          amount: orderTotal,
          dueDate: nowIso.split('T')[0],
          status: 'PAID',
          paymentMethod: resolvedMethod,
          paymentConfirmationType: confirmationType,
          settlementSource,
          pspProvider: normalizedProvider,
          providerTransactionId: providerTransactionId.trim(),
          confirmedByUid: `psp:${normalizedProvider}`,
          confirmedByRole: 'PSP_WEBHOOK',
          confirmedAt: nowIso,
          paidAt: nowIso,
          orderId,
          hlc,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        transaction.set(finOrdRef, finRecord);
        stageSyncOutboxInTransaction(transaction, {
          entity: 'financial_records',
          entityId: finOrdRef.id,
          operation: 'UPSERT',
          tenantId: finRecord.tenantId,
          storeId: finRecord.storeId,
          hlc,
          payload: finRecord,
        });
      }

      if (!wasPaid && openCashResult) {
        settleOpenCashSessionInTransaction(
          transaction,
          openCashResult.ref,
          openCashResult.snap,
          orderTotal,
          orderData.tenantId || 'tenant-1',
          orderData.storeId || null,
          hlc,
          nowIso
        );
      }

      transaction.set(eventRef, {
        id: webhookEventDocId,
        orderId,
        tenantId: orderData.tenantId || 'tenant-1',
        storeId: orderData.storeId || null,
        provider: normalizedProvider,
        providerTransactionId: providerTransactionId.trim(),
        paidAmount: paidAmount ?? orderTotal,
        processedAt: nowIso,
      });

      return {
        deduplicated: false as const,
        orderId,
        tenantId: orderData.tenantId || 'tenant-1',
        storeId: orderData.storeId || null,
        paymentStatus: 'PAID',
        paymentMethod: resolvedMethod,
        paymentConfirmationType: confirmationType,
        settlementSource,
        providerTransactionId: providerTransactionId.trim(),
      };
    }, orderPreview.tenantId ? { tenantId: orderPreview.tenantId } : undefined);

    if (!txOutcome.deduplicated) {
      broadcastSseEvent(
        'ORDER_PAYMENT_CONFIRMED',
        {
          orderId: txOutcome.orderId,
          storeId: txOutcome.storeId,
          customerId: orderPreview.customerId || null,
          paymentStatus: 'PAID',
          paymentConfirmationType: txOutcome.paymentConfirmationType,
          providerTransactionId: txOutcome.providerTransactionId,
        },
        txOutcome.tenantId,
        true,
        {
          storeId: txOutcome.storeId,
          customerId: orderPreview.customerId || null,
        }
      );
    }

    return res.json({ success: true, ...txOutcome });
  } catch (err: any) {
    const msg = err?.message || 'Erro ao processar webhook PSP.';
    const status = msg.includes('não encontrado') ? 404 : 400;
    return res.status(status).json({ error: msg });
  }
});

export default router;
