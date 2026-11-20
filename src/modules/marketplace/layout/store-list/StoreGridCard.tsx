import React, { useState } from 'react';
import { Star, Clock, ShoppingBag, Heart, MapPin } from 'lucide-react';
import { Store } from '../../../../types';

interface StoreGridCardProps {
  store: Store;
  fee: number;
  dist: string | null;
  isFav: boolean;
  onOpenStore: (slug: string) => void;
  onOpenModal: (store: Store) => void;
  onToggleFavorite: (storeId: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  RESTAURANT: 'Gastronomia',
  PIZZA: 'Pizzaria',
  SUSHI: 'Sushi',
  BURGER: 'Hamburgueria',
  CAFE: 'Cafeteria',
  BAKERY: 'Padaria',
  RETAIL: 'Varejo',
  MARKET: 'Mercado',
  PHARMACY: 'Farmácia',
  SERVICES: 'Serviços',
  BEAUTY: 'Beleza',
  FURNITURE: 'Móveis',
  TECH: 'Tecnologia',
  FASHION: 'Moda',
  PETSHOP: 'Pet Shop',
};

export const StoreGridCard: React.FC<StoreGridCardProps> = ({
  store,
  fee,
  dist,
  isFav,
  onOpenStore,
  onOpenModal,
  onToggleFavorite,
}) => {
  const isService = ['SERVICES', 'BEAUTY'].includes(store.category);
  const [bannerFailed, setBannerFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const categoryLabel = CATEGORY_LABELS[String(store.category || '').toUpperCase()] || store.category;
  const initials = (store.name || '3C').slice(0, 2).toUpperCase();

  return (
    <div
      onClick={() => onOpenStore(store.slug)}
      className="bg-[#121316] border border-slate-800 rounded-[2.5rem] overflow-hidden group hover:border-amber-500/40 hover:shadow-[0_10px_50px_rgba(245,158,11,0.1)] transition-all cursor-pointer relative flex flex-col h-full"
    >
      <div className="relative h-48 bg-slate-900">
        {store.banner && !bannerFailed ? (
          <img
            src={store.banner}
            alt={store.name}
            referrerPolicy="no-referrer"
            onError={() => setBannerFailed(true)}
            className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out ${
              store.isOpen === false ? 'grayscale opacity-65' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#121316] via-[#121316]/20 to-transparent opacity-90" />

        <div className="absolute top-4 left-4">
          <div className="bg-slate-950/80 backdrop-blur-md p-2.5 rounded-[1.25rem] border border-white/10 shadow-2xl">
            {store.logo && !logoFailed ? (
              <img
                src={store.logo}
                alt={store.name}
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
                className="w-12 h-12 rounded-xl object-cover shadow-lg border border-slate-900"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-mono text-sm font-black text-amber-400">
                {initials}
              </div>
            )}
          </div>
        </div>

        <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(store.id);
              }}
              title={isFav ? 'Remover dos favoritos' : 'Favoritar loja'}
              className={`p-1.5 rounded-full backdrop-blur-md border transition-all cursor-pointer ${
                isFav
                  ? 'bg-rose-500/90 border-rose-400 text-white shadow-lg'
                  : 'bg-slate-950/70 border-white/15 text-slate-300 hover:text-white'
              }`}
            >
              <Heart size={12} className={isFav ? 'fill-white' : ''} />
            </button>
            <span className="bg-amber-500 text-slate-950 text-[10px] font-black font-mono tabular-nums px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-1.5">
              <Star size={12} className="fill-slate-950" /> {store.rating.toFixed(1)}
            </span>
          </div>
          {store.isOpen === false && (
            <span className="bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-lg">
              Fechada
            </span>
          )}
        </div>

        <div className="absolute bottom-4 left-6 right-6">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="inline-block px-2.5 py-0.5 rounded-lg text-[8px] font-black bg-white/10 backdrop-blur-md border border-white/20 text-white uppercase tracking-widest">
              {categoryLabel}
            </span>
            {dist && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-mono tabular-nums font-bold bg-slate-950/70 backdrop-blur-md border border-white/10 text-amber-300">
                <MapPin size={9} /> {dist}
              </span>
            )}
          </div>
          <h3 className="text-xl font-black text-white uppercase italic tracking-tighter truncate drop-shadow-xl">
            {store.name}
          </h3>
        </div>
      </div>

      <div className="p-6 pt-2 flex-1 flex flex-col justify-between space-y-5">
        <p className="text-[10px] font-bold text-slate-500 leading-relaxed line-clamp-2">
          {store.showcaseTemplate?.tagline || store.address}
        </p>

        <div className="flex items-center justify-between pt-4 border-t border-slate-800/60 mt-auto">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                {isService ? 'Atendimento' : 'Tempo'}
              </span>
              <span className="text-[11px] font-mono tabular-nums font-black text-slate-200 flex items-center gap-1.5 mt-0.5">
                <Clock size={12} className="text-slate-500" />{' '}
                {isService ? 'Agendado' : `${store.deliveryTimeMin}m`}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                {isService ? 'Modalidade' : 'Frete'}
              </span>
              <span className="text-[11px] font-mono tabular-nums font-black text-emerald-500 flex items-center gap-1 mt-0.5">
                {isService ? 'HORA MARCADA' : fee === 0 ? 'GRÁTIS' : `R$ ${fee.toFixed(2)}`}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal(store);
            }}
            className="w-10 h-10 bg-slate-800 rounded-2xl text-slate-400 hover:bg-amber-500 hover:text-slate-950 transition-all shadow-xl active:scale-90 flex items-center justify-center cursor-pointer border border-slate-700/50"
          >
            <ShoppingBag size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
};
