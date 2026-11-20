import React from 'react';
import {
  CheckCircle2,
  Cloud,
  Download,
  Package,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { ReleaseArtifactsResponse } from './types';

interface HqDownloadsKpiStripProps {
  manifest: ReleaseArtifactsResponse | null;
  fallbackChannel: string;
  publishedCount: number;
  totalBinaryCount: number;
  unpublishedCount: number;
  disabledCount: number;
  loading: boolean;
  onRefresh: () => void;
}

export const HqDownloadsKpiStrip: React.FC<HqDownloadsKpiStripProps> = ({
  manifest,
  fallbackChannel,
  publishedCount,
  totalBinaryCount,
  unpublishedCount,
  disabledCount,
  loading,
  onRefresh,
}) => {
  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-tight">
            <Download className="w-5 h-5 text-indigo-400" />
            3C Release Manager — Governança de Downloads &amp; Instaladores
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl mt-1">
            Centraliza a distribuição de instaladores Windows (Tauri 2), Android (Capacitor 6) e 3C Edge Node.
            Alterações salvas aqui atualizam imediatamente os endpoints públicos de download e auto-update.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Verificando Artefatos...' : 'Reescanear Artefatos'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] font-mono uppercase text-slate-500">Origem Ativa</div>
          <div className="mt-1 flex items-center gap-2 text-sm font-black text-white">
            <Cloud className="w-4 h-4 text-cyan-400" />
            {manifest?.releaseBaseUrlSource === 'HQ_GOVERNANCE'
              ? 'HQ Governança'
              : manifest?.releaseBaseUrlSource === 'ENV_VAR'
              ? 'Variável de Ambiente'
              : 'Somente Disco Local'}
          </div>
          <p className="text-[10px] font-mono text-slate-400 truncate mt-1">
            {manifest?.effectiveReleaseBaseUrl || 'public/releases/'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] font-mono uppercase text-slate-500">Binários Publicados</div>
          <div className="mt-1 flex items-center gap-2 text-sm font-black text-emerald-400 font-mono">
            <CheckCircle2 className="w-4 h-4" />
            {publishedCount} / {totalBinaryCount}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {unpublishedCount} pendente(s) • {disabledCount} pausado(s)
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] font-mono uppercase text-slate-500">Assinatura Tauri Updater</div>
          <div
            className={`mt-1 flex items-center gap-2 text-sm font-black ${
              manifest?.tauriSigned ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {manifest?.tauriSigned ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <ShieldAlert className="w-4 h-4" />
            )}
            {manifest?.tauriSigned ? 'SIGNED_RELEASE' : 'UNSIGNED_SANDBOX'}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {manifest?.tauriSigned
              ? 'Assinatura Ed25519 configurada (HQ / Server)'
              : 'Configure assinatura no HQ ou TAURI_RELEASE_SIGNATURE'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-[10px] font-mono uppercase text-slate-500">Release Train &amp; Canal</div>
          <div className="mt-1 flex items-center gap-2 text-sm font-black text-indigo-300 font-mono">
            <Package className="w-4 h-4" />
            {manifest?.releaseTrain || '—'} ({manifest?.activeChannel || fallbackChannel})
          </div>
          <p className="text-[10px] font-mono text-slate-400 truncate mt-1">
            Contrato v{manifest?.contractVersion || '1.0'} • Build Local / CDN
          </p>
        </div>
      </div>
    </div>
  );
};
