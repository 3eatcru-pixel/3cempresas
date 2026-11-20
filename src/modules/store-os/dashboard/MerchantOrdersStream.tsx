import React, { useMemo, useState } from 'react';
import { BarChart3, ArrowRight, ChefHat } from 'lucide-react';
import { Order } from '../../../types';
import { WindowAppId } from '../layout/storeOsAppsList';

interface MerchantOrdersStreamProps {
  todayOrders: Order[];
  onOpenApp?: (appId: WindowAppId, title: string) => void;
}

type StreamFilter = 'ALL' | 'OPEN' | 'COMPLETED';

const ORDER_STATUS_META: Record<string, { label: string; colorClass: string }> = {
  PENDING: { label: 'Pendente', colorClass: 'text-amber-400' },
  CONFIRMED: { label: 'Confirmado', colorClass: 'text-sky-400' },
  IN_PREPARATION: { label: 'Em Preparo', colorClass: 'text-amber-300' },
  READY: { label: 'Pronto', colorClass: 'text-cyan-400' },
  OUT_FOR_DELIVERY: { label: 'Em Entrega', colorClass: 'text-indigo-400' },
  DELIVERED: { label: 'Concluído', colorClass: 'text-emerald-400' },
  CANCELLED: { label: 'Cancelado', colorClass: 'text-rose-400' },
};

const PAYMENT_SHORT_LABEL: Record<string, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Crédito',
  DEBIT_CARD: 'Débito',
  CASH: 'Dinheiro',
  BOLETO: 'Boleto',
  BANK_TRANSFER: 'Transferência',
  PAYMENT_LINK: 'Link',
};

const CHANNEL_SHORT_LABEL: Record<string, string> = {
  MARKETPLACE: 'Marketplace',
  POS: 'PDV',
  KIOSK: 'Totem',
  WAITER: 'Garçom',
  TABLE: 'Mesa',
};

export const MerchantOrdersStream: React.FC<MerchantOrdersStreamProps> = ({
  todayOrders,
  onOpenApp,
}) => {
  const [showAll, setShowAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StreamFilter>('ALL');

  const counts = useMemo(() => {
    const open = todayOrders.filter(
      (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
    ).length;
    const completed = todayOrders.filter((o) => o.status === 'DELIVERED').length;
    return { all: todayOrders.length, open, completed };
  }, [todayOrders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'OPEN') {
      return todayOrders.filter(
        (o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'
      );
    }
    if (statusFilter === 'COMPLETED') {
      return todayOrders.filter((o) => o.status === 'DELIVERED');
    }
    return todayOrders;
  }, [todayOrders, statusFilter]);

  const displayedOrders = showAll ? filteredOrders : filteredOrders.slice(0, 8);

  return (
    <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex flex-wrap justify-between items-center gap-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-500" /> Fluxo de Pedidos de Hoje
        </h3>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
            {(
              [
                { id: 'ALL', label: `Todos (${counts.all})` },
                { id: 'OPEN', label: `Em Aberto (${counts.open})` },
                { id: 'COMPLETED', label: `Concluídos (${counts.completed})` },
              ] as Array<{ id: StreamFilter; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap tabular-nums cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {onOpenApp && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenApp('kds', 'KDS Cozinha')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <ChefHat className="w-3.5 h-3.5 text-purple-400" /> KDS
              </button>
              <button
                type="button"
                onClick={() => onOpenApp('pdv', 'PDV Balcão')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
              >
                Abrir PDV <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-400 font-medium border-b border-slate-800 bg-slate-950/40">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Cliente e Canal</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {displayedOrders.map((order) => {
              const statusInfo = ORDER_STATUS_META[order.status] || {
                label: order.status,
                colorClass: 'text-slate-300',
              };
              const channelLabel =
                CHANNEL_SHORT_LABEL[String(order.channel || '').toUpperCase()] ||
                order.channel ||
                'PDV';
              const paymentLabel =
                PAYMENT_SHORT_LABEL[String(order.paymentMethod || '').toUpperCase()] ||
                order.paymentMethod ||
                '';

              return (
                <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono tabular-nums font-semibold text-amber-400 whitespace-nowrap">
                    {order.code}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{order.customerName}</div>
                    <div className="text-[11px] text-slate-400">
                      <span>{channelLabel}</span>
                      {paymentLabel && (
                        <>
                          <span className="mx-1.5 text-slate-600">·</span>
                          <span>{paymentLabel}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`font-semibold ${statusInfo.colorClass}`}>
                      {statusInfo.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-white whitespace-nowrap">
                    R$ {order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
            {displayedOrders.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  {todayOrders.length === 0
                    ? 'Nenhum pedido recebido hoje ainda.'
                    : 'Nenhum pedido corresponde ao filtro selecionado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredOrders.length > 8 && (
        <div className="px-4 py-2.5 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            {showAll ? 'Mostrar menos' : `Ver todos (${filteredOrders.length})`}
          </button>
        </div>
      )}
    </div>
  );
};

