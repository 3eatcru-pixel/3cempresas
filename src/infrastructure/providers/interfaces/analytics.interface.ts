export interface AnalyticsEventPayload {
  eventName: string;
  pillar: 'hq' | 'os' | 'consumer' | 'driver' | 'waiter' | 'server';
  storeId?: string;
  userId?: string;
  properties?: Record<string, string | number | boolean | null>;
  timestamp?: string;
}

export interface IAnalyticsProvider {
  readonly providerId: string;
  isAvailable(): boolean;
  trackEvent(event: AnalyticsEventPayload): Promise<{ recorded: boolean; providerId: string }>;
}
