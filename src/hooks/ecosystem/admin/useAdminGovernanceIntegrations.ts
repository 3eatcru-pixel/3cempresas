import React from 'react';
import { StorageAdapter } from '../../../services/databaseAdapter';
import {
  PlatformGovernance,
  SubscriptionPlanTier,
  SystemIntegration,
  CouponCampaign,
} from '../../../types';
import {
  seedDatabaseToLocalCore as runSeedDatabase,
  resetEntirePlatformData as runResetEntirePlatform,
} from '../../../services/adminSeedService';
import { apiClient } from '../../../core/api/apiClient';
import { generateCouponId, generateIntegrationId } from '../../../utils/idGenerator';

interface UseAdminGovernanceIntegrationsParams {
  adapter: StorageAdapter;
  governance: PlatformGovernance;
  setGovernance: React.Dispatch<React.SetStateAction<PlatformGovernance>>;
  integrations: SystemIntegration[];
  setIntegrations: React.Dispatch<React.SetStateAction<SystemIntegration[]>>;
  coupons: CouponCampaign[];
  setCoupons: React.Dispatch<React.SetStateAction<CouponCampaign[]>>;
  setOrders: React.Dispatch<React.SetStateAction<any[]>>;
  setCart: React.Dispatch<React.SetStateAction<any[]>>;
  setCustomersCrm: React.Dispatch<React.SetStateAction<any[]>>;
  setFinancialRecords: React.Dispatch<React.SetStateAction<any[]>>;
  setCashSession: React.Dispatch<React.SetStateAction<any>>;
  syncHqData: () => Promise<void>;
  getIdToken: () => Promise<string | undefined>;
  showNotification: (msg: string) => void;
  logSystemEvent: (
    type: string,
    payload: string,
    channel: string,
    tenantId?: string
  ) => Promise<void>;
}

export const useAdminGovernanceIntegrations = ({
  adapter,
  governance,
  setGovernance,
  integrations,
  setIntegrations,
  coupons,
  setCoupons,
  setOrders,
  setCart,
  setCustomersCrm,
  setFinancialRecords,
  setCashSession,
  syncHqData,
  getIdToken,
  showNotification,
  logSystemEvent,
}: UseAdminGovernanceIntegrationsParams) => {
  const testIntegration = async (id: string) => {
    try {
      if (adapter.type !== 'SERVER_CORE_REST') {
        showNotification('Teste de integração requer Server Core (Pilar 4) ativo.');
        return;
      }
      const token = await getIdToken();
      const res = await apiClient.testHqIntegration(id, token);
      if (res?.status) {
        setIntegrations(prev =>
          prev.map(i =>
            i.id === id
              ? {
                  ...i,
                  status: res.status as any,
                  diagnosticMessage: res.diagnosticMessage,
                  lastSync: res.lastSync,
                  latencyMs: res.latencyMs,
                  lastHttpStatus: res.lastHttpStatus,
                  probeHistory: res.probeHistory,
                }
              : i
          )
        );
        showNotification(`Diagnóstico [${res.status}]: ${res.diagnosticMessage}`);
      }
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao testar integração.');
    }
  };

  const dispatchIntegrationWebhookTest = async (
    id: string,
    eventType: 'PING' | 'ORDER_COMMITTED' | 'PAYMENT_CONFIRMED' = 'PING'
  ) => {
    try {
      if (adapter.type !== 'SERVER_CORE_REST') {
        showNotification('Disparo de webhook assinado requer Server Core ativo.');
        return null;
      }
      const token = await getIdToken();
      const res = await apiClient.testHqIntegrationWebhook(id, { eventType }, token);
      setIntegrations(prev =>
        prev.map(i =>
          i.id === id
            ? {
                ...i,
                diagnosticMessage: res.diagnosticMessage,
                lastSync: res.lastSync,
                latencyMs: res.latencyMs,
                lastHttpStatus: res.httpStatus,
                probeHistory: res.probeHistory,
              }
            : i
        )
      );
      showNotification(
        `${res.diagnosticMessage} (Assinatura ${res.signaturePreview})`
      );
      return res;
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao disparar webhook assinado.');
      return null;
    }
  };

  const suspendIntegration = async (id: string) => {
    try {
      if (adapter.type !== 'SERVER_CORE_REST') {
        showNotification('Suspensão de integração requer Server Core (Pilar 4) ativo.');
        return;
      }
      const token = await getIdToken();
      const res = await apiClient.suspendHqIntegration(id, token);
      if (res?.status) {
        setIntegrations(prev => prev.map(i => (i.id === id ? { ...i, status: res.status as any } : i)));
        showNotification(`Status alterado para ${res.status}`);
      }
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao alterar status da integração.');
    }
  };

  const toggleFeatureFlag = async (flagKey: keyof PlatformGovernance['featureFlags']) => {
    try {
      const newFlags = {
        ...governance.featureFlags,
        [flagKey]: !governance.featureFlags[flagKey],
      };
      await adapter.saveGovernance({ featureFlags: newFlags });
      setGovernance(prev => ({ ...prev, featureFlags: newFlags }));
      if (
        (flagKey === 'firebaseEnabled' ||
          flagKey === 'firebaseAuthEnabled' ||
          flagKey === 'firebaseFirestoreEnabled') &&
        typeof window !== 'undefined'
      ) {
        window.dispatchEvent(new CustomEvent('3c:auth-providers-changed'));
      }
      showNotification(
        flagKey === 'firebaseEnabled'
          ? `Firebase ${newFlags.firebaseEnabled ? 'ATIVADO' : 'DESATIVADO'} em todo o ecossistema!`
          : flagKey === 'firebaseAuthEnabled'
          ? `Firebase Authentication (Google OAuth) ${newFlags.firebaseAuthEnabled ? 'ATIVADO' : 'DESATIVADO'}!`
          : flagKey === 'firebaseFirestoreEnabled'
          ? `Firestore Cores (/users, /cloud_preferences & /admins) ${newFlags.firebaseFirestoreEnabled ? 'ATIVADO' : 'DESATIVADO'}!`
          : `Feature Flag "${flagKey}" atualizada!`
      );
      logSystemEvent('HQ_FEATURE_TOGGLE', `Feature flag ${flagKey} alterada.`, 'hq/governance');
    } catch {
      showNotification('Erro ao atualizar Feature Flag.');
    }
  };

  const updatePlanPricing = async (tier: SubscriptionPlanTier, pricing: any) => {
    try {
      const newPlanPricing = {
        ...governance.planPricing,
        [tier]: pricing,
      };
      await adapter.saveGovernance({ planPricing: newPlanPricing });
      setGovernance(prev => ({ ...prev, planPricing: newPlanPricing }));
      showNotification(`Preços do plano ${tier} atualizados!`);
    } catch {
      showNotification(`Erro ao atualizar preços.`);
    }
  };

  const updateGovernanceSettings = async (updates: Partial<PlatformGovernance>) => {
    try {
      await adapter.saveGovernance(updates);
      setGovernance(prev => ({ ...prev, ...updates }));
      showNotification('Customizações de governança do ecossistema salvas!');
      logSystemEvent(
        'HQ_GOVERNANCE_CUSTOMIZATION',
        `Parâmetros globais do ecossistema atualizados (${Object.keys(updates).join(', ')}).`,
        'hq/governance'
      );
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao salvar customizações de governança.');
    }
  };

  const addCoupon = async (coupon: Omit<CouponCampaign, 'id'>) => {
    try {
      const id = generateCouponId();
      const created: CouponCampaign = {
        ...coupon,
        audience: coupon.audience || (coupon.storeId ? 'CONSUMER' : 'CONSUMER'),
        id,
      };
      await adapter.saveCoupon(created);
      setCoupons(prev => [...prev, created]);
      showNotification(
        created.audience === 'MERCHANT'
          ? `Cupom SaaS p/ Lojistas "${created.code}" ativado!`
          : `Cupom p/ Consumidores "${created.code}" ativado!`
      );
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao criar cupom.');
    }
  };

  const toggleCouponStatus = async (id: string, nextActive: boolean) => {
    try {
      if (adapter.type === 'SERVER_CORE_REST') {
        const token = await getIdToken();
        await apiClient.updateCoupon(id, { isActive: nextActive }, token);
      } else {
        const current = coupons.find(c => c.id === id);
        if (current) await adapter.saveCoupon({ ...current, isActive: nextActive });
      }
      setCoupons(prev => prev.map(c => (c.id === id ? { ...c, isActive: nextActive } : c)));
      showNotification(`Cupom ${nextActive ? 'reativado' : 'pausado'}.`);
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao alterar status do cupom.');
    }
  };

  const deleteCoupon = async (id: string) => {
    try {
      if (adapter.type === 'SERVER_CORE_REST') {
        const token = await getIdToken();
        await apiClient.deleteCoupon(id, token);
      } else {
        await adapter.deleteDocument('coupons', id);
      }
      setCoupons(prev => prev.filter(c => c.id !== id));
      showNotification('Cupom removido com sucesso.');
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao remover cupom.');
    }
  };

  const seedDatabaseToLocalCore = () => runSeedDatabase(showNotification);

  const resetEntirePlatformData = async () => {
    const token = await getIdToken();
    await runResetEntirePlatform(
      showNotification,
      setOrders,
      setCart,
      setCustomersCrm,
      setFinancialRecords,
      setCashSession,
      token
    );
    await syncHqData();
  };

  const addIntegration = async (integ: Omit<SystemIntegration, 'id'> & { apiKey?: string }) => {
    try {
      const id = generateIntegrationId();
      const created = { ...integ, id };
      const res = await adapter.saveIntegration(created);
      const { apiKey: _omitted, ...localFallback } = created as any;
      const savedIntegration: SystemIntegration = res?.integration || {
        ...localFallback,
        apiKeyMasked: integ.apiKey
          ? `${integ.apiKey.slice(0, 4)}••••••••`
          : integ.apiKeyMasked || 'NÃO CONFIGURADO',
      };
      setIntegrations(prev => [...prev, savedIntegration]);
      showNotification(`Integração ${savedIntegration.name} registrada!`);
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao registrar integração.');
    }
  };

  const updateIntegration = async (id: string, updates: Partial<SystemIntegration>) => {
    try {
      const current = integrations.find(i => i.id === id);
      if (current) {
        const updated = { ...current, ...updates };
        await adapter.saveIntegration(updated);
        setIntegrations(prev => prev.map(i => (i.id === id ? updated : i)));
        showNotification('Integração atualizada.');
      }
    } catch {
      showNotification('Erro ao atualizar integração.');
    }
  };

  const deleteIntegration = async (id: string) => {
    try {
      await adapter.deleteIntegration(id);
      setIntegrations(prev => prev.filter(i => i.id !== id));
      showNotification('Integração removida.');
    } catch {
      showNotification('Erro ao remover integração.');
    }
  };

  return {
    testIntegration,
    dispatchIntegrationWebhookTest,
    suspendIntegration,
    toggleFeatureFlag,
    updatePlanPricing,
    updateGovernanceSettings,
    addCoupon,
    toggleCouponStatus,
    deleteCoupon,
    seedDatabaseToLocalCore,
    resetEntirePlatformData,
    addIntegration,
    updateIntegration,
    deleteIntegration,
  };
};
