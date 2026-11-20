import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import {
  ClientContractContext,
  PLATFORM_CONTRACT_MANIFEST,
} from '@3c/contracts';

export type { ClientContractContext };
export { PLATFORM_CONTRACT_MANIFEST };

interface CachedIdempotentResponse {
  statusCode: number;
  body: any;
  createdAtMs: number;
}

const IDEMPOTENCY_TTL_MS = 1000 * 60 * 15; // 15 minutes
const MAX_IDEMPOTENCY_ENTRIES = 2000;
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const idempotencyCache = new Map<string, CachedIdempotentResponse>();
const inFlightIdempotencyKeys = new Set<string>();

/**
 * Extracts versioned multiplatform headers defined by RFC-001.
 */
export function attachContractContext(req: Request, _res: Response, next: NextFunction) {
  const rawIdemKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  const ctx: ClientContractContext = {
    contractVersion: String(req.headers['x-3c-contract-version'] || '1.0'),
    appId: String(req.headers['x-3c-app-id'] || 'unified-portal'),
    platform: String(req.headers['x-3c-platform'] || 'web'),
    appVersion: String(req.headers['x-3c-app-version'] || '5.2.1'),
    idempotencyKey: rawIdemKey ? String(rawIdemKey) : undefined,
  };
  (req as any).clientContext = ctx;
  next();
}

/**
 * Prevents duplicate mutations when Edge Node or offline mobile clients retry with the same Idempotency-Key.
 */
export function idempotencyGuard(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  if (!rawKey || typeof rawKey !== 'string') {
    return next();
  }
  const normalizedKey = rawKey.trim();
  if (!normalizedKey) {
    return next();
  }

  const now = Date.now();
  // Prune expired or overflowing entries (bounded LRU)
  if (idempotencyCache.size >= MAX_IDEMPOTENCY_ENTRIES) {
    for (const [k, v] of idempotencyCache.entries()) {
      if (now - v.createdAtMs > IDEMPOTENCY_TTL_MS) {
        idempotencyCache.delete(k);
      }
    }
    while (idempotencyCache.size >= MAX_IDEMPOTENCY_ENTRIES) {
      const oldestKey = idempotencyCache.keys().next().value;
      if (!oldestKey) break;
      idempotencyCache.delete(oldestKey);
    }
  }

  const authRaw = typeof req.headers.authorization === 'string' ? req.headers.authorization : 'anon';
  const callerScope = crypto.createHash('sha256').update(authRaw).digest('hex').slice(0, 16);
  const scopedKey = `${req.method.toUpperCase()}:${req.originalUrl}:${callerScope}:${normalizedKey}`;
  const cached = idempotencyCache.get(scopedKey);
  if (cached && now - cached.createdAtMs <= IDEMPOTENCY_TTL_MS) {
    res.setHeader('X-3C-Idempotent-Replay', 'true');
    const replayBody =
      cached.body && typeof cached.body === 'object' && !Array.isArray(cached.body)
        ? { ...cached.body, deduplicated: true }
        : cached.body;
    return res.status(cached.statusCode).json(replayBody);
  }

  if (inFlightIdempotencyKeys.has(scopedKey)) {
    return res.status(409).json({
      error: 'Requisição idêntica já está em processamento. Aguarde a conclusão.',
      inFlight: true,
    });
  }

  inFlightIdempotencyKeys.add(scopedKey);
  const releaseLock = () => {
    inFlightIdempotencyKeys.delete(scopedKey);
  };
  res.once('finish', releaseLock);
  res.once('close', releaseLock);

  const originalJson = res.json.bind(res);
  res.json = ((body: any) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyCache.delete(scopedKey);
      idempotencyCache.set(scopedKey, {
        statusCode: res.statusCode,
        body,
        createdAtMs: Date.now(),
      });
    }
    return originalJson(body);
  }) as any;

  next();
}

