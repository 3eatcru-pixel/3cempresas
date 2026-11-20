import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { PILLAR_THEMES } from '@3c/design-system';
import { BrandMark } from '../common/BrandLogo';
import heroRetailStoreImg from '../../assets/images/hero_retail_store_1794350796193.webp';
import heroRestaurantDishImg from '../../assets/images/hero_restaurant_dish_1794350794440.webp';
import heroCourierRiderImg from '../../assets/images/hero_courier_rider_1794350796124.webp';
import heroDiningTableImg from '../../assets/images/hero_dining_table_1794350795591.webp';

interface PortalCoresGridProps {
  onNavigate: (sectionId: string) => void;
}

export const PortalCoresGrid: React.FC<PortalCoresGridProps> = ({ onNavigate }) => {
  const storeTheme = PILLAR_THEMES['store-os'];
  const marketTheme = PILLAR_THEMES.marketplace;
  const driverTheme = PILLAR_THEMES.driver;
  const waiterTheme = PILLAR_THEMES.waiter;

  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const markFailed = (key: string) =>
    setFailedImages((prev) => ({ ...prev, [key]: true }));

  return (
    <section id="produtos" className="max-w-6xl mx-auto px-6 py-20 space-y-14">
      <div className="max-w-2xl space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <span className="text-amber-400 font-semibold">Ecossistema Comercial</span>
          <span aria-hidden="true">·</span>
          <span>Loja, Vitrine, Entrega e Salão</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance">
          Nossos produtos para lojistas e consumidores
        </h2>
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
          Cada ponta do comércio tem seu aplicativo dedicado: o lojista opera sua empresa e o consumidor compra com acompanhamento em tempo real.
        </p>
      </div>

      {/* Dois produtos principais do ecossistema */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* 1. STORE OS - LOJISTAS */}
        <button
          type="button"
          onClick={() => onNavigate('store-os')}
          className={`text-left group bg-slate-900/70 hover:bg-slate-900 border border-slate-800 ${storeTheme.hoverBorderClass} rounded-2xl overflow-hidden transition-colors cursor-pointer flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
        >
          <div>
            <div className="relative h-48 sm:h-52 w-full bg-slate-950 overflow-hidden border-b border-slate-800/80">
              {!failedImages.store ? (
                <img
                  src={heroRetailStoreImg}
                  alt="Ambiente de loja de varejo e atendimento conectado ao Store OS"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => markFailed('store')}
                  className="w-full h-full object-cover object-center group-hover:scale-[1.02] transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-900">
                  <BrandMark id="store-os" size="xl" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between gap-3">
                <span className={`text-xs font-semibold ${storeTheme.accentTextClass}`}>
                  Para Lojistas · Gestão de Lojas
                </span>
                <span className="text-[11px] font-medium text-slate-300">
                  Windows · Android · Web
                </span>
              </div>
            </div>

            <div className="p-7 space-y-3">
              <div className="flex items-center gap-3">
                <BrandMark id="store-os" size="md" />
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Store OS — Sistema Operacional da Loja
                </h3>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                PDV para gastronomia, varejo e serviços, cozinha (KDS), controle de mesas e comandas, estoque com baixa por receita, fluxo de caixa e operação local offline.
              </p>
            </div>
          </div>

          <div className={`mx-7 mb-7 pt-5 border-t border-slate-800 flex items-center justify-between ${storeTheme.accentTextClass} text-xs font-semibold tracking-wide`}>
            <span>Acessar Store OS · Login e Cadastro de Lojistas</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* 2. MARKETPLACE - CONSUMIDORES */}
        <button
          type="button"
          onClick={() => onNavigate('marketplace')}
          className={`text-left group bg-slate-900/70 hover:bg-slate-900 border border-slate-800 ${marketTheme.hoverBorderClass} rounded-2xl overflow-hidden transition-colors cursor-pointer flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400`}
        >
          <div>
            <div className="relative h-48 sm:h-52 w-full bg-slate-950 overflow-hidden border-b border-slate-800/80">
              {!failedImages.marketplace ? (
                <img
                  src={heroRestaurantDishImg}
                  alt="Prato artesanal disponível para pedido direto pelo Marketplace 3C"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => markFailed('marketplace')}
                  className="w-full h-full object-cover object-center group-hover:scale-[1.02] transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-900">
                  <BrandMark id="marketplace" size="xl" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between gap-3">
                <span className={`text-xs font-semibold ${marketTheme.accentTextClass}`}>
                  Para Consumidores · Vitrine e Pedidos
                </span>
                <span className="text-[11px] font-medium text-slate-300">
                  Android · Web
                </span>
              </div>
            </div>

            <div className="p-7 space-y-3">
              <div className="flex items-center gap-3">
                <BrandMark id="marketplace" size="md" />
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Marketplace 3C — Descoberta e Compra
                </h3>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                Encontre estabelecimentos na sua região, navegue por catálogos e cardápios atualizados, peça pela entrega, retirada ou na mesa e acompanhe cada etapa.
              </p>
            </div>
          </div>

          <div className={`mx-7 mb-7 pt-5 border-t border-slate-800 flex items-center justify-between ${marketTheme.accentTextClass} text-xs font-semibold tracking-wide`}>
            <span>Explorar Marketplace · Vitrine e Pedidos de Consumidores</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>

      {/* Os 2 aplicativos satélites conectados ao Store OS e Marketplace */}
      <div id="aplicativos" className="space-y-4 pt-2">
        <p className="text-xs font-medium text-slate-400">
          Os 2 aplicativos conectados pelo Server Core · 3C Driver (Logística Dual Fleet) e 3C Waiter (Salão BYOD)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            type="button"
            onClick={() => onNavigate('driver')}
            className={`text-left group bg-slate-900/50 hover:bg-slate-900 border border-slate-800/80 ${driverTheme.hoverBorderClass} p-4 rounded-2xl transition-colors cursor-pointer flex items-center gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400`}
          >
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 flex items-center justify-center">
              {!failedImages.driver ? (
                <img
                  src={heroCourierRiderImg}
                  alt="Entregador parceiro utilizando o aplicativo 3C Driver"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => markFailed('driver')}
                  className="w-full h-full object-cover"
                />
              ) : (
                <BrandMark id="driver" size="md" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <BrandMark id="driver" size="xs" tone="plain" className={driverTheme.accentTextClass} />
                <span className={`text-[11px] font-medium ${driverTheme.accentTextClass}`}>
                  Logística · Android .apk
                </span>
              </div>
              <h4 className="text-white font-semibold text-base">App do Entregador (3C Driver)</h4>
              <p className="text-xs text-slate-400 truncate">
                Rotas, coleta e confirmação segura de entregas
              </p>
            </div>
            <ArrowRight className={`w-4 h-4 text-slate-500 ${driverTheme.groupHoverTextClass} ml-auto shrink-0`} />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('waiter')}
            className={`text-left group bg-slate-900/50 hover:bg-slate-900 border border-slate-800/80 ${waiterTheme.hoverBorderClass} p-4 rounded-2xl transition-colors cursor-pointer flex items-center gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400`}
          >
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 flex items-center justify-center">
              {!failedImages.waiter ? (
                <img
                  src={heroDiningTableImg}
                  alt="Salão e mesa de restaurante atendidos pelo 3C Waiter"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => markFailed('waiter')}
                  className="w-full h-full object-cover"
                />
              ) : (
                <BrandMark id="waiter" size="md" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <BrandMark id="waiter" size="xs" tone="plain" className={waiterTheme.accentTextClass} />
                <span className={`text-[11px] font-medium ${waiterTheme.accentTextClass}`}>
                  Salão · Android .apk
                </span>
              </div>
              <h4 className="text-white font-semibold text-base">Terminal do Garçom (3C Waiter)</h4>
              <p className="text-xs text-slate-400 truncate">
                Pedidos em mesa e comandas em rede local
              </p>
            </div>
            <ArrowRight className={`w-4 h-4 text-slate-500 ${waiterTheme.groupHoverTextClass} ml-auto shrink-0`} />
          </button>
        </div>
      </div>
    </section>
  );
};


