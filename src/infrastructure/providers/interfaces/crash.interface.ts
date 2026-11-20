export interface CrashReportPayload {
  severity: 'WARNING' | 'ERROR' | 'FATAL';
  module: 'HQ_CENTRAL' | 'SERVER_CORE' | 'STORE_OS' | 'MARKETPLACE' | 'DRIVER_APP' | 'WAITER_APP';
  message: string;
  stack?: string;
  storeId?: string;
  context?: Record<string, unknown>;
  occurredAt?: string;
}

export interface ICrashReportingProvider {
  readonly providerId: string;
  isAvailable(): boolean;
  reportException(report: CrashReportPayload): Promise<{ logged: boolean; providerId: string }>;
}
