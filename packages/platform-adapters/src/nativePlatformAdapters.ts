import {
  buildCashDrawerPulseBytes,
  uint8ArrayToBase64,
  uint8ArrayToLatin1String,
} from './escposEncoder';
import { hasConnectedWebSerialScale } from './webHardwareTransport';
import {
  CLOUD_RUN_SERVICE_URL,
  isSensitiveStorageKey,
  type PlatformAdapters,
  type SecureStorageAdapter,
} from './adapterContracts';
import {
  browserStorageAdapter,
  defaultEdgeSidecarAdapter,
  defaultLinksAdapter,
  defaultNetworkAdapter,
  defaultPrinterAdapter,
  defaultScaleAdapter,
  memoryFallbackStore,
  resolveConfiguredCloudBaseUrl,
} from './webPlatformAdapters';

let capacitorVolatileWarningLogged = false;

async function invokeTauriCommand<T = any>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  const invoke = w.__TAURI_INTERNALS__?.invoke || w.__TAURI__?.core?.invoke;
  if (typeof invoke !== 'function') return null;
  return invoke(cmd, args);
}

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
