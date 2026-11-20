import { getPlatformAdapters } from '@3c/platform-adapters';
import type { CompatibilityEvaluation, ReleaseManagerManifest } from '@3c/contracts';
import type { MarketplaceGovernanceConfig } from '@3c/shared-types';
import { rawFetch, requestJson } from './httpClient.ts';

export const systemApi = {
  async getHealth() {
    return requestJson('/health', { method: 'GET' });
  },

  async getPublicConfig() {
    return requestJson<{
      globalAnnouncementBanner: string;
      aiEngineEnabled: boolean;
      maintenanceMode: boolean;
      marketplaceReadOnly?: boolean;
      maintenanceMessage?: string;
      marketplaceConfig?: MarketplaceGovernanceConfig;
    }>('/system/public-config', {
      method: 'GET',
      skipAuthInvalidationOn401: true,
    });
  },

  async getContractsManifest() {
    return requestJson('/system/contracts', { method: 'GET' });
  },

  async getReleaseManifest(): Promise<ReleaseManagerManifest> {
    return requestJson<ReleaseManagerManifest>('/system/releases', { method: 'GET' });
  },

  async getReleaseArtifacts(): Promise<{
    managerName: string;
    releaseTrain: string;
    remoteReleaseConfigured?: boolean;
    products: Record<
      string,
      {
        appId: string;
        displayName: string;
        latestVersion: string;
        artifacts: Array<{
          platform: string;
          format: string;
          runtime: string;
          packageName: string;
          bundleId?: string;
          downloadPath: string;
          available: boolean;
          source?: 'LOCAL_DISK' | 'REMOTE_RELEASE_URL' | 'UNPUBLISHED';
          fileName?: string;
          fileSizeBytes?: number | null;
          sha256?: string | null;
          downloadUrl?: string;
          externalDownloadUrl?: string | null;
          buildCommand?: string | null;
        }>;
      }
    >;
  }> {
    return requestJson('/system/releases/artifacts', { method: 'GET' });
  },

  async getReleaseArtifactInfo(params: {
    appId: string;
    platform: string;
    format?: string;
  }): Promise<{
    available: boolean;
    source?: 'LOCAL_DISK' | 'REMOTE_RELEASE_URL' | 'UNPUBLISHED';
    appId: string;
    displayName: string;
    version: string;
    artifact: {
      platform: string;
      format: string;
      runtime: string;
      packageName: string;
      bundleId?: string;
      downloadPath: string;
    };
    fileName: string;
    fileSizeBytes?: number | null;
    sha256?: string | null;
    downloadUrl: string;
    externalDownloadUrl?: string | null;
    fallbackWebUrl: string;
    buildCommand: string | null;
  }> {
    const qs = new URLSearchParams({
      meta: '1',
      ...(params.format ? { format: params.format } : {}),
    });
    return requestJson(
      `/system/releases/download/${encodeURIComponent(params.appId)}/${encodeURIComponent(params.platform)}?${qs.toString()}`,
      { method: 'GET' }
    );
  },

  async checkAppCompatibility(params: {
    appId: string;
    version: string;
    platform?: string;
  }): Promise<CompatibilityEvaluation> {
    const qs = new URLSearchParams({
      appId: params.appId,
      version: params.version,
      ...(params.platform ? { platform: params.platform } : {}),
    });
    return requestJson<CompatibilityEvaluation>(`/system/releases/check?${qs.toString()}`, {
      method: 'GET',
    });
  },

  async sendClusterCommand(command: 'FORCE_FAILOVER' | 'FLUSH_REDIS', token?: string) {
    const base = getPlatformAdapters().network.getApiBaseUrl();
    const resp = await rawFetch(`${base}/sse/cluster/command`, {
      method: 'POST',
      body: { command },
      token,
      appId: 'hq',
    });
    const data = await resp.json().catch(() => ({}));
    return { ok: resp.ok, data };
  },

  async createSseTicket(token?: string) {
    return requestJson<{ ticket: string; expiresAt: string; ttlSeconds: number }>('/sse/ticket', {
      method: 'POST',
      body: {},
      token,
    });
  },

  async callGeminiProxy(prompt: string, token?: string): Promise<{ text?: string }> {
    const root = getPlatformAdapters().network.getRootBaseUrl();
    const resp = await rawFetch(`${root}/api/gemini`, {
      method: 'POST',
      body: { prompt },
      token,
      idempotency: false,
    });
    if (!resp.ok) {
      throw new Error('Server proxy error');
    }
    return resp.json();
  },

  async getSupabaseHealth(token?: string) {
    return requestJson<{
      online: boolean;
      standbyByHq?: boolean;
      configured: boolean;
      hasSecretKey: boolean;
      masterEnabled: boolean;
      authEnabled: boolean;
      dbEnabled: boolean;
      url: string;
      jwksUrl: string;
      oauthAuthorizeUrl?: string;
      oauthTokenUrl?: string;
      oidcDiscoveryUrl?: string;
      jwksReachable: boolean;
      oidcReachable?: boolean;
      authHealthStatus: number | null;
      latencyMs: number;
      source: string;
      detail: string;
      migrationsReady?: boolean;
      migrationsCount?: number;
      latestMigration?: string | null;
    }>('/supabase/health', {
      method: 'GET',
      token,
    });
  },
};
