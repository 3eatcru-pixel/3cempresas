import React from 'react';
import { Sparkles, Link } from 'lucide-react';

interface ShowcaseSocialLinksFormProps {
  tagline: string;
  setTagline: (val: string) => void;
  announcementBanner: string;
  setAnnouncementBanner: (val: string) => void;
  whatsapp: string;
  setWhatsapp: (val: string) => void;
  instagram: string;
  setInstagram: (val: string) => void;
  facebook: string;
  setFacebook: (val: string) => void;
  ifood: string;
  setIfood: (val: string) => void;
  website: string;
  setWebsite: (val: string) => void;
}

export const ShowcaseSocialLinksForm: React.FC<ShowcaseSocialLinksFormProps> = ({
  tagline,
  setTagline,
  announcementBanner,
  setAnnouncementBanner,
  whatsapp,
  setWhatsapp,
  instagram,
  setInstagram,
  facebook,
  setFacebook,
  ifood,
  setIfood,
  website,
  setWebsite,
}) => {
  return (
    <div className="space-y-6">
      {/* Identity & Marketing Copy */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
        <div>
          <label className="block text-[11px] font-black text-slate-400 uppercase mb-1">
            Slogan / Frase de Impacto da Vitrine
          </label>
          <input
            type="text"
            placeholder="Ex: A melhor pizza napolitana da região"
            value={tagline}
            onChange={e => setTagline(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-pink-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Faixa Promocional / Destaque do Topo
          </label>
          <input
            type="text"
            placeholder="Ex: Frete Grátis acima de R$ 60 até às 22h!"
            value={announcementBanner}
            onChange={e => setAnnouncementBanner(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-pink-500"
          />
        </div>
      </div>

      {/* External Links & Socials */}
      <div className="space-y-3 pt-4 border-t border-slate-800">
        <label className="block text-xs font-black uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
          <Link className="w-3.5 h-3.5 text-pink-400" />
          3. Canais de Contato & Redes Sociais
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: 'WhatsApp de Pedidos', value: whatsapp, setter: setWhatsapp, placeholder: '(43) 99999-9999' },
            { label: 'Instagram (@usuario)', value: instagram, setter: setInstagram, placeholder: '@minhaloja' },
            { label: 'Facebook / Página', value: facebook, setter: setFacebook, placeholder: 'facebook.com/minhaloja' },
            { label: 'Link no iFood', value: ifood, setter: setIfood, placeholder: 'ifood.com.br/delivery/...' },
            { label: 'Site Próprio / Linktree', value: website, setter: setWebsite, placeholder: 'https://minhaloja.com.br' },
          ].map(link => (
            <div key={link.label}>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">{link.label}</label>
              <input
                type="text"
                placeholder={link.placeholder}
                value={link.value}
                onChange={e => link.setter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-pink-500"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
