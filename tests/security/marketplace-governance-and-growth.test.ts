/**
 * Suite 19 — Marketplace Governance, Sponsored Placements, Growth Isolation & GitHub Release Sync
 * Verifica sanitização B2B em /system/public-config, anti-IDOR e anti-eviction em /store/marketplace-growth,
 * proteção contra spam duplicado, bloqueio de lojas suspensas/ocultas e contrato de releases GitHub.
 */
import express from 'express';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-mkt-growth-sec-'));
if (!process.env.SERVER_DB_PATH) process.env.SERVER_DB_PATH = path.join(tempDir, 'mkt-test-db.json');
if (!process.env.SERVER_SECRET_PATH) process.env.SERVER_SECRET_PATH = path.join(tempDir, '.server-secret');
if (!process.env.SERVER_SECRET) process.env.SERVER_SECRET = '3c_mkt_growth_sec_isolated_secret_2026';

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string, detail?: any) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`, detail !== undefined ? JSON.stringify(detail) : '');
  }
}

async function reqJson(
  baseUrl: string,
  urlPath: string,
  opts: { method?: string; token?: string; body?: any } = {}
) {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  const { auth, db, hashPassword } = await import('../../src/server/config.ts');
  const { attachContractContext } = await import('../../src/server/middleware/contracts.ts');
  const { default: adminRoutes } = await import('../../src/server/routes/admin.ts');
  const { default: storeRoutes } = await import('../../src/server/routes/store.ts');
  const { default: systemRoutes } = await import('../../src/server/routes/system.ts');

  const app = express();
  app.use(express.json());
  app.use(attachContractContext);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/store', storeRoutes);
  app.use('/api/v1/system', systemRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    console.log('\n[Suite 19] Marketplace Governance, Growth Isolation & GitHub CI Contract');

    await db.collection('tenants').doc('tenant-1').set({
      id: 'tenant-1',
      name: 'Tenant 1',
      status: 'ACTIVE',
    });
    await db.collection('tenants').doc('tenant-2').set({
      id: 'tenant-2',
      name: 'Tenant 2',
      status: 'ACTIVE',
    });
    await db.collection('stores').doc('store-1').set({
      id: 'store-1',
      tenantId: 'tenant-1',
      name: 'Loja 1',
      status: 'ACTIVE',
    });
    await db.collection('stores').doc('store-2').set({
      id: 'store-2',
      tenantId: 'tenant-2',
      name: 'Loja 2',
      status: 'ACTIVE',
    });
    await db.collection('stores').doc('store-hidden-1').set({
      id: 'store-hidden-1',
      tenantId: 'tenant-1',
      name: 'Loja Oculta',
      status: 'ACTIVE',
    });

    await db.collection('users').doc('usr-dev-master').set({
      uid: 'usr-dev-master',
      id: 'usr-dev-master',
      email: '3eatcru@gmail.com',
      name: 'Master HQ',
      role: 'DEV_OWNER',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      tokenVersion: 1,
      passwordHash: hashPassword('MasterPass!2026'),
    });
    await db.collection('users').doc('usr-owner-1').set({
      uid: 'usr-owner-1',
      id: 'usr-owner-1',
      email: 'loja1@3ccorp.com',
      name: 'Lojista 1',
      role: 'STORE_OWNER',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      allowedStoreIds: ['store-1'],
      status: 'ACTIVE',
      tokenVersion: 1,
      passwordHash: hashPassword('StorePass!2026'),
    });
    await db.collection('users').doc('usr-consumer-1').set({
      uid: 'usr-consumer-1',
      id: 'usr-consumer-1',
      email: 'cliente@3ccorp.com',
      name: 'Consumidor 1',
      role: 'CUSTOMER',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      tokenVersion: 1,
      passwordHash: hashPassword('ConsumerPass!2026'),
    });

    const devToken = auth.generateDevToken({
      uid: 'usr-dev-master',
      email: '3eatcru@gmail.com',
      role: 'DEV_OWNER',
      tenantId: 'tenant-1',
      tokenVersion: 1,
    });
    const storeOwnerToken = auth.generateDevToken({
      uid: 'usr-owner-1',
      email: 'loja1@3ccorp.com',
      role: 'STORE_OWNER',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      tokenVersion: 1,
    });
    const consumerToken = auth.generateDevToken({
      uid: 'usr-consumer-1',
      email: 'cliente@3ccorp.com',
      role: 'CUSTOMER',
      tenantId: 'tenant-1',
      tokenVersion: 1,
    });

    assert(Boolean(devToken && storeOwnerToken && consumerToken), 'Tokens HQ, Store OS e Marketplace emitidos');

    // 1. Seed governance via HQ DEV_OWNER with B2B pricing, active placement, pending placement, hidden store placement
    const govPut = await reqJson(baseUrl, '/api/v1/admin/governance', {
      method: 'PUT',
      token: devToken,
      body: {
        marketplaceConfig: {
          recommendationsTitle: 'Curadoria 3C',
          hiddenStoreIds: ['store-hidden-1'],
          spotlightPricing: {
            heroBannerMonthlyFee: 499,
            recommendedSlotMonthlyFee: 249,
            categoryTopMonthlyFee: 149,
          },
          sponsoredPlacements: [
            {
              id: 'ad-active-1',
              storeId: 'store-1',
              placementType: 'HERO_BANNER',
              badgeText: 'Oficial',
              bannerTitle: 'Loja 1 Destaque',
              bannerSubtitle: 'Oferta real',
              ctaLabel: 'Abrir',
              monthlyFee: 499,
              active: true,
              status: 'ACTIVE',
            },
            {
              id: 'ad-pending-leak-test',
              storeId: 'store-1',
              placementType: 'CATEGORY_TOP',
              bannerTitle: 'Nao deve vazar',
              monthlyFee: 149,
              active: true,
              status: 'PENDING_APPROVAL',
            },
            {
              id: 'ad-hidden-leak-test',
              storeId: 'store-hidden-1',
              placementType: 'RECOMMENDED_CAROUSEL',
              bannerTitle: 'Loja oculta',
              monthlyFee: 249,
              active: true,
              status: 'ACTIVE',
            },
          ],
        },
      },
    });
    assert(govPut.status === 200, 'DEV_OWNER salva governança de Marketplace e preços B2B (200)');

    // 2. Public config sanitization check (zero B2B leak, zero hidden/pending leak)
    const pubRes = await reqJson(baseUrl, '/api/v1/system/public-config');
    const mkt = pubRes.data?.marketplaceConfig || {};
    assert(pubRes.status === 200, 'GET /api/v1/system/public-config acessível sem vazar B2B (200)');
    assert(
      Array.isArray(mkt.externalChannelConnectors) && mkt.externalChannelConnectors.length === 0,
      'Public-config zera externalChannelConnectors para consumidores'
    );
    assert(
      mkt.spotlightPricing?.heroBannerMonthlyFee === 0 &&
        mkt.spotlightPricing?.recommendedSlotMonthlyFee === 0 &&
        mkt.spotlightPricing?.categoryTopMonthlyFee === 0,
      'Public-config zera valores B2B de spotlightPricing para consumidores'
    );
    assert(
      Array.isArray(mkt.sponsoredPlacements) &&
        mkt.sponsoredPlacements.length === 1 &&
        mkt.sponsoredPlacements[0].id === 'ad-active-1' &&
        mkt.sponsoredPlacements[0].monthlyFee === 0,
      'Public-config exibe somente anúncios ACTIVE de lojas não ocultas e zera monthlyFee',
      mkt.sponsoredPlacements
    );

    // 3. RBAC & Anti-IDOR checks on /api/v1/store/marketplace-growth
    const unauthGrowth = await reqJson(baseUrl, '/api/v1/store/marketplace-growth?storeId=store-1');
    assert(unauthGrowth.status === 401, 'Bloqueia acesso anônimo em /store/marketplace-growth (401)');

    const consumerGrowth = await reqJson(baseUrl, '/api/v1/store/marketplace-growth?storeId=store-1', {
      token: consumerToken,
    });
    assert(consumerGrowth.status === 403, 'Consumidor não acessa API de crescimento B2B da loja (403)');

    const crossStore = await reqJson(baseUrl, '/api/v1/store/marketplace-growth?storeId=store-2', {
      token: storeOwnerToken,
    });
    assert(crossStore.status === 403, 'Anti-IDOR impede lojista de consultar outra loja (403)');

    // 4. Store Owner creates valid spotlight request & receives 409 on duplicate
    const ownReq1 = await reqJson(baseUrl, '/api/v1/store/marketplace-growth/spotlight-request', {
      method: 'POST',
      token: storeOwnerToken,
      body: {
        storeId: 'store-1',
        placementType: 'RECOMMENDED_CAROUSEL',
        bannerTitle: 'Combo da Casa',
        bannerSubtitle: 'Entrega em 25 min',
      },
    });
    assert(
      ownReq1.status === 201 &&
        ownReq1.data?.placement?.status === 'PENDING_APPROVAL' &&
        ownReq1.data?.placement?.monthlyFee === 249,
      'Lojista cria solicitação PENDING_APPROVAL com preço oficial do servidor (201)',
      ownReq1
    );

    const dupReq = await reqJson(baseUrl, '/api/v1/store/marketplace-growth/spotlight-request', {
      method: 'POST',
      token: storeOwnerToken,
      body: {
        storeId: 'store-1',
        placementType: 'RECOMMENDED_CAROUSEL',
        bannerTitle: 'Spam duplicado',
      },
    });
    assert(dupReq.status === 409, 'Bloqueia solicitação pendente duplicada do mesmo tipo para a mesma loja (409)');

    // 5. Hidden store cannot submit spotlight request
    const devHiddenStoreReq = await reqJson(baseUrl, '/api/v1/store/marketplace-growth/spotlight-request', {
      method: 'POST',
      token: devToken,
      body: {
        storeId: 'store-hidden-1',
        placementType: 'HERO_BANNER',
        bannerTitle: 'Tentativa loja oculta',
      },
    });
    assert(devHiddenStoreReq.status === 403, 'Loja presente em hiddenStoreIds é bloqueada de solicitar destaque (403)');

    // 6. Audit log recorded for store spotlight request
    const auditLogsSnap = await db.collection('audit_logs').get();
    const hasSpotlightAudit = auditLogsSnap.docs.some(
      (d: any) => d.data()?.action === 'STORE_MARKETPLACE_SPOTLIGHT_REQUEST' && d.data()?.storeId === 'store-1'
    );
    assert(hasSpotlightAudit, 'Solicitação de destaque gravou evento imutável em audit_logs');

    // 7. Sentinel Logs endpoint RBAC + GitHub CI contract check
    const unauthSentinel = await reqJson(baseUrl, '/api/v1/admin/diagnostics/sentinel-logs');
    assert(unauthSentinel.status === 401, 'Bloqueia acesso anônimo em /admin/diagnostics/sentinel-logs (401)');

    const consumerSentinel = await reqJson(baseUrl, '/api/v1/admin/diagnostics/sentinel-logs', {
      token: consumerToken,
    });
    assert(consumerSentinel.status === 403, 'Consumidor não acessa logs do Sentinel no HQ (403)');

    const hqSentinel = await reqJson(baseUrl, '/api/v1/admin/diagnostics/sentinel-logs', {
      token: devToken,
    });
    assert(
      hqSentinel.status === 200 && Array.isArray(hqSentinel.data?.history),
      'DEV_OWNER lê endpoint /admin/diagnostics/sentinel-logs com sucesso (200)',
      hqSentinel
    );

    const artifactsRes = await reqJson(baseUrl, '/api/v1/system/releases/artifacts');
    assert(
      artifactsRes.status === 200 &&
        artifactsRes.data?.managerName === '3C Release Manager' &&
        typeof artifactsRes.data?.tauriSigned === 'boolean' &&
        Boolean(artifactsRes.data?.products?.['store-os']) &&
        Boolean(artifactsRes.data?.products?.['marketplace']),
      'GET /api/v1/system/releases/artifacts retorna manifesto completo do 3C Release Manager sem acoplamento GitHub',
      artifactsRes.data
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore temp cleanup errors
    }
  }

  console.log(`\nResumo Suite 19: ${passed} ✓ / ${failed} ✗`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
