import React from 'react';
import {
  Building2,
  Edit3,
  Mail,
  MessageSquare,
  PackagePlus,
  Phone,
  Trash2,
  User,
} from 'lucide-react';
import { Supplier } from '../../../types';

interface SupplierCardProps {
  supplier: Supplier;
  whatsappLink: string | null;
  isConfirmingDelete: boolean;
  onEdit: (supplier: Supplier) => void;
  onRequestDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  onOpenPurchase: (supplier: Supplier) => void;
}

export const SupplierCard: React.FC<SupplierCardProps> = ({
  supplier,
  whatsappLink,
  isConfirmingDelete,
  onEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onOpenPurchase,
}) => {
  return (
    <div className="p-5 bg-slate-900 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors space-y-3 flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-slate-800 rounded-xl text-slate-400 shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-white font-bold text-sm truncate">{supplier.companyName}</h4>
              <p className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                {supplier.cnpj || 'CNPJ não informado'} · {supplier.category}
              </p>
            </div>
          </div>
          {!isConfirmingDelete && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onEdit(supplier)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Editar fornecedor"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onRequestDelete(supplier.id)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="Remover fornecedor"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2 truncate">
            <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">{supplier.contactName || '—'}</span>
          </div>
          <div className="flex items-center gap-2 truncate">
            <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="font-mono tabular-nums text-[11px]">
              {supplier.phone || 'Não informado'}
            </span>
          </div>
          <div className="flex items-center gap-2 truncate">
            <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate text-[11px]">{supplier.email || 'Não informado'}</span>
          </div>
        </div>
      </div>

      {isConfirmingDelete ? (
        <div className="flex items-center justify-between gap-2 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
          <span className="text-xs font-semibold text-rose-300">Remover fornecedor?</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onConfirmDelete(supplier.id)}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Remover
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              Não
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => onOpenPurchase(supplier)}
            className="flex-1 py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <PackagePlus className="w-3.5 h-3.5" /> Registrar Compra / NF
          </button>
          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              title="Chamar no WhatsApp"
              className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              <MessageSquare className="w-4 h-4" />
            </a>
          )}
        </div>
      )}
    </div>
  );
};
