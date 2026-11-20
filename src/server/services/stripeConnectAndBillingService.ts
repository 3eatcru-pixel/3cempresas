import Stripe from 'stripe';
import { db, runWithSystemDbContext } from '../config.ts';
import {
  ensureStripeCustomerForStore,
  getStripeClient,
  getStripeCurrency,
  toMinorCurrencyUnits,
} from './stripeService.ts';

export async function createOrGetConnectAccount(store: Record<string, any>, ownerEmail?: string) {
  const stripe = getStripeClient();
  if (store.stripeConnectAccountId && typeof store.stripeConnectAccountId === 'string') {
    const existing = await stripe.accounts.retrieve(store.stripeConnectAccountId);
    return {
      accountId: existing.id,
      chargesEnabled: Boolean(existing.charges_enabled),
      payoutsEnabled: Boolean(existing.payouts_enabled),
      detailsSubmitted: Boolean(existing.details_submitted),
      created: false,
    };
  }

  const accountV2 = await stripe.v2.core.accounts.create({
    display_name: String(store.name || `Loja ${store.id}`),
    contact_email: ownerEmail && /@/.test(ownerEmail) ? ownerEmail : undefined,
    dashboard: 'express',
    identity: {
      country: 'br',
    },
    defaults: {
      responsibilities: {
        fees_collector: 'application',
        losses_collector: 'stripe',
      },
    },
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { requested: true },
        },
      },
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { requested: true },
          },
        },
      },
    },
    metadata: {
      storeId: String(store.id),
      tenantId: String(store.tenantId || 'tenant-1'),
      platform: 'www.3eatcrucom.br',
    },
  });

  const account = await stripe.accounts.retrieve(accountV2.id);
  const nowIso = new Date().toISOString();
  await runWithSystemDbContext('STRIPE_CONNECT_ACCOUNT_PERSIST', () =>
    db.collection('stores').doc(String(store.id)).set(
      {
        stripeConnectAccountId: account.id,
        stripeConnectChargesEnabled: Boolean(account.charges_enabled),
        stripeConnectPayoutsEnabled: Boolean(account.payouts_enabled),
        stripeConnectDetailsSubmitted: Boolean(account.details_submitted),
        updatedAt: nowIso,
      },
      { merge: true }
    )
  );

  return {
    accountId: account.id,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    created: true,
  };
}

export async function createConnectOnboardingLink(params: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}) {
  const stripe = getStripeClient();
  try {
    const v2Link = await stripe.v2.core.accountLinks.create({
      account: params.accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          refresh_url: params.refreshUrl,
          return_url: params.returnUrl,
        },
      },
    });
    return {
      url: v2Link.url,
      expiresAt: Math.floor(new Date(v2Link.expires_at).getTime() / 1000),
    };
  } catch {
    const link = await stripe.accountLinks.create({
      account: params.accountId,
      refresh_url: params.refreshUrl,
      return_url: params.returnUrl,
      type: 'account_onboarding',
    });
    return {
      url: link.url,
      expiresAt: link.expires_at,
    };
  }
}

export async function syncConnectAccountStatus(storeId: string, accountId: string) {
  const stripe = getStripeClient();
  const account = await stripe.accounts.retrieve(accountId);
  const nowIso = new Date().toISOString();
  await runWithSystemDbContext('STRIPE_CONNECT_SYNC_PERSIST', () =>
    db.collection('stores').doc(String(storeId)).set(
      {
        stripeConnectAccountId: account.id,
        stripeConnectChargesEnabled: Boolean(account.charges_enabled),
        stripeConnectPayoutsEnabled: Boolean(account.payouts_enabled),
        stripeConnectDetailsSubmitted: Boolean(account.details_submitted),
        updatedAt: nowIso,
      },
      { merge: true }
    )
  );
  return {
    accountId: account.id,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    requirementsDue: account.requirements?.currently_due || [],
  };
}

export async function createSaasSubscriptionCheckout(params: {
  store: Record<string, any>;
  planTier: string;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  finalAmountBrl: number;
  ownerEmail?: string;
  couponCode?: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = getStripeClient();
  const amountMinor = toMinorCurrencyUnits(params.finalAmountBrl);
  if (amountMinor < 100) {
    const err: any = new Error('Valor mínimo de assinatura no Stripe Billing é R$ 1,00.');
    err.statusCode = 400;
    throw err;
  }

  const customerId = await ensureStripeCustomerForStore(params.store, params.ownerEmail);
  const recurring: Stripe.Checkout.SessionCreateParams.LineItem.PriceData.Recurring =
    params.billingCycle === 'ANNUAL'
      ? { interval: 'year', interval_count: 1 }
      : params.billingCycle === 'QUARTERLY'
      ? { interval: 'month', interval_count: 3 }
      : { interval: 'month', interval_count: 1 };

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    line_items: [
      {
        price_data: {
          currency: getStripeCurrency(),
          unit_amount: amountMinor,
          recurring,
          product_data: {
            name: `Assinatura SaaS ${params.planTier} (${params.billingCycle})`,
            description: `Licença operacional PDV & Marketplace para ${params.store.name || params.store.id}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      kind: 'SAAS_SUBSCRIPTION',
      storeId: String(params.store.id),
      tenantId: String(params.store.tenantId || 'tenant-1'),
      planTier: params.planTier,
      billingCycle: params.billingCycle,
      ...(params.couponCode ? { couponCode: params.couponCode } : {}),
    },
    subscription_data: {
      metadata: {
        kind: 'SAAS_SUBSCRIPTION',
        storeId: String(params.store.id),
        tenantId: String(params.store.tenantId || 'tenant-1'),
        planTier: params.planTier,
        billingCycle: params.billingCycle,
      },
    },
  });

  return {
    sessionId: session.id,
    url: session.url,
    customerId,
    amountMinor,
    currency: getStripeCurrency(),
  };
}

export async function createBillingPortalSession(params: {
  store: Record<string, any>;
  ownerEmail?: string;
  returnUrl: string;
}) {
  const stripe = getStripeClient();
  const customerId = await ensureStripeCustomerForStore(params.store, params.ownerEmail);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: params.returnUrl,
  });
  return {
    url: session.url,
    customerId,
  };
}

export async function createAndFinalizeInvoice(params: {
  store: Record<string, any>;
  customerEmail?: string;
  amountBrl: number;
  description: string;
  daysUntilDue?: number;
  metadata?: Record<string, string>;
  sendNow?: boolean;
}) {
  const stripe = getStripeClient();
  const amountMinor = toMinorCurrencyUnits(params.amountBrl);
  if (amountMinor < 100) {
    const err: any = new Error('Valor mínimo de fatura Stripe Invoicing é R$ 1,00.');
    err.statusCode = 400;
    throw err;
  }

  const customerId = await ensureStripeCustomerForStore(params.store, params.customerEmail);
  const daysUntilDue = Math.min(90, Math.max(1, Math.floor(Number(params.daysUntilDue ?? 7))));

  const draftInvoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: 'send_invoice',
    days_until_due: daysUntilDue,
    auto_advance: false,
    description: params.description.slice(0, 200),
    metadata: {
      kind: 'COMMERCIAL_INVOICE',
      storeId: String(params.store.id),
      tenantId: String(params.store.tenantId || 'tenant-1'),
      ...(params.metadata || {}),
    },
  });

  await stripe.invoiceItems.create({
    customer: customerId,
    invoice: draftInvoice.id,
    amount: amountMinor,
    currency: getStripeCurrency(),
    description: params.description.slice(0, 200),
  });

  let finalized = await stripe.invoices.finalizeInvoice(draftInvoice.id);
  if (params.sendNow !== false && finalized.status === 'open') {
    try {
      finalized = await stripe.invoices.sendInvoice(finalized.id);
    } catch {
      // Test mode / email delivery settings may return finalized open invoice without sending email
    }
  }

  const record = {
    id: finalized.id,
    storeId: String(params.store.id),
    tenantId: String(params.store.tenantId || 'tenant-1'),
    customerId,
    status: finalized.status || 'open',
    amountBrl: Math.round(amountMinor) / 100,
    amountMinor,
    currency: finalized.currency,
    description: params.description,
    hostedInvoiceUrl: finalized.hosted_invoice_url || null,
    invoicePdf: finalized.invoice_pdf || null,
    number: finalized.number || null,
    dueDate: finalized.due_date ? new Date(finalized.due_date * 1000).toISOString().slice(0, 10) : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await runWithSystemDbContext('STRIPE_INVOICE_PERSIST', () =>
    db.collection('stripe_invoices').doc(finalized.id).set(record, { merge: true })
  );

  return record;
}

export async function listStoreInvoices(params: { store: Record<string, any> }) {
  const stripe = getStripeClient();
  if (!params.store.stripeCustomerId) {
    return [];
  }
  const list = await stripe.invoices.list({
    customer: String(params.store.stripeCustomerId),
    limit: 20,
  });
  return list.data.map((inv) => ({
    id: inv.id,
    number: inv.number || null,
    status: inv.status || 'draft',
    amountBrl: Number(inv.amount_due || 0) / 100,
    amountPaidBrl: Number(inv.amount_paid || 0) / 100,
    currency: inv.currency,
    description: inv.description || null,
    hostedInvoiceUrl: inv.hosted_invoice_url || null,
    invoicePdf: inv.invoice_pdf || null,
    dueDate: inv.due_date ? new Date(inv.due_date * 1000).toISOString().slice(0, 10) : null,
    createdAt: new Date(inv.created * 1000).toISOString(),
  }));
}
