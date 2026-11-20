import React, { useState, useEffect } from 'react';
import { CreditCard, Check, X } from 'lucide-react';
import { SubscriptionPlanTier, PlatformGovernance } from '../../../types';
import { SAAS_PLAN_TIERS } from '../../../constants/platformDefaults';
import { getDefaultBranchesForPlan, getDefaultDevicesForPlan } from '../../../utils/storeDomain';

interface HqPlanPricingModalProps {
  editingTier: SubscriptionPlanTier | null;
  governance: PlatformGovernance;
  onClose: () => void;
  onSave: (tier: SubscriptionPlanTier, pricing: { monthlyPrice: number; quarterlyPrice: number; annualPrice: number; maxDevices: number; maxBranches: number }) => Promise<void>;
}

export const HqPlanPricingModal: React.FC<HqPlanPricingModalProps> = ({
  editingTier,
  governance,
  onClose,
  onSave,
}) => {
  const [editMonthly, setEditMonthly] = useState<number>(149);
  const [editQuarterly, setEditQuarterly] = useState<number>(134.1);
  const [editAnnual, setEditAnnual] = useState<number>(111.75);
  const [editMaxBranches, setEditMaxBranches] = useState<number>(1);
  const [editMaxDevices, setEditMaxDevices] = useState<number>(5);

  useEffect(() => {
    if (editingTier) {
      const custom = governance.planPricing?.[editingTier];
      const defaultTier = SAAS_PLAN_TIERS.find(t => t.tier === editingTier);
      setEditMonthly(custom?.monthlyPrice ?? defaultTier?.monthlyPrice ?? 149);
      setEditQuarterly(custom?.quarterlyPrice ?? defaultTier?.quarterlyPrice ?? 134.1);
      setEditAnnual(custom?.annualPrice ?? defaultTier?.annualPrice ?? 111.75);
      setEditMaxBranches(custom?.maxBranches ?? defaultTier?.maxBranches ?? getDefaultBranchesForPlan(editingTier));
      setEditMaxDevices(custom?.maxDevices ?? defaultTier?.maxDevices ?? getDefaultDevicesForPlan(editingTier));
    }
  }, [editingTier, governance]);

  if (!editingTier) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(editingTier, {
      monthlyPrice: Number(editMonthly),
      quarterlyPrice: Number(editQuarterly),
      annualPrice: Number(editAnnual),
      maxDevices: Math.max(1, Number(editMaxDevices) || getDefaultDevicesForPlan(editingTier)),
      maxBranches: Math.max(1, Number(editMaxBranches) || 1),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-scaleIn"
      >
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-400" />
            <h3 className="font-black text-white text-base uppercase italic tracking-tighter">
              Customizar Preço • Plano {editingTier}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Defina os novos valores de cobrança para novas assinaturas e renovações deste plano no cluster:
        </p>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase">Preço Mensal Padrão (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={editMonthly}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                setEditMonthly(val);
                setEditQuarterly(Number((val * 0.9).toFixed(2)));
                setEditAnnual(Number((val * 0.75).toFixed(2)));
              }}
              className="w-full bg-slate-950 border border-slate-800 text-sm font-mono text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">Trimestral (R$/mês)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={editQuarterly}
                onChange={(e) => setEditQuarterly(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 p-2.5 rounded-xl focus:outline-none focus:border-emerald-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">Anual (R$/mês)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={editAnnual}
                onChange={(e) => setEditAnnual(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-amber-400 p-2.5 rounded-xl focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">Cota de Filiais</label>
              <input
                type="number"
                min="1"
                max="50"
                required
                value={editMaxBranches}
                onChange={(e) => setEditMaxBranches(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">Cota de Dispositivos</label>
              <input
                type="number"
                min="1"
                max="999"
                required
                value={editMaxDevices}
                onChange={(e) => setEditMaxDevices(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-950 border border-slate-800 text-xs font-mono text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" /> Salvar Novos Preços
          </button>
        </div>
      </form>
    </div>
  );
};
