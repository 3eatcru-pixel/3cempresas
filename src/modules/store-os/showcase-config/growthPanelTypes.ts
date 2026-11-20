import {
  MarketplacePlacementType,
  MarketplaceSpotlightPricing,
} from '../../../types';

export interface StoreExternalChannelEntry {
  enabled: boolean;
  merchantExternalId: string;
  autoAcceptOrders: boolean;
}

export const SPOTLIGHT_PLACEMENT_OPTIONS: Array<{
  type: MarketplacePlacementType;
  title: string;
  description: string;
  priceKey: keyof MarketplaceSpotlightPricing;
}> = [
  {
    type: 'HERO_BANNER',
    title: 'Banner Principal no Topo',
    description:
      'Destaque editorial de alta conversão na abertura do Marketplace com CTA direto para sua vitrine.',
    priceKey: 'heroBannerMonthlyFee',
  },
  {
    type: 'RECOMMENDED_CAROUSEL',
    title: 'Carrossel de Recomendações',
    description:
      'Posição prioritária na faixa "Recomendados para você" para consumidores na sua região.',
    priceKey: 'recommendedSlotMonthlyFee',
  },
  {
    type: 'CATEGORY_TOP',
    title: 'Topo da Categoria',
    description: 'Prioridade quando o consumidor filtra pelo seu segmento de atuação.',
    priceKey: 'categoryTopMonthlyFee',
  },
];
