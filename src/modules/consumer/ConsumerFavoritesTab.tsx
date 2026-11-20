import React from 'react';
import { useConsumer } from '../../context/ConsumerContext';
import { useEcosystem } from '../../context/EcosystemContext';
import { Heart, Star, Store as StoreIcon, ArrowRight } from 'lucide-react';

export const ConsumerFavoritesTab: React.FC = () => {
  const { consumer, toggleFavoriteStore } = useConsumer();
  const { stores, setSelectedStoreSlugForShowcase } = useEcosystem();

  const favoriteStoresList = stores.filter(s => consumer.favoriteStoreIds.includes(s.id));

  return (
    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-6 shadow-xl animate-fadeIn">
      <div className="border-b border-slate-800 pb-4 flex justify-between items-center">
        <div>
          <h3 className="font-black text-white italic uppercase tracking-tight flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500 fill-rose-500" /> Minhas Lojas Favoritas
          </h3>
          <p className="text-xs text-slate-400">Acesso rápido aos seus estabelecimentos prediletos no ecossistema</p>
        </div>
        <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
          {favoriteStoresList.length} Lojas Favoritadas
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {favoriteStoresList.map(store => (
          <div key={store.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={store.logo} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-800" />
              <div>
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  <span>{store.name}</span>
                  <span className="text-amber-400 font-mono text-xs flex items-center gap-0.5">
                    <Star className="w-3 h-3 fill-amber-400" /> {store.rating}
                  </span>
                </div>
                <div className="text-xs text-slate-400">{store.category} • {store.address}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedStoreSlugForShowcase(store.slug)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow flex items-center gap-1"
              >
                <span>Vitrine</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => toggleFavoriteStore(store.id)}
                className="p-2 text-rose-500 hover:text-rose-400 bg-rose-500/10 rounded-xl border border-rose-500/20 transition-colors"
                title="Remover dos favoritos"
              >
                <Heart className="w-4 h-4 fill-rose-500" />
              </button>
            </div>
          </div>
        ))}

        {favoriteStoresList.length === 0 && (
          <div className="col-span-2 text-center py-12 text-slate-500 text-xs font-mono space-y-2">
            <Heart className="w-8 h-8 mx-auto text-slate-600" />
            <p>Você ainda não favoritou nenhuma loja no Marketplace.</p>
          </div>
        )}
      </div>
    </div>
  );
};
