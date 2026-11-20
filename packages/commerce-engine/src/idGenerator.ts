/**
 * 3C Corp SaaS — Standard ID & HLC Generator (@3c/commerce-engine)
 * Conforms to /docs/architecture/security/README.md
 */

function fillCryptoBytes(bytes: Uint8Array<ArrayBuffer>): void {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    return;
  }
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
}

function generateEntropyString(length = 12): string {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  fillCryptoBytes(bytes);
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  let str = '';
  for (let i = 0; i < length; i++) {
    str += alphabet[bytes[i] % alphabet.length];
  }
  return str;
}

let lastUuidV7Ms = 0;
let lastUuidV7Seq = 0;

/**
 * RFC 9562 Monotonic UUIDv7 generator (48-bit Unix ms + 12-bit monotonic seq + 62-bit CSPRNG).
 * Prevents B-tree index fragmentation in PostgreSQL 18 and SQLite WAL high-write tables.
 */
export function generateUuidV7(): string {
  let nowMs = Date.now();
  if (nowMs > lastUuidV7Ms) {
    lastUuidV7Ms = nowMs;
    lastUuidV7Seq = 0;
  } else {
    lastUuidV7Seq = (lastUuidV7Seq + 1) & 0x0fff;
    if (lastUuidV7Seq === 0) {
      lastUuidV7Ms += 1;
    }
    nowMs = lastUuidV7Ms;
  }

  const bytes = new Uint8Array(new ArrayBuffer(16));
  fillCryptoBytes(bytes);

  // 48-bit big-endian Unix timestamp in milliseconds
  const tsHi = Math.floor(nowMs / 0x10000);
  const tsLo = nowMs % 0x10000;
  bytes[0] = (tsHi >>> 24) & 0xff;
  bytes[1] = (tsHi >>> 16) & 0xff;
  bytes[2] = (tsHi >>> 8) & 0xff;
  bytes[3] = tsHi & 0xff;
  bytes[4] = (tsLo >>> 8) & 0xff;
  bytes[5] = tsLo & 0xff;

  // Version 7 (0111) + 12-bit monotonic sequence in rand_a
  bytes[6] = 0x70 | ((lastUuidV7Seq >>> 8) & 0x0f);
  bytes[7] = lastUuidV7Seq & 0xff;

  // Variant RFC 4122/9562 (10xx)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  let hex = '';
  for (let i = 0; i < 16; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

let lastStdIdMs = 0;
let lastStdIdSeq = 0;

export function generateStandardId(prefix: string): string {
  const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'id';
  let nowMs = Date.now();
  if (nowMs > lastStdIdMs) {
    lastStdIdMs = nowMs;
    lastStdIdSeq = 0;
  } else {
    lastStdIdSeq = (lastStdIdSeq + 1) % 1296;
    if (lastStdIdSeq === 0) {
      lastStdIdMs += 1;
    }
    nowMs = lastStdIdMs;
  }
  const timePart = nowMs.toString(36).padStart(9, '0');
  const seqPart = lastStdIdSeq.toString(36).padStart(2, '0');
  const entropyPart = generateEntropyString(8);
  return `${cleanPrefix}_${timePart}${seqPart}${entropyPart}`;
}

export const generatePlatformId = () => generateStandardId('plat');
export const generateTenantId = () => generateStandardId('tnt');
export const generateStoreId = () => generateStandardId('str');
export const generateUserId = () => generateStandardId('usr');
export const generateRoleId = () => generateStandardId('rol');
export const generatePlanId = () => generateStandardId('pln');
export const generateLicenseId = () => generateStandardId('lic');
export const generateSubscriptionId = () => generateStandardId('sub');

export const generateProductId = () => generateStandardId('prd');
export const generateCategoryId = () => generateStandardId('cat');
export const generateCustomerId = () => generateStandardId('cst');
export const generateSupplierId = () => generateStandardId('sup');
export const generateOrderId = () => generateStandardId('ord');
export const generateSaleId = () => generateStandardId('sal');
export const generatePaymentId = () => generateStandardId('pay');
export const generateCouponId = () => generateStandardId('cpn');
export const generateStockMovementId = () => generateStandardId('stk');

export const generateTableId = () => generateStandardId('tbl');
export const generateReservationId = () => generateStandardId('res');
export const generateDeliveryId = () => generateStandardId('dlv');
export const generateDriverId = () => generateStandardId('drv');
export const generateDeviceId = () => generateStandardId('dvc');
export const generateTerminalId = () => generateStandardId('trm');
export const generateIntegrationId = () => generateStandardId('itg');

export const generateSessionId = () => generateStandardId('ses');
export const generateEventId = () => generateStandardId('evt');
export const generateAuditLogId = () => generateStandardId('aud');
export const generateNotificationId = () => generateStandardId('ntf');
export const generateRequestId = () => generateStandardId('req');
export const generateIdempotencyKey = () => generateStandardId('idm');
export const generateEdgeNodeId = () => generateStandardId('edg');
export const generateSyncCursorId = () => generateStandardId('cur');
export const generateOutboxId = () => generateStandardId('out');

let lastHlcWallMs = 0;
let lastHlcCounter = 0;

export function generateHlcTimestamp(nodeId = 'cloud_core'): string {
  const now = Date.now();
  if (now > lastHlcWallMs) {
    lastHlcWallMs = now;
    lastHlcCounter = 0;
  } else {
    lastHlcCounter += 1;
  }
  const cleanNode = nodeId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'node';
  return `${lastHlcWallMs}:${String(lastHlcCounter).padStart(4, '0')}:${cleanNode}`;
}

export function advanceHlcTimestamp(observedHlc?: string | null, nodeId = 'cloud_core'): string {
  if (observedHlc && typeof observedHlc === 'string') {
    const [msStr = '0', cntStr = '0'] = observedHlc.split(':');
    const obsMs = Number(msStr) || 0;
    const obsCnt = Number(cntStr) || 0;
    if (obsMs > lastHlcWallMs) {
      lastHlcWallMs = obsMs;
      lastHlcCounter = obsCnt;
    } else if (obsMs === lastHlcWallMs && obsCnt > lastHlcCounter) {
      lastHlcCounter = obsCnt;
    }
  }
  return generateHlcTimestamp(nodeId);
}

export function compareHlcTimestamps(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;

  const parse = (hlc: string) => {
    const [msStr = '0', cntStr = '0', node = ''] = hlc.split(':');
    return {
      ms: Number(msStr) || 0,
      cnt: Number(cntStr) || 0,
      node,
    };
  };

  const pa = parse(a);
  const pb = parse(b);
  if (pa.ms !== pb.ms) return pa.ms - pb.ms;
  if (pa.cnt !== pb.cnt) return pa.cnt - pb.cnt;
  return pa.node.localeCompare(pb.node);
}

export function isValidStandardId(id: string, expectedPrefix?: string): boolean {
  if (!id || typeof id !== 'string') return false;
  if (!id.includes('_')) return false;
  const parts = id.split('_');
  if (parts.length !== 2) return false;
  if (expectedPrefix && parts[0] !== expectedPrefix) return false;
  return parts[0].length >= 2 && parts[1].length >= 8;
}
