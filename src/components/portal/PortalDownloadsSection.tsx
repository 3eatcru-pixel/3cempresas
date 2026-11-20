import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Globe,
  Loader2,
  Monitor,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { RELEASE_MANAGER_MANIFEST } from '@3c/contracts';
import { apiClient } from '../../core/api/apiClient';
import { useEcosystem } from '../../context/EcosystemContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { BrandMark } from '../common/BrandLogo';
import { ReleaseDownloadInfo, ReleaseDownloadModal } from '../common/ReleaseDownloadModal';

interface PortalDownloadsSectionProps {
  onNavigate: (sectionId: string) => void;
}

type PortalDownloadKey =
  | 'store-os:windows-exe'
  | 'store-os:windows-msi'
  | 'store-os:android-tablet'
  | 'marketplace:android'
  | 'driver:android'
  | 'waiter:android';

const ANDROID_APPS: Array<{
  key: PortalDownloadKey;
  appId: 'marketplace' | 'driver' | 'waiter';
  title: string;
  roleMeta: string;
  description: string;
  packageLabel: string;
  accentTextClass: string;
}> = [
  {
    key: 'marketplace:android',
    appId: 'marketplace',
    title: '3C Marketplace',
    roleMeta: 'Consumidores · Android .apk',
    description:
      'Vitrine regional para explorar lojas, fazer pedidos e acompanhar a entrega em tempo real.',
    packageLabel: 'com.threec.marketplace',
    accentTextClass: 'text-emerald-400',
  },
  {
    key: 'driver:android',
    appId: 'driver',
    title: '3C Driver',
    roleMeta: 'Entregadores · Android .apk',
    description:
      'Aceite corridas, confirme coletas e entregas com código de segurança e acompanhe ganhos.',
    packageLabel: 'com.threec.driver',
    accentTextClass: 'text-sky-400',
  },
  {
    key: 'waiter:android',
    appId: 'waiter',
    title: '3C Waiter',
    roleMeta: 'Garçons · Android .apk',
    description:
      'Atendimento de mesas e comandas integrado em rede local diretamente ao caixa e à cozinha.',
    packageLabel: 'com.threec.waiter',
    accentTextClass: 'text-pink-400',
  },
];

export const PortalDownloadsSection: React.FC<PortalDownloadsSectionProps> = ({ onNavigate }) => {
  const { showNotification } = useEcosystem();
  const { isInstallable, isInstalled, isAndroid, isWindows, install } = usePWAInstall();
  const [loadingKey, setLoadingKey] = useState<PortalDownloadKey | null>(null);
  const [modalInfo, setModalInfo] = useState<ReleaseDownloadInfo | null>(null);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, boolean>>({});
  const [installingDirect, setInstallingDirect] = useState(false);

  useEffect(() => {
    let active = true;
    apiClient
      .getReleaseArtifacts()
      .then((manifest) => {
        if (!active || !manifest?.products) return;
        const map: Record<string, boolean> = {};
        for (const [appId, entry] of Object.entries(manifest.products)) {
          for (const art of entry.artifacts || []) {
            map[`${appId}:${art.platform}:${art.format}`] = Boolean(art.available);
          }
        }
        setAvailabilityMap(map);
      })
      .catch(() => {
        // Keep graceful fallback when offline
      });
    return () => {
      active = false;
    };
  }, []);

  const isPackageReady = (appId: string, platform: string, format: string) =>
    Boolean(availabilityMap[`${appId}:${platform}:${format}`]);

  const handleInstallAppNow = async () => {
    setInstallingDirect(true);
    try {
      const ok = await install();
      if (ok) {
        showNotification('Aplicativo 3C Corp instalado neste dispositivo.');
      }
    } finally {
      setInstallingDirect(false);
    }
  };

  const handleDownload = async (
    key: PortalDownloadKey,
    appId: 'store-os' | 'marketplace' | 'driver' | 'waiter',
    platform: 'windows' | 'android-tablet' | 'android',
    format: '.exe' | '.msi' | '.apk'
  ) => {
    setLoadingKey(key);
    try {
      const info = await apiClient.getReleaseArtifactInfo({ appId, platform, format });
      if (info.available) {
        const link = document.createElement('a');
        link.href = info.downloadUrl;
        link.download = info.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification(`Download iniciado: ${info.fileName}`);
      } else {
        setModalInfo(info);
      }
    } catch {
      const product = RELEASE_MANAGER_MANIFEST.products[appId];
      const artifact =
        product.artifacts.find((a) => a.platform === platform && a.format === format) ||
        product.artifacts.find((a) => a.platform === platform) ||
        product.artifacts[0];
      const fileName = artifact.downloadPath.split('/').pop() || `${appId}-${platform}${format}`;
      setModalInfo({
        available: false,
        source: 'UNPUBLISHED',
        appId,
        displayName: product.displayName,
        version: product.latestVersion,
        artifact,
        fileName,
        downloadUrl: `/api/v1/system/releases/download/${appId}/${platform}?format=${encodeURIComponent(format)}`,
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

  const winExeReady = isPackageReady('store-os', 'windows', '.exe');
  const winMsiReady = isPackageReady('store-os', 'windows', '.msi');
  const storeApkReady = isPackageReady('store-os', 'android-tablet', '.apk');

  return (
    <section
      id="downloads"
      className="border-t border-slate-900 bg-slate-950 py-20 px-6"
    >
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Cabeçalho editorial */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
              <span>Pacotes de Instalação</span>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-slate-400">Windows e Android</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance">
              Baixe o instalador do Store OS para Windows ou instale os apps no Android
            </h2>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Pacotes prontos para baixar e instalar em Windows 10/11 (.exe / .msi) e Android (.apk), além de instalação imediata pelo navegador em um clique.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {isInstallable && !isInstalled && (
              <button
                type="button"
                disabled={installingDirect}
                onClick={handleInstallAppNow}
                className="py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                {installingDirect ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>
                  {isAndroid
                    ? 'Instalar no Android Agora'
                    : isWindows
                    ? 'Instalar no Windows Agora'
                    : 'Instalar App Agora'}
                </span>
              </button>
            )}
            <div className="text-xs text-slate-400 tabular-nums">
              Versão <span className="text-slate-200 font-semibold">v{RELEASE_MANAGER_MANIFEST.products['store-os'].latestVersion}</span>
            </div>
          </div>
        </div>

        {/* 01. Prioridade: Store OS (Windows + Android Tablet) */}
        <div className="rounded-2xl bg-slate-900/75 border border-amber-500/30 p-7 sm:p-9">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4">
              <div className="flex items-center gap-3">
                <BrandMark id="store-os" size="lg" />
                <div>
                  <div className="text-xs font-semibold text-amber-400">
                    01 · Terminal da Loja · Windows e Android Tablet
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    3C Store OS — PDV, Cozinha e Caixa
                  </h3>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                Instalador para Windows 10/11 (Tauri 2 com banco local SQLite) e pacote dedicado para Tablet Android. Opera vendas, KDS, comandas e estoque mesmo quando a internet oscila.
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                <span>com.threec.storeos</span>
                <span aria-hidden="true">·</span>
                <span>com.threec.store</span>
                {(winExeReady || winMsiReady || storeApkReady) && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-sans font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Pacote pronto para download
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={loadingKey !== null}
                onClick={() =>
                  handleDownload('store-os:windows-exe', 'store-os', 'windows', '.exe')
                }
                className="sm:col-span-2 py-3.5 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2.5 whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                {loadingKey === 'store-os:windows-exe' ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Monitor className="w-4 h-4 shrink-0" />
                )}
                <span>Baixar Store OS para Windows (.exe)</span>
              </button>

              <button
                type="button"
                disabled={loadingKey !== null}
                onClick={() =>
                  handleDownload('store-os:windows-msi', 'store-os', 'windows', '.msi')
                }
                className="py-3 px-4 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-slate-200 font-medium text-xs rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                {loadingKey === 'store-os:windows-msi' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-amber-400" />
                ) : (
                  <Download className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                )}
                <span>Instalador Windows (.msi)</span>
              </button>

              <button
                type="button"
                disabled={loadingKey !== null}
                onClick={() =>
                  handleDownload(
                    'store-os:android-tablet',
                    'store-os',
                    'android-tablet',
                    '.apk'
                  )
                }
                className="py-3 px-4 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-slate-200 font-medium text-xs rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                {loadingKey === 'store-os:android-tablet' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-amber-400" />
                ) : (
                  <Smartphone className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                )}
                <span>Store OS para Android (.apk)</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('store-os')}
                className="sm:col-span-2 py-2.5 px-4 text-xs font-medium text-slate-400 hover:text-amber-300 transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span>Ou abrir Store OS imediatamente no navegador</span>
              </button>
            </div>
          </div>
        </div>

        {/* 02. Demais aplicativos em Android */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-400">
            <span>02 · Aplicativos Móveis para Android (.apk)</span>
            <span className="hidden sm:inline text-slate-500">
              Instalação direta no celular ou via WebAPK
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ANDROID_APPS.map((app) => {
              const isLoading = loadingKey === app.key;
              const apkReady = isPackageReady(app.appId, 'android', '.apk');
              return (
                <article
                  key={app.key}
                  className="bg-slate-900/55 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between gap-6"
                >
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-3">
                      <BrandMark id={app.appId} size="md" />
                      <div className="min-w-0">
                        <div className={`text-[11px] font-medium ${app.accentTextClass}`}>
                          {app.roleMeta}
                        </div>
                        <h4 className="text-base font-bold text-white truncate">
                          {app.title}
                        </h4>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {app.description}
                    </p>

                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
                      <span className="truncate">{app.packageLabel}</span>
                      {apkReady && (
                        <span className="text-emerald-400 font-sans font-medium shrink-0">
                          Pronto
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      disabled={loadingKey !== null}
                      onClick={() => handleDownload(app.key, app.appId, 'android', '.apk')}
                      className="flex-1 py-2.5 px-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-100 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60"
                    >
                      {isLoading ? (
                        <Loader2 className={`w-3.5 h-3.5 animate-spin shrink-0 ${app.accentTextClass}`} />
                      ) : (
                        <Smartphone className={`w-3.5 h-3.5 shrink-0 ${app.accentTextClass}`} />
                      )}
                      <span>Baixar .apk</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigate(app.appId)}
                      className="py-2.5 px-3.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Abrir Web
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <ReleaseDownloadModal
        info={modalInfo}
        onClose={() => setModalInfo(null)}
      />
    </section>
  );
};
