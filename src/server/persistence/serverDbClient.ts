import { generateStandardId } from '../../utils/idGenerator.ts';
import {
  DbExecutionContext,
  resolveEffectiveDbContext,
} from './dbExecutionContext.ts';
import { ServerInMemoryStore, IncrementalWalOp } from './ServerInMemoryStore.ts';

export interface UnifiedDocRef {
  collectionName: string;
  id: string;
  get(): Promise<{ exists: boolean; id: string; data: () => any }>;
  set(data: any, options?: { merge?: boolean }): Promise<void>;
  update(data: any): Promise<void>;
  delete(): Promise<void>;
}

export interface UnifiedTransaction {
  get(docRef: UnifiedDocRef): Promise<{ exists: boolean; id: string; data: () => any }>;
  set(docRef: UnifiedDocRef, data: any, options?: { merge?: boolean }): void;
  update(docRef: UnifiedDocRef, data: any): void;
  delete(docRef: UnifiedDocRef): void;
}

export interface CloudSyncDriverHandle {
  ping(): Promise<boolean>;
  runSchemaMigrations(): Promise<void>;
  loadAllDocuments(options?: { reason?: 'SYSTEM_BOOTSTRAP' | 'HQ_BACKUP' }): Promise<Record<string, any[]>>;
  syncSnapshot(
    tables: Record<string, any[]>,
    options?: { replaceAll?: boolean; reason?: 'SYSTEM_BOOTSTRAP' | 'HQ_RESTORE' }
  ): Promise<void>;
  getDoc<T = any>(collection: string, id: string, context?: DbExecutionContext | string): Promise<T | null>;
  setDoc<T = any>(
    collection: string,
    id: string,
    data: T,
    merge?: boolean,
    context?: DbExecutionContext | string
  ): Promise<T & { id: string }>;
  updateDoc?(
    collection: string,
    id: string,
    patch: Record<string, any>,
    context?: DbExecutionContext | string
  ): Promise<any>;
  deleteDoc(collection: string, id: string, context?: DbExecutionContext | string): Promise<void>;
  listDocs<T = any>(collection: string, context?: DbExecutionContext | string): Promise<T[]>;
  queryDocs?<T = any>(
    collection: string,
    filter: {
      storeId?: string;
      tenantId?: string;
      customerId?: string;
      status?: string;
      sinceHlc?: string;
      limit?: number;
      offset?: number;
    },
    context?: DbExecutionContext | string
  ): Promise<T[]>;
  hasCachedCollectionSize(collection: string): boolean;
  getCollectionSize(collection: string): number;
  getCollectionSizeAsync(collection: string): Promise<number>;
  runTransaction<T>(fn: (tx: any) => Promise<T>, context?: DbExecutionContext): Promise<T>;
  close(): Promise<void>;
}

export function createServerDbFacade(deps: {
  getCloudSyncDriver: () => CloudSyncDriverHandle | null;
  memoryStore: ServerInMemoryStore;
}) {
  const { getCloudSyncDriver, memoryStore } = deps;

  class ServerDocRef implements UnifiedDocRef {
    constructor(public collectionName: string, public id: string) {}

    async get(): Promise<{ exists: boolean; id: string; data: () => any }> {
      const cloudSyncDriver = getCloudSyncDriver();
      if (cloudSyncDriver) {
        const ctx = resolveEffectiveDbContext();
        const cloudDoc = await cloudSyncDriver.getDoc(this.collectionName, this.id, ctx);
        const table = memoryStore.getTable(this.collectionName);
        if (cloudDoc !== null && cloudDoc !== undefined) {
          table.set(this.id, cloudDoc);
          return {
            exists: true,
            id: this.id,
            data: () => structuredClone(cloudDoc),
          };
        }
        return {
          exists: false,
          id: this.id,
          data: () => undefined,
        };
      }
      const table = memoryStore.getTable(this.collectionName);
      const item = table.get(this.id);
      return {
        exists: Boolean(item),
        id: this.id,
        data: () => (item ? structuredClone(item) : undefined),
      };
    }

    async set(data: any, options?: { merge?: boolean }): Promise<void> {
      const cloudSyncDriver = getCloudSyncDriver();
      if (cloudSyncDriver) {
        const ctx = resolveEffectiveDbContext();
        const written = await cloudSyncDriver.setDoc(
          this.collectionName,
          this.id,
          data,
          options?.merge === true,
          ctx
        );
        const release = await memoryStore.acquireLock();
        try {
          const table = memoryStore.getTable(this.collectionName);
          table.set(this.id, written);
          memoryStore.recordIncrementalMutations([
            { op: 'set', col: this.collectionName, id: this.id, doc: written },
          ]);
        } finally {
          release();
        }
        return;
      }

      let written: any;
      const release = await memoryStore.acquireLock();
      try {
        const table = memoryStore.getTable(this.collectionName);
        if (options?.merge) {
          const current = table.get(this.id) || {};
          written = { ...current, ...data, id: this.id };
        } else {
          written = { ...data, id: this.id };
        }
        table.set(this.id, written);
        memoryStore.recordIncrementalMutations([
          { op: 'set', col: this.collectionName, id: this.id, doc: written },
        ]);
      } finally {
        release();
      }
    }

    async update(data: any): Promise<void> {
      const cloudSyncDriver = getCloudSyncDriver();
      if (cloudSyncDriver) {
        const ctx = resolveEffectiveDbContext();
        let updated: any;
        if (typeof cloudSyncDriver.updateDoc === 'function') {
          updated = await cloudSyncDriver.updateDoc(this.collectionName, this.id, data, ctx);
        } else {
          updated = await cloudSyncDriver.runTransaction(async (pgTx) => {
            const current = await pgTx.get(this.collectionName, this.id);
            if (!current) {
              throw new Error(`Document ${this.collectionName}/${this.id} does not exist`);
            }
            const next = { ...current, ...data, id: this.id };
            await pgTx.set(this.collectionName, this.id, next);
            return next;
          }, ctx);
        }
        const release = await memoryStore.acquireLock();
        try {
          const table = memoryStore.getTable(this.collectionName);
          table.set(this.id, updated);
          memoryStore.recordIncrementalMutations([
            { op: 'set', col: this.collectionName, id: this.id, doc: updated },
          ]);
        } finally {
          release();
        }
        return;
      }

      let updated: any;
      const release = await memoryStore.acquireLock();
      try {
        const table = memoryStore.getTable(this.collectionName);
        const current = table.get(this.id);
        if (!current) {
          throw new Error(`Document ${this.collectionName}/${this.id} does not exist`);
        }
        updated = { ...current, ...data };
        table.set(this.id, updated);
        memoryStore.recordIncrementalMutations([
          { op: 'set', col: this.collectionName, id: this.id, doc: updated },
        ]);
      } finally {
        release();
      }
    }

    async delete(): Promise<void> {
      const cloudSyncDriver = getCloudSyncDriver();
      if (cloudSyncDriver) {
        const ctx = resolveEffectiveDbContext();
        await cloudSyncDriver.deleteDoc(this.collectionName, this.id, ctx);
        const release = await memoryStore.acquireLock();
        try {
          const table = memoryStore.getTable(this.collectionName);
          table.delete(this.id);
          memoryStore.recordIncrementalMutations([
            { op: 'del', col: this.collectionName, id: this.id },
          ]);
        } finally {
          release();
        }
        return;
      }

      const release = await memoryStore.acquireLock();
      try {
        const table = memoryStore.getTable(this.collectionName);
        table.delete(this.id);
        memoryStore.recordIncrementalMutations([
          { op: 'del', col: this.collectionName, id: this.id },
        ]);
      } finally {
        release();
      }
    }
  }

  class ServerCollectionRef {
    constructor(public name: string) {}

    doc(id?: string): UnifiedDocRef {
      const prefix = this.name.substring(0, 3).toLowerCase();
      const docId = id || generateStandardId(prefix);
      return new ServerDocRef(this.name, docId);
    }

    async get(): Promise<{ docs: Array<{ id: string; exists: boolean; data: () => any }> }> {
      const cloudSyncDriver = getCloudSyncDriver();
      if (cloudSyncDriver) {
        const ctx = resolveEffectiveDbContext();
        const cloudDocs = await cloudSyncDriver.listDocs(this.name, ctx);
        const table = memoryStore.getTable(this.name);
        if (ctx.bypassRls) {
          table.clear();
        }
        for (const d of cloudDocs) {
          if (d && typeof d.id === 'string') {
            table.set(d.id, d);
          }
        }
        return {
          docs: cloudDocs.map((val) => ({
            id: val.id,
            exists: true,
            data: () => structuredClone(val),
          })),
        };
      }
      const table = memoryStore.getTable(this.name);
      const docs = Array.from(table.entries()).map(([id, val]) => ({
        id,
        exists: true,
        data: () => structuredClone(val),
      }));
      return { docs };
    }

    async query(filter: {
      storeId?: string;
      tenantId?: string;
      customerId?: string;
      status?: string;
      sinceHlc?: string;
      limit?: number;
      offset?: number;
    }): Promise<{ docs: Array<{ id: string; exists: boolean; data: () => any }> }> {
      const cloudSyncDriver = getCloudSyncDriver();
      if (cloudSyncDriver && typeof cloudSyncDriver.queryDocs === 'function') {
        const ctx = resolveEffectiveDbContext();
        const cloudDocs = await cloudSyncDriver.queryDocs(this.name, filter, ctx);
        return {
          docs: cloudDocs.map((val) => ({
            id: val.id,
            exists: true,
            data: () => structuredClone(val),
          })),
        };
      }
      const table = memoryStore.getTable(this.name);
      let list = Array.from(table.entries());
      if (filter.tenantId) list = list.filter(([, v]) => v?.tenantId === filter.tenantId);
      if (filter.storeId) list = list.filter(([, v]) => v?.storeId === filter.storeId);
      if (filter.customerId) list = list.filter(([, v]) => v?.customerId === filter.customerId);
      if (filter.status) list = list.filter(([, v]) => v?.status === filter.status);
      if (filter.sinceHlc) {
        list = list
          .filter(([, v]) => typeof v?.hlc === 'string' && v.hlc > filter.sinceHlc!)
          .sort(([, a], [, b]) => String(a?.hlc || '').localeCompare(String(b?.hlc || '')));
      }
      if (typeof filter.offset === 'number' && filter.offset > 0) {
        list = list.slice(Math.floor(filter.offset));
      }
      if (typeof filter.limit === 'number' && filter.limit > 0) {
        list = list.slice(0, Math.floor(filter.limit));
      }
      return {
        docs: list.map(([id, val]) => ({
          id,
          exists: true,
          data: () => structuredClone(val),
        })),
      };
    }
  }

  class ServerTransaction implements UnifiedTransaction {
    private stagingUpdates: Array<{
      docRef: UnifiedDocRef;
      type: 'set' | 'update' | 'delete';
      data?: any;
      options?: any;
    }> = [];

    async get(docRef: UnifiedDocRef): Promise<{ exists: boolean; id: string; data: () => any }> {
      return await docRef.get();
    }

    set(docRef: UnifiedDocRef, data: any, options?: { merge?: boolean }): void {
      this.stagingUpdates.push({ docRef, type: 'set', data, options });
    }

    update(docRef: UnifiedDocRef, data: any): void {
      this.stagingUpdates.push({ docRef, type: 'update', data });
    }

    delete(docRef: UnifiedDocRef): void {
      this.stagingUpdates.push({ docRef, type: 'delete' });
    }

    async commit(): Promise<void> {
      const snapshots: Array<{ docRef: UnifiedDocRef; originalData: any; exists: boolean }> = [];
      for (const update of this.stagingUpdates) {
        const snap = await update.docRef.get();
        snapshots.push({
          docRef: update.docRef,
          originalData: snap.exists ? snap.data() : null,
          exists: snap.exists,
        });
      }

      try {
        const stagedDocs: Array<{ col: string; id: string; op: 'set' | 'delete'; finalDoc?: any }> = [];
        for (let i = 0; i < this.stagingUpdates.length; i++) {
          const op = this.stagingUpdates[i];
          const table = memoryStore.getTable(op.docRef.collectionName);
          if (op.type === 'set') {
            let finalDoc: any;
            if (op.options?.merge) {
              const current = table.get(op.docRef.id) || {};
              finalDoc = { ...current, ...op.data, id: op.docRef.id };
            } else {
              finalDoc = { ...op.data, id: op.docRef.id };
            }
            table.set(op.docRef.id, finalDoc);
            stagedDocs.push({ col: op.docRef.collectionName, id: op.docRef.id, op: 'set', finalDoc });
          } else if (op.type === 'update') {
            const current = table.get(op.docRef.id);
            if (!current) {
              throw new Error(`Document ${op.docRef.collectionName}/${op.docRef.id} does not exist for update`);
            }
            const finalDoc = { ...current, ...op.data };
            table.set(op.docRef.id, finalDoc);
            stagedDocs.push({ col: op.docRef.collectionName, id: op.docRef.id, op: 'set', finalDoc });
          } else if (op.type === 'delete') {
            table.delete(op.docRef.id);
            stagedDocs.push({ col: op.docRef.collectionName, id: op.docRef.id, op: 'delete' });
          }
        }
        memoryStore.recordIncrementalMutations(
          stagedDocs.map((item) =>
            item.op === 'set'
              ? ({ op: 'set', col: item.col, id: item.id, doc: item.finalDoc } as const)
              : ({ op: 'del', col: item.col, id: item.id } as const)
          )
        );
      } catch (commitErr) {
        console.error('[Transaction ACID Rollback] Transaction execution failed, rolling back changes...', commitErr);
        for (const snap of snapshots) {
          const table = memoryStore.getTable(snap.docRef.collectionName);
          if (snap.exists && snap.originalData) {
            table.set(snap.docRef.id, snap.originalData);
          } else {
            table.delete(snap.docRef.id);
          }
        }
        throw commitErr;
      }
    }
  }

  return {
    collection(name: string): ServerCollectionRef {
      return new ServerCollectionRef(name);
    },

    async runTransaction<T>(
      updateFunction: (transaction: UnifiedTransaction) => Promise<T>,
      context?: DbExecutionContext
    ): Promise<T> {
      const effectiveCtx = resolveEffectiveDbContext(context);
      const cloudSyncDriver = getCloudSyncDriver();
      if (cloudSyncDriver) {
        const activeDriver = cloudSyncDriver;
        const committedMutations: IncrementalWalOp[] = [];
        const result = await activeDriver.runTransaction(async (pgTx) => {
          const stagingUpdates: Array<{
            docRef: UnifiedDocRef;
            type: 'set' | 'update' | 'delete';
            data?: any;
            options?: any;
          }> = [];
          const txReadCache = new Map<string, any | null>();

          const pgUnifiedTx: UnifiedTransaction = {
            async get(docRef: UnifiedDocRef) {
              const cacheKey = `${docRef.collectionName}:${docRef.id}`;
              if (txReadCache.has(cacheKey)) {
                const cached = txReadCache.get(cacheKey);
                return {
                  exists: cached !== null && cached !== undefined,
                  id: docRef.id,
                  data: () => (cached !== null && cached !== undefined ? structuredClone(cached) : undefined),
                };
              }
              const doc = await pgTx.get(docRef.collectionName, docRef.id);
              txReadCache.set(cacheKey, doc);
              return {
                exists: doc !== null && doc !== undefined,
                id: docRef.id,
                data: () => (doc !== null && doc !== undefined ? structuredClone(doc) : undefined),
              };
            },
            set(docRef: UnifiedDocRef, data: any, options?: { merge?: boolean }) {
              stagingUpdates.push({ docRef, type: 'set', data, options });
              const cacheKey = `${docRef.collectionName}:${docRef.id}`;
              if (options?.merge && txReadCache.has(cacheKey)) {
                const prev = txReadCache.get(cacheKey) || {};
                txReadCache.set(cacheKey, { ...prev, ...data, id: docRef.id });
              } else if (!options?.merge) {
                txReadCache.set(cacheKey, { ...data, id: docRef.id });
              } else {
                txReadCache.delete(cacheKey);
              }
            },
            update(docRef: UnifiedDocRef, data: any) {
              stagingUpdates.push({ docRef, type: 'update', data });
              const cacheKey = `${docRef.collectionName}:${docRef.id}`;
              if (txReadCache.has(cacheKey) && txReadCache.get(cacheKey)) {
                txReadCache.set(cacheKey, { ...txReadCache.get(cacheKey), ...data, id: docRef.id });
              } else {
                txReadCache.delete(cacheKey);
              }
            },
            delete(docRef: UnifiedDocRef) {
              stagingUpdates.push({ docRef, type: 'delete' });
              txReadCache.set(`${docRef.collectionName}:${docRef.id}`, null);
            },
          };

          const outcome = await updateFunction(pgUnifiedTx);

          const commitStateCache = new Map<string, any | null>();
          for (const update of stagingUpdates) {
            const col = update.docRef.collectionName;
            const id = update.docRef.id;
            const cacheKey = `${col}:${id}`;
            if (update.type === 'set') {
              let finalDoc: any;
              if (update.options?.merge) {
                const current = commitStateCache.has(cacheKey)
                  ? commitStateCache.get(cacheKey) || {}
                  : (await pgTx.get(col, id)) || {};
                finalDoc = { ...current, ...update.data, id };
              } else {
                finalDoc = { ...update.data, id };
              }
              await pgTx.set(col, id, finalDoc);
              commitStateCache.set(cacheKey, finalDoc);
              committedMutations.push({ op: 'set', col, id, doc: finalDoc });
            } else if (update.type === 'update') {
              const current = commitStateCache.has(cacheKey)
                ? commitStateCache.get(cacheKey)
                : await pgTx.get(col, id);
              if (!current) {
                throw new Error(`Document ${col}/${id} does not exist for update`);
              }
              const finalDoc = { ...current, ...update.data, id };
              await pgTx.set(col, id, finalDoc);
              commitStateCache.set(cacheKey, finalDoc);
              committedMutations.push({ op: 'set', col, id, doc: finalDoc });
            } else if (update.type === 'delete') {
              await pgTx.delete(col, id);
              commitStateCache.set(cacheKey, null);
              committedMutations.push({ op: 'del', col, id });
            }
          }

          return outcome;
        }, effectiveCtx);

        if (committedMutations.length > 0) {
          const release = await memoryStore.acquireLock();
          try {
            for (const m of committedMutations) {
              const table = memoryStore.getTable(m.col);
              if (m.op === 'del') {
                table.delete(m.id);
              } else {
                table.set(m.id, m.doc);
              }
            }
            memoryStore.recordIncrementalMutations(committedMutations);
          } finally {
            release();
          }
        }
        return result;
      }

      const release = await memoryStore.acquireLock();
      try {
        const transaction = new ServerTransaction();
        const result = await updateFunction(transaction);
        await transaction.commit();
        return result;
      } finally {
        release();
      }
    },

    getCollectionSize(name: string): number {
      const cloudSyncDriver = getCloudSyncDriver();
      if (cloudSyncDriver && cloudSyncDriver.hasCachedCollectionSize(name)) {
        return cloudSyncDriver.getCollectionSize(name);
      }
      return memoryStore.getTable(name).size;
    },

    async getCollectionSizeAsync(name: string): Promise<number> {
      const cloudSyncDriver = getCloudSyncDriver();
      if (cloudSyncDriver) {
        return await cloudSyncDriver.getCollectionSizeAsync(name);
      }
      return memoryStore.getTable(name).size;
    },

    getRevisions(): { revision: number; collections: Record<string, number> } {
      return memoryStore.getRevisionsSnapshot();
    },

    saveImmediately(): void {
      memoryStore.saveImmediately();
    },

    async exportSnapshotAsync(): Promise<Record<string, any[]>> {
      const cloudSyncDriver = getCloudSyncDriver();
      if (cloudSyncDriver) {
        return await cloudSyncDriver.loadAllDocuments({ reason: 'HQ_BACKUP' });
      }
      return memoryStore.exportSnapshot();
    },

    exportSnapshot(): Record<string, any[]> {
      return memoryStore.exportSnapshot();
    },

    async restoreSnapshot(snapshot: Record<string, any[]>): Promise<number> {
      return memoryStore.restoreSnapshot(snapshot);
    },

    async resetToSeeds(): Promise<void> {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Operação resetToSeeds() bloqueada em ambiente de produção (NODE_ENV=production).');
      }
      const release = await memoryStore.acquireLock();
      try {
        const existingUsers = Array.from(memoryStore.getTable('users').values());
        memoryStore.tables.clear();
        memoryStore.seed();
        const usersMap = memoryStore.getTable('users');
        for (const u of existingUsers) {
          if (u && u.uid && u.role === 'DEV_OWNER' && !usersMap.has(u.uid)) {
            usersMap.set(u.uid, u);
          }
        }
        memoryStore.bumpRevisions(memoryStore.tables.keys());
        memoryStore.saveImmediately();
      } finally {
        release();
      }
    },
  };
}
