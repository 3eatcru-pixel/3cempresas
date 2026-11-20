/**
 * Regra Fundamental da Arquitetura OmniEats / 3C Corp:
 * O Server Core é SEMPRE a autoridade única dos dados comerciais (estoque, vendas, pedidos e financeiro).
 * Provedores secundários (como Firestore) nunca recebem escrita simultânea com autoridade comercial;
 * atuam apenas como espelho complementar opcional (read-only / fan-out) sob governança do HQ Central.
 */
export interface SecondaryMirrorEnvelope {
  collection: 'orders_mirror' | 'stores_presence' | 'telemetry_heartbeat';
  documentId: string;
  storeId?: string;
  authoritativeServerVersion: number;
  payload: Record<string, unknown>;
}

export interface SyncHealthStatus {
  providerId: string;
  role: 'PRIMARY_AUTHORITY' | 'SECONDARY_COMPLEMENTARY';
  connected: boolean;
  latencyMs: number | null;
  lastCheckedAt: string;
  detail: string;
}

export interface ISecondarySyncProvider {
  readonly providerId: string;
  readonly isAuthoritativeForCommercialData: false;
  isAvailable(): boolean;
  mirrorFromAuthoritativeServer(envelope: SecondaryMirrorEnvelope): Promise<{
    mirrored: boolean;
    providerId: string;
    skippedReason?: string;
  }>;
  checkHealth(): Promise<SyncHealthStatus>;
}
