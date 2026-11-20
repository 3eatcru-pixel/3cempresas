import React from 'react';
import { Package, Store, MapPin, ArrowRight, CreditCard, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Order } from '../../../types';

interface DriverAvailableOrdersListProps {
  availableOrders: Order[];
  currentDriverId?: string;
  isOnline?: boolean;
  acceptingOrderId?: string | null;
  onSelectOrder: (order: Order) => void;
  onAcceptDelivery: (orderId: string) => void;
}

const getOrderPayout = (order: Order) =>
  Math.round(((Number(order.deliveryFee) || 0) + (Number((order as any).courierTip) || 0)) * 100) / 100;

export const formatDriverPaymentLabel = (method?: string) => {
  switch (method) {
    case 'PIX':
      return 'PIX';
    case 'CREDIT_CARD':
    case 'CREDIT':
      return 'Cartão de Crédito';
    case 'DEBIT_CARD':
    case 'DEBIT':
      return 'Cartão de Débito';
    case 'CASH':
      return 'Dinheiro';
    case 'BOLETO':
      return 'Boleto Bancário';
    case 'BANK_TRANSFER':
      return 'TED / Transferência';
    case 'PAYMENT_LINK':
      return 'Link de Pagamento';
    case 'TABLE_BILL':
      return 'Conta da Mesa';
    default:
      return method || 'Cartão / PIX';
  }
};

export const DriverAvailableOrdersList: React.FC<DriverAvailableOrdersListProps> = ({
  availableOrders,
  currentDriverId,
  isOnline = true,
  acceptingOrderId = null,
  onSelectOrder,
  onAcceptDelivery,
}) => {
  if (availableOrders.length === 0) {
    return (
      <div className="bg-[#111922] border border-slate-800 rounded-2xl p-8 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-[#00CCBC]/10 border border-[#00CCBC]/20 text-[#00CCBC] flex items-center justify-center mx-auto">
          <Package className="w-7 h-7" />
        </div>
        <h3 className="text-base font-extrabold text-white">Nenhuma entrega disponível</h3>
        <p className="text-xs text-slate-400 max-w-xs mx-auto">
          No momento não há pedidos prontos para coleta nesta modalidade.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      {availableOrders.map((order) => {
        const payout = getOrderPayout(order);
        const isDirectDispatch = Boolean(currentDriverId && order.driverId === currentDriverId);
        const isStoreModality = order.deliveryModality === 'STORE_FLEET' || isDirectDispatch;
        const isPaid = order.paymentStatus === 'PAID';
        const paymentLabel = formatDriverPaymentLabel(order.paymentMethod);

        return (
          <div
            key={order.id}
            className={`bg-[#111922] rounded-2xl p-4 space-y-3 transition-all shadow-md border ${
              isDirectDispatch ? 'border-[#00CCBC]' : 'border-slate-800 hover:border-[#00CCBC]/50'
            }`}
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#00CCBC]/10 text-[#00CCBC] flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-extrabold text-white truncate">
                    {order.storeName}
                  </h4>
                  <span
                    className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                      isDirectDispatch
                        ? 'bg-[#00CCBC]/15 text-[#00CCBC] border-[#00CCBC]/30'
                        : isStoreModality
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                    }`}
                  >
                    {isDirectDispatch
                      ? 'Despacho Direto da Loja'
                      : isStoreModality
                      ? 'Frota da Loja'
                      : 'Plataforma Aberta'}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Repasse</span>
                <span className="text-base font-black text-[#00CCBC] font-mono tabular-nums">
                  R$ {payout.toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-1.5">
              <div className="flex items-center justify-between text-slate-400">
                <span>
                  Pedido <strong className="text-white font-mono">{order.code}</strong>
                </span>
                <span className="tabular-nums">{order.items.length} {order.items.length === 1 ? 'item' : 'itens'}</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-300 bg-[#0B1117] px-2 py-0.5 rounded-md border border-slate-800">
                  <CreditCard className="w-3 h-3 text-[#00CCBC]" />
                  {paymentLabel}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md border ${
                    isPaid
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {isPaid ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> PAGO (NÃO COBRAR)
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3" /> COBRAR NA ENTREGA (R$ {order.total.toFixed(2).replace('.', ',')})
                    </>
                  )}
                </span>
              </div>

              <p className="text-slate-300 flex items-start gap-1.5 text-xs pt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#00CCBC] shrink-0 mt-0.5" />
                <span className="line-clamp-2">{order.deliveryAddress || 'Retirada no balcão'}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onSelectOrder(order)}
                className="min-h-[44px] flex-1 py-2.5 bg-[#0B1117] hover:bg-slate-800 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all text-center cursor-pointer"
              >
                Detalhes
              </button>
              <button
                type="button"
                disabled={!isOnline || Boolean(acceptingOrderId)}
                onClick={() => onAcceptDelivery(order.id)}
                className="min-h-[44px] flex-1 py-2.5 bg-[#00CCBC] hover:bg-[#00b5a7] disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {acceptingOrderId === order.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Aceitando...</span>
                  </>
                ) : !isOnline ? (
                  <span>Fique Online</span>
                ) : (
                  <>
                    <span>{isDirectDispatch ? 'Iniciar Coleta' : 'Aceitar'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
