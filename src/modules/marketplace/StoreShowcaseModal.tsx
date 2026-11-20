import React, { useState, useEffect } from 'react';
import { Store, MenuItem } from '../../types';
import { useConsumer } from '../../context/ConsumerContext';
import { useEcosystem } from '../../context/EcosystemContext';
import {
  getItemSegmentGroup,
  isMultiCommerceStore,
  isServiceCategory,
  storeSupportsTableService
} from '../../utils/storeDomain';

import { StoreShowcaseModalHeader } from './showcase-modal/StoreShowcaseModalHeader';
import { StoreShowcaseModalSubBar } from './showcase-modal/StoreShowcaseModalSubBar';
import { ShowcaseProductsTab } from './showcase-modal/ShowcaseProductsTab';
import { ShowcaseInfoTabs } from './showcase-modal/ShowcaseInfoTabs';
import { ShowcaseReservationsTab } from './showcase-modal/ShowcaseReservationsTab';
import { ShowcaseSelfServiceTab } from './showcase-modal/ShowcaseSelfServiceTab';
import { ShowcaseModalFooter } from './showcase-modal/ShowcaseModalFooter';

type ModalTab = 'Produtos' | 'Autoatendimento' | 'Sobre' | 'Avaliações' | 'Contato' | 'Reservas';

interface StoreShowcaseModalProps {
  store: Store | null;
  onClose: () => void;
  menuItems: MenuItem[];
  onAddToCart: (item: MenuItem) => void;
  onOpenCheckout: () => void;
  onOpenFullShowcase?: (slug: string) => void;
  tableNumber?: number;
  setTableNumber?: (t: number) => void;
  onActivateTableModality?: () => void;
}

export const StoreShowcaseModal: React.FC<StoreShowcaseModalProps> = ({
  store,
  onClose,
  menuItems,
  onAddToCart,
  onOpenCheckout,
  onOpenFullShowcase,
  tableNumber,
  setTableNumber,
  onActivateTableModality,
}) => {
  const { consumer, toggleFavoriteStore } = useConsumer();
  const { showNotification, addReservation } = useEcosystem();
  const [activeTab, setActiveTab] = useState<ModalTab>('Produtos');
  const [internalModalTable, setInternalModalTable] = useState<number>(4);
  const modalTable = tableNumber ?? internalModalTable;
  const setModalTable = setTableNumber ?? setInternalModalTable;
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [segmentFilter, setSegmentFilter] = useState<'ALL' | 'FOOD' | 'RETAIL' | 'SERVICE'>('ALL');
  const [selectedServiceItem, setSelectedServiceItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    setActiveTab('Produtos');
    setSelectedCategory('Todos');
    setSegmentFilter('ALL');
    setSelectedServiceItem(null);
  }, [store?.id]);

  if (!store) return null;

  const isService = isServiceCategory(store.category);
  const supportsTable = storeSupportsTableService(store);
  const isMulti = isMultiCommerceStore(store);
  const customSections = store.showcaseTemplate?.customSections;
  const canReserve = isService || supportsTable || (isMulti && customSections?.showServicesSection !== false);

  const rawStoreItems = menuItems.filter(m => m.storeId === store.id);
  const storeItems = isMulti
    ? rawStoreItems.filter(item => {
        const grp = getItemSegmentGroup(item, store);
        if (grp === 'FOOD' && customSections?.showFoodSection === false) return false;
        if (grp === 'RETAIL' && customSections?.showRetailSection === false) return false;
        if (grp === 'SERVICE' && customSections?.showServicesSection === false) return false;
        return true;
      })
    : rawStoreItems;

  const allowedTabs: { id: ModalTab; label: string }[] = [
    { id: 'Produtos', label: isMulti ? `Catálogo (${storeItems.length})` : isService ? `Serviços (${storeItems.length})` : `Produtos (${storeItems.length})` },
    ...(canReserve ? [{ id: 'Reservas' as ModalTab, label: isMulti ? 'Agendamentos / Mesas' : isService ? 'Agendamentos' : 'Reservas' }] : []),
    ...(supportsTable ? [{ id: 'Autoatendimento' as ModalTab, label: `🍽️ Autoatendimento (Mesa ${modalTable})` }] : []),
    { id: 'Sobre', label: 'Sobre' },
    { id: 'Avaliações', label: 'Avaliações' },
    { id: 'Contato', label: 'Contato' },
  ];

  const isFavorite = consumer.favoriteStoreIds.includes(store.id);

  const segmentScopedItems =
    isMulti && segmentFilter !== 'ALL'
      ? storeItems.filter(item => getItemSegmentGroup(item, store) === segmentFilter)
      : storeItems;

  const categories = ['Todos', ...Array.from(new Set(segmentScopedItems.map(i => i.category || 'Geral')))];
  const filteredItems = selectedCategory === 'Todos'
    ? segmentScopedItems
    : segmentScopedItems.filter(i => (i.category || 'Geral') === selectedCategory);

  const getNicheSubtitle = () => {
    switch (store.category) {
      case 'MULTI_COMMERCE': return 'Multivendas 360° • Gastronomia, Varejo, Tech & Serviços';
      case 'PIZZA': return 'Pizzaria & Forno a Lenha • Massas & Bebidas';
      case 'BURGER': return 'Hamburgueria Artesanal • Blends & Porções';
      case 'RETAIL': return 'Empório & Conveniência • Varejo por SKU';
      case 'JAPANESE': return 'Culinária Japonesa & Oriental • Sushis & Barcas';
      case 'FURNITURE': return 'Móveis & Design de Interiores • Ambientes & Decoração';
      case 'ELECTRONICS': return 'Eletrônicos & Informática • Hardware, Áudio & Tech';
      case 'FASHION': return 'Moda, Vestuário & Boutique • Coleções Exclusivas';
      case 'SERVICES': return 'Serviços Especializados • Atendimento & Agendamentos';
      case 'HEALTH': return 'Saúde & Farmácia • Cuidados & Bem-Estar';
      case 'BEAUTY': return 'Estética & Cuidados • Agendamentos & Procedimentos';
      default: return `${store.category || 'Comércio'} • Atendimento & Vendas`;
    }
  };

  const templateTagline = store.showcaseTemplate?.tagline || 'Excelência em atendimento e produtos de qualidade selecionada.';
  const primaryColor = store.showcaseTemplate?.primaryColor || '#f97316';
  const totalReviews = store.totalOrders ? Math.max(12, Math.floor(store.totalOrders * 0.4)) : 48;
  const isStoreClosed = store.isOpen === false;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#121316] border border-stone-800 w-full max-w-4xl rounded-3xl overflow-hidden max-h-[92vh] flex flex-col justify-between shadow-2xl animate-scaleIn text-stone-900 font-sans">
        
        {/* Header */}
        <StoreShowcaseModalHeader
          store={store}
          onClose={onClose}
          primaryColor={primaryColor}
          getNicheSubtitle={getNicheSubtitle}
          totalReviews={totalReviews}
          templateTagline={templateTagline}
        />

        {/* Info Sub-bar */}
        <StoreShowcaseModalSubBar
          store={store}
          onClose={onClose}
          onOpenFullShowcase={onOpenFullShowcase}
          isFavorite={isFavorite}
          toggleFavoriteStore={toggleFavoriteStore}
          showNotification={showNotification}
        />

        {/* Tab Selector (Strictly scoped by vertical) */}
        <div className="bg-[#fff8f0] px-5 pt-4 pb-2 border-b border-stone-200 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          {allowedTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-orange-500 text-white shadow-md' 
                  : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Store Body with Functional Tabs */}
        <div className="bg-[#fff8f0] p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {isStoreClosed && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-medium flex items-center justify-between gap-2">
              <span>
                <strong className="uppercase font-black text-rose-700">Estabelecimento fechado:</strong>{' '}
                novos pedidos são recusados automaticamente até a reabertura.
              </span>
            </div>
          )}
          {activeTab === 'Reservas' && canReserve && (
            <ShowcaseReservationsTab
              store={store}
              consumer={consumer}
              selectedServiceItem={selectedServiceItem}
              onClearSelectedService={() => setSelectedServiceItem(null)}
              onSubmitReservation={addReservation}
              onSuccess={() => {
                setSelectedServiceItem(null);
                setActiveTab('Produtos');
              }}
              showNotification={showNotification}
            />
          )}

          {activeTab === 'Produtos' && (
            <>
              {isMulti && (
                <div className="bg-white p-3 rounded-2xl border border-stone-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase text-stone-700">
                    {customSections?.title || 'Filtrar por frente Multivendas'}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
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
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            segmentFilter === seg.id
                              ? 'bg-orange-500 text-white'
                              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          {seg.label}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <ShowcaseProductsTab
                categories={categories}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                filteredItems={filteredItems}
                onAddToCart={onAddToCart}
                showNotification={showNotification}
                isServiceStore={isService}
                isStoreClosed={isStoreClosed}
                onScheduleService={(item) => {
                  setSelectedServiceItem(item);
                  setActiveTab('Reservas');
                }}
              />
            </>
          )}

          {activeTab === 'Autoatendimento' && supportsTable && (
            <ShowcaseSelfServiceTab
              store={store}
              modalTable={modalTable}
              setModalTable={(t) => {
                setModalTable(t);
                onActivateTableModality?.();
              }}
              onSelectTable={table => {
                setModalTable(table);
                onActivateTableModality?.();
                setActiveTab('Produtos');
                showNotification(`Mesa ${table} selecionada! Adicione os itens à comanda.`);
              }}
            />
          )}

          {(activeTab === 'Sobre' || activeTab === 'Avaliações' || activeTab === 'Contato') && (
            <ShowcaseInfoTabs
              store={store}
              activeTab={activeTab}
              totalReviews={totalReviews}
            />
          )}
        </div>

        {/* Footer */}
        <ShowcaseModalFooter
          isServiceStore={isService}
          isStoreClosed={isStoreClosed}
          onSchedule={() => setActiveTab('Reservas')}
          onCheckout={() => {
            onClose();
            onOpenCheckout();
          }}
        />

      </div>
    </div>
  );
};
