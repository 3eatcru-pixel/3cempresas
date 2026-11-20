import { useCallback, useEffect, useState } from 'react';
import {
  buildStandardContractHeaders,
  getPlatformAdapters,
} from '../../../../core/platform/PlatformAdapter';
import { AutomatedMessage } from '../../../../types';
import {
  WhatsAppConnectorConfig,
  WhatsAppConnectorMode,
} from '../layout/WhatsAppConnectModal';

export interface DispatchLogItem {
  id: string;
  customerName: string;
  phone: string;
  mode: WhatsAppConnectorMode;
  status: 'SENT' | 'OPENED_WA_ME' | 'FAILED';
  detail?: string;
  at: string;
}

export const buildDefaultWhatsAppConfig = (storeId: string): WhatsAppConnectorConfig => ({
  storeId,
  mode: 'WA_ME',
  phoneNumberId: '',
  wabaId: '',
  webhookUrl: '',
  coexistence: true,
  hasToken: false,
  tokenMasked: '',
  lastTestedAt: null,
  lastTestStatus: null,
  lastTestMessage: null,
  updatedAt: null,
});

export const buildWaUrl = (phone: string, text: string): string => {
  const digits = String(phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}?text=${encodeURIComponent(text)}`;
};

export function useWhatsAppConnector(
  storeId: string,
  showNotification: (msg: string) => void
) {
  const [connectorConfig, setConnectorConfig] = useState<WhatsAppConnectorConfig>(() =>
    buildDefaultWhatsAppConfig(storeId)
  );
  const [orderTriggers, setOrderTriggers] = useState<AutomatedMessage[]>([]);
  const [isDispatchingApi, setIsDispatchingApi] = useState(false);
  const [dispatchHistory, setDispatchHistory] = useState<DispatchLogItem[]>([]);

  const apiBase = getPlatformAdapters().network.getApiBaseUrl();

  const loadWhatsAppState = useCallback(async () => {
    if (!storeId) return;
    try {
      const headers = await buildStandardContractHeaders({ includeIdempotencyKey: false });
      const [cfgRes, trigRes] = await Promise.all([
        fetch(`${apiBase}/store/whatsapp/config?storeId=${encodeURIComponent(storeId)}`, {
          headers,
        }),
        fetch(`${apiBase}/store/whatsapp/triggers?storeId=${encodeURIComponent(storeId)}`, {
          headers,
        }),
      ]);
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        setConnectorConfig(cfgData);
      } else {
        setConnectorConfig(buildDefaultWhatsAppConfig(storeId));
      }
      if (trigRes.ok) {
        const list = await trigRes.json();
        if (Array.isArray(list)) setOrderTriggers(list);
      }
    } catch {
      setConnectorConfig(buildDefaultWhatsAppConfig(storeId));
    }
  }, [apiBase, storeId]);

  useEffect(() => {
    void loadWhatsAppState();
  }, [loadWhatsAppState]);

  const appendDispatchLog = useCallback((entry: Omit<DispatchLogItem, 'id' | 'at'>) => {
    setDispatchHistory((prev) => [
      {
        ...entry,
        id: `log-${Date.now()}`,
        at: new Date().toLocaleTimeString('pt-BR'),
      },
      ...prev.slice(0, 14),
    ]);
  }, []);

  const dispatchViaServerApi = useCallback(
    async (
      phone: string,
      message: string,
      customerName: string,
      orderCode?: string
    ): Promise<boolean> => {
      setIsDispatchingApi(true);
      try {
        const headers = await buildStandardContractHeaders({ includeIdempotencyKey: true });
        const res = await fetch(`${apiBase}/store/whatsapp/send`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            storeId,
            phone,
            message,
            customerName,
            orderCode,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          appendDispatchLog({
            customerName,
            phone,
            mode: connectorConfig.mode,
            status: 'FAILED',
            detail: data.error || `HTTP ${res.status}`,
          });
          showNotification(data.error || 'Falha no envio via conector API.');
          return false;
        }
        appendDispatchLog({
          customerName,
          phone,
          mode: connectorConfig.mode,
          status: 'SENT',
          detail: data.messageId ? `ID ${data.messageId}` : 'Entregue ao gateway',
        });
        showNotification(`Mensagem enviada via ${connectorConfig.mode} para ${customerName}.`);
        return true;
      } catch {
        showNotification('Erro de rede ao contatar o conector WhatsApp no servidor.');
        return false;
      } finally {
        setIsDispatchingApi(false);
      }
    },
    [apiBase, appendDispatchLog, connectorConfig.mode, showNotification, storeId]
  );

  const saveConnectorConfig = useCallback(
    async (payload: {
      mode: WhatsAppConnectorMode;
      phoneNumberId: string;
      wabaId: string;
      webhookUrl: string;
      token?: string;
      coexistence: boolean;
      clearToken?: boolean;
    }): Promise<boolean> => {
      try {
        const headers = await buildStandardContractHeaders({ includeIdempotencyKey: true });
        const res = await fetch(`${apiBase}/store/whatsapp/config`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...payload, storeId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showNotification(data.error || 'Erro ao salvar conector WhatsApp.');
          return false;
        }
        if (data.config) setConnectorConfig(data.config);
        showNotification(
          payload.mode === 'WA_ME'
            ? 'Modo wa.me zero-custo ativado.'
            : `Conector ${payload.mode} salvo com segurança no Server Core.`
        );
        return true;
      } catch {
        showNotification('Falha de conexão ao salvar configuração WhatsApp.');
        return false;
      }
    },
    [apiBase, showNotification, storeId]
  );

  const testConnector = useCallback(async () => {
    try {
      const headers = await buildStandardContractHeaders({ includeIdempotencyKey: false });
      const res = await fetch(`${apiBase}/store/whatsapp/test`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ storeId }),
      });
      const data = await res.json().catch(() => null);
      if (data) {
        await loadWhatsAppState();
      }
      return data;
    } catch {
      return null;
    }
  }, [apiBase, loadWhatsAppState, storeId]);

  const saveOrderTrigger = useCallback(
    async (
      trigger: AutomatedMessage['trigger'],
      updates: { content?: string; isActive?: boolean }
    ) => {
      try {
        const headers = await buildStandardContractHeaders({ includeIdempotencyKey: true });
        const res = await fetch(
          `${apiBase}/store/whatsapp/triggers/${encodeURIComponent(trigger)}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({ storeId, ...updates }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.trigger) {
          setOrderTriggers((prev) =>
            prev.map((t) => (t.trigger === trigger ? data.trigger : t))
          );
          showNotification('Gatilho de status atualizado.');
        } else {
          showNotification(data.error || 'Erro ao atualizar gatilho.');
        }
      } catch {
        showNotification('Falha de rede ao salvar gatilho.');
      }
    },
    [apiBase, showNotification, storeId]
  );

  return {
    connectorConfig,
    orderTriggers,
    isDispatchingApi,
    dispatchHistory,
    appendDispatchLog,
    dispatchViaServerApi,
    saveConnectorConfig,
    testConnector,
    saveOrderTrigger,
  };
}
