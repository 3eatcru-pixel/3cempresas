import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-e2e-'));
if (!process.env.SERVER_DB_PATH) process.env.SERVER_DB_PATH = path.join(tempDir, 'e2e-db.json');
if (!process.env.SERVER_SECRET_PATH) process.env.SERVER_SECRET_PATH = path.join(tempDir, '.server-secret');
if (!process.env.SERVER_SECRET) process.env.SERVER_SECRET = '3c_e2e_isolated_secret_2026';

async function testEcosystemInteraction() {
  console.log('🚀 Iniciando Teste de Interação Ponta-a-Ponta dos 4 Pilares...');

  const { auth, db } = await import('../src/server/config.ts');
  const { createServerCoreApp } = await import('../src/server/app.ts');

  const app = createServerCoreApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as { port: number }).port;
  const API_BASE = `http://127.0.0.1:${port}/api/v1`;

  try {
    // 1. Provisionar atores legítimos (HQ DEV_OWNER, STORE_OWNER, COURIER, e CUSTOMER via signup)
    console.log('\n--- 1. Autenticação & Provisionamento Multi-Ator ---');
    await db.collection('users').doc('usr-e2e-dev').set({
      uid: 'usr-e2e-dev',
      id: 'usr-e2e-dev',
      email: 'dev@3ccorp.local',
      name: 'HQ Dev Owner',
      role: 'DEV_OWNER',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      tokenVersion: 1,
    });
    const devToken = auth.generateDevToken({
      uid: 'usr-e2e-dev',
      email: 'dev@3ccorp.local',
      email_verified: true,
      name: 'HQ Dev Owner',
      role: 'DEV_OWNER',
      tenantId: 'tenant-1',
      tokenVersion: 1,
    });

    const e2eEmail = `e2e_owner_${crypto.randomUUID().slice(0, 8)}@3ccorp.local`;
    const e2ePass = crypto.randomBytes(12).toString('hex');
    const ownerSignupResp = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Operador Loja E2E',
        email: e2eEmail,
        password: e2ePass,
        role: 'STORE_OWNER',
        storeName: 'Bistrô E2E Automação',
      }),
    });
    const ownerSignupData: any = await ownerSignupResp.json();
    if (!ownerSignupResp.ok) throw new Error(`Falha ao provisionar lojista E2E: ${ownerSignupData.error}`);
    const ownerToken: string = ownerSignupData.token;
    const tenantId: string = ownerSignupData.user.tenantId;
    const storeId: string = ownerSignupData.user.storeId;

    await db.collection('stores').doc(storeId).update({
      isOpen: true,
      deliveryFee: 6.9,
      deliveryModality: 'PLATFORM_FLEET',
    });

    await db.collection('menu_items').doc('item-e2e-101').set({
      id: 'item-e2e-101',
      tenantId,
      storeId,
      name: 'Smash Trufado Single',
      price: 38.9,
      costPrice: 12.0,
      stock: 10,
      isAvailable: true,
      category: 'Burgers',
    });

    const driverUid = 'usr-e2e-courier';
    await db.collection('users').doc(driverUid).set({
      uid: driverUid,
      id: driverUid,
      email: 'courier.e2e@3ccorp.local',
      name: 'Entregador E2E',
      role: 'COURIER',
      tenantId,
      status: 'ACTIVE',
      tokenVersion: 1,
    });
    const driverToken = auth.generateDevToken({
      uid: driverUid,
      email: 'courier.e2e@3ccorp.local',
      email_verified: true,
      name: 'Entregador E2E',
      role: 'COURIER',
      tenantId,
      tokenVersion: 1,
    });

    const custEmail = `e2e_cust_${crypto.randomUUID().slice(0, 8)}@cliente.local`;
    const custResp = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Consumidor E2E',
        email: custEmail,
        password: crypto.randomBytes(12).toString('hex'),
        role: 'CUSTOMER',
      }),
    });
    const custData: any = await custResp.json();
    if (!custResp.ok) throw new Error(`Falha ao cadastrar consumidor E2E: ${custData.error}`);
    const customerToken: string = custData.token;
    console.log(`✅ Atores provisionados (store=${storeId}, tenant=${tenantId})`);

    // 2. Snapshot Inicial Governança (HQ)
    console.log('\n--- 2. Snapshot Governança (HQ DEV_OWNER) ---');
    const govResp = await fetch(`${API_BASE}/admin/governance`, {
      headers: { Authorization: `Bearer ${devToken}` },
    });
    if (!govResp.ok) throw new Error(`Falha ao consultar governança inicial: HTTP ${govResp.status}`);
    const govData: any = await govResp.json();
    const initialGMV = Number(govData.totalGMV || 0);
    console.log(`📊 GMV Inicial: R$ ${initialGMV.toFixed(2)}`);

    // 3. Simular Pedido Marketplace (Consumidor)
    console.log('\n--- 3. Fluxo de Venda (Marketplace -> Server Core) ---');
    const orderPayload = {
      storeId,
      customerName: 'Consumidor E2E',
      deliveryAddress: 'Av. Higienópolis, 500 - Centro',
      items: [{ menuItemId: 'item-e2e-101', quantity: 1 }],
      paymentMethod: 'PIX',
      deliveryModality: 'PLATFORM_FLEET',
      channel: 'MARKETPLACE',
    };

    const orderResp = await fetch(`${API_BASE}/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
        'Idempotency-Key': `e2e-${Date.now()}`,
      },
      body: JSON.stringify(orderPayload),
    });
    const orderResult: any = await orderResp.json();
    if (!orderResp.ok) throw new Error(`Falha ao criar pedido: ${orderResult.error}`);
    const orderId = orderResult.transaction.orderId;
    const orderCode = orderResult.transaction.code;
    const deliveryPin = orderResult.transaction?.deliveryPin;
    console.log(`✅ Pedido ${orderCode} criado (ID: ${orderId}, total=${orderResult.transaction.total})`);

    // 4. Ciclo de Vida do Pedido (Store OS KDS -> Driver App)
    console.log(`\n--- 4. Ciclo de Vida do Pedido (Iniciando de ${orderResult.transaction.status}) ---`);
    const transitions: Array<{ status: string; actorToken: string; label: string; deliveryPin?: string }> = [
      { status: 'CONFIRMED', actorToken: ownerToken, label: 'Store OS' },
      { status: 'IN_PREPARATION', actorToken: ownerToken, label: 'Store OS KDS' },
      { status: 'READY_FOR_PICKUP', actorToken: ownerToken, label: 'Store OS Despacho' },
      { status: 'OUT_FOR_DELIVERY', actorToken: driverToken, label: 'Driver App' },
      { status: 'DELIVERED', actorToken: driverToken, label: 'Driver App', deliveryPin },
    ];

    for (const step of transitions) {
      const updateResp = await fetch(`${API_BASE}/commerce/orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${step.actorToken}`,
        },
        body: JSON.stringify({
          status: step.status,
          ...(step.deliveryPin ? { deliveryPin: step.deliveryPin } : {}),
        }),
      });
      if (!updateResp.ok) {
        const err: any = await updateResp.json();
        throw new Error(`Falha ao avançar para ${step.status} (${step.label}): ${err.error}`);
      }
      console.log(`➡️ Status alterado para: ${step.status} (${step.label})`);
    }

    // Confirmar tracking final no perfil do consumidor
    const trackResp = await fetch(`${API_BASE}/commerce/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const trackedOrder: any = await trackResp.json();
    if (!trackResp.ok || trackedOrder.status !== 'DELIVERED') {
      throw new Error(`Tracking do consumidor não refletiu DELIVERED: ${trackedOrder.status}`);
    }

    // 5. Validação Final Governança (HQ)
    console.log('\n--- 5. Validação Final (HQ Governança & GMV) ---');
    const finalGovResp = await fetch(`${API_BASE}/admin/governance`, {
      headers: { Authorization: `Bearer ${devToken}` },
    });
    if (!finalGovResp.ok) throw new Error(`Falha ao consultar governança final: HTTP ${finalGovResp.status}`);
    const finalGovData: any = await finalGovResp.json();
    const finalGMV = Number(finalGovData.totalGMV || 0);
    const gmvIncrease = finalGMV - initialGMV;

    console.log(`📊 GMV Final: R$ ${finalGMV.toFixed(2)}`);
    console.log(`📈 Incremento Detectado: R$ ${gmvIncrease.toFixed(2)}`);

    const expectedTotal = 38.9 + 6.9;
    if (Math.abs(gmvIncrease - expectedTotal) < 0.01) {
      console.log('\n🏆 SUCESSO: Interação ponta-a-ponta entre Marketplace -> Store OS -> Driver -> Server Core -> HQ confirmada!');
    } else {
      throw new Error(`Incremento de GMV divergente: esperado R$ ${expectedTotal.toFixed(2)}, obtido R$ ${gmvIncrease.toFixed(2)}`);
    }
  } finally {
    server.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

testEcosystemInteraction().catch((error: any) => {
  console.error('\n🚨 Erro durante o teste de interação E2E:', error?.message || error);
  process.exit(1);
});
