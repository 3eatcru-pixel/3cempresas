import React, { useState } from 'react';
import { ArrowRight, Download } from 'lucide-react';
import heroStorePosCounterImg from '../../assets/images/hero_store_pos_counter_1794865226007.webp';
import { BrandMark } from '../common/BrandLogo';

interface PortalHeroSectionProps {
  onNavigate: (sectionId: string) => void;
}

export const PortalHeroSection: React.FC<PortalHeroSectionProps> = ({ onNavigate }) => {
  const [heroImageFailed, setHeroImageFailed] = useState(false);

  const handleScrollToDownloads = () => {
    const el = document.getElementById('downloads');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative bg-slate-950 py-14 sm:py-20 border-b border-slate-900">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
        {/* Coluna Esquerda: Proposta de Valor + CTAs */}
        <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-400 tracking-wide">
            <span className="text-amber-400 font-semibold">3C Corp</span>
            <span aria-hidden="true">·</span>
            <span>Store OS para Lojistas</span>
            <span aria-hidden="true">·</span>
            <span>Marketplace Regional</span>
          </div>

          <h1
            style={{ fontSize: 'clamp(2.25rem, 3.8vw, 3.35rem)' }}
            className="font-bold text-white tracking-tight leading-[1.08] text-balance"
          >
            Gestão completa para sua loja.{' '}
            <span className="text-amber-400">
              Compra direta para seus clientes.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-xl">
            Opere balcão, estoque, cozinha e financeiro no Store OS com continuidade offline e conecte seus produtos ao catálogo em tempo real do Marketplace 3C.
          </p>

          <div className="flex flex-wrap items-center gap-3.5 pt-1">
            <button
              type="button"
              onClick={() => onNavigate('store-os')}
              className="px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm rounded-xl transition-colors flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <BrandMark id="store-os" size="xs" tone="plain" className="text-slate-950" />
              <span>Acessar Store OS</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('marketplace')}
              className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-800 hover:border-emerald-500/40 font-semibold text-sm rounded-xl transition-colors flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <BrandMark id="marketplace" size="xs" tone="plain" className="text-emerald-400" />
              <span>Explorar Marketplace</span>
            </button>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
            <button
              type="button"
              onClick={handleScrollToDownloads}
              className="inline-flex items-center gap-2 font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Baixar para Windows e Android</span>
            </button>
            <span className="text-slate-700" aria-hidden="true">·</span>
            <span>PDV Offline + Sincronização em Nuvem</span>
          </div>
        </div>

        {/* Coluna Direita: Fotografia Editorial do Balcão Store OS */}
        <div className="lg:col-span-6 flex">
          <div className="relative w-full min-h-[280px] sm:min-h-[360px] lg:min-h-[430px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-900">
            {!heroImageFailed ? (
              <img
                src={heroStorePosCounterImg}
                alt="Balcão de atendimento moderno operando terminal PDV Store OS com leitor de cartão e impressora térmica"
                decoding="async"
                fetchPriority="high"
                referrerPolicy="no-referrer"
                onError={() => setHeroImageFailed(true)}
                className="w-full h-full object-cover object-center"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 flex flex-col items-center justify-center p-8 text-center gap-3">
                <BrandMark id="store-os" size="lg" />
                <p className="text-sm font-semibold text-white">
                  3C Store OS — Terminal de Caixa e Operação
                </p>
                <p className="text-xs text-slate-400 max-w-xs">
                  Desktop Windows, Tablet Android e acesso imediato via navegador.
                </p>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent pointer-events-none" />

            <div className="absolute inset-x-0 bottom-0 p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-amber-400">
                  Store OS · Operação no Balcão e Salão
                </p>
                <p className="text-sm font-semibold text-white">
                  Frente de caixa rápida, cozinha e estoque integrados
                </p>
              </div>
              <button
                type="button"
                onClick={handleScrollToDownloads}
                className="self-start sm:self-auto px-3.5 py-2 bg-slate-950/85 hover:bg-slate-900 border border-slate-700 text-slate-100 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Ver instaladores
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

