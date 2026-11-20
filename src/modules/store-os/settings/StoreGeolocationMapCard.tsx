import React, { useEffect, useState } from 'react';
import { Building2, Loader2, MapPin, Save, Search } from 'lucide-react';
import { BRAZILIAN_STATES, Store } from '../../../types';
import { MapDisplay } from '../../../components/common/MapDisplay';
import {
  geocodeAddressNominatim,
  isValidLatLng,
  lookupBrazilianCep,
  NominatimGeocodeResult,
  reverseGeocodeNominatim,
  searchAddressSuggestions,
} from '../../../components/common/map/mapUtils';

interface StoreGeolocationMapCardProps {
  currentStore: Store;
  onUpdateLocation: (updates: {
    address: string;
    city?: string;
    state?: string;
    latitude: number;
    longitude: number;
  }) => Promise<void> | void;
}

export const StoreGeolocationMapCard: React.FC<StoreGeolocationMapCardProps> = ({
  currentStore,
  onUpdateLocation,
}) => {
  const [storeAddress, setStoreAddress] = useState(currentStore.address || '');
  const [storeCity, setStoreCity] = useState(currentStore.city || '');
  const [storeState, setStoreState] = useState(currentStore.state || 'PR');
  const [storeLat, setStoreLat] = useState<number>(
    isValidLatLng(currentStore.latitude, currentStore.longitude)
      ? (currentStore.latitude as number)
      : -23.3105
  );
  const [storeLng, setStoreLng] = useState<number>(
    isValidLatLng(currentStore.latitude, currentStore.longitude)
      ? (currentStore.longitude as number)
      : -51.1628
  );
  const [geocoding, setGeocoding] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<NominatimGeocodeResult[]>([]);
  const [locationFeedback, setLocationFeedback] = useState<string | null>(null);

  useEffect(() => {
    setStoreAddress(currentStore.address || '');
    setStoreCity(currentStore.city || '');
    setStoreState(currentStore.state || 'PR');
    if (isValidLatLng(currentStore.latitude, currentStore.longitude)) {
      setStoreLat(currentStore.latitude as number);
      setStoreLng(currentStore.longitude as number);
    }
  }, [
    currentStore.id,
    currentStore.address,
    currentStore.city,
    currentStore.state,
    currentStore.latitude,
    currentStore.longitude,
  ]);

  useEffect(() => {
    const trimmed = storeAddress.trim();
    if (trimmed.length < 4) {
      setAddressSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (/^\d{5}-?\d{3}$/.test(trimmed)) {
        const cepHit = await lookupBrazilianCep(trimmed, {
          biasCoords: [storeLat, storeLng],
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setAddressSuggestions(cepHit ? [cepHit] : []);
        }
        return;
      }
      const results = await searchAddressSuggestions(trimmed, {
        limit: 4,
        biasCoords: [storeLat, storeLng],
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setAddressSuggestions(results);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [storeAddress, storeLat, storeLng]);

  const applyGeoMeta = (result: NominatimGeocodeResult) => {
    if (result.city) setStoreCity(result.city);
    if (result.state && /^[A-Za-z]{2}$/.test(result.state.trim())) {
      setStoreState(result.state.trim().toUpperCase());
    }
  };

  const handleGeocodeStoreAddress = async () => {
    const query = [storeAddress.trim(), storeCity.trim(), storeState.trim()]
      .filter(Boolean)
      .join(', ');
    if (!query) return;
    setGeocoding(true);
    setLocationFeedback(null);
    setAddressSuggestions([]);
    try {
      const result = await geocodeAddressNominatim(query, {
        countryCodes: 'br',
        biasCoords: [storeLat, storeLng],
      });
      if (result) {
        setStoreLat(parseFloat(result.lat.toFixed(6)));
        setStoreLng(parseFloat(result.lng.toFixed(6)));
        if (result.street || result.city) {
          setStoreAddress(result.displayName);
        }
        applyGeoMeta(result);
        setLocationFeedback(
          'Endereço físico localizado no mapa. Clique em "Salvar Localização" para confirmar.'
        );
      } else {
        setLocationFeedback('Endereço não localizado. Informe Rua, Número, Cidade/UF ou CEP válido.');
      }
    } finally {
      setGeocoding(false);
    }
  };

  const applyReverseAddress = async (lat: number, lng: number) => {
    const rev = await reverseGeocodeNominatim(lat, lng);
    if (rev?.displayName) {
      setStoreAddress(rev.displayName);
      applyGeoMeta(rev);
      setLocationFeedback('Pino da loja ajustado no mapa pelo endereço físico selecionado.');
    }
  };

  const handleSaveStoreLocation = async () => {
    if (!isValidLatLng(storeLat, storeLng)) return;
    setSavingLocation(true);
    try {
      await onUpdateLocation({
        address: storeAddress.trim() || currentStore.address,
        ...(storeCity.trim() ? { city: storeCity.trim() } : {}),
        ...(storeState.trim() ? { state: storeState.trim().toUpperCase() } : {}),
        latitude: storeLat,
        longitude: storeLng,
      });
    } finally {
      setSavingLocation(false);
    }
  };

  return (
    <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-amber-400" />
          <div>
            <h4 className="font-bold text-sm text-white">
              Cidade, Endereço Físico &amp; Pino da Loja (Brasil)
            </h4>
            <p className="text-[10px] text-slate-400">
              Informe a cidade, UF e endereço físico ou CEP da loja em qualquer município do Brasil (ou clique no mapa para ajustar a fachada).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSaveStoreLocation()}
          disabled={savingLocation || !isValidLatLng(storeLat, storeLng)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {savingLocation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>Salvar Localização</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                UF
              </label>
              <select
                value={storeState}
                onChange={(e) => setStoreState(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-xs px-2.5 py-2 rounded-xl text-white focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {BRAZILIAN_STATES.map((st) => (
                  <option key={st.uf} value={st.uf}>
                    {st.uf}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                Cidade de Operação
              </label>
              <input
                type="text"
                value={storeCity}
                onChange={(e) => setStoreCity(e.target.value)}
                placeholder="Ex: Londrina, São Paulo, Curitiba..."
                className="w-full bg-slate-950 border border-slate-700 text-xs px-3 py-2 rounded-xl text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="space-y-1 relative">
            <label className="text-[10px] text-slate-400 font-bold uppercase">
              Endereço Físico Completo ou CEP do Estabelecimento
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={storeAddress}
                onChange={(e) => {
                  setStoreAddress(e.target.value);
                  setLocationFeedback(null);
                }}
                placeholder="Rua, Número, Bairro - Cidade/UF ou CEP"
                className="flex-1 bg-slate-950 border border-slate-700 text-xs px-3 py-2 rounded-xl text-white focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => void handleGeocodeStoreAddress()}
                disabled={geocoding}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
              >
                {geocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>Localizar Endereço</span>
              </button>
            </div>

            {addressSuggestions.length > 0 && (
              <div className="bg-slate-950 border border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-800 shadow-xl">
                {addressSuggestions.map((item, idx) => (
                  <button
                    key={`${item.lat}-${item.lng}-${idx}`}
                    type="button"
                    onClick={() => {
                      setStoreLat(parseFloat(item.lat.toFixed(6)));
                      setStoreLng(parseFloat(item.lng.toFixed(6)));
                      setStoreAddress(item.displayName);
                      applyGeoMeta(item);
                      setAddressSuggestions([]);
                      setLocationFeedback(
                        'Endereço físico selecionado. Clique em "Salvar Localização" para gravar.'
                      );
                    }}
                    className="w-full text-left px-3 py-2 text-[11px] text-slate-200 hover:bg-slate-800 hover:text-amber-400 flex items-start gap-2 cursor-pointer transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{item.displayName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="0.000001"
                min={-90}
                max={90}
                value={storeLat}
                onChange={(e) => setStoreLat(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 text-xs px-3 py-2 rounded-xl text-emerald-400 font-mono tabular-nums focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="0.000001"
                min={-180}
                max={180}
                value={storeLng}
                onChange={(e) => setStoreLng(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 text-xs px-3 py-2 rounded-xl text-emerald-400 font-mono tabular-nums focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="p-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-start gap-2">
            <Building2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Lojas utilizam exclusivamente o <strong className="text-slate-200">endereço físico</strong> (CEP/rua) sem captura automática de GPS do dispositivo.
            </span>
          </div>

          {locationFeedback && (
            <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 font-medium">
              {locationFeedback}
            </div>
          )}
        </div>

        <MapDisplay
          center={[storeLat, storeLng]}
          zoom={15}
          height="220px"
          styleName="dark"
          interactiveControls={true}
          onMapClick={(lat, lng) => {
            const rLat = parseFloat(lat.toFixed(6));
            const rLng = parseFloat(lng.toFixed(6));
            setStoreLat(rLat);
            setStoreLng(rLng);
            void applyReverseAddress(rLat, rLng);
          }}
          markers={[
            {
              position: [storeLat, storeLng],
              title: currentStore.name,
              description: storeAddress || 'Base da Loja',
              icon: 'store',
              badgeText: 'Pino da Loja',
            },
          ]}
        />
      </div>
    </div>
  );
};
