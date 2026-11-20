import React from 'react';
import { Star, Clock, Bike, ShieldCheck, Heart, MapPin } from 'lucide-react';
import { Store } from '../../../../types';

interface StoreFicharioCardProps {
  store: Store;
  fee: number;
  dist: string | null;
  isFav: boolean;
  onOpenStore: (slug: string) => void;
  onOpenModal: (store: Store) => void;
  onToggleFavorite: (storeId: string) => void;
}

export const StoreFicharioCard: React.FC<StoreFicharioCardProps> = ({
  store,
  fee,
  dist,
  isFav,
  onOpenStore,
  onOpenModal,
  onToggleFavorite,
}) => {
  return (
    <div
      onClick={() => onOpenStore(store.slug)}
      className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-5 flex flex-col md:flex-row items-center gap-6 hover:bg-slate-900 hover:border-amber-500/30 transition-all cursor-pointer group shadow-xl"
    >
      <div className="relative shrink-0">
        <img
          src={store.logo}
          alt={store.name}
          className="w-24 h-24 rounded-3xl object-cover border-4 border-slate-950 shadow-2xl group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1.5 rounded-full border-2 border-slate-900 shadow-lg">
          <ShieldCheck size={14} strokeWidth={3} />
        </div>
      </div>

      <div className="flex-1 space-y-3 text-center md:text-left min-w-0">
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
          <h3 className="text-xl font-black text-white uppercase italic tracking-tighter truncate leading-none">
            {store.name}
          </h3>
          <span className="inline-block px-2.5 py-0.5 rounded-lg text-[9px] font-black bg-slate-950 border border-slate-800 text-slate-500 uppercase tracking-widest w-fit mx-auto md:mx-0">
            {store.category}
          </span>
          {store.isOpen === false && (
            <span className="inline-block px-2.5 py-0.5 rounded-lg text-[9px] font-black bg-rose-500/15 border border-rose-500/40 text-rose-400 uppercase tracking-widest w-fit mx-auto md:mx-0">
              Fechada • Não aceita pedidos
            </span>
          )}
        </div>

        <p className="text-[11px] text-slate-400 font-medium leading-relaxed line-clamp-1 max-w-lg">
          {store.showcaseTemplate?.tagline || store.address}
        </p>

        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-1">
          <div className="flex items-center gap-1.5 font-black text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full text-[10px]">
            <Star size={14} className="fill-amber-500" />
            {store.rating.toFixed(1)}
            <span className="text-slate-600 font-bold ml-1">{store.totalOrders || 120}+ atendimentos</span>
          </div>

          <div className="flex items-center gap-2 text-slate-300 font-mono text-[10px] bg-slate-950/50 px-2.5 py-1 rounded-full border border-slate-800/50">
            <Clock size={14} className="text-slate-500" />
            {['SERVICES', 'BEAUTY'].includes(store.category)
              ? 'HORA MARCADA'
              : `${store.deliveryTimeMin}-${store.deliveryTimeMin + 15} MIN`}
          </div>

          <div className="flex items-center gap-2 text-emerald-400 font-mono text-[10px] bg-emerald-400/10 px-2.5 py-1 rounded-full">
            <Bike size={14} />
            {['SERVICES', 'BEAUTY'].includes(store.category)
              ? 'AGENDAMENTO ONLINE'
              : fee === 0
              ? 'FRETE GRÁTIS'
              : `TAXA R$ ${fee.toFixed(2)}`}
          </div>

          {dist && (
            <div className="flex items-center gap-1 text-slate-400 font-mono text-[10px] bg-slate-950/60 px-2.5 py-1 rounded-full border border-slate-800">
              <MapPin size={12} className="text-amber-400" /> {dist}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
        <div className="flex items-center gap-2">
          <button className="flex-1 px-6 py-3 bg-amber-500 text-slate-950 font-black text-[10px] rounded-2xl transition-all uppercase tracking-[0.1em] shadow-lg hover:brightness-110 active:scale-95 cursor-pointer">
            Explorar Vitrine
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(store.id);
            }}
            className={`p-3 rounded-2xl border transition-all cursor-pointer ${
              isFav
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title={isFav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
          >
            <Heart size={16} className={isFav ? 'fill-rose-400' : ''} />
          </button>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenModal(store);
          }}
          className="px-6 py-2 bg-slate-800 text-slate-300 font-bold text-[9px] rounded-xl transition-all uppercase tracking-widest hover:bg-slate-700 cursor-pointer"
        >
          {['SERVICES', 'BEAUTY'].includes(store.category)
            ? 'Ver Serviços'
            : ['FURNITURE', 'ELECTRONICS', 'FASHION', 'RETAIL', 'HEALTH'].includes(store.category)
            ? 'Ver Catálogo'
            : 'Ver Cardápio Rápido'}
        </button>
      </div>
    </div>
  );
};
