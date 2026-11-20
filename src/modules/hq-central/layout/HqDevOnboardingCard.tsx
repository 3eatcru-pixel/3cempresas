import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CreditCard,
  Database,
  KeyRound,
  Laptop,
  Mail,
  Store as StoreIcon,
  Terminal,
} from 'lucide-react';
import { DeviceLicense, Driver, Order, Store, SystemIntegration } from '../../../types';
import { UserProfile, useAuth } from '../../../context/AuthContext';
import { apiClient } from '../../../core/api/apiClient';
import { HqTabId } from './HqSidebar';
import {
  CLOUD_RUN_ENV_TEMPLATE,
  EnvReadinessPayload,
  FALLBACK_CLOUD_RUN_VARS,
  OnboardingStep,
} from './onboarding/hqDevOnboardingConstants';
import { HqCloudRunEnvMatrix } from './onboarding/HqCloudRunEnvMatrix';
import { HqOnboardingStepsGrid } from './onboarding/HqOnboardingStepsGrid';

interface HqDevOnboardingCardProps {
  profile: UserProfile | null;
  systemHealth?: {
    persistenceDriver?: string;
    persistenceMode?: string;
    productionDatabaseReady?: boolean;
    cloudProbeVerified?: boolean;
    cloudProbeError?: string | null;
    region?: string;
    environmentMode?: string;
  };
  stores: Store[];
  integrations: SystemIntegration[];
  deviceLicenses: DeviceLicense[];
  drivers: Driver[];
  orders: Order[];
  onNavigateTab?: (tab: HqTabId) => void;
}

export const HqDevOnboardingCard: React.FC<HqDevOnboardingCardProps> = ({
  profile,
  systemHealth,
  stores,
  integrations,
  deviceLicenses,
  drivers,
  orders,
  onNavigateTab,
}) => {
  const { getIdToken } = useAuth();
  const [envReadiness, setEnvReadiness] = useState<EnvReadinessPayload | null>(null);
  const [envLoading, setEnvLoading] = useState(false);
  const [envError, setEnvError] = useState<string | null>(null);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  const isDevOwner = String(profile?.role || '').toUpperCase() === 'DEV_OWNER';

  const loadEnvReadiness = useCallback(async () => {
    if (!isDevOwner) return;
    setEnvLoading(true);
    setEnvError(null);
    try {
      const token = await getIdToken();
      if (!token) return;
      const data = await apiClient.getDevEnvReadiness(token);
      setEnvReadiness(data);
    } catch (err: any) {
      setEnvError(
        err?.message || 'Não foi possível consultar o status das variáveis no servidor.'
      );
    } finally {
      setEnvLoading(false);
    }
  }, [getIdToken, isDevOwner]);

  useEffect(() => {
    void loadEnvReadiness();
  }, [loadEnvReadiness]);

  const handleCopyEnvTemplate = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(CLOUD_RUN_ENV_TEMPLATE);
        setCopiedNotice('Template Cloud Run copiado com placeholders seguros.');
      } else {
        setCopiedNotice(
          'Clipboard indisponível neste navegador — use .env.example no repositório.'
        );
      }
    } catch {
      setCopiedNotice('Permissão de clipboard negada — copie a partir de .env.example.');
    }
    setTimeout(() => setCopiedNotice(null), 4000);
  };

  const activeStores = useMemo(
    () => stores.filter((s) => !s._deleted && s.tenantStatus !== 'SUSPENDED'),
    [stores]
  );

  const effectiveDbReady =
    envReadiness?.productionDatabaseReady ?? systemHealth?.productionDatabaseReady === true;
  const effectiveDriver =
    envReadiness?.persistenceDriver || systemHealth?.persistenceDriver || 'json-memory';
  const effectiveMode =
    envReadiness?.persistenceMode || systemHealth?.persistenceMode || 'SANDBOX_LOCAL';
  const effectiveRegion = envReadiness?.region || systemHealth?.region || 'local';
  const effectiveProbeError =
    envReadiness?.cloudProbeError ?? systemHealth?.cloudProbeError ?? null;

  const steps = useMemo<OnboardingStep[]>(() => {
    const passwordRotated = profile?.mustChangePassword !== true;
    const postgresReady = effectiveDbReady === true;
    const hasActiveStore = activeStores.length > 0;
    const hasPaymentIntegration = integrations.some(
      (i) => i.category === 'PAYMENT' && i.status !== 'SUSPENDED'
    );
    const hasNotificationOrEmail = integrations.some(
      (i) =>
        ['EMAIL', 'SMS', 'WHATSAPP', 'API'].includes(String(i.category).toUpperCase()) &&
        Boolean(i.endpointUrl)
    );
    const hasHardwareAndFleet = deviceLicenses.length > 0 && drivers.length > 0;
    const hasFirstTestOrder = orders.length > 0;

    return [
      {
        id: 'dev-password',
        title: '1. Senha Definitiva do Master HQ',
        description: passwordRotated
          ? `Credencial definitiva validada para ${profile?.email || '3eatcru@gmail.com'}.`
          : 'Troque a senha inicial de primeiro acesso antes de liberar operações em produção.',
        envHints: ['INITIAL_DEV_PASSWORD', 'SERVER_SECRET'],
        completed: passwordRotated,
        statusLabel: passwordRotated ? 'Configurado' : 'Obrigatório',
        icon: KeyRound,
      },
      {
        id: 'cloud-postgres',
        title: '2. PostgreSQL Cloud & Segredos de Runtime',
        description: postgresReady
          ? `Banco Cloud ativo (${effectiveDriver}) na região ${effectiveRegion}.`
          : `Operando em ${effectiveDriver} (${effectiveMode}). Para produção multi-instância no Cloud Run, conecte PostgreSQL via DATABASE_URL ou SQL_HOST/SQL_USER/SQL_PASSWORD/SQL_DB_NAME + SERVER_SECRET.`,
        envHints: ['DATABASE_URL / SQL_*', 'ENABLE_POSTGRES_CLOUD', 'TRUST_PROXY'],
        completed: postgresReady,
        warningOnly: !postgresReady,
        statusLabel: postgresReady ? 'Cloud Ativo' : 'Modo Local/Sandbox',
        actionLabel: 'Ver Telemetria & TBL',
        targetTab: 'telemetry-tables',
        icon: Database,
      },
      {
        id: 'first-store',
        title: '3. Primeiro Tenant & Loja de Testes',
        description: hasActiveStore
          ? `${activeStores.length} loja(s) ativa(s) pronta(s) para PDV no Store OS e pedidos no Marketplace.`
          : 'Crie o primeiro estabelecimento comercial para habilitar cardápio, mesas, caixa e vitrine pública.',
        envHints: ['EDGE_STORE_ID', 'EDGE_TENANT_ID'],
        completed: hasActiveStore,
        statusLabel: hasActiveStore ? `${activeStores.length} loja(s)` : 'Pendente',
        actionLabel: 'Tenants & Lojas',
        targetTab: 'tenants',
        icon: StoreIcon,
      },
      {
        id: 'payments-psp',
        title: '4. Gateway de Pagamento & Webhooks PSP',
        description: hasPaymentIntegration
          ? 'Provedor de pagamento cadastrado no HQ. Valide os segredos HMAC no Cloud Run antes de ir ao ar.'
          : 'Cadastre um provedor de pagamento (Mercado Pago / Stripe / PIX) e defina PSP_WEBHOOK_SECRET e SAAS_PSP_WEBHOOK_SECRET.',
        envHints: ['PSP_WEBHOOK_SECRET', 'SAAS_PSP_WEBHOOK_SECRET'],
        completed: hasPaymentIntegration,
        warningOnly: !hasPaymentIntegration,
        statusLabel: hasPaymentIntegration ? 'Cadastrado' : 'Configurar PSP',
        actionLabel: 'Integrações',
        targetTab: 'integrations',
        icon: CreditCard,
      },
      {
        id: 'email-webhook',
        title: '5. E-mail Transacional & Notificações',
        description: hasNotificationOrEmail
          ? 'Endpoint de notificação/API configurado. Confira EMAIL_WEBHOOK_URL e EMAIL_WEBHOOK_SECRET no servidor.'
          : 'Para recuperação de senha real sem console sandbox, preencha EMAIL_WEBHOOK_URL e EMAIL_WEBHOOK_SECRET no Cloud Run.',
        envHints: ['EMAIL_WEBHOOK_URL', 'EMAIL_WEBHOOK_SECRET'],
        completed: hasNotificationOrEmail,
        warningOnly: !hasNotificationOrEmail,
        statusLabel: hasNotificationOrEmail ? 'Webhook Ativo' : 'Opcional (Sandbox)',
        actionLabel: 'Provedores',
        targetTab: 'integrations',
        icon: Mail,
      },
      {
        id: 'fleet-edge-test',
        title: '6. Terminais PDQ/Waiter, Entregadores & Pedido Teste',
        description:
          hasHardwareAndFleet && hasFirstTestOrder
            ? `${deviceLicenses.length} terminal(is), ${drivers.length} entregador(es) e ${orders.length} pedido(s) registrados no cluster.`
            : 'Provisione um terminal PDQ/Garçom, vincule um entregador e execute 1 pedido teste no Marketplace → Store OS → Driver.',
        envHints: ['CLOUD_BASE_URL', 'EDGE_PORT', 'EDGE_AUTO_SYNC_MS'],
        completed: hasHardwareAndFleet && hasFirstTestOrder,
        warningOnly: !(hasHardwareAndFleet && hasFirstTestOrder),
        statusLabel: `${deviceLicenses.length} term. · ${drivers.length} driv.`,
        actionLabel: 'Dispositivos',
        targetTab: 'devices',
        icon: Laptop,
      },
    ];
  }, [
    profile,
    effectiveDbReady,
    effectiveDriver,
    effectiveMode,
    effectiveRegion,
    activeStores.length,
    integrations,
    deviceLicenses.length,
    drivers.length,
    orders.length,
  ]);

  const completedCount = steps.filter((s) => s.completed).length;
  const [isExpanded, setIsExpanded] = useState(completedCount < steps.length);
  const [showEnvMatrix, setShowEnvMatrix] = useState(false);

  const displayedVars = envReadiness?.variables || FALLBACK_CLOUD_RUN_VARS;
  const configuredVarCount = displayedVars.filter((v) => v.configured).length;

  return (
    <section className="bg-slate-900/80 border border-indigo-500/30 rounded-2xl p-5 space-y-4 shadow-xl shadow-indigo-950/20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 shrink-0">
            <Terminal className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black text-white uppercase tracking-tight">
                Onboarding do Dev · Primeiros Testes &amp; Cloud Run
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-mono font-bold text-indigo-300 tabular-nums">
                {completedCount}/{steps.length} etapas prontas
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${
                  effectiveDbReady
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                {effectiveMode} · {effectiveRegion}
              </span>
              {envReadiness && (
                <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-cyan-500/30 text-[10px] font-mono font-bold text-cyan-300 tabular-nums">
                  Env: {configuredVarCount}/{displayedVars.length} ativos
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Checklist guiado para o Dev Owner deixar PostgreSQL, webhooks, lojas, PDQ/Edge e testes ponta-a-ponta operacionais.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowEnvMatrix((prev) => !prev)}
            className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-cyan-300 text-[11px] font-bold rounded-xl transition-colors cursor-pointer"
          >
            {showEnvMatrix ? 'Ocultar Variáveis Env' : 'Variáveis Cloud Run'}
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 text-[11px] font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>{isExpanded ? 'Recolher' : 'Expandir Checklist'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {showEnvMatrix && (
        <HqCloudRunEnvMatrix
          envReadiness={envReadiness}
          displayedVars={displayedVars}
          isDevOwner={isDevOwner}
          envLoading={envLoading}
          envError={envError}
          effectiveProbeError={effectiveProbeError}
          copiedNotice={copiedNotice}
          onReloadEnvReadiness={() => void loadEnvReadiness()}
          onCopyEnvTemplate={() => void handleCopyEnvTemplate()}
        />
      )}

      {isExpanded && <HqOnboardingStepsGrid steps={steps} onNavigateTab={onNavigateTab} />}
    </section>
  );
};
