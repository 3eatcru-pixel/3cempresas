import React from 'react';
import { Download, FileCheck2, FileText, RefreshCw, Trash2 } from 'lucide-react';

interface ConsumerVaultObjectsTableProps {
  objects: any[];
  folders: string[];
  loading: boolean;
  formatKb: (bytes: number) => string;
  onRefresh: () => void;
  onMoveFolder: (objectId: string, nextFolder: string) => void;
  onDownloadObject: (obj: any) => void;
  onDeleteObject: (obj: any) => void;
}

export const ConsumerVaultObjectsTable: React.FC<ConsumerVaultObjectsTableProps> = ({
  objects,
  folders,
  loading,
  formatKb,
  onRefresh,
  onMoveFolder,
  onDownloadObject,
  onDeleteObject,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase text-slate-400">
          Arquivos Armazenados ({objects.length})
        </span>
        <button
          type="button"
          onClick={onRefresh}
          className="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          Atualizar
        </button>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/90 text-slate-400 uppercase font-mono text-[10px]">
            <tr>
              <th className="px-4 py-3">Arquivo</th>
              <th className="px-4 py-3">Pasta</th>
              <th className="px-4 py-3">Tamanho / MIME</th>
              <th className="px-4 py-3">Integridade SHA-256</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {objects.map((obj) => (
              <tr key={obj.id} className="hover:bg-slate-900/50">
                <td className="px-4 py-3">
                  <div className="font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{obj.filename}</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    {obj.createdAt ? new Date(obj.createdAt).toLocaleString('pt-BR') : obj.id}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono">
                  <select
                    value={obj.folder || 'geral'}
                    onChange={(e) => onMoveFolder(obj.id, e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-amber-300 font-bold focus:outline-none cursor-pointer"
                  >
                    {folders.map((f) => (
                      <option key={f} value={f}>
                        /{f}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 font-mono text-[11px]">
                  <div className="text-slate-200">{formatKb(Number(obj.sizeBytes || 0))}</div>
                  <div className="text-[10px] text-slate-500">{obj.mimeType}</div>
                </td>
                <td className="px-4 py-3 font-mono text-[10px] text-emerald-400">
                  <span className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                    <FileCheck2 className="w-3 h-3" />
                    {String(obj.sha256 || '').slice(0, 12)}…
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onDownloadObject(obj)}
                      className="px-2.5 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" /> Baixar
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteObject(obj)}
                      className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg cursor-pointer"
                      title="Excluir arquivo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {objects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">
                  Nenhum arquivo pessoal armazenado nesta pasta. Use o painel acima para enviar documentos ou salvar comprovantes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
