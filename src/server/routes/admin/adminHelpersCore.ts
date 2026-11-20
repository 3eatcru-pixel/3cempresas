import express from 'express';
import crypto from 'crypto';
import net from 'net';
import dns from 'dns/promises';
import { db } from '../../config.ts';
import { AuthenticatedRequestUser } from '../../middleware/auth.ts';
import { generateEventId } from '../../../utils/idGenerator.ts';
import { stripPrototypePollution, sanitizeStringList } from '../../utils/requestSanitizer.ts';

export { stripPrototypePollution, sanitizeStringList as sanitizeStringArray };

export const ROLE_LEVELS: Record<string, number> = {
  DEV_OWNER: 100,
  SUPER_ADMIN: 90,
  REGIONAL_MANAGER: 80,
  STORE_OWNER: 70,
  STORE_MANAGER: 60,
  CASHIER: 50,
  KITCHEN_STAFF: 40,
  WAITER: 30,
  COURIER: 20,
  CUSTOMER: 10,
  CONSUMER: 10,
  GUEST: 0,
};

export const STORE_SCOPED_ROLE_SET = new Set([
  'REGIONAL_MANAGER',
  'STORE_OWNER',
  'STORE_MANAGER',
  'CASHIER',
  'KITCHEN_STAFF',
  'WAITER',
  'COURIER',
]);

export const HQ_ONLY_ROLES = ['DEV_OWNER', 'SUPER_ADMIN'];
export const DEVICE_MANAGER_ROLES = ['DEV_OWNER', 'SUPER_ADMIN'];

export function isPrivateOrBlockedIp(ip: string): boolean {
  const normalized = ip.replace(/^::ffff:/i, '').trim();
  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(normalized)) {
    const lower = normalized.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) return true;
    return false;
  }
  return true;
}

export async function validateSafeExternalUrl(
  rawUrl: string
): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'URL de endpoint inválida.' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: `Esquema '${parsed.protocol}' não permitido para probes externos.` };
  }
  const hostname = parsed.hostname.toLowerCase().trim();
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal'
  ) {
    return { ok: false, reason: `Host '${hostname}' bloqueado por política anti-SSRF.` };
  }
  if (net.isIP(hostname) && isPrivateOrBlockedIp(hostname)) {
    return { ok: false, reason: `Endereço IP privado/reservado '${hostname}' bloqueado por política anti-SSRF.` };
  }
  try {
    const resolved = await dns.lookup(hostname, { all: true });
    if (!resolved.length || resolved.some((r) => isPrivateOrBlockedIp(r.address))) {
      return { ok: false, reason: `Resolução DNS de '${hostname}' aponta para rede privada/bloqueada (anti-SSRF).` };
    }
  } catch {
    return { ok: false, reason: `Falha ao resolver DNS externo para '${hostname}'.` };
  }
  return { ok: true, url: parsed };
}

export function normalizeUserRole(role?: string): string {
  const upper = String(role || 'CUSTOMER').trim().toUpperCase();
  if (upper === 'CONSUMER') return 'CUSTOMER';
  if (upper === 'DRIVER') return 'COURIER';
  return upper;
}

export function isMarketplaceConsumerRole(role?: string): boolean {
  const upper = String(role || '').trim().toUpperCase();
  return upper === 'CUSTOMER' || upper === 'CONSUMER';
}

export interface AdminAuditOptions {
  req?: express.Request;
  actor?: AuthenticatedRequestUser | null;
  resourceType?: string;
  resourceId?: string;
  before?: any;
  after?: any;
  result?: string;
  critical?: boolean;
}

export async function recordAdminAuditEvent(
  type: string,
  payload: string,
  channel: string,
  tenantId = 'tenant-1',
  options: AdminAuditOptions = {}
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
    resourceType: options.resourceType || null,
    resourceId: options.resourceId || null,
    beforeState: options.before ?? null,
    afterState: options.after ?? null,
    result: options.result || 'SUCCESS',
    immutable: true,
    timestamp: nowIso,
    timeStr: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };

  try {
    await db.collection('events').doc(id).set(eventDoc);
  } catch (err: any) {
    console.error(`[Admin Audit] Critical error persisting audit event ${type}:`, err?.message);
    if (options.critical !== false) {
      throw new Error(`Falha ao gravar trilha de auditoria obrigatória (${type}).`);
    }
  }
}
