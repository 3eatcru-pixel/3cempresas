import React, { useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Clock, Star } from 'lucide-react';
import { MarketplaceGovernanceConfig, Store } from '../../../types';

interface MarketplaceSpotlightSectionProps {
  stores: Store[];
  marketplaceConfig?: MarketplaceGovernanceConfig;
  onOpenStoreShowcase: (slug: string) => void;
}

export const MarketplaceSpotlightSection: React.FC<MarketplaceSpotlightSectionProps> = ({
  stores,
  marketplaceConfig,
  onOpenStoreShowcase,
}) => {
  const [bannerIndex, setBannerIndex] = useState(0);

  const visibleStoresById = useMemo(() => {
    const hiddenSet = new Set(marketplaceConfig?.hiddenStoreIds || []);
    const map = new Map<string, Store>();
    for (const s of stores) {
      if (!s._deleted && !hiddenSet.has(s.id)) {
        map.set(s.id, s);
      }
    }
    return map;
  }, [stores, marketplaceConfig?.hiddenStoreIds]);

  const activePlacements = useMemo(
    () => (marketplaceConfig?.sponsoredPlacements || []).filter((p) => p.active),
    [marketplaceConfig?.sponsoredPlacements]
  );

  const heroBanners = useMemo(() => {
    return activePlacements
      .filter((p) => p.placementType === 'HERO_BANNER' && visibleStoresById.has(p.storeId))
      .map((placement) => ({
        placement,
        store: visibleStoresById.get(placement.storeId)!,
      }));
  }, [activePlacements, visibleStoresById]);

  const recommendedItems = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ store: Store; tag?: string; sponsored: boolean }> = [];

    // 1. Lojas patrocinadas em carrossel de recomendações / topo de categoria
    for (const p of activePlacements) {
      if (p.placementType === 'HERO_BANNER') continue;
      const st = visibleStoresById.get(p.storeId);
      if (st && !seen.has(st.id)) {
        seen.add(st.id);
        items.push({ store: st, tag: p.badgeText || 'Patrocinado', sponsored: true });
      }
    }

    // 2. Lojas em curadoria editorial
    for (const id of marketplaceConfig?.featuredStoreIds || []) {
      const st = visibleStoresById.get(id);
      if (st && !seen.has(st.id)) {
        seen.add(st.id);
        items.push({ store: st, tag: 'Destaque', sponsored: false });
      }
    }

    // 3. Melhor avaliadas para completar recomendações (estilo iFood / Uber Eats)
    const topRated = Array.from(visibleStoresById.values())
      .filter((s) => !seen.has(s.id))
      .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
      .slice(0, Math.max(0, 6 - items.length));

    for (const st of topRated) {
      seen.add(st.id);
      items.push({ store: st, sponsored: false });
    }

    return items.slice(0, 6);
  }, [activePlacements, marketplaceConfig?.featuredStoreIds, visibleStoresById]);

  const currentBanner =
    heroBanners.length > 0 ? heroBanners[bannerIndex % heroBanners.length] : null;
  const editorialHeadline = marketplaceConfig?.heroHeadline || '';
  const editorialSubtitle = marketplaceConfig?.heroSubtitle || '';
  const recommendationsTitle =
    marketplaceConfig?.recommendationsTitle || 'Recomendados para você';

  if (!currentBanner && !editorialHeadline && recommendedItems.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5">
      {/* Banner principal patrocinado ou editorial */}
      {currentBanner ? (
        <section className="relative rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
          {currentBanner.store.banner && (
            <img
              src={currentBanner.store.banner}
              alt={currentBanner.store.name}
              className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none"
            />
          )}
          <div className="relative px-6 py-6 sm:px-8 sm:py-7 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-[11px] font-medium text-amber-300">
                <span>{currentBanner.placement.badgeText || 'Patrocinado'}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-300">{currentBanner.store.name}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {currentBanner.placement.bannerTitle || currentBanner.store.name}
              </h2>
              {(currentBanner.placement.bannerSubtitle || currentBanner.store.address) && (
                <p className="text-sm text-slate-300 leading-relaxed">
                  {currentBanner.placement.bannerSubtitle || currentBanner.store.address}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {heroBanners.length > 1 && (
                <div className="flex items-center gap-1 mr-1">
                  <button
                    type="button"
                    aria-label="Banner anterior"
                    onClick={() =>
                      setBannerIndex((prev) => (prev - 1 + heroBanners.length) % heroBanners.length)
                    }
                    className="p-2 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Próximo banner"
                    onClick={() => setBannerIndex((prev) => (prev + 1) % heroBanners.length)}
                    className="p-2 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => onOpenStoreShowcase(currentBanner.store.slug)}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {currentBanner.placement.ctaLabel || 'Ver vitrine'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      ) : editorialHeadline ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 px-6 py-5 space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white max-w-2xl">
            {editorialHeadline}
          </h1>
          {editorialSubtitle && (
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">{editorialSubtitle}</p>
          )}
        </section>
      ) : null}

      {/* Faixa de Recomendações (carrossel horizontal estilo delivery/hospitalidade) */}
      {recommendedItems.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white tracking-tight">{recommendationsTitle}</h2>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {recommendedItems.length} opções
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recommendedItems.map(({ store, tag, sponsored }) => (
              <button
                key={store.id}
                type="button"
                onClick={() => onOpenStoreShowcase(store.slug)}
                className="text-left rounded-xl border border-slate-800 bg-slate-900/90 hover:border-slate-700 p-3.5 flex items-center gap-3.5 transition-colors cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center text-sm font-bold text-slate-400">
                  {store.logo ? (
                    <img
                      src={store.logo}
                      alt={store.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    store.name.slice(0, 2).toUpperCase()
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white truncate group-hover:text-amber-300 transition-colors">
                      {store.name}
                    </span>
                    {tag && (
                      <span
                        className={`text-[10px] font-medium shrink-0 ${
                          sponsored ? 'text-amber-400' : 'text-indigo-300'
                        }`}
                      >
                        {tag}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
                    <span className="inline-flex items-center gap-0.5 text-amber-400">
                      <Star className="w-3 h-3 fill-amber-400" />
                      {Number(store.rating || 5).toFixed(1)}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {store.deliveryTimeMin || 30} min
                    </span>
                    <span className="text-slate-600">·</span>
                    <span>
                      {Number(store.deliveryFee || 0) === 0
                        ? 'Entrega grátis'
                        : `R$ ${Number(store.deliveryFee).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
