import {
  primaryServerProvider,
  PrimaryServerProvider,
} from './primary/server-provider';
import {
  secondaryFirebaseProvider,
  SecondaryFirebaseProvider,
} from './secondary/firebase-provider';
import { NotificationPayload } from './interfaces/notification.interface';
import { AnalyticsEventPayload } from './interfaces/analytics.interface';
import { CrashReportPayload } from './interfaces/crash.interface';
import { SyncHealthStatus } from './interfaces/sync.interface';
import { PlatformGovernance } from '../../types';

export interface IntegrationProviderDescriptor {
  id: 'PRIMARY_SERVER_CORE' | 'SECONDARY_FIREBASE_PROVIDER';
  name: string;
  tier: 'PRIMARY' | 'SECONDARY';
  authorityLabel: string;
  description: string;
  connected: boolean;
  latencyMs: number | null;
  lastCheckedAt: string;
  statusDetail: string;
  failureCount: number;
}

/**
 * Integration Layer (Camada de Conexão — Provider Adapter)
 *
 * Responsabilidades:
 * - Garantir que o Server Core próprio seja SEMPRE o provedor principal e a autoridade única dos dados comerciais.
 * - Orquestrar provedores secundários opcionais (Firebase) sem acoplamento direto dos produtos (HQ, Store OS, Marketplace, Waiter, Driver).
 * - Isolar falhas de provedores secundários para que a indisponibilidade do Firebase nunca afete o funcionamento do ecossistema.
 */
class IntegrationProviderManager {
  public readonly primary: PrimaryServerProvider = primaryServerProvider;
  public readonly secondaryFirebase: SecondaryFirebaseProvider = secondaryFirebaseProvider;

  private failureCounters: Record<string, number> = {
    PRIMARY_SERVER_CORE: 0,
    SECONDARY_FIREBASE_PROVIDER: 0,
  };

  private lastHealthCache: Record<string, SyncHealthStatus> = {};

  public syncGovernance(governance?: PlatformGovernance | null): void {
    this.secondaryFirebase.syncFromGovernance(governance);
  }

  public async dispatchNotification(payload: NotificationPayload) {
    // 1. Primary Server Core always executes first
    const primaryResult = await this.primary.sendNotification(payload);

    // 2. Optional secondary FCM push fan-out (non-blocking)
    if (this.secondaryFirebase.isAvailable()) {
      await this.secondaryFirebase.sendNotification(payload).catch(() => {
        this.failureCounters.SECONDARY_FIREBASE_PROVIDER += 1;
      });
    }

    return primaryResult;
  }

  public async trackAnalytics(event: AnalyticsEventPayload) {
    await this.primary.trackEvent(event);
    if (this.secondaryFirebase.isAvailable()) {
      await this.secondaryFirebase.trackEvent(event).catch(() => {
        this.failureCounters.SECONDARY_FIREBASE_PROVIDER += 1;
      });
    }
  }

  public async reportCrash(report: CrashReportPayload) {
    await this.primary.reportException(report);
    if (this.secondaryFirebase.isAvailable()) {
      await this.secondaryFirebase.reportException(report).catch(() => {
        this.failureCounters.SECONDARY_FIREBASE_PROVIDER += 1;
      });
    }
  }

  public async probeAllProviders(): Promise<{
    primaryHealth: SyncHealthStatus;
    secondaryHealth: SyncHealthStatus;
    descriptors: IntegrationProviderDescriptor[];
  }> {
    const [primaryHealth, secondaryHealth] = await Promise.all([
      this.primary.checkHealth(),
      this.secondaryFirebase.checkHealth(),
    ]);

    if (!primaryHealth.connected) {
      this.failureCounters.PRIMARY_SERVER_CORE += 1;
    }
    if (
      this.secondaryFirebase.getServicesConfig().masterEnabled &&
      !secondaryHealth.connected
    ) {
      this.failureCounters.SECONDARY_FIREBASE_PROVIDER += 1;
    }

    this.lastHealthCache.PRIMARY_SERVER_CORE = primaryHealth;
    this.lastHealthCache.SECONDARY_FIREBASE_PROVIDER = secondaryHealth;

    return {
      primaryHealth,
      secondaryHealth,
      descriptors: this.getProviderDescriptors(),
    };
  }

  public getProviderDescriptors(): IntegrationProviderDescriptor[] {
    const pHealth = this.lastHealthCache.PRIMARY_SERVER_CORE;
    const sHealth = this.lastHealthCache.SECONDARY_FIREBASE_PROVIDER;

    return [
      {
        id: 'PRIMARY_SERVER_CORE',
        name: '3C Server Core & Edge Backbone',
        tier: 'PRIMARY',
        authorityLabel: 'AUTORIDADE ÚNICA DE DADOS COMERCIAIS',
        description:
          'Dados comerciais (estoque, vendas, pedidos, financeiro), APIs REST/SSE, regras de negócio e sincronização Offline-First.',
        connected: pHealth ? pHealth.connected : true,
        latencyMs: pHealth?.latencyMs ?? 4,
        lastCheckedAt: pHealth?.lastCheckedAt || new Date().toISOString(),
        statusDetail:
          pHealth?.detail ||
          'Server Core operacional • Fonte única de verdade para HQ, Store OS, Marketplace, Garçom e Driver.',
        failureCount: this.failureCounters.PRIMARY_SERVER_CORE,
      },
      {
        id: 'SECONDARY_FIREBASE_PROVIDER',
        name: 'Google Firebase (Provider Adapter Secundário)',
        tier: 'SECONDARY',
        authorityLabel: 'COMPLEMENTAR & OPCIONAL (SEM AUTORIDADE COMERCIAL)',
        description:
          'Serviços complementares desacoplados: Cloud Messaging (Push), Analytics, Crashlytics, Auth complementar e espelhamento opcional.',
        connected: sHealth ? sHealth.connected : this.secondaryFirebase.isAvailable(),
        latencyMs: sHealth?.latencyMs ?? null,
        lastCheckedAt: sHealth?.lastCheckedAt || new Date().toISOString(),
        statusDetail:
          sHealth?.detail ||
          'Adaptador secundário pronto • Governado individualmente pelo HQ Central.',
        failureCount: this.failureCounters.SECONDARY_FIREBASE_PROVIDER,
      },
    ];
  }
}

export const providerManager = new IntegrationProviderManager();
