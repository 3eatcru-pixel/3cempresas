import express from 'express';
import fs from 'fs';
import path from 'path';
import {
  compareSemver,
  DistributionArtifact,
  evaluateAppCompatibility,
  PLATFORM_CONTRACT_MANIFEST,
  ProductReleaseManifestEntry,
  RELEASE_MANAGER_MANIFEST,
} from '@3c/contracts';
import type { ReleaseDistributionConfig } from '@3c/shared-types';
import { db, runWithSystemDbContext } from '../config.ts';
import {
  DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG,
  DEFAULT_RELEASE_DISTRIBUTION_CONFIG,
} from '../../constants/platformDefaults.ts';

const router = express.Router();

const BUILD_COMMANDS: Record<string, Record<string, string>> = {
  'store-os': {
    windows: 'npm --workspace=@3c/store-desktop run sidecar:prepare:strict && npm --workspace=@3c/store-desktop run build:windows',
    'android-tablet': 'npm --workspace=@3c/store-android run cap:sync && cd apps/store-android/android && ./gradlew assembleRelease',
    android: 'npm --workspace=@3c/store-android run cap:sync && cd apps/store-android/android && ./gradlew assembleRelease',
    linux: 'npm --workspace=@3c/store-desktop run sidecar:prepare:strict && npm --workspace=@3c/store-desktop run build:linux',
  },
  marketplace: {
    android: 'npm --workspace=@3c/marketplace-android run cap:sync && cd apps/marketplace-android/android && ./gradlew assembleRelease',
  },
  driver: {
    android: 'npm --workspace=@3c/driver-android run cap:sync && cd apps/driver-android/android && ./gradlew assembleRelease',
  },
  waiter: {
    android: 'npm --workspace=@3c/waiter-android run cap:sync && cd apps/waiter-android/android && ./gradlew assembleRelease',
  },
};

function getReleasesBaseDir(): string {
  if (process.env.RELEASES_DIR) {
    return path.resolve(process.env.RELEASES_DIR);
  }
  const publicReleases = path.resolve(process.cwd(), 'public', 'releases');
  if (fs.existsSync(publicReleases)) {
    return publicReleases;
  }
  return path.resolve(process.cwd(), 'releases-dist');
}

function validateReleaseBaseUrl(rawValue?: string | null): string | null {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const isLocalHttp =
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    if (parsed.protocol !== 'https:' && !isLocalHttp) {
      return null;
    }
    return raw.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

interface EffectiveReleaseGovernance {
  config: ReleaseDistributionConfig;
  effectiveRemoteBaseUrl: string | null;
  remoteBaseUrlSource: 'HQ_GOVERNANCE' | 'ENV_VAR' | 'UNCONFIGURED';
  disabledProductsSet: Set<string>;
}

async function loadEffectiveReleaseGovernanceAsync(): Promise<EffectiveReleaseGovernance> {
  let stored: Partial<ReleaseDistributionConfig> = {};
  try {
    const govSnap = await runWithSystemDbContext('SYSTEM_RELEASES_CONFIG', () =>
      db.collection('governance').doc('governance').get()
    );
    if (govSnap.exists && govSnap.data()?.releaseConfig) {
      stored = govSnap.data()!.releaseConfig;
    }
  } catch {
    // Fallback to environment / default config
  }

  const config: ReleaseDistributionConfig = {
    ...DEFAULT_RELEASE_DISTRIBUTION_CONFIG,
    ...stored,
    disabledProducts: Array.isArray(stored.disabledProducts) ? stored.disabledProducts : [],
  };

  const hqUrl = validateReleaseBaseUrl(config.releaseBaseUrl);
  const envUrl = validateReleaseBaseUrl(process.env.RELEASE_BASE_URL);
  const effectiveRemoteBaseUrl = hqUrl || envUrl || null;
  const remoteBaseUrlSource: EffectiveReleaseGovernance['remoteBaseUrlSource'] = hqUrl
    ? 'HQ_GOVERNANCE'
    : envUrl
    ? 'ENV_VAR'
    : 'UNCONFIGURED';

  return {
    config,
    effectiveRemoteBaseUrl,
    remoteBaseUrlSource,
    disabledProductsSet: new Set(config.disabledProducts.map((p) => String(p).toLowerCase())),
  };
}

async function resolveArtifactOnDiskAsync(artifact: DistributionArtifact): Promise<{
  diskFile: string;
  fileSizeBytes: number;
} | null> {
  if (!artifact.downloadPath.startsWith('/releases/')) return null;
  const relPath = artifact.downloadPath.replace(/^\/releases\//, '');
  const baseDir = getReleasesBaseDir();
  const candidates = [
    path.resolve(baseDir, relPath),
    path.resolve(baseDir, path.basename(relPath)),
  ];
  for (const resolved of candidates) {
    if (!resolved.startsWith(baseDir + path.sep) && resolved !== baseDir) {
      continue;
    }
    try {
      const stat = await fs.promises.stat(resolved);
      if (stat.isFile()) {
        return { diskFile: resolved, fileSizeBytes: stat.size };
      }
    } catch {
      // candidate not present on disk
    }
  }
  return null;
}

function resolveArtifactRemoteUrl(
  artifact: DistributionArtifact,
  effectiveRemoteBaseUrl: string | null
): string | null {
  if (!artifact.downloadPath.startsWith('/releases/')) return null;
  if (!effectiveRemoteBaseUrl) return null;
  const fileName = path.basename(artifact.downloadPath);
  if (!fileName || fileName.includes('..')) return null;
  return `${effectiveRemoteBaseUrl}/${encodeURIComponent(fileName)}`;
}

async function resolveArtifactSha256Async(
  diskFile: string,
  sumsMap?: Map<string, string>
): Promise<string | null> {
  try {
    const directSha = `${diskFile}.sha256`;
    try {
      const raw = await fs.promises.readFile(directSha, 'utf8');
      const token = raw.trim().split(/\s+/)[0];
      if (/^[a-fA-F0-9]{64}$/.test(token)) return token.toLowerCase();
    } catch {
      // optional sidecar checksum absent
    }
    const targetName = path.basename(diskFile);
    if (sumsMap) {
      return sumsMap.get(targetName) || null;
    }
    const sumsPath = path.join(getReleasesBaseDir(), 'SHA256SUMS.txt');
    try {
      const lines = (await fs.promises.readFile(sumsPath, 'utf8')).split(/\r?\n/);
      for (const line of lines) {
        const match = line.trim().match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
        if (match && path.basename(match[2].trim()) === targetName) {
          return match[1].toLowerCase();
        }
      }
    } catch {
      // optional SHA256SUMS.txt absent
    }
  } catch {
    // Ignore optional checksum lookup errors
  }
  return null;
}

async function loadSha256SumsMapAsync(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const sumsPath = path.join(getReleasesBaseDir(), 'SHA256SUMS.txt');
    const lines = (await fs.promises.readFile(sumsPath, 'utf8')).split(/\r?\n/);
    for (const line of lines) {
      const match = line.trim().match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
      if (match) {
        map.set(path.basename(match[2].trim()), match[1].toLowerCase());
      }
    }
  } catch {
    // SHA256SUMS.txt not present
  }
  return map;
}

async function inspectArtifactAvailabilityAsync(
  artifact: DistributionArtifact,
  effectiveRemoteBaseUrl: string | null,
  sumsMap?: Map<string, string>,
  isProductDisabled = false
) {
  if (isProductDisabled && artifact.platform !== 'web') {
    return {
      available: false,
      source: 'DISABLED_BY_HQ' as const,
      diskFile: null as string | null,
      externalDownloadUrl: null as string | null,
      fileSizeBytes: null as number | null,
      sha256: null as string | null,
    };
  }

  const diskInfo = await resolveArtifactOnDiskAsync(artifact);
  if (diskInfo) {
    return {
      available: true,
      source: 'LOCAL_DISK' as const,
      diskFile: diskInfo.diskFile,
      externalDownloadUrl: null as string | null,
      fileSizeBytes: diskInfo.fileSizeBytes,
      sha256: await resolveArtifactSha256Async(diskInfo.diskFile, sumsMap),
    };
  }

  const remoteUrl = resolveArtifactRemoteUrl(artifact, effectiveRemoteBaseUrl);
  if (remoteUrl) {
    return {
      available: true,
      source: 'REMOTE_RELEASE_URL' as const,
      diskFile: null as string | null,
      externalDownloadUrl: remoteUrl,
      fileSizeBytes: null as number | null,
      sha256: null as string | null,
    };
  }

  return {
    available: false,
    source: 'UNPUBLISHED' as const,
    diskFile: null as string | null,
    externalDownloadUrl: null as string | null,
    fileSizeBytes: null as number | null,
    sha256: null as string | null,
  };
}

router.get('/revisions', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(db.getRevisions());
});

router.get('/contracts', (_req, res) => {
  res.json(PLATFORM_CONTRACT_MANIFEST);
});

router.get('/releases', async (_req, res) => {
  const { config } = await loadEffectiveReleaseGovernanceAsync();
  res.json({
    ...RELEASE_MANAGER_MANIFEST,
    activeChannel: config.channel,
    minSupportedVersionOverride: config.minSupportedVersionOverride || null,
    releaseNotesOverride: config.releaseNotesOverride || null,
  });
});

router.get('/releases/artifacts', async (_req, res) => {
  const [sumsMap, releaseGov] = await Promise.all([
    loadSha256SumsMapAsync(),
    loadEffectiveReleaseGovernanceAsync(),
  ]);
  const productEntries = await Promise.all(
    Object.entries(RELEASE_MANAGER_MANIFEST.products).map(async ([appId, entry]) => {
      const isDisabled = releaseGov.disabledProductsSet.has(appId.toLowerCase());
      const artifacts = await Promise.all(
        entry.artifacts.map(async (artifact) => {
          const status = await inspectArtifactAvailabilityAsync(
            artifact,
            releaseGov.effectiveRemoteBaseUrl,
            sumsMap,
            isDisabled
          );
          return {
            ...artifact,
            available: status.available,
            source: status.source,
            fileName: path.basename(artifact.downloadPath),
            fileSizeBytes: status.fileSizeBytes,
            sha256: status.sha256,
            downloadUrl: `/api/v1/system/releases/download/${appId}/${artifact.platform}?format=${encodeURIComponent(artifact.format)}`,
            externalDownloadUrl: status.externalDownloadUrl,
            buildCommand: BUILD_COMMANDS[appId]?.[artifact.platform] || null,
          };
        })
      );
      return [
        appId,
        {
          ...entry,
          channel: releaseGov.config.channel || entry.channel,
          minSupportedVersion: releaseGov.config.minSupportedVersionOverride || entry.minSupportedVersion,
          releaseNotes: releaseGov.config.releaseNotesOverride || entry.releaseNotes,
          downloadsEnabled: !isDisabled,
          artifacts,
        },
      ] as const;
    })
  );
  const sigMap = releaseGov.config.artifactSignatures || {};
  const hasHqSignature = Object.values(sigMap).some((v) => typeof v === 'string' && v.trim().length > 0);
  const tauriSigned = hasHqSignature || Boolean((process.env.TAURI_RELEASE_SIGNATURE || '').trim());
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ...RELEASE_MANAGER_MANIFEST,
    remoteReleaseConfigured: Boolean(releaseGov.effectiveRemoteBaseUrl),
    effectiveReleaseBaseUrl: releaseGov.effectiveRemoteBaseUrl,
    releaseBaseUrlSource: releaseGov.remoteBaseUrlSource,
    activeChannel: releaseGov.config.channel,
    disabledProducts: releaseGov.config.disabledProducts,
    tauriSigned,
    tauriReleaseChannel: tauriSigned ? 'SIGNED_RELEASE' : 'UNSIGNED_SANDBOX_MANIFEST',
    products: Object.fromEntries(productEntries),
  });
});

router.get('/releases/download/:appId/:platform', async (req, res) => {
  const { appId, platform } = req.params;
  const formatFilter = req.query.format ? String(req.query.format) : undefined;
  const products = RELEASE_MANAGER_MANIFEST.products as Record<string, ProductReleaseManifestEntry>;
  const product = products[appId];
  if (!product) {
    return res.status(404).json({ error: `Produto '${appId}' não encontrado no 3C Release Manager.` });
  }

  const normalizedPlatform = platform.toLowerCase();
  const candidates = product.artifacts.filter((a) => {
    const platMatch =
      a.platform.toLowerCase() === normalizedPlatform ||
      (normalizedPlatform === 'android' && a.platform === 'android-tablet');
    if (!platMatch) return false;
    if (formatFilter) return a.format.toLowerCase() === formatFilter.toLowerCase();
    return true;
  });

  const artifact = candidates[0];
  if (!artifact) {
    return res.status(404).json({
      error: `Artefato para '${appId}' (${platform}) não encontrado no manifesto.`,
    });
  }

  const releaseGov = await loadEffectiveReleaseGovernanceAsync();
  const isDisabled = releaseGov.disabledProductsSet.has(appId.toLowerCase());
  const status = await inspectArtifactAvailabilityAsync(
    artifact,
    releaseGov.effectiveRemoteBaseUrl,
    undefined,
    isDisabled
  );
  const fileName = path.basename(artifact.downloadPath);

  if (req.query.meta !== '1') {
    if (status.diskFile) {
      return res.download(status.diskFile, fileName);
    }
    if (status.externalDownloadUrl) {
      return res.redirect(302, status.externalDownloadUrl);
    }
  }

  const webArtifact = product.artifacts.find((a) => a.platform === 'web');
  return res.json({
    available: status.available,
    source: status.source,
    appId: product.appId,
    displayName: product.displayName,
    version: product.latestVersion,
    artifact,
    fileName,
    fileSizeBytes: status.fileSizeBytes,
    sha256: status.sha256,
    downloadUrl: `/api/v1/system/releases/download/${product.appId}/${artifact.platform}?format=${encodeURIComponent(artifact.format)}`,
    externalDownloadUrl: status.externalDownloadUrl,
    fallbackWebUrl: webArtifact?.downloadPath || `/?app=${product.appId}`,
    buildCommand: BUILD_COMMANDS[product.appId]?.[artifact.platform] || null,
  });
});

router.get('/releases/check', async (req, res) => {
  const clientContext = (req as any).clientContext;
  const appId = String(req.query.appId || clientContext?.appId || 'store-os');
  const currentVersion = String(req.query.version || clientContext?.appVersion || '5.2.1');
  const platform = req.query.platform ? String(req.query.platform) : clientContext?.platform;

  const evaluation = evaluateAppCompatibility(appId, currentVersion, platform);
  if (!evaluation) {
    return res.status(404).json({ error: `Produto '${appId}' não registrado no 3C Release Manager.` });
  }
  const { config } = await loadEffectiveReleaseGovernanceAsync();
  if (config.minSupportedVersionOverride) {
    const belowMin = compareSemver(currentVersion, config.minSupportedVersionOverride) < 0;
    return res.json({
      ...evaluation,
      minSupportedVersion: config.minSupportedVersionOverride,
      compatible: !belowMin,
      updateRequired: belowMin,
    });
  }
  return res.json(evaluation);
});

/**
 * Tauri 2 updater endpoint compatible with @tauri-apps/plugin-updater
 * Returns 204 No Content when client is up-to-date, or updater JSON when newer release exists.
 */
router.get('/releases/tauri/:target/:arch/:currentVersion', async (req, res) => {
  const { target, arch, currentVersion } = req.params;
  const storeOs = RELEASE_MANAGER_MANIFEST.products['store-os'];
  if (compareSemver(currentVersion, storeOs.latestVersion) >= 0) {
    return res.status(204).send();
  }

  const releaseGov = await loadEffectiveReleaseGovernanceAsync();
  const normalizedTarget = target.toLowerCase().includes('win') ? 'windows' : 'linux';
  const artifact =
    storeOs.artifacts.find((a) => a.platform === normalizedTarget && (a.format === '.msi' || a.format === '.AppImage')) ||
    storeOs.artifacts.find((a) => a.platform === normalizedTarget);
  const sigMap = releaseGov.config.artifactSignatures || {};
  const specificSigKey = artifact ? `${normalizedTarget}:${artifact.format}` : normalizedTarget;
  const configuredSignature = String(
    sigMap[specificSigKey] ||
      sigMap[normalizedTarget] ||
      process.env.TAURI_RELEASE_SIGNATURE ||
      ''
  ).trim();
  const isSigned = configuredSignature.length > 0;
  const remoteUrl = artifact
    ? resolveArtifactRemoteUrl(artifact, releaseGov.effectiveRemoteBaseUrl)
    : null;
  const baseNotes = releaseGov.config.releaseNotesOverride || storeOs.releaseNotes;

  return res.json({
    version: storeOs.latestVersion,
    notes: isSigned
      ? baseNotes
      : `${baseNotes} [MANIFEST SEM ASSINATURA PRODUÇÃO — DEFINA ASSINATURA NO HQ CENTRAL OU TAURI_RELEASE_SIGNATURE]`,
    pub_date: storeOs.releasedAt,
    url: remoteUrl || artifact?.downloadPath || `/releases/store-os/${storeOs.latestVersion}/bundle-${normalizedTarget}-${arch}`,
    signature: configuredSignature || null,
    signed: isSigned,
    releaseChannel: isSigned ? 'SIGNED_RELEASE' : 'UNSIGNED_SANDBOX_MANIFEST',
  });
});

/**
 * Public configuration endpoint for consumer-facing and operational apps
 * Safely exposes global announcement banner and feature flags without credentials
 */
router.get('/public-config', async (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
  const zeroPublicSpotlightPricing = {
    heroBannerMonthlyFee: 0,
    recommendedSlotMonthlyFee: 0,
    categoryTopMonthlyFee: 0,
  };
  try {
    const govSnap = await db.collection('governance').doc('governance').get();
    const data = govSnap.exists ? govSnap.data() : null;
    const rawMkt = data?.marketplaceConfig || {};
    const hiddenStoreIds = Array.isArray(rawMkt.hiddenStoreIds)
      ? rawMkt.hiddenStoreIds.map((id: any) => String(id))
      : [];
    const hiddenSet = new Set(hiddenStoreIds);
    const rawPlacements = Array.isArray(rawMkt.sponsoredPlacements) ? rawMkt.sponsoredPlacements : [];
    const publicSponsoredPlacements = rawPlacements
      .filter((p: any) => {
        if (!p || !p.active || !p.storeId) return false;
        if (hiddenSet.has(String(p.storeId))) return false;
        const status = String(p.status || 'ACTIVE').toUpperCase();
        return status !== 'PENDING_APPROVAL' && status !== 'PAUSED' && status !== 'REJECTED';
      })
      .map((p: any) => ({
        id: String(p.id || ''),
        storeId: String(p.storeId),
        placementType: p.placementType,
        badgeText: String(p.badgeText || 'Patrocinado'),
        bannerTitle: String(p.bannerTitle || ''),
        bannerSubtitle: String(p.bannerSubtitle || ''),
        ctaLabel: String(p.ctaLabel || 'Ver vitrine'),
        monthlyFee: 0,
        active: true,
        status: 'ACTIVE' as const,
      }));

    return res.json({
      globalAnnouncementBanner: String(data?.globalAnnouncementBanner || ''),
      aiEngineEnabled: Boolean(data?.featureFlags?.aiEngineEnabled),
      maintenanceMode: Boolean(data?.maintenanceMode),
      marketplaceReadOnly: Boolean(data?.featureFlags?.marketplaceMaintenanceReadOnly),
      maintenanceMessage: String(data?.maintenanceMessage || ''),
      marketplaceConfig: {
        marketplaceName: String(rawMkt.marketplaceName || DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.marketplaceName),
        heroHeadline: String(rawMkt.heroHeadline || DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.heroHeadline),
        heroSubtitle: String(rawMkt.heroSubtitle || DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.heroSubtitle),
        recommendationsTitle: String(
          rawMkt.recommendationsTitle || DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.recommendationsTitle
        ),
        defaultDiscoveryRadiusKm: Number(
          rawMkt.defaultDiscoveryRadiusKm ?? DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.defaultDiscoveryRadiusKm
        ),
        allowGuestBrowsing:
          rawMkt.allowGuestBrowsing !== undefined
            ? Boolean(rawMkt.allowGuestBrowsing)
            : DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.allowGuestBrowsing,
        featuredStoreIds: Array.isArray(rawMkt.featuredStoreIds)
          ? rawMkt.featuredStoreIds.map((id: any) => String(id)).filter((id: string) => !hiddenSet.has(id))
          : [],
        hiddenStoreIds,
        enabledVerticals: Array.isArray(rawMkt.enabledVerticals)
          ? rawMkt.enabledVerticals
          : DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.enabledVerticals,
        spotlightPricing: zeroPublicSpotlightPricing,
        sponsoredPlacements: publicSponsoredPlacements,
        externalChannelConnectors: [],
      },
    });
  } catch {
    return res.json({
      globalAnnouncementBanner: '',
      aiEngineEnabled: false,
      maintenanceMode: false,
      marketplaceReadOnly: false,
      maintenanceMessage: '',
      marketplaceConfig: {
        ...DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG,
        spotlightPricing: zeroPublicSpotlightPricing,
        externalChannelConnectors: [],
      },
    });
  }
});

export default router;
