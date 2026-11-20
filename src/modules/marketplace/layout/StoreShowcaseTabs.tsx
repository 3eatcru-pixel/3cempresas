import React from 'react';
import { Store } from '../../../types';
import { getAllowedShowcaseTabs, isDiningCategory, isMultiCommerceStore, isServiceCategory, ShowcaseTabId } from '../../../utils/storeDomain';

interface StoreShowcaseTabsProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  currentTable: number;
  storeCategory: string;
  store?: Store;
  isLightMode: boolean;
  primaryColor: string;
  displayedItemsCount: number;
}

export const StoreShowcaseTabs: React.FC<StoreShowcaseTabsProps> = ({
  activeTab,
  setActiveTab,
  currentTable,
  storeCategory,
  store,
  isLightMode,
  primaryColor,
  displayedItemsCount
}) => {
  const isDining = isDiningCategory(storeCategory);
  const isServices = isServiceCategory(storeCategory);
  const isMulti = isMultiCommerceStore(store) || storeCategory === 'MULTI_COMMERCE';

  const allowedIds: ShowcaseTabId[] = store
    ? getAllowedShowcaseTabs(store)
    : isServices
    ? ['CARDAPIO', 'PROMOCOES', 'RESERVAS', 'SOBRE']
    : isDining
    ? ['CARDAPIO', 'PROMOCOES', 'DESTAQUES', 'AUTOATENDIMENTO', 'RESERVAS', 'SOBRE']
    : ['CARDAPIO', 'PROMOCOES', 'DESTAQUES', 'SOBRE'];

  const allTabs: { id: ShowcaseTabId; label: string }[] = [
    {
      id: 'CARDAPIO',
      label: isMulti ? 'Catálogo 360°' : isServices ? 'Serviços & Pacotes' : isDining ? 'Cardápio Completo' : 'Catálogo Completo'
    },
    {
      id: 'AUTOATENDIMENTO',
      label: `🍽️ Mesa ${String(currentTable).padStart(2, '0')}`
    },
    {
      id: 'RESERVAS',
      label: isMulti ? '📅 Agendar / Reservar' : isServices ? '📅 Agendar Horário' : '📅 Reservar Mesa'
    },
    {
      id: 'PROMOCOES',
      label: isServices ? 'Pacotes Especiais' : 'Promoções & Ofertas'
    },
    {
      id: 'DESTAQUES',
      label: isDining ? 'Mais Pedidos' : 'Mais Vendidos'
    },
    {
      id: 'SOBRE',
      label: 'Sobre & Redes'
    }
  ];

  const tabs = allTabs.filter(t => allowedIds.includes(t.id));

  return (
    <div className={`flex items-center justify-between border-b pb-4 gap-4 overflow-x-auto no-scrollbar ${isLightMode ? 'border-stone-200' : 'border-slate-800'}`}>
      <div className="flex items-center gap-2">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.id 
                ? 'text-white shadow-lg' 
                : isLightMode ? 'text-stone-500 hover:text-stone-900 hover:bg-stone-100' : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
            style={activeTab === tab.id ? { backgroundColor: primaryColor } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <span className="text-[11px] font-mono font-bold opacity-60 hidden sm:inline">
        {displayedItemsCount} {isServices ? 'serviços disponíveis' : 'itens disponíveis'}
      </span>
    </div>
  );
};
