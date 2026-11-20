import express from 'express';
import { buildSyncOutboxEntry } from '../../../../src/server/persistence/PersistenceDriver.ts';
import { generateHlcTimestamp, generateIdempotencyKey } from '@3c/commerce-engine';
import { stripEdgePrototypePollution } from '../../helpers.ts';
import { EdgeRouteContext } from '../types.ts';

const EDGE_PERIPHERAL_MANAGER_ROLES = ['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER'];
const EDGE_PERIPHERAL_READER_ROLES = [...EDGE_PERIPHERAL_MANAGER_ROLES, 'CASHIER', 'WAITER', 'KITCHEN_STAFF'];
const VALID_EDGE_PERIPHERAL_KINDS = new Set(['PRINTER', 'SCALE', 'CUSTOMER_DISPLAY', 'KDS_SCREEN']);
const VALID_EDGE_CONNECTIONS = new Set(['LAN_RAW_9100', 'USB_DEVICE', 'BLUETOOTH', 'SERIAL_COM', 'BROWSER']);
const VALID_EDGE_STATIONS = new Set(['CASHIER', 'KITCHEN', 'BAR', 'EXPEDITION', 'COUNTER', 'ALL']);
const VALID_EDGE_HEARTBEAT_STATUSES = new Set(['ONLINE', 'OFFLINE', 'PAPER_OUT', 'ERROR']);

export function registerEdgePeripheralsAndPrintRoutes(app: express.Express, ctx: EdgeRouteContext): void {
  const { nodeId, storeId, tenantId, driver, authenticateEdge, requireEdgeRoles } = ctx;

  app.get(
    '/api/v1/store/peripherals',
    authenticateEdge,
    requireEdgeRoles(EDGE_PERIPHERAL_READER_ROLES),
    async (req, res) => {
      if (req.query.storeId && String(req.query.storeId) !== storeId) {
        return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
      }
      const requestedKind = req.query.kind ? String(req.query.kind).toUpperCase() : '';
      const requestedStation = req.query.station ? String(req.query.station).toUpperCase() : '';
      const list = (await driver.listDocs<any>('peripherals')).filter(
        (p) =>
          p &&
          !p._deleted &&
          (!p.storeId || p.storeId === storeId) &&
          (!requestedKind || String(p.kind || '').toUpperCase() === requestedKind) &&
          (!requestedStation || String(p.station || '').toUpperCase() === requestedStation)
      );
      return res.json(list);
    }
  );

  app.post(
    '/api/v1/store/peripherals',
    authenticateEdge,
    requireEdgeRoles(EDGE_PERIPHERAL_MANAGER_ROLES),
    async (req, res) => {
      try {
        const authenticatedUser = (req as any).user;
        const body = stripEdgePrototypePollution(req.body || {});
        if (body.storeId && String(body.storeId) !== storeId) {
          return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
        }
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (name.length < 2) {
          return res.status(400).json({ error: 'Nome do periférico (mínimo 2 caracteres) é obrigatório.' });
        }
        const kind = String(body.kind || 'PRINTER').toUpperCase();
        if (!VALID_EDGE_PERIPHERAL_KINDS.has(kind)) {
          return res.status(400).json({ error: `Tipo inválido. Permitidos: [${Array.from(VALID_EDGE_PERIPHERAL_KINDS).join(', ')}].` });
        }
        const connectionType = String(body.connectionType || (kind === 'SCALE' ? 'SERIAL_COM' : 'LAN_RAW_9100')).toUpperCase();
        if (!VALID_EDGE_CONNECTIONS.has(connectionType)) {
          return res.status(400).json({ error: `Conexão inválida. Permitidas: [${Array.from(VALID_EDGE_CONNECTIONS).join(', ')}].` });
        }
        const station = String(body.station || 'CASHIER').toUpperCase();
        if (!VALID_EDGE_STATIONS.has(station)) {
          return res.status(400).json({ error: `Estação inválida. Permitidas: [${Array.from(VALID_EDGE_STATIONS).join(', ')}].` });
        }
        const id =
          typeof body.id === 'string' && body.id.trim()
            ? body.id.trim()
            : `periph-${kind.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const port = body.port !== undefined && body.port !== null ? Number(body.port) : connectionType === 'LAN_RAW_9100' ? 9100 : null;
        if (port !== null && (!Number.isInteger(port) || port < 1 || port > 65535)) {
          return res.status(400).json({ error: 'Porta TCP inválida (1-65535).' });
        }
        const paperWidthMm = body.paperWidthMm !== undefined ? Number(body.paperWidthMm) : 80;
        if (kind === 'PRINTER' && paperWidthMm !== 58 && paperWidthMm !== 80) {
          return res.status(400).json({ error: 'Largura de papel inválida (use 58 ou 80 mm).' });
        }
        const host = typeof body.host === 'string' ? body.host.trim() : undefined;
        const devicePath = typeof body.devicePath === 'string' ? body.devicePath.trim() : undefined;
        if (connectionType === 'LAN_RAW_9100' && !host) {
          return res.status(400).json({ error: 'Endereço IP/host é obrigatório para periférico LAN_RAW_9100.' });
        }

        const isDefault = body.isDefault === true;
        const active = body.active !== false;
        const nowIso = new Date().toISOString();

        const saved = await driver.runTransaction(async (tx) => {
          const existingSnap = await tx.get({ collectionName: 'peripherals', id });
          const existing = existingSnap.exists ? existingSnap.data() : null;
          if (isDefault) {
            const allPeriphs = await driver.listDocs<any>('peripherals');
            for (const p of allPeriphs) {
              if (
                p &&
                !p._deleted &&
                p.id !== id &&
                p.storeId === storeId &&
                p.kind === kind &&
                p.station === station &&
                p.isDefault === true
              ) {
                tx.update({ collectionName: 'peripherals', id: p.id }, { isDefault: false, updatedAt: nowIso });
              }
            }
          }
          const hlc = generateHlcTimestamp(nodeId);
          const record = {
            id,
            tenantId,
            storeId,
            name,
            kind,
            connectionType,
            station,
            host: host || existing?.host || null,
            port,
            devicePath: devicePath || existing?.devicePath || null,
            baudRate: body.baudRate !== undefined ? Number(body.baudRate) || 9600 : existing?.baudRate || null,
            paperWidthMm: kind === 'PRINTER' ? paperWidthMm : null,
            autoCut: kind === 'PRINTER' ? body.autoCut !== false : false,
            isDefault,
            active,
            status: existing?.status || 'CONFIGURED_OFFLINE',
            lastHeartbeatAt: existing?.lastHeartbeatAt || null,
            hlc,
            createdAt: existing?.createdAt || nowIso,
            updatedAt: nowIso,
            updatedByUid: authenticatedUser.uid,
          };
          tx.set({ collectionName: 'peripherals', id }, record, { merge: true });
          const outbox = buildSyncOutboxEntry({
            entity: 'peripherals',
            entityId: id,
            operation: 'UPSERT',
            tenantId,
            storeId,
            nodeId,
            hlc,
            idempotencyKey: generateIdempotencyKey(),
            payload: record,
          });
          tx.set({ collectionName: 'sync_outbox', id: outbox.id }, outbox, { merge: false });
          return record;
        });

        return res.status(200).json({ success: true, peripheral: saved });
      } catch (err: any) {
        return res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar periférico no Edge Node.' });
      }
    }
  );

  app.post(
    '/api/v1/store/peripherals/:id/heartbeat',
    authenticateEdge,
    requireEdgeRoles(EDGE_PERIPHERAL_READER_ROLES),
    async (req, res) => {
      try {
        const { id } = req.params;
        const status = String(req.body?.status || 'ONLINE').toUpperCase();
        if (!VALID_EDGE_HEARTBEAT_STATUSES.has(status)) {
          return res.status(400).json({ error: `Status inválido. Permitidos: [${Array.from(VALID_EDGE_HEARTBEAT_STATUSES).join(', ')}].` });
        }
        const nowIso = new Date().toISOString();
        const updated = await driver.runTransaction(async (tx) => {
          const snap = await tx.get({ collectionName: 'peripherals', id });
          const existing = snap.exists ? snap.data() : null;
          if (!existing || existing._deleted) {
            const err: any = new Error('Periférico não encontrado no Edge Node.');
            err.statusCode = 404;
            throw err;
          }
          if (existing.storeId && existing.storeId !== storeId) {
            const err: any = new Error('Acesso negado: Periférico pertence a outra filial.');
            err.statusCode = 403;
            throw err;
          }
          const hlc = generateHlcTimestamp(nodeId);
          const patch: Record<string, any> = {
            ...existing,
            status,
            lastHeartbeatAt: nowIso,
            hlc,
            updatedAt: nowIso,
          };
          if (typeof req.body?.lastError === 'string') {
            patch.lastError = req.body.lastError.slice(0, 200);
          }
          if (typeof req.body?.lastWeightKg === 'number' && Number.isFinite(req.body.lastWeightKg)) {
            patch.lastWeightKg = Number(req.body.lastWeightKg);
          }
          tx.set({ collectionName: 'peripherals', id }, patch, { merge: true });
          return patch;
        });
        return res.json({ success: true, id, status: updated.status, lastHeartbeatAt: nowIso });
      } catch (err: any) {
        return res.status(err?.statusCode || 500).json({ error: err?.message || 'Falha ao registrar heartbeat do periférico no Edge.' });
      }
    }
  );

  app.delete(
    '/api/v1/store/peripherals/:id',
    authenticateEdge,
    requireEdgeRoles(EDGE_PERIPHERAL_MANAGER_ROLES),
    async (req, res) => {
      try {
        const authenticatedUser = (req as any).user;
        const { id } = req.params;
        await driver.runTransaction(async (tx) => {
          const snap = await tx.get({ collectionName: 'peripherals', id });
          const existing = snap.exists ? snap.data() : null;
          if (!existing || existing._deleted) {
            const err: any = new Error('Periférico não encontrado no Edge Node.');
            err.statusCode = 404;
            throw err;
          }
          if (existing.storeId && existing.storeId !== storeId) {
            const err: any = new Error('Acesso negado: Periférico pertence a outra filial.');
            err.statusCode = 403;
            throw err;
          }
          const hlc = generateHlcTimestamp(nodeId);
          const nowIso = new Date().toISOString();
          tx.set(
            { collectionName: 'peripherals', id },
            {
              ...existing,
              _deleted: true,
              active: false,
              deletedAt: nowIso,
              deletedByUid: authenticatedUser.uid,
              hlc,
              updatedAt: nowIso,
            },
            { merge: true }
          );
          const outbox = buildSyncOutboxEntry({
            entity: 'peripherals',
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
        return res.status(err?.statusCode || 500).json({ error: err?.message || 'Falha ao remover periférico no Edge.' });
      }
    }
  );

  app.get(
    '/api/v1/store/print-jobs',
    authenticateEdge,
    requireEdgeRoles(EDGE_PERIPHERAL_READER_ROLES),
    async (req, res) => {
      if (req.query.storeId && String(req.query.storeId) !== storeId) {
        return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
      }
      const requestedStatus = req.query.status ? String(req.query.status).toUpperCase() : '';
      const requestedPeripheralId = req.query.peripheralId ? String(req.query.peripheralId) : '';
      const jobs = (await driver.listDocs<any>('print_jobs')).filter(
        (j) =>
          j &&
          !j._deleted &&
          (!j.storeId || j.storeId === storeId) &&
          (!requestedStatus || String(j.status || '').toUpperCase() === requestedStatus) &&
          (!requestedPeripheralId || j.peripheralId === requestedPeripheralId)
      );
      jobs.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      return res.json(jobs.slice(0, 100));
    }
  );

  app.post(
    '/api/v1/store/print-jobs',
    authenticateEdge,
    requireEdgeRoles(EDGE_PERIPHERAL_READER_ROLES),
    async (req, res) => {
      try {
        const authenticatedUser = (req as any).user;
        const body = stripEdgePrototypePollution(req.body || {});
        if (body.storeId && String(body.storeId) !== storeId) {
          return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
        }
        const content = typeof body.content === 'string' ? body.content : '';
        if (!content.trim()) {
          return res.status(400).json({ error: 'Conteúdo de impressão (content) não pode estar vazio.' });
        }
        const station = String(body.station || 'CASHIER').toUpperCase();
        const requestedPeripheralId = typeof body.peripheralId === 'string' ? body.peripheralId.trim() : '';

        const storePrinters = (await driver.listDocs<any>('peripherals')).filter(
          (p) => p && !p._deleted && (!p.storeId || p.storeId === storeId) && p.kind === 'PRINTER' && p.active !== false
        );

        let targetPrinter: any = null;
        if (requestedPeripheralId) {
          targetPrinter = storePrinters.find((p) => p.id === requestedPeripheralId) || null;
          if (!targetPrinter) {
            return res.status(404).json({ error: `Impressora '${requestedPeripheralId}' não encontrada ou inativa nesta loja.` });
          }
        } else {
          targetPrinter =
            storePrinters.find((p) => p.station === station && p.isDefault) ||
            storePrinters.find((p) => p.station === station) ||
            storePrinters.find((p) => p.station === 'ALL' && p.isDefault) ||
            storePrinters.find((p) => p.isDefault) ||
            storePrinters[0] ||
            null;
        }

        if (!targetPrinter && body.requireRegisteredPrinter === true) {
          return res.status(409).json({ error: `Nenhuma impressora ativa configurada para a estação '${station}'.` });
        }

        const nowIso = new Date().toISOString();
        const jobId = `pj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const job = await driver.runTransaction(async (tx) => {
          const hlc = generateHlcTimestamp(nodeId);
          const nextJob = {
            id: jobId,
            tenantId,
            storeId,
            orderId: typeof body.orderId === 'string' ? body.orderId : null,
            station,
            peripheralId: targetPrinter?.id || null,
            peripheralName: targetPrinter?.name || null,
            connectionType: targetPrinter?.connectionType || 'UNASSIGNED',
            routingMode: requestedPeripheralId ? 'EXPLICIT_PERIPHERAL' : targetPrinter ? 'STATION_DEFAULT' : 'UNASSIGNED_FALLBACK',
            content,
            bytes: Buffer.byteLength(content, 'utf8'),
            status: 'QUEUED',
            attempts: 0,
            createdByUid: authenticatedUser.uid,
            hlc,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          tx.set({ collectionName: 'print_jobs', id: jobId }, nextJob, { merge: false });
          return nextJob;
        });

        return res.status(201).json({ success: true, job });
      } catch (err: any) {
        return res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao enfileirar trabalho de impressão no Edge.' });
      }
    }
  );

  app.post(
    '/api/v1/store/print-jobs/:jobId/ack',
    authenticateEdge,
    requireEdgeRoles(EDGE_PERIPHERAL_READER_ROLES),
    async (req, res) => {
      try {
        const authenticatedUser = (req as any).user;
        const { jobId } = req.params;
        const nextStatus = String(req.body?.status || '').toUpperCase();
        if (!['DISPATCHED', 'PRINTED', 'FAILED', 'QUEUED'].includes(nextStatus)) {
          return res.status(400).json({ error: 'Status de ACK inválido. Use DISPATCHED, PRINTED, FAILED ou QUEUED.' });
        }
        const updatedJob = await driver.runTransaction(async (tx) => {
          const snap = await tx.get({ collectionName: 'print_jobs', id: jobId });
          const existing = snap.exists ? snap.data() : null;
          if (!existing || existing._deleted) {
            const err: any = new Error('Trabalho de impressão não encontrado no Edge Node.');
            err.statusCode = 404;
            throw err;
          }
          if (existing.storeId && existing.storeId !== storeId) {
            const err: any = new Error('Acesso negado: Trabalho de impressão pertence a outra filial.');
            err.statusCode = 403;
            throw err;
          }
          const nowIso = new Date().toISOString();
          const hlc = generateHlcTimestamp(nodeId);
          const patch: Record<string, any> = {
            ...existing,
            status: nextStatus,
            attempts: Number(existing.attempts || 0) + (nextStatus === 'PRINTED' || nextStatus === 'FAILED' ? 1 : 0),
            updatedAt: nowIso,
            ackedByUid: authenticatedUser.uid,
            hlc,
          };
          if (nextStatus === 'PRINTED') {
            patch.printedAt = nowIso;
            patch.lastError = null;
          } else if (nextStatus === 'FAILED') {
            patch.lastError = typeof req.body?.error === 'string' ? req.body.error.slice(0, 250) : 'Falha reportada pelo agente de impressão';
          }
          tx.set({ collectionName: 'print_jobs', id: jobId }, patch, { merge: true });
          return patch;
        });
        return res.json({ success: true, job: updatedJob });
      } catch (err: any) {
        return res.status(err?.statusCode || 500).json({ error: err?.message || 'Falha ao confirmar trabalho de impressão no Edge.' });
      }
    }
  );
}
