import {
  buildCashDrawerPulseBytes,
  buildEscPosPlainTextBytes,
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
import {
  detectRuntimeTarget,
  type EdgeSidecarAdapter,
  type ExternalLinkAdapter,
  type HostOperatingSystem,
  type LocalTerminalInfo,
  type NetworkResolverAdapter,
  type PrinterDispatchResult,
  type PrinterHardwareAdapter,
  type ScaleHardwareAdapter,
  type SecureStorageAdapter,
} from './adapterContracts';

export const memoryFallbackStore = new Map<string, string>();
let activeEdgeBaseUrl: string | null = null;

export const browserStorageAdapter: SecureStorageAdapter = {
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

export function resolveConfiguredCloudBaseUrl(): string {
  const envCloudUrl =
    typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CLOUD_API_URL
      ? String((import.meta as any).env.VITE_CLOUD_API_URL).trim().replace(/\/+$/, '')
      : '';
  if (envCloudUrl) return envCloudUrl;
  const storedCloudUrl = browserStorageAdapter.getItem('3ccorp_cloud_api_url');
  return storedCloudUrl ? storedCloudUrl.trim().replace(/\/+$/, '') : '';
}

export const defaultNetworkAdapter: NetworkResolverAdapter = {
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

export const defaultLinksAdapter: ExternalLinkAdapter = {
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

export const defaultPrinterAdapter: PrinterHardwareAdapter = {
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

export const defaultScaleAdapter: ScaleHardwareAdapter = {
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

export const defaultEdgeSidecarAdapter: EdgeSidecarAdapter = {
  async getSidecarStatus() {
    return { running: false, managedBy: 'NONE' };
  },
  async restartSidecar() {
    return { restarted: false };
  },
};

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
