import React, { useState } from 'react';
import { ShoppingBag, MapPin, Phone, AlertCircle, Clock, UtensilsCrossed, ShieldCheck } from 'lucide-react';
import { Order } from '../../../types';
import { useEcosystem } from '../../../context/EcosystemContext';

interface TrackingOrderSummaryProps {
  order: Order;
}

const PAYMENT_LABELS: Record<string, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  CASH: 'Dinheiro',
  BOLETO: 'Vale-Refeição',
  BANK_TRANSFER: 'Vale-Alimentação',
  PAYMENT_LINK: 'Carteira Digital',
  TABLE_BILL: 'Conta da Mesa',
};

export const TrackingOrderSummary: React.FC<TrackingOrderSummaryProps> = ({ order }) => {
  const { stores } = useEcosystem();
  const [logoFailed, setLogoFailed] = useState(false);
  const storeObj = stores.find((s) => s.id === order.storeId);
  const storeDisplayName = order.storeName || storeObj?.name || 'Estabelecimento';
  const storeInitials = storeDisplayName.slice(0, 2).toUpperCase();
  const driverDisplayName = order.driverName || 'Entregador Credenciado';
  const driverInitials = driverDisplayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || '')
    .join('')
    .toUpperCase() || 'EN';
  const paymentLabel = PAYMENT_LABELS[String(order.paymentMethod || '')] || order.paymentMethod || 'PIX';
  const isTableOrder = order.channel === 'TABLE' || order.channel === 'WAITER_TABLE';
  const isPickupOrder = order.channel === 'PICKUP';
  const isOpenTab = order.paymentMethod === 'TABLE_BILL';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Order Details */}
      <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 font-mono tabular-nums">
          <ShoppingBag className="w-4 h-4 text-amber-500" /> Resumo do Pedido {order.code}
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
            {storeObj?.logo && !logoFailed ? (
              <img
                src={storeObj.logo}
                alt={storeDisplayName}
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
                className="w-10 h-10 rounded-xl object-cover border border-slate-800 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-black font-mono text-amber-400 shrink-0">
                {storeInitials}
              </div>
            )}
            <div>
              <div className="text-xs font-bold text-white uppercase">
                {storeDisplayName}
              </div>
              <div className="text-[10px] text-slate-500">
                {isTableOrder
                  ? `Mesa ${String(order.tableNumber || 1).padStart(2, '0')} • Consumo no Salão`
                  : isPickupOrder
                  ? 'Retirada no Balcão'
                  : 'Delivery Local'}
              </div>
            </div>
          </div>
          <div className="space-y-1.5 px-1">
            {order.items.map((it, idx) => (
              <div key={it.id || idx} className="space-y-0.5">
                <div className="flex justify-between text-[11px] font-mono tabular-nums">
                  <span className="text-slate-300">
                    {it.quantity}x {it.name}
                    {it.variantLabel ? (
                      <span className="text-amber-400"> ({it.variantLabel})</span>
                    ) : null}
                  </span>
                  <span className="text-white">R$ {(it.price * it.quantity).toFixed(2)}</span>
                </div>
                {it.notes && (
                  <div className="text-[10px] text-slate-500 italic pl-3">Obs: {it.notes}</div>
                )}
              </div>
            ))}
          </div>

          {((order.discount || 0) > 0 || (order.deliveryFee || 0) > 0 || (order.courierTip || 0) > 0) && (
            <div className="pt-2 border-t border-slate-800/60 space-y-1 px-1 text-[10px] font-mono tabular-nums">
              {(order.discount || 0) > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Desconto Cupom {order.couponCode ? `(${order.couponCode})` : ''}:</span>
                  <span>- R$ {(order.discount || 0).toFixed(2)}</span>
                </div>
              )}
              {!isTableOrder && !isPickupOrder && (
                <div className="flex justify-between text-slate-400">
                  <span>Taxa de Entrega:</span>
                  <span>
                    {(order.deliveryFee || 0) === 0
                      ? 'Grátis'
                      : `R$ ${(order.deliveryFee || 0).toFixed(2)}`}
                  </span>
                </div>
              )}
              {(order.courierTip || 0) > 0 && (
                <div className="flex justify-between text-pink-400">
                  <span>Gorjeta Entregador:</span>
                  <span>+ R$ {(order.courierTip || 0).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex justify-between items-center px-1">
            <span className="text-xs font-bold text-slate-500">
              {isOpenTab ? 'Lançado na Comanda (Aberto)' : 'Total do Pedido'}
            </span>
            <span className="text-base font-black text-emerald-400 font-mono tabular-nums">R$ {order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Context-specific Atendimento / Logística Info */}
      <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
          {isTableOrder ? (
            <>
              <UtensilsCrossed className="w-4 h-4 text-amber-400" /> Atendimento na Mesa
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4 text-emerald-500" />{' '}
              {isPickupOrder ? 'Local de Retirada' : 'Logística de Entrega'}
            </>
          )}
        </h3>
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 font-bold uppercase">
              {isTableOrder ? 'Mesa & Salão' : isPickupOrder ? 'Ponto de Retirada' : 'Endereço de Destino'}
            </p>
            <p className="text-xs text-white leading-relaxed font-medium">
              {isTableOrder
                ? `Mesa ${String(order.tableNumber || 1).padStart(2, '0')} — ${
                    isOpenTab ? 'Pagamento ao fechar a conta na mesa.' : `Quitado via ${paymentLabel}`
                  }`
                : order.deliveryAddress || storeObj?.address || 'Retirada no Balcão da Loja'}
            </p>
          </div>

          {isTableOrder ? (
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center gap-3 text-amber-200">
              <UtensilsCrossed className="w-5 h-5 shrink-0 text-amber-400" />
              <p className="text-[11px] font-medium leading-tight">
                Sua rodada foi enviada diretamente para a cozinha. Um garçom entregará os itens na Mesa{' '}
                {String(order.tableNumber || 1).padStart(2, '0')} assim que ficarem prontos.
              </p>
            </div>
          ) : isPickupOrder ? (
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex items-center gap-3 text-blue-200">
              <ShoppingBag className="w-5 h-5 shrink-0 text-blue-400" />
              <p className="text-[11px] font-medium leading-tight">
                {order.status === 'READY_FOR_PICKUP'
                  ? 'Seu pedido já está pronto! Apresente o código no balcão para retirar.'
                  : 'Assim que o preparo finalizar, liberaremos o aviso para retirada sem fila.'}
              </p>
            </div>
          ) : order.driverId ? (
            <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-emerald-500 flex items-center justify-center font-mono text-xs font-black text-emerald-300 shrink-0">
                    {driverInitials}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white uppercase tracking-tight">
                      {driverDisplayName}
                    </p>
                    <p className="text-[11px] text-emerald-400 font-black">ENTREGADOR A CAMINHO</p>
                  </div>
                </div>
                {storeObj?.phone && (
                  <a
                    href={`tel:${storeObj.phone}`}
                    className="p-2 bg-emerald-500 text-slate-950 rounded-xl hover:scale-110 transition-transform cursor-pointer"
                    title="Contatar estabelecimento"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ) : order.status === 'READY_FOR_PICKUP' ? (
            <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl flex items-center gap-3 text-amber-200">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-[11px] font-medium leading-tight">
                Pedido pronto e aguardando coleta do entregador para despacho.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 opacity-30 gap-2 border-2 border-dashed border-slate-800 rounded-2xl">
              <Clock className="w-6 h-6" />
              <p className="text-[9px] font-bold uppercase tracking-widest text-center">Aguardando despacho...</p>
            </div>
          )}

          {!isTableOrder &&
            !isPickupOrder &&
            order.status !== 'DELIVERED' &&
            order.status !== 'CANCELLED' &&
            order.deliveryPin && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                      PIN de Confirmação na Entrega
                    </p>
                    <p className="text-[10px] text-amber-100/80 leading-tight mt-0.5">
                      Informe este código de 4 dígitos ao entregador somente ao receber seu pedido.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-amber-500/40 font-mono text-base font-black tracking-[0.25em] text-amber-400 shrink-0">
                  {order.deliveryPin}
                </span>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
