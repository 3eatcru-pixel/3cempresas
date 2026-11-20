import express from 'express';
import { db, runWithSystemDbContext } from '../../config.ts';
import {
  AuthenticatedRequestUser,
  requireRoles,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import { verifyStoreTenantAccess } from '../store/storeAccessHelpers.ts';
import {
  createAndFinalizeInvoice,
  createConnectOnboardingLink,
  createOrGetConnectAccount,
  isStoreFreeOrTrialPlan,
  listStoreInvoices,
  normalizeSafeRedirectUrl,
  syncConnectAccountStatus,
} from '../../services/stripeService.ts';

const FREE_PLAN_STRIPE_BLOCK_MESSAGE =
  'Stripe Connect e cobrança por cartão pela plataforma estão disponíveis apenas nos planos pagos (Promo, Basic, Pro ou Enterprise). No Plano Free (7 dias grátis), utilize PIX direto da loja ou pagamento manual/maquininha externa.';

const router = express.Router();

router.post(
  '/connect/account',
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
      if (user.role !== 'DEV_OWNER' && isStoreFreeOrTrialPlan(check.store)) {
        return res.status(403).json({ error: FREE_PLAN_STRIPE_BLOCK_MESSAGE });
      }
      const result = await createOrGetConnectAccount(
        { id: storeId, ...(check.store || {}) },
        req.body?.email || user.email
      );
      return res.json({ success: true, storeId, ...result });
    } catch (err: any) {
      return res.status(err?.statusCode || 500).json({
        error: err?.message || 'Falha ao provisionar conta conectada Stripe Connect.',
      });
    }
  }
);

router.post(
  '/connect/onboarding-link',
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
      if (user.role !== 'DEV_OWNER' && isStoreFreeOrTrialPlan(check.store)) {
        return res.status(403).json({ error: FREE_PLAN_STRIPE_BLOCK_MESSAGE });
      }
      const ensured = await createOrGetConnectAccount(
        { id: storeId, ...(check.store || {}) },
        user.email
      );
      const refreshUrl = normalizeSafeRedirectUrl(
        req.body?.refreshUrl,
        `/?app=store-os&connect=refresh&storeId=${encodeURIComponent(storeId)}`
      );
      const returnUrl = normalizeSafeRedirectUrl(
        req.body?.returnUrl,
        `/?app=store-os&connect=return&storeId=${encodeURIComponent(storeId)}`
      );
      const link = await createConnectOnboardingLink({
        accountId: ensured.accountId,
        refreshUrl,
        returnUrl,
      });
      return res.json({ success: true, storeId, accountId: ensured.accountId, ...link });
    } catch (err: any) {
      return res.status(err?.statusCode || 500).json({
        error: err?.message || 'Falha ao gerar link de onboarding Stripe Connect.',
      });
    }
  }
);

router.get(
  '/connect/status/:storeId',
  verifyAutonomousToken,
  requireRoles(['STORE_OWNER', 'REGIONAL_MANAGER', 'STORE_MANAGER', 'DEV_OWNER']),
  async (req, res) => {
    try {
      const user = (req as any).user as AuthenticatedRequestUser;
      const { storeId } = req.params;
      const check = await verifyStoreTenantAccess(storeId, user);
      if (check.ok === false) {
        return res.status(check.status).json({ error: check.error });
      }
      const accountId = check.store?.stripeConnectAccountId;
      if (!accountId) {
        return res.json({
          connected: false,
          storeId,
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
        });
      }
      const synced = await syncConnectAccountStatus(storeId, String(accountId));
      return res.json({ connected: true, storeId, ...synced });
    } catch (err: any) {
      return res.status(err?.statusCode || 500).json({
        error: err?.message || 'Falha ao sincronizar status Stripe Connect.',
      });
    }
  }
);

router.post(
  '/invoices',
  verifyAutonomousToken,
  requireRoles(['STORE_OWNER', 'REGIONAL_MANAGER', 'STORE_MANAGER', 'DEV_OWNER']),
  async (req, res) => {
    try {
      const user = (req as any).user as AuthenticatedRequestUser;
      const storeId = String(req.body?.storeId || user.storeId || '').trim();
      if (!storeId) {
        return res.status(400).json({ error: 'storeId é obrigatório para faturamento.' });
      }
      const check = await verifyStoreTenantAccess(storeId, user);
      if (check.ok === false) {
        return res.status(check.status).json({ error: check.error });
      }
      if (user.role !== 'DEV_OWNER' && isStoreFreeOrTrialPlan(check.store)) {
        return res.status(403).json({ error: FREE_PLAN_STRIPE_BLOCK_MESSAGE });
      }
      const amountBrl = Number(req.body?.amount);
      if (!Number.isFinite(amountBrl) || amountBrl < 1) {
        return res.status(400).json({ error: 'Valor da fatura inválido (mínimo R$ 1,00).' });
      }
      const description = String(req.body?.description || `Fatura comercial - ${check.store?.name || storeId}`).trim();
      const invoice = await createAndFinalizeInvoice({
        store: { id: storeId, ...(check.store || {}) },
        customerEmail: req.body?.customerEmail || user.email,
        amountBrl,
        description,
        daysUntilDue: req.body?.daysUntilDue,
        sendNow: req.body?.sendNow !== false,
      });
      return res.json({ success: true, invoice });
    } catch (err: any) {
      return res.status(err?.statusCode || 500).json({
        error: err?.message || 'Falha ao emitir fatura Stripe Invoicing.',
      });
    }
  }
);

router.get(
  '/invoices',
  verifyAutonomousToken,
  requireRoles(['STORE_OWNER', 'REGIONAL_MANAGER', 'STORE_MANAGER', 'DEV_OWNER']),
  async (req, res) => {
    try {
      const user = (req as any).user as AuthenticatedRequestUser;
      const storeId = String(req.query.storeId || user.storeId || '').trim();
      if (!storeId) {
        return res.status(400).json({ error: 'storeId é obrigatório.' });
      }
      const check = await verifyStoreTenantAccess(storeId, user);
      if (check.ok === false) {
        return res.status(check.status).json({ error: check.error });
      }

      const [remoteInvoices, localSnap] = await Promise.all([
        listStoreInvoices({ id: storeId, ...(check.store || {}) }),
        runWithSystemDbContext('STRIPE_INVOICES_LOCAL_LIST', () =>
          db.collection('stripe_invoices').get()
        ),
      ]);

      const localMatches = localSnap.docs
        .map((d) => d.data())
        .filter((inv) => inv && inv.storeId === storeId && (!check.store?.tenantId || inv.tenantId === check.store.tenantId));

      return res.json({
        storeId,
        invoices: remoteInvoices.length > 0 ? remoteInvoices : localMatches,
      });
    } catch (err: any) {
      return res.status(err?.statusCode || 500).json({
        error: err?.message || 'Falha ao listar faturas Stripe Invoicing.',
      });
    }
  }
);

export default router;
