import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { apiClient, AccountSecurityOverviewResponse } from '../../../packages/api-client/src';
import { RefreshCw, UserPlus, Users } from 'lucide-react';
import { EcosystemSessionRole } from '../../types';
import { HqCreateUserModal, CreateUserFormData } from './rbac/HqCreateUserModal';
import { HqRbacUsersTable } from './rbac/HqRbacUsersTable';
import { HqResetPasswordModal } from './rbac/HqResetPasswordModal';
import { HqCustomizeUserModal } from './rbac/HqCustomizeUserModal';
import { HqAccountSecurityRadar } from './rbac/HqAccountSecurityRadar';
import {
  AccountSegment,
  HQ_ROLES,
  STORE_SCOPED_ROLES,
  StatusFilter,
  getUserEffectiveStatus,
  normalizeRoleLabel,
} from './rbac/hqRbacHelpers';

export const HqRbacTab: React.FC = () => {
  const { profile } = useAuth();
  const {
    users,
    stores,
    updateUserRole,
    updateCourierGovernance,
    updateUserAccountDetails,
    toggleUserStatus,
    createUserAccount,
    deleteUserAccount,
    revokeUserSessions,
    resetUserPassword,
    showNotification,
  } = useEcosystem();

  const [segment, setSegment] = useState<AccountSegment>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [customizingUser, setCustomizingUser] = useState<any | null>(null);
  const [securityOverview, setSecurityOverview] = useState<AccountSecurityOverviewResponse | null>(null);
  const [loadingSecurity, setLoadingSecurity] = useState(false);

  const [resetPasswordResult, setResetPasswordResult] = useState<{
    uid: string;
    name: string;
    email: string;
    temporaryPassword: string;
  } | null>(null);
  const [copiedTempPass, setCopiedTempPass] = useState(false);

  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserData, setNewUserData] = useState<CreateUserFormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'STORE_OWNER' as EcosystemSessionRole,
    storeId: '',
    courierFleetScope: 'PLATFORM_ONLY',
    vehicle: 'SCOOTER',
    vehiclePlate: '',
  });

  const loadAccountSecurity = useCallback(async () => {
    setLoadingSecurity(true);
    try {
      const res = await apiClient.getAccountSecurityOverview();
      setSecurityOverview(res);
    } catch {
      // Ignore if caller lacks permission
    } finally {
      setLoadingSecurity(false);
    }
  }, []);

  useEffect(() => {
    void loadAccountSecurity();
  }, [loadAccountSecurity, users.length]);

  useEffect(() => {
    const needsDefaultStore =
      newUserData.role !== 'CUSTOMER' &&
      !(newUserData.role === 'COURIER' && newUserData.courierFleetScope === 'PLATFORM_ONLY');
    if (isCreatingUser && needsDefaultStore && !newUserData.storeId && stores.length > 0) {
      setNewUserData((prev) => ({ ...prev, storeId: stores[0].id }));
    }
  }, [isCreatingUser, newUserData.role, newUserData.courierFleetScope, newUserData.storeId, stores]);

  const counts = useMemo(() => {
    let marketplace = 0;
    let merchants = 0;
    let couriers = 0;
    let hq = 0;
    let suspended = 0;

    for (const u of users) {
      const role = normalizeRoleLabel(u.role);
      if (role === 'CUSTOMER') marketplace++;
      else if (role === 'COURIER' || role === 'DRIVER') couriers++;
      else if (HQ_ROLES.has(role)) hq++;
      else merchants++;

      if (getUserEffectiveStatus(u) === 'DISABLED') suspended++;
    }

    return { total: users.length, marketplace, merchants, couriers, hq, suspended };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return users.filter((u) => {
      const role = normalizeRoleLabel(u.role);
      const effStatus = getUserEffectiveStatus(u);

      if (segment === 'MARKETPLACE' && role !== 'CUSTOMER') return false;
      if (segment === 'MERCHANTS' && !STORE_SCOPED_ROLES.has(role)) return false;
      if (segment === 'COURIERS' && role !== 'COURIER' && role !== 'DRIVER') return false;
      if (segment === 'HQ' && !HQ_ROLES.has(role)) return false;

      if (statusFilter !== 'ALL' && effStatus !== statusFilter) return false;

      if (query) {
        const uid = String(u.uid || u.id || '').toLowerCase();
        const name = String(u.name || '').toLowerCase();
        const email = String(u.email || '').toLowerCase();
        const phone = String(u.phone || '').toLowerCase();
        if (
          !uid.includes(query) &&
          !name.includes(query) &&
          !email.includes(query) &&
          !phone.includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [users, segment, statusFilter, searchTerm]);

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.name || !newUserData.email || newUserData.password.length < 8) return;
    const isCourier = newUserData.role === 'COURIER';
    const shouldBindStore =
      STORE_SCOPED_ROLES.has(newUserData.role) ||
      (isCourier && newUserData.courierFleetScope !== 'PLATFORM_ONLY' && Boolean(newUserData.storeId));

    const courierOptions = isCourier
      ? {
          fleetType:
            newUserData.courierFleetScope === 'STORE_ONLY'
              ? ('STORE_FLEET' as const)
              : ('PLATFORM_FLEET' as const),
          allowedFleetModes:
            newUserData.courierFleetScope === 'HYBRID'
              ? (['STORE_FLEET', 'PLATFORM_FLEET'] as ('STORE_FLEET' | 'PLATFORM_FLEET')[])
              : newUserData.courierFleetScope === 'STORE_ONLY'
              ? (['STORE_FLEET'] as ('STORE_FLEET' | 'PLATFORM_FLEET')[])
              : (['PLATFORM_FLEET'] as ('STORE_FLEET' | 'PLATFORM_FLEET')[]),
          vehicle: newUserData.vehicle,
          vehiclePlate: newUserData.vehiclePlate,
        }
      : undefined;

    await createUserAccount(
      newUserData.name,
      newUserData.email,
      newUserData.role,
      shouldBindStore ? newUserData.storeId : undefined,
      newUserData.password,
      newUserData.phone,
      undefined,
      courierOptions
    );
    setIsCreatingUser(false);
    setNewUserData({
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'STORE_OWNER',
      storeId: stores[0]?.id || '',
      courierFleetScope: 'PLATFORM_ONLY',
      vehicle: 'SCOOTER',
      vehiclePlate: '',
    });
    void loadAccountSecurity();
  };

  const openCreateModalForSegment = () => {
    const defaultRole: EcosystemSessionRole =
      segment === 'MARKETPLACE'
        ? 'CUSTOMER'
        : segment === 'COURIERS'
        ? 'COURIER'
        : 'STORE_OWNER';
    setNewUserData((prev) => ({
      ...prev,
      role: defaultRole,
      courierFleetScope: 'PLATFORM_ONLY',
      storeId: defaultRole === 'COURIER' ? '' : stores[0]?.id || prev.storeId,
    }));
    setIsCreatingUser(true);
  };

  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-5 animate-fadeIn">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" /> Controle de Contas: HQ, Lojistas &amp; Marketplace
          </h2>
          <p className="text-xs text-slate-400">
            Governança central de contas autenticadas via Server Core — inclui customização de módulos Store OS, filiais autorizadas e fila de recuperação assistida.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadAccountSecurity()}
            className="px-3 py-2 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl text-[10px] font-bold hover:text-white cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSecurity ? 'animate-spin text-amber-400' : ''}`} />
            Radar Seg.
          </button>
          <button
            onClick={openCreateModalForSegment}
            className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" /> CRIAR CONTA DE USUÁRIO
          </button>
        </div>
      </div>

      <HqAccountSecurityRadar
        securityOverview={securityOverview}
        segment={segment}
        onChangeSegment={setSegment}
        counts={counts}
        searchTerm={searchTerm}
        onChangeSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        onChangeStatusFilter={setStatusFilter}
        onGenerateTempPassword={async (item) => {
          const temp = await resetUserPassword(item.uid);
          if (temp) {
            setCopiedTempPass(false);
            setResetPasswordResult({
              uid: item.uid,
              name: item.name,
              email: item.email,
              temporaryPassword: temp,
            });
            void loadAccountSecurity();
          }
        }}
      />

      <HqRbacUsersTable
        filteredUsers={filteredUsers}
        stores={stores}
        callerUid={profile?.uid}
        callerRole={profile?.role}
        onUpdateRole={updateUserRole}
        onUpdateCourierGovernance={updateCourierGovernance}
        onUpdateUserStore={(uid, nextStoreId) => {
          void updateUserAccountDetails(uid, { storeId: nextStoreId });
        }}
        onCustomizeUser={(u) => setCustomizingUser(u)}
        onToggleStatus={toggleUserStatus}
        onRevokeSessions={revokeUserSessions}
        onResetPassword={async (u, userId) => {
          const temp = await resetUserPassword(userId);
          if (temp) {
            setCopiedTempPass(false);
            setResetPasswordResult({
              uid: userId,
              name: u.name || u.email,
              email: u.email,
              temporaryPassword: temp,
            });
            void loadAccountSecurity();
          }
        }}
        onDeleteUser={deleteUserAccount}
      />

      {customizingUser && (
        <HqCustomizeUserModal
          user={customizingUser}
          stores={stores}
          onClose={() => setCustomizingUser(null)}
          onSave={async (uid, updates) => {
            await updateUserAccountDetails(uid, updates);
            void loadAccountSecurity();
          }}
        />
      )}

      {isCreatingUser && (
        <HqCreateUserModal
          newUserData={newUserData}
          setNewUserData={setNewUserData}
          stores={stores}
          callerRole={profile?.role}
          onClose={() => setIsCreatingUser(false)}
          onSubmit={handleCreateUserSubmit}
        />
      )}

      {resetPasswordResult && (
        <HqResetPasswordModal
          resetPasswordResult={resetPasswordResult}
          copiedTempPass={copiedTempPass}
          onCopy={() => {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
              navigator.clipboard.writeText(resetPasswordResult.temporaryPassword).catch(() => {});
            }
            setCopiedTempPass(true);
            showNotification('Senha temporária copiada!');
          }}
          onClose={() => setResetPasswordResult(null)}
        />
      )}
    </div>
  );
};
