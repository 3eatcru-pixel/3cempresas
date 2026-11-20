import React from 'react';
import { TicketPercent } from 'lucide-react';
import { CouponCampaign } from '../../../types';

interface CheckoutSummaryBoxProps {
  coupon: string;
  setCoupon: (coupon: string) => void;
  cartTotal: number;
  effectiveDeliveryFee: number;
  courierTip: number;
  discount?: number;
  couponApplied?: boolean;
  couponInvalid?: boolean;
  total: number;
  activeModality?: 'DELIVERY' | 'PICKUP' | 'TABLE';
  tableNumber?: number;
  isOpenTableTab?: boolean;
  availableCoupons?: CouponCampaign[];
}

export const CheckoutSummaryBox: React.FC<CheckoutSummaryBoxProps> = ({
  coupon,
  setCoupon,
  cartTotal,
  effectiveDeliveryFee,
  courierTip,
  discount = 0,
  couponApplied = false,
  couponInvalid = false,
  total,
  activeModality = 'DELIVERY',
  tableNumber,
  isOpenTableTab = false,
  availableCoupons = [],
}) => {
  return (
    <div className="space-y-3">
      {/* Cupom Promocional (Opcional) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
            <TicketPercent className="w-3.5 h-3.5 text-amber-400" /> Cupom Promocional (Opcional)
          </label>
          {couponApplied && discount > 0 && (
            <span className="text-[10px] font-bold text-emerald-400">Cupom aplicado!</span>
          )}
          {couponInvalid && (
            <span className="text-[10px] font-bold text-amber-400">Cupom inválido ou não elegível</span>
          )}
        </div>
        {availableCoupons.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {availableCoupons.map((c) => {
              const isSelected = coupon.trim().toUpperCase() === c.code.toUpperCase();
              const label =
                c.discountType === 'PERCENT'
                  ? `${c.code} (-${c.discountValue}%)`
                  : `${c.code} (-R$ ${(c.discountValue || 0).toFixed(0)})`;
              return (
                <button
                  key={c.id || c.code}
                  type="button"
                  onClick={() => setCoupon(isSelected ? '' : c.code)}
                  className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-amber-300 hover:border-amber-500/50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
        <input
          type="text"
          placeholder="Ex: BEMVINDO10"
          value={coupon}
          onChange={(e) => setCoupon(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none uppercase font-mono"
        />
      </div>

      {/* Totais contextualizados por modalidade */}
      <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1.5 text-xs font-mono">
        <div className="flex justify-between text-slate-400">
          <span>{activeModality === 'TABLE' ? 'Subtotal da Rodada:' : 'Subtotal Itens:'}</span>
          <span>R$ {cartTotal.toFixed(2)}</span>
        </div>

        {discount > 0 && (
          <div className="flex justify-between text-emerald-400 font-bold">
            <span>Desconto Cupom ({coupon.trim().toUpperCase()}):</span>
            <span>- R$ {discount.toFixed(2)}</span>
          </div>
        )}

        {activeModality === 'DELIVERY' ? (
          <>
            <div className="flex justify-between text-slate-400">
              <span>Taxa de Entrega:</span>
              <span className={effectiveDeliveryFee === 0 ? 'text-emerald-400 font-bold' : ''}>
                {effectiveDeliveryFee === 0 ? 'Grátis' : `R$ ${effectiveDeliveryFee.toFixed(2)}`}
              </span>
            </div>
            {courierTip > 0 && (
              <div className="flex justify-between text-pink-400">
                <span>Gorjeta Motoboy (Opcional):</span>
                <span>+ R$ {courierTip.toFixed(2)}</span>
              </div>
            )}
          </>
        ) : activeModality === 'TABLE' ? (
          <>
            <div className="flex justify-between text-amber-400">
              <span>Consumo no Local:</span>
              <span className="font-bold">Mesa {String(tableNumber || 1).padStart(2, '0')} • Taxa R$ 0,00</span>
            </div>
            {isOpenTableTab && (
              <div className="flex justify-between text-emerald-400 text-[11px]">
                <span>Cobrança:</span>
                <span className="font-bold">Comanda Aberta (Pagar ao fechar)</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex justify-between text-blue-400">
            <span>Retirada no Balcão:</span>
            <span className="font-bold">Taxa R$ 0,00</span>
          </div>
        )}

        <div className="flex justify-between text-white font-bold border-t border-slate-800 pt-1.5 text-sm">
          <span>{isOpenTableTab ? 'Valor Lançado na Comanda:' : 'Total Final:'}</span>
          <span className="text-emerald-400 font-black">R$ {total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};
