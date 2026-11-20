import { openDB, IDBPDatabase } from 'idb';
import type { MenuItem } from '@3c/shared-types';
import { generateHlcTimestamp, generateIdempotencyKey } from '@3c/commerce-engine';

const DB_NAME = '3eatcru-pos-db';
const DB_VERSION = 3;
const STORE_CATALOG = 'catalog';
const STORE_PENDING_ORDERS = 'pending-orders';
const STORE_PENDING_MUTATIONS = 'pending-mutations';
const STORE_SYNC_CONFLICTS = 'sync-conflicts';

export type OfflineMutationEntity =
  | 'orders'
  | 'tables'
  | 'inventory_batches'
  | 'reservations'
  | 'cash_sessions'
  | 'financial_records';

export interface OfflinePendingMutation {
  id: string; // idempotencyKey idm_...
  entity: OfflineMutationEntity;
  entityId: string;
  operation: 'UPSERT' | 'DELETE';
  storeId: string;
  appId: 'store-os' | 'waiter' | 'driver' | 'marketplace' | 'hq';
  hlc: string;
  deltaQty?: number;
  variantDeltas?: Array<{ variantId: string; deltaQty: number }>;
  payload: any;
  synced: boolean;
  offlineAt: string;
}

export interface SyncConflictRecord {
  id: string; // idempotencyKey
  entity: string;
  entityId: string;
  storeId?: string;
  reason: string;
  kind: 'CONFLICT' | 'REJECTED';
  payload?: any;
  serverRecord?: any;
  detectedAt: string;
}

export class StorageService {
  private static db: IDBPDatabase | null = null;
  private static nodeFallbackMutations: OfflinePendingMutation[] = [];
  private static nodeFallbackConflicts: SyncConflictRecord[] = [];

  static async getDB(): Promise<IDBPDatabase | null> {
    if (typeof indexedDB === 'undefined') return null;
    if (this.db) return this.db;
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_CATALOG)) {
          db.createObjectStore(STORE_CATALOG, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PENDING_ORDERS)) {
          db.createObjectStore(STORE_PENDING_ORDERS, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(STORE_PENDING_MUTATIONS)) {
          db.createObjectStore(STORE_PENDING_MUTATIONS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SYNC_CONFLICTS)) {
          db.createObjectStore(STORE_SYNC_CONFLICTS, { keyPath: 'id' });
        }
      },
    });
    return this.db;
  }

  static async cacheCatalog(items: MenuItem[]) {
    const db = await this.getDB();
    if (!db) return;
    const tx = db.transaction(STORE_CATALOG, 'readwrite');
    await tx.store.clear();
    for (const item of items) {
      await tx.store.put(item);
    }
    await tx.done;
  }

  static async getCachedCatalog(): Promise<MenuItem[]> {
    const db = await this.getDB();
    if (!db) return [];
    return await db.getAll(STORE_CATALOG);
  }

  static async saveOfflineOrder(order: any) {
    const db = await this.getDB();
    if (!db) return;
    await db.add(STORE_PENDING_ORDERS, {
      ...order,
      idempotencyKey: order.idempotencyKey || generateIdempotencyKey(),
      hlc: order.hlc || generateHlcTimestamp('browser_offline'),
      synced: false,
      offlineAt: new Date().toISOString(),
    });
  }

  static async getPendingOrders() {
    const db = await this.getDB();
    if (!db) return [];
    return await db.getAll(STORE_PENDING_ORDERS);
  }

  static async markOrderSynced(id: number) {
    const db = await this.getDB();
    if (!db) return;
    await db.delete(STORE_PENDING_ORDERS, id);
  }

  static async enqueueOfflineMutation(params: {
    entity: OfflineMutationEntity;
    entityId: string;
    operation?: 'UPSERT' | 'DELETE';
    storeId: string;
    appId: OfflinePendingMutation['appId'];
    deltaQty?: number;
    variantDeltas?: Array<{ variantId: string; deltaQty: number }>;
    payload: any;
    nodeId?: string;
  }): Promise<OfflinePendingMutation> {
    const mutation: OfflinePendingMutation = {
      id: generateIdempotencyKey(),
      entity: params.entity,
      entityId: params.entityId,
      operation: params.operation || 'UPSERT',
      storeId: params.storeId,
      appId: params.appId,
      hlc: generateHlcTimestamp(params.nodeId || params.appId),
      deltaQty: params.deltaQty,
      ...(Array.isArray(params.variantDeltas) && params.variantDeltas.length > 0
        ? { variantDeltas: params.variantDeltas }
        : {}),
      payload: params.payload,
      synced: false,
      offlineAt: new Date().toISOString(),
    };

    const db = await this.getDB();
    if (!db) {
      this.nodeFallbackMutations.push(mutation);
      return mutation;
    }

    await db.put(STORE_PENDING_MUTATIONS, mutation);
    return mutation;
  }

  static async getPendingMutations(): Promise<OfflinePendingMutation[]> {
    const db = await this.getDB();
    if (!db) return [...this.nodeFallbackMutations];
    return await db.getAll(STORE_PENDING_MUTATIONS);
  }

  static async removeSyncedMutation(idempotencyKey: string): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      this.nodeFallbackMutations = this.nodeFallbackMutations.filter((m) => m.id !== idempotencyKey);
      return;
    }
    await db.delete(STORE_PENDING_MUTATIONS, idempotencyKey);
  }

  static async saveSyncConflict(conflict: SyncConflictRecord): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      this.nodeFallbackConflicts = [
        ...this.nodeFallbackConflicts.filter((c) => c.id !== conflict.id),
        conflict,
      ];
      return;
    }
    await db.put(STORE_SYNC_CONFLICTS, conflict);
  }

  static async getSyncConflicts(): Promise<SyncConflictRecord[]> {
    const db = await this.getDB();
    if (!db) return [...this.nodeFallbackConflicts];
    return await db.getAll(STORE_SYNC_CONFLICTS);
  }

  static async removeSyncConflict(id: string): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      this.nodeFallbackConflicts = this.nodeFallbackConflicts.filter((c) => c.id !== id);
      return;
    }
    await db.delete(STORE_SYNC_CONFLICTS, id);
  }

  static async clearSyncConflicts(): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      this.nodeFallbackConflicts = [];
      return;
    }
    const tx = db.transaction(STORE_SYNC_CONFLICTS, 'readwrite');
    await tx.store.clear();
    await tx.done;
  }
}
