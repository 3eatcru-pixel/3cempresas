import React, { useState, useEffect } from 'react';
import { QrCode, Calendar, MapPin, Phone, Plus } from 'lucide-react';
import { Store, MenuItem, StoreShowcaseTemplate } from '../../types';
import { useEcosystem } from '../../context/EcosystemContext';
import { MerchantVitrineHero } from './vitrine/MerchantVitrineHero';
import { MerchantVitrineNavTabs, VitrineTabId } from './vitrine/MerchantVitrineNavTabs';
import {
  getAllowedShowcaseTabs,
  getItemSegmentGroup,
  isItemService,
  isMultiCommerceStore,
  isRetailCategory,
  isServiceCategory,
} from '../../utils/storeDomain';

interface MerchantVitrineViewProps {
  currentStore: Store;
  menuItems: MenuItem[];
}

export const MerchantVitrineView: React.FC<MerchantVitrineViewProps> = ({
  currentStore,
  menuItems,
}) => {
  const { addToCart, showNotification } = useEcosystem();
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [segmentFilter, setSegmentFilter] = useState<'ALL' | 'FOOD' | 'RETAIL' | 'SERVICE'>('ALL');
  const [activeTab, setActiveTab] = useState<VitrineTabId>('CARDAPIO');

  const allowedTabs = getAllowedShowcaseTabs(currentStore);
  const isServiceStore = isServiceCategory(currentStore.category);
  const isMulti = isMultiCommerceStore(currentStore);
  const customSections = currentStore.showcaseTemplate?.customSections;

  useEffect(() => {
    if (!allowedTabs.includes(activeTab as any)) {
      setActiveTab('CARDAPIO');
    }
  }, [currentStore.id, activeTab]);

  useEffect(() => {
    setSegmentFilter('ALL');
    setSelectedCategory('Todos');
  }, [currentStore.id]);

  const template: StoreShowcaseTemplate = currentStore.showcaseTemplate?.templateId || 'BURGER_MODERN';
  const primaryColor = currentStore.showcaseTemplate?.primaryColor || '#f59e0b';
  const announcement = currentStore.showcaseTemplate?.announcementBanner;
  const tagline = currentStore.showcaseTemplate?.tagline || '';

  const visibleItems = isMulti
    ? menuItems.filter(i => {
        const grp = getItemSegmentGroup(i, currentStore);
        if (grp === 'FOOD' && customSections?.showFoodSection === false) return false;
        if (grp === 'RETAIL' && customSections?.showRetailSection === false) return false;
        if (grp === 'SERVICE' && customSections?.showServicesSection === false) return false;
        return true;
      })
    : menuItems;

  const segmentItems =
    isMulti && segmentFilter !== 'ALL'
      ? visibleItems.filter(i => getItemSegmentGroup(i, currentStore) === segmentFilter)
      : visibleItems;

  const categories = ['Todos', ...Array.from(new Set(segmentItems.map(i => i.category || 'Geral')))];

  const isPizza = template === 'PIZZA_TRATTORIA' || currentStore.category === 'PIZZA';
  const isRetail =
    template === 'RETAIL_EMPORIO' ||
    isRetailCategory(currentStore.category) ||
    (isMulti && customSections?.cardDensity === 'COMPACT');

  let displayedItems = segmentItems;
  if (activeTab === 'CARDAPIO') {
    displayedItems = selectedCategory === 'Todos' ? segmentItems : segmentItems.filter(i => i.category === selectedCategory);
  } else if (activeTab === 'PROMOCOES') {
    displayedItems = visibleItems.filter(
      i => (i.category && /promo|combo/i.test(i.category)) || (i.description && /desconto|promo/i.test(i.description))
    );
  }

  return (
    <div className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 space-y-6 p-6 shadow-2xl animate-fadeIn">
      <MerchantVitrineHero
        currentStore={currentStore}
        primaryColor={primaryColor}
        template={template}
        announcement={announcement}
        tagline={tagline}
      />

      <MerchantVitrineNavTabs
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        primaryColor={primaryColor}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        allowedTabs={allowedTabs}
        isServiceStore={isServiceStore}
        isRetail={isRetail}
      />

      {isMulti && activeTab === 'CARDAPIO' && (
        <div className="p-3.5 rounded-2xl bg-slate-950 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-black uppercase text-indigo-300 tracking-wider">
            {customSections?.title || 'Preview Multivendas 360°'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'ALL' as const, label: 'Tudo', enabled: true },
              { id: 'FOOD' as const, label: '🍔 Comidas', enabled: customSections?.showFoodSection !== false },
              { id: 'RETAIL' as const, label: '🛍️ Varejo & Tech', enabled: customSections?.showRetailSection !== false },
              { id: 'SERVICE' as const, label: '✂️ Serviços', enabled: customSections?.showServicesSection !== false },
            ]
              .filter(s => s.enabled)
              .map(seg => (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => {
                    setSegmentFilter(seg.id);
                    setSelectedCategory('Todos');
                  }}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                    segmentFilter === seg.id
                      ? 'text-slate-950'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                  style={segmentFilter === seg.id ? { backgroundColor: primaryColor } : undefined}
                >
                  {seg.label}
                </button>
              ))}
          </div>
        </div>
      )}

      {(activeTab === 'CARDAPIO' || activeTab === 'PROMOCOES') && (
        <div
          className={`grid gap-4 ${
            isRetail
              ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
              : isPizza
              ? 'grid-cols-1 md:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {displayedItems.map(item => {
            const itemIsService = isItemService(item, currentStore) || isServiceStore;
            return (
              <div
                key={item.id}
                className="bg-slate-950 rounded-2xl overflow-hidden border border-slate-800/80 flex flex-col justify-between transition-all hover:border-slate-700"
              >
                <div className={`relative ${isPizza ? 'h-32' : 'h-40'} overflow-hidden bg-slate-900`}>
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 bg-slate-950/80 px-2 py-0.5 rounded text-[9px] font-black uppercase text-white">
                    {item.category || 'Geral'}
                  </div>
                  {itemIsService && item.specs?.durationMinutes && (
                    <div className="absolute top-2 right-2 bg-indigo-500/90 px-2 py-0.5 rounded text-[9px] font-black uppercase text-white">
                      {item.specs.durationMinutes} min
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <h4 className="font-black text-sm text-white tracking-tight">{item.name}</h4>
                  <p className="text-[10px] text-slate-400 line-clamp-2">{item.description}</p>
                  <div className="flex items-center justify-between pt-2">
                    <span className="font-mono font-black text-white">R$ {item.price.toFixed(2)}</span>
                    {itemIsService ? (
                      <button
                        onClick={() => {
                          setActiveTab('RESERVAS');
                          showNotification(`Preview: cliente direcionado à agenda para "${item.name}".`);
                        }}
                        className="px-3 py-1.5 rounded-lg text-slate-950 text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <Calendar className="w-3.5 h-3.5" /> Agendar
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          addToCart(item);
                          showNotification('Item adicionado no modo Preview.');
                        }}
                        className="p-2 rounded-lg text-slate-950 cursor-pointer"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'AUTOATENDIMENTO' && (
        <div className="bg-slate-950 p-10 rounded-3xl border border-slate-800 text-center space-y-4">
          <QrCode className="w-16 h-16 mx-auto text-amber-500 opacity-50" />
          <h3 className="text-xl font-black text-white uppercase italic">Modo Autoatendimento (Preview)</h3>
          <p className="text-xs text-slate-400">
            O consumidor verá aqui o seletor de mesa e o QR Code dinâmico para realizar pedidos sem garçom.
          </p>
        </div>
      )}

      {activeTab === 'RESERVAS' && (
        <div className="bg-slate-950 p-10 rounded-3xl border border-slate-800 text-center space-y-4">
          <Calendar className="w-16 h-16 mx-auto text-emerald-500 opacity-50" />
          <h3 className="text-xl font-black text-white uppercase italic">
            {isServiceStore ? 'Agendamento de Horários (Preview)' : 'Módulo de Reservas (Preview)'}
          </h3>
          <p className="text-xs text-slate-400">
            Formulário de agendamento de data e horário sincronizado com o calendário do lojista.
          </p>
        </div>
      )}

      {activeTab === 'SOBRE' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
            <div className="font-bold text-amber-500 uppercase flex items-center gap-2">
              <MapPin className="w-3 h-3" /> Endereço
            </div>
            <div className="text-slate-300">{currentStore.address}</div>
          </div>
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
            <div className="font-bold text-emerald-500 uppercase flex items-center gap-2">
              <Phone className="w-3 h-3" /> Contato
            </div>
            <div className="text-slate-300">{currentStore.phone}</div>
          </div>
        </div>
      )}
    </div>
  );
};
