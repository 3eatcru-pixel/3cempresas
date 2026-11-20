import { httpClientApi } from './httpClient.ts';
import { systemApi } from './systemApi.ts';
import { authApi } from './authApi.ts';
import { hqAdminApi } from './hqAdminApi.ts';
import { storeApi } from './storeApi.ts';
import { commerceApi } from './commerceApi.ts';
import { syncApi } from './syncApi.ts';
import { stripeApi } from './stripeApi.ts';

export type { ApiRequestOptions } from './httpClient.ts';
export {
  httpClientApi,
  rawFetch,
  requestJson,
  executeEndpoint,
} from './httpClient.ts';
export { systemApi } from './systemApi.ts';
export { authApi } from './authApi.ts';
export { hqAdminApi } from './hqAdminApi.ts';
export type {
  EcosystemTableInspectResponse,
  AccountSecurityOverviewResponse,
  SentinelLogsResponse,
} from './hqAdminApi.ts';
export { storeApi } from './storeApi.ts';
export { commerceApi } from './commerceApi.ts';
export { syncApi } from './syncApi.ts';
export { stripeApi } from './stripeApi.ts';
export type {
  StripePublicConfigResponse,
  StripeHealthResponse,
  StripeInvoiceSummary,
} from './stripeApi.ts';

export const apiClient = {
  ...httpClientApi,
  ...systemApi,
  ...authApi,
  ...hqAdminApi,
  ...storeApi,
  ...commerceApi,
  ...syncApi,
  ...stripeApi,
};
