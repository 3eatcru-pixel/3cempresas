import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  Globe,
  Monitor,
  Smartphone,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import { useOptionalEcosystem } from '../../context/EcosystemContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { MainSectionId } from '../../types';
import { BrandLogoId, BrandMark } from './BrandLogo';

export interface ReleaseDownloadInfo {
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
}

interface ReleaseDownloadModalProps {
  info: ReleaseDownloadInfo | null;
  onClose: () => void;
  onAfterWebLaunch?: () => void;
}

const APP_ID_TO_SECTION: Record<string, MainSectionId> = {
  'store-os': 'store-os',
  marketplace: 'marketplace',
  driver: 'driver',
  waiter: 'waiter',
  hq: 'hq-central',
};

const APP_ID_TO_BRAND: Record<string, BrandLogoId> = {
  'store-os': 'store-os',
  marketplace: 'marketplace',
  driver: 'driver',
  waiter: 'waiter',
  hq: 'hq',
  'server-core': 'server-core',
};

function formatFileSize(bytes?: number | null): string | null {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const ReleaseDownloadModal: React.FC<ReleaseDownloadModalProps> = ({
  info,
  onClose,
  onAfterWebLaunch,
}) => {
  const ecosystem = useOptionalEcosystem();
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [copied, setCopied] = useState(false);
  const [installingPwa, setInstallingPwa] = useState(false);

  if (!info) return null;

  const isWindows = info.artifact.platform === 'windows';
  const platformLabel = isWindows
    ? 'Windows 10/11 (Instalador Desktop)'
    : info.artifact.platform === 'android-tablet'
    ? 'Android Tablet (Pacote .apk)'
    : 'Android (Pacote .apk)';
  const formattedSize = formatFileSize(info.fileSizeBytes);

  const handleCopyCommand = async () => {
    if (!info.buildCommand) return;
    try {
      await navigator.clipboard.writeText(info.buildCommand);
      setCopied(true);
      ecosystem?.showNotification('Comando de empacotamento copiado.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      ecosystem?.showNotification('Não foi possível copiar automaticamente.');
    }
  };

  const handleDirectDownload = () => {
    const link = document.createElement('a');
    link.href = info.downloadUrl;
    link.download = info.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    ecosystem?.showNotification(`Download iniciado: ${info.fileName}`);
  };

  const handleInstallPwa = async () => {
    setInstallingPwa(true);
    try {
      const accepted = await install();
      if (accepted) {
        ecosystem?.showNotification(`${info.displayName} instalado com sucesso neste dispositivo.`);
        onClose();
      }
    } finally {
      setInstallingPwa(false);
    }
  };

  const handleOpenWeb = () => {
    const targetSection = APP_ID_TO_SECTION[info.appId];
    onClose();
    if (onAfterWebLaunch) onAfterWebLaunch();
    if (targetSection && ecosystem?.setActiveSection) {
      ecosystem.setActiveSection(targetSection);
      window.scrollTo(0, 0);
    } else {
      window.location.assign(info.fallbackWebUrl);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="release-download-title"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark id={APP_ID_TO_BRAND[info.appId] || 'portal'} size="md" />
            <div className="min-w-0">
              <h3
                id="release-download-title"
                className="text-sm font-bold text-white truncate"
              >
                {info.displayName}
              </h3>
              <p className="text-xs text-slate-400 truncate inline-flex items-center gap-1.5">
                {isWindows ? (
                  <Monitor className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                ) : (
                  <Smartphone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span>{platformLabel} · v{info.version}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de download"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">Arquivo empacotado</span>
              <span className="font-mono text-slate-200 truncate max-w-[230px]" title={info.fileName}>
                {info.fileName}
              </span>
            </div>
            {formattedSize && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Tamanho</span>
                <span className="font-mono text-slate-300">{formattedSize}</span>
              </div>
            )}
            {info.artifact.bundleId && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Identificador</span>
                <span className="font-mono text-slate-300">{info.artifact.bundleId}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">Situação do pacote</span>
              <span
                className={`font-medium ${
                  info.available ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                {info.available ? 'Pronto para download' : 'Aguardando publicação do pacote'}
              </span>
            </div>
            {info.sha256 && (
              <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
                <span className="text-slate-400">SHA-256</span>
                <span className="font-mono text-[10px] text-slate-400 truncate max-w-[220px]" title={info.sha256}>
                  {info.sha256}
                </span>
              </div>
            )}
          </div>

          {info.available ? (
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-3.5 text-xs text-slate-200 space-y-1.5">
              <div className="font-semibold text-emerald-300">Como instalar:</div>
              {isWindows ? (
                <ol className="list-decimal list-inside space-y-1 text-slate-300 leading-relaxed">
                  <li>Clique em <strong>Baixar {info.artifact.format}</strong> abaixo.</li>
                  <li>Abra o arquivo baixado no Windows 10 ou 11 e conclua o assistente.</li>
                </ol>
              ) : (
                <ol className="list-decimal list-inside space-y-1 text-slate-300 leading-relaxed">
                  <li>Clique em <strong>Baixar .apk</strong> abaixo no seu celular ou tablet Android.</li>
                  <li>Toque no arquivo baixado e confirme <strong>Instalar</strong> (permitindo o navegador se solicitado).</li>
                </ol>
              )}
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <p>
                O instalador empacotado <strong className="text-slate-100">{info.artifact.format}</strong> ainda não foi publicado neste servidor. Enquanto o pacote nativo é gerado, você já pode instalar e usar o aplicativo diretamente no seu{' '}
                <strong className="text-slate-100">{isWindows ? 'Windows' : 'Android'}</strong>:
              </p>
              {isWindows ? (
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>Clique em <strong className="text-slate-200">{isInstallable ? 'Instalar no Windows Agora' : 'Abrir Aplicativo'}</strong> abaixo.</li>
                  <li>No Chrome ou Edge, clique no ícone de instalação na barra de endereço para fixar no Menu Iniciar.</li>
                </ol>
              ) : (
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>Clique em <strong className="text-slate-200">{isInstallable ? 'Instalar no Android Agora' : 'Abrir Aplicativo'}</strong> abaixo.</li>
                  <li>No Chrome Android, toque no menu <strong className="text-slate-200">⋮</strong> e escolha <strong className="text-slate-200">Instalar aplicativo</strong> para criar o ícone nativo na tela inicial.</li>
                </ol>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            {info.available && (
              <button
                type="button"
                onClick={handleDirectDownload}
                className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>Baixar {info.artifact.format}</span>
              </button>
            )}

            {!info.available && isInstallable && !isInstalled && (
              <button
                type="button"
                disabled={installingPwa}
                onClick={handleInstallPwa}
                className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>
                  {isWindows ? 'Instalar no Windows Agora' : 'Instalar no Android Agora'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenWeb}
              className={`flex-1 py-2.5 px-4 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                info.available || (isInstallable && !isInstalled)
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
              }`}
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span>Abrir Aplicativo</span>
            </button>
          </div>

          {!info.available && info.buildCommand && (
            <details className="group border-t border-slate-800/80 pt-3">
              <summary className="list-none flex items-center justify-between text-[11px] font-medium text-slate-400 hover:text-slate-200 cursor-pointer select-none">
                <span className="inline-flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-slate-500" />
                  <span>Publicação do instalador nativo (Equipe técnica)</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 transition-transform group-open:rotate-180" />
              </summary>

              <div className="mt-3 space-y-2.5 text-[11px] text-slate-400">
                <p className="leading-relaxed">
                  Gere e publique os pacotes Windows (<code className="text-slate-200">.exe</code>/<code className="text-slate-200">.msi</code>) e Android (<code className="text-slate-200">.apk</code>) usando os scripts do workspace e configure a URL base no HQ (<code className="text-slate-200">RELEASE_BASE_URL</code>) ou copie os arquivos em <code className="text-slate-200">public/releases/</code>.
                </p>

                {info.buildCommand && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Comando local de empacotamento</span>
                      <button
                        type="button"
                        onClick={handleCopyCommand}
                        className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                    <pre className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-200 overflow-x-auto">
                      {info.buildCommand}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};
