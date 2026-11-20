import React from 'react';
import { Ruler, Box, Zap, Shield, Hash, Clock, User, Layers, Palette, Info } from 'lucide-react';
import { MenuItem } from '../../../types';

interface ItemSpecsGridProps {
  specs: NonNullable<MenuItem['specs']>;
}

export const ItemSpecsGrid: React.FC<ItemSpecsGridProps> = ({ specs }) => {
  return (
    <div className="bg-stone-900/40 border border-stone-800/60 rounded-[1.5rem] p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-orange-400" />
        <span className="text-[11px] font-black uppercase text-stone-300 tracking-widest">
          Ficha Técnica & Detalhes
        </span>
      </div>

      <div className="grid grid-cols-2 gap-y-5 gap-x-8">
        {specs.dimensions && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-stone-500">
              <Ruler className="w-3 h-3" />
              <span className="text-[10px] font-black uppercase tracking-tighter">Dimensões</span>
            </div>
            <span className="text-xs font-bold text-white block">
              {typeof specs.dimensions === 'string'
                ? specs.dimensions
                : `${specs.dimensions.widthCm || ''}×${specs.dimensions.heightCm || ''}×${specs.dimensions.depthCm || ''} cm`}
            </span>
          </div>
        )}
        {specs.material && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-stone-500">
              <Box className="w-3 h-3" />
              <span className="text-[10px] font-black uppercase tracking-tighter">Material</span>
            </div>
            <span className="text-xs font-bold text-white block">{specs.material}</span>
          </div>
        )}
        {specs.voltage && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-stone-500">
              <Zap className="w-3 h-3" />
              <span className="text-[10px] font-black uppercase tracking-tighter">Voltagem</span>
            </div>
            <span className="text-xs font-bold text-white block">{specs.voltage}</span>
          </div>
        )}
        {specs.warrantyMonths && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-stone-500">
              <Shield className="w-3 h-3" />
              <span className="text-[10px] font-black uppercase tracking-tighter">Garantia</span>
            </div>
            <span className="text-xs font-bold text-white block">{specs.warrantyMonths} meses</span>
          </div>
        )}
        {specs.durationMinutes && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-stone-500">
              <Clock className="w-3 h-3" />
              <span className="text-[10px] font-black uppercase tracking-tighter">Duração</span>
            </div>
            <span className="text-xs font-bold text-white block">{specs.durationMinutes} min</span>
          </div>
        )}
        {specs.professionalName && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-stone-500">
              <User className="w-3 h-3" />
              <span className="text-[10px] font-black uppercase tracking-tighter">Expert</span>
            </div>
            <span className="text-xs font-bold text-white block">{specs.professionalName}</span>
          </div>
        )}
        {specs.sizes && specs.sizes.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-stone-500">
              <Layers className="w-3 h-3" />
              <span className="text-[10px] font-black uppercase tracking-tighter">Tamanhos</span>
            </div>
            <span className="text-xs font-bold text-white block">{specs.sizes.join(', ')}</span>
          </div>
        )}
        {specs.colors && specs.colors.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-stone-500">
              <Palette className="w-3 h-3" />
              <span className="text-[10px] font-black uppercase tracking-tighter">Cores</span>
            </div>
            <span className="text-xs font-bold text-white block">{specs.colors.join(', ')}</span>
          </div>
        )}
      </div>

      {specs.technicalSpecs && (
        <div className="pt-4 border-t border-stone-800/80">
          <div className="flex items-center gap-1.5 text-stone-500 mb-1.5">
            <Hash className="w-3 h-3" />
            <span className="text-[10px] font-black uppercase tracking-tighter">Especificações Adicionais</span>
          </div>
          <p className="text-stone-300 text-[11px] leading-relaxed font-mono bg-stone-950/50 p-3 rounded-xl border border-stone-800/40">
            {specs.technicalSpecs}
          </p>
        </div>
      )}
    </div>
  );
};
