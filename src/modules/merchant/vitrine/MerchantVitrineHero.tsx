import React from 'react';
import { Sparkles, CheckCircle, Star, Clock, MapPin, Phone, Instagram, Globe } from 'lucide-react';
import { Store } from '../../../types';
import { getStoreSocials, isServiceCategory } from '../../../utils/storeDomain';

interface MerchantVitrineHeroProps {
  currentStore: Store;
  primaryColor: string;
  template: string;
  announcement?: string;
  tagline?: string;
}

export const MerchantVitrineHero: React.FC<MerchantVitrineHeroProps> = ({
  currentStore,
  primaryColor,
  template,
  announcement,
  tagline,
}) => {
  const socials = getStoreSocials(currentStore);
  const isServiceStore = isServiceCategory(currentStore.category);
  const waDigits = (socials.whatsapp || currentStore.phone || '').replace(/\D/g, '');
  const waUrl = waDigits ? `https://wa.me/${waDigits.startsWith('55') ? waDigits : `55${waDigits}`}` : '';
  const igUrl = socials.instagram
    ? socials.instagram.startsWith('http')
      ? socials.instagram
      : `https://instagram.com/${socials.instagram.replace(/^@/, '')}`
    : '';
  const webUrl = socials.website
    ? socials.website.startsWith('http')
      ? socials.website
      : `https://${socials.website}`
    : '';

  return (
    <div className="space-y-6">
      {/* Announcement bar if configured */}
      {announcement && (
        <div className="bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-indigo-500/20 border border-amber-500/30 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs text-amber-200 font-bold">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>{announcement}</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            Destaque
          </span>
        </div>
      )}

      {/* Hero Banner & Identity */}
      <div className="relative rounded-2xl overflow-hidden h-60 bg-slate-950 border border-slate-800">
        <img src={currentStore.banner} alt={currentStore.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />

        {/* Template Pill */}
        <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
          <span className="text-[10px] font-black uppercase text-slate-300 tracking-wider">
            Tema: {template.replace('_', ' ')}
          </span>
        </div>

        <div className="absolute bottom-4 left-4 right-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={currentStore.logo}
              alt={currentStore.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 shadow-2xl shrink-0"
              style={{ borderColor: primaryColor }}
            />
            <div className="text-white space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">{currentStore.name}</h2>
                <CheckCircle className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {currentStore.isOpen ? 'Aberto Agora' : 'Fechado no Momento'}
                </span>
              </div>
              {tagline && <p className="text-xs text-slate-300 font-medium line-clamp-1">{tagline}</p>}
              <div className="text-xs text-slate-400 flex items-center gap-3 flex-wrap pt-0.5">
                <span className="flex items-center gap-1 text-amber-400 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400" /> {currentStore.rating.toFixed(1)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />{' '}
                  {isServiceStore ? 'Atendimento sob agenda' : `${currentStore.deliveryTimeMin} min`}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />{' '}
                  {currentStore.address?.split('-')[0] || 'Localização central'}
                </span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold">
                  {isServiceStore ? 'Por Agendamento' : `Taxa R$ ${currentStore.deliveryFee.toFixed(2)}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-end">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir WhatsApp da loja"
                className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/20 transition-all"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
            {igUrl && (
              <a
                href={igUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir Instagram da loja"
                className="p-2 bg-pink-500/10 text-pink-400 border border-pink-500/30 rounded-xl hover:bg-pink-500/20 transition-all"
              >
                <Instagram className="w-4 h-4" />
              </a>
            )}
            {webUrl && (
              <a
                href={webUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir Site da loja"
                className="p-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-xl hover:bg-blue-500/20 transition-all"
              >
                <Globe className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
