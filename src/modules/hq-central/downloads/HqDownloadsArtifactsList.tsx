import React from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  HardDrive,
  Terminal,
  XCircle,
} from 'lucide-react';
import { formatArtifactBytes, ProductReleaseSummary } from './types';

interface HqDownloadsArtifactsListProps {
  products: ProductReleaseSummary[];
  copiedCmd: string | null;
  onCopyCommand: (cmd: string) => void;
}

export const HqDownloadsArtifactsList: React.FC<HqDownloadsArtifactsListProps> = ({
  products,
  copiedCmd,
  onCopyCommand,
}) => {
  return (
    <>
      <div className="space-y-4">
        {products.map((product) => (
          <div
            key={product.appId}
            className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950/40">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">
                    {product.displayName}
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono font-bold">
                    v{product.latestVersion}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                    min: {product.minSupportedVersion}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{product.releaseNotes}</p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-black uppercase border ${
                  product.downloadsEnabled === false
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {product.downloadsEnabled === false ? 'Downloads Pausados' : 'Distribuição Ativa'}
              </span>
            </div>

            <div className="divide-y divide-slate-800/70">
              {product.artifacts.map((art) => {
                const isWeb = art.platform === 'web';
                const statusBadge = isWeb
                  ? { label: 'WEB / PWA ONLINE', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' }
                  : art.source === 'LOCAL_DISK'
                  ? { label: 'DISCO LOCAL', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }
                  : art.source === 'REMOTE_RELEASE_URL'
                  ? { label: 'RELEASE REMOTA', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }
                  : art.source === 'DISABLED_BY_HQ'
                  ? { label: 'PAUSADO NO HQ', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' }
                  : { label: 'NÃO PUBLICADO', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };

                return (
                  <div
                    key={`${product.appId}-${art.platform}-${art.format}`}
                    className="px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-white uppercase">
                          {art.platform} ({art.format})
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">{art.runtime}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-black border ${statusBadge.cls}`}>
                          {statusBadge.label}
                        </span>
                        {art.fileSizeBytes ? (
                          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                            <HardDrive className="w-3 h-3" /> {formatArtifactBytes(art.fileSizeBytes)}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">
                        {art.externalDownloadUrl || art.downloadPath}
                        {art.sha256 ? ` • SHA256: ${art.sha256.slice(0, 16)}…` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {art.buildCommand && (
                        <button
                          type="button"
                          onClick={() => onCopyCommand(art.buildCommand!)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-mono flex items-center gap-1.5 cursor-pointer"
                          title={art.buildCommand}
                        >
                          {copiedCmd === art.buildCommand ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          Copiar Build
                        </button>
                      )}
                      {isWeb ? (
                        <a
                          href={art.downloadPath}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[10px] font-black uppercase flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3 h-3" /> Abrir Web
                        </a>
                      ) : art.available ? (
                        <a
                          href={art.downloadUrl}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black uppercase flex items-center gap-1.5"
                        >
                          <Download className="w-3 h-3" /> Testar Download
                        </a>
                      ) : (
                        <span className="px-3 py-1.5 rounded-lg bg-slate-950 text-slate-500 border border-slate-800 text-[10px] font-mono flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Sem binário
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-start gap-3">
        <Terminal className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400 leading-relaxed">
          Para compilar e publicar novos instaladores Windows (<code className="text-slate-200">.exe</code>/
          <code className="text-slate-200">.msi</code>) e Android (<code className="text-slate-200">.apk</code>),
          execute os comandos de build acima ou publique os artefatos em seu CDN/Bucket HTTPS configurado neste painel
          (ou diretamente em <code className="text-slate-200">public/releases/</code> no Server Core).
        </div>
      </div>
    </>
  );
};
