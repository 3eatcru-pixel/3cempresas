import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { CustomerCRM } from '../../../../types';

interface NewCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitCustomer: (customerData: Omit<CustomerCRM, 'id' | 'storeId'>) => Promise<void>;
}

export const NewCustomerModal: React.FC<NewCustomerModalProps> = ({
  isOpen,
  onClose,
  onSubmitCustomer,
}) => {
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    loyaltyPoints: 0,
    totalSpent: 0,
    totalOrders: 0,
    lastOrderDate: '',
    notes: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.phone) return;
    await onSubmitCustomer(newCustomer as any);
    onClose();
    setNewCustomer({
      name: '',
      phone: '',
      email: '',
      loyaltyPoints: 0,
      totalSpent: 0,
      totalOrders: 0,
      lastOrderDate: '',
      notes: '',
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-white text-lg flex items-center gap-2 uppercase tracking-tighter italic">
            <Users className="w-5 h-5 text-blue-400" />
            Cadastrar Novo Cliente
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase">Nome Completo</label>
            <input
              type="text"
              required
              autoFocus
              value={newCustomer.name}
              onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-3 rounded-xl focus:border-blue-500 outline-none transition-all"
              placeholder="Nome do Cliente"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">WhatsApp / Telefone</label>
              <input
                type="tel"
                required
                value={newCustomer.phone}
                onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-3 rounded-xl focus:border-blue-500 outline-none transition-all font-mono"
                placeholder="(43) 99999-9999"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">E-mail (Opcional)</label>
              <input
                type="email"
                value={newCustomer.email}
                onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-3 rounded-xl focus:border-blue-500 outline-none transition-all font-mono"
                placeholder="cliente@email.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase">Observações Internas</label>
            <textarea
              value={newCustomer.notes}
              onChange={e => setNewCustomer({ ...newCustomer, notes: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-3 rounded-xl focus:border-blue-500 outline-none transition-all h-20 resize-none"
              placeholder="Ex: Alérgico a camarão, prefere entrega rápida..."
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-[2] px-4 py-3 bg-blue-500 hover:bg-blue-400 text-slate-950 text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 cursor-pointer"
          >
            Salvar Cliente no CRM
          </button>
        </div>
      </form>
    </div>
  );
};
