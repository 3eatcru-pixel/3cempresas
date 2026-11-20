import express from 'express';
import {
  db,
  getRuntimePersistenceCapabilities,
  revokeAuthSessionEverywhere,
} from '../../config.ts';
import { verifyAutonomousToken, requireRoles, AuthenticatedRequestUser } from '../../middleware/auth.ts';
import {
  generateHlcTimestamp,
  generateStoreId,
  generateTenantId,
} from '../../../utils/idGenerator.ts';
import { stageSyncOutboxInTransaction } from '../../persistence/PersistenceDriver.ts';
import { resolveDefaultDevicesForPlan } from '../../utils/deviceLicensing.ts';
import {
  recordAdminAuditEvent,
  stripPrototypePollution,
} from './adminHelpersCore.ts';
import saasBillingSettlementCore from './saasBillingSettlementCore.ts';

const router = express.Router();

// ==========================================
// TENANTS, PROVISIONED STORES & SUBSCRIPTION QUOTAS
// ==========================================

router.post('/tenants/:tenantId/suspend', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const nowIso = new Date().toISOString();
    const nowSec = Math.floor(Date.now() / 1000);

    const [storesSnap, usersSnap] = await Promise.all([
      db.collection('stores').get(),
      db.collection('users').get(),
    ]);
    const matchingStoreIds = storesSnap.docs
      .filter(d => !d.data()?._deleted && d.data()?.tenantId === tenantId)
      .map(d => d.id);
    const affectedUserIds = usersSnap.docs
      .filter(uDoc => {
        const u = uDoc.data();
        return !u?._deleted && u?.tenantId === tenantId && u?.role !== 'DEV_OWNER' && u?.role !== 'CUSTOMER' && u?.role !== 'CONSUMER';
      })
      .map(uDoc => ({ id: uDoc.id, nextVersion: (Number(uDoc.data()?.tokenVersion) || 1) + 1 }));

    const tenantRef = db.collection('tenants').doc(tenantId);
    const existingTenantSnap = await tenantRef.get();
    if (!existingTenantSnap.exists && matchingStoreIds.length === 0) {
      return res.status(404).json({ error: `Empresa/Tenant '${tenantId}' não encontrado.` });
    }

    const previousStatus = existingTenantSnap.data()?.status || 'ACTIVE';

    await db.runTransaction(async (tx) => {
      const txTenantSnap = await tx.get(tenantRef);
      tx.set(tenantRef, {
        ...(txTenantSnap.exists ? txTenantSnap.data() : {}),
        id: tenantId,
        status: 'SUSPENDED',
        suspendedAt: nowIso,
        suspendedReason: typeof req.body?.reason === 'string' ? req.body.reason : null,
        updatedAt: nowIso
      }, { merge: true });

      for (const storeId of matchingStoreIds) {
        tx.update(db.collection('stores').doc(storeId), {
          tenantStatus: 'SUSPENDED',
          isOpen: false,
          updatedAt: nowIso
        });
      }

      for (const uInfo of affectedUserIds) {
        tx.update(db.collection('users').doc(uInfo.id), {
          tokenVersion: uInfo.nextVersion,
          tokenRevokedAtSec: nowSec,
          updatedAt: nowIso
        });
      }
    });

    for (const uInfo of affectedUserIds) {
      await revokeAuthSessionEverywhere(uInfo.id);
    }

    await recordAdminAuditEvent(
      'TENANT_SUSPENDED',
      `Empresa/Tenant '${tenantId}' suspensa pelo HQ Central. Acesso de lojistas e filiais bloqueado.`,
      'hq/governance',
      tenantId,
      {
        req,
        actor: authenticatedUser,
        resourceType: 'tenants',
        resourceId: tenantId,
        before: { status: previousStatus },
        after: { status: 'SUSPENDED', affectedStores: matchingStoreIds.length, affectedUsers: affectedUserIds.length },
      }
    );

    res.json({ success: true, status: 'SUSPENDED', tenantId });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao suspender empresa.' });
  }
});

router.post('/tenants/:tenantId/activate', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const nowIso = new Date().toISOString();

    const storesSnap = await db.collection('stores').get();
    const matchingStoreIds = storesSnap.docs
      .filter(d => !d.data()?._deleted && d.data()?.tenantId === tenantId)
      .map(d => d.id);
    const tenantRef = db.collection('tenants').doc(tenantId);
    const existingTenantSnap = await tenantRef.get();
    if (!existingTenantSnap.exists && matchingStoreIds.length === 0) {
      return res.status(404).json({ error: `Empresa/Tenant '${tenantId}' não encontrado.` });
    }
    const previousStatus = existingTenantSnap.data()?.status || 'SUSPENDED';

    await db.runTransaction(async (tx) => {
      const txTenantSnap = await tx.get(tenantRef);
      tx.set(tenantRef, {
        ...(txTenantSnap.exists ? txTenantSnap.data() : {}),
        id: tenantId,
        status: 'ACTIVE',
        activatedAt: nowIso,
        updatedAt: nowIso
      }, { merge: true });

      for (const storeId of matchingStoreIds) {
        tx.update(db.collection('stores').doc(storeId), {
          tenantStatus: 'ACTIVE',
          updatedAt: nowIso
        });
      }
    });

    await recordAdminAuditEvent(
      'TENANT_ACTIVATED',
      `Empresa/Tenant '${tenantId}' reativada pelo HQ Central.`,
      'hq/governance',
      tenantId,
      {
        req,
        actor: authenticatedUser,
        resourceType: 'tenants',
        resourceId: tenantId,
        before: { status: previousStatus },
        after: { status: 'ACTIVE', affectedStores: matchingStoreIds.length },
      }
    );

    res.json({ success: true, status: 'ACTIVE', tenantId });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao ativar empresa.' });
  }
});

router.post('/stores', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const rawStore = stripPrototypePollution(req.body || {});
    const name = typeof rawStore.name === 'string' ? rawStore.name.trim() : '';
    if (name.length < 2) {
      return res.status(400).json({ error: 'Nome da loja (mínimo 2 caracteres) é obrigatório.' });
    }

    const validPlans = ['FREE', 'PROMO', 'BASIC', 'PRO', 'ENTERPRISE'];
    const plan = validPlans.includes(String(rawStore.subscriptionPlan || 'PRO'))
      ? String(rawStore.subscriptionPlan || 'PRO')
      : 'PRO';
    const validCycles = ['MONTHLY', 'QUARTERLY', 'ANNUAL'];
    const billingCycle = validCycles.includes(String(rawStore.billingCycle || 'MONTHLY'))
      ? String(rawStore.billingCycle || 'MONTHLY')
      : 'MONTHLY';

    const storeId = typeof rawStore.id === 'string' && rawStore.id.trim() ? rawStore.id.trim() : generateStoreId();
    const tenantId =
      typeof rawStore.tenantId === 'string' && rawStore.tenantId.trim()
        ? rawStore.tenantId.trim()
        : generateTenantId();

    const nowIso = new Date().toISOString();
    const hlcTimestamp = generateHlcTimestamp();

    const createdStore = await db.runTransaction(async (tx) => {
      const storeRef = db.collection('stores').doc(storeId);
      const existingStore = await tx.get(storeRef);
      if (existingStore.exists) {
        const err: any = new Error(`Loja '${storeId}' já existe.`);
        err.statusCode = 409;
        throw err;
      }

      const govSnap = await tx.get(db.collection('governance').doc('governance'));
      const govTierPricing = govSnap.exists ? govSnap.data()?.planPricing?.[plan] : undefined;

      const maxAllowedBranches =
        typeof rawStore.maxAllowedBranches === 'number' && rawStore.maxAllowedBranches > 0
          ? Math.floor(rawStore.maxAllowedBranches)
          : Number(govTierPricing?.maxBranches) > 0
          ? Number(govTierPricing.maxBranches)
          : plan === 'ENTERPRISE'
          ? 5
          : plan === 'PRO'
          ? 2
          : 1;

      const maxAllowedDevices =
        typeof rawStore.maxAllowedDevices === 'number' && rawStore.maxAllowedDevices > 0
          ? Math.floor(rawStore.maxAllowedDevices)
          : Number(govTierPricing?.maxDevices) > 0
          ? Number(govTierPricing.maxDevices)
          : resolveDefaultDevicesForPlan(plan);

      let saasMonthlyFee =
        typeof rawStore.saasMonthlyFee === 'number' && Number.isFinite(rawStore.saasMonthlyFee)
          ? rawStore.saasMonthlyFee
          : undefined;
      if (saasMonthlyFee === undefined) {
        if (govTierPricing?.monthlyPrice !== undefined) {
          saasMonthlyFee =
            billingCycle === 'ANNUAL' && govTierPricing.annualPrice !== undefined
              ? Number(govTierPricing.annualPrice)
              : billingCycle === 'QUARTERLY' && govTierPricing.quarterlyPrice !== undefined
              ? Number(govTierPricing.quarterlyPrice)
              : Number(govTierPricing.monthlyPrice);
        } else {
          const baseMonthly =
            plan === 'FREE' ? 0 : plan === 'PROMO' ? 49.9 : plan === 'BASIC' ? 149 : plan === 'PRO' ? 299 : 499;
          saasMonthlyFee =
            billingCycle === 'ANNUAL' ? baseMonthly * 0.75 : billingCycle === 'QUARTERLY' ? baseMonthly * 0.9 : baseMonthly;
        }
      }

      const saasPaymentStatus =
        rawStore.saasPaymentStatus || (plan === 'FREE' ? 'TRIAL' : 'PENDING');

      const tenantRef = db.collection('tenants').doc(tenantId);
      const existingTenant = await tx.get(tenantRef);

      const storeDoc: Record<string, any> = {
        ...rawStore,
        id: storeId,
        name,
        tenantId,
        tenantStatus: existingTenant.exists ? existingTenant.data()?.status || 'ACTIVE' : 'ACTIVE',
        category: rawStore.category || 'Restaurante',
        isOpen: rawStore.isOpen ?? true,
        rating: typeof rawStore.rating === 'number' ? rawStore.rating : 5.0,
        deliveryTimeMin: Number(rawStore.deliveryTimeMin) || 25,
        deliveryTimeMax: Number(rawStore.deliveryTimeMax) || 40,
        deliveryFee: Number(rawStore.deliveryFee) || 0,
        subscriptionPlan: plan,
        billingCycle,
        maxAllowedBranches,
        maxAllowedDevices,
        saasMonthlyFee: Number(Number(saasMonthlyFee).toFixed(2)),
        saasPaymentStatus,
        isBranch: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      if (plan === 'FREE' && !storeDoc.trialExpiresAt) {
        const defaultTrialDays = Number(govSnap.exists ? govSnap.data()?.defaultTrialDays : 7) || 7;
        storeDoc.trialExpiresAt = new Date(Date.now() + defaultTrialDays * 86400000).toISOString();
      }
      if (storeDoc.commissionRate === undefined && govSnap.exists && typeof govSnap.data()?.globalCommissionRate === 'number') {
        storeDoc.commissionRate = Number(govSnap.data()?.globalCommissionRate);
      }

      if (!existingTenant.exists) {
        tx.set(tenantRef, {
          id: tenantId,
          name,
          status: 'ACTIVE',
          subscriptionPlan: plan,
          billingCycle,
          maxAllowedBranches,
          maxAllowedDevices,
          saasPaymentStatus,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      tx.set(storeRef, storeDoc);
      stageSyncOutboxInTransaction(tx as any, {
        entity: 'stores',
        entityId: storeId,
        operation: 'UPSERT',
        tenantId,
        storeId,
        nodeId: 'cloud_core',
        hlc: hlcTimestamp,
        payload: storeDoc,
      });
      return storeDoc;
    });

    await recordAdminAuditEvent(
      'HQ_STORE_CREATED',
      `Estabelecimento '${createdStore.name}' (${storeId}) provisionado no tenant '${tenantId}' (plano ${plan}) pelo HQ`,
      'hq/stores',
      tenantId,
      {
        req,
        actor: authenticatedUser,
        resourceType: 'stores',
        resourceId: storeId,
        before: null,
        after: { id: storeId, tenantId, name: createdStore.name, subscriptionPlan: plan },
      }
    );

    res.status(201).json({ success: true, store: createdStore });
  } catch (err: any) {
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    res.status(500).json({ error: err?.message || 'Falha ao provisionar loja pelo HQ.' });
  }
});

router.put('/stores/:id/subscription', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      subscriptionPlan,
      billingCycle,
      maxAllowedBranches,
      maxAllowedDevices,
      saasMonthlyFee,
      saasPaymentStatus,
      trialExpiresAt,
      commissionRate,
      enabledModules,
    } = req.body || {};
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;

    const validPlans = ['FREE', 'PROMO', 'BASIC', 'PRO', 'ENTERPRISE'];
    const validCycles = ['MONTHLY', 'QUARTERLY', 'ANNUAL'];
    const validStatuses = ['TRIAL', 'PENDING', 'PAID', 'OVERDUE', 'SUSPENDED'];

    if (subscriptionPlan && !validPlans.includes(subscriptionPlan)) {
      return res.status(400).json({ error: 'Plano de assinatura inválido.' });
    }
    if (billingCycle && !validCycles.includes(billingCycle)) {
      return res.status(400).json({ error: 'Ciclo de cobrança inválido.' });
    }
    if (saasPaymentStatus && !validStatuses.includes(saasPaymentStatus)) {
      return res.status(400).json({ error: 'Status de pagamento inválido.' });
    }
    if (
      maxAllowedBranches !== undefined &&
      (typeof maxAllowedBranches !== 'number' || !Number.isInteger(maxAllowedBranches) || maxAllowedBranches < 0 || maxAllowedBranches > 500)
    ) {
      return res.status(400).json({ error: 'Número maxAllowedBranches inválido (permitido: inteiro de 0 a 500).' });
    }
    if (
      maxAllowedDevices !== undefined &&
      (typeof maxAllowedDevices !== 'number' || !Number.isInteger(maxAllowedDevices) || maxAllowedDevices < 0 || maxAllowedDevices > 9999)
    ) {
      return res.status(400).json({ error: 'Número maxAllowedDevices inválido (permitido: inteiro de 0 a 9999).' });
    }
    if (
      saasMonthlyFee !== undefined &&
      (typeof saasMonthlyFee !== 'number' || !Number.isFinite(saasMonthlyFee) || saasMonthlyFee < 0 || saasMonthlyFee > 1000000)
    ) {
      return res.status(400).json({ error: 'Mensalidade saasMonthlyFee inválida.' });
    }
    if (
      commissionRate !== undefined &&
      (typeof commissionRate !== 'number' || !Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100)
    ) {
      return res.status(400).json({ error: 'Taxa de comissão commissionRate inválida (0 a 100).' });
    }
    if (
      enabledModules !== undefined &&
      (!Array.isArray(enabledModules) || !enabledModules.every((m) => typeof m === 'string'))
    ) {
      return res.status(400).json({ error: 'Lista enabledModules inválida.' });
    }

    const txOutcome = await db.runTransaction(async (tx) => {
      const storeRef = db.collection('stores').doc(id);
      const storeDoc = await tx.get(storeRef);
      if (!storeDoc.exists || storeDoc.data()?._deleted) {
        return { notFound: true as const };
      }

      const currentStore = storeDoc.data() || {};
      const plan = subscriptionPlan || currentStore?.subscriptionPlan || 'BASIC';
      const cycle = billingCycle || currentStore?.billingCycle || 'MONTHLY';
      const planChanged = plan !== currentStore?.subscriptionPlan;
      const cycleChanged = cycle !== currentStore?.billingCycle;

      const govSnap = await tx.get(db.collection('governance').doc('governance'));
      const govTierPricing = govSnap.exists ? govSnap.data()?.planPricing?.[plan] : undefined;

      let branches = typeof maxAllowedBranches === 'number'
        ? maxAllowedBranches
        : (!planChanged ? currentStore?.maxAllowedBranches : govTierPricing?.maxBranches);
      if (!branches) {
        branches = plan === 'ENTERPRISE' ? 5 : plan === 'PRO' ? 2 : 1;
      }

      const devicesQuota =
        typeof maxAllowedDevices === 'number' && maxAllowedDevices > 0
          ? Math.floor(maxAllowedDevices)
          : (!planChanged && Number(currentStore?.maxAllowedDevices) > 0
              ? Number(currentStore.maxAllowedDevices)
              : (Number(govTierPricing?.maxDevices) > 0
                  ? Number(govTierPricing.maxDevices)
                  : resolveDefaultDevicesForPlan(plan)));

      let fee =
        typeof saasMonthlyFee === 'number'
          ? saasMonthlyFee
          : (!planChanged && !cycleChanged && currentStore?.saasMonthlyFee !== undefined && currentStore?.saasMonthlyFee !== null
              ? currentStore.saasMonthlyFee
              : undefined);
      if (fee === undefined || fee === null) {
        if (govTierPricing?.monthlyPrice !== undefined) {
          if (cycle === 'ANNUAL' && govTierPricing.annualPrice !== undefined) fee = Number(govTierPricing.annualPrice);
          else if (cycle === 'QUARTERLY' && govTierPricing.quarterlyPrice !== undefined) fee = Number(govTierPricing.quarterlyPrice);
          else fee = Number(govTierPricing.monthlyPrice);
        } else {
          const baseMonthly = plan === 'FREE' ? 0 : plan === 'PROMO' ? 49.9 : plan === 'BASIC' ? 149 : plan === 'PRO' ? 299 : 499;
          fee = cycle === 'ANNUAL' ? baseMonthly * 0.75 : cycle === 'QUARTERLY' ? baseMonthly * 0.9 : baseMonthly;
        }
      }

      const paymentStatus =
        saasPaymentStatus ||
        (plan === 'FREE'
          ? 'TRIAL'
          : (planChanged && currentStore?.saasPaymentStatus === 'TRIAL'
              ? 'PENDING'
              : (currentStore?.saasPaymentStatus || 'PAID')));
      const nowIso = new Date().toISOString();

      const patch: Record<string, any> = {
        subscriptionPlan: plan,
        billingCycle: cycle,
        maxAllowedBranches: branches,
        maxAllowedDevices: devicesQuota,
        saasMonthlyFee: Number(fee.toFixed(2)),
        saasPaymentStatus: paymentStatus,
        pendingUpgradeRequest: null,
        updatedAt: nowIso,
      };
      if (typeof commissionRate === 'number') {
        patch.commissionRate = Number(commissionRate.toFixed(2));
      }
      if (Array.isArray(enabledModules)) {
        patch.enabledModules = Array.from(new Set(enabledModules.map((m) => m.trim()).filter(Boolean)));
      }

      if (plan === 'FREE') {
        const defaultTrialDays = Number(govSnap.exists ? govSnap.data()?.defaultTrialDays : 7) || 7;
        patch.trialExpiresAt =
          trialExpiresAt ||
          currentStore?.trialExpiresAt ||
          new Date(Date.now() + defaultTrialDays * 86400000).toISOString();
      } else {
        patch.trialExpiresAt = null;
      }

      const tenantId = currentStore?.tenantId || 'tenant-1';
      const tenantRef = db.collection('tenants').doc(tenantId);
      const existingTenantSnap = await tx.get(tenantRef);

      tx.update(storeRef, patch);
      tx.set(tenantRef, {
        ...(existingTenantSnap.exists ? existingTenantSnap.data() : {}),
        id: tenantId,
        status: existingTenantSnap.data()?.status || 'ACTIVE',
        subscriptionPlan: plan,
        billingCycle: cycle,
        maxAllowedBranches: branches,
        maxAllowedDevices: devicesQuota,
        saasPaymentStatus: paymentStatus,
        updatedAt: nowIso,
      }, { merge: true });

      return { notFound: false as const, currentStore, patch, tenantId, plan, branches, devicesQuota, fee };
    });

    if (txOutcome.notFound) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    await recordAdminAuditEvent(
      'STORE_SUBSCRIPTION_UPDATE',
      `Assinatura da loja ${txOutcome.currentStore?.name || id} atualizada para plano ${txOutcome.plan} (${txOutcome.branches} filiais, ${txOutcome.devicesQuota} dispositivos, R$ ${txOutcome.fee})`,
      'hq/billing',
      txOutcome.tenantId,
      {
        req,
        actor: authenticatedUser,
        resourceType: 'stores',
        resourceId: id,
        before: {
          subscriptionPlan: txOutcome.currentStore?.subscriptionPlan,
          maxAllowedBranches: txOutcome.currentStore?.maxAllowedBranches,
          maxAllowedDevices: txOutcome.currentStore?.maxAllowedDevices,
          saasPaymentStatus: txOutcome.currentStore?.saasPaymentStatus,
        },
        after: txOutcome.patch,
      }
    );

    res.json({ success: true, store: { ...txOutcome.currentStore, ...txOutcome.patch, id } });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao atualizar assinatura da loja.' });
  }
});

router.get('/tenants/multi-empresa', verifyAutonomousToken, requireRoles(['DEV_OWNER']), async (_req, res) => {
  const storesSnap = await db.collection('stores').get();
  const distinctTenants = new Set(
    storesSnap.docs
      .map(d => d.data())
      .filter(s => s && !s._deleted && s.tenantId)
      .map(s => s.tenantId)
  );
  const caps = getRuntimePersistenceCapabilities();
  res.json({
    totalActive: distinctTenants.size,
    driver: caps.persistenceDriver,
    productionDatabaseReady: caps.productionDatabaseReady,
    shards: [
      { shardId: 'local-primary', region: 'standalone', tenantsCount: distinctTenants.size, status: 'HEALTHY' }
    ]
  });
});

router.use(saasBillingSettlementCore);

export default router;
