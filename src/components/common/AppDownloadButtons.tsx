import React, { useState } from 'react';
import { Monitor, Smartphone, Loader2 } from 'lucide-react';
import { RELEASE_MANAGER_MANIFEST } from '@3c/contracts';
import { apiClient } from '../../core/api/apiClient';
import { useOptionalEcosystem } from '../../context/EcosystemContext';
import { AuthModalContextId } from '../../context/AuthContext';
import { BrandMark } from './BrandLogo';
import {
  ReleaseDownloadInfo,
  ReleaseDownloadModal,
  triggerSafeReleaseDownload,
} from './ReleaseDownloadModal';

interface AppDownloadButtonsProps {
  variant?: 'compact' | 'panel';
  contextId?: AuthModalContextId;
  onAfterWebLaunch?: () => void;
}

type DownloadTargetKey =
  | 'store-os:windows'
  | 'store-os:android-tablet'
  | 'marketplace:android'
  | 'driver:android'
  | 'waiter:android';

const SECONDARY_ANDROID_TARGETS: Array<{
  key: DownloadTargetKey;
  appId: 'marketplace' | 'driver' | 'waiter';
  label: string;
  shortLabel: string;
  accentClass: string;
}> = [
  {
    key: 'marketplace:android',
    appId: 'marketplace',
    label: '3C Marketplace',
    shortLabel: 'Marketplace',
    accentClass: 'hover:border-emerald-500/40 text-emerald-400',
  },
  {
    key: 'driver:android',
    appId: 'driver',
    label: '3C Driver',
    shortLabel: 'Driver',
    accentClass: 'hover:border-sky-500/40 text-sky-400',
  },
  {
    key: 'waiter:android',
    appId: 'waiter',
    label: '3C Waiter',
    shortLabel: 'Waiter',
    accentClass: 'hover:border-pink-500/40 text-pink-400',
  },
];

export const AppDownloadButtons: React.FC<AppDownloadButtonsProps> = ({
  variant = 'compact',
  contextId = 'portal',
  onAfterWebLaunch,
}) => {
  const ecosystem = useOptionalEcosystem();
  const [loadingKey, setLoadingKey] = useState<DownloadTargetKey | null>(null);
  const [modalInfo, setModalInfo] = useState<ReleaseDownloadInfo | null>(null);

  if (contextId === 'hq' || contextId === 'server-core') {
    return null;
  }

  const handleDownloadClick = async (
    key: DownloadTargetKey,
    appId: 'store-os' | 'marketplace' | 'driver' | 'waiter',
    platform: 'windows' | 'android-tablet' | 'android',
    format?: string
  ) => {
    setLoadingKey(key);
    try {
      const info = await apiClient.getReleaseArtifactInfo({ appId, platform, format });
      if (info.available) {
        const started = await triggerSafeReleaseDownload(info);
        if (started) {
          ecosystem?.showNotification(`Download iniciado: ${info.fileName}`);
        } else {
          setModalInfo({
            ...info,
            available: false,
            source: 'UNPUBLISHED',
          });
        }
      } else {
        setModalInfo(info);
      }
    } catch {
      const product = RELEASE_MANAGER_MANIFEST.products[appId];
      const artifact =
        product.artifacts.find((a) => a.platform === platform) || product.artifacts[0];
      const fileName = artifact.downloadPath.split('/').pop() || `${appId}-${platform}`;
      setModalInfo({
        available: false,
        source: 'UNPUBLISHED',
        appId,
        displayName: product.displayName,
        version: product.latestVersion,
        artifact,
        fileName,
        downloadUrl: `/api/v1/system/releases/download/${appId}/${platform}`,
        fallbackWebUrl: `/?app=${appId}`,
        buildCommand:
          platform === 'windows'
            ? 'npm --workspace=@3c/store-desktop run sidecar:prepare:strict && npm --workspace=@3c/store-desktop run build:windows'
            : `npm --workspace=@3c/${appId === 'store-os' ? 'store' : appId}-android run cap:sync && cd apps/${appId === 'store-os' ? 'store' : appId}-android/android && ./gradlew assembleRelease`,
      });
    } finally {
      setLoadingKey(null);
    }
  };

  const showStoreOs = contextId === 'portal' || contextId === 'store-os';
  const filteredSecondaryTargets =
    contextId === 'portal'
      ? SECONDARY_ANDROID_TARGETS
      : SECONDARY_ANDROID_TARGETS.filter((item) => item.appId === contextId);

  const headerTitle =
    contextId === 'store-os'
      ? 'Baixar aplicativo Store OS'
      : contextId === 'marketplace'
      ? 'Baixar aplicativo 3C Marketplace'
      : contextId === 'driver'
      ? 'Baixar aplicativo 3C Driver'
      : contextId === 'waiter'
      ? 'Baixar aplicativo 3C Waiter'
      : 'Baixar aplicativos';

  const headerMeta =
    contextId === 'store-os'
      ? 'Windows · Android'
      : contextId === 'portal'
      ? 'Store OS · Android'
      : 'Android .apk';

  return (
    <>
      <div className={variant === 'compact' ? 'space-y-2.5' : 'space-y-3'}>
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
          <span>{headerTitle}</span>
          <span className="text-slate-500">{headerMeta}</span>
        </div>

        {showStoreOs && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loadingKey !== null}
              onClick={() => handleDownloadClick('store-os:windows', 'store-os', 'windows', '.exe')}
              className="px-3 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60"
            >
              {loadingKey === 'store-os:windows' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Monitor className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">Store OS · Windows</span>
            </button>

            <button
              type="button"
              disabled={loadingKey !== null}
              onClick={() =>
                handleDownloadClick('store-os:android-tablet', 'store-os', 'android-tablet', '.apk')
              }
              className="px-3 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60"
            >
              {loadingKey === 'store-os:android-tablet' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <Smartphone className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">Store OS · Android</span>
            </button>
          </div>
        )}

        {filteredSecondaryTargets.length > 0 && (
          <div
            className={`grid ${
              filteredSecondaryTargets.length === 1 ? 'grid-cols-1' : 'grid-cols-3'
            } gap-2`}
          >
            {filteredSecondaryTargets.map((item) => {
              const isLoading = loadingKey === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={loadingKey !== null}
                  onClick={() => handleDownloadClick(item.key, item.appId, 'android', '.apk')}
                  className={`px-3 py-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 ${item.accentClass} text-xs font-semibold transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60`}
                  title={`Baixar ${item.label} para Android (.apk)`}
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : (
                    <BrandMark id={item.appId} size="xs" tone="plain" />
                  )}
                  <span className="truncate">
                    {filteredSecondaryTargets.length === 1
                      ? `${item.label} · Android (.apk)`
                      : variant === 'compact'
                      ? item.shortLabel
                      : `${item.shortLabel} APK`}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ReleaseDownloadModal
        info={modalInfo}
        onClose={() => setModalInfo(null)}
        onAfterWebLaunch={onAfterWebLaunch}
      />
    </>
  );
};
