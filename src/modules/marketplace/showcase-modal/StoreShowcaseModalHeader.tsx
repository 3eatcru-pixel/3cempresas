import React from 'react';
import { Store } from '../../../types';
import { X, Check, Star } from 'lucide-react';

interface StoreShowcaseModalHeaderProps {
  store: Store;
  onClose: () => void;
  primaryColor: string;
  getNicheSubtitle: () => string;
  totalReviews: number;
  templateTagline: string;
}

export const StoreShowcaseModalHeader: React.FC<StoreShowcaseModalHeaderProps> = ({
  store,
  onClose,
  primaryColor,
  getNicheSubtitle,
  totalReviews,
  templateTagline
}) => {
  const [logoFailed, setLogoFailed] = React.useState(false);
  const initials = (store.name || '3C').slice(0, 2).toUpperCase();

  return (
    <div className="relative bg-stone-950 text-white p-5 sm:p-6 border-b border-stone-800 shrink-0 overflow-hidden">
      <div 
        className="absolute inset-0 opacity-30 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: `url(${store.banner})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/85 to-stone-900/50 pointer-events-none" />

      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 bg-stone-900/80 hover:bg-stone-800 text-stone-300 hover:text-white p-2 rounded-full border border-stone-700 z-10 transition-colors cursor-pointer"
        title="Fechar vitrine"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            {store.logo && !logoFailed ? (
              <img
                src={store.logo}
                alt={store.name}
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 shadow-xl bg-stone-900"
                style={{ borderColor: primaryColor }}
              />
            ) : (
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 shadow-xl bg-stone-900 flex items-center justify-center font-mono text-lg font-black text-amber-400"
                style={{ borderColor: primaryColor }}
              >
                {initials}
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1 rounded-full text-[10px] font-bold shadow">
              <Check className="w-3 h-3" strokeWidth={3} />
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{store.name}</h2>
            </div>
            <div className="text-xs text-stone-300 font-medium">{getNicheSubtitle()}</div>
            <div className="flex items-center gap-3 text-xs pt-0.5">
              <span className="text-amber-400 font-bold font-mono tabular-nums flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400" /> {store.rating.toFixed(1)} <span className="text-stone-400 font-normal">({totalReviews} avaliações)</span>
              </span>
              <span className={`font-bold flex items-center gap-1.5 ${store.isOpen ? 'text-emerald-400' : 'text-amber-400'}`}>
                <span className={`w-2 h-2 rounded-full ${store.isOpen ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {store.isOpen ? 'Aberto Agora' : 'Fechado para Pedidos'}
              </span>
            </div>
          </div>
        </div>

        <div className="hidden lg:block text-right italic font-serif text-amber-200/90 text-xs max-w-xs tracking-wide">
          "{templateTagline}"
        </div>
      </div>
    </div>
  );
};
