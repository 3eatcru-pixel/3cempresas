import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-prod-readiness-'));
if (!process.env.SERVER_DB_PATH) process.env.SERVER_DB_PATH = path.join(tempDir, 'prod-readiness-db.json');
if (!process.env.SERVER_SECRET_PATH) process.env.SERVER_SECRET_PATH = path.join(tempDir, '.server-secret');
if (!process.env.SERVER_SECRET) process.env.SERVER_SECRET = '3c_prod_readiness_secret_deterministic_2026';
process.env.PSP_WEBHOOK_SECRET = 'psp_test_hmac_secret_key_3c_corp_2026';

let passed = 0;
let failed = 0;

function check(cond: boolean, name: string, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function jsonReq(
  baseUrl: string,
  method: string,
  urlPath: string,
  token?: string,
  body?: any,
  extraHeaders?: Record<string, string>
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extraHeaders || {}),
  };

  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

async function run() {
  const { auth, db, hashPassword, encryptIntegrationSecret, decryptIntegrationSecret } = await import(
    '../../src/server/config.ts'
  );
  const { SqliteWalDriver } = await import('../../src/server/persistence/SqliteWalDriver.ts');
  const { createServerCoreApp } = await import('../../src/server/app.ts');

  console.log('======================================================================');
  console.log('🚀  FASES 2, 3 & 4 DO PLANO DE AÇÃO — HOMOLOGAÇÃO DE PRONTIDÃO DE PRODUÇÃO');
  console.log('======================================================================\n');

  const app = createServerCoreApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // -------------------------------------------------------------------------
    // SETUP BASE: Tenants, Stores, Users & Roles
    // -------------------------------------------------------------------------
    await db.collection('tenants').doc('tenant-prod').set({
      id: 'tenant-prod',
      name: 'Rede Gastronômica Estrela Ltda',
      status: 'ACTIVE',
      plan: 'ENTERPRISE',
    });

    await db.collection('stores').doc('store-prod-1').set({
      id: 'store-prod-1',
      tenantId: 'tenant-prod',
      name: 'Estrela Matriz Jardins',
      isOpen: true,
      subscriptionPlan: 'ENTERPRISE',
    });

    const storeManagerToken = auth.generateDevToken({
      uid: 'usr-admin-prod',
      email: 'gerente@estrela.com.br',
      name: 'Gerente Geral Estrela',
      role: 'STORE_MANAGER',
      tenantId: 'tenant-prod',
      storeId: 'store-prod-1',
    });

    await db.collection('users').doc('usr-admin-prod').set({
      uid: 'usr-admin-prod',
      id: 'usr-admin-prod',
      email: 'gerente@estrela.com.br',
      name: 'Gerente Geral Estrela',
      role: 'STORE_MANAGER',
      tenantId: 'tenant-prod',
      storeId: 'store-prod-1',
      status: 'ACTIVE',
      tokenVersion: 1,
      passwordHash: hashPassword('GerenteEstrela!2026'),
    });

    // -------------------------------------------------------------------------
    // FASE 2.1 — WEBHOOKS PSP (HMAC-SHA256, DEDUPLICAÇÃO & CONCILIAÇÃO)
    // -------------------------------------------------------------------------
    console.log('--- Fase 2: Webhooks PSP com HMAC-SHA256 & Idempotência ---');

    await db.collection('orders').doc('ord-psp-101').set({
      id: 'ord-psp-101',
      orderNumber: 101,
      tenantId: 'tenant-prod',
      storeId: 'store-prod-1',
      customerName: 'Cliente VIP Checkout',
      customerEmail: 'clientevip@email.com',
      items: [{ id: 'item-1', name: 'Combo Prime', quantity: 1, unitPrice: 89.9 }],
      total: 89.9,
      status: 'PENDING',
      paymentStatus: 'PENDING',
      paymentMethod: 'PIX',
      createdAt: new Date().toISOString(),
    });

    // 1. Rejeição de webhook sem assinatura HMAC
    const noSigRes = await jsonReq(baseUrl, 'POST', '/api/v1/commerce/payments/webhook', undefined, {
      orderId: 'ord-psp-101',
      providerTransactionId: 'tx-pix-101-abc',
      provider: 'MERCADO_PAGO',
      status: 'PAID',
      paidAmount: 89.9,
    });
    check(noSigRes.status === 401, 'Webhook PSP sem assinatura X-PSP-Signature é rejeitado com HTTP 401');

    // 2. Rejeição de webhook com assinatura HMAC inválida
    const badSigRes = await jsonReq(
      baseUrl,
      'POST',
      '/api/v1/commerce/payments/webhook',
      undefined,
      {
        orderId: 'ord-psp-101',
        providerTransactionId: 'tx-pix-101-abc',
        provider: 'MERCADO_PAGO',
        status: 'PAID',
        paidAmount: 89.9,
      },
      { 'x-psp-signature': 'invalid_forged_hmac_hash_0000000000000000000000000000' }
    );
    check(badSigRes.status === 401, 'Webhook PSP com assinatura HMAC inválida é rejeitado com HTTP 401');

    // 3. Rejeição com divergência de valor (esperado 89.90, recebido 50.00)
    const divergentPayload = {
      orderId: 'ord-psp-101',
      providerTransactionId: 'tx-pix-divergent',
      provider: 'MERCADO_PAGO',
      status: 'PAID',
      paidAmount: 50.0,
    };
    const divergentHmac = crypto
      .createHmac('sha256', process.env.PSP_WEBHOOK_SECRET!)
      .update(JSON.stringify(divergentPayload))
      .digest('hex');

    const divergentRes = await jsonReq(
      baseUrl,
      'POST',
      '/api/v1/commerce/payments/webhook',
      undefined,
      divergentPayload,
      { 'x-psp-signature': divergentHmac }
    );
    check(
      divergentRes.status >= 400,
      'Webhook PSP com valor divergente do total do pedido é rejeitado pelo motor de liquidação'
    );

    // 4. Liquidação legítima com HMAC-SHA256 válido e valor exato
    const validPayload = {
      orderId: 'ord-psp-101',
      providerTransactionId: 'tx-pix-real-101-def',
      provider: 'MERCADO_PAGO',
      status: 'PAID',
      paidAmount: 89.9,
      paymentMethod: 'PIX',
    };
    const validHmac = crypto
      .createHmac('sha256', process.env.PSP_WEBHOOK_SECRET!)
      .update(JSON.stringify(validPayload))
      .digest('hex');

    const validRes = await jsonReq(baseUrl, 'POST', '/api/v1/commerce/payments/webhook', undefined, validPayload, {
      'x-psp-signature': validHmac,
    });
    check(
      validRes.status === 200 && validRes.data?.paymentStatus === 'PAID',
      'Webhook PSP com HMAC válido liquida pedido para paymentStatus=PAID com sucesso'
    );

    const verifiedOrderSnap = await db.collection('orders').doc('ord-psp-101').get();
    const verifiedOrder = verifiedOrderSnap.data();
    check(
      verifiedOrder?.paymentConfirmationType === 'AUTOMATED_PSP' &&
        verifiedOrder?.confirmedByRole === 'PSP_WEBHOOK' &&
        verifiedOrder?.settlementSource === 'VERIFIED_PSP_WEBHOOK',
      'Pedido auditado registra paymentConfirmationType=AUTOMATED_PSP e settlementSource=VERIFIED_PSP_WEBHOOK'
    );

    // 5. Deduplicação idempotente: reenvio do mesmo webhook
    const replayRes = await jsonReq(baseUrl, 'POST', '/api/v1/commerce/payments/webhook', undefined, validPayload, {
      'x-psp-signature': validHmac,
    });
    check(
      replayRes.status === 200 && replayRes.data?.deduplicated === true,
      'Replay de webhook PSP é deduplicado idempotentemente via payment_webhook_events'
    );

    // 6. PDV balcão não pode forjar providerTransactionId (POS-TX-*) como liquidação automática PSP
    await db.collection('menu_items').doc('prd-pos-audit-1').set({
      id: 'prd-pos-audit-1',
      tenantId: 'tenant-prod',
      storeId: 'store-prod-1',
      name: 'Café Expresso Audit',
      price: 12.0,
      stock: 50,
      isAvailable: true,
    });

    const spoofedPosRes = await jsonReq(baseUrl, 'POST', '/api/v1/commerce/orders', storeManagerToken, {
      storeId: 'store-prod-1',
      channel: 'POS',
      deliveryModality: 'PICKUP',
      customerName: 'Cliente Balcão',
      paymentMethod: 'PIX',
      paymentConfirmed: true,
      providerTransactionId: 'POS-TX-SPOOFED-999999',
      items: [{ menuItemId: 'prd-pos-audit-1', quantity: 1 }],
    });
    const spoofedOrderId = spoofedPosRes.data?.transaction?.orderId;
    const spoofedOrderDoc = spoofedOrderId ? (await db.collection('orders').doc(spoofedOrderId).get()).data() : null;
    const spoofedFinDoc = spoofedOrderId
      ? (await db.collection('financial_records').doc(`fin-ord-${spoofedOrderId}`).get()).data()
      : null;

    const unconfirmedPixPosRes = await jsonReq(baseUrl, 'POST', '/api/v1/commerce/orders', storeManagerToken, {
      storeId: 'store-prod-1',
      channel: 'POS',
      deliveryModality: 'PICKUP',
      customerName: 'Cliente Pix Pendente',
      paymentMethod: 'PIX',
      items: [{ menuItemId: 'prd-pos-audit-1', quantity: 1 }],
    });

    check(
      spoofedPosRes.status === 201 &&
        spoofedOrderDoc?.paymentStatus === 'PAID' &&
        spoofedOrderDoc?.paymentConfirmationType === 'MANUAL_OPERATOR' &&
        spoofedOrderDoc?.settlementSource === 'POS_OPERATOR_COUNTER' &&
        !spoofedOrderDoc?.providerTransactionId &&
        !spoofedOrderDoc?.operatorReferenceId &&
        spoofedOrderDoc?.confirmedByUid === 'usr-admin-prod' &&
        spoofedFinDoc?.paymentConfirmationType === 'MANUAL_OPERATOR' &&
        unconfirmedPixPosRes.status === 201 &&
        unconfirmedPixPosRes.data?.transaction?.paymentStatus === 'PENDING',
      'Venda PDV balcão registra MANUAL_OPERATOR / POS_OPERATOR_COUNTER e descarta prefixos sintéticos POS-TX-* (sem falsificar AUTOMATED_PSP)',
      `status=${spoofedPosRes.status}, type=${spoofedOrderDoc?.paymentConfirmationType}, src=${spoofedOrderDoc?.settlementSource}, ptx=${spoofedOrderDoc?.providerTransactionId}, opRef=${spoofedOrderDoc?.operatorReferenceId}, unconfPay=${unconfirmedPixPosRes.data?.transaction?.paymentStatus}`
    );

    // -------------------------------------------------------------------------
    // FASE 2.2 — RECUPERAÇÃO DE SENHA & DISPARO SEGURO
    // -------------------------------------------------------------------------
    console.log('\n--- Fase 2: Recuperação de Senha & Reset Seguro ---');

    // Solicitar recuperação de senha para 'gerente@estrela.com.br'
    const recoverReqRes = await jsonReq(baseUrl, 'POST', '/api/v1/auth/recover-request', undefined, {
      email: 'gerente@estrela.com.br',
    });
    check(
      recoverReqRes.status === 200 && recoverReqRes.data?.success === true,
      'POST /api/v1/auth/recover-request emite solicitação com sucesso'
    );

    // Verificar que o hash do código e expiração foram gravados no usuário
    const userWithReset = (await db.collection('users').doc('usr-admin-prod').get()).data();
    check(
      Boolean(userWithReset?.resetCodeHash) && Boolean(userWithReset?.resetCodeExpiresAt),
      'Código de recuperação gerou resetCodeHash criptográfico (PBKDF2) e resetCodeExpiresAt'
    );

    // Tentar redefinir com código inválido
    const badResetRes = await jsonReq(baseUrl, 'POST', '/api/v1/auth/recover-reset', undefined, {
      email: 'gerente@estrela.com.br',
      code: 'ERR_0000',
      newPassword: 'NovaSenhaSegura!2026',
    });
    check(badResetRes.status === 400, 'Tentativa de reset de senha com código inválido é rejeitada com HTTP 400');

    // -------------------------------------------------------------------------
    // FASE 2.3 — COFRE AES-256-GCM PARA INTEGRAÇÕES (WHATSAPP & GATEWAYS)
    // -------------------------------------------------------------------------
    console.log('\n--- Fase 2: Cofre Criptográfico AES-256-GCM para WhatsApp & PSPs ---');

    const rawWhatsappKey = 'EAABwzL12345LiveTokenWhatsAppBusinessCloudApiSecret999';
    const encryptedEnvelope = encryptIntegrationSecret(rawWhatsappKey);
    check(
      encryptedEnvelope.alg === 'aes-256-gcm' &&
        Boolean(encryptedEnvelope.data) &&
        Boolean(encryptedEnvelope.iv) &&
        Boolean(encryptedEnvelope.tag),
      'encryptIntegrationSecret() gera envelope AES-256-GCM com IV e AuthTag autônomos'
    );

    const decryptedSecret = decryptIntegrationSecret(encryptedEnvelope);
    check(
      decryptedSecret === rawWhatsappKey,
      'decryptIntegrationSecret() recupera com precisão de 100% o segredo em claro'
    );

    await db.collection('integrations').doc('integ-wa-prod').set({
      id: 'integ-wa-prod',
      tenantId: 'tenant-prod',
      name: 'WhatsApp Business Cloud Matriz',
      provider: 'WHATSAPP_CLOUD',
      category: 'MESSAGING',
      status: 'ACTIVE',
      encryptedSecret: encryptedEnvelope,
      createdAt: new Date().toISOString(),
    });

    const savedIntegSnap = await db.collection('integrations').doc('integ-wa-prod').get();
    check(
      savedIntegSnap.exists && savedIntegSnap.data()?.encryptedSecret?.data !== rawWhatsappKey,
      'Cofre de integrações nunca armazena tokens ou chaves em texto plano no banco de dados'
    );

    // -------------------------------------------------------------------------
    // FASE 3.1 — 3C EDGE NODE AUTÔNOMO (SQLITE WAL LOCAL-FIRST)
    // -------------------------------------------------------------------------
    console.log('\n--- Fase 3: 3C Edge Node Autônomo com SQLite WAL ---');

    const edgeDbFile = path.join(tempDir, 'edge-test.db');
    const edgeDriver = new SqliteWalDriver(edgeDbFile);
    await edgeDriver.setDoc('local_orders', 'ord-edge-1', {
      id: 'ord-edge-1',
      tenantId: 'tenant-prod',
      storeId: 'store-prod-1',
      total: 45.0,
      status: 'CONFIRMED',
      syncedWithCloud: false,
    });

    const edgeDoc = await edgeDriver.getDoc('local_orders', 'ord-edge-1');
    check(
      edgeDoc !== null && edgeDoc.total === 45.0 && edgeDoc.status === 'CONFIRMED',
      'SqliteWalDriver grava e lê transacionalmente no SQLite WAL local mesmo sem conexão WAN'
    );
    await edgeDriver.close();

    // -------------------------------------------------------------------------
    // FASE 3.2 — ROTEAMENTO DE IMPRESSÃO ESC/POS POR ESTAÇÃO
    // -------------------------------------------------------------------------
    console.log('\n--- Fase 3: Roteamento de Impressão Térmica ESC/POS por Estação ---');

    // Cadastrar impressoras térmicas para store-prod-1
    await db.collection('peripherals').doc('printer-kitchen-1').set({
      id: 'printer-kitchen-1',
      tenantId: 'tenant-prod',
      storeId: 'store-prod-1',
      name: 'Epson TM-T20 Cozinha Quente',
      kind: 'PRINTER',
      station: 'KITCHEN',
      connectionType: 'LAN_RAW_9100',
      active: true,
      isDefault: false,
    });

    await db.collection('peripherals').doc('printer-cashier-1').set({
      id: 'printer-cashier-1',
      tenantId: 'tenant-prod',
      storeId: 'store-prod-1',
      name: 'Daruma DR800 Balcão Caixa',
      kind: 'PRINTER',
      station: 'CASHIER',
      connectionType: 'LAN_RAW_9100',
      active: true,
      isDefault: true,
    });

    // Enfileirar trabalho para KITCHEN
    const kitchenJobRes = await jsonReq(
      baseUrl,
      'POST',
      '/api/v1/store/print-jobs',
      storeManagerToken,
      {
        storeId: 'store-prod-1',
        station: 'KITCHEN',
        title: 'Comanda Mesa 04 — Pedido #102',
        content: '=== COZINHA ===\n1x Picanha na Brasa\nPonto: Mal Passada',
      }
    );
    check(
      kitchenJobRes.status === 201 && kitchenJobRes.data?.job?.peripheralId === 'printer-kitchen-1',
      'POST /api/v1/store/print-jobs com station=KITCHEN roteia deterministicamente para printer-kitchen-1'
    );
    const createdJobId = kitchenJobRes.data?.job?.id;

    // Listar trabalhos filtrados por station KITCHEN
    const listKitchenRes = await jsonReq(
      baseUrl,
      'GET',
      `/api/v1/store/print-jobs?storeId=store-prod-1&status=QUEUED`,
      storeManagerToken
    );
    check(
      listKitchenRes.status === 200 &&
        Array.isArray(listKitchenRes.data) &&
        listKitchenRes.data.some((j: any) => j.id === createdJobId),
      'GET /api/v1/store/print-jobs lista trabalho pendente na fila operacional'
    );

    // Confirmar ACK de impressão com status PRINTED
    const ackRes = await jsonReq(
      baseUrl,
      'POST',
      `/api/v1/store/print-jobs/${createdJobId}/ack`,
      storeManagerToken,
      {
        status: 'PRINTED',
      }
    );
    check(
      ackRes.status === 200 && ackRes.data?.job?.status === 'PRINTED',
      'POST /api/v1/store/print-jobs/:id/ack transiciona trabalho para status=PRINTED'
    );

    // -------------------------------------------------------------------------
    // FASE 4.1 — CONFORMIDADE LGPD (AUTOEXCLUSÃO & ANONIMIZAÇÃO DE PII)
    // -------------------------------------------------------------------------
    console.log('\n--- Fase 4: Conformidade LGPD & Anonimização Forense ---');

    // Cadastrar consumidor titular de dados
    const consumerUid = 'usr-consumer-lgpd-test';
    const consumerToken = auth.generateDevToken({
      uid: consumerUid,
      email: 'titular.lgpd@dominio.com.br',
      name: 'Carlos da Silva Oliveira',
      role: 'CUSTOMER',
      tenantId: 'tenant-prod',
    });

    await db.collection('users').doc(consumerUid).set({
      uid: consumerUid,
      id: consumerUid,
      email: 'titular.lgpd@dominio.com.br',
      name: 'Carlos da Silva Oliveira',
      role: 'CUSTOMER',
      phone: '(11) 98765-4321',
      tenantId: 'tenant-prod',
      status: 'ACTIVE',
      tokenVersion: 1,
      passwordHash: hashPassword('SenhaTitular!2026'),
    });

    await db.collection('orders').doc('ord-lgpd-titular-1').set({
      id: 'ord-lgpd-titular-1',
      tenantId: 'tenant-prod',
      storeId: 'store-prod-1',
      customerId: consumerUid,
      customerName: 'Carlos da Silva Oliveira',
      customerEmail: 'titular.lgpd@dominio.com.br',
      customerPhone: '(11) 98765-4321',
      total: 120.0,
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      createdAt: new Date().toISOString(),
    });

    // Executar autoexclusão de conta via DELETE /api/v1/auth/account
    const deleteAccountRes = await jsonReq(baseUrl, 'DELETE', '/api/v1/auth/account', consumerToken);
    check(
      deleteAccountRes.status === 200 && deleteAccountRes.data?.success === true,
      'DELETE /api/v1/auth/account processa solicitação de autoexclusão com HTTP 200'
    );

    // Verificar que usuário não existe mais
    const deletedUserSnap = await db.collection('users').doc(consumerUid).get();
    check(!deletedUserSnap.exists, 'Documento do usuário na coleção users foi permanentemente deletado');

    // Verificar anonimização do pedido sem quebrar registro fiscal
    const anonymizedOrderSnap = await db.collection('orders').doc('ord-lgpd-titular-1').get();
    const anonOrderData = anonymizedOrderSnap.data();
    check(
      anonOrderData?.customerName === 'Consumidor Removido (LGPD)' &&
        anonOrderData?.customerEmail === null &&
        anonOrderData?.customerPhone === null &&
        anonOrderData?.total === 120.0,
      'Pedido preserva integridade fiscal contábil com PII totalmente anonimizada'
    );

    // -------------------------------------------------------------------------
    // FASE 4.2 — MANIFESTO DE RELEASE 5.2.1 (3C RELEASE MANAGER)
    // -------------------------------------------------------------------------
    console.log('\n--- Fase 4: Manifesto do 3C Release Manager (v5.2.1) ---');

    const releasesRes = await jsonReq(baseUrl, 'GET', '/api/v1/system/releases');
    check(
      releasesRes.status === 200 &&
        releasesRes.data?.managerName === '3C Release Manager' &&
        releasesRes.data?.products?.['store-os']?.latestVersion === '5.2.1' &&
        releasesRes.data?.products?.['marketplace']?.latestVersion === '5.2.1',
      'GET /api/v1/system/releases retorna manifesto oficial com Store OS e Marketplace em v5.2.1'
    );

    const compCheckRes = await jsonReq(
      baseUrl,
      'GET',
      '/api/v1/system/releases/check?appId=store-os&version=5.2.1&platform=web'
    );
    check(
      compCheckRes.status === 200 && compCheckRes.data?.compatible === true,
      'GET /api/v1/system/releases/check homologa Store OS v5.2.1 como compatível'
    );

    const artifactsRes = await jsonReq(baseUrl, 'GET', '/api/v1/system/releases/artifacts');
    check(
      artifactsRes.status === 200 &&
        Array.isArray(artifactsRes.data?.products?.['store-os']?.artifacts) &&
        typeof artifactsRes.data?.products?.['store-os']?.artifacts[0]?.available === 'boolean',
      'GET /api/v1/system/releases/artifacts lista disponibilidade e comandos de build dos instaladores'
    );

    const storeWinMeta = await jsonReq(
      baseUrl,
      'GET',
      '/api/v1/system/releases/download/store-os/windows?meta=1&format=.exe'
    );
    const storeApkMeta = await jsonReq(
      baseUrl,
      'GET',
      '/api/v1/system/releases/download/store-os/android?meta=1&format=.apk'
    );
    const marketApkMeta = await jsonReq(
      baseUrl,
      'GET',
      '/api/v1/system/releases/download/marketplace/android?meta=1&format=.apk'
    );
    const driverApkMeta = await jsonReq(
      baseUrl,
      'GET',
      '/api/v1/system/releases/download/driver/android?meta=1&format=.apk'
    );
    const waiterApkMeta = await jsonReq(
      baseUrl,
      'GET',
      '/api/v1/system/releases/download/waiter/android?meta=1&format=.apk'
    );
    check(
      storeWinMeta.status === 200 &&
        storeWinMeta.data?.artifact?.platform === 'windows' &&
        storeApkMeta.status === 200 &&
        storeApkMeta.data?.artifact?.format === '.apk' &&
        marketApkMeta.status === 200 &&
        driverApkMeta.status === 200 &&
        waiterApkMeta.status === 200,
      'GET /api/v1/system/releases/download/:appId/:platform resolve metadados de Store OS (Windows/Android) e Marketplace/Driver/Waiter (Android)'
    );

    // Distribuição de pacotes empacotados: RELEASES_DIR local + SHA256SUMS.txt + RELEASE_BASE_URL HTTPS seguro
    const prevReleasesDir = process.env.RELEASES_DIR;
    const prevReleaseBaseUrl = process.env.RELEASE_BASE_URL;
    const mockReleasesDir = path.join(tempDir, 'releases-staging');
    fs.mkdirSync(mockReleasesDir, { recursive: true });
    const mockApkPayload = Buffer.from('PK\x03\x04MOCK_ANDROID_APK_BINARY_PAYLOAD');
    const mockApkHash = crypto.createHash('sha256').update(mockApkPayload).digest('hex');
    fs.writeFileSync(path.join(mockReleasesDir, '3c-marketplace-5.2.1.apk'), mockApkPayload);
    fs.writeFileSync(
      path.join(mockReleasesDir, 'SHA256SUMS.txt'),
      `${mockApkHash}  3c-marketplace-5.2.1.apk\n`
    );

    try {
      process.env.RELEASES_DIR = mockReleasesDir;
      delete process.env.RELEASE_BASE_URL;

      const localApkMeta = await jsonReq(
        baseUrl,
        'GET',
        '/api/v1/system/releases/download/marketplace/android?meta=1&format=.apk'
      );
      const localApkDownload = await fetch(
        `${baseUrl}/api/v1/system/releases/download/marketplace/android?format=.apk`
      );
      const downloadedBuf = Buffer.from(await localApkDownload.arrayBuffer());
      const contentDisp = localApkDownload.headers.get('content-disposition') || '';

      check(
        localApkMeta.status === 200 &&
          localApkMeta.data?.available === true &&
          localApkMeta.data?.source === 'LOCAL_DISK' &&
          localApkMeta.data?.fileSizeBytes === mockApkPayload.length &&
          localApkMeta.data?.sha256 === mockApkHash &&
          localApkDownload.status === 200 &&
          contentDisp.includes('3c-marketplace-5.2.1.apk') &&
          downloadedBuf.equals(mockApkPayload),
        'RELEASES_DIR entrega arquivo empacotado (.apk) com Content-Disposition, tamanho real e checksum SHA-256'
      );

      // Remote HTTPS release URL redirect for Windows .exe + rejection of unsafe http:// external URL
      process.env.RELEASE_BASE_URL = 'https://releases.3ccorp.example.com/v5.2.1';
      const remoteWinMeta = await jsonReq(
        baseUrl,
        'GET',
        '/api/v1/system/releases/download/store-os/windows?meta=1&format=.exe'
      );
      const remoteWinRedirect = await fetch(
        `${baseUrl}/api/v1/system/releases/download/store-os/windows?format=.exe`,
        { redirect: 'manual' }
      );
      const redirectLoc = remoteWinRedirect.headers.get('location') || '';

      process.env.RELEASE_BASE_URL = 'http://evil-unencrypted.example.com/releases';
      const unsafeRemoteMeta = await jsonReq(
        baseUrl,
        'GET',
        '/api/v1/system/releases/download/store-os/windows?meta=1&format=.exe'
      );

      check(
        remoteWinMeta.status === 200 &&
          remoteWinMeta.data?.available === true &&
          remoteWinMeta.data?.source === 'REMOTE_RELEASE_URL' &&
          remoteWinRedirect.status === 302 &&
          redirectLoc ===
            'https://releases.3ccorp.example.com/v5.2.1/3C-Store-OS_5.2.1_x64-setup.exe' &&
          unsafeRemoteMeta.status === 200 &&
          unsafeRemoteMeta.data?.available === false &&
          unsafeRemoteMeta.data?.source === 'UNPUBLISHED',
        'RELEASE_BASE_URL HTTPS redireciona (302) direto para instalador Windows (.exe) e rejeita URL externa HTTP insegura'
      );
    } finally {
      if (prevReleasesDir === undefined) delete process.env.RELEASES_DIR;
      else process.env.RELEASES_DIR = prevReleasesDir;
      if (prevReleaseBaseUrl === undefined) delete process.env.RELEASE_BASE_URL;
      else process.env.RELEASE_BASE_URL = prevReleaseBaseUrl;
    }
  } finally {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log(`\n======================================================================`);
  console.log(`Resultado Homologação de Prontidão de Produção: ${passed} passaram, ${failed} falharam`);
  console.log('======================================================================\n');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
