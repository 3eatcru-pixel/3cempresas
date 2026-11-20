import express from 'express';
import { clusterState, sseClients } from './state.ts';
import { db, getRuntimePersistenceCapabilities, runWithSystemDbContext } from './config.ts';
import { attachContractContext, idempotencyGuard } from './middleware/contracts.ts';
import { httpCompressionMiddleware } from './middleware/compression.ts';

import aiRoutes from './routes/ai.ts';
import commerceRoutes from './routes/commerce.ts';
import storeRoutes from './routes/store.ts';
import adminRoutes from './routes/admin.ts';
import authRoutes from './routes/auth.ts';
import genericRoutes from './routes/generic.ts';
import sseRoutes from './routes/sse.ts';
import syncRoutes from './routes/sync.ts';
import systemRoutes from './routes/system.ts';
import storageRoutes from './routes/storage.ts';
import mapsRoutes from './routes/maps.ts';
import supabaseRoutes from './routes/supabase.ts';

import {
  RateLimitEntry,
  recordHttpTelemetry,
  registerRateLimiter,
} from './telemetry.ts';

export const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
  'https://3ccorp.ai.studio',
  'https://3cruempresas.cloud.run',
  'https://app-3ccorp-164281225843.us-west1.run.app',
  'https://app-3ccorp-2aj4z66sma-uw.a.run.app',
  'https://ais-dev-emgp6shecr4sdojoqobhpa-294047880193.us-west2.run.app',
  'https://ais-pre-emgp6shecr4sdojoqobhpa-294047880193.us-west2.run.app',
];

const MAX_RATE_LIMIT_KEYS = 10_000;

export function createSlidingWindowRateLimiter(
  windowMs: number,
  maxRequests: number,
  limiterName?: string
) {
  const hits = new Map<string, RateLimitEntry>();
  if (limiterName) {
    registerRateLimiter(limiterName, windowMs, maxRequests, hits);
  }
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
    const ip = String(rawIp).replace(/^::ffff:/, '') || 'unknown';
    const now = Date.now();
    if (hits.size >= MAX_RATE_LIMIT_KEYS && !hits.has(ip)) {
      for (const [k, v] of hits.entries()) {
        if (v.resetAt <= now) hits.delete(k);
      }
      while (hits.size >= MAX_RATE_LIMIT_KEYS) {
        const oldestKey = hits.keys().next().value;
        if (!oldestKey) break;
        hits.delete(oldestKey);
      }
    }
    const entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      if (entry) hits.delete(ip);
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - 1)));
      return next();
    }
    entry.count += 1;
    // Refresh insertion order for bounded LRU eviction under sustained burst
    hits.delete(ip);
    hits.set(ip, entry);
    const remaining = Math.max(0, maxRequests - entry.count);
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    if (entry.count > maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: 'Muitas requisições neste endereço. Aguarde alguns instantes e tente novamente.',
      });
    }
    return next();
  };
}

export function createServerCoreApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  const trustProxyEnv = process.env.TRUST_PROXY;
  if (
    trustProxyEnv === 'true' ||
    (trustProxyEnv !== 'false' && (Boolean(process.env.K_SERVICE) || process.env.NODE_ENV === 'production'))
  ) {
    app.set('trust proxy', 1);
  }
  app.use((req, res, next) => {
    const startNs = process.hrtime.bigint();
    res.on('finish', () => {
      const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
      const appId = (req.headers['x-3c-app-id'] || req.headers['x-client-app']) as string | undefined;
      const platform = (req.headers['x-3c-platform'] || req.headers['x-client-platform']) as string | undefined;
      const appVersion = (req.headers['x-3c-app-version'] || req.headers['x-client-version']) as string | undefined;
      recordHttpTelemetry({
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: elapsedMs,
        appId: appId ? String(appId).trim() : undefined,
        platform: platform ? String(platform).trim() : undefined,
        appVersion: appVersion ? String(appVersion).trim() : undefined,
      });
    });
    next();
  });
  app.use(['/api/v1/admin/restore', '/api/admin/restore', '/api/v1/admin/diagnostics/restore-preview', '/api/admin/diagnostics/restore-preview'], express.json({ limit: '25mb' }));
  app.use('/api/v1/storage/objects', express.json({ limit: '4mb' }));
  app.use(express.json({ limit: '2mb' }));
  app.use(httpCompressionMiddleware);
  app.use(attachContractContext);

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.path.startsWith('/api')) {
      res.setHeader('X-Frame-Options', 'DENY');
    }
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
    next();
  });

  // Strict CORS allowlist (exact origins only; no wildcard suffix matches) + HQ runtimePolicy overrides
  const envOrigins = [
    ...(process.env.ALLOWED_ORIGINS || '').split(','),
    ...(process.env.APP_URL ? [process.env.APP_URL] : []),
    ...(process.env.CLOUD_BASE_URL ? [process.env.CLOUD_BASE_URL] : []),
  ]
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const allowedOrigins = new Set([...DEFAULT_ALLOWED_ORIGINS, ...envOrigins]);
  let dynamicCorsCache: { expiresAt: number; origins: Set<string> } = {
    expiresAt: 0,
    origins: new Set<string>(),
  };

  const getRuntimeCorsOrigins = async (): Promise<Set<string>> => {
    const now = Date.now();
    if (dynamicCorsCache.expiresAt > now) {
      return dynamicCorsCache.origins;
    }
    try {
      const govSnap = await runWithSystemDbContext('CORS_ORIGINS_CHECK', () =>
        db.collection('governance').doc('governance').get()
      );
      const extra = Array.isArray(govSnap.data()?.runtimePolicy?.extraAllowedOrigins)
        ? (govSnap.data()!.runtimePolicy.extraAllowedOrigins as string[])
        : [];
      const set = new Set(extra.map((o) => String(o || '').trim().replace(/\/+$/, '')).filter(Boolean));
      dynamicCorsCache = { expiresAt: now + 15_000, origins: set };
      return set;
    } catch {
      dynamicCorsCache = { expiresAt: now + 15_000, origins: new Set<string>() };
      return dynamicCorsCache.origins;
    }
  };

  app.use(async (req, res, next) => {
    const origin = req.headers.origin;
    let isAllowed = Boolean(origin && allowedOrigins.has(origin));
    if (!isAllowed && origin) {
      const runtimeOrigins = await getRuntimeCorsOrigins();
      isAllowed = runtimeOrigins.has(origin);
    }
    if (origin && isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Range, If-None-Match, X-Device-Token, X-3C-Contract-Version, X-3C-App-Id, X-3C-Platform, X-3C-App-Version, Idempotency-Key, X-Client-App, X-Client-Version, X-Client-Platform, X-Contract-Version, X-Idempotency-Key'
    );
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Range, Content-Length, Accept-Ranges, ETag, X-Total-Count, X-Limit, X-Offset, X-Has-More, X-Next-Cursor'
    );
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    return next();
  });

  const authRateLimiter = createSlidingWindowRateLimiter(60_000, 60, 'auth');
  const aiRateLimiter = createSlidingWindowRateLimiter(60_000, 30, 'ai');
  const adminRateLimiter = createSlidingWindowRateLimiter(60_000, 120, 'admin');
  const devicePairingRateLimiter = createSlidingWindowRateLimiter(60_000, 20, 'device-pairing');
  const mapsRateLimiter = createSlidingWindowRateLimiter(60_000, 180, 'maps');

  // Cloud Run / Kubernetes standard liveness & readiness probes
  app.get('/healthz', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: '3c-cloud-hub',
      region: process.env.CLOUD_REGION || 'local',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/readyz', (_req, res) => {
    const caps = getRuntimePersistenceCapabilities();
    if (caps.sandboxModeBlockedInProduction) {
      return res.status(503).json({
        ready: false,
        reason: 'SANDBOX_BLOCKED_IN_PRODUCTION',
        persistenceDriver: caps.persistenceDriver,
        persistenceMode: caps.persistenceMode,
        cloudProbeVerified: caps.cloudProbeVerified,
        cloudProbeError: caps.cloudProbeError,
      });
    }
    return res.status(200).json({
      ready: true,
      service: '3c-cloud-hub',
      region: process.env.CLOUD_REGION || 'local',
      persistenceDriver: caps.persistenceDriver,
      persistenceMode: caps.persistenceMode,
      productionDatabaseReady: caps.productionDatabaseReady,
      cloudProbeVerified: caps.cloudProbeVerified,
    });
  });

  // Guard: Prevent accidental Cloud operation in NODE_ENV=production over unverified local sandbox persistence across all API endpoints (v1 and legacy admin)
  app.use(['/api/v1', '/api/admin', '/api'], (req, res, next) => {
    const currentPath = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
    if (
      req.path === '/health' ||
      req.path.startsWith('/health') ||
      req.path.startsWith('/system') ||
      currentPath === '/api/v1/health' ||
      currentPath.startsWith('/api/v1/system') ||
      currentPath.startsWith('/api/system')
    ) {
      return next();
    }
    const caps = getRuntimePersistenceCapabilities();
    if (caps.sandboxModeBlockedInProduction) {
      return res.status(503).json({
        error: 'Operação bloqueada em produção: banco Cloud primário (PostgreSQL) não configurado. Configure o driver Cloud ou defina ALLOW_SANDBOX_IN_PRODUCTION=true explicitamente.',
        persistenceDriver: caps.persistenceDriver,
        persistenceMode: caps.persistenceMode,
      });
    }
    return next();
  });

  // 1. Health Check, Contract Manifest & 3C Release Manager (Public)
  let healthMetricsCache: {
    revKey: string;
    expiresAt: number;
    activeTenants: number;
    activeStores: number;
    totalOrdersProcessed: number;
  } | null = null;

  app.get('/api/v1/health', async (_req, res) => {
    const uptimeSec = Math.floor((Date.now() - clusterState.uptimeStart) / 1000);
    const mem = process.memoryUsage();
    const caps = getRuntimePersistenceCapabilities();
    const revs = db.getRevisions();
    const revKey = `${revs.collections.stores || 1}:${revs.collections.orders || 1}:${caps.persistenceDriver}`;
    const now = Date.now();

    let activeTenants = 0;
    let activeStores = 0;
    let totalOrdersProcessed = 0;

    if (healthMetricsCache && healthMetricsCache.revKey === revKey && healthMetricsCache.expiresAt > now) {
      activeTenants = healthMetricsCache.activeTenants;
      activeStores = healthMetricsCache.activeStores;
      totalOrdersProcessed = healthMetricsCache.totalOrdersProcessed;
    } else {
      try {
        await runWithSystemDbContext('PUBLIC_HEALTH_METRICS', async () => {
          const [storesSnap, ordersCount] = await Promise.all([
            db.collection('stores').get(),
            db.getCollectionSizeAsync('orders'),
          ]);
          const tenantIds = new Set<string>();
          for (const d of storesSnap.docs) {
            const tenantId = String(d.data()?.tenantId || '');
            if (tenantId) tenantIds.add(tenantId);
          }
          activeTenants = tenantIds.size;
          activeStores = storesSnap.docs.length;
          totalOrdersProcessed = ordersCount;
        });
        healthMetricsCache = {
          revKey,
          expiresAt: now + 10_000,
          activeTenants,
          activeStores,
          totalOrdersProcessed,
        };
      } catch {
        activeTenants = 0;
        activeStores = 0;
        totalOrdersProcessed = 0;
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=5');
    res.json({
      status: clusterState.systemStatus,
      service: '3c-cloud-hub',
      region: process.env.CLOUD_REGION || 'local',
      uptimeSeconds: uptimeSec,
      activeTenants,
      activeStores,
      totalOrdersProcessed,
      cpuUsage: `${(process.cpuUsage().user / 1000000).toFixed(1)}%`,
      memoryUsage: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`,
      activeConnections: sseClients.length,
      persistenceDriver: caps.persistenceDriver,
      persistenceMode: caps.persistenceMode,
      productionDatabaseReady: caps.productionDatabaseReady,
      cloudProbeVerified: caps.cloudProbeVerified,
      cloudProbeLastCheckedAt: caps.cloudProbeLastCheckedAt,
      cloudProbeError: caps.cloudProbeError,
      sandboxModeBlockedInProduction: caps.sandboxModeBlockedInProduction,
      environmentMode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      timestamp: new Date().toISOString()
    });
  });

  app.use('/api/v1/system', systemRoutes);

  // 2. Domain Routes
  app.use('/api/gemini', aiRateLimiter);
  app.use('/api', aiRoutes);
  app.use('/api/v1/auth', authRateLimiter, authRoutes);
  app.use('/api/v1/commerce', idempotencyGuard, commerceRoutes);
  app.use('/api/v1/store/devices/pair-login', devicePairingRateLimiter);
  app.use('/api/v1/store/devices/:id/pair', devicePairingRateLimiter);
  app.use('/api/v1/store/waiter-pairing/login', devicePairingRateLimiter);
  app.use('/api/v1/store', idempotencyGuard, storeRoutes);
  app.use('/api/v1/admin/devices/:id/pair', devicePairingRateLimiter);
  app.use('/api/admin/devices/:id/pair', devicePairingRateLimiter);
  app.use('/api/v1/admin', adminRateLimiter, adminRoutes);
  app.use('/api/admin', adminRateLimiter, adminRoutes);
  app.use('/api/v1/generic', genericRoutes);
  app.use('/api/v1/sse', sseRoutes);
  app.use('/api/v1/sync', idempotencyGuard, syncRoutes);
  app.use('/api/v1/storage', storageRoutes);
  app.use('/api/v1/maps', mapsRateLimiter, mapsRoutes);
  app.use('/api/v1/supabase', adminRateLimiter, supabaseRoutes);

  return app;
}
