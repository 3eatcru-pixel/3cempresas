import React, { useState, useEffect } from 'react';
import {
  QrCode,
  CreditCard,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Truck,
  Wrench,
  FileText,
  Landmark,
  Link2,
} from 'lucide-react';
import { CustomerCRM, MenuItem, StorePaymentMethod } from '../../../../types';
import { PosCustomerPicker } from '../components/PosCustomerPicker';

interface RetailPosCheckoutPanelProps {
  selectedItems: { menuItem: MenuItem; qty: number }[];
  total: number;
  appliedDiscount: number;
  couponCode: string;
  setCouponCode: (code: string) => void;
  onApplyCoupon: () => void;
  customers?: CustomerCRM[];
  selectedCustomer?: CustomerCRM | null;
  onSelectCustomer?: (c: CustomerCRM | null) => void;
  customerName?: string;
  setCustomerName?: (name: string) => void;
  onFinish: (method: StorePaymentMethod) => void;
  isFinishing: boolean;
  hasLowStock: boolean;
  acceptedPaymentMethods?: StorePaymentMethod[];
  showDeliverySchedule?: boolean;
  scheduledDeliveryDate?: string;
  setScheduledDeliveryDate?: (d: string) => void;
  scheduledDeliveryPeriod?: 'MANHÃ' | 'TARDE' | 'NOITE';
  setScheduledDeliveryPeriod?: (p: 'MANHÃ' | 'TARDE' | 'NOITE') => void;
  assemblyRequired?: boolean;
  setAssemblyRequired?: (val: boolean) => void;
  onOpenExchangeModal?: () => void;
  operatorName?: string;
  terminalLabel?: string;
}

const RETAIL_PAYMENT_METHODS: {
  id: StorePaymentMethod;
  label: string;
  icon: React.FC<{ className?: string; size?: number }>;
  activeClass: string;
  iconClass: string;
}[] = [
  {
    id: 'PIX',
    label: 'PIX (PDV)',
    icon: QrCode,
    activeClass: 'bg-emerald-500/15 border-2 border-emerald-500 shadow-lg shadow-emerald-500/10',
    iconClass: 'text-emerald-500',
  },
  {
    id: 'CREDIT_CARD',
    label: 'CRÉDITO',
    icon: CreditCard,
    activeClass: 'bg-blue-500/15 border-2 border-blue-500 shadow-lg shadow-blue-500/10',
    iconClass: 'text-blue-500',
  },
  {
    id: 'DEBIT_CARD',
    label: 'DÉBITO',
    icon: CreditCard,
    activeClass: 'bg-indigo-500/15 border-2 border-indigo-500 shadow-lg shadow-indigo-500/10',
    iconClass: 'text-indigo-400',
  },
  {
    id: 'CASH',
    label: 'DINHEIRO',
    icon: DollarSign,
    activeClass: 'bg-amber-500/15 border-2 border-amber-500 shadow-lg shadow-amber-500/10',
    iconClass: 'text-amber-500',
  },
  {
    id: 'BOLETO',
    label: 'BOLETO',
    icon: FileText,
    activeClass: 'bg-purple-500/15 border-2 border-purple-500 shadow-lg shadow-purple-500/10',
    iconClass: 'text-purple-400',
  },
  {
    id: 'BANK_TRANSFER',
    label: 'TED / TRANSF.',
    icon: Landmark,
    activeClass: 'bg-cyan-500/15 border-2 border-cyan-500 shadow-lg shadow-cyan-500/10',
    iconClass: 'text-cyan-400',
  },
  {
    id: 'PAYMENT_LINK',
    label: 'LINK PAGTO.',
    icon: Link2,
    activeClass: 'bg-pink-500/15 border-2 border-pink-500 shadow-lg shadow-pink-500/10',
    iconClass: 'text-pink-400',
  },
];

export const RetailPosCheckoutPanel: React.FC<RetailPosCheckoutPanelProps> = ({
  selectedItems,
  total,
  appliedDiscount,
  couponCode,
  setCouponCode,
  onApplyCoupon,
  customers = [],
  selectedCustomer = null,
  onSelectCustomer,
  customerName = '',
  setCustomerName,
  onFinish,
  isFinishing,
  hasLowStock,
  acceptedPaymentMethods,
  showDeliverySchedule = false,
  scheduledDeliveryDate = '',
  setScheduledDeliveryDate,
  scheduledDeliveryPeriod = 'TARDE',
  setScheduledDeliveryPeriod,
  assemblyRequired = false,
  setAssemblyRequired,
  onOpenExchangeModal,
  operatorName,
  terminalLabel,
}) => {
  const enabledIds: StorePaymentMethod[] =
    Array.isArray(acceptedPaymentMethods) && acceptedPaymentMethods.length > 0
      ? acceptedPaymentMethods
      : RETAIL_PAYMENT_METHODS.map((m) => m.id);
  const visibleMethods = RETAIL_PAYMENT_METHODS.filter((m) => enabledIds.includes(m.id));
  const [selectedMethod, setSelectedMethod] = useState<StorePaymentMethod>(
    visibleMethods[0]?.id || 'CREDIT_CARD'
  );
  const [cashTendered, setCashTendered] = useState('');

  const netTotal = Math.max(0, total - appliedDiscount);
  const numericCash = parseFloat(cashTendered.replace(',', '.')) || 0;
  const changeAmount =
    selectedMethod === 'CASH' && numericCash > netTotal
      ? Math.round((numericCash - netTotal) * 100) / 100
      : 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isFinishing && selectedItems.length > 0) {
        const target = e.target as HTMLElement | null;
        if (target?.tagName === 'INPUT' || target?.tagName === 'SELECT' || target?.tagName === 'TEXTAREA') {
          return;
        }
        e.preventDefault();
        onFinish(selectedMethod);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMethod, isFinishing, selectedItems.length, onFinish]);

  return (
    <div className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col justify-between overflow-y-auto custom-scrollbar">
      <div className="p-6 space-y-5">
        {/* Display */}
        <div className="bg-slate-950 p-5 rounded-2xl border-2 border-slate-800 shadow-inner space-y-3">
          <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <span>Itens no Carrinho</span>
            <span>{selectedItems.reduce((a, b) => a + b.qty, 0)} un</span>
          </div>
          <div className="space-y-1 text-right">
            <div className="flex justify-between items-end">
              <span className="text-[9px] text-slate-600 font-bold uppercase">Subtotal</span>
              <span className="text-sm font-mono text-slate-400">R$ {total.toFixed(2)}</span>
            </div>
            {appliedDiscount > 0 && (
              <div className="flex justify-between items-end text-emerald-500">
                <span className="text-[9px] font-bold uppercase">Desconto Cupom</span>
                <span className="text-sm font-mono">- R$ {appliedDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-800 mt-1">
              <p className="text-[9px] font-bold text-slate-500 uppercase mb-1">Total Líquido</p>
              <p className="text-5xl font-black text-emerald-400 font-mono tracking-tighter">
                {netTotal.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* CRM Customer Identification */}
        {setCustomerName && onSelectCustomer && (
          <div className="space-y-1.5">
            <h4 className="text-[10px] font-bold text-slate-400 px-1">Cliente / Fidelidade CRM</h4>
            <PosCustomerPicker
              customers={customers}
              selectedCustomer={selectedCustomer}
              onSelectCustomer={onSelectCustomer}
              customerName={customerName}
              setCustomerName={setCustomerName}
              placeholder="Cliente Varejo ou buscar CRM..."
              compact
            />
          </div>
        )}

        {/* Scheduled Delivery & Assembly for Furniture / Large Items */}
        {showDeliverySchedule && setScheduledDeliveryDate && setScheduledDeliveryPeriod && setAssemblyRequired && (
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-amber-500/30 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-400">
              <Truck size={13} /> Agendamento de Entrega & Montagem
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={scheduledDeliveryDate}
                onChange={e => setScheduledDeliveryDate(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] font-mono text-white outline-none focus:border-amber-500"
              />
              <select
                value={scheduledDeliveryPeriod}
                onChange={e => setScheduledDeliveryPeriod(e.target.value as any)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] font-bold text-white outline-none focus:border-amber-500"
              >
                <option value="MANHÃ">Manhã</option>
                <option value="TARDE">Tarde</option>
                <option value="NOITE">Noite</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={assemblyRequired}
                onChange={e => setAssemblyRequired(e.target.checked)}
                className="accent-amber-500 w-3.5 h-3.5"
              />
              <Wrench size={12} className="text-amber-400" />
              <span>Incluir Ordem de Montagem</span>
            </label>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">
            Cupom Promocional
          </h4>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="DIGITAR CÓDIGO..."
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[10px] font-bold text-white focus:outline-none focus:border-emerald-500 uppercase"
            />
            <button
              onClick={onApplyCoupon}
              className="px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase transition-all cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Formas de Pagamento ({visibleMethods.length})
            </h4>
            {onOpenExchangeModal && (
              <button
                type="button"
                onClick={onOpenExchangeModal}
                className="text-[9px] font-black text-pink-400 hover:text-pink-300 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={11} /> TROCA / DEVOL.
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {visibleMethods.map((method) => {
              const Icon = method.icon;
              const isSelected = selectedMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setSelectedMethod(method.id)}
                  disabled={selectedItems.length === 0 || isFinishing}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl transition-all group disabled:opacity-50 cursor-pointer ${
                    isSelected
                      ? method.activeClass
                      : 'bg-slate-950 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <Icon size={18} className={`${method.iconClass} group-hover:scale-110 transition-transform`} />
                  <span className="text-[10px] font-black">{method.label}</span>
                </button>
              );
            })}
          </div>

          {selectedMethod === 'CASH' && (
            <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase text-amber-400">Valor Recebido (R$)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={netTotal.toFixed(2)}
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  className="w-24 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-right text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              {changeAmount > 0 && (
                <div className="flex items-center justify-between text-[10px] font-black text-emerald-400 pt-1 border-t border-slate-800">
                  <span>TROCO</span>
                  <span className="font-mono">R$ {changeAmount.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {hasLowStock && (
          <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-500" />
            <p className="text-[10px] font-bold text-red-200 uppercase">
              Alerta: Itens com estoque baixo identificados no catálogo!
            </p>
          </div>
        )}
      </div>

      <div className="p-6 bg-slate-950 border-t border-slate-800">
        <button
          onClick={() => onFinish(selectedMethod)}
          disabled={selectedItems.length === 0 || isFinishing}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <span className="text-sm">
            FINALIZAR VENDA ({RETAIL_PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.label || selectedMethod} - ENTER)
          </span>
          <ArrowRight size={18} />
        </button>
        <div className="mt-4 flex justify-between text-[9px] font-mono text-slate-500 font-bold uppercase">
          <span>Operador: {operatorName || 'Operador Balcão'}</span>
          <span>Caixa: {terminalLabel || 'PDV-01'}</span>
        </div>
      </div>
    </div>
  );
};
