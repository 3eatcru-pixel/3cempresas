import { useState, useEffect, useCallback } from 'react';
import { DatabaseAdapterManager } from '../../services/databaseAdapter';
import { MainSectionId, EcosystemSessionRole } from '../../types';
import { apiClient } from '../../core/api/apiClient';
import { buildSseStreamUrl, getPlatformAdapters } from '../../core/platform/PlatformAdapter';
import { generateEventId } from '../../utils/idGenerator';

export const useSystem = (
  user: any,
  profile: any,
  loading: boolean,
  isAuthenticated: boolean,
  options?: { initialSection?: MainSectionId; lockedSection?: boolean }
) => {
  const [activeSection, setActiveSectionState] = useState<MainSectionId>(options?.initialSection || 'portal');
  const setActiveSection = useCallback(
    (sec: MainSectionId) => {
      if (options?.lockedSection) return;
      setActiveSectionState(sec);
    },
    [options?.lockedSection]
  );
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [sessionRole, setSessionRoleState] = useState<EcosystemSessionRole>('CUSTOMER');
  const [selectedStoreSlugForShowcase, setSelectedStoreSlugForShowcase] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const slug = new URLSearchParams(window.location.search).get('store');
      return slug ? slug.trim() || null : null;
    } catch {
      return null;
    }
  });
  const [activeNotification, setActiveNotification] = useState<string | null>(null);
  const [eventLogs, setEventLogs] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>({
    status: 'PROBING',
    cpuUsage: '--',
    memoryUsage: '--',
    activeConnections: 0,
    uptimeSeconds: 0,
    persistenceDriver: 'json-memory',
    productionDatabaseReady: false,
    timestamp: new Date().toISOString()
  });

  const adapter = DatabaseAdapterManager.getAdapter();

  // Cluster Health Polling (scoped strictly to infra control planes: HQ & Server Core)
  useEffect(() => {
    if (loading) return;
    const isInfraPillar = activeSection === 'hq-central' || activeSection === 'server-core';
    if (!isInfraPillar) return;
    const intervalMs = 10_000;
    const pollHealth = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const health = await apiClient.getHealth();
        if (health) {
          setSystemHealth(health);
        }
      } catch {
        // console.warn('[System] Health poll failed', err);
      }
    };

    const interval = setInterval(pollHealth, intervalMs);
    pollHealth();
    return () => clearInterval(interval);
  }, [loading, activeSection]);

  const showNotification = (msg: string) => {
    setActiveNotification(msg);
    setTimeout(() => setActiveNotification(null), 4000);
  };

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      if (next) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      return next;
    });
  };

  const logSystemEvent = async (type: string, payload: string, channel: string, tenantId?: string) => {
    try {
      const event = {
        id: generateEventId(),
        type, 
        payload, 
        channel, 
        tenantId: tenantId || profile?.tenantId || 'SYSTEM',
        timestamp: new Date().toISOString(),
        timeStr: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
      if (adapter.type === 'SERVER_CORE_REST') {
        setEventLogs(prev => [event, ...prev.slice(0, 199)]);
        return;
      }
      await adapter.setDocument('events', event.id, event);
    } catch (e) { 
      console.warn("Event log fallback", e); 
    }
  };

  // SSE Listener for Real-time Events (ZIP 5 Final Polish)
  useEffect(() => {
    if (loading || !isAuthenticated) return;
    const tenantId = profile?.tenantId || 'PUBLIC';
    const token = getPlatformAdapters().storage.getItem('3ccorp_auth_token') || undefined;
    let eventSource: EventSource | null = null;
    let cancelled = false;

    const connectSse = async () => {
      let sseUrl: string;
      if (token) {
        const ticketRes = await apiClient.createSseTicket(token).catch(() => null);
        if (cancelled) return;
        sseUrl = ticketRes?.ticket
          ? buildSseStreamUrl({ ticket: ticketRes.ticket, tenantId })
          : buildSseStreamUrl({ tenantId });
      } else {
        sseUrl = buildSseStreamUrl({ tenantId });
      }
      if (cancelled) return;

      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'WHATSAPP_NOTIFICATION') {
            showNotification(`[WhatsApp Sandbox] Para: ${data.to} - ${data.message}`);
          } else if (data.type === 'ORDER_COMMITTED') {
            showNotification(`Novo Pedido: ${data.orderCode} - R$ ${data.total}`);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('3c:collection-hint', {
                  detail: { collections: ['orders', 'tables', 'inventory_batches', 'financial_records'] },
                })
              );
            }
          } else if (data.type === 'ORDER_STATUS_CHANGED') {
            showNotification(`Pedido ${data.orderCode}: Status alterado para ${data.status}`);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('3c:collection-hint', {
                  detail: { collections: ['orders', 'tables'] },
                })
              );
            }
          } else if (data.type === 'ORDER_RETURNED') {
            showNotification(`Estorno processado (${data.returnedQuantity || 1}x) — estoque e caixa atualizados.`);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('3c:collection-hint', {
                  detail: { collections: ['orders', 'inventory_batches', 'financial_records'] },
                })
              );
            }
          } else if (data.type === 'USER_SESSION_REVOKED') {
            const reason =
              data.reason === 'PASSWORD_RESET_BY_HQ'
                ? 'Sua senha foi redefinida pelo HQ Central. Faça login com a nova senha temporária.'
                : data.reason === 'PASSWORD_RECOVERED'
                ? 'Sua senha foi redefinida. Faça login novamente.'
                : 'Sua sessão foi revogada pelo HQ Central.';
            showNotification(reason);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('3c:auth-invalidated', { detail: { reason } }));
            }
          } else if (data.type === 'USER_SUSPENDED') {
            const reason = 'Sua conta foi suspensa pelo HQ Central.';
            showNotification(reason);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('3c:auth-invalidated', { detail: { reason } }));
            }
          } else if (data.type === 'USER_DELETED') {
            const reason = 'Sua conta foi removida do ecossistema.';
            showNotification(reason);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('3c:auth-invalidated', { detail: { reason } }));
            }
          } else if (data.type === 'USER_ROLE_UPDATED') {
            showNotification(`Suas permissões foram atualizadas para ${data.role || 'novo perfil'}.`);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('3c:auth-refresh'));
            }
          } else if (data.type === 'CLUSTER_FAILOVER') {
            showNotification(`[ALERTA CLUSTER] Failover detectado: ${data.reason}`);
          } else if (data.type === 'CLUSTER_CACHE_PURGE') {
            showNotification(`[INFRA] Cache Global limpo: ${data.scope}`);
          } else if (data.type === 'CONNECTED') {
            console.log('[SSE] Cluster Connected:', data.tenantId);
          }
        } catch (err) {
          console.warn('[SSE] Event parse warning:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.warn('[SSE] EventSource connection lost, retrying...', err);
      };
    };

    void connectSse();

    return () => {
      cancelled = true;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [profile?.tenantId, profile?.uid, loading, isAuthenticated]);

  useEffect(() => {
    if (loading || !isAuthenticated) {
      if (!loading && !isAuthenticated) setEventLogs([]);
      return;
    }
    const roleUpper = String(profile?.role || '').toUpperCase();
    const canReadAuditEvents = [
      'DEV_OWNER',
      'SUPER_ADMIN',
      'REGIONAL_MANAGER',
      'STORE_OWNER',
      'STORE_MANAGER',
    ].includes(roleUpper);
    if (!canReadAuditEvents) {
      setEventLogs([]);
      return;
    }
    const unsubs: (() => void)[] = [];

    unsubs.push(
      adapter.subscribe<any>('events', (events) => {
        setEventLogs(events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      })
    );

    return () => unsubs.forEach(u => u());
  }, [loading, isAuthenticated, profile?.role]);

  useEffect(() => {
    if (!profile || !isAuthenticated) {
      setSessionRoleState('CUSTOMER');
      return;
    }

    if (profile.role === 'DEV_OWNER' || profile.role === 'SUPER_ADMIN') {
      setSessionRoleState(profile.role);
    } else if (profile.role === 'WAITER') {
      setSessionRoleState('WAITER');
      if (!options?.lockedSection && ['hq-central', 'server-core', 'store-os'].includes(activeSection)) {
        setActiveSection('waiter');
      }
    } else if (
      profile.role === 'REGIONAL_MANAGER' ||
      profile.role === 'STORE_OWNER' ||
      profile.role === 'STORE_MANAGER' ||
      profile.role === 'CASHIER' ||
      profile.role === 'KITCHEN_STAFF'
    ) {
      setSessionRoleState(profile.role);
      if (!options?.lockedSection && (activeSection === 'hq-central' || activeSection === 'server-core')) {
        setActiveSection('store-os');
      }
    } else if (profile.role === 'COURIER' || profile.role === 'DRIVER') {
      setSessionRoleState('COURIER');
    } else {
      setSessionRoleState('CUSTOMER');
      if (!options?.lockedSection && (activeSection === 'hq-central' || activeSection === 'server-core')) {
        setActiveSection('marketplace');
      }
    }
  }, [profile, isAuthenticated, options?.lockedSection]);

  const setSessionRole = (role: EcosystemSessionRole) => {
    const privilegedRoles: EcosystemSessionRole[] = ['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER'];
    if (privilegedRoles.includes(role) && profile && profile.role !== 'DEV_OWNER') {
      showNotification('Acesso negado: alteração de papel privilegiado restrita.');
      return;
    }
    setSessionRoleState(role);
    if (role === 'STORE_OWNER' && (activeSection === 'hq-central' || activeSection === 'server-core')) setActiveSection('store-os');
  };

  const microservices: any[] = [];
  const simulateFailover = (_serviceName: string) => {
    showNotification('Failover manual disponível apenas via orquestrador Kubernetes/Cloud Run.');
  };

  const sendClusterCommand = async (command: 'FORCE_FAILOVER' | 'FLUSH_REDIS') => {
    try {
      const token = getPlatformAdapters().storage.getItem('3ccorp_auth_token') || undefined;
      const { ok, data } = await apiClient.sendClusterCommand(command, token);
      if (ok) {
        showNotification(data.message || 'Comando enviado com sucesso.');
        logSystemEvent('CLUSTER_COMMAND', `Comando ${command} executado via HQ.`, 'infra/cluster');
      } else {
        showNotification(`Erro: ${data.error}`);
      }
    } catch {
      showNotification('Falha ao comunicar com o cluster.');
    }
  };

  return {
    activeSection, setActiveSection,
    isDarkMode, toggleDarkMode,
    sessionRole, setSessionRole,
    selectedStoreSlugForShowcase, setSelectedStoreSlugForShowcase,
    activeNotification, showNotification,
    eventLogs, systemHealth,
    logSystemEvent,
    microservices, simulateFailover,
    sendClusterCommand
  };
};
