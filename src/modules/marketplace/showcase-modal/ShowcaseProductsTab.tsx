import React from 'react';
import { MenuItem } from '../../../types';
import { ShoppingBag, Calendar } from 'lucide-react';

interface ShowcaseProductsTabProps {
  categories: string[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  filteredItems: MenuItem[];
  onAddToCart: (item: MenuItem) => void;
  showNotification: (msg: string) => void;
  isServiceStore?: boolean;
  isStoreClosed?: boolean;
  onScheduleService?: (item: MenuItem) => void;
}

export const ShowcaseProductsTab: React.FC<ShowcaseProductsTabProps> = ({
  categories,
  selectedCategory,
  setSelectedCategory,
  filteredItems,
  onAddToCart,
  showNotification,
  isServiceStore = false,
  isStoreClosed = false,
  onScheduleService,
}) => {
  return (
    <div className="space-y-4">
      {/* Category Pills */}
      {categories.length > 2 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-stone-900 text-white'
                  : 'bg-white text-stone-600 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="text-center py-12 text-stone-500 space-y-2">
          <ShoppingBag className="w-10 h-10 mx-auto text-stone-400" />
          <p className="text-xs font-semibold">
            {isServiceStore ? 'Nenhum serviço cadastrado nesta categoria.' : 'Nenhum produto cadastrado nesta categoria.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => {
            const isServiceItem = isServiceStore || item.specs?.segment === 'SERVICE';
            return (
              <div 
                key={item.id}
                className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="relative h-36 bg-stone-100 overflow-hidden">
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-300" 
                  />
                  <span className="absolute top-2 left-2 bg-stone-900/80 backdrop-blur-sm text-stone-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                    {item.category || 'Item'}
                  </span>
                </div>

                <div className="p-3.5 space-y-1.5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="font-bold text-sm text-stone-900 line-clamp-1">{item.name}</div>
                    <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed">
                      {item.description || 'Produto selecionado com atendimento especializado.'}
                    </p>
                    {item.specs && (
                      <div className="pt-1 text-[10px] text-stone-600 flex flex-wrap items-center gap-x-1.5 leading-tight font-medium">
                        {item.specs.dimensions && (
                          <span className="text-amber-800 font-semibold">
                            {typeof item.specs.dimensions === 'string'
                              ? item.specs.dimensions
                              : `${item.specs.dimensions.widthCm || ''}×${item.specs.dimensions.heightCm || ''}×${item.specs.dimensions.depthCm || ''} cm`}
                          </span>
                        )}
                        {item.specs.material && <span>· {item.specs.material}</span>}
                        {item.specs.voltage && <span className="text-blue-800 font-semibold">{item.specs.voltage}</span>}
                        {item.specs.warrantyMonths && <span>· {item.specs.warrantyMonths}m garantia</span>}
                        {item.specs.durationMinutes && <span className="text-purple-800 font-semibold">{item.specs.durationMinutes} min</span>}
                        {item.specs.professionalName && <span>· {item.specs.professionalName}</span>}
                        {item.specs.sizes && item.specs.sizes.length > 0 && <span>· Tam: {item.specs.sizes.join('/')}</span>}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 space-y-2 border-t border-stone-100">
                    <div className="font-black text-stone-900 text-base font-mono">
                      R$ {item.price.toFixed(2).replace('.', ',')}
                    </div>

                    {isServiceItem && onScheduleService ? (
                      <button
                        type="button"
                        onClick={() => onScheduleService(item)}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow transition-all active:scale-95 cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5" /> Agendar Horário
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isStoreClosed || item.stock <= 0}
                        onClick={() => {
                          if (isStoreClosed) {
                            showNotification('Estabelecimento fechado no momento. Novos pedidos estão bloqueados.');
                            return;
                          }
                          onAddToCart(item);
                        }}
                        className={`w-full py-2 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow transition-all ${
                          isStoreClosed || item.stock <= 0
                            ? 'bg-stone-300 text-stone-600 cursor-not-allowed'
                            : 'bg-orange-500 hover:bg-orange-600 text-white active:scale-95 cursor-pointer'
                        }`}
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        {isStoreClosed ? 'Loja Fechada' : item.stock <= 0 ? 'Indisponível' : 'Adicionar à Sacola'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
