import {
  INotificationProvider,
  NotificationDeliveryResult,
  NotificationPayload,
} from '../interfaces/notification.interface';
import {
  AnalyticsEventPayload,
  IAnalyticsProvider,
} from '../interfaces/analytics.interface';
import {
  CrashReportPayload,
  ICrashReportingProvider,
} from '../interfaces/crash.interface';
import {
  ISecondarySyncProvider,
  SecondaryMirrorEnvelope,
  SyncHealthStatus,
} from '../interfaces/sync.interface';
import {
  configureSupabaseClientRuntime,
  getSupabaseRuntimeMetadata,
  testSupabaseConnection,
} from '../../../services/supabaseClient';
import { PlatformGovernance } from '../../../types';

export interface SupabaseComplementaryServicesConfig {
  masterEnabled: boolean;
  complementaryAuth: boolean;
  supabaseDb: boolean;
  mirrorSync: boolean;
}

/**
 * Provedor Secundário Opcional — Supabase Adapter (@supabase/supabase-js + @supabase/server)
 *
 * Princípios Arquiteturais:
 * 1. O ecossistema 3C Corp NÃO depende diretamente do Supabase.
 * 2. Se o Supabase ficar indisponível ou desativado no HQ, o Server Core continua operando 100%.
 * 3. Auth complementar verifica tokens JWT via JWKS no Server Core (/api/v1/auth/supabase-exchange).
 * 4. O Supabase NUNCA ganha autoridade de escrita sobre dados comerciais (estoque, vendas, pedidos, financeiro).
 */
export class SecondarySupabaseProvider
  implements
    INotificationProvider,
    IAnalyticsProvider,
    ICrashReportingProvider,
    ISecondarySyncProvider
{
  public readonly providerId = 'SECONDARY_SUPABASE_PROVIDER';
  public readonly isAuthoritativeForCommercialData = false as const;

  private servicesConfig: SupabaseComplementaryServicesConfig = {
    masterEnabled: false,
    complementaryAuth: false,
    supabaseDb: false,
    mirrorSync: false,
  };

  public syncFromGovernance(governance?: PlatformGovernance | null): void {
    const flags = governance?.featureFlags;
    const policy = governance?.runtimePolicy;
    if (policy && (policy.supabaseUrl || policy.supabasePublishableKey || policy.supabaseJwksUrl)) {
      configureSupabaseClientRuntime({
        url: policy.supabaseUrl,
        publishableKey: policy.supabasePublishableKey,
        jwksUrl: policy.supabaseJwksUrl,
      });
    }
    const meta = getSupabaseRuntimeMetadata();
    const master = Boolean(flags?.supabaseEnabled ?? true) && meta.configured;
    this.servicesConfig = {
      masterEnabled: master,
      complementaryAuth: master && Boolean(flags?.supabaseAuthEnabled ?? true),
      supabaseDb: master && Boolean(flags?.supabaseDbEnabled ?? true),
      mirrorSync: false,
    };
  }

  public getServicesConfig(): SupabaseComplementaryServicesConfig {
    return { ...this.servicesConfig };
  }

  public isAvailable(): boolean {
    const meta = getSupabaseRuntimeMetadata();
    return Boolean(this.servicesConfig.masterEnabled && meta.configured);
  }

  public async sendNotification(
    payload: NotificationPayload
  ): Promise<NotificationDeliveryResult> {
    return {
      delivered: false,
      providerId: 'SECONDARY_FIREBASE_FCM',
      timestamp: new Date().toISOString(),
      detail: `Notificações comerciais (${payload.channel}) são exclusivas do Server Core SSE.`,
    };
  }

  public async trackEvent(
    event: AnalyticsEventPayload
  ): Promise<{ recorded: boolean; providerId: string }> {
    return {
      recorded: false,
      providerId: `${this.providerId}:ANALYTICS_NOT_INTEGRATED:${event.eventName}`,
    };
  }

  public async reportException(
    report: CrashReportPayload
  ): Promise<{ logged: boolean; providerId: string }> {
    return {
      logged: false,
      providerId: `${this.providerId}:CRASH_NOT_INTEGRATED:${report.module}`,
    };
  }

  public async mirrorFromAuthoritativeServer(
    envelope: SecondaryMirrorEnvelope
  ): Promise<{
    mirrored: boolean;
    providerId: string;
    skippedReason?: string;
  }> {
    return {
      mirrored: false,
      providerId: `${this.providerId}:MIRROR_STANDBY:${envelope.collection}/${envelope.documentId}`,
      skippedReason:
        'Espelhamento comercial em standby • Server Core mantém autoridade exclusiva de gravação.',
    };
  }

  public async checkHealth(): Promise<SyncHealthStatus> {
    const meta = getSupabaseRuntimeMetadata();

    if (!meta.configured) {
      return {
        providerId: this.providerId,
        role: 'SECONDARY_COMPLEMENTARY',
        connected: false,
        latencyMs: null,
        lastCheckedAt: new Date().toISOString(),
        detail:
          'Variáveis Supabase ausentes • Server Core principal opera 100% autônomo sem impacto.',
      };
    }

    if (!this.servicesConfig.masterEnabled) {
      return {
        providerId: this.providerId,
        role: 'SECONDARY_COMPLEMENTARY',
        connected: false,
        latencyMs: null,
        lastCheckedAt: new Date().toISOString(),
        detail:
          'Provedor Supabase em standby pelo HQ Central • Ative a chave mestra para habilitar serviços.',
      };
    }

    if (!this.servicesConfig.supabaseDb) {
      return {
        providerId: this.providerId,
        role: 'SECONDARY_COMPLEMENTARY',
        connected: Boolean(this.servicesConfig.complementaryAuth),
        latencyMs: null,
        lastCheckedAt: new Date().toISOString(),
        detail: this.servicesConfig.complementaryAuth
          ? 'Supabase Auth JWKS ativo • PostgREST/DB em standby pelo HQ Central.'
          : 'Supabase Auth e DB em standby pelo HQ Central.',
      };
    }

    const probe = await testSupabaseConnection();
    return {
      providerId: this.providerId,
      role: 'SECONDARY_COMPLEMENTARY',
      connected: probe.online,
      latencyMs: probe.latencyMs,
      lastCheckedAt: new Date().toISOString(),
      detail: probe.detail,
    };
  }
}

export const secondarySupabaseProvider = new SecondarySupabaseProvider();
