import React, { useMemo } from 'react';
import { Globe, MapPin } from 'lucide-react';
import { Store, Order } from '../../../types';
import { MapDisplay } from '../../../components/common/MapDisplay';
import { isValidLatLng } from '../../../components/common/map/mapUtils';

interface HqRegionalGovernanceProps {
  selectedHqRegion: string;
  setSelectedHqRegion: (val: string) => void;
  stores: Store[];
  orders?: Order[];
}

function getStoreCityClusterKey(store: Store): string {
  const city = (store.city || '').trim();
  const uf = (store.state || '').trim().toUpperCase();
  if (city && uf) return `${city} - ${uf}`;
  if (city) return city;
  if (/londrina/i.test(store.address || '')) return 'Londrina - PR';
  return 'Sem Cidade Definida';
}

export const HqRegionalGovernance: React.FC<HqRegionalGovernanceProps> = ({
  selectedHqRegion,
  setSelectedHqRegion,
  stores,
  orders = []
}) => {
  const activeStores = useMemo(() => stores.filter((s) => !s._deleted), [stores]);

  const cityClusters = useMemo(() => {
    const map = new Map<string, { key: string; stores: Store[]; revenue: number; center: [number, number] | null }>();
    for (const s of activeStores) {
      const key = getStoreCityClusterKey(s);
      const existing = map.get(key) || { key, stores: [], revenue: 0, center: null };
      existing.stores.push(s);
      if (!existing.center && isValidLatLng(s.latitude, s.longitude)) {
        existing.center = [s.latitude as number, s.longitude as number];
      }
      map.set(key, existing);
    }
    for (const o of orders) {
      if (o.status === 'CANCELLED') continue;
      const store = activeStores.find((s) => s.id === o.storeId);
      if (!store) continue;
      const key = getStoreCityClusterKey(store);
      const entry = map.get(key);
      if (entry) entry.revenue += Number(o.total) || 0;
    }
    return Array.from(map.values()).sort((a, b) => b.stores.length - a.stores.length || b.revenue - a.revenue);
  }, [activeStores, orders]);

  const visibleStores = useMemo(
    () =>
      selectedHqRegion === 'ALL'
        ? activeStores
        : activeStores.filter((s) => getStoreCityClusterKey(s) === selectedHqRegion),
    [activeStores, selectedHqRegion]
  );

  const selectedCluster = cityClusters.find((c) => c.key === selectedHqRegion);
  const firstValidStore = visibleStores.find((s) => isValidLatLng(s.latitude, s.longitude));
  const mapCenter: [number, number] =
    selectedCluster?.center ||
    (firstValidStore
      ? [firstValidStore.latitude as number, firstValidStore.longitude as number]
      : [-23.3105, -51.1628]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-black text-sm text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-400" /> Governança Territorial Nacional — Clusters por Cidade / UF
            </h3>
            <p className="text-[10px] text-slate-400">
              Monitoramento multi-cidade em todo o território brasileiro (ponto de partida Londrina/PR com expansão automática por município).
            </p>
          </div>
          <button
            onClick={() => setSelectedHqRegion('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 font-mono cursor-pointer ${
              selectedHqRegion === 'ALL'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>Todo o Brasil ({activeStores.length})</span>
          </button>
        </div>

        {cityClusters.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
            Nenhuma loja cadastrada ainda. Assim que empresas forem registradas em qualquer cidade do Brasil, os clusters aparecerão automaticamente aqui.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {cityClusters.map((cluster) => {
              const isSelected = selectedHqRegion === cluster.key;
              return (
                <button
                  key={cluster.key}
                  onClick={() => setSelectedHqRegion(cluster.key)}
                  className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-slate-950 border-amber-500 ring-2 ring-amber-500/30 shadow-2xl scale-[1.02]'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        {cluster.key.includes(' - ') ? cluster.key.split(' - ').pop() : 'BR'}
                      </span>
                      <span className="text-[10px] font-mono tabular-nums text-slate-400 font-bold">
                        {cluster.stores.length} loja(s)
                      </span>
                    </div>
                    <h4 className="text-xs font-black text-white">{cluster.key}</h4>
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-1">
                      Cluster operacional ativo
                    </p>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-800/80 space-y-1">
                    <div className="flex justify-between text-[10px] font-mono tabular-nums">
                      <span className="text-slate-500">GMV Real:</span>
                      <span className="text-emerald-400 font-bold">
                        R$ {cluster.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div>
            <h3 className="font-black text-sm text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" /> Mapa Territorial de Lojas (Brasil)
            </h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              {selectedHqRegion === 'ALL' ? 'Visualização Nacional' : `Foco em: ${selectedHqRegion}`}
            </p>
          </div>
        </div>
        <div className="h-[420px] relative">
          <MapDisplay
            center={mapCenter}
            zoom={selectedHqRegion === 'ALL' ? (visibleStores.length > 1 ? 5 : 13) : 13}
            height="100%"
            styleName="dark"
            autoFitBounds={visibleStores.length > 1}
            interactiveControls={true}
            markers={visibleStores
              .filter((s) => isValidLatLng(s.latitude, s.longitude))
              .map((s) => {
                const cityLabel = getStoreCityClusterKey(s);
                return {
                  position: [s.latitude as number, s.longitude as number],
                  title: s.name,
                  description: `${s.category} • ${cityLabel}`,
                  icon: 'store' as const,
                  badgeText: s.state || 'BR',
                };
              })}
          />
        </div>
      </div>
    </div>
  );
};
