import React from 'react';
import { Save, Sliders, Trash2 } from 'lucide-react';
import { FirebaseCloudTheme } from '../../../services/firebaseClient';

interface HqFirebasePreferencesFormProps {
  activeEmail?: string | null;
  locale: string;
  setLocale: (val: string) => void;
  theme: FirebaseCloudTheme;
  setTheme: (val: FirebaseCloudTheme) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (val: boolean) => void;
  prefsUpdatedAt?: string;
  prefsBusy: boolean;
  onSave: (e: React.FormEvent) => void;
  onDelete: () => void;
}

export const HqFirebasePreferencesForm: React.FC<HqFirebasePreferencesFormProps> = ({
  activeEmail,
  locale,
  setLocale,
  theme,
  setTheme,
  notificationsEnabled,
  setNotificationsEnabled,
  prefsUpdatedAt,
  prefsBusy,
  onSave,
  onDelete,
}) => {
  return (
    <form
      onSubmit={onSave}
      className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          Preferências Multi-Dispositivo
        </h4>
        <span className="text-[10px] font-mono text-slate-400 truncate max-w-[180px]">
          {activeEmail}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-slate-400">Idioma (locale)</label>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
          >
            <option value="pt-BR">pt-BR (Português)</option>
            <option value="en-US">en-US (English)</option>
            <option value="es-ES">es-ES (Español)</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-slate-400">Tema Visual</label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as FirebaseCloudTheme)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
          >
            <option value="dark">Escuro (Dark)</option>
            <option value="light">Claro (Light)</option>
            <option value="system">Sistema (System)</option>
          </select>
        </div>
      </div>

      <label className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
        <span className="text-[11px] text-slate-300">Receber notificações de governança</span>
        <input
          type="checkbox"
          checked={notificationsEnabled}
          onChange={(e) => setNotificationsEnabled(e.target.checked)}
          className="w-4 h-4 accent-amber-500 cursor-pointer"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-[10px] font-mono text-slate-500">
          {prefsUpdatedAt ? `Sincronizado: ${new Date(prefsUpdatedAt).toLocaleString('pt-BR')}` : 'Ainda não salvo'}
        </span>
        <div className="flex items-center gap-2">
          {prefsUpdatedAt && (
            <button
              type="button"
              disabled={prefsBusy}
              onClick={onDelete}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
              Limpar
            </button>
          )}
          <button
            type="submit"
            disabled={prefsBusy}
            className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3 h-3" />
            {prefsBusy ? 'Salvando...' : 'Sincronizar'}
          </button>
        </div>
      </div>
    </form>
  );
};
