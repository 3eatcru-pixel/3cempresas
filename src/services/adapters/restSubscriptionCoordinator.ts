import { buildStandardContractHeaders, getPlatformAdapters } from '../../core/platform/PlatformAdapter';
import {
  CollectionFilter,
  SubscriptionCallback,
  UnsubscribeFn,
} from './StorageAdapterTypes';

interface ETagCacheEntry {
  etag: string;
  body: any;
}

interface SubscriberEntry<T = any> {
  callback: SubscriptionCallback<T>;
}

interface SubscriberGroup<T = any> {
  key: string;
  collectionName: string;
  filter?: CollectionFilter;
  subscribers: Set<SubscriberEntry<T>>;
  lastData: T[] | null;
  lastSignature: string | null;
  lastKnownRevs: Record<string, number>;
  inFlight: boolean;
}

function computeFastCollectionSignature(data: any[]): string {
  if (!Array.isArray(data)) return String(data);
  const len = data.length;
  if (len === 0) return '0';
  let hash = 2166136261 ^ len;
  for (let i = 0; i < len; i++) {
    const item = data[i];
    const token =
      item && typeof item === 'object'
        ? `${item.id ?? ''}|${item.updatedAt ?? item.createdAt ?? item.hlc ?? ''}|${item.status ?? ''}|${item.price ?? item.total ?? item.quantity ?? ''}|${item.available ?? item.isActive ?? ''}`
        : String(item);
    for (let j = 0; j < token.length; j++) {
      hash ^= token.charCodeAt(j);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `${len}:${hash >>> 0}`;
}

const VIRTUAL_COLLECTION_REVISION_DEPS: Record<string, string[]> = {
  store_staff: ['users', 'store_staff'],
  store_devices: ['device_licenses', 'store_devices'],
};

/**
 * Coordinates HTTP ETag caching, `/system/revisions` delta polling,
 * browser visibility/hint events, and reactive collection subscriptions
 * for ServerCoreRESTAdapter.
 */
export class RestSubscriptionCoordinator {
  private subscriberGroups = new Map<string, SubscriberGroup<any>>();
  private coordinatorTimer: ReturnType<typeof setTimeout> | null = null;
  private lastGlobalRevision = -1;
  private latestServerRevisions: Record<string, number> = {};
  private etagCache = new Map<string, ETagCacheEntry>();
  private browserListenersBound = false;

  constructor(
    private readonly queryDocumentsFn: <T = any>(
      collectionName: string,
      filter?: CollectionFilter
    ) => Promise<T[]>
  ) {
    this.bindBrowserListeners();
  }

  private bindBrowserListeners() {
    if (this.browserListenersBound || typeof window === 'undefined') return;
    this.browserListenersBound = true;

    window.addEventListener('3c:auth-invalidated', () => {
      this.etagCache.clear();
      this.lastGlobalRevision = -1;
    });

    window.addEventListener('3c:collection-hint', (ev: Event) => {
      const detail = (ev as CustomEvent<{ collections?: string[] }>).detail;
      if (Array.isArray(detail?.collections)) {
        for (const col of detail.collections) {
          this.invalidateCollection(col);
        }
      }
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.subscriberGroups.size > 0) {
          void this.runCoordinatorTick(true);
        }
      });
    }
  }

  private getBaseUrl(): string {
    return getPlatformAdapters().network.getApiBaseUrl();
  }

  private getAuthCacheScope(): string {
    const token = getPlatformAdapters().storage.getItem('3ccorp_auth_token') || 'anon';
    return token.slice(-16);
  }

  private async getHeaders(method = 'GET') {
    const isMutation = method !== 'GET' && method !== 'HEAD';
    return buildStandardContractHeaders({ includeIdempotencyKey: isMutation });
  }

  async request(path: string, method = 'GET', body?: any) {
    const existingToken = getPlatformAdapters().storage.getItem('3ccorp_auth_token');
    const headers: Record<string, string> = { ...(await this.getHeaders(method)) };
    const isGet = method === 'GET';
    const cacheKey = isGet ? `${this.getAuthCacheScope()}:${path}` : '';

    if (isGet) {
      const cached = this.etagCache.get(cacheKey);
      if (cached?.etag) {
        headers['If-None-Match'] = cached.etag;
      }
    }

    const resp = await fetch(`${this.getBaseUrl()}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (isGet && resp.status === 304) {
      const cached = this.etagCache.get(cacheKey);
      if (cached) {
        return cached.body;
      }
    }

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => resp.statusText);
      if (
        existingToken &&
        (resp.status === 401 ||
          (resp.status === 403 && /desativad|suspens|revogad/i.test(errorText || '')))
      ) {
        this.etagCache.clear();
        getPlatformAdapters().storage.removeItem('3ccorp_auth_token');
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(
            new CustomEvent('3c:auth-invalidated', {
              detail: { reason: errorText || resp.statusText || 'UNAUTHORIZED' },
            })
          );
        }
      }
      console.warn(`[Storage] Notice on ${path}: ${resp.status}`);
      const err: any = new Error(`Server error (${resp.status}): ${errorText || resp.statusText}`);
      err.status = resp.status;
      throw err;
    }

    const json = await resp.json();
    if (isGet) {
      const etag = resp.headers.get('etag');
      if (etag) {
        if (this.etagCache.size > 200) {
          this.etagCache.clear();
        }
        this.etagCache.set(cacheKey, { etag, body: json });
      }
    }
    return json;
  }

  private getTrackedRevisionKeys(collectionName: string): string[] {
    return VIRTUAL_COLLECTION_REVISION_DEPS[collectionName] || [collectionName];
  }

  private getStableGroupKey(collectionName: string, filter?: CollectionFilter): string {
    if (!filter) return `${collectionName}::{}`;
    const sortedEntries = Object.keys(filter)
      .sort()
      .filter((k) => (filter as any)[k] !== undefined)
      .map((k) => [k, (filter as any)[k]]);
    return `${collectionName}::${JSON.stringify(sortedEntries)}`;
  }

  private clearEtagsForCollection(collectionName: string) {
    const keys = this.getTrackedRevisionKeys(collectionName);
    for (const cacheKey of Array.from(this.etagCache.keys())) {
      if (
        keys.some((k) => cacheKey.includes(k)) ||
        (collectionName === 'menu_items' && cacheKey.includes('/store/menu')) ||
        (collectionName === 'stores' && cacheKey.includes('/store')) ||
        (collectionName === 'financial_records' && cacheKey.includes('/store/finance')) ||
        (collectionName === 'inventory_batches' && cacheKey.includes('/store/inventory')) ||
        (collectionName === 'customers_crm' && cacheKey.includes('/store/customers')) ||
        (collectionName === 'cash_sessions' && cacheKey.includes('/store/cash')) ||
        (collectionName === 'device_licenses' && cacheKey.includes('/devices')) ||
        (collectionName === 'store_staff' && cacheKey.includes('/store/staff')) ||
        (collectionName === 'store_devices' && cacheKey.includes('/store/devices'))
      ) {
        this.etagCache.delete(cacheKey);
      }
    }
  }

  invalidateCollection(collectionName: string) {
    this.clearEtagsForCollection(collectionName);
    this.lastGlobalRevision = -1;
    const deps = new Set(this.getTrackedRevisionKeys(collectionName));
    for (const group of this.subscriberGroups.values()) {
      const groupDeps = this.getTrackedRevisionKeys(group.collectionName);
      if (
        group.collectionName === collectionName ||
        groupDeps.some((d) => deps.has(d) || d === collectionName)
      ) {
        void this.refreshGroup(group);
      }
    }
  }

  private async refreshGroup(group: SubscriberGroup<any>, serverRevs?: Record<string, number>) {
    if (group.inFlight || group.subscribers.size === 0) return;
    group.inFlight = true;
    try {
      const data = await this.queryDocumentsFn<any>(group.collectionName, group.filter);
      if (serverRevs) {
        for (const dep of this.getTrackedRevisionKeys(group.collectionName)) {
          group.lastKnownRevs[dep] = serverRevs[dep] ?? group.lastKnownRevs[dep] ?? 1;
        }
      }
      const nextSig = computeFastCollectionSignature(data);
      const changed = nextSig !== group.lastSignature || group.lastData === null;
      if (changed) {
        group.lastSignature = nextSig;
        group.lastData = data;
        for (const sub of group.subscribers) {
          try {
            sub.callback(data);
          } catch {
            // keep other subscribers isolated
          }
        }
      }
    } catch {
      // poll notice ignored silently
    } finally {
      group.inFlight = false;
    }
  }

  private scheduleNextCoordinatorTick() {
    if (this.coordinatorTimer || this.subscriberGroups.size === 0) return;
    const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const delayMs = isHidden ? 20_000 : 5_000;
    this.coordinatorTimer = setTimeout(() => {
      this.coordinatorTimer = null;
      void this.runCoordinatorTick(false);
    }, delayMs);
    (this.coordinatorTimer as any)?.unref?.();
  }

  private async runCoordinatorTick(forceCheck: boolean) {
    if (this.subscriberGroups.size === 0) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && !forceCheck) {
      this.scheduleNextCoordinatorTick();
      return;
    }

    try {
      const revResp = await fetch(`${this.getBaseUrl()}/system/revisions`, {
        method: 'GET',
        headers: await this.getHeaders('GET'),
      });
      if (revResp.ok) {
        const revData = (await revResp.json()) as {
          revision?: number;
          collections?: Record<string, number>;
        };
        const serverGlobalRev = Number(revData?.revision ?? -1);
        const serverCollections = revData?.collections || {};
        this.latestServerRevisions = serverCollections;

        if (serverGlobalRev !== -1 && serverGlobalRev === this.lastGlobalRevision && !forceCheck) {
          return;
        }

        this.lastGlobalRevision = serverGlobalRev;
        const refreshes: Promise<void>[] = [];
        for (const group of this.subscriberGroups.values()) {
          const deps = this.getTrackedRevisionKeys(group.collectionName);
          const changed = deps.some((dep) => {
            const currentRev = serverCollections[dep];
            const prevRev = group.lastKnownRevs[dep];
            return currentRev !== undefined && currentRev !== prevRev;
          });
          if (changed || group.lastSignature === null) {
            this.clearEtagsForCollection(group.collectionName);
            refreshes.push(this.refreshGroup(group, serverCollections));
          }
        }
        if (serverCollections['governance'] !== undefined && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('3c:auth-providers-changed'));
        }
        if (refreshes.length > 0) {
          await Promise.allSettled(refreshes);
        }
        return;
      }
    } catch {
      // Fallback gracefully if /system/revisions is unreachable
    } finally {
      if (this.subscriberGroups.size > 0) {
        this.scheduleNextCoordinatorTick();
      }
    }

    await Promise.allSettled(
      Array.from(this.subscriberGroups.values()).map((g) => this.refreshGroup(g))
    );
  }

  subscribe<T = any>(
    collectionName: string,
    callback: SubscriptionCallback<T>,
    filter?: CollectionFilter
  ): UnsubscribeFn {
    const key = this.getStableGroupKey(collectionName, filter);
    let group = this.subscriberGroups.get(key);
    const entry: SubscriberEntry<T> = { callback };

    if (!group) {
      const initialRevs: Record<string, number> = {};
      for (const dep of this.getTrackedRevisionKeys(collectionName)) {
        if (this.latestServerRevisions[dep] !== undefined) {
          initialRevs[dep] = this.latestServerRevisions[dep];
        }
      }
      group = {
        key,
        collectionName,
        filter,
        subscribers: new Set([entry]),
        lastData: null,
        lastSignature: null,
        lastKnownRevs: initialRevs,
        inFlight: false,
      };
      this.subscriberGroups.set(key, group);
      void this.refreshGroup(group, this.latestServerRevisions);
    } else {
      group.subscribers.add(entry);
      if (group.lastData !== null) {
        callback(group.lastData);
      } else {
        void this.refreshGroup(group, this.latestServerRevisions);
      }
    }

    this.scheduleNextCoordinatorTick();

    return () => {
      const activeGroup = this.subscriberGroups.get(key);
      if (!activeGroup) return;
      activeGroup.subscribers.delete(entry);
      if (activeGroup.subscribers.size === 0) {
        this.subscriberGroups.delete(key);
      }
      if (this.subscriberGroups.size === 0 && this.coordinatorTimer) {
        clearTimeout(this.coordinatorTimer);
        this.coordinatorTimer = null;
      }
    };
  }
}
