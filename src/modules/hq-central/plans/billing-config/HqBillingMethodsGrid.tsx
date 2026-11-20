import React from 'react';
import { CheckCheck } from 'lucide-react';
import { PlatformBillingPaymentConfig } from '../../../../types';
import { PAYMENT_METHOD_CARDS } from './constants';

interface HqBillingMethodsGridProps {
  form: PlatformBillingPaymentConfig;
  canEdit: boolean;
  activeMethodsCount: number;
  onUpdateField: <K extends keyof PlatformBillingPaymentConfig>(
    key: K,
    value: PlatformBillingPaymentConfig[K]
  ) => void;
  onEnableAllMethods: () => void;
}

export const HqBillingMethodsGrid: React.FC<HqBillingMethodsGridProps> = ({
  form,
  canEdit,
  activeMethodsCount,
  onUpdateField,
  onEnableAllMethods,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">
          1. Meios de Pagamento Liberados para Escolha do Lojista
        </h3>
        {canEdit && activeMethodsCount < PAYMENT_METHOD_CARDS.length && (
          <button
            type="button"
            onClick={onEnableAllMethods}
            className="px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Liberar Todos os Meios
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PAYMENT_METHOD_CARDS.map((method) => {
          const Icon = method.icon;
          const active = Boolean(form[method.key]);
          return (
            <button
              key={method.key}
              type="button"
              disabled={!canEdit}
              onClick={() => onUpdateField(method.key, !active)}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer disabled:cursor-not-allowed ${
                active
                  ? 'bg-slate-950 border-emerald-500/50 shadow-lg shadow-emerald-500/5'
                  : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${active ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className="text-xs font-black text-white">{method.title}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                    active
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {active ? 'Liberado' : 'Bloqueado'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{method.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
