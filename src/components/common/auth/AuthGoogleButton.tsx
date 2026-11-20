import React from 'react';

interface AuthGoogleButtonProps {
  contextId: string;
  activeTab: 'login' | 'signup' | 'recover';
  isSubmitting: boolean;
  onClick: () => void;
}

function getGoogleAuthButtonLabel(contextId: string, activeTab: 'login' | 'signup' | 'recover'): string {
  if (contextId === 'marketplace') {
    return activeTab === 'signup'
      ? 'Criar conta de Consumidor com Google'
      : 'Entrar no Marketplace com Google';
  }
  if (contextId === 'store-os') return 'Entrar no Store OS com Google (Conta Lojista)';
  if (contextId === 'driver') return 'Entrar no 3C Driver com Google (Entregador)';
  if (contextId === 'waiter') return 'Entrar no 3C Waiter com Google (Garçom)';
  if (contextId === 'hq' || contextId === 'server-core') {
    return 'Entrar no HQ Central com Google (Mantenedor Autorizado)';
  }
  return 'Continuar com Google';
}

export function getAuthFooterLabel(contextId: string): string {
  if (contextId === 'marketplace') return '3C Marketplace · Ambiente Seguro do Consumidor';
  if (contextId === 'store-os') return 'Store OS · Sistema Operacional Comercial';
  if (contextId === 'driver') return '3C Driver · Aplicativo do Entregador';
  if (contextId === 'waiter') return '3C Waiter · Terminal de Salão';
  if (contextId === 'hq' || contextId === 'server-core') {
    return '3C Corp · Governança & Infraestrutura Autenticada';
  }
  return '3C Corp · Ambiente Autenticado';
}

export const AuthGoogleButton: React.FC<AuthGoogleButtonProps> = ({
  contextId,
  activeTab,
  isSubmitting,
  onClick,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
        <div className="h-px flex-1 bg-slate-800" />
        <span>ou</span>
        <div className="h-px flex-1 bg-slate-800" />
      </div>
      <button
        type="button"
        disabled={isSubmitting}
        onClick={onClick}
        className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs shadow-sm border border-slate-200 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span>{getGoogleAuthButtonLabel(contextId, activeTab)}</span>
      </button>
    </div>
  );
};
