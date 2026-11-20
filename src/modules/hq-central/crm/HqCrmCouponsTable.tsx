import React, { useState } from 'react';
import { Pause, Play, Trash2 } from 'lucide-react';
import { CouponCampaign, CouponAudience } from '../../../types';

interface HqCrmCouponsTableProps {
  activeAudienceTab: CouponAudience;
  consumerCoupons: CouponCampaign[];
  merchantCoupons: CouponCampaign[];
  onToggleCouponStatus: (id: string, nextStatus: boolean) => void;
  onDeleteCoupon: (id: string) => void;
}

export const HqCrmCouponsTable: React.FC<HqCrmCouponsTableProps> = ({
  activeAudienceTab,
  consumerCoupons,
  merchantCoupons,
  onToggleCouponStatus,
  onDeleteCoupon,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (activeAudienceTab === 'CONSUMER') {
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase font-mono">
            <tr>
              <th className="px-4 py-3">Código (Consumidor)</th>
              <th className="px-4 py-3">Campanha / Escopo</th>
              <th className="px-4 py-3">Desconto</th>
              <th className="px-4 py-3">Pedido Mín.</th>
              <th className="px-4 py-3">Validade</th>
              <th className="px-4 py-3">Uso / Limite</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {consumerCoupons.map((c) => (
              <tr key={c.id} className="hover:bg-slate-800/40">
                <td className="px-4 py-3 font-mono font-bold text-emerald-400">{c.code}</td>
                <td className="px-4 py-3">
                  <div className="text-slate-200 font-medium">
                    {c.description || 'Campanha Global Marketplace'}
                  </div>
                  <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-mono text-emerald-300">
                    B2C • CONSUMIDOR FINAL
                  </span>
                </td>
                <td className="px-4 py-3 font-mono tabular-nums font-bold text-emerald-400">
                  {c.discountType === 'FIXED'
                    ? `R$ ${Number(c.discountValue).toFixed(2)} OFF`
                    : `${c.discountValue}% OFF`}
                  {c.maxDiscount ? (
                    <span className="block text-[10px] text-slate-400 font-normal">
                      Teto R$ {Number(c.maxDiscount).toFixed(2)}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums">
                  R$ {Number(c.minOrderValue || 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums text-slate-400">
                  {c.validUntil || 'Sem prazo'}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums text-slate-400">
                  {c.usageCount || 0} / {c.usageLimit || 1000}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded border font-bold font-mono text-[10px] ${
                      c.isActive !== false
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {c.isActive !== false ? 'ATIVO' : 'PAUSADO'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onToggleCouponStatus(c.id, c.isActive === false)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title={c.isActive !== false ? 'Pausar campanha' : 'Reativar campanha'}
                    >
                      {c.isActive !== false ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </button>
                    {confirmDeleteId === c.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteCoupon(c.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black transition-colors cursor-pointer"
                        >
                          Excluir
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold transition-colors cursor-pointer"
                        >
                          Voltar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(c.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                        title="Excluir campanha de consumidor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {consumerCoupons.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500 italic">
                  Nenhum cupom global para consumidores encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-left text-xs text-slate-300">
        <thead className="bg-slate-950 text-slate-400 uppercase font-mono">
          <tr>
            <th className="px-4 py-3">Código (Lojista SaaS)</th>
            <th className="px-4 py-3">Planos Elegíveis / Regra</th>
            <th className="px-4 py-3">Desconto SaaS</th>
            <th className="px-4 py-3">Fatura Mín.</th>
            <th className="px-4 py-3">Validade</th>
            <th className="px-4 py-3">Uso / Limite</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {merchantCoupons.map((c) => (
            <tr key={c.id} className="hover:bg-slate-800/40">
              <td className="px-4 py-3 font-mono font-bold text-amber-400">{c.code}</td>
              <td className="px-4 py-3 space-y-1">
                <div className="text-slate-200 font-medium">
                  {c.description || 'Desconto em assinatura / upgrade de plano'}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-mono text-amber-300">
                    B2B • LOJISTA SAAS
                  </span>
                  {Array.isArray(c.applicablePlans) && c.applicablePlans.length > 0 ? (
                    c.applicablePlans.map((plan) => (
                      <span
                        key={plan}
                        className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[9px] font-mono text-slate-200"
                      >
                        {plan}
                      </span>
                    ))
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[9px] font-mono text-slate-300">
                      TODOS OS PLANOS
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 font-mono tabular-nums font-bold text-amber-300">
                {c.discountType === 'FIXED'
                  ? `R$ ${Number(c.discountValue).toFixed(2)} OFF`
                  : `${c.discountValue}% OFF`}
                {c.maxDiscount ? (
                  <span className="block text-[10px] text-slate-400 font-normal">
                    Teto R$ {Number(c.maxDiscount).toFixed(2)}
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3 font-mono tabular-nums">
                R$ {Number(c.minOrderValue || 0).toFixed(2)}
              </td>
              <td className="px-4 py-3 font-mono tabular-nums text-slate-400">
                {c.validUntil || 'Sem prazo'}
              </td>
              <td className="px-4 py-3 font-mono tabular-nums text-slate-400">
                {c.usageCount || 0} / {c.usageLimit || 200}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-0.5 rounded border font-bold font-mono text-[10px] ${
                    c.isActive !== false
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {c.isActive !== false ? 'ATIVO' : 'PAUSADO'}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onToggleCouponStatus(c.id, c.isActive === false)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title={c.isActive !== false ? 'Pausar cupom SaaS' : 'Reativar cupom SaaS'}
                  >
                    {c.isActive !== false ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </button>
                  {confirmDeleteId === c.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteCoupon(c.id);
                          setConfirmDeleteId(null);
                        }}
                        className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black transition-colors cursor-pointer"
                      >
                        Excluir
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        Voltar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(c.id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                      title="Excluir cupom SaaS"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {merchantCoupons.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-500 italic">
                Nenhum cupom SaaS para lojistas cadastrado. Crie acima para oferecer descontos em upgrades de planos.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
