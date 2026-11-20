import React from 'react';
import { HardDrive, Download, Upload, AlertTriangle, SearchCheck, CheckCircle2, XCircle } from 'lucide-react';

export interface RestorePreviewSummary {
  valid: boolean;
  schemaValid: boolean;
  checksumValid: boolean;
  hasActiveDevOwner: boolean;
  errors: string[];
  warnings: string[];
  lockoutRisks: {
    usersMissingPasswordHash: number;
    devicesMissingTokenHash: number;
    integrationsMissingSecret: number;
  };
  diffs: {
    collection: string;
    currentCount: number;
    snapshotCount: number;
    added: number;
    updated: number;
    removed: number;
  }[];
}

interface ServerBackupPanelProps {
  isExporting: boolean;
  onDownloadBackup: () => void;
  restoreJson: string;
  setRestoreJson: (json: string) => void;
  confirmRestore: boolean;
  setConfirmRestore: (checked: boolean) => void;
  isRestoring: boolean;
  isPreviewing: boolean;
  previewResult: RestorePreviewSummary | null;
  onPreviewRestore: () => void;
  onRestoreSnapshot: () => void;
}

export const ServerBackupPanel: React.FC<ServerBackupPanelProps> = ({
  isExporting,
  onDownloadBackup,
  restoreJson,
  setRestoreJson,
  confirmRestore,
  setConfirmRestore,
  isRestoring,
  isPreviewing,
  previewResult,
  onPreviewRestore,
  onRestoreSnapshot,
}) => {
  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <HardDrive className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-tight">
              Backup &amp; Restauração de Snapshot (/admin/backup &amp; /restore)
            </h3>
            <p className="text-xs text-slate-400">
              Exclusivo DEV_OWNER para portabilidade e recuperação controlada com Dry-Run e Diff prévio.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDownloadBackup}
          disabled={isExporting}
          className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Exportando...' : 'Baixar Snapshot (.json)'}
        </button>
      </div>

      <div className="space-y-3">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
          Restaurar a partir de JSON Snapshot (cole o snapshot completo exportado):
        </label>
        <textarea
          rows={5}
          value={restoreJson}
          onChange={(e) => setRestoreJson(e.target.value)}
          placeholder='{"schemaVersion": "1.0.3", "checksum": "...", "tables": {"stores": [...], "users": [...]}}'
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-200 focus:outline-none focus:border-amber-500"
        />

        {previewResult && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 font-bold">
                {previewResult.valid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Dry-Run Aprovado (Pronto para Restore)</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span className="text-rose-400">Dry-Run Bloqueado ({previewResult.errors.length} erro(s))</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
                <span>Schema: {previewResult.schemaValid ? 'OK' : 'INVÁLIDO'}</span>
                <span>HMAC: {previewResult.checksumValid ? 'OK' : 'INVÁLIDO'}</span>
                <span>DEV_OWNER: {previewResult.hasActiveDevOwner ? 'ATIVO' : 'AUSENTE'}</span>
              </div>
            </div>

            {previewResult.errors.map((err, i) => (
              <div key={i} className="text-rose-300 font-mono text-[11px]">
                Erro: {err}
              </div>
            ))}
            {previewResult.warnings.map((warn, i) => (
              <div key={i} className="text-amber-300 font-mono text-[11px]">
                Aviso: {warn}
              </div>
            ))}

            {previewResult.diffs.length > 0 && (
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-left font-mono tabular-nums text-[11px] text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-2.5 py-1.5">Coleção</th>
                      <th className="px-2.5 py-1.5 text-right">Atual</th>
                      <th className="px-2.5 py-1.5 text-right">Snapshot</th>
                      <th className="px-2.5 py-1.5 text-right text-emerald-400">+Novos</th>
                      <th className="px-2.5 py-1.5 text-right text-amber-400">~Alterados</th>
                      <th className="px-2.5 py-1.5 text-right text-rose-400">-Removidos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {previewResult.diffs.map((d) => (
                      <tr key={d.collection}>
                        <td className="px-2.5 py-1 text-white">{d.collection}</td>
                        <td className="px-2.5 py-1 text-right">{d.currentCount}</td>
                        <td className="px-2.5 py-1 text-right">{d.snapshotCount}</td>
                        <td className="px-2.5 py-1 text-right text-emerald-400">{d.added}</td>
                        <td className="px-2.5 py-1 text-right text-amber-400">{d.updated}</td>
                        <td className="px-2.5 py-1 text-right text-rose-400">{d.removed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-amber-300 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmRestore}
              onChange={(e) => setConfirmRestore(e.target.checked)}
              className="accent-amber-500"
            />
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Confirmo sobrescrever as coleções incluídas neste snapshot</span>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPreviewRestore}
              disabled={isPreviewing || !restoreJson.trim()}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-40 whitespace-nowrap"
            >
              <SearchCheck className="w-4 h-4 text-cyan-400" />
              {isPreviewing ? 'Simulando...' : 'Simular Dry-Run'}
            </button>
            <button
              type="button"
              onClick={onRestoreSnapshot}
              disabled={isRestoring || !restoreJson.trim() || !confirmRestore}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-40 whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              {isRestoring ? 'Restaurando...' : 'Executar Restore'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
