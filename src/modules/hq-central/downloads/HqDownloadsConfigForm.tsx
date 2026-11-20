import React from 'react';
import { Link2, Save } from 'lucide-react';
import { ReleaseDistributionConfig } from '../../../types';
import { RELEASE_PRODUCT_ORDER } from './types';

interface HqDownloadsConfigFormProps {
  draft: ReleaseDistributionConfig;
  isDevOwner: boolean;
  saving: boolean;
  onChangeDraft: React.Dispatch<React.SetStateAction<ReleaseDistributionConfig>>;
  onToggleProduct: (appId: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const HqDownloadsConfigForm: React.FC<HqDownloadsConfigFormProps> = ({
  draft,
  isDevOwner,
  saving,
  onChangeDraft,
  onToggleProduct,
  onSubmit,
}) => {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Link2 className="w-4 h-4 text-amber-400" />
            Configuração de Distribuição Remota (CDN / Bucket HTTPS / Disco Local)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Quando preenchida, a URL base do HQ sobrescreve a variável de ambiente{' '}
            <code className="text-cyan-300">RELEASE_BASE_URL</code> sem precisar reiniciar o servidor.
          </p>
        </div>
        {!isDevOwner && (
          <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700">
            Somente leitura (requer DEV_OWNER)
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
            URL Base dos Instaladores (CDN / Bucket HTTPS)
          </label>
          <input
            type="url"
            disabled={!isDevOwner}
            value={draft.releaseBaseUrl}
            onChange={(e) => onChangeDraft((prev) => ({ ...prev, releaseBaseUrl: e.target.value }))}
            placeholder="https://releases.suaempresa.com.br/v5.2.1"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Canal de Release
          </label>
          <select
            disabled={!isDevOwner}
            value={draft.channel}
            onChange={(e) =>
              onChangeDraft((prev) => ({
                ...prev,
                channel: e.target.value as ReleaseDistributionConfig['channel'],
              }))
            }
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          >
            <option value="stable">Stable (Produção)</option>
            <option value="beta">Beta (Homologação)</option>
            <option value="canary">Canary (Interno)</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Versão Mínima Suportada (Override SemVer)
          </label>
          <input
            type="text"
            disabled={!isDevOwner}
            value={draft.minSupportedVersionOverride || ''}
            onChange={(e) =>
              onChangeDraft((prev) => ({ ...prev, minSupportedVersionOverride: e.target.value }))
            }
            placeholder="Ex.: 5.0.0 (vazio = padrão do manifesto)"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
        </div>

        <div className="lg:col-span-2 space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Notas de Release Globais (Opcional — exibido no Tauri Updater)
          </label>
          <input
            type="text"
            disabled={!isDevOwner}
            value={draft.releaseNotesOverride || ''}
            onChange={(e) =>
              onChangeDraft((prev) => ({ ...prev, releaseNotesOverride: e.target.value }))
            }
            placeholder="Ex.: Correções de sincronização Edge e otimização de performance."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
        </div>

        <div className="lg:col-span-3 space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Assinatura Ed25519 Tauri Updater — windows-x86_64 (Opcional — gerenciada pelo HQ)
          </label>
          <input
            type="text"
            disabled={!isDevOwner}
            value={draft.artifactSignatures?.['windows-x86_64'] || ''}
            onChange={(e) =>
              onChangeDraft((prev) => ({
                ...prev,
                artifactSignatures: {
                  ...(prev.artifactSignatures || {}),
                  'windows-x86_64': e.target.value,
                },
              }))
            }
            placeholder="Assinatura .sig gerada no build Tauri para windows-x86_64"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-800">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Disponibilidade de Download Binário por Produto
        </div>
        <div className="flex flex-wrap gap-2">
          {RELEASE_PRODUCT_ORDER.filter((id) => id !== 'hq').map((appId) => {
            const isPaused = draft.disabledProducts.includes(appId);
            return (
              <button
                key={appId}
                type="button"
                disabled={!isDevOwner}
                onClick={() => onToggleProduct(appId)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-black uppercase border transition-all cursor-pointer disabled:opacity-50 ${
                  isPaused
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                }`}
              >
                {appId}: {isPaused ? 'PAUSADO' : 'LIBERADO'}
              </button>
            );
          })}
        </div>
      </div>

      {isDevOwner && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando Governança...' : 'Salvar Configuração de Releases'}
          </button>
        </div>
      )}
    </form>
  );
};
