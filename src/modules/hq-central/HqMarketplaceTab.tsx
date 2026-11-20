import React, { useEffect, useMemo, useState } from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG } from '../../constants/platformDefaults';
import {
  ExternalDeliveryChannelConfig,
  MarketplaceSponsoredPlacement,
  MarketplaceSpotlightPricing,
} from '../../types';
import { HqMarketplaceKpiStrip } from './marketplace/HqMarketplaceKpiStrip';
import {
  HqMarketplaceExperienceForm,
  MarketplaceExperienceDraft,
} from './marketplace/HqMarketplaceExperienceForm';
import { HqMarketplaceVitrinesTable } from './marketplace/HqMarketplaceVitrinesTable';
import { HqMarketplaceSponsoredPanel } from './marketplace/HqMarketplaceSponsoredPanel';
import { HqMarketplaceExternalChannelsPanel } from './marketplace/HqMarketplaceExternalChannelsPanel';

type MarketplaceSubTab = 'experience' | 'sponsored' | 'channels';

export const HqMarketplaceTab: React.FC = () => {
  const { profile } = useAuth();
  const {
    stores,
    governance,
    updateGovernanceSettings: updateGovernance,
    toggleFeatureFlag,
  } = useEcosystem();
  const isDevOwner = profile?.role === 'DEV_OWNER';
  const [subTab, setSubTab] = useState<MarketplaceSubTab>('experience');

  const currentMkt = useMemo(
    () => ({
      ...DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG,
      ...(governance.marketplaceConfig || {}),
      spotlightPricing: {
        ...DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.spotlightPricing,
        ...(governance.marketplaceConfig?.spotlightPricing || {}),
      },
      sponsoredPlacements: Array.isArray(governance.marketplaceConfig?.sponsoredPlacements)
        ? governance.marketplaceConfig!.sponsoredPlacements
        : DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.sponsoredPlacements,
      externalChannelConnectors: Array.isArray(
        governance.marketplaceConfig?.externalChannelConnectors
      )
        ? governance.marketplaceConfig!.externalChannelConnectors
        : DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.externalChannelConnectors,
    }),
    [governance.marketplaceConfig]
  );

  const [draft, setDraft] = useState<MarketplaceExperienceDraft>(() => ({
    marketplaceName: currentMkt.marketplaceName,
    heroHeadline: currentMkt.heroHeadline,
    heroSubtitle: currentMkt.heroSubtitle,
    recommendationsTitle: currentMkt.recommendationsTitle || 'Recomendados para você',
    globalAnnouncementBanner: governance.globalAnnouncementBanner || '',
    defaultPlatformDeliveryFee: Number(governance.defaultPlatformDeliveryFee ?? 6.9),
    globalCommissionRate: Number(governance.globalCommissionRate ?? 0),
    defaultDiscoveryRadiusKm: Number(currentMkt.defaultDiscoveryRadiusKm ?? 25),
    maxConcurrentOrdersPerStore: Number(governance.maxConcurrentOrdersPerStore ?? 150),
    allowGuestBrowsing: currentMkt.allowGuestBrowsing !== false,
    enabledVerticals: currentMkt.enabledVerticals,
    maintenanceMessage:
      governance.maintenanceMessage ||
      'Plataforma em manutenção programada. Voltamos em instantes.',
  }));

  const [saving, setSaving] = useState(false);
  const [togglingFlag, setTogglingFlag] = useState<string | null>(null);
  const [busyStoreId, setBusyStoreId] = useState<string | null>(null);

  useEffect(() => {
    setDraft({
      marketplaceName: currentMkt.marketplaceName,
      heroHeadline: currentMkt.heroHeadline,
      heroSubtitle: currentMkt.heroSubtitle,
      recommendationsTitle: currentMkt.recommendationsTitle || 'Recomendados para você',
      globalAnnouncementBanner: governance.globalAnnouncementBanner || '',
      defaultPlatformDeliveryFee: Number(governance.defaultPlatformDeliveryFee ?? 6.9),
      globalCommissionRate: Number(governance.globalCommissionRate ?? 0),
      defaultDiscoveryRadiusKm: Number(currentMkt.defaultDiscoveryRadiusKm ?? 25),
      maxConcurrentOrdersPerStore: Number(governance.maxConcurrentOrdersPerStore ?? 150),
      allowGuestBrowsing: currentMkt.allowGuestBrowsing !== false,
      enabledVerticals: currentMkt.enabledVerticals,
      maintenanceMessage:
        governance.maintenanceMessage ||
        'Plataforma em manutenção programada. Voltamos em instantes.',
    });
  }, [currentMkt, governance]);

  const activeStores = useMemo(
    () =>
      stores.filter(
        (s) =>
          !s._deleted &&
          s.tenantStatus !== 'SUSPENDED' &&
          String((s as any).status || 'ACTIVE').toUpperCase() !== 'SUSPENDED'
      ),
    [stores]
  );

  const hiddenSet = useMemo(() => new Set(currentMkt.hiddenStoreIds), [currentMkt.hiddenStoreIds]);
  const visibleVitrinesCount = activeStores.filter((s) => !hiddenSet.has(s.id)).length;
  const activePlacements = currentMkt.sponsoredPlacements.filter((p) => p.active);
  const sponsoredMediaMrr = activePlacements.reduce(
    (sum, p) => sum + (Number(p.monthlyFee) || 0),
    0
  );
  const enabledConnectorsCount = currentMkt.externalChannelConnectors.filter(
    (c) => c.enabled
  ).length;

  const handleToggleVertical = (verticalId: string) => {
    if (!isDevOwner) return;
    setDraft((prev) => {
      const exists = prev.enabledVerticals.includes(verticalId);
      if (exists && prev.enabledVerticals.length <= 1) return prev;
      return {
        ...prev,
        enabledVerticals: exists
          ? prev.enabledVerticals.filter((v) => v !== verticalId)
          : [...prev.enabledVerticals, verticalId],
      };
    });
  };

  const handleToggleFlag = async (
    flag:
      | 'marketplaceMaintenanceReadOnly'
      | 'autoDispatchEnabled'
      | 'dynamicSurgePricingEnabled'
      | 'aiEngineEnabled'
  ) => {
    if (!isDevOwner || togglingFlag) return;
    setTogglingFlag(flag);
    try {
      await toggleFeatureFlag(flag);
    } finally {
      setTogglingFlag(null);
    }
  };

  const handleSaveExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDevOwner || saving) return;
    setSaving(true);
    try {
      await updateGovernance({
        globalAnnouncementBanner: draft.globalAnnouncementBanner.trim(),
        defaultPlatformDeliveryFee: Number(draft.defaultPlatformDeliveryFee) || 0,
        globalCommissionRate: Number(draft.globalCommissionRate) || 0,
        maxConcurrentOrdersPerStore: Math.max(
          1,
          Math.floor(Number(draft.maxConcurrentOrdersPerStore) || 150)
        ),
        maintenanceMessage: draft.maintenanceMessage.trim(),
        marketplaceConfig: {
          ...currentMkt,
          marketplaceName: draft.marketplaceName.trim() || '3C Marketplace',
          heroHeadline: draft.heroHeadline.trim(),
          heroSubtitle: draft.heroSubtitle.trim(),
          recommendationsTitle: draft.recommendationsTitle.trim() || 'Recomendados para você',
          defaultDiscoveryRadiusKm: Math.min(
            100,
            Math.max(1, Math.round(Number(draft.defaultDiscoveryRadiusKm) || 25))
          ),
          allowGuestBrowsing: draft.allowGuestBrowsing,
          enabledVerticals: draft.enabledVerticals,
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePricing = async (nextPricing: MarketplaceSpotlightPricing) => {
    if (!isDevOwner || saving) return;
    setSaving(true);
    try {
      await updateGovernance({
        marketplaceConfig: {
          ...currentMkt,
          spotlightPricing: nextPricing,
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddPlacement = async (placement: Omit<MarketplaceSponsoredPlacement, 'id'>) => {
    if (!isDevOwner || saving) return;
    setSaving(true);
    try {
      const created: MarketplaceSponsoredPlacement = {
        ...placement,
        id: `mkt-ad-${Date.now()}`,
      };
      await updateGovernance({
        marketplaceConfig: {
          ...currentMkt,
          sponsoredPlacements: [created, ...currentMkt.sponsoredPlacements],
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePlacement = async (id: string) => {
    if (!isDevOwner || saving) return;
    setSaving(true);
    try {
      await updateGovernance({
        marketplaceConfig: {
          ...currentMkt,
          sponsoredPlacements: currentMkt.sponsoredPlacements.map((p) => {
            if (p.id !== id) return p;
            const nextActive = !p.active;
            return { ...p, active: nextActive, status: nextActive ? 'ACTIVE' : 'PAUSED' };
          }),
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePlacement = async (id: string) => {
    if (!isDevOwner || saving) return;
    setSaving(true);
    try {
      await updateGovernance({
        marketplaceConfig: {
          ...currentMkt,
          sponsoredPlacements: currentMkt.sponsoredPlacements.filter((p) => p.id !== id),
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConnectors = async (next: ExternalDeliveryChannelConfig[]) => {
    if (!isDevOwner || saving) return;
    setSaving(true);
    try {
      await updateGovernance({
        marketplaceConfig: {
          ...currentMkt,
          externalChannelConnectors: next,
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFeatured = async (storeId: string) => {
    if (!isDevOwner || busyStoreId) return;
    setBusyStoreId(storeId);
    try {
      const exists = currentMkt.featuredStoreIds.includes(storeId);
      const nextFeatured = exists
        ? currentMkt.featuredStoreIds.filter((id) => id !== storeId)
        : [...currentMkt.featuredStoreIds, storeId];
      await updateGovernance({
        marketplaceConfig: {
          ...currentMkt,
          featuredStoreIds: nextFeatured,
        },
      });
    } finally {
      setBusyStoreId(null);
    }
  };

  const handleToggleHidden = async (storeId: string) => {
    if (!isDevOwner || busyStoreId) return;
    setBusyStoreId(storeId);
    try {
      const exists = currentMkt.hiddenStoreIds.includes(storeId);
      const nextHidden = exists
        ? currentMkt.hiddenStoreIds.filter((id) => id !== storeId)
        : [...currentMkt.hiddenStoreIds, storeId];
      const nextFeatured = exists
        ? currentMkt.featuredStoreIds
        : currentMkt.featuredStoreIds.filter((id) => id !== storeId);
      await updateGovernance({
        marketplaceConfig: {
          ...currentMkt,
          hiddenStoreIds: nextHidden,
          featuredStoreIds: nextFeatured,
        },
      });
    } finally {
      setBusyStoreId(null);
    }
  };

  const isReadOnly = Boolean(governance.featureFlags?.marketplaceMaintenanceReadOnly);

  return (
    <div className="space-y-6">
      <HqMarketplaceKpiStrip
        totalActiveStores={activeStores.length}
        visibleVitrinesCount={visibleVitrinesCount}
        featuredCount={currentMkt.featuredStoreIds.length}
        hiddenCount={currentMkt.hiddenStoreIds.length}
        sponsoredCount={activePlacements.length}
        sponsoredMediaMrr={sponsoredMediaMrr}
        enabledConnectorsCount={enabledConnectorsCount}
        isReadOnly={isReadOnly}
        governance={governance}
      />

      {/* Sub-navegação limpa da Gestão do Marketplace */}
      <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 w-fit">
        {(
          [
            { id: 'experience', label: 'Experiência & Economia' },
            {
              id: 'sponsored',
              label: `Banners & Destaques Pagos (${activePlacements.length})`,
            },
            {
              id: 'channels',
              label: `Canais Externos & Curadoria (${enabledConnectorsCount})`,
            },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSubTab(item.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              subTab === item.id
                ? 'bg-indigo-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {subTab === 'experience' && (
        <HqMarketplaceExperienceForm
          draft={draft}
          isDevOwner={isDevOwner}
          saving={saving}
          isReadOnly={isReadOnly}
          autoDispatchEnabled={Boolean(governance.featureFlags?.autoDispatchEnabled)}
          dynamicSurgeEnabled={Boolean(governance.featureFlags?.dynamicSurgePricingEnabled)}
          aiEngineEnabled={Boolean(governance.featureFlags?.aiEngineEnabled)}
          togglingFlag={togglingFlag}
          onChangeDraft={setDraft}
          onToggleVertical={handleToggleVertical}
          onToggleFlag={(flag) => void handleToggleFlag(flag)}
          onSubmit={(e) => void handleSaveExperience(e)}
        />
      )}

      {subTab === 'sponsored' && (
        <HqMarketplaceSponsoredPanel
          stores={stores}
          placements={currentMkt.sponsoredPlacements}
          pricing={currentMkt.spotlightPricing}
          isDevOwner={isDevOwner}
          busy={saving}
          onSavePricing={handleSavePricing}
          onAddPlacement={handleAddPlacement}
          onTogglePlacement={handleTogglePlacement}
          onRemovePlacement={handleRemovePlacement}
        />
      )}

      {subTab === 'channels' && (
        <div className="space-y-6">
          <HqMarketplaceExternalChannelsPanel
            connectors={currentMkt.externalChannelConnectors}
            isDevOwner={isDevOwner}
            saving={saving}
            onSaveConnectors={handleSaveConnectors}
          />

          <HqMarketplaceVitrinesTable
            stores={stores}
            featuredStoreIds={currentMkt.featuredStoreIds}
            hiddenStoreIds={currentMkt.hiddenStoreIds}
            isDevOwner={isDevOwner}
            busyStoreId={busyStoreId}
            onToggleFeatured={(id) => void handleToggleFeatured(id)}
            onToggleHidden={(id) => void handleToggleHidden(id)}
          />
        </div>
      )}
    </div>
  );
};
