import Stripe from 'stripe';
import { db, runWithSystemDbContext } from '../config.ts';

let cachedClient: { secretKey: string; client: Stripe } | null = null;

export function getStripeSecretKey(): string {
  return String(process.env.STRIPE_SECRET_KEY || '').trim();
}

export function getStripePublishableKey(): string {
  return String(
    process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY || ''
  ).trim();
}

export function getStripeWebhookSecret(): string {
  return String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
}

export function getStripeCurrency(): string {
  const raw = String(process.env.STRIPE_DEFAULT_CURRENCY || 'brl').trim().toLowerCase();
  return /^[a-z]{3}$/.test(raw) ? raw : 'brl';
}

export function isStripeConfigured(): boolean {
  return getStripeSecretKey().length > 0;
}

export function getStripeClient(): Stripe {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    const err: any = new Error(
      'Stripe não configurado no Server Core: defina STRIPE_SECRET_KEY no ambiente seguro do servidor.'
    );
    err.statusCode = 503;
    throw err;
  }
  if (!cachedClient || cachedClient.secretKey !== secretKey) {
    cachedClient = {
      secretKey,
      client: new Stripe(secretKey, {
        appInfo: {
          name: '3C Corp SaaS & Marketplace (3eatcrucom.br)',
          version: '5.2.1',
          url: 'https://www.3eatcrucom.br',
        },
      }),
    };
  }
  return cachedClient.client;
}

export function getStripePublicConfig() {
  const secretKey = getStripeSecretKey();
  const publishableKey = getStripePublishableKey();
  const webhookSecretConfigured = getStripeWebhookSecret().length > 0;
  const mode = !secretKey
    ? 'unconfigured'
    : secretKey.startsWith('sk_live_')
    ? 'live'
    : 'test';

  return {
    configured: Boolean(secretKey && publishableKey),
    secretConfigured: Boolean(secretKey),
    webhookSecretConfigured,
    mode,
    publishableKey: publishableKey || null,
    currency: getStripeCurrency(),
    businessDomain: 'www.3eatcrucom.br',
    products: {
      payments: Boolean(secretKey),
      billing: Boolean(secretKey),
      connect: Boolean(secretKey),
      invoicing: Boolean(secretKey),
    },
  };
}

export function normalizeSafeRedirectUrl(rawUrl: unknown, fallbackPath: string): string {
  const candidate = String(rawUrl || '').trim();
  if (candidate) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'))) {
        return parsed.toString();
      }
    } catch {
      // Fall back below
    }
  }
  const baseOrigin = String(
    process.env.APP_URL || process.env.CLOUD_BASE_URL || 'http://127.0.0.1:3000'
  )
    .trim()
    .replace(/\/+$/, '');
  const suffix = fallbackPath.startsWith('/') ? fallbackPath : `/${fallbackPath}`;
  return `${baseOrigin}${suffix}`;
}

export function toMinorCurrencyUnits(amountMajor: number): number {
  const numeric = Number(amountMajor);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return Math.round(numeric * 100);
}

export async function ensureStripeCustomerForStore(store: Record<string, any>, fallbackEmail?: string): Promise<string> {
  const stripe = getStripeClient();
  if (store.stripeCustomerId && typeof store.stripeCustomerId === 'string') {
    return store.stripeCustomerId;
  }

  const email =
    String(fallbackEmail || store.email || '').trim() ||
    `financeiro+${String(store.id || 'store').replace(/[^a-zA-Z0-9_-]/g, '')}@3eatcrucom.br`;

  const customer = await stripe.customers.create({
    name: String(store.name || `Loja ${store.id}`),
    email,
    phone: typeof store.phone === 'string' && store.phone.trim() ? store.phone.trim() : undefined,
    metadata: {
      storeId: String(store.id || ''),
      tenantId: String(store.tenantId || 'tenant-1'),
      platform: 'www.3eatcrucom.br',
    },
  });

  if (store.id) {
    await runWithSystemDbContext('STRIPE_STORE_CUSTOMER_PERSIST', () =>
      db.collection('stores').doc(String(store.id)).set(
        {
          stripeCustomerId: customer.id,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )
    );
  }

  return customer.id;
}

export function isStoreFreeOrTrialPlan(store?: Record<string, any> | null): boolean {
  const plan = String(store?.subscriptionPlan || 'FREE').trim().toUpperCase();
  const status = String(store?.saasPaymentStatus || '').trim().toUpperCase();
  return plan === 'FREE' || status === 'TRIAL';
}

export function computeOrderConnectSplit(params: {
  amountMinor: number;
  channel?: string;
  deliveryModality?: string;
  store?: Record<string, any> | null;
  globalCommissionRate?: number;
  platformFleetCommissionEnabled?: boolean;
}) {
  const store = params.store || {};
  const connectAccountId =
    typeof store.stripeConnectAccountId === 'string' ? store.stripeConnectAccountId.trim() : '';
  const chargesEnabled = Boolean(store.stripeConnectChargesEnabled);

  if (!connectAccountId || !chargesEnabled) {
    return {
      destinationAccountId: null as string | null,
      applicationFeeAmount: 0,
      commissionRateApplied: 0,
    };
  }

  const channelUpper = String(params.channel || 'MARKETPLACE').toUpperCase();
  const modalityUpper = String(params.deliveryModality || '').toUpperCase();
  const isDirectInStoreSale = ['PDV', 'POS', 'WAITER', 'WAITER_TABLE', 'TABLE', 'KIOSK'].includes(
    channelUpper
  );
  const isNonPlatformFleetDelivery =
    modalityUpper === 'STORE_FLEET' || modalityUpper === 'PICKUP' || modalityUpper === 'TABLE';
  // A plataforma monetiza via subscrição SaaS (0% sobre vendas); comissão percentual aplica-se
  // somente quando a frota de motoristas da plataforma estiver explicitamente liberada e ativa.
  const commissionDisabledByModel =
    isDirectInStoreSale ||
    isNonPlatformFleetDelivery ||
    params.platformFleetCommissionEnabled === false;

  const rawCommission = commissionDisabledByModel
    ? 0
    : Number(store.commissionRate ?? params.globalCommissionRate ?? 0);
  const commissionPct = Math.min(50, Math.max(0, Number.isFinite(rawCommission) ? rawCommission : 0));
  const applicationFeeAmount =
    commissionPct > 0 ? Math.round((params.amountMinor * commissionPct) / 100) : 0;

  return {
    destinationAccountId: connectAccountId,
    applicationFeeAmount: Math.min(Math.max(0, applicationFeeAmount), Math.max(0, params.amountMinor - 50)),
    commissionRateApplied: commissionPct,
  };
}

export async function createOrderPaymentIntent(params: {
  order: Record<string, any>;
  store: Record<string, any>;
  globalCommissionRate?: number;
  platformFleetCommissionEnabled?: boolean;
  customerEmail?: string;
}) {
  const stripe = getStripeClient();
  const amountMinor = toMinorCurrencyUnits(Number(params.order.total || 0));
  if (amountMinor < 100) {
    const err: any = new Error('Valor mínimo para pagamento Stripe é R$ 1,00.');
    err.statusCode = 400;
    throw err;
  }

  const split = computeOrderConnectSplit({
    amountMinor,
    channel: params.order.channel,
    deliveryModality: params.order.deliveryModality,
    store: params.store,
    globalCommissionRate: params.globalCommissionRate,
    platformFleetCommissionEnabled: params.platformFleetCommissionEnabled,
  });

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountMinor,
    currency: getStripeCurrency(),
    automatic_payment_methods: { enabled: true },
    receipt_email: params.customerEmail && /@/.test(params.customerEmail) ? params.customerEmail : undefined,
    description: `Pedido ${params.order.code || params.order.id} - ${params.store.name || params.order.storeId}`,
    metadata: {
      kind: 'MARKETPLACE_ORDER',
      orderId: String(params.order.id),
      storeId: String(params.order.storeId || params.store.id || ''),
      tenantId: String(params.order.tenantId || params.store.tenantId || 'tenant-1'),
      channel: String(params.order.channel || 'MARKETPLACE'),
    },
    ...(split.destinationAccountId
      ? {
          transfer_data: { destination: split.destinationAccountId },
          ...(split.applicationFeeAmount > 0
            ? { application_fee_amount: split.applicationFeeAmount }
            : {}),
        }
      : {}),
  });

  await runWithSystemDbContext('STRIPE_ORDER_INTENT_PERSIST', () =>
    db.collection('orders').doc(String(params.order.id)).set(
      {
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )
  );

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    amountMinor: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: paymentIntent.status,
    connectSplitApplied: Boolean(split.destinationAccountId),
    applicationFeeAmount: split.applicationFeeAmount,
  };
}

export async function createOrderCheckoutSession(params: {
  order: Record<string, any>;
  store: Record<string, any>;
  globalCommissionRate?: number;
  platformFleetCommissionEnabled?: boolean;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = getStripeClient();
  const amountMinor = toMinorCurrencyUnits(Number(params.order.total || 0));
  if (amountMinor < 100) {
    const err: any = new Error('Valor mínimo para checkout Stripe é R$ 1,00.');
    err.statusCode = 400;
    throw err;
  }

  const split = computeOrderConnectSplit({
    amountMinor,
    channel: params.order.channel,
    deliveryModality: params.order.deliveryModality,
    store: params.store,
    globalCommissionRate: params.globalCommissionRate,
    platformFleetCommissionEnabled: params.platformFleetCommissionEnabled,
  });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer_email:
      params.customerEmail && /@/.test(params.customerEmail) ? params.customerEmail : undefined,
    line_items: [
      {
        price_data: {
          currency: getStripeCurrency(),
          unit_amount: amountMinor,
          product_data: {
            name: `Pedido ${params.order.code || params.order.id}`,
            description: `${params.store.name || 'Estabelecimento'} (${params.order.items?.length || 1} item(ns))`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      kind: 'MARKETPLACE_ORDER',
      orderId: String(params.order.id),
      storeId: String(params.order.storeId || params.store.id || ''),
      tenantId: String(params.order.tenantId || params.store.tenantId || 'tenant-1'),
      channel: String(params.order.channel || 'MARKETPLACE'),
    },
    payment_intent_data: {
      metadata: {
        kind: 'MARKETPLACE_ORDER',
        orderId: String(params.order.id),
        storeId: String(params.order.storeId || params.store.id || ''),
        tenantId: String(params.order.tenantId || params.store.tenantId || 'tenant-1'),
        channel: String(params.order.channel || 'MARKETPLACE'),
      },
      ...(split.destinationAccountId
        ? {
            transfer_data: { destination: split.destinationAccountId },
            ...(split.applicationFeeAmount > 0
              ? { application_fee_amount: split.applicationFeeAmount }
              : {}),
          }
        : {}),
    },
  });

  await runWithSystemDbContext('STRIPE_ORDER_SESSION_PERSIST', () =>
    db.collection('orders').doc(String(params.order.id)).set(
      {
        stripeCheckoutSessionId: session.id,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )
  );

  return {
    sessionId: session.id,
    url: session.url,
    amountMinor,
    currency: getStripeCurrency(),
    connectSplitApplied: Boolean(split.destinationAccountId),
    applicationFeeAmount: split.applicationFeeAmount,
  };
}

export {
  createOrGetConnectAccount,
  createConnectOnboardingLink,
  syncConnectAccountStatus,
  createSaasSubscriptionCheckout,
  createBillingPortalSession,
  createAndFinalizeInvoice,
  listStoreInvoices,
} from './stripeConnectAndBillingService.ts';

export function constructVerifiedStripeEvent(rawBody: Buffer | string, signature: string): Stripe.Event {
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    const err: any = new Error(
      'STRIPE_WEBHOOK_SECRET não configurado no Server Core.'
    );
    err.statusCode = 503;
    throw err;
  }
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}
