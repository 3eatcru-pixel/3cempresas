import React, { useMemo, useState } from 'react';
import { Award, Search, User, X } from 'lucide-react';
import { CustomerCRM } from '../../../../types';

interface PosCustomerPickerProps {
  customers: CustomerCRM[];
  selectedCustomer: CustomerCRM | null;
  onSelectCustomer: (customer: CustomerCRM | null) => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  placeholder?: string;
  compact?: boolean;
}

export const PosCustomerPicker: React.FC<PosCustomerPickerProps> = ({
  customers,
  selectedCustomer,
  onSelectCustomer,
  customerName,
  setCustomerName,
  placeholder = 'Buscar cliente CRM ou digitar nome...',
  compact = false,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const matches = useMemo(() => {
    const q = customerName.trim().toLowerCase();
    if (!q) return customers.slice(0, 5);
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [customers, customerName]);

  if (selectedCustomer) {
    return (
      <div className="bg-slate-950 border border-amber-500/40 rounded-xl p-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black text-xs shrink-0">
              {selectedCustomer.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate leading-tight">
                {selectedCustomer.name}
              </p>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                {selectedCustomer.phone || 'Sem telefone'} · {selectedCustomer.loyaltyTier}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelectCustomer(null);
              setCustomerName('');
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Desvincular cliente CRM"
          >
            <X size={13} />
          </button>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80 font-mono tabular-nums">
          <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
            <Award size={11} /> {selectedCustomer.loyaltyPoints || 0} pts
          </span>
          <span>
            {selectedCustomer.totalOrders || 0} ped. · R$ {(selectedCustomer.totalSpent || 0).toFixed(2)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-3.5 h-3.5" />
        <input
          type="text"
          placeholder={placeholder}
          value={customerName}
          onFocus={() => setIsDropdownOpen(true)}
          onBlur={() => setTimeout(() => setIsDropdownOpen(false), 160)}
          onChange={(e) => {
            setCustomerName(e.target.value);
            setIsDropdownOpen(true);
          }}
          className={`w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 ${
            compact ? 'py-2 text-xs' : 'py-2.5 text-xs'
          } font-medium text-white placeholder-slate-500 focus:outline-none focus:border-amber-500`}
        />
        {customers.length > 0 && (
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 w-3.5 h-3.5 pointer-events-none" />
        )}
      </div>

      {isDropdownOpen && matches.length > 0 && (
        <div className="absolute left-0 right-0 mt-1.5 z-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
          <div className="px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
            <span>Clientes CRM ({matches.length})</span>
            <span className="text-amber-400">Pontua Fidelidade</span>
          </div>
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectCustomer(c);
                setCustomerName(c.name);
                setIsDropdownOpen(false);
              }}
              className="w-full px-3 py-2 text-left hover:bg-slate-800/80 border-b border-slate-800/50 last:border-0 flex items-center justify-between gap-2 transition-colors cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{c.name}</p>
                <p className="text-[10px] text-slate-400 font-mono truncate">
                  {c.phone || c.email || 'Sem contato'}
                </p>
              </div>
              <div className="text-right shrink-0 font-mono tabular-nums">
                <span className="block text-[10px] font-bold text-amber-400">{c.loyaltyTier}</span>
                <span className="block text-[10px] text-slate-400">{c.loyaltyPoints || 0} pts</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
