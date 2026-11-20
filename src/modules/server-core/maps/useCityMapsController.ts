import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useEcosystem } from '../../../context/EcosystemContext';
import { MapMarkerData } from '../../../components/common/MapDisplay';
import {
  geocodeAddressNominatim,
  isValidLatLng,
  LONDRINA_CENTER_COORDS,
  NominatimGeocodeResult,
  reverseGeocodeNominatim,
} from '../../../components/common/map/mapUtils';
import {
  CityDirectoryRow,
  IbgeCityItem,
  IbgeStateItem,
  SourceFilter,
} from './cityMapsTypes';

export function useCityMapsController() {
  const { getIdToken } = useAuth();
  const { showNotification } = useEcosystem();

  const [country] = useState<'Brasil'>('Brasil');
  const [states, setStates] = useState<IbgeStateItem[]>([]);
  const [cities, setCities] = useState<IbgeCityItem[]>([]);

  const [selectedUf, setSelectedUf] = useState<string>('PR');
  const [selectedCity, setSelectedCity] = useState<string>('Londrina');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [neighborhood, setNeighborhood] = useState<string>('');
  const [street, setStreet] = useState<string>('Avenida Higienópolis');
  const [houseNumber, setHouseNumber] = useState<string>('1200');
  const [cep, setCep] = useState<string>('');

  const [availableRegions, setAvailableRegions] = useState<string[]>([
    'CENTRO',
    'SUL',
    'NORTE',
    'OESTE',
    'LESTE',
  ]);
  const [availableNeighborhoods, setAvailableNeighborhoods] = useState<string[]>([]);
  const [rows, setRows] = useState<CityDirectoryRow[]>([]);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL');

  const [isLoadingStates, setIsLoadingStates] = useState<boolean>(false);
  const [isLoadingCities, setIsLoadingCities] = useState<boolean>(false);
  const [isQueryingDirectory, setIsQueryingDirectory] = useState<boolean>(false);
  const [isGeocodingPin, setIsGeocodingPin] = useState<boolean>(false);
  const [isSavingIndex, setIsSavingIndex] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [resolvedPin, setResolvedPin] = useState<NominatimGeocodeResult | null>({
    lat: -23.314409,
    lng: -51.165572,
    displayName: 'Avenida Higienópolis, 1200 - Jardim Higienópolis, Londrina - PR (CEP 86015-010)',
    cep: '86015-010',
    street: 'Avenida Higienópolis, 1200',
    houseNumber: '1200',
    houseNumberPrecision: 'CEP_BLOCK_INTERPOLATED',
    neighborhood: 'Jardim Higienópolis',
    city: 'Londrina',
    state: 'PR',
    source: 'VIACEP_OSM',
  });

  useEffect(() => {
    let active = true;
    setIsLoadingStates(true);
    fetch('/api/v1/maps/ibge/states')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && Array.isArray(data?.states)) {
          setStates(data.states);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingStates(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedUf) return;
    let active = true;
    setIsLoadingCities(true);
    fetch(`/api/v1/maps/ibge/cities?uf=${encodeURIComponent(selectedUf)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return;
        const list: IbgeCityItem[] = Array.isArray(data?.cities) ? data.cities : [];
        setCities(list);
        if (list.length > 0 && !list.some((c) => c.name.toLowerCase() === selectedCity.toLowerCase())) {
          setSelectedCity(selectedUf === 'PR' ? 'Londrina' : list[0].name);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingCities(false);
      });
    return () => {
      active = false;
    };
  }, [selectedUf]);

  const currentStateObj = useMemo(
    () => states.find((s) => s.uf === selectedUf),
    [states, selectedUf]
  );

  const currentCityObj = useMemo(
    () => cities.find((c) => c.name.toLowerCase() === selectedCity.toLowerCase()),
    [cities, selectedCity]
  );

  const fetchCityDirectory = useCallback(async () => {
    setIsQueryingDirectory(true);
    setErrorMessage(null);
    try {
      const qs = new URLSearchParams({
        uf: selectedUf,
        city: selectedCity,
      });
      if (selectedRegion) qs.set('region', selectedRegion);
      if (neighborhood.trim()) qs.set('neighborhood', neighborhood.trim());
      if (street.trim()) qs.set('street', street.trim());
      if (houseNumber.trim()) qs.set('number', houseNumber.trim());
      if (cep.trim()) qs.set('cep', cep.trim());

      const resp = await fetch(`/api/v1/maps/city-directory?${qs.toString()}`);
      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.error || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      if (Array.isArray(data?.facets?.regions) && data.facets.regions.length > 0) {
        setAvailableRegions(data.facets.regions);
      }
      if (Array.isArray(data?.facets?.neighborhoods)) {
        setAvailableNeighborhoods(data.facets.neighborhoods);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Não foi possível consultar os dados territoriais.');
    } finally {
      setIsQueryingDirectory(false);
    }
  }, [selectedUf, selectedCity, selectedRegion, neighborhood, street, houseNumber, cep]);

  useEffect(() => {
    void fetchCityDirectory();
  }, [selectedUf, selectedCity]);

  const handleLocateOnMap = async () => {
    const cleanCep = cep.replace(/\D/g, '');
    const queryParts = [
      street.trim() ? (houseNumber.trim() ? `${street.trim()}, ${houseNumber.trim()}` : street.trim()) : '',
      neighborhood.trim(),
      selectedCity,
      selectedUf,
    ].filter(Boolean);

    const query = cleanCep.length === 8 && !street.trim() ? cleanCep : queryParts.join(', ');
    if (!query || query.length < 3) {
      showNotification('Informe rua/número, bairro ou CEP para localizar no mapa.');
      return;
    }

    setIsGeocodingPin(true);
    try {
      const biasCoords: [number, number] | undefined =
        selectedUf === 'PR' && selectedCity.toLowerCase() === 'londrina'
          ? LONDRINA_CENTER_COORDS
          : undefined;

      const geo = await geocodeAddressNominatim(query, {
        regionBias: `${selectedCity}, ${selectedUf}`,
        countryCodes: 'br',
        biasCoords,
      });

      if (!geo) {
        showNotification(`Coordenada exata não localizada para "${query}".`);
        return;
      }

      const enriched = await reverseGeocodeNominatim(geo.lat, geo.lng).catch(() => null);
      const mergedPin: NominatimGeocodeResult = {
        ...geo,
        siglonQuadraLote: enriched?.siglonQuadraLote || geo.siglonQuadraLote,
        cep:
          geo.cep ||
          enriched?.cep ||
          (cleanCep.length === 8 ? `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}` : undefined),
        neighborhood: geo.neighborhood || neighborhood.trim() || enriched?.neighborhood,
      };
      setResolvedPin(mergedPin);
      if (mergedPin.cep && !cep.trim()) setCep(mergedPin.cep);
      if (mergedPin.neighborhood && !neighborhood.trim()) setNeighborhood(mergedPin.neighborhood);
      showNotification(`Localizado: ${mergedPin.displayName}`);
      await fetchCityDirectory();
    } finally {
      setIsGeocodingPin(false);
    }
  };

  const handleSaveToCityIndex = async () => {
    const targetStreet = street.trim() || (resolvedPin?.street || '').split(',')[0].trim();
    if (!targetStreet || !selectedCity || !selectedUf) {
      showNotification('Preencha Estado, Cidade e Rua para indexar no servidor.');
      return;
    }
    setIsSavingIndex(true);
    try {
      const token = await getIdToken();
      if (!token) {
        showNotification('Sessão DEV_OWNER necessária para gravar no índice do servidor.');
        return;
      }
      const resp = await fetch('/api/v1/maps/city-index', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stateUf: selectedUf,
          stateName: currentStateObj?.name || selectedUf,
          city: selectedCity,
          region: selectedRegion || 'CENTRO',
          neighborhood: neighborhood.trim() || resolvedPin?.neighborhood || '',
          street: targetStreet,
          houseNumber: houseNumber.trim() || resolvedPin?.houseNumber || '',
          cep: cep.trim() || resolvedPin?.cep || '',
          lat: resolvedPin && isValidLatLng(resolvedPin.lat, resolvedPin.lng) ? resolvedPin.lat : null,
          lng: resolvedPin && isValidLatLng(resolvedPin.lat, resolvedPin.lng) ? resolvedPin.lng : null,
          siglonQuadraLote: resolvedPin?.siglonQuadraLote || null,
          label: resolvedPin?.displayName || '',
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.error || `HTTP ${resp.status}`);
      }
      showNotification('Endereço territorial salvo em Server City Maps Data.');
      await fetchCityDirectory();
    } catch (err: any) {
      showNotification(err?.message || 'Erro ao salvar registro no índice.');
    } finally {
      setIsSavingIndex(false);
    }
  };

  const handleDeleteIndexRow = async (id: string) => {
    try {
      const token = await getIdToken();
      if (!token) {
        showNotification('Autenticação necessária para excluir registros.');
        return;
      }
      const resp = await fetch(`/api/v1/maps/city-index/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      showNotification('Registro removido de City Maps Data.');
      await fetchCityDirectory();
    } catch (err: any) {
      showNotification(err?.message || 'Falha ao excluir registro.');
    }
  };

  const handleInspectRow = async (row: CityDirectoryRow) => {
    if (row.neighborhood) setNeighborhood(row.neighborhood);
    if (row.street) setStreet(row.street);
    if (row.houseNumber) setHouseNumber(row.houseNumber);
    if (row.cep) setCep(row.cep);
    if (row.region && row.region !== 'CORREIOS_CEP' && row.region !== 'MUNICIPAL') {
      setSelectedRegion(row.region);
    }

    if (typeof row.lat === 'number' && typeof row.lng === 'number' && isValidLatLng(row.lat, row.lng)) {
      setResolvedPin({
        lat: row.lat,
        lng: row.lng,
        displayName: `${row.street}${row.houseNumber ? `, ${row.houseNumber}` : ''} - ${
          row.neighborhood || row.city
        }, ${row.city} - ${row.stateUf}`,
        cep: row.cep,
        street: row.street,
        houseNumber: row.houseNumber,
        neighborhood: row.neighborhood,
        city: row.city,
        state: row.stateUf,
        siglonQuadraLote: row.siglonQuadraLote || undefined,
      });
      return;
    }

    const q = [
      row.street ? (row.houseNumber ? `${row.street}, ${row.houseNumber}` : row.street) : '',
      row.neighborhood,
      row.city,
      row.stateUf,
    ]
      .filter(Boolean)
      .join(', ');
    if (q) {
      setIsGeocodingPin(true);
      try {
        const geo = await geocodeAddressNominatim(q, {
          regionBias: `${row.city}, ${row.stateUf}`,
          countryCodes: 'br',
        });
        if (geo) setResolvedPin(geo);
      } finally {
        setIsGeocodingPin(false);
      }
    }
  };

  const handleResetFilters = () => {
    setSelectedRegion('');
    setNeighborhood('');
    setStreet('');
    setHouseNumber('');
    setCep('');
    setSourceFilter('ALL');
  };

  const filteredRows = useMemo(() => {
    if (sourceFilter === 'ALL') return rows;
    return rows.filter((r) => r.source === sourceFilter);
  }, [rows, sourceFilter]);

  const mapMarkers = useMemo<MapMarkerData[]>(() => {
    const markers: MapMarkerData[] = [];
    if (resolvedPin && isValidLatLng(resolvedPin.lat, resolvedPin.lng)) {
      markers.push({
        position: [resolvedPin.lat, resolvedPin.lng],
        title: resolvedPin.street || 'Ponto Selecionado',
        description: resolvedPin.siglonQuadraLote
          ? `${resolvedPin.displayName} · ${resolvedPin.siglonQuadraLote}`
          : resolvedPin.displayName,
        icon: 'customer',
        badgeText: 'Alvo',
      });
    }
    rows.forEach((r) => {
      if (typeof r.lat === 'number' && typeof r.lng === 'number' && isValidLatLng(r.lat, r.lng)) {
        markers.push({
          position: [r.lat, r.lng],
          title: r.label || `${r.street}${r.houseNumber ? `, ${r.houseNumber}` : ''}`,
          description: `${r.neighborhood || r.city} · CEP ${r.cep || 'N/D'}`,
          icon: r.source === 'STORE_DB' ? 'store' : 'cluster',
          badgeText: r.houseNumber || r.stateUf,
        });
      }
    });
    return markers;
  }, [resolvedPin, rows]);

  const mapCenter: [number, number] =
    resolvedPin && isValidLatLng(resolvedPin.lat, resolvedPin.lng)
      ? [resolvedPin.lat, resolvedPin.lng]
      : LONDRINA_CENTER_COORDS;

  const sourceCounts = useMemo(() => {
    const counts = { CITY_INDEX: 0, STORE_DB: 0, VIACEP_RANGE: 0, SIGLON_LONDRINA: 0 };
    rows.forEach((r) => {
      if (r.source in counts) {
        counts[r.source as keyof typeof counts] += 1;
      }
    });
    return counts;
  }, [rows]);

  const handleMapClick = async (lat: number, lng: number) => {
    const rev = await reverseGeocodeNominatim(lat, lng);
    if (rev) {
      setResolvedPin(rev);
      if (rev.street) setStreet(rev.street.split(',')[0].trim());
      if (rev.houseNumber) setHouseNumber(rev.houseNumber);
      if (rev.neighborhood) setNeighborhood(rev.neighborhood);
      if (rev.cep) setCep(rev.cep);
    } else {
      setResolvedPin({
        lat,
        lng,
        displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      });
    }
  };

  return {
    country,
    states,
    cities,
    selectedUf,
    setSelectedUf,
    selectedCity,
    setSelectedCity,
    selectedRegion,
    setSelectedRegion,
    neighborhood,
    setNeighborhood,
    street,
    setStreet,
    houseNumber,
    setHouseNumber,
    cep,
    setCep,
    availableRegions,
    availableNeighborhoods,
    rows,
    sourceFilter,
    setSourceFilter,
    isLoadingStates,
    isLoadingCities,
    isQueryingDirectory,
    isGeocodingPin,
    isSavingIndex,
    errorMessage,
    resolvedPin,
    setResolvedPin,
    currentStateObj,
    currentCityObj,
    fetchCityDirectory,
    handleLocateOnMap,
    handleSaveToCityIndex,
    handleDeleteIndexRow,
    handleInspectRow,
    handleResetFilters,
    filteredRows,
    mapMarkers,
    mapCenter,
    sourceCounts,
    handleMapClick,
  };
}
