import express from 'express';
import {
  buildStockLedgerEntry,
  buildSyncOutboxEntry,
} from '../../../../src/server/persistence/PersistenceDriver.ts';
import {
  generateHlcTimestamp,
  generateIdempotencyKey,
  generateStandardId,
} from '@3c/commerce-engine';
import { stripEdgePrototypePollution } from '../../helpers.ts';
import { EdgeRouteContext } from '../types.ts';

export function registerEdgeInventoryAndFinanceRoutes(app: express.Express, ctx: EdgeRouteContext): void {
  const { nodeId, storeId, tenantId, driver, authenticateEdge, requireEdgeRoles } = ctx;

  app.get(
    '/api/v1/store/inventory',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'KITCHEN_STAFF', 'CASHIER']),
    async (_req, res) => {
      const batches = await driver.listDocs<any>('inventory_batches');
      res.json(batches.filter((b) => (!b.storeId || b.storeId === storeId) && !b._deleted));
    }
  );

  app.post(
    '/api/v1/store/inventory',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'KITCHEN_STAFF']),
    async (req, res) => {
      try {
        const cleanInvBody = stripEdgePrototypePollution(req.body || {});
        if (cleanInvBody.storeId && cleanInvBody.storeId !== storeId) {
          return res.status(403).json({ error: 'Acesso negado: Lote pertence a outra filial.' });
        }
        const { batchId, id: rawBodyId, sku, name, itemName, quantityDelta, quantity, unit = 'UN', minQuantity = 0 } = cleanInvBody;
        const isDeltaMode = quantityDelta !== undefined && quantityDelta !== null;
        const isFullBatchMode = quantity !== undefined && quantity !== null;

        if (!isDeltaMode && !isFullBatchMode) {
          return res.status(400).json({ error: 'quantityDelta ou quantity numérico obrigatório.' });
        }

        if (isDeltaMode) {
          if (!batchId && !sku) {
            return res.status(400).json({ error: 'batchId ou sku obrigatório.' });
          }
          if (!Number.isFinite(Number(quantityDelta))) {
            return res.status(400).json({ error: 'quantityDelta numérico obrigatório.' });
          }
        } else {
          for (const { key, label } of [
            { key: 'quantity', label: 'Quantidade' },
            { key: 'costPrice', label: 'Preço de custo' },
            { key: 'costPerUnit', label: 'Custo unitário' },
            { key: 'minQuantity', label: 'Estoque mínimo' },
          ]) {
            if (cleanInvBody[key] !== undefined && cleanInvBody[key] !== null) {
              const v = Number(cleanInvBody[key]);
              if (!Number.isFinite(v) || v < 0) {
                return res.status(400).json({ error: `Valor inválido para ${label} (${key}): deve ser >= 0.` });
              }
            }
          }
        }

        const targetId = String(
          rawBodyId || batchId || (sku ? `bat_${sku}_${storeId}` : generateStandardId('bat'))
        );
        const result = await driver.runTransaction(async (tx) => {
          const snap = await tx.get({ collectionName: 'inventory_batches', id: targetId });
          const existing = snap.exists ? snap.data() : null;
          if (existing && existing.storeId && existing.storeId !== storeId) {
            const err: any = new Error('Lote pertence a outra filial.');
            err.statusCode = 403;
            throw err;
          }
          const prevQty = Number(existing?.quantity) || 0;
          const nextQty = isDeltaMode
            ? Math.round((prevQty + Number(quantityDelta)) * 1000) / 1000
            : Math.round(Number(quantity) * 1000) / 1000;
          if (nextQty < 0) {
            throw new Error(`Saldo insuficiente no lote '${targetId}': disponível ${prevQty}.`);
          }
          const delta = Math.round((nextQty - prevQty) * 1000) / 1000;
          const hlc = generateHlcTimestamp(nodeId);
          const resolvedName = name || itemName || existing?.name || existing?.itemName || sku || targetId;
          const updatedBatch = {
            ...(existing || {}),
            ...(!isDeltaMode ? cleanInvBody : {}),
            id: targetId,
            tenantId,
            storeId,
            sku: sku || existing?.sku || targetId,
            name: resolvedName,
            unit: cleanInvBody.unit || existing?.unit || unit,
            minQuantity: cleanInvBody.minQuantity ?? existing?.minQuantity ?? minQuantity,
            quantity: nextQty,
            _deleted: false,
            hlc,
            updatedAt: new Date().toISOString(),
          };
          tx.set({ collectionName: 'inventory_batches', id: targetId }, updatedBatch, { merge: true });

          if (delta !== 0 || isDeltaMode) {
            const ledger = buildStockLedgerEntry({
              tenantId,
              storeId,
              itemType: 'RAW_BATCH',
              targetId,
              sku: updatedBatch.sku,
              itemName: resolvedName,
              deltaQty: delta,
              previousQty: prevQty,
              balanceAfter: nextQty,
              reason: delta >= 0 ? 'RESTOCK' : 'ADJUSTMENT',
              nodeId,
              hlc,
            });
            tx.set({ collectionName: 'stock_ledger', id: ledger.id }, ledger, { merge: false });
          }

          const outbox = {
            ...buildSyncOutboxEntry({
              entity: 'inventory_batches',
              entityId: targetId,
              operation: 'UPSERT',
              tenantId,
              storeId,
              nodeId,
              hlc,
              idempotencyKey: generateIdempotencyKey(),
              payload: updatedBatch,
            }),
            ...(delta !== 0 ? { deltaQty: delta } : {}),
          };
          tx.set({ collectionName: 'sync_outbox', id: outbox.id }, outbox, { merge: false });

          return updatedBatch;
        });

        res.json({ success: true, batch: result });
      } catch (err: any) {
        res.status(err?.statusCode || 400).json({ error: err?.message || 'Erro ao movimentar estoque no Edge Node.' });
      }
    }
  );

  app.get(
    '/api/v1/store/cash/session',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER']),
    async (req, res) => {
      if (req.query.storeId && String(req.query.storeId) !== storeId) {
        return res.status(403).json({ error: 'Sessão pertence a outra filial.' });
      }
      const sessions = await driver.listDocs<any>('cash_sessions');
      const openSession =
        sessions
          .filter((s) => !s._deleted && s.storeId === storeId && s.status === 'OPEN')
          .sort((a, b) => new Date(b.openedAt || b.updatedAt || 0).getTime() - new Date(a.openedAt || a.updatedAt || 0).getTime())[0] ||
        null;
      return res.json(openSession);
    }
  );

  app.post(
    '/api/v1/store/cash/session',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER']),
    async (req, res) => {
      try {
        const rawSession = stripEdgePrototypePollution(req.body || {});
        if (rawSession.storeId && rawSession.storeId !== storeId) {
          return res.status(403).json({ error: 'Sessão pertence a outra filial.' });
        }
        const id = String(rawSession.id || generateStandardId('cas'));
        const numericFields = ['initialCash', 'totalSales', 'totalSangrias', 'totalSuprimentos', 'finalCashCalculated'];
        for (const field of numericFields) {
          if (rawSession[field] !== undefined && rawSession[field] !== null) {
            const val = Number(rawSession[field]);
            if (!Number.isFinite(val) || val < 0) {
              return res.status(400).json({ error: `Valor financeiro inválido para '${field}': deve ser >= 0.` });
            }
          }
        }

        const saved = await driver.runTransaction(async (tx) => {
          const snap = await tx.get({ collectionName: 'cash_sessions', id });
          const existing = snap.exists ? snap.data() : null;
          const nextStatus = rawSession.status ?? existing?.status ?? 'OPEN';
          if (!['OPEN', 'CLOSED'].includes(String(nextStatus))) {
            const err: any = new Error('Status de sessão de caixa inválido: utilize OPEN ou CLOSED.');
            err.statusCode = 400;
            throw err;
          }
          if (nextStatus === 'OPEN') {
            const allSessions = await driver.listDocs<any>('cash_sessions');
            const conflict = allSessions.find(
              (s) => s.id !== id && !s._deleted && s.storeId === storeId && s.status === 'OPEN'
            );
            if (conflict) {
              const err: any = new Error(
                `Já existe uma sessão de caixa ABERTA (${conflict.id}) para esta loja no Edge Node.`
              );
              err.statusCode = 409;
              throw err;
            }
          }
          const hlc = generateHlcTimestamp(nodeId);
          const nextSession = {
            ...(existing || {}),
            ...rawSession,
            id,
            tenantId,
            storeId,
            status: nextStatus,
            hlc,
            updatedAt: new Date().toISOString(),
          };
          tx.set({ collectionName: 'cash_sessions', id }, nextSession, { merge: true });
          const outbox = buildSyncOutboxEntry({
            entity: 'cash_sessions',
            entityId: id,
            operation: 'UPSERT',
            tenantId,
            storeId,
            nodeId,
            hlc,
            idempotencyKey: generateIdempotencyKey(),
            payload: nextSession,
          });
          tx.set({ collectionName: 'sync_outbox', id: outbox.id }, outbox, { merge: false });
          return nextSession;
        });
        return res.json({ success: true, session: saved });
      } catch (err: any) {
        return res.status(err?.statusCode || 400).json({ error: err?.message || 'Erro ao salvar sessão de caixa.' });
      }
    }
  );

  app.post(
    '/api/v1/store/cash/movement',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER']),
    async (req, res) => {
      try {
        const authenticatedUser = (req as any).user;
        const { storeId: bodyStoreId, sessionId, type, amount, reason } = req.body || {};
        if (bodyStoreId && bodyStoreId !== storeId) {
          return res.status(403).json({ error: 'Movimentação pertence a outra filial.' });
        }
        const normalizedType = String(type || '').toUpperCase();
        if (!['SANGRIA', 'SUPRIMENTO'].includes(normalizedType)) {
          return res.status(400).json({ error: 'Tipo de movimentação inválido: utilize SANGRIA ou SUPRIMENTO.' });
        }
        const parsedAmount = Number(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
          return res.status(400).json({ error: 'Valor da movimentação inválido: deve ser maior que zero.' });
        }
        const roundedAmount = Math.round(parsedAmount * 100) / 100;

        const result = await driver.runTransaction(async (tx) => {
          const sessions = await driver.listDocs<any>('cash_sessions');
          const openDoc = sessions
            .filter(
              (s) =>
                !s._deleted &&
                s.storeId === storeId &&
                s.status === 'OPEN' &&
                (!sessionId || s.id === sessionId)
            )
            .sort((a, b) => new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime())[0];

          if (!openDoc) {
            const err: any = new Error('Operação bloqueada: Nenhuma sessão de caixa ABERTA no Edge Node.');
            err.statusCode = 400;
            throw err;
          }
          const currentFinalCash = Number(openDoc.finalCashCalculated) || 0;
          if (normalizedType === 'SANGRIA' && roundedAmount > currentFinalCash) {
            const err: any = new Error(
              `Saldo insuficiente em caixa para sangria (disponível: R$ ${currentFinalCash.toFixed(2)}).`
            );
            err.statusCode = 400;
            throw err;
          }

          const nowIso = new Date().toISOString();
          const hlc = generateHlcTimestamp(nodeId);
          const nextTotalSangrias =
            normalizedType === 'SANGRIA'
              ? Math.round(((Number(openDoc.totalSangrias) || 0) + roundedAmount) * 100) / 100
              : Number(openDoc.totalSangrias) || 0;
          const nextTotalSuprimentos =
            normalizedType === 'SUPRIMENTO'
              ? Math.round(((Number(openDoc.totalSuprimentos) || 0) + roundedAmount) * 100) / 100
              : Number(openDoc.totalSuprimentos) || 0;
          const nextFinalCash =
            normalizedType === 'SANGRIA'
              ? Math.round((currentFinalCash - roundedAmount) * 100) / 100
              : Math.round((currentFinalCash + roundedAmount) * 100) / 100;

          const updatedSession = {
            ...openDoc,
            totalSangrias: nextTotalSangrias,
            totalSuprimentos: nextTotalSuprimentos,
            finalCashCalculated: nextFinalCash,
            hlc,
            updatedAt: nowIso,
          };

          const finId = generateStandardId('fin');
          const safeReason =
            typeof reason === 'string' && reason.trim()
              ? reason.trim().slice(0, 180)
              : normalizedType === 'SANGRIA' ? 'Retirada de caixa' : 'Reforço de troco';
          const finRecord = {
            id: finId,
            storeId,
            tenantId,
            type: normalizedType === 'SANGRIA' ? 'PAYABLE' : 'RECEIVABLE',
            category: normalizedType,
            description:
              normalizedType === 'SANGRIA'
                ? `Sangria de Caixa: ${safeReason}`
                : `Suprimento de Caixa: ${safeReason}`,
            amount: roundedAmount,
            dueDate: nowIso.slice(0, 10),
            status: 'PAID',
            entityName: authenticatedUser.name || openDoc.openedBy || 'Operador Caixa',
            cashSessionId: openDoc.id,
            hlc,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          tx.update({ collectionName: 'cash_sessions', id: openDoc.id }, {
            totalSangrias: nextTotalSangrias,
            totalSuprimentos: nextTotalSuprimentos,
            finalCashCalculated: nextFinalCash,
            hlc,
            updatedAt: nowIso,
          });
          tx.set({ collectionName: 'financial_records', id: finId }, finRecord, { merge: false });

          const cashOutbox = buildSyncOutboxEntry({
            entity: 'cash_sessions',
            entityId: openDoc.id,
            operation: 'UPSERT',
            tenantId,
            storeId,
            nodeId,
            hlc,
            idempotencyKey: generateIdempotencyKey(),
            payload: updatedSession,
          });
          const finOutbox = buildSyncOutboxEntry({
            entity: 'financial_records',
            entityId: finId,
            operation: 'UPSERT',
            tenantId,
            storeId,
            nodeId,
            hlc,
            idempotencyKey: generateIdempotencyKey(),
            payload: finRecord,
          });
          tx.set({ collectionName: 'sync_outbox', id: cashOutbox.id }, cashOutbox, { merge: false });
          tx.set({ collectionName: 'sync_outbox', id: finOutbox.id }, finOutbox, { merge: false });

          return { session: updatedSession, financialRecord: finRecord };
        });

        return res.json({ success: true, ...result });
      } catch (err: any) {
        return res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao registrar movimentação de caixa no Edge.' });
      }
    }
  );

  app.get(
    '/api/v1/store/finance',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']),
    async (req, res) => {
      if (req.query.storeId && String(req.query.storeId) !== storeId) {
        return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
      }
      const records = await driver.listDocs<any>('financial_records');
      return res.json(records.filter((r) => !r._deleted && r.storeId === storeId));
    }
  );

  app.post(
    '/api/v1/store/finance',
    authenticateEdge,
    requireEdgeRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']),
    async (req, res) => {
      try {
        const rawRecord = stripEdgePrototypePollution(req.body || {});
        if (rawRecord.storeId && rawRecord.storeId !== storeId) {
          return res.status(403).json({ error: 'Registro financeiro pertence a outra filial.' });
        }
        const id = String(rawRecord.id || generateStandardId('fin'));
        const savedRecord = await driver.runTransaction(async (tx) => {
          const snap = await tx.get({ collectionName: 'financial_records', id });
          const existing = snap.exists ? snap.data() : null;
          const recordType = rawRecord.type ?? existing?.type;
          if (!['RECEIVABLE', 'PAYABLE'].includes(String(recordType || ''))) {
            const err: any = new Error('Tipo de lançamento financeiro inválido: utilize RECEIVABLE ou PAYABLE.');
            err.statusCode = 400;
            throw err;
          }
          const recordAmount = rawRecord.amount !== undefined ? Number(rawRecord.amount) : Number(existing?.amount);
          if (!Number.isFinite(recordAmount) || recordAmount <= 0) {
            const err: any = new Error('Valor do lançamento financeiro inválido: deve ser maior que zero.');
            err.statusCode = 400;
            throw err;
          }
          const hlc = generateHlcTimestamp(nodeId);
          const nextRecord = {
            ...(existing || {}),
            ...rawRecord,
            id,
            tenantId,
            storeId,
            type: recordType,
            amount: Math.round(recordAmount * 100) / 100,
            hlc,
            updatedAt: new Date().toISOString(),
          };
          tx.set({ collectionName: 'financial_records', id }, nextRecord, { merge: true });
          const outbox = buildSyncOutboxEntry({
            entity: 'financial_records',
            entityId: id,
            operation: 'UPSERT',
            tenantId,
            storeId,
            nodeId,
            hlc,
            idempotencyKey: generateIdempotencyKey(),
            payload: nextRecord,
          });
          tx.set({ collectionName: 'sync_outbox', id: outbox.id }, outbox, { merge: false });
          return nextRecord;
        });
        return res.json({ success: true, record: savedRecord });
      } catch (err: any) {
        return res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao gravar lançamento financeiro no Edge.' });
      }
    }
  );
}
