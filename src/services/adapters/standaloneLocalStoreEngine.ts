import { DEFAULT_PLATFORM_GOVERNANCE } from '../../constants/platformDefaults';
import {
  CollectionFilter,
  SubscriptionCallback,
  UnsubscribeFn,
} from './StorageAdapterTypes';

/**
 * Low-level in-memory + debounced localStorage persistence engine
 * with cross-tab `storage` synchronization and reactive pub/sub notifications.
 */
export class StandaloneLocalStoreEngine {
  readonly cache: Map<string, Map<string, any>> = new Map();
  private subscribers: Map<
    string,
    Set<{ callback: SubscriptionCallback<any>; filter?: CollectionFilter }>
  > = new Map();
  private initialized = false;
  private dirtyCollections = new Set<string>();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.initDefaultData();
    this.setupCrossTabSync();
    this.setupUnloadFlush();
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  private setupUnloadFlush() {
    if (!this.isBrowser()) return;
    const flush = () => this.flushDirtyCollections();
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
  }

  private setupCrossTabSync() {
    if (!this.isBrowser()) return;
    window.addEventListener('storage', (event) => {
      if (event.key && event.key.startsWith('3ccorp_')) {
        const collectionName = event.key.replace('3ccorp_', '');
        try {
          const raw = event.newValue;
          if (raw) {
            const parsed = JSON.parse(raw);
            const map = new Map<string, any>();
            parsed.forEach((item: any) => map.set(item.id, item));
            this.cache.set(collectionName, map);
            this.notifySubscribers(collectionName);
          }
        } catch {
          // ignore parsing error
        }
      }
    });
  }

  initDefaultData() {
    if (this.initialized) return;

    const loadCollection = <T extends { id: string }>(name: string, defaults: T[]) => {
      const map = new Map<string, any>();
      let loadedFromStorage = false;

      if (this.isBrowser()) {
        try {
          const raw = localStorage.getItem(`3ccorp_${name}`);
          if (raw !== null) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((item: any) => map.set(item.id, item));
              loadedFromStorage = true;
            }
          }
        } catch {
          // ignore parsing error
        }
      }

      if (!loadedFromStorage) {
        defaults.forEach((item) => map.set(item.id, { ...item }));
      }
      this.cache.set(name, map);
    };

    loadCollection('stores', []);
    loadCollection('menu_items', []);
    loadCollection('orders', []);
    loadCollection('tables', []);
    loadCollection('drivers', []);
    loadCollection('customers_crm', []);
    loadCollection('inventory_batches', []);
    loadCollection('financial_records', []);
    loadCollection('device_licenses', []);
    loadCollection('coupons', []);
    loadCollection('integrations', []);
    loadCollection('suppliers', []);
    loadCollection('reservations', []);
    loadCollection('users', []);

    this.cache.set('cash_sessions', new Map<string, any>());

    const govMap = new Map<string, any>();
    govMap.set('governance', { ...DEFAULT_PLATFORM_GOVERNANCE });
    this.cache.set('governance', govMap);

    this.cache.set('events', new Map());
    this.initialized = true;
  }

  private flushDirtyCollections() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (!this.isBrowser() || this.dirtyCollections.size === 0) return;
    const pending = Array.from(this.dirtyCollections);
    this.dirtyCollections.clear();
    for (const collectionName of pending) {
      try {
        const collMap = this.cache.get(collectionName);
        if (collMap) {
          const arr = Array.from(collMap.values());
          localStorage.setItem(`3ccorp_${collectionName}`, JSON.stringify(arr));
        }
      } catch (e) {
        console.warn(`[StandaloneStorage] Persist error for ${collectionName}:`, e);
      }
    }
  }

  persistCollection(collectionName: string) {
    if (!this.isBrowser()) return;
    this.dirtyCollections.add(collectionName);
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.flushDirtyCollections();
    }, 120);
  }

  notifySubscribers(collectionName: string) {
    const subs = this.subscribers.get(collectionName);
    if (!subs || subs.size === 0) return;

    const collMap = this.cache.get(collectionName);
    const allItems = collMap
      ? Array.from(collMap.values()).filter((item: any) => item && !item._deleted)
      : [];

    subs.forEach((sub) => {
      let filtered = allItems;
      if (sub.filter) {
        filtered = allItems.filter((item) => {
          for (const [key, val] of Object.entries(sub.filter || {})) {
            if (val !== undefined && item[key] !== val) return false;
          }
          return true;
        });
      }
      try {
        sub.callback([...filtered]);
      } catch (err) {
        console.error(`[StandaloneStorage] Subscriber error on ${collectionName}:`, err);
      }
    });
  }

  subscribe<T = any>(
    collectionName: string,
    callback: SubscriptionCallback<T>,
    filter?: CollectionFilter
  ): UnsubscribeFn {
    if (!this.subscribers.has(collectionName)) {
      this.subscribers.set(collectionName, new Set());
    }
    const subObj = { callback, filter };
    this.subscribers.get(collectionName)!.add(subObj);

    setTimeout(() => {
      const collMap = this.cache.get(collectionName);
      const allItems = collMap
        ? Array.from(collMap.values()).filter((item: any) => item && !item._deleted)
        : [];
      let filtered = allItems;
      if (filter) {
        filtered = allItems.filter((item) => {
          for (const [key, val] of Object.entries(filter)) {
            if (val !== undefined && item[key] !== val) return false;
          }
          return true;
        });
      }
      callback([...filtered]);
    }, 0);

    return () => {
      const set = this.subscribers.get(collectionName);
      if (set) set.delete(subObj);
    };
  }

  resetToSeeds() {
    this.cache.clear();
    if (this.isBrowser()) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('3ccorp_')) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }
    this.initialized = false;
    this.initDefaultData();
    for (const collName of this.cache.keys()) {
      this.notifySubscribers(collName);
    }
  }
}
