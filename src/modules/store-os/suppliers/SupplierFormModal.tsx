import React from 'react';
import { Truck, X } from 'lucide-react';

export interface SupplierFormValues {
  companyName: string;
  cnpj: string;
  contactName: string;
  phone: string;
  email: string;
  category: string;
}

interface SupplierFormModalProps {
  isEditing: boolean;
  isSubmitting: boolean;
  form: SupplierFormValues;
  onChangeForm: React.Dispatch<React.SetStateAction<SupplierFormValues>>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const SUPPLIER_CATEGORIES = [
  'Insumos Gerais',
  'Carnes & Frios',
  'Hortifruti',
  'Bebidas',
  'Embalagens',
  'Limpeza & Higiene',
  'Revenda / Varejo',
];

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  isEditing,
  isSubmitting,
  form,
  onChangeForm,
  onClose,
  onSubmit,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Truck className="w-4 h-4 text-amber-400" />
            <span>{isEditing ? 'Editar Fornecedor' : 'Novo Fornecedor'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-400">
              Razão Social / Nome *
            </label>
            <input
              type="text"
              required
              value={form.companyName}
              onChange={(e) => onChangeForm((prev) => ({ ...prev, companyName: e.target.value }))}
              placeholder="Ex: Distribuidora Central Ltda"
              className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-400">CNPJ</label>
              <input
                type="text"
                value={form.cnpj}
                onChange={(e) => onChangeForm((prev) => ({ ...prev, cnpj: e.target.value }))}
                placeholder="00.000.000/0000-00"
                className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => onChangeForm((prev) => ({ ...prev, category: e.target.value }))}
                className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              >
                {SUPPLIER_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-400">
                Contato / Vendedor
              </label>
              <input
                type="text"
                value={form.contactName}
                onChange={(e) =>
                  onChangeForm((prev) => ({ ...prev, contactName: e.target.value }))
                }
                placeholder="Ex: Carlos"
                className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400">
                Telefone / WhatsApp
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => onChangeForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="(00) 00000-0000"
                className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => onChangeForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="compras@fornecedor.com.br"
              className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Salvar Fornecedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
