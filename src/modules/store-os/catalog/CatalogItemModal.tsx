import React from 'react';
import { MenuItem } from '../../../types';
import { Edit3, Plus, X, Check } from 'lucide-react';
import { CatalogItemInfoFields } from './layout/CatalogItemInfoFields';
import { CatalogItemPricingFields } from './layout/CatalogItemPricingFields';

interface CatalogItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  editingItem: MenuItem | null;
  newItem: Partial<MenuItem>;
  setNewItem: React.Dispatch<React.SetStateAction<Partial<MenuItem>>>;
  onAiDescribe: () => void;
  isAiLoading: boolean;
  onAiPrice: () => void;
  isPricingLoading: boolean;
  pricingJustification: string | null;
}

export const CatalogItemModal: React.FC<CatalogItemModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingItem,
  newItem,
  setNewItem,
  onAiDescribe,
  isAiLoading,
  onAiPrice,
  isPricingLoading,
  pricingJustification,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <form
        onSubmit={onSubmit}
        className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl p-6 space-y-6 shadow-2xl animate-scaleIn my-auto"
      >
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 text-slate-950 rounded-xl">
              {editingItem ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-tighter italic">
                {editingItem ? 'Editar Produto' : 'Cadastrar Novo Produto'}
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase">
                {editingItem
                  ? 'Atualize as informações do produto e precificação'
                  : 'Preencha os dados do item para exibição multicanal'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CatalogItemInfoFields
            newItem={newItem}
            setNewItem={setNewItem}
            onAiDescribe={onAiDescribe}
            isAiLoading={isAiLoading}
          />

          <CatalogItemPricingFields
            newItem={newItem}
            setNewItem={setNewItem}
            onAiPrice={onAiPrice}
            isPricingLoading={isPricingLoading}
            pricingJustification={pricingJustification}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-2xl transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-[2] py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Check className="w-4 h-4" />
            {editingItem ? 'Salvar Alterações no Catálogo' : 'Salvar & Ativar no Marketplace'}
          </button>
        </div>
      </form>
    </div>
  );
};
