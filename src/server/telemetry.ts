import { sseClients } from './state.ts';

export type TelemetryDomain = 'auth' | 'commerce' | 'store' | 'admin' | 'sync' | 'system' | 'sse' | 'other';

interface LatencyBucket {
  count: number;
  err4xx: number;
  err5xx: number;
  totalMs: number;
  maxMs: number;
  samples: number[];
}

interface RouteBucket {
  method: string;
  route: string;
  domain: TelemetryDomain;
  count: number;
  errors: number;
  samples: number[];
  lastStatus: number;
  lastSeenAt: string;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RegisteredRateLimiter {
  name: string;
  windowMs: number;
  maxRequests: number;
  hits: Map<string, RateLimitEntry>;
}

interface ObservedClientKey {
  appId: string;
  platform: string;
  appVersion: string;
  requests: number;
  lastSeenAt: string;
}

const MAX_SAMPLES = 400;
const MAX_ROUTES = 250;
const MAX_RECENT_TIMESTAMPS = 20_000;
const domainBuckets = new Map<TelemetryDomain, LatencyBucket>();
const routeBuckets = new Map<string, RouteBucket>();
const rateLimiters = new Map<string, RegisteredRateLimiter>();
const observedClients = new Map<string, ObservedClientKey>();
const recentRequestTimestamps: number[] = [];

let globalTotalRequests = 0;
let globalErrors4xx = 0;
let globalErrors5xx = 0;

function pushSample(arr: number[], value: number) {
  arr.push(value);
  if (arr.length > MAX_SAMPLES) {
    arr.shift();
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Number(sorted[idx].toFixed(1));
}

export function resolveTelemetryDomain(urlPath: string): TelemetryDomain {
  const clean = urlPath.split('?')[0] || '';
  if (clean.startsWith('/api/v1/auth')) return 'auth';
  if (clean.startsWith('/api/v1/commerce')) return 'commerce';
  if (clean.startsWith('/api/v1/store')) return 'store';
  if (clean.startsWith('/api/v1/admin') || clean.startsWith('/api/admin')) return 'admin';
  if (clean.startsWith('/api/v1/sync')) return 'sync';
  if (clean.startsWith('/api/v1/sse')) return 'sse';
  if (clean.startsWith('/api/v1/system') || clean === '/api/v1/health' || clean === '/healthz' || clean === '/readyz') {
    return 'system';
  }
  return 'other';
}

export function normalizeRoutePath(urlPath: string): string {
  const clean = (urlPath.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  return clean
    .replace(/\/[a-zA-Z0-9_-]*_[a-zA-Z0-9_-]{4,}/g, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{12,}/gi, '/:uuid')
    .replace(/\/\d{3,}/g, '/:num');
}

export function recordHttpTelemetry(params: {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  appId?: string;
  platform?: string;
  appVersion?: string;
}) {
  const now = Date.now();
  const domain = resolveTelemetryDomain(params.path);
  const route = normalizeRoutePath(params.path);
  const safeDuration = Number.isFinite(params.durationMs) ? Math.max(0, params.durationMs) : 0;

  globalTotalRequests += 1;
  if (params.statusCode >= 500) globalErrors5xx += 1;
  else if (params.statusCode >= 400) globalErrors4xx += 1;

  recentRequestTimestamps.push(now);
  const cutoff = now - 60_000;
  while (recentRequestTimestamps.length > 0 && recentRequestTimestamps[0] < cutoff) {
    recentRequestTimestamps.shift();
  }
  if (recentRequestTimestamps.length > MAX_RECENT_TIMESTAMPS) {
    recentRequestTimestamps.splice(0, recentRequestTimestamps.length - MAX_RECENT_TIMESTAMPS);
  }

  let dbucket = domainBuckets.get(domain);
  if (!dbucket) {
    dbucket = { count: 0, err4xx: 0, err5xx: 0, totalMs: 0, maxMs: 0, samples: [] };
    domainBuckets.set(domain, dbucket);
  }
  dbucket.count += 1;
  if (params.statusCode >= 500) dbucket.err5xx += 1;
  else if (params.statusCode >= 400) dbucket.err4xx += 1;
  dbucket.totalMs += safeDuration;
  if (safeDuration > dbucket.maxMs) dbucket.maxMs = safeDuration;
  pushSample(dbucket.samples, safeDuration);

  const routeKey = `${params.method.toUpperCase()} ${route}`;
  let rbucket = routeBuckets.get(routeKey);
  if (!rbucket) {
    if (routeBuckets.size >= MAX_ROUTES) {
      const oldestKey = routeBuckets.keys().next().value;
      if (oldestKey) routeBuckets.delete(oldestKey);
    }
    rbucket = {
      method: params.method.toUpperCase(),
      route,
      domain,
      count: 0,
      errors: 0,
      samples: [],
      lastStatus: params.statusCode,
      lastSeenAt: new Date(now).toISOString(),
    };
    routeBuckets.set(routeKey, rbucket);
  }
  rbucket.count += 1;
  if (params.statusCode >= 400) rbucket.errors += 1;
  rbucket.lastStatus = params.statusCode;
  rbucket.lastSeenAt = new Date(now).toISOString();
  pushSample(rbucket.samples, safeDuration);

  if (params.appId && params.appVersion) {
    const clientKey = `${params.appId}::${params.platform || 'unknown'}::${params.appVersion}`;
    const existing = observedClients.get(clientKey);
    if (existing) {
      existing.requests += 1;
      existing.lastSeenAt = new Date(now).toISOString();
    } else if (observedClients.size < 100) {
      observedClients.set(clientKey, {
        appId: params.appId,
        platform: params.platform || 'unknown',
        appVersion: params.appVersion,
        requests: 1,
        lastSeenAt: new Date(now).toISOString(),
      });
    }
  }
}

export function registerRateLimiter(
  name: string,
  windowMs: number,
  maxRequests: number,
  hits: Map<string, RateLimitEntry>
) {
  rateLimiters.set(name, { name, windowMs, maxRequests, hits });
}

export function listRateLimiterSnapshot() {
  const now = Date.now();
  const limiters: {
    name: string;
    windowMs: number;
    maxRequests: number;
    trackedKeys: number;
    blockedKeys: { ip: string; hits: number; remainingSeconds: number }[];
  }[] = [];

  for (const rl of rateLimiters.values()) {
    const blockedKeys: { ip: string; hits: number; remainingSeconds: number }[] = [];
    let trackedKeys = 0;
    for (const [ip, entry] of rl.hits.entries()) {
      if (entry.resetAt <= now) {
        rl.hits.delete(ip);
        continue;
      }
      trackedKeys += 1;
      if (entry.count > rl.maxRequests) {
        blockedKeys.push({
          ip,
          hits: entry.count,
          remainingSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
        });
      }
    }
    limiters.push({
      name: rl.name,
      windowMs: rl.windowMs,
      maxRequests: rl.maxRequests,
      trackedKeys,
      blockedKeys,
    });
  }
  return limiters;
}

export function unlockRateLimiterKey(limiterName?: string, ip?: string): number {
  let cleared = 0;
  for (const rl of rateLimiters.values()) {
    if (limiterName && rl.name !== limiterName) continue;
    if (ip) {
      if (rl.hits.delete(ip)) cleared += 1;
    } else {
      cleared += rl.hits.size;
      rl.hits.clear();
    }
  }
  return cleared;
}

export function listActiveSseSessions() {
  return sseClients.map((client, index) => ({
    index,
    uid: client.uid || 'anonymous',
    tenantId: client.tenantId,
    isDev: client.isDev,
    writableEnded: Boolean(client.response.writableEnded || client.response.destroyed),
  }));
}

export function disconnectSseSessions(filter: { index?: number; uid?: string; tenantId?: string }): number {
  let closed = 0;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const c = sseClients[i];
    const matchesIndex = typeof filter.index === 'number' && filter.index === i;
    const matchesUid = typeof filter.uid === 'string' && filter.uid.length > 0 && c.uid === filter.uid;
    const matchesTenant = typeof filter.tenantId === 'string' && filter.tenantId.length > 0 && c.tenantId === filter.tenantId;

    if (matchesIndex || matchesUid || matchesTenant) {
      try {
        if (!c.response.writableEnded && !c.response.destroyed) {
          c.response.end();
        }
      } catch {
        // ignore close error
      }
      sseClients.splice(i, 1);
      closed += 1;
    }
  }
  return closed;
}

export function getObservedClientsSnapshot(): ObservedClientKey[] {
  return Array.from(observedClients.values()).sort((a, b) =>
    b.lastSeenAt.localeCompare(a.lastSeenAt)
  );
}

export function getHttpGoldenSignalsSnapshot() {
  const now = Date.now();
  const cutoff = now - 60_000;
  while (recentRequestTimestamps.length > 0 && recentRequestTimestamps[0] < cutoff) {
    recentRequestTimestamps.shift();
  }

  const allSamples: number[] = [];
  const domains = Array.from(domainBuckets.entries())
    .map(([domain, b]) => {
      allSamples.push(...b.samples);
      const sorted = [...b.samples].sort((x, y) => x - y);
      return {
        domain,
        count: b.count,
        err4xx: b.err4xx,
        err5xx: b.err5xx,
        avgMs: b.count > 0 ? Number((b.totalMs / b.count).toFixed(1)) : 0,
        p50Ms: percentile(sorted, 50),
        p95Ms: percentile(sorted, 95),
        p99Ms: percentile(sorted, 99),
        maxMs: Number(b.maxMs.toFixed(1)),
      };
    })
    .sort((a, b) => b.count - a.count);

  const sortedAll = [...allSamples].sort((x, y) => x - y);

  const topRoutes = Array.from(routeBuckets.values())
    .map((r) => {
      const sorted = [...r.samples].sort((x, y) => x - y);
      return {
        method: r.method,
        route: r.route,
        domain: r.domain,
        count: r.count,
        errors: r.errors,
        p95Ms: percentile(sorted, 95),
        lastStatus: r.lastStatus,
        lastSeenAt: r.lastSeenAt,
      };
    })
    .sort((a, b) => b.p95Ms - a.p95Ms || b.count - a.count)
    .slice(0, 12);

  return {
    capturedAt: new Date(now).toISOString(),
    summary: {
      totalRequests: globalTotalRequests,
      rpm: recentRequestTimestamps.length,
      errors4xx: globalErrors4xx,
      errors5xx: globalErrors5xx,
      errorRatePercent:
        globalTotalRequests > 0
          ? Number((((globalErrors4xx + globalErrors5xx) / globalTotalRequests) * 100).toFixed(2))
          : 0,
      p50Ms: percentile(sortedAll, 50),
      p95Ms: percentile(sortedAll, 95),
      p99Ms: percentile(sortedAll, 99),
    },
    domains,
    topRoutes,
    rateLimits: listRateLimiterSnapshot(),
    sseSessions: listActiveSseSessions(),
  };
}
