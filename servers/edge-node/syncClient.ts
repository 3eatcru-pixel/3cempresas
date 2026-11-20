import { SqliteWalDriver } from '../../src/server/persistence/SqliteWalDriver.ts';
import { compareHlcTimestamps } from '../../src/server/persistence/PersistenceDriver.ts';
import { generateHlcTimestamp } from '@3c/commerce-engine';
import { assertSecureCloudUrl } from './helpers.ts';

export type EdgeSyncState =
  | 'IDLE'
  | 'SYNCING'
  | 'OK'
  | 'DEGRADED'
  | 'OFFLINE'
  | 'PARTIAL_PENDING';

export type EdgeCloudLinkStatus = 'UNCONFIGURED' | 'LINKED' | 'UNREACHABLE';

export interface EdgeCloudSnapshot {
  tenant?: any;
  store?: any;
  menuItems?: any[];
  tables?: any[];
  inventoryBatches?: any[];
  reservations?: any[];
  users?: any[];
  coupons?: any[];
  cashSessions?: any[];
  orders?: any[];
  customersCrm?: any[];
  financialRecords?: any[];
  suppliers?: any[];
  deviceLicenses?: any[];
  waiterTerminals?: any[];
}

export interface EdgeSyncReport {
  pushedAccepted: number;
  pushedDeduplicated: number;
  pulledEntries: number;
  hasMore?: boolean;
  syncState?: EdgeSyncState;
}

export class EdgeSyncClient {
  public lastPullHlc = '';
  public lastCloudSyncAt: string | null = null;
  public lastPartialSyncAt: string | null = null;
  public lastFullSyncAt: string | null = null;
  public lastSyncAttemptAt: string | null = null;
  public lastSyncError: string | null = null;
  public activeEdgeToken?: string;
  public edgeTokenExpiresAt?: string;
  public cursorLoaded = false;
  public syncState: EdgeSyncState = 'IDLE';
  public unresolvedConflictsCount = 0;
  public cloudLinkStatus: EdgeCloudLinkStatus = 'UNCONFIGURED';
  public autoSyncTimer: ReturnType<typeof setInterval> | null = null;
  public syncFollowupTimer: ReturnType<typeof setTimeout> | null = null;
  private syncInFlight: Promise<EdgeSyncReport> | null = null;
  private isClosed = false;

  constructor(
    private readonly driver: SqliteWalDriver,
    private readonly nodeId: string,
    private readonly storeId: string
  ) {}

  markClosed(): void {
    this.isClosed = true;
    this.stopAutoSync();
  }

  async ensureCursorLoaded(): Promise<void> {
    if (this.cursorLoaded) return;
    this.cursorLoaded = true;
    const saved = await this.driver.getDoc<any>('sync_metadata', 'cursor');
    if (saved) {
      if (typeof saved.lastPullHlc === 'string' && saved.lastPullHlc) {
        this.lastPullHlc = saved.lastPullHlc;
      }
      if (typeof saved.lastCloudSyncAt === 'string') {
        this.lastCloudSyncAt = saved.lastCloudSyncAt;
      }
      if (typeof saved.lastPartialSyncAt === 'string') {
        this.lastPartialSyncAt = saved.lastPartialSyncAt;
      }
      if (typeof saved.lastFullSyncAt === 'string') {
        this.lastFullSyncAt = saved.lastFullSyncAt;
      }
      if (typeof saved.lastSyncAttemptAt === 'string') {
        this.lastSyncAttemptAt = saved.lastSyncAttemptAt;
      }
      if (typeof saved.edgeTokenExpiresAt === 'string') {
        this.edgeTokenExpiresAt = saved.edgeTokenExpiresAt;
      }
    }
  }

  async persistCursorMetadata(): Promise<void> {
    await this.driver.setDoc(
      'sync_metadata',
      'cursor',
      {
        id: 'cursor',
        lastPullHlc: this.lastPullHlc || '',
        lastSyncAttemptAt: this.lastSyncAttemptAt,
        lastCloudSyncAt: this.lastCloudSyncAt,
        lastPartialSyncAt: this.lastPartialSyncAt,
        lastFullSyncAt: this.lastFullSyncAt,
        edgeTokenExpiresAt: this.edgeTokenExpiresAt || null,
        updatedAt: new Date().toISOString(),
      },
      true
    );
  }

  async seedFromCloudSnapshot(snapshot: EdgeCloudSnapshot): Promise<void> {
    const batch: Array<{ collection: string; id: string; data: any; merge?: boolean }> = [];
    if (snapshot.tenant?.id) {
      batch.push({ collection: 'tenants', id: snapshot.tenant.id, data: snapshot.tenant, merge: true });
    }
    if (snapshot.store?.id) {
      batch.push({ collection: 'stores', id: snapshot.store.id, data: snapshot.store, merge: true });
    }
    const collectionWrites: Array<[string, any[] | undefined]> = [
      ['menu_items', snapshot.menuItems],
      ['tables', snapshot.tables],
      ['inventory_batches', snapshot.inventoryBatches],
      ['reservations', snapshot.reservations],
      ['coupons', snapshot.coupons],
      ['cash_sessions', snapshot.cashSessions],
      ['orders', snapshot.orders],
      ['customers_crm', snapshot.customersCrm],
      ['financial_records', snapshot.financialRecords],
      ['suppliers', snapshot.suppliers],
      ['device_licenses', snapshot.deviceLicenses],
      ['waiter_terminals', snapshot.waiterTerminals],
    ];
    for (const [collectionName, list] of collectionWrites) {
      for (const doc of list || []) {
        if (doc?.id) {
          batch.push({ collection: collectionName, id: doc.id, data: doc, merge: true });
        }
      }
    }
    for (const user of snapshot.users || []) {
      const uid = user.uid || user.id;
      if (!uid) continue;
      const sanitizedUser = { ...user };
      delete sanitizedUser.passwordHash;
      batch.push({ collection: 'users', id: uid, data: sanitizedUser, merge: true });
    }
    await this.driver.bulkSetDocs(batch);
  }

  async registerWithCloud(
    cloudBaseUrl: string,
    adminToken: string,
    hostname?: string
  ): Promise<{ edgeToken: string; edgeTokenExpiresAt: string }> {
    const cleanCloud = assertSecureCloudUrl(cloudBaseUrl);
    const resp = await fetch(`${cleanCloud}/api/v1/sync/edge/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        nodeId: this.nodeId,
        storeId: this.storeId,
        hostname: hostname || `edge-${this.storeId}`,
      }),
    });
    const body: any = await resp.json().catch(() => ({}));
    if (!resp.ok || !body?.edgeToken) {
      throw new Error(body?.error || `Falha ao registrar identidade técnica Edge (HTTP ${resp.status})`);
    }
    this.activeEdgeToken = body.edgeToken;
    this.edgeTokenExpiresAt = body.edgeTokenExpiresAt;
    await this.persistCursorMetadata();
    return { edgeToken: body.edgeToken, edgeTokenExpiresAt: body.edgeTokenExpiresAt };
  }

  private async tryRefreshEdgeToken(cloudBaseUrl: string, currentToken: string): Promise<string | null> {
    if (!currentToken.startsWith('edg-tok:')) return null;
    const cleanCloud = assertSecureCloudUrl(cloudBaseUrl);
    const resp = await fetch(`${cleanCloud}/api/v1/sync/edge/token/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ nodeId: this.nodeId }),
    });
    if (!resp.ok) return null;
    const data: any = await resp.json().catch(() => ({}));
    if (data?.edgeToken) {
      this.activeEdgeToken = data.edgeToken;
      this.edgeTokenExpiresAt = data.edgeTokenExpiresAt;
      await this.persistCursorMetadata();
      return data.edgeToken;
    }
    return null;
  }

  async bootstrapFromCloud(cloudBaseUrl: string, bearerToken: string): Promise<void> {
    await this.ensureCursorLoaded();
    this.lastSyncAttemptAt = new Date().toISOString();
    try {
      const cleanCloud = assertSecureCloudUrl(cloudBaseUrl);
      const tokenToUse =
        this.activeEdgeToken && bearerToken.startsWith('edg-tok:') ? this.activeEdgeToken : bearerToken;
      const resp = await fetch(`${cleanCloud}/api/v1/sync/edge/bootstrap/${encodeURIComponent(this.storeId)}`, {
        headers: {
          Authorization: `Bearer ${tokenToUse}`,
          'X-3C-App-Id': 'server-core',
          'X-3C-Platform': 'edge-node-sqlite',
        },
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.error || `Edge bootstrap HTTP ${resp.status}`);
      }
      const snapshot = await resp.json();
      await this.seedFromCloudSnapshot(snapshot);
      if (snapshot.serverHlc) {
        this.lastPullHlc = snapshot.serverHlc;
      }
      this.cloudLinkStatus = 'LINKED';
      this.syncState = 'OK';
      this.lastSyncError = null;
      await this.persistCursorMetadata();
    } catch (err: any) {
      this.cloudLinkStatus = 'UNREACHABLE';
      this.syncState = 'OFFLINE';
      this.lastSyncError = err?.message || 'Bootstrap Cloud falhou.';
      await this.persistCursorMetadata().catch(() => {});
      throw err;
    }
  }

  async syncWithCloud(cloudBaseUrl: string, bearerToken: string): Promise<EdgeSyncReport> {
    if (this.syncInFlight) {
      return this.syncInFlight;
    }
    if (this.syncFollowupTimer) {
      clearTimeout(this.syncFollowupTimer);
      this.syncFollowupTimer = null;
    }
    this.syncInFlight = this.executeSyncWithCloud(cloudBaseUrl, bearerToken).finally(() => {
      this.syncInFlight = null;
    });
    return this.syncInFlight;
  }

  private async executeSyncWithCloud(cloudBaseUrl: string, bearerToken: string): Promise<EdgeSyncReport> {
    await this.ensureCursorLoaded();
    this.lastSyncAttemptAt = new Date().toISOString();
    this.syncState = 'SYNCING';
    try {
      const cleanCloud = assertSecureCloudUrl(cloudBaseUrl);
      let activeToken =
        bearerToken.startsWith('edg-tok:')
          ? (this.activeEdgeToken || bearerToken)
          : bearerToken;
      if (bearerToken.startsWith('edg-tok:') && !this.activeEdgeToken) {
        this.activeEdgeToken = bearerToken;
      }

      if (activeToken.startsWith('edg-tok:') && this.edgeTokenExpiresAt) {
        const expMs = Date.parse(this.edgeTokenExpiresAt);
        if (Number.isFinite(expMs) && expMs - Date.now() < 5 * 60 * 1000) {
          const refreshed = await this.tryRefreshEdgeToken(cleanCloud, activeToken).catch(() => null);
          if (refreshed) activeToken = refreshed;
        }
      }

      const fetchWithTokenRefresh = async (url: string, init: RequestInit): Promise<Response> => {
        const first = await fetch(url, {
          ...init,
          headers: { ...(init.headers || {}), Authorization: `Bearer ${activeToken}` },
        });
        if (first.status === 401 && activeToken.startsWith('edg-tok:')) {
          const refreshed = await this.tryRefreshEdgeToken(cleanCloud, activeToken).catch(() => null);
          if (refreshed) {
            activeToken = refreshed;
            return fetch(url, {
              ...init,
              headers: { ...(init.headers || {}), Authorization: `Bearer ${activeToken}` },
            });
          }
        }
        return first;
      };

      const allOutbox = await this.driver.listDocs<any>('sync_outbox');
      const pending = allOutbox
        .filter((entry) => !entry.syncedToCloudAt)
        .sort((a, b) => compareHlcTimestamps(a.hlc, b.hlc));

      let pushedAccepted = 0;
      let pushedDeduplicated = 0;
      let conflictCount = 0;

      const PUSH_CHUNK_SIZE = 200;
      for (let offset = 0; offset < pending.length; offset += PUSH_CHUNK_SIZE) {
        const chunk = pending.slice(offset, offset + PUSH_CHUNK_SIZE);
        const pushResp = await fetchWithTokenRefresh(`${cleanCloud}/api/v1/sync/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-3C-App-Id': 'store-os',
            'X-3C-Platform': 'edge-node-sqlite',
          },
          body: JSON.stringify({
            nodeId: this.nodeId,
            storeId: this.storeId,
            mutations: chunk.map((m) => ({
              idempotencyKey: m.idempotencyKey || m.id,
              entity: m.entity,
              entityId: m.entityId,
              operation: m.operation,
              hlc: m.hlc,
              deltaQty: m.deltaQty,
              ...(typeof m.deltaUsage === 'number' ? { deltaUsage: m.deltaUsage } : {}),
              ...(Array.isArray(m.variantDeltas) && m.variantDeltas.length > 0 ? { variantDeltas: m.variantDeltas } : {}),
              payload: m.payload,
            })),
          }),
        });
        if (!pushResp.ok) {
          const errBody = await pushResp.json().catch(() => ({}));
          throw new Error(errBody?.error || `Cloud push HTTP ${pushResp.status}`);
        }
        const pushJson = await pushResp.json();
        pushedAccepted += pushJson.accepted?.length || 0;
        pushedDeduplicated += pushJson.deduplicated?.length || 0;
        conflictCount += (pushJson.conflicts?.length || 0) + (pushJson.rejected?.length || 0);

        const acknowledgedKeys = new Set<string>([
          ...(pushJson.accepted || []).map((a: any) => a.idempotencyKey).filter(Boolean),
          ...(pushJson.deduplicated || []).map((d: any) => d.idempotencyKey).filter(Boolean),
        ]);

        const terminalConflictKeys = new Map<string, string>();
        for (const c of (pushJson.conflicts || [])) {
          if (c?.idempotencyKey) terminalConflictKeys.set(c.idempotencyKey, c.reason || 'CONFLICT');
        }
        for (const r of (pushJson.rejected || [])) {
          if (r?.idempotencyKey) terminalConflictKeys.set(r.idempotencyKey, r.reason || 'REJECTED');
        }

        const syncedIso = new Date().toISOString();
        for (const entry of chunk) {
          const key = entry.idempotencyKey || entry.id;
          if (acknowledgedKeys.has(key)) {
            await this.driver.updateDoc('sync_outbox', entry.id, { syncedToCloudAt: syncedIso });
          } else if (terminalConflictKeys.has(key)) {
            await this.driver.updateDoc('sync_outbox', entry.id, {
              syncedToCloudAt: syncedIso,
              syncError: terminalConflictKeys.get(key),
            });
          }
        }
      }

      let totalPulledEntries = 0;
      let hasMore = true;
      let pageCount = 0;
      const MAX_PULL_PAGES = 50;

      while (hasMore && pageCount < MAX_PULL_PAGES) {
        pageCount += 1;
        const qs = new URLSearchParams({ storeId: this.storeId, limit: '200' });
        if (this.lastPullHlc) qs.set('sinceHlc', this.lastPullHlc);

        const pullResp = await fetchWithTokenRefresh(`${cleanCloud}/api/v1/sync/pull?${qs.toString()}`, {});
        if (!pullResp.ok) {
          throw new Error(`Cloud pull HTTP ${pullResp.status}`);
        }
        const pullJson = await pullResp.json();
        const entries: any[] = pullJson.entries || [];
        totalPulledEntries += entries.length;

        const advancingCursor =
          pullJson.nextHlc && entries.length > 0 && pullJson.nextHlc !== this.lastPullHlc
            ? String(pullJson.nextHlc)
            : null;

        await this.driver.runTransaction(async (tx) => {
          for (const entry of entries) {
            if (!entry?.entity || !entry?.entityId) continue;
            if (entry.operation === 'DELETE' || entry.payload?._deleted === true) {
              tx.delete({ collectionName: entry.entity, id: entry.entityId });
            } else if (entry.payload) {
              const snap = await tx.get({ collectionName: entry.entity, id: entry.entityId });
              const localDoc = snap.exists ? snap.data() : null;
              if (!localDoc || !localDoc.hlc || compareHlcTimestamps(entry.hlc, localDoc.hlc) >= 0) {
                tx.set(
                  { collectionName: entry.entity, id: entry.entityId },
                  { ...entry.payload, hlc: entry.hlc },
                  { merge: true }
                );
              }
            }
          }
          if (advancingCursor) {
            tx.set(
              { collectionName: 'sync_metadata', id: 'cursor' },
              {
                id: 'cursor',
                lastPullHlc: advancingCursor,
                lastSyncAttemptAt: this.lastSyncAttemptAt,
                lastCloudSyncAt: this.lastCloudSyncAt,
                lastPartialSyncAt: this.lastPartialSyncAt,
                lastFullSyncAt: this.lastFullSyncAt,
                edgeTokenExpiresAt: this.edgeTokenExpiresAt || null,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
          }
        });

        if (advancingCursor) {
          this.lastPullHlc = advancingCursor;
          hasMore = Boolean(pullJson.hasMore);
        } else {
          hasMore = false;
        }
      }

      const syncDoneIso = new Date().toISOString();
      this.lastSyncError = null;
      this.cloudLinkStatus = 'LINKED';

      const refreshedOutbox = await this.driver.listDocs<any>('sync_outbox');
      const remainingUnsynced = refreshedOutbox.filter((o) => !o.syncedToCloudAt).length;
      this.unresolvedConflictsCount = conflictCount;

      if (hasMore) {
        this.syncState = 'PARTIAL_PENDING';
        this.lastPartialSyncAt = syncDoneIso;
        console.warn(
          `[3C Edge Node Standard] Sincronização atingiu o teto de ${MAX_PULL_PAGES} páginas com deltas pendentes (hasMore=true). Agendando rodada subsequente.`
        );
        if (!this.isClosed && !this.syncFollowupTimer) {
          this.syncFollowupTimer = setTimeout(() => {
            this.syncFollowupTimer = null;
            if (!this.isClosed) {
              void this.syncWithCloud(cleanCloud, this.activeEdgeToken || activeToken).catch((err: any) => {
                console.warn(`[3C Edge Node Standard] Rodada subsequente de sync falhou: ${err?.message || err}`);
              });
            }
          }, 500);
        }
      } else {
        this.lastCloudSyncAt = syncDoneIso;
        this.lastFullSyncAt = syncDoneIso;
        this.syncState = conflictCount > 0 ? 'DEGRADED' : 'OK';
      }

      await this.persistCursorMetadata();

      await fetchWithTokenRefresh(`${cleanCloud}/api/v1/sync/edge/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeId: this.nodeId,
          storeId: this.storeId,
          lastHlc: this.lastPullHlc || generateHlcTimestamp(this.nodeId),
          pendingOutboxCount: remainingUnsynced,
          unresolvedConflictsCount: conflictCount,
          syncState: this.syncState,
        }),
      }).catch((hbErr: any) => {
        console.warn(`[3C Edge Node Standard] Heartbeat Cloud falhou: ${hbErr?.message || hbErr}`);
      });

      return {
        pushedAccepted,
        pushedDeduplicated,
        pulledEntries: totalPulledEntries,
        hasMore,
        syncState: this.syncState,
      };
    } catch (err: any) {
      this.syncState = 'OFFLINE';
      this.cloudLinkStatus = 'UNREACHABLE';
      this.lastSyncError = err?.message || 'Falha de sincronização com 3C Cloud.';
      await this.persistCursorMetadata().catch(() => {});
      throw err;
    }
  }

  startAutoSync(
    cloudBaseUrl: string,
    bearerToken: string,
    intervalMs = Number(process.env.EDGE_AUTO_SYNC_MS || 15000)
  ): void {
    const cleanCloud = assertSecureCloudUrl(cloudBaseUrl);
    if (bearerToken.startsWith('edg-tok:')) {
      this.activeEdgeToken = bearerToken;
    }
    this.stopAutoSync();
    const safeInterval = Math.max(2000, intervalMs);
    this.autoSyncTimer = setInterval(() => {
      const currentToken = this.activeEdgeToken || bearerToken;
      void this.syncWithCloud(cleanCloud, currentToken).catch((err: any) => {
        console.warn(`[3C Edge Node Standard] Auto-sync falhou (${this.storeId}): ${err?.message || err}`);
      });
    }, safeInterval);
  }

  stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
    if (this.syncFollowupTimer) {
      clearTimeout(this.syncFollowupTimer);
      this.syncFollowupTimer = null;
    }
  }
}
