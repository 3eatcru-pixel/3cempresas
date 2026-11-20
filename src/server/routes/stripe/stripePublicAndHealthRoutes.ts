import express from 'express';
import { verifyAutonomousToken, requireRoles } from '../../middleware/auth.ts';
import { getStripeClient, getStripePublicConfig } from '../../services/stripeService.ts';

const router = express.Router();

/**
 * Public non-secret Stripe capabilities & publishable key for client Checkout/Elements
 */
router.get('/config', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(getStripePublicConfig());
});

/**
 * Live Stripe account & balance health probe (HQ governance only)
 */
router.get('/health', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (_req, res) => {
  const pub = getStripePublicConfig();
  if (!pub.secretConfigured) {
    return res.json({
      ...pub,
      healthy: false,
      reason: 'STRIPE_SECRET_KEY não configurada no ambiente do Server Core.',
    });
  }
  try {
    const stripe = getStripeClient();
    const [account, balance] = await Promise.all([
      stripe.accounts.retrieve(null),
      stripe.balance.retrieve(),
    ]);
    return res.json({
      ...pub,
      healthy: true,
      accountId: account.id,
      country: account.country || 'BR',
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      availableBalances: (balance.available || []).map((b) => ({
        currency: b.currency,
        amountMajor: Number(b.amount || 0) / 100,
      })),
      pendingBalances: (balance.pending || []).map((b) => ({
        currency: b.currency,
        amountMajor: Number(b.amount || 0) / 100,
      })),
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(502).json({
      ...pub,
      healthy: false,
      error: err?.message || 'Falha ao consultar API Stripe no Server Core.',
    });
  }
});

export default router;
