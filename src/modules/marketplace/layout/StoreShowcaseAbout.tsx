import React from 'react';
import { MapPin, Phone, Clock, Bike, MessageSquare, Instagram, Facebook, Globe, ShoppingBag, ExternalLink, Calendar } from 'lucide-react';
import { Store } from '../../../types';
import { getStoreSocials, isServiceCategory } from '../../../utils/storeDomain';

interface StoreShowcaseAboutProps {
  store: Store;
  isLightMode: boolean;
}

export const StoreShowcaseAbout: React.FC<StoreShowcaseAboutProps> = ({
  store,
  isLightMode
}) => {
  const socials = getStoreSocials(store);
  const isService = isServiceCategory(store.category);

  return (
    <div className={`p-6 sm:p-8 rounded-3xl border max-w-3xl mx-auto space-y-6 shadow-xl ${isLightMode ? 'bg-white border-stone-200' : 'bg-slate-900/70 border-slate-800'}`}>
      <div>
        <h3 className="text-lg font-black uppercase italic tracking-tight">Informações do Estabelecimento</h3>
        <p className="text-xs text-slate-400 mt-1">Conheça mais sobre nossa operação, canais oficiais e redes sociais.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className={`p-4 rounded-2xl border space-y-1 ${isLightMode ? 'bg-stone-50 border-stone-200' : 'bg-slate-950/60 border-slate-800'}`}>
          <div className="font-bold flex items-center gap-1.5 text-amber-500">
            <MapPin className="w-4 h-4" /> Endereço Oficial
          </div>
          <div className="text-slate-300 font-medium">{store.address}</div>
        </div>

        <div className={`p-4 rounded-2xl border space-y-1 ${isLightMode ? 'bg-stone-50 border-stone-200' : 'bg-slate-950/60 border-slate-800'}`}>
          <div className="font-bold flex items-center gap-1.5 text-emerald-500">
            <Phone className="w-4 h-4" /> Telefone / WhatsApp
          </div>
          <div className="text-slate-300 font-mono font-medium">{socials.whatsapp || store.phone || '(43) 3324-0000'}</div>
        </div>

        <div className={`p-4 rounded-2xl border space-y-1 ${isLightMode ? 'bg-stone-50 border-stone-200' : 'bg-slate-950/60 border-slate-800'}`}>
          <div className="font-bold flex items-center gap-1.5 text-blue-500">
            <Clock className="w-4 h-4" /> Horário de Atendimento
          </div>
          <div className="text-slate-300 font-medium">
            {isService ? 'Segunda a Sábado das 09:00 às 20:00 (Com hora marcada)' : 'Todos os dias das 11:00 às 23:30'}
          </div>
        </div>

        <div className={`p-4 rounded-2xl border space-y-1 ${isLightMode ? 'bg-stone-50 border-stone-200' : 'bg-slate-950/60 border-slate-800'}`}>
          <div className="font-bold flex items-center gap-1.5 text-orange-500">
            {isService ? <Calendar className="w-4 h-4" /> : <Bike className="w-4 h-4" />}
            {isService ? 'Modelo de Atendimento' : 'Política de Entrega'}
          </div>
          <div className="text-slate-300 font-medium">
            {isService
              ? 'Agendamento online direto com confirmação do profissional.'
              : 'Entrega direta com rastreamento e opção de retirada no local.'}
          </div>
        </div>
      </div>

      {/* Social Media & Official Channels */}
      <div className={`p-5 rounded-2xl border space-y-3 ${isLightMode ? 'bg-stone-50 border-stone-200' : 'bg-slate-950/60 border-slate-800'}`}>
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Globe className="w-4 h-4 text-pink-500" />
          Redes Sociais & Canais Oficiais
        </h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {socials.whatsapp && (
            <a
              href={`https://wa.me/55${socials.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center justify-between transition-all"
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> WhatsApp Oficial
              </span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          )}

          {socials.instagram && (
            <a
              href={`https://instagram.com/${socials.instagram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-pink-600/20 hover:bg-pink-600/30 text-pink-400 border border-pink-500/30 rounded-xl text-xs font-bold flex items-center justify-between transition-all"
            >
              <span className="flex items-center gap-2">
                <Instagram className="w-4 h-4" /> {socials.instagram}
              </span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          )}

          {socials.facebook && (
            <a
              href={`https://${socials.facebook.startsWith('http') ? socials.facebook.replace(/^https?:\/\//, '') : socials.facebook}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold flex items-center justify-between transition-all"
            >
              <span className="flex items-center gap-2">
                <Facebook className="w-4 h-4" /> Facebook
              </span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          )}

          {socials.ifood && (
            <a
              href={`https://${socials.ifood.startsWith('http') ? socials.ifood.replace(/^https?:\/\//, '') : socials.ifood}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center justify-between transition-all"
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" /> Loja no iFood
              </span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          )}

          {socials.website && (
            <a
              href={socials.website.startsWith('http') ? socials.website : `https://${socials.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 rounded-xl text-xs font-bold flex items-center justify-between transition-all col-span-full"
            >
              <span className="flex items-center gap-2">
                <Globe className="w-4 h-4" /> {socials.website}
              </span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          )}
        </div>

        {!socials.whatsapp && !socials.instagram && !socials.facebook && !socials.ifood && !socials.website && (
          <p className="text-[11px] text-slate-500 italic">Nenhuma rede social ou link externo cadastrado pelo estabelecimento.</p>
        )}
      </div>

      {store.phone && (
        <div className="pt-2">
          <a
            href={`https://wa.me/55${store.phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Falar com o Atendimento via WhatsApp</span>
          </a>
        </div>
      )}
    </div>
  );
};

