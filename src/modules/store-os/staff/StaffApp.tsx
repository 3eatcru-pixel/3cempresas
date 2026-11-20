import React, { useState } from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { useAuth } from '../../../context/AuthContext';
import { Users, UserPlus, Lock, Key, Copy, X } from 'lucide-react';
import { AdminUser, UserRole } from '../../../types';
import { StaffMemberCard } from './layout/StaffMemberCard';
import { InviteStaffModal } from './layout/InviteStaffModal';

const ROLE_LEVELS: Record<string, number> = {
  DEV_OWNER: 100,
  SUPER_ADMIN: 90,
  STORE_OWNER: 80,
  REGIONAL_MANAGER: 70,
  STORE_MANAGER: 60,
  CASHIER: 50,
  KITCHEN_STAFF: 40,
  WAITER: 30,
  COURIER: 20,
  CUSTOMER: 10,
};

const STAFF_MANAGER_ROLES = new Set<string>([
  'DEV_OWNER',
  'SUPER_ADMIN',
  'STORE_OWNER',
  'REGIONAL_MANAGER',
  'STORE_MANAGER',
]);

const STORE_PERSONNEL_ROLES = new Set<string>([
  'STORE_OWNER',
  'REGIONAL_MANAGER',
  'STORE_MANAGER',
  'CASHIER',
  'KITCHEN_STAFF',
  'WAITER',
]);

export const StaffApp: React.FC = () => {
  const { profile } = useAuth();
  const {
    currentStore,
    stores,
    adminUsers,
    showNotification,
    createUserAccount,
    deleteUserAccount,
    updateUserRole,
    updateUserBlockedApps,
    toggleUserStatus,
    revokeUserSessions,
    resetUserPassword,
  } = useEcosystem();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'MANAGEMENT' | 'CASHIER' | 'KITCHEN_STAFF' | 'WAITER'>('ALL');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [tempPasswordInfo, setTempPasswordInfo] = useState<{
    name: string;
    email: string;
    password: string;
  } | null>(null);

  const canManageStaff = Boolean(profile?.role && STAFF_MANAGER_ROLES.has(profile.role));
  const callerLevel = ROLE_LEVELS[profile?.role || ''] || 0;

  if (!canManageStaff) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-white uppercase tracking-tight">
          Acesso Restrito à Gestão de Equipe
        </h3>
        <p className="text-xs text-slate-400 max-w-sm">
          Apenas proprietários e gestores autorizados da loja podem gerenciar usuários, bloqueios de módulos e sessões.
        </p>
      </div>
    );
  }

  const storeStaff = adminUsers.filter(
    (u) =>
      STORE_PERSONNEL_ROLES.has(u.role) &&
      u.tenantId === currentStore.tenantId &&
      (u.storeId === currentStore.id || (!u.storeId && (u.role === 'REGIONAL_MANAGER' || u.role === 'STORE_OWNER')))
  );

  const isManagementRole = (role: string) =>
    role === 'STORE_OWNER' || role === 'REGIONAL_MANAGER' || role === 'STORE_MANAGER';

  const roleCounts = {
    all: storeStaff.length,
    management: storeStaff.filter((u) => isManagementRole(u.role)).length,
    cashier: storeStaff.filter((u) => u.role === 'CASHIER').length,
    kitchen: storeStaff.filter((u) => u.role === 'KITCHEN_STAFF').length,
    waiter: storeStaff.filter((u) => u.role === 'WAITER').length,
  };

  const filteredStaff = storeStaff.filter((u) => {
    const matchesQuery =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesQuery) return false;
    if (roleFilter === 'ALL') return true;
    if (roleFilter === 'MANAGEMENT') return isManagementRole(u.role);
    return u.role === roleFilter;
  });

  const accessibleBranches = stores.filter((s) => {
    if (s.tenantId !== currentStore.tenantId || s._deleted) return false;
    if (['DEV_OWNER', 'SUPER_ADMIN'].includes(profile?.role || '') || !profile?.storeId) return true;
    const allowedSet = new Set([
      profile.storeId,
      ...(Array.isArray(profile.allowedStoreIds) ? profile.allowedStoreIds : []),
    ]);
    return allowedSet.has(s.id);
  });

  const handleInviteStaff = async (
    name: string,
    email: string,
    role: UserRole,
    password: string,
    blockedApps?: string[],
    targetStoreId?: string | null
  ) => {
    const resolvedBranchId = targetStoreId === null ? undefined : (targetStoreId || currentStore.id);
    await createUserAccount(name, email, role, resolvedBranchId, password, undefined, blockedApps);
  };

  return (
    <div className="space-y-5 h-full overflow-y-auto pr-2 custom-scrollbar">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 sticky top-0 bg-[#0a0e17] z-10 py-2">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-indigo-400" />
          <div>
            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
              Gestão de Equipe &amp; Permissões da Loja
            </h3>
            <p className="text-[10px] text-slate-400 font-bold">
              O dono da loja libera e-mails e senhas da equipe (inclusive garçons do 3C Waiter), cargos e sessões.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar colaborador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-[11px] px-4 py-2 rounded-xl text-white outline-none focus:border-indigo-500 w-48"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="px-4 py-2 bg-indigo-500 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors hover:bg-indigo-400 flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" /> CONVIDAR
          </button>
        </div>
      </div>

      {/* Role KPI & Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'ALL', label: 'Todos', count: roleCounts.all },
            { id: 'MANAGEMENT', label: 'Gestão', count: roleCounts.management },
            { id: 'CASHIER', label: 'Caixa / PDV', count: roleCounts.cashier },
            { id: 'KITCHEN_STAFF', label: 'Cozinha (KDS)', count: roleCounts.kitchen },
            { id: 'WAITER', label: 'Garçom', count: roleCounts.waiter },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setRoleFilter(tab.id)}
            className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              roleFilter === tab.id
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>{tab.label}</span>
            <span className="font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded bg-slate-950/80 text-slate-200">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {tempPasswordInfo && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Key className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-200 space-y-0.5">
              <div className="font-black text-emerald-300 uppercase tracking-wide">
                Nova Senha Temporária Gerada — {tempPasswordInfo.name}
              </div>
              <div>
                Login: <span className="font-mono font-bold text-white">{tempPasswordInfo.email}</span> • Senha:{' '}
                <span className="font-mono font-black text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  {tempPasswordInfo.password}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(tempPasswordInfo.password).then(() => {
                  showNotification('Senha temporária copiada para a área de transferência!');
                }).catch(() => {});
              }}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" /> Copiar Senha
            </button>
            <button
              type="button"
              onClick={() => setTempPasswordInfo(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              aria-label="Fechar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStaff.map((member) => {
          const targetUid = member.uid || member.id;
          const targetLevel = ROLE_LEVELS[member.role] || 0;
          const canMutateTarget =
            targetUid !== profile?.uid &&
            (profile?.role === 'DEV_OWNER' || profile?.role === 'STORE_OWNER' || callerLevel > targetLevel);
          const canAdministerAccount =
            canMutateTarget &&
            ['DEV_OWNER', 'SUPER_ADMIN', 'STORE_OWNER', 'REGIONAL_MANAGER'].includes(profile?.role || '');
          return (
            <StaffMemberCard
              key={targetUid}
              member={member}
              canMutate={canMutateTarget}
              canAdministerAccount={canAdministerAccount}
              callerRole={profile?.role}
              onDeleteAccount={deleteUserAccount}
              onChangeRole={(uid, nextRole) =>
                updateUserRole(
                  uid,
                  nextRole as any,
                  currentStore.tenantId,
                  nextRole === 'REGIONAL_MANAGER' ? null : (member.storeId || currentStore.id)
                )
              }
              onUpdateBlockedApps={updateUserBlockedApps}
              onToggleStatus={toggleUserStatus}
              onRevokeSessions={revokeUserSessions}
              onResetPassword={async (uid, targetMember: AdminUser) => {
                const pwd = await resetUserPassword(uid);
                if (pwd) {
                  setTempPasswordInfo({
                    name: targetMember.name,
                    email: targetMember.email,
                    password: pwd,
                  });
                }
              }}
            />
          );
        })}
      </div>

      <InviteStaffModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInvite={handleInviteStaff}
        callerRole={profile?.role}
        accessibleStores={accessibleBranches}
        defaultStoreId={currentStore.id}
        showNotification={showNotification}
      />

      {filteredStaff.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center opacity-30 gap-4">
          <Users className="w-16 h-16 text-slate-500" />
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
            Nenhum colaborador encontrado nesta filial.
          </p>
        </div>
      )}
    </div>
  );
};
