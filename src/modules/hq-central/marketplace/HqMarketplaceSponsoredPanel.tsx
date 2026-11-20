import React, { useMemo, useState } from 'react';
import { Megaphone, Pause, Play, Plus, Trash2 } from 'lucide-react';
import {
  MarketplacePlacementType,
  MarketplaceSponsoredPlacement,
  MarketplaceSpotlightPricing,
  Store,
} from '../../../types';

interface HqMarketplaceSponsoredPanelProps {
  stores: Store[];
  placements: MarketplaceSponsoredPlacement[];
  pricing: MarketplaceSpotlightPricing;
  isDevOwner: boolean;
  busy: boolean;
  onSavePricing: (nextPricing: MarketplaceSpotlightPricing) => Promise<void>;
  onAddPlacement: (placement: Omit<MarketplaceSponsoredPlacement, 'id'>) => Promise<void>;
  onTogglePlacement: (id: string) => Promise<void>;
  onRemovePlacement: (id: string) => Promise<void>;
}

const PLACEMENT_LABELS: Record<MarketplacePlacementType, string> = {
  HERO_BANNER: 'Banner Principal (Topo)',
  RECOMMENDED_CAROUSEL: 'Carrossel Recomendados',
  CATEGORY_TOP: 'Topo de Categoria',
};

export const HqMarketplaceSponsoredPanel: React.FC<HqMarketplaceSponsoredPanelProps> = ({
  stores,
  placements,
  pricing,
  isDevOwner,
  busy,
  onSavePricing,
  onAddPlacement,
  onTogglePlacement,
  onRemovePlacement,
}) => {
  const activeTenants = useMemo(
    () =>
      stores.filter(
        (s) =>
          !s._deleted &&
          s.tenantStatus !== 'SUSPENDED' &&
          String((s as any).status || 'ACTIVE').toUpperCase() !== 'SUSPENDED'
      ),
    [stores]
  );

  const [pricingDraft, setPricingDraft] = useState<MarketplaceSpotlightPricing>(pricing);
  const [storeId, setStoreId] = useState<string>(activeTenants[0]?.id || '');
  const [placementType, setPlacementType] = useState<MarketplacePlacementType>('HERO_BANNER');
  const [badgeText, setBadgeText] = useState('Patrocinado');
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerSubtitle, setBannerSubtitle] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Ver vitrine');
  const [monthlyFee, setMonthlyFee] = useState<number>(pricing.heroBannerMonthlyFee);

  const storeMap = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);

  const handlePlacementTypeChange = (nextType: MarketplacePlacementType) => {
    setPlacementType(nextType);
    if (nextType === 'HERO_BANNER') setMonthlyFee(pricingDraft.heroBannerMonthlyFee);
    else if (nextType === 'RECOMMENDED_CAROUSEL')
      setMonthlyFee(pricingDraft.recommendedSlotMonthlyFee);
    else setMonthlyFee(pricingDraft.categoryTopMonthlyFee);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedStoreId = storeId || activeTenants[0]?.id;
    if (!isDevOwner || !resolvedStoreId || busy) return;
    await onAddPlacement({
      storeId: resolvedStoreId,
      placementType,
      badgeText: badgeText.trim() || 'Patrocinado',
      bannerTitle: bannerTitle.trim(),
      bannerSubtitle: bannerSubtitle.trim(),
      ctaLabel: ctaLabel.trim() || 'Ver vitrine',
      monthlyFee: Math.max(0, Number(monthlyFee) || 0),
      active: true,
    });
    setBannerTitle('');
    setBannerSubtitle('');
  };

  const activeMediaMrr = placements
    .filter((p) => p.active)
    .reduce((sum, p) => sum + (Number(p.monthlyFee) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Tabela de preços oficiais de destaque do HQ */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-semibold text-white">
              Tabela Oficial de Mídia &amp; Destaques Pagos (Ads do Marketplace)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              O lojista paga pela visibilidade na audiência do Marketplace (modelo iFood / Uber Eats / Deliveroo). Receita 100% da plataforma.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-400">Receita Recorrente de Destaques</div>
            <div className="text-lg font-bold text-emerald-400 font-mono tabular-nums">
              R$ {activeMediaMrr.toFixed(2)}/mês
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Banner Principal (R$/mês)</label>
            <input
              type="number"
              min={0}
              step="1"
              disabled={!isDevOwner}
              value={pricingDraft.heroBannerMonthlyFee}
              onChange={(e) =>
                setPricingDraft((prev) => ({
                  ...prev,
                  heroBannerMonthlyFee: Number(e.target.value),
                }))
              }
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm font-mono tabular-nums text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Slot Recomendados (R$/mês)</label>
            <input
              type="number"
              min={0}
              step="1"
              disabled={!isDevOwner}
              value={pricingDraft.recommendedSlotMonthlyFee}
              onChange={(e) =>
                setPricingDraft((prev) => ({
                  ...prev,
                  recommendedSlotMonthlyFee: Number(e.target.value),
                }))
              }
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm font-mono tabular-nums text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Topo Categoria (R$/mês)</label>
            <input
              type="number"
              min={0}
              step="1"
              disabled={!isDevOwner}
              value={pricingDraft.categoryTopMonthlyFee}
              onChange={(e) =>
                setPricingDraft((prev) => ({
                  ...prev,
                  categoryTopMonthlyFee: Number(e.target.value),
                }))
              }
              className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm font-mono tabular-nums text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
            />
          </div>

          <button
            type="button"
            disabled={!isDevOwner || busy}
            onClick={() => void onSavePricing(pricingDraft)}
            className="h-10 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            Atualizar Tabela
          </button>
        </div>
      </section>

      {/* Nova campanha de destaque patrocinado */}
      {isDevOwner && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Megaphone className="w-4 h-4 text-indigo-400" />
            Ativar Campanha de Destaque Pago para Lojista
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Estabelecimento Parceiro</label>
              <select
                value={storeId || activeTenants[0]?.id || ''}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {activeTenants.length === 0 ? (
                  <option value="">Nenhuma loja ativa</option>
                ) : (
                  activeTenants.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Posição no Marketplace</label>
              <select
                value={placementType}
                onChange={(e) =>
                  handlePlacementTypeChange(e.target.value as MarketplacePlacementType)
                }
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="HERO_BANNER">Banner Principal (Topo)</option>
                <option value="RECOMMENDED_CAROUSEL">Carrossel de Recomendações</option>
                <option value="CATEGORY_TOP">Topo de Categoria</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Valor Contratado (R$/mês)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(Number(e.target.value))}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-mono tabular-nums text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Título do Banner / Chamada (Opcional)
              </label>
              <input
                type="text"
                maxLength={120}
                value={bannerTitle}
                onChange={(e) => setBannerTitle(e.target.value)}
                placeholder="Ex.: Noite Italiana · 20% OFF no primeiro pedido"
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Subtítulo / Oferta</label>
              <input
                type="text"
                maxLength={220}
                value={bannerSubtitle}
                onChange={(e) => setBannerSubtitle(e.target.value)}
                placeholder="Ex.: Entrega rápida e cardápio exclusivo hoje"
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Selo</label>
                <input
                  type="text"
                  maxLength={28}
                  value={badgeText}
                  onChange={(e) => setBadgeText(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Texto CTA</label>
                <input
                  type="text"
                  maxLength={32}
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy || activeTenants.length === 0}
              className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Publicar Campanha de Destaque
            </button>
          </div>
        </form>
      )}

      {/* Lista de campanhas ativas e pausadas */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">
            Campanhas de Destaque Contratadas ({placements.length})
          </span>
          <span className="text-xs text-slate-500 font-mono">
            Exibidas no topo e carrossel do Marketplace
          </span>
        </div>

        {placements.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Nenhuma campanha patrocinada cadastrada. Publique um banner ou slot de recomendação acima para monetizar a audiência do Marketplace.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-[11px] font-medium text-slate-400">
                  <th className="py-2.5 px-4">Lojista</th>
                  <th className="py-2.5 px-4">Posição</th>
                  <th className="py-2.5 px-4">Chamada</th>
                  <th className="py-2.5 px-4 text-right">Valor / Mês</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {placements.map((item) => {
                  const st = storeMap.get(item.storeId);
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">
                          {st?.name || item.storeId}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Selo: {item.badgeText}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {PLACEMENT_LABELS[item.placementType] || item.placementType}
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                        {item.bannerTitle || st?.name || 'Destaque direto da vitrine'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-400 font-semibold">
                        R$ {Number(item.monthlyFee || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-medium ${
                            item.active
                              ? 'text-emerald-400'
                              : item.status === 'PENDING_APPROVAL'
                              ? 'text-amber-300'
                              : 'text-slate-500'
                          }`}
                        >
                          {item.active
                            ? 'Ativa no Marketplace'
                            : item.status === 'PENDING_APPROVAL'
                            ? 'Solicitada pelo Lojista'
                            : 'Pausada'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {!item.active && item.status === 'PENDING_APPROVAL' ? (
                            <button
                              type="button"
                              disabled={!isDevOwner || busy}
                              onClick={() => void onTogglePlacement(item.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold cursor-pointer disabled:opacity-40 whitespace-nowrap"
                            >
                              Aprovar &amp; Publicar
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!isDevOwner || busy}
                              onClick={() => void onTogglePlacement(item.id)}
                              className="p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 hover:text-white cursor-pointer disabled:opacity-40"
                              title={item.active ? 'Pausar campanha' : 'Reativar campanha'}
                            >
                              {item.active ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!isDevOwner || busy}
                            onClick={() => void onRemovePlacement(item.id)}
                            className="p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-rose-400 hover:bg-rose-500/15 cursor-pointer disabled:opacity-40"
                            title="Remover campanha"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
