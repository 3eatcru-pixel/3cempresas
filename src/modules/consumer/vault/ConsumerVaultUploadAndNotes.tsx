import React from 'react';
import { Folder, FolderPlus, PlusCircle, Upload } from 'lucide-react';

interface ConsumerVaultUploadAndNotesProps {
  folders: string[];
  selectedFolder: string;
  onSelectFolder: (folder: string) => void;
  uploadFolder: string;
  onChangeUploadFolder: (folder: string) => void;
  newFolderName: string;
  onChangeNewFolderName: (val: string) => void;
  onAddFolder: (e: React.FormEvent) => void;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  quickTitle: string;
  onChangeQuickTitle: (val: string) => void;
  quickContent: string;
  onChangeQuickContent: (val: string) => void;
  onQuickNoteSave: (e: React.FormEvent) => void;
}

export const ConsumerVaultUploadAndNotes: React.FC<ConsumerVaultUploadAndNotesProps> = ({
  folders,
  selectedFolder,
  onSelectFolder,
  uploadFolder,
  onChangeUploadFolder,
  newFolderName,
  onChangeNewFolderName,
  onAddFolder,
  uploading,
  fileInputRef,
  onFileUpload,
  quickTitle,
  onChangeQuickTitle,
  quickContent,
  onChangeQuickContent,
  onQuickNoteSave,
}) => {
  return (
    <>
      {/* Folders Bar & New Folder */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectFolder('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer transition-all ${
              selectedFolder === 'ALL'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Todas as Pastas</span>
          </button>
          {folders.map((folder) => {
            const active = selectedFolder === folder;
            return (
              <button
                key={folder}
                type="button"
                onClick={() => {
                  onSelectFolder(folder);
                  onChangeUploadFolder(folder);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-1.5 border cursor-pointer transition-all ${
                  active
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-white'
                }`}
              >
                <Folder className="w-3.5 h-3.5" />
                <span>/{folder}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={onAddFolder} className="flex items-center gap-2">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => onChangeNewFolderName(e.target.value)}
            placeholder="Nova pasta (ex: exames)..."
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <FolderPlus className="w-3.5 h-3.5" /> Criar Pasta
          </button>
        </form>
      </div>

      {/* Upload File & Quick Note */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-400" /> Enviar Arquivo (PDF, PNG, JPEG, WEBP, CSV, TXT, JSON)
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Limite de 2 MB por arquivo. Somente sua conta autenticada possui permissão de leitura e exclusão.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <select
              value={uploadFolder}
              onChange={(e) => onChangeUploadFolder(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono font-bold focus:outline-none cursor-pointer"
            >
              {folders.map((f) => (
                <option key={f} value={f}>
                  Pasta: /{f}
                </option>
              ))}
            </select>

            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.pdf,.csv,.txt,.json"
              onChange={onFileUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Enviando...' : 'Selecionar Arquivo do Dispositivo'}
            </button>
          </div>
        </div>

        <form
          onSubmit={onQuickNoteSave}
          className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2.5"
        >
          <div className="text-xs font-bold text-white flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-emerald-400" /> Criar Comprovante / Nota Pessoal Rápida
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              required
              value={quickTitle}
              onChange={(e) => onChangeQuickTitle(e.target.value)}
              placeholder="Nome do arquivo (ex: recibo-jantar.txt)"
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
            />
            <input
              type="text"
              required
              value={quickContent}
              onChange={(e) => onChangeQuickContent(e.target.value)}
              placeholder="Conteúdo / chave PIX / protocolo..."
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={uploading}
              className="px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-[11px] font-bold cursor-pointer disabled:opacity-50"
            >
              Salvar na pasta /{uploadFolder}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};
