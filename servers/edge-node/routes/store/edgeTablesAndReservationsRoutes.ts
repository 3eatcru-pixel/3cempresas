import express from 'express';
import { buildSyncOutboxEntry } from '../../../../src/server/persistence/PersistenceDriver.ts';
import {
  generateHlcTimestamp,
  generateIdempotencyKey,
  generateTableId,
  hasReservationConflict,
} from '@3c/commerce-engine';
import {
  EDGE_POS_AND_TABLE_ROLES,
  EDGE_STAFF_ROLES,
  stripEdgePrototypePollution,
} from '../../helpers.ts';
import { EdgeRouteContext } from '../types.ts';

export function registerEdgeTablesAndReservationsRoutes(app: express.Express, ctx: EdgeRouteContext): void {
  const { nodeId, storeId, tenantId, driver, authenticateEdge, requireEdgeRoles } = ctx;

  app.get('/api/v1/store/tables', authenticateEdge, requireEdgeRoles(EDGE_STAFF_ROLES), async (_req, res) => {
    const tables = await driver.listDocs<any>('tables');
    res.json(tables.filter((t) => (!t.storeId || t.storeId === storeId) && !t._deleted));
  });

  app.post(
    '/api/v1/store/tables',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']),
    async (req, res) => {
      try {
        const rawTable = stripEdgePrototypePollution(req.body || {});
        if (rawTable.storeId && rawTable.storeId !== storeId) {
          return res.status(403).json({ error: 'Acesso negado: Mesa pertence a outra filial.' });
        }
        const VALID_TABLE_STATUSES = ['FREE', 'OCCUPIED', 'RESERVED', 'BILL_REQUESTED', 'CLEANING'];
        const nextStatus = rawTable.status ? String(rawTable.status) : 'FREE';
        if (!VALID_TABLE_STATUSES.includes(nextStatus)) {
          return res.status(400).json({ error: `Status de mesa inválido: utilize [${VALID_TABLE_STATUSES.join(', ')}].` });
        }
        const tableNumber = Number(rawTable.tableNumber);
        if (!Number.isInteger(tableNumber) || tableNumber < 1) {
          return res.status(400).json({ error: 'tableNumber válido (>= 1) é obrigatório.' });
        }
        const capacity = rawTable.capacity !== undefined ? Number(rawTable.capacity) : 4;
        if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
          return res.status(400).json({ error: 'Capacidade da mesa inválida (1 a 100).' });
        }
        const id = String(rawTable.id || generateTableId());
        const savedTable = await driver.runTransaction(async (tx) => {
          const snap = await tx.get({ collectionName: 'tables', id });
          const existing = snap.exists ? snap.data() : null;
          if (existing && existing.storeId && existing.storeId !== storeId) {
            const err: any = new Error('Acesso negado: Mesa pertence a outra filial.');
            err.statusCode = 403;
            throw err;
          }
          const hlc = generateHlcTimestamp(nodeId);
          const nextDoc = {
            ...(existing || {}),
            id,
            storeId,
            tenantId,
            tableNumber,
            capacity,
            status: nextStatus,
            activeItemsCount: existing?.activeItemsCount ?? Number(rawTable.activeItemsCount || 0),
            totalAmount: existing?.totalAmount ?? Number(rawTable.totalAmount || 0),
            _deleted: false,
            hlc,
            updatedAt: new Date().toISOString(),
          };
          tx.set({ collectionName: 'tables', id }, nextDoc, { merge: true });
          const outbox = buildSyncOutboxEntry({
            entity: 'tables',
            entityId: id,
            operation: 'UPSERT',
            tenantId,
            storeId,
            nodeId,
            hlc,
            idempotencyKey: generateIdempotencyKey(),
            payload: nextDoc,
          });
          tx.set({ collectionName: 'sync_outbox', id: outbox.id }, outbox, { merge: false });
          return nextDoc;
        });
        return res.json({ success: true, table: savedTable });
      } catch (err: any) {
        return res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar mesa no Edge.' });
      }
    }
  );

  app.delete(
    '/api/v1/store/tables/:id',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']),
    async (req, res) => {
      try {
        const { id } = req.params;
        await driver.runTransaction(async (tx) => {
          const snap = await tx.get({ collectionName: 'tables', id });
          const existing = snap.exists ? snap.data() : null;
          if (!existing || existing._deleted) {
            const err: any = new Error('Mesa não encontrada no Edge Node.');
            err.statusCode = 404;
            throw err;
          }
          if (existing.storeId && existing.storeId !== storeId) {
            const err: any = new Error('Acesso negado: Mesa pertence a outra filial.');
            err.statusCode = 403;
            throw err;
          }
          const hlc = generateHlcTimestamp(nodeId);
          const nowIso = new Date().toISOString();
          tx.set(
            { collectionName: 'tables', id },
            { ...existing, id, _deleted: true, deletedAt: nowIso, hlc, updatedAt: nowIso },
            { merge: true }
          );
          const outbox = buildSyncOutboxEntry({
            entity: 'tables',
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
        return res.json({ success: true, deletedId: id });
      } catch (err: any) {
        return res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao deletar mesa no Edge.' });
      }
    }
  );

  app.put(
    '/api/v1/store/tables/:id/status',
    authenticateEdge,
    requireEdgeRoles(EDGE_POS_AND_TABLE_ROLES),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body || {};
        const ALLOWED_TABLE_STATUSES = ['FREE', 'OCCUPIED', 'RESERVED', 'BILL_REQUESTED', 'CLEANING'];
        if (!status || typeof status !== 'string' || !ALLOWED_TABLE_STATUSES.includes(status)) {
          return res.status(400).json({
            error: `Status de mesa inválido. Valores permitidos: ${ALLOWED_TABLE_STATUSES.join(', ')}.`,
          });
        }
        const updated = await driver.runTransaction(async (tx) => {
          const snap = await tx.get({ collectionName: 'tables', id });
          const existing = snap.exists ? snap.data() : null;
          if (!existing || existing._deleted) {
            const err: any = new Error(`Mesa '${id}' não encontrada no Edge Node.`);
            err.statusCode = 404;
            throw err;
          }
          if (existing.storeId && existing.storeId !== storeId) {
            const err: any = new Error('Mesa pertence a outra filial.');
            err.statusCode = 403;
            throw err;
          }
          const hlc = generateHlcTimestamp(nodeId);
          const nextTable = {
            ...existing,
            status,
            storeId,
            tenantId,
            hlc,
            updatedAt: new Date().toISOString(),
          };
          tx.set({ collectionName: 'tables', id }, nextTable, { merge: true });
          const outbox = buildSyncOutboxEntry({
            entity: 'tables',
            entityId: id,
            operation: 'UPSERT',
            tenantId,
            storeId,
            nodeId,
            hlc,
            idempotencyKey: generateIdempotencyKey(),
            payload: nextTable,
          });
          tx.set({ collectionName: 'sync_outbox', id: outbox.id }, outbox, { merge: false });
          return nextTable;
        });
        return res.json({ success: true, table: updated });
      } catch (err: any) {
        return res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao atualizar mesa no Edge Node.' });
      }
    }
  );

  app.post(
    '/api/v1/store/tables/request-bill',
    authenticateEdge,
    requireEdgeRoles([...EDGE_POS_AND_TABLE_ROLES, 'CUSTOMER', 'CONSUMER']),
    async (req, res) => {
      try {
        const { storeId: bodyStoreId = storeId, tableNumber } = req.body || {};
        const parsedTable = Number(tableNumber);
        if (!Number.isInteger(parsedTable) || parsedTable < 1) {
          return res.status(400).json({ error: 'tableNumber válido (>= 1) é obrigatório.' });
        }
        if (bodyStoreId !== storeId) {
          return res.status(403).json({ error: 'Mesa pertence a outra filial.' });
        }
        const tableId = await driver.runTransaction(async (tx) => {
          const tables = await driver.listDocs<any>('tables');
          const target = tables.find(
            (t) => !t._deleted && t.tableNumber === parsedTable && (!t.storeId || t.storeId === storeId)
          );
          if (!target) return null;
          const hlc = generateHlcTimestamp(nodeId);
          const updated = {
            ...target,
            status: 'BILL_REQUESTED',
            storeId,
            tenantId,
            hlc,
            updatedAt: new Date().toISOString(),
          };
          tx.set({ collectionName: 'tables', id: target.id }, updated, { merge: true });
          const outbox = buildSyncOutboxEntry({
            entity: 'tables',
            entityId: target.id,
            operation: 'UPSERT',
            tenantId,
            storeId,
            nodeId,
            hlc,
            idempotencyKey: generateIdempotencyKey(),
            payload: updated,
          });
          tx.set({ collectionName: 'sync_outbox', id: outbox.id }, outbox, { merge: false });
          return target.id;
        });
        return res.json({ success: true, tableId });
      } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Erro ao solicitar fechamento da mesa no Edge.' });
      }
    }
  );

  app.get('/api/v1/store/reservations', authenticateEdge, requireEdgeRoles(EDGE_POS_AND_TABLE_ROLES), async (_req, res) => {
    const reservations = await driver.listDocs<any>('reservations');
    res.json(reservations.filter((r) => (!r.storeId || r.storeId === storeId) && !r._deleted));
  });

  app.post('/api/v1/store/reservations', authenticateEdge, requireEdgeRoles(EDGE_POS_AND_TABLE_ROLES), async (req, res) => {
    try {
      const payload = stripEdgePrototypePollution(req.body || {});
      const rawDateTime = String(payload.dateTime || '').trim();
      let date = String(payload.date || '').trim();
      let time = String(payload.time || '').trim();
      if ((!date || !time) && rawDateTime) {
        if (rawDateTime.includes('T')) {
          const [d, tPart] = rawDateTime.split('T');
          date = date || d;
          time = time || (tPart || '').slice(0, 5);
        } else {
          const parts = rawDateTime.split(/\s+/);
          date = date || parts[0] || '';
          time = time || (parts[1] || '').slice(0, 5);
        }
      }
      const dateTime = rawDateTime || (date && time ? `${date}T${time}:00.000Z` : '');
      if (!date || !time) {
        return res.status(400).json({ error: 'Data e horário (date/time ou dateTime) são obrigatórios para reserva.' });
      }
      const durationMinutes = Math.max(15, Number(payload.durationMinutes ?? payload.durationMin) || 90);
      const id = String(payload.id || `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);

      const reservation = await driver.runTransaction(async (tx) => {
        const existingReservations = (await driver.listDocs<any>('reservations')).filter(
          (r) => (!r.storeId || r.storeId === storeId) && !r._deleted
        );

        if (
          hasReservationConflict(existingReservations, {
            id,
            storeId,
            date,
            time,
            dateTime,
            professional: payload.professional || payload.professionalId,
            tableNumber: payload.tableNumber !== undefined ? Number(payload.tableNumber) : undefined,
            serviceOrTable: payload.serviceOrTable,
            durationMinutes,
          })
        ) {
          const conflictErr: any = new Error(
            'Conflito de agenda no Edge Node: já existe reserva confirmada neste horário.'
          );
          conflictErr.statusCode = 409;
          throw conflictErr;
        }

        const hlc = generateHlcTimestamp(nodeId);
        const nextReservation = {
          ...payload,
          id,
          tenantId,
          storeId,
          date,
          time,
          dateTime,
          durationMinutes,
          status: payload.status || 'CONFIRMED',
          hlc,
          createdAt: payload.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        tx.set({ collectionName: 'reservations', id }, nextReservation, { merge: true });
        const outbox = buildSyncOutboxEntry({
          entity: 'reservations',
          entityId: id,
          operation: 'UPSERT',
          tenantId,
          storeId,
          nodeId,
          hlc,
          idempotencyKey: generateIdempotencyKey(),
          payload: nextReservation,
        });
        tx.set({ collectionName: 'sync_outbox', id: outbox.id }, outbox, { merge: false });
        return nextReservation;
      });

      return res.status(201).json({ success: true, reservation });
    } catch (err: any) {
      return res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar reserva no Edge Node.' });
    }
  });

  app.delete('/api/v1/store/reservations/:id', authenticateEdge, async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const { id } = req.params;
      await driver.runTransaction(async (tx) => {
        const snap = await tx.get({ collectionName: 'reservations', id });
        const prev = snap.exists ? snap.data() : null;
        if (!prev || prev._deleted) {
          const err: any = new Error('Reserva não encontrada no Edge Node.');
          err.statusCode = 404;
          throw err;
        }
        if (authenticatedUser.role === 'CUSTOMER' || authenticatedUser.role === 'CONSUMER') {
          if (prev.customerId !== authenticatedUser.uid) {
            const err: any = new Error('Acesso negado: Reserva pertence a outro cliente.');
            err.statusCode = 403;
            throw err;
          }
        } else if (!EDGE_POS_AND_TABLE_ROLES.includes(authenticatedUser.role)) {
          const err: any = new Error('Acesso negado para cancelar reserva.');
          err.statusCode = 403;
          throw err;
        } else if (prev.storeId && prev.storeId !== storeId) {
          const err: any = new Error('Acesso negado: Reserva pertence a outra filial.');
          err.statusCode = 403;
          throw err;
        }
        const hlc = generateHlcTimestamp(nodeId);
        const nowIso = new Date().toISOString();
        tx.set(
          { collectionName: 'reservations', id },
          { ...prev, id, _deleted: true, deletedAt: nowIso, hlc, updatedAt: nowIso },
          { merge: true }
        );
        const outbox = buildSyncOutboxEntry({
          entity: 'reservations',
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
      return res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao deletar reserva no Edge Node.' });
    }
  });
}
