import React from 'react';
import { StorageAdapter } from '../../../services/databaseAdapter';
import {
  PlatformGovernance,
  Store,
  SubscriptionPlanTier,
  BillingCycle,
} from '../../../types';
import { apiClient } from '../../../core/api/apiClient';
import { generateStoreId } from '../../../utils/idGenerator';
import { computePlanQuotasAndMonthlyFee } from './subscriptionQuotaCalculator';
import { useTenantLifecycleActions } from './useTenantLifecycleActions';

interface UseAdminSubscriptionsParams {
  adapter: StorageAdapter;
  isHqRole: boolean;
  profile: any;
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

export const useAdminSubscriptions = ({
  adapter,
  isHqRole,
  profile,
  governance,
  stores,
  setStores,
  getIdToken,
  showNotification,
  logSystemEvent,
}: UseAdminSubscriptionsParams) => {
  const lifecycleActions = useTenantLifecycleActions({
    adapter,
    isHqRole,
    governance,
    stores,
    setStores,
    getIdToken,
    showNotification,
    logSystemEvent,
  });

  const addStore = async (storeData: Omit<Store, 'id'>): Promise<string> => {
    try {
      if (adapter.type === 'SERVER_CORE_REST' && isHqRole) {
        const token = await getIdToken();
        const res = await apiClient.createHqStore(storeData, token);
        const createdStore = res?.store as Store | undefined;
        if (createdStore?.id) {
          setStores((prev) => [...prev, createdStore]);
          showNotification(
            `Loja ${createdStore.name} cadastrada no ecossistema (tenant ${createdStore.tenantId})!`
          );
          void logSystemEvent(
            'STORE_CREATED',
            `Nova loja ${createdStore.name} criada pelo HQ.`,
            'hq/governance',
            createdStore.tenantId
          );
          return createdStore.id;
        }
      }

      const id = generateStoreId();
      const isolatedTenantId =
        storeData.tenantId ||
        `tenant-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const plan = storeData.subscriptionPlan || 'BASIC';
      const cycle = storeData.billingCycle || 'MONTHLY';
      const { monthlyFee } = computePlanQuotasAndMonthlyFee({
        plan,
        cycle,
        governance,
        monthlyFeeOverride: storeData.saasMonthlyFee,
        applyCycleDiscountFallback: false,
      });

      const newStore: Store = {
        id,
        ...storeData,
        tenantId: isolatedTenantId,
        commissionRate: 0,
        saasMonthlyFee: monthlyFee,
        totalOrders: 0,
        monthlyRevenue: 0,
        isOpen: false,
      };
      await adapter.saveStore(newStore);
      setStores((prev) => [...prev, newStore]);
      showNotification(`Loja ${storeData.name} cadastrada no ecossistema (tenant ${isolatedTenantId})!`);
      void logSystemEvent(
        'STORE_CREATED',
        `Nova loja ${storeData.name} criada pelo HQ.`,
        'hq/governance',
        isolatedTenantId
      );
      return id;
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao criar loja.');
      return '';
    }
  };

  const updateStoreSubscription = async (
    storeId: string,
    plan: SubscriptionPlanTier,
    billingCycle?: BillingCycle,
    maxBranchesOverride?: number,
    trialExpiresAt?: string,
    couponCode?: string,
    customOverrides?: {
      maxAllowedDevices?: number;
      saasMonthlyFee?: number;
      commissionRate?: number;
      enabledModules?: string[];
      saasPaymentStatus?: 'TRIAL' | 'PENDING' | 'PAID' | 'OVERDUE';
      paymentMethod?: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BOLETO' | 'BANK_TRANSFER' | 'PAYMENT_LINK';
    }
  ) => {
    try {
      const store = stores.find((s) => s.id === storeId);
      if (!store) return;

      const newCycle = billingCycle || store.billingCycle || 'MONTHLY';
      const isPlatformAdmin = profile?.role === 'DEV_OWNER' || profile?.role === 'SUPER_ADMIN';

      const { branchesQuota, devicesQuota, monthlyFee } = computePlanQuotasAndMonthlyFee({
        plan,
        cycle: newCycle,
        governance,
        maxBranchesOverride,
        maxDevicesOverride: customOverrides?.maxAllowedDevices,
        monthlyFeeOverride: customOverrides?.saasMonthlyFee,
      });

      if (adapter.type === 'SERVER_CORE_REST') {
        const token = await getIdToken();
        if (!token) {
          showNotification('Sessão expirada. Faça login novamente.');
          return;
        }

        if (isPlatformAdmin) {
          const res = await apiClient.updateHqStoreSubscription(
            storeId,
            {
              subscriptionPlan: plan,
              billingCycle: newCycle,
              maxAllowedBranches: branchesQuota,
              maxAllowedDevices: devicesQuota,
              saasMonthlyFee: monthlyFee,
              ...(customOverrides?.saasPaymentStatus
                ? { saasPaymentStatus: customOverrides.saasPaymentStatus }
                : {}),
              ...(typeof customOverrides?.commissionRate === 'number'
                ? { commissionRate: customOverrides.commissionRate }
                : {}),
              ...(Array.isArray(customOverrides?.enabledModules)
                ? { enabledModules: customOverrides.enabledModules }
                : {}),
              ...(plan === 'FREE'
                ? {
                    trialExpiresAt:
                      trialExpiresAt ||
                      (store.trialExpiresAt ??
                        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()),
                  }
                : { trialExpiresAt: null }),
            },
            token
          );
          if (res?.store) {
            setStores((prev) => prev.map((s) => (s.id === storeId ? { ...s, ...res.store } : s)));
          } else {
            const freshStores = await adapter.getStores().catch(() => null);
            if (Array.isArray(freshStores)) setStores(freshStores);
          }
          showNotification(`Licença e customizações da loja ${store.name} atualizadas (${plan}) pelo HQ!`);
          void logSystemEvent(
            'STORE_SUBSCRIPTION_UPDATE',
            `HQ alterou loja ${store.name} para plano ${plan} (${branchesQuota} filiais, ${devicesQuota} terminais, R$ ${monthlyFee.toFixed(2)}).`,
            'hq/billing',
            store.tenantId
          );
          return;
        }

        const reqRes = await apiClient.requestStoreSubscriptionUpgrade(
          storeId,
          {
            requestedPlan: plan,
            billingCycle: newCycle,
            paymentMethod: customOverrides?.paymentMethod || store.saasPaymentMethod || 'PIX',
            ...(couponCode?.trim() ? { couponCode: couponCode.trim().toUpperCase() } : {}),
          },
          token
        );
        if (reqRes?.pendingUpgradeRequest) {
          setStores((prev) =>
            prev.map((s) =>
              s.id === storeId ? { ...s, pendingUpgradeRequest: reqRes.pendingUpgradeRequest } : s
            )
          );
        }
        showNotification(
          `Solicitação de upgrade para ${plan} registrada${
            reqRes?.pendingUpgradeRequest?.couponCode
              ? ` (cupom ${reqRes.pendingUpgradeRequest.couponCode} aplicado)`
              : ''
          } — aguardando compensação/aprovação do HQ.`
        );
        void logSystemEvent(
          'STORE_SUBSCRIPTION_REQUEST',
          `Loja ${store.name} solicitou upgrade para ${plan} (${newCycle})${
            reqRes?.pendingUpgradeRequest?.couponCode
              ? ` com cupom ${reqRes.pendingUpgradeRequest.couponCode}`
              : ''
          }.`,
          'store/billing',
          store.tenantId
        );
        return;
      }

      const updateData: any = {
        subscriptionPlan: plan,
        billingCycle: newCycle,
        maxAllowedDevices: devicesQuota,
        maxAllowedBranches: branchesQuota,
        saasMonthlyFee: monthlyFee,
        saasPaymentStatus: customOverrides?.saasPaymentStatus || (plan === 'FREE' ? 'TRIAL' : 'PENDING'),
        ...(typeof customOverrides?.commissionRate === 'number'
          ? { commissionRate: customOverrides.commissionRate }
          : {}),
        ...(Array.isArray(customOverrides?.enabledModules)
          ? { enabledModules: customOverrides.enabledModules }
          : {}),
        trialExpiresAt:
          plan === 'FREE'
            ? trialExpiresAt ||
              (store.trialExpiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
            : null,
      };

      await adapter.updateStore(storeId, updateData);
      setStores((prev) => prev.map((s) => (s.id === storeId ? { ...s, ...updateData } : s)));
      showNotification(
        `Plano da loja ${store.name} atualizado (${devicesQuota} terminal(is), ${branchesQuota} filial(is))!`
      );
      void logSystemEvent(
        'STORE_SUBSCRIPTION_UPDATE',
        `Loja ${store.name} migrada para plano ${plan} (${branchesQuota} filiais, ${devicesQuota} dispositivos)`,
        'hq/billing',
        store.tenantId
      );
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao atualizar assinatura.');
    }
  };

  return {
    addStore,
    updateStoreSubscription,
    ...lifecycleActions,
  };
};
