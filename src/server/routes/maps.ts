import express from 'express';
import {
  BRASIL_STATES_FALLBACK,
  getCachedPersistent,
  getStaleCachedPersistent,
  ParsedViaCepRange,
  parseViaCepComplementRange,
  setCachedPersistent,
  stripAccents,
} from './maps/mapsGeoHelpers.ts';
import cityDirectoryAndIndexRoutes from './maps/cityDirectoryAndIndexRoutes.ts';
import pmtilesRoutes from './maps/pmtilesRoutes.ts';

export type { ParsedViaCepRange };
export { parseViaCepComplementRange };

const router = express.Router();

router.get('/viacep-street', async (req, res) => {
  const uf = String(req.query.uf || 'PR').trim().toUpperCase().slice(0, 2);
  const city = String(req.query.city || 'Londrina').trim();
  const rawStreet = String(req.query.street || '').trim();
  const numRaw = String(req.query.number || '').replace(/\D/g, '');
  const targetNum = numRaw ? parseInt(numRaw, 10) : null;
  const neighborhoodHint = stripAccents(String(req.query.neighborhood || '')).toLowerCase();

  if (!/^[A-Z]{2}$/.test(uf) || city.length < 2 || rawStreet.length < 3) {
    return res.status(400).json({ error: 'Parâmetros inválidos para consulta de logradouro.' });
  }

  const strippedStreet = rawStreet
    .replace(/^(Rua|Avenida|Av\.?|R\.?|Alameda|Travessa|Rodovia|Estrada|Praça)\s+/i, '')
    .trim();

  const cacheKey = `viacep-st:${uf}:${stripAccents(city).toLowerCase()}:${stripAccents(strippedStreet || rawStreet).toLowerCase()}`;

  try {
    let rawBlocks = await getCachedPersistent<any[]>(cacheKey);

    if (!rawBlocks) {
      const candidatesToTry = Array.from(
        new Set([rawStreet, strippedStreet].filter((s) => s.length >= 3))
      );

      for (const candidateStreet of candidatesToTry) {
        const url = `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(city)}/${encodeURIComponent(candidateStreet)}/json/`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(5500) });
        if (!resp.ok) continue;
        const json = await resp.json();
        if (Array.isArray(json) && json.length > 0) {
          rawBlocks = json;
          break;
        }
      }

      if (!rawBlocks) {
        const stale = await getStaleCachedPersistent<any[]>(cacheKey);
        rawBlocks = stale || [];
      } else {
        await setCachedPersistent(cacheKey, rawBlocks);
      }
    }

    const parsedBlocks = rawBlocks
      .filter((b: any) => b && b.cep && !b.erro)
      .map((b: any) => {
        const range = parseViaCepComplementRange(b.complemento || '');
        return {
          cep: String(b.cep),
          logradouro: String(b.logradouro || ''),
          complemento: String(b.complemento || ''),
          bairro: String(b.bairro || ''),
          localidade: String(b.localidade || city),
          uf: String(b.uf || uf),
          range,
        };
      });

    let matched: (typeof parsedBlocks)[number] | null = null;
    if (parsedBlocks.length > 0) {
      const scored = parsedBlocks.map((block) => {
        let score = 0;
        const blockStreetNorm = stripAccents(block.logradouro).toLowerCase();
        const queryStreetNorm = stripAccents(rawStreet).toLowerCase();
        if (blockStreetNorm === queryStreetNorm) score += 400;
        else if (blockStreetNorm.includes(stripAccents(strippedStreet).toLowerCase())) score += 200;

        if (neighborhoodHint && stripAccents(block.bairro).toLowerCase().includes(neighborhoodHint)) {
          score += 300;
        }

        if (targetNum !== null && Number.isFinite(targetNum)) {
          const { min, max, exactNumber, parity } = block.range;
          if (exactNumber !== null && exactNumber === targetNum) {
            score += 900;
          } else if (min !== null || max !== null) {
            const lo = min ?? 0;
            const hi = max ?? Number.MAX_SAFE_INTEGER;
            if (targetNum >= lo && targetNum <= hi) {
              score += 650;
              if (parity === 'ODD' && targetNum % 2 === 1) score += 80;
              if (parity === 'EVEN' && targetNum % 2 === 0) score += 80;
              if (parity === 'ODD' && targetNum % 2 === 0) score -= 120;
              if (parity === 'EVEN' && targetNum % 2 === 1) score -= 120;
            } else {
              score -= 350;
            }
          }
        }
        return { block, score };
      });
      scored.sort((a, b) => b.score - a.score);
      matched = scored[0]?.block || null;
    }

    return res.json({ matched, blocks: parsedBlocks.slice(0, 20) });
  } catch (err: any) {
    return res.status(502).json({ error: err?.message || 'Falha ao consultar ViaCEP.' });
  }
});

router.get('/siglon/arruamento', async (req, res) => {
  const q = stripAccents(String(req.query.q || '')).toUpperCase().replace(/['"%_;]/g, '').trim();
  if (q.length < 3) {
    return res.json({ streets: [] });
  }

  const cacheKey = `siglon-arr:${q}`;
  try {
    const cached = await getCachedPersistent<any[]>(cacheKey);
    if (cached) {
      return res.json({ streets: cached });
    }

    const whereClause = `NOME_BUSCA LIKE '%${q}%'`;
    const url = encodeURI(
      `https://geo.londrina.pr.gov.br/server/rest/services/Portal_Publico/Arruamento_Publico/MapServer/0/query?where=${whereClause}&outFields=OBJECTID,TIPO,NOME,NOME_LOGRADOURO,CODLOG,LOCALIDADE&returnGeometry=false&resultRecordCount=15&f=json`
    );
    const resp = await fetch(url, { signal: AbortSignal.timeout(5500) });
    if (!resp.ok) {
      const stale = await getStaleCachedPersistent<any[]>(cacheKey);
      return res.json({ streets: stale || [] });
    }
    const data = await resp.json();
    const streets = (Array.isArray(data?.features) ? data.features : []).map((f: any) => ({
      objectId: f?.attributes?.OBJECTID,
      tipo: f?.attributes?.TIPO || '',
      nome: f?.attributes?.NOME || '',
      nomeLogradouro: f?.attributes?.NOME_LOGRADOURO || '',
      codLog: f?.attributes?.CODLOG || '',
      localidade: f?.attributes?.LOCALIDADE || 'LONDRINA',
    }));

    await setCachedPersistent(cacheKey, streets);
    return res.json({ streets });
  } catch {
    const stale = await getStaleCachedPersistent<any[]>(cacheKey);
    return res.json({ streets: stale || [] });
  }
});

router.get('/siglon/lote', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -23.6 || lat > -23.0 || lng < -51.4 || lng > -50.9) {
    return res.json({ lote: null });
  }

  const cacheKey = `siglon-lote:${lat.toFixed(5)},${lng.toFixed(5)}`;
  try {
    const cached = await getCachedPersistent<any>(cacheKey);
    if (cached !== undefined) {
      return res.json({ lote: cached });
    }

    const url = encodeURI(
      `https://geo.londrina.pr.gov.br/server/rest/services/Portal_Publico/Base_Cartográfica_Pública/MapServer/0/query?geometry=${lng},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=25&units=esriSRUnit_Meter&outFields=OBJECTID,QUADR_C,LOTE_C,CODLOT,NOME_LOTE&returnGeometry=false&resultRecordCount=1&f=json`
    );
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) {
      const stale = await getStaleCachedPersistent<any>(cacheKey);
      return res.json({ lote: stale ?? null });
    }
    const data = await resp.json();
    const attrs = data?.features?.[0]?.attributes;
    const lote = attrs
      ? {
          quadra: attrs.QUADR_C || null,
          lote: attrs.LOTE_C || null,
          codLot: attrs.CODLOT || null,
          loteamento: attrs.NOME_LOTE || null,
        }
      : null;
    await setCachedPersistent(cacheKey, lote);
    return res.json({ lote });
  } catch {
    const stale = await getStaleCachedPersistent<any>(cacheKey);
    return res.json({ lote: stale ?? null });
  }
});

router.get('/nominatim/search', async (req, res) => {
  const params = new URLSearchParams();
  for (const key of ['q', 'street', 'city', 'state', 'postalcode', 'countrycodes', 'limit', 'polygon_geojson']) {
    const val = req.query[key];
    if (typeof val === 'string' && val.trim()) {
      params.set(key, val.trim());
    }
  }
  params.set('format', 'jsonv2');
  params.set('addressdetails', '1');
  if (!params.has('limit')) params.set('limit', '6');

  const cacheKey = `nom-s:${params.toString()}`;
  try {
    const cached = await getCachedPersistent<any>(cacheKey);
    if (cached !== undefined) {
      return res.json(cached);
    }

    const resp = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        'User-Agent': '3CCorpMaps-Londrina/1.0 (+https://3ccorp.com.br)',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(6500),
    });
    if (!resp.ok) {
      const stale = await getStaleCachedPersistent<any>(cacheKey);
      if (stale !== undefined) return res.json(stale);
      return res.status(resp.status).json([]);
    }
    const json = await resp.json();
    await setCachedPersistent(cacheKey, json);
    return res.json(json);
  } catch {
    const stale = await getStaleCachedPersistent<any>(cacheKey);
    if (stale !== undefined) return res.json(stale);
    return res.status(502).json([]);
  }
});

router.get('/nominatim/reverse', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: 'Coordenadas inválidas.' });
  }

  const cacheKey = `nom-r:${lat.toFixed(5)},${lon.toFixed(5)}`;
  try {
    const cached = await getCachedPersistent<any>(cacheKey);
    if (cached !== undefined) {
      return res.json(cached);
    }

    const params = new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      lat: String(lat),
      lon: String(lon),
    });

    const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: {
        'User-Agent': '3CCorpMaps-Londrina/1.0 (+https://3ccorp.com.br)',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(6500),
    });
    if (!resp.ok) {
      const stale = await getStaleCachedPersistent<any>(cacheKey);
      if (stale !== undefined) return res.json(stale);
      return res.status(resp.status).json({});
    }
    const json = await resp.json();
    await setCachedPersistent(cacheKey, json);
    return res.json(json);
  } catch {
    const stale = await getStaleCachedPersistent<any>(cacheKey);
    if (stale !== undefined) return res.json(stale);
    return res.status(502).json({});
  }
});

router.get('/ibge/states', async (_req, res) => {
  const cacheKey = 'ibge:states:br';
  const cached = await getCachedPersistent<any[]>(cacheKey);
  if (cached) {
    return res.json({ country: 'Brasil', countryCode: 'BR', states: cached });
  }
  try {
    const resp = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome', {
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        const states = data.map((s: any) => ({
          id: Number(s.id),
          uf: String(s.sigla || '').toUpperCase(),
          name: String(s.nome || ''),
          region: String(s?.regiao?.nome || ''),
        }));
        await setCachedPersistent(cacheKey, states);
        return res.json({ country: 'Brasil', countryCode: 'BR', states });
      }
    }
  } catch {
    // fallback below
  }
  return res.json({ country: 'Brasil', countryCode: 'BR', states: BRASIL_STATES_FALLBACK });
});

router.get('/ibge/cities', async (req, res) => {
  const uf = String(req.query.uf || 'PR').trim().toUpperCase().slice(0, 2);
  if (!/^[A-Z]{2}$/.test(uf)) {
    return res.status(400).json({ error: 'UF inválida.' });
  }
  const cacheKey = `ibge:cities:${uf}`;
  const cached = await getCachedPersistent<any[]>(cacheKey);
  if (cached) {
    return res.json({ uf, cities: cached });
  }
  try {
    const resp = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(uf)}/municipios?orderBy=nome`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        const cities = data.map((c: any) => ({
          id: Number(c.id),
          name: String(c.nome || ''),
          uf,
          mesorregiao: String(c?.microrregiao?.mesorregiao?.nome || c?.['regiao-imediata']?.['regiao-intermediaria']?.nome || ''),
          microrregiao: String(c?.microrregiao?.nome || c?.['regiao-imediata']?.nome || ''),
        }));
        await setCachedPersistent(cacheKey, cities);
        return res.json({ uf, cities });
      }
    }
  } catch {
    // fallback below
  }
  const stale = await getStaleCachedPersistent<any[]>(cacheKey);
  if (stale && stale.length > 0) {
    return res.json({ uf, cities: stale });
  }
  const fallbackCities =
    uf === 'PR'
      ? [
          { id: 4113700, name: 'Londrina', uf: 'PR', mesorregiao: 'Norte Central Paranaense', microrregiao: 'Londrina' },
          { id: 4106902, name: 'Curitiba', uf: 'PR', mesorregiao: 'Metropolitana de Curitiba', microrregiao: 'Curitiba' },
          { id: 4115200, name: 'Maringá', uf: 'PR', mesorregiao: 'Norte Central Paranaense', microrregiao: 'Maringá' },
          { id: 4104808, name: 'Cascavel', uf: 'PR', mesorregiao: 'Oeste Paranaense', microrregiao: 'Cascavel' },
        ]
      : [];
  return res.json({ uf, cities: fallbackCities });
});

router.get('/osrm/route', async (req, res) => {
  const coords = String(req.query.coords || '').trim();
  if (!coords || !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?(;-?\d+(\.\d+)?,-?\d+(\.\d+)?)+$/.test(coords)) {
    return res.status(400).json({ error: 'Coordenadas OSRM inválidas.' });
  }
  const cacheKey = `osrm-rt:${coords}`;
  try {
    const cached = await getCachedPersistent<any>(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5500) });
    if (!resp.ok) {
      const stale = await getStaleCachedPersistent<any>(cacheKey);
      if (stale) return res.json(stale);
      return res.status(resp.status).json({ error: 'OSRM route indisponível.' });
    }
    const json = await resp.json();
    await setCachedPersistent(cacheKey, json);
    return res.json(json);
  } catch {
    const stale = await getStaleCachedPersistent<any>(cacheKey);
    if (stale) return res.json(stale);
    return res.status(502).json({ error: 'Falha ao consultar OSRM route.' });
  }
});

router.get('/osrm/trip', async (req, res) => {
  const coords = String(req.query.coords || '').trim();
  if (!coords || !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?(;-?\d+(\.\d+)?,-?\d+(\.\d+)?)+$/.test(coords)) {
    return res.status(400).json({ error: 'Coordenadas OSRM trip inválidas.' });
  }
  const cacheKey = `osrm-tr:${coords}`;
  try {
    const cached = await getCachedPersistent<any>(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const url = `https://router.project-osrm.org/trip/v1/driving/${coords}?source=first&roundtrip=false&destination=any&overview=full&geometries=geojson`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5500) });
    if (!resp.ok) {
      const stale = await getStaleCachedPersistent<any>(cacheKey);
      if (stale) return res.json(stale);
      return res.status(resp.status).json({ error: 'OSRM trip indisponível.' });
    }
    const json = await resp.json();
    await setCachedPersistent(cacheKey, json);
    return res.json(json);
  } catch {
    const stale = await getStaleCachedPersistent<any>(cacheKey);
    if (stale) return res.json(stale);
    return res.status(502).json({ error: 'Falha ao consultar OSRM trip.' });
  }
});

router.use(pmtilesRoutes);
router.use(cityDirectoryAndIndexRoutes);

export default router;
