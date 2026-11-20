import express from 'express';
import { buildSyncOutboxEntry } from '../../../../src/server/persistence/PersistenceDriver.ts';
import { generateHlcTimestamp, generateIdempotencyKey } from '@3c/commerce-engine';
import { EDGE_POS_AND_TABLE_ROLES } from '../../helpers.ts';
import { EdgeRouteContext } from '../types.ts';

export function registerEdgeOrderPaymentAndSyncRoutes(app: express.Express, ctx: EdgeRouteContext): void {
  const { nodeId, storeId, tenantId, config, driver, syncClient, authenticateEdge, requireEdgeRoles } = ctx;

  app.post(
    '/api/v1/commerce/orders/:orderId/confirm-payment',
    authenticateEdge,
    requireEdgeRoles(EDGE_POS_AND_TABLE_ROLES),
    async (req, res) => {
      try {
        const { orderId } = req.params;
        const { providerTransactionId, paymentMethod } = req.body || {};
        const authenticatedUser = (req as any).user || {};
        const result = await driver.runTransaction(async (tx) => {
          const orderSnap = await tx.get({ collectionName: 'orders', id: orderId });
          if (!orderSnap.exists || orderSnap.data()?._deleted) {
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

          const finOrdId = `fin-ord-${orderId}`;
          const finOrdSnap = await tx.get({ collectionName: 'financial_records', id: finOrdId });

          const confirmationType = 'MANUAL_OPERATOR';
          const settlementSource = 'OPERATOR_CONSOLE';
          const rawOperatorRef =
            typeof providerTransactionId === 'string' ? providerTransactionId.trim() : '';
          const operatorRef =
            rawOperatorRef && !rawOperatorRef.toUpperCase().startsWith('POS-TX-')
              ? rawOperatorRef
              : undefined;

          const nowIso = new Date().toISOString();
          const hlc = generateHlcTimestamp(nodeId);
          const wasPaid = orderData.paymentStatus === 'PAID';
          const nextOrder = {
            ...orderData,
            id: orderId,
            paymentStatus: 'PAID',
            paymentMethod: resolvedPaymentMethod,
            paymentConfirmationType: confirmationType,
            settlementSource,
            confirmedByUid: authenticatedUser.uid || null,
            confirmedByRole: authenticatedUser.role || null,
            confirmedAt: nowIso,
            paidAt: orderData.paidAt || nowIso,
            ...(operatorRef
              ? { operatorReferenceId: operatorRef }
              : {}),
            hlc,
            updatedAt: nowIso,
          };
          tx.set({ collectionName: 'orders', id: orderId }, nextOrder, { merge: true });
          const ordOutbox = buildSyncOutboxEntry({
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
          tx.set({ collectionName: 'sync_outbox', id: ordOutbox.id }, ordOutbox, { merge: false });

          const orderTotal = Number(orderData.total) || 0;
          if (finOrdSnap.exists) {
            if (finOrdSnap.data()?.status !== 'PAID') {
              const updatedFin = {
                ...finOrdSnap.data(),
                id: finOrdId,
                status: 'PAID',
                paymentMethod: resolvedPaymentMethod,
                paymentConfirmationType: confirmationType,
                settlementSource,
                confirmedByUid: authenticatedUser.uid || null,
                confirmedByRole: authenticatedUser.role || null,
                confirmedAt: nowIso,
                paidAt: nowIso,
                ...(operatorRef
                  ? { operatorReferenceId: operatorRef }
                  : {}),
                hlc,
                updatedAt: nowIso,
              };
              tx.set({ collectionName: 'financial_records', id: finOrdId }, updatedFin, { merge: true });
              const finOutbox = buildSyncOutboxEntry({
                entity: 'financial_records',
                entityId: finOrdId,
                operation: 'UPSERT',
                tenantId,
                storeId,
                nodeId,
                hlc,
                idempotencyKey: generateIdempotencyKey(),
                payload: updatedFin,
              });
              tx.set({ collectionName: 'sync_outbox', id: finOutbox.id }, finOutbox, { merge: false });
            }
          } else if (orderTotal > 0) {
            const finRecord = {
              id: finOrdId,
              tenantId,
              storeId,
              type: 'RECEIVABLE',
              category: 'VENDAS',
              description: `Venda Edge ${orderData.channel || 'TABLE'} ${orderData.code || orderId} (${resolvedPaymentMethod})`,
              amount: orderTotal,
              dueDate: nowIso.split('T')[0],
              status: 'PAID',
              paymentMethod: resolvedPaymentMethod,
              paymentConfirmationType: confirmationType,
              settlementSource,
              confirmedByUid: authenticatedUser.uid || null,
              confirmedByRole: authenticatedUser.role || null,
              confirmedAt: nowIso,
              paidAt: nowIso,
              ...(operatorRef
                ? { operatorReferenceId: operatorRef }
                : {}),
              orderId,
              hlc,
              createdAt: nowIso,
              updatedAt: nowIso,
            };
            tx.set({ collectionName: 'financial_records', id: finOrdId }, finRecord, { merge: false });
            const finOutbox = buildSyncOutboxEntry({
              entity: 'financial_records',
              entityId: finOrdId,
              operation: 'UPSERT',
              tenantId,
              storeId,
              nodeId,
              hlc,
              idempotencyKey: generateIdempotencyKey(),
              payload: finRecord,
            });
            tx.set({ collectionName: 'sync_outbox', id: finOutbox.id }, finOutbox, { merge: false });
          }

          if (!wasPaid && orderTotal > 0) {
            const openCashSession = (await driver.listDocs<any>('cash_sessions'))
              .filter((s) => !s._deleted && s.storeId === storeId && s.status === 'OPEN')
              .sort((a, b) => new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime())[0];
            if (openCashSession) {
              const nextTotalSales = Math.round(((Number(openCashSession.totalSales) || 0) + orderTotal) * 100) / 100;
              const nextFinalCash = Math.round(((Number(openCashSession.finalCashCalculated) || 0) + orderTotal) * 100) / 100;
              const updatedSession = {
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
                payload: updatedSession,
              });
              tx.set({ collectionName: 'sync_outbox', id: cashOutbox.id }, cashOutbox, { merge: false });
            }
          }

          return {
            orderId,
            paymentStatus: 'PAID',
            paymentMethod: resolvedPaymentMethod,
            paymentConfirmationType: confirmationType,
            settlementSource,
            confirmedByUid: authenticatedUser.uid || null,
            confirmedAt: nowIso,
          };
        });
        return res.json({ success: true, ...result });
      } catch (err: any) {
        return res.status(err?.statusCode || 400).json({ error: err?.message || 'Erro ao confirmar pagamento no Edge Node.' });
      }
    }
  );

  app.post(
    '/api/v1/edge/sync',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER']),
    async (req, res) => {
      try {
        const callerRole = String((req as any).user?.role || '').toUpperCase();
        const requestedCloudUrl =
          typeof req.body?.cloudBaseUrl === 'string' ? req.body.cloudBaseUrl.trim() : '';
        const configuredCloudUrl = String(config.cloudBaseUrl || '').trim();
        if (
          requestedCloudUrl &&
          configuredCloudUrl &&
          requestedCloudUrl.replace(/\/+$/, '') !== configuredCloudUrl.replace(/\/+$/, '') &&
          callerRole !== 'DEV_OWNER'
        ) {
          return res.status(403).json({
            error: 'Acesso negado: Apenas DEV_OWNER pode sobrescrever a URL da Cloud configurada no Edge Node.',
          });
        }
        const cloudUrl = configuredCloudUrl || (callerRole === 'DEV_OWNER' ? requestedCloudUrl : '');
        if (!cloudUrl) {
          return res.status(400).json({ error: 'cloudBaseUrl não configurado.' });
        }
        const token = req.headers.authorization!.slice('Bearer '.length).trim();
        const report = await syncClient.syncWithCloud(cloudUrl, token);
        res.json({ success: true, ...report });
      } catch (err: any) {
        res.status(502).json({ error: err?.message || 'Falha ao sincronizar com 3C Cloud.' });
      }
    }
  );
}
