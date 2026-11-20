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
  getFirebaseRuntimeMetadata,
  testFirebaseConnection,
} from '../../../services/firebaseClient';
import { PlatformGovernance } from '../../../types';

export interface FirebaseComplementaryServicesConfig {
  masterEnabled: boolean;
  fcmPush: boolean;
  analytics: boolean;
  crashlytics: boolean;
  complementaryAuth: boolean;
  firestoreCores: boolean;
  firestoreMirrorSync: boolean;
}

/**
 * Provedor Secundário Opcional — Firebase Adapter
 *
 * Princípios Arquiteturais:
 * 1. O ecossistema 3C Corp NÃO depende diretamente do Firebase.
 * 2. Se o Firebase ficar indisponível ou desativado, o Server Core principal continua operando 100%.
 * 3. Serviços realmente integrados hoje: Firebase Auth (troca RS256 em /api/v1/auth/firebase-exchange)
 *    e Firestore Cores (/users, /cloud_preferences, /admins e Health Probe sob firestore.rules Zero-Trust).
 * 4. O Firebase NUNCA ganha autoridade de escrita sobre dados comerciais (estoque, vendas, pedidos, financeiro).
 */
export class SecondaryFirebaseProvider
  implements
    INotificationProvider,
    IAnalyticsProvider,
    ICrashReportingProvider,
    ISecondarySyncProvider
{
  public readonly providerId = 'SECONDARY_FIREBASE_PROVIDER';
  public readonly isAuthoritativeForCommercialData = false as const;

  private servicesConfig: FirebaseComplementaryServicesConfig = {
    masterEnabled: false,
    fcmPush: false,
    analytics: false,
    crashlytics: false,
    complementaryAuth: false,
    firestoreCores: false,
    firestoreMirrorSync: false,
  };

  public syncFromGovernance(governance?: PlatformGovernance | null): void {
    const flags = governance?.featureFlags;
    const meta = getFirebaseRuntimeMetadata();
    const master =
      Boolean(flags?.firebaseEnabled ?? true) &&
      Boolean(meta.projectId);
    this.servicesConfig = {
      masterEnabled: master,
      fcmPush: false,
      analytics: false,
      crashlytics: false,
      complementaryAuth: master && Boolean(flags?.firebaseAuthEnabled ?? true),
      firestoreCores: master && Boolean(flags?.firebaseFirestoreEnabled ?? true),
      firestoreMirrorSync: false,
    };
  }

  public getServicesConfig(): FirebaseComplementaryServicesConfig {
    return { ...this.servicesConfig };
  }

  public isAvailable(): boolean {
    const meta = getFirebaseRuntimeMetadata();
    return Boolean(this.servicesConfig.masterEnabled && meta.projectId);
  }

  public async sendNotification(
    payload: NotificationPayload
  ): Promise<NotificationDeliveryResult> {
    return {
      delivered: false,
      providerId: 'SECONDARY_FIREBASE_FCM',
      timestamp: new Date().toISOString(),
      detail: `FCM Push não integrado no cliente (${payload.channel}) • Entregue pelo Server Core primário.`,
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
      providerId: `${this.providerId}:CRASHLYTICS_NOT_INTEGRATED:${report.module}`,
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
      providerId: `${this.providerId}:MIRROR_NOT_INTEGRATED:${envelope.collection}/${envelope.documentId}`,
      skippedReason:
        'Espelhamento comercial no Firestore não habilitado • Server Core mantém autoridade exclusiva.',
    };
  }

  public async checkHealth(): Promise<SyncHealthStatus> {
    const meta = getFirebaseRuntimeMetadata();

    if (!meta.projectId) {
      return {
        providerId: this.providerId,
        role: 'SECONDARY_COMPLEMENTARY',
        connected: false,
        latencyMs: null,
        lastCheckedAt: new Date().toISOString(),
        detail:
          'Configuração Firebase ausente • O sistema principal opera 100% via Server Core sem impacto.',
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
          'Provedor secundário em standby pelo HQ Central • Ative a chave mestra para habilitar serviços complementares.',
      };
    }

    if (!this.servicesConfig.firestoreCores) {
      return {
        providerId: this.providerId,
        role: 'SECONDARY_COMPLEMENTARY',
        connected: Boolean(this.servicesConfig.complementaryAuth),
        latencyMs: null,
        lastCheckedAt: new Date().toISOString(),
        detail: this.servicesConfig.complementaryAuth
          ? 'Auth Google ativo • Firestore Cores em standby pelo HQ Central.'
          : 'Auth Google e Firestore Cores em standby pelo HQ Central.',
      };
    }

    const probe = await testFirebaseConnection();
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

export const secondaryFirebaseProvider = new SecondaryFirebaseProvider();
