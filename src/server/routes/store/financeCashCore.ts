import express from 'express';
import { db } from '../../config.ts';
import {
  AuthenticatedRequestUser,
  hasUserStoreAccess,
  requireModuleAccess,
  requireRoles,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import { broadcastSseEvent } from '../../state.ts';
import {
  generateHlcTimestamp,
  generateStandardId,
} from '../../../utils/idGenerator.ts';
import { stageSyncOutboxInTransaction } from '../../persistence/PersistenceDriver.ts';
import {
  isSingleBranchLocked,
  omitKeys,
  stripPrototypePollution,
  verifyStoreTenantAccess,
} from './storeAccessHelpers.ts';
import paymentFiscalSubscriptionCore from './paymentFiscalSubscriptionCore.ts';

const router = express.Router();

// ==========================================
// 1. FINANCIAL RECORDS & CASH SESSIONS
// ==========================================

router.get('/finance', verifyAutonomousToken, requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']), requireModuleAccess('finance'), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    if (
      authenticatedUser.role !== 'DEV_OWNER' &&
      req.query.storeId &&
      !hasUserStoreAccess(authenticatedUser, String(req.query.storeId))
    ) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }

    const snap = await db.collection('financial_records').get();
    let records = snap.docs.map((d) => d.data()).filter((r) => r && !r._deleted);

    if (authenticatedUser.role !== 'DEV_OWNER') {
      const userTenant = authenticatedUser.tenantId || 'tenant-1';
      records = records.filter((r) => r.tenantId === userTenant && hasUserStoreAccess(authenticatedUser, r.storeId));
    }
    if (req.query.storeId) {
      records = records.filter((r) => r.storeId === req.query.storeId);
    }

    res.json(records);
  } catch {
    res.status(500).json({ error: 'Erro ao listar dados financeiros.' });
  }
});

router.post('/finance', verifyAutonomousToken, requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']), requireModuleAccess('finance'), async (req, res) => {
  try {
    const rawRecord = stripPrototypePollution(req.body || {});
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const id = rawRecord.id || `fin-${Date.now()}`;
    const cleanRecord = omitKeys(
      rawRecord,
      authenticatedUser.role === 'DEV_OWNER' ? ['id'] : ['id', 'tenantId', ...(isSingleBranchLocked(authenticatedUser) ? ['storeId'] : [])]
    );

    const savedRecord = await db.runTransaction(async (transaction) => {
      const finRef = db.collection('financial_records').doc(id);
      const existingSnap = await transaction.get(finRef);
      if (existingSnap.exists && authenticatedUser.role !== 'DEV_OWNER') {
        if (existingSnap.data()?.tenantId !== authenticatedUser.tenantId) {
          const err: any = new Error('Acesso negado: Registro financeiro pertence a outra empresa/tenant.');
          err.statusCode = 403;
          throw err;
        }
        if (!hasUserStoreAccess(authenticatedUser, existingSnap.data()?.storeId)) {
          const err: any = new Error('Acesso negado: Registro financeiro pertence a outra filial.');
          err.statusCode = 403;
          throw err;
        }
      }

      const recordType = rawRecord.type ?? existingSnap.data()?.type;
      if (!['RECEIVABLE', 'PAYABLE'].includes(String(recordType || ''))) {
        const err: any = new Error('Tipo de lançamento financeiro inválido: utilize RECEIVABLE ou PAYABLE.');
        err.statusCode = 400;
        throw err;
      }

      const recordAmount = rawRecord.amount !== undefined ? Number(rawRecord.amount) : Number(existingSnap.data()?.amount);
      if (!Number.isFinite(recordAmount) || recordAmount <= 0) {
        const err: any = new Error('Valor do lançamento financeiro inválido: deve ser maior que zero.');
        err.statusCode = 400;
        throw err;
      }

      const targetStoreId = rawRecord.storeId || existingSnap.data()?.storeId || authenticatedUser.storeId;
      if (targetStoreId && authenticatedUser.role !== 'DEV_OWNER') {
        const storeSnap = await transaction.get(db.collection('stores').doc(String(targetStoreId)));
        if (!storeSnap.exists) {
          const err: any = new Error(`Loja '${targetStoreId}' não encontrada.`);
          err.statusCode = 404;
          throw err;
        }
        if (storeSnap.data()?.tenantId !== authenticatedUser.tenantId) {
          const err: any = new Error('Acesso negado: Loja pertence a outra empresa/tenant.');
          err.statusCode = 403;
          throw err;
        }
        if (!hasUserStoreAccess(authenticatedUser, String(targetStoreId))) {
          const err: any = new Error('Acesso negado: Perfil restrito a outra filial.');
          err.statusCode = 403;
          throw err;
        }
      }

      const tenantId = authenticatedUser.role === 'DEV_OWNER'
        ? (rawRecord.tenantId || existingSnap.data()?.tenantId || authenticatedUser.tenantId)
        : authenticatedUser.tenantId;
      const finHlc = generateHlcTimestamp('cloud_core');
      const nextRecord = {
        ...(existingSnap.exists ? existingSnap.data() : {}),
        ...cleanRecord,
        id,
        tenantId,
        ...(targetStoreId ? { storeId: targetStoreId } : {}),
        type: recordType,
        amount: Math.round(recordAmount * 100) / 100,
        hlc: finHlc,
        updatedAt: new Date().toISOString(),
      };

      transaction.set(finRef, nextRecord, { merge: true });
      stageSyncOutboxInTransaction(transaction, {
        entity: 'financial_records',
        entityId: id,
        operation: 'UPSERT',
        tenantId: tenantId || 'tenant-1',
        storeId: nextRecord.storeId || null,
        hlc: finHlc,
        payload: nextRecord,
      });
      return nextRecord;
    });

    res.json({ success: true, record: savedRecord });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar registro financeiro.' });
  }
});

router.get('/cash/session', verifyAutonomousToken, requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER']), requireModuleAccess('cash', 'pos'), async (req, res) => {
  try {
    const { storeId } = req.query;
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    if (authenticatedUser.role !== 'DEV_OWNER' && storeId && !hasUserStoreAccess(authenticatedUser, String(storeId))) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }
    const targetStoreId = (authenticatedUser.role !== 'DEV_OWNER' && isSingleBranchLocked(authenticatedUser))
      ? String(authenticatedUser.storeId)
      : String(storeId || authenticatedUser.storeId || '');

    const snap = await db.collection('cash_sessions').get();
    let sessions = snap.docs.map((d) => d.data());

    if (authenticatedUser.role !== 'DEV_OWNER') {
      const userTenant = authenticatedUser.tenantId || 'tenant-1';
      sessions = sessions.filter((s) => s.tenantId === userTenant);
    }

    const openSession =
      sessions
        .filter((s) => s.storeId === targetStoreId && s.status === 'OPEN' && !s._deleted)
        .sort((a, b) => new Date(b.openedAt || b.updatedAt || 0).getTime() - new Date(a.openedAt || a.updatedAt || 0).getTime())[0] ||
      null;
    res.json(openSession);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar sessão de caixa.' });
  }
});

router.post('/cash/session', verifyAutonomousToken, requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER']), requireModuleAccess('cash', 'pos'), async (req, res) => {
  try {
    const rawSession = req.body || {};
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const id = rawSession.id || generateStandardId('cas');

    const numericCashFields = ['initialCash', 'totalSales', 'totalSangrias', 'totalSuprimentos', 'finalCashCalculated'];
    for (const field of numericCashFields) {
      if (rawSession[field] !== undefined && rawSession[field] !== null) {
        const val = Number(rawSession[field]);
        if (!Number.isFinite(val) || val < 0) {
          return res.status(400).json({ error: `Valor financeiro inválido para '${field}': deve ser >= 0.` });
        }
      }
    }

    if (authenticatedUser.role !== 'DEV_OWNER' && rawSession.storeId && !hasUserStoreAccess(authenticatedUser, String(rawSession.storeId))) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }

    const candidateStoreId = rawSession.storeId || authenticatedUser.storeId;
    if (candidateStoreId && authenticatedUser.role !== 'DEV_OWNER') {
      const check = await verifyStoreTenantAccess(String(candidateStoreId), authenticatedUser);
      if (check.ok === false) {
        return res.status(check.status).json({ error: check.error });
      }
    }

    const savedSession = await db.runTransaction(async (transaction) => {
      const sessionRef = db.collection('cash_sessions').doc(id);
      const existingSnap = await transaction.get(sessionRef);
      const existing = existingSnap.exists ? existingSnap.data() : null;

      if (existing && authenticatedUser.role !== 'DEV_OWNER') {
        if (existing.tenantId !== authenticatedUser.tenantId) {
          const err: any = new Error('Acesso negado: Sessão de caixa pertence a outra empresa/tenant.');
          err.statusCode = 403;
          throw err;
        }
        if (!hasUserStoreAccess(authenticatedUser, existing.storeId)) {
          const err: any = new Error('Acesso negado: Sessão pertence a outra filial.');
          err.statusCode = 403;
          throw err;
        }
      }

      const nextStatus = rawSession.status ?? existing?.status ?? 'OPEN';
      if (!['OPEN', 'CLOSED'].includes(String(nextStatus))) {
        const err: any = new Error('Status de sessão de caixa inválido: utilize OPEN ou CLOSED.');
        err.statusCode = 400;
        throw err;
      }

      const targetStoreId = rawSession.storeId || existing?.storeId || authenticatedUser.storeId;
      if (nextStatus === 'OPEN' && targetStoreId) {
        const allSessionsSnap = await db.collection('cash_sessions').get();
        const conflictingOpen = allSessionsSnap.docs.find((d) => {
          const s = d.data();
          return d.id !== id && s.storeId === targetStoreId && s.status === 'OPEN' && !s._deleted;
        });
        if (conflictingOpen) {
          const err: any = new Error(
            `Já existe uma sessão de caixa ABERTA (${conflictingOpen.id}) para esta loja. Feche o turno atual antes de abrir outro.`
          );
          err.statusCode = 409;
          throw err;
        }
      }

      const tenantId = authenticatedUser.role === 'DEV_OWNER'
        ? (rawSession.tenantId || existing?.tenantId || authenticatedUser.tenantId)
        : authenticatedUser.tenantId;
      const cleanSession = omitKeys(
        rawSession,
        authenticatedUser.role === 'DEV_OWNER' ? ['id'] : ['id', 'tenantId', ...(isSingleBranchLocked(authenticatedUser) ? ['storeId'] : [])]
      );
      const cashHlc = generateHlcTimestamp('cloud_core');
      const nextDoc = {
        ...(existing || {}),
        ...cleanSession,
        id,
        tenantId,
        status: nextStatus,
        ...(targetStoreId ? { storeId: targetStoreId } : {}),
        hlc: cashHlc,
        updatedAt: new Date().toISOString(),
      };

      transaction.set(sessionRef, nextDoc, { merge: true });
      stageSyncOutboxInTransaction(transaction, {
        entity: 'cash_sessions',
        entityId: id,
        operation: 'UPSERT',
        tenantId: tenantId || 'tenant-1',
        storeId: targetStoreId || null,
        hlc: cashHlc,
        payload: nextDoc,
      });

      return nextDoc;
    });

    res.json({ success: true, session: savedSession });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar sessão de caixa.' });
  }
});

// Atomic Cashier Movement (Sangria / Suprimento)
router.post(
  '/cash/movement',
  verifyAutonomousToken,
  requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER']),
  requireModuleAccess('cash', 'pos'),
  async (req, res) => {
    try {
      const { storeId, sessionId, type, amount, reason } = req.body || {};
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;

      const normalizedType = String(type || '').toUpperCase();
      if (!['SANGRIA', 'SUPRIMENTO'].includes(normalizedType)) {
        return res.status(400).json({ error: 'Tipo de movimentação inválido: utilize SANGRIA ou SUPRIMENTO.' });
      }

      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Valor da movimentação inválido: deve ser maior que zero.' });
      }
      const roundedAmount = Math.round(parsedAmount * 100) / 100;

      const targetStoreId =
        authenticatedUser.role !== 'DEV_OWNER' && isSingleBranchLocked(authenticatedUser)
          ? String(authenticatedUser.storeId)
          : String(storeId || authenticatedUser.storeId || '');
      if (!targetStoreId) {
        return res.status(400).json({ error: 'storeId é obrigatório para movimentação de caixa.' });
      }
      if (authenticatedUser.role !== 'DEV_OWNER' && storeId && !hasUserStoreAccess(authenticatedUser, String(storeId))) {
        return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
      }

      const access = await verifyStoreTenantAccess(targetStoreId, authenticatedUser);
      if (access.ok === false) {
        return res.status(access.status).json({ error: access.error });
      }
      const tenantId = access.store?.tenantId || authenticatedUser.tenantId || 'tenant-1';

      const result = await db.runTransaction(async (transaction) => {
        const allSessionsSnap = await db.collection('cash_sessions').get();
        const openDoc = allSessionsSnap.docs
          .filter((d) => {
            const s = d.data();
            return (
              s.storeId === targetStoreId &&
              s.tenantId === tenantId &&
              s.status === 'OPEN' &&
              !s._deleted &&
              (!sessionId || d.id === sessionId)
            );
          })
          .sort((a, b) => new Date(b.data()?.openedAt || 0).getTime() - new Date(a.data()?.openedAt || 0).getTime())[0];

        if (!openDoc) {
          const err: any = new Error('Operação bloqueada: Nenhuma sessão de caixa ABERTA encontrada para esta loja.');
          err.statusCode = 400;
          throw err;
        }

        const sessionRef = db.collection('cash_sessions').doc(openDoc.id);
        const freshSnap = await transaction.get(sessionRef);
        const currentSession = freshSnap.data() || {};
        if (currentSession.status !== 'OPEN') {
          const err: any = new Error('Sessão de caixa já foi encerrada.');
          err.statusCode = 400;
          throw err;
        }

        const currentFinalCash = Number(currentSession.finalCashCalculated) || 0;
        if (normalizedType === 'SANGRIA' && roundedAmount > currentFinalCash) {
          const err: any = new Error(
            `Saldo insuficiente em caixa para sangria (disponível: R$ ${currentFinalCash.toFixed(2)}).`
          );
          err.statusCode = 400;
          throw err;
        }

        const nowIso = new Date().toISOString();
        const movHlc = generateHlcTimestamp('cloud_core');
        const nextTotalSangrias =
          normalizedType === 'SANGRIA'
            ? Math.round(((Number(currentSession.totalSangrias) || 0) + roundedAmount) * 100) / 100
            : Number(currentSession.totalSangrias) || 0;
        const nextTotalSuprimentos =
          normalizedType === 'SUPRIMENTO'
            ? Math.round(((Number(currentSession.totalSuprimentos) || 0) + roundedAmount) * 100) / 100
            : Number(currentSession.totalSuprimentos) || 0;
        const nextFinalCash =
          normalizedType === 'SANGRIA'
            ? Math.round((currentFinalCash - roundedAmount) * 100) / 100
            : Math.round((currentFinalCash + roundedAmount) * 100) / 100;

        const updatedSession = {
          ...currentSession,
          id: openDoc.id,
          totalSangrias: nextTotalSangrias,
          totalSuprimentos: nextTotalSuprimentos,
          finalCashCalculated: nextFinalCash,
          hlc: movHlc,
          updatedAt: nowIso,
        };

        const finId = generateStandardId('fin');
        const safeReason = typeof reason === 'string' && reason.trim()
          ? reason.trim().slice(0, 180)
          : normalizedType === 'SANGRIA' ? 'Retirada de caixa' : 'Reforço de troco';
        const finRecord = {
          id: finId,
          storeId: targetStoreId,
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
          entityName: authenticatedUser.name || currentSession.openedBy || 'Operador Caixa',
          cashSessionId: openDoc.id,
          hlc: movHlc,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        transaction.update(sessionRef, {
          totalSangrias: nextTotalSangrias,
          totalSuprimentos: nextTotalSuprimentos,
          finalCashCalculated: nextFinalCash,
          hlc: movHlc,
          updatedAt: nowIso,
        });
        transaction.set(db.collection('financial_records').doc(finId), finRecord, { merge: false });

        stageSyncOutboxInTransaction(transaction, {
          entity: 'cash_sessions',
          entityId: openDoc.id,
          operation: 'UPSERT',
          tenantId,
          storeId: targetStoreId,
          hlc: movHlc,
          payload: updatedSession,
        });
        stageSyncOutboxInTransaction(transaction, {
          entity: 'financial_records',
          entityId: finId,
          operation: 'UPSERT',
          tenantId,
          storeId: targetStoreId,
          hlc: movHlc,
          payload: finRecord,
        });

        return { session: updatedSession, financialRecord: finRecord };
      });

      broadcastSseEvent(
        'CASH_MOVEMENT',
        { storeId: targetStoreId, type: normalizedType, amount: roundedAmount, sessionId: result.session.id },
        tenantId,
        true,
        {
          storeId: targetStoreId,
          allowedRoles: ['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER'],
        }
      );

      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao registrar movimentação de caixa.' });
    }
  }
);

router.use(paymentFiscalSubscriptionCore);

export default router;
