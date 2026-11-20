import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-mkt-sec-'));
if (!process.env.SERVER_DB_PATH) process.env.SERVER_DB_PATH = path.join(tempDir, 'marketplace-test-db.json');
if (!process.env.SERVER_SECRET_PATH) process.env.SERVER_SECRET_PATH = path.join(tempDir, '.server-secret');
if (!process.env.SERVER_SECRET) process.env.SERVER_SECRET = '3c_mkt_sec_isolated_secret_2026';

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

async function run() {
  const { auth, db, hashPassword } = await import('../../src/server/config.ts');
  const { createServerCoreApp } = await import('../../src/server/app.ts');

  console.log('======================================================================');
  console.log('🛍️  PILAR 3 (PÚBLICO & MARKETPLACE) — SEGURANÇA, ISOLAMENTO & CHECKOUT');
  console.log('======================================================================\n');

  const app = createServerCoreApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Seed Tenants
    await db.collection('tenants').doc('tenant-burgers').set({
      id: 'tenant-burgers',
      name: 'Burger Kingdom Brasil Ltda',
      document: '11.222.333/0001-44',
      status: 'ACTIVE',
      plan: 'ENTERPRISE',
    });

    await db.collection('tenants').doc('tenant-pizza').set({
      id: 'tenant-pizza',
      name: 'Bella Pizza Forneria',
      document: '44.555.666/0001-77',
      status: 'ACTIVE',
      plan: 'PRO',
    });

    // 2. Seed Stores
    await db.collection('stores').doc('store-burger-sp').set({
      id: 'store-burger-sp',
      tenantId: 'tenant-burgers',
      name: 'Burger Kingdom Paulista',
      slug: 'burger-kingdom-sp',
      category: 'RESTAURANT',
      isOpen: true,
      deliveryFee: 8.50,
      deliveryModality: 'PLATFORM_FLEET',
      // Private SaaS fields that MUST NOT leak to public/consumers
      subscriptionPlan: 'ENTERPRISE',
      commissionRate: 7.5,
      saasMonthlyFee: 499.0,
      saasPaymentMethod: 'PIX',
      saasPaymentStatus: 'PAID',
      maxAllowedDevices: 25,
      maxAllowedBranches: 5,
      totalOrders: 4320,
      monthlyRevenue: 185400.0,
    });

    await db.collection('stores').doc('store-pizza-rj').set({
      id: 'store-pizza-rj',
      tenantId: 'tenant-pizza',
      name: 'Bella Pizza Copacabana',
      slug: 'bella-pizza-rj',
      category: 'PIZZERIA',
      isOpen: true,
      deliveryFee: 12.00,
      deliveryModality: 'STORE_FLEET',
      ownFleetCustomFee: 10.00,
      subscriptionPlan: 'PRO',
      commissionRate: 10.0,
      saasMonthlyFee: 299.0,
    });

    // 3. Seed Menu Items (Products with internal secrets: recipe, costPrice, supplierName)
    await db.collection('menu_items').doc('item-burger-master').set({
      id: 'item-burger-master',
      tenantId: 'tenant-burgers',
      storeId: 'store-burger-sp',
      name: 'Super Trufado Bacon Burger',
      description: 'Blend bovino 200g, queijo cheddar inglês e maionese trufada',
      price: 45.0,
      category: 'Burgers',
      stock: 15,
      isAvailable: true,
      // Internal confidential fields:
      costPrice: 14.80,
      supplierName: 'Frigorífico Premium Carnes Ltda',
      internalNotes: 'Margem líquida calculada em 67%',
      recipe: [
        { ingredientId: 'raw-blend-200g', ingredientName: 'Blend 200g', quantityRequired: 1 },
        { ingredientId: 'raw-bacon-fatias', ingredientName: 'Bacon Defumado', quantityRequired: 2 }
      ]
    });

    await db.collection('menu_items').doc('item-pizza-margherita').set({
      id: 'item-pizza-margherita',
      tenantId: 'tenant-pizza',
      storeId: 'store-pizza-rj',
      name: 'Pizza Margherita Especial',
      description: 'Molho San Marzano, fior di latte e manjericão fresco',
      price: 68.0,
      category: 'Pizzas',
      stock: 20,
      isAvailable: true,
      costPrice: 18.0,
      supplierName: 'Moinho Italiano Import',
      recipe: []
    });

    // 3.1 Seed Inventory Batches for BOM FIFO verification
    await db.collection('inventory_batches').doc('batch-blend-01').set({
      id: 'batch-blend-01',
      tenantId: 'tenant-burgers',
      storeId: 'store-burger-sp',
      sku: 'raw-blend-200g',
      quantity: 50,
      expirationDate: '2027-12-31',
    });

    await db.collection('inventory_batches').doc('batch-bacon-01').set({
      id: 'batch-bacon-01',
      tenantId: 'tenant-burgers',
      storeId: 'store-burger-sp',
      sku: 'raw-bacon-fatias',
      quantity: 100,
      expirationDate: '2027-12-31',
    });

    // 4. Seed Users & Consumer Profiles: Lojista and Two distinct Consumers (Alice and Bob)
    await db.collection('users').doc('usr-owner-burger').set({
      uid: 'usr-owner-burger',
      id: 'usr-owner-burger',
      email: 'owner@burgers.com',
      name: 'Burger Owner',
      role: 'STORE_OWNER',
      tenantId: 'tenant-burgers',
      storeId: 'store-burger-sp',
      status: 'ACTIVE',
      tokenVersion: 1,
    });

    await db.collection('users').doc('usr-cust-alice').set({
      uid: 'usr-cust-alice',
      id: 'usr-cust-alice',
      email: 'alice@cliente.com',
      name: 'Alice Consumidora',
      role: 'CUSTOMER',
      tenantId: 'tenant-burgers',
      status: 'ACTIVE',
      tokenVersion: 1,
    });

    await db.collection('consumers').doc('usr-cust-alice').set({
      id: 'usr-cust-alice',
      uid: 'usr-cust-alice',
      name: 'Alice Consumidora',
      email: 'alice@cliente.com',
      tenantId: 'tenant-1',
      savedAddresses: [{ street: 'Av. Paulista', number: '1000' }],
    });

    await db.collection('users').doc('usr-cust-bob').set({
      uid: 'usr-cust-bob',
      id: 'usr-cust-bob',
      email: 'bob@cliente.com',
      name: 'Bob Consumidor',
      role: 'CUSTOMER',
      tenantId: 'tenant-pizza',
      status: 'ACTIVE',
      tokenVersion: 1,
    });

    await db.collection('consumers').doc('usr-cust-bob').set({
      id: 'usr-cust-bob',
      uid: 'usr-cust-bob',
      name: 'Bob Consumidor',
      email: 'bob@cliente.com',
      tenantId: 'tenant-1',
      savedAddresses: [{ street: 'Av. Atlântica', number: '500' }],
    });

    // 4.1 Seed Dining Table 7 for QR Code Auto-service
    await db.collection('tables').doc('table-burger-7').set({
      id: 'table-burger-7',
      tenantId: 'tenant-burgers',
      storeId: 'store-burger-sp',
      tableNumber: 7,
      status: 'AVAILABLE',
      capacity: 4,
    });

    // 4.2 Seed Store Direct Payment Gateway Config
    await db.collection('payment_configs').doc('store-burger-sp').set({
      storeId: 'store-burger-sp',
      tenantId: 'tenant-burgers',
      pixKey: 'financeiro@burgers.com.br',
      pixKeyType: 'EMAIL',
      gatewayProvider: 'PIX_DIRECT_MERCHANT',
      autoTransfer: true,
      privateSecretApiKey: 'SUPER_SECRET_PIX_CREDENTIAL_XYZ',
    });

    // 5. Seed Coupons
    await db.collection('coupons').doc('coupon-bemvindo').set({
      id: 'coupon-bemvindo',
      code: 'BEMVINDO10',
      tenantId: 'tenant-burgers',
      storeId: 'store-burger-sp',
      discountType: 'PERCENT',
      discountValue: 10,
      minOrderValue: 30.0,
      usageLimit: 100,
      usageCount: 0,
      isActive: true,
    });

    // Auth Tokens
    const tokenBurgerOwner = auth.generateDevToken({
      uid: 'usr-owner-burger',
      email: 'owner@burgers.com',
      role: 'STORE_OWNER',
      tenantId: 'tenant-burgers',
      storeId: 'store-burger-sp',
      tokenVersion: 1,
    });

    const tokenAlice = auth.generateDevToken({
      uid: 'usr-cust-alice',
      email: 'alice@cliente.com',
      role: 'CUSTOMER',
      tenantId: 'tenant-burgers',
      tokenVersion: 1,
    });

    const tokenBob = auth.generateDevToken({
      uid: 'usr-cust-bob',
      email: 'bob@cliente.com',
      role: 'CUSTOMER',
      tenantId: 'tenant-pizza',
      tokenVersion: 1,
    });

    console.log('--- TEST GROUP 1: SANITIZAÇÃO DE CATÁLOGO & PRIVACIDADE MERCANTIL ---');

    // 1.1 GET /store/list anônimo não deve vazar SaaS / dados financeiros
    const resPublicStores = await fetch(`${baseUrl}/api/v1/store/list`);
    const publicStores = await resPublicStores.json();
    check(resPublicStores.status === 200, 'GET /api/v1/store/list retorna 200 para público anônimo');
    
    const burgerPublic = publicStores.find((s: any) => s.id === 'store-burger-sp');
    check(Boolean(burgerPublic), 'Loja Burger Kingdom retornada na listagem pública');
    check(burgerPublic?.subscriptionPlan === undefined, 'subscriptionPlan NÃO vazou no catálogo público');
    check(burgerPublic?.commissionRate === undefined, 'commissionRate NÃO vazou no catálogo público');
    check(burgerPublic?.saasMonthlyFee === undefined, 'saasMonthlyFee NÃO vazou no catálogo público');
    check(burgerPublic?.maxAllowedDevices === undefined, 'maxAllowedDevices NÃO vazou no catálogo público');
    check(burgerPublic?.monthlyRevenue === undefined, 'monthlyRevenue NÃO vazou no catálogo público');

    // 1.2 GET /store/:id anônimo
    const resPublicStoreDetail = await fetch(`${baseUrl}/api/v1/store/store-burger-sp`);
    const publicStoreDetail = await resPublicStoreDetail.json();
    check(resPublicStoreDetail.status === 200, 'GET /api/v1/store/:id retorna 200 para público');
    check(publicStoreDetail.subscriptionPlan === undefined, 'Detalhe de loja público omite plano SaaS');
    check(publicStoreDetail.deliveryFee === 8.50, 'Taxa pública de delivery preservada');

    // 1.3 GET /store/menu anônimo / cliente
    const resPublicMenu = await fetch(`${baseUrl}/api/v1/store/menu?storeId=store-burger-sp`);
    const publicMenuItems = await resPublicMenu.json();
    check(resPublicMenu.status === 200, 'GET /api/v1/store/menu retorna 200');
    const burgerItem = publicMenuItems.find((i: any) => i.id === 'item-burger-master');
    check(Boolean(burgerItem), 'Item do cardápio retornado na listagem pública');
    check(burgerItem?.costPrice === undefined, 'Preço de custo (costPrice) estritamente omitido do público');
    check(burgerItem?.supplierName === undefined, 'Nome do fornecedor (supplierName) estritamente omitido');
    check(burgerItem?.recipe === undefined, 'Ficha técnica / receita confidencial estritamente omitida');
    check(burgerItem?.internalNotes === undefined, 'Anotações internas de margem estritamente omitidas');
    check(burgerItem?.price === 45.0, 'Preço público de venda mantido');

    // 1.4 GET /store/menu com token de STORE_OWNER
    const resStaffMenu = await fetch(`${baseUrl}/api/v1/store/menu?storeId=store-burger-sp`, {
      headers: { Authorization: `Bearer ${tokenBurgerOwner}` }
    });
    const staffMenuItems = await resStaffMenu.json();
    const staffBurgerItem = staffMenuItems.find((i: any) => i.id === 'item-burger-master');
    check(staffBurgerItem?.costPrice === 14.80, 'Lojista autorizado visualiza preço de custo para gestão');
    check(Array.isArray(staffBurgerItem?.recipe), 'Lojista autorizado visualiza ficha técnica para gestão');

    // 1.5 GET /store/payment-public-info/:storeId público
    const resPaymentInfo = await fetch(`${baseUrl}/api/v1/store/payment-public-info/store-burger-sp`);
    const paymentInfo = await resPaymentInfo.json();
    check(resPaymentInfo.status === 200, 'GET /store/payment-public-info/:storeId retorna 200');
    check(paymentInfo.acceptsPix === true, 'Informa que estabelecimento aceita PIX');
    check(paymentInfo.pixKey === 'financeiro@burgers.com.br', 'Chave PIX pública correta');
    check(paymentInfo.privateSecretApiKey === undefined, 'Segredo de gateway privateSecretApiKey estritamente omitido');

    console.log('\n--- TEST GROUP 2: CHECKOUT ATÔMICO & VALIDAÇÃO DE ESTOQUE E REGRAS ---');

    // 2.1 Quantidade inválida / abusiva
    const resBadQty = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`
      },
      body: JSON.stringify({
        storeId: 'store-burger-sp',
        customerName: 'Alice',
        channel: 'MARKETPLACE',
        deliveryModality: 'PLATFORM_FLEET',
        deliveryAddress: 'Av. Paulista, 1000 - Apto 42',
        paymentMethod: 'PIX',
        items: [{ menuItemId: 'item-burger-master', quantity: 0 }]
      })
    });
    const badQtyData = await resBadQty.json();
    check(resBadQty.status === 400 || badQtyData.success === false, 'Rejeita pedido com quantidade <= 0');

    // 2.2 Quantidade maior que estoque disponível
    const resExceedStock = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`
      },
      body: JSON.stringify({
        storeId: 'store-burger-sp',
        customerName: 'Alice',
        channel: 'MARKETPLACE',
        deliveryModality: 'PLATFORM_FLEET',
        deliveryAddress: 'Av. Paulista, 1000 - Apto 42',
        paymentMethod: 'PIX',
        items: [{ menuItemId: 'item-burger-master', quantity: 99 }]
      })
    });
    const exceedStockData = await resExceedStock.json();
    check(resExceedStock.status === 400 || exceedStockData.success === false, 'Rejeita pedido excedendo estoque disponível');

    // 2.3 Tentativa de compra cruzada (item de outra loja)
    const resCrossStore = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`
      },
      body: JSON.stringify({
        storeId: 'store-burger-sp',
        customerName: 'Alice',
        channel: 'MARKETPLACE',
        deliveryModality: 'PLATFORM_FLEET',
        deliveryAddress: 'Av. Paulista, 1000',
        paymentMethod: 'PIX',
        items: [
          { menuItemId: 'item-burger-master', quantity: 1 },
          { menuItemId: 'item-pizza-margherita', quantity: 1 } // Pertence a store-pizza-rj!
        ]
      })
    });
    const crossStoreData = await resCrossStore.json();
    check(resCrossStore.status === 400 || crossStoreData.success === false, 'Bloqueia produto que não pertence ao estabelecimento alvo');

    // 2.4 Bloqueio de consumidor forjando canal operacional interno (POS)
    const resStaffChannelSpoof = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`
      },
      body: JSON.stringify({
        storeId: 'store-burger-sp',
        customerName: 'Alice Forger',
        channel: 'POS', // Internal staff channel
        deliveryModality: 'PICKUP',
        paymentMethod: 'CASH',
        items: [{ menuItemId: 'item-burger-master', quantity: 1 }]
      })
    });
    const staffChannelData = await resStaffChannelSpoof.json();
    check(resStaffChannelSpoof.status === 403 || staffChannelData.success === false, 'Bloqueia cliente tentando emitir pedido via canal de staff (POS)');

    // 2.5 Pedido Marketplace Legítimo com Cupom de Desconto
    const initialBurgerDoc = await db.collection('menu_items').doc('item-burger-master').get();
    const stockBeforeOrder = initialBurgerDoc.data().stock;

    const resAliceOrder = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`
      },
      body: JSON.stringify({
        storeId: 'store-burger-sp',
        // Attempting to spoof customerId to Bob:
        customerId: 'usr-cust-bob',
        customerName: 'Alice Consumidora Real',
        customerPhone: '(11) 98888-7777',
        channel: 'MARKETPLACE',
        deliveryModality: 'PLATFORM_FLEET',
        deliveryAddress: 'Av. Paulista, 1000 - Apto 42',
        paymentMethod: 'PIX',
        couponCode: 'BEMVINDO10',
        items: [{ menuItemId: 'item-burger-master', quantity: 2 }]
      })
    });

    const aliceOrderData = await resAliceOrder.json();
    check((resAliceOrder.status === 201 || resAliceOrder.status === 200) && aliceOrderData.success === true, 'Checkout do Marketplace efetuado com sucesso (Alice)');
    
    const aliceOrderId = aliceOrderData.transaction?.orderId;
    const aliceOrderDoc = await db.collection('orders').doc(aliceOrderId).get();
    const savedAliceOrder = aliceOrderDoc.data();

    check(savedAliceOrder.customerId === 'usr-cust-alice', 'Servidor protege e vincula customerId ao usuário autenticado (anti-spoofing)');
    check(savedAliceOrder.subtotal === 90.0, 'Subtotal calculado com integridade no backend (2 x R$ 45 = R$ 90)');
    check(savedAliceOrder.discount === 9.0, 'Desconto do cupom de 10% aplicado com precisão (R$ 9.00)');
    check(savedAliceOrder.deliveryFee === 8.50, 'Taxa de entrega PLATFORM_FLEET aplicada corretamente (R$ 8.50)');
    check(savedAliceOrder.total === 89.50, 'Total final correto: R$ 90 + R$ 8.50 - R$ 9.00 = R$ 89.50');

    // Verificar decremento atômico de estoque
    const updatedBurgerDoc = await db.collection('menu_items').doc('item-burger-master').get();
    check(updatedBurgerDoc.data().stock === stockBeforeOrder - 2, `Estoque deduzido atomicamente no banco (${stockBeforeOrder} -> ${updatedBurgerDoc.data().stock})`);

    // 2.5.1 Baixa de Insumos BOM FIFO e Registro Financeiro
    const rawBlendBatch = await db.collection('inventory_batches').doc('batch-blend-01').get();
    check(rawBlendBatch.data()?.quantity === 48, 'BOM FIFO deduziu 2 blend de 200g (50 -> 48)');

    const rawBaconBatch = await db.collection('inventory_batches').doc('batch-bacon-01').get();
    check(rawBaconBatch.data()?.quantity === 96, 'BOM FIFO deduziu 4 fatias de bacon (100 -> 96)');

    const finSnap = await db.collection('financial_records').get();
    const orderFinRecord = finSnap.docs.find(d => d.data()?.orderId === aliceOrderId);
    check(Boolean(orderFinRecord), 'Lançamento financeiro RECEIVABLE criado para o pedido Marketplace');
    check(orderFinRecord?.data()?.amount === 89.50, 'Valor financeiro RECEIVABLE correspondente ao total do pedido (R$ 89.50)');
    check(
      savedAliceOrder.paymentStatus === 'PENDING' && orderFinRecord?.data()?.status === 'PENDING',
      'Pedido remoto do Marketplace nasce com paymentStatus e RECEIVABLE PENDING (sem baixa antecipada antes de confirmação)'
    );

    // 2.6 Pedido de Autoatendimento no Salão (Mesa / TABLE)
    const resTableOrder = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`
      },
      body: JSON.stringify({
        storeId: 'store-burger-sp',
        channel: 'TABLE',
        tableNumber: 7,
        customerName: 'Alice na Mesa 7',
        deliveryModality: 'TABLE',
        paymentMethod: 'TABLE_BILL',
        items: [{ menuItemId: 'item-burger-master', quantity: 1 }]
      })
    });
    const tableOrderData = await resTableOrder.json();
    check((resTableOrder.status === 201 || resTableOrder.status === 200) && tableOrderData.success === true, 'Pedido de autoatendimento na Mesa 7 efetuado com sucesso');
    const tableOrderId = tableOrderData.transaction?.orderId;
    const tableOrderDoc = await db.collection('orders').doc(tableOrderId).get();
    check(tableOrderDoc.data().tableNumber === 7, 'Mesa 7 vinculada na comanda digital');
    check(tableOrderDoc.data().deliveryFee === 0, 'Autoatendimento no salão com taxa de entrega zerada');

    const tableBurgerDoc = await db.collection('tables').doc('table-burger-7').get();
    check(tableBurgerDoc.data()?.status === 'OCCUPIED', 'Mesa física 7 marcada atomicamente como OCCUPIED no checkout do salão');

    // 2.7 Pedido Bob em outra loja
    const resBobOrder = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenBob}`
      },
      body: JSON.stringify({
        storeId: 'store-pizza-rj',
        customerName: 'Bob',
        customerPhone: '(21) 97777-6666',
        channel: 'PICKUP',
        deliveryModality: 'PICKUP',
        paymentMethod: 'CREDIT_CARD',
        items: [{ menuItemId: 'item-pizza-margherita', quantity: 1 }]
      })
    });
    const bobOrderData = await resBobOrder.json();
    check((resBobOrder.status === 201 || resBobOrder.status === 200) && bobOrderData.success === true, 'Checkout do Marketplace efetuado com sucesso (Bob)');
    const bobOrderId = bobOrderData.transaction?.orderId;

    console.log('\n--- TEST GROUP 3: ISOLAMENTO ESTREITO DE CONSUMIDORES & ANTI-IDOR ---');

    // 3.1 GET /orders com token de Alice
    const resAliceOrdersList = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const aliceOrdersList = await resAliceOrdersList.json();
    check(resAliceOrdersList.status === 200, 'GET /commerce/orders para consumidor autenticado retorna 200');
    check(aliceOrdersList.every((o: any) => o.customerId === 'usr-cust-alice'), 'Alice visualiza APENAS seus próprios pedidos (zero cross-consumer leaks)');
    check(!aliceOrdersList.some((o: any) => o.id === bobOrderId), 'Pedido de Bob NÃO aparece na listagem de Alice');

    // 3.2 GET /orders/:id de Alice buscando seu próprio pedido
    const resAliceOwnOrder = await fetch(`${baseUrl}/api/v1/commerce/orders/${aliceOrderId}`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    check(resAliceOwnOrder.status === 200, 'Alice consegue acessar o tracking do seu próprio pedido');

    // 3.3 Anti-IDOR: Alice tenta acessar o pedido de Bob diretamente por ID
    const resAliceAccessBobOrder = await fetch(`${baseUrl}/api/v1/commerce/orders/${bobOrderId}`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    check(resAliceAccessBobOrder.status === 403, 'Tentativa de IDOR por Alice no pedido de Bob bloqueada com 403 Forbidden');

    // 3.4 Bob buscando seu próprio pedido
    const resBobOwnOrder = await fetch(`${baseUrl}/api/v1/commerce/orders/${bobOrderId}`, {
      headers: { Authorization: `Bearer ${tokenBob}` }
    });
    check(resBobOwnOrder.status === 200, 'Bob consegue acessar o tracking do seu próprio pedido');

    // 3.5 Anti-IDOR: Alice tenta ler o perfil de consumidor de Bob em /generic/consumers/:id
    const resAliceReadBobProfile = await fetch(`${baseUrl}/api/v1/generic/consumers/usr-cust-bob`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    check(resAliceReadBobProfile.status === 403, 'Tentativa de ler perfil de outro consumidor bloqueada com 403 Forbidden');

    // 3.6 Anti-IDOR: Alice tenta alterar o perfil de consumidor de Bob
    const resAliceWriteBobProfile = await fetch(`${baseUrl}/api/v1/generic/consumers/usr-cust-bob`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`
      },
      body: JSON.stringify({ data: { name: 'Bob Hacked' } })
    });
    check(resAliceWriteBobProfile.status === 403, 'Tentativa de alterar perfil de outro consumidor bloqueada com 403 Forbidden');

    // 3.7 Anti-IDOR: Alice tenta excluir o perfil de consumidor de Bob
    const resAliceDeleteBobProfile = await fetch(`${baseUrl}/api/v1/generic/consumers/usr-cust-bob`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    check(resAliceDeleteBobProfile.status === 403, 'Tentativa de excluir perfil de outro consumidor bloqueada com 403 Forbidden');

    // 3.8 Listagem /generic/consumers filtra estritamente o próprio consumidor
    const resAliceListConsumers = await fetch(`${baseUrl}/api/v1/generic/consumers`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const aliceConsumersList = await resAliceListConsumers.json();
    check(resAliceListConsumers.status === 200, 'GET /generic/consumers retorna 200 para consumidor');
    check(aliceConsumersList.length === 1 && aliceConsumersList[0].id === 'usr-cust-alice', 'Consumidor Alice visualiza apenas o seu próprio registro na coleção consumers');

    console.log('\n--- TEST GROUP 4: RASTREAMENTO EM TEMPO REAL & CICLO DE VIDA DO PEDIDO ---');

    // 4.1 Status inicial
    check(savedAliceOrder.status === 'PENDING', 'Pedido recém-criado inicia com status PENDING');

    // 4.2 Tentativa de avanço de status por consumidor não-autorizado
    const resCustomerTryAdvance = await fetch(`${baseUrl}/api/v1/commerce/orders/${aliceOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`
      },
      body: JSON.stringify({ status: 'CONFIRMED' })
    });
    check(resCustomerTryAdvance.status === 403, 'Consumidor é impedido de avançar status do pedido (403 Forbidden)');

    // 4.3 Lojista avança status do pedido
    const resConfirm = await fetch(`${baseUrl}/api/v1/commerce/orders/${aliceOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenBurgerOwner}`
      },
      body: JSON.stringify({ status: 'CONFIRMED' })
    });
    check(resConfirm.status === 200, 'Lojista confirma pedido (PENDING -> CONFIRMED)');

    const resPrep = await fetch(`${baseUrl}/api/v1/commerce/orders/${aliceOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenBurgerOwner}`
      },
      body: JSON.stringify({ status: 'IN_PREPARATION' })
    });
    check(resPrep.status === 200, 'Pedido entra em produção na cozinha (IN_PREPARATION)');

    const resReady = await fetch(`${baseUrl}/api/v1/commerce/orders/${aliceOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenBurgerOwner}`
      },
      body: JSON.stringify({ status: 'READY_FOR_PICKUP' })
    });
    check(resReady.status === 200, 'Pedido pronto para despacho/retirada (READY_FOR_PICKUP)');

    const resDelivered = await fetch(`${baseUrl}/api/v1/commerce/orders/${aliceOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenBurgerOwner}`
      },
      body: JSON.stringify({ status: 'DELIVERED' })
    });
    check(resDelivered.status === 200, 'Pedido finalizado como entregue (DELIVERED)');

    // 4.4 Consulta de tracking pelo cliente após avanço
    const resAliceTrackingDelivered = await fetch(`${baseUrl}/api/v1/commerce/orders/${aliceOrderId}`, {
      headers: { Authorization: `Bearer ${tokenAlice}` }
    });
    const trackedDelivered = await resAliceTrackingDelivered.json();
    const settledAliceFinSnap = await db.collection('financial_records').doc(`fin-ord-${aliceOrderId}`).get();
    check(
      trackedDelivered.status === 'DELIVERED' &&
        trackedDelivered.paymentStatus === 'PAID' &&
        settledAliceFinSnap.data()?.status === 'PAID',
      'Consumidor recebe status DELIVERED atualizado e recebível é liquidado para PAID na entrega'
    );

    // 4.5 Bloqueio de transição inválida na Máquina de Estados (DELIVERED -> PENDING)
    const resInvalidRevert = await fetch(`${baseUrl}/api/v1/commerce/orders/${aliceOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenBurgerOwner}`
      },
      body: JSON.stringify({ status: 'PENDING' })
    });
    check(resInvalidRevert.status === 400, 'Transição inválida de pedido entregue de volta para PENDING rejeitada com 400');

    console.log('\n--- TEST GROUP 5: SEGURANÇA E AUDITORIA DE DEPENDÊNCIAS OFFLINE ---');

    // 5.1 Verificar que nenhuma dependência de rede externa (api.qrserver.com) existe nos módulos do Marketplace
    const mktFiles = [
      path.join(process.cwd(), 'src/modules/marketplace/layout/StoreShowcaseAutoService.tsx'),
      path.join(process.cwd(), 'src/modules/marketplace/showcase-modal/ShowcaseSelfServiceTab.tsx'),
    ];

    let hasExternalQr = false;
    for (const f of mktFiles) {
      if (fs.existsSync(f)) {
        const content = fs.readFileSync(f, 'utf8');
        if (content.includes('api.qrserver.com')) {
          hasExternalQr = true;
          console.error(`Falha: Arquivo ${f} ainda contém dependência de api.qrserver.com!`);
        }
      }
    }
    check(!hasExternalQr, 'Zero dependências de API externa de terceiros (api.qrserver.com) no Marketplace');

    console.log('\n--- TEST GROUP 6: HARDENING ETAPA 3 (CONSUMER RBAC, CUPONS, IDEMPOTÊNCIA, GORJETA, SUSPENSÃO) ---');

    // 6.1 Usuário com papel CONSUMER (espelho de CUSTOMER)
    await db.collection('users').doc('usr-consumer-carol').set({
      uid: 'usr-consumer-carol',
      id: 'usr-consumer-carol',
      email: 'carol@consumidor.com',
      name: 'Carol Consumer',
      role: 'CONSUMER',
      tenantId: 'tenant-burgers',
      status: 'ACTIVE',
      tokenVersion: 1,
    });
    const tokenCarol = auth.generateDevToken({
      uid: 'usr-consumer-carol',
      email: 'carol@consumidor.com',
      role: 'CONSUMER',
      tenantId: 'tenant-burgers',
      tokenVersion: 1,
    });

    // 6.1a CONSUMER lê /generic/stores e /generic/menu_items com sanitização estrita
    const resGenStoresCarol = await fetch(`${baseUrl}/api/v1/generic/stores`, {
      headers: { Authorization: `Bearer ${tokenCarol}` },
    });
    const genStoresCarol = await resGenStoresCarol.json();
    const genBurgerCarol = Array.isArray(genStoresCarol) ? genStoresCarol.find((s: any) => s.id === 'store-burger-sp') : null;
    check(resGenStoresCarol.status === 200 && Boolean(genBurgerCarol), 'CONSUMER acessa /generic/stores com 200');
    check(
      genBurgerCarol?.subscriptionPlan === undefined &&
        genBurgerCarol?.saasMonthlyFee === undefined &&
        genBurgerCarol?.commissionRate === undefined,
      'CONSUMER não recebe dados SaaS/faturamento via /generic/stores'
    );

    const resGenMenuCarol = await fetch(`${baseUrl}/api/v1/generic/menu_items`, {
      headers: { Authorization: `Bearer ${tokenCarol}` },
    });
    const genMenuCarol = await resGenMenuCarol.json();
    const genBurgerItemCarol = Array.isArray(genMenuCarol) ? genMenuCarol.find((i: any) => i.id === 'item-burger-master') : null;
    check(resGenMenuCarol.status === 200 && Boolean(genBurgerItemCarol), 'CONSUMER acessa /generic/menu_items com 200');
    check(
      genBurgerItemCarol?.costPrice === undefined &&
        genBurgerItemCarol?.supplierName === undefined &&
        genBurgerItemCarol?.recipe === undefined &&
        genBurgerItemCarol?.internalNotes === undefined,
      'CONSUMER não recebe costPrice, supplierName, internalNotes nem recipe via /generic/menu_items'
    );

    // 6.1b CONSUMER bloqueado de sobrescrever /generic/orders/:id
    const resCarolGenOrderWrite = await fetch(`${baseUrl}/api/v1/generic/orders/${aliceOrderId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCarol}` },
      body: JSON.stringify({ data: { status: 'CANCELLED' } }),
    });
    check(resCarolGenOrderWrite.status === 403, 'CONSUMER bloqueado de alterar pedidos via /generic/orders/:id (403)');

    // 6.2 Isolamento de cupons cross-tenant (global ou mesmo código)
    await db.collection('coupons').doc('coupon-pizza-global').set({
      id: 'coupon-pizza-global',
      code: 'PIZZAGLOBAL20',
      tenantId: 'tenant-pizza',
      discountType: 'FIXED',
      discountValue: 20,
      minOrderValue: 10,
      isActive: true,
    });
    await db.collection('coupons').doc('coupon-pizza-samecode').set({
      id: 'coupon-pizza-samecode',
      code: 'BEMVINDO10',
      tenantId: 'tenant-pizza',
      storeId: 'store-pizza-rj',
      discountType: 'FIXED',
      discountValue: 50,
      minOrderValue: 10,
      isActive: true,
    });

    const resCouponsBurger = await fetch(`${baseUrl}/api/v1/commerce/coupons?storeId=store-burger-sp`);
    const couponsBurger = await resCouponsBurger.json();
    check(
      resCouponsBurger.status === 200 &&
        couponsBurger.some((c: any) => c.code === 'BEMVINDO10' && c.tenantId === 'tenant-burgers') &&
        !couponsBurger.some((c: any) => c.tenantId === 'tenant-pizza'),
      'GET /commerce/coupons?storeId=... isola cupons pelo tenant da loja sem vazar cupons globais de outro tenant'
    );

    // Tentar usar cupom global de tenant-pizza em store-burger-sp não deve aplicar desconto
    const stockBeforeCrossCoupon = (await db.collection('menu_items').doc('item-burger-master').get()).data().stock;
    const resOrderCrossCoupon = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCarol}` },
      body: JSON.stringify({
        storeId: 'store-burger-sp',
        channel: 'MARKETPLACE',
        deliveryModality: 'PICKUP',
        paymentMethod: 'PIX',
        couponCode: 'PIZZAGLOBAL20',
        items: [{ menuItemId: 'item-burger-master', quantity: 1 }],
      }),
    });
    const orderCrossCoupon = await resOrderCrossCoupon.json();
    const savedCrossOrder = (await db.collection('orders').doc(orderCrossCoupon.transaction.orderId).get()).data();
    check(savedCrossOrder.discount === 0 && savedCrossOrder.total === 45.0, 'Cupom de outro tenant é ignorado no checkout (desconto 0)');

    // 6.3 Idempotência de checkout via X-Idempotency-Key + validação de gorjeta e anti-injeção de comissão
    const idemKey = `mkt-idem-${Date.now()}`;
    const stockBeforeIdem = (await db.collection('menu_items').doc('item-burger-master').get()).data().stock;
    const tipPayload = {
      storeId: 'store-burger-sp',
      channel: 'MARKETPLACE',
      deliveryModality: 'PLATFORM_FLEET',
      deliveryAddress: 'Rua Augusta, 2500 - SP',
      paymentMethod: 'PIX',
      courierTip: 7.5,
      // Tentativa de injeção de comissão por consumidor deve ser ignorada
      professionalId: 'prof-fake',
      commissionRate: 50,
      commissionAmount: 99,
      items: [{ menuItemId: 'item-burger-master', quantity: 1 }],
    };
    const resIdem1 = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idemKey,
        Authorization: `Bearer ${tokenCarol}`,
      },
      body: JSON.stringify(tipPayload),
    });
    const dataIdem1 = await resIdem1.json();
    const savedIdem1 = (await db.collection('orders').doc(dataIdem1.transaction.orderId).get()).data();
    check(
      resIdem1.status === 201 &&
        savedIdem1.courierTip === 7.5 &&
        savedIdem1.total === 61.0 && // 45 + 8.50 + 7.50
        savedIdem1.professionalId === null &&
        savedIdem1.commissionRate === null,
      'Checkout aceita courierTip (45 + 8.50 + 7.50 = 61.0) e remove comissão injetada por consumidor'
    );

    const resIdem2 = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idemKey,
        Authorization: `Bearer ${tokenCarol}`,
      },
      body: JSON.stringify(tipPayload),
    });
    const dataIdem2 = await resIdem2.json();
    const stockAfterIdem = (await db.collection('menu_items').doc('item-burger-master').get()).data().stock;
    const idemDocSnap = await db.collection('order_idempotency_keys').doc(`usr-consumer-carol::store-burger-sp::${idemKey}`).get();
    check(
      (resIdem2.status === 200 || resIdem2.status === 201) &&
        dataIdem2.deduplicated === true &&
        resIdem2.headers.get('x-3c-idempotent-replay') === 'true' &&
        dataIdem2.transaction?.orderId === dataIdem1.transaction?.orderId &&
        idemDocSnap.exists &&
        stockAfterIdem === stockBeforeIdem - 1,
      'X-Idempotency-Key deduplica retry de checkout e persiste order_idempotency_keys sem duplicar baixa de estoque'
    );

    // 6.4 Validações de Delivery sem endereço, TABLE_BILL fora da mesa e loja fechada
    const resNoAddr = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCarol}` },
      body: JSON.stringify({
        storeId: 'store-burger-sp',
        channel: 'MARKETPLACE',
        deliveryModality: 'PLATFORM_FLEET',
        paymentMethod: 'PIX',
        items: [{ menuItemId: 'item-burger-master', quantity: 1 }],
      }),
    });
    check(resNoAddr.status === 400, 'Rejeita Delivery de consumidor sem deliveryAddress válido (400)');

    const resInvalidTableBill = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCarol}` },
      body: JSON.stringify({
        storeId: 'store-burger-sp',
        channel: 'MARKETPLACE',
        deliveryModality: 'PICKUP',
        paymentMethod: 'TABLE_BILL',
        items: [{ menuItemId: 'item-burger-master', quantity: 1 }],
      }),
    });
    check(resInvalidTableBill.status === 400, 'Rejeita TABLE_BILL em pedido que não é de mesa (400)');

    await db.collection('stores').doc('store-burger-sp').update({ isOpen: false });
    const resClosedStore = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCarol}` },
      body: JSON.stringify({
        storeId: 'store-burger-sp',
        channel: 'MARKETPLACE',
        deliveryModality: 'PICKUP',
        paymentMethod: 'PIX',
        items: [{ menuItemId: 'item-burger-master', quantity: 1 }],
      }),
    });
    const resClosedStoreTable = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCarol}` },
      body: JSON.stringify({
        storeId: 'store-burger-sp',
        channel: 'TABLE',
        tableNumber: 7,
        deliveryModality: 'TABLE',
        paymentMethod: 'TABLE_BILL',
        items: [{ menuItemId: 'item-burger-master', quantity: 1 }],
      }),
    });
    check(resClosedStore.status === 400, 'Rejeita checkout do consumidor quando a loja está fechada (isOpen=false)');
    check(resClosedStoreTable.status === 400, 'Rejeita pedido de mesa (TABLE) do consumidor quando a loja está fechada (isOpen=false)');
    await db.collection('stores').doc('store-burger-sp').update({ isOpen: true });

    // 6.5 Anti-spoofing em POST /store/reservations
    const resReservation = await fetch(`${baseUrl}/api/v1/store/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCarol}` },
      body: JSON.stringify({
        storeId: 'store-burger-sp',
        customerId: 'usr-cust-bob',
        status: 'CONFIRMED',
        customerName: 'Carol Reserva',
        partySize: 2,
        date: '2027-06-15',
        time: '20:00',
      }),
    });
    const reservationData = await resReservation.json();
    check(
      resReservation.status === 200 &&
        reservationData.reservation?.customerId === 'usr-consumer-carol' &&
        reservationData.reservation?.status === 'PENDING',
      'POST /store/reservations força customerId autenticado e status PENDING para consumidor (anti-spoofing)'
    );

    // 6.6 Bloqueio integral de tenant/loja SUSPENDED em endpoints públicos e de checkout
    await db.collection('tenants').doc('tenant-pizza').update({ status: 'SUSPENDED' });
    const resListSuspended = await fetch(`${baseUrl}/api/v1/store/list`);
    const listSuspended = await resListSuspended.json();
    check(
      !listSuspended.some((s: any) => s.id === 'store-pizza-rj'),
      'GET /store/list oculta lojas pertencentes a empresa SUSPENDED'
    );

    const resDetailSuspended = await fetch(`${baseUrl}/api/v1/store/store-pizza-rj`);
    check(resDetailSuspended.status === 403, 'GET /store/:id retorna 403 para loja de empresa SUSPENDED');

    const resPaySuspended = await fetch(`${baseUrl}/api/v1/store/payment-public-info/store-pizza-rj`);
    check(resPaySuspended.status === 403, 'GET /store/payment-public-info/:storeId retorna 403 para empresa SUSPENDED');

    const resOrderSuspended = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCarol}` },
      body: JSON.stringify({
        storeId: 'store-pizza-rj',
        channel: 'MARKETPLACE',
        deliveryModality: 'PICKUP',
        paymentMethod: 'PIX',
        items: [{ menuItemId: 'item-pizza-margherita', quantity: 1 }],
      }),
    });
    check(
      resOrderSuspended.status === 403 || resOrderSuspended.status === 400,
      'POST /commerce/orders bloqueia checkout em loja de empresa SUSPENDED'
    );

    const resReserveSuspended = await fetch(`${baseUrl}/api/v1/store/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCarol}` },
      body: JSON.stringify({
        storeId: 'store-pizza-rj',
        partySize: 2,
        date: '2027-06-16',
        time: '19:30',
      }),
    });
    check(resReserveSuspended.status === 403, 'POST /store/reservations retorna 403 para loja de empresa SUSPENDED');

    // Keep unused check variable happy
    void stockBeforeCrossCoupon;

    console.log('\n--- TEST GROUP 7: CICLO DE IDENTIDADE DO CONSUMIDOR, LGPD, CATÁLOGO SUSPENSO, STORE_FLEET CRM & CANCELAMENTO ---');

    // Seed single active DEV_OWNER for HQ governance & last-owner protection tests
    await db.collection('users').doc('usr-hq-owner').set({
      uid: 'usr-hq-owner',
      id: 'usr-hq-owner',
      email: 'hq-owner@3ccorp.com',
      name: 'HQ Root Owner',
      role: 'DEV_OWNER',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      tokenVersion: 1,
    });
    const tokenHqOwner = auth.generateDevToken({
      uid: 'usr-hq-owner',
      email: 'hq-owner@3ccorp.com',
      role: 'DEV_OWNER',
      tenantId: 'tenant-1',
      tokenVersion: 1,
    });

    // 7.1 Public menu sanitization when store/tenant is SUSPENDED or item is _deleted (tenant-pizza is SUSPENDED from 6.6)
    const resMenuWhileSuspended = await fetch(`${baseUrl}/api/v1/store/menu`);
    const menuWhileSuspended = await resMenuWhileSuspended.json();
    check(
      resMenuWhileSuspended.status === 200 &&
        menuWhileSuspended.some((i: any) => i.id === 'item-burger-master') &&
        !menuWhileSuspended.some((i: any) => i.id === 'item-pizza-margherita'),
      'GET /store/menu oculta produtos de lojas pertencentes a empresa SUSPENDED para público'
    );

    const resMenuAdminWhileSuspended = await fetch(`${baseUrl}/api/v1/store/menu`, {
      headers: { Authorization: `Bearer ${tokenHqOwner}` },
    });
    const menuAdminWhileSuspended = await resMenuAdminWhileSuspended.json();
    check(
      resMenuAdminWhileSuspended.status === 200 &&
        menuAdminWhileSuspended.some((i: any) => i.id === 'item-pizza-margherita'),
      'GET /store/menu mantém visibilidade administrativa para DEV_OWNER mesmo durante suspensão'
    );

    // Restore tenant-pizza to ACTIVE for remaining STORE_FLEET & CRM tests
    await db.collection('tenants').doc('tenant-pizza').update({ status: 'ACTIVE' });

    // 7.2 Consumer Signup -> Visible in HQ -> Self-service profile update with role/email lock
    const resDanSignup = await fetch(`${baseUrl}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Danilo Marketplace',
        email: 'danilo@cliente.com',
        password: 'SenhaInicial123',
        role: 'DEV_OWNER', // Attempt self-escalation on signup
      }),
    });
    const danSignup = await resDanSignup.json();
    const danUid = danSignup.user?.uid;
    let danToken = danSignup.token as string;
    check(
      resDanSignup.status === 201 &&
        Boolean(danUid) &&
        danSignup.user?.role === 'CUSTOMER' &&
        danSignup.user?.tenantId === 'tenant-1',
      'Signup força papel CUSTOMER e tenant-1 mesmo com tentativa de escalonamento para DEV_OWNER'
    );

    const resHqUsers = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: { Authorization: `Bearer ${tokenHqOwner}` },
    });
    const hqUsers = await resHqUsers.json();
    const danInHq = Array.isArray(hqUsers) ? hqUsers.find((u: any) => u.uid === danUid) : null;
    check(
      resHqUsers.status === 200 &&
        Boolean(danInHq) &&
        danInHq.resetCodeHash === undefined &&
        danInHq.passwordHash === undefined,
      'Consumidor criado no Marketplace aparece imediatamente no HQ sem expor hashes'
    );

    const resManualHqUser = await fetch(`${baseUrl}/api/v1/admin/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenHqOwner}` },
      body: JSON.stringify({
        name: 'Operador Manual HQ',
        email: 'manual-hq-check@cliente.com',
        password: 'ManualHqPass123',
        role: 'CUSTOMER',
        tenantId: 'tenant-1',
      }),
    });
    const manualHqUserData = await resManualHqUser.json();
    const manualHqUid = manualHqUserData?.user?.uid;
    const manualConsumerDoc = manualHqUid ? await db.collection('consumers').doc(manualHqUid).get() : null;
    check(
      resManualHqUser.status === 201 &&
        manualHqUserData?.user?.emailVerified === false &&
        Boolean(manualConsumerDoc?.exists),
      'HQ /admin/users/create grava users+consumers atomicamente e mantém emailVerified=false até confirmação'
    );

    const resDanProfileUpdate = await fetch(`${baseUrl}/api/v1/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${danToken}` },
      body: JSON.stringify({
        name: 'Danilo Silva Atualizado',
        phone: '(11) 99999-1234',
        role: 'DEV_OWNER',
        email: 'hacked@3ccorp.com',
      }),
    });
    const danProfileUpdate = await resDanProfileUpdate.json();
    const danConsumerAfterProfile = (await db.collection('consumers').doc(danUid).get()).data();
    check(
      resDanProfileUpdate.status === 200 &&
        danProfileUpdate.user?.name === 'Danilo Silva Atualizado' &&
        danProfileUpdate.user?.phone === '(11) 99999-1234' &&
        danProfileUpdate.user?.role === 'CUSTOMER' &&
        danProfileUpdate.user?.email === 'danilo@cliente.com' &&
        danConsumerAfterProfile?.name === 'Danilo Silva Atualizado' &&
        danConsumerAfterProfile?.phone === '(11) 99999-1234',
      'PUT /auth/profile sincroniza nome/telefone em users e consumers mantendo role e email imutáveis'
    );

    // 7.3 HQ Password Reset + immediate old token invalidation + temporary password login
    const resHqResetPass = await fetch(`${baseUrl}/api/v1/admin/users/${danUid}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenHqOwner}` },
      body: JSON.stringify({}),
    });
    const hqResetData = await resHqResetPass.json();
    check(
      resHqResetPass.status === 200 &&
        typeof hqResetData.temporaryPassword === 'string' &&
        hqResetData.temporaryPassword.startsWith('3C-') &&
        hqResetData.mustChangePassword === true,
      'HQ emite senha temporária e sinaliza mustChangePassword=true'
    );

    const resDanOldTokenMe = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${danToken}` },
    });
    check(resDanOldTokenMe.status === 401, 'Token anterior do consumidor é imediatamente invalidado após reset no HQ (401)');

    const resDanOldPassLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'danilo@cliente.com', password: 'SenhaInicial123' }),
    });
    check(resDanOldPassLogin.status === 401, 'Senha antiga não autentica após reset pelo HQ');

    const resDanTempLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'danilo@cliente.com', password: hqResetData.temporaryPassword }),
    });
    const danTempLogin = await resDanTempLogin.json();
    check(resDanTempLogin.status === 200 && Boolean(danTempLogin.token), 'Consumidor autentica com senha temporária emitida pelo HQ');
    const tempDanToken = danTempLogin.token as string;

    const resDanTempMe = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${tempDanToken}` },
    });
    const danTempMe = await resDanTempMe.json();
    check(
      resDanTempMe.status === 200 &&
        danTempMe.mustChangePassword === true &&
        danTempMe.resetCodeHash === undefined &&
        danTempMe.passwordHash === undefined,
      '/auth/me expõe mustChangePassword=true e omite hashes internos'
    );

    // 7.4 Authenticated Password Change
    const resBadCurrentPass = await fetch(`${baseUrl}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tempDanToken}` },
      body: JSON.stringify({ currentPassword: 'SenhaErrada999', newPassword: 'NovaSenhaForte!99' }),
    });
    check(resBadCurrentPass.status === 401, 'POST /auth/change-password rejeita senha atual incorreta (401)');

    const resChangePass = await fetch(`${baseUrl}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tempDanToken}` },
      body: JSON.stringify({ currentPassword: hqResetData.temporaryPassword, newPassword: 'NovaSenhaForte!99' }),
    });
    const changePassData = await resChangePass.json();
    check(
      resChangePass.status === 200 && Boolean(changePassData.token),
      'POST /auth/change-password atualiza senha e rotaciona token JWT'
    );
    danToken = changePassData.token;

    const resTempTokenAfterChange = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${tempDanToken}` },
    });
    check(resTempTokenAfterChange.status === 401, 'Token pré-alteração de senha é revogado após change-password');

    const resDanMeAfterChange = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${danToken}` },
    });
    const danMeAfterChange = await resDanMeAfterChange.json();
    check(
      resDanMeAfterChange.status === 200 && danMeAfterChange.mustChangePassword === false,
      'mustChangePassword é limpo após troca autenticada de senha'
    );

    // 7.5 Autonomous Recovery Request + Anti-Enumeration + Lockout + Reset
    const resRecUnknown = await fetch(`${baseUrl}/api/v1/auth/recover-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'inexistente@cliente.com' }),
    });
    const recUnknown = await resRecUnknown.json();

    const resRecDan = await fetch(`${baseUrl}/api/v1/auth/recover-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'danilo@cliente.com' }),
    });
    const recDan = await resRecDan.json();
    const danUserAfterRecReq = (await db.collection('users').doc(danUid).get()).data();
    check(
      resRecUnknown.status === 200 &&
        resRecDan.status === 200 &&
        recUnknown.message === recDan.message &&
        Boolean(danUserAfterRecReq?.resetCodeHash),
      'POST /auth/recover-request retorna resposta anti-enumeração sem vazar código de recuperação'
    );

    // Lockout after 5 wrong recovery attempts
    let lastBadResetStatus = 0;
    for (let attempt = 0; attempt < 6; attempt++) {
      const r = await fetch(`${baseUrl}/api/v1/auth/recover-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'danilo@cliente.com',
          code: 'WRONG999',
          newPassword: 'TentativaFalha123',
        }),
      });
      lastBadResetStatus = r.status;
    }
    check(lastBadResetStatus === 429, 'POST /auth/recover-reset bloqueia brute-force na 6ª tentativa com HTTP 429');

    // Complete recovery with valid code
    await db.collection('users').doc(danUid).update({
      resetCodeHash: hashPassword('REC12345'),
      resetCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      resetAttempts: 0,
    });
    const resRecoverOk = await fetch(`${baseUrl}/api/v1/auth/recover-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'danilo@cliente.com',
        code: 'REC12345',
        newPassword: 'SenhaRecuperada!88',
      }),
    });
    check(resRecoverOk.status === 200, 'POST /auth/recover-reset redefine senha com código válido');

    const resOldDanMeAfterRec = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${danToken}` },
    });
    check(resOldDanMeAfterRec.status === 401, 'Sessões antigas revogadas após recover-reset (401)');

    const resLoginAfterRec = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'danilo@cliente.com', password: 'SenhaRecuperada!88' }),
    });
    const loginAfterRec = await resLoginAfterRec.json();
    danToken = loginAfterRec.token;
    check(resLoginAfterRec.status === 200 && Boolean(danToken), 'Login bem-sucedido com a senha redefinida via recuperação');

    // 7.6 HQ Suspend & Reactivate Consumer
    const resSuspendDan = await fetch(`${baseUrl}/api/v1/admin/users/${danUid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenHqOwner}` },
      body: JSON.stringify({ status: 'DISABLED' }),
    });
    check(resSuspendDan.status === 200, 'HQ suspende conta do consumidor com status DISABLED');

    const resSuspendedMe = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${danToken}` },
    });
    const resSuspendedLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'danilo@cliente.com', password: 'SenhaRecuperada!88' }),
    });
    check(
      resSuspendedMe.status === 403 && resSuspendedLogin.status === 403,
      'Consumidor suspenso é bloqueado imediatamente em /auth/me e /auth/login (403)'
    );

    const resReactivateDan = await fetch(`${baseUrl}/api/v1/admin/users/${danUid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenHqOwner}` },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    check(resReactivateDan.status === 200, 'HQ reativa conta do consumidor com status ACTIVE');

    const resReactivatedLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'danilo@cliente.com', password: 'SenhaRecuperada!88' }),
    });
    const reactivatedLoginData = await resReactivatedLogin.json();
    danToken = reactivatedLoginData.token;
    check(resReactivatedLogin.status === 200 && Boolean(danToken), 'Consumidor reativado volta a autenticar normalmente');

    // 7.7 HQ Role Promotion (CUSTOMER -> STORE_OWNER with tenantId/storeId)
    await db.collection('users').doc('usr-promote-test').set({
      uid: 'usr-promote-test',
      id: 'usr-promote-test',
      email: 'promovido@cliente.com',
      name: 'Promovido Teste',
      role: 'CUSTOMER',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
      passwordHash: hashPassword('PromoPass123'),
      tokenVersion: 1,
    });
    const resPromote = await fetch(`${baseUrl}/api/v1/admin/users/usr-promote-test`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenHqOwner}` },
      body: JSON.stringify({ role: 'STORE_OWNER', tenantId: 'tenant-burgers', storeId: 'store-burger-sp' }),
    });
    const promotedData = await resPromote.json();
    check(
      resPromote.status === 200 &&
        promotedData.user?.role === 'STORE_OWNER' &&
        promotedData.user?.tenantId === 'tenant-burgers' &&
        promotedData.user?.storeId === 'store-burger-sp',
      'HQ promove conta CUSTOMER para STORE_OWNER vinculando tenantId e storeId da loja'
    );

    // 7.8 STORE_FLEET ownFleetCustomFee + Store OS CRM upsert + sync_outbox
    const resStoreFleetOrder = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${danToken}` },
      body: JSON.stringify({
        storeId: 'store-pizza-rj',
        customerName: 'Danilo Silva Atualizado',
        customerPhone: '(11) 99999-1234',
        channel: 'MARKETPLACE',
        deliveryModality: 'PLATFORM_FLEET',
        deliveryAddress: 'Rua Copacabana, 900 - RJ',
        paymentMethod: 'PIX',
        items: [{ menuItemId: 'item-pizza-margherita', quantity: 1 }],
      }),
    });
    const storeFleetOrderRes = await resStoreFleetOrder.json();
    const danOrderId = storeFleetOrderRes.transaction?.orderId;
    const savedFleetOrder = (await db.collection('orders').doc(danOrderId).get()).data();
    const crmSnap = await db.collection('customers_crm').doc(`crm-store-pizza-rj-${danUid}`).get();
    const crmData = crmSnap.data();
    const outboxSnap = await db.collection('sync_outbox').get();
    const hasCrmOutbox = outboxSnap.docs.some(
      d => d.data()?.entity === 'customers_crm' && d.data()?.entityId === `crm-store-pizza-rj-${danUid}`
    );

    check(
      resStoreFleetOrder.status === 201 &&
        savedFleetOrder?.deliveryFee === 10.0 &&
        savedFleetOrder?.total === 78.0 &&
        crmSnap.exists &&
        crmData?.totalOrders === 1 &&
        crmData?.totalSpent === 78.0 &&
        hasCrmOutbox,
      'STORE_FLEET aplica ownFleetCustomFee (R$ 10,00) no total e sincroniza customers_crm + sync_outbox no Lojista OS'
    );

    // 7.9 Consumer Order Cancellation while PENDING (restores product + variant stock + RETURN ledger + PAYABLE)
    await db.collection('menu_items').doc('item-burger-variant').set({
      id: 'item-burger-variant',
      tenantId: 'tenant-burgers',
      storeId: 'store-burger-sp',
      name: 'Camiseta Burger Kingdom',
      price: 50.0,
      category: 'Merch',
      stock: 10,
      isAvailable: true,
      variants: [
        { id: 'var-m', label: 'M', stock: 4 },
        { id: 'var-g', label: 'G', stock: 6 },
      ],
    });

    const resVarOrder = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({
        storeId: 'store-burger-sp',
        channel: 'PICKUP',
        deliveryModality: 'PICKUP',
        paymentMethod: 'PIX',
        items: [{ menuItemId: 'item-burger-variant', variantId: 'var-m', variantLabel: 'M', quantity: 2 }],
      }),
    });
    const varOrderData = await resVarOrder.json();
    const varOrderId = varOrderData.transaction?.orderId;
    const itemAfterSale = (await db.collection('menu_items').doc('item-burger-variant').get()).data();
    check(
      resVarOrder.status === 201 &&
        itemAfterSale?.stock === 8 &&
        itemAfterSale?.variants?.find((v: any) => v.id === 'var-m')?.stock === 2,
      'Venda com variação deduz estoque do produto (10 -> 8) e da variação (4 -> 2)'
    );

    const resBobCancelAlice = await fetch(`${baseUrl}/api/v1/commerce/orders/${varOrderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ reason: 'Tentativa IDOR' }),
    });
    check(resBobCancelAlice.status === 403, 'Outro consumidor é bloqueado de cancelar pedido alheio (403)');

    const resAliceCancel = await fetch(`${baseUrl}/api/v1/commerce/orders/${varOrderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ reason: 'Desisti da compra' }),
    });
    const aliceCancelData = await resAliceCancel.json();
    const itemAfterCancel = (await db.collection('menu_items').doc('item-burger-variant').get()).data();
    const ledgerSnap = await db.collection('stock_ledger').get();
    const hasMenuReturn = ledgerSnap.docs.some(
      d => d.data()?.orderId === varOrderId && d.data()?.itemType === 'MENU_ITEM' && d.data()?.reason === 'RETURN'
    );
    const hasVarReturn = ledgerSnap.docs.some(
      d => d.data()?.orderId === varOrderId && d.data()?.itemType === 'VARIANT' && d.data()?.reason === 'RETURN'
    );
    const finOrdUnpaidCancelSnap = await db.collection('financial_records').doc(`fin-ord-${varOrderId}`).get();
    const finCancelSnap = await db.collection('financial_records').doc(`fin-can-${varOrderId}`).get();

    check(
      resAliceCancel.status === 200 &&
        aliceCancelData.status === 'CANCELLED' &&
        itemAfterCancel?.stock === 10 &&
        itemAfterCancel?.variants?.find((v: any) => v.id === 'var-m')?.stock === 4 &&
        hasMenuReturn &&
        hasVarReturn &&
        finOrdUnpaidCancelSnap.data()?.status === 'CANCELLED' &&
        !finCancelSnap.exists,
      'POST /commerce/orders/:id/cancel em pedido PENDING não pago restaura estoque/variação, grava stock_ledger RETURN e cancela recebível PENDING sem estorno fictício'
    );

    // Confirm payment & status as store owner, reject consumer cancel, and verify paid cancellation generates PAYABLE refund
    const resVarOrder2 = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({
        storeId: 'store-burger-sp',
        channel: 'PICKUP',
        deliveryModality: 'PICKUP',
        paymentMethod: 'PIX',
        items: [{ menuItemId: 'item-burger-variant', variantId: 'var-g', variantLabel: 'G', quantity: 1 }],
      }),
    });
    const varOrder2Id = (await resVarOrder2.json()).transaction?.orderId;
    const resConfirmPayment2 = await fetch(`${baseUrl}/api/v1/commerce/orders/${varOrder2Id}/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBurgerOwner}` },
      body: JSON.stringify({ providerTransactionId: 'pix-tx-998877' }),
    });
    const finOrd2AfterConfirm = (await db.collection('financial_records').doc(`fin-ord-${varOrder2Id}`).get()).data();
    check(
      resConfirmPayment2.status === 200 && finOrd2AfterConfirm?.status === 'PAID',
      'POST /commerce/orders/:id/confirm-payment liquida recebível para PAID após confirmação do lojista/gateway'
    );

    await fetch(`${baseUrl}/api/v1/commerce/orders/${varOrder2Id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBurgerOwner}` },
      body: JSON.stringify({ status: 'CONFIRMED' }),
    });
    const resCancelConfirmed = await fetch(`${baseUrl}/api/v1/commerce/orders/${varOrder2Id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ reason: 'Tarde demais' }),
    });
    check(resCancelConfirmed.status === 400, 'Consumidor é impedido de cancelar após confirmação pela loja (400)');

    const resOwnerCancelPaid = await fetch(`${baseUrl}/api/v1/commerce/orders/${varOrder2Id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBurgerOwner}` },
      body: JSON.stringify({ reason: 'Estorno aprovado pela loja' }),
    });
    const finCancelPaidSnap = await db.collection('financial_records').doc(`fin-can-${varOrder2Id}`).get();
    check(
      resOwnerCancelPaid.status === 200 && finCancelPaidSnap.exists && finCancelPaidSnap.data()?.type === 'PAYABLE',
      'Cancelamento de pedido já PAID pelo lojista gera lançamento financeiro PAYABLE de estorno'
    );

    // 7.10 LGPD Self-Deletion + Last DEV_OWNER protection
    const allUsersPreDevDelete = await db.collection('users').get();
    const otherActiveDevs = allUsersPreDevDelete.docs
      .filter((d) => d.id !== 'usr-hq-owner' && d.data()?.role === 'DEV_OWNER' && d.data()?.status !== 'DISABLED' && d.data()?.disabled !== true);
    for (const d of otherActiveDevs) {
      await db.collection('users').doc(d.id).update({ status: 'DISABLED', disabled: true });
    }
    const resDeleteLastDev = await fetch(`${baseUrl}/api/v1/auth/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenHqOwner}` },
    });
    for (const d of otherActiveDevs) {
      await db.collection('users').doc(d.id).update({ status: 'ACTIVE', disabled: false });
    }
    check(resDeleteLastDev.status === 400, 'DELETE /auth/account bloqueia autoexclusão do último DEV_OWNER ativo (400)');

    const resDeleteDan = await fetch(`${baseUrl}/api/v1/auth/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${danToken}` },
    });
    const danUserAfterDel = await db.collection('users').doc(danUid).get();
    const danConsumerAfterDel = await db.collection('consumers').doc(danUid).get();
    const danMeAfterDel = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${danToken}` },
    });
    const danLoginAfterDel = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'danilo@cliente.com', password: 'SenhaRecuperada!88' }),
    });
    const danOrderAfterDel = (await db.collection('orders').doc(danOrderId).get()).data();
    const danOrderFinAfterDel = await db.collection('financial_records').doc(`fin-ord-${danOrderId}`).get();

    check(
      resDeleteDan.status === 200 &&
        !danUserAfterDel.exists &&
        !danConsumerAfterDel.exists &&
        danMeAfterDel.status === 401 &&
        danLoginAfterDel.status === 401 &&
        danOrderAfterDel?.customerName === 'Consumidor Removido (LGPD)' &&
        danOrderAfterDel?.customerEmail === null &&
        danOrderAfterDel?.customerPhone === null &&
        danOrderFinAfterDel.exists,
      'DELETE /auth/account exclui usuário/consumidor, revoga JWT e anonimiza PII de pedidos mantendo ledger fiscal'
    );

    console.log('\n--- TEST GROUP 8: P0 DRIVER & MARKETPLACE (DELIVERY PIN, CARTEIRA, SAQUE PIX & HAVERSINE) ---');

    const { calculateHaversineKm } = await import('../../packages/commerce-engine/src/storeDomain.ts');
    const distNearKm = calculateHaversineKm(-23.3105, -51.1628, -23.3112, -51.1585);
    const distFarKm = calculateHaversineKm(-23.3105, -51.1628, -23.3401, -51.1211);
    check(
      distNearKm < 1 && distFarKm > 5 && distFarKm < 6,
      `Haversine calcula distâncias reais para filtro de raio (perto=${distNearKm.toFixed(2)}km < 1km, distante=${distFarKm.toFixed(2)}km > 5km)`
    );

    // 8.1 Create delivery order with tip -> server generates 4-digit deliveryPin
    const resPinOrder = await fetch(`${baseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({
        storeId: 'store-burger-sp',
        customerName: 'Alice Delivery PIN',
        channel: 'MARKETPLACE',
        deliveryModality: 'PLATFORM_FLEET',
        deliveryAddress: 'Av. Higienópolis, 500',
        paymentMethod: 'PIX',
        courierTip: 3.5,
        items: [{ menuItemId: 'item-burger-master', quantity: 1 }],
      }),
    });
    const pinOrderJson = await resPinOrder.json();
    const pinOrderId = pinOrderJson.transaction?.orderId;
    const generatedDeliveryPin = String(pinOrderJson.transaction?.deliveryPin || '');

    const resTrackPinOrder = await fetch(`${baseUrl}/api/v1/commerce/orders/${pinOrderId}`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    const trackedPinOrder = await resTrackPinOrder.json();
    check(
      resPinOrder.status === 201 &&
        /^\d{4}$/.test(generatedDeliveryPin) &&
        trackedPinOrder?.deliveryPin === generatedDeliveryPin,
      'Pedido delivery gera deliveryPin de 4 dígitos no servidor e expõe ao cliente no tracking'
    );

    // 8.2 Seed COURIER user bound to UID and verify PUT /drivers/:id auto-upsert + delivery PIN gate
    await db.collection('users').doc('usr-courier-p0').set({
      uid: 'usr-courier-p0',
      id: 'usr-courier-p0',
      email: 'courier.p0@3ccorp.com',
      name: 'Entregador P0',
      role: 'COURIER',
      tenantId: 'tenant-burgers',
      status: 'ACTIVE',
      tokenVersion: 1,
    });
    const tokenCourierP0 = auth.generateDevToken({
      uid: 'usr-courier-p0',
      email: 'courier.p0@3ccorp.com',
      role: 'COURIER',
      tenantId: 'tenant-burgers',
      tokenVersion: 1,
    });

    const resUpsertCourier = await fetch(`${baseUrl}/api/v1/commerce/drivers/usr-courier-p0`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCourierP0}` },
      body: JSON.stringify({ status: 'AVAILABLE', latitude: -23.3105, longitude: -51.1628 }),
    });
    const upsertedCourierDoc = (await db.collection('drivers').doc('usr-courier-p0').get()).data();
    check(
      resUpsertCourier.status === 200 &&
        upsertedCourierDoc?.uid === 'usr-courier-p0' &&
        upsertedCourierDoc?.latitude === -23.3105,
      'PUT /commerce/drivers/:id faz auto-upsert seguro do motorista COURIER vinculado ao seu UID'
    );

    // Advance order to READY_FOR_PICKUP -> OUT_FOR_DELIVERY by courier
    for (const st of ['CONFIRMED', 'IN_PREPARATION', 'READY_FOR_PICKUP']) {
      await fetch(`${baseUrl}/api/v1/commerce/orders/${pinOrderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBurgerOwner}` },
        body: JSON.stringify({ status: st }),
      });
    }
    const resAcceptDelivery = await fetch(`${baseUrl}/api/v1/commerce/orders/${pinOrderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCourierP0}` },
      body: JSON.stringify({ status: 'OUT_FOR_DELIVERY' }),
    });
    check(resAcceptDelivery.status === 200, 'COURIER autenticado assume entrega READY_FOR_DELIVERY -> OUT_FOR_DELIVERY');

    const wrongPin = generatedDeliveryPin === '0000' ? '1111' : '0000';
    const resWrongPinDeliver = await fetch(`${baseUrl}/api/v1/commerce/orders/${pinOrderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCourierP0}` },
      body: JSON.stringify({ status: 'DELIVERED', deliveryPin: wrongPin }),
    });
    check(
      resWrongPinDeliver.status === 400,
      'Conclusão de entrega (DELIVERED) com deliveryPin incorreto é rejeitada com HTTP 400'
    );

    const resRightPinDeliver = await fetch(`${baseUrl}/api/v1/commerce/orders/${pinOrderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCourierP0}` },
      body: JSON.stringify({ status: 'DELIVERED', deliveryPin: generatedDeliveryPin }),
    });
    const courierAfterDeliver = (await db.collection('drivers').doc('usr-courier-p0').get()).data();
    // deliveryFee (8.50) + courierTip (3.50) = 12.00
    check(
      resRightPinDeliver.status === 200 &&
        courierAfterDeliver?.walletBalance === 12 &&
        courierAfterDeliver?.totalDeliveries === 1,
      'Conclusão com deliveryPin correto (200) credita deliveryFee + courierTip na carteira (R$ 12,00) e incrementa entregas'
    );

    // 8.3 Atomic PIX Withdraw (/commerce/drivers/:id/withdraw & /payouts)
    const [resNoPix, resOverBalance] = await Promise.all([
      fetch(`${baseUrl}/api/v1/commerce/drivers/usr-courier-p0/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCourierP0}` },
        body: JSON.stringify({ amount: 5, pixKey: '' }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/drivers/usr-courier-p0/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCourierP0}` },
        body: JSON.stringify({ amount: 999, pixKey: 'courier@pix.com' }),
      }),
    ]);

    const resValidWithdraw = await fetch(`${baseUrl}/api/v1/commerce/drivers/usr-courier-p0/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCourierP0}` },
      body: JSON.stringify({ amount: 7.5, pixKey: 'courier.p0@pix.com' }),
    });
    const validWithdrawJson = await resValidWithdraw.json();
    const resListPayouts = await fetch(`${baseUrl}/api/v1/commerce/drivers/usr-courier-p0/payouts`, {
      headers: { Authorization: `Bearer ${tokenCourierP0}` },
    });
    const listPayoutsJson = await resListPayouts.json();
    const courierAfterWithdraw = (await db.collection('drivers').doc('usr-courier-p0').get()).data();

    check(
      resNoPix.status === 400 &&
        resOverBalance.status === 400 &&
        resValidWithdraw.status === 201 &&
        validWithdrawJson?.walletBalance === 4.5 &&
        courierAfterWithdraw?.walletBalance === 4.5 &&
        resListPayouts.status === 200 &&
        Array.isArray(listPayoutsJson) &&
        listPayoutsJson.some((p: any) => p.amount === 7.5 && p.pixKey === 'courier.p0@pix.com'),
      'Saque PIX atômico valida chave/saldo (400), debita walletBalance (12 -> 4.50) e persiste em driver_payouts',
      `noPix=${resNoPix.status}, over=${resOverBalance.status}, ok=${resValidWithdraw.status}, bal=${courierAfterWithdraw?.walletBalance}`
    );

    // 8.4 Cofre Pessoal do Consumidor (Pastas, Cota Pessoal Isolada e Autorização por Proprietário)
    const aliceUploadRes = await fetch(`${baseUrl}/api/v1/storage/objects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({
        appId: 'marketplace',
        folder: 'comprovantes',
        filename: 'comprovante-pix-jantar.txt',
        mimeType: 'text/plain',
        contentUtf8: 'PIX R$ 89,90 — Autenticação 3C-998811',
      }),
    });
    const aliceUploadJson: any = await aliceUploadRes.json();
    const aliceObjId = aliceUploadJson?.object?.id;

    const [
      aliceListRes,
      bobReadAliceRes,
      ownerReadAliceRes,
      bobMoveAliceRes,
      aliceMoveFolderRes,
      aliceReadContentRes,
    ] = await Promise.all([
      fetch(`${baseUrl}/api/v1/storage/objects?appId=marketplace`, {
        headers: { Authorization: `Bearer ${tokenAlice}` },
      }),
      fetch(`${baseUrl}/api/v1/storage/objects/${aliceObjId}/content`, {
        headers: { Authorization: `Bearer ${tokenBob}` },
      }),
      fetch(`${baseUrl}/api/v1/storage/objects/${aliceObjId}/content`, {
        headers: { Authorization: `Bearer ${tokenBurgerOwner}` },
      }),
      fetch(`${baseUrl}/api/v1/storage/objects/${aliceObjId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
        body: JSON.stringify({ folder: 'hacked' }),
      }),
      fetch(`${baseUrl}/api/v1/storage/objects/${aliceObjId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
        body: JSON.stringify({ folder: 'notas-fiscais', filename: 'nf-jantar-atualizada.txt' }),
      }),
      fetch(`${baseUrl}/api/v1/storage/objects/${aliceObjId}/content`, {
        headers: { Authorization: `Bearer ${tokenAlice}` },
      }),
    ]);

    const aliceListJson: any = await aliceListRes.json();
    const aliceMoveJson: any = await aliceMoveFolderRes.json();
    const aliceContentText = await aliceReadContentRes.text();

    const aliceDeleteObjRes = await fetch(`${baseUrl}/api/v1/storage/objects/${aliceObjId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    const aliceReadAfterDelRes = await fetch(
      `${baseUrl}/api/v1/storage/objects/${aliceObjId}/content`,
      {
        headers: { Authorization: `Bearer ${tokenAlice}` },
      }
    );

    check(
      aliceUploadRes.status === 201 &&
        aliceUploadJson?.object?.quotaScope === 'USER_PERSONAL' &&
        aliceUploadJson?.object?.ownerUid === 'usr-cust-alice' &&
        aliceListRes.status === 200 &&
        aliceListJson?.quotaScope === 'USER_PERSONAL' &&
        Array.isArray(aliceListJson?.folders) &&
        aliceListJson.folders.includes('comprovantes') &&
        bobReadAliceRes.status === 403 &&
        ownerReadAliceRes.status === 403 &&
        bobMoveAliceRes.status === 403 &&
        aliceMoveFolderRes.status === 200 &&
        aliceMoveJson?.object?.folder === 'notas-fiscais' &&
        aliceMoveJson?.object?.filename === 'nf-jantar-atualizada.txt' &&
        aliceReadContentRes.status === 200 &&
        aliceContentText.includes('PIX R$ 89,90') &&
        aliceDeleteObjRes.status === 200 &&
        aliceReadAfterDelRes.status === 404,
      'Cofre Pessoal do Consumidor aplica cota individual (USER_PERSONAL), organiza pastas (PATCH), bloqueia leitura/edição por terceiros ou lojistas (403) e remove blob na exclusão',
      `up=${aliceUploadRes.status}, scope=${aliceListJson?.quotaScope}, bobRead=${bobReadAliceRes.status}, ownerRead=${ownerReadAliceRes.status}, move=${aliceMoveFolderRes.status}, del=${aliceDeleteObjRes.status}/${aliceReadAfterDelRes.status}`
    );

    // 14. Auditoria Maps: Coordenadas de Entrega no Pedido (Validação + Persistência)
    const [badCoordOrderRes, partialCoordOrderRes, validCoordOrderRes] = await Promise.all([
      fetch(`${baseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
        body: JSON.stringify({
          storeId: 'store-burger-sp',
          channel: 'MARKETPLACE',
          deliveryModality: 'PLATFORM_FLEET',
          deliveryAddress: 'Av. Paulista, 1000 - São Paulo, SP',
          deliveryLatitude: 120,
          deliveryLongitude: -46.65,
          paymentMethod: 'PIX',
          items: [{ menuItemId: 'item-burger-master', quantity: 1 }],
        }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
        body: JSON.stringify({
          storeId: 'store-burger-sp',
          channel: 'MARKETPLACE',
          deliveryModality: 'PLATFORM_FLEET',
          deliveryAddress: 'Av. Paulista, 1000 - São Paulo, SP',
          deliveryLatitude: -23.5614,
          paymentMethod: 'PIX',
          items: [{ menuItemId: 'item-burger-master', quantity: 1 }],
        }),
      }),
      fetch(`${baseUrl}/api/v1/commerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
        body: JSON.stringify({
          storeId: 'store-burger-sp',
          channel: 'MARKETPLACE',
          deliveryModality: 'PLATFORM_FLEET',
          deliveryAddress: 'Av. Paulista, 1000 - São Paulo, SP',
          deliveryLatitude: -23.561412,
          deliveryLongitude: -46.655881,
          paymentMethod: 'PIX',
          items: [{ menuItemId: 'item-burger-master', quantity: 1 }],
        }),
      }),
    ]);

    const validCoordOrderJson: any = await validCoordOrderRes.json();
    const persistedOrderId = validCoordOrderJson?.transaction?.orderId;
    const persistedOrderSnap = persistedOrderId
      ? await db.collection('orders').doc(persistedOrderId).get()
      : null;
    const persistedOrderData = persistedOrderSnap?.data();

    check(
      badCoordOrderRes.status === 400 &&
        partialCoordOrderRes.status === 400 &&
        validCoordOrderRes.status === 201 &&
        persistedOrderData?.deliveryLatitude === -23.561412 &&
        persistedOrderData?.deliveryLongitude === -46.655881,
      'Auditoria Maps: POST /orders rejeita coordenadas fora de faixa ou parciais (400) e persiste deliveryLatitude/deliveryLongitude válidas',
      `bad=${badCoordOrderRes.status}, partial=${partialCoordOrderRes.status}, ok=${validCoordOrderRes.status}, lat=${persistedOrderData?.deliveryLatitude}, lng=${persistedOrderData?.deliveryLongitude}`
    );

  } finally {
    server.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }

  console.log('\n======================================================================');
  console.log(`RESULTADO DA AUDITORIA DO PILAR 3 (MARKETPLACE): ${passed} passaram, ${failed} falharam`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
