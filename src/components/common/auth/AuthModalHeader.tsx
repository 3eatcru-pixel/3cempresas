import React, { useState } from 'react';
import { X, LogIn, UserPlus, ChevronDown, Store, ShoppingBag, ShieldCheck, Bike, UtensilsCrossed } from 'lucide-react';
import { BrandMark } from '../BrandLogo';
import { AuthContextMeta } from './authContextMeta';
import { AuthModalContextId } from '../../../context/AuthContext';

interface AuthModalHeaderProps {
  meta: AuthContextMeta;
  activeTab: 'login' | 'signup' | 'recover';
  borderClass: string;
  onClose: () => void;
  onSelectTab: (tab: 'login' | 'signup') => void;
  onSwitchContext?: (contextId: AuthModalContextId) => void;
}

const PRODUCT_CHOICES: Array<{
  id: AuthModalContextId;
  label: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { id: 'store-os', label: 'Store OS', category: 'Lojistas e Equipe', icon: Store, color: 'text-amber-400' },
  { id: 'marketplace', label: 'Marketplace', category: 'Consumidores', icon: ShoppingBag, color: 'text-emerald-400' },
  { id: 'hq', label: 'HQ Central', category: 'Governança Master (Dev)', icon: ShieldCheck, color: 'text-indigo-400' },
  { id: 'driver', label: '3C Driver', category: 'Entregadores', icon: Bike, color: 'text-sky-400' },
  { id: 'waiter', label: '3C Waiter', category: 'Garçons e Salão', icon: UtensilsCrossed, color: 'text-pink-400' },
];

export const AuthModalHeader: React.FC<AuthModalHeaderProps> = ({
  meta,
  activeTab,
  borderClass,
  onClose,
  onSelectTab,
  onSwitchContext,
}) => {
  const activeTheme = meta.theme;
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      <div className={`p-6 border-b ${borderClass} bg-slate-950/70 space-y-3`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark id={meta.brandId} size="md" />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white tracking-tight truncate">{meta.title}</h2>
              <p className="text-[11px] text-slate-400 font-medium truncate">{meta.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {onSwitchContext && (
          <div className="relative pt-1">
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              className="text-[11px] font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-850 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center justify-between w-full transition-colors cursor-pointer"
            >
              <span>Não é este produto? <strong className="text-amber-400">Clique para alternar login</strong></span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPicker ? 'rotate-180' : ''}`} />
            </button>

            {showPicker && (
              <div className="mt-2 p-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl space-y-1 animate-fadeIn">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Selecione o login correspondente:
                </div>
                {PRODUCT_CHOICES.map((prod) => {
                  const Icon = prod.icon;
                  const isCurrent = prod.id === meta.brandId;
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => {
                        setShowPicker(false);
                        onSwitchContext(prod.id);
                      }}
                      className={`w-full p-2.5 rounded-lg text-left flex items-center justify-between transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-slate-800 text-white font-bold'
                          : 'hover:bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${prod.color}`} />
                        <div>
                          <div className="text-xs">{prod.label}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{prod.category}</div>
                        </div>
                      </div>
                      {isCurrent && (
                        <span className="text-[10px] bg-slate-750 px-2 py-0.5 rounded text-amber-300 font-bold">
                          Ativo
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {meta.allowSignup ? (
        <div className={`grid grid-cols-2 border-b ${borderClass} p-1.5 bg-slate-950/30`}>
          <button
            type="button"
            onClick={() => onSelectTab('login')}
            className={`py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'login' || activeTab === 'recover'
                ? `${activeTheme.accentBgClass} text-slate-950 shadow-lg`
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" /> Entrar
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('signup')}
            className={`py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'signup'
                ? `${activeTheme.accentBgClass} text-slate-950 shadow-lg`
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" /> {meta.signupLabel || 'Criar Conta'}
          </button>
        </div>
      ) : (
        <div className={`px-6 py-2.5 border-b ${borderClass} bg-slate-950/30 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider ${activeTheme.accentTextClass}`}>
          <LogIn className="w-3.5 h-3.5" />
          <span>{activeTab === 'recover' ? 'Recuperação de Senha' : 'Acesso Exclusivo por Login'}</span>
        </div>
      )}
    </>
  );
};
