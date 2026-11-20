import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-driver-dual-'));
if (!process.env.SERVER_DB_PATH) process.env.SERVER_DB_PATH = path.join(tempDir, 'driver-dual-test-db.json');
if (!process.env.SERVER_SECRET_PATH) process.env.SERVER_SECRET_PATH = path.join(tempDir, '.server-secret');
if (!process.env.SERVER_SECRET) process.env.SERVER_SECRET = '3c_driver_dual_fleet_secret_2026';

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

async function jsonReq(baseUrl: string, method: string, urlPath: string, token: string, body?: any) {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
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
  const { auth, db } = await import('../../src/server/config.ts');
  const { createServerCoreApp } = await import('../../src/server/app.ts');

  console.log('======================================================================');
  console.log('🛵  DRIVER DUAL FLEET (HQ PLATFORM + STORE OS) — INTEGRAÇÃO REAL');
  console.log('======================================================================\n');

  const app = createServerCoreApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await db.collection('tenants').doc('tenant-dual').set({
      id: 'tenant-dual',
      name: 'Grupo Dual Fleet Ltda',
      status: 'ACTIVE',
      plan: 'ENTERPRISE',
    });

    await db.collection('stores').doc('store-a').set({
      id: 'store-a',
      tenantId: 'tenant-dual',
      name: 'Burger Centro',
      isOpen: true,
      deliveryModality: 'STORE_FLEET',
    });

    await db.collection('stores').doc('store-b').set({
      id: 'store-b',
      tenantId: 'tenant-dual',
      name: 'Pizza Sul',
      isOpen: true,
      deliveryModality: 'STORE_FLEET',
    });

    await db.collection('users').doc('usr-hq-admin').set({
      uid: 'usr-hq-admin',
      id: 'usr-hq-admin',
      email: 'hq@dual.com',
      name: 'HQ Admin',
      role: 'SUPER_ADMIN',
      tenantId: 'tenant-dual',
      status: 'ACTIVE',
      tokenVersion: 1,
    });

    await db.collection('users').doc('usr-owner-a').set({
      uid: 'usr-owner-a',
      id: 'usr-owner-a',
      email: 'ownera@dual.com',
      name: 'Owner A',
      role: 'STORE_OWNER',
      tenantId: 'tenant-dual',
      storeId: 'store-a',
      status: 'ACTIVE',
      tokenVersion: 1,
    });

    await db.collection('users').doc('usr-owner-b').set({
      uid: 'usr-owner-b',
      id: 'usr-owner-b',
      email: 'ownerb@dual.com',
      name: 'Owner B',
      role: 'STORE_OWNER',
      tenantId: 'tenant-dual',
      storeId: 'store-b',
      status: 'ACTIVE',
      tokenVersion: 1,
    });

    const tokenHq = auth.generateDevToken({
      uid: 'usr-hq-admin',
      email: 'hq@dual.com',
      role: 'SUPER_ADMIN',
      tenantId: 'tenant-dual',
      tokenVersion: 1,
    });
    const tokenOwnerA = auth.generateDevToken({
      uid: 'usr-owner-a',
      email: 'ownera@dual.com',
      role: 'STORE_OWNER',
      tenantId: 'tenant-dual',
      storeId: 'store-a',
      tokenVersion: 1,
    });
    const tokenOwnerB = auth.generateDevToken({
      uid: 'usr-owner-b',
      email: 'ownerb@dual.com',
      role: 'STORE_OWNER',
      tenantId: 'tenant-dual',
      storeId: 'store-b',
      tokenVersion: 1,
    });

    // 1. HQ provisions Hybrid Courier (store-a + platform) and Platform-Only Courier
    const createHybrid = await jsonReq(baseUrl, 'POST', '/api/v1/admin/users/create', tokenHq, {
      name: 'Lucas Híbrido',
      email: 'lucas.hibrido@dual.com',
      password: 'Password!123',
      role: 'COURIER',
      storeId: 'store-a',
      fleetType: 'STORE_FLEET',
      allowedFleetModes: ['STORE_FLEET', 'PLATFORM_FLEET'],
      vehicle: 'MOTO',
      vehiclePlate: 'ABC-1234',
    });
    check(createHybrid.status === 201 && Boolean(createHybrid.data?.user?.uid), 'HQ provisiona entregador híbrido (Store + Plataforma)');
    const hybridUid = createHybrid.data?.user?.uid;

    const hybridDriverSnap = await db.collection('drivers').doc(hybridUid).get();
    const hybridDriverDoc = hybridDriverSnap.data();
    check(
      hybridDriverSnap.exists &&
        hybridDriverDoc?.storeId === 'store-a' &&
        Array.isArray(hybridDriverDoc?.allowedFleetModes) &&
        hybridDriverDoc.allowedFleetModes.includes('STORE_FLEET') &&
        hybridDriverDoc.allowedFleetModes.includes('PLATFORM_FLEET'),
      'Provisionamento HQ sincroniza documento drivers/{uid} com ambas as modalidades'
    );

    const createPlatform = await jsonReq(baseUrl, 'POST', '/api/v1/admin/users/create', tokenHq, {
      name: 'Rafael Plataforma',
      email: 'rafael.plat@dual.com',
      password: 'Password!123',
      role: 'COURIER',
      fleetType: 'PLATFORM_FLEET',
      allowedFleetModes: ['PLATFORM_FLEET'],
      vehicle: 'E_BIKE',
    });
    check(createPlatform.status === 201 && Boolean(createPlatform.data?.user?.uid), 'HQ provisiona entregador exclusivo Plataforma');
    const platformUid = createPlatform.data?.user?.uid;

    const createStoreOnly = await jsonReq(baseUrl, 'POST', '/api/v1/admin/users/create', tokenHq, {
      name: 'Bruno Frota Loja',
      email: 'bruno.loja@dual.com',
      password: 'Password!123',
      role: 'COURIER',
      storeId: 'store-a',
      fleetType: 'STORE_FLEET',
      allowedFleetModes: ['STORE_FLEET'],
      vehicle: 'MOTO',
    });
    check(createStoreOnly.status === 201 && Boolean(createStoreOnly.data?.user?.uid), 'HQ provisiona entregador exclusivo Frota da Loja A');
    const storeOnlyUid = createStoreOnly.data?.user?.uid;

    const tokenHybrid = auth.generateDevToken({
      uid: hybridUid,
      email: 'lucas.hibrido@dual.com',
      role: 'COURIER',
      tenantId: 'tenant-dual',
      storeId: 'store-a',
      tokenVersion: 1,
    });
    const tokenPlatform = auth.generateDevToken({
      uid: platformUid,
      email: 'rafael.plat@dual.com',
      role: 'COURIER',
      tenantId: 'tenant-dual',
      tokenVersion: 1,
    });
    const tokenStoreOnly = auth.generateDevToken({
      uid: storeOnlyUid,
      email: 'bruno.loja@dual.com',
      role: 'COURIER',
      tenantId: 'tenant-dual',
      storeId: 'store-a',
      tokenVersion: 1,
    });

    // 2. Mode switching enforcement
    const switchPlatform = await jsonReq(baseUrl, 'PUT', `/api/v1/commerce/drivers/${hybridUid}`, tokenHybrid, {
      activeOperationMode: 'PLATFORM',
    });
    check(switchPlatform.status === 200 && switchPlatform.data?.driver?.activeOperationMode === 'PLATFORM', 'Entregador híbrido alterna para modo Plataforma HQ');

    const blockedStoreSwitch = await jsonReq(baseUrl, 'PUT', `/api/v1/commerce/drivers/${platformUid}`, tokenPlatform, {
      activeOperationMode: 'STORE',
    });
    check(blockedStoreSwitch.status === 403, 'Entregador sem vínculo de loja é bloqueado de ativar Modo Loja (403)');

    // 3. Seed orders and validate scope & Store OS dispatch
    await db.collection('orders').doc('ord-store-a-1').set({
      id: 'ord-store-a-1',
      code: 'ORD-A1',
      tenantId: 'tenant-dual',
      storeId: 'store-a',
      status: 'READY_FOR_PICKUP',
      channel: 'MARKETPLACE',
      orderType: 'DELIVERY',
      deliveryModality: 'STORE_FLEET',
      deliveryFee: 9.0,
      total: 59.0,
      deliveryPin: '4321',
    });

    await db.collection('orders').doc('ord-store-a-2').set({
      id: 'ord-store-a-2',
      code: 'ORD-A2',
      tenantId: 'tenant-dual',
      storeId: 'store-a',
      status: 'READY_FOR_PICKUP',
      channel: 'MARKETPLACE',
      orderType: 'DELIVERY',
      deliveryModality: 'STORE_FLEET',
      deliveryFee: 11.0,
      total: 71.0,
      deliveryPin: '8877',
    });

    await db.collection('orders').doc('ord-store-b-1').set({
      id: 'ord-store-b-1',
      code: 'ORD-B1',
      tenantId: 'tenant-dual',
      storeId: 'store-b',
      status: 'READY_FOR_PICKUP',
      channel: 'MARKETPLACE',
      orderType: 'DELIVERY',
      deliveryModality: 'STORE_FLEET',
      deliveryFee: 10.0,
      total: 60.0,
      deliveryPin: '1234',
    });

    // Platform-only courier cannot view or claim Store A STORE_FLEET order
    const platOrders = await jsonReq(baseUrl, 'GET', '/api/v1/commerce/orders', tokenPlatform);
    const seesStoreA = Array.isArray(platOrders.data) && platOrders.data.some((o: any) => o.id === 'ord-store-a-1');
    check(platOrders.status === 200 && !seesStoreA, 'Entregador exclusivo Plataforma não enxerga corrida exclusiva de Frota da Loja');

    const platClaimStoreA = await jsonReq(baseUrl, 'POST', '/api/v1/commerce/orders/ord-store-a-1/status', tokenPlatform, {
      status: 'OUT_FOR_DELIVERY',
    });
    check(platClaimStoreA.status === 403, 'Entregador exclusivo Plataforma é bloqueado ao tentar assumir pedido STORE_FLEET (403)');

    // Hybrid courier switches back to STORE mode and claims ord-store-a-1
    const switchStore = await jsonReq(baseUrl, 'PUT', `/api/v1/commerce/drivers/${hybridUid}`, tokenHybrid, {
      activeOperationMode: 'STORE',
    });
    check(switchStore.status === 200 && switchStore.data?.driver?.activeOperationMode === 'STORE', 'Entregador híbrido retorna para Modo Loja');

    const hybridClaim = await jsonReq(baseUrl, 'POST', '/api/v1/commerce/orders/ord-store-a-1/status', tokenHybrid, {
      status: 'OUT_FOR_DELIVERY',
    });
    check(hybridClaim.status === 200 && hybridClaim.data?.success === true, 'Entregador híbrido no Modo Loja assume pedido STORE_FLEET da sua loja');

    // Store A owner dispatches ord-store-a-2 directly to Store A's store-only driver
    const storeADispatch = await jsonReq(baseUrl, 'POST', '/api/v1/commerce/orders/ord-store-a-2/assign-driver', tokenOwnerA, {
      driverId: storeOnlyUid,
    });
    check(
      storeADispatch.status === 200 && storeADispatch.data?.driverId === storeOnlyUid,
      'Store OS (Loja A) despacha pedido diretamente para entregador da loja via API compartilhada'
    );

    const storeOnlyOrders = await jsonReq(baseUrl, 'GET', '/api/v1/commerce/orders', tokenStoreOnly);
    const seesAssigned = Array.isArray(storeOnlyOrders.data) && storeOnlyOrders.data.some((o: any) => o.id === 'ord-store-a-2' && o.driverId === storeOnlyUid);
    check(seesAssigned, 'Entregador recebe despacho direto da Store OS dentro do mesmo App Driver');

    // Store B owner cannot dispatch Store B order to Store A store-only driver, nor dispatch Store A order
    const crossStoreDriverDispatch = await jsonReq(baseUrl, 'POST', '/api/v1/commerce/orders/ord-store-b-1/assign-driver', tokenOwnerB, {
      driverId: storeOnlyUid,
    });
    check(crossStoreDriverDispatch.status === 403, 'Loja B bloqueada de despachar pedido próprio para entregador exclusivo da Loja A (403)');

    const crossStoreOrderDispatch = await jsonReq(baseUrl, 'POST', '/api/v1/commerce/orders/ord-store-a-2/assign-driver', tokenOwnerB, {
      driverId: storeOnlyUid,
    });
    check(crossStoreOrderDispatch.status === 403, 'Loja B bloqueada de despachar pedido pertencente à Loja A (403)');

    // 4. HQ disables store-only driver -> blocks status/mode updates and dispatches
    await db.collection('drivers').doc(storeOnlyUid).update({ accountStatus: 'DISABLED' });
    const disabledSwitch = await jsonReq(baseUrl, 'PUT', `/api/v1/commerce/drivers/${storeOnlyUid}`, tokenStoreOnly, {
      status: 'AVAILABLE',
    });
    check(disabledSwitch.status === 403, 'Entregador suspenso pelo HQ é bloqueado de ficar online (403)');

    const dispatchToDisabled = await jsonReq(baseUrl, 'POST', '/api/v1/commerce/orders/ord-store-a-2/assign-driver', tokenOwnerA, {
      driverId: storeOnlyUid,
    });
    check(dispatchToDisabled.status === 400, 'Store OS bloqueado de despachar para entregador suspenso pelo HQ (400)');

    // 5. Maps & GPS coordinate bounds validation (Drivers & Stores)
    const badDriverLat = await jsonReq(baseUrl, 'PUT', `/api/v1/commerce/drivers/${hybridUid}`, tokenHybrid, {
      latitude: 95,
      longitude: -51.16,
    });
    const badDriverLng = await jsonReq(baseUrl, 'PUT', `/api/v1/commerce/drivers/${hybridUid}`, tokenHq, {
      latitude: -23.31,
      longitude: -200,
    });
    const validDriverGps = await jsonReq(baseUrl, 'PUT', `/api/v1/commerce/drivers/${hybridUid}`, tokenHybrid, {
      latitude: -23.3125,
      longitude: -51.1642,
    });
    const badStoreCoords = await jsonReq(baseUrl, 'PUT', '/api/v1/store/store-a', tokenOwnerA, {
      latitude: -91,
      longitude: 185,
    });
    const validStoreCoords = await jsonReq(baseUrl, 'PUT', '/api/v1/store/store-a', tokenOwnerA, {
      latitude: -23.3105,
      longitude: -51.1628,
    });

    check(
      badDriverLat.status === 400 &&
        badDriverLng.status === 400 &&
        validDriverGps.status === 200 &&
        validDriverGps.data?.driver?.latitude === -23.3125 &&
        badStoreCoords.status === 400 &&
        validStoreCoords.status === 200,
      'Auditoria Maps: GPS de entregador e loja bloqueia coordenadas fora de [-90..90, -180..180] e persiste coordenadas válidas',
      `drvBad=${badDriverLat.status}/${badDriverLng.status}, drvOk=${validDriverGps.status}, storeBad=${badStoreCoords.status}, storeOk=${validStoreCoords.status}`
    );
  } finally {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log(`\n======================================================================`);
  console.log(`Resultado Driver Dual Fleet: ${passed} passaram, ${failed} falharam`);
  console.log(`======================================================================`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
