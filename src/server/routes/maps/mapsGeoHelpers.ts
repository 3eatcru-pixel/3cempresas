import crypto from 'crypto';
import { db, runWithSystemDbContext } from '../../config.ts';

export interface CacheEntry<T> {
  expiresAt: number;
  value: T;
  updatedAt?: string;
}

const MAX_L1_ENTRIES = 1000;
const TTL_7_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const TTL_72_HOURS_MS = 72 * 60 * 60 * 1000;
const TTL_24_HOURS_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;

const responseCache = new Map<string, CacheEntry<any>>();

const geoCacheMetrics = {
  l1Hits: 0,
  l2Hits: 0,
  staleFallbacks: 0,
  misses: 0,
  l2Writes: 0,
};

export const resolveGeoCacheTtlMs = (key: string): number => {
  if (
    key.startsWith('viacep-') ||
    key.startsWith('cep:') ||
    key.startsWith('siglon-') ||
    key.startsWith('ibge:')
  ) {
    return TTL_7_DAYS_MS;
  }
  if (key.startsWith('nom-s:') || key.startsWith('nom-r:')) {
    return TTL_72_HOURS_MS;
  }
  if (key.startsWith('osrm-rt:') || key.startsWith('osrm-tr:')) {
    return TTL_24_HOURS_MS;
  }
  return DEFAULT_CACHE_TTL_MS;
};

export const encodeGeoCacheDocId = (key: string): string => {
  const prefix = key
    .split(':')[0]
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 16) || 'geo';
  const digest = crypto.createHash('sha256').update(key).digest('hex').slice(0, 36);
  return `${prefix}-${digest}`;
};

export const getCached = <T>(key: string): T | undefined => {
  const entry = responseCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    return undefined;
  }
  geoCacheMetrics.l1Hits += 1;
  return entry.value as T;
};

const setL1Cache = <T>(key: string, value: T, expiresAt: number): void => {
  if (!responseCache.has(key) && responseCache.size >= MAX_L1_ENTRIES) {
    const firstKey = responseCache.keys().next().value;
    if (firstKey) responseCache.delete(firstKey);
  }
  responseCache.set(key, {
    expiresAt,
    value,
    updatedAt: new Date().toISOString(),
  });
};

export const setCached = <T>(key: string, value: T, customTtlMs?: number): void => {
  const ttlMs = customTtlMs ?? resolveGeoCacheTtlMs(key);
  const expiresAt = Date.now() + ttlMs;
  setL1Cache(key, value, expiresAt);
  void persistL2CacheEntry(key, value, expiresAt);
};

async function persistL2CacheEntry<T>(key: string, value: T, expiresAt: number): Promise<void> {
  try {
    const docId = encodeGeoCacheDocId(key);
    const nowIso = new Date().toISOString();
    await runWithSystemDbContext('GEO_CACHE_L2_WRITE', () =>
      db.collection('geo_cache').doc(docId).set({
        id: docId,
        cacheKey: key,
        value,
        expiresAt,
        updatedAt: nowIso,
      })
    );
    geoCacheMetrics.l2Writes += 1;
  } catch {
    // Non-fatal if persistence driver is shutting down
  }
}

export const setCachedPersistent = async <T>(
  key: string,
  value: T,
  customTtlMs?: number
): Promise<void> => {
  const ttlMs = customTtlMs ?? resolveGeoCacheTtlMs(key);
  const expiresAt = Date.now() + ttlMs;
  setL1Cache(key, value, expiresAt);
  await persistL2CacheEntry(key, value, expiresAt);
};

export const getCachedPersistent = async <T>(key: string): Promise<T | undefined> => {
  const l1 = getCached<T>(key);
  if (l1 !== undefined) {
    return l1;
  }
  try {
    const docId = encodeGeoCacheDocId(key);
    const snap = await runWithSystemDbContext('GEO_CACHE_L2_READ', () =>
      db.collection('geo_cache').doc(docId).get()
    );
    if (snap.exists) {
      const data = snap.data();
      if (data && typeof data.expiresAt === 'number' && Date.now() <= data.expiresAt && data.value !== undefined) {
        setL1Cache(key, data.value, data.expiresAt);
        geoCacheMetrics.l2Hits += 1;
        return data.value as T;
      }
    }
  } catch {
    // Fallback to miss if L2 read fails
  }
  geoCacheMetrics.misses += 1;
  return undefined;
};

/**
 * Returns a cached entry even if its TTL has expired.
 * Used as an offline/outage fallback when external APIs (ViaCEP, Nominatim, OSRM, SIGLON) are unreachable.
 */
export const getStaleCachedPersistent = async <T>(key: string): Promise<T | undefined> => {
  const l1Entry = responseCache.get(key);
  if (l1Entry && l1Entry.value !== undefined) {
    geoCacheMetrics.staleFallbacks += 1;
    return l1Entry.value as T;
  }
  try {
    const docId = encodeGeoCacheDocId(key);
    const snap = await runWithSystemDbContext('GEO_CACHE_L2_STALE_READ', () =>
      db.collection('geo_cache').doc(docId).get()
    );
    if (snap.exists) {
      const data = snap.data();
      if (data && data.value !== undefined) {
        geoCacheMetrics.staleFallbacks += 1;
        return data.value as T;
      }
    }
  } catch {
    // Ignore
  }
  return undefined;
};

export const getGeoCacheStats = () => ({
  l1Size: responseCache.size,
  maxL1Entries: MAX_L1_ENTRIES,
  ...geoCacheMetrics,
});

export const stripAccents = (val: string): string =>
  val
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export interface ParsedViaCepRange {
  min: number | null;
  max: number | null;
  exactNumber: number | null;
  parity: 'ODD' | 'EVEN' | 'ALL';
  raw: string;
}

export const parseViaCepComplementRange = (complemento: string): ParsedViaCepRange => {
  const raw = String(complemento || '').trim();
  if (!raw) {
    return { min: null, max: null, exactNumber: null, parity: 'ALL', raw: '' };
  }

  const lower = stripAccents(raw).toLowerCase();
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
    return {
      min: Math.min(a1, a2),
      max: Math.max(b1, b2),
      exactNumber: null,
      parity,
      raw,
    };
  }

  const rangeToEnd = lower.match(/de\s+(\d{1,5})(?:\/(\d{1,5}))?\s+ao\s+fim/);
  if (rangeToEnd) {
    const a1 = parseInt(rangeToEnd[1], 10);
    const a2 = rangeToEnd[2] ? parseInt(rangeToEnd[2], 10) : a1;
    return {
      min: Math.min(a1, a2),
      max: null,
      exactNumber: null,
      parity,
      raw,
    };
  }

  const rangeUntil = lower.match(/ate\s+(\d{1,5})(?:\/(\d{1,5}))?/);
  if (rangeUntil) {
    const b1 = parseInt(rangeUntil[1], 10);
    const b2 = rangeUntil[2] ? parseInt(rangeUntil[2], 10) : b1;
    return {
      min: 1,
      max: Math.max(b1, b2),
      exactNumber: null,
      parity,
      raw,
    };
  }

  return { min: null, max: null, exactNumber: null, parity, raw };
};

export const BRASIL_STATES_FALLBACK = [
  { id: 12, uf: 'AC', name: 'Acre', region: 'Norte' },
  { id: 27, uf: 'AL', name: 'Alagoas', region: 'Nordeste' },
  { id: 16, uf: 'AP', name: 'Amapá', region: 'Norte' },
  { id: 13, uf: 'AM', name: 'Amazonas', region: 'Norte' },
  { id: 29, uf: 'BA', name: 'Bahia', region: 'Nordeste' },
  { id: 23, uf: 'CE', name: 'Ceará', region: 'Nordeste' },
  { id: 53, uf: 'DF', name: 'Distrito Federal', region: 'Centro-Oeste' },
  { id: 32, uf: 'ES', name: 'Espírito Santo', region: 'Sudeste' },
  { id: 52, uf: 'GO', name: 'Goiás', region: 'Centro-Oeste' },
  { id: 21, uf: 'MA', name: 'Maranhão', region: 'Nordeste' },
  { id: 51, uf: 'MT', name: 'Mato Grosso', region: 'Centro-Oeste' },
  { id: 50, uf: 'MS', name: 'Mato Grosso do Sul', region: 'Centro-Oeste' },
  { id: 31, uf: 'MG', name: 'Minas Gerais', region: 'Sudeste' },
  { id: 15, uf: 'PA', name: 'Pará', region: 'Norte' },
  { id: 25, uf: 'PB', name: 'Paraíba', region: 'Nordeste' },
  { id: 41, uf: 'PR', name: 'Paraná', region: 'Sul' },
  { id: 26, uf: 'PE', name: 'Pernambuco', region: 'Nordeste' },
  { id: 22, uf: 'PI', name: 'Piauí', region: 'Nordeste' },
  { id: 33, uf: 'RJ', name: 'Rio de Janeiro', region: 'Sudeste' },
  { id: 24, uf: 'RN', name: 'Rio Grande do Norte', region: 'Nordeste' },
  { id: 43, uf: 'RS', name: 'Rio Grande do Sul', region: 'Sul' },
  { id: 11, uf: 'RO', name: 'Rondônia', region: 'Norte' },
  { id: 14, uf: 'RR', name: 'Roraima', region: 'Norte' },
  { id: 42, uf: 'SC', name: 'Santa Catarina', region: 'Sul' },
  { id: 35, uf: 'SP', name: 'São Paulo', region: 'Sudeste' },
  { id: 28, uf: 'SE', name: 'Sergipe', region: 'Nordeste' },
  { id: 17, uf: 'TO', name: 'Tocantins', region: 'Norte' },
];

export const parseStoreAddressFields = (store: any) => {
  const raw = String(store?.address || '').trim();
  const cepMatch = raw.match(/\b(\d{5}-?\d{3})\b/);
  const cep = cepMatch ? cepMatch[1] : undefined;
  const cleaned = raw.replace(/\(?\s*CEP\s*\d{5}-?\d{3}\)?/i, '').trim();
  const ufMatch = cleaned.match(/-\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i);
  const stateUf = ufMatch ? ufMatch[1].toUpperCase() : 'PR';

  const parts = cleaned.split(/\s+-\s+/);
  const streetPart = (parts[0] || '').trim();
  const [streetOnly, numCandidate] = streetPart.split(',').map((s) => s.trim());
  let neighborhood = '';
  let city = 'Londrina';
  if (parts.length >= 2) {
    const mid = parts[1].split(',').map((s) => s.trim()).filter(Boolean);
    if (mid.length >= 2) {
      neighborhood = mid[0];
      city = mid[1];
    } else if (mid.length === 1) {
      neighborhood = mid[0];
    }
  }
  return {
    street: streetOnly || raw,
    houseNumber: numCandidate && /^\d+[A-Za-z]?$/.test(numCandidate) ? numCandidate : '',
    neighborhood,
    city,
    stateUf,
    cep: cep || '',
  };
};
