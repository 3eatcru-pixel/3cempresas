import React, { useState } from 'react';
import { Building2, X } from 'lucide-react';
import { StoreCategory, SubscriptionPlanTier, BillingCycle } from '../../../types';

interface CreateStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const CreateStoreModal: React.FC<CreateStoreModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [data, setData] = useState({
    name: '',
    slug: '',
    category: 'RESTAURANT' as StoreCategory,
    subscriptionPlan: 'FREE' as SubscriptionPlanTier,
    billingCycle: 'MONTHLY' as BillingCycle,
    address: '',
    phone: '',
    logo: '',
    banner: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(data);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            Cadastrar Novo Lojista
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase">Nome da Loja</label>
            <input
              type="text" required value={data.name}
              onChange={e => setData({...data, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase">Slug da URL</label>
            <input
              type="text" required value={data.slug}
              onChange={e => setData({...data, slug: e.target.value})}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase">Categoria</label>
            <select
              value={data.category}
              onChange={e => setData({...data, category: e.target.value as any})}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none"
            >
              <option value="RESTAURANT">Restaurante Geral</option>
              <option value="BURGER">Hamburgueria</option>
              <option value="PIZZA">Pizzaria</option>
              <option value="JAPANESE">Culinária Japonesa</option>
              <option value="RETAIL">Varejo / Empório</option>
              <option value="BEVERAGES">Adega & Bebidas</option>
              <option value="FURNITURE">Móveis & Decoração</option>
              <option value="ELECTRONICS">Eletrônicos & Tech</option>
              <option value="FASHION">Moda & Vestuário</option>
              <option value="SERVICES">Serviços Gerais</option>
              <option value="HEALTH">Saúde & Bem-Estar</option>
              <option value="BEAUTY">Estética & Beleza</option>
              <option value="MULTI_COMMERCE">Multivendas Híbrido (Tudo + Comida)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase">Plano</label>
            <select
              value={data.subscriptionPlan}
              onChange={e => setData({...data, subscriptionPlan: e.target.value as any})}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none"
            >
              <option value="FREE">FREE (1 Filial • Até 2 Dispositivos)</option>
              <option value="PROMO">PROMO (1 Filial • Até 3 Dispositivos)</option>
              <option value="BASIC">BASIC (1 Filial • Até 5 Dispositivos)</option>
              <option value="PRO">PRO (Até 2 Filiais • Até 15 Dispositivos)</option>
              <option value="ENTERPRISE">ENTERPRISE (Até 5 Filiais • 999 Dispositivos)</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 font-bold uppercase">Endereço Comercial</label>
          <input
            type="text" required value={data.address}
            onChange={e => setData({...data, address: e.target.value})}
            className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl">Cancelar</button>
          <button type="submit" className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl">Cadastrar Lojista</button>
        </div>
      </form>
    </div>
  );
};
