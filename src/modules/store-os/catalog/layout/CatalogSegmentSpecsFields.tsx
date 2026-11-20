import React from 'react';
import { Armchair, Cpu, Scissors, Shield, Wrench, Zap, Calendar, Clock } from 'lucide-react';
import { COMMERCE_SEGMENT_COLORS } from '@3c/design-system';
import { MenuItem, ProductSpecifications } from '../../../../types';
import { CatalogFashionVariantsPanel } from './CatalogFashionVariantsPanel';

interface CatalogSegmentSpecsFieldsProps {
  segment: NonNullable<ProductSpecifications['segment']>;
  newItem: Partial<MenuItem>;
  setNewItem: React.Dispatch<React.SetStateAction<Partial<MenuItem>>>;
  onUpdateSpecs: (partial: Partial<ProductSpecifications>) => void;
}

export const CatalogSegmentSpecsFields: React.FC<CatalogSegmentSpecsFieldsProps> = ({
  segment,
  newItem,
  setNewItem,
  onUpdateSpecs,
}) => {
  const furnitureToken = COMMERCE_SEGMENT_COLORS.FURNITURE;
  const electronicsToken = COMMERCE_SEGMENT_COLORS.ELECTRONICS;
  const serviceToken = COMMERCE_SEGMENT_COLORS.SERVICE;
  const foodToken = COMMERCE_SEGMENT_COLORS.FOOD;

  if (segment === 'FURNITURE') {
    return (
      <div className={`bg-slate-950 p-3.5 rounded-2xl border ${furnitureToken.borderClass} space-y-3`}>
        <div className={`flex items-center gap-1.5 ${furnitureToken.textClass} text-[10px] font-black uppercase`}>
          <Armchair className="w-3.5 h-3.5" /> Especificações de Móveis & Entrega
        </div>
        <div className="space-y-1">
          <label className="text-[9px] text-slate-500 font-bold uppercase">Dimensões AxLxP (cm)</label>
          <input
            type="text"
            placeholder="Ex: 220 x 95 x 88 cm"
            value={
              typeof newItem.specs?.dimensions === 'string'
                ? newItem.specs.dimensions
                : newItem.specs?.dimensions
                ? `${newItem.specs.dimensions.widthCm || ''} x ${newItem.specs.dimensions.heightCm || ''} x ${newItem.specs.dimensions.depthCm || ''} cm`
                : ''
            }
            onChange={e => onUpdateSpecs({ dimensions: e.target.value })}
            className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg outline-none font-mono"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-slate-500 font-bold uppercase">Material / Estrutura</label>
            <input
              type="text"
              placeholder="Ex: Madeira Maciça e Linho"
              value={newItem.specs?.material || ''}
              onChange={e => onUpdateSpecs({ material: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg outline-none"
            />
          </div>
          <div>
            <label className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1">
              <Shield className={`w-2.5 h-2.5 ${furnitureToken.textClass}`} /> Garantia (meses)
            </label>
            <input
              type="number"
              placeholder="Ex: 24"
              value={newItem.specs?.warrantyMonths ?? 12}
              onChange={e => onUpdateSpecs({ warrantyMonths: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg outline-none font-mono"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 items-center pt-1">
          <div>
            <label className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1">
              <Calendar className={`w-2.5 h-2.5 ${foodToken.textClass}`} /> Prazo Entrega (dias)
            </label>
            <input
              type="number"
              min={0}
              placeholder="Ex: 5"
              value={newItem.specs?.defaultDeliveryLeadDays ?? 3}
              onChange={e => onUpdateSpecs({ defaultDeliveryLeadDays: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg outline-none font-mono"
            />
          </div>
          <label className="flex items-center gap-2 pt-4 cursor-pointer text-[11px] font-bold text-slate-300">
            <input
              type="checkbox"
              checked={!!newItem.specs?.assemblyRequired}
              onChange={e => onUpdateSpecs({ assemblyRequired: e.target.checked })}
              className="accent-amber-500 w-4 h-4"
            />
            <Wrench className={`w-3 h-3 ${foodToken.textClass}`} />
            <span>Requer Montagem</span>
          </label>
        </div>
      </div>
    );
  }

  if (segment === 'ELECTRONICS') {
    return (
      <div className={`bg-slate-950 p-3.5 rounded-2xl border ${electronicsToken.borderClass} space-y-3`}>
        <div className={`flex items-center gap-1.5 ${electronicsToken.textClass} text-[10px] font-black uppercase`}>
          <Cpu className="w-3.5 h-3.5" /> Especificações Técnicas, Voltagem & IMEI
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1">
              <Zap className={`w-2.5 h-2.5 ${foodToken.textClass}`} /> Voltagem / Alimentação
            </label>
            <select
              value={newItem.specs?.voltage || 'BIVOLT'}
              onChange={e => onUpdateSpecs({ voltage: e.target.value as any })}
              className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg outline-none"
            >
              <option value="BIVOLT">Bivolt Automático (110V/220V)</option>
              <option value="110V">110V / 127V</option>
              <option value="220V">220V</option>
              <option value="BATERIA">Bateria Recarregável</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1">
              <Shield className={`w-2.5 h-2.5 ${furnitureToken.textClass}`} /> Garantia de Fábrica (meses)
            </label>
            <input
              type="number"
              placeholder="Ex: 12"
              value={newItem.specs?.warrantyMonths ?? 12}
              onChange={e => onUpdateSpecs({ warrantyMonths: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg outline-none font-mono"
            />
          </div>
        </div>
        <div>
          <label className="text-[9px] text-slate-500 font-bold uppercase">Ficha Técnica Rápida (Specs)</label>
          <input
            type="text"
            placeholder="Ex: 16GB RAM DDR5, 512GB SSD NVMe, Tela OLED 120Hz"
            value={newItem.specs?.technicalSpecs || ''}
            onChange={e => onUpdateSpecs({ technicalSpecs: e.target.value })}
            className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg outline-none"
          />
        </div>
        <label className={`flex items-center gap-2 cursor-pointer text-[11px] font-bold ${electronicsToken.textClass} pt-1`}>
          <input
            type="checkbox"
            checked={!!newItem.specs?.requiresSerialOrImei}
            onChange={e => onUpdateSpecs({ requiresSerialOrImei: e.target.checked })}
            className="accent-cyan-500 w-4 h-4"
          />
          <span>Exigir Número de Série / IMEI no PDV (Garantia & Rastreabilidade)</span>
        </label>
      </div>
    );
  }

  if (segment === 'FASHION') {
    return (
      <CatalogFashionVariantsPanel
        specs={newItem.specs}
        variants={newItem.variants || []}
        onUpdateSpecs={onUpdateSpecs}
        setNewItem={setNewItem}
      />
    );
  }

  if (segment === 'SERVICE') {
    return (
      <div className={`bg-slate-950 p-3.5 rounded-2xl border ${serviceToken.borderClass} space-y-3`}>
        <div className={`flex items-center gap-1.5 ${serviceToken.textClass} text-[10px] font-black uppercase`}>
          <Scissors className="w-3.5 h-3.5" /> Detalhes do Serviço & Agendamento
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1">
              <Clock className={`w-2.5 h-2.5 ${serviceToken.textClass}`} /> Duração Média (min)
            </label>
            <input
              type="number"
              placeholder="Ex: 45"
              value={newItem.specs?.durationMinutes ?? 45}
              onChange={e => onUpdateSpecs({ durationMinutes: Number(e.target.value) })}
              className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg outline-none font-mono"
            />
          </div>
          <div>
            <label className="text-[9px] text-slate-500 font-bold uppercase">Profissional / Atendente</label>
            <input
              type="text"
              placeholder="Ex: Mestre Barbeiro Carlos"
              value={newItem.specs?.professionalName || ''}
              onChange={e => onUpdateSpecs({ professionalName: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg outline-none"
            />
          </div>
        </div>
      </div>
    );
  }

  if (segment === 'FOOD') {
    return (
      <div className="space-y-1">
        <label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
          <Clock className={`w-3 h-3 ${foodToken.textClass}`} /> Tempo Estimado de Preparo na Cozinha (minutos)
        </label>
        <input
          type="number"
          value={newItem.prepTimeMin ?? 15}
          onChange={e => setNewItem({ ...newItem, prepTimeMin: Number(e.target.value) })}
          className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500 font-mono"
        />
      </div>
    );
  }

  return null;
};
