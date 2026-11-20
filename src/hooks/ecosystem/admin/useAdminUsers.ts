import React from 'react';
import { StorageAdapter } from '../../../services/databaseAdapter';
import { EcosystemSessionRole, Store } from '../../../types';
import { apiClient } from '../../../core/api/apiClient';
import { useUserLifecycleAndCredentials } from './useUserLifecycleAndCredentials';

const STORE_SCOPED_ROLES = new Set([
  'REGIONAL_MANAGER',
  'STORE_OWNER',
  'STORE_MANAGER',
  'CASHIER',
  'KITCHEN_STAFF',
  'WAITER',
]);

interface UseAdminUsersParams {
  adapter: StorageAdapter;
  isHqRole: boolean;
  profile: any;
  stores: Store[];
  setUsers: React.Dispatch<React.SetStateAction<any[]>>;
  getIdToken: () => Promise<string | undefined>;
  showNotification: (msg: string) => void;
  logSystemEvent: (
    type: string,
    payload: string,
    channel: string,
    tenantId?: string
  ) => Promise<void>;
}

export const useAdminUsers = ({
  adapter,
  isHqRole,
  profile,
  stores,
  setUsers,
  getIdToken,
  showNotification,
  logSystemEvent,
}: UseAdminUsersParams) => {
  const refreshManagedUsers = async () => {
    const freshUsers = await adapter.queryDocuments<any>(isHqRole ? 'users' : 'store_staff');
    if (Array.isArray(freshUsers)) setUsers(freshUsers);
  };

  const emitDriversRefreshHint = () => {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('3c:collection-hint', { detail: { collections: ['drivers'] } }));
    }
  };

  const updateUserRole = async (
    uid: string,
    role: EcosystemSessionRole,
    tenantId?: string,
    storeId?: string | null
  ) => {
    try {
      if (adapter.type !== 'SERVER_CORE_REST') {
        showNotification('Operação bloqueada: alteração de privilégios exige Server Core (Pilar 4) ativo.');
        return;
      }
      const token = await getIdToken();
      const normalizedRole = String(role) === 'DRIVER' ? ('COURIER' as EcosystemSessionRole) : role;
      const keepStoreId =
        STORE_SCOPED_ROLES.has(normalizedRole) || (normalizedRole === 'COURIER' && Boolean(storeId));
      const normalizedStoreId = keepStoreId ? (storeId ?? null) : null;
      const res = isHqRole
        ? await apiClient.updateHqUser(
            uid,
            {
              role: normalizedRole,
              ...(normalizedRole !== 'CUSTOMER' && tenantId ? { tenantId } : {}),
              storeId: normalizedStoreId,
            },
            token
          )
        : await apiClient.updateStoreStaff(
            uid,
            {
              role: normalizedRole,
              ...(normalizedStoreId ? { storeId: normalizedStoreId } : {}),
            },
            token
          );
      if (res?.user) {
        setUsers((prev) => prev.map((u) => ((u.uid || u.id) === uid ? { ...u, ...res.user } : u)));
      } else {
        await refreshManagedUsers();
      }
      emitDriversRefreshHint();
      showNotification('Privilégios do usuário atualizados!');
      logSystemEvent(
        'USER_ROLE_UPDATE',
        `Usuário ${uid} alterado para ${normalizedRole}`,
        isHqRole ? 'hq/security' : 'store/staff'
      );
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao atualizar privilégios.');
    }
  };

  const updateCourierGovernance = async (
    uid: string,
    updates: {
      fleetType?: 'PLATFORM_FLEET' | 'STORE_FLEET';
      allowedFleetModes?: ('PLATFORM_FLEET' | 'STORE_FLEET')[];
      storeId?: string | null;
      vehicle?: 'SCOOTER' | 'BIKE' | 'CAR';
      vehiclePlate?: string;
    }
  ) => {
    try {
      if (adapter.type !== 'SERVER_CORE_REST' || !isHqRole) {
        showNotification('Governança de frota de entregadores exige HQ Central ativo no Server Core.');
        return;
      }
      const token = await getIdToken();
      const res = await apiClient.updateHqUser(uid, updates, token);
      if (res?.user) {
        setUsers((prev) => prev.map((u) => ((u.uid || u.id) === uid ? { ...u, ...res.user } : u)));
      } else {
        await refreshManagedUsers();
      }
      emitDriversRefreshHint();
      showNotification('Modalidade de frota do entregador atualizada pelo HQ!');
      logSystemEvent(
        'COURIER_GOVERNANCE_UPDATED',
        `Entregador ${uid} atualizado (${updates.fleetType || 'MODO'})`,
        'hq/logistics'
      );
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao atualizar modalidade do entregador.');
    }
  };

  const updateUserBlockedApps = async (uid: string, blockedApps: string[]) => {
    try {
      if (adapter.type !== 'SERVER_CORE_REST') {
        setUsers((prev) => prev.map((u) => ((u.uid || u.id) === uid ? { ...u, blockedApps } : u)));
        showNotification('Bloqueio de módulos atualizado localmente.');
        return;
      }
      const token = await getIdToken();
      const res = isHqRole
        ? await apiClient.updateHqUser(uid, { blockedApps }, token)
        : await apiClient.updateStoreStaff(uid, { blockedApps }, token);
      if (res?.user) {
        setUsers((prev) => prev.map((u) => ((u.uid || u.id) === uid ? { ...u, ...res.user } : u)));
      } else {
        await refreshManagedUsers();
      }
      showNotification('Permissões de acesso aos módulos atualizadas!');
      logSystemEvent(
        'USER_BLOCKED_APPS_UPDATED',
        `Bloqueios de apps atualizados para ${uid} (${blockedApps.length} módulo(s))`,
        isHqRole ? 'hq/security' : 'store/staff'
      );
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao atualizar bloqueio de módulos.');
    }
  };

  const updateUserAccountDetails = async (
    uid: string,
    updates: {
      name?: string;
      phone?: string;
      storeId?: string | null;
      tenantId?: string;
      allowedStoreIds?: string[];
      blockedApps?: string[];
      role?: EcosystemSessionRole;
    }
  ) => {
    try {
      if (adapter.type !== 'SERVER_CORE_REST') {
        setUsers((prev) => prev.map((u) => ((u.uid || u.id) === uid ? { ...u, ...updates } : u)));
        showNotification('Dados e customizações da conta atualizados localmente.');
        return;
      }
      const token = await getIdToken();
      const linkedStore = updates.storeId ? stores.find((s) => s.id === updates.storeId) : undefined;
      const payload: any = {
        ...updates,
        ...(linkedStore?.tenantId && !updates.tenantId ? { tenantId: linkedStore.tenantId } : {}),
      };
      const res = isHqRole
        ? await apiClient.updateHqUser(uid, payload, token)
        : await apiClient.updateStoreStaff(uid, payload, token);
      if (res?.user) {
        setUsers((prev) => prev.map((u) => ((u.uid || u.id) === uid ? { ...u, ...res.user } : u)));
      } else {
        await refreshManagedUsers();
      }
      emitDriversRefreshHint();
      showNotification('Conta e escopo de permissões customizados pelo HQ!');
      logSystemEvent(
        'USER_ACCOUNT_CUSTOMIZED',
        `Conta ${uid} customizada (${Object.keys(updates).join(', ')})`,
        isHqRole ? 'hq/security' : 'store/staff'
      );
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao customizar conta.');
    }
  };

  const lifecycleActions = useUserLifecycleAndCredentials({
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
  });

  return {
    updateUserRole,
    updateCourierGovernance,
    updateUserBlockedApps,
    updateUserAccountDetails,
    ...lifecycleActions,
  };
};
