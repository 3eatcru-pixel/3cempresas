import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DEFAULT_PLATFORM_GOVERNANCE } from '../../constants/platformDefaults.ts';
import { hashPassword } from '../security/cryptoVaultAndHashing.ts';

function isStrictProdRuntime(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.ALLOW_SANDBOX_IN_PRODUCTION !== 'true';
}

export const DB_FILE = process.env.SERVER_DB_PATH
  ? path.resolve(process.env.SERVER_DB_PATH)
  : path.join(process.cwd(), 'server-db.json');
export const WAL_FILE = `${DB_FILE}.ops.ndjson`;

export type IncrementalWalOp =
  | { op: 'set'; col: string; id: string; doc: any }
  | { op: 'del'; col: string; id: string };

/**
 * In-Memory Autonomous Server Database (with transaction & query support)
 * Guarantees zero-dependency startup and execution.
 */
export class ServerInMemoryStore {
  public tables: Map<string, Map<string, any>> = new Map();
  private lock: Promise<void> = Promise.resolve();
  private persistTimeout: NodeJS.Timeout | null = null;
  private asyncPersistInFlight = false;
  private asyncPersistPending = false;
  private globalRevision = 1;
  private collectionRevisions: Map<string, number> = new Map();
  private walOpsSinceCompaction = 0;
  private isCloudActiveGetter: () => boolean;
  private onRestoreCloudSync?: (snapshot: Record<string, any[]>) => Promise<void>;

  constructor(options?: {
    isCloudActiveGetter?: () => boolean;
    onRestoreCloudSync?: (snapshot: Record<string, any[]>) => Promise<void>;
  }) {
    this.isCloudActiveGetter = options?.isCloudActiveGetter || (() => false);
    this.onRestoreCloudSync = options?.onRestoreCloudSync;
    this.load();
  }

  public setCloudCallbacks(options: {
    isCloudActiveGetter: () => boolean;
    onRestoreCloudSync: (snapshot: Record<string, any[]>) => Promise<void>;
  }) {
    this.isCloudActiveGetter = options.isCloudActiveGetter;
    this.onRestoreCloudSync = options.onRestoreCloudSync;
  }

  public bumpRevisions(collections: Iterable<string>) {
    let touched = false;
    for (const col of collections) {
      if (!col) continue;
      this.collectionRevisions.set(col, (this.collectionRevisions.get(col) || 1) + 1);
      touched = true;
    }
    if (touched) {
      this.globalRevision += 1;
    }
  }

  public getRevisionsSnapshot(): { revision: number; collections: Record<string, number> } {
    const collections: Record<string, number> = {};
    this.collectionRevisions.forEach((rev, col) => {
      collections[col] = rev;
    });
    return {
      revision: this.globalRevision,
      collections,
    };
  }

  private replayWalFile(): number {
    if (!fs.existsSync(WAL_FILE)) return 0;
    let replayed = 0;
    try {
      const rawWal = fs.readFileSync(WAL_FILE, 'utf-8');
      const lines = rawWal.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const op = JSON.parse(trimmed) as IncrementalWalOp;
          if (!op || !op.col || !op.id) continue;
          const table = this.getTable(op.col);
          if (op.op === 'set' && op.doc !== undefined) {
            table.set(op.id, op.doc);
            replayed++;
          } else if (op.op === 'del') {
            table.delete(op.id);
            replayed++;
          }
        } catch {
          // Ignore malformed/incomplete trailing line from an unclean shutdown
        }
      }
      this.walOpsSinceCompaction = replayed;
      if (replayed > 0) {
        console.log(`[Database] Replayed ${replayed} incremental ops from WAL.`);
      }
    } catch (err) {
      console.warn('[Database] Failed to replay incremental WAL:', err);
    }
    return replayed;
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const data = JSON.parse(raw);
        for (const [tableName, items] of Object.entries(data)) {
          const map = new Map<string, any>();
          if (Array.isArray(items)) {
            items.forEach((item) => {
              if (item && item.id) map.set(item.id, item);
            });
          }
          this.tables.set(tableName, map);
        }
        const replayed = this.replayWalFile();
        console.log(
          `[Database] Loaded ${this.tables.size} tables from persistence${
            replayed > 0 ? ` (+${replayed} WAL ops)` : ''
          }.`
        );

        const govTable = this.tables.get('governance');
        const govDoc = govTable?.get('governance');
        let migratedGovernance = false;
        if (govDoc && (!govDoc.databaseStatus || !govDoc.serverCollections)) {
          govTable!.set('governance', {
            ...DEFAULT_PLATFORM_GOVERNANCE,
            ...govDoc,
            databaseStatus: govDoc.databaseStatus || 'CONNECTED',
            serverCollections: govDoc.serverCollections || DEFAULT_PLATFORM_GOVERNANCE.serverCollections,
            auditLogs: Array.isArray(govDoc.auditLogs) ? govDoc.auditLogs : [],
          });
          migratedGovernance = true;
        }

        let hasNewSeeds = false;

        const usersTable = this.tables.get('users');
        const masterUser = usersTable?.get('usr-dev-master');
        if (masterUser && (!masterUser.passwordHash || masterUser.passwordSealed === true)) {
          const envDevPassword = process.env.INITIAL_DEV_PASSWORD?.trim();
          const hasSafeProdPassword =
            Boolean(envDevPassword) &&
            envDevPassword!.length >= 8 &&
            envDevPassword !== 'SetPassword2026';
          if (isStrictProdRuntime() && !hasSafeProdPassword) {
            if (!masterUser.passwordHash) {
              masterUser.passwordHash = hashPassword(crypto.randomBytes(32).toString('hex'));
            }
            masterUser.passwordSealed = true;
            masterUser.mustChangePassword = true;
            console.error(
              '[Bootstrap Security] PRODUÇÃO: INITIAL_DEV_PASSWORD ausente ou insegura para 3eatcru@gmail.com; credencial aleatória selada até configuração via Secret Manager.'
            );
            usersTable!.set('usr-dev-master', masterUser);
            hasNewSeeds = true;
          } else {
            const wasSealed = masterUser.passwordSealed === true;
            const bootstrapPassword = envDevPassword || 'SetPassword2026';
            masterUser.passwordHash = hashPassword(bootstrapPassword);
            masterUser.passwordSealed = false;
            masterUser.mustChangePassword =
              wasSealed || !envDevPassword || envDevPassword === 'SetPassword2026';
            if (wasSealed) {
              console.info(
                `[Bootstrap Security] Conta master HQ '3eatcru@gmail.com' destravada via INITIAL_DEV_PASSWORD com troca obrigatória no primeiro login.`
              );
            } else if (!envDevPassword) {
              console.info(
                `[Bootstrap Security] INITIAL_DEV_PASSWORD padronizada para '3eatcru@gmail.com' com troca obrigatória no primeiro login.`
              );
            }
            usersTable!.set('usr-dev-master', masterUser);
            hasNewSeeds = true;
          }
        }

        if (hasNewSeeds || migratedGovernance) {
          this.saveImmediately();
        }
      } else {
        this.seed();
        this.replayWalFile();
      }
      this.tables.forEach((_, name) => {
        if (!this.collectionRevisions.has(name)) {
          this.collectionRevisions.set(name, 1);
        }
      });
    } catch (err) {
      console.warn('[Database] Failed to load persistence, starting fresh with seeds.', err);
      this.seed();
    }
  }

  private save() {
    if (this.isCloudActiveGetter()) {
      return;
    }
    if (this.persistTimeout) return;
    this.persistTimeout = setTimeout(() => {
      this.persistTimeout = null;
      void this.saveAsync();
    }, 1500); // Coalesce compaction snapshots into server-db.json
    this.persistTimeout.unref?.();
  }

  private async saveAsync(): Promise<void> {
    if (this.isCloudActiveGetter()) return;
    if (this.asyncPersistInFlight) {
      this.asyncPersistPending = true;
      return;
    }
    this.asyncPersistInFlight = true;
    try {
      const parentDir = path.dirname(DB_FILE);
      try {
        await fs.promises.access(parentDir);
      } catch {
        return;
      }
      const data: Record<string, any[]> = {};
      this.tables.forEach((map, tableName) => {
        data[tableName] = Array.from(map.values());
      });
      const tmpFile = `${DB_FILE}.tmp`;
      await fs.promises.writeFile(tmpFile, JSON.stringify(data), 'utf-8');
      await fs.promises.rename(tmpFile, DB_FILE);
      this.walOpsSinceCompaction = 0;
      await fs.promises.unlink(WAL_FILE).catch(() => {});
    } catch (err: any) {
      if (err?.code === 'ENOENT') return;
      console.error('[Database] Failed to save persistence asynchronously:', err);
    } finally {
      this.asyncPersistInFlight = false;
      if (this.asyncPersistPending) {
        this.asyncPersistPending = false;
        void this.saveAsync();
      }
    }
  }

  public saveImmediately() {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
      this.persistTimeout = null;
    }
    try {
      const parentDir = path.dirname(DB_FILE);
      if (!fs.existsSync(parentDir)) {
        return;
      }
      const data: Record<string, any[]> = {};
      this.tables.forEach((map, tableName) => {
        data[tableName] = Array.from(map.values());
      });
      // P0-05: Compact atomic file write to avoid file corruption & reduce payload size
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(data), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
      this.walOpsSinceCompaction = 0;
      if (fs.existsSync(WAL_FILE)) {
        fs.unlinkSync(WAL_FILE);
      }
    } catch (err: any) {
      if (err?.code === 'ENOENT' && !fs.existsSync(path.dirname(DB_FILE))) {
        return;
      }
      console.error('[Database] Failed to save persistence:', err);
      if (process.env.NODE_ENV === 'production') {
        throw err;
      }
    }
  }

  public recordIncrementalMutations(ops: IncrementalWalOp[]) {
    if (!ops || ops.length === 0) return;
    const touchedCollections = new Set<string>();
    for (const op of ops) {
      if (op.col) touchedCollections.add(op.col);
    }
    this.bumpRevisions(touchedCollections);

    // When PostgreSQL Cloud is active, deltas are already committed directly per-document in SQL.
    // Skip local server-db.json full snapshots so Cloud instances never block the event loop on disk I/O.
    if (this.isCloudActiveGetter()) {
      return;
    }

    try {
      if (!fs.existsSync(path.dirname(DB_FILE))) {
        return;
      }
      const lines = ops.map((op) => JSON.stringify(op)).join('\n') + '\n';
      fs.appendFileSync(WAL_FILE, lines, 'utf-8');
      this.walOpsSinceCompaction += ops.length;
      if (this.walOpsSinceCompaction >= 250) {
        this.saveImmediately();
      } else {
        this.save();
      }
    } catch (err) {
      console.warn('[Database] Incremental WAL append failed, falling back to full snapshot:', err);
      this.saveImmediately();
    }
  }

  async acquireLock(): Promise<() => void> {
    let release: () => void;
    const wait = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.lock;
    this.lock = previous.then(() => wait);
    await previous;
    return release!;
  }

  public seed() {
    const seedTable = (name: string, items: { id: string; [key: string]: any }[]) => {
      const map = new Map<string, any>();
      items.forEach((item) => map.set(item.id, { ...item }));
      this.tables.set(name, map);
    };

    const envDevPassword = process.env.INITIAL_DEV_PASSWORD?.trim();
    console.log('[Database] Autonomous clean bootstrap: seeding platform governance & master HQ only.');
    seedTable('tenants', [
      {
        id: 'tenant-1',
        name: '3C Corp Matriz (HQ)',
        status: 'ACTIVE',
        subscriptionPlan: 'PRO',
        billingCycle: 'MONTHLY',
        maxAllowedBranches: 2,
        maxAllowedDevices: 15,
        saasPaymentStatus: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
    ]);
    seedTable('governance', [{ ...DEFAULT_PLATFORM_GOVERNANCE, id: 'governance' }]);

    const hasSafeProdPassword =
      Boolean(envDevPassword) &&
      envDevPassword!.length >= 8 &&
      envDevPassword !== 'SetPassword2026';
    const strictBlocked = isStrictProdRuntime() && !hasSafeProdPassword;
    const defaultBootstrapPassword = strictBlocked
      ? crypto.randomBytes(32).toString('hex')
      : (envDevPassword || 'SetPassword2026');
    if (strictBlocked) {
      console.error(
        '[Bootstrap Security] PRODUÇÃO: INITIAL_DEV_PASSWORD ausente ou insegura; seed master HQ gerado com chave aleatória selada.'
      );
    } else if (!envDevPassword) {
      console.info(
        `[Bootstrap Security] INITIAL_DEV_PASSWORD padronizada para '3eatcru@gmail.com' com troca obrigatória no primeiro login.`
      );
    }

    seedTable('users', [
      {
        id: 'usr-dev-master',
        uid: 'usr-dev-master',
        name: 'Dono da Plataforma (Master HQ)',
        email: '3eatcru@gmail.com',
        role: 'DEV_OWNER',
        tenantId: 'tenant-1',
        status: 'ACTIVE',
        emailVerified: true,
        passwordSealed: strictBlocked,
        mustChangePassword: strictBlocked || !envDevPassword || envDevPassword === 'SetPassword2026',
        passwordHash: hashPassword(defaultBootstrapPassword),
      },
    ]);
  }

  getTable(name: string): Map<string, any> {
    let t = this.tables.get(name);
    if (!t) {
      t = new Map<string, any>();
      this.tables.set(name, t);
    }
    return t;
  }

  markDirty(immediate = false) {
    if (immediate) {
      if (this.persistTimeout) {
        clearTimeout(this.persistTimeout);
        this.persistTimeout = null;
      }
      this.saveImmediately();
    } else {
      this.save();
    }
  }

  exportSnapshot(): Record<string, any[]> {
    const data: Record<string, any[]> = {};
    this.tables.forEach((map, tableName) => {
      data[tableName] = Array.from(map.values()).map((item) => JSON.parse(JSON.stringify(item)));
    });
    return data;
  }

  async restoreSnapshot(
    snapshot: Record<string, any[]>,
    options?: { skipCloudSync?: boolean }
  ): Promise<number> {
    const release = await this.acquireLock();
    try {
      let restoredDocs = 0;
      const nextTables = new Map<string, Map<string, any>>();
      for (const [tableName, items] of Object.entries(snapshot)) {
        if (!Array.isArray(items)) continue;
        const map = new Map<string, any>();
        for (const item of items) {
          if (item && typeof item.id === 'string' && item.id.trim().length > 0) {
            map.set(item.id, JSON.parse(JSON.stringify(item)));
            restoredDocs++;
          }
        }
        nextTables.set(tableName, map);
      }
      if (!options?.skipCloudSync && this.onRestoreCloudSync) {
        const cleanSnapshot: Record<string, any[]> = {};
        nextTables.forEach((map, tableName) => {
          cleanSnapshot[tableName] = Array.from(map.values());
        });
        await this.onRestoreCloudSync(cleanSnapshot);
      }
      this.tables = nextTables;
      this.bumpRevisions(nextTables.keys());
      this.saveImmediately();
      return restoredDocs;
    } finally {
      release();
    }
  }
}
