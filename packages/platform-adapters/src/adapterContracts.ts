export type RuntimeTarget = 'web' | 'tauri-windows' | 'tauri-linux' | 'capacitor-android' | 'node-test';
export type ClientAppId = 'marketplace' | 'store-os' | 'driver' | 'waiter' | 'hq' | 'server-core' | 'unified-portal';

export interface SecureStorageAdapter {
  getItem(key: string): string | null;
  getItemAsync?(key: string): Promise<string | null>;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  getDiagnostics?(): {
    backend: string;
    persistent: boolean;
    encrypted: boolean;
    warning?: string;
  };
}

export interface NetworkResolverAdapter {
  getRootBaseUrl(): string;
  getApiBaseUrl(): string;
  getEdgeBaseUrl(): string | null;
  setEdgeBaseUrl(url: string | null): void;
  isOnline(): boolean;
  subscribeNetworkChanges(onChange: (online: boolean) => void): () => void;
}

export interface ExternalLinkAdapter {
  openExternal(url: string): void;
  getOrigin(): string;
  downloadTextFile(filename: string, content: string, mimeType?: string): void;
}

export type PrinterTransportMode =
  | 'BROWSER_PRINT'
  | 'TAURI_ESCPOS'
  | 'CAPACITOR_BT'
  | 'WEB_SERIAL_ESCPOS'
  | 'WEB_BLUETOOTH_ESCPOS';

export interface PrinterDispatchResult {
  printed: boolean;
  mode: PrinterTransportMode;
  simulated?: boolean;
}

export interface PrinterHardwareAdapter {
  printEscPosText(content: string): Promise<PrinterDispatchResult>;
  printEscPosBytes?(bytes: Uint8Array, textFallback?: string): Promise<PrinterDispatchResult>;
  openCashDrawer?(): Promise<{ opened: boolean; mode: PrinterTransportMode; simulated?: boolean }>;
}

export interface ScaleHardwareAdapter {
  readWeightKg(): Promise<{
    weightKg: number;
    stable: boolean;
    connected: boolean;
    simulated: boolean;
    source: 'MOCK' | 'TAURI_SERIAL' | 'WEB_SERIAL';
    protocol?: string;
  }>;
}

export interface EdgeSidecarAdapter {
  getSidecarStatus(): Promise<{ running: boolean; managedBy: 'NONE' | 'TAURI_SIDECAR'; port?: number }>;
  restartSidecar(): Promise<{ restarted: boolean }>;
}

export interface PlatformAdapters {
  readonly target: RuntimeTarget;
  readonly storage: SecureStorageAdapter;
  readonly network: NetworkResolverAdapter;
  readonly links: ExternalLinkAdapter;
  readonly printer: PrinterHardwareAdapter;
  readonly scale: ScaleHardwareAdapter;
  readonly edgeSidecar: EdgeSidecarAdapter;
}

export type HostOperatingSystem = 'Windows' | 'Linux' | 'macOS' | 'Android' | 'iOS' | 'Web';

export interface LocalTerminalInfo {
  isLocalTerminal: boolean;
  os: HostOperatingSystem;
  runtimeTarget: RuntimeTarget;
  isDesktopShell: boolean;
  isLoopbackOrLan: boolean;
  label: string;
  detailLabel: string;
}

export const CLOUD_RUN_SERVICE_URL = 'https://app-3ccorp-164281225843.us-west1.run.app';
export const CLOUD_RUN_SHORT_URL = 'https://app-3ccorp-2aj4z66sma-uw.a.run.app';
export const PROVISIONAL_CLOUD_BASE_URL = 'https://3ccorp.ai.studio';
export const PROVISIONAL_CLOUD_RUN_URL = 'https://3cruempresas.cloud.run';

let configuredClientAppId: ClientAppId | null = null;

export function setActiveClientAppId(appId: ClientAppId): void {
  configuredClientAppId = appId;
}

export function getActiveClientAppId(): ClientAppId {
  if (configuredClientAppId) return configuredClientAppId;
  if (typeof window !== 'undefined' && window.location?.search) {
    const appParam = new URLSearchParams(window.location.search).get('app');
    if (
      appParam === 'marketplace' ||
      appParam === 'store-os' ||
      appParam === 'driver' ||
      appParam === 'waiter' ||
      appParam === 'hq' ||
      appParam === 'server-core' ||
      appParam === 'unified-portal'
    ) {
      return appParam;
    }
  }
  const envAppId =
    typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_3C_APP_ID
      ? String((import.meta as any).env.VITE_3C_APP_ID)
      : '';
  if (
    envAppId === 'marketplace' ||
    envAppId === 'store-os' ||
    envAppId === 'driver' ||
    envAppId === 'waiter' ||
    envAppId === 'hq' ||
    envAppId === 'server-core'
  ) {
    return envAppId;
  }
  return 'unified-portal';
}

export function detectRuntimeTarget(): RuntimeTarget {
  if (typeof window === 'undefined') return 'node-test';
  const w = window as any;
  if (w.Capacitor?.isNativePlatform?.()) {
    return 'capacitor-android';
  }
  if (w.__TAURI_INTERNALS__ || w.__TAURI__) {
    const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
    const plat = (typeof navigator !== 'undefined' ? navigator.platform : '').toLowerCase();
    return plat.includes('linux') || (ua.includes('linux') && !ua.includes('android'))
      ? 'tauri-linux'
      : 'tauri-windows';
  }
  return 'web';
}

export function isSensitiveStorageKey(key: string): boolean {
  return (
    key === '3ccorp_auth_token' ||
    key === '3ccorp_device_token' ||
    key.startsWith('3ccorp_device_token_')
  );
}
