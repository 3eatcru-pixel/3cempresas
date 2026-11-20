import React from 'react';
import { ShoppingBag, Grid, BookOpen, User, ArrowLeft } from 'lucide-react';
import { BrandMark } from '../../../components/common/BrandLogo';
import { getActiveClientAppId } from '../../../core/platform/PlatformAdapter';

interface MarketplaceNavbarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  activeOrdersCount: number;
  onBackToPortal: () => void;
  onOpenCheckout: () => void;
  cartCount: number;
  cartTotal: number;
  isConsumerAuthenticated?: boolean;
  onSignInConsumer?: () => void;
}

export const MarketplaceNavbar: React.FC<MarketplaceNavbarProps> = ({
  activeTab,
  setActiveTab,
  activeOrdersCount,
  onBackToPortal,
  onOpenCheckout,
  cartCount,
  cartTotal,
  isConsumerAuthenticated = false,
  onSignInConsumer,
}) => {
  const navTabs = isConsumerAuthenticated
    ? [
        { id: 'marketplace', label: 'Explorar Hub', icon: Grid },
        { id: 'orders', label: 'Meus Pedidos', icon: ShoppingBag, badge: activeOrdersCount },
        { id: 'institutional', label: 'Sobre o Marketplace', icon: BookOpen },
        { id: 'consumer-account', label: 'Minha Conta', icon: User },
      ]
    : [
        { id: 'marketplace', label: 'Explorar Hub', icon: Grid },
        { id: 'institutional', label: 'Sobre o Marketplace', icon: BookOpen },
      ];

  return (
    <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
      <div className="flex items-center gap-3">
        <BrandMark id="marketplace" size="md" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-white tracking-tight">
              3C <span className="text-emerald-400">Marketplace</span>
            </h1>
          </div>
          <p className="text-xs text-slate-400">Vitrine Pública, Pedidos &amp; Rastreamento em Tempo Real.</p>
        </div>
        {getActiveClientAppId() === 'unified-portal' && (
          <button
            onClick={onBackToPortal}
            className="ml-4 p-2 text-slate-500 hover:text-white transition-colors cursor-pointer"
            title="Voltar ao Ecossistema"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar">
          {navTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap relative cursor-pointer ${
                  isActive ? 'bg-emerald-500 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge ? (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono tabular-nums font-black bg-rose-500 text-white">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
          {!isConsumerAuthenticated && onSignInConsumer && (
            <button
              type="button"
              onClick={onSignInConsumer}
              className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/30"
            >
              <User className="w-4 h-4" />
              <span>Entrar / Cadastrar</span>
            </button>
          )}
        </div>

        <button
          onClick={onOpenCheckout}
          className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <ShoppingBag className="w-4 h-4" />
          <span className="font-mono tabular-nums">Sacola ({cartCount})</span>
          <span className="font-mono tabular-nums text-slate-950 font-black pl-1 border-l border-slate-950/30">
            R$ {cartTotal.toFixed(2)}
          </span>
        </button>
      </div>
    </div>
  );
};
