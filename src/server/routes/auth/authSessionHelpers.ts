import type express from 'express';
import { db } from '../../config.ts';

export const DEDICATED_PRODUCT_IDS = new Set([
  'marketplace',
  'store-os',
  'driver',
  'waiter',
  'hq',
  'server-core',
]);

export function resolveStrictProductAppId(req: express.Request, bodyContextId?: unknown): string | null {
  const rawHeader = String(
    req.headers['x-3c-app-id'] || (req as any).clientContext?.appId || ''
  )
    .trim()
    .toLowerCase();
  const headerAppId = rawHeader === 'hq-central' ? 'hq' : rawHeader;
  if (DEDICATED_PRODUCT_IDS.has(headerAppId)) {
    return headerAppId;
  }
  const rawBody = String(bodyContextId || '')
    .trim()
    .toLowerCase();
  const requestedContext = rawBody === 'hq-central' ? 'hq' : rawBody;
  if (DEDICATED_PRODUCT_IDS.has(requestedContext)) {
    return requestedContext;
  }
  return null;
}

export async function validateCorporateTenantStatus(
  profile: Record<string, any>
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const normalizedRole = String(profile.role || '').toUpperCase();
  if (
    normalizedRole === 'DEV_OWNER' ||
    normalizedRole === 'CUSTOMER' ||
    normalizedRole === 'CONSUMER'
  ) {
    return { ok: true };
  }

  const userTenant = typeof profile.tenantId === 'string' ? profile.tenantId.trim() : '';
  if (!userTenant) {
    return {
      ok: false,
      status: 403,
      error: 'Acesso bloqueado: Conta corporativa sem tenantId válido.',
    };
  }

  const tenantSnap = await db.collection('tenants').doc(userTenant).get();
  if (!tenantSnap.exists) {
    return {
      ok: false,
      status: 403,
      error: 'Acesso bloqueado: Empresa/Tenant não encontrada.',
    };
  }

  const tenantStatus = String(tenantSnap.data()?.status || 'ACTIVE').toUpperCase();
  if (tenantStatus === 'SUSPENDED') {
    return {
      ok: false,
      status: 403,
      error: 'Acesso bloqueado: Empresa temporariamente suspensa na plataforma.',
    };
  }
  if (tenantStatus !== 'ACTIVE') {
    return {
      ok: false,
      status: 403,
      error: `Acesso bloqueado: Empresa em estado inválido (${tenantStatus}).`,
    };
  }

  return { ok: true };
}

export function suggestAppIdForRole(canonicalRole: string): string {
  if (
    canonicalRole === 'STORE_OWNER' ||
    canonicalRole === 'STORE_MANAGER' ||
    canonicalRole === 'REGIONAL_MANAGER' ||
    canonicalRole === 'CASHIER' ||
    canonicalRole === 'KITCHEN_STAFF'
  ) {
    return 'store-os';
  }
  if (canonicalRole === 'COURIER' || canonicalRole === 'DRIVER') {
    return 'driver';
  }
  if (canonicalRole === 'WAITER') {
    return 'waiter';
  }
  return 'marketplace';
}

export function buildRoleAppForbiddenPayload(
  canonicalRole: string,
  targetAppId: string,
  source: 'login' | 'firebase-exchange'
): Record<string, any> {
  const isInternalGovernanceRole =
    canonicalRole === 'DEV_OWNER' || canonicalRole === 'SUPER_ADMIN';
  if (isInternalGovernanceRole) {
    return {
      code: 'APP_ROLE_FORBIDDEN',
      error: `Acesso negado: esta conta não é autorizada para o aplicativo '${targetAppId}'.`,
    };
  }

  const suggestedAppId = suggestAppIdForRole(canonicalRole);
  if (source === 'firebase-exchange') {
    return {
      code: 'APP_ROLE_FORBIDDEN',
      canonicalRole,
      suggestedAppId,
      error: `Acesso negado: Sua conta Google pertence ao perfil '${canonicalRole}' e deve entrar pelo aplicativo '${suggestedAppId}'.`,
    };
  }

  return {
    code: 'APP_ROLE_FORBIDDEN',
    suggestedAppId,
    error: `Acesso negado: Perfil '${canonicalRole}' não é autorizado para o produto '${targetAppId}'. Utilize o aplicativo correspondente.`,
  };
}
