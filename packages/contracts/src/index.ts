/**
 * 3C Corp SaaS - Platform API & Sync Contracts (@3c/contracts)
 * RFC-001 Shared Level 1 Contracts.
 */

export const CONTRACT_VERSION = '1.0';

export type AppId =
  | 'unified-portal'
  | 'marketplace'
  | 'store-os'
  | 'driver'
  | 'waiter'
  | 'hq'
  | 'server-core';

export type RuntimePlatform =
  | 'web'
  | 'tauri-windows'
  | 'tauri-linux'
  | 'capacitor-android'
  | 'node-test'
  | 'edge-node-sqlite';

export interface ClientContractContext {
  contractVersion: string;
  appId: string;
  platform: string;
  appVersion: string;
  idempotencyKey?: string;
}

export const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'IN_PREPARATION', 'CANCELLED'],
  CONFIRMED: ['IN_PREPARATION', 'READY_FOR_PICKUP', 'CANCELLED'],
  IN_PREPARATION: ['READY_FOR_PICKUP', 'CANCELLED'],
  READY_FOR_PICKUP: ['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const TERMINAL_ORDER_STATES = new Set<string>(['DELIVERED', 'CANCELLED']);

export function isValidOrderStatusTransition(fromStatus: string, toStatus: string): boolean {
  const allowed = ORDER_STATUS_TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
}

export const PLATFORM_CONTRACT_MANIFEST = {
  contractVersion: CONTRACT_VERSION,
  architectureRfc: 'RFC-001-3C-CORP-MULTIPLATFORM',
  edgeMode: 'standard',
  desktopRuntime: 'tauri-2',
  mobileRuntime: 'capacitor',
  products: {
    marketplace: { platforms: ['web-pwa', 'android'], minSupportedVersion: '5.0.0' },
    'store-os': {
      platforms: ['web', 'windows-tauri2', 'linux-tauri2', 'android-tablet'],
      minSupportedVersion: '5.0.0',
    },
    driver: { platforms: ['web', 'android'], minSupportedVersion: '5.0.0' },
    waiter: { platforms: ['web', 'android'], minSupportedVersion: '5.0.0' },
    hq: { platforms: ['web'], minSupportedVersion: '5.0.0' },
    'server-core': { platforms: ['cloud-node', 'edge-node-standard'], minSupportedVersion: '5.0.0' },
  },
} as const;

export type ReleaseChannel = 'stable' | 'beta' | 'canary';

export interface DistributionArtifact {
  platform: 'web' | 'windows' | 'linux' | 'android' | 'android-tablet' | 'docker' | 'edge-sidecar';
  format: 'pwa' | '.exe' | '.msi' | '.AppImage' | '.deb' | '.apk' | '.aab' | 'oci-image' | 'binary';
  runtime: 'browser' | 'tauri-2' | 'capacitor-6' | 'node-22';
  packageName: string;
  bundleId?: string;
  downloadPath: string;
  checksumSha256?: string;
}

export interface ProductReleaseManifestEntry {
  appId: Exclude<AppId, 'unified-portal'>;
  displayName: string;
  latestVersion: string;
  minSupportedVersion: string;
  contractVersion: string;
  channel: ReleaseChannel;
  releasedAt: string;
  releaseNotes: string;
  artifacts: DistributionArtifact[];
}

export interface ReleaseManagerManifest {
  managerName: '3C Release Manager';
  releaseTrain: string;
  contractVersion: string;
  generatedAt: string;
  products: Record<Exclude<AppId, 'unified-portal'>, ProductReleaseManifestEntry>;
}

export interface CompatibilityEvaluation {
  compatible: boolean;
  updateRequired: boolean;
  updateAvailable: boolean;
  appId: string;
  currentVersion: string;
  latestVersion: string;
  minSupportedVersion: string;
  contractVersion: string;
  recommendedArtifacts: DistributionArtifact[];
}

export function compareSemver(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/, '')
      .split('-')[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

const RELEASE_TIMESTAMP = '2026-11-12T00:00:00.000Z';

export const RELEASE_MANAGER_MANIFEST: ReleaseManagerManifest = {
  managerName: '3C Release Manager',
  releaseTrain: '2026.11-5.2',
  contractVersion: CONTRACT_VERSION,
  generatedAt: RELEASE_TIMESTAMP,
  products: {
    marketplace: {
      appId: 'marketplace',
      displayName: '3C Marketplace',
      latestVersion: '5.2.1',
      minSupportedVersion: '5.0.0',
      contractVersion: CONTRACT_VERSION,
      channel: 'stable',
      releasedAt: RELEASE_TIMESTAMP,
      releaseNotes: 'PWA responsiva e shell Capacitor Android independente com checkout atômico.',
      artifacts: [
        {
          platform: 'web',
          format: 'pwa',
          runtime: 'browser',
          packageName: '@3c/marketplace-web',
          downloadPath: '/?app=marketplace',
        },
        {
          platform: 'android',
          format: '.aab',
          runtime: 'capacitor-6',
          packageName: '@3c/marketplace-android',
          bundleId: 'com.threec.marketplace',
          downloadPath: '/releases/marketplace/5.2.1/3c-marketplace-5.2.1.aab',
        },
        {
          platform: 'android',
          format: '.apk',
          runtime: 'capacitor-6',
          packageName: '@3c/marketplace-android',
          bundleId: 'com.threec.marketplace',
          downloadPath: '/releases/marketplace/5.2.1/3c-marketplace-5.2.1.apk',
        },
      ],
    },
    'store-os': {
      appId: 'store-os',
      displayName: '3C Store OS',
      latestVersion: '5.2.1',
      minSupportedVersion: '5.0.0',
      contractVersion: CONTRACT_VERSION,
      channel: 'stable',
      releasedAt: RELEASE_TIMESTAMP,
      releaseNotes: 'PDV multi-segmento com Tauri 2 (Windows/Linux), Capacitor Tablet e 3C Edge Node Padrão.',
      artifacts: [
        {
          platform: 'web',
          format: 'pwa',
          runtime: 'browser',
          packageName: '@3c/store-web',
          downloadPath: '/?app=store-os',
        },
        {
          platform: 'windows',
          format: '.msi',
          runtime: 'tauri-2',
          packageName: '@3c/store-desktop',
          bundleId: 'com.threec.storeos',
          downloadPath: '/releases/store-os/5.2.1/3C-Store-OS_5.2.1_x64.msi',
        },
        {
          platform: 'windows',
          format: '.exe',
          runtime: 'tauri-2',
          packageName: '@3c/store-desktop',
          bundleId: 'com.threec.storeos',
          downloadPath: '/releases/store-os/5.2.1/3C-Store-OS_5.2.1_x64-setup.exe',
        },
        {
          platform: 'linux',
          format: '.AppImage',
          runtime: 'tauri-2',
          packageName: '@3c/store-desktop',
          bundleId: 'com.threec.storeos',
          downloadPath: '/releases/store-os/5.2.1/3C-Store-OS_5.2.1_amd64.AppImage',
        },
        {
          platform: 'linux',
          format: '.deb',
          runtime: 'tauri-2',
          packageName: '@3c/store-desktop',
          bundleId: 'com.threec.storeos',
          downloadPath: '/releases/store-os/5.2.1/3C-Store-OS_5.2.1_amd64.deb',
        },
        {
          platform: 'android-tablet',
          format: '.apk',
          runtime: 'capacitor-6',
          packageName: '@3c/store-android',
          bundleId: 'com.threec.store',
          downloadPath: '/releases/store-os/5.2.1/3c-store-tablet-5.2.1.apk',
        },
      ],
    },
    driver: {
      appId: 'driver',
      displayName: '3C Driver',
      latestVersion: '5.2.1',
      minSupportedVersion: '5.0.0',
      contractVersion: CONTRACT_VERSION,
      channel: 'stable',
      releasedAt: RELEASE_TIMESTAMP,
      releaseNotes: 'App de campo com telemetria GPS em segundo plano, rotas e confirmação de entrega.',
      artifacts: [
        {
          platform: 'web',
          format: 'pwa',
          runtime: 'browser',
          packageName: '@3c/driver-web',
          downloadPath: '/?app=driver',
        },
        {
          platform: 'android',
          format: '.aab',
          runtime: 'capacitor-6',
          packageName: '@3c/driver-android',
          bundleId: 'com.threec.driver',
          downloadPath: '/releases/driver/5.2.1/3c-driver-5.2.1.aab',
        },
        {
          platform: 'android',
          format: '.apk',
          runtime: 'capacitor-6',
          packageName: '@3c/driver-android',
          bundleId: 'com.threec.driver',
          downloadPath: '/releases/driver/5.2.1/3c-driver-5.2.1.apk',
        },
      ],
    },
    waiter: {
      appId: 'waiter',
      displayName: '3C Waiter',
      latestVersion: '5.2.1',
      minSupportedVersion: '5.0.0',
      contractVersion: CONTRACT_VERSION,
      channel: 'stable',
      releasedAt: RELEASE_TIMESTAMP,
      releaseNotes: 'Atendimento por mesas BYOD com pareamento LAN no Edge Node e fallback offline.',
      artifacts: [
        {
          platform: 'web',
          format: 'pwa',
          runtime: 'browser',
          packageName: '@3c/waiter-web',
          downloadPath: '/?app=waiter',
        },
        {
          platform: 'android',
          format: '.apk',
          runtime: 'capacitor-6',
          packageName: '@3c/waiter-android',
          bundleId: 'com.threec.waiter',
          downloadPath: '/releases/waiter/5.2.1/3c-waiter-5.2.1.apk',
        },
      ],
    },
    hq: {
      appId: 'hq',
      displayName: '3C HQ Central',
      latestVersion: '5.2.1',
      minSupportedVersion: '5.0.0',
      contractVersion: CONTRACT_VERSION,
      channel: 'stable',
      releasedAt: RELEASE_TIMESTAMP,
      releaseNotes: 'Governança global, licenciamento multi-empresa e console Server Core.',
      artifacts: [
        {
          platform: 'web',
          format: 'pwa',
          runtime: 'browser',
          packageName: '@3c/hq-web',
          downloadPath: '/?app=hq',
        },
      ],
    },
    'server-core': {
      appId: 'server-core',
      displayName: '3C Server Core & Edge Node',
      latestVersion: '5.2.1',
      minSupportedVersion: '5.0.0',
      contractVersion: CONTRACT_VERSION,
      channel: 'stable',
      releasedAt: RELEASE_TIMESTAMP,
      releaseNotes: 'Núcleo transacional Cloud e sidecar Edge SQLite WAL com reconciliação HLC.',
      artifacts: [
        {
          platform: 'docker',
          format: 'oci-image',
          runtime: 'node-22',
          packageName: '3c-corp-monorepo',
          downloadPath: '3c-corp/server-core:5.2.1',
        },
        {
          platform: 'edge-sidecar',
          format: 'binary',
          runtime: 'node-22',
          packageName: '@3c/edge-node',
          downloadPath: '/releases/edge-node/5.2.1/3c-edge-node',
        },
      ],
    },
  },
};

export function evaluateAppCompatibility(
  appId: string,
  currentVersion: string,
  platform?: string
): CompatibilityEvaluation | null {
  const entry = (RELEASE_MANAGER_MANIFEST.products as Record<string, ProductReleaseManifestEntry>)[appId];
  if (!entry) return null;

  const belowMin = compareSemver(currentVersion, entry.minSupportedVersion) < 0;
  const belowLatest = compareSemver(currentVersion, entry.latestVersion) < 0;

  const recommendedArtifacts = platform
    ? entry.artifacts.filter((a) => platform.includes(a.platform) || a.platform.includes(platform))
    : entry.artifacts;

  return {
    compatible: !belowMin,
    updateRequired: belowMin,
    updateAvailable: belowLatest,
    appId: entry.appId,
    currentVersion,
    latestVersion: entry.latestVersion,
    minSupportedVersion: entry.minSupportedVersion,
    contractVersion: entry.contractVersion,
    recommendedArtifacts: recommendedArtifacts.length > 0 ? recommendedArtifacts : entry.artifacts,
  };
}

