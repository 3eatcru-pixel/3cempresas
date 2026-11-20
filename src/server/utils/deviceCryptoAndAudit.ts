import crypto from 'crypto';
import express from 'express';
import { db } from '../config.ts';
import { AuthenticatedRequestUser } from '../middleware/auth.ts';
import { generateEventId } from '../../utils/idGenerator.ts';

export const PAIRING_CODE_TTL_MS = 15 * 60 * 1000;
export const PAIRING_MAX_ATTEMPTS = 5;
export const PAIRING_LOCKOUT_MS = 15 * 60 * 1000;

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function generateSecurePairingCode(): string {
  return `3C-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

export function sanitizeDeviceForResponse(dev: any): any {
  if (!dev || typeof dev !== 'object') return dev;
  const {
    deviceToken: _dt,
    deviceTokenHash: _dth,
    pairingCodeHash: _pch,
    ...safe
  } = dev;
  if (safe.paired === true || safe.pairingCodeUsed === true) {
    safe.pairingCode = null;
  }
  return safe;
}

export function resolveDefaultDevicesForPlan(plan?: string): number {
  switch (String(plan || 'FREE').toUpperCase()) {
    case 'FREE':
      return 2;
    case 'PROMO':
      return 3;
    case 'BASIC':
      return 5;
    case 'PRO':
      return 15;
    case 'ENTERPRISE':
      return 999;
    default:
      return 2;
  }
}

export async function recordDeviceAuditEvent(
  type: string,
  payload: string,
  channel: string,
  tenantId = 'tenant-1',
  options: {
    req?: express.Request;
    actor?: AuthenticatedRequestUser | null;
    resourceId?: string;
    after?: any;
    result?: string;
    critical?: boolean;
  } = {}
): Promise<void> {
  const id = generateEventId();
  const nowIso = new Date().toISOString();
  const callerIp = options.req?.ip?.replace(/^::ffff:/, '') || null;
  const requestId =
    (options.req?.headers['x-request-id'] as string) ||
    (options.req?.headers['idempotency-key'] as string) ||
    `req-${crypto.randomBytes(6).toString('hex')}`;

  const eventDoc: Record<string, any> = {
    id,
    type,
    payload,
    channel,
    tenantId,
    actorUid: options.actor?.uid || null,
    actorEmail: options.actor?.email || null,
    actorRole: options.actor?.role || null,
    sourceIp: callerIp,
    requestId,
    resourceType: 'device_licenses',
    resourceId: options.resourceId || null,
    beforeState: null,
    afterState: options.after ?? null,
    result: options.result || 'SUCCESS',
    immutable: true,
    timestamp: nowIso,
    timeStr: new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };

  try {
    await db.collection('events').doc(id).set(eventDoc);
  } catch (err: any) {
    console.error(`[Device Audit] Critical error persisting audit event ${type}:`, err?.message);
    if (options.critical !== false) {
      throw new Error(`Falha ao gravar trilha de auditoria obrigatória (${type}).`);
    }
  }
}

const FORBIDDEN_DEVICE_PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function stripDeviceProtoPollution(value: any): any {
  if (Array.isArray(value)) {
    return value.map(stripDeviceProtoPollution);
  }
  if (value && typeof value === 'object') {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_DEVICE_PROTO_KEYS.has(k)) continue;
      clean[k] = stripDeviceProtoPollution(v);
    }
    return clean;
  }
  return value;
}
