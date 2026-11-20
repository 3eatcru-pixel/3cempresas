import React, { useState, useEffect } from 'react';
import { Users, Trash2, ShieldCheck, Key, Ban, CheckCircle2, Lock, ChevronDown, ChevronUp, QrCode, RefreshCw } from 'lucide-react';
import { AdminUser, UserRole } from '../../../../types';
import { BLOCKABLE_STORE_MODULES } from '../../layout/storeOsAppsList';

interface StaffMemberCardProps {
  member: AdminUser;
  canMutate: boolean;
  canAdministerAccount?: boolean;
  callerRole?: string;
  onDeleteAccount: (id: string) => void;
  onChangeRole: (uid: string, nextRole: UserRole) => void;
  onUpdateBlockedApps: (uid: string, blockedApps: string[]) => Promise<void> | void;
  onToggleStatus: (uid: string, nextStatus: 'ACTIVE' | 'DISABLED') => void;
  onRevokeSessions: (uid: string) => void;
  onResetPassword?: (uid: string, member: AdminUser) => void;
}

export const getRoleBadgeColor = (role: UserRole) => {
  switch (role) {
    case 'SUPER_ADMIN': return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'STORE_OWNER': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    case 'REGIONAL_MANAGER': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    case 'STORE_MANAGER': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    case 'CASHIER': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'WAITER': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'KITCHEN_STAFF': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
};

export const StaffMemberCard: React.FC<StaffMemberCardProps> = ({
  member,
  canMutate,
  canAdministerAccount,
  callerRole,
  onDeleteAccount,
  onChangeRole,
  onUpdateBlockedApps,
  onToggleStatus,
  onRevokeSessions,
  onResetPassword,
}) => {
  const canAdminAccount = canAdministerAccount ?? (callerRole !== 'STORE_MANAGER');
  const targetUid = member.uid || member.id;
  const isSuspended = String(member.status) === 'DISABLED' || member.status === 'SUSPENDED';
  const [isEditingBlocks, setIsEditingBlocks] = useState(false);
  const [draftBlockedApps, setDraftBlockedApps] = useState<string[]>(member.blockedApps || []);
  const [isSavingBlocks, setIsSavingBlocks] = useState(false);

  useEffect(() => {
    setDraftBlockedApps(member.blockedApps || []);
  }, [member.blockedApps]);

  const canAssignRegional =
    callerRole === 'DEV_OWNER' || callerRole === 'SUPER_ADMIN' || callerRole === 'STORE_OWNER';

  const blockedCount = (member.blockedApps || []).length;

  const toggleModuleBlock = (moduleId: string) => {
    setDraftBlockedApps((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    );
  };

  const handleSaveBlocks = async () => {
    setIsSavingBlocks(true);
    try {
      await onUpdateBlockedApps(targetUid, draftBlockedApps);
      setIsEditingBlocks(false);
    } finally {
      setIsSavingBlocks(false);
    }
  };

  return (
    <div className="bg-slate-900/80 rounded-3xl border border-slate-800 p-5 space-y-4 shadow-xl group hover:border-indigo-500/30 transition-all">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-indigo-400 shadow-inner group-hover:scale-110 transition-transform">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-white font-black text-sm">{member.name}</div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
              {member.email}
            </div>
          </div>
        </div>
        {canMutate && canAdminAccount && (
          <button
            onClick={() => onDeleteAccount(targetUid)}
            className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer"
            title="Remover Colaborador"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <span
          className={`px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase ${getRoleBadgeColor(
            member.role
          )}`}
        >
          {member.role.replace('_', ' ')}
        </span>
        <div className="flex items-center gap-1.5">
          {blockedCount > 0 && (
            <span className="px-2 py-0.5 rounded-lg border bg-amber-500/10 text-amber-300 border-amber-500/20 text-[9px] font-black uppercase">
              {blockedCount} bloqueado(s)
            </span>
          )}
          <span
            className={`px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase ${
              !isSuspended
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}
          >
            {member.status}
          </span>
        </div>
      </div>

      {canMutate ? (
        <div className="space-y-2.5 pt-2 border-t border-slate-800/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <select
              value={member.role}
              onChange={(e) => onChangeRole(targetUid, e.target.value as UserRole)}
              aria-label={`Alterar função de ${member.name}`}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white focus:outline-none focus:border-indigo-500"
            >
              {canAssignRegional && (
                <option value="REGIONAL_MANAGER">REGIONAL MANAGER (Multi-Filial)</option>
              )}
              <option value="STORE_MANAGER">STORE MANAGER</option>
              <option value="CASHIER">CASHIER</option>
              <option value="KITCHEN_STAFF">KITCHEN STAFF</option>
              <option value="WAITER">WAITER (App 3C Waiter)</option>
            </select>
          </div>

          {member.role === 'WAITER' ? (
            <div className="px-3 py-2 rounded-xl bg-blue-500/5 border border-blue-500/20 text-[10px] text-blue-300 flex items-center gap-2">
              <QrCode className="w-3.5 h-3.5 shrink-0" />
              <span>Entra no 3C Waiter com este e-mail/senha da loja (ou via PDQ/PIN do salão).</span>
            </div>
          ) : (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setIsEditingBlocks((prev) => !prev)}
                className="w-full px-3 py-2 flex items-center justify-between text-[10px] font-black uppercase text-slate-300 hover:text-white cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-amber-400" />
                  Bloquear Módulos do Store OS ({draftBlockedApps.length})
                </span>
                {isEditingBlocks ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {isEditingBlocks && (
                <div className="p-3 border-t border-slate-800 space-y-2.5">
                  <div className="max-h-36 overflow-y-auto grid grid-cols-1 gap-1 pr-1 custom-scrollbar">
                    {BLOCKABLE_STORE_MODULES.map((mod) => {
                      const isBlocked = draftBlockedApps.includes(mod.id);
                      return (
                        <label
                          key={mod.id}
                          className={`flex items-center justify-between px-2 py-1 rounded-lg text-[10px] cursor-pointer transition-colors ${
                            isBlocked
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : 'bg-slate-900/70 text-slate-300 hover:bg-slate-900'
                          }`}
                        >
                          <span className="truncate font-semibold">{mod.title}</span>
                          <input
                            type="checkbox"
                            checked={isBlocked}
                            onChange={() => toggleModuleBlock(mod.id)}
                            className="accent-rose-500 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDraftBlockedApps([]);
                      }}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-bold uppercase rounded-lg cursor-pointer"
                    >
                      Liberar Tudo
                    </button>
                    <button
                      type="button"
                      disabled={isSavingBlocks}
                      onClick={handleSaveBlocks}
                      className="flex-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[9px] font-black uppercase rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      {isSavingBlocks ? 'Salvando...' : 'Salvar Bloqueios'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className={`grid ${canAdminAccount ? (onResetPassword ? 'grid-cols-3' : 'grid-cols-2') : 'grid-cols-1'} gap-2`}>
            <button
              type="button"
              onClick={() => onToggleStatus(targetUid, isSuspended ? 'ACTIVE' : 'DISABLED')}
              className={`p-2 rounded-xl transition-all text-[9px] font-black uppercase flex items-center justify-center gap-1 cursor-pointer ${
                isSuspended
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'
              }`}
            >
              {isSuspended ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
              {isSuspended ? 'Reativar' : 'Suspender'}
            </button>
            {canAdminAccount && (
              <button
                type="button"
                onClick={() => onRevokeSessions(targetUid)}
                className="p-2 bg-slate-950/50 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-amber-400 transition-all text-[9px] font-black uppercase flex items-center justify-center gap-1 cursor-pointer"
                title="Revogar sessões ativas"
              >
                <Key className="w-3.5 h-3.5" /> Sessões
              </button>
            )}
            {canAdminAccount && onResetPassword && (
              <button
                type="button"
                onClick={() => onResetPassword(targetUid, member)}
                className="p-2 bg-slate-950/50 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-emerald-400 transition-all text-[9px] font-black uppercase flex items-center justify-center gap-1 cursor-pointer"
                title="Gerar nova senha temporária para este colaborador"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Nova Senha
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="pt-2 border-t border-slate-800/50 text-[10px] text-slate-500 font-bold text-center">
          Conta protegida pela hierarquia
        </div>
      )}
    </div>
  );
};
