import { DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG } from '../../../constants/platformDefaults.ts';

export type MarketplaceSanitizeResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string };

export function sanitizeMarketplaceConfigPatch(
  incoming: Record<string, any>,
  currentMarketplace?: Record<string, any>
): MarketplaceSanitizeResult<Record<string, any>> {
  const existingMkt = {
    ...DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG,
    ...(currentMarketplace || {}),
  };

  const rawRadius =
    incoming.defaultDiscoveryRadiusKm !== undefined
      ? Number(incoming.defaultDiscoveryRadiusKm)
      : existingMkt.defaultDiscoveryRadiusKm;
  if (!Number.isFinite(rawRadius) || rawRadius < 1 || rawRadius > 100) {
    return {
      ok: false,
      status: 400,
      error: 'Raio padrão de descoberta do Marketplace inválido (permitido: 1 a 100 km).',
    };
  }

  const sanitizeIdArray = (val: unknown, fallback: string[]) =>
    Array.isArray(val)
      ? Array.from(
          new Set(
            val
              .map((v) => String(v || '').trim().slice(0, 80))
              .filter(Boolean)
          )
        ).slice(0, 200)
      : fallback;

  const validVerticals = new Set(['RESTAURANT', 'RETAIL', 'SERVICES', 'MULTI_COMMERCE']);
  const nextVerticals = Array.isArray(incoming.enabledVerticals)
    ? Array.from(
        new Set(
          incoming.enabledVerticals
            .map((v: unknown) => String(v || '').trim().toUpperCase())
            .filter((v: string) => validVerticals.has(v))
        )
      )
    : existingMkt.enabledVerticals;
  if (nextVerticals.length === 0) {
    return {
      ok: false,
      status: 400,
      error: 'Mantenha pelo menos uma vertical ativa no Marketplace.',
    };
  }

  const featuredIds = sanitizeIdArray(incoming.featuredStoreIds, existingMkt.featuredStoreIds);
  const hiddenIds = sanitizeIdArray(incoming.hiddenStoreIds, existingMkt.hiddenStoreIds);
  const hiddenSet = new Set(hiddenIds);

  const clampMoney = (val: unknown, fallback: number, max = 100000) => {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0 || n > max) return fallback;
    return Number(n.toFixed(2));
  };

  const incomingPricing =
    incoming.spotlightPricing && typeof incoming.spotlightPricing === 'object'
      ? incoming.spotlightPricing
      : {};
  const existingPricing = {
    ...DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.spotlightPricing,
    ...(existingMkt.spotlightPricing || {}),
  };
  const nextSpotlightPricing = {
    heroBannerMonthlyFee: clampMoney(
      incomingPricing.heroBannerMonthlyFee,
      existingPricing.heroBannerMonthlyFee
    ),
    recommendedSlotMonthlyFee: clampMoney(
      incomingPricing.recommendedSlotMonthlyFee,
      existingPricing.recommendedSlotMonthlyFee
    ),
    categoryTopMonthlyFee: clampMoney(
      incomingPricing.categoryTopMonthlyFee,
      existingPricing.categoryTopMonthlyFee
    ),
  };

  const validPlacementTypes = new Set(['HERO_BANNER', 'RECOMMENDED_CAROUSEL', 'CATEGORY_TOP']);
  const validStatuses = new Set(['PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'REJECTED']);
  const nextSponsoredPlacements = Array.isArray(incoming.sponsoredPlacements)
    ? incoming.sponsoredPlacements
        .slice(0, 100)
        .map((p: any, idx: number) => {
          const storeId = String(p?.storeId || '').trim().slice(0, 80);
          const placementType = String(p?.placementType || 'RECOMMENDED_CAROUSEL').toUpperCase();
          if (!storeId || !validPlacementTypes.has(placementType)) return null;
          const isActive = Boolean(p?.active) && !hiddenSet.has(storeId);
          const rawStatus = String(p?.status || '').toUpperCase();
          const resolvedStatus = validStatuses.has(rawStatus)
            ? (rawStatus as 'PENDING_APPROVAL' | 'ACTIVE' | 'PAUSED' | 'REJECTED')
            : isActive
            ? 'ACTIVE'
            : 'PAUSED';
          return {
            id: String(p?.id || `mkt-ad-${Date.now()}-${idx}`).trim().slice(0, 80),
            storeId,
            placementType: placementType as 'HERO_BANNER' | 'RECOMMENDED_CAROUSEL' | 'CATEGORY_TOP',
            badgeText: String(p?.badgeText || 'Patrocinado').trim().slice(0, 28) || 'Patrocinado',
            bannerTitle: String(p?.bannerTitle || '').trim().slice(0, 120),
            bannerSubtitle: String(p?.bannerSubtitle || '').trim().slice(0, 220),
            ctaLabel: String(p?.ctaLabel || 'Ver vitrine').trim().slice(0, 32) || 'Ver vitrine',
            monthlyFee: clampMoney(p?.monthlyFee, 0),
            active: isActive,
            status: resolvedStatus,
            requestedByUid: p?.requestedByUid ? String(p.requestedByUid).trim().slice(0, 80) : undefined,
            requestedAt: p?.requestedAt ? String(p.requestedAt).trim().slice(0, 40) : undefined,
            startsAt: p?.startsAt ? String(p.startsAt).trim().slice(0, 40) : undefined,
            endsAt: p?.endsAt ? String(p.endsAt).trim().slice(0, 40) : undefined,
          };
        })
        .filter(Boolean)
    : Array.isArray(existingMkt.sponsoredPlacements)
    ? existingMkt.sponsoredPlacements
    : [];

  const validProviders = new Set(['IFOOD', 'UBER_EATS', 'DELIVEROO', 'RAPPI', 'NINETY_NINE_FOOD']);
  const defaultConnectorsByProvider = new Map(
    DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.externalChannelConnectors.map((c) => [c.provider, c])
  );
  const nextConnectors = Array.isArray(incoming.externalChannelConnectors)
    ? incoming.externalChannelConnectors
        .slice(0, 20)
        .map((c: any) => {
          const provider = String(c?.provider || '').toUpperCase();
          if (!validProviders.has(provider)) return null;
          const fallback = defaultConnectorsByProvider.get(provider as any);
          const share = Number(c?.revenueSharePercent);
          return {
            provider: provider as any,
            label:
              String(c?.label || fallback?.label || provider).trim().slice(0, 60) ||
              fallback?.label ||
              provider,
            enabled: Boolean(c?.enabled),
            monthlyAddonFee: clampMoney(c?.monthlyAddonFee, fallback?.monthlyAddonFee ?? 79),
            revenueSharePercent:
              Number.isFinite(share) && share >= 0 && share <= 50 ? Number(share.toFixed(2)) : 0,
            syncCatalog: c?.syncCatalog !== false,
            syncOrders: c?.syncOrders !== false,
          };
        })
        .filter(Boolean)
    : Array.isArray(existingMkt.externalChannelConnectors)
    ? existingMkt.externalChannelConnectors
    : DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.externalChannelConnectors;

  return {
    ok: true,
    value: {
      marketplaceName:
        incoming.marketplaceName !== undefined
          ? String(incoming.marketplaceName || '').trim().slice(0, 60) || '3C Marketplace'
          : existingMkt.marketplaceName,
      heroHeadline:
        incoming.heroHeadline !== undefined
          ? String(incoming.heroHeadline || '').trim().slice(0, 140)
          : existingMkt.heroHeadline,
      heroSubtitle:
        incoming.heroSubtitle !== undefined
          ? String(incoming.heroSubtitle || '').trim().slice(0, 260)
          : existingMkt.heroSubtitle,
      recommendationsTitle:
        incoming.recommendationsTitle !== undefined
          ? String(incoming.recommendationsTitle || '').trim().slice(0, 80) ||
            'Recomendados para você'
          : existingMkt.recommendationsTitle || 'Recomendados para você',
      featuredStoreIds: featuredIds.filter((id) => !hiddenSet.has(id)),
      hiddenStoreIds: hiddenIds,
      defaultDiscoveryRadiusKm: Math.round(rawRadius),
      allowGuestBrowsing:
        incoming.allowGuestBrowsing !== undefined
          ? Boolean(incoming.allowGuestBrowsing)
          : existingMkt.allowGuestBrowsing,
      enabledVerticals: nextVerticals,
      spotlightPricing: nextSpotlightPricing,
      sponsoredPlacements: nextSponsoredPlacements,
      externalChannelConnectors: nextConnectors,
      updatedAt: new Date().toISOString(),
    },
  };
}
