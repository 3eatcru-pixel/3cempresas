import React, { useMemo, useState } from 'react';
import {
  Award,
  Mail,
  MessageSquare,
  Phone,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { CustomerCRM, Order, Store } from '../../../../types';
import { CustomerOrderHistoryPanel } from './CustomerOrderHistoryPanel';

interface CustomerDetailModalProps {
  customer: CustomerCRM;
  currentStore: Store;
  orders: Order[];
  onClose: () => void;
  onUpdateProfile: (
    customerId: string,
    updates: Partial<Pick<CustomerCRM, 'name' | 'phone' | 'email' | 'notes' | 'loyaltyTier' | 'loyaltyPoints'>>
  ) => Promise<boolean>;
  onDeleteCustomer: (customerId: string) => Promise<boolean>;
  onShowNotification: (msg: string) => void;
}

const normalizeDigits = (val?: string) => String(val || '').replace(/\D/g, '');

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  customer,
  currentStore,
  orders,
  onClose,
  onUpdateProfile,
  onDeleteCustomer,
  onShowNotification,
}) => {
  const [name, setName] = useState(customer.name || '');
  const [phone, setPhone] = useState(customer.phone || '');
  const [email, setEmail] = useState(customer.email || '');
  const [loyaltyTier, setLoyaltyTier] = useState<CustomerCRM['loyaltyTier']>(
    customer.loyaltyTier || 'BRONZE'
  );
  const [loyaltyPoints, setLoyaltyPoints] = useState(String(customer.loyaltyPoints ?? 0));
  const [notes, setNotes] = useState(customer.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const customerOrders = useMemo(() => {
    const targetDigits = normalizeDigits(customer.phone);
    const targetEmail = (customer.email || '').trim().toLowerCase();
    const targetName = (customer.name || '').trim().toLowerCase();

    return orders
      .filter((o) => {
        if (o.storeId !== currentStore.id) return false;
        if (o.customerId && o.customerId === customer.id) return true;
        if (targetDigits && normalizeDigits(o.customerPhone) === targetDigits) return true;
        if (targetEmail && o.customerEmail && o.customerEmail.trim().toLowerCase() === targetEmail) return true;
        if (targetName && o.customerName && o.customerName.trim().toLowerCase() === targetName) return true;
        return false;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, currentStore.id, customer]);

  const validOrders = customerOrders.filter((o) => o.status !== 'CANCELLED');
  const effectiveOrdersCount = Math.max(customer.totalOrders || 0, validOrders.length);
  const computedOrdersTotal = validOrders.reduce((acc, o) => acc + (o.total || 0), 0);
  const effectiveTotalSpent = Math.max(customer.totalSpent || 0, computedOrdersTotal);
  const averageTicket = effectiveOrdersCount > 0 ? effectiveTotalSpent / effectiveOrdersCount : 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setIsSaving(true);
    try {
      const ok = await onUpdateProfile(customer.id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        loyaltyTier,
        loyaltyPoints: Math.max(0, Math.round(Number(loyaltyPoints) || 0)),
        notes: notes.trim(),
      });
      if (ok) onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const ok = await onDeleteCustomer(customer.id);
      if (ok) onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const waDigits = normalizeDigits(phone || customer.phone);
  const waHref = `https://wa.me/${waDigits.startsWith('55') ? waDigits : `55${waDigits}`}?text=${encodeURIComponent(
    `Olá ${name || customer.name}! Tudo bem? Aqui é do ${currentStore.name}.`
  )}`;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl my-auto overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 font-black text-base flex items-center justify-center shrink-0">
              {(name || customer.name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white truncate">{customer.name}</h3>
                <span
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase ${
                    loyaltyTier === 'PLATINUM'
                      ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                      : loyaltyTier === 'GOLD'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : loyaltyTier === 'SILVER'
                      ? 'bg-slate-400/10 text-slate-300 border-slate-400/30'
                      : 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                  }`}
                >
                  {loyaltyTier}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono truncate">
                ID: {customer.id} · Último pedido: {customer.lastOrderDate || 'Sem registro'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {waDigits && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onShowNotification(`Abrindo WhatsApp direto para ${customer.name}`)}
                className="px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <MessageSquare size={14} /> WhatsApp
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 custom-scrollbar">
          {/* Left: Editable Profile Form */}
          <form onSubmit={handleSave} className="lg:col-span-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Ficha Cadastral & Fidelidade
            </h4>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Nome Completo *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                  <Phone size={11} /> Telefone / WhatsApp *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                  <Mail size={11} /> E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                  <Award size={11} /> Nível Fidelidade
                </label>
                <select
                  value={loyaltyTier}
                  onChange={(e) => setLoyaltyTier(e.target.value as CustomerCRM['loyaltyTier'])}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="BRONZE">BRONZE</option>
                  <option value="SILVER">SILVER</option>
                  <option value="GOLD">GOLD</option>
                  <option value="PLATINUM">PLATINUM</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Saldo de Pontos</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={loyaltyPoints}
                  onChange={(e) => setLoyaltyPoints(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-amber-400 font-bold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">
                Preferências & Observações Internas
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Restrições alimentares, ponto da carne, endereço alternativo..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save size={14} /> {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>

            {/* 2-step inline delete */}
            <div className="pt-3 border-t border-slate-800/80">
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full py-2 bg-slate-950 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 size={13} /> Remover Cliente da Base CRM
                </button>
              ) : (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2">
                  <p className="text-[11px] text-rose-300 font-semibold">
                    Confirmar remoção de {customer.name}? Os pedidos históricos permanecem preservados.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {isDeleting ? 'Removendo...' : 'Confirmar Exclusão'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>

          <CustomerOrderHistoryPanel
            customerOrders={customerOrders}
            effectiveTotalSpent={effectiveTotalSpent}
            effectiveOrdersCount={effectiveOrdersCount}
            averageTicket={averageTicket}
            loyaltyPoints={Number(loyaltyPoints) || 0}
          />
        </div>
      </div>
    </div>
  );
};
