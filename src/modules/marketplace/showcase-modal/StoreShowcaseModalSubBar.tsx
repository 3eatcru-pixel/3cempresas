import React from 'react';
import { Store } from '../../../types';
import { MapPin, Bike, Clock, Sparkles, Heart, Calendar, MessageCircle, Instagram, Globe } from 'lucide-react';
import { getStoreSocials, isServiceCategory } from '../../../utils/storeDomain';

interface StoreShowcaseModalSubBarProps {
  store: Store;
  onClose: () => void;
  onOpenFullShowcase?: (slug: string) => void;
  isFavorite: boolean;
  toggleFavoriteStore: (storeId: string) => void;
  showNotification: (msg: string) => void;
}

export const StoreShowcaseModalSubBar: React.FC<StoreShowcaseModalSubBarProps> = ({
  store,
  onClose,
  onOpenFullShowcase,
  isFavorite,
  toggleFavoriteStore,
  showNotification
}) => {
  const isService = isServiceCategory(store.category);
  const socials = getStoreSocials(store);

  return (
    <div className="bg-[#fff9f2] border-b border-stone-200 px-5 py-3 flex flex-wrap items-center justify-between text-xs text-stone-700 font-medium gap-3 shrink-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-stone-800">
          <MapPin className="w-4 h-4 text-orange-600 shrink-0" />
          <span>{store.address || 'Endereço Central'}</span>
        </span>
        {isService ? (
          <span className="flex items-center gap-1.5 text-indigo-700 font-semibold">
            <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Atendimento com Hora Marcada • Sem Frete</span>
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1.5 text-stone-600">
              <Bike className="w-4 h-4 text-orange-600 shrink-0" />
              <span>{store.deliveryFee === 0 ? 'Entrega Grátis' : `Taxa: R$ ${store.deliveryFee.toFixed(2)}`}</span>
            </span>
            <span className="flex items-center gap-1.5 text-stone-600">
              <Clock className="w-4 h-4 text-orange-600 shrink-0" />
              <span>Preparo: {store.deliveryTimeMin || 25} a {(store.deliveryTimeMin || 25) + 15} min</span>
            </span>
          </>
        )}

        {/* Quick Social Links */}
        <div className="flex items-center gap-1.5">
          {socials.whatsapp && (
            <a
              href={`https://wa.me/55${socials.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 border border-emerald-500/30 font-bold text-[10px] flex items-center gap-1 transition-all"
              title="WhatsApp"
            >
              <MessageCircle className="w-3 h-3" /> WhatsApp
            </a>
          )}
          {socials.instagram && (
            <a
              href={`https://instagram.com/${socials.instagram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-700 border border-pink-500/30 font-bold text-[10px] flex items-center gap-1 transition-all"
              title={`Instagram ${socials.instagram}`}
            >
              <Instagram className="w-3 h-3" /> Instagram
            </a>
          )}
          {socials.website && (
            <a
              href={socials.website.startsWith('http') ? socials.website : `https://${socials.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 rounded-lg bg-stone-200/70 hover:bg-stone-200 text-stone-700 border border-stone-300 font-bold text-[10px] flex items-center gap-1 transition-all"
              title="Site Oficial"
            >
              <Globe className="w-3 h-3" /> Site
            </a>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onOpenFullShowcase && (
          <button
            onClick={() => {
              onClose();
              onOpenFullShowcase(store.slug);
            }}
            className="px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:brightness-110 text-slate-950 transition-all shadow cursor-pointer uppercase tracking-wider"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Vitrine Completa</span>
          </button>
        )}

        <button
          onClick={() => {
            toggleFavoriteStore(store.id);
            showNotification(isFavorite ? `Você deixou de seguir ${store.name}.` : `Você agora segue ${store.name}!`);
          }}
          className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer ${
            isFavorite 
              ? 'bg-rose-500 text-white shadow-rose-500/20' 
              : 'bg-stone-900 text-white hover:bg-stone-800'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-white' : ''}`} /> 
          <span>{isFavorite ? 'Seguindo ✓' : 'Seguir Loja'}</span>
        </button>
      </div>
    </div>
  );
};
