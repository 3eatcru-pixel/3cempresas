import express from 'express';
import { db, runWithSystemDbContext } from '../../config.ts';
import {
  AuthenticatedRequestUser,
  requireRoles,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import { broadcastSseEvent } from '../../state.ts';
import {
  DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG,
  DEFAULT_PLATFORM_GOVERNANCE,
} from '../../../constants/platformDefaults.ts';
import { stripPrototypePollution, verifyStoreTenantAccess } from './storeAccessHelpers.ts';

const router = express.Router();

const MERCHANT_GROWTH_ROLES = [
  'DEV_OWNER',
  'SUPER_ADMIN',
  'REGIONAL_MANAGER',
  'STORE_OWNER',
  'STORE_MANAGER',
];

const MERCHANT_WRITE_ROLES = ['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER'];

async function loadMarketplaceGovernance() {
  const doc = await runWithSystemDbContext('MERCHANT_MARKETPLACE_GROWTH_READ', () =>
    db.collection('governance').doc('governance').get()
  );
  const raw = doc.exists ? doc.data() : DEFAULT_PLATFORM_GOVERNANCE;
  const rawMkt = raw?.marketplaceConfig || {};
  return {
    rawGovernance: raw || DEFAULT_PLATFORM_GOVERNANCE,
    marketplaceConfig: {
      ...DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG,
      ...rawMkt,
      spotlightPricing: {
        ...DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.spotlightPricing,
        ...(rawMkt.spotlightPricing || {}),
      },
      sponsoredPlacements: Array.isArray(rawMkt.sponsoredPlacements)
        ? rawMkt.sponsoredPlacements
        : [],
      externalChannelConnectors: Array.isArray(rawMkt.externalChannelConnectors)
        ? rawMkt.externalChannelConnectors
        : DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.externalChannelConnectors,
    },
  };
}

router.get(
  '/marketplace-growth',
  verifyAutonomousToken,
  requireRoles(MERCHANT_GROWTH_ROLES),
  async (req, res) => {
    try {
      const user = (req as any).user as AuthenticatedRequestUser;
      const storeId = String(req.query.storeId || user.storeId || '').trim();
      if (!storeId) {
        return res.status(400).json({ error: 'storeId é obrigatório.' });
      }
      const access = await verifyStoreTenantAccess(storeId, user);
      if (!access.ok) {
        return res.status(access.status).json({ error: access.error });
      }

      const { marketplaceConfig } = await loadMarketplaceGovernance();
      const storePlacements = marketplaceConfig.sponsoredPlacements.filter(
        (p: any) => p && p.storeId === storeId
      );
      const availableConnectors = marketplaceConfig.externalChannelConnectors.filter(
        (c: any) => c && c.enabled
      );
      const storeExternalChannels =
        access.store?.operationalSettings?.externalChannels &&
        typeof access.store.operationalSettings.externalChannels === 'object'
          ? access.store.operationalSettings.externalChannels
          : {};

      return res.json({
        storeId,
        spotlightPricing: marketplaceConfig.spotlightPricing,
        placements: storePlacements,
        availableConnectors,
        storeExternalChannels,
      });
    } catch {
      return res.status(500).json({ error: 'Erro ao carregar dados de crescimento no Marketplace.' });
    }
  }
);

router.post(
  '/marketplace-growth/spotlight-request',
  verifyAutonomousToken,
  requireRoles(MERCHANT_WRITE_ROLES),
  async (req, res) => {
    try {
      const user = (req as any).user as AuthenticatedRequestUser;
      const body = stripPrototypePollution(req.body || {});
      const storeId = String(body.storeId || user.storeId || '').trim();
      if (!storeId) {
        return res.status(400).json({ error: 'storeId é obrigatório.' });
      }
      const access = await verifyStoreTenantAccess(storeId, user);
      if (!access.ok) {
        return res.status(access.status).json({ error: access.error });
      }

      const placementType = String(body.placementType || '').toUpperCase();
      if (!['HERO_BANNER', 'RECOMMENDED_CAROUSEL', 'CATEGORY_TOP'].includes(placementType)) {
        return res.status(400).json({ error: 'Tipo de destaque inválido.' });
      }

      const { rawGovernance, marketplaceConfig } = await loadMarketplaceGovernance();
      const storeStatus = String(access.store?.status || 'ACTIVE').toUpperCase();
      const hiddenSet = new Set<string>(
        Array.isArray(marketplaceConfig.hiddenStoreIds) ? marketplaceConfig.hiddenStoreIds : []
      );
      if (storeStatus === 'SUSPENDED' || hiddenSet.has(storeId)) {
        return res.status(403).json({
          error: 'Loja suspensa ou ocultada no Marketplace não pode solicitar novos destaques.',
        });
      }

      const existingForStore = marketplaceConfig.sponsoredPlacements.filter(
        (p: any) => p && p.storeId === storeId && (p.status || (p.active ? 'ACTIVE' : 'PAUSED')) === 'PENDING_APPROVAL'
      );
      if (existingForStore.some((p: any) => String(p.placementType).toUpperCase() === placementType)) {
        return res.status(409).json({
          error: `Já existe uma solicitação pendente de destaque (${placementType}) para esta loja.`,
        });
      }
      if (existingForStore.length >= 5) {
        return res.status(429).json({
          error: 'Limite de 5 solicitações pendentes simultâneas por loja atingido. Aguarde aprovação do HQ.',
        });
      }

      const pricing = marketplaceConfig.spotlightPricing;
      const officialFee =
        placementType === 'HERO_BANNER'
          ? pricing.heroBannerMonthlyFee
          : placementType === 'RECOMMENDED_CAROUSEL'
          ? pricing.recommendedSlotMonthlyFee
          : pricing.categoryTopMonthlyFee;

      const nowIso = new Date().toISOString();
      const createdPlacement = {
        id: `mkt-req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        storeId,
        placementType: placementType as 'HERO_BANNER' | 'RECOMMENDED_CAROUSEL' | 'CATEGORY_TOP',
        badgeText: 'Patrocinado',
        bannerTitle: String(body.bannerTitle || access.store?.name || '').trim().slice(0, 120),
        bannerSubtitle: String(body.bannerSubtitle || '').trim().slice(0, 220),
        ctaLabel: String(body.ctaLabel || 'Ver vitrine').trim().slice(0, 32) || 'Ver vitrine',
        monthlyFee: Number(officialFee) || 0,
        active: false,
        status: 'PENDING_APPROVAL' as const,
        requestedByUid: user.uid,
        requestedAt: nowIso,
      };

      const combined = [createdPlacement, ...marketplaceConfig.sponsoredPlacements];
      const nextPlacements =
        combined.length <= 200
          ? combined
          : [
              ...combined.filter((p: any) => p?.active || p?.status === 'ACTIVE' || p?.status === 'PAUSED'),
              ...combined.filter(
                (p: any) => !p?.active && p?.status !== 'ACTIVE' && p?.status !== 'PAUSED'
              ),
            ].slice(0, 200);

      await runWithSystemDbContext('MERCHANT_MARKETPLACE_SPOTLIGHT_REQUEST', async () => {
        await db
          .collection('governance')
          .doc('governance')
          .set(
            {
              ...rawGovernance,
              marketplaceConfig: {
                ...marketplaceConfig,
                sponsoredPlacements: nextPlacements,
                updatedAt: nowIso,
              },
              updatedAt: nowIso,
            },
            { merge: true }
          );
      });

      await db.collection('audit_logs').doc(`aud-mkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`).set({
        action: 'STORE_MARKETPLACE_SPOTLIGHT_REQUEST',
        channel: 'store/marketplace-growth',
        tenantId: access.store?.tenantId || user.tenantId || 'tenant-1',
        storeId,
        actorUid: user.uid,
        actorEmail: user.email || null,
        actorRole: user.role,
        resourceType: 'sponsored_placement',
        resourceId: createdPlacement.id,
        details: `Solicitação de destaque ${placementType} criada para a loja ${storeId}`,
        afterState: createdPlacement,
        timestamp: nowIso,
      });

      broadcastSseEvent('GOVERNANCE_UPDATED', { type: 'SPOTLIGHT_REQUEST' }, 'ALL', true);
      return res.status(201).json({ success: true, placement: createdPlacement });
    } catch {
      return res.status(500).json({ error: 'Erro ao registrar solicitação de destaque.' });
    }
  }
);

router.put(
  '/marketplace-growth/external-channels',
  verifyAutonomousToken,
  requireRoles(MERCHANT_WRITE_ROLES),
  async (req, res) => {
    try {
      const user = (req as any).user as AuthenticatedRequestUser;
      const body = stripPrototypePollution(req.body || {});
      const storeId = String(body.storeId || user.storeId || '').trim();
      if (!storeId) {
        return res.status(400).json({ error: 'storeId é obrigatório.' });
      }
      const access = await verifyStoreTenantAccess(storeId, user);
      if (!access.ok) {
        return res.status(access.status).json({ error: access.error });
      }

      if (String(access.store?.status || 'ACTIVE').toUpperCase() === 'SUSPENDED') {
        return res.status(403).json({
          error: 'Loja suspensa não pode alterar conectores de canais externos.',
        });
      }

      const { marketplaceConfig } = await loadMarketplaceGovernance();
      const enabledProviders = new Set<string>(
        marketplaceConfig.externalChannelConnectors
          .filter((c: any) => c && c.enabled)
          .map((c: any) => String(c.provider).toUpperCase())
      );

      const incomingChannels =
        body.externalChannels && typeof body.externalChannels === 'object'
          ? body.externalChannels
          : {};
      const sanitizedChannels: Record<
        string,
        { enabled: boolean; merchantExternalId: string; autoAcceptOrders: boolean }
      > = {};

      for (const provider of enabledProviders) {
        const entry = incomingChannels[provider];
        if (!entry || typeof entry !== 'object') continue;
        sanitizedChannels[provider] = {
          enabled: Boolean(entry.enabled),
          merchantExternalId: String(entry.merchantExternalId || '').trim().slice(0, 80),
          autoAcceptOrders: Boolean(entry.autoAcceptOrders),
        };
      }

      const nowIso = new Date().toISOString();
      const nextOperationalSettings = {
        ...(access.store?.operationalSettings || {}),
        externalChannels: sanitizedChannels,
      };

      await db.collection('stores').doc(storeId).set(
        {
          operationalSettings: nextOperationalSettings,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      await db.collection('audit_logs').doc(`aud-ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`).set({
        action: 'STORE_EXTERNAL_CHANNELS_UPDATED',
        channel: 'store/marketplace-growth',
        tenantId: access.store?.tenantId || user.tenantId || 'tenant-1',
        storeId,
        actorUid: user.uid,
        actorEmail: user.email || null,
        actorRole: user.role,
        resourceType: 'store_external_channels',
        resourceId: storeId,
        details: `Canais externos atualizados para loja ${storeId}`,
        afterState: sanitizedChannels,
        timestamp: nowIso,
      });

      return res.json({ success: true, storeExternalChannels: sanitizedChannels });
    } catch {
      return res.status(500).json({ error: 'Erro ao salvar canais externos da loja.' });
    }
  }
);

export default router;
