import express from 'express';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { EdgeNodeRuntime as EdgeNodeRuntimeType } from '../../servers/edge-node/index.ts';
import { generateIdempotencyKey } from '@3c/commerce-engine';
import {
  createCapacitorPlatformAdapters,
  createTauriPlatformAdapters,
  detectLocalTerminalInfo,
} from '@3c/platform-adapters';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '3c-homologation-'));
if (!process.env.SERVER_DB_PATH) {
  process.env.SERVER_DB_PATH = path.join(tempDir, 'cloud-homologation-db.json');
}
if (!process.env.SERVER_SECRET_PATH) {
  process.env.SERVER_SECRET_PATH = path.join(tempDir, '.server-secret');
}
if (!process.env.SERVER_SECRET) {
  process.env.SERVER_SECRET = '3c_homologation_isolated_secret_2026';
}

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

async function openSseCapture(url: string): Promise<{
  events: any[];
  close: () => void;
  ready: Promise<void>;
}> {
  const events: any[] = [];
  let reqRef: http.ClientRequest | null = null;
  let resolveReady!: () => void;
  const ready = new Promise<void>((res) => {
    resolveReady = res;
  });

  reqRef = http.get(url, (res) => {
    res.setEncoding('utf-8');
    let buffer = '';
    res.on('data', (chunk: string) => {
      buffer += chunk;
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';
      for (const frame of frames) {
        const line = frame
          .split('\n')
          .find((l) => l.startsWith('data:'));
        if (!line) continue;
        try {
          const parsed = JSON.parse(line.replace(/^data:\s*/, ''));
          events.push(parsed);
          if (parsed.type === 'CONNECTED') {
            resolveReady();
          }
        } catch {
          // ignore malformed chunks
        }
      }
    });
  });

  reqRef.on('error', () => {
    resolveReady();
  });

  return {
    events,
    ready,
    close: () => {
      reqRef?.destroy();
    },
  };
}

async function run() {
  const { auth, db } = await import('../../src/server/config.ts');
  const {
    attachContractContext,
    idempotencyGuard,
  } = await import('../../src/server/middleware/contracts.ts');
  const { default: commerceRoutes } = await import('../../src/server/routes/commerce.ts');
  const { default: storeRoutes } = await import('../../src/server/routes/store.ts');
  const { default: syncRoutes } = await import('../../src/server/routes/sync.ts');
  const { default: sseRoutes } = await import('../../src/server/routes/sse.ts');
  const { default: systemRoutes } = await import('../../src/server/routes/system.ts');
  const { EdgeNodeRuntime } = await import('../../servers/edge-node/index.ts');

  console.log('======================================================================');
  console.log('🌍 HOMOLOGAÇÃO GLOBAL CROSS-PLATFORM FASE 6 & 7 — 3C CORP ECOSYSTEM');
  console.log('======================================================================\n');

  const sqliteTenantA = path.join(tempDir, 'edge-tenant-a.sqlite');
  const sqliteTenantB = path.join(tempDir, 'edge-tenant-b.sqlite');

  // Mount full Cloud Server Core router stack
  const cloudApp = express();
  cloudApp.use(express.json());
  cloudApp.use(attachContractContext);
  cloudApp.use('/api/v1/system', systemRoutes);
  cloudApp.use('/api/v1/commerce', idempotencyGuard, commerceRoutes);
  cloudApp.use('/api/v1/store', storeRoutes);
  cloudApp.use('/api/v1/sync', idempotencyGuard, syncRoutes);
  cloudApp.use('/api/v1/sse', sseRoutes);

  const cloudServer = http.createServer(cloudApp);
  await new Promise<void>((resolve) => cloudServer.listen(0, '127.0.0.1', () => resolve()));
  const cloudPort = (cloudServer.address() as { port: number }).port;
  const cloudBaseUrl = `http://127.0.0.1:${cloudPort}`;

  let edgeA: EdgeNodeRuntimeType | null = null;
  let edgeB: EdgeNodeRuntimeType | null = null;
  let sseClientA: { events: any[]; close: () => void; ready: Promise<void> } | null = null;
  let sseClientB: { events: any[]; close: () => void; ready: Promise<void> } | null = null;

  try {
    // ------------------------------------------------------------------
    // 1. Validate Platform Adapters & 3C Release Manager Endpoints
    // ------------------------------------------------------------------
    const tauriAdapter = createTauriPlatformAdapters('tauri-linux');
    const capacitorAdapter = createCapacitorPlatformAdapters();

    // Test sensitive token isolation (never written to localStorage on native shells) + honest scale diagnostics
    const mockLocalStorage = new Map<string, string>();
    const prevGlobalWindow = (globalThis as any).window;
    const prevGlobalLs = (globalThis as any).localStorage;
    let capTokenInLs = false;
    let tauriTokenInLs = false;
    let capDiag: any = null;
    let scaleRead: any = null;
    try {
      (globalThis as any).localStorage = {
        getItem: (k: string) => mockLocalStorage.get(k) ?? null,
        setItem: (k: string, v: string) => {
          mockLocalStorage.set(k, v);
        },
        removeItem: (k: string) => {
          mockLocalStorage.delete(k);
        },
      };
      (globalThis as any).window = { location: { hostname: 'localhost', protocol: 'https:' } };
      capacitorAdapter.storage.setItem('3ccorp_auth_token', 'cap_secret_jwt_123');
      capacitorAdapter.storage.setItem('3ccorp_device_token_dev1', 'cap_device_secret_456');
      capTokenInLs =
        mockLocalStorage.has('3ccorp_auth_token') || mockLocalStorage.has('3ccorp_device_token_dev1');
      capDiag = capacitorAdapter.storage.getDiagnostics?.();
      capacitorAdapter.storage.removeItem('3ccorp_auth_token');
      capacitorAdapter.storage.removeItem('3ccorp_device_token_dev1');

      tauriAdapter.storage.setItem('3ccorp_auth_token', 'tauri_secret_jwt_789');
      tauriTokenInLs = mockLocalStorage.has('3ccorp_auth_token');
      tauriAdapter.storage.removeItem('3ccorp_auth_token');

      scaleRead = await tauriAdapter.scale.readWeightKg();
    } finally {
      if (prevGlobalWindow === undefined) delete (globalThis as any).window;
      else (globalThis as any).window = prevGlobalWindow;
      if (prevGlobalLs === undefined) delete (globalThis as any).localStorage;
      else (globalThis as any).localStorage = prevGlobalLs;
    }

    check(
      tauriAdapter.target === 'tauri-linux' &&
        typeof tauriAdapter.scale.readWeightKg === 'function' &&
        typeof tauriAdapter.edgeSidecar.getSidecarStatus === 'function' &&
        capacitorAdapter.target === 'capacitor-android' &&
        !capTokenInLs &&
        !tauriTokenInLs &&
        capDiag?.backend === 'CAPACITOR_VOLATILE_MEMORY_ONLY' &&
        scaleRead?.connected === false &&
        scaleRead?.simulated === true &&
        scaleRead?.stable === false,
      '1. Adaptadores nativos Tauri 2 e Capacitor 6 isolam tokens sensíveis de localStorage e reportam hardware simulado/desconectado com honestidade',
      `capLs=${capTokenInLs}, tauriLs=${tauriTokenInLs}, capBackend=${capDiag?.backend}, scale=${JSON.stringify(scaleRead)}`
    );

    const prevWindowDesc = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const prevNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    let winTerm: ReturnType<typeof detectLocalTerminalInfo>;
    let linuxTerm: ReturnType<typeof detectLocalTerminalInfo>;
    let androidTerm: ReturnType<typeof detectLocalTerminalInfo>;
    const nodeTerm = detectLocalTerminalInfo();
    try {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: { __TAURI_INTERNALS__: {}, location: { hostname: '127.0.0.1', protocol: 'http:' } },
      });
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32' },
      });
      winTerm = detectLocalTerminalInfo();

      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', platform: 'Linux x86_64' },
      });
      linuxTerm = detectLocalTerminalInfo();

      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        writable: true,
        value: { Capacitor: { isNativePlatform: () => true }, location: { hostname: 'localhost', protocol: 'https:' } },
      });
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: { userAgent: 'Mozilla/5.0 (Linux; Android 14)', platform: 'Linux armv8l' },
      });
      androidTerm = detectLocalTerminalInfo();
    } finally {
      if (prevWindowDesc) Object.defineProperty(globalThis, 'window', prevWindowDesc);
      else delete (globalThis as any).window;
      if (prevNavDesc) Object.defineProperty(globalThis, 'navigator', prevNavDesc);
      else delete (globalThis as any).navigator;
    }
    check(
      nodeTerm.isLocalTerminal === false &&
        winTerm.isLocalTerminal === true &&
        winTerm.os === 'Windows' &&
        winTerm.label === 'Terminal Local • Windows' &&
        linuxTerm.isLocalTerminal === true &&
        linuxTerm.os === 'Linux' &&
        linuxTerm.label === 'Terminal Local • Linux' &&
        androidTerm.isLocalTerminal === false &&
        androidTerm.os === 'Android',
      '1b. detectLocalTerminalInfo identifica Terminal Local Windows e Linux corretamente sem falso positivo em Android/Node'
    );

    const relResp = await fetch(`${cloudBaseUrl}/api/v1/system/releases`);
    const relManifest = await relResp.json();
    const productKeys = Object.keys(relManifest.products || {});
    check(
      relResp.status === 200 &&
        relManifest.managerName === '3C Release Manager' &&
        ['marketplace', 'store-os', 'driver', 'waiter', 'hq', 'server-core'].every((k) =>
          productKeys.includes(k)
        ),
      '2. 3C Release Manager publica artefatos oficiais para todos os 6 produtos (Web, Tauri 2, Capacitor e Edge)'
    );

    const compatOkResp = await fetch(
      `${cloudBaseUrl}/api/v1/system/releases/check?appId=store-os&version=5.0.0&platform=windows`
    );
    const compatOk = await compatOkResp.json();
    const compatOldResp = await fetch(
      `${cloudBaseUrl}/api/v1/system/releases/check?appId=driver&version=4.8.0&platform=android`
    );
    const compatOld = await compatOldResp.json();
    const tauriUpdateResp = await fetch(
      `${cloudBaseUrl}/api/v1/system/releases/tauri/windows/x86_64/5.0.0`
    );
    const latestStoreOsVer = relManifest.products['store-os'].latestVersion;
    const tauriUpToDateResp = await fetch(
      `${cloudBaseUrl}/api/v1/system/releases/tauri/linux/x86_64/${latestStoreOsVer}`
    );
    check(
      compatOk.compatible === true &&
        compatOk.updateAvailable === true &&
        compatOld.compatible === false &&
        compatOld.updateRequired === true &&
        tauriUpdateResp.status === 200 &&
        tauriUpToDateResp.status === 204,
      '3. Endpoint de compatibilidade semver e auto-updater Tauri 2 respondem corretamente (200 update vs 204 current)'
    );

    // ------------------------------------------------------------------
    // 2. Seed Tenant A & Tenant B + Real Users for SSE & Security Checks
    // ------------------------------------------------------------------
    const tenantA = 'tnt_homolog_a';
    const tenantB = 'tnt_homolog_b';
    const storeA = 'str_homolog_a';
    const storeB = 'str_homolog_b';
    const productA = 'prd_homolog_combo';
    const tableA = 'tbl_homolog_01';

    await db.collection('tenants').doc('tenant-1').set({ id: 'tenant-1', name: '3C Platform', status: 'ACTIVE' });
    await db.collection('tenants').doc(tenantA).set({ id: tenantA, name: 'Homolog Tenant A', status: 'ACTIVE' });
    await db.collection('tenants').doc(tenantB).set({ id: tenantB, name: 'Homolog Tenant B', status: 'ACTIVE' });

    const ownerAUser = {
      uid: 'usr_hom_owner_a',
      email: 'owner.a@homolog.local',
      name: 'Store Owner A',
      role: 'STORE_OWNER',
      tenantId: tenantA,
      storeId: storeA,
      status: 'ACTIVE',
    };
    const waiterAUser = {
      uid: 'usr_hom_waiter_a',
      email: 'waiter.a@homolog.local',
      name: 'Garçom A',
      role: 'WAITER',
      tenantId: tenantA,
      storeId: storeA,
      status: 'ACTIVE',
    };
    const driverAUser = {
      uid: 'usr_hom_driver_a',
      email: 'driver.a@homolog.local',
      name: 'Entregador A',
      role: 'COURIER',
      tenantId: tenantA,
      status: 'ACTIVE',
    };
    const consumerUser = {
      uid: 'usr_hom_consumer',
      email: 'consumer@homolog.local',
      name: 'Consumidor Android',
      role: 'CONSUMER',
      tenantId: 'tenant-1',
      status: 'ACTIVE',
    };
    const ownerBUser = {
      uid: 'usr_hom_owner_b',
      email: 'owner.b@homolog.local',
      name: 'Store Owner B',
      role: 'STORE_OWNER',
      tenantId: tenantB,
      storeId: storeB,
      status: 'ACTIVE',
    };
    for (const u of [ownerAUser, waiterAUser, driverAUser, consumerUser, ownerBUser]) {
      await db.collection('users').doc(u.uid).set(u);
    }

    const ownerAToken = auth.generateDevToken({
      uid: 'usr_hom_owner_a',
      email: 'owner.a@homolog.local',
      email_verified: true,
      name: 'Store Owner A',
      role: 'STORE_OWNER',
      tenantId: tenantA,
      storeId: storeA,
    });
    const waiterAToken = auth.generateDevToken({
      uid: 'usr_hom_waiter_a',
      email: 'waiter.a@homolog.local',
      email_verified: true,
      name: 'Garçom A',
      role: 'WAITER',
      tenantId: tenantA,
      storeId: storeA,
    });
    const driverAToken = auth.generateDevToken({
      uid: 'usr_hom_driver_a',
      email: 'driver.a@homolog.local',
      email_verified: true,
      name: 'Entregador A',
      role: 'COURIER',
      tenantId: tenantA,
    });
    const consumerToken = auth.generateDevToken({
      uid: 'usr_hom_consumer',
      email: 'consumer@homolog.local',
      email_verified: true,
      name: 'Consumidor Android',
      role: 'CONSUMER',
      tenantId: 'tenant-1',
    });
    const ownerBToken = auth.generateDevToken({
      uid: 'usr_hom_owner_b',
      email: 'owner.b@homolog.local',
      email_verified: true,
      name: 'Store Owner B',
      role: 'STORE_OWNER',
      tenantId: tenantB,
      storeId: storeB,
    });

    const storeADoc = {
      id: storeA,
      tenantId: tenantA,
      name: 'Bistrô Homolog A',
      category: 'RESTAURANT',
      deliveryFee: 8,
      isOpen: true,
    };
    const storeBDoc = {
      id: storeB,
      tenantId: tenantB,
      name: 'Loja Isolada B',
      category: 'RETAIL',
      deliveryFee: 10,
      isOpen: true,
    };
    const menuA = {
      id: productA,
      tenantId: tenantA,
      storeId: storeA,
      name: 'Combo Executivo',
      price: 45,
      stock: 10,
      isAvailable: true,
    };
    const tableADoc = {
      id: tableA,
      tenantId: tenantA,
      storeId: storeA,
      tableNumber: 1,
      capacity: 4,
      status: 'AVAILABLE',
    };

    await db.collection('stores').doc(storeA).set(storeADoc);
    await db.collection('stores').doc(storeB).set(storeBDoc);
    await db.collection('menu_items').doc(productA).set(menuA);
    await db.collection('tables').doc(tableA).set(tableADoc);

    // Connect live SSE streams for Tenant A and Tenant B using single-use SSE tickets
    const [ticketARes, ticketBRes]: any[] = await Promise.all([
      fetch(`${cloudBaseUrl}/api/v1/sse/ticket`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerAToken}` },
      }).then((r) => r.json()),
      fetch(`${cloudBaseUrl}/api/v1/sse/ticket`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerBToken}` },
      }).then((r) => r.json()),
    ]);
    sseClientA = await openSseCapture(`${cloudBaseUrl}/api/v1/sse/stream?ticket=${encodeURIComponent(ticketARes.ticket)}`);
    sseClientB = await openSseCapture(`${cloudBaseUrl}/api/v1/sse/stream?ticket=${encodeURIComponent(ticketBRes.ticket)}`);
    await Promise.all([sseClientA.ready, sseClientB.ready]);

    // Boot Tenant A and Tenant B Edge Nodes
    edgeA = new EdgeNodeRuntime({
      storeId: storeA,
      tenantId: tenantA,
      dbPath: sqliteTenantA,
      port: 0,
      cloudBaseUrl,
    });
    await edgeA.seedFromCloudSnapshot({ store: storeADoc, menuItems: [menuA], tables: [tableADoc], users: [ownerAUser, waiterAUser, driverAUser] });
    const edgeAPort = await edgeA.listen(0);
    const edgeABaseUrl = `http://127.0.0.1:${edgeAPort}`;
    await edgeA.registerWithCloud(cloudBaseUrl, ownerAToken, 'edge-homolog-a');

    edgeB = new EdgeNodeRuntime({
      storeId: storeB,
      tenantId: tenantB,
      dbPath: sqliteTenantB,
      port: 0,
      cloudBaseUrl,
    });
    await edgeB.seedFromCloudSnapshot({ store: storeBDoc, menuItems: [], tables: [], users: [ownerBUser] });
    await edgeB.listen(0);
    await edgeB.registerWithCloud(cloudBaseUrl, ownerBToken, 'edge-homolog-b');

    // ------------------------------------------------------------------
    // 3. Multi-Client Concurrent Simulation (Edge Offline + Cloud Online)
    // ------------------------------------------------------------------
    // (a) Store OS Tauri 2 sells 2 offline on Edge
    const posResp = await fetch(`${edgeABaseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerAToken}`,
        'Idempotency-Key': generateIdempotencyKey(),
        'X-3C-App-Id': 'store-os',
        'X-3C-Platform': 'tauri-linux',
      },
      body: JSON.stringify({
        storeId: storeA,
        channel: 'POS',
        deliveryModality: 'PICKUP',
        customerName: 'Cliente Balcão Tauri',
        items: [{ menuItemId: productA, quantity: 2 }],
      }),
    });

    // (b) Waiter Android marks table OCCUPIED on Edge LAN
    const waiterResp = await fetch(`${edgeABaseUrl}/api/v1/store/tables/${tableA}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${waiterAToken}`,
        'X-3C-App-Id': 'waiter',
        'X-3C-Platform': 'capacitor-android',
      },
      body: JSON.stringify({ status: 'OCCUPIED' }),
    });
    check(posResp.status === 201 && waiterResp.status === 200, '4. Store OS (Tauri 2) e Waiter (Android LAN) operam offline sobre 3C Edge Node');

    // (c) Marketplace Android places concurrent order (qty 1) on Cloud
    const mktOrderResp = await fetch(`${cloudBaseUrl}/api/v1/commerce/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${consumerToken}`,
        'Idempotency-Key': generateIdempotencyKey(),
        'X-3C-App-Id': 'marketplace',
        'X-3C-Platform': 'capacitor-android',
      },
      body: JSON.stringify({
        storeId: storeA,
        channel: 'MARKETPLACE',
        deliveryModality: 'DELIVERY',
        customerName: 'Consumidor Android',
        deliveryAddress: 'Av. Paulista, 1000',
        items: [{ menuItemId: productA, quantity: 1 }],
      }),
    });
    const mktOrderJson = await mktOrderResp.json();
    const cloudOrderId = mktOrderJson.transaction?.orderId;

    const cloudOrderPin = mktOrderJson.transaction?.deliveryPin;

    // (d) Advance Marketplace order FSM across Store OS + Driver Android up to DELIVERED
    const transitions = [
      { status: 'CONFIRMED', token: ownerAToken, appId: 'store-os', platform: 'tauri-linux' },
      { status: 'IN_PREPARATION', token: ownerAToken, appId: 'store-os', platform: 'tauri-linux' },
      { status: 'READY_FOR_PICKUP', token: ownerAToken, appId: 'store-os', platform: 'tauri-linux' },
      { status: 'OUT_FOR_DELIVERY', token: driverAToken, appId: 'driver', platform: 'capacitor-android' },
      { status: 'DELIVERED', token: driverAToken, appId: 'driver', platform: 'capacitor-android', deliveryPin: cloudOrderPin },
    ];
    let fsmAllOk = mktOrderResp.status === 201 && Boolean(cloudOrderId);
    for (const step of transitions) {
      const r = await fetch(`${cloudBaseUrl}/api/v1/commerce/orders/${cloudOrderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${step.token}`,
          'X-3C-App-Id': step.appId,
          'X-3C-Platform': step.platform,
        },
        body: JSON.stringify({
          status: step.status,
          ...(step.deliveryPin ? { deliveryPin: step.deliveryPin } : {}),
        }),
      });
      if (r.status !== 200) fsmAllOk = false;
    }

    const invalidRevertResp = await fetch(`${cloudBaseUrl}/api/v1/commerce/orders/${cloudOrderId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerAToken}`,
      },
      body: JSON.stringify({ status: 'PENDING' }),
    });

    check(
      fsmAllOk && invalidRevertResp.status === 400,
      '5. Marketplace (Android) -> Store OS (KDS) -> Driver (Android) completam FSM do pedido e bloqueiam regressão pós-DELIVERED'
    );

    // ------------------------------------------------------------------
    // 4. Cross-Tenant Security & SSE Multitenant Isolation
    // ------------------------------------------------------------------
    await new Promise((r) => setTimeout(r, 150));
    const sseAOrderEvents = sseClientA.events.filter((e) => e.type === 'ORDER_COMMITTED' || e.type === 'ORDER_STATUS_CHANGED');
    const sseBLeakedEvents = sseClientB.events.filter((e) => e.type === 'ORDER_COMMITTED' || e.type === 'ORDER_STATUS_CHANGED');

    const crossTenantPush = await fetch(`${cloudBaseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerBToken}`,
      },
      body: JSON.stringify({
        nodeId: edgeB.nodeId,
        storeId: storeA,
        mutations: [],
      }),
    });
    const crossTenantOrderRead = await fetch(`${cloudBaseUrl}/api/v1/commerce/orders/${cloudOrderId}`, {
      headers: { Authorization: `Bearer ${ownerBToken}` },
    });

    check(
      sseAOrderEvents.length >= 2 &&
        sseBLeakedEvents.length === 0 &&
        crossTenantPush.status === 403 &&
        crossTenantOrderRead.status === 403,
      '6. Isolamento multitenant estrito em SSE live stream, Sync Push e leitura de pedidos cross-tenant (HTTP 403)'
    );

    // ------------------------------------------------------------------
    // 5. Bidirectional Sync & Intentional Conflict Homologation
    // ------------------------------------------------------------------
    const syncRes = await edgeA.syncWithCloud(cloudBaseUrl, ownerAToken);
    const cloudFinalItem = (await db.collection('menu_items').doc(productA).get()).data();
    const edgeFinalItem = await edgeA.driver.getDoc<any>('menu_items', productA);
    const cloudFinalTable = (await db.collection('tables').doc(tableA).get()).data();

    check(
      syncRes.pushedAccepted === 4 &&
        cloudFinalItem?.stock === 7 &&
        edgeFinalItem?.stock === 7 &&
        cloudFinalTable?.status === 'OCCUPIED',
      `7. Convergência pós-WAN Cloud <-> Edge garante saldo 7 (Cloud=${cloudFinalItem?.stock}, Edge=${edgeFinalItem?.stock}) e mesa OCCUPIED`
    );

    // Intentional Conflict 1: Terminal Order State protection
    // Intentional Conflict 2: Stale HLC rejection on Table
    const conflictBatchIdem = generateIdempotencyKey();
    const staleHlcIdem = generateIdempotencyKey();
    const conflictResp = await fetch(`${cloudBaseUrl}/api/v1/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerAToken}`,
        'Idempotency-Key': generateIdempotencyKey(),
      },
      body: JSON.stringify({
        nodeId: edgeA.nodeId,
        storeId: storeA,
        mutations: [
          {
            idempotencyKey: conflictBatchIdem,
            entity: 'orders',
            entityId: cloudOrderId,
            operation: 'UPSERT',
            hlc: `${Date.now()}-0001-stale_client`,
            payload: { id: cloudOrderId, status: 'IN_PREPARATION' },
          },
          {
            idempotencyKey: staleHlcIdem,
            entity: 'tables',
            entityId: tableA,
            operation: 'UPSERT',
            hlc: '0000000000001-0000-old_tablet',
            payload: { id: tableA, status: 'AVAILABLE' },
          },
        ],
      }),
    });
    const conflictJson = await conflictResp.json();
    const hasTerminalConflict = conflictJson.conflicts?.some(
      (c: any) => c.entityId === cloudOrderId && c.reason === 'TERMINAL_ORDER_STATE'
    );
    const hasStaleHlcConflict = conflictJson.conflicts?.some(
      (c: any) => c.entityId === tableA && c.reason === 'STALE_HLC'
    );

    check(
      conflictResp.status === 200 && Boolean(hasTerminalConflict) && Boolean(hasStaleHlcConflict),
      '8. Conflitos intencionais (TERMINAL_ORDER_STATE em pedido DELIVERED e STALE_HLC em mesa) detectados e preservados na Cloud',
      JSON.stringify(conflictJson.conflicts)
    );
  } finally {
    sseClientA?.close();
    sseClientB?.close();
    if (edgeA) await edgeA.close().catch(() => {});
    if (edgeB) await edgeB.close().catch(() => {});
    cloudServer.closeAllConnections?.();
    await new Promise<void>((resolve) => cloudServer.close(() => resolve()));
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log(`\nResultado Homologação Global Fase 6 & 7: ${passed} aprovados, ${failed} falhas.`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
