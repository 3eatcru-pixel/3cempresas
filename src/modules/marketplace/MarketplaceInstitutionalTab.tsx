import React from 'react';
import { ShieldCheck, MapPin, Store, KeyRound } from 'lucide-react';

export const MarketplaceInstitutionalTab: React.FC = () => {
  return (
    <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 space-y-6 shadow-xl text-center max-w-4xl mx-auto animate-fadeIn">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
        <ShieldCheck className="w-4 h-4" /> 3C Marketplace · Experiência Oficial do Consumidor
      </div>

      <h2 className="text-3xl font-black text-white tracking-tight">
        Descoberta Local, Vitrines Verificadas &amp; Entrega Rastreada
      </h2>

      <p className="text-sm text-slate-300 leading-relaxed max-w-2xl mx-auto">
        Encontre restaurantes, lojas de varejo e prestadores de serviços da sua região com catálogos atualizados em tempo real, preços transparentes e confirmação segura da entrega no seu endereço.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left pt-4 text-xs">
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2">
          <div className="font-bold text-emerald-400 text-sm flex items-center gap-2">
            <Store className="w-4 h-4 shrink-0" />
            <span>Vitrines Locais Verificadas</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Compre diretamente dos estabelecimentos da sua cidade com disponibilidade real para Delivery, Retirada no Balcão, Mesa ou Agendamento.
          </p>
        </div>
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2">
          <div className="font-bold text-emerald-400 text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4 shrink-0" />
            <span>Rastreamento GPS ao Vivo</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Acompanhe cada etapa do seu pedido desde a confirmação até o deslocamento do entregador no mapa em tempo real.
          </p>
        </div>
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2">
          <div className="font-bold text-emerald-400 text-sm flex items-center gap-2">
            <KeyRound className="w-4 h-4 shrink-0" />
            <span>Entrega Protegida por PIN</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Cada pedido gera um código exclusivo de 4 dígitos para garantir que sua encomenda seja entregue com total segurança em suas mãos.
          </p>
        </div>
      </div>
    </div>
  );
};
