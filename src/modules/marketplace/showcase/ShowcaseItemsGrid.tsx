import React from 'react';
import { Search, ArrowUpDown, X } from 'lucide-react';
import { Store, MenuItem } from '../../../types';
import { isItemService } from '../../../utils/storeDomain';
import { StoreShowcaseItemCard } from '../layout/StoreShowcaseItemCard';

interface ShowcaseItemsGridProps {
  store: Store;
  displayedItems: MenuItem[];
  showcaseSearch: string;
  setShowcaseSearch: (val: string) => void;
  showcaseSort: 'DEFAULT' | 'PRICE_ASC' | 'PRICE_DESC' | 'NAME';
  setShowcaseSort: (val: 'DEFAULT' | 'PRICE_ASC' | 'PRICE_DESC' | 'NAME') => void;
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
  isLightMode: boolean;
  primaryColor: string;
  isStoreClosed: boolean;
  layout: any;
  onOpenItemModal: (item: MenuItem) => void;
  onDirectAdd: (e: React.MouseEvent, item: MenuItem) => void;
  onSelectServiceItem: (item: MenuItem) => void;
}

export const ShowcaseItemsGrid: React.FC<ShowcaseItemsGridProps> = ({
  store,
  displayedItems,
  showcaseSearch,
  setShowcaseSearch,
  showcaseSort,
  setShowcaseSort,
  selectedCategory,
  setSelectedCategory,
  isLightMode,
  primaryColor,
  isStoreClosed,
  layout,
  onOpenItemModal,
  onDirectAdd,
  onSelectServiceItem,
}) => {
  return (
    <>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div
          className={`flex-1 flex items-center gap-2 px-3.5 py-2 rounded-2xl border transition-all ${
            isLightMode ? 'bg-white border-stone-200 text-stone-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}
        >
          <Search className="w-4 h-4 text-amber-500 shrink-0" />
          <input
            type="text"
            placeholder={`Buscar em ${store.name}...`}
            value={showcaseSearch}
            onChange={(e) => setShowcaseSearch(e.target.value)}
            className="bg-transparent text-xs focus:outline-none w-full font-medium placeholder-slate-500"
          />
          {showcaseSearch && (
            <button
              type="button"
              onClick={() => setShowcaseSearch('')}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div
          className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border shrink-0 ${
            isLightMode ? 'bg-white border-stone-200 text-stone-800' : 'bg-slate-900 border-slate-800 text-slate-200'
          }`}
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <select
            value={showcaseSort}
            onChange={(e) => setShowcaseSort(e.target.value as any)}
            className="bg-transparent text-[11px] font-bold focus:outline-none uppercase tracking-wider cursor-pointer"
          >
            <option value="DEFAULT" className="bg-slate-900 text-white">
              Ordenar: Padrão
            </option>
            <option value="PRICE_ASC" className="bg-slate-900 text-white">
              Menor Preço
            </option>
            <option value="PRICE_DESC" className="bg-slate-900 text-white">
              Maior Preço
            </option>
            <option value="NAME" className="bg-slate-900 text-white">
              Nome (A-Z)
            </option>
          </select>
        </div>
      </div>

      {displayedItems.length === 0 ? (
        <div
          className={`p-10 rounded-3xl border text-center space-y-3 ${
            isLightMode ? 'bg-white border-stone-200 text-stone-600' : 'bg-slate-900/60 border-slate-800 text-slate-400'
          }`}
        >
          <p className="text-xs font-bold">Nenhum item encontrado para o filtro atual.</p>
          {(showcaseSearch || selectedCategory !== 'Todos') && (
            <button
              type="button"
              onClick={() => {
                setShowcaseSearch('');
                setSelectedCategory('Todos');
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-xl cursor-pointer"
            >
              Limpar Busca da Vitrine
            </button>
          )}
        </div>
      ) : (
        <div
          className={`
            ${layout.isPizza ? 'space-y-4' : ''}
            ${layout.isRetail ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3' : ''}
            ${layout.isSushi ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5' : ''}
            ${layout.isCafe ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : ''}
            ${layout.isBurger ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : ''}
            ${layout.isFurniture ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6' : ''}
            ${layout.isTech ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5' : ''}
            ${layout.isService ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : ''}
            ${
              !layout.isPizza &&
              !layout.isRetail &&
              !layout.isSushi &&
              !layout.isCafe &&
              !layout.isBurger &&
              !layout.isFurniture &&
              !layout.isTech &&
              !layout.isService
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'
                : ''
            }
          `}
        >
          {displayedItems.map((item) => (
            <StoreShowcaseItemCard
              key={item.id}
              item={item}
              onOpenModal={(clickedItem) => {
                if (layout.isService || isItemService(clickedItem, store)) {
                  onSelectServiceItem(clickedItem);
                }
                onOpenItemModal(clickedItem);
              }}
              onDirectAdd={onDirectAdd}
              isLightMode={isLightMode}
              primaryColor={primaryColor}
              isStoreClosed={isStoreClosed}
              layout={{
                ...layout,
                isService: layout.isService || isItemService(item, store),
              }}
            />
          ))}
        </div>
      )}
    </>
  );
};
