import {
  isInsideLondrina,
  isValidLatLng,
  LONDRINA_CENTER_COORDS,
  NominatimGeocodeResult,
} from './mapTypesAndIcons';
import {
  candidateMatchesCityAndState,
  formatShortBrazilianAddress,
  geocodeCache,
  getCached,
  inferRegionDefaults,
  interpolatePointOnStreetGeometry,
  isSameOriginHttpEnv,
  parseBrazilianAddressParts,
  ParsedBrazilianAddress,
  reverseCache,
  scoreGeocodeCandidate,
  setCached,
  stripAccentsLower,
  ViaCepStreetBlock,
} from './mapBrazilianAddressParser';
import { lookupBrazilianStreetHouseBlock } from './mapViaCepStreetBlock';
import {
  fetchNominatimCandidates,
  searchAddressSuggestions,
} from './mapNominatimAndPhoton';
import { lookupBrazilianCep } from './mapBrazilianCepLookup';

export { lookupBrazilianCep, searchAddressSuggestions };

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
