import { generateIdempotencyKey } from '@3c/commerce-engine';
import { CONTRACT_VERSION } from '@3c/contracts';
import {
  buildCashDrawerPulseBytes,
  buildEscPosPlainTextBytes,
  uint8ArrayToBase64,
  uint8ArrayToLatin1String,
} from './escposEncoder';
import {
  getBrowserHardwareCapabilities,
  hasConnectedWebBluetoothPrinter,
  hasConnectedWebSerialPrinter,
  hasConnectedWebSerialScale,
  readWeightFromWebSerialScale,
  writeBytesWebBluetoothPrinter,
  writeBytesWebSerialPrinter,
} from './webHardwareTransport';

export * from './escposEncoder';
export * from './webHardwareTransport';

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

const memoryFallbackStore = new Map<string, string>();
let activeEdgeBaseUrl: string | null = null;
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

export function detectLocalTerminalInfo(options?: {
  activeTransport?: 'CLOUD' | 'EDGE_LAN' | 'OFFLINE';
  edgeBaseUrl?: string | null;
}): LocalTerminalInfo {
  const runtimeTarget = detectRuntimeTarget();
  const isDesktopShell = runtimeTarget === 'tauri-windows' || runtimeTarget === 'tauri-linux';

  let os: HostOperatingSystem = 'Web';
  if (runtimeTarget === 'node-test') {
    os = 'Web';
  } else if (runtimeTarget === 'tauri-windows') {
    os = 'Windows';
  } else if (runtimeTarget === 'tauri-linux') {
    os = 'Linux';
  } else if (runtimeTarget === 'capacitor-android') {
    os = 'Android';
  } else if (typeof navigator !== 'undefined') {
    const navAny = navigator as any;
    const uaDataPlat = String(navAny.userAgentData?.platform || '').toLowerCase();
    const plat = String(navigator.platform || '').toLowerCase();
    const ua = String(navigator.userAgent || '').toLowerCase();
    const combined = `${uaDataPlat} ${plat} ${ua}`;

    if (combined.includes('android')) {
      os = 'Android';
    } else if (/iphone|ipad|ipod/.test(combined)) {
      os = 'iOS';
    } else if (combined.includes('win')) {
      os = 'Windows';
    } else if (combined.includes('linux') || combined.includes('x11')) {
      os = 'Linux';
    } else if (combined.includes('mac')) {
      os = 'macOS';
    }
  }

  let isLoopbackOrLan = isDesktopShell || options?.activeTransport === 'EDGE_LAN';
  if (!isLoopbackOrLan && typeof window !== 'undefined' && window.location) {
    const host = String(window.location.hostname || '').toLowerCase();
    const proto = String(window.location.protocol || '').toLowerCase();
    isLoopbackOrLan =
      proto === 'tauri:' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
  }
  if (!isLoopbackOrLan && (options?.edgeBaseUrl || defaultNetworkAdapter.getEdgeBaseUrl())) {
    isLoopbackOrLan = true;
  }

  const isLocalTerminal = isDesktopShell || os === 'Windows' || os === 'Linux';
  const label = os === 'Windows' || os === 'Linux' ? `Terminal Local • ${os}` : 'Terminal Local';
  const detailLabel = isDesktopShell
    ? `App Desktop Tauri (${os})`
    : options?.activeTransport === 'EDGE_LAN'
    ? `Edge LAN (${os})`
    : isLoopbackOrLan
    ? `Estação Local (${os})`
    : `Estação ${os} (Web)`;

  return {
    isLocalTerminal,
    os,
    runtimeTarget,
    isDesktopShell,
    isLoopbackOrLan,
    label,
    detailLabel,
  };
}

function isSensitiveStorageKey(key: string): boolean {
  return (
    key === '3ccorp_auth_token' ||
    key === '3ccorp_device_token' ||
    key.startsWith('3ccorp_device_token_')
  );
}

let capacitorVolatileWarningLogged = false;

const browserStorageAdapter: SecureStorageAdapter = {
  getItem(key: string): string | null {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(key);
      } catch {
        return memoryFallbackStore.get(key) ?? null;
      }
    }
    return memoryFallbackStore.get(key) ?? null;
  },
  async getItemAsync(key: string): Promise<string | null> {
    return browserStorageAdapter.getItem(key);
  },
  setItem(key: string, value: string): void {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, value);
        return;
      } catch {
        // fallback to memory store
      }
    }
    memoryFallbackStore.set(key, value);
  },
  removeItem(key: string): void {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
    memoryFallbackStore.delete(key);
  },
  getDiagnostics() {
    return {
      backend: 'WEB_LOCAL_STORAGE',
      persistent: typeof window !== 'undefined' && typeof localStorage !== 'undefined',
      encrypted: false,
    };
  },
};

function createTauriSecureStorageAdapter(): SecureStorageAdapter {
  return {
    getItem(key: string): string | null {
      if (isSensitiveStorageKey(key)) {
        if (memoryFallbackStore.has(key)) {
          return memoryFallbackStore.get(key) ?? null;
        }
        void invokeTauriCommand<{ value: string | null }>('secure_storage_get', { key })
          .then((res) => {
            if (res && typeof res.value === 'string') {
              memoryFallbackStore.set(key, res.value);
            }
          })
          .catch(() => {});
        return null;
      }
      return browserStorageAdapter.getItem(key);
    },
    async getItemAsync(key: string): Promise<string | null> {
      if (isSensitiveStorageKey(key)) {
        if (memoryFallbackStore.has(key)) {
          return memoryFallbackStore.get(key) ?? null;
        }
        try {
          const res = await invokeTauriCommand<{ value: string | null }>('secure_storage_get', { key });
          if (res && typeof res.value === 'string') {
            memoryFallbackStore.set(key, res.value);
            return res.value;
          }
        } catch {
          // keep volatile fallback only
        }
        return memoryFallbackStore.get(key) ?? null;
      }
      return browserStorageAdapter.getItem(key);
    },
    setItem(key: string, value: string): void {
      if (isSensitiveStorageKey(key)) {
        memoryFallbackStore.set(key, value);
        void invokeTauriCommand('secure_storage_set', { key, value }).catch(() => {});
        return;
      }
      browserStorageAdapter.setItem(key, value);
    },
    removeItem(key: string): void {
      if (isSensitiveStorageKey(key)) {
        memoryFallbackStore.delete(key);
        void invokeTauriCommand('secure_storage_remove', { key }).catch(() => {});
      }
      browserStorageAdapter.removeItem(key);
    },
    getDiagnostics() {
      return {
        backend: 'TAURI_APP_LOCAL_VAULT',
        persistent: true,
        encrypted: false,
        warning: 'Cofre local em diretório restrito (0700) do SO; tokens não são gravados em localStorage.',
      };
    },
  };
}

function getCapacitorNativeSecurePlugin(): any {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  return w?.Capacitor?.Plugins?.SecureStoragePlugin || null;
}

function createCapacitorSecureStorageAdapter(): SecureStorageAdapter {
  return {
    getItem(key: string): string | null {
      if (isSensitiveStorageKey(key)) {
        if (memoryFallbackStore.has(key)) {
          return memoryFallbackStore.get(key) ?? null;
        }
        const nativeSecure = getCapacitorNativeSecurePlugin();
        if (nativeSecure?.get) {
          void nativeSecure
            .get({ key })
            .then((res: any) => {
              if (res && typeof res.value === 'string') {
                memoryFallbackStore.set(key, res.value);
              }
            })
            .catch(() => {});
        }
        // Fail closed against unencrypted localStorage persistence on Android
        return null;
      }
      return browserStorageAdapter.getItem(key);
    },
    async getItemAsync(key: string): Promise<string | null> {
      if (isSensitiveStorageKey(key)) {
        if (memoryFallbackStore.has(key)) {
          return memoryFallbackStore.get(key) ?? null;
        }
        const nativeSecure = getCapacitorNativeSecurePlugin();
        if (nativeSecure?.get) {
          try {
            const res = await nativeSecure.get({ key });
            if (res && typeof res.value === 'string') {
              memoryFallbackStore.set(key, res.value);
              return res.value;
            }
          } catch {
            // key absent or plugin error
          }
        }
        return memoryFallbackStore.get(key) ?? null;
      }
      return browserStorageAdapter.getItem(key);
    },
    setItem(key: string, value: string): void {
      if (isSensitiveStorageKey(key)) {
        memoryFallbackStore.set(key, value);
        const nativeSecure = getCapacitorNativeSecurePlugin();
        if (nativeSecure?.set) {
          void nativeSecure.set({ key, value }).catch(() => {});
          return;
        }
        if (!capacitorVolatileWarningLogged && typeof console !== 'undefined') {
          capacitorVolatileWarningLogged = true;
          console.warn(
            '[PlatformAdapters] SecureStoragePlugin ausente no shell Capacitor; credenciais sensíveis mantidas apenas em memória volátil (sem gravação em localStorage).'
          );
        }
        return;
      }
      browserStorageAdapter.setItem(key, value);
    },
    removeItem(key: string): void {
      if (isSensitiveStorageKey(key)) {
        memoryFallbackStore.delete(key);
        const nativeSecure = getCapacitorNativeSecurePlugin();
        if (nativeSecure?.remove) {
          void nativeSecure.remove({ key }).catch(() => {});
        }
      }
      browserStorageAdapter.removeItem(key);
    },
    getDiagnostics() {
      const hasNativePlugin = Boolean(getCapacitorNativeSecurePlugin()?.set);
      return {
        backend: hasNativePlugin ? 'CAPACITOR_SECURE_STORAGE' : 'CAPACITOR_VOLATILE_MEMORY_ONLY',
        persistent: hasNativePlugin,
        encrypted: hasNativePlugin,
        ...(hasNativePlugin
          ? {}
          : {
              warning:
                'SecureStoragePlugin nativo ausente: tokens mantidos exclusivamente em memória volátil da sessão (nunca em localStorage).',
            }),
      };
    },
  };
}

export const CLOUD_RUN_SERVICE_URL = 'https://app-3ccorp-164281225843.us-west1.run.app';
export const CLOUD_RUN_SHORT_URL = 'https://app-3ccorp-2aj4z66sma-uw.a.run.app';
export const PROVISIONAL_CLOUD_BASE_URL = 'https://3ccorp.ai.studio';
export const PROVISIONAL_CLOUD_RUN_URL = 'https://3cruempresas.cloud.run';

function resolveConfiguredCloudBaseUrl(): string {
  const envCloudUrl =
    typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CLOUD_API_URL
      ? String((import.meta as any).env.VITE_CLOUD_API_URL).trim().replace(/\/+$/, '')
      : '';
  if (envCloudUrl) return envCloudUrl;
  const storedCloudUrl = browserStorageAdapter.getItem('3ccorp_cloud_api_url');
  return storedCloudUrl ? storedCloudUrl.trim().replace(/\/+$/, '') : '';
}

const defaultNetworkAdapter: NetworkResolverAdapter = {
  getRootBaseUrl(): string {
    const edge = defaultNetworkAdapter.getEdgeBaseUrl();
    const preferEdgeLan = browserStorageAdapter.getItem('3ccorp_prefer_edge_lan') === 'true';
    if (edge && (!defaultNetworkAdapter.isOnline() || preferEdgeLan)) {
      return edge.replace(/\/$/, '');
    }
    return resolveConfiguredCloudBaseUrl();
  },
  getApiBaseUrl(): string {
    const root = defaultNetworkAdapter.getRootBaseUrl();
    return root ? `${root}/api/v1` : '/api/v1';
  },
  getEdgeBaseUrl(): string | null {
    return activeEdgeBaseUrl || browserStorageAdapter.getItem('3ccorp_edge_base_url');
  },
  setEdgeBaseUrl(url: string | null): void {
    activeEdgeBaseUrl = url;
    if (url) {
      browserStorageAdapter.setItem('3ccorp_edge_base_url', url);
    } else {
      browserStorageAdapter.removeItem('3ccorp_edge_base_url');
    }
  },
  isOnline(): boolean {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  },
  subscribeNetworkChanges(onChange: (online: boolean) => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const handleOnline = () => onChange(true);
    const handleOffline = () => onChange(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  },
};

const defaultLinksAdapter: ExternalLinkAdapter = {
  openExternal(url: string): void {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    }
  },
  getOrigin(): string {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return 'http://localhost:3000';
  },
  downloadTextFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8'): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

async function tryWebHardwareBytesPrint(bytes: Uint8Array): Promise<PrinterDispatchResult | null> {
  if (hasConnectedWebSerialPrinter()) {
    try {
      const ok = await writeBytesWebSerialPrinter(bytes);
      if (ok) return { printed: true, mode: 'WEB_SERIAL_ESCPOS', simulated: false };
    } catch {
      // fall through to WebBluetooth or browser print
    }
  }
  if (hasConnectedWebBluetoothPrinter()) {
    try {
      const ok = await writeBytesWebBluetoothPrinter(bytes);
      if (ok) return { printed: true, mode: 'WEB_BLUETOOTH_ESCPOS', simulated: false };
    } catch {
      // fall through to browser print
    }
  }
  return null;
}

const defaultPrinterAdapter: PrinterHardwareAdapter = {
  async printEscPosText(content: string) {
    const hardwareRes = await tryWebHardwareBytesPrint(buildEscPosPlainTextBytes(content));
    if (hardwareRes) return hardwareRes;

    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
      return { printed: true, mode: 'BROWSER_PRINT' };
    }
    return { printed: false, mode: 'BROWSER_PRINT', simulated: true };
  },
  async printEscPosBytes(bytes: Uint8Array, textFallback?: string) {
    const hardwareRes = await tryWebHardwareBytesPrint(bytes);
    if (hardwareRes) return hardwareRes;

    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
      return { printed: true, mode: 'BROWSER_PRINT' };
    }
    return { printed: false, mode: 'BROWSER_PRINT', simulated: !textFallback };
  },
  async openCashDrawer() {
    const pulse = buildCashDrawerPulseBytes(2);
    const hardwareRes = await tryWebHardwareBytesPrint(pulse);
    if (hardwareRes) {
      return { opened: true, mode: hardwareRes.mode, simulated: false };
    }
    return { opened: false, mode: 'BROWSER_PRINT', simulated: true };
  },
};

const defaultScaleAdapter: ScaleHardwareAdapter = {
  async readWeightKg() {
    if (hasConnectedWebSerialScale()) {
      const reading = await readWeightFromWebSerialScale().catch(() => null);
      if (reading && reading.connected) {
        return {
          weightKg: reading.weightKg,
          stable: reading.stable,
          connected: true,
          simulated: false,
          source: 'WEB_SERIAL',
          protocol: reading.protocol,
        };
      }
    }
    return {
      weightKg: 0,
      stable: false,
      connected: false,
      simulated: true,
      source: 'MOCK',
      protocol: getBrowserHardwareCapabilities().webSerialSupported ? 'WEB_SERIAL_UNPAIRED' : 'NO_SCALE_DRIVER',
    };
  },
};

const defaultEdgeSidecarAdapter: EdgeSidecarAdapter = {
  async getSidecarStatus() {
    return { running: false, managedBy: 'NONE' };
  },
  async restartSidecar() {
    return { restarted: false };
  },
};

async function invokeTauriCommand<T = any>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  const invoke = w.__TAURI_INTERNALS__?.invoke || w.__TAURI__?.core?.invoke;
  if (typeof invoke !== 'function') return null;
  return invoke(cmd, args);
}

/**
 * Native desktop adapter for Store OS (Windows/Linux on Tauri 2).
 * Uses Tauri IPC commands for ESC/POS printing, serial scale, and the 3C Edge Node sidecar.
 */
export function createTauriPlatformAdapters(target: 'tauri-windows' | 'tauri-linux'): PlatformAdapters {
  return {
    target,
    storage: createTauriSecureStorageAdapter(),
    network: {
      ...defaultNetworkAdapter,
      getRootBaseUrl(): string {
        const edge = defaultNetworkAdapter.getEdgeBaseUrl();
        const preferEdgeLan = browserStorageAdapter.getItem('3ccorp_prefer_edge_lan') === 'true';
        if (edge && (!defaultNetworkAdapter.isOnline() || preferEdgeLan)) {
          return edge.replace(/\/$/, '');
        }
        // Tauri runs under tauri://localhost, so default to configured Cloud URL or local Edge sidecar
        return resolveConfiguredCloudBaseUrl() || 'http://127.0.0.1:3300';
      },
      getApiBaseUrl(): string {
        const root = this.getRootBaseUrl();
        return root ? `${root}/api/v1` : '/api/v1';
      },
    },
    links: defaultLinksAdapter,
    printer: {
      async printEscPosText(content: string) {
        const res = await invokeTauriCommand<{ printed: boolean; simulated?: boolean }>('print_escpos_receipt', {
          content,
        });
        if (res && res.printed && res.simulated !== true) {
          return { printed: true, mode: 'TAURI_ESCPOS', simulated: false };
        }
        return defaultPrinterAdapter.printEscPosText(content);
      },
      async printEscPosBytes(bytes: Uint8Array, textFallback?: string) {
        const res = await invokeTauriCommand<{ printed: boolean; simulated?: boolean }>('print_escpos_bytes', {
          bytesBase64: uint8ArrayToBase64(bytes),
        }).catch(() => null);
        if (res && res.printed && res.simulated !== true) {
          return { printed: true, mode: 'TAURI_ESCPOS', simulated: false };
        }
        const legacyRes = await invokeTauriCommand<{ printed: boolean; simulated?: boolean }>('print_escpos_receipt', {
          content: textFallback || uint8ArrayToLatin1String(bytes),
        }).catch(() => null);
        if (legacyRes && legacyRes.printed && legacyRes.simulated !== true) {
          return { printed: true, mode: 'TAURI_ESCPOS', simulated: false };
        }
        return defaultPrinterAdapter.printEscPosBytes!(bytes, textFallback);
      },
      async openCashDrawer() {
        const pulse = buildCashDrawerPulseBytes(2);
        const res = await invokeTauriCommand<{ printed: boolean; simulated?: boolean }>('print_escpos_bytes', {
          bytesBase64: uint8ArrayToBase64(pulse),
        }).catch(() => null);
        if (res && res.printed && res.simulated !== true) {
          return { opened: true, mode: 'TAURI_ESCPOS', simulated: false };
        }
        return defaultPrinterAdapter.openCashDrawer!();
      },
    },
    scale: {
      async readWeightKg() {
        const res = await invokeTauriCommand<{
          weightKg: number;
          stable: boolean;
          connected?: boolean;
          simulated?: boolean;
          protocol?: string;
        }>('read_scale_weight');
        if (res && typeof res.weightKg === 'number' && res.connected === true && res.simulated !== true) {
          return {
            weightKg: res.weightKg,
            stable: Boolean(res.stable),
            connected: true,
            simulated: false,
            source: 'TAURI_SERIAL',
            protocol: res.protocol,
          };
        }
        if (hasConnectedWebSerialScale()) {
          return defaultScaleAdapter.readWeightKg();
        }
        return {
          weightKg: res?.weightKg ?? 0,
          stable: false,
          connected: false,
          simulated: true,
          source: 'MOCK',
          protocol: res?.protocol || 'SANDBOX_SCALE_NO_SERIAL_PORT',
        };
      },
    },
    edgeSidecar: {
      async getSidecarStatus() {
        const res = await invokeTauriCommand<{ running: boolean; port?: number }>('get_edge_node_status');
        if (res) {
          return { running: Boolean(res.running), managedBy: 'TAURI_SIDECAR', port: res.port || 3300 };
        }
        return defaultEdgeSidecarAdapter.getSidecarStatus();
      },
      async restartSidecar() {
        const res = await invokeTauriCommand<{ restarted: boolean }>('restart_edge_node');
        return { restarted: Boolean(res?.restarted) };
      },
    },
  };
}

/**
 * Native mobile adapter for Android shells (Marketplace, Store Tablet, Driver, Waiter on Capacitor 6+).
 */
export function createCapacitorPlatformAdapters(): PlatformAdapters {
  return {
    target: 'capacitor-android',
    storage: createCapacitorSecureStorageAdapter(),
    network: {
      ...defaultNetworkAdapter,
      getRootBaseUrl(): string {
        const edge = defaultNetworkAdapter.getEdgeBaseUrl();
        const preferEdgeLan = browserStorageAdapter.getItem('3ccorp_prefer_edge_lan') === 'true';
        if (edge && (!defaultNetworkAdapter.isOnline() || preferEdgeLan)) {
          return edge.replace(/\/$/, '');
        }
        return resolveConfiguredCloudBaseUrl() || CLOUD_RUN_SERVICE_URL;
      },
      getApiBaseUrl(): string {
        const root = this.getRootBaseUrl();
        return root ? `${root}/api/v1` : '/api/v1';
      },
    },
    links: {
      ...defaultLinksAdapter,
      openExternal(url: string): void {
        const w = typeof window !== 'undefined' ? (window as any) : null;
        if (w?.Capacitor?.Plugins?.Browser?.open) {
          void w.Capacitor.Plugins.Browser.open({ url });
          return;
        }
        defaultLinksAdapter.openExternal(url);
      },
    },
    printer: {
      async printEscPosText(content: string) {
        const w = typeof window !== 'undefined' ? (window as any) : null;
        if (w?.Capacitor?.Plugins?.BluetoothPrinter?.printText) {
          await w.Capacitor.Plugins.BluetoothPrinter.printText({ text: content });
          return { printed: true, mode: 'CAPACITOR_BT', simulated: false };
        }
        return defaultPrinterAdapter.printEscPosText(content);
      },
      async printEscPosBytes(bytes: Uint8Array, textFallback?: string) {
        const w = typeof window !== 'undefined' ? (window as any) : null;
        const bt = w?.Capacitor?.Plugins?.BluetoothPrinter;
        if (bt?.printBase64) {
          await bt.printBase64({ data: uint8ArrayToBase64(bytes) });
          return { printed: true, mode: 'CAPACITOR_BT', simulated: false };
        }
        if (bt?.printText) {
          await bt.printText({ text: textFallback || uint8ArrayToLatin1String(bytes) });
          return { printed: true, mode: 'CAPACITOR_BT', simulated: false };
        }
        return defaultPrinterAdapter.printEscPosBytes!(bytes, textFallback);
      },
      async openCashDrawer() {
        const pulse = buildCashDrawerPulseBytes(2);
        const w = typeof window !== 'undefined' ? (window as any) : null;
        const bt = w?.Capacitor?.Plugins?.BluetoothPrinter;
        if (bt?.printBase64) {
          await bt.printBase64({ data: uint8ArrayToBase64(pulse) });
          return { opened: true, mode: 'CAPACITOR_BT', simulated: false };
        }
        return defaultPrinterAdapter.openCashDrawer!();
      },
    },
    scale: defaultScaleAdapter,
    edgeSidecar: defaultEdgeSidecarAdapter,
  };
}

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
