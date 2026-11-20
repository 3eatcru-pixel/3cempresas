import { isValidLatLng, NominatimGeocodeResult } from './mapTypesAndIcons';
import {
  candidateMatchesCityAndState,
  expandBrazilianAbbreviations,
  formatShortBrazilianAddress,
  geocodeCache,
  getCached,
  ParsedBrazilianAddress,
  scoreGeocodeCandidate,
  setCached,
  UF_FULL_NAMES,
} from './mapBrazilianAddressParser';
import {
  fetchNominatimCandidates,
  searchAddressSuggestions,
} from './mapNominatimAndPhoton';

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
