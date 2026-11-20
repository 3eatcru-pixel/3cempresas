import React from 'react';
import { ChevronDown, ChevronRight, Store as StoreIcon } from 'lucide-react';
import { CouponCampaign, Store } from '../../../types';

interface HqStorePrivateCouponsAuditProps {
  storePrivateCoupons: CouponCampaign[];
  stores: Store[];
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const HqStorePrivateCouponsAudit: React.FC<HqStorePrivateCouponsAuditProps> = ({
  storePrivateCoupons,
  stores,
  isOpen,
  onToggleOpen,
}) => {
  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
      <button
        type="button"
        onClick={onToggleOpen}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <StoreIcon className="w-4 h-4 text-slate-400" />
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider">
              Auditoria Somente Leitura: Cupons Privados Criados pelas Lojas ({storePrivateCoupons.length})
            </div>
            <div className="text-[11px] text-slate-500">
              Cupons B2C criados individualmente por cada estabelecimento para seus próprios consumidores (isolados do HQ Global e dos planos SaaS).
            </div>
          </div>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-slate-800 overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-500 uppercase font-mono">
              <tr>
                <th className="px-4 py-2.5">Loja Emissora</th>
                <th className="px-4 py-2.5">Código</th>
                <th className="px-4 py-2.5">Desconto</th>
                <th className="px-4 py-2.5">Uso</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {storePrivateCoupons.map((c) => {
                const ownerStore = stores.find((s) => s.id === c.storeId);
                return (
                  <tr key={c.id} className="hover:bg-slate-800/20">
                    <td className="px-4 py-2.5 text-slate-300 font-medium">
                      {ownerStore?.name || c.storeId}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-200">{c.code}</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-slate-300">
                      {c.discountType === 'FIXED'
                        ? `R$ ${Number(c.discountValue).toFixed(2)}`
                        : `${c.discountValue}%`}
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-slate-400">
                      {c.usageCount || 0} / {c.usageLimit || 0}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10px]">
                      <span className={c.isActive !== false ? 'text-emerald-400' : 'text-slate-500'}>
                        {c.isActive !== false ? 'ATIVO' : 'PAUSADO'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {storePrivateCoupons.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500 italic">
                    Nenhum cupom privado criado por lojas até o momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
