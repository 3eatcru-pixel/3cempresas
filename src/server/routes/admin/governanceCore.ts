import express from 'express';
import fs from 'fs';
import path from 'path';
import { db, runWithSystemDbContext } from '../../config.ts';
import { verifyAutonomousToken, requireRoles, AuthenticatedRequestUser } from '../../middleware/auth.ts';
import {
  DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG,
  DEFAULT_PLATFORM_BILLING_CONFIG,
  DEFAULT_PLATFORM_GOVERNANCE,
  DEFAULT_PLATFORM_RUNTIME_POLICY,
  DEFAULT_RELEASE_DISTRIBUTION_CONFIG,
} from '../../../constants/platformDefaults.ts';
import { recordAdminAuditEvent, stripPrototypePollution } from './adminHelpersCore.ts';
import {
  sanitizeBillingConfigPatch,
  sanitizeMarketplaceConfigPatch,
  sanitizeReleaseConfigPatch,
  sanitizeRuntimePolicyPatch,
  sanitizeScalarGovernancePatch,
} from './governanceValidators.ts';
import { broadcastSseEvent } from '../../state.ts';

const router = express.Router();

const isEnvPspWebhookConfigured = () =>
  Boolean(
    (
      process.env.STRIPE_WEBHOOK_SECRET ||
      process.env.SAAS_PSP_WEBHOOK_SECRET ||
      process.env.PSP_WEBHOOK_SECRET ||
      ''
    ).trim()
  );

async function checkPspWebhookConfigured(): Promise<boolean> {
  if (isEnvPspWebhookConfigured()) return true;
  try {
    const snap = await runWithSystemDbContext('GOV_PSP_VAULT_CHECK', () =>
      db.collection('integrations').get()
    );
    return snap.docs.some((d) => {
      const integ = d.data();
      return (
        integ &&
        !integ._deleted &&
        integ.status !== 'SUSPENDED' &&
        integ.category === 'PAYMENT' &&
        Boolean(integ.encryptedSecret) &&
        (!integ.tenantId || integ.tenantId === 'tenant-1')
      );
    });
  } catch {
    return false;
  }
}

const buildHydratedGovernance = (raw: any, pspConfigured = isEnvPspWebhookConfigured()) => ({
  ...DEFAULT_PLATFORM_GOVERNANCE,
  ...(raw || {}),
  featureFlags: {
    ...DEFAULT_PLATFORM_GOVERNANCE.featureFlags,
    ...(raw?.featureFlags || {}),
  },
  planPricing: {
    ...DEFAULT_PLATFORM_GOVERNANCE.planPricing,
    ...(raw?.planPricing || {}),
  },
  billingConfig: {
    ...DEFAULT_PLATFORM_BILLING_CONFIG,
    ...(raw?.billingConfig || {}),
  },
  releaseConfig: {
    ...DEFAULT_RELEASE_DISTRIBUTION_CONFIG,
    ...(raw?.releaseConfig || {}),
    artifactSignatures:
      raw?.releaseConfig?.artifactSignatures && typeof raw.releaseConfig.artifactSignatures === 'object'
        ? raw.releaseConfig.artifactSignatures
        : DEFAULT_RELEASE_DISTRIBUTION_CONFIG.artifactSignatures || {},
  },
  runtimePolicy: {
    ...DEFAULT_PLATFORM_RUNTIME_POLICY,
    ...(raw?.runtimePolicy || {}),
    extraAllowedOrigins: Array.isArray(raw?.runtimePolicy?.extraAllowedOrigins)
      ? raw.runtimePolicy.extraAllowedOrigins
      : DEFAULT_PLATFORM_RUNTIME_POLICY.extraAllowedOrigins,
  },
  marketplaceConfig: {
    ...DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG,
    ...(raw?.marketplaceConfig || {}),
    featuredStoreIds: Array.isArray(raw?.marketplaceConfig?.featuredStoreIds)
      ? raw?.marketplaceConfig?.featuredStoreIds
      : DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.featuredStoreIds,
    hiddenStoreIds: Array.isArray(raw?.marketplaceConfig?.hiddenStoreIds)
      ? raw?.marketplaceConfig?.hiddenStoreIds
      : DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.hiddenStoreIds,
    enabledVerticals: Array.isArray(raw?.marketplaceConfig?.enabledVerticals)
      ? raw?.marketplaceConfig?.enabledVerticals
      : DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.enabledVerticals,
    spotlightPricing: {
      ...DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.spotlightPricing,
      ...(raw?.marketplaceConfig?.spotlightPricing || {}),
    },
    sponsoredPlacements: Array.isArray(raw?.marketplaceConfig?.sponsoredPlacements)
      ? raw?.marketplaceConfig?.sponsoredPlacements
      : DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.sponsoredPlacements,
    externalChannelConnectors: Array.isArray(raw?.marketplaceConfig?.externalChannelConnectors)
      ? raw?.marketplaceConfig?.externalChannelConnectors
      : DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.externalChannelConnectors,
  },
  pspWebhookConfigured: pspConfigured,
});

router.get('/governance', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (_req, res) => {
  const pspConfigured = await checkPspWebhookConfigured();
  try {
    const doc = await db.collection('governance').doc('governance').get();
    if (doc.exists) {
      res.json(buildHydratedGovernance(doc.data(), pspConfigured));
    } else {
      res.json(buildHydratedGovernance(DEFAULT_PLATFORM_GOVERNANCE, pspConfigured));
    }
  } catch {
    res.json(buildHydratedGovernance(DEFAULT_PLATFORM_GOVERNANCE, pspConfigured));
  }
});

router.put('/governance', verifyAutonomousToken, requireRoles(['DEV_OWNER']), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const cleanBody = stripPrototypePollution(req.body || {});
    const currentSnap = await db.collection('governance').doc('governance').get();
    const current = (currentSnap.exists ? currentSnap.data() : DEFAULT_PLATFORM_GOVERNANCE) || DEFAULT_PLATFORM_GOVERNANCE;

    const scalarRes = sanitizeScalarGovernancePatch(cleanBody, current);
    if (scalarRes.ok === false) {
      return res.status(scalarRes.status).json({ error: scalarRes.error });
    }
    const normalizedPatch = scalarRes.value;

    if (cleanBody.billingConfig && typeof cleanBody.billingConfig === 'object') {
      const billingRes = sanitizeBillingConfigPatch(cleanBody.billingConfig, current?.billingConfig);
      if (billingRes.ok === false) {
        return res.status(billingRes.status).json({ error: billingRes.error });
      }
      normalizedPatch.billingConfig = billingRes.value;
    }

    if (cleanBody.releaseConfig && typeof cleanBody.releaseConfig === 'object') {
      const releaseRes = sanitizeReleaseConfigPatch(cleanBody.releaseConfig, current?.releaseConfig);
      if (releaseRes.ok === false) {
        return res.status(releaseRes.status).json({ error: releaseRes.error });
      }
      normalizedPatch.releaseConfig = releaseRes.value;
    }

    if (cleanBody.runtimePolicy && typeof cleanBody.runtimePolicy === 'object') {
      const policyRes = sanitizeRuntimePolicyPatch(cleanBody.runtimePolicy, current?.runtimePolicy);
      if (policyRes.ok === false) {
        return res.status(policyRes.status).json({ error: policyRes.error });
      }
      normalizedPatch.runtimePolicy = policyRes.value;
    }

    if (cleanBody.marketplaceConfig && typeof cleanBody.marketplaceConfig === 'object') {
      const mktRes = sanitizeMarketplaceConfigPatch(cleanBody.marketplaceConfig, current?.marketplaceConfig);
      if (mktRes.ok === false) {
        return res.status(mktRes.status).json({ error: mktRes.error });
      }
      normalizedPatch.marketplaceConfig = mktRes.value;
    }

    const merged = { ...current, ...normalizedPatch, updatedAt: new Date().toISOString() };
    await db.collection('governance').doc('governance').set(merged, { merge: true });
    broadcastSseEvent('GOVERNANCE_UPDATED', { featureFlags: merged.featureFlags }, 'ALL', true);
    await recordAdminAuditEvent(
      'HQ_GOVERNANCE_UPDATE',
      `Governança global atualizada por ${authenticatedUser.email || authenticatedUser.uid}`,
      'hq/governance',
      authenticatedUser.tenantId || 'tenant-1',
      {
        req,
        actor: authenticatedUser,
        resourceType: 'governance',
        resourceId: 'governance',
        before: current,
        after: merged,
      }
    );
    const pspConfigured = await checkPspWebhookConfigured();
    res.json({ success: true, governance: buildHydratedGovernance(merged, pspConfigured) });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar governança.' });
  }
});

router.get('/audit-logs', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const [eventsSnap, auditSnap] = await Promise.all([
      db.collection('events').get(),
      db.collection('audit_logs').get(),
    ]);

    const normalized: any[] = [];
    for (const d of eventsSnap.docs) {
      const ev = d.data() || {};
      normalized.push({
        id: ev.id || d.id,
        source: 'events',
        type: ev.type || 'SYSTEM_EVENT',
        action: ev.action || ev.type || 'SYSTEM_EVENT',
        payload: ev.payload || ev.message || '',
        channel: ev.channel || 'system',
        tenantId: ev.tenantId || 'tenant-1',
        storeId: ev.storeId || null,
        actorUid: ev.actorUid || null,
        actorEmail: ev.actorEmail || null,
        actorRole: ev.actorRole || null,
        sourceIp: ev.sourceIp || null,
        requestId: ev.requestId || null,
        resourceType: ev.resourceType || null,
        resourceId: ev.resourceId || null,
        beforeState: ev.beforeState ?? null,
        afterState: ev.afterState ?? null,
        result: ev.result || 'SUCCESS',
        immutable: ev.immutable !== false,
        timestamp: ev.timestamp || ev.createdAt || new Date(0).toISOString(),
        timeStr: ev.timeStr || '',
      });
    }

    for (const d of auditSnap.docs) {
      const al = d.data() || {};
      normalized.push({
        id: al.id || d.id,
        source: 'audit_logs',
        type: al.action || al.type || 'STORE_AUDIT',
        action: al.action || al.type || 'STORE_AUDIT',
        payload: al.details || al.payload || al.message || JSON.stringify(al.metadata || {}),
        channel: al.channel || 'store/audit',
        tenantId: al.tenantId || 'tenant-1',
        storeId: al.storeId || null,
        actorUid: al.actorUid || al.userId || null,
        actorEmail: al.actorEmail || al.userEmail || null,
        actorRole: al.actorRole || al.role || null,
        sourceIp: al.sourceIp || al.ip || null,
        requestId: al.requestId || null,
        resourceType: al.resourceType || al.entityType || null,
        resourceId: al.resourceId || al.entityId || null,
        beforeState: al.beforeState ?? null,
        afterState: al.afterState ?? null,
        result: al.result || 'SUCCESS',
        immutable: true,
        timestamp: al.timestamp || al.createdAt || new Date(0).toISOString(),
        timeStr: al.timeStr || '',
      });
    }

    const filterType = req.query.type ? String(req.query.type).toUpperCase() : '';
    const filterTenant = req.query.tenantId ? String(req.query.tenantId) : '';
    const filterActor = req.query.actorUid ? String(req.query.actorUid) : '';
    const filterChannel = req.query.channel ? String(req.query.channel).toLowerCase() : '';
    const filterQuery = req.query.q ? String(req.query.q).toLowerCase() : '';
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));

    let filtered = normalized;
    if (filterType && filterType !== 'ALL') {
      filtered = filtered.filter((item) => String(item.type).toUpperCase().includes(filterType));
    }
    if (filterTenant) {
      filtered = filtered.filter((item) => item.tenantId === filterTenant);
    }
    if (filterActor) {
      filtered = filtered.filter((item) => item.actorUid === filterActor);
    }
    if (filterChannel) {
      filtered = filtered.filter((item) => String(item.channel).toLowerCase().includes(filterChannel));
    }
    if (filterQuery) {
      filtered = filtered.filter((item) => {
        const blob = `${item.type} ${item.payload} ${item.channel} ${item.actorEmail || ''} ${item.tenantId || ''} ${item.resourceId || ''}`.toLowerCase();
        return blob.includes(filterQuery);
      });
    }

    filtered.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    const logs = filtered.slice(0, limit);
    res.json({ logs, total: filtered.length });
  } catch {
    res.status(500).json({ error: 'Falha ao consultar trilha unificada de auditoria.' });
  }
});

router.post('/reset-sandbox', verifyAutonomousToken, requireRoles(['DEV_OWNER']), async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Operação proibida em ambiente de produção (NODE_ENV=production).' });
    }
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    await db.resetToSeeds();
    await recordAdminAuditEvent(
      'PLATFORM_SANDBOX_RESET',
      `Plataforma restaurada para o estado inicial por ${authenticatedUser.email || authenticatedUser.uid}`,
      'hq/governance',
      authenticatedUser.tenantId || 'tenant-1',
      { req, actor: authenticatedUser, resourceType: 'platform', resourceId: 'sandbox' }
    );
    res.json({ success: true, resetAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao resetar sandbox da plataforma.' });
  }
});

router.get('/baseline', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (_req, res) => {
  try {
    const baselinePath = path.join(process.cwd(), 'docs', 'architecture', 'README.md');
    if (!fs.existsSync(baselinePath)) {
      return res.status(404).json({ error: 'Documento docs/architecture/README.md não encontrado.' });
    }
    const content = fs.readFileSync(baselinePath, 'utf-8');
    res.json({ filename: 'docs/architecture/README.md', content });
  } catch {
    res.status(500).json({ error: 'Erro ao carregar baseline técnica.' });
  }
});

export default router;
