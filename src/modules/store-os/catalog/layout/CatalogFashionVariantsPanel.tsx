import React, { useState } from 'react';
import { Shirt, Plus, Trash2 } from 'lucide-react';
import { COMMERCE_SEGMENT_COLORS, STATUS_COLORS } from '@3c/design-system';
import { MenuItem, MenuItemVariant, ProductSpecifications } from '../../../../types';
import { computeTotalVariantStock } from '../../../../utils/storeDomain';

interface CatalogFashionVariantsPanelProps {
  specs?: ProductSpecifications;
  variants: MenuItemVariant[];
  onUpdateSpecs: (partial: Partial<ProductSpecifications>) => void;
  setNewItem: React.Dispatch<React.SetStateAction<Partial<MenuItem>>>;
}

export const CatalogFashionVariantsPanel: React.FC<CatalogFashionVariantsPanelProps> = ({
  specs,
  variants,
  onUpdateSpecs,
  setNewItem,
}) => {
  const [varSize, setVarSize] = useState('M');
  const [varColor, setVarColor] = useState('Preto');
  const [varStock, setVarStock] = useState(5);

  const fashionToken = COMMERCE_SEGMENT_COLORS.FASHION;
  const successToken = STATUS_COLORS.SUCCESS;

  const applyVariants = (nextVariants: MenuItemVariant[]) => {
    const uniqueSizes = Array.from(new Set(nextVariants.map(v => v.size).filter(Boolean) as string[]));
    const uniqueColors = Array.from(new Set(nextVariants.map(v => v.color).filter(Boolean) as string[]));
    setNewItem(prev => ({
      ...prev,
      variants: nextVariants,
      stock: nextVariants.length > 0 ? computeTotalVariantStock(nextVariants) : prev.stock,
      specs: {
        ...(prev.specs || {}),
        ...(uniqueSizes.length > 0 ? { sizes: uniqueSizes } : {}),
        ...(uniqueColors.length > 0 ? { colors: uniqueColors } : {}),
      }
    }));
  };

  const handleAddVariant = () => {
    if (!varSize.trim() && !varColor.trim()) return;
    const newVar: MenuItemVariant = {
      id: `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      size: varSize.trim() || 'Único',
      color: varColor.trim() || 'Padrão',
      stock: Math.max(0, Number(varStock) || 0),
    };
    applyVariants([...variants, newVar]);
  };

  const handleUpdateVariantStock = (id: string, stock: number) => {
    applyVariants(variants.map(v => (v.id === id ? { ...v, stock: Math.max(0, stock) } : v)));
  };

  const handleRemoveVariant = (id: string) => {
    applyVariants(variants.filter(v => v.id !== id));
  };

  const handleGenerateMatrix = () => {
    const sizes = (specs?.sizes && specs.sizes.length > 0) ? specs.sizes : ['P', 'M', 'G'];
    const colors = (specs?.colors && specs.colors.length > 0) ? specs.colors : ['Preto', 'Branco'];
    const generated: MenuItemVariant[] = [];
    colors.forEach(color => {
      sizes.forEach(size => {
        const existing = variants.find(v => v.color === color && v.size === size);
        generated.push(
          existing || {
            id: `var-${color}-${size}-${Math.random().toString(36).slice(2, 6)}`,
            color,
            size,
            stock: 5,
          }
        );
      });
    });
    applyVariants(generated);
  };

  return (
    <div className={`bg-slate-950 p-3.5 rounded-2xl border ${fashionToken.borderClass} space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1.5 ${fashionToken.textClass} text-[10px] font-black uppercase`}>
          <Shirt className="w-3.5 h-3.5" /> Grade de Tamanhos, Cores & Estoque
        </div>
        <button
          type="button"
          onClick={handleGenerateMatrix}
          className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${fashionToken.badgeClass} hover:opacity-90 cursor-pointer`}
        >
          Gerar Matriz Auto
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[9px] text-slate-500 font-bold uppercase">Tamanhos</label>
          <input
            type="text"
            placeholder="Ex: P, M, G, GG"
            value={(specs?.sizes || []).join(', ')}
            onChange={e => onUpdateSpecs({ sizes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg outline-none"
          />
        </div>
        <div>
          <label className="text-[9px] text-slate-500 font-bold uppercase">Cores</label>
          <input
            type="text"
            placeholder="Ex: Preto, Off-White"
            value={(specs?.colors || []).join(', ')}
            onChange={e => onUpdateSpecs({ colors: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            className="w-full bg-slate-900 border border-slate-800 text-xs text-white p-2 rounded-lg outline-none"
          />
        </div>
      </div>

      <div className="pt-2 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
          <span>Grade Individual por Variação</span>
          {variants.length > 0 && (
            <span className={`${successToken.textClass} font-mono`}>
              Estoque Total Auto: {computeTotalVariantStock(variants)} un
            </span>
          )}
        </div>
        <div className="grid grid-cols-12 gap-1.5">
          <input
            type="text"
            value={varColor}
            onChange={e => setVarColor(e.target.value)}
            placeholder="Cor"
            className="col-span-4 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none"
          />
          <input
            type="text"
            value={varSize}
            onChange={e => setVarSize(e.target.value)}
            placeholder="Tam"
            className="col-span-3 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none"
          />
          <input
            type="number"
            min={0}
            value={varStock}
            onChange={e => setVarStock(Number(e.target.value))}
            placeholder="Qtd"
            className="col-span-3 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-white font-mono outline-none"
          />
          <button
            type="button"
            onClick={handleAddVariant}
            className="col-span-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg flex items-center justify-center cursor-pointer"
            title="Adicionar variação na grade"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {variants.length > 0 && (
          <div className="max-h-28 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {variants.map(v => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-2 bg-slate-900/90 px-2.5 py-1 rounded-lg border border-slate-800 text-[11px]"
              >
                <span className="text-slate-200 font-bold truncate">
                  {v.color || 'Padrão'} • Tam {v.size || 'Único'}
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={v.stock}
                    onChange={e => handleUpdateVariantStock(v.id, Number(e.target.value))}
                    className={`w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono ${successToken.textClass} text-[11px]`}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveVariant(v.id)}
                    className="text-slate-500 hover:text-rose-400 p-0.5 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
