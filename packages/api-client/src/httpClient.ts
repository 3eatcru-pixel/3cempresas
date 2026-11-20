import {
  buildStandardContractHeaders,
  ClientAppId,
  getPlatformAdapters,
} from '@3c/platform-adapters';

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  rawBody?: string;
  token?: string | null;
  deviceToken?: string | null;
  headers?: Record<string, string>;
  appId?: ClientAppId;
  idempotency?: boolean;
  idempotencyKey?: string;
  skipAuthInvalidationOn401?: boolean;
}

export async function rawFetch(fullUrl: string, options: ApiRequestOptions = {}): Promise<Response> {
  const method = options.method || 'GET';
  const isMutation = method !== 'GET';
  const baseHeaders = buildStandardContractHeaders({
    token: options.token,
    appId: options.appId,
    includeIdempotencyKey: options.idempotency ?? isMutation,
    existingIdempotencyKey: options.idempotencyKey,
  });
  const headers: Record<string, string> = {
    ...baseHeaders,
    ...(options.deviceToken ? { 'X-Device-Token': options.deviceToken } : {}),
    ...(options.headers || {}),
  };

  return fetch(fullUrl, {
    method,
    headers,
    credentials: 'include',
    body:
      options.rawBody !== undefined
        ? options.rawBody
        : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined,
  });
}

function notifyAuthInvalidated(reason: string) {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('3c:auth-invalidated', { detail: { reason } }));
  }
}

export async function requestJson<T = any>(
  apiV1Path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const base = getPlatformAdapters().network.getApiBaseUrl();
  const cleanPath = apiV1Path.startsWith('/') ? apiV1Path : `/${apiV1Path}`;
  const resp = await rawFetch(`${base}${cleanPath}`, options);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const errMsg = String(data?.error || `HTTP ${resp.status}`);
    const shouldInvalidateOn401 = resp.status === 401 && !options.skipAuthInvalidationOn401;
    if (
      options.token &&
      (shouldInvalidateOn401 || (resp.status === 403 && /desativad|suspens|revogad/i.test(errMsg)))
    ) {
      getPlatformAdapters().storage.removeItem('3ccorp_auth_token');
      notifyAuthInvalidated(errMsg);
    }
    const err: any = new Error(errMsg);
    if (data?.code) err.code = data.code;
    if (data?.suggestedAppId) err.suggestedAppId = data.suggestedAppId;
    if (data?.canonicalRole) err.canonicalRole = data.canonicalRole;
    throw err;
  }
  return data as T;
}

export async function executeEndpoint(
  endpointPath: string,
  options: ApiRequestOptions = {}
): Promise<{ status: number; statusText: string; data: any }> {
  const root = getPlatformAdapters().network.getRootBaseUrl();
  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  const resp = await rawFetch(`${root}${cleanPath}`, options);
  const data = await resp.json().catch(() => ({}));
  return { status: resp.status, statusText: resp.statusText || 'OK', data };
}

export const httpClientApi = {
  requestJson,
  executeEndpoint,
};
