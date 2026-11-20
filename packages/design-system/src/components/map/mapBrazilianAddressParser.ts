import {
  calculateDistanceKm,
  isInsideLondrina,
  isValidLatLng,
  LONDRINA_CENTER_COORDS,
  NominatimGeocodeResult,
} from './mapTypesAndIcons';

export const UF_FULL_NAMES: Record<string, string> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
};

const STATE_NAME_TO_UF: Record<string, string> = Object.fromEntries(
  Object.entries(UF_FULL_NAMES).map(([uf, name]) => [
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase(),
    uf,
  ])
);

export const stripAccentsLower = (val: string): string =>
  val
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const stateToUf = (state?: string): string => {
  if (!state) return '';
  const trimmed = state.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return STATE_NAME_TO_UF[stripAccentsLower(trimmed)] || trimmed;
};

export const formatShortBrazilianAddress = (res: Partial<NominatimGeocodeResult>): string => {
  const street = res.street?.trim() || '';
  const neighborhood = res.neighborhood?.trim() || '';
  const city = res.city?.trim() || '';
  const uf = stateToUf(res.state);
  const cityState = city && uf ? `${city} - ${uf}` : city || uf;
  const parts = [street, neighborhood, cityState].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' - ').replace(/ - ([^-]+ - [A-Z]{2})$/, ', $1');
  }
  return res.displayName || '';
};

export const expandBrazilianAbbreviations = (input: string): string =>
  input
    .replace(/\bAv\.?\s+/gi, 'Avenida ')
    .replace(/\bR\.?\s+/gi, 'Rua ')
    .replace(/\bAl\.?\s+/gi, 'Alameda ')
    .replace(/\bTv\.?\s+/gi, 'Travessa ')
    .replace(/\bRod\.?\s+/gi, 'Rodovia ')
    .replace(/\bPç\.?\s+/gi, 'Praça ')
    .replace(/\bEst\.?\s+/gi, 'Estrada ')
    .replace(/\bJd\.?\s+/gi, 'Jardim ')
    .replace(/\bPq\.?\s+/gi, 'Parque ')
    .replace(/\bVl\.?\s+/gi, 'Vila ')
    .replace(/\s+/g, ' ')
    .trim();

export interface ParsedBrazilianAddress {
  cep?: string;
  street?: string;
  houseNumber?: string;
  neighborhood?: string;
  city?: string;
  stateUf?: string;
  stateFull?: string;
  normalizedQuery: string;
}

export const parseBrazilianAddressParts = (raw: string): ParsedBrazilianAddress => {
  const cleaned = expandBrazilianAbbreviations(raw).replace(/\s*\/\s*Brasil$/i, '');
  const cepMatch = cleaned.match(/\b(\d{5})-?(\d{3})\b/);
  const cep = cepMatch ? `${cepMatch[1]}${cepMatch[2]}` : undefined;
  let working = cepMatch ? cleaned.replace(cepMatch[0], '').trim() : cleaned;

  let stateUf: string | undefined;
  let stateFull: string | undefined;
  const ufMatch = working.match(
    /(?:^|[,\s\-/])(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\s*$/i
  );
  if (ufMatch) {
    stateUf = ufMatch[1].toUpperCase();
    stateFull = UF_FULL_NAMES[stateUf];
    working = working.slice(0, working.length - ufMatch[0].length).trim().replace(/[,\-/\s]+$/, '');
  }

  const workingCommaParts = working.split(/[,]+/).map((s) => s.trim()).filter(Boolean);

  let neighborhood: string | undefined;
  const neighMatch = working.match(/\s-\s([^,]+)(?:,|$)/);
  if (neighMatch) {
    const candidateNeigh = neighMatch[1].split('/')[0].trim();
    if (candidateNeigh && !/^\d{1,5}[A-Za-z]?$/.test(candidateNeigh)) {
      neighborhood = candidateNeigh;
    }
  } else if (workingCommaParts.length >= 3) {
    const maybeNeigh = workingCommaParts[workingCommaParts.length - 2];
    if (maybeNeigh && !/^\d{1,5}[A-Za-z]?$/.test(maybeNeigh)) {
      neighborhood = maybeNeigh.split('/')[0].trim();
    }
  }

  const firstSegment = working.split(/\s+-\s+/)[0].trim();
  const streetComma = firstSegment.split(',').map((s) => s.trim()).filter(Boolean);
  let street = streetComma[0];
  let houseNumber: string | undefined;
  if (streetComma.length >= 2 && /^\d{1,5}[A-Za-z]?$/.test(streetComma[1])) {
    houseNumber = streetComma[1];
  } else if (street) {
    const inlineNum = street.match(/^(.+?)\s+(\d{1,5})$/);
    if (inlineNum) {
      street = inlineNum[1].trim();
      houseNumber = inlineNum[2];
    }
  }

  let city: string | undefined;
  const cityCandidateIndex = houseNumber && streetComma.length >= 2 ? 2 : 1;
  if (workingCommaParts.length > cityCandidateIndex) {
    const lastSeg = workingCommaParts[workingCommaParts.length - 1];
    const dashParts = lastSeg.split(/\s+-\s+/).map((s) => s.trim()).filter(Boolean);
    const candidateCity = dashParts[dashParts.length - 1];
    if (
      candidateCity &&
      !/^\d{1,5}[A-Za-z]?$/.test(candidateCity) &&
      !/^(?:s\/n|km\s*\d+|casa|apto|bloco|loja|sala)/i.test(candidateCity)
    ) {
      city = candidateCity;
    }
  }

  const normalizedParts = [
    street ? (houseNumber ? `${street}, ${houseNumber}` : street) : undefined,
    neighborhood,
    city,
    stateFull,
  ].filter(Boolean);

  return {
    cep,
    street,
    houseNumber,
    neighborhood,
    city,
    stateUf,
    stateFull,
    normalizedQuery: normalizedParts.length > 0 ? normalizedParts.join(', ') : working,
  };
};

export const candidateMatchesCityAndState = (
  candidate: NominatimGeocodeResult,
  parsed: ParsedBrazilianAddress
): { cityOk: boolean; stateOk: boolean } => {
  const candCity = stripAccentsLower(candidate.city || '');
  const candState = stripAccentsLower(candidate.state || '');
  const candUf = stateToUf(candidate.state).toUpperCase();
  const candDisplay = stripAccentsLower(candidate.displayName || '');

  let cityOk = true;
  if (parsed.city) {
    const targetCity = stripAccentsLower(parsed.city);
    cityOk =
      candCity === targetCity ||
      candCity.includes(targetCity) ||
      targetCity.includes(candCity && candCity.length >= 3 ? candCity : '___') ||
      candDisplay.includes(targetCity);
  }

  let stateOk = true;
  if (parsed.stateFull || parsed.stateUf) {
    const targetState = parsed.stateFull ? stripAccentsLower(parsed.stateFull) : '';
    const targetUf = parsed.stateUf ? parsed.stateUf.toUpperCase() : '';
    stateOk =
      (targetUf !== '' && candUf === targetUf) ||
      (targetState !== '' &&
        (candState === targetState || candState.includes(targetState) || candDisplay.includes(targetState)));
  }

  return { cityOk, stateOk };
};

export const scoreGeocodeCandidate = (
  candidate: NominatimGeocodeResult,
  parsed: ParsedBrazilianAddress,
  biasCoords?: [number, number]
): number => {
  let score = 0;
  const candStreet = stripAccentsLower(candidate.street || '');
  const candNeigh = stripAccentsLower(candidate.neighborhood || '');
  const candCity = stripAccentsLower(candidate.city || '');
  const candState = stripAccentsLower(candidate.state || '');
  const candUf = stateToUf(candidate.state).toUpperCase();
  const candDisplay = stripAccentsLower(candidate.displayName || '');
  const candCep = (candidate.cep || '').replace(/\D/g, '');

  if (parsed.stateFull || parsed.stateUf) {
    const targetState = parsed.stateFull ? stripAccentsLower(parsed.stateFull) : '';
    const targetUf = parsed.stateUf ? parsed.stateUf.toUpperCase() : '';
    const matchesState =
      (targetUf !== '' && candUf === targetUf) ||
      (targetState !== '' &&
        (candState === targetState || candState.includes(targetState) || candDisplay.includes(targetState)));
    if (matchesState) {
      score += 1200;
    } else if (candState || candUf) {
      score -= 4000;
    }
  }

  if (parsed.city) {
    const targetCity = stripAccentsLower(parsed.city);
    if (candCity && (candCity === targetCity || candCity.includes(targetCity))) {
      score += 1500;
    } else if (candDisplay.includes(targetCity)) {
      score += 900;
    } else if (candCity) {
      score -= 3500;
    }
  }

  if (parsed.street) {
    const targetStreet = stripAccentsLower(parsed.street);
    if (candStreet && (candStreet.includes(targetStreet) || targetStreet.includes(candStreet))) {
      score += 950;
    } else if (candDisplay.includes(targetStreet)) {
      score += 480;
    } else if (candStreet) {
      score -= 900;
    }
  }

  if (parsed.neighborhood) {
    const targetNeigh = stripAccentsLower(parsed.neighborhood);
    if (candNeigh && (candNeigh.includes(targetNeigh) || targetNeigh.includes(candNeigh))) {
      score += 450;
    } else if (candDisplay.includes(targetNeigh)) {
      score += 260;
    } else if (candNeigh) {
      score -= 220;
    }
  }

  if (parsed.cep && candCep) {
    if (candCep === parsed.cep) score += 500;
    else if (candCep.slice(0, 5) === parsed.cep.slice(0, 5)) score += 250;
  }

  if (parsed.houseNumber && candidate.houseNumber) {
    if (stripAccentsLower(candidate.houseNumber) === stripAccentsLower(parsed.houseNumber)) {
      score += 350;
    }
  } else if (parsed.houseNumber && candDisplay.includes(parsed.houseNumber.toLowerCase())) {
    score += 180;
  }

  if (biasCoords && isValidLatLng(biasCoords[0], biasCoords[1])) {
    const distKm = calculateDistanceKm(biasCoords[0], biasCoords[1], candidate.lat, candidate.lng);
    if (distKm <= 30) {
      score += Math.max(0, 120 - distKm * 4);
    }
  }

  return score;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
export const geocodeCache = new Map<string, { expiresAt: number; value: NominatimGeocodeResult | null }>();
export const reverseCache = new Map<string, { expiresAt: number; value: NominatimGeocodeResult | null }>();
export const suggestionsCache = new Map<string, { expiresAt: number; value: NominatimGeocodeResult[] }>();

export const getCached = <T>(cache: Map<string, { expiresAt: number; value: T }>, key: string): T | undefined => {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
};

export const setCached = <T>(cache: Map<string, { expiresAt: number; value: T }>, key: string, value: T) => {
  if (cache.size > 150) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
};

export const isSameOriginHttpEnv = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.location?.origin === 'string' &&
  /^https?:\/\//.test(window.location.origin);

export interface ParsedViaCepRange {
  min: number | null;
  max: number | null;
  exactNumber: number | null;
  parity: 'ODD' | 'EVEN' | 'ALL';
  raw: string;
}

export interface ViaCepStreetBlock {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  range: ParsedViaCepRange;
}

export const parseViaCepComplementRangeLocal = (complemento: string): ParsedViaCepRange => {
  const raw = String(complemento || '').trim();
  if (!raw) return { min: null, max: null, exactNumber: null, parity: 'ALL', raw: '' };
  const lower = stripAccentsLower(raw);
  const parity: 'ODD' | 'EVEN' | 'ALL' = lower.includes('impar')
    ? 'ODD'
    : lower.includes('par')
    ? 'EVEN'
    : 'ALL';

  const exactOnly = lower.match(/^(\d{1,5})(?:\s+(?:loja|sala|bl|bloco|conj|andar|s\/n|km).*)?$/);
  if (exactOnly && !lower.includes('ate') && !lower.includes('de ') && !lower.includes('/')) {
    const n = parseInt(exactOnly[1], 10);
    return { min: n, max: n, exactNumber: n, parity, raw };
  }

  const rangeBetween = lower.match(/de\s+(\d{1,5})(?:\/(\d{1,5}))?\s+a\s+(\d{1,5})(?:\/(\d{1,5}))?/);
  if (rangeBetween) {
    const a1 = parseInt(rangeBetween[1], 10);
    const a2 = rangeBetween[2] ? parseInt(rangeBetween[2], 10) : a1;
    const b1 = parseInt(rangeBetween[3], 10);
    const b2 = rangeBetween[4] ? parseInt(rangeBetween[4], 10) : b1;
    return { min: Math.min(a1, a2), max: Math.max(b1, b2), exactNumber: null, parity, raw };
  }

  const rangeToEnd = lower.match(/de\s+(\d{1,5})(?:\/(\d{1,5}))?\s+ao\s+fim/);
  if (rangeToEnd) {
    const a1 = parseInt(rangeToEnd[1], 10);
    const a2 = rangeToEnd[2] ? parseInt(rangeToEnd[2], 10) : a1;
    return { min: Math.min(a1, a2), max: null, exactNumber: null, parity, raw };
  }

  const rangeUntil = lower.match(/ate\s+(\d{1,5})(?:\/(\d{1,5}))?/);
  if (rangeUntil) {
    const b1 = parseInt(rangeUntil[1], 10);
    const b2 = rangeUntil[2] ? parseInt(rangeUntil[2], 10) : b1;
    return { min: 1, max: Math.max(b1, b2), exactNumber: null, parity, raw };
  }

  return { min: null, max: null, exactNumber: null, parity, raw };
};

export const interpolatePointOnStreetGeometry = (
  geojson: any,
  houseNumberStr: string,
  range?: ParsedViaCepRange,
  originAnchor: [number, number] = LONDRINA_CENTER_COORDS
): [number, number] | null => {
  const numDigits = houseNumberStr.replace(/\D/g, '');
  const houseNum = numDigits ? parseInt(numDigits, 10) : NaN;
  if (!Number.isFinite(houseNum) || !geojson) return null;

  let rawCoords: Array<[number, number]> = [];
  if (geojson.type === 'LineString' && Array.isArray(geojson.coordinates)) {
    rawCoords = geojson.coordinates;
  } else if (geojson.type === 'MultiLineString' && Array.isArray(geojson.coordinates)) {
    let longest: Array<[number, number]> = [];
    for (const part of geojson.coordinates) {
      if (Array.isArray(part) && part.length > longest.length) longest = part;
    }
    rawCoords = longest;
  }
  const pts: Array<[number, number]> = rawCoords
    .filter((c) => Array.isArray(c) && isValidLatLng(Number(c[1]), Number(c[0])))
    .map((c) => [Number(c[1]), Number(c[0])]);

  if (pts.length < 2) return null;

  const distStart = calculateDistanceKm(pts[0][0], pts[0][1], originAnchor[0], originAnchor[1]);
  const distEnd = calculateDistanceKm(pts[pts.length - 1][0], pts[pts.length - 1][1], originAnchor[0], originAnchor[1]);
  const ordered = distEnd < distStart ? [...pts].reverse() : pts;

  const minN = range?.min ?? 1;
  const maxN = range?.max ?? Math.max(minN + 600, houseNum + 200);
  const span = Math.max(10, maxN - minN);
  const ratio = Math.max(0.08, Math.min(0.92, (houseNum - minN) / span));

  const segLengths: number[] = [];
  let totalLen = 0;
  for (let i = 1; i < ordered.length; i++) {
    const d = Math.hypot(ordered[i][0] - ordered[i - 1][0], ordered[i][1] - ordered[i - 1][1]);
    segLengths.push(d);
    totalLen += d;
  }
  if (totalLen <= 0) return ordered[0];

  const targetDist = totalLen * ratio;
  let accum = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i];
    if (accum + segLen >= targetDist || i === segLengths.length - 1) {
      const localRatio = segLen > 0 ? Math.max(0, Math.min(1, (targetDist - accum) / segLen)) : 0;
      const lat = ordered[i][0] + (ordered[i + 1][0] - ordered[i][0]) * localRatio;
      const lng = ordered[i][1] + (ordered[i + 1][1] - ordered[i][1]) * localRatio;
      return isValidLatLng(lat, lng) ? [Number(lat.toFixed(6)), Number(lng.toFixed(6))] : null;
    }
    accum += segLen;
  }
  return ordered[Math.floor(ordered.length / 2)];
};

export const inferRegionDefaults = (
  parsed: ParsedBrazilianAddress,
  regionBias?: string,
  biasCoords?: [number, number]
): { city?: string; stateUf?: string; stateFull?: string } => {
  let city = parsed.city;
  let stateUf = parsed.stateUf;
  let stateFull = parsed.stateFull;

  if (!city && regionBias) {
    const biasParts = parseBrazilianAddressParts(regionBias);
    city = biasParts.city || (!regionBias.includes(',') ? regionBias.split('-')[0].trim() : undefined);
    if (!stateUf && biasParts.stateUf) {
      stateUf = biasParts.stateUf;
      stateFull = biasParts.stateFull;
    }
  }
  if (!city && biasCoords && isInsideLondrina(biasCoords[0], biasCoords[1])) {
    city = 'Londrina';
    stateUf = stateUf || 'PR';
    stateFull = stateFull || 'Paraná';
  }
  if (city && stripAccentsLower(city) === 'londrina' && !stateUf) {
    stateUf = 'PR';
    stateFull = 'Paraná';
  }
  return { city, stateUf, stateFull };
};
