import React from 'react';
import { Shield, UserPlus } from 'lucide-react';
import { FirebaseAdminRecord } from '../../../services/firebaseClient';

interface HqFirebaseAdminsManagerProps {
  isDevOwner: boolean;
  activeUserUid?: string | null;
  admins: FirebaseAdminRecord[];
  adminsBusy: boolean;
  newAdminUid: string;
  setNewAdminUid: (val: string) => void;
  newAdminEmail: string;
  setNewAdminEmail: (val: string) => void;
  confirmRevokeUid: string | null;
  setConfirmRevokeUid: (uid: string | null) => void;
  onGrantAdmin: (e: React.FormEvent) => void;
  onRevokeAdmin: (uid: string) => void;
}

export const HqFirebaseAdminsManager: React.FC<HqFirebaseAdminsManagerProps> = ({
  isDevOwner,
  activeUserUid,
  admins,
  adminsBusy,
  newAdminUid,
  setNewAdminUid,
  newAdminEmail,
  setNewAdminEmail,
  confirmRevokeUid,
  setConfirmRevokeUid,
  onGrantAdmin,
  onRevokeAdmin,
}) => {
  return (
    <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          Admins Autorizados no Firestore (/admins)
        </h4>
        <span className="text-[10px] font-mono text-slate-400">{admins.length} registro(s)</span>
      </div>

      {isDevOwner ? (
        <form onSubmit={onGrantAdmin} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            required
            value={newAdminUid}
            onChange={(e) => setNewAdminUid(e.target.value)}
            placeholder="UID Firebase"
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
          />
          <input
            type="email"
            required
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            placeholder="admin@empresa.com"
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
          />
          <button
            type="submit"
            disabled={adminsBusy}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Conceder
          </button>
        </form>
      ) : (
        <p className="text-[11px] text-slate-500">Somente DEV_OWNER pode conceder ou revogar /admins.</p>
      )}

      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
        {admins.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic">
            Nenhum admin adicional cadastrado em /admins (bootstrap owner ativo via rules).
          </p>
        ) : (
          admins.map((admin) => {
            const isSelf = admin.uid === activeUserUid;
            const confirming = confirmRevokeUid === admin.uid;
            return (
              <div
                key={admin.uid}
                className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px]"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-200 truncate">{admin.email}</div>
                  <div className="text-[10px] font-mono text-slate-500 truncate">UID: {admin.uid}</div>
                </div>
                {isDevOwner && !isSelf && (
                  confirming ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={adminsBusy}
                        onClick={() => onRevokeAdmin(admin.uid)}
                        className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-black cursor-pointer"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRevokeUid(null)}
                        className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[10px] font-bold cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={adminsBusy}
                      onClick={() => setConfirmRevokeUid(admin.uid)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 text-[10px] font-bold shrink-0 cursor-pointer"
                    >
                      Revogar
                    </button>
                  )
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
