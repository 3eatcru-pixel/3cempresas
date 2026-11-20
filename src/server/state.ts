import express from 'express';

export interface SseClient {
  response: express.Response;
  tenantId: string;
  role: string;
  isDev: boolean;
  uid?: string;
  storeId?: string;
  allowedStoreIds?: string[];
}

export interface SseBroadcastOptions {
  storeId?: string | null;
  customerId?: string | null;
  driverId?: string | null;
  allowedRoles?: string[];
}

export const clusterState = {
  uptimeStart: Date.now(),
  ordersProcessed: 0,
  activeTenants: 0,
  systemStatus: 'ONLINE_HEALTHY',
  lastEvent: 'Sistema inicializado em modo seguro',
  merchantPaymentConfigs: new Map<string, any>()
};

export const sseClients: SseClient[] = [];

function writeOrPruneSseClient(client: SseClient, data: string): boolean {
  if (client.response.writableEnded || client.response.destroyed) {
    return false;
  }
  try {
    client.response.write(`data: ${data}\n\n`);
    return true;
  } catch {
    return false;
  }
}

function pruneDeadSseClients(deadIndices: number[]) {
  for (let i = deadIndices.length - 1; i >= 0; i--) {
    sseClients.splice(deadIndices[i], 1);
  }
}

function clientMatchesStore(client: SseClient, eventStoreId?: string | null): boolean {
  if (!eventStoreId) return true;
  if (client.role === 'DEV_OWNER' || client.role === 'SUPER_ADMIN' || client.role === 'STORE_OWNER' || client.role === 'REGIONAL_MANAGER') {
    const allowed = Array.isArray(client.allowedStoreIds) ? client.allowedStoreIds.filter(Boolean) : [];
    if (allowed.length === 0 && !client.storeId) return true;
    return allowed.includes(eventStoreId) || client.storeId === eventStoreId;
  }
  const allowed = Array.isArray(client.allowedStoreIds) ? client.allowedStoreIds.filter(Boolean) : [];
  if (allowed.length > 0) {
    return allowed.includes(eventStoreId) || client.storeId === eventStoreId;
  }
  if (client.storeId) {
    return client.storeId === eventStoreId;
  }
  return false;
}

const COURIER_ALLOWED_SSE_TYPES = new Set([
  'ORDER_STATUS_CHANGED',
  'ORDER_DRIVER_ASSIGNED',
  'DRIVER_PAYOUT_REQUESTED',
  'ORDER_COMMITTED',
]);

export const broadcastSseEvent = (
  type: string,
  payload: any,
  targetTenantId?: string,
  isPrivate: boolean = false,
  options?: SseBroadcastOptions
) => {
  const data = JSON.stringify({ type, timestamp: new Date().toISOString(), ...payload });
  const deadIndices: number[] = [];
  const eventStoreId = options?.storeId ?? payload?.storeId ?? null;
  const eventCustomerId = options?.customerId ?? payload?.customerId ?? null;
  const eventDriverId = options?.driverId ?? payload?.driverId ?? null;

  sseClients.forEach((client, idx) => {
    if (client.response.writableEnded || client.response.destroyed) {
      deadIndices.push(idx);
      return;
    }

    // Dev owners receive platform governance/operational telemetry
    if (client.isDev) {
      if (!writeOrPruneSseClient(client, data)) deadIndices.push(idx);
      return;
    }

    // Public / Anonymous clients NEVER receive private or specific tenant events
    if (client.tenantId === 'PUBLIC') {
      if (!isPrivate && targetTenantId === 'PUBLIC') {
        if (!writeOrPruneSseClient(client, data)) deadIndices.push(idx);
      }
      return;
    }

    const roleUpper = String(client.role || '').toUpperCase();

    // Consumers NEVER receive store internal operational/financial events or other customers' orders
    if (roleUpper === 'CUSTOMER' || roleUpper === 'CONSUMER') {
      const isPublicEvent = !isPrivate && targetTenantId === 'PUBLIC';
      const isOwnConsumerEvent = Boolean(eventCustomerId && client.uid && eventCustomerId === client.uid);
      if (!isPublicEvent && !isOwnConsumerEvent) {
        return;
      }
      if (!writeOrPruneSseClient(client, data)) deadIndices.push(idx);
      return;
    }

    // Tenant boundary check for store/courier/hq staff
    const matchesTenant = client.tenantId === targetTenantId || (!isPrivate && targetTenantId === 'PUBLIC');
    if (!matchesTenant) {
      return;
    }

    // Couriers only receive delivery/driver-related events inside their scope
    if (roleUpper === 'COURIER' || roleUpper === 'DRIVER') {
      if (!COURIER_ALLOWED_SSE_TYPES.has(type)) {
        return;
      }
      if (type === 'DRIVER_PAYOUT_REQUESTED' && eventDriverId && eventDriverId !== client.uid) {
        return;
      }
      if (client.storeId && eventStoreId && eventStoreId !== client.storeId) {
        return;
      }
      if (!writeOrPruneSseClient(client, data)) deadIndices.push(idx);
      return;
    }

    // Explicit role allowlist on sensitive store/hq broadcasts
    if (Array.isArray(options?.allowedRoles) && options.allowedRoles.length > 0) {
      if (!options.allowedRoles.includes(roleUpper)) {
        return;
      }
    }

    // Branch lock isolation within multi-branch tenants
    if (!clientMatchesStore(client, eventStoreId)) {
      return;
    }

    if (!writeOrPruneSseClient(client, data)) deadIndices.push(idx);
  });
  pruneDeadSseClients(deadIndices);
};

export const broadcastUserSseEvent = (targetUid: string, type: string, payload: any = {}) => {
  if (!targetUid) return;
  const data = JSON.stringify({ type, uid: targetUid, timestamp: new Date().toISOString(), ...payload });
  const deadIndices: number[] = [];
  sseClients.forEach((client, idx) => {
    if (client.response.writableEnded || client.response.destroyed) {
      deadIndices.push(idx);
      return;
    }
    if (client.uid === targetUid) {
      if (!writeOrPruneSseClient(client, data)) deadIndices.push(idx);
    }
  });
  pruneDeadSseClients(deadIndices);
};
