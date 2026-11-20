import express from 'express';
import { buildSyncOutboxEntry } from '../../../../src/server/persistence/PersistenceDriver.ts';
import {
  generateHlcTimestamp,
  generateIdempotencyKey,
  generateStandardId,
} from '@3c/commerce-engine';
import {
  generateEdgeWaiterPin,
  normalizeEdgeWaiterPin,
  stripEdgePrototypePollution,
  timingSafeEqualEdge,
} from '../../helpers.ts';
import { EdgeRouteContext } from '../types.ts';

const WAITER_EDGE_ADMIN_ROLES = [
  'DEV_OWNER',
  'SUPER_ADMIN',
  'REGIONAL_MANAGER',
  'STORE_OWNER',
  'STORE_MANAGER',
  'CASHIER',
];

export function registerEdgeWaiterAndCrmRoutes(app: express.Express, ctx: EdgeRouteContext): void {
  const { nodeId, storeId, tenantId, driver, authenticateEdge, requireEdgeRoles } = ctx;

  app.get('/api/v1/store/:id/waiter-pairing', authenticateEdge, requireEdgeRoles(WAITER_EDGE_ADMIN_ROLES), async (req, res) => {
    try {
      const { id } = req.params;
      if (id !== storeId) {
        return res.status(403).json({ error: 'Acesso negado: Loja pertence a outra filial.' });
      }
      const outcome = await driver.runTransaction(async (tx) => {
        const storeSnap = await tx.get({ collectionName: 'stores', id });
        const storeData = storeSnap.exists ? storeSnap.data() : { id, tenantId, name: id };
        if (storeData?._deleted) {
          return { ok: false as const, status: 404, error: `Loja '${id}' não encontrada.` };
        }
        if (
          String(storeData?.status || 'ACTIVE').toUpperCase() === 'SUSPENDED' ||
          String(storeData?.tenantStatus || 'ACTIVE').toUpperCase() === 'SUSPENDED'
        ) {
          return { ok: false as const, status: 403, error: 'Acesso bloqueado: estabelecimento suspenso.' };
        }
        let pin = storeData.waiterPairingPin;
        let updatedAt = storeData.waiterPairingPinUpdatedAt || storeData.updatedAt || new Date().toISOString();
        if (!pin || normalizeEdgeWaiterPin(pin).length < 6) {
          pin = generateEdgeWaiterPin();
          updatedAt = new Date().toISOString();
          tx.set(
            { collectionName: 'stores', id },
            { ...storeData, waiterPairingPin: pin, waiterPairingPinUpdatedAt: updatedAt },
            { merge: true }
          );
        }
        return { ok: true as const, storeName: storeData.name || id, pin, updatedAt };
      });
      if (!outcome.ok) {
        return res.status(outcome.status).json({ error: outcome.error });
      }
      return res.json({ storeId: id, storeName: outcome.storeName, pin: outcome.pin, updatedAt: outcome.updatedAt });
    } catch {
      return res.status(500).json({ error: 'Erro ao consultar PIN de pareamento no Edge Node.' });
    }
  });

  app.post(
    '/api/v1/store/:id/waiter-pairing/regenerate',
    authenticateEdge,
    requireEdgeRoles(WAITER_EDGE_ADMIN_ROLES),
    async (req, res) => {
      try {
        const { id } = req.params;
        if (id !== storeId) {
          return res.status(403).json({ error: 'Acesso negado: Loja pertence a outra filial.' });
        }
        const pin = generateEdgeWaiterPin();
        const updatedAt = new Date().toISOString();
        const txOutcome = await driver.runTransaction(async (tx) => {
          const storeSnap = await tx.get({ collectionName: 'stores', id });
          const storeData = storeSnap.exists ? storeSnap.data() : { id, tenantId };
          if (storeData?._deleted) {
            return { ok: false as const, status: 404, error: `Loja '${id}' não encontrada.` };
          }
          if (
            String(storeData?.status || 'ACTIVE').toUpperCase() === 'SUSPENDED' ||
            String(storeData?.tenantStatus || 'ACTIVE').toUpperCase() === 'SUSPENDED'
          ) {
            return { ok: false as const, status: 403, error: 'Acesso bloqueado: estabelecimento suspenso.' };
          }
          tx.set(
            { collectionName: 'stores', id },
            {
              ...storeData,
              waiterPairingPin: pin,
              waiterPairingPinUpdatedAt: updatedAt,
              waiterPinAttempts: 0,
              waiterPinLockedUntil: null,
            },
            { merge: true }
          );
          return { ok: true as const };
        });
        if (!txOutcome.ok) {
          return res.status(txOutcome.status).json({ error: txOutcome.error });
        }
        return res.json({ success: true, storeId: id, pin, updatedAt });
      } catch {
        return res.status(500).json({ error: 'Erro ao regenerar PIN de pareamento no Edge Node.' });
      }
    }
  );

  app.post(
    '/api/v1/store/:id/waiter-pairing/verify',
    authenticateEdge,
    requireEdgeRoles([...WAITER_EDGE_ADMIN_ROLES, 'WAITER']),
    async (req, res) => {
      try {
        const { id } = req.params;
        if (id !== storeId) {
          return res.status(403).json({ error: 'Acesso negado: Loja pertence a outra filial.' });
        }
        const outcome = await driver.runTransaction(async (tx) => {
          const storeSnap = await tx.get({ collectionName: 'stores', id });
          const storeData = (storeSnap.exists ? storeSnap.data() : null) || {};
          if (storeData._deleted) {
            return { ok: false as const, status: 404, error: `Loja '${id}' não encontrada.` };
          }
          if (
            String(storeData.status || 'ACTIVE').toUpperCase() === 'SUSPENDED' ||
            String(storeData.tenantStatus || 'ACTIVE').toUpperCase() === 'SUSPENDED'
          ) {
            return { ok: false as const, status: 403, error: 'Acesso bloqueado: estabelecimento suspenso.' };
          }
          if (storeData.waiterPinLockedUntil && new Date(storeData.waiterPinLockedUntil).getTime() > Date.now()) {
            return {
              ok: false as const,
              status: 429,
              error: 'Pareamento por PIN temporariamente bloqueado por excesso de tentativas. Regenere o PIN no Store OS.',
            };
          }
          const expected = normalizeEdgeWaiterPin(storeData.waiterPairingPin);
          const submitted = normalizeEdgeWaiterPin(req.body?.pin);
          if (!expected) {
            return { ok: false as const, status: 401, error: 'PIN de pareamento ainda não gerado no Edge Node.' };
          }
          if (!submitted || submitted.length !== expected.length || !timingSafeEqualEdge(submitted, expected)) {
            const nextAttempts = (Number(storeData.waiterPinAttempts) || 0) + 1;
            const locked = nextAttempts >= 5;
            tx.set(
              { collectionName: 'stores', id },
              {
                ...storeData,
                waiterPinAttempts: nextAttempts,
                ...(locked ? { waiterPinLockedUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString() } : {}),
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
            return {
              ok: false as const,
              status: locked ? 429 : 401,
              error: locked
                ? 'Limite de tentativas inválidas atingido. Pareamento bloqueado por 15 minutos.'
                : 'PIN de pareamento inválido. Confira o código exibido no Store OS.',
            };
          }
          if (storeData.waiterPinAttempts || storeData.waiterPinLockedUntil) {
            tx.set(
              { collectionName: 'stores', id },
              { ...storeData, waiterPinAttempts: 0, waiterPinLockedUntil: null },
              { merge: true }
            );
          }
          return {
            ok: true as const,
            storeName: storeData.name || id,
          };
        });
        if (!outcome.ok) {
          return res.status(outcome.status).json({ error: outcome.error });
        }
        return res.json({
          success: true,
          verified: true,
          storeId: id,
          storeName: outcome.storeName,
        });
      } catch {
        return res.status(500).json({ error: 'Erro ao validar PIN de pareamento no Edge Node.' });
      }
    }
  );

  app.get(
    '/api/v1/store/customers',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER']),
    async (_req, res) => {
      const custs = await driver.listDocs<any>('customers_crm');
      return res.json(custs.filter((c) => !c._deleted && (!c.storeId || c.storeId === storeId)));
    }
  );

  app.post(
    '/api/v1/store/customers',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER']),
    async (req, res) => {
      try {
        const rawCustomer = stripEdgePrototypePollution(req.body || {});
        if (rawCustomer.storeId && rawCustomer.storeId !== storeId) {
          return res.status(403).json({ error: 'Cliente pertence a outra filial.' });
        }
        const id = String(rawCustomer.id || generateStandardId('cus'));
        const savedCustomer = await driver.runTransaction(async (tx) => {
          const snap = await tx.get({ collectionName: 'customers_crm', id });
          const existing = snap.exists ? snap.data() : null;
          const hlc = generateHlcTimestamp(nodeId);
          const nextCustomer = {
            ...(existing || {}),
            ...rawCustomer,
            id,
            tenantId,
            storeId,
            hlc,
            updatedAt: new Date().toISOString(),
          };
          tx.set({ collectionName: 'customers_crm', id }, nextCustomer, { merge: true });
          const outbox = buildSyncOutboxEntry({
            entity: 'customers_crm',
            entityId: id,
            operation: 'UPSERT',
            tenantId,
            storeId,
            nodeId,
            hlc,
            idempotencyKey: generateIdempotencyKey(),
            payload: nextCustomer,
          });
          tx.set({ collectionName: 'sync_outbox', id: outbox.id }, outbox, { merge: false });
          return nextCustomer;
        });
        return res.json({ success: true, customer: savedCustomer });
      } catch (err: any) {
        return res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar cliente no Edge.' });
      }
    }
  );

  app.put(
    '/api/v1/store/customers/:id',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']),
    async (req, res) => {
      try {
        const { id } = req.params;
        const cleanUpdates = stripEdgePrototypePollution(req.body || {});
        const updatedCustomer = await driver.runTransaction(async (tx) => {
          const snap = await tx.get({ collectionName: 'customers_crm', id });
          const existing = snap.exists ? snap.data() : null;
          if (!existing || existing._deleted) {
            const err: any = new Error('Cliente CRM não encontrado no Edge Node.');
            err.statusCode = 404;
            throw err;
          }
          if (existing.storeId && existing.storeId !== storeId) {
            const err: any = new Error('Cliente pertence a outra filial.');
            err.statusCode = 403;
            throw err;
          }
          const hlc = generateHlcTimestamp(nodeId);
          const nextCustomer = {
            ...existing,
            ...cleanUpdates,
            id,
            tenantId,
            storeId: existing.storeId || storeId,
            hlc,
            updatedAt: new Date().toISOString(),
          };
          tx.set({ collectionName: 'customers_crm', id }, nextCustomer, { merge: true });
          const outbox = buildSyncOutboxEntry({
            entity: 'customers_crm',
            entityId: id,
            operation: 'UPSERT',
            tenantId,
            storeId,
            nodeId,
            hlc,
            idempotencyKey: generateIdempotencyKey(),
            payload: nextCustomer,
          });
          tx.set({ collectionName: 'sync_outbox', id: outbox.id }, outbox, { merge: false });
          return nextCustomer;
        });
        return res.json({ success: true, customer: updatedCustomer });
      } catch (err: any) {
        return res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao atualizar cliente no Edge.' });
      }
    }
  );

  app.get(
    '/api/v1/store/suppliers',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']),
    async (_req, res) => {
      const sups = await driver.listDocs<any>('suppliers');
      return res.json(sups.filter((s) => !s._deleted && (!s.storeId || s.storeId === storeId)));
    }
  );

  app.post(
    '/api/v1/store/suppliers',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']),
    async (req, res) => {
      try {
        const rawSupplier = stripEdgePrototypePollution(req.body || {});
        if (rawSupplier.storeId && rawSupplier.storeId !== storeId) {
          return res.status(403).json({ error: 'Fornecedor pertence a outra filial.' });
        }
        const id = String(rawSupplier.id || generateStandardId('sup'));
        const savedSupplier = await driver.runTransaction(async (tx) => {
          const snap = await tx.get({ collectionName: 'suppliers', id });
          const existing = snap.exists ? snap.data() : null;
          const hlc = generateHlcTimestamp(nodeId);
          const nextSupplier = {
            ...(existing || {}),
            ...rawSupplier,
            id,
            tenantId,
            storeId,
            hlc,
            updatedAt: new Date().toISOString(),
          };
          tx.set({ collectionName: 'suppliers', id }, nextSupplier, { merge: true });
          const outbox = buildSyncOutboxEntry({
            entity: 'suppliers',
            entityId: id,
            operation: 'UPSERT',
            tenantId,
            storeId,
            nodeId,
            hlc,
            idempotencyKey: generateIdempotencyKey(),
            payload: nextSupplier,
          });
          tx.set({ collectionName: 'sync_outbox', id: outbox.id }, outbox, { merge: false });
          return nextSupplier;
        });
        return res.json({ success: true, supplier: savedSupplier });
      } catch (err: any) {
        return res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar fornecedor no Edge.' });
      }
    }
  );

  app.delete(
    '/api/v1/store/suppliers/:id',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']),
    async (req, res) => {
      try {
        const { id } = req.params;
        await driver.runTransaction(async (tx) => {
          const snap = await tx.get({ collectionName: 'suppliers', id });
          const existing = snap.exists ? snap.data() : null;
          if (!existing || existing._deleted) {
            const err: any = new Error('Fornecedor não encontrado no Edge Node.');
            err.statusCode = 404;
            throw err;
          }
          if (existing.storeId && existing.storeId !== storeId) {
            const err: any = new Error('Acesso negado: Fornecedor pertence a outra filial.');
            err.statusCode = 403;
            throw err;
          }
          const hlc = generateHlcTimestamp(nodeId);
          const nowIso = new Date().toISOString();
          tx.set(
            { collectionName: 'suppliers', id },
            { ...existing, id, _deleted: true, deletedAt: nowIso, hlc, updatedAt: nowIso },
            { merge: true }
          );
          const outbox = buildSyncOutboxEntry({
            entity: 'suppliers',
            entityId: id,
            operation: 'DELETE',
            tenantId,
            storeId,
            nodeId,
            hlc,
            idempotencyKey: generateIdempotencyKey(),
            payload: { id, _deleted: true },
          });
          tx.set({ collectionName: 'sync_outbox', id: outbox.id }, outbox, { merge: false });
        });
        return res.json({ success: true });
      } catch (err: any) {
        return res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao remover fornecedor no Edge Node.' });
      }
    }
  );
}
