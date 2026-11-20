import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { STATUS_COLORS } from '@3c/design-system';

interface AuthModalBannersProps {
  errorMsg: string;
  infoMsg: string;
  suggestedContext: any;
  allowCrossContextSwitch?: boolean;
  onSwitchSuggestedContext: (target: any) => void;
}

function getSuggestedProductTitle(ctx: string): string {
  if (ctx === 'store-os') return 'Store OS (Lojistas)';
  if (ctx === 'driver') return '3C Driver (Entregadores)';
  if (ctx === 'waiter') return '3C Waiter (Garçons)';
  if (ctx === 'marketplace') return 'Marketplace (Consumidores)';
  return 'outro aplicativo autorizado';
}

function getSuggestedButtonName(ctx: string): string {
  if (ctx === 'store-os') return 'Store OS';
  if (ctx === 'driver') return '3C Driver';
  if (ctx === 'waiter') return '3C Waiter';
  if (ctx === 'marketplace') return 'Marketplace';
  return 'Aplicativo Correto';
}

export const AuthModalBanners: React.FC<AuthModalBannersProps> = ({
  errorMsg,
  infoMsg,
  suggestedContext,
  allowCrossContextSwitch = false,
  onSwitchSuggestedContext,
}) => {
  const errorToken = STATUS_COLORS.DANGER;
  const successToken = STATUS_COLORS.SUCCESS;
  const isInternalTarget = suggestedContext === 'hq' || suggestedContext === 'server-core';
  const showSuggestedBanner = Boolean(suggestedContext) && !isInternalTarget;

  return (
    <>
      {errorMsg && (
        <div
          className={`p-3.5 ${errorToken.bgClass} border ${errorToken.borderClass} rounded-xl flex items-center gap-3 text-xs ${errorToken.textClass} font-medium`}
        >
          <AlertCircle className={`w-4 h-4 shrink-0 ${errorToken.textClass}`} />
          <span>{errorMsg}</span>
        </div>
      )}

      {showSuggestedBanner && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200 animate-fadeIn">
          <div className="space-y-0.5 min-w-0">
            <p className="font-bold text-amber-300">Conta de outro produto detectada</p>
            <p className="text-[11px] text-amber-200/80">
              Esta credencial pertence ao{' '}
              <strong className="text-white">{getSuggestedProductTitle(suggestedContext)}</strong>.
            </p>
          </div>
          {allowCrossContextSwitch && (
            <button
              type="button"
              onClick={() => onSwitchSuggestedContext(suggestedContext)}
              className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg shrink-0 cursor-pointer transition-colors shadow-sm text-center"
            >
              Ir para o Login do {getSuggestedButtonName(suggestedContext)}
            </button>
          )}
        </div>
      )}

      {infoMsg && (
        <div
          className={`p-3.5 ${successToken.bgClass} border ${successToken.borderClass} rounded-xl flex items-center gap-3 text-xs ${successToken.textClass} font-medium`}
        >
          <CheckCircle2 className={`w-4 h-4 shrink-0 ${successToken.textClass}`} />
          <span>{infoMsg}</span>
        </div>
      )}
    </>
  );
};
