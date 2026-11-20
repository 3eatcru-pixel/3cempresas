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
const idempotencyCache = new Map<string, CachedIdempotentResponse>();

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
  const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
  if (!rawKey || typeof rawKey !== 'string') {
    return next();
  }

  const now = Date.now();
  // Prune expired entries opportunistically
  if (idempotencyCache.size > 500) {
    for (const [k, v] of idempotencyCache.entries()) {
      if (now - v.createdAtMs > IDEMPOTENCY_TTL_MS) {
        idempotencyCache.delete(k);
      }
    }
  }

  const authRaw = typeof req.headers.authorization === 'string' ? req.headers.authorization : 'anon';
  const callerScope = crypto.createHash('sha256').update(authRaw).digest('hex').slice(0, 16);
  const scopedKey = `${req.method}:${req.originalUrl}:${callerScope}:${rawKey}`;
  const cached = idempotencyCache.get(scopedKey);
  if (cached && now - cached.createdAtMs <= IDEMPOTENCY_TTL_MS) {
    res.setHeader('X-3C-Idempotent-Replay', 'true');
    const replayBody =
      cached.body && typeof cached.body === 'object' && !Array.isArray(cached.body)
        ? { ...cached.body, deduplicated: true }
        : cached.body;
    return res.status(cached.statusCode).json(replayBody);
  }

  const originalJson = res.json.bind(res);
  res.json = ((body: any) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
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

