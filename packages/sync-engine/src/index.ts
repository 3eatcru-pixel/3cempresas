import { apiClient } from '@3c/api-client';
import { getPlatformAdapters } from '@3c/platform-adapters';
import { OfflineMutationEntity, OfflinePendingMutation, StorageService, SyncConflictRecord } from './storage.ts';

export { StorageService };
export type { OfflineMutationEntity, OfflinePendingMutation, SyncConflictRecord };

export interface EdgePairingConfig {
  nodeId: string;
  storeId: string;
  storeName?: string;
  edgeBaseUrl: string;
  hostname?: string;
  lanIp?: string;
  port?: number;
  preferLan?: boolean;
  pairedAt: string;
}

export type SyncTransport = 'CLOUD' | 'EDGE_LAN' | 'OFFLINE';

export interface SyncSnapshot {
  isOnline: boolean;
  activeTransport: SyncTransport;
  isSyncing: boolean;
  pendingOrdersCount: number;
  pendingMutationsCount: number;
  conflictsCount: number;
  conflicts: SyncConflictRecord[];
  totalPendingCount: number;
  lastSyncedAt: string | null;
  lastHlc: string | null;
  pairedEdge: EdgePairingConfig | null;
  lastError: string | null;
}

const EDGE_PAIRING_STORAGE_KEY = '3ccorp_edge_pairing';
const LAST_HLC_STORAGE_KEY = '3ccorp_sync_last_hlc';

class SyncEngineService {
  private listeners = new Set<(snapshot: SyncSnapshot) => void>();
  private inFlightFlush: Promise<{ syncedOrders: number; syncedMutations: number }> | null = null;
  private initialized = false;
  private state: SyncSnapshot = {
    isOnline: true,
    activeTransport: 'CLOUD',
    isSyncing: false,
    pendingOrdersCount: 0,
    pendingMutationsCount: 0,
    conflictsCount: 0,
    conflicts: [],
    totalPendingCount: 0,
    lastSyncedAt: null,
    lastHlc: null,
    pairedEdge: null,
    lastError: null,
  };

  private ensureInit() {
    if (this.initialized) return;
    this.initialized = true;

    const platform = getPlatformAdapters();
    const savedPairingRaw = platform.storage.getItem(EDGE_PAIRING_STORAGE_KEY);
    let parsedPairing: EdgePairingConfig | null = null;
    if (savedPairingRaw) {
      try {
        parsedPairing = JSON.parse(savedPairingRaw);
        if (parsedPairing?.edgeBaseUrl) {
          platform.network.setEdgeBaseUrl(parsedPairing.edgeBaseUrl);
        }
      } catch {
        parsedPairing = null;
      }
    }

    const savedHlc = platform.storage.getItem(LAST_HLC_STORAGE_KEY);
    const isOnline = platform.network.isOnline();

    this.state = {
      ...this.state,
      isOnline,
      pairedEdge: parsedPairing,
      lastHlc: savedHlc,
      activeTransport: this.resolveTransport(isOnline, parsedPairing),
    };

    platform.network.subscribeNetworkChanges((online) => {
      this.updateState({
        isOnline: online,
        activeTransport: this.resolveTransport(online, this.state.pairedEdge),
      });
      if (online) {
        void this.flushAll();
      }
    });

    void this.refreshCounts();
  }

  private resolveTransport(
    isOnline: boolean,
    pairedEdge: EdgePairingConfig | null
  ): SyncSnapshot['activeTransport'] {
    if (pairedEdge?.edgeBaseUrl && (!isOnline || pairedEdge.preferLan)) {
      return 'EDGE_LAN';
    }
    if (!isOnline) {
      return 'OFFLINE';
    }
    return 'CLOUD';
  }

  private updateState(patch: Partial<SyncSnapshot>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((cb) => {
      try {
        cb(this.state);
      } catch {
        // ignore subscriber errors
      }
    });
  }

  getSnapshot(): SyncSnapshot {
    this.ensureInit();
    return this.state;
  }

  subscribe(listener: (snapshot: SyncSnapshot) => void): () => void {
    this.ensureInit();
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async refreshCounts(): Promise<void> {
    try {
      const [orders, mutations, conflicts] = await Promise.all([
        StorageService.getPendingOrders(),
        StorageService.getPendingMutations(),
        StorageService.getSyncConflicts(),
      ]);
      this.updateState({
        pendingOrdersCount: orders.length,
        pendingMutationsCount: mutations.length,
        conflictsCount: conflicts.length,
        conflicts,
        totalPendingCount: orders.length + mutations.length,
      });
    } catch {
      // IndexedDB may be unavailable in restricted contexts
    }
  }

  async dismissConflict(id: string): Promise<void> {
    await StorageService.removeSyncConflict(id);
    await this.refreshCounts();
  }

  async clearConflicts(): Promise<void> {
    await StorageService.clearSyncConflicts();
    await this.refreshCounts();
  }

  async pairEdgeNode(
    params: {
      storeId: string;
      storeName?: string;
      edgeBaseUrl: string;
      hostname?: string;
      lanIp?: string;
      port?: number;
      preferLan?: boolean;
    },
    token?: string
  ): Promise<EdgePairingConfig> {
    this.ensureInit();
    const cleanUrl = params.edgeBaseUrl.trim().replace(/\/$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      throw new Error('URL do 3C Edge Node deve iniciar com http:// ou https://');
    }

    const platform = getPlatformAdapters();
    let registeredNodeId = this.state.pairedEdge?.nodeId;

    if (platform.network.isOnline()) {
      const resp = await apiClient.registerEdgeNode(
        {
          nodeId: registeredNodeId,
          storeId: params.storeId,
          hostname: params.hostname || `edge-${params.storeId}`,
          lanIp: params.lanIp,
          port: params.port || 3300,
          platform: platform.target,
          lastHlc: this.state.lastHlc || undefined,
        },
        token
      );
      if (resp?.edgeNode?.id) {
        registeredNodeId = resp.edgeNode.id;
      }
    }

    const pairing: EdgePairingConfig = {
      nodeId: registeredNodeId || `edg_local_${params.storeId}`,
      storeId: params.storeId,
      storeName: params.storeName,
      edgeBaseUrl: cleanUrl,
      hostname: params.hostname || `edge-${params.storeId}`,
      lanIp: params.lanIp,
      port: params.port || 3300,
      preferLan: Boolean(params.preferLan),
      pairedAt: new Date().toISOString(),
    };

    platform.storage.setItem(EDGE_PAIRING_STORAGE_KEY, JSON.stringify(pairing));
    platform.network.setEdgeBaseUrl(cleanUrl);
    if (pairing.preferLan) {
      platform.storage.setItem('3ccorp_prefer_edge_lan', 'true');
    } else {
      platform.storage.removeItem('3ccorp_prefer_edge_lan');
    }

    this.updateState({
      pairedEdge: pairing,
      activeTransport: this.resolveTransport(this.state.isOnline, pairing),
      lastError: null,
    });

    return pairing;
  }

  unpairEdgeNode(): void {
    this.ensureInit();
    const platform = getPlatformAdapters();
    platform.storage.removeItem(EDGE_PAIRING_STORAGE_KEY);
    platform.storage.removeItem('3ccorp_prefer_edge_lan');
    platform.network.setEdgeBaseUrl(null);
    this.updateState({
      pairedEdge: null,
      activeTransport: this.resolveTransport(this.state.isOnline, null),
    });
  }

  async enqueueMutation(params: {
    entity: OfflineMutationEntity;
    entityId: string;
    operation?: 'UPSERT' | 'DELETE';
    storeId: string;
    appId: 'store-os' | 'waiter' | 'driver' | 'marketplace' | 'hq';
    deltaQty?: number;
    variantDeltas?: Array<{ variantId: string; deltaQty: number }>;
    payload: any;
  }) {
    this.ensureInit();
    const mutation = await StorageService.enqueueOfflineMutation({
      ...params,
      nodeId: this.state.pairedEdge?.nodeId || params.appId,
    });
    await this.refreshCounts();
    return mutation;
  }

  async flushAll(
    tokenOrOptions?: string | { token?: string; storeId?: string },
    storeIdArg?: string
  ): Promise<{ syncedOrders: number; syncedMutations: number }> {
    this.ensureInit();
    if (this.inFlightFlush) {
      return this.inFlightFlush;
    }

    const options =
      typeof tokenOrOptions === 'object' && tokenOrOptions !== null
        ? tokenOrOptions
        : { token: tokenOrOptions, storeId: storeIdArg };
    const token = options.token;
    const storeId = options.storeId;

    const platform = getPlatformAdapters();
    if (!platform.network.isOnline() && !this.state.pairedEdge?.edgeBaseUrl) {
      return { syncedOrders: 0, syncedMutations: 0 };
    }

    const resolvedToken = token ?? platform.storage.getItem('3ccorp_auth_token') ?? undefined;
    if (!resolvedToken) {
      return { syncedOrders: 0, syncedMutations: 0 };
    }

    this.inFlightFlush = (async () => {
      this.updateState({ isSyncing: true, lastError: null });
      let syncedOrders = 0;
      let syncedMutations = 0;

      try {
        const pendingOrders = await StorageService.getPendingOrders();
        for (const p of pendingOrders) {
          try {
            const targetStoreId = p.storeId || storeId || this.state.pairedEdge?.storeId || 'store-1';
            const res = await apiClient.placeOrder({
              storeId: targetStoreId,
              channel: p.channel || 'POS',
              customerName: p.customerName || 'Cliente Balcão',
              items: (p.items || []).map((i: any) => ({
                menuItemId: i.menuItemId || i.id,
                name: i.name,
                price: i.price,
                quantity: i.quantity || i.qty || 1,
                variantId: i.variantId,
                variantLabel: i.variantLabel,
                serialNumber: i.serialNumber,
                notes: i.notes,
              })),
              total: p.total || 0,
              discount: p.discount || 0,
              couponCode: p.couponCode || '',
              paymentMethod: p.paymentMethod || 'PIX',
              deliveryModality: p.deliveryModality || 'PICKUP',
              ...(p.tableNumber !== undefined ? { tableNumber: p.tableNumber } : {}),
              ...(p.customerPhone ? { customerPhone: p.customerPhone } : {}),
              ...(p.deliveryAddress ? { deliveryAddress: p.deliveryAddress } : {}),
              ...(p.notes ? { notes: p.notes } : {}),
              ...(p.courierTip !== undefined ? { courierTip: p.courierTip } : {}),
              ...(p.professionalId ? { professionalId: p.professionalId } : {}),
              ...(p.professionalName ? { professionalName: p.professionalName } : {}),
              ...(p.commissionRate !== undefined ? { commissionRate: p.commissionRate } : {}),
              ...(p.commissionAmount !== undefined ? { commissionAmount: p.commissionAmount } : {}),
              ...(p.reservationId ? { reservationId: p.reservationId } : {}),
              ...(p.scheduledDeliveryDate ? { scheduledDeliveryDate: p.scheduledDeliveryDate } : {}),
              ...(p.scheduledDeliveryPeriod ? { scheduledDeliveryPeriod: p.scheduledDeliveryPeriod } : {}),
              ...(typeof p.assemblyRequired === 'boolean' ? { assemblyRequired: p.assemblyRequired } : {}),
              idempotencyKey: p.idempotencyKey,
              token: resolvedToken,
            });
            if (res.success) {
              await StorageService.markOrderSynced(p.id);
              syncedOrders++;
            }
          } catch {
            // Keep pending order in IndexedDB for next retry
          }
        }

        const pendingMutations = await StorageService.getPendingMutations();
        if (pendingMutations.length > 0) {
          const pushPayload = {
            nodeId: this.state.pairedEdge?.nodeId || `web_${platform.target}`,
            storeId: storeId || this.state.pairedEdge?.storeId || pendingMutations[0].storeId,
            mutations: pendingMutations.map((m) => ({
              idempotencyKey: m.id,
              entity: m.entity,
              entityId: m.entityId,
              operation: m.operation,
              hlc: m.hlc,
              deltaQty: m.deltaQty,
              ...(m.variantDeltas ? { variantDeltas: m.variantDeltas } : {}),
              payload: m.payload,
            })),
          };

          const pushResult = await apiClient.pushSyncMutations(pushPayload, resolvedToken);
          const acknowledgedKeys = new Set<string>([
            ...((pushResult?.accepted || []).map((a: any) => a.idempotencyKey).filter(Boolean)),
            ...((pushResult?.deduplicated || []).map((d: any) => d.idempotencyKey).filter(Boolean)),
          ]);

          for (const key of acknowledgedKeys) {
            await StorageService.removeSyncedMutation(key);
            syncedMutations++;
          }

          const nowIso = new Date().toISOString();
          const mutationByKey = new Map(pendingMutations.map((m) => [m.id, m]));
          const conflictItems = (pushResult?.conflicts || []) as any[];
          const rejectedItems = (pushResult?.rejected || []) as any[];

          for (const c of conflictItems) {
            const key = c?.idempotencyKey || `${c?.entity}:${c?.entityId}:conflict`;
            const orig = c?.idempotencyKey ? mutationByKey.get(c.idempotencyKey) : undefined;
            await StorageService.saveSyncConflict({
              id: key,
              entity: c?.entity || orig?.entity || 'unknown',
              entityId: c?.entityId || orig?.entityId || 'unknown',
              storeId: orig?.storeId || storeId,
              reason: c?.reason || 'CONFLICT',
              kind: 'CONFLICT',
              payload: orig?.payload,
              serverRecord: c?.serverRecord,
              detectedAt: nowIso,
            });
            if (c?.idempotencyKey) {
              await StorageService.removeSyncedMutation(c.idempotencyKey);
            }
          }

          for (const r of rejectedItems) {
            const key = r?.idempotencyKey || `${r?.entity}:${r?.entityId}:rejected`;
            const orig = r?.idempotencyKey ? mutationByKey.get(r.idempotencyKey) : undefined;
            await StorageService.saveSyncConflict({
              id: key,
              entity: r?.entity || orig?.entity || 'unknown',
              entityId: r?.entityId || orig?.entityId || 'unknown',
              storeId: orig?.storeId || storeId,
              reason: r?.reason || 'REJECTED',
              kind: 'REJECTED',
              payload: orig?.payload,
              detectedAt: nowIso,
            });
            if (r?.idempotencyKey) {
              await StorageService.removeSyncedMutation(r.idempotencyKey);
            }
          }

          if (conflictItems.length > 0 || rejectedItems.length > 0) {
            this.updateState({
              lastError: `${conflictItems.length + rejectedItems.length} mutação(ões) offline em conflito ou rejeitadas; preservadas para revisão.`,
            });
          }

          if (pushResult?.serverHlc) {
            platform.storage.setItem(LAST_HLC_STORAGE_KEY, pushResult.serverHlc);
            this.updateState({ lastHlc: pushResult.serverHlc });
          }
        }

        if (storeId || this.state.pairedEdge?.storeId) {
          try {
            const pullResult = await apiClient.pullSyncDelta(
              {
                sinceHlc: this.state.lastHlc || undefined,
                storeId: storeId || this.state.pairedEdge?.storeId,
                limit: 50,
              },
              resolvedToken
            );
            const nextHlc = pullResult?.nextHlc || pullResult?.serverHlc;
            if (nextHlc) {
              platform.storage.setItem(LAST_HLC_STORAGE_KEY, nextHlc);
              this.updateState({ lastHlc: nextHlc });
            }
          } catch {
            // Non-blocking delta checkpoint error
          }
        }

        this.updateState({
          lastSyncedAt: new Date().toISOString(),
        });
      } catch (err: any) {
        this.updateState({ lastError: err?.message || 'Falha na sincronização.' });
      } finally {
        await this.refreshCounts();
        this.updateState({ isSyncing: false });
        this.inFlightFlush = null;
      }

      return { syncedOrders, syncedMutations };
    })();

    return this.inFlightFlush;
  }
}

export const syncEngine = new SyncEngineService();
