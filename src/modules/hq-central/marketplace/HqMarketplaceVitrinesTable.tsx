import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Search, Star } from 'lucide-react';
import { Store } from '../../../types';

type VitrineFilter = 'ALL' | 'FEATURED' | 'VISIBLE' | 'HIDDEN';

interface HqMarketplaceVitrinesTableProps {
  stores: Store[];
  featuredStoreIds: string[];
  hiddenStoreIds: string[];
  isDevOwner: boolean;
  busyStoreId: string | null;
  onToggleFeatured: (storeId: string) => void;
  onToggleHidden: (storeId: string) => void;
}

export const HqMarketplaceVitrinesTable: React.FC<HqMarketplaceVitrinesTableProps> = ({
  stores,
  featuredStoreIds,
  hiddenStoreIds,
  isDevOwner,
  busyStoreId,
  onToggleFeatured,
  onToggleHidden,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<VitrineFilter>('ALL');

  const featuredSet = useMemo(() => new Set(featuredStoreIds), [featuredStoreIds]);
  const hiddenSet = useMemo(() => new Set(hiddenStoreIds), [hiddenStoreIds]);

  const activeTenants = useMemo(
    () =>
      stores.filter(
        (s) =>
          !s._deleted &&
          s.tenantStatus !== 'SUSPENDED' &&
          String((s as any).status || 'ACTIVE').toUpperCase() !== 'SUSPENDED'
      ),
    [stores]
  );

  const filteredStores = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeTenants.filter((s) => {
      const isFeatured = featuredSet.has(s.id);
      const isHidden = hiddenSet.has(s.id);
      if (filter === 'FEATURED' && !isFeatured) return false;
      if (filter === 'VISIBLE' && isHidden) return false;
      if (filter === 'HIDDEN' && !isHidden) return false;
      if (!q) return true;
      return `${s.name} ${s.slug} ${s.category} ${s.city || ''}`.toLowerCase().includes(q);
    });
  }, [activeTenants, featuredSet, hiddenSet, filter, search]);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="p-5 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            Curadoria &amp; Visibilidade de Vitrines no Marketplace
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Promova vitrines parceiras na descoberta ou pause a exibição pública sem interferir no Store OS privado do lojista.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            {(
              [
                { id: 'ALL', label: 'Todas' },
                { id: 'FEATURED', label: 'Destaque' },
                { id: 'VISIBLE', label: 'Visíveis' },
                { id: 'HIDDEN', label: 'Ocultas' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  filter === tab.id
                    ? 'bg-indigo-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar loja, cidade ou segmento..."
              className="w-full rounded-lg bg-slate-950 border border-slate-800 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {filteredStores.length === 0 ? (
        <div className="p-10 text-center text-xs text-slate-500">
          Nenhuma vitrine encontrada com os filtros atuais.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-medium text-slate-400 bg-slate-950/50">
                <th className="py-3 px-4">Vitrine Parceira</th>
                <th className="py-3 px-4">Segmento · Local</th>
                <th className="py-3 px-4 text-right">Avaliação</th>
                <th className="py-3 px-4">Exibição no Marketplace</th>
                <th className="py-3 px-4 text-right">Ações de Curadoria</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {filteredStores.map((store) => {
                const isFeatured = featuredSet.has(store.id);
                const isHidden = hiddenSet.has(store.id);
                const isBusy = busyStoreId === store.id;

                return (
                  <tr
                    key={store.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{store.name}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        /{store.slug || store.id} · Plano {store.subscriptionPlan}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      <span>{store.category}</span>
                      <span className="text-slate-600 mx-1.5">·</span>
                      <span className="text-slate-400">
                        {store.city ? `${store.city}${store.state ? ` - ${store.state}` : ''}` : 'Brasil'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                      {Number(store.rating || 5).toFixed(1)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs font-medium ${
                          isHidden
                            ? 'text-rose-400'
                            : isFeatured
                            ? 'text-amber-300'
                            : 'text-emerald-400'
                        }`}
                      >
                        {isHidden
                          ? 'Ocultada na moderação'
                          : isFeatured
                          ? 'Publicada · Em Destaque'
                          : 'Publicada'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!isDevOwner || isHidden || isBusy}
                          onClick={() => onToggleFeatured(store.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${
                            isFeatured
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-950 text-slate-300 border-slate-700 hover:text-amber-300'
                          }`}
                        >
                          <Star className="w-3.5 h-3.5" />
                          {isFeatured ? 'Remover Destaque' : 'Destacar'}
                        </button>

                        <button
                          type="button"
                          disabled={!isDevOwner || isBusy}
                          onClick={() => onToggleHidden(store.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${
                            isHidden
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                              : 'bg-slate-950 text-slate-300 border-slate-700 hover:text-rose-300'
                          }`}
                        >
                          {isHidden ? (
                            <>
                              <Eye className="w-3.5 h-3.5" /> Republicar
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5" /> Ocultar
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
