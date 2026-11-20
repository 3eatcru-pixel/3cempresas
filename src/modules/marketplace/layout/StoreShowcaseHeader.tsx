import React from 'react';
import {
  Sparkles, ArrowLeft, Moon, Sun, Heart, Star, Clock, Bike,
  ShieldCheck, ShoppingBag, UtensilsCrossed, Calendar, Instagram,
  Facebook, Globe, MessageSquare
} from 'lucide-react';
import { Store } from '../../../types';
import { getAllowedModalities, getStoreSocials, isServiceCategory } from '../../../utils/storeDomain';

interface StoreShowcaseHeaderProps {
  store: Store;
  config: any;
  primaryColor: string;
  isLightMode: boolean;
  setIsLightMode: (val: boolean) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onBack: () => void;
  onOpenCheckout: () => void;
  cartTotal: number;
  activeModality: string;
  updateModality: (m: any) => void;
  currentTable: number;
  onTabChange: (tab: any) => void;
}

export const StoreShowcaseHeader: React.FC<StoreShowcaseHeaderProps> = ({
  store,
  config,
  primaryColor,
  isLightMode,
  setIsLightMode,
  isFavorite,
  onToggleFavorite,
  onBack,
  onOpenCheckout,
  cartTotal,
  activeModality,
  updateModality,
  currentTable,
  onTabChange
}) => {
  const isService = isServiceCategory(store.category);
  const allowedModalities = getAllowedModalities(store);
  const socials = getStoreSocials(store);

  const modalityButtons = [
    { id: 'DELIVERY' as const, label: 'Entrega', icon: Bike },
    { id: 'PICKUP' as const, label: 'Retirada', icon: ShoppingBag },
    { id: 'TABLE' as const, label: `Mesa ${String(currentTable).padStart(2, '0')}`, icon: UtensilsCrossed },
  ].filter(m => allowedModalities.includes(m.id));

  return (
    <div className="relative">
      {/* Announcement Banner */}
      {config?.announcementBanner && (
        <div 
          className="text-slate-950 py-2.5 px-4 text-center text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 sticky top-0 z-50 shadow-lg"
          style={{ backgroundColor: primaryColor }}
        >
          <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
          {config.announcementBanner}
        </div>
      )}

      {/* Store Header Banner */}
      <div className="relative h-72 md:h-80 overflow-hidden">
        <img src={store.banner} alt={store.name} className="w-full h-full object-cover" />
        <div className={`absolute inset-0 bg-gradient-to-t ${isLightMode ? 'from-stone-50 via-stone-900/65' : 'from-slate-950 via-slate-950/75'} to-transparent`} />
        
        {/* Top Floating Controls */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20">
          <button
            onClick={onBack}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg backdrop-blur-md transition-all cursor-pointer ${
              isLightMode ? 'bg-white/90 text-stone-900 hover:bg-white' : 'bg-slate-900/90 text-white hover:bg-slate-800'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Marketplace</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLightMode(!isLightMode)}
              className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-md transition-all cursor-pointer ${
                isLightMode ? 'bg-white/90 text-stone-900' : 'bg-slate-900/90 text-amber-400'
              }`}
            >
              {isLightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            <button
              onClick={onToggleFavorite}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-md transition-all cursor-pointer ${
                isFavorite 
                  ? 'bg-rose-500 text-white shadow-rose-500/30' 
                  : isLightMode ? 'bg-white/90 text-stone-900 hover:bg-white' : 'bg-slate-900/90 text-white hover:bg-slate-800'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-white' : ''}`} />
              <span className="hidden sm:inline">{isFavorite ? 'Seguindo' : 'Seguir Loja'}</span>
            </button>
          </div>
        </div>

        {/* Store Title & Profile Card */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-5 sm:gap-6">
            <div className="relative group shrink-0">
              <img 
                src={store.logo} 
                alt={store.name} 
                className="w-20 h-20 sm:w-28 sm:h-28 rounded-3xl object-cover border-4 border-slate-950 shadow-2xl transition-transform group-hover:scale-105" 
              />
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1.5 rounded-full border-2 border-slate-950">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-4xl font-black text-white drop-shadow-lg tracking-tight uppercase italic">{store.name}</h1>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-md">
                  {store.category}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-md border ${
                    store.isOpen === false
                      ? 'bg-rose-500/25 text-rose-200 border-rose-400/40'
                      : 'bg-emerald-500/25 text-emerald-200 border-emerald-400/40'
                  }`}
                >
                  {store.isOpen === false ? 'Fechada' : 'Aberta'}
                </span>
              </div>
              
              <p className="text-xs sm:text-sm text-slate-200 font-medium max-w-xl line-clamp-1 opacity-90">
                {config?.tagline || store.address}
              </p>

              <div className="flex flex-wrap items-center gap-2.5 text-xs pt-1">
                <span className="flex items-center gap-1 font-bold text-amber-400 bg-amber-400/20 backdrop-blur-md px-2.5 py-0.5 rounded-full">
                  <Star className="w-3.5 h-3.5 fill-amber-400" /> {store.rating.toFixed(1)}
                </span>
                {isService ? (
                  <span className="flex items-center gap-1.5 font-mono text-indigo-200 bg-indigo-500/25 backdrop-blur-md px-3 py-0.5 rounded-full text-[11px]">
                    <Calendar className="w-3 h-3 text-indigo-300" /> Atendimento Agendado
                  </span>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5 font-mono text-slate-200 bg-slate-900/60 backdrop-blur-md px-3 py-0.5 rounded-full text-[11px]">
                      <Clock className="w-3 h-3 text-slate-400" /> {store.deliveryTimeMin || 25}-{(store.deliveryTimeMin || 25) + 15} MIN
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-slate-200 bg-slate-900/60 backdrop-blur-md px-3 py-0.5 rounded-full text-[11px]">
                      <Bike className="w-3 h-3 text-slate-400" /> {activeModality === 'TABLE' || activeModality === 'PICKUP' ? 'Grátis (Local)' : store.deliveryFee === 0 ? 'Grátis' : `R$ ${store.deliveryFee.toFixed(2)}`}
                    </span>
                  </>
                )}

                {/* Direct Social Links Pills */}
                <div className="flex items-center gap-1.5">
                  {socials.whatsapp && (
                    <a
                      href={`https://wa.me/55${socials.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="WhatsApp Oficial"
                      className="p-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/30 backdrop-blur-md transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {socials.instagram && (
                    <a
                      href={`https://instagram.com/${socials.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Instagram ${socials.instagram}`}
                      className="p-1.5 rounded-full bg-pink-500/20 hover:bg-pink-500/40 text-pink-300 border border-pink-500/30 backdrop-blur-md transition-colors"
                    >
                      <Instagram className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {socials.facebook && (
                    <a
                      href={`https://${socials.facebook.replace(/^https?:\/\//, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Facebook"
                      className="p-1.5 rounded-full bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 border border-blue-500/30 backdrop-blur-md transition-colors"
                    >
                      <Facebook className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {socials.website && (
                    <a
                      href={socials.website.startsWith('http') ? socials.website : `https://${socials.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Site Oficial"
                      className="p-1.5 rounded-full bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 border border-purple-500/30 backdrop-blur-md transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>

              {!isService && modalityButtons.length > 0 && (
                <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 backdrop-blur-md rounded-2xl border border-white/10 text-xs mt-2 w-fit">
                  {modalityButtons.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        updateModality(m.id);
                        if (m.id === 'TABLE') {
                          onTabChange('AUTOATENDIMENTO');
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all text-[11px] cursor-pointer ${
                        activeModality === m.id
                          ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <m.icon className="w-3.5 h-3.5" />
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-3">
            {isService ? (
              <button
                onClick={() => onTabChange('RESERVAS')}
                className="px-6 py-3 text-slate-950 font-black rounded-2xl text-xs uppercase tracking-wider shadow-2xl flex items-center gap-2 hover:brightness-110 transition-all cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                <Calendar className="w-4 h-4" /> Agendar Horário
              </button>
            ) : (
              <button
                onClick={onOpenCheckout}
                disabled={store.isOpen === false && cartTotal <= 0}
                className={`px-6 py-3 font-black rounded-2xl text-xs uppercase tracking-wider shadow-2xl flex items-center gap-2 transition-all ${
                  store.isOpen === false
                    ? 'bg-rose-950/90 text-rose-200 border border-rose-500/40 cursor-not-allowed opacity-90'
                    : 'text-slate-950 hover:brightness-110 cursor-pointer'
                }`}
                style={store.isOpen === false ? undefined : { backgroundColor: primaryColor }}
              >
                <ShoppingBag className="w-4 h-4" />
                {store.isOpen === false
                  ? 'Loja Fechada'
                  : activeModality === 'TABLE'
                  ? `Comanda Mesa ${String(currentTable).padStart(2, '0')} (${cartTotal > 0 ? `R$ ${cartTotal.toFixed(2)}` : 'Vazia'})`
                  : `Sacola (${cartTotal > 0 ? `R$ ${cartTotal.toFixed(2)}` : 'Vazia'})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
