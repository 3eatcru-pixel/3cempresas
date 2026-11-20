import React, { useState, useEffect } from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { useAuth } from '../../../context/AuthContext';
import { Palette, Check, Eye, ExternalLink, Layers, Power } from 'lucide-react';
import { MultiCommerceCustomSections, StoreShowcaseTemplate } from '../../../types';
import { ShowcaseTemplateSelector } from '../showcase-config/ShowcaseTemplateSelector';
import { ShowcaseSocialLinksForm } from '../showcase-config/ShowcaseSocialLinksForm';
import { ShowcaseMarketplaceGrowthPanel } from '../showcase-config/ShowcaseMarketplaceGrowthPanel';
import { getStoreSocials } from '../../../utils/storeDomain';
import { getActiveClientAppId } from '../../../core/platform/PlatformAdapter';

const DEFAULT_CUSTOM_SECTIONS: MultiCommerceCustomSections = {
  title: 'Vitrine Multivendas 360°',
  showFoodSection: true,
  showRetailSection: true,
  showServicesSection: true,
  showTablesSection: true,
  cardDensity: 'COMFORT',
  highlightPromo: true,
};

export const ShowcaseConfigApp: React.FC = () => {
  const {
    currentStore,
    updateStoreTemplate,
    updateStoreData,
    showNotification,
    setSelectedStoreSlugForShowcase,
    setActiveSection,
  } = useEcosystem();
  const { profile } = useAuth();
  const canToggleOpen = !profile?.role || ['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER'].includes(String(profile.role).toUpperCase());
  const currentConfig = currentStore.showcaseTemplate || {
    templateId: 'BURGER_MODERN',
    primaryColor: '#f59e0b',
    tagline: '',
    announcementBanner: '',
    showCategoryPills: true,
    showReviews: true,
    layoutStyle: 'GRID_CARDS',
  };
  const mergedSocials = getStoreSocials(currentStore);

  const [activeShowcaseSection, setActiveShowcaseSection] = useState<'identity' | 'growth'>(
    'identity'
  );
  const [templateSelection, setTemplateSelection] = useState<StoreShowcaseTemplate>(currentConfig.templateId);
  const [primaryColor, setPrimaryColor] = useState(currentConfig.primaryColor || '#f59e0b');
  const [tagline, setTagline] = useState(currentConfig.tagline || '');
  const [announcementBanner, setAnnouncementBanner] = useState(currentConfig.announcementBanner || '');
  const [customSections, setCustomSections] = useState<MultiCommerceCustomSections>({
    ...DEFAULT_CUSTOM_SECTIONS,
    ...(currentConfig.customSections || {}),
  });

  const [instagram, setInstagram] = useState(mergedSocials.instagram || '');
  const [facebook, setFacebook] = useState(mergedSocials.facebook || '');
  const [whatsapp, setWhatsapp] = useState(mergedSocials.whatsapp || '');
  const [ifood, setIfood] = useState(mergedSocials.ifood || '');
  const [website, setWebsite] = useState(mergedSocials.website || '');

  useEffect(() => {
    const cfg = currentStore.showcaseTemplate;
    const socials = getStoreSocials(currentStore);
    setTemplateSelection(cfg?.templateId || 'BURGER_MODERN');
    setPrimaryColor(cfg?.primaryColor || '#f59e0b');
    setTagline(cfg?.tagline || '');
    setAnnouncementBanner(cfg?.announcementBanner || '');
    setCustomSections({
      ...DEFAULT_CUSTOM_SECTIONS,
      ...(cfg?.customSections || {}),
    });
    setInstagram(socials.instagram || '');
    setFacebook(socials.facebook || '');
    setWhatsapp(socials.whatsapp || '');
    setIfood(socials.ifood || '');
    setWebsite(socials.website || '');
  }, [currentStore.id]);

  const isMultiTemplate = templateSelection === 'MULTI_COMMERCE' || currentStore.category === 'MULTI_COMMERCE';

  const handleSave = () => {
    const cleanSocials = {
      instagram: instagram.trim(),
      facebook: facebook.trim(),
      whatsapp: whatsapp.trim(),
      ifood: ifood.trim(),
      website: website.trim(),
    };
    updateStoreTemplate(currentStore.id, {
      templateId: templateSelection,
      primaryColor,
      tagline,
      announcementBanner,
      showCategoryPills: true,
      layoutStyle:
        templateSelection === 'MULTI_COMMERCE' ? 'HYBRID_MIXED' :
        templateSelection === 'RETAIL_EMPORIO' ? 'DENSE_SHELVES' :
        templateSelection === 'FURNITURE_SHOWROOM' ? 'SHOWROOM_GALLERY' :
        templateSelection === 'TECH_ELECTRONICS' ? 'TECH_SPECS' :
        templateSelection === 'FASHION_BOUTIQUE' ? 'GRID_CARDS' :
        templateSelection === 'SERVICES_APPOINTMENT' ? 'SERVICES_LIST' :
        templateSelection === 'PIZZA_TRATTORIA' ? 'ELEGANT_MENU' : 'GRID_CARDS',
      customSections: isMultiTemplate ? customSections : currentConfig.customSections,
      socials: cleanSocials,
    });
    showNotification('Vitrine comercial e redes sociais salvas e sincronizadas com o Marketplace!');
  };

  const handlePreviewShowcase = async () => {
    const slug = currentStore.slug;
    if (getActiveClientAppId() === 'unified-portal') {
      setSelectedStoreSlugForShowcase(slug);
      setActiveSection('marketplace');
      return;
    }
    const publicPath = `/?app=marketplace&store=${encodeURIComponent(slug)}`;
    const fullUrl =
      typeof window !== 'undefined' ? `${window.location.origin}${publicPath}` : publicPath;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullUrl);
        showNotification(`Link público da vitrine copiado: ${publicPath}`);
        return;
      }
    } catch {
      // Clipboard blocked in restricted context; show URL notice below
    }
    showNotification(`Vitrine pública disponível em: ${publicPath}`);
  };

  return (
    <div className="space-y-6 h-full overflow-y-auto pr-2 custom-scrollbar animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
        <div className="flex items-center gap-3">
          <Palette className="w-6 h-6 text-pink-400" />
          <div>
            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
              Personalização de Vitrine Comercial
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Escolha o nicho, as cores de destaque e as redes sociais que seus clientes verão no Marketplace e na Minha Vitrine.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canToggleOpen && (
            <button
              type="button"
              onClick={() => updateStoreData(currentStore.id, { isOpen: !currentStore.isOpen })}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all cursor-pointer ${
                currentStore.isOpen
                  ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300 hover:bg-rose-500/15 hover:border-rose-500/35 hover:text-rose-300'
                  : 'bg-rose-500/15 border-rose-500/35 text-rose-300 hover:bg-emerald-500/15 hover:border-emerald-500/35 hover:text-emerald-300'
              }`}
              title={currentStore.isOpen ? 'Clique para fechar a vitrine e recusar pedidos' : 'Clique para abrir a vitrine para pedidos'}
            >
              <Power className="w-3 h-3" />
              <span>{currentStore.isOpen ? 'Vitrine Aberta' : 'Vitrine Fechada'}</span>
            </button>
          )}
          <span className="text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
            <Eye className="w-3 h-3 text-pink-400" />
            Loja: {currentStore.name}
          </span>
          <button
            type="button"
            onClick={handlePreviewShowcase}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-pink-500/40 text-pink-300 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Ver Minha Vitrine</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800 w-fit">
        <button
          type="button"
          onClick={() => setActiveShowcaseSection('identity')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeShowcaseSection === 'identity'
              ? 'bg-pink-500 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Identidade &amp; Redes da Vitrine
        </button>
        <button
          type="button"
          onClick={() => setActiveShowcaseSection('growth')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeShowcaseSection === 'growth'
              ? 'bg-amber-500 text-slate-950'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Destaque no Marketplace &amp; Canais Externos
        </button>
      </div>

      {activeShowcaseSection === 'growth' ? (
        <ShowcaseMarketplaceGrowthPanel
          currentStore={currentStore}
          canWrite={canToggleOpen}
          onShowNotification={showNotification}
        />
      ) : (
        <>
          <ShowcaseTemplateSelector
            templateSelection={templateSelection}
            onSelectTemplate={setTemplateSelection}
            primaryColor={primaryColor}
            onSelectColor={setPrimaryColor}
          />

      {isMultiTemplate && (
        <div className="p-5 rounded-2xl bg-slate-950 border border-indigo-500/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <div>
                <h4 className="text-xs font-black uppercase text-white tracking-wider">
                  Customizador de Seções Multivendas (Vende Tudo + Comida)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Ative ou oculte frentes de negócio na mesma loja pública sem perder o KDS ou estoque.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
              {(['COMFORT', 'COMPACT'] as const).map(density => (
                <button
                  key={density}
                  type="button"
                  onClick={() => setCustomSections(prev => ({ ...prev, cardDensity: density }))}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                    customSections.cardDensity === density
                      ? 'bg-indigo-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {density === 'COMFORT' ? 'Cards Amplos' : 'Grade Compacta'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
              Título da Vitrine Híbrida
            </label>
            <input
              type="text"
              value={customSections.title || ''}
              onChange={e => setCustomSections(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Tudo em um só lugar: Bistrô, Tech & Serviços"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { key: 'showFoodSection', label: '🍔 Gastronomia & Delivery', desc: 'Comidas, bebidas e KDS cozinha' },
              { key: 'showRetailSection', label: '🛍️ Varejo, Tech & Moda', desc: 'Produtos físicos com entrega/retirada' },
              { key: 'showServicesSection', label: '✂️ Serviços & Agenda', desc: 'CTA Agendar Horário sem frete' },
              { key: 'showTablesSection', label: '🍽️ Salão & Mesas QR', desc: 'Autoatendimento e reservas de mesa' },
              { key: 'highlightPromo', label: '🔥 Aba Ofertas em Destaque', desc: 'Prioriza combos e promoções' },
            ].map(opt => {
              const checked = (customSections as any)[opt.key] !== false;
              return (
                <label
                  key={opt.key}
                  className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                    checked ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-slate-900/50 border-slate-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e =>
                      setCustomSections(prev => ({ ...prev, [opt.key]: e.target.checked }))
                    }
                    className="mt-0.5 accent-indigo-500 w-4 h-4"
                  />
                  <div>
                    <div className="text-xs font-bold text-white">{opt.label}</div>
                    <div className="text-[10px] text-slate-400">{opt.desc}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <ShowcaseSocialLinksForm
        tagline={tagline}
        setTagline={setTagline}
        announcementBanner={announcementBanner}
        setAnnouncementBanner={setAnnouncementBanner}
        whatsapp={whatsapp}
        setWhatsapp={setWhatsapp}
        instagram={instagram}
        setInstagram={setInstagram}
        facebook={facebook}
        setFacebook={setFacebook}
        ifood={ifood}
        setIfood={setIfood}
        website={website}
        setWebsite={setWebsite}
      />

      <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
        <p className="text-[11px] text-slate-500 font-medium">
          As alterações entram em vigor imediatamente no catálogo público e no app do cliente.
        </p>
        <button
          type="button"
          onClick={handleSave}
          className="px-8 py-3 bg-pink-500 hover:bg-pink-400 text-white font-black text-xs rounded-xl shadow-xl shadow-pink-500/20 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          SALVAR VITRINE COMERCIAL
        </button>
      </div>
        </>
      )}
    </div>
  );
};
