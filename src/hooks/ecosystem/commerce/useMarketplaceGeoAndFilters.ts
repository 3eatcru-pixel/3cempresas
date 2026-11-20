import { useState } from 'react';
import {
  geocodeAddressNominatim,
  reverseGeocodeNominatim,
  isValidLatLng,
} from '../../../components/common/map/mapUtils';

export function useMarketplaceGeoAndFilters(showNotification: (msg: string) => void) {
  const [geoAddress, setGeoAddress] = useState<string>(
    'Avenida Higienópolis, 1200 - Jardim Higienópolis, Londrina - PR (CEP 86015-010)'
  );
  const [userCoords, setUserCoords] = useState<[number, number]>([-23.314409, -51.165572]);
  const [gpsCoords, setGpsCoords] = useState<[number, number] | null>(null);
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);
  const [locationSource, setLocationSource] = useState<'GPS' | 'ADDRESS' | 'DEFAULT'>('DEFAULT');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [maxRadiusKm, setMaxRadiusKm] = useState<number>(10);
  const [marketplaceViewMode, setMarketplaceViewMode] = useState<'grid' | 'fichario' | 'livro-razao' | 'map'>('grid');
  const [modalities, setModalities] = useState({
    delivery: true,
    pickup: true,
    tableReservation: false,
    openNow: false,
  });

  const fallbackToPhysicalAddress = async (reasonPrefix: string) => {
    const query = geoAddress.trim();
    if (query.length >= 3) {
      const addrResult = await geocodeAddressNominatim(query, {
        countryCodes: 'br',
        biasCoords: isValidLatLng(userCoords[0], userCoords[1]) ? userCoords : undefined,
      });
      if (addrResult) {
        setUserCoords([addrResult.lat, addrResult.lng]);
        setLocationSource('ADDRESS');
        if (addrResult.displayName) setGeoAddress(addrResult.displayName);
        showNotification(`${reasonPrefix} Usando o endereço físico com maior acurácia.`);
        return;
      }
    }
    showNotification(`${reasonPrefix} Digite seu CEP ou endereço físico para localizar lojas próximas.`);
  };

  const requestUserGeolocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      void fallbackToPhysicalAddress('GPS não disponível neste navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        const accuracy = Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null;
        setGpsCoords(coords);
        setGpsAccuracyMeters(accuracy);

        if (accuracy !== null && accuracy > 1500 && geoAddress.trim().length >= 5) {
          const addrResult = await geocodeAddressNominatim(geoAddress.trim(), {
            countryCodes: 'br',
            biasCoords: isValidLatLng(userCoords[0], userCoords[1]) ? userCoords : undefined,
          });
          if (addrResult) {
            setUserCoords([addrResult.lat, addrResult.lng]);
            setLocationSource('ADDRESS');
            showNotification(
              `Sinal GPS com baixa precisão (±${(accuracy / 1000).toFixed(1)} km). Mantendo seu endereço físico por maior acurácia.`
            );
            return;
          }
        }

        setUserCoords(coords);
        setLocationSource('GPS');
        setGeoAddress(`Localizando endereço (${coords[0].toFixed(4)}, ${coords[1].toFixed(4)})...`);
        const rev = await reverseGeocodeNominatim(coords[0], coords[1]);
        setGeoAddress(
          rev?.displayName || `Minha Localização (${coords[0].toFixed(4)}, ${coords[1].toFixed(4)})`
        );
        showNotification(
          accuracy !== null
            ? `GPS real atualizado (precisão ±${accuracy}m) para filtro de raio!`
            : 'Localização GPS real atualizada para filtro de raio!'
        );
      },
      (err) => {
        if (err?.code === 1) {
          void fallbackToPhysicalAddress('Permissão de GPS negada.');
        } else if (err?.code === 3) {
          void fallbackToPhysicalAddress('Tempo esgotado ao buscar sinal GPS.');
        } else {
          void fallbackToPhysicalAddress('Sinal GPS indisponível no momento.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const geocodeUserAddress = async (queryOverride?: string): Promise<boolean> => {
    const query = (queryOverride ?? geoAddress).trim();
    if (!query || query.length < 3) {
      showNotification('Digite uma rua, bairro ou CEP para localizar no mapa.');
      return false;
    }
    setIsGeocodingAddress(true);
    try {
      const result = await geocodeAddressNominatim(query, {
        countryCodes: 'br',
        biasCoords: isValidLatLng(userCoords[0], userCoords[1]) ? userCoords : undefined,
      });
      if (!result) {
        showNotification('Endereço não localizado no OpenStreetMap. Tente incluir cidade/estado.');
        return false;
      }
      setUserCoords([result.lat, result.lng]);
      setLocationSource('ADDRESS');
      setGeoAddress(result.displayName || query);
      showNotification('Endereço físico localizado e raio do Marketplace atualizado!');
      return true;
    } finally {
      setIsGeocodingAddress(false);
    }
  };

  return {
    geoAddress,
    setGeoAddress,
    userCoords,
    setUserCoords,
    gpsCoords,
    gpsAccuracyMeters,
    locationSource,
    requestUserGeolocation,
    geocodeUserAddress,
    isGeocodingAddress,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    maxRadiusKm,
    setMaxRadiusKm,
    marketplaceViewMode,
    setMarketplaceViewMode,
    modalities,
    setModalities,
  };
}
