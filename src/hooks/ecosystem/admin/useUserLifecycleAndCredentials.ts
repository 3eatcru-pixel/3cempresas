import React from 'react';
import { StorageAdapter } from '../../../services/databaseAdapter';
import { UserRole, Store } from '../../../types';
import { apiClient } from '../../../core/api/apiClient';
import { generateUserId } from '../../../utils/idGenerator';

const STORE_SCOPED_ROLES = new Set([
  'REGIONAL_MANAGER',
  'STORE_OWNER',
  'STORE_MANAGER',
  'CASHIER',
  'KITCHEN_STAFF',
  'WAITER',
]);

interface UseUserLifecycleAndCredentialsParams {
  adapter: StorageAdapter;
  isHqRole: boolean;
  profile: any;
  stores: Store[];
  setUsers: React.Dispatch<React.SetStateAction<any[]>>;
  refreshManagedUsers: () => Promise<void>;
  emitDriversRefreshHint: () => void;
  getIdToken: () => Promise<string | undefined>;
  showNotification: (msg: string) => void;
  logSystemEvent: (
    type: string,
    payload: string,
    channel: string,
    tenantId?: string
  ) => Promise<void>;
}

export const useUserLifecycleAndCredentials = ({
  adapter,
  isHqRole,
  profile,
  stores,
  setUsers,
  refreshManagedUsers,
  emitDriversRefreshHint,
  getIdToken,
  showNotification,
  logSystemEvent,
}: UseUserLifecycleAndCredentialsParams) => {
  const toggleUserStatus = async (uid: string, nextStatus: 'ACTIVE' | 'DISABLED') => {
    if (profile?.uid && uid === profile.uid && nextStatus === 'DISABLED') {
      showNotification('Operação bloqueada: Você não pode suspender a própria conta em uso.');
      return;
    }
    try {
      if (adapter.type !== 'SERVER_CORE_REST') {
        showNotification('Operação bloqueada: suspensão/reativação exige Server Core (Pilar 4) ativo.');
        return;
      }
      const token = await getIdToken();
      const res = isHqRole
        ? await apiClient.updateHqUser(uid, { status: nextStatus }, token)
        : await apiClient.updateStoreStaff(uid, { status: nextStatus }, token);
      if (res?.user) {
        setUsers((prev) => prev.map((u) => ((u.uid || u.id) === uid ? { ...u, ...res.user } : u)));
      } else {
        await refreshManagedUsers();
      }
      emitDriversRefreshHint();
      showNotification(
        nextStatus === 'DISABLED'
          ? 'Conta suspensa e sessões revogadas imediatamente!'
          : 'Conta reativada com sucesso!'
      );
      logSystemEvent(
        nextStatus === 'DISABLED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
        `Conta ${uid} alterada para ${nextStatus}`,
        isHqRole ? 'hq/security' : 'store/staff'
      );
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao alterar status da conta.');
    }
  };

  const createUserAccount = async (
    name: string,
    email: string,
    role: UserRole,
    storeId?: string,
    password?: string,
    phone?: string,
    blockedApps?: string[],
    courierOptions?: {
      fleetType?: 'PLATFORM_FLEET' | 'STORE_FLEET';
      allowedFleetModes?: ('PLATFORM_FLEET' | 'STORE_FLEET')[];
      vehicle?: 'SCOOTER' | 'BIKE' | 'CAR';
      vehiclePlate?: string;
    }
  ) => {
    try {
      if (adapter.type !== 'SERVER_CORE_REST') {
        showNotification('Operação bloqueada: criação de contas exige Server Core (Pilar 4) ativo.');
        return;
      }
      if (!password || password.length < 8) {
        showNotification('Defina uma senha inicial de no mínimo 8 caracteres.');
        return;
      }
      const token = await getIdToken();
      let uid = generateUserId();
      const scopedStoreId =
        STORE_SCOPED_ROLES.has(role) || (role === 'COURIER' && Boolean(storeId))
          ? storeId
          : undefined;
      const linkedStore = scopedStoreId ? stores.find((s) => s.id === scopedStoreId) : undefined;
      const courierPayload =
        role === 'COURIER' && courierOptions
          ? {
              ...(courierOptions.fleetType ? { fleetType: courierOptions.fleetType } : {}),
              ...(courierOptions.allowedFleetModes
                ? { allowedFleetModes: courierOptions.allowedFleetModes }
                : {}),
              ...(courierOptions.vehicle ? { vehicle: courierOptions.vehicle } : {}),
              ...(courierOptions.vehiclePlate ? { vehiclePlate: courierOptions.vehiclePlate } : {}),
            }
          : {};
      const res = isHqRole
        ? await apiClient.createHqUser(
            {
              name,
              email,
              password,
              role,
              ...(scopedStoreId ? { storeId: scopedStoreId } : {}),
              ...(role !== 'CUSTOMER' && linkedStore?.tenantId ? { tenantId: linkedStore.tenantId } : {}),
              ...(phone?.trim() ? { phone: phone.trim() } : {}),
              ...(Array.isArray(blockedApps) && blockedApps.length > 0 ? { blockedApps } : {}),
              ...courierPayload,
            },
            token
          )
        : await apiClient.createStoreStaff(
            {
              name,
              email,
              password,
              role,
              ...(scopedStoreId ? { storeId: scopedStoreId } : {}),
              ...(phone?.trim() ? { phone: phone.trim() } : {}),
              ...(Array.isArray(blockedApps) && blockedApps.length > 0 ? { blockedApps } : {}),
            },
            token
          );
      if (res?.uid) uid = res.uid;
      if (res?.user) {
        setUsers((prev) => [res.user, ...prev.filter((u) => (u.uid || u.id) !== uid)]);
      } else {
        await refreshManagedUsers();
      }
      if (role === 'COURIER') {
        emitDriversRefreshHint();
      }
      showNotification(`Conta criada para ${name} (${role}) com sucesso!`);
      logSystemEvent(
        isHqRole ? 'USER_CREATED_BY_HQ' : 'STAFF_CREATED_BY_STORE',
        `Conta criada: ${email} como ${role}`,
        isHqRole ? 'hq/security' : 'store/staff'
      );
    } catch (e: any) {
      console.warn('Notice in createUserAccount:', e);
      showNotification(e?.message || 'Erro ao criar conta no sistema.');
    }
  };

  const deleteUserAccount = async (uid: string) => {
    if (profile?.uid && uid === profile.uid) {
      showNotification('Operação bloqueada: Você não pode excluir a própria conta em uso.');
      return;
    }
    try {
      if (adapter.type !== 'SERVER_CORE_REST') {
        showNotification('Operação bloqueada: exclusão de contas exige Server Core (Pilar 4) ativo.');
        return;
      }
      const token = await getIdToken();
      if (isHqRole) {
        await apiClient.deleteHqUser(uid, token);
      } else {
        await apiClient.deleteStoreStaff(uid, token);
      }
      setUsers((prev) => prev.filter((u) => (u.uid || u.id) !== uid));
      emitDriversRefreshHint();
      showNotification('Conta removida com sucesso.');
      logSystemEvent(
        isHqRole ? 'USER_DELETED_BY_HQ' : 'STAFF_DELETED_BY_STORE',
        `Removeu conta: ${uid}`,
        isHqRole ? 'hq/security' : 'store/staff'
      );
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao deletar conta.');
    }
  };

  const revokeUserSessions = async (uid: string) => {
    try {
      if (adapter.type !== 'SERVER_CORE_REST') {
        showNotification('Revogação bloqueada: requer Server Core (Pilar 4) ativo.');
        return;
      }
      const token = await getIdToken();
      const res = isHqRole
        ? await apiClient.revokeHqUserSessions(uid, token)
        : await apiClient.revokeStoreStaffSessions(uid, token);
      if (res?.tokenVersion) {
        setUsers((prev) =>
          prev.map((u) => ((u.uid || u.id) === uid ? { ...u, tokenVersion: res.tokenVersion } : u))
        );
      }
      showNotification('Sessões do usuário revogadas no cluster!');
      logSystemEvent(
        'USER_SESSION_REVOKED',
        `Sessões revogadas para ${uid}`,
        isHqRole ? 'hq/security' : 'store/staff'
      );
    } catch (e: any) {
      showNotification(e?.message || 'Falha ao revogar sessões.');
    }
  };

  const resetUserPassword = async (uid: string, newPassword?: string): Promise<string | null> => {
    try {
      if (adapter.type !== 'SERVER_CORE_REST') {
        showNotification('Redefinição bloqueada: requer Server Core (Pilar 4) ativo.');
        return null;
      }
      const token = await getIdToken();
      const payload = newPassword?.trim() ? { newPassword: newPassword.trim() } : {};
      const res = isHqRole
        ? await apiClient.resetHqUserPassword(uid, payload, token)
        : await apiClient.resetStoreStaffPassword(uid, payload, token);
      setUsers((prev) =>
        prev.map((u) =>
          (u.uid || u.id) === uid
            ? { ...u, mustChangePassword: true, tokenVersion: res.tokenVersion }
            : u
        )
      );
      showNotification('Senha temporária gerada e sessões do usuário revogadas!');
      logSystemEvent(
        'USER_PASSWORD_RESET',
        `Senha redefinida para ${uid}`,
        isHqRole ? 'hq/security' : 'store/staff'
      );
      return res.temporaryPassword;
    } catch (e: any) {
      showNotification(e?.message || 'Falha ao redefinir senha do usuário.');
      return null;
    }
  };

  return {
    toggleUserStatus,
    createUserAccount,
    deleteUserAccount,
    revokeUserSessions,
    resetUserPassword,
  };
};
