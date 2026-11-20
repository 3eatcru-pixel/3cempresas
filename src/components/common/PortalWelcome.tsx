import React from 'react';
import { Lock } from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { PortalHeroSection } from '../portal/PortalHeroSection';
import { PortalCoresGrid } from '../portal/PortalCoresGrid';
import { PortalDownloadsSection } from '../portal/PortalDownloadsSection';
import { BrandLogo } from './BrandLogo';

export const PortalWelcome: React.FC = () => {
  const { setActiveSection } = useEcosystem();
  const { profile, isAuthenticated, openAuthModal } = useAuth();

  const handleNavigate = (sectionId: string) => {
    setActiveSection(sectionId as any);
    window.scrollTo(0, 0);
  };

  const handleScrollTo = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleStoreLogin = () => {
    handleNavigate('store-os');
    if (!isAuthenticated) {
      openAuthModal('login', 'STORE_OWNER', 'store-os');
    }
  };

  const handleHqDevAccess = () => {
    handleNavigate('hq-central');
    if (profile?.role !== 'DEV_OWNER' && profile?.role !== 'SUPER_ADMIN') {
      openAuthModal('login', 'DEV_OWNER', 'hq');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-slate-950">
      {/* Top Bar — 3 zonas: marca, links curtos, 1 CTA */}
      <header className="border-b border-slate-900 bg-slate-950/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg"
          >
            <BrandLogo id="portal" size="sm" />
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
            <button
              type="button"
              onClick={() => handleNavigate('store-os')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Store OS
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('marketplace')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Marketplace
            </button>
            <button
              type="button"
              onClick={() => handleScrollTo('downloads')}
              className="hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Downloads
            </button>
            <button
              type="button"
              onClick={() => handleScrollTo('aplicativos')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Aplicativos
            </button>
          </nav>

          <div className="shrink-0 flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleStoreLogin}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Entrar no Store OS
            </button>
          </div>
        </div>
      </header>

      {/* Hero em duas colunas focado nos produtos comerciais e downloads */}
      <PortalHeroSection onNavigate={handleNavigate} />

      {/* Grade dos produtos principais com fotografia editorial */}
      <PortalCoresGrid onNavigate={handleNavigate} />

      {/* Seção dedicada de downloads: Store OS (Windows + Android) primeiro, demais apps em Android */}
      <PortalDownloadsSection onNavigate={handleNavigate} />

      {/* Pilares operacionais para o negócio e cliente */}
      <section className="bg-slate-900/30 border-t border-slate-900 py-14">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div className="space-y-1.5">
            <div className="text-white font-bold text-lg">Operação Offline</div>
            <div className="text-slate-400 text-xs">
              Vendas no balcão mesmo sem internet
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="text-white font-bold text-lg">Tempo Real</div>
            <div className="text-slate-400 text-xs">
              Pedidos sincronizados entre loja e cliente
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="text-white font-bold text-lg">Multi-Filial</div>
            <div className="text-slate-400 text-xs">
              Estoque, caixa e cardápio por unidade
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="text-white font-bold text-lg">Vitrine Segura</div>
            <div className="text-slate-400 text-xs">
              Catálogo público protegido para compras
            </div>
          </div>
        </div>
      </section>

      <footer className="py-10 px-6 border-t border-slate-900">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            3C Corp · Criado por <strong className="text-slate-300 font-semibold">3eatcru</strong> · Soluções para Lojistas e Consumidores
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => handleScrollTo('downloads')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Downloads
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => handleNavigate('marketplace')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Marketplace
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => handleNavigate('store-os')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Store OS
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => handleNavigate('driver')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              3C Driver
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => handleNavigate('waiter')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              3C Waiter
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={handleHqDevAccess}
              className="hover:text-indigo-300 text-indigo-400/90 font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <Lock className="w-3 h-3" />
              Governança HQ
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

