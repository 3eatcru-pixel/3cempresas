import React from 'react';
import { SearchX } from 'lucide-react';
import { Store } from '../../../types';
import { MapDisplay, MapMarkerData } from '../../../components/common/MapDisplay';
import { isValidLatLng } from '../../../components/common/map/mapUtils';
import { useConsumer } from '../../../context/ConsumerContext';
import { useEcosystem } from '../../../context/EcosystemContext';
import { calculateHaversineKm } from '../../../utils/storeDomain';
import { StoreFicharioCard } from './store-list/StoreFicharioCard';
import { StoreLedgerTable } from './store-list/StoreLedgerTable';
import { StoreGridCard } from './store-list/StoreGridCard';

interface StoreListViewProps {
  viewMode: 'grid' | 'fichario' | 'livro-razao' | 'map';
  stores: Store[];
  onOpenStore: (slug: string) => void;
  onOpenModal: (store: Store) => void;
  onResetFilters?: () => void;
}

export const StoreListView: React.FC<StoreListViewProps> = ({
  viewMode,
  stores,
  onOpenStore,
  onOpenModal,
  onResetFilters,
}) => {
  const { consumer, toggleFavoriteStore } = useConsumer();
  const { userCoords, setUserCoords, setGeoAddress, maxRadiusKm } = useEcosystem();

  const getDistanceLabel = (store: Store) => {
    if (typeof store.latitude !== 'number' || typeof store.longitude !== 'number') return null;
    const km = calculateHaversineKm(userCoords[0], userCoords[1], store.latitude, store.longitude);
    return `${km.toFixed(1)} km`;
  };

  const getEffectiveFee = (store: Store) =>
    store.deliveryModality === 'STORE_FLEET'
      ? (store.ownFleetCustomFee ?? store.deliveryFee ?? 0)
      : (store.deliveryFee ?? 0);

  if (stores.length === 0 && viewMode !== 'map') {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-10 text-center space-y-3">
        <SearchX className="w-10 h-10 text-amber-400/60 mx-auto" />
        <h3 className="text-sm font-black text-white uppercase tracking-wider">
          Nenhum estabelecimento encontrado para estes filtros
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Tente aumentar o raio de distância, alterar a categoria selecionada ou limpar os filtros de busca.
        </p>
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
          >
            Restaurar Todos os Estabelecimentos
          </button>
        )}
      </div>
    );
  }

  if (viewMode === 'map') {
    const validCenter: [number, number] = isValidLatLng(userCoords?.[0], userCoords?.[1])
      ? userCoords
      : [-23.3105, -51.1628];
    const mapMarkers: MapMarkerData[] = [
      {
        position: validCenter,
        title: 'Sua Localização',
        description: `Centro de busca • Raio ativo de ${maxRadiusKm} km`,
        icon: 'customer',
        badgeText: 'Você',
      },
      ...stores
        .filter((s) => isValidLatLng(s.latitude, s.longitude))
        .map((s) => {
          const distLabel = getDistanceLabel(s);
          return {
            position: [s.latitude as number, s.longitude as number] as [number, number],
            title: s.name,
            description: `${s.category} • ★ ${s.rating.toFixed(1)}${distLabel ? ` • ${distLabel}` : ''}`,
            icon: 'store' as const,
            badgeText: s.name.split(' ')[0],
            onSelect: () => onOpenStore(s.slug),
          };
        }),
    ];

    return (
      <div className="h-[600px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative isolate z-0">
        <MapDisplay
          center={validCenter}
          zoom={maxRadiusKm >= 15 ? 12 : 14}
          height="100%"
          styleName="dark"
          circleRadiusKm={maxRadiusKm}
          interactiveControls={true}
          enableNominatimSearch={true}
          regionBias="Brasil"
          searchPlaceholder="Ex: Rua, Número, Bairro, Cidade/UF ou CEP..."
          onLocationFound={(lat, lng, displayName) => {
            setUserCoords([lat, lng]);
            setGeoAddress(displayName);
          }}
          markers={mapMarkers}
        />
      </div>
    );
  }

  if (viewMode === 'fichario') {
    return (
      <div className="grid grid-cols-1 gap-4">
        {stores.map((store) => (
          <StoreFicharioCard
            key={store.id}
            store={store}
            fee={getEffectiveFee(store)}
            dist={getDistanceLabel(store)}
            isFav={consumer.favoriteStoreIds.includes(store.id)}
            onOpenStore={onOpenStore}
            onOpenModal={onOpenModal}
            onToggleFavorite={toggleFavoriteStore}
          />
        ))}
      </div>
    );
  }

  if (viewMode === 'livro-razao') {
    return (
      <StoreLedgerTable
        stores={stores}
        getEffectiveFee={getEffectiveFee}
        onOpenStore={onOpenStore}
      />
    );
  }

  // DEFAULT: GRID MODE
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {stores.map((store) => (
        <StoreGridCard
          key={store.id}
          store={store}
          fee={getEffectiveFee(store)}
          dist={getDistanceLabel(store)}
          isFav={consumer.favoriteStoreIds.includes(store.id)}
          onOpenStore={onOpenStore}
          onOpenModal={onOpenModal}
          onToggleFavorite={toggleFavoriteStore}
        />
      ))}
    </div>
  );
};
