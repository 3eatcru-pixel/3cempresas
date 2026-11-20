import React from 'react';
import {
  Filter,
  Bike,
  ShoppingBag,
  UtensilsCrossed,
  Clock,
  LayoutGrid,
  Layers,
  BookOpen,
  Map as MapIcon,
  Heart,
  Tag,
  ArrowUpDown,
} from 'lucide-react';
import { MarketplaceSortOption } from '../../hooks/useMarketplaceLogic';

interface MarketplaceFiltersToolbarProps {
  maxRadiusKm: number;
  setMaxRadiusKm: (val: number) => void;
  modalities: any;
  toggleModality: (key: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  marketplaceViewMode: string;
  setMarketplaceViewMode: (mode: any) => void;
  sortBy?: MarketplaceSortOption;
  setSortBy?: (val: MarketplaceSortOption) => void;
  freeDeliveryOnly?: boolean;
  setFreeDeliveryOnly?: (val: boolean) => void;
  favoritesOnly?: boolean;
  setFavoritesOnly?: (val: boolean) => void;
}

export const MarketplaceFiltersToolbar: React.FC<MarketplaceFiltersToolbarProps> = ({
  maxRadiusKm,
  setMaxRadiusKm,
  modalities,
  toggleModality,
  selectedCategory,
  setSelectedCategory,
  marketplaceViewMode,
  setMarketplaceViewMode,
  sortBy = 'RECOMMENDED',
  setSortBy,
  freeDeliveryOnly = false,
  setFreeDeliveryOnly,
  favoritesOnly = false,
  setFavoritesOnly,
}) => {
  return (
    <>
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto pb-2 md:pb-0">
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
            <div className="px-2 text-[9px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-800 mr-1">
              Raios
            </div>
            {[1, 3, 5, 10, 25].map((r) => (
              <button
                key={r}
                onClick={() => setMaxRadiusKm(r)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  maxRadiusKm === r ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {r}km
              </button>
            ))}
          </div>

          <div className="h-8 w-px bg-slate-800 mx-1 shrink-0" />

          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
            {[
              { id: 'delivery', icon: Bike, label: 'Entrega' },
              { id: 'pickup', icon: ShoppingBag, label: 'Retirada' },
              { id: 'tableReservation', icon: UtensilsCrossed, label: 'Mesas' },
              { id: 'openNow', icon: Clock, label: 'Abertos' },
            ].map((m) => {
              const Icon = m.icon;
              const isActive = (modalities as any)[m.id];
              return (
                <button
                  key={m.id}
                  onClick={() => toggleModality(m.id)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {setFreeDeliveryOnly && (
            <button
              type="button"
              onClick={() => setFreeDeliveryOnly(!freeDeliveryOnly)}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-xl border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                freeDeliveryOnly
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Tag className="w-3 h-3" />
              <span>Frete Grátis</span>
            </button>
          )}

          {setFavoritesOnly && (
            <button
              type="button"
              onClick={() => setFavoritesOnly(!favoritesOnly)}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-xl border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                favoritesOnly
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Heart className={`w-3 h-3 ${favoritesOnly ? 'fill-rose-400' : ''}`} />
              <span>Favoritos</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
          {setSortBy && (
            <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-800">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as MarketplaceSortOption)}
                className="bg-transparent text-[10px] font-bold text-slate-200 focus:outline-none uppercase tracking-wider cursor-pointer"
              >
                <option value="RECOMMENDED" className="bg-slate-900 text-white">
                  Ordenar: Relevância
                </option>
                <option value="RATING" className="bg-slate-900 text-white">
                  Melhor Avaliação
                </option>
                <option value="DELIVERY_TIME" className="bg-slate-900 text-white">
                  Menor Tempo
                </option>
                <option value="DELIVERY_FEE" className="bg-slate-900 text-white">
                  Menor Frete
                </option>
                <option value="DISTANCE" className="bg-slate-900 text-white">
                  Mais Próximos
                </option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'grid', icon: LayoutGrid, title: 'Grade' },
              { id: 'fichario', icon: Layers, title: 'Fichário' },
              { id: 'livro-razao', icon: BookOpen, title: 'Livro' },
              { id: 'map', icon: MapIcon, title: 'Mapa' },
            ].map((v) => {
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  onClick={() => setMarketplaceViewMode(v.id as any)}
                  className={`p-2 rounded-lg transition-all cursor-pointer ${
                    marketplaceViewMode === v.id
                      ? 'bg-slate-800 text-amber-400 border border-slate-700'
                      : 'text-slate-500 hover:text-white'
                  }`}
                  title={v.title}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <Filter className="w-3.5 h-3.5 text-slate-600 shrink-0 mr-2" />
        {[
          { id: 'Todos', label: 'Todos' },
          { id: 'MULTI_COMMERCE', label: 'Multivendas 360°' },
          { id: 'RESTAURANT', label: 'Gastronomia' },
          { id: 'FURNITURE', label: 'Móveis' },
          { id: 'ELECTRONICS', label: 'Tech' },
          { id: 'FASHION', label: 'Moda' },
          { id: 'SERVICES', label: 'Serviços' },
          { id: 'RETAIL', label: 'Varejo' },
          { id: 'BEVERAGES', label: 'Bebidas' },
          { id: 'HEALTH', label: 'Saúde' },
          { id: 'BEAUTY', label: 'Beleza' },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all whitespace-nowrap border cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/10'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </>
  );
};
