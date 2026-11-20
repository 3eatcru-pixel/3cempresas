import express from 'express';
import { db, runWithSystemDbContext } from '../../config.ts';
import { verifyAutonomousToken, requireRoles } from '../../middleware/auth.ts';
import {
  BRASIL_STATES_FALLBACK,
  getCachedPersistent,
  getStaleCachedPersistent,
  parseStoreAddressFields,
  parseViaCepComplementRange,
  setCachedPersistent,
  stripAccents,
} from './mapsGeoHelpers.ts';

const router = express.Router();

router.get('/city-directory', async (req, res) => {
  try {
    const country = 'Brasil';
    const countryCode = 'BR';
    const uf = String(req.query.uf || 'PR').trim().toUpperCase().slice(0, 2);
    const stateMeta = BRASIL_STATES_FALLBACK.find((s) => s.uf === uf);
    const stateName = stateMeta?.name || uf;
    const city = String(req.query.city || 'Londrina').trim();
    const regionFilter = stripAccents(String(req.query.region || '')).toLowerCase();
    const neighborhoodFilter = stripAccents(String(req.query.neighborhood || '')).toLowerCase();
    const streetFilter = String(req.query.street || '').trim();
    const numberFilterRaw = String(req.query.number || '').replace(/\D/g, '');
    const targetNum = numberFilterRaw ? parseInt(numberFilterRaw, 10) : null;
    const cepFilterDigits = String(req.query.cep || '').replace(/\D/g, '');

    const [indexSnap, storesSnap] = await runWithSystemDbContext('CITY_MAPS_DIRECTORY_READ', () =>
      Promise.all([db.collection('city_maps_data').get(), db.collection('stores').get()])
    );

    const rows: any[] = [];
    const regionSet = new Set<string>(['CENTRO', 'SUL', 'NORTE', 'OESTE', 'LESTE']);
    const neighborhoodSet = new Set<string>();

    const matchesText = (hay: string | undefined, needle: string) => {
      if (!needle) return true;
      return stripAccents(String(hay || '')).toLowerCase().includes(needle);
    };

    const matchesFilters = (rec: {
      stateUf?: string;
      city?: string;
      region?: string;
      neighborhood?: string;
      street?: string;
      houseNumber?: string;
      cep?: string;
    }) => {
      if (uf && rec.stateUf && rec.stateUf.toUpperCase() !== uf) return false;
      if (city && rec.city && stripAccents(rec.city).toLowerCase() !== stripAccents(city).toLowerCase()) return false;
      if (regionFilter && !matchesText(rec.region, regionFilter)) return false;
      if (neighborhoodFilter && !matchesText(rec.neighborhood, neighborhoodFilter)) return false;
      if (streetFilter && !matchesText(rec.street, stripAccents(streetFilter).toLowerCase())) return false;
      if (numberFilterRaw && rec.houseNumber && !String(rec.houseNumber).includes(numberFilterRaw)) return false;
      if (cepFilterDigits && String(rec.cep || '').replace(/\D/g, '') !== cepFilterDigits) return false;
      return true;
    };

    // 1. Saved City Maps Index docs
    for (const d of indexSnap.docs) {
      const data = d.data();
      if (!data || data._deleted) continue;
      if (data.region) regionSet.add(String(data.region).toUpperCase());
      if (data.neighborhood && (!city || stripAccents(data.city || '').toLowerCase() === stripAccents(city).toLowerCase())) {
        neighborhoodSet.add(String(data.neighborhood));
      }
      if (!matchesFilters(data)) continue;
      rows.push({
        id: data.id || d.id,
        country,
        countryCode,
        stateUf: data.stateUf || uf,
        stateName: data.stateName || stateName,
        city: data.city || city,
        region: data.region || 'CENTRO',
        neighborhood: data.neighborhood || '',
        street: data.street || '',
        houseNumber: data.houseNumber || '',
        numberRange: data.rangeLabel || data.houseNumber || '',
        cep: data.cep || '',
        lat: typeof data.lat === 'number' ? data.lat : null,
        lng: typeof data.lng === 'number' ? data.lng : null,
        siglonQuadraLote: data.siglonQuadraLote || null,
        source: 'CITY_INDEX',
        label: data.label || '',
      });
    }

    // 2. Active geo-referenced Stores in DB
    for (const d of storesSnap.docs) {
      const st = d.data();
      if (!st || st._deleted) continue;
      if (String(st.status || 'ACTIVE').toUpperCase() === 'SUSPENDED') continue;
      const parsed = parseStoreAddressFields(st);
      if (st.region) regionSet.add(String(st.region).toUpperCase());
      if (parsed.neighborhood && (!city || stripAccents(parsed.city).toLowerCase() === stripAccents(city).toLowerCase())) {
        neighborhoodSet.add(parsed.neighborhood);
      }
      const candidate = {
        stateUf: parsed.stateUf,
        city: parsed.city,
        region: st.region || 'CENTRO',
        neighborhood: parsed.neighborhood,
        street: parsed.street,
        houseNumber: parsed.houseNumber,
        cep: parsed.cep,
      };
      if (!matchesFilters(candidate)) continue;
      rows.push({
        id: `store-${st.id || d.id}`,
        country,
        countryCode,
        stateUf: parsed.stateUf,
        stateName,
        city: parsed.city,
        region: st.region || 'CENTRO',
        neighborhood: parsed.neighborhood,
        street: parsed.street,
        houseNumber: parsed.houseNumber,
        numberRange: parsed.houseNumber || '',
        cep: parsed.cep,
        lat: typeof st.latitude === 'number' ? st.latitude : null,
        lng: typeof st.longitude === 'number' ? st.longitude : null,
        siglonQuadraLote: null,
        source: 'STORE_DB',
        label: st.name || '',
      });
    }

    // 3. Exact CEP lookup via ViaCEP (with L1+L2 persistent cache) if 8-digit CEP supplied
    if (cepFilterDigits.length === 8) {
      const cepCacheKey = `viacep-cep:${cepFilterDigits}`;
      let cData = await getCachedPersistent<any>(cepCacheKey);
      if (!cData) {
        try {
          const cepResp = await fetch(`https://viacep.com.br/ws/${cepFilterDigits}/json/`, {
            signal: AbortSignal.timeout(4500),
          });
          if (cepResp.ok) {
            const fetched = await cepResp.json();
            if (fetched && !fetched.erro) {
              cData = fetched;
              await setCachedPersistent(cepCacheKey, cData);
            }
          }
        } catch {
          cData = await getStaleCachedPersistent<any>(cepCacheKey);
        }
      }
      if (cData && !cData.erro) {
        if (cData.bairro) neighborhoodSet.add(String(cData.bairro));
        const range = parseViaCepComplementRange(cData.complemento || '');
        rows.push({
          id: `viacep-cep-${cepFilterDigits}`,
          country,
          countryCode,
          stateUf: String(cData.uf || uf),
          stateName,
          city: String(cData.localidade || city),
          region: regionFilter ? regionFilter.toUpperCase() : 'MUNICIPAL',
          neighborhood: String(cData.bairro || ''),
          street: String(cData.logradouro || ''),
          houseNumber: numberFilterRaw || (range.exactNumber ? String(range.exactNumber) : ''),
          numberRange: cData.complemento || 'Faixa única CEP',
          cep: String(cData.cep || cepFilterDigits),
          lat: null,
          lng: null,
          siglonQuadraLote: null,
          source: 'VIACEP_RANGE',
          label: cData.complemento || '',
        });
      }
    }

    // 4. Street search against ViaCEP + SIGLON Arruamento (when street >= 3 chars)
    if (streetFilter.length >= 3 && /^[A-Z]{2}$/.test(uf) && city.length >= 2) {
      const stripped = streetFilter
        .replace(/^(Rua|Avenida|Av\.?|R\.?|Alameda|Travessa|Rodovia|Estrada|Praça)\s+/i, '')
        .trim();
      const viaStreetCacheKey = `viacep-st:${uf}:${stripAccents(city).toLowerCase()}:${stripAccents(stripped || streetFilter).toLowerCase()}`;
      const viaCepUrl = `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(city)}/${encodeURIComponent(stripped || streetFilter)}/json/`;
      const isLondrina = uf === 'PR' && stripAccents(city).toLowerCase() === 'londrina';
      const siglonQ = stripAccents(stripped || streetFilter).toUpperCase().replace(/['"%_;]/g, '');
      const siglonCacheKey = `siglon-arr-raw:${siglonQ}`;
      const siglonUrl =
        isLondrina && siglonQ.length >= 3
          ? encodeURI(
              `https://geo.londrina.pr.gov.br/server/rest/services/Portal_Publico/Arruamento_Publico/MapServer/0/query?where=NOME_BUSCA LIKE '%${siglonQ}%'&outFields=OBJECTID,TIPO,NOME,NOME_LOGRADOURO,CODLOG,LOCALIDADE&returnGeometry=false&resultRecordCount=15&f=json`
            )
          : null;

      const [viaRes, sigRes] = await Promise.all([
        (async () => {
          const cached = await getCachedPersistent<any[]>(viaStreetCacheKey);
          if (cached) return cached;
          try {
            const r = await fetch(viaCepUrl, { signal: AbortSignal.timeout(5000) });
            if (r.ok) {
              const json = await r.json();
              if (Array.isArray(json)) {
                await setCachedPersistent(viaStreetCacheKey, json);
                return json;
              }
            }
          } catch {
            // fallback to stale
          }
          return (await getStaleCachedPersistent<any[]>(viaStreetCacheKey)) || [];
        })(),
        siglonUrl
          ? (async () => {
              const cached = await getCachedPersistent<any>(siglonCacheKey);
              if (cached) return cached;
              try {
                const r = await fetch(siglonUrl, { signal: AbortSignal.timeout(5000) });
                if (r.ok) {
                  const json = await r.json();
                  await setCachedPersistent(siglonCacheKey, json);
                  return json;
                }
              } catch {
                // fallback to stale
              }
              return (await getStaleCachedPersistent<any>(siglonCacheKey)) || null;
            })()
          : Promise.resolve(null),
      ]);

      if (Array.isArray(viaRes)) {
        for (const blk of viaRes.slice(0, 25)) {
          if (!blk || !blk.cep || blk.erro) continue;
          if (blk.bairro) neighborhoodSet.add(String(blk.bairro));
          const range = parseViaCepComplementRange(blk.complemento || '');
          const inRange =
            targetNum === null ||
            (range.exactNumber !== null && range.exactNumber === targetNum) ||
            ((range.min === null && range.max === null) ||
              (targetNum >= (range.min ?? 0) && targetNum <= (range.max ?? Number.MAX_SAFE_INTEGER)));
          if (neighborhoodFilter && !matchesText(blk.bairro, neighborhoodFilter)) continue;
          if (cepFilterDigits && String(blk.cep).replace(/\D/g, '') !== cepFilterDigits) continue;
          rows.push({
            id: `viacep-${String(blk.cep)}-${blk.complemento || 'all'}`,
            country,
            countryCode,
            stateUf: String(blk.uf || uf),
            stateName,
            city: String(blk.localidade || city),
            region: regionFilter ? regionFilter.toUpperCase() : 'CORREIOS_CEP',
            neighborhood: String(blk.bairro || ''),
            street: String(blk.logradouro || ''),
            houseNumber: numberFilterRaw || (range.exactNumber ? String(range.exactNumber) : ''),
            numberRange: blk.complemento || 'Toda a extensão',
            cep: String(blk.cep),
            lat: null,
            lng: null,
            siglonQuadraLote: null,
            source: 'VIACEP_RANGE',
            rangeMatchesNumber: inRange,
            label: inRange && targetNum !== null ? `Compatível c/ nº ${targetNum}` : '',
          });
        }
      }

      const sigFeatures = Array.isArray(sigRes?.features) ? sigRes.features : [];
      for (const feat of sigFeatures) {
        const a = feat?.attributes;
        if (!a) continue;
        rows.push({
          id: `siglon-arr-${a.OBJECTID || a.CODLOG}`,
          country,
          countryCode,
          stateUf: 'PR',
          stateName: 'Paraná',
          city: 'Londrina',
          region: a.LOCALIDADE || 'LONDRINA',
          neighborhood: '',
          street: a.NOME || a.NOME_LOGRADOURO || '',
          houseNumber: numberFilterRaw || '',
          numberRange: a.CODLOG ? `CODLOG ${a.CODLOG}` : 'Arruamento Oficial',
          cep: '',
          lat: null,
          lng: null,
          siglonQuadraLote: a.CODLOG ? `CODLOG ${a.CODLOG}` : null,
          source: 'SIGLON_LONDRINA',
          label: `${a.TIPO || ''} • SIGLON Oficial`.trim(),
        });
      }
    }

    return res.json({
      country,
      countryCode,
      stateUf: uf,
      stateName,
      city,
      facets: {
        regions: Array.from(regionSet),
        neighborhoods: Array.from(neighborhoodSet).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      },
      rows,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Erro ao consultar City Maps Directory.' });
  }
});

router.get('/city-index', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (_req, res) => {
  try {
    const snap = await runWithSystemDbContext('CITY_MAPS_INDEX_LIST', () =>
      db.collection('city_maps_data').get()
    );
    const items = snap.docs
      .map((d) => d.data())
      .filter((item) => item && !item._deleted);
    return res.json({ items });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Falha ao listar índice City Maps Data.' });
  }
});

router.post('/city-index', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const body = req.body || {};
    const street = String(body.street || '').trim();
    const city = String(body.city || '').trim();
    const stateUf = String(body.stateUf || '').trim().toUpperCase().slice(0, 2);
    if (!street || !city || !/^[A-Z]{2}$/.test(stateUf)) {
      return res.status(400).json({ error: 'Campos obrigatórios: stateUf, city e street.' });
    }
    const id =
      typeof body.id === 'string' && body.id.trim()
        ? body.id.trim().replace(/[^a-zA-Z0-9_-]/g, '')
        : `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const record = {
      id,
      country: 'Brasil',
      countryCode: 'BR',
      stateUf,
      stateName: String(body.stateName || BRASIL_STATES_FALLBACK.find((s) => s.uf === stateUf)?.name || stateUf),
      city,
      region: String(body.region || 'CENTRO').trim().toUpperCase(),
      neighborhood: String(body.neighborhood || '').trim(),
      street,
      houseNumber: String(body.houseNumber || '').trim(),
      rangeLabel: String(body.rangeLabel || '').trim(),
      cep: String(body.cep || '').trim(),
      lat: typeof body.lat === 'number' && Number.isFinite(body.lat) ? body.lat : null,
      lng: typeof body.lng === 'number' && Number.isFinite(body.lng) ? body.lng : null,
      siglonQuadraLote: body.siglonQuadraLote ? String(body.siglonQuadraLote).trim() : null,
      label: String(body.label || '').trim(),
      source: String(body.source || 'CITY_INDEX'),
      updatedAt: new Date().toISOString(),
    };

    await runWithSystemDbContext('CITY_MAPS_INDEX_WRITE', () =>
      db.collection('city_maps_data').doc(id).set(record)
    );
    return res.status(201).json({ item: record });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Falha ao salvar registro no índice City Maps Data.' });
  }
});

router.delete('/city-index/:id', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'ID inválido.' });
    await runWithSystemDbContext('CITY_MAPS_INDEX_DELETE', () =>
      db.collection('city_maps_data').doc(id).delete()
    );
    return res.json({ deleted: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Falha ao excluir registro.' });
  }
});

export default router;
