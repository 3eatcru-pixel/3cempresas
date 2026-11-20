import React from 'react';
import { ShowcaseTabId } from '../../../utils/storeDomain';

export type VitrineTabId = 'CARDAPIO' | 'AUTOATENDIMENTO' | 'RESERVAS' | 'PROMOCOES' | 'SOBRE';

interface MerchantVitrineNavTabsProps {
  activeTab: VitrineTabId;
  onSelectTab: (tab: VitrineTabId) => void;
  primaryColor: string;
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  allowedTabs?: ShowcaseTabId[];
  isServiceStore?: boolean;
  isRetail?: boolean;
}

export const MerchantVitrineNavTabs: React.FC<MerchantVitrineNavTabsProps> = ({
  activeTab,
  onSelectTab,
  primaryColor,
  categories,
  selectedCategory,
  onSelectCategory,
  allowedTabs,
  isServiceStore,
  isRetail,
}) => {
  const allTabs: { id: VitrineTabId; label: string }[] = [
    { id: 'CARDAPIO', label: isServiceStore ? 'Serviços' : isRetail ? 'Catálogo' : 'Cardápio' },
    { id: 'AUTOATENDIMENTO', label: '🍽️ Mesa' },
    { id: 'RESERVAS', label: isServiceStore ? '📅 Agenda' : '📅 Reservas' },
    { id: 'PROMOCOES', label: '🏷️ Promos' },
    { id: 'SOBRE', label: 'Sobre' },
  ];

  const visibleTabs = allowedTabs
    ? allTabs.filter(t => allowedTabs.includes(t.id))
    : allTabs;

  return (
    <div className="space-y-4">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-4 overflow-x-auto no-scrollbar">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id as VitrineTabId)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'text-white shadow-lg shadow-amber-500/10'
                : 'bg-slate-950 text-slate-500 border border-slate-800 hover:text-white'
            }`}
            style={{ backgroundColor: activeTab === tab.id ? primaryColor : undefined }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Category Pills */}
      {activeTab === 'CARDAPIO' && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'text-white shadow-md'
                  : 'bg-slate-950 text-slate-500 border border-slate-800 hover:border-slate-700'
              }`}
              style={{
                backgroundColor: selectedCategory === cat ? primaryColor : undefined,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
