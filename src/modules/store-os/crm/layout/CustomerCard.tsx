import React from 'react';
import { Eye, MessageSquare, StickyNote } from 'lucide-react';
import { CustomerCRM, Store } from '../../../../types';

interface CustomerCardProps {
  customer: CustomerCRM;
  currentStore: Store;
  onShowNotification: (msg: string) => void;
  onOpenDetails: (customer: CustomerCRM) => void;
}

export const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  currentStore,
  onShowNotification,
  onOpenDetails,
}) => {
  const tier = customer.loyaltyTier || 'BRONZE';
  const phoneDigits = String(customer.phone || '').replace(/\D/g, '');
  const waHref = `https://wa.me/${phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`}?text=${encodeURIComponent(
    `Olá ${customer.name}! Tudo bem? Sentimos sua falta aqui no ${currentStore.name}. Dá uma olhada nas nossas novidades hoje!`
  )}`;

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 space-y-4 hover:border-blue-500/40 transition-colors group flex flex-col justify-between">
      <div className="space-y-3.5">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-base shrink-0">
              {(customer.name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => onOpenDetails(customer)}
                className="text-white font-bold text-sm group-hover:text-blue-400 transition-colors truncate block text-left cursor-pointer max-w-full"
              >
                {customer.name}
              </button>
              <div className="text-[11px] text-slate-400 font-mono truncate">{customer.phone}</div>
              {customer.email && (
                <div className="text-[10px] text-slate-500 font-mono truncate">{customer.email}</div>
              )}
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase shrink-0 ${
              tier === 'PLATINUM'
                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                : tier === 'GOLD'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : tier === 'SILVER'
                ? 'bg-slate-400/10 text-slate-300 border-slate-400/30'
                : 'bg-orange-500/10 text-orange-400 border-orange-500/30'
            }`}
          >
            {tier}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
            <div className="text-[9px] text-slate-500 font-bold uppercase mb-0.5">Total Gasto</div>
            <div className="text-xs font-black text-emerald-400 font-mono tabular-nums">
              R$ {(customer.totalSpent || 0).toFixed(2)}
            </div>
          </div>
          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
            <div className="text-[9px] text-slate-500 font-bold uppercase mb-0.5">Pedidos</div>
            <div className="text-xs font-black text-white font-mono tabular-nums">
              {customer.totalOrders || 0}
            </div>
          </div>
          <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
            <div className="text-[9px] text-slate-500 font-bold uppercase mb-0.5">Pontos</div>
            <div className="text-xs font-black text-amber-400 font-mono tabular-nums">
              {customer.loyaltyPoints || 0}
            </div>
          </div>
        </div>

        {customer.notes && (
          <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-xl bg-slate-950/50 border border-slate-800/60 text-[11px] text-slate-400">
            <StickyNote size={12} className="text-slate-500 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{customer.notes}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-800/70 gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpenDetails(customer)}
            className="px-2.5 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 rounded-xl transition-colors flex items-center gap-1.5 text-[11px] font-bold cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Perfil 360°</span>
          </button>
          {phoneDigits && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                onShowNotification(
                  `Abrindo WhatsApp direto para ${customer.name} (Zero Taxa de Mensageria)`
                )
              }
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 rounded-xl transition-colors flex items-center gap-1.5 text-[11px] font-bold cursor-pointer"
              title="Chamar no WhatsApp Direto"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>WhatsApp</span>
            </a>
          )}
        </div>
        <span className="text-[10px] text-slate-500 font-mono truncate">
          {customer.lastOrderDate || 'Sem pedidos'}
        </span>
      </div>
    </div>
  );
};
