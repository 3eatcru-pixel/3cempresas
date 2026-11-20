import { AsyncLocalStorage } from 'node:async_hooks';

export interface DbExecutionContext {
  tenantId?: string | null;
  bypassRls?: boolean;
  reason?: string;
}

const dbContextStorage = new AsyncLocalStorage<DbExecutionContext>();

export function runWithDbContext<T>(ctx: DbExecutionContext, fn: () => T): T {
  return dbContextStorage.run(ctx, fn);
}

export function runWithSystemDbContext<T>(reason: string, fn: () => T): T {
  return dbContextStorage.run({ tenantId: null, bypassRls: true, reason }, fn);
}

export function runWithTenantDbContext<T>(tenantId: string, fn: () => T, reason = 'TENANT_SCOPED'): T {
  return dbContextStorage.run({ tenantId, bypassRls: false, reason }, fn);
}

export function getActiveDbContext(): DbExecutionContext | undefined {
  return dbContextStorage.getStore();
}

export function resolveEffectiveDbContext(explicit?: DbExecutionContext): {
  tenantId: string | null;
  bypassRls: boolean;
  reason?: string;
} {
  const active = dbContextStorage.getStore();
  if (explicit) {
    if (explicit.bypassRls === true) {
      return { tenantId: null, bypassRls: true, reason: explicit.reason || active?.reason };
    }
    if (explicit.tenantId !== undefined) {
      const trimmed = typeof explicit.tenantId === 'string' ? explicit.tenantId.trim() : '';
      return { tenantId: trimmed || null, bypassRls: false, reason: explicit.reason || active?.reason };
    }
  }
  if (active) {
    const bypass = active.bypassRls === true;
    const trimmed = typeof active.tenantId === 'string' ? active.tenantId.trim() : '';
    return {
      tenantId: bypass ? null : (trimmed || null),
      bypassRls: bypass,
      reason: active.reason,
    };
  }
  // Fail-closed when invoked outside an explicit/authenticated DB context
  return { tenantId: null, bypassRls: false, reason: 'FAIL_CLOSED_UNBOUND' };
}
