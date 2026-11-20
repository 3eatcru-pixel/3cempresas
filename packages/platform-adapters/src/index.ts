import { generateIdempotencyKey } from '@3c/commerce-engine';
import { CONTRACT_VERSION } from '@3c/contracts';
import {
  detectRuntimeTarget,
  getActiveClientAppId,
  type ClientAppId,
  type PlatformAdapters,
} from './adapterContracts';
import {
  createCapacitorPlatformAdapters,
  createTauriPlatformAdapters,
} from './nativePlatformAdapters';
import {
  browserStorageAdapter,
  defaultEdgeSidecarAdapter,
  defaultLinksAdapter,
  defaultNetworkAdapter,
  defaultPrinterAdapter,
  defaultScaleAdapter,
} from './webPlatformAdapters';

export * from './escposEncoder';
export * from './webHardwareTransport';
export * from './adapterContracts';
export { detectLocalTerminalInfo } from './webPlatformAdapters';
export {
  createTauriPlatformAdapters,
  createCapacitorPlatformAdapters,
} from './nativePlatformAdapters';

let currentPlatformAdapters: PlatformAdapters | null = null;

export function getPlatformAdapters(): PlatformAdapters {
  if (!currentPlatformAdapters) {
    const target = detectRuntimeTarget();
    if (target === 'tauri-windows' || target === 'tauri-linux') {
      currentPlatformAdapters = createTauriPlatformAdapters(target);
    } else if (target === 'capacitor-android') {
      currentPlatformAdapters = createCapacitorPlatformAdapters();
    } else {
      currentPlatformAdapters = {
        target,
        storage: browserStorageAdapter,
        network: defaultNetworkAdapter,
        links: defaultLinksAdapter,
        printer: defaultPrinterAdapter,
        scale: defaultScaleAdapter,
        edgeSidecar: defaultEdgeSidecarAdapter,
      };
    }
  }
  return currentPlatformAdapters;
}

export function registerPlatformAdapters(custom: Partial<PlatformAdapters>): void {
  const base = getPlatformAdapters();
  currentPlatformAdapters = {
    target: custom.target ?? base.target,
    storage: custom.storage ?? base.storage,
    network: custom.network ?? base.network,
    links: custom.links ?? base.links,
    printer: custom.printer ?? base.printer,
    scale: custom.scale ?? base.scale,
    edgeSidecar: custom.edgeSidecar ?? base.edgeSidecar,
  };
}

export function buildStandardContractHeaders(options?: {
  token?: string | null;
  appId?: ClientAppId;
  includeIdempotencyKey?: boolean;
  existingIdempotencyKey?: string;
}): Record<string, string> {
  const adapters = getPlatformAdapters();
  const token = options?.token !== undefined ? options.token : adapters.storage.getItem('3ccorp_auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-3C-Contract-Version': CONTRACT_VERSION,
    'X-3C-App-Id': options?.appId || getActiveClientAppId(),
    'X-3C-Platform': adapters.target,
    'X-3C-App-Version': '5.2.1',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options?.includeIdempotencyKey) {
    headers['Idempotency-Key'] = options.existingIdempotencyKey || generateIdempotencyKey();
  }
  return headers;
}

export function buildSseStreamUrl(params?: {
  tenantId?: string;
  token?: string | null;
  ticket?: string | null;
}): string {
  const base = getPlatformAdapters().network.getApiBaseUrl();
  const query = new URLSearchParams();
  if (params?.tenantId) query.set('tenantId', params.tenantId);
  if (params?.ticket) {
    query.set('ticket', params.ticket);
  } else {
    const token =
      params?.token !== undefined ? params.token : getPlatformAdapters().storage.getItem('3ccorp_auth_token');
    if (token) query.set('token', token);
  }
  const qs = query.toString();
  return `${base}/sse/stream${qs ? `?${qs}` : ''}`;
}
