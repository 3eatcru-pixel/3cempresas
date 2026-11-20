import { requestJson } from './httpClient.ts';

export const syncApi = {
  async getSyncStatus(token?: string) {
    return requestJson('/sync/status', { method: 'GET', token });
  },

  async registerEdgeNode(
    payload: {
      nodeId?: string;
      storeId: string;
      hostname?: string;
      lanIp?: string;
      port?: number;
      platform?: string;
      appVersion?: string;
      lastHlc?: string;
    },
    token?: string
  ) {
    return requestJson('/sync/edge/register', {
      method: 'POST',
      body: payload,
      token,
      appId: 'store-os',
    });
  },

  async listEdgeNodes(storeId?: string, token?: string) {
    const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
    return requestJson(`/sync/edge/nodes${query}`, { method: 'GET', token });
  },

  async pushSyncMutations(
    payload: { nodeId: string; storeId?: string; mutations: any[] },
    token?: string
  ) {
    return requestJson('/sync/push', {
      method: 'POST',
      body: payload,
      token,
      appId: 'store-os',
    });
  },

  async pullSyncDelta(params?: { sinceHlc?: string; storeId?: string; limit?: number }, token?: string) {
    const search = new URLSearchParams();
    if (params?.sinceHlc) search.set('sinceHlc', params.sinceHlc);
    if (params?.storeId) search.set('storeId', params.storeId);
    if (params?.limit) search.set('limit', String(params.limit));
    const qs = search.toString() ? `?${search.toString()}` : '';
    return requestJson(`/sync/pull${qs}`, { method: 'GET', token });
  },

  async getStockLedger(params?: { storeId?: string; targetId?: string; orderId?: string }, token?: string) {
    const search = new URLSearchParams();
    if (params?.storeId) search.set('storeId', params.storeId);
    if (params?.targetId) search.set('targetId', params.targetId);
    if (params?.orderId) search.set('orderId', params.orderId);
    const qs = search.toString() ? `?${search.toString()}` : '';
    return requestJson(`/sync/stock-ledger${qs}`, { method: 'GET', token });
  },
};
