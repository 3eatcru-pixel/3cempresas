export interface NotificationPayload {
  id?: string;
  title: string;
  body: string;
  channel: 'STORE_OS' | 'MARKETPLACE' | 'DRIVER' | 'WAITER' | 'HQ_CENTRAL';
  storeId?: string;
  recipientId?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationDeliveryResult {
  delivered: boolean;
  providerId: 'PRIMARY_SERVER' | 'SECONDARY_FIREBASE_FCM';
  timestamp: string;
  detail?: string;
}

export interface INotificationProvider {
  readonly providerId: string;
  isAvailable(): boolean;
  sendNotification(payload: NotificationPayload): Promise<NotificationDeliveryResult>;
}
