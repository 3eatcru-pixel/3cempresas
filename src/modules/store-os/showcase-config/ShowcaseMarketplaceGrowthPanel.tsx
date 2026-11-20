import React, { useCallback, useEffect, useState } from 'react';
import { Check, Megaphone, RefreshCw, Sparkles } from 'lucide-react';
import {
  ExternalDeliveryChannelConfig,
  MarketplacePlacementType,
  MarketplaceSponsoredPlacement,
  MarketplaceSpotlightPricing,
  Store,
} from '../../../types';
import {
  buildStandardContractHeaders,
  getPlatformAdapters,
} from '../../../core/platform/PlatformAdapter';
import {
  SPOTLIGHT_PLACEMENT_OPTIONS,
  StoreExternalChannelEntry,
} from './growthPanelTypes';
import { StoreExternalChannelsCard } from './StoreExternalChannelsCard';

interface ShowcaseMarketplaceGrowthPanelProps {
  currentStore: Store;
  canWrite: boolean;
  onShowNotification: (msg: string) => void;
}

export const ShowcaseMarketplaceGrowthPanel: React.FC<ShowcaseMarketplaceGrowthPanelProps> = ({
  currentStore,
  canWrite,
  onShowNotification,
}) => {
  const apiBase = getPlatformAdapters().network.getApiBaseUrl();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingChannels, setSavingChannels] = useState(false);

  const [pricing, setPricing] = useState<MarketplaceSpotlightPricing>({
    heroBannerMonthlyFee: 299,
    recommendedSlotMonthlyFee: 149,
    categoryTopMonthlyFee: 99,
  });
  const [placements, setPlacements] = useState<MarketplaceSponsoredPlacement[]>([]);
  const [availableConnectors, setAvailableConnectors] = useState<ExternalDeliveryChannelConfig[]>(
    []
  );
  const [channelsDraft, setChannelsDraft] = useState<Record<string, StoreExternalChannelEntry>>({});

  const [selectedType, setSelectedType] = useState<MarketplacePlacementType>('HERO_BANNER');
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerSubtitle, setBannerSubtitle] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Ver vitrine');

  const loadGrowthData = useCallback(async () => {
    if (!currentStore?.id) return;
    setLoading(true);
    try {
      const headers = await buildStandardContractHeaders({ includeIdempotencyKey: false });
      const res = await fetch(
        `${apiBase}/store/marketplace-growth?storeId=${encodeURIComponent(currentStore.id)}`,
        { headers }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.spotlightPricing) setPricing(data.spotlightPricing);
      if (Array.isArray(data.placements)) setPlacements(data.placements);
      if (Array.isArray(data.availableConnectors)) setAvailableConnectors(data.availableConnectors);
      if (data.storeExternalChannels && typeof data.storeExternalChannels === 'object') {
        setChannelsDraft(data.storeExternalChannels);
      }
    } catch {
      // silent offline fallback
    } finally {
      setLoading(false);
    }
  }, [apiBase, currentStore?.id]);

  useEffect(() => {
    void loadGrowthData();
  }, [loadGrowthData]);

  const handleRequestSpotlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || submitting) return;
    setSubmitting(true);
    try {
      const headers = await buildStandardContractHeaders({ includeIdempotencyKey: true });
      const res = await fetch(`${apiBase}/store/marketplace-growth/spotlight-request`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          storeId: currentStore.id,
          placementType: selectedType,
          bannerTitle: bannerTitle.trim() || currentStore.name,
          bannerSubtitle: bannerSubtitle.trim(),
          ctaLabel: ctaLabel.trim() || 'Ver vitrine',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onShowNotification(data.error || 'Não foi possível enviar a solicitação de destaque.');
        return;
      }
      onShowNotification(
        'Solicitação de destaque registrada! Assim que aprovada, sua campanha entra no ar no Marketplace.'
      );
      setBannerTitle('');
      setBannerSubtitle('');
      await loadGrowthData();
    } catch {
      onShowNotification('Falha de rede ao enviar solicitação de destaque.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveExternalChannels = async () => {
    if (!canWrite || savingChannels) return;
    setSavingChannels(true);
    try {
      const headers = await buildStandardContractHeaders({ includeIdempotencyKey: true });
      const res = await fetch(`${apiBase}/store/marketplace-growth/external-channels`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          storeId: currentStore.id,
          externalChannels: channelsDraft,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onShowNotification(data.error || 'Erro ao salvar canais externos.');
        return;
      }
      onShowNotification('Configurações de canais externos salvas com sucesso!');
      await loadGrowthData();
    } catch {
      onShowNotification('Falha de rede ao salvar canais externos.');
    } finally {
      setSavingChannels(false);
    }
  };

  const updateChannel = (provider: string, patch: Partial<StoreExternalChannelEntry>) => {
    setChannelsDraft((prev) => ({
      ...prev,
      [provider]: {
        enabled: prev[provider]?.enabled ?? false,
        merchantExternalId: prev[provider]?.merchantExternalId ?? '',
        autoAcceptOrders: prev[provider]?.autoAcceptOrders ?? false,
        ...patch,
      },
    }));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-5">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-start gap-2.5">
            <Megaphone className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-white">
                Impulsionar Vitrine no Marketplace
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Aumente seus pedidos com posicionamento patrocinado no topo e nas recomendações do Marketplace. Suas vendas no PDV presencial e mesas continuam com 0% de comissão.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadGrowthData()}
            className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
            title="Atualizar campanhas e canais"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SPOTLIGHT_PLACEMENT_OPTIONS.map((opt) => {
            const active = selectedType === opt.type;
            const fee = Number(pricing[opt.priceKey] || 0);
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => setSelectedType(opt.type)}
                className={`text-left p-4 rounded-xl border transition-colors cursor-pointer space-y-2 ${
                  active
                    ? 'bg-amber-500/10 border-amber-500/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white">{opt.title}</span>
                  {active && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{opt.description}</p>
                <div className="text-sm font-bold text-emerald-400 font-mono tabular-nums pt-1">
                  R$ {fee.toFixed(2)}/mês
                </div>
              </button>
            );
          })}
        </div>

        {canWrite && (
          <form
            onSubmit={(e) => void handleRequestSpotlight(e)}
            className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Título da Campanha / Chamada
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={bannerTitle}
                  onChange={(e) => setBannerTitle(e.target.value)}
                  placeholder={`Ex.: ${currentStore.name} · Oferta Especial`}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Subtítulo / Benefício</label>
                <input
                  type="text"
                  maxLength={220}
                  value={bannerSubtitle}
                  onChange={(e) => setBannerSubtitle(e.target.value)}
                  placeholder="Ex.: Entrega rápida e combos exclusivos hoje"
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Botão CTA</label>
                <input
                  type="text"
                  maxLength={32}
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {submitting ? 'Enviando solicitação...' : 'Solicitar Destaque no Marketplace'}
              </button>
            </div>
          </form>
        )}

        {placements.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300">
              Suas Campanhas de Destaque ({placements.length})
            </div>
            <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950">
              {placements.map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-semibold text-white">
                      {item.bannerTitle || currentStore.name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {item.placementType} · R$ {Number(item.monthlyFee || 0).toFixed(2)}/mês
                    </div>
                  </div>
                  <span
                    className={`font-medium ${
                      item.active
                        ? 'text-emerald-400'
                        : item.status === 'PENDING_APPROVAL'
                        ? 'text-amber-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {item.active
                      ? 'Ativa no Marketplace'
                      : item.status === 'PENDING_APPROVAL'
                      ? 'Aguardando ativação'
                      : 'Pausada'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <StoreExternalChannelsCard
        availableConnectors={availableConnectors}
        channelsDraft={channelsDraft}
        canWrite={canWrite}
        savingChannels={savingChannels}
        onUpdateChannel={updateChannel}
        onSaveExternalChannels={() => void handleSaveExternalChannels()}
      />
    </div>
  );
};
