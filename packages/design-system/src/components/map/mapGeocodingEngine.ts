import {
  isInsideLondrina,
  isValidLatLng,
  LONDRINA_CENTER_COORDS,
  NominatimGeocodeResult,
} from './mapTypesAndIcons';
import {
  candidateMatchesCityAndState,
  expandBrazilianAbbreviations,
  formatShortBrazilianAddress,
  geocodeCache,
  getCached,
  inferRegionDefaults,
  interpolatePointOnStreetGeometry,
  isSameOriginHttpEnv,
  parseBrazilianAddressParts,
  ParsedBrazilianAddress,
  parseViaCepComplementRangeLocal,
  reverseCache,
  scoreGeocodeCandidate,
  setCached,
  stripAccentsLower,
  suggestionsCache,
  UF_FULL_NAMES,
  ViaCepStreetBlock,
} from './mapBrazilianAddressParser';

const formatPhotonFeature = (feature: any): NominatimGeocodeResult | null => {
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

const mapNominatimItem = (item: any, fallbackLabel: string): (NominatimGeocodeResult & { geojson?: any }) | null => {
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

const fetchNominatimCandidates = async (
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

const viaCepStreetCache = new Map<
  string,
  { expiresAt: number; value: { matched: ViaCepStreetBlock | null; blocks: ViaCepStreetBlock[] } }
>();

const lookupBrazilianStreetHouseBlock = async (
  street: string,
  city: string,
  uf: string,
  houseNumber?: string,
  neighborhoodHint?: string,
  signal?: AbortSignal
): Promise<{ matched: ViaCepStreetBlock | null; blocks: ViaCepStreetBlock[] }> => {
  const cleanUf = uf.trim().toUpperCase().slice(0, 2);
  const cleanCity = city.trim();
  const cleanStreet = street.trim();
  if (!/^[A-Z]{2}$/.test(cleanUf) || cleanCity.length < 2 || cleanStreet.length < 3) {
    return { matched: null, blocks: [] };
  }

  const numDigits = (houseNumber || '').replace(/\D/g, '');
  const targetNum = numDigits ? parseInt(numDigits, 10) : null;
  const cacheKey = `vcst:${cleanUf}:${stripAccentsLower(cleanCity)}:${stripAccentsLower(cleanStreet)}:${numDigits}:${stripAccentsLower(neighborhoodHint || '')}`;
  const cached = getCached(viaCepStreetCache, cacheKey);
  if (cached !== undefined) return cached;

  try {
    if (isSameOriginHttpEnv()) {
      const qs = new URLSearchParams({
        uf: cleanUf,
        city: cleanCity,
        street: cleanStreet,
        ...(numDigits ? { number: numDigits } : {}),
        ...(neighborhoodHint ? { neighborhood: neighborhoodHint } : {}),
      });
      const resp = await fetch(`/api/v1/maps/viacep-street?${qs.toString()}`, { signal });
      if (resp.ok) {
        const json = await resp.json();
        const result = {
          matched: (json?.matched || null) as ViaCepStreetBlock | null,
          blocks: Array.isArray(json?.blocks) ? (json.blocks as ViaCepStreetBlock[]) : [],
        };
        setCached(viaCepStreetCache, cacheKey, result);
        return result;
      }
    }

    const strippedStreet = cleanStreet
      .replace(/^(Rua|Avenida|Av\.?|R\.?|Alameda|Travessa|Rodovia|Estrada|Praça)\s+/i, '')
      .trim();
    const tries = Array.from(new Set([cleanStreet, strippedStreet].filter((s) => s.length >= 3)));
    let rawList: any[] = [];
    for (const st of tries) {
      const resp = await fetch(
        `https://viacep.com.br/ws/${encodeURIComponent(cleanUf)}/${encodeURIComponent(cleanCity)}/${encodeURIComponent(st)}/json/`,
        { signal }
      );
      if (!resp.ok) continue;
      const json = await resp.json();
      if (Array.isArray(json) && json.length > 0) {
        rawList = json;
        break;
      }
    }

    const blocks: ViaCepStreetBlock[] = rawList
      .filter((b: any) => b && b.cep && !b.erro)
      .map((b: any) => ({
        cep: String(b.cep),
        logradouro: String(b.logradouro || ''),
        complemento: String(b.complemento || ''),
        bairro: String(b.bairro || ''),
        localidade: String(b.localidade || cleanCity),
        uf: String(b.uf || cleanUf),
        range: parseViaCepComplementRangeLocal(b.complemento || ''),
      }));

    if (blocks.length === 0) {
      const empty = { matched: null, blocks: [] };
      setCached(viaCepStreetCache, cacheKey, empty);
      return empty;
    }

    const neighHintNorm = stripAccentsLower(neighborhoodHint || '');
    const scored = blocks.map((block) => {
      let score = 0;
      const bStreet = stripAccentsLower(block.logradouro);
      if (bStreet === stripAccentsLower(cleanStreet)) score += 400;
      else if (bStreet.includes(stripAccentsLower(strippedStreet))) score += 200;
      if (neighHintNorm && stripAccentsLower(block.bairro).includes(neighHintNorm)) score += 300;
      if (targetNum !== null && Number.isFinite(targetNum)) {
        const { min, max, exactNumber, parity } = block.range;
        if (exactNumber !== null && exactNumber === targetNum) score += 900;
        else if (min !== null || max !== null) {
          const lo = min ?? 0;
          const hi = max ?? Number.MAX_SAFE_INTEGER;
          if (targetNum >= lo && targetNum <= hi) {
            score += 650;
            if (parity === 'ODD' && targetNum % 2 === 1) score += 80;
            if (parity === 'EVEN' && targetNum % 2 === 0) score += 80;
          } else {
            score -= 350;
          }
        }
      }
      return { block, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const out = { matched: scored[0]?.block || null, blocks: blocks.slice(0, 20) };
    setCached(viaCepStreetCache, cacheKey, out);
    return out;
  } catch {
    return { matched: null, blocks: [] };
  }
};

export const lookupBrazilianCep = async (
  rawCep: string,
  options?: { signal?: AbortSignal; biasCoords?: [number, number] }
): Promise<NominatimGeocodeResult | null> => {
  const digits = rawCep.replace(/\D/g, '');
  if (digits.length !== 8) return null;

  const cacheKey = `cep:${digits}`;
  const cached = getCached(geocodeCache, cacheKey);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  const signal = options?.signal || controller.signal;

  const resolveStreetByFields = async (
    street: string | undefined,
    neighborhood: string | undefined,
    city: string | undefined,
    uf: string | undefined,
    brasilApiCoords?: [number, number]
  ): Promise<NominatimGeocodeResult | null> => {
    const fullState = uf ? UF_FULL_NAMES[uf.toUpperCase()] || uf : undefined;
    const displayLabel =
      formatShortBrazilianAddress({
        street,
        neighborhood,
        city,
        state: uf,
      }) || `CEP ${digits}`;

    const parsedTarget: ParsedBrazilianAddress = {
      cep: digits,
      street: street ? expandBrazilianAbbreviations(street) : undefined,
      neighborhood,
      city,
      stateUf: uf?.toUpperCase(),
      stateFull: fullState,
      normalizedQuery: [street, neighborhood, city, fullState].filter(Boolean).join(', '),
    };

    if (street && city) {
      const structuredCandidates = await fetchNominatimCandidates(
        {
          street: expandBrazilianAbbreviations(street),
          city,
          ...(fullState ? { state: fullState } : {}),
          countrycodes: 'br',
        },
        displayLabel,
        signal
      );

      const qCandidates =
        structuredCandidates.length === 0
          ? await fetchNominatimCandidates(
              {
                q: `${expandBrazilianAbbreviations(street)}, ${neighborhood ? `${neighborhood}, ` : ''}${city}, ${fullState || ''}, Brasil`,
                countrycodes: 'br',
              },
              displayLabel,
              signal
            )
          : [];

      const candidates = [...structuredCandidates, ...qCandidates];
      if (candidates.length > 0) {
        candidates.sort(
          (a, b) =>
            scoreGeocodeCandidate(b, parsedTarget, brasilApiCoords || options?.biasCoords) -
            scoreGeocodeCandidate(a, parsedTarget, brasilApiCoords || options?.biasCoords)
        );
        const best = candidates[0];
        const match = candidateMatchesCityAndState(best, parsedTarget);
        if (match.cityOk && match.stateOk) {
          return {
            ...best,
            displayName: displayLabel,
            cep: digits,
            street: street || best.street,
            neighborhood: neighborhood || best.neighborhood,
            city: city || best.city,
            state: uf || best.state,
            source: brasilApiCoords ? 'BRASILAPI' : 'NOMINATIM',
          };
        }
      }

      if (!brasilApiCoords) {
        const photonMatches = await searchAddressSuggestions(
          [expandBrazilianAbbreviations(street), neighborhood, city, fullState].filter(Boolean).join(', '),
          { limit: 5, biasCoords: options?.biasCoords, countryCodeFilter: 'BR', signal }
        );
        if (photonMatches.length > 0) {
          photonMatches.sort(
            (a, b) =>
              scoreGeocodeCandidate(b, parsedTarget, options?.biasCoords) -
              scoreGeocodeCandidate(a, parsedTarget, options?.biasCoords)
          );
          const bestPhoton = photonMatches[0];
          const match = candidateMatchesCityAndState(bestPhoton, parsedTarget);
          if (match.cityOk && match.stateOk) {
            return {
              ...bestPhoton,
              displayName: displayLabel,
              cep: digits,
              street: street || bestPhoton.street,
              neighborhood: neighborhood || bestPhoton.neighborhood,
              city: city || bestPhoton.city,
              state: uf || bestPhoton.state,
              source: 'PHOTON',
            };
          }
        }
      }
    }

    if (brasilApiCoords && isValidLatLng(brasilApiCoords[0], brasilApiCoords[1])) {
      return {
        lat: brasilApiCoords[0],
        lng: brasilApiCoords[1],
        displayName: displayLabel,
        cep: digits,
        street,
        neighborhood,
        city,
        state: uf,
        source: 'BRASILAPI',
      };
    }

    const postalCandidates = await fetchNominatimCandidates(
      {
        postalcode: `${digits.slice(0, 5)}-${digits.slice(5)}`,
        ...(city ? { city } : {}),
        countrycodes: 'br',
      },
      displayLabel,
      signal
    );
    if (postalCandidates.length > 0) {
      return {
        ...postalCandidates[0],
        displayName: displayLabel,
        cep: digits,
        street: street || postalCandidates[0].street,
        neighborhood: neighborhood || postalCandidates[0].neighborhood,
        city: city || postalCandidates[0].city,
        state: uf || postalCandidates[0].state,
        source: 'NOMINATIM',
      };
    }

    if (city) {
      const cityMatches = await searchAddressSuggestions(
        [neighborhood, city, fullState].filter(Boolean).join(', '),
        { limit: 3, biasCoords: options?.biasCoords, countryCodeFilter: 'BR', signal }
      );
      if (cityMatches.length > 0) {
        return {
          ...cityMatches[0],
          displayName: displayLabel,
          cep: digits,
          street: street || cityMatches[0].street,
          neighborhood: neighborhood || cityMatches[0].neighborhood,
          city: city || cityMatches[0].city,
          state: uf || cityMatches[0].state,
          source: 'PHOTON',
        };
      }
    }
    return null;
  };

  try {
    const brRes = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`, { signal });
    if (brRes.ok) {
      const data = await brRes.json();
      const coords = data?.location?.coordinates;
      const lng = Number(coords?.longitude);
      const lat = Number(coords?.latitude);
      const validBrCoords: [number, number] | undefined = isValidLatLng(lat, lng) ? [lat, lng] : undefined;

      const resolved = await resolveStreetByFields(
        data.street,
        data.neighborhood,
        data.city,
        data.state,
        validBrCoords
      );
      if (resolved) {
        setCached(geocodeCache, cacheKey, resolved);
        return resolved;
      }
    }

    const viaRes = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal });
    if (viaRes.ok) {
      const vData = await viaRes.json();
      if (!vData?.erro) {
        const resolved = await resolveStreetByFields(
          vData.logradouro,
          vData.bairro,
          vData.localidade,
          vData.uf
        );
        if (resolved) {
          setCached(geocodeCache, cacheKey, resolved);
          return resolved;
        }
      }
    }

    setCached(geocodeCache, cacheKey, null);
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
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

export const geocodeAddressNominatim = async (
  query: string,
  options?: { regionBias?: string; countryCodes?: string; biasCoords?: [number, number]; signal?: AbortSignal }
): Promise<NominatimGeocodeResult | null> => {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const cleanDigits = trimmed.replace(/\D/g, '');
  if (/^\d{5}-?\d{3}$/.test(trimmed) || cleanDigits.length === 8) {
    const cepResult = await lookupBrazilianCep(cleanDigits, {
      signal: options?.signal,
      biasCoords: options?.biasCoords,
    });
    if (cepResult) return cepResult;
  }

  const parsed = parseBrazilianAddressParts(trimmed);
  const inferred = inferRegionDefaults(parsed, options?.regionBias, options?.biasCoords);
  const effectiveParsed: ParsedBrazilianAddress = {
    ...parsed,
    city: parsed.city || inferred.city,
    stateUf: parsed.stateUf || inferred.stateUf,
    stateFull: parsed.stateFull || inferred.stateFull,
  };

  const regionBias = options?.regionBias?.trim();
  const fullQuery =
    regionBias && !stripAccentsLower(effectiveParsed.normalizedQuery).includes(stripAccentsLower(regionBias))
      ? `${effectiveParsed.normalizedQuery}, ${regionBias}`
      : effectiveParsed.city &&
        !stripAccentsLower(effectiveParsed.normalizedQuery).includes(stripAccentsLower(effectiveParsed.city))
      ? `${effectiveParsed.normalizedQuery}, ${effectiveParsed.city}${effectiveParsed.stateFull ? `, ${effectiveParsed.stateFull}` : ''}`
      : effectiveParsed.normalizedQuery;

  const countryCode = options?.countryCodes || 'br';
  const cacheKey = `geo:${fullQuery.toLowerCase()}:${countryCode}`;
  const cached = getCached(geocodeCache, cacheKey);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  const signal = options?.signal || controller.signal;

  const pickBest = (
    candidates: Array<NominatimGeocodeResult & { geojson?: any }>,
    target: ParsedBrazilianAddress = effectiveParsed
  ): (NominatimGeocodeResult & { geojson?: any }) | null => {
    if (candidates.length === 0) return null;
    const sorted = [...candidates].sort(
      (a, b) =>
        scoreGeocodeCandidate(b, target, options?.biasCoords) -
        scoreGeocodeCandidate(a, target, options?.biasCoords)
    );
    return sorted[0];
  };

  const isAccurateRegionMatch = (
    candidate: NominatimGeocodeResult | null,
    target: ParsedBrazilianAddress = effectiveParsed
  ): boolean => {
    if (!candidate) return false;
    const { cityOk, stateOk } = candidateMatchesCityAndState(candidate, target);
    return cityOk && stateOk;
  };

  const finalizeResult = (
    candidate: NominatimGeocodeResult & { geojson?: any },
    matchedViaCep?: ViaCepStreetBlock | null,
    fallbackGeomPool: Array<NominatimGeocodeResult & { geojson?: any }> = []
  ): NominatimGeocodeResult => {
    const clean = { ...candidate };
    delete clean.geojson;
    if (effectiveParsed.houseNumber && !clean.houseNumber) {
      const roadOnly = (clean.street || matchedViaCep?.logradouro || effectiveParsed.street || '').split(',')[0].trim();
      const hasLineGeom = (g: any) => g && (g.type === 'LineString' || g.type === 'MultiLineString');
      const targetGeom = hasLineGeom(candidate.geojson)
        ? candidate.geojson
        : fallbackGeomPool.find((c) => {
            if (!hasLineGeom(c.geojson)) return false;
            const cStreet = stripAccentsLower(c.street || '');
            const targetCore = stripAccentsLower(
              roadOnly.replace(/^(Rua|Avenida|Alameda|Travessa|Rodovia|Estrada|Praça)\s+/i, '')
            );
            return Boolean(targetCore) && cStreet.includes(targetCore);
          })?.geojson;
      const interpolated = interpolatePointOnStreetGeometry(
        targetGeom,
        effectiveParsed.houseNumber,
        matchedViaCep?.range,
        isInsideLondrina(clean.lat, clean.lng) ? LONDRINA_CENTER_COORDS : [clean.lat, clean.lng]
      );
      if (interpolated) {
        clean.lat = interpolated[0];
        clean.lng = interpolated[1];
        clean.houseNumberPrecision = 'CEP_BLOCK_INTERPOLATED';
      } else if (matchedViaCep) {
        clean.houseNumberPrecision = 'CEP_BLOCK';
      }
      clean.houseNumber = effectiveParsed.houseNumber;
      if (roadOnly) {
        clean.street = `${roadOnly}, ${effectiveParsed.houseNumber}`;
      }
      if (matchedViaCep) {
        clean.cep = clean.cep || matchedViaCep.cep;
        clean.neighborhood = matchedViaCep.bairro || clean.neighborhood;
        clean.source = 'VIACEP_OSM';
      }
      clean.displayName = formatShortBrazilianAddress(clean) || clean.displayName;
      if (clean.cep && !clean.displayName.includes(clean.cep)) {
        clean.displayName = `${clean.displayName} (CEP ${clean.cep})`;
      }
    }
    return clean;
  };

  const collectedCandidates: Array<NominatimGeocodeResult & { geojson?: any }> = [];

  try {
    const viaCepPromise =
      effectiveParsed.street && effectiveParsed.city && effectiveParsed.stateUf
        ? lookupBrazilianStreetHouseBlock(
            effectiveParsed.street,
            effectiveParsed.city,
            effectiveParsed.stateUf,
            effectiveParsed.houseNumber,
            effectiveParsed.neighborhood,
            signal
          )
        : Promise.resolve({ matched: null, blocks: [] });

    const structPromise =
      effectiveParsed.street && effectiveParsed.city
        ? fetchNominatimCandidates(
            {
              street: effectiveParsed.houseNumber
                ? `${effectiveParsed.houseNumber} ${effectiveParsed.street}`
                : effectiveParsed.street,
              city: effectiveParsed.city,
              ...(effectiveParsed.stateFull ? { state: effectiveParsed.stateFull } : {}),
              countrycodes: countryCode,
              polygon_geojson: '1',
            },
            trimmed,
            signal
          )
        : Promise.resolve([]);

    const [viaCepData, structCandidates] = await Promise.all([viaCepPromise, structPromise]);
    const matchedViaCep = viaCepData.matched;

    const targetWithCep: ParsedBrazilianAddress = {
      ...effectiveParsed,
      cep: effectiveParsed.cep || matchedViaCep?.cep?.replace(/\D/g, ''),
      neighborhood: effectiveParsed.neighborhood || matchedViaCep?.bairro,
    };

    collectedCandidates.push(...structCandidates);

    const exactDoorHit = structCandidates.find(
      (c) =>
        c.houseNumber &&
        effectiveParsed.houseNumber &&
        stripAccentsLower(c.houseNumber) === stripAccentsLower(effectiveParsed.houseNumber) &&
        isAccurateRegionMatch(c, targetWithCep)
    );
    if (exactDoorHit) {
      const out = finalizeResult(exactDoorHit, matchedViaCep, collectedCandidates);
      setCached(geocodeCache, cacheKey, out);
      return out;
    }

    if (matchedViaCep?.cep && effectiveParsed.street && effectiveParsed.city) {
      const cepCandidates = await fetchNominatimCandidates(
        {
          postalcode: matchedViaCep.cep,
          street: effectiveParsed.street,
          city: effectiveParsed.city,
          ...(effectiveParsed.stateFull ? { state: effectiveParsed.stateFull } : {}),
          countrycodes: countryCode,
          polygon_geojson: '1',
        },
        trimmed,
        signal
      );
      collectedCandidates.push(...cepCandidates);
      const bestCepHit = pickBest(cepCandidates, targetWithCep);
      const hasCepLine =
        bestCepHit?.geojson?.type === 'LineString' || bestCepHit?.geojson?.type === 'MultiLineString';
      if (bestCepHit && isAccurateRegionMatch(bestCepHit, targetWithCep) && (hasCepLine || !effectiveParsed.houseNumber)) {
        const out = finalizeResult(bestCepHit, matchedViaCep, collectedCandidates);
        setCached(geocodeCache, cacheKey, out);
        return out;
      }
    }

    if (effectiveParsed.street && effectiveParsed.city && effectiveParsed.houseNumber) {
      const streetGeomCandidates = await fetchNominatimCandidates(
        {
          street: effectiveParsed.street,
          city: effectiveParsed.city,
          ...(effectiveParsed.stateFull ? { state: effectiveParsed.stateFull } : {}),
          countrycodes: countryCode,
          polygon_geojson: '1',
        },
        trimmed,
        signal
      );
      collectedCandidates.push(...streetGeomCandidates);
      const bestStreetGeom = pickBest(collectedCandidates, targetWithCep);
      if (bestStreetGeom && isAccurateRegionMatch(bestStreetGeom, targetWithCep)) {
        const out = finalizeResult(bestStreetGeom, matchedViaCep, collectedCandidates);
        setCached(geocodeCache, cacheKey, out);
        return out;
      }
    }

    const freeCandidates = await fetchNominatimCandidates(
      { q: fullQuery, countrycodes: countryCode, polygon_geojson: '1' },
      trimmed,
      signal
    );
    collectedCandidates.push(...freeCandidates);
    const bestFree = pickBest(collectedCandidates, targetWithCep);
    if (bestFree && isAccurateRegionMatch(bestFree, targetWithCep)) {
      const out = finalizeResult(bestFree, matchedViaCep, collectedCandidates);
      setCached(geocodeCache, cacheKey, out);
      return out;
    }

    if (effectiveParsed.houseNumber && effectiveParsed.street) {
      const noNumQuery = [
        effectiveParsed.street,
        targetWithCep.neighborhood,
        effectiveParsed.city,
        effectiveParsed.stateFull,
      ]
        .filter(Boolean)
        .join(', ');
      if (noNumQuery) {
        const streetCandidates = await fetchNominatimCandidates(
          { q: noNumQuery, countrycodes: countryCode, polygon_geojson: '1' },
          trimmed,
          signal
        );
        collectedCandidates.push(...streetCandidates);
        const bestStreet = pickBest(collectedCandidates, targetWithCep);
        if (bestStreet && isAccurateRegionMatch(bestStreet, targetWithCep)) {
          const out = finalizeResult(bestStreet, matchedViaCep, collectedCandidates);
          setCached(geocodeCache, cacheKey, out);
          return out;
        }
      }
    }

    const photonMatches = await searchAddressSuggestions(fullQuery, {
      limit: 6,
      biasCoords: options?.biasCoords,
      countryCodeFilter: countryCode.toUpperCase(),
      signal,
    });
    collectedCandidates.push(...photonMatches);

    const bestOverall = pickBest(collectedCandidates, targetWithCep);
    if (bestOverall && isAccurateRegionMatch(bestOverall, targetWithCep)) {
      const out = finalizeResult(bestOverall, matchedViaCep, collectedCandidates);
      setCached(geocodeCache, cacheKey, out);
      return out;
    }

    if (effectiveParsed.city) {
      const areaFallback = await searchAddressSuggestions(
        [targetWithCep.neighborhood, effectiveParsed.city, effectiveParsed.stateFull].filter(Boolean).join(', '),
        {
          limit: 3,
          biasCoords: options?.biasCoords,
          countryCodeFilter: countryCode.toUpperCase(),
          signal,
        }
      );
      const bestArea = pickBest(areaFallback, targetWithCep);
      if (bestArea && isAccurateRegionMatch(bestArea, targetWithCep)) {
        const out = finalizeResult(bestArea, matchedViaCep, collectedCandidates);
        setCached(geocodeCache, cacheKey, out);
        return out;
      }
    }

    const finalOut =
      bestOverall && isAccurateRegionMatch(bestOverall, targetWithCep)
        ? finalizeResult(bestOverall, matchedViaCep, collectedCandidates)
        : null;
    setCached(geocodeCache, cacheKey, finalOut);
    return finalOut;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

export const reverseGeocodeNominatim = async (
  lat: number,
  lng: number,
  options?: { signal?: AbortSignal }
): Promise<NominatimGeocodeResult | null> => {
  if (!isValidLatLng(lat, lng)) return null;
  const cacheKey = `rev:${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = getCached(reverseCache, cacheKey);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  const signal = options?.signal || controller.signal;

  try {
    const siglonPromise =
      isInsideLondrina(lat, lng) && isSameOriginHttpEnv()
        ? fetch(`/api/v1/maps/siglon/lote?lat=${lat}&lng=${lng}`, {
            signal: AbortSignal.timeout(2500),
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null)
        : Promise.resolve(null);

    const nomReverseEndpoints = isSameOriginHttpEnv()
      ? [
          `/api/v1/maps/nominatim/reverse?lat=${lat}&lon=${lng}`,
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`,
        ]
      : [`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`];

    const fetchNomReverse = async (): Promise<any | null> => {
      for (const ep of nomReverseEndpoints) {
        try {
          const r = await fetch(ep, {
            headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
            signal,
          });
          if (r.ok) {
            const json = await r.json();
            if (json && (json.address || json.display_name)) return json;
          }
        } catch {
          // try next endpoint
        }
      }
      return null;
    };

    const [data, siglonData] = await Promise.all([fetchNomReverse(), siglonPromise]);

    const addr = data?.address || {};
    const street = [addr.road || addr.pedestrian || addr.footway, addr.house_number]
      .filter(Boolean)
      .join(', ');
    const neighborhood = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district;
    const city =
      addr.city || addr.town || addr.municipality || addr.village || (isInsideLondrina(lat, lng) ? 'Londrina' : undefined);
    const state = addr.state || (isInsideLondrina(lat, lng) ? 'PR' : undefined);

    const lote = siglonData?.lote;
    const quadraLoteLabel =
      lote && (lote.quadra || lote.lote)
        ? [lote.quadra ? `Q:${lote.quadra}` : null, lote.lote ? `L:${lote.lote}` : null, lote.loteamento]
            .filter(Boolean)
            .join(' • ')
        : undefined;

    if (!data && !quadraLoteLabel) return null;

    const result: NominatimGeocodeResult = {
      lat,
      lng,
      displayName: '',
      cep: addr.postcode,
      street: street || undefined,
      houseNumber: addr.house_number ? String(addr.house_number) : undefined,
      houseNumberPrecision: addr.house_number ? 'EXACT_DOOR' : street ? 'STREET_CENTER' : 'AREA_FALLBACK',
      siglonQuadraLote: quadraLoteLabel,
      neighborhood,
      city,
      state,
      source: quadraLoteLabel ? 'SIGLON_LONDRINA' : 'NOMINATIM',
    };
    const baseDisplay =
      formatShortBrazilianAddress(result) ||
      String(data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    result.displayName = quadraLoteLabel ? `${baseDisplay} (${quadraLoteLabel})` : baseDisplay;
    setCached(reverseCache, cacheKey, result);
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
