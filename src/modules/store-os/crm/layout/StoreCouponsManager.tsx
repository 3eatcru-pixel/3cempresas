import React, { useMemo, useState } from 'react';
import { Pause, Play, Plus, Tag, Trash2, X } from 'lucide-react';
import { CouponCampaign, Store } from '../../../../types';

interface StoreCouponsManagerProps {
  currentStore: Store;
  coupons: CouponCampaign[];
  onCreateCoupon: (coupon: Omit<CouponCampaign, 'id'>) => Promise<void>;
  onToggleStatus: (id: string, nextActive: boolean) => Promise<void>;
  onDeleteCoupon: (id: string) => Promise<void>;
}

export const StoreCouponsManager: React.FC<StoreCouponsManagerProps> = ({
  currentStore,
  coupons,
  onCreateCoupon,
  onToggleStatus,
  onDeleteCoupon,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [discountValue, setDiscountValue] = useState('10');
  const [minOrderValue, setMinOrderValue] = useState('40');
  const [usageLimit, setUsageLimit] = useState('100');
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const storeOwnedCoupons = useMemo(
    () =>
      coupons.filter(
        (c) => !c._deleted && c.audience !== 'MERCHANT' && c.storeId === currentStore.id
      ),
    [coupons, currentStore.id]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '');
    const numericDiscount = Number(discountValue);
    const numericMin = Math.max(0, Number(minOrderValue) || 0);
    const numericLimit = Math.max(1, Math.round(Number(usageLimit) || 1));

    if (cleanCode.length < 2 || !Number.isFinite(numericDiscount) || numericDiscount <= 0) return;
    if (discountType === 'PERCENT' && numericDiscount > 100) return;

    setIsSubmitting(true);
    try {
      await onCreateCoupon({
        code: cleanCode,
        audience: 'CONSUMER',
        discountType,
        discountValue: numericDiscount,
        minOrderValue: numericMin,
        validUntil: validUntil ? new Date(`${validUntil}T23:59:59`).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString(),
        usageCount: 0,
        usageLimit: numericLimit,
        isActive: true,
        storeId: currentStore.id,
        tenantId: currentStore.tenantId,
        description: description.trim() || `Campanha exclusiva ${currentStore.name}`,
      });
      setCode('');
      setDescription('');
      setIsCreating(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Tag size={16} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
              Cupons Promocionais da Loja ({storeOwnedCoupons.length})
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Válidos na Vitrine do Marketplace e no PDV exclusivamente para {currentStore.name}.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsCreating((prev) => !prev)}
          className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          {isCreating ? <X size={14} /> : <Plus size={14} />}
          {isCreating ? 'Fechar Formulário' : 'Novo Cupom da Loja'}
        </button>
      </div>

      {isCreating && (
        <form
          onSubmit={handleSubmit}
          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Código *</label>
              <input
                type="text"
                required
                minLength={2}
                placeholder="EX: BEMVINDO10"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Tipo & Valor *</label>
              <div className="flex gap-1.5">
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'PERCENT' | 'FIXED')}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="PERCENT">%</option>
                  <option value="FIXED">R$</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={discountType === 'PERCENT' ? 100 : undefined}
                  required
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono tabular-nums font-bold text-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Pedido Mínimo (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={minOrderValue}
                onChange={(e) => setMinOrderValue(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">Limite & Validade</label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min="1"
                  step="1"
                  title="Limite de usos"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                  className="w-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                />
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <input
              type="text"
              placeholder="Descrição interna / regra da campanha (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Criando...' : 'Ativar Cupom'}
            </button>
          </div>
        </form>
      )}

      {storeOwnedCoupons.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <p className="text-xs font-semibold text-slate-500">
            Nenhum cupom exclusivo cadastrado para esta loja ainda.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-500">
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 px-3">Desconto</th>
                <th className="py-2 px-3">Mínimo</th>
                <th className="py-2 px-3">Usos</th>
                <th className="py-2 px-3">Validade</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 pl-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {storeOwnedCoupons.map((coupon) => {
                const isExpired =
                  coupon.validUntil && new Date(coupon.validUntil).getTime() < Date.now();
                return (
                  <tr key={coupon.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/50">
                    <td className="py-3 pr-3">
                      <div className="font-mono font-black text-slate-900 dark:text-white">
                        {coupon.code}
                      </div>
                      {coupon.description && (
                        <div className="text-[10px] text-slate-500 truncate max-w-[200px]">
                          {coupon.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums font-bold text-emerald-500">
                      {coupon.discountType === 'PERCENT'
                        ? `${coupon.discountValue}%`
                        : `R$ ${Number(coupon.discountValue || 0).toFixed(2)}`}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-slate-400">
                      R$ {Number(coupon.minOrderValue || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-slate-300">
                      {coupon.usageCount || 0} / {coupon.usageLimit || '∞'}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                      {coupon.validUntil
                        ? new Date(coupon.validUntil).toLocaleDateString('pt-BR')
                        : 'Sem prazo'}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase ${
                          isExpired
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : coupon.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                        }`}
                      >
                        {isExpired ? 'Expirado' : coupon.isActive ? 'Ativo' : 'Pausado'}
                      </span>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onToggleStatus(coupon.id, !coupon.isActive)}
                          title={coupon.isActive ? 'Pausar cupom' : 'Reativar cupom'}
                          className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/20 text-slate-500 hover:text-amber-400 rounded-lg transition-colors cursor-pointer"
                        >
                          {coupon.isActive ? <Pause size={13} /> : <Play size={13} />}
                        </button>
                        {confirmDeleteId === coupon.id ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteCoupon(coupon.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                          >
                            Confirmar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(coupon.id)}
                            title="Remover cupom"
                            className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
