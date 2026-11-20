import React, { useMemo, useState } from 'react';
import { Users, CheckCircle2, Search } from 'lucide-react';
import { CustomerCRM } from '../../../../types';

interface WhatsAppAudienceSidebarProps {
  customers: CustomerCRM[];
  selectedCustomers: string[];
  onToggleCustomer: (id: string) => void;
  onSelectSubset: (ids: string[]) => void;
}

type SegmentType = 'ALL' | 'VIP' | 'RECURRING';

export const WhatsAppAudienceSidebar: React.FC<WhatsAppAudienceSidebarProps> = ({
  customers,
  selectedCustomers,
  onToggleCustomer,
  onSelectSubset,
}) => {
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<SegmentType>('ALL');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      if (segment === 'VIP' && c.loyaltyTier !== 'GOLD' && c.loyaltyTier !== 'PLATINUM') {
        return false;
      }
      if (segment === 'RECURRING' && (c.totalOrders || 0) < 2) {
        return false;
      }
      if (!q) return true;
      return (
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      );
    });
  }, [customers, query, segment]);

  return (
    <div className="w-full md:w-80 border-r border-slate-800 bg-slate-950 flex flex-col overflow-hidden shrink-0">
      <div className="p-4 border-b border-slate-800 bg-slate-900/60 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold flex items-center gap-2 text-slate-200">
            <Users size={14} className="text-blue-400" />
            Público Alvo ({selectedCustomers.length}/{customers.length})
          </h2>
          <button
            type="button"
            onClick={() =>
              selectedCustomers.length === filtered.length && filtered.length > 0
                ? onSelectSubset([])
                : onSelectSubset(filtered.map((c) => c.id))
            }
            className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 cursor-pointer"
          >
            {selectedCustomers.length === filtered.length && filtered.length > 0
              ? 'Limpar'
              : 'Marcar visíveis'}
          </button>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Filtrar cliente ou telefone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
          />
          <Search size={13} className="text-slate-500 absolute right-2.5 top-2" />
        </div>

        <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
          {(
            [
              { id: 'ALL', label: 'Todos' },
              { id: 'VIP', label: 'VIPs' },
              { id: 'RECURRING', label: 'Recorrentes' },
            ] as const
          ).map((seg) => (
            <button
              key={seg.id}
              type="button"
              onClick={() => setSegment(seg.id)}
              className={`py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                segment === seg.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {seg.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
        {filtered.map((customer) => {
          const isSelected = selectedCustomers.includes(customer.id);
          return (
            <button
              type="button"
              key={customer.id}
              onClick={() => onToggleCustomer(customer.id)}
              className={`w-full text-left p-3.5 cursor-pointer transition-colors flex items-center gap-3 ${
                isSelected ? 'bg-blue-500/10' : 'hover:bg-slate-900/60'
              }`}
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                  isSelected
                    ? 'bg-blue-500 border-blue-500 text-slate-950'
                    : 'border-slate-700'
                }`}
              >
                {isSelected && <CheckCircle2 size={10} strokeWidth={3} />}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-bold truncate ${
                    isSelected ? 'text-white' : 'text-slate-300'
                  }`}
                >
                  {customer.name}
                </p>
                <p className="text-[11px] text-slate-500 truncate font-mono">
                  {customer.phone} · {customer.totalOrders || 0} ped.
                </p>
              </div>
              {customer.loyaltyTier && (
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase shrink-0">
                  {customer.loyaltyTier}
                </span>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-6 text-center text-xs text-slate-500">
            Nenhum cliente encontrado neste segmento.
          </div>
        )}
      </div>
    </div>
  );
};
