import React from 'react';
import { Tag, Edit3, Sparkles, Armchair, Cpu, Scissors, Shirt, ShoppingBag, Utensils } from 'lucide-react';
import { COMMERCE_SEGMENT_COLORS, PILLAR_THEMES } from '@3c/design-system';
import { MenuItem, ProductSpecifications } from '../../../../types';
import { CatalogSegmentSpecsFields } from './CatalogSegmentSpecsFields';

interface CatalogItemInfoFieldsProps {
  newItem: Partial<MenuItem>;
  setNewItem: React.Dispatch<React.SetStateAction<Partial<MenuItem>>>;
  onAiDescribe: () => void;
  isAiLoading: boolean;
}

const SEGMENT_OPTIONS: Array<{
  id: NonNullable<ProductSpecifications['segment']>;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'FOOD', label: 'Comida', icon: Utensils },
  { id: 'FURNITURE', label: 'Móveis', icon: Armchair },
  { id: 'ELECTRONICS', label: 'Tech & Eletro', icon: Cpu },
  { id: 'FASHION', label: 'Moda', icon: Shirt },
  { id: 'SERVICE', label: 'Serviço', icon: Scissors },
  { id: 'RETAIL_GENERAL', label: 'Varejo', icon: ShoppingBag },
];

export const CatalogItemInfoFields: React.FC<CatalogItemInfoFieldsProps> = ({
  newItem,
  setNewItem,
  onAiDescribe,
  isAiLoading,
}) => {
  const currentSegment = (newItem.specs?.segment || 'FOOD') as NonNullable<ProductSpecifications['segment']>;
  const storeOsTheme = PILLAR_THEMES['store-os'];
  const activeSegToken = COMMERCE_SEGMENT_COLORS[currentSegment] || COMMERCE_SEGMENT_COLORS.FOOD;

  const updateSpecs = (partial: Partial<ProductSpecifications>) => {
    setNewItem(prev => ({
      ...prev,
      specs: {
        ...(prev.specs || {}),
        ...partial,
      }
    }));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-between">
          <span>Tipo de Comércio / Segmento</span>
          <span className={`text-[9px] ${storeOsTheme.accentTextClass} font-mono font-normal`}>Adapta campos automaticamente</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
          {SEGMENT_OPTIONS.map(s => {
            const Icon = s.icon;
            const isSelected = currentSegment === s.id;
            const segColor = COMMERCE_SEGMENT_COLORS[s.id];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => updateSpecs({ segment: s.id })}
                className={`py-2 px-2 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? `${segColor.badgeClass} shadow-md font-black`
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
          <Tag className={`w-3 h-3 ${activeSegToken.textClass}`} /> Nome do Item / Produto / Serviço
        </label>
        <input
          type="text"
          required
          value={newItem.name || ''}
          onChange={e => setNewItem({ ...newItem, name: e.target.value })}
          placeholder={
            currentSegment === 'FURNITURE' ? 'Ex: Sofá 3 Lugares em Linho Cru' :
            currentSegment === 'ELECTRONICS' ? 'Ex: Notebook Ultra 15.6" 16GB 512GB' :
            currentSegment === 'SERVICE' ? 'Ex: Corte Masculino Premium + Barba' :
            currentSegment === 'FASHION' ? 'Ex: Camiseta Algodão Egípcio Minimal' :
            currentSegment === 'RETAIL_GENERAL' ? 'Ex: Vinho Tinto Reserva 750ml' :
            'Ex: Smash Burger Trufado Angus'
          }
          className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 font-bold uppercase">Categoria Interna</label>
          <input
            type="text"
            value={newItem.category || ''}
            onChange={e => setNewItem({ ...newItem, category: e.target.value })}
            placeholder={
              currentSegment === 'FURNITURE' ? 'Ex: Salas de Estar' :
              currentSegment === 'ELECTRONICS' ? 'Ex: Informática' :
              currentSegment === 'SERVICE' ? 'Ex: Cabelo & Estética' :
              'Ex: Principais'
            }
            className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 font-bold uppercase">Código SKU / Referência</label>
          <input
            type="text"
            value={newItem.sku || ''}
            onChange={e => setNewItem({ ...newItem, sku: e.target.value })}
            placeholder="Ex: SKU-8801"
            className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>
      </div>

      <CatalogSegmentSpecsFields
        segment={currentSegment}
        newItem={newItem}
        setNewItem={setNewItem}
        onUpdateSpecs={updateSpecs}
      />

      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
            <Edit3 className={`w-3 h-3 ${activeSegToken.textClass}`} /> Descrição Comercial
          </label>
          <button
            type="button"
            onClick={onAiDescribe}
            disabled={isAiLoading}
            className={`text-[9px] font-black ${storeOsTheme.badgeClass} px-2 py-0.5 rounded-full hover:opacity-90 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50`}
          >
            <Sparkles className={`w-2.5 h-2.5 ${isAiLoading ? 'animate-spin' : ''}`} />
            {isAiLoading ? 'Gemini Escrevendo...' : 'GERAR DESCRIÇÃO COM IA'}
          </button>
        </div>
        <textarea
          rows={3}
          value={newItem.description || ''}
          onChange={e => setNewItem({ ...newItem, description: e.target.value })}
          placeholder="Destaque as qualidades, diferenciais e apelo de venda para o cliente..."
          className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500 resize-none"
        />
      </div>
    </div>
  );
};
