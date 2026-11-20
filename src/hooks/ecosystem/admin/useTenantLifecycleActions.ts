import React from 'react';
import { StorageAdapter } from '../../../services/databaseAdapter';
import { PlatformGovernance, Store } from '../../../types';
import {
  getDefaultEnabledModulesForCategory,
  getStoreMaxBranches,
  getStoreMaxDevices,
  getTenantStores,
} from '../../../utils/storeDomain';
import { apiClient } from '../../../core/api/apiClient';
import { generateStoreId } from '../../../utils/idGenerator';

interface UseTenantLifecycleActionsParams {
  adapter: StorageAdapter;
  isHqRole: boolean;
  governance: PlatformGovernance;
  stores: Store[];
  setStores: React.Dispatch<React.SetStateAction<Store[]>>;
  getIdToken: () => Promise<string | undefined>;
  showNotification: (msg: string) => void;
  logSystemEvent: (
    type: string,
    payload: string,
    channel: string,
    tenantId?: string
  ) => Promise<void>;
}

export function useTenantLifecycleActions({
  adapter,
  isHqRole,
  governance,
  stores,
  setStores,
  getIdToken,
  showNotification,
  logSystemEvent,
}: UseTenantLifecycleActionsParams) {
  const createBranchStore = async (
    parentStore: Store,
    branchData: {
      name: string;
      branchLabel?: string;
      address: string;
      phone: string;
      category?: Store['category'];
    }
  ): Promise<string | null> => {
    try {
      const maxBranches = getStoreMaxBranches(parentStore, governance);
      const maxDevices = getStoreMaxDevices(parentStore, governance);
      const existingBranches = getTenantStores(stores, parentStore);

      if (existingBranches.length >= maxBranches) {
        showNotification(
          `Limite de filiais do plano ${parentStore.subscriptionPlan} atingido (${existingBranches.length}/${maxBranches}). Faça upgrade para adicionar mais filiais.`
        );
        return null;
      }

      const rootId = parentStore.parentStoreId || parentStore.id;
      const slugBase = branchData.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const id = generateStoreId();
      const category = branchData.category || parentStore.category;

      const newBranch: Store = {
        ...parentStore,
        id,
        name: branchData.name.trim(),
        slug: `${slugBase || 'filial'}-${String(Date.now()).slice(-4)}`,
        category,
        parentStoreId: rootId,
        branchLabel:
          branchData.branchLabel?.trim() ||
          `Filial ${String(existingBranches.length + 1).padStart(2, '0')}`,
        address: branchData.address.trim() || parentStore.address,
        phone: branchData.phone.trim() || parentStore.phone,
        totalOrders: 0,
        monthlyRevenue: 0,
        maxAllowedDevices: maxDevices,
        maxAllowedBranches: maxBranches,
        isOpen: false,
        isDemo: false,
        enabledModules: getDefaultEnabledModulesForCategory(
          category,
          parentStore.operationalSettings?.darkKitchenMode
        ),
      };

      await adapter.saveStore(newBranch);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('3c:auth-refresh'));
      }
      if (adapter.type === 'SERVER_CORE_REST') {
        const freshStores = await adapter.getStores().catch(() => null);
        if (Array.isArray(freshStores)) {
          setStores(freshStores);
        } else {
          setStores((prev) => [...prev, newBranch]);
        }
      } else {
        setStores((prev) => [...prev, newBranch]);
      }
      showNotification(`Filial "${newBranch.name}" criada com sucesso!`);
      void logSystemEvent(
        'BRANCH_CREATED',
        `Nova filial ${newBranch.name} vinculada à matriz ${parentStore.name}.`,
        'store/branches',
        parentStore.tenantId
      );
      return id;
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao criar nova filial.');
      return null;
    }
  };

  const toggleStoreBillingStatus = async (
    storeId: string,
    status: 'PAID' | 'PENDING' | 'OVERDUE'
  ) => {
    try {
      if (adapter.type === 'SERVER_CORE_REST' && isHqRole) {
        const token = await getIdToken();
        const res = await apiClient.updateHqStoreBillingStatus(storeId, status, token);
        if (res?.store) {
          setStores((prev) => prev.map((s) => (s.id === storeId ? { ...s, ...res.store } : s)));
        } else {
          setStores((prev) =>
            prev.map((s) => (s.id === storeId ? { ...s, saasPaymentStatus: status } : s))
          );
        }
      } else {
        await adapter.updateStore(storeId, { saasPaymentStatus: status });
        setStores((prev) =>
          prev.map((s) => (s.id === storeId ? { ...s, saasPaymentStatus: status } : s))
        );
      }
      showNotification(`Status de pagamento alterado para ${status}`);
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao atualizar status de pagamento.');
    }
  };

  const suspendTenant = async (tenantId: string) => {
    try {
      if (adapter.type !== 'SERVER_CORE_REST') {
        showNotification('Suspensão bloqueada: requer Server Core (Pilar 4) ativo.');
        return;
      }
      const token = await getIdToken();
      await apiClient.suspendHqTenant(tenantId, token);
      setStores((prev) =>
        prev.map((s) =>
          s.tenantId === tenantId ? { ...s, tenantStatus: 'SUSPENDED', isOpen: false } : s
        )
      );
      showNotification(`Empresa ${tenantId} suspensa pelo HQ Central.`);
      void logSystemEvent('TENANT_SUSPENDED', `Tenant ${tenantId} suspenso`, 'hq/governance', tenantId);
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao suspender empresa.');
    }
  };

  const activateTenant = async (tenantId: string) => {
    try {
      if (adapter.type !== 'SERVER_CORE_REST') {
        showNotification('Reativação bloqueada: requer Server Core (Pilar 4) ativo.');
        return;
      }
      const token = await getIdToken();
      await apiClient.activateHqTenant(tenantId, token);
      setStores((prev) =>
        prev.map((s) => (s.tenantId === tenantId ? { ...s, tenantStatus: 'ACTIVE' } : s))
      );
      showNotification(`Empresa ${tenantId} reativada.`);
      void logSystemEvent('TENANT_ACTIVATED', `Tenant ${tenantId} ativado`, 'hq/governance', tenantId);
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao ativar empresa.');
    }
  };

  const triggerBillingReconciliation = async () => {
    try {
      if (adapter.type !== 'SERVER_CORE_REST') {
        showNotification('Reconciliação de faturas requer Server Core (Pilar 4) ativo.');
        return;
      }
      showNotification('Iniciando reconciliação de faturas SaaS...');
      const token = await getIdToken();
      const res = await apiClient.reconcileHqBilling(token);
      if (Array.isArray(res?.stores)) {
        setStores(res.stores);
      }
      showNotification(
        `Reconciliação concluída: ${res?.checkedStores ?? stores.length} lojas verificadas, ${
          res?.reconciledCount ?? 0
        } atualizada(s), ${res?.overdueCount ?? 0} vencida(s).`
      );
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao reconciliar faturas SaaS.');
    }
  };

  return {
    createBranchStore,
    toggleStoreBillingStatus,
    suspendTenant,
    activateTenant,
    triggerBillingReconciliation,
  };
}
