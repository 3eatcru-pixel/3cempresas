import express from 'express';
import { db, runWithSystemDbContext } from '../../config.ts';
import {
  AuthenticatedRequestUser,
  hasUserStoreAccess,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import {
  createOrderCheckoutSession,
  createOrderPaymentIntent,
  normalizeSafeRedirectUrl,
} from '../../services/stripeService.ts';

const router = express.Router();

async function loadAuthorizedOrderContext(
  orderId: string,
  user: AuthenticatedRequestUser
): Promise<
  | { ok: true; order: Record<string, any>; store: Record<string, any>; globalCommissionRate: number }
  | { ok: false; status: number; error: string }
> {
  const orderSnap = await runWithSystemDbContext('STRIPE_ORDER_LOAD', () =>
    db.collection('orders').doc(orderId).get()
  );
  if (!orderSnap.exists) {
    return { ok: false, status: 404, error: `Pedido '${orderId}' não encontrado.` };
  }
  const order = { id: orderSnap.id, ...(orderSnap.data() || {}) };
  if (order.status === 'CANCELLED') {
    return { ok: false, status: 400, error: 'Pedido cancelado não aceita cobrança Stripe.' };
  }
  if (order.paymentStatus === 'PAID') {
    return { ok: false, status: 409, error: 'Este pedido já se encontra quitado.' };
  }

  const isStaff = ['STORE_OWNER', 'REGIONAL_MANAGER', 'STORE_MANAGER', 'CASHIER', 'WAITER'].includes(
    user.role
  );
  if (user.role !== 'DEV_OWNER') {
    if (isStaff) {
      if (order.tenantId !== user.tenantId || !hasUserStoreAccess(user, order.storeId)) {
        return { ok: false, status: 403, error: 'Acesso negado ao pedido de outra loja.' };
      }
    } else if (order.customerId && order.customerId !== user.uid) {
      return { ok: false, status: 403, error: 'Acesso negado: pedido pertence a outro consumidor.' };
    } else if (!order.customerId) {
      return { ok: false, status: 403, error: 'Consumidor não autenticado para este pedido.' };
    }
  }

  const [storeSnap, govSnap] = await runWithSystemDbContext('STRIPE_ORDER_STORE_GOV', () =>
    Promise.all([
      db.collection('stores').doc(String(order.storeId || '')).get(),
      db.collection('governance').doc('governance').get(),
    ])
  );
  const store = storeSnap.exists ? { id: storeSnap.id, ...(storeSnap.data() || {}) } : { id: order.storeId };
  const globalCommissionRate = Number(govSnap.exists ? govSnap.data()?.globalCommissionRate ?? 12 : 12);

  return { ok: true, order, store, globalCommissionRate };
}

router.post('/payments/intent', verifyAutonomousToken, async (req, res) => {
  try {
    const user = (req as any).user as AuthenticatedRequestUser;
    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) {
      return res.status(400).json({ error: 'orderId é obrigatório para criar PaymentIntent.' });
    }

    const ctx = await loadAuthorizedOrderContext(orderId, user);
    if (ctx.ok === false) {
      return res.status(ctx.status).json({ error: ctx.error });
    }

    const intent = await createOrderPaymentIntent({
      order: ctx.order,
      store: ctx.store,
      globalCommissionRate: ctx.globalCommissionRate,
      customerEmail: user.email,
    });
    return res.json({ success: true, orderId, ...intent });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      error: err?.message || 'Falha ao gerar PaymentIntent Stripe.',
    });
  }
});

router.post('/payments/checkout-session', verifyAutonomousToken, async (req, res) => {
  try {
    const user = (req as any).user as AuthenticatedRequestUser;
    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) {
      return res.status(400).json({ error: 'orderId é obrigatório para Checkout Stripe.' });
    }

    const ctx = await loadAuthorizedOrderContext(orderId, user);
    if (ctx.ok === false) {
      return res.status(ctx.status).json({ error: ctx.error });
    }

    const successUrl = normalizeSafeRedirectUrl(
      req.body?.successUrl,
      `/?app=marketplace&stripe_payment=success&orderId=${encodeURIComponent(orderId)}`
    );
    const cancelUrl = normalizeSafeRedirectUrl(
      req.body?.cancelUrl,
      `/?app=marketplace&stripe_payment=cancel&orderId=${encodeURIComponent(orderId)}`
    );

    const session = await createOrderCheckoutSession({
      order: ctx.order,
      store: ctx.store,
      globalCommissionRate: ctx.globalCommissionRate,
      customerEmail: user.email,
      successUrl,
      cancelUrl,
    });
    return res.json({ success: true, orderId, ...session });
  } catch (err: any) {
    return res.status(err?.statusCode || 500).json({
      error: err?.message || 'Falha ao gerar sessão de pagamento Stripe.',
    });
  }
});

export default router;
