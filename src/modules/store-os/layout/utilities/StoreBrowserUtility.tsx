import React from 'react';
import {
  Globe,
  ExternalLink,
  Copy,
  Store as StoreIcon,
  MessageCircle,
  Instagram,
} from 'lucide-react';
import { WindowAppId } from '../storeOsAppsList';
import { Store } from '../../../../types';
import { useEcosystem } from '../../../../context/EcosystemContext';
import { getStoreSocials } from '../../../../utils/storeDomain';
import { getPlatformAdapters } from '../../../../core/platform/PlatformAdapter';

interface StoreBrowserUtilityProps {
  currentStore: Store;
  onOpenApp?: (appId: WindowAppId, title: string) => void;
}

export const StoreBrowserUtility: React.FC<StoreBrowserUtilityProps> = ({
  currentStore,
  onOpenApp,
}) => {
  const { showNotification } = useEcosystem();
  const socials = getStoreSocials(currentStore);
  const publicUrl = `${getPlatformAdapters().links.getOrigin()}/?store=${encodeURIComponent(currentStore.slug || currentStore.id)}`;
  const waPhone = (socials.whatsapp || currentStore.phone || '').replace(/\D/g, '');
  const waUrl = waPhone ? `https://wa.me/${waPhone.startsWith('55') ? waPhone : `55${waPhone}`}` : '';
  const igUrl = socials.instagram
    ? socials.instagram.startsWith('http')
      ? socials.instagram
      : `https://instagram.com/${socials.instagram.replace(/^@/, '')}`
    : '';

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(publicUrl);
      showNotification('Link público da vitrine copiado!');
    }
  };

  return (
    <div className="h-full p-6 space-y-6 overflow-y-auto text-slate-200 animate-fadeIn">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/30 text-indigo-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
              Links & Vitrine Web
            </h3>
            <p className="text-[11px] text-slate-400">
              Canais públicos e redes integradas para {currentStore.name}
            </p>
          </div>
        </div>
        {onOpenApp && (
          <button
            onClick={() => onOpenApp('vitrine-preview', 'Ver Minha Loja')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer"
          >
            <StoreIcon className="w-3.5 h-3.5" /> Abrir Preview da Vitrine
          </button>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          URL Direta da Loja no Marketplace
        </div>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={publicUrl}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400"
          />
          <button
            onClick={handleCopy}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" /> Copiar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between hover:bg-emerald-500/20 transition-all"
          >
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <div className="text-xs font-black text-white">WhatsApp Comercial</div>
                <div className="text-[10px] text-emerald-300 font-mono">{socials.whatsapp || currentStore.phone}</div>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-emerald-400" />
          </a>
        )}

        {igUrl && (
          <a
            href={igUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 bg-pink-500/10 border border-pink-500/30 rounded-2xl flex items-center justify-between hover:bg-pink-500/20 transition-all"
          >
            <div className="flex items-center gap-3">
              <Instagram className="w-5 h-5 text-pink-400" />
              <div>
                <div className="text-xs font-black text-white">Instagram Oficial</div>
                <div className="text-[10px] text-pink-300 font-mono">{socials.instagram}</div>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-pink-400" />
          </a>
        )}

        {socials.website && (
          <a
            href={socials.website.startsWith('http') ? socials.website : `https://${socials.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-between hover:bg-blue-500/20 transition-all"
          >
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-xs font-black text-white">Site Próprio</div>
                <div className="text-[10px] text-blue-300 font-mono">{socials.website}</div>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-blue-400" />
          </a>
        )}
      </div>

      {onOpenApp && (
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-white">Personalizar links e banners da vitrine</div>
            <div className="text-[10px] text-slate-400">Edite Instagram, WhatsApp, tema e anúncios da loja.</div>
          </div>
          <button
            onClick={() => onOpenApp('showcase-templates', 'Vitrine Tema')}
            className="px-3 py-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase cursor-pointer"
          >
            Configurar Vitrine
          </button>
        </div>
      )}
    </div>
  );
};
