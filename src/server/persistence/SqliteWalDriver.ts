import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import {
  PERSISTENCE_DRIVERS_REGISTRY,
  PersistenceDriver,
} from './PersistenceDriver.ts';

const require = createRequire(import.meta.url);

interface SqliteTransactionContext {
  get(docRef: { collectionName: string; id: string }): Promise<{ exists: boolean; id: string; data: () => any }>;
  set(docRef: { collectionName: string; id: string }, data: any, options?: { merge?: boolean }): void;
  update(docRef: { collectionName: string; id: string }, data: Record<string, any>): void;
  delete(docRef: { collectionName: string; id: string }): void;
}

/**
 * RFC-001 Standard 3C Edge Node Repository backed by Node 22 native SQLite WAL.
 */
export class SqliteWalDriver implements PersistenceDriver {
  public readonly capabilities = PERSISTENCE_DRIVERS_REGISTRY['sqlite-wal-edge'];
  private sqlite: any;
  private lock: Promise<void> = Promise.resolve();
  private stmtRead: any;
  private stmtWrite: any;
  private stmtWriteLww: any;
  private stmtDelete: any;
  private stmtList: any;
  private stmtCount: any;

  constructor(private readonly dbPath: string) {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    const { DatabaseSync } = require('node:sqlite') as {
      DatabaseSync: new (file: string) => any;
    };
    this.sqlite = new DatabaseSync(dbPath);
    this.sqlite.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA busy_timeout = 5000;
      PRAGMA foreign_keys = ON;
      PRAGMA cache_size = -64000;
      PRAGMA temp_store = MEMORY;
      PRAGMA mmap_size = 268435456;
      PRAGMA wal_autocheckpoint = 1000;
      CREATE TABLE IF NOT EXISTS edge_documents (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        tenant_id TEXT,
        store_id TEXT,
        hlc TEXT,
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (collection, id)
      );
      CREATE INDEX IF NOT EXISTS idx_edge_docs_tenant ON edge_documents(collection, tenant_id);
      CREATE INDEX IF NOT EXISTS idx_edge_docs_store ON edge_documents(collection, store_id);
      CREATE INDEX IF NOT EXISTS idx_edge_docs_hlc ON edge_documents(collection, hlc);
    `);

    this.stmtRead = this.sqlite.prepare(
      'SELECT data_json FROM edge_documents WHERE collection = ? AND id = ?'
    );
    this.stmtWrite = this.sqlite.prepare(
      `INSERT INTO edge_documents (collection, id, tenant_id, store_id, hlc, data_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(collection, id) DO UPDATE SET
         tenant_id = excluded.tenant_id,
         store_id = excluded.store_id,
         hlc = excluded.hlc,
         data_json = excluded.data_json,
         updated_at = excluded.updated_at`
    );
    this.stmtWriteLww = this.sqlite.prepare(
      `INSERT INTO edge_documents (collection, id, tenant_id, store_id, hlc, data_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(collection, id) DO UPDATE SET
         tenant_id = excluded.tenant_id,
         store_id = excluded.store_id,
         hlc = excluded.hlc,
         data_json = excluded.data_json,
         updated_at = excluded.updated_at
       WHERE edge_documents.hlc IS NULL
          OR excluded.hlc IS NULL
          OR excluded.hlc >= edge_documents.hlc`
    );
    this.stmtDelete = this.sqlite.prepare(
      'DELETE FROM edge_documents WHERE collection = ? AND id = ?'
    );
    this.stmtList = this.sqlite.prepare(
      'SELECT data_json FROM edge_documents WHERE collection = ?'
    );
    this.stmtCount = this.sqlite.prepare(
      'SELECT COUNT(*) AS cnt FROM edge_documents WHERE collection = ?'
    );
  }

  private async acquireLock(): Promise<() => void> {
    let release: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prev = this.lock;
    this.lock = prev.then(() => wait);
    await prev;
    return release!;
  }

  private readRaw(collection: string, id: string): any | null {
    const row = this.stmtRead.get(collection, id);
    if (!row) return null;
    return JSON.parse(row.data_json);
  }

  private writeRaw(collection: string, id: string, data: any): void {
    const record = { ...data, id };
    const nowIso = record.updatedAt || new Date().toISOString();
    this.stmtWrite.run(
      collection,
      id,
      record.tenantId || null,
      record.storeId || null,
      record.hlc || null,
      JSON.stringify(record),
      nowIso
    );
  }

  /**
   * Atomic SQL-native Last-Write-Wins (LWW) upsert based on HLC lexicographical ordering.
   * Returns true if the document was inserted or updated.
   */
  public upsertIfNewerHlcSync(collection: string, id: string, data: any): boolean {
    const record = { ...data, id };
    const nowIso = record.updatedAt || new Date().toISOString();
    const res = this.stmtWriteLww.run(
      collection,
      id,
      record.tenantId || null,
      record.storeId || null,
      record.hlc || null,
      JSON.stringify(record),
      nowIso
    );
    return Number(res?.changes || 0) > 0;
  }

  public optimizeWal(): void {
    this.sqlite.exec('PRAGMA optimize; PRAGMA wal_checkpoint(PASSIVE);');
  }

  public getDocSync<T = any>(collection: string, id: string): T | null {
    return this.readRaw(collection, id) as T | null;
  }

  public setDocSync<T = any>(collection: string, id: string, data: T): void {
    this.writeRaw(collection, id, data);
  }

  async getDoc<T = any>(collection: string, id: string): Promise<T | null> {
    return this.readRaw(collection, id) as T | null;
  }

  async setDoc<T = any>(collection: string, id: string, data: T, merge = true): Promise<void> {
    const release = await this.acquireLock();
    try {
      const existing = merge ? this.readRaw(collection, id) || {} : {};
      this.writeRaw(collection, id, { ...existing, ...(data as any), id });
    } finally {
      release();
    }
  }

  async updateDoc(collection: string, id: string, patch: Record<string, any>): Promise<void> {
    const release = await this.acquireLock();
    try {
      const existing = this.readRaw(collection, id);
      if (!existing) {
        throw new Error(`Document ${collection}/${id} does not exist`);
      }
      this.writeRaw(collection, id, { ...existing, ...patch, id });
    } finally {
      release();
    }
  }

  async deleteDoc(collection: string, id: string): Promise<void> {
    const release = await this.acquireLock();
    try {
      this.stmtDelete.run(collection, id);
    } finally {
      release();
    }
  }

  async listDocs<T = any>(collection: string): Promise<T[]> {
    const rows = this.stmtList.all(collection);
    return rows.map((r: any) => JSON.parse(r.data_json) as T);
  }

  async queryDocs<T = any>(
    collection: string,
    filter: { storeId?: string; tenantId?: string; sinceHlc?: string; limit?: number; offset?: number }
  ): Promise<T[]> {
    const clauses: string[] = ['collection = ?'];
    const params: any[] = [collection];
    if (filter.tenantId) {
      clauses.push('tenant_id = ?');
      params.push(filter.tenantId);
    }
    if (filter.storeId) {
      clauses.push('store_id = ?');
      params.push(filter.storeId);
    }
    if (filter.sinceHlc) {
      clauses.push('hlc > ?');
      params.push(filter.sinceHlc);
    }
    let sql = `SELECT data_json FROM edge_documents WHERE ${clauses.join(' AND ')}`;
    if (filter.sinceHlc) {
      sql += ' ORDER BY hlc ASC';
    }
    if (typeof filter.limit === 'number' && Number.isFinite(filter.limit) && filter.limit > 0) {
      sql += ' LIMIT ?';
      params.push(Math.min(5000, Math.floor(filter.limit)));
    }
    if (typeof filter.offset === 'number' && Number.isFinite(filter.offset) && filter.offset > 0) {
      sql += ' OFFSET ?';
      params.push(Math.floor(filter.offset));
    }
    const rows = this.sqlite.prepare(sql).all(...params);
    return rows.map((r: any) => JSON.parse(r.data_json) as T);
  }

  async bulkSetDocs(
    entries: Array<{ collection: string; id: string; data: any; merge?: boolean }>
  ): Promise<number> {
    if (!entries || entries.length === 0) return 0;
    const release = await this.acquireLock();
    try {
      this.sqlite.exec('BEGIN IMMEDIATE;');
      try {
        let written = 0;
        for (const entry of entries) {
          if (!entry.collection || !entry.id) continue;
          const existing = entry.merge ? this.readRaw(entry.collection, entry.id) || {} : {};
          this.writeRaw(entry.collection, entry.id, { ...existing, ...entry.data, id: entry.id });
          written++;
        }
        this.sqlite.exec('COMMIT;');
        return written;
      } catch (err) {
        this.sqlite.exec('ROLLBACK;');
        throw err;
      }
    } finally {
      release();
    }
  }

  getCollectionSize(collection: string): number {
    const row = this.stmtCount.get(collection);
    return Number(row?.cnt) || 0;
  }

  getWalMode(): string {
    const row = this.sqlite.prepare('PRAGMA journal_mode;').get();
    return String(row?.journal_mode || 'unknown').toUpperCase();
  }

  async runTransaction<T>(fn: (tx: SqliteTransactionContext) => Promise<T>): Promise<T> {
    const release = await this.acquireLock();
    const staged: Array<{
      collection: string;
      id: string;
      type: 'set' | 'update' | 'delete';
      data?: any;
      merge?: boolean;
    }> = [];

    const tx: SqliteTransactionContext = {
      get: async (docRef) => {
        const data = this.readRaw(docRef.collectionName, docRef.id);
        return {
          exists: Boolean(data),
          id: docRef.id,
          data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
        };
      },
      set: (docRef, data, options) => {
        staged.push({
          collection: docRef.collectionName,
          id: docRef.id,
          type: 'set',
          data,
          merge: options?.merge ?? false,
        });
      },
      update: (docRef, data) => {
        staged.push({
          collection: docRef.collectionName,
          id: docRef.id,
          type: 'update',
          data,
        });
      },
      delete: (docRef) => {
        staged.push({
          collection: docRef.collectionName,
          id: docRef.id,
          type: 'delete',
        });
      },
    };

    try {
      const result = await fn(tx);
      this.sqlite.exec('BEGIN IMMEDIATE;');
      try {
        for (const op of staged) {
          if (op.type === 'delete') {
            this.stmtDelete.run(op.collection, op.id);
          } else if (op.type === 'set') {
            const existing = op.merge ? this.readRaw(op.collection, op.id) || {} : {};
            this.writeRaw(op.collection, op.id, { ...existing, ...op.data, id: op.id });
          } else {
            const existing = this.readRaw(op.collection, op.id);
            if (!existing) {
              throw new Error(`Document ${op.collection}/${op.id} does not exist for update`);
            }
            this.writeRaw(op.collection, op.id, { ...existing, ...op.data, id: op.id });
          }
        }
        this.sqlite.exec('COMMIT;');
      } catch (err) {
        this.sqlite.exec('ROLLBACK;');
        throw err;
      }
      return result;
    } finally {
      release();
    }
  }

  close(): void {
    this.sqlite.close();
  }
}
