import express from 'express';
import { db, runWithSystemDbContext } from '../../config.ts';
import {
  AuthenticatedRequestUser,
  hasUserStoreAccess,
  requireRoles,
  resolveOptionalUser,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import { broadcastUserSseEvent, clusterState } from '../../state.ts';
import { generateHlcTimestamp } from '../../../utils/idGenerator.ts';
import { stageSyncOutboxInTransaction } from '../../persistence/PersistenceDriver.ts';
import {
  canViewPrivateStoreFields,
  omitKeys,
  PROTECTED_STORE_SAAS_FIELDS,
  sanitizeStoreForPublic,
  stripPrototypePollution,
} from './storeAccessHelpers.ts';

const router = express.Router();
export const storePublicDetailRouter = express.Router();

router.get('/list', async (req, res) => {
  try {
    const { tenantId } = req.query;
    const { user: callerUser } = await resolveOptionalUser(req);

    const [snap, tenantsSnap] = await runWithSystemDbContext('PUBLIC_STORE_LIST', () =>
      Promise.all([
        db.collection('stores').get(),
        db.collection('tenants').get(),
      ])
    );
    const suspendedTenants = new Set(
      tenantsSnap.docs
        .map(d => d.data())
        .filter(t => String(t?.status || 'ACTIVE').toUpperCase() === 'SUSPENDED')
        .map(t => t.id)
    );
    const isAdminViewer = Boolean(callerUser && ['DEV_OWNER', 'SUPER_ADMIN'].includes(callerUser.role));

    let stores = snap.docs.map(d => d.data()).filter(s => !s?._deleted);
    if (!isAdminViewer) {
      stores = stores.filter(
        s => !suspendedTenants.has(s.tenantId) && String(s.status || 'ACTIVE').toUpperCase() !== 'SUSPENDED'
      );
    }
    if (tenantId) {
      stores = stores.filter(s => s.tenantId === tenantId);
    }

    // Only verified platform admins or owners/managers of THAT store see billing/SaaS fields.
    // Waiter pairing PIN is never exposed on general store listing.
    stores = stores.map(s => {
      const base = canViewPrivateStoreFields(callerUser, s) ? { ...s } : sanitizeStoreForPublic(s);
      delete base.waiterPairingPin;
      delete base.waiterPairingPinUpdatedAt;
      delete base.waiterPinAttempts;
      delete base.waiterPinLockedUntil;
      delete base.waiterPairingRevokedAtSec;
      return base;
    });

    res.json(stores);
  } catch {
    res.status(500).json({ error: 'Erro ao listar lojas.' });
  }
});

router.post('/save', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER']), async (req, res) => {
  try {
    const rawData = stripPrototypePollution(req.body || {});
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    if (
      rawData.latitude !== undefined &&
      rawData.latitude !== null &&
      (typeof rawData.latitude !== 'number' ||
        !Number.isFinite(rawData.latitude) ||
        rawData.latitude < -90 ||
        rawData.latitude > 90)
    ) {
      return res.status(400).json({ error: 'Latitude do estabelecimento inválida (-90 a 90).' });
    }
    if (
      rawData.longitude !== undefined &&
      rawData.longitude !== null &&
      (typeof rawData.longitude !== 'number' ||
        !Number.isFinite(rawData.longitude) ||
        rawData.longitude < -180 ||
        rawData.longitude > 180)
    ) {
      return res.status(400).json({ error: 'Longitude do estabelecimento inválida (-180 a 180).' });
    }
    const id = rawData.id || `store-${Date.now()}`;

    const existingSnap = await db.collection('stores').doc(id).get();
    if (existingSnap.exists && authenticatedUser.role !== 'DEV_OWNER') {
      if (existingSnap.data()?.tenantId !== authenticatedUser.tenantId) {
        return res.status(403).json({ error: 'Acesso negado: Loja pertence a outra empresa/tenant.' });
      }
      if (!hasUserStoreAccess(authenticatedUser, id)) {
        return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
      }
    }

    const isPlatformAdmin = authenticatedUser.role === 'DEV_OWNER' || authenticatedUser.role === 'SUPER_ADMIN';
    const forbiddenKeys = [
      'id',
      'createdAt',
      'totalOrders',
      'monthlyRevenue',
      'waiterPairingPin',
      'waiterPairingPinUpdatedAt',
      'waiterPinAttempts',
      'waiterPinLockedUntil',
      'waiterPairingRevokedAtSec',
      'pendingUpgradeRequest',
    ];
    if (authenticatedUser.role !== 'DEV_OWNER') {
      forbiddenKeys.push('tenantId');
    }
    if (!isPlatformAdmin) {
      forbiddenKeys.push(...PROTECTED_STORE_SAAS_FIELDS);
    }

    const sanitizedPayload = omitKeys(rawData, forbiddenKeys);
    let tenantId = authenticatedUser.tenantId;
    if (authenticatedUser.role === 'DEV_OWNER') {
      if (rawData.tenantId) {
        tenantId = String(rawData.tenantId);
      } else if (existingSnap.exists && existingSnap.data()?.tenantId) {
        tenantId = existingSnap.data()?.tenantId;
      } else if (rawData.parentStoreId) {
        const parentSnap = await db.collection('stores').doc(String(rawData.parentStoreId)).get();
        if (!parentSnap.exists) {
          return res.status(404).json({ error: `Loja matriz '${rawData.parentStoreId}' não encontrada.` });
        }
        tenantId = parentSnap.data()?.tenantId || `tenant-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      } else {
        tenantId = `tenant-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      }
    } else {
      const tenantSnap = await db.collection('tenants').doc(authenticatedUser.tenantId || 'tenant-1').get();
      if (tenantSnap.exists && tenantSnap.data()?.status === 'SUSPENDED') {
        return res.status(403).json({ error: 'Acesso bloqueado: Empresa suspensa pelo HQ Central.' });
      }
    }

    let grantedAllowedStoreIds: string[] | null = null;
    const savedStore = await db.runTransaction(async (transaction) => {
      const storeRef = db.collection('stores').doc(id);
      const txStoreSnap = await transaction.get(storeRef);
      const creatorUserRef =
        !txStoreSnap.exists && authenticatedUser.role !== 'DEV_OWNER' && authenticatedUser.uid
          ? db.collection('users').doc(authenticatedUser.uid)
          : null;
      const creatorUserSnap = creatorUserRef ? await transaction.get(creatorUserRef) : null;

      if (!txStoreSnap.exists && (rawData.parentStoreId || (authenticatedUser.role !== 'DEV_OWNER' && authenticatedUser.tenantId))) {
        let targetTenantId = tenantId;
        let targetParentStore: any = null;

        if (rawData.parentStoreId) {
          const parentSnap = await transaction.get(db.collection('stores').doc(String(rawData.parentStoreId)));
          if (!parentSnap.exists) {
            const err: any = new Error(`Loja matriz '${rawData.parentStoreId}' não encontrada.`);
            err.statusCode = 404;
            throw err;
          }
          targetParentStore = parentSnap.data();
          targetTenantId = targetParentStore?.tenantId || tenantId;

          if (authenticatedUser.role !== 'DEV_OWNER' && targetTenantId !== authenticatedUser.tenantId) {
            const err: any = new Error('Acesso negado: Loja matriz pertence a outra empresa/tenant.');
            err.statusCode = 403;
            throw err;
          }
        }

        const allStoresSnap = await db.collection('stores').get();
        const tenantStores = allStoresSnap.docs
          .map(d => d.data())
          .filter(s => s.tenantId === targetTenantId && !s._deleted);

        if (tenantStores.length > 0) {
          if (!targetParentStore) {
            targetParentStore = tenantStores.find((s: any) => s.isParentStore) || tenantStores[0];
          }

          let maxAllowedBranches = Number(targetParentStore?.maxAllowedBranches);
          if (!maxAllowedBranches || isNaN(maxAllowedBranches)) {
            const plan = targetParentStore?.subscriptionPlan || 'FREE';
            maxAllowedBranches = plan === 'ENTERPRISE' ? 5 : plan === 'PRO' ? 2 : 1;
          }

          if (tenantStores.length >= maxAllowedBranches) {
            const err: any = new Error(
              `Limite de filiais do plano ${targetParentStore?.subscriptionPlan || 'atual'} atingido (${tenantStores.length}/${maxAllowedBranches}). Faça upgrade de plano no HQ para adicionar mais filiais.`
            );
            err.statusCode = 403;
            throw err;
          }
        }
      }

      const hlc = generateHlcTimestamp('cloud_core');
      const trialDefaults = (!txStoreSnap.exists && !isPlatformAdmin)
        ? {
            subscriptionPlan: 'FREE',
            billingCycle: 'MONTHLY',
            maxAllowedDevices: 2,
            maxAllowedBranches: 1,
            commissionRate: 0,
            saasMonthlyFee: 0,
            saasPaymentStatus: 'TRIAL',
          }
        : {};

      const nextStore: Record<string, any> = {
        ...(txStoreSnap.exists ? txStoreSnap.data() : trialDefaults),
        ...sanitizedPayload,
        id,
        tenantId,
        hlc,
        updatedAt: new Date().toISOString()
      };
      if (nextStore.trialExpiresAt === null) {
        delete nextStore.trialExpiresAt;
      }

      transaction.set(storeRef, nextStore, { merge: true });
      const nextPixKey =
        typeof nextStore.operationalSettings?.pixKey === 'string'
          ? nextStore.operationalSettings.pixKey.trim()
          : '';
      if (nextPixKey) {
        const payCfgRef = db.collection('payment_configs').doc(id);
        const payCfgSnap = await transaction.get(payCfgRef);
        const prevCfg = payCfgSnap.exists ? payCfgSnap.data() || {} : {};
        const mergedCfg = {
          storeId: id,
          tenantId,
          pixKeyType: prevCfg.pixKeyType || 'EMAIL',
          gatewayProvider: prevCfg.gatewayProvider || 'PIX_DIRECT_MERCHANT',
          autoTransfer: prevCfg.autoTransfer ?? true,
          commissionPolicy: prevCfg.commissionPolicy || '0%_COMMISSION_DIRECT_SALES',
          ...prevCfg,
          pixKey: nextPixKey,
          updatedAt: nextStore.updatedAt,
        };
        transaction.set(payCfgRef, mergedCfg, { merge: true });
        clusterState.merchantPaymentConfigs.set(id, mergedCfg);
      }
      if (!txStoreSnap.exists) {
        transaction.set(db.collection('tenants').doc(tenantId), {
          id: tenantId,
          name: nextStore.name || `Tenant ${tenantId}`,
          status: 'ACTIVE',
          subscriptionPlan: nextStore.subscriptionPlan || 'FREE',
          billingCycle: nextStore.billingCycle || 'MONTHLY',
          maxAllowedBranches: Number(nextStore.maxAllowedBranches) || 1,
          maxAllowedDevices: Number(nextStore.maxAllowedDevices) || 2,
          saasPaymentStatus: nextStore.saasPaymentStatus || 'TRIAL',
          updatedAt: nextStore.updatedAt,
        }, { merge: true });

        if (creatorUserRef && creatorUserSnap?.exists && ['STORE_OWNER', 'REGIONAL_MANAGER'].includes(authenticatedUser.role)) {
          const creatorData = creatorUserSnap.data() || {};
          if (creatorData.storeId || Array.isArray(creatorData.allowedStoreIds)) {
            const prevAllowed = Array.isArray(creatorData.allowedStoreIds)
              ? creatorData.allowedStoreIds
              : (creatorData.storeId ? [creatorData.storeId] : []);
            const nextAllowed = Array.from(new Set([...prevAllowed, id]));
            transaction.update(creatorUserRef, {
              allowedStoreIds: nextAllowed,
              updatedAt: nextStore.updatedAt,
            });
            grantedAllowedStoreIds = nextAllowed;
          }
        }
      }
      stageSyncOutboxInTransaction(transaction, {
        entity: 'stores',
        entityId: id,
        operation: 'UPSERT',
        tenantId: nextStore.tenantId || 'tenant-1',
        storeId: id,
        hlc,
        payload: nextStore,
      });
      return nextStore;
    });

    if (grantedAllowedStoreIds) {
      broadcastUserSseEvent(authenticatedUser.uid, 'USER_ROLE_UPDATED', {
        role: authenticatedUser.role,
        tenantId: savedStore.tenantId,
        storeId: authenticatedUser.storeId ?? null,
        allowedStoreIds: grantedAllowedStoreIds,
      });
    }

    res.json({ success: true, store: savedStore });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar loja.' });
  }
});

router.put('/:id', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER']), async (req, res) => {
  try {
    const { id } = req.params;
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;

    const isPlatformAdmin = authenticatedUser.role === 'DEV_OWNER' || authenticatedUser.role === 'SUPER_ADMIN';
    const forbiddenKeys = [
      'id',
      'tenantId',
      'createdAt',
      'totalOrders',
      'monthlyRevenue',
      'waiterPairingPin',
      'waiterPairingPinUpdatedAt',
      'waiterPinAttempts',
      'waiterPinLockedUntil',
      'waiterPairingRevokedAtSec',
      'pendingUpgradeRequest',
    ];
    if (!isPlatformAdmin) {
      forbiddenKeys.push(...PROTECTED_STORE_SAAS_FIELDS);
    }
    const updates = omitKeys(stripPrototypePollution(req.body || {}), forbiddenKeys);
    if (
      updates.latitude !== undefined &&
      updates.latitude !== null &&
      (typeof updates.latitude !== 'number' ||
        !Number.isFinite(updates.latitude) ||
        updates.latitude < -90 ||
        updates.latitude > 90)
    ) {
      return res.status(400).json({ error: 'Latitude do estabelecimento inválida (-90 a 90).' });
    }
    if (
      updates.longitude !== undefined &&
      updates.longitude !== null &&
      (typeof updates.longitude !== 'number' ||
        !Number.isFinite(updates.longitude) ||
        updates.longitude < -180 ||
        updates.longitude > 180)
    ) {
      return res.status(400).json({ error: 'Longitude do estabelecimento inválida (-180 a 180).' });
    }

    await db.runTransaction(async (transaction) => {
      const storeRef = db.collection('stores').doc(id);
      const storeDoc = await transaction.get(storeRef);

      if (!storeDoc.exists) {
        const err: any = new Error('Loja não encontrada.');
        err.statusCode = 404;
        throw err;
      }

      if (authenticatedUser.role !== 'DEV_OWNER') {
        if (storeDoc.data()?.tenantId !== authenticatedUser.tenantId) {
          const err: any = new Error('Acesso negado: Loja pertence a outra empresa/tenant.');
          err.statusCode = 403;
          throw err;
        }
        if (!hasUserStoreAccess(authenticatedUser, id)) {
          const err: any = new Error('Acesso negado: Perfil restrito a outra filial.');
          err.statusCode = 403;
          throw err;
        }

        const tenantSnap = await transaction.get(db.collection('tenants').doc(authenticatedUser.tenantId || 'tenant-1'));
        if (tenantSnap.exists && tenantSnap.data()?.status === 'SUSPENDED') {
          const err: any = new Error('Acesso bloqueado: Empresa suspensa pelo HQ Central.');
          err.statusCode = 403;
          throw err;
        }
      }

      const hlc = generateHlcTimestamp('cloud_core');
      const patch = { ...updates, hlc, updatedAt: new Date().toISOString() };
      transaction.update(storeRef, patch);

      const tenantId = storeDoc.data()?.tenantId || authenticatedUser.tenantId || 'tenant-1';
      const nextPixKey =
        typeof updates.operationalSettings?.pixKey === 'string'
          ? updates.operationalSettings.pixKey.trim()
          : '';
      if (nextPixKey) {
        const payCfgRef = db.collection('payment_configs').doc(id);
        const payCfgSnap = await transaction.get(payCfgRef);
        const prevCfg = payCfgSnap.exists ? payCfgSnap.data() || {} : {};
        const mergedCfg = {
          storeId: id,
          tenantId,
          pixKeyType: prevCfg.pixKeyType || 'EMAIL',
          gatewayProvider: prevCfg.gatewayProvider || 'PIX_DIRECT_MERCHANT',
          autoTransfer: prevCfg.autoTransfer ?? true,
          commissionPolicy: prevCfg.commissionPolicy || '0%_COMMISSION_DIRECT_SALES',
          ...prevCfg,
          pixKey: nextPixKey,
          updatedAt: patch.updatedAt,
        };
        transaction.set(payCfgRef, mergedCfg, { merge: true });
        clusterState.merchantPaymentConfigs.set(id, mergedCfg);
      }

      stageSyncOutboxInTransaction(transaction, {
        entity: 'stores',
        entityId: id,
        operation: 'UPSERT',
        tenantId,
        storeId: id,
        hlc,
        payload: { ...storeDoc.data(), ...patch, id },
      });
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao atualizar loja.' });
  }
});

// Mounted strictly LAST by store.ts so parameterized /:id never shadows static /store/* routes
storePublicDetailRouter.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('stores').doc(req.params.id).get();
    if (doc.exists && !doc.data()?._deleted) {
      let storeData = doc.data();
      const { user: callerUser } = await resolveOptionalUser(req);
      const isAdminViewer = Boolean(callerUser && ['DEV_OWNER', 'SUPER_ADMIN'].includes(callerUser.role));
      if (!isAdminViewer) {
        const tenantSnap = storeData?.tenantId
          ? await db.collection('tenants').doc(String(storeData.tenantId)).get()
          : null;
        if (
          (tenantSnap?.exists && String(tenantSnap.data()?.status || 'ACTIVE').toUpperCase() === 'SUSPENDED') ||
          String(storeData?.status || 'ACTIVE').toUpperCase() === 'SUSPENDED'
        ) {
          return res.status(403).json({ error: 'Estabelecimento indisponível: empresa suspensa.' });
        }
      }

      if (!canViewPrivateStoreFields(callerUser, storeData)) {
        storeData = sanitizeStoreForPublic(storeData);
      } else {
        storeData = { ...storeData };
        delete storeData.waiterPairingPin;
        delete storeData.waiterPairingPinUpdatedAt;
        delete storeData.waiterPinAttempts;
        delete storeData.waiterPinLockedUntil;
        delete storeData.waiterPairingRevokedAtSec;
      }

      res.json(storeData);
    } else {
      res.status(404).json({ error: 'Loja não encontrada.' });
    }
  } catch {
    res.status(500).json({ error: 'Erro ao buscar loja.' });
  }
});

export default router;
