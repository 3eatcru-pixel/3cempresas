import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Stripe from 'stripe';

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-stripe-test-'));
  process.env.NODE_ENV = 'development';
  process.env.SERVER_DB_PATH = path.join(tmpDir, 'server-db.json');
  process.env.SERVER_SECRET_PATH = path.join(tmpDir, '.server-secret');
  process.env.SERVER_SECRET = 'test-secret-stripe-integration-2026';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_sentinel_deterministic_secret_2026';

  const { db, runWithSystemDbContext } = await import('../../src/server/config.ts');
  const { createServerCoreApp } = await import('../../src/server/app.ts');
  const { computeOrderConnectSplit } = await import('../../src/server/services/stripeService.ts');

  const app = createServerCoreApp();
  const server = await new Promise<any>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  let passed = 0;
  const check = (name: string, fn: () => void | Promise<void>) =>
    Promise.resolve()
      .then(fn)
      .then(() => {
        passed++;
        console.log(`  ✓ ${name}`);
      });

  try {
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}/api/v1`;

    // Bootstrap isolated actors via real auth endpoints
    const devLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-3c-app-id': 'hq' },
      body: JSON.stringify({ email: '3eatcru@gmail.com', password: 'SetPassword2026' }),
    });
    assert.equal(devLoginRes.status, 200);
    const { token: devToken } = await devLoginRes.json();

    const store1Signup = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-3c-app-id': 'store-os' },
      body: JSON.stringify({
        name: 'Lojista Stripe 1',
        email: 'stripe-owner1@loja1.com',
        password: 'StorePass123!',
        role: 'STORE_OWNER',
        storeName: 'Loja Stripe Teste 1',
      }),
    });
    assert.equal(store1Signup.status, 201);
    const store1Auth = await store1Signup.json();
    const owner1Token: string = store1Auth.token;
    const store1Id: string = store1Auth.user.storeId;
    const store1TenantId: string = store1Auth.user.tenantId;

    const store2Signup = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-3c-app-id': 'store-os' },
      body: JSON.stringify({
        name: 'Lojista Stripe 2',
        email: 'stripe-owner2@loja2.com',
        password: 'StorePass123!',
        role: 'STORE_OWNER',
        storeName: 'Loja Stripe Teste 2',
      }),
    });
    assert.equal(store2Signup.status, 201);
    const store2Auth = await store2Signup.json();
    const owner2Token: string = store2Auth.token;

    const cust1Res = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-3c-app-id': 'marketplace' },
      body: JSON.stringify({
        name: 'Consumidor Stripe 1',
        email: 'stripe-cust1@consumidor.com',
        password: 'CustPass123!',
      }),
    });
    assert.equal(cust1Res.status, 201);
    const cust1Auth = await cust1Res.json();
    const customer1Token: string = cust1Auth.token;
    const customer1Uid: string = cust1Auth.user.uid;

    const cust2Res = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-3c-app-id': 'marketplace' },
      body: JSON.stringify({
        name: 'Consumidor Stripe 2',
        email: 'stripe-cust2@consumidor.com',
        password: 'CustPass123!',
      }),
    });
    assert.equal(cust2Res.status, 201);
    const cust2Auth = await cust2Res.json();
    const customer2Token: string = cust2Auth.token;

    console.log('Executing Stripe Integration, Connect Split, Anti-IDOR & Webhook Security Suite...');

    await check('1. GET /api/v1/stripe/config exposes only public non-secret fields', async () => {
      const res = await fetch(`${baseUrl}/stripe/config`);
      assert.equal(res.status, 200);
      const body = await res.json();
      const serialized = JSON.stringify(body);
      assert.equal(serialized.includes('sk_test_'), false);
      assert.equal(serialized.includes('sk_live_'), false);
      assert.equal(serialized.includes('whsec_'), false);
      assert.equal(body.products.payments, Boolean(process.env.STRIPE_SECRET_KEY));
      assert.equal(body.businessDomain, 'www.3eatcrucom.br');
    });

    await check('2. GET /api/v1/stripe/health restricts access strictly to HQ admins', async () => {
      const rUnauth = await fetch(`${baseUrl}/stripe/health`);
      assert.equal(rUnauth.status, 401);

      const rCust = await fetch(`${baseUrl}/stripe/health`, {
        headers: { Authorization: `Bearer ${customer1Token}`, 'x-3c-app-id': 'marketplace' },
      });
      assert.equal(rCust.status, 403);

      const rOwner = await fetch(`${baseUrl}/stripe/health`, {
        headers: { Authorization: `Bearer ${owner1Token}`, 'x-3c-app-id': 'store-os' },
      });
      assert.equal(rOwner.status, 403);
    });

    await check('3. Governance validators reject Stripe secret keys (sk_test_/whsec_) in runtimePolicy and billingConfig', async () => {
      const badRuntime = await fetch(`${baseUrl}/admin/governance`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${devToken}`,
          'x-3c-app-id': 'hq',
        },
        body: JSON.stringify({
          runtimePolicy: {
            emailWebhookUrl: `https://example.com/?k=${'sk_test_' + '51ABCDEF'}`,
          },
        }),
      });
      assert.equal(badRuntime.status, 400);

      const badBilling = await fetch(`${baseUrl}/admin/governance`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${devToken}`,
          'x-3c-app-id': 'hq',
        },
        body: JSON.stringify({
          billingConfig: {
            paymentInstructions: `webhook ${'whsec_' + 'ABC12345'}`,
          },
        }),
      });
      assert.equal(badBilling.status, 400);
    });

    await check('4. Connect split rules preserve 0% commission on PDV/Waiter and apply commissionRate on Marketplace', () => {
      const connectStore = {
        id: store1Id,
        commissionRate: 12,
        stripeConnectAccountId: 'acct_test_12345',
        stripeConnectChargesEnabled: true,
      };
      const mktSplit = computeOrderConnectSplit({
        amountMinor: 10_000,
        channel: 'MARKETPLACE',
        store: connectStore,
        globalCommissionRate: 12,
      });
      assert.equal(mktSplit.destinationAccountId, 'acct_test_12345');
      assert.equal(mktSplit.applicationFeeAmount, 1200);

      const pdvSplit = computeOrderConnectSplit({
        amountMinor: 10_000,
        channel: 'PDV',
        store: connectStore,
        globalCommissionRate: 12,
      });
      assert.equal(pdvSplit.destinationAccountId, 'acct_test_12345');
      assert.equal(pdvSplit.applicationFeeAmount, 0);

      const unverifiedSplit = computeOrderConnectSplit({
        amountMinor: 10_000,
        channel: 'MARKETPLACE',
        store: { ...connectStore, stripeConnectChargesEnabled: false },
      });
      assert.equal(unverifiedSplit.destinationAccountId, null);

      // Subscription-only model: 0% commission when platform fleet commission is disabled or STORE_FLEET
      const subOnlySplit = computeOrderConnectSplit({
        amountMinor: 10_000,
        channel: 'MARKETPLACE',
        deliveryModality: 'PLATFORM_FLEET',
        store: connectStore,
        globalCommissionRate: 12,
        platformFleetCommissionEnabled: false,
      });
      assert.equal(subOnlySplit.destinationAccountId, 'acct_test_12345');
      assert.equal(subOnlySplit.applicationFeeAmount, 0);

      const storeFleetSplit = computeOrderConnectSplit({
        amountMinor: 10_000,
        channel: 'MARKETPLACE',
        deliveryModality: 'STORE_FLEET',
        store: connectStore,
        globalCommissionRate: 12,
        platformFleetCommissionEnabled: true,
      });
      assert.equal(storeFleetSplit.applicationFeeAmount, 0);
    });

    await check('4b. FREE / 7-day trial stores are blocked (HTTP 403) from Stripe online card payments, Connect & Invoicing', async () => {
      // store1Id was created via signup -> subscriptionPlan='FREE', saasPaymentStatus='TRIAL'
      const payInfoRes = await fetch(`${baseUrl}/store/payment-public-info/${store1Id}`);
      assert.equal(payInfoRes.status, 200);
      const payInfo = await payInfoRes.json();
      assert.equal(payInfo.isFreePlan, true);
      assert.equal(payInfo.platformOnlinePaymentsEnabled, false);
      assert.equal(payInfo.paymentMode, 'MANUAL_AND_EXTERNAL_TERMINAL_ONLY');

      const rConnect = await fetch(`${baseUrl}/stripe/connect/account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
          'x-3c-app-id': 'store-os',
        },
        body: JSON.stringify({ storeId: store1Id }),
      });
      assert.equal(rConnect.status, 403);

      const rInvoice = await fetch(`${baseUrl}/stripe/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner1Token}`,
          'x-3c-app-id': 'store-os',
        },
        body: JSON.stringify({ storeId: store1Id, amount: 50 }),
      });
      assert.equal(rInvoice.status, 403);
    });

    await runWithSystemDbContext('STRIPE_TEST_ORDER_SEED', () =>
      db.collection('orders').doc('ord-stripe-1').set({
        id: 'ord-stripe-1',
        code: 'ORD-S1',
        storeId: store1Id,
        tenantId: store1TenantId,
        customerId: customer1Uid,
        channel: 'MARKETPLACE',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentMethod: 'CREDIT_CARD',
        total: 59.9,
        items: [{ id: 'it-1', name: 'Burger Artesanal', price: 59.9, quantity: 1 }],
        createdAt: new Date().toISOString(),
      })
    );

    await check('5. Anti-IDOR blocks cross-consumer & cross-tenant access on order intents, Connect, Billing & Invoicing', async () => {
      const r1 = await fetch(`${baseUrl}/stripe/payments/intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customer2Token}`,
          'x-3c-app-id': 'marketplace',
        },
        body: JSON.stringify({ orderId: 'ord-stripe-1' }),
      });
      assert.equal(r1.status, 403);

      const r2 = await fetch(`${baseUrl}/stripe/payments/checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner2Token}`,
          'x-3c-app-id': 'store-os',
        },
        body: JSON.stringify({ orderId: 'ord-stripe-1' }),
      });
      assert.equal(r2.status, 403);

      const r3 = await fetch(`${baseUrl}/stripe/connect/account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner2Token}`,
          'x-3c-app-id': 'store-os',
        },
        body: JSON.stringify({ storeId: store1Id }),
      });
      assert.equal(r3.status, 403);

      const r4 = await fetch(`${baseUrl}/stripe/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${owner2Token}`,
          'x-3c-app-id': 'store-os',
        },
        body: JSON.stringify({ storeId: store1Id, amount: 100, description: 'Cross tenant attack' }),
      });
      assert.equal(r4.status, 403);

      const r5 = await fetch(`${baseUrl}/stripe/billing/subscription-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customer1Token}`,
          'x-3c-app-id': 'marketplace',
        },
        body: JSON.stringify({ storeId: store1Id, requestedPlan: 'PRO', billingCycle: 'MONTHLY' }),
      });
      assert.equal(r5.status, 403);
    });

    await check('6. Signed Stripe Webhook rejects invalid signatures and idempotently settles orders & SaaS plans', async () => {
      const dummyStripe = new Stripe('sk_test_dummy_for_webhook_header_signing_only');
      const orderPayload = JSON.stringify({
        id: 'evt_stripe_ord_1',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_ord_1',
            object: 'payment_intent',
            metadata: { kind: 'MARKETPLACE_ORDER', orderId: 'ord-stripe-1' },
          },
        },
      });

      const badSigRes = await fetch(`${baseUrl}/stripe/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'stripe-signature': 't=123,v1=deadbeef' },
        body: orderPayload,
      });
      assert.ok(badSigRes.status === 400 || badSigRes.status === 503);

      const prevKey = process.env.STRIPE_SECRET_KEY;
      if (!prevKey) {
        process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_for_webhook_verification_only';
      }
      try {
        const validOrderSig = dummyStripe.webhooks.generateTestHeaderString({
          payload: orderPayload,
          secret: process.env.STRIPE_WEBHOOK_SECRET!,
        });

        const w1Res = await fetch(`${baseUrl}/stripe/webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'stripe-signature': validOrderSig },
          body: orderPayload,
        });
        assert.equal(w1Res.status, 200);
        const w1 = await w1Res.json();
        assert.equal(w1.deduplicated, false);

        const w2Res = await fetch(`${baseUrl}/stripe/webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'stripe-signature': validOrderSig },
          body: orderPayload,
        });
        assert.equal(w2Res.status, 200);
        const w2 = await w2Res.json();
        assert.equal(w2.deduplicated, true);

        const orderAfter = await runWithSystemDbContext('VERIFY_STRIPE_ORDER', () =>
          db.collection('orders').doc('ord-stripe-1').get()
        );
        assert.equal(orderAfter.data()?.paymentStatus, 'PAID');
        assert.equal(orderAfter.data()?.pspProvider, 'STRIPE');

        const saasPayload = JSON.stringify({
          id: 'evt_stripe_saas_1',
          object: 'event',
          type: 'checkout.session.completed',
          data: {
            object: {
              id: 'cs_test_saas_1',
              mode: 'subscription',
              subscription: 'sub_test_1',
              metadata: {
                kind: 'SAAS_SUBSCRIPTION',
                storeId: store1Id,
                tenantId: store1TenantId,
                planTier: 'PRO',
                billingCycle: 'ANNUAL',
              },
            },
          },
        });
        const saasSig = dummyStripe.webhooks.generateTestHeaderString({
          payload: saasPayload,
          secret: process.env.STRIPE_WEBHOOK_SECRET!,
        });
        const wSaas = await fetch(`${baseUrl}/stripe/webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'stripe-signature': saasSig },
          body: saasPayload,
        });
        assert.equal(wSaas.status, 200);

        const storeAfter = await runWithSystemDbContext('VERIFY_STRIPE_SAAS_STORE', () =>
          db.collection('stores').doc(store1Id).get()
        );
        assert.equal(storeAfter.data()?.subscriptionPlan, 'PRO');
        assert.equal(storeAfter.data()?.billingCycle, 'ANNUAL');
        assert.equal(storeAfter.data()?.saasPaymentStatus, 'PAID');
      } finally {
        if (!prevKey) {
          delete process.env.STRIPE_SECRET_KEY;
        }
      }
    });

    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_test_51')) {
      await check('7. Live Stripe Sandbox API probe validates HQ health, PaymentIntent, Billing Checkout & Invoicing', async () => {
        const healthRes = await fetch(`${baseUrl}/stripe/health`, {
          headers: { Authorization: `Bearer ${devToken}`, 'x-3c-app-id': 'hq' },
        });
        assert.equal(healthRes.status, 200);
        const healthBody = await healthRes.json();
        assert.equal(healthBody.healthy, true);
        assert.equal(healthBody.mode, 'test');

        await runWithSystemDbContext('LIVE_TEST_ORDER_SEED', () =>
          db.collection('orders').doc('ord-stripe-live-1').set({
            id: 'ord-stripe-live-1',
            code: 'ORD-LIVE-1',
            storeId: store1Id,
            tenantId: store1TenantId,
            customerId: customer1Uid,
            channel: 'MARKETPLACE',
            status: 'PENDING',
            paymentStatus: 'PENDING',
            paymentMethod: 'CREDIT_CARD',
            total: 42.5,
            items: [{ id: 'it-1', name: 'Combo Live Test', price: 42.5, quantity: 1 }],
            createdAt: new Date().toISOString(),
          })
        );

        const piRes = await fetch(`${baseUrl}/stripe/payments/intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${customer1Token}`,
            'x-3c-app-id': 'marketplace',
          },
          body: JSON.stringify({ orderId: 'ord-stripe-live-1' }),
        });
        assert.equal(piRes.status, 200);
        const piBody = await piRes.json();
        assert.ok(String(piBody.paymentIntentId).startsWith('pi_'));
        assert.equal(piBody.amountMinor, 4250);

        const subCheckoutRes = await fetch(`${baseUrl}/stripe/billing/subscription-checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${owner1Token}`,
            'x-3c-app-id': 'store-os',
          },
          body: JSON.stringify({ storeId: store1Id, requestedPlan: 'BASIC', billingCycle: 'MONTHLY' }),
        });
        assert.equal(subCheckoutRes.status, 200);
        const subBody = await subCheckoutRes.json();
        assert.ok(String(subBody.sessionId).startsWith('cs_test_'));
        assert.ok(String(subBody.url).startsWith('https://checkout.stripe.com/'));

        const invoiceRes = await fetch(`${baseUrl}/stripe/invoices`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${owner1Token}`,
            'x-3c-app-id': 'store-os',
          },
          body: JSON.stringify({
            storeId: store1Id,
            amount: 89.9,
            description: 'Fatura Teste Validacao 3eatcrucom.br',
            daysUntilDue: 5,
            sendNow: false,
          }),
        });
        assert.equal(invoiceRes.status, 200);
        const invBody = await invoiceRes.json();
        assert.ok(String(invBody.invoice.id).startsWith('in_'));
        assert.equal(invBody.invoice.amountBrl, 89.9);

        const connectAcctRes = await fetch(`${baseUrl}/stripe/connect/account`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${owner1Token}`,
            'x-3c-app-id': 'store-os',
          },
          body: JSON.stringify({ storeId: store1Id }),
        });
        assert.equal(connectAcctRes.status, 200);
        const connectAcctBody = await connectAcctRes.json();
        assert.ok(String(connectAcctBody.accountId).startsWith('acct_'));

        const connectLinkRes = await fetch(`${baseUrl}/stripe/connect/onboarding-link`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${owner1Token}`,
            'x-3c-app-id': 'store-os',
          },
          body: JSON.stringify({ storeId: store1Id }),
        });
        assert.equal(connectLinkRes.status, 200);
        const connectLinkBody = await connectLinkRes.json();
        assert.ok(String(connectLinkBody.url).startsWith('https://connect.stripe.com/'));

        const connectStatusRes = await fetch(`${baseUrl}/stripe/connect/status/${store1Id}`, {
          headers: {
            Authorization: `Bearer ${owner1Token}`,
            'x-3c-app-id': 'store-os',
          },
        });
        assert.equal(connectStatusRes.status, 200);
      });
    } else {
      console.log('  ⊘ 7. Live Stripe Sandbox probe skipped (STRIPE_SECRET_KEY not set in shell env)');
    }

    console.log(`\nALL STRIPE SECURITY & INTEGRATION TESTS PASSED (${passed} passed, 0 failed)!`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('❌ Stripe integration test failed:', err);
  process.exit(1);
});
