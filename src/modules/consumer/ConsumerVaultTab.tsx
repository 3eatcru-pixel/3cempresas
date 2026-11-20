import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HardDrive, ShieldCheck } from 'lucide-react';
import { apiClient, rawFetch } from '../../../packages/api-client/src';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { ConsumerVaultUploadAndNotes } from './vault/ConsumerVaultUploadAndNotes';
import { ConsumerVaultObjectsTable } from './vault/ConsumerVaultObjectsTable';

export const ConsumerVaultTab: React.FC = () => {
  const { profile } = useAuth();
  const { showNotification } = useEcosystem();

  const [objects, setObjects] = useState<any[]>([]);
  const [folders, setFolders] = useState<string[]>([
    'comprovantes',
    'notas-fiscais',
    'documentos',
    'receitas',
    'geral',
  ]);
  const [selectedFolder, setSelectedFolder] = useState<string>('ALL');
  const [uploadFolder, setUploadFolder] = useState<string>('comprovantes');
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [quotaBytes, setQuotaBytes] = useState<number>(10 * 1024 * 1024);
  const [usedBytes, setUsedBytes] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);

  const [quickTitle, setQuickTitle] = useState<string>('');
  const [quickContent, setQuickContent] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadPersonalVault = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.listStorageObjects({
        appId: 'marketplace',
        folder: selectedFolder !== 'ALL' ? selectedFolder : undefined,
      });
      setObjects(Array.isArray(res.objects) ? res.objects : []);
      if (typeof res.quotaBytes === 'number') setQuotaBytes(res.quotaBytes);
      if (typeof res.usedBytes === 'number') setUsedBytes(res.usedBytes);
      if (Array.isArray(res.folders) && res.folders.length > 0) {
        setFolders((prev) => Array.from(new Set([...prev, ...res.folders!])));
      }
    } catch (err: any) {
      showNotification(err?.message || 'Erro ao carregar arquivos pessoais.');
    } finally {
      setLoading(false);
    }
  }, [selectedFolder, showNotification]);

  useEffect(() => {
    void loadPersonalVault();
  }, [loadPersonalVault]);

  const handleAddFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newFolderName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-');
    if (!cleaned) return;
    if (!folders.includes(cleaned)) {
      setFolders((prev) => [...prev, cleaned]);
    }
    setUploadFolder(cleaned);
    setSelectedFolder(cleaned);
    setNewFolderName('');
    showNotification(`Pasta "${cleaned}" selecionada para organização.`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Falha ao ler arquivo local.'));
        reader.readAsDataURL(file);
      });
      const contentBase64 = await base64Promise;
      await apiClient.uploadStorageObject({
        appId: 'marketplace',
        folder: uploadFolder || 'comprovantes',
        filename: file.name,
        mimeType: file.type || 'application/pdf',
        visibility: 'PRIVATE',
        contentBase64,
      });
      showNotification(`Arquivo "${file.name}" salvo na pasta "${uploadFolder}".`);
      await loadPersonalVault();
    } catch (err: any) {
      showNotification(err?.message || 'Falha ao enviar arquivo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleQuickNoteSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || !quickContent.trim()) return;
    setUploading(true);
    try {
      const safeName = quickTitle.trim().endsWith('.txt')
        ? quickTitle.trim()
        : `${quickTitle.trim()}.txt`;
      await apiClient.uploadStorageObject({
        appId: 'marketplace',
        folder: uploadFolder || 'comprovantes',
        filename: safeName,
        mimeType: 'text/plain',
        visibility: 'PRIVATE',
        contentUtf8: quickContent,
      });
      setQuickTitle('');
      setQuickContent('');
      showNotification(`Nota pessoal salva na pasta "${uploadFolder}".`);
      await loadPersonalVault();
    } catch (err: any) {
      showNotification(err?.message || 'Erro ao salvar nota pessoal.');
    } finally {
      setUploading(false);
    }
  };

  const handleMoveFolder = async (objectId: string, nextFolder: string) => {
    try {
      await apiClient.updateStorageObject(objectId, { folder: nextFolder });
      showNotification(`Arquivo movido para a pasta "${nextFolder}".`);
      await loadPersonalVault();
    } catch (err: any) {
      showNotification(err?.message || 'Erro ao mover arquivo.');
    }
  };

  const handleDownloadObject = async (obj: any) => {
    try {
      const response = await rawFetch(`/storage/objects/${encodeURIComponent(obj.id)}/content`, {
        method: 'GET',
        appId: 'marketplace',
      });
      if (!response.ok) {
        throw new Error(`Falha no download (HTTP ${response.status}).`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = obj.filename || `${obj.id}.bin`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showNotification(err?.message || 'Erro ao baixar arquivo.');
    }
  };

  const handleDeleteObject = async (obj: any) => {
    try {
      await apiClient.deleteStorageObject(obj.id);
      showNotification(`Arquivo "${obj.filename}" removido do cofre pessoal.`);
      await loadPersonalVault();
    } catch (err: any) {
      showNotification(err?.message || 'Erro ao excluir arquivo.');
    }
  };

  const usedPercent = Math.min(100, Math.round((usedBytes / Math.max(1, quotaBytes)) * 100));
  const formatKb = (bytes: number) =>
    bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
      : `${Math.max(0.1, bytes / 1024).toFixed(1)} KB`;

  return (
    <div className="bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6 shadow-xl animate-fadeIn">
      {/* Header & Personal Quota */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h3 className="font-black text-white italic uppercase tracking-tight flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-amber-400" /> Cofre Pessoal de Arquivos &amp; Comprovantes
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Armazenamento isolado por proprietário ({profile?.email}) com organização em pastas, verificação SHA-256 e cota individual.
          </p>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 min-w-[260px]">
          <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
            <span className="text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Cota Pessoal Isolada
            </span>
            <span className="text-white font-bold">
              {formatKb(usedBytes)} / {formatKb(quotaBytes)} ({usedPercent}%)
            </span>
          </div>
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all ${
                usedPercent > 85 ? 'bg-rose-500' : usedPercent > 60 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
        </div>
      </div>

      <ConsumerVaultUploadAndNotes
        folders={folders}
        selectedFolder={selectedFolder}
        onSelectFolder={setSelectedFolder}
        uploadFolder={uploadFolder}
        onChangeUploadFolder={setUploadFolder}
        newFolderName={newFolderName}
        onChangeNewFolderName={setNewFolderName}
        onAddFolder={handleAddFolder}
        uploading={uploading}
        fileInputRef={fileInputRef}
        onFileUpload={handleFileUpload}
        quickTitle={quickTitle}
        onChangeQuickTitle={setQuickTitle}
        quickContent={quickContent}
        onChangeQuickContent={setQuickContent}
        onQuickNoteSave={handleQuickNoteSave}
      />

      <ConsumerVaultObjectsTable
        objects={objects}
        folders={folders}
        loading={loading}
        formatKb={formatKb}
        onRefresh={() => void loadPersonalVault()}
        onMoveFolder={(objectId, nextFolder) => void handleMoveFolder(objectId, nextFolder)}
        onDownloadObject={(obj) => void handleDownloadObject(obj)}
        onDeleteObject={(obj) => void handleDeleteObject(obj)}
      />
    </div>
  );
};
