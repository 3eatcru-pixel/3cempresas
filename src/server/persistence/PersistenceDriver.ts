import { db } from '../config.ts';
import {
  compareHlcTimestamps,
  generateHlcTimestamp,
  generateOutboxId,
  generateStockMovementId,
} from '@3c/commerce-engine';

export { compareHlcTimestamps };

export type PersistenceDriverKind = 'json-memory' | 'postgres-cloud' | 'sqlite-wal-edge';

export interface PersistenceDriverCapabilities {
  kind: PersistenceDriverKind;
  acidTransactions: boolean;
  walMode: boolean;
  edgeReady: boolean;
  cloudMultiRegionReady: boolean;
  description: string;
}

export interface PersistenceDriver {
  readonly capabilities: PersistenceDriverCapabilities;
  getDoc<T = any>(collection: string, id: string): Promise<T | null>;
  setDoc<T = any>(collection: string, id: string, data: T, merge?: boolean): Promise<void | (T & { id: string })>;
  updateDoc(collection: string, id: string, patch: Record<string, any>): Promise<void>;
  deleteDoc(collection: string, id: string): Promise<void>;
  listDocs<T = any>(collection: string): Promise<T[]>;
  getCollectionSize(collection: string): number;
  runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T>;
}

export interface SyncOutboxEntry {
  id: string;
  entity: string;
  entityId: string;
  operation: 'UPSERT' | 'DELETE';
  tenantId: string;
  storeId?: string | null;
  hlc: string;
  nodeId: string;
  idempotencyKey?: string;
  payload: any;
  createdAt: string;
}

export interface StockLedgerEntry {
  id: string;
  tenantId: string;
  storeId: string;
  itemType: 'MENU_ITEM' | 'VARIANT' | 'RAW_BATCH';
  targetId: string;
  sku?: string;
  itemName?: string;
  deltaQty: number;
  previousQty: number;
  balanceAfter: number;
  reason: 'SALE' | 'BOM_FIFO' | 'ADJUSTMENT' | 'RESTOCK' | 'SYNC_RECONCILE' | 'RETURN';
  orderId?: string;
  orderCode?: string;
  hlc: string;
  nodeId: string;
  createdAt: string;
}

export interface EdgeNodeRegistration {
  id: string;
  tenantId: string;
  storeId: string;
  hostname: string;
  lanIp?: string;
  port: number;
  platform: 'windows' | 'linux' | 'macos' | 'docker' | string;
  appVersion: string;
  lastHlc: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  pairedByUid: string;
  lastHeartbeatAt: string;
  createdAt: string;
}

export const PERSISTENCE_DRIVERS_REGISTRY: Record<PersistenceDriverKind, PersistenceDriverCapabilities> = {
  'json-memory': {
    kind: 'json-memory',
    acidTransactions: true,
    walMode: false,
    edgeReady: false,
    cloudMultiRegionReady: false,
    description: 'Atomic in-memory transactional store backed by server-db.json (Local Server Core Runtime).',
  },
  'postgres-cloud': {
    kind: 'postgres-cloud',
    acidTransactions: true,
    walMode: true,
    edgeReady: false,
    cloudMultiRegionReady: true,
    description: 'RFC-001 Cloud PostgreSQL repository target with advisory locks, pg pool & sync_outbox.',
  },
  'sqlite-wal-edge': {
    kind: 'sqlite-wal-edge',
    acidTransactions: true,
    walMode: true,
    edgeReady: true,
    cloudMultiRegionReady: false,
    description: 'RFC-001 Standard 3C Edge Node local SQLite WAL repository with offline outbox & LAN sync.',
  },
};

export class JsonMemoryDriver implements PersistenceDriver {
  public readonly capabilities = PERSISTENCE_DRIVERS_REGISTRY['json-memory'];

  async getDoc<T = any>(collection: string, id: string): Promise<T | null> {
    const snap = await db.collection(collection).doc(id).get();
    return snap.exists ? (snap.data() as T) : null;
  }

  async setDoc<T = any>(collection: string, id: string, data: T, merge = true): Promise<void> {
    await db.collection(collection).doc(id).set(data, { merge });
  }

  async updateDoc(collection: string, id: string, patch: Record<string, any>): Promise<void> {
    await db.collection(collection).doc(id).update(patch);
  }

  async deleteDoc(collection: string, id: string): Promise<void> {
    await db.collection(collection).doc(id).delete();
  }

  async listDocs<T = any>(collection: string): Promise<T[]> {
    const snap = await db.collection(collection).get();
    return snap.docs.map(d => d.data() as T);
  }

  getCollectionSize(collection: string): number {
    return db.getCollectionSize(collection);
  }

  async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return db.runTransaction(fn);
  }
}

import { PostgresCloudDriver } from './PostgresCloudDriver.ts';

export function resolvePersistenceDriver(env: Record<string, string | undefined> = process.env): PersistenceDriver {
  const cloudUrl = env.DATABASE_URL || env.POSTGRES_URL;
  if (cloudUrl) {
    if (env.ENABLE_POSTGRES_CLOUD === 'true' || env.ALLOW_INCOMPLETE_POSTGRES_DRIVER === 'true') {
      return new PostgresCloudDriver(cloudUrl, env);
    }
    console.warn(
      '[PersistenceDriver] DATABASE_URL detectado, mas ENABLE_POSTGRES_CLOUD != "true" (usando JsonMemoryDriver unificado).'
    );
  }
  return new JsonMemoryDriver();
}

export const activePersistenceDriver: PersistenceDriver = resolvePersistenceDriver();

/**
 * Stages or writes an HLC-ordered event into sync_outbox for Edge/Cloud delta replication.
 */
export function buildSyncOutboxEntry(params: {
  entity: string;
  entityId: string;
  operation: 'UPSERT' | 'DELETE';
  tenantId: string;
  storeId?: string | null;
  nodeId?: string;
  hlc?: string;
  idempotencyKey?: string;
  payload: any;
}): SyncOutboxEntry {
  const nowIso = new Date().toISOString();
  return {
    id: generateOutboxId(),
    entity: params.entity,
    entityId: params.entityId,
    operation: params.operation,
    tenantId: params.tenantId || 'tenant-1',
    storeId: params.storeId ?? null,
    hlc: params.hlc || generateHlcTimestamp(params.nodeId || 'cloud_core'),
    nodeId: params.nodeId || 'cloud_core',
    idempotencyKey: params.idempotencyKey,
    payload: params.payload,
    createdAt: nowIso,
  };
}

export function stageSyncOutboxInTransaction(
  transaction: { set: (ref: any, data: any, opts?: any) => void },
  params: Parameters<typeof buildSyncOutboxEntry>[0]
): SyncOutboxEntry {
  const entry = buildSyncOutboxEntry(params);
  transaction.set(db.collection('sync_outbox').doc(entry.id), entry, { merge: false });
  return entry;
}

export async function recordSyncOutbox(
  params: Parameters<typeof buildSyncOutboxEntry>[0]
): Promise<SyncOutboxEntry> {
  const entry = buildSyncOutboxEntry(params);
  await db.collection('sync_outbox').doc(entry.id).set(entry, { merge: false });
  return entry;
}

export function buildStockLedgerEntry(params: {
  tenantId: string;
  storeId: string;
  itemType: StockLedgerEntry['itemType'];
  targetId: string;
  sku?: string;
  itemName?: string;
  deltaQty: number;
  previousQty: number;
  balanceAfter: number;
  reason: StockLedgerEntry['reason'];
  orderId?: string;
  orderCode?: string;
  nodeId?: string;
  hlc?: string;
}): StockLedgerEntry {
  return {
    id: generateStockMovementId(),
    tenantId: params.tenantId || 'tenant-1',
    storeId: params.storeId,
    itemType: params.itemType,
    targetId: params.targetId,
    sku: params.sku,
    itemName: params.itemName,
    deltaQty: params.deltaQty,
    previousQty: params.previousQty,
    balanceAfter: params.balanceAfter,
    reason: params.reason,
    orderId: params.orderId,
    orderCode: params.orderCode,
    hlc: params.hlc || generateHlcTimestamp(params.nodeId || 'cloud_core'),
    nodeId: params.nodeId || 'cloud_core',
    createdAt: new Date().toISOString(),
  };
}

export function stageStockLedgerInTransaction(
  transaction: { set: (ref: any, data: any, opts?: any) => void },
  params: Parameters<typeof buildStockLedgerEntry>[0]
): StockLedgerEntry {
  const entry = buildStockLedgerEntry(params);
  transaction.set(db.collection('stock_ledger').doc(entry.id), entry, { merge: false });
  return entry;
}

export async function recordStockLedger(
  params: Parameters<typeof buildStockLedgerEntry>[0]
): Promise<StockLedgerEntry> {
  const entry = buildStockLedgerEntry(params);
  await db.collection('stock_ledger').doc(entry.id).set(entry, { merge: false });
  return entry;
}
