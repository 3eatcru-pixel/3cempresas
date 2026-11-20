import React, { useState } from 'react';
import { Plus, Package } from 'lucide-react';
import { MenuItem } from '../../../types';

interface StoreShowcaseItemCardProps {
  item: MenuItem;
  onOpenModal: (item: MenuItem) => void;
  onDirectAdd: (e: React.MouseEvent, item: MenuItem) => void;
  isLightMode: boolean;
  primaryColor: string;
  isStoreClosed?: boolean;
  layout: {
    isPizza?: boolean;
    isRetail?: boolean;
    isSushi?: boolean;
    isCafe?: boolean;
    isBurger?: boolean;
    isFurniture?: boolean;
    isTech?: boolean;
    isFashion?: boolean;
    isService?: boolean;
  };
}

export const StoreShowcaseItemCard: React.FC<StoreShowcaseItemCardProps> = ({
  item,
  onOpenModal,
  onDirectAdd,
  isLightMode,
  primaryColor,
  isStoreClosed = false,
  layout
}) => {
  const { isPizza, isRetail, isSushi, isCafe, isFurniture, isTech, isService } = layout;
  const isActionBlocked = item.stock <= 0 || (!isService && isStoreClosed);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div 
      onClick={() => onOpenModal(item)}
      className={`
        rounded-2xl border overflow-hidden flex transition-all cursor-pointer group shadow-sm hover:shadow-xl
        ${isLightMode ? 'bg-white border-stone-200 hover:border-stone-400' : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 hover:border-slate-700'}
        ${isPizza ? 'flex-row items-center p-4 gap-6' : 'flex-col'}
        ${isRetail ? 'p-3 flex-col justify-between text-center' : ''}
        ${isSushi ? 'border-l-4 border-l-emerald-500' : ''}
        ${isFurniture ? 'border-amber-600/20 hover:border-amber-500/40' : ''}
        ${isTech ? 'border-blue-600/20 hover:border-blue-500/40' : ''}
        ${isCafe ? 'rounded-[2rem]' : ''}
      `}
    >
      {/* Product Image Section */}
      <div className={`
        relative overflow-hidden shrink-0
        ${isPizza ? 'w-24 h-24 sm:w-32 sm:h-32 rounded-3xl shadow-lg border border-stone-100' : 'h-52 sm:h-56'}
        ${isRetail ? 'h-32 rounded-xl mb-3' : ''}
        ${isCafe ? 'h-44 rounded-[1.5rem]' : ''}
      `}>
        {item.image && !imgFailed ? (
          <img
            src={item.image}
            alt={item.name}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${isLightMode ? 'bg-stone-100 text-stone-400' : 'bg-slate-950 text-slate-600'}`}>
            <Package className="w-8 h-8" />
          </div>
        )}
        
        {/* Contextual Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg backdrop-blur-xl border ${isLightMode ? 'bg-stone-900/90 text-white border-stone-700' : 'bg-slate-950/90 text-slate-200 border-slate-800'}`}>
            {item.category || 'Geral'}
          </span>
          {item.stock < (item.minStockAlert || 5) && item.stock > 0 && (
            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 shadow-lg">
              Últimas Unidades
            </span>
          )}
          {item.stock <= 0 && (
            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-rose-600 text-white shadow-lg">
              Indisponível
            </span>
          )}
        </div>
      </div>

      {/* Product Information */}
      <div className={`
        flex-1 flex flex-col justify-between
        ${isPizza ? 'gap-1.5 py-1' : 'p-5 gap-4'}
        ${isRetail ? 'p-2 gap-2 items-center' : ''}
      `}>
        <div className="space-y-1.5">
          <div className={`flex justify-between items-start gap-3 ${isRetail ? 'flex-col items-center gap-1' : ''}`}>
            <h4 className={`font-black uppercase tracking-tighter leading-tight ${isLightMode ? 'text-stone-900' : 'text-white'} ${isRetail ? 'text-xs' : 'text-lg'}`}>
              {item.name}
            </h4>
            <div className="flex flex-col items-end">
              <span className={`font-mono tabular-nums font-black ${isRetail ? 'text-xs' : 'text-lg'}`} style={{ color: primaryColor }}>
                R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {!isRetail && item.description && (
            <p className={`text-[11px] font-medium leading-relaxed opacity-70 line-clamp-2 ${isLightMode ? 'text-stone-600' : 'text-slate-400'}`}>
              {item.description}
            </p>
          )}

          {/* Structured Niche Specs - Unboxed Typography */}
          {item.specs && (
            <div className={`pt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold tracking-tight ${isLightMode ? 'text-stone-500' : 'text-slate-400'}`}>
              {item.specs.dimensions && (
                <span className="text-amber-600 dark:text-amber-400">
                  {typeof item.specs.dimensions === 'string'
                    ? item.specs.dimensions
                    : `${item.specs.dimensions.widthCm || ''}×${item.specs.dimensions.heightCm || ''}×${item.specs.dimensions.depthCm || ''} cm`}
                </span>
              )}
              {item.specs.material && <span className="opacity-50">/</span>}
              {item.specs.material && <span>{item.specs.material}</span>}
              
              {item.specs.voltage && <span className="opacity-50">/</span>}
              {item.specs.voltage && <span className="text-cyan-500">{item.specs.voltage}</span>}
              
              {item.specs.warrantyMonths && <span className="opacity-50">/</span>}
              {item.specs.warrantyMonths && <span>{item.specs.warrantyMonths}m Garantia</span>}
              
              {item.specs.durationMinutes && <span className="opacity-50">/</span>}
              {item.specs.durationMinutes && <span className="text-indigo-500">{item.specs.durationMinutes} min</span>}
              
              {item.specs.professionalName && <span className="opacity-50">/</span>}
              {item.specs.professionalName && <span>{item.specs.professionalName}</span>}
            </div>
          )}

        </div>

        {/* Footer Interaction Bar */}
        <div className={`flex items-center justify-between pt-3 border-t ${isLightMode ? 'border-stone-100' : 'border-slate-800/60'}`}>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              {isService ? 'Disponibilidade' : 'Logística'}
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {isService 
                ? (item.specs?.serviceLocation || 'No Local') 
                : isFurniture 
                ? 'Frete Especial' 
                : item.prepTimeMin ? `${item.prepTimeMin} min` : 'Envio Imediato'}
            </span>
          </div>
          <button
            onClick={(e) => onDirectAdd(e, item)}
            disabled={isActionBlocked}
            className={`
              px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-tighter flex items-center gap-2 shadow-lg transition-all active:scale-95 text-slate-950
              ${isActionBlocked ? 'opacity-40 cursor-not-allowed grayscale' : 'cursor-pointer hover:brightness-110 hover:-translate-y-0.5'}
            `}
            style={{ backgroundColor: primaryColor }}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={4} />
            {!isService && isStoreClosed
              ? 'Fechada'
              : isService
              ? 'Agendar'
              : isRetail
              ? 'Adicionar'
              : isFurniture || isTech
              ? 'Comprar'
              : 'Pedir'}
          </button>
        </div>
      </div>
    </div>
  );
};

