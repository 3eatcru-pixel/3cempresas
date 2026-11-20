import express from 'express';
import { db } from '../../config.ts';
import {
  AuthenticatedRequestUser,
  hasUserStoreAccess,
  requireRoles,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import { generateHlcTimestamp } from '../../../utils/idGenerator.ts';
import { stageSyncOutboxInTransaction } from '../../persistence/PersistenceDriver.ts';
import {
  isSingleBranchLocked,
  omitKeys,
  stripPrototypePollution,
} from './storeAccessHelpers.ts';

const router = express.Router();

router.get('/customers', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    if (authenticatedUser.role !== 'DEV_OWNER' && req.query.storeId && !hasUserStoreAccess(authenticatedUser, String(req.query.storeId))) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }
    const snap = await db.collection('customers_crm').get();
    let custs = snap.docs.map(d => d.data()).filter(c => c && !c._deleted);

    if (authenticatedUser.role !== 'DEV_OWNER') {
      const userTenant = authenticatedUser.tenantId || 'tenant-1';
      custs = custs.filter(c => c.tenantId === userTenant && (!c.storeId || hasUserStoreAccess(authenticatedUser, c.storeId)));
    }
    if (req.query.storeId) {
      custs = custs.filter(c => c.storeId === req.query.storeId);
    }

    res.json(custs);
  } catch {
    res.status(500).json({ error: 'Erro ao listar clientes CRM.' });
  }
});

router.post('/customers', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER']), async (req, res) => {
  try {
    const rawCustomer = stripPrototypePollution(req.body || {});
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const id = rawCustomer.id || `cust-${Date.now()}`;
    const cleanCustomer = omitKeys(
      rawCustomer,
      authenticatedUser.role === 'DEV_OWNER'
        ? ['id']
        : ['id', 'tenantId', ...(isSingleBranchLocked(authenticatedUser) ? ['storeId'] : [])]
    );

    const savedCustomer = await db.runTransaction(async (transaction) => {
      const custRef = db.collection('customers_crm').doc(id);
      const existingSnap = await transaction.get(custRef);
      if (existingSnap.exists && authenticatedUser.role !== 'DEV_OWNER') {
        if (existingSnap.data()?.tenantId !== authenticatedUser.tenantId) {
          const err: any = new Error('Acesso negado: Cliente pertence a outra empresa/tenant.');
          err.statusCode = 403;
          throw err;
        }
        if (existingSnap.data()?.storeId && !hasUserStoreAccess(authenticatedUser, existingSnap.data()?.storeId)) {
          const err: any = new Error('Acesso negado: Cliente pertence a outra filial.');
          err.statusCode = 403;
          throw err;
        }
      }

      const targetStoreId = rawCustomer.storeId || existingSnap.data()?.storeId || authenticatedUser.storeId;
      if (authenticatedUser.role !== 'DEV_OWNER') {
        if (targetStoreId && !hasUserStoreAccess(authenticatedUser, String(targetStoreId))) {
          const err: any = new Error('Acesso negado: Perfil restrito a outra filial.');
          err.statusCode = 403;
          throw err;
        }
        if (targetStoreId) {
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
        }
      }

      const tenantId = authenticatedUser.role === 'DEV_OWNER'
        ? (rawCustomer.tenantId || existingSnap.data()?.tenantId || authenticatedUser.tenantId)
        : authenticatedUser.tenantId;

      const custHlc = generateHlcTimestamp('cloud_core');
      const nextCustomer = {
        ...(existingSnap.exists ? existingSnap.data() : {}),
        ...cleanCustomer,
        id,
        tenantId,
        ...(targetStoreId ? { storeId: targetStoreId } : {}),
        hlc: custHlc,
        updatedAt: new Date().toISOString(),
      };
      transaction.set(custRef, nextCustomer, { merge: true });
      stageSyncOutboxInTransaction(transaction, {
        entity: 'customers_crm',
        entityId: id,
        operation: 'UPSERT',
        tenantId: tenantId || 'tenant-1',
        storeId: nextCustomer.storeId || null,
        hlc: custHlc,
        payload: nextCustomer,
      });
      return nextCustomer;
    });

    res.json({ success: true, customer: savedCustomer });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar cliente CRM.' });
  }
});

router.put('/customers/:id', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const updates = omitKeys(
      stripPrototypePollution(req.body || {}),
      ['id', 'tenantId', 'createdAt', ...(isSingleBranchLocked(authenticatedUser) ? ['storeId'] : [])]
    );

    const updatedCustomer = await db.runTransaction(async (transaction) => {
      const docRef = db.collection('customers_crm').doc(req.params.id);
      const snap = await transaction.get(docRef);

      if (!snap.exists) {
        const err: any = new Error('Cliente CRM não encontrado.');
        err.statusCode = 404;
        throw err;
      }

      const prevCustomer = snap.data() || {};
      if (authenticatedUser.role !== 'DEV_OWNER') {
        if (prevCustomer.tenantId !== authenticatedUser.tenantId) {
          const err: any = new Error('Acesso negado: Cliente pertence a outra empresa/tenant.');
          err.statusCode = 403;
          throw err;
        }
        if (prevCustomer.storeId && !hasUserStoreAccess(authenticatedUser, prevCustomer.storeId)) {
          const err: any = new Error('Acesso negado: Cliente pertence a outra filial.');
          err.statusCode = 403;
          throw err;
        }
      }

      const custHlc = generateHlcTimestamp('cloud_core');
      const nextDoc = {
        ...prevCustomer,
        ...updates,
        id: req.params.id,
        hlc: custHlc,
        updatedAt: new Date().toISOString(),
      };
      transaction.update(docRef, { ...updates, hlc: custHlc, updatedAt: nextDoc.updatedAt });
      stageSyncOutboxInTransaction(transaction, {
        entity: 'customers_crm',
        entityId: req.params.id,
        operation: 'UPSERT',
        tenantId: prevCustomer.tenantId || authenticatedUser.tenantId || 'tenant-1',
        storeId: nextDoc.storeId || null,
        hlc: custHlc,
        payload: nextDoc,
      });
      return nextDoc;
    });

    res.json({ success: true, customer: updatedCustomer });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao atualizar cliente CRM.' });
  }
});

export default router;
