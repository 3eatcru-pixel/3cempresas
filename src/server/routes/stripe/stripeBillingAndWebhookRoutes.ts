import express from 'express';
import { db, runWithSystemDbContext } from '../../config.ts';
import {
  AuthenticatedRequestUser,
  requireRoles,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import { verifyStoreTenantAccess } from '../store/storeAccessHelpers.ts';
import { DEFAULT_PLATFORM_GOVERNANCE } from '../../../constants/platformDefaults.ts';
import {
  constructVerifiedStripeEvent,
  createBillingPortalSession,
  createSaasSubscriptionCheckout,
  normalizeSafeRedirectUrl,
} from '../../services/stripeService.ts';
import { generateHlcTimestamp } from '../../../utils/idGenerator.ts';
import { stageSyncOutboxInTransaction } from '../../persistence/PersistenceDriver.ts';
import {
  findLatestOpenCashSessionInTx,
  settleOpenCashSessionInTransaction,
} from '../commerce/orderInventoryHelpers.ts';
import { broadcastSseEvent } from '../../state.ts';
import { recordAdminAuditEvent } from '../admin/adminHelpersCore.ts';

const router = express.Router();

const SERVER_PLAN_PRICING: Record<string, { MONTHLY: number; QUARTERLY: number; ANNUAL: number }> = {
  PROMO: { MONTHLY: 49.9, QUARTERLY: 44.91, ANNUAL: 37.43 },
  BASIC: { MONTHLY: 149.0, QUARTERLY: 134.1, ANNUAL: 111.75 },
  PRO: { MONTHLY: 299.0, QUARTERLY: 269.1, ANNUAL: 224.25 },
  ENTERPRISE: { MONTHLY: 499.0, QUARTERLY: 449.1, ANNUAL: 374.25 },
};

router.post(
  '/billing/subscription-checkout',
  verifyAutonomousToken,
  requireRoles(['STORE_OWNER', 'REGIONAL_MANAGER', 'DEV_OWNER']),
  async (req, res) => {
    try {
      const user = (req as any).user as AuthenticatedRequestUser;
      const storeId = String(req.body?.storeId || user.storeId || '').trim();
      const requestedPlan = String(req.body?.requestedPlan || 'PRO').trim().toUpperCase();
      const billingCycle = String(req.body?.billingCycle || 'MONTHLY').trim().toUpperCase() as
        | 'MONTHLY'
        | 'QUARTERLY'
        | 'ANNUAL';

      if (!storeId) {
        return res.status(400).json({ error: 'storeId é obrigatório.' });
      }
      if (!SERVER_PLAN_PRICING[requestedPlan]) {
        return res.status(400).json({ error: 'Plano pago inválido para checkout Stripe Billing.' });
      }
      if (!['MONTHLY', 'QUARTERLY', 'ANNUAL'].includes(billingCycle)) {
        return res.status(400).json({ error: 'Ciclo de faturamento inválido.' });
      }

      const check = await verifyStoreTenantAccess(storeId, user);
      if (check.ok === false) {
        return res.status(check.status).json({ error: check.error });
      }

      const govSnap = await runWithSystemDbContext('STRIPE_BILLING_GOV_READ', () =>
        db.collection('governance').doc('governance').get()
      );
      const govData = govSnap.exists ? govSnap.data() || {} : DEFAULT_PLATFORM_GOVERNANCE;
      const govTier = govData?.planPricing?.[requestedPlan];
      const multiplier = billingCycle === 'ANNUAL' ? 12 : billingCycle === 'QUARTERLY' ? 3 : 1;
      const unitMonthly =
        govTier?.monthlyPrice !== undefined
          ? billingCycle === 'ANNUAL' && govTier.annualPrice !== undefined
            ? Number(govTier.annualPrice)
            : billingCycle === 'QUARTERLY' && govTier.quarterlyPrice !== undefined
            ? Number(govTier.quarterlyPrice)
            : Number(govTier.monthlyPrice)
          : SERVER_PLAN_PRICING[requestedPlan][billingCycle];
      const baseAmountBrl = Math.round(unitMonthly * multiplier * 100) / 100;

      const session = await createSaasSubscriptionCheckout({
        store: { id: storeId, ...(check.store || {}) },
        planTier: requestedPlan,
        billingCycle,
        finalAmountBrl: baseAmountBrl,
        ownerEmail: user.email,
        couponCode: typeof req.body?.couponCode === 'string' ? req.body.couponCode.trim().toUpperCase() : undefined,
        successUrl: normalizeSafeRedirectUrl(
          req.body?.successUrl,
          `/?app=store-os&stripe_billing=success&storeId=${encodeURIComponent(storeId)}`
        ),
        cancelUrl: normalizeSafeRedirectUrl(
          req.body?.cancelUrl,
          `/?app=store-os&stripe_billing=cancel&storeId=${encodeURIComponent(storeId)}`
        ),
      });

      return res.json({ success: true, storeId, ...session });
    } catch (err: any) {
      return res.status(err?.statusCode || 500).json({
        error: err?.message || 'Falha ao iniciar checkout de assinatura Stripe Billing.',
      });
    }
  }
);

router.post(
  '/billing/portal',
  verifyAutonomousToken,
  requireRoles(['STORE_OWNER', 'REGIONAL_MANAGER', 'DEV_OWNER']),
  async (req, res) => {
    try {
      const user = (req as any).user as AuthenticatedRequestUser;
      const storeId = String(req.body?.storeId || user.storeId || '').trim();
      if (!storeId) {
        return res.status(400).json({ error: 'storeId é obrigatório.' });
      }
      const check = await verifyStoreTenantAccess(storeId, user);
      if (check.ok === false) {
        return res.status(check.status).json({ error: check.error });
      }
      const portal = await createBillingPortalSession({
        store: { id: storeId, ...(check.store || {}) },
        ownerEmail: user.email,
        returnUrl: normalizeSafeRedirectUrl(req.body?.returnUrl, '/?app=store-os'),
      });
      return res.json({ success: true, storeId, ...portal });
    } catch (err: any) {
      return res.status(err?.statusCode || 500).json({
        error: err?.message || 'Falha ao abrir portal de faturamento Stripe.',
      });
    }
  }
);

async function settleMarketplaceOrderFromStripe(orderId: string, providerTxId: string) {
  const preview = await runWithSystemDbContext('STRIPE_WEBHOOK_ORDER_PREVIEW', () =>
    db.collection('orders').doc(orderId).get()
  );
  if (!preview.exists) return null;
  const orderPreview = preview.data() || {};
  const outcome = await db.runTransaction(async (tx) => {
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) return null;
    const orderData = orderSnap.data() || {};
    if (orderData.status === 'CANCELLED' || orderData.paymentStatus === 'PAID') {
      return { alreadySettled: true, orderId, tenantId: orderData.tenantId, storeId: orderData.storeId, customerId: orderData.customerId };
    }
    const nowIso = new Date().toISOString();
    const hlc = generateHlcTimestamp('cloud_core');
    const orderTotal = Number(orderData.total) || 0;
    const patch = {
      paymentStatus: 'PAID',
      paymentConfirmationType: 'AUTOMATED_PSP',
      settlementSource: 'VERIFIED_STRIPE_WEBHOOK',
      pspProvider: 'STRIPE',
      providerTransactionId: providerTxId,
      confirmedByUid: 'psp:STRIPE',
      confirmedByRole: 'PSP_WEBHOOK',
      confirmedAt: nowIso,
      paidAt: orderData.paidAt || nowIso,
      hlc,
      updatedAt: nowIso,
    };
    tx.update(orderRef, patch);
    stageSyncOutboxInTransaction(tx, {
      entity: 'orders',
      entityId: orderId,
      operation: 'UPSERT',
      tenantId: orderData.tenantId || 'tenant-1',
      storeId: orderData.storeId || null,
      hlc,
      payload: { ...orderData, ...patch, id: orderId },
    });
    const openCash = orderData.storeId
      ? await findLatestOpenCashSessionInTx(tx, orderData.storeId, orderData.tenantId)
      : null;
    if (openCash) {
      settleOpenCashSessionInTransaction(
        tx,
        openCash.ref,
        openCash.snap,
        orderTotal,
        orderData.tenantId || 'tenant-1',
        orderData.storeId || null,
        hlc,
        nowIso
      );
    }
    return { alreadySettled: false, orderId, tenantId: orderData.tenantId || 'tenant-1', storeId: orderData.storeId || null, customerId: orderData.customerId || null };
  }, orderPreview.tenantId ? { tenantId: orderPreview.tenantId } : undefined);

  if (outcome && !outcome.alreadySettled) {
    broadcastSseEvent(
      'ORDER_PAYMENT_CONFIRMED',
      {
        orderId: outcome.orderId,
        storeId: outcome.storeId,
        customerId: outcome.customerId,
        paymentStatus: 'PAID',
        pspProvider: 'STRIPE',
        providerTransactionId: providerTxId,
      },
      outcome.tenantId,
      true,
      { storeId: outcome.storeId, customerId: outcome.customerId }
    );
  }
  return outcome;
}

router.post('/webhook', async (req, res) => {
  try {
    const signature = String(req.headers['stripe-signature'] || '').trim();
    if (!signature) {
      return res.status(401).json({ error: 'Cabeçalho stripe-signature ausente.' });
    }
    const rawBody: Buffer | string =
      (req as any).rawBody || (Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body || {}));
    const event = constructVerifiedStripeEvent(rawBody, signature);

    const alreadyProcessed = await runWithSystemDbContext('STRIPE_WEBHOOK_DEDUP', async () => {
      const ref = db.collection('stripe_webhook_events').doc(event.id);
      const snap = await ref.get();
      if (snap.exists) return true;
      await ref.set({ id: event.id, type: event.type, processedAt: new Date().toISOString() });
      return false;
    });
    if (alreadyProcessed) {
      return res.json({ received: true, deduplicated: true, eventId: event.id });
    }

    const obj = event.data.object as any;
    const nowIso = new Date().toISOString();

    if (event.type === 'payment_intent.succeeded' || (event.type === 'checkout.session.completed' && obj?.mode === 'payment')) {
      const orderId = obj?.metadata?.orderId;
      if (orderId) {
        await settleMarketplaceOrderFromStripe(String(orderId), String(obj.payment_intent || obj.id));
      }
    } else if (event.type === 'checkout.session.completed' && obj?.mode === 'subscription') {
      const storeId = obj?.metadata?.storeId;
      const planTier = obj?.metadata?.planTier;
      const billingCycle = obj?.metadata?.billingCycle;
      if (storeId && planTier) {
        await runWithSystemDbContext('STRIPE_SAAS_CHECKOUT_SETTLE', async () => {
          await db.collection('stores').doc(String(storeId)).set(
            {
              subscriptionPlan: String(planTier),
              billingCycle: String(billingCycle || 'MONTHLY'),
              saasPaymentStatus: 'PAID',
              saasSettlementType: 'AUTOMATED_PSP',
              saasProvider: 'STRIPE',
              stripeSubscriptionId: obj.subscription ? String(obj.subscription) : undefined,
              saasLastPaidAt: nowIso,
              saasNextDueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
              pendingUpgradeRequest: null,
              updatedAt: nowIso,
            },
            { merge: true }
          );
        });
        await recordAdminAuditEvent(
          'STRIPE_SAAS_SUBSCRIPTION_ACTIVATED',
          `Assinatura Stripe (${planTier}/${billingCycle}) ativada automaticamente para loja ${storeId}`,
          'hq/billing',
          String(obj?.metadata?.tenantId || 'tenant-1'),
          { req, resourceType: 'stores', resourceId: String(storeId) }
        );
      }
    } else if (event.type === 'invoice.paid') {
      await runWithSystemDbContext('STRIPE_INVOICE_PAID_SYNC', () =>
        db.collection('stripe_invoices').doc(String(obj.id)).set(
          { id: String(obj.id), status: 'paid', paidAt: nowIso, updatedAt: nowIso },
          { merge: true }
        )
      );
    } else if (event.type === 'account.updated' && obj?.metadata?.storeId) {
      await runWithSystemDbContext('STRIPE_CONNECT_WEBHOOK_SYNC', () =>
        db.collection('stores').doc(String(obj.metadata.storeId)).set(
          {
            stripeConnectAccountId: String(obj.id),
            stripeConnectChargesEnabled: Boolean(obj.charges_enabled),
            stripeConnectPayoutsEnabled: Boolean(obj.payouts_enabled),
            stripeConnectDetailsSubmitted: Boolean(obj.details_submitted),
            updatedAt: nowIso,
          },
          { merge: true }
        )
      );
    }

    return res.json({ received: true, deduplicated: false, eventId: event.id, type: event.type });
  } catch (err: any) {
    const status = err?.statusCode || (String(err?.type || '').includes('StripeSignatureVerificationError') ? 400 : 500);
    return res.status(status).json({ error: err?.message || 'Falha no webhook Stripe.' });
  }
});

export default router;
