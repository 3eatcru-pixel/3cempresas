import React from 'react';
import {
  ShoppingCart,
  Printer,
  Zap,
  Minus,
  Plus,
  CreditCard,
  Banknote,
  FileText,
  Landmark,
  Link2,
} from 'lucide-react';
import { getPlatformAdapters } from '../../../../core/platform/PlatformAdapter';
import { StorePaymentMethod } from '../../../../types';
import { PosCustomerPicker } from './PosCustomerPicker';

interface POSCartProps {
  logic: any;
}

const PAYMENT_OPTIONS: {
  id: StorePaymentMethod;
  label: string;
  shortLabel: string;
  icon: React.FC<{ size?: number; className?: string }>;
  activeClass: string;
}[] = [
  {
    id: 'PIX',
    label: 'PIX Direto',
    shortLabel: 'PIX',
    icon: Zap,
    activeClass: 'bg-emerald-500/20 border-emerald-500 text-emerald-300',
  },
  {
    id: 'CREDIT_CARD',
    label: 'Cartão Crédito',
    shortLabel: 'CRÉDITO',
    icon: CreditCard,
    activeClass: 'bg-blue-500/20 border-blue-500 text-blue-300',
  },
  {
    id: 'DEBIT_CARD',
    label: 'Cartão Débito',
    shortLabel: 'DÉBITO',
    icon: CreditCard,
    activeClass: 'bg-indigo-500/20 border-indigo-500 text-indigo-300',
  },
  {
    id: 'CASH',
    label: 'Dinheiro',
    shortLabel: 'DINHEIRO',
    icon: Banknote,
    activeClass: 'bg-amber-500/20 border-amber-500 text-amber-300',
  },
  {
    id: 'BOLETO',
    label: 'Boleto',
    shortLabel: 'BOLETO',
    icon: FileText,
    activeClass: 'bg-purple-500/20 border-purple-500 text-purple-300',
  },
  {
    id: 'BANK_TRANSFER',
    label: 'TED / Transf.',
    shortLabel: 'TED/DOC',
    icon: Landmark,
    activeClass: 'bg-cyan-500/20 border-cyan-500 text-cyan-300',
  },
  {
    id: 'PAYMENT_LINK',
    label: 'Link Pagto.',
    shortLabel: 'LINK',
    icon: Link2,
    activeClass: 'bg-pink-500/20 border-pink-500 text-pink-300',
  },
];

export const POSCart: React.FC<POSCartProps> = ({ logic }) => {
  const platform = getPlatformAdapters();
  const savedReceipt = platform.storage.getItem(`last_pos_order_${logic.currentStore.id}`);
  const finalTotal = Math.max(0, logic.total - logic.appliedDiscount);
  const acceptedIds: StorePaymentMethod[] =
    Array.isArray(logic.acceptedPaymentMethods) && logic.acceptedPaymentMethods.length > 0
      ? logic.acceptedPaymentMethods
      : PAYMENT_OPTIONS.map((o) => o.id);
  const visibleMethods = PAYMENT_OPTIONS.filter((opt) => acceptedIds.includes(opt.id));
  const selectedMethod: StorePaymentMethod =
    logic.selectedPaymentMethod || visibleMethods[0]?.id || 'PIX';
  const numericCash = parseFloat(String(logic.cashTendered || '').replace(',', '.')) || 0;
  const changeAmount =
    selectedMethod === 'CASH' && numericCash > finalTotal
      ? Math.round((numericCash - finalTotal) * 100) / 100
      : 0;

  return (
    <div className="bg-slate-900/80 rounded-3xl border border-slate-800 flex flex-col shadow-2xl overflow-hidden h-full">
      <div className="p-5 border-b border-slate-800 bg-slate-950/30">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
            <ShoppingCart size={14} /> Sacola de Itens
          </span>
          <div className="flex items-center gap-2">
            {savedReceipt && (
              <button 
                onClick={() => {
                  const saved = platform.storage.getItem(`last_pos_order_${logic.currentStore.id}`);
                  if (saved) logic.setLastOrderForReceipt(JSON.parse(saved));
                }}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 rounded-lg transition-all cursor-pointer"
                title="Reimprimir Último Recibo"
              >
                <Printer size={12} />
              </button>
            )}
            <span className="bg-slate-950 px-2 py-1 rounded text-amber-500 font-mono text-xs font-bold border border-slate-800">
              {logic.selectedItems.reduce((a: any, b: any) => a + b.qty, 0)}
            </span>
          </div>
        </div>
        <div className="space-y-3">
          <PosCustomerPicker
            customers={logic.storeCustomers || []}
            selectedCustomer={logic.selectedCrmCustomer || null}
            onSelectCustomer={(c) => logic.setSelectedCrmCustomer?.(c)}
            customerName={logic.customerName}
            setCustomerName={logic.setCustomerName}
            placeholder="Cliente Balcão ou buscar CRM..."
            compact
          />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Zap className="absolute left-3 top-2.5 text-slate-600 w-4 h-4" />
              <input 
                type="text"
                placeholder="Cupom"
                value={logic.couponCode}
                onChange={(e) => logic.setCouponCode(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-[10px] font-bold text-white focus:outline-none focus:border-emerald-500 uppercase"
              />
            </div>
            <button 
              onClick={logic.handleApplyCoupon}
              className="px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer"
            >
              APLICAR
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {logic.selectedItems.map((it: any) => {
          const itemKey = `${it.menuItem.id}::${it.variantId || 'base'}`;
          return (
            <div key={itemKey} className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800/60 flex items-center justify-between group">
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-1.5 truncate">
                  <p className="text-[11px] font-black text-white truncate uppercase">{it.menuItem.name}</p>
                  {it.variantLabel && (
                    <span className="text-[9px] text-amber-400 font-bold tracking-tight">({it.variantLabel})</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 font-mono">R$ {it.menuItem.price.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-3 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
                <button 
                  onClick={() => logic.handleUpdateQty(it.menuItem.id, -1, it.variantId)} 
                  className="text-slate-500 hover:text-red-400 cursor-pointer"
                  title="Diminuir quantidade"
                >
                  <Minus size={14} />
                </button>
                <span className="text-xs font-black text-white w-4 text-center">{it.qty}</span>
                <button 
                  onClick={() => logic.handleUpdateQty(it.menuItem.id, 1, it.variantId)} 
                  className="text-slate-500 hover:text-emerald-400 cursor-pointer"
                  title="Aumentar quantidade"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          );
        })}
        {logic.selectedItems.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 gap-3 py-12">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-500 flex items-center justify-center">
              <ShoppingCart size={32} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest">Aguardando Lançamento</p>
          </div>
        )}
      </div>

      <div className="p-5 bg-slate-950/50 border-t border-slate-800 space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
            <span>Subtotal</span>
            <span>R$ {logic.total.toFixed(2)}</span>
          </div>
          {logic.appliedDiscount > 0 && (
            <div className="flex justify-between text-[10px] text-emerald-400 font-bold uppercase">
              <span>Desconto</span>
              <span>- R$ {logic.appliedDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-black text-white uppercase italic border-t border-slate-800 pt-1 mt-1">
            <span>Total</span>
            <span className="text-amber-400 font-mono">R$ {finalTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* All Payment Methods Selector */}
        <div className="space-y-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
            Modo de Pagamento ({visibleMethods.length} habilitados)
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {visibleMethods.map((method) => {
              const Icon = method.icon;
              const isSelected = selectedMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => logic.setSelectedPaymentMethod?.(method.id)}
                  className={`py-2 px-1.5 rounded-xl border text-[9px] font-black uppercase flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    isSelected
                      ? method.activeClass
                      : 'bg-slate-900/90 hover:bg-slate-800 text-slate-400 border-slate-800'
                  }`}
                >
                  <Icon size={13} />
                  <span className="truncate max-w-full">{method.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedMethod === 'CASH' && (
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-black uppercase text-amber-400">Valor Recebido (R$)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder={finalTotal.toFixed(2)}
                value={logic.cashTendered || ''}
                onChange={(e) => logic.setCashTendered?.(e.target.value)}
                className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-right text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            {changeAmount > 0 && (
              <div className="flex items-center justify-between text-[10px] font-black text-emerald-400 pt-1 border-t border-slate-800">
                <span>TROCO A DEVOLVER</span>
                <span className="font-mono">R$ {changeAmount.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        <button
          disabled={logic.selectedItems.length === 0}
          onClick={() => logic.handleFinishOrder(selectedMethod)}
          className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs uppercase rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/10"
        >
          <Printer size={16} /> Finalizar ({PAYMENT_OPTIONS.find((o) => o.id === selectedMethod)?.shortLabel || selectedMethod}) & Recibo
        </button>
      </div>
    </div>
  );
};
