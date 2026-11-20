export interface ArtifactEntry {
  platform: string;
  format: string;
  runtime: string;
  packageName: string;
  bundleId?: string;
  downloadPath: string;
  available: boolean;
  source: 'LOCAL_DISK' | 'REMOTE_RELEASE_URL' | 'UNPUBLISHED' | 'DISABLED_BY_HQ';
  fileName: string;
  fileSizeBytes: number | null;
  sha256: string | null;
  downloadUrl: string;
  externalDownloadUrl: string | null;
  buildCommand: string | null;
}

export interface ProductReleaseSummary {
  appId: string;
  displayName: string;
  latestVersion: string;
  minSupportedVersion: string;
  channel: string;
  releasedAt: string;
  releaseNotes: string;
  downloadsEnabled?: boolean;
  artifacts: ArtifactEntry[];
}

export interface ReleaseArtifactsResponse {
  managerName: string;
  releaseTrain: string;
  contractVersion: string;
  remoteReleaseConfigured?: boolean;
  effectiveReleaseBaseUrl?: string | null;
  releaseBaseUrlSource?: 'HQ_GOVERNANCE' | 'ENV_VAR' | 'UNCONFIGURED';
  activeChannel?: 'stable' | 'beta' | 'canary';
  disabledProducts?: string[];
  tauriSigned?: boolean;
  tauriReleaseChannel?: string;
  products: Record<string, ProductReleaseSummary>;
}

export const RELEASE_PRODUCT_ORDER = [
  'store-os',
  'marketplace',
  'driver',
  'waiter',
  'server-core',
  'hq',
] as const;

export function formatArtifactBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
