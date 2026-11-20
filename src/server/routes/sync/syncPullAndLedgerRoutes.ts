import express from 'express';
import { hasUserStoreAccess, requireRoles } from '../../middleware/auth.ts';
import {
  generateHlcTimestamp,
  generateSyncCursorId,
} from '../../../utils/idGenerator.ts';
import {
  activePersistenceDriver,
  compareHlcTimestamps,
} from '../../persistence/PersistenceDriver.ts';
import {
  isBranchScopedSyncUser,
  SYNC_OPERATIONAL_ROLES,
  verifySyncCredentials,
} from './syncValidationCore.ts';

const router = express.Router();

router.get(
  '/pull',
  verifySyncCredentials,
  requireRoles(SYNC_OPERATIONAL_ROLES),
  async (req, res) => {
    try {
      const authenticatedUser = (req as any).user;
      const sinceHlc = req.query.sinceHlc ? String(req.query.sinceHlc) : '';
      const requestedStoreId = req.query.storeId ? String(req.query.storeId) : '';
      const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));

      if (isBranchScopedSyncUser(authenticatedUser) && !authenticatedUser.storeId && !authenticatedUser.allowedStoreIds?.length) {
        return res.status(403).json({ error: 'Acesso negado: Operador sem filial vinculada.' });
      }
      if (authenticatedUser.role !== 'DEV_OWNER' && requestedStoreId && !hasUserStoreAccess(authenticatedUser, requestedStoreId)) {
        return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
      }
      const isSingleLocked = Boolean(
        authenticatedUser.role !== 'DEV_OWNER' &&
        authenticatedUser.storeId &&
        !(Array.isArray(authenticatedUser.allowedStoreIds) && authenticatedUser.allowedStoreIds.length > 1)
      );
      const storeId = isSingleLocked
        ? String(authenticatedUser.storeId)
        : requestedStoreId;

      const allOutbox = await activePersistenceDriver.listDocs<any>('sync_outbox');
      let filtered =
        authenticatedUser.role === 'DEV_OWNER'
          ? allOutbox
          : allOutbox.filter(e => e.tenantId === (authenticatedUser.tenantId || 'tenant-1'));

      if (storeId) {
        filtered = filtered.filter(e => !e.storeId || e.storeId === storeId);
      } else if (authenticatedUser.role !== 'DEV_OWNER') {
        filtered = filtered.filter(e => !e.storeId || hasUserStoreAccess(authenticatedUser, e.storeId));
      }

      if (sinceHlc) {
        filtered = filtered.filter(e => compareHlcTimestamps(e.hlc, sinceHlc) > 0);
      }

      filtered.sort((a, b) => compareHlcTimestamps(a.hlc, b.hlc));
      const slice = filtered.slice(0, limit);
      const nextHlc = slice.length > 0 ? slice[slice.length - 1].hlc : sinceHlc || generateHlcTimestamp('cloud_core');

      res.json({
        cursorId: generateSyncCursorId(),
        entries: slice,
        count: slice.length,
        hasMore: filtered.length > slice.length,
        nextHlc,
        serverHlc: generateHlcTimestamp('cloud_core'),
      });
    } catch {
      res.status(500).json({ error: 'Erro ao consultar delta de sincronização pull.' });
    }
  }
);

router.get('/stock-ledger', verifySyncCredentials, requireRoles(SYNC_OPERATIONAL_ROLES), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user;
    const { storeId, targetId, orderId } = req.query;
    const requestedStoreId = storeId ? String(storeId) : '';

    if (isBranchScopedSyncUser(authenticatedUser) && !authenticatedUser.storeId && !authenticatedUser.allowedStoreIds?.length) {
      return res.status(403).json({ error: 'Acesso negado: Operador sem filial vinculada.' });
    }
    if (!hasUserStoreAccess(authenticatedUser, requestedStoreId)) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }
    const effectiveStoreId = isBranchScopedSyncUser(authenticatedUser)
      ? String(authenticatedUser.storeId || authenticatedUser.allowedStoreIds?.[0] || '')
      : requestedStoreId;

    const entries = await activePersistenceDriver.listDocs<any>('stock_ledger');

    let filtered =
      authenticatedUser.role === 'DEV_OWNER'
        ? entries
        : entries.filter(e => e.tenantId === (authenticatedUser.tenantId || 'tenant-1'));

    if (effectiveStoreId) {
      filtered = filtered.filter(e => e.storeId === effectiveStoreId);
    } else if (authenticatedUser.role !== 'DEV_OWNER') {
      filtered = filtered.filter(e => hasUserStoreAccess(authenticatedUser, e.storeId));
    }
    if (targetId) filtered = filtered.filter(e => e.targetId === String(targetId));
    if (orderId) filtered = filtered.filter(e => e.orderId === String(orderId));

    filtered.sort((a, b) => compareHlcTimestamps(b.hlc, a.hlc));
    res.json(filtered);
  } catch {
    res.status(500).json({ error: 'Erro ao listar ledger de estoque.' });
  }
});

export default router;
