import {
  getCached,
  isSameOriginHttpEnv,
  parseViaCepComplementRangeLocal,
  setCached,
  stripAccentsLower,
  ViaCepStreetBlock,
} from './mapBrazilianAddressParser';

const viaCepStreetCache = new Map<
  string,
  { expiresAt: number; value: { matched: ViaCepStreetBlock | null; blocks: ViaCepStreetBlock[] } }
>();

export const lookupBrazilianStreetHouseBlock = async (
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
