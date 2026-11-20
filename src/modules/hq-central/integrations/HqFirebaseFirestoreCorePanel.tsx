import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
} from 'lucide-react';
import {
  checkCurrentUserIsFirestoreAdmin,
  deleteFirebaseCloudPreferences,
  FirebaseAdminRecord,
  FirebaseCloudTheme,
  getActiveFirebaseAuthUser,
  grantFirebaseAdmin,
  listFirebaseAdmins,
  readFirebaseCloudPreferences,
  revokeFirebaseAdmin,
  saveFirebaseCloudPreferences,
  subscribeFirebaseAuthUser,
} from '../../../services/firebaseClient';
import { HqFirebasePreferencesForm } from './HqFirebasePreferencesForm';
import { HqFirebaseAdminsManager } from './HqFirebaseAdminsManager';

interface HqFirebaseFirestoreCorePanelProps {
  firebaseEnabled: boolean;
  firebaseFirestoreEnabled?: boolean;
  isDevOwner: boolean;
}

export const HqFirebaseFirestoreCorePanel: React.FC<HqFirebaseFirestoreCorePanelProps> = ({
  firebaseEnabled,
  firebaseFirestoreEnabled = firebaseEnabled,
  isDevOwner,
}) => {
  const firestoreActive = firebaseEnabled && firebaseFirestoreEnabled;
  const [activeGoogleUser, setActiveGoogleUser] = useState(() =>
    firestoreActive ? getActiveFirebaseAuthUser() : null
  );

  useEffect(() => {
    if (!firestoreActive) {
      setActiveGoogleUser(null);
      return;
    }
    setActiveGoogleUser(getActiveFirebaseAuthUser());
    const unsub = subscribeFirebaseAuthUser((firebaseUser) => {
      setActiveGoogleUser(firebaseUser);
    });
    return () => unsub();
  }, [firestoreActive]);

  const hasVerifiedGoogleSession = Boolean(activeGoogleUser && activeGoogleUser.emailVerified);

  const [locale, setLocale] = useState('pt-BR');
  const [theme, setTheme] = useState<FirebaseCloudTheme>('dark');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [prefsUpdatedAt, setPrefsUpdatedAt] = useState<string | undefined>(undefined);
  const [prefsBusy, setPrefsBusy] = useState(false);

  const [admins, setAdmins] = useState<FirebaseAdminRecord[]>([]);
  const [adminsBusy, setAdminsBusy] = useState(false);
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [confirmRevokeUid, setConfirmRevokeUid] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const showFeedback = (kind: 'ok' | 'err', text: string) => {
    setFeedback({ kind, text });
  };

  const loadFirestoreState = useCallback(async () => {
    if (!firestoreActive || !hasVerifiedGoogleSession) return;
    setPrefsBusy(true);
    setAdminsBusy(true);
    setFeedback(null);
    try {
      const canManageAdmins = isDevOwner ? await checkCurrentUserIsFirestoreAdmin() : false;
      const [prefs, adminList] = await Promise.all([
        readFirebaseCloudPreferences(),
        canManageAdmins ? listFirebaseAdmins() : Promise.resolve([]),
      ]);
      if (prefs) {
        setLocale(prefs.locale);
        setTheme(prefs.theme);
        setNotificationsEnabled(prefs.notificationsEnabled);
        setPrefsUpdatedAt(prefs.updatedAt);
      }
      setAdmins(adminList);
    } catch (err: any) {
      showFeedback('err', err?.message || 'Falha ao consultar Firestore.');
    } finally {
      setPrefsBusy(false);
      setAdminsBusy(false);
    }
  }, [firestoreActive, hasVerifiedGoogleSession, isDevOwner]);

  useEffect(() => {
    void loadFirestoreState();
  }, [loadFirestoreState]);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestoreActive || !hasVerifiedGoogleSession || prefsBusy) return;
    setPrefsBusy(true);
    setFeedback(null);
    try {
      const saved = await saveFirebaseCloudPreferences({
        productScope: 'hq',
        locale,
        theme,
        notificationsEnabled,
      });
      setPrefsUpdatedAt(saved.updatedAt);
      showFeedback('ok', 'Preferências sincronizadas em /cloud_preferences/{uid}.');
    } catch (err: any) {
      showFeedback('err', err?.message || 'Erro ao gravar preferências no Firestore.');
    } finally {
      setPrefsBusy(false);
    }
  };

  const handleDeletePreferences = async () => {
    if (!firestoreActive || !hasVerifiedGoogleSession || prefsBusy) return;
    setPrefsBusy(true);
    setFeedback(null);
    try {
      await deleteFirebaseCloudPreferences();
      setPrefsUpdatedAt(undefined);
      showFeedback('ok', 'Documento /cloud_preferences/{uid} removido.');
    } catch (err: any) {
      showFeedback('err', err?.message || 'Erro ao remover preferências.');
    } finally {
      setPrefsBusy(false);
    }
  };

  const handleGrantAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestoreActive || !isDevOwner || !hasVerifiedGoogleSession || adminsBusy) return;
    setAdminsBusy(true);
    setFeedback(null);
    try {
      const granted = await grantFirebaseAdmin(newAdminUid, newAdminEmail);
      setAdmins((prev) => [...prev.filter((a) => a.uid !== granted.uid), granted]);
      setNewAdminUid('');
      setNewAdminEmail('');
      showFeedback('ok', `Admin ${granted.email} registrado em /admins/${granted.uid}.`);
    } catch (err: any) {
      showFeedback('err', err?.message || 'Erro ao conceder permissão em /admins.');
    } finally {
      setAdminsBusy(false);
    }
  };

  const handleRevokeAdmin = async (uid: string) => {
    if (!firestoreActive || !isDevOwner || !hasVerifiedGoogleSession || adminsBusy) return;
    setAdminsBusy(true);
    setFeedback(null);
    try {
      await revokeFirebaseAdmin(uid);
      setAdmins((prev) => prev.filter((a) => a.uid !== uid));
      setConfirmRevokeUid(null);
      showFeedback('ok', `Permissão revogada em /admins/${uid}.`);
    } catch (err: any) {
      showFeedback('err', err?.message || 'Erro ao revogar permissão em /admins.');
    } finally {
      setAdminsBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            Firestore Cores Ativos — Preferências &amp; Governança (/cloud_preferences &amp; /admins)
          </h3>
          <p className="text-[11px] text-slate-400">
            Coleções não comerciais protegidas por <code className="text-cyan-300">firestore.rules</code> Zero-Trust.
            Requer sessão Google ativa no conector secundário.
          </p>
        </div>

        {firestoreActive && hasVerifiedGoogleSession && (
          <button
            type="button"
            disabled={prefsBusy || adminsBusy}
            onClick={() => void loadFirestoreState()}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${prefsBusy || adminsBusy ? 'animate-spin' : ''}`} />
            Recarregar Firestore
          </button>
        )}
      </div>

      {!firebaseEnabled ? (
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Conector Firebase está em modo STANDBY (Kill-Switch desligado). Ative o provedor secundário acima para
            operar as coleções opcionais do Firestore.
          </span>
        </div>
      ) : !firebaseFirestoreEnabled ? (
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Sub-serviço <strong>Firestore Cores</strong> está em modo STANDBY no grid acima. Reative{' '}
            <code className="font-mono text-cyan-300">Firestore Cores</code> para gravar ou ler{' '}
            <code className="font-mono">/cloud_preferences</code> e <code className="font-mono">/admins</code>.
          </span>
        </div>
      ) : !hasVerifiedGoogleSession ? (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Você está autenticado exclusivamente pelo Server Core autônomo (e-mail/senha). Para gravar em{' '}
            <code className="font-mono">/cloud_preferences</code> ou gerenciar{' '}
            <code className="font-mono">/admins</code> no Firestore, entre no HQ usando o login Google OAuth.
          </span>
        </div>
      ) : (
        <>
          {feedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                feedback.kind === 'ok'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              {feedback.kind === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <HqFirebasePreferencesForm
              activeEmail={activeGoogleUser?.email}
              locale={locale}
              setLocale={setLocale}
              theme={theme}
              setTheme={setTheme}
              notificationsEnabled={notificationsEnabled}
              setNotificationsEnabled={setNotificationsEnabled}
              prefsUpdatedAt={prefsUpdatedAt}
              prefsBusy={prefsBusy}
              onSave={(e) => void handleSavePreferences(e)}
              onDelete={() => void handleDeletePreferences()}
            />

            <HqFirebaseAdminsManager
              isDevOwner={isDevOwner}
              activeUserUid={activeGoogleUser?.uid}
              admins={admins}
              adminsBusy={adminsBusy}
              newAdminUid={newAdminUid}
              setNewAdminUid={setNewAdminUid}
              newAdminEmail={newAdminEmail}
              setNewAdminEmail={setNewAdminEmail}
              confirmRevokeUid={confirmRevokeUid}
              setConfirmRevokeUid={setConfirmRevokeUid}
              onGrantAdmin={(e) => void handleGrantAdmin(e)}
              onRevokeAdmin={(uid) => void handleRevokeAdmin(uid)}
            />
          </div>
        </>
      )}
    </div>
  );
};
