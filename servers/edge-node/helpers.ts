import crypto from 'crypto';

export const EDGE_STAFF_ROLES = [
  'DEV_OWNER',
  'SUPER_ADMIN',
  'REGIONAL_MANAGER',
  'STORE_OWNER',
  'STORE_MANAGER',
  'CASHIER',
  'KITCHEN_STAFF',
  'WAITER',
];

export const EDGE_POS_AND_TABLE_ROLES = [
  'DEV_OWNER',
  'SUPER_ADMIN',
  'REGIONAL_MANAGER',
  'STORE_OWNER',
  'STORE_MANAGER',
  'CASHIER',
  'WAITER',
];

const FORBIDDEN_EDGE_PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function stripEdgePrototypePollution(value: any): any {
  if (Array.isArray(value)) {
    return value.map(stripEdgePrototypePollution);
  }
  if (value && typeof value === 'object') {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_EDGE_PROTO_KEYS.has(k)) continue;
      clean[k] = stripEdgePrototypePollution(v);
    }
    return clean;
  }
  return value;
}

export function sanitizePublicEdgeMenuItem(item: any) {
  const copy = { ...item };
  delete copy.costPrice;
  delete copy.recipe;
  delete copy.supplierName;
  delete copy.supplierId;
  delete copy.internalNotes;
  return copy;
}

export function validateEdgeMenuNumericFields(payload: Record<string, any>): string | null {
  const fields: Array<{ key: string; label: string }> = [
    { key: 'price', label: 'Preço de venda' },
    { key: 'costPrice', label: 'Custo' },
    { key: 'stock', label: 'Estoque' },
    { key: 'minStockAlert', label: 'Alerta de estoque mínimo' },
  ];
  for (const { key, label } of fields) {
    if (payload[key] !== undefined && payload[key] !== null) {
      const val = Number(payload[key]);
      if (!Number.isFinite(val) || val < 0) {
        return `Valor inválido para ${label} (${key}): deve ser >= 0.`;
      }
    }
  }
  return null;
}

export function generateEdgeWaiterPin(): string {
  const digits = String(crypto.randomInt(100000, 999999));
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}`;
}

export function normalizeEdgeWaiterPin(raw: unknown): string {
  return String(raw || '').replace(/[^0-9]/g, '');
}

export function timingSafeEqualEdge(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function isLocalOrLanHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local')) {
    return true;
  }
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) {
    return true;
  }
  const m172 = h.match(/^172\.(\d+)\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

export function assertSecureCloudUrl(rawUrl: string): string {
  const clean = String(rawUrl || '').trim();
  if (!clean) {
    throw new Error('cloudBaseUrl não configurado.');
  }
  const parsed = new URL(clean);
  if (parsed.protocol === 'https:') {
    return clean.replace(/\/$/, '');
  }
  if (parsed.protocol === 'http:') {
    if (process.env.ALLOW_INSECURE_CLOUD_HTTP === 'true' || isLocalOrLanHostname(parsed.hostname)) {
      return clean.replace(/\/$/, '');
    }
    throw new Error(
      `Comunicação remota com 3C Cloud requer HTTPS (${parsed.hostname}). HTTP é restrito a loopback/LAN autorizada.`
    );
  }
  throw new Error(`Protocolo não suportado para cloudBaseUrl: ${parsed.protocol}`);
}

export function resolveEdgeCorsAllowlist(configOrigins?: string[]): Set<string> {
  const origins = new Set<string>([
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',
    'tauri://localhost',
    'http://tauri.localhost',
    'https://tauri.localhost',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3300',
    'http://127.0.0.1:3300',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);
  for (const raw of (process.env.EDGE_ALLOWED_ORIGINS || '').split(',')) {
    const t = raw.trim();
    if (t) origins.add(t);
  }
  if (process.env.APP_URL) origins.add(process.env.APP_URL.trim());
  for (const o of configOrigins || []) {
    if (o && o.trim()) origins.add(o.trim());
  }
  return origins;
}

export interface EdgeNodeConfig {
  nodeId?: string;
  storeId: string;
  tenantId: string;
  dbPath?: string;
  pmtilesDir?: string;
  port?: number;
  cloudBaseUrl?: string;
  allowedOrigins?: string[];
}
