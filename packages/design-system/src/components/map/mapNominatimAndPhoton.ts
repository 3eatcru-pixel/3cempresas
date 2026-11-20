import {
  isValidLatLng,
  LONDRINA_CENTER_COORDS,
  NominatimGeocodeResult,
} from './mapTypesAndIcons';
import {
  candidateMatchesCityAndState,
  formatShortBrazilianAddress,
  getCached,
  inferRegionDefaults,
  isSameOriginHttpEnv,
  parseBrazilianAddressParts,
  ParsedBrazilianAddress,
  scoreGeocodeCandidate,
  setCached,
  stripAccentsLower,
  suggestionsCache,
} from './mapBrazilianAddressParser';
import { lookupBrazilianStreetHouseBlock } from './mapViaCepStreetBlock';

export const formatPhotonFeature = (feature: any): NominatimGeocodeResult | null => {
  const coords = feature?.geometry?.coordinates;
  const props = feature?.properties || {};
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!isValidLatLng(lat, lng)) return null;

  const roadName = props.street || props.name || '';
  const houseNumber = props.housenumber ? String(props.housenumber) : undefined;
  const streetPart = [roadName, houseNumber].filter(Boolean).join(', ');
  const neighborhood = props.district || props.suburb || props.locality;
  const city = props.city || props.town || props.village || props.county;
  const state = props.state;

  const partial: NominatimGeocodeResult = {
    lat,
    lng,
    displayName: '',
    cep: props.postcode,
    street: streetPart || props.name,
    houseNumber,
    houseNumberPrecision: houseNumber ? 'EXACT_DOOR' : roadName ? 'STREET_CENTER' : 'AREA_FALLBACK',
    neighborhood,
    city,
    state,
    source: 'PHOTON',
  };
  partial.displayName = formatShortBrazilianAddress(partial) || props.name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return partial;
};

export const mapNominatimItem = (item: any, fallbackLabel: string): (NominatimGeocodeResult & { geojson?: any }) | null => {
  const lat = parseFloat(item?.lat);
  const lng = parseFloat(item?.lon);
  if (!isValidLatLng(lat, lng)) return null;

  const addr = item?.address || {};
  const road = addr.road || addr.pedestrian || addr.footway || addr.path;
  const houseNumber = addr.house_number ? String(addr.house_number) : undefined;
  const street = [road, houseNumber].filter(Boolean).join(', ');
  const neighborhood = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district;
  const city = addr.city || addr.town || addr.municipality || addr.village;
  const state = addr.state;

  const result: NominatimGeocodeResult & { geojson?: any } = {
    lat,
    lng,
    displayName: '',
    cep: addr.postcode,
    street,
    houseNumber,
    houseNumberPrecision: houseNumber ? 'EXACT_DOOR' : road ? 'STREET_CENTER' : 'AREA_FALLBACK',
    neighborhood,
    city,
    state,
    source: 'NOMINATIM',
    geojson: item?.geojson,
  };
  result.displayName = formatShortBrazilianAddress(result) || String(item?.display_name || fallbackLabel);
  return result;
};

export const fetchNominatimCandidates = async (
  paramsObj: Record<string, string>,
  fallbackLabel: string,
  signal?: AbortSignal
): Promise<Array<NominatimGeocodeResult & { geojson?: any }>> => {
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '6',
    ...paramsObj,
  });
  const endpoints = isSameOriginHttpEnv()
    ? [
        `/api/v1/maps/nominatim/search?${params.toString()}`,
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      ]
    : [`https://nominatim.openstreetmap.org/search?${params.toString()}`];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
        signal,
      });
      if (!response.ok) continue;
      const data = await response.json();
      if (!Array.isArray(data)) continue;
      return data
        .map((item: any) => mapNominatimItem(item, fallbackLabel))
        .filter((r): r is NominatimGeocodeResult & { geojson?: any } => Boolean(r));
    } catch {
      // try next endpoint
    }
  }
  return [];
};

export const searchAddressSuggestions = async (
  query: string,
  options?: {
    regionBias?: string;
    limit?: number;
    biasCoords?: [number, number];
    countryCodeFilter?: string;
    signal?: AbortSignal;
  }
): Promise<NominatimGeocodeResult[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const parsed = parseBrazilianAddressParts(trimmed);
  const inferred = inferRegionDefaults(parsed, options?.regionBias, options?.biasCoords);
  const regionBias = options?.regionBias?.trim();
  const baseText = parsed.normalizedQuery
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const fullQuery =
    regionBias && !stripAccentsLower(baseText).includes(stripAccentsLower(regionBias))
      ? `${baseText} ${regionBias}`
      : inferred.city && !stripAccentsLower(baseText).includes(stripAccentsLower(inferred.city))
      ? `${baseText} ${inferred.city} ${inferred.stateUf || ''}`.trim()
      : baseText;

  const cacheKey = `sug:${fullQuery.toLowerCase()}`;
  const cached = getCached(suggestionsCache, cacheKey);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5500);
  const signal = options?.signal || controller.signal;

  try {
    const params = new URLSearchParams({
      q: fullQuery,
      limit: String(Math.max(5, options?.limit || 5)),
    });
    if (options?.biasCoords && isValidLatLng(options.biasCoords[0], options.biasCoords[1])) {
      params.set('lat', String(options.biasCoords[0]));
      params.set('lon', String(options.biasCoords[1]));
    }

    const viaCepPromise =
      parsed.street && inferred.city && inferred.stateUf && parsed.houseNumber
        ? lookupBrazilianStreetHouseBlock(
            parsed.street,
            inferred.city,
            inferred.stateUf,
            parsed.houseNumber,
            parsed.neighborhood,
            signal
          )
        : Promise.resolve({ matched: null, blocks: [] });

    const [photonRes, viaCepBlockRes] = await Promise.all([
      fetch(`https://photon.komoot.io/api/?${params.toString()}`, { signal }).catch(() => null),
      viaCepPromise,
    ]);

    let list: NominatimGeocodeResult[] = [];
    if (photonRes && photonRes.ok) {
      const data = await photonRes.json();
      const wantCountry = (options?.countryCodeFilter || 'BR').toUpperCase();
      const features = Array.isArray(data?.features) ? data.features : [];
      const filteredFeatures = wantCountry
        ? features.filter((f: any) => {
            const cc = String(f?.properties?.countrycode || '').toUpperCase();
            return !cc || cc === wantCountry;
          })
        : features;

      list = filteredFeatures
        .map(formatPhotonFeature)
        .filter((item: NominatimGeocodeResult | null): item is NominatimGeocodeResult => Boolean(item));
    }

    const scoringTarget: ParsedBrazilianAddress = {
      ...parsed,
      city: parsed.city || inferred.city,
      stateUf: parsed.stateUf || inferred.stateUf,
      stateFull: parsed.stateFull || inferred.stateFull,
      cep: parsed.cep || viaCepBlockRes.matched?.cep?.replace(/\D/g, ''),
      neighborhood: parsed.neighborhood || viaCepBlockRes.matched?.bairro,
    };

    if (viaCepBlockRes.matched && parsed.houseNumber) {
      const m = viaCepBlockRes.matched;
      const targetCoreStreet = stripAccentsLower(
        m.logradouro.replace(/^(Rua|Avenida|Alameda|Travessa|Rodovia|Estrada|Praça)\s+/i, '')
      );
      const streetMatchedAnchor = list.find((it) => {
        const mc = candidateMatchesCityAndState(it, scoringTarget);
        const itStreet = stripAccentsLower(it.street || '');
        return mc.cityOk && mc.stateOk && targetCoreStreet && itStreet.includes(targetCoreStreet);
      });
      const anchorItem =
        streetMatchedAnchor ||
        list.find((it) => {
          const mc = candidateMatchesCityAndState(it, scoringTarget);
          return mc.cityOk && mc.stateOk;
        });
      const fallbackPos: [number, number] = anchorItem
        ? [anchorItem.lat, anchorItem.lng]
        : options?.biasCoords && isValidLatLng(options.biasCoords[0], options.biasCoords[1])
        ? options.biasCoords
        : LONDRINA_CENTER_COORDS;

      const syntheticDisplay = `${formatShortBrazilianAddress({
        street: `${m.logradouro}, ${parsed.houseNumber}`,
        neighborhood: m.bairro,
        city: m.localidade,
        state: m.uf,
      })} (CEP ${m.cep})`;

      const exactPhotonAlready = list.some((it) => {
        const mc = candidateMatchesCityAndState(it, scoringTarget);
        const itStreet = stripAccentsLower(it.street || '');
        return (
          it.houseNumber === parsed.houseNumber &&
          mc.cityOk &&
          Boolean(targetCoreStreet) &&
          itStreet.includes(targetCoreStreet)
        );
      });

      if (!exactPhotonAlready) {
        list.unshift({
          lat: fallbackPos[0],
          lng: fallbackPos[1],
          displayName: syntheticDisplay,
          cep: m.cep,
          street: `${m.logradouro}, ${parsed.houseNumber}`,
          houseNumber: parsed.houseNumber,
          houseNumberPrecision: 'CEP_BLOCK',
          neighborhood: m.bairro,
          city: m.localidade,
          state: m.uf,
          source: 'VIACEP_OSM',
        });
      }
    }

    const sorted = list
      .sort(
        (a: NominatimGeocodeResult, b: NominatimGeocodeResult) =>
          scoreGeocodeCandidate(b, scoringTarget, options?.biasCoords) -
          scoreGeocodeCandidate(a, scoringTarget, options?.biasCoords)
      )
      .slice(0, options?.limit || 5);

    setCached(suggestionsCache, cacheKey, sorted);
    return sorted;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
};
