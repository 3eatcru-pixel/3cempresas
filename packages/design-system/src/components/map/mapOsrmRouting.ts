import {
  calculateDistanceKm,
  estimateCourierEtaMin,
  isValidLatLng,
} from './mapTypesAndIcons';
import { getCached, isSameOriginHttpEnv, setCached } from './mapBrazilianAddressParser';

export interface OsrmRouteResult {
  coordinates: [number, number][];
  distanceKm: number;
  durationMin: number;
  isFallback: boolean;
}

export interface OptimizedStopResult<T> {
  orderedStops: T[];
  route: OsrmRouteResult;
}

const routeCache = new Map<string, { expiresAt: number; value: OsrmRouteResult }>();

const buildGeodesicFallback = (waypoints: [number, number][]): OsrmRouteResult => {
  let totalKm = 0;
  for (let i = 1; i < waypoints.length; i++) {
    totalKm += calculateDistanceKm(
      waypoints[i - 1][0],
      waypoints[i - 1][1],
      waypoints[i][0],
      waypoints[i][1]
    );
  }
  const roundedKm = parseFloat(totalKm.toFixed(2));
  return {
    coordinates: waypoints,
    distanceKm: roundedKm,
    durationMin: estimateCourierEtaMin(roundedKm, 'SCOOTER'),
    isFallback: true,
  };
};

const parseOsrmRoutePayload = (data: any, fallbackWaypoints: [number, number][]): OsrmRouteResult => {
  const route = data?.routes?.[0];
  const coords = route?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) {
    return buildGeodesicFallback(fallbackWaypoints);
  }

  const leafletCoords: [number, number][] = coords
    .filter((pair: any) => Array.isArray(pair) && isValidLatLng(pair[1], pair[0]))
    .map((pair: [number, number]) => [pair[1], pair[0]]);

  if (leafletCoords.length < 2) {
    return buildGeodesicFallback(fallbackWaypoints);
  }

  const distanceKm = parseFloat(((Number(route.distance) || 0) / 1000).toFixed(2));
  const durationMin = Math.max(2, Math.round((Number(route.duration) || 0) / 60));

  return {
    coordinates: leafletCoords,
    distanceKm,
    durationMin,
    isFallback: false,
  };
};

export const fetchStreetRouteOsrm = async (
  waypoints: [number, number][],
  options?: { signal?: AbortSignal }
): Promise<OsrmRouteResult> => {
  const valid = waypoints.filter((p) => isValidLatLng(p[0], p[1]));
  if (valid.length < 2) {
    return { coordinates: valid, distanceKm: 0, durationMin: 0, isFallback: true };
  }

  const cacheKey = `rt:${valid.map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).join('|')}`;
  const cached = getCached(routeCache, cacheKey);
  if (cached !== undefined) return cached;

  const coordsPath = valid.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5500);
  const signal = options?.signal || controller.signal;

  const endpoints = isSameOriginHttpEnv()
    ? [
        `/api/v1/maps/osrm/route?coords=${encodeURIComponent(coordsPath)}`,
        `https://router.project-osrm.org/route/v1/driving/${coordsPath}?overview=full&geometries=geojson`,
      ]
    : [`https://router.project-osrm.org/route/v1/driving/${coordsPath}?overview=full&geometries=geojson`];

  try {
    for (const url of endpoints) {
      try {
        const response = await fetch(url, { signal });
        if (!response.ok) continue;
        const data = await response.json();
        const parsed = parseOsrmRoutePayload(data, valid);
        if (!parsed.isFallback) {
          setCached(routeCache, cacheKey, parsed);
          return parsed;
        }
      } catch {
        // try next endpoint
      }
    }
    return buildGeodesicFallback(valid);
  } finally {
    clearTimeout(timer);
  }
};

export const optimizeMultiStopTripOsrm = async <T extends { position: [number, number] }>(
  startPos: [number, number],
  stops: T[],
  options?: { signal?: AbortSignal }
): Promise<OptimizedStopResult<T>> => {
  const validStops = stops.filter((s) => isValidLatLng(s.position[0], s.position[1]));
  if (validStops.length === 0 || !isValidLatLng(startPos[0], startPos[1])) {
    return {
      orderedStops: validStops,
      route: { coordinates: [startPos], distanceKm: 0, durationMin: 0, isFallback: true },
    };
  }
  if (validStops.length === 1) {
    const route = await fetchStreetRouteOsrm([startPos, validStops[0].position], options);
    return { orderedStops: validStops, route };
  }

  const allPoints: [number, number][] = [startPos, ...validStops.map((s) => s.position)];
  const coordsPath = allPoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5500);
  const signal = options?.signal || controller.signal;

  const endpoints = isSameOriginHttpEnv()
    ? [
        `/api/v1/maps/osrm/trip?coords=${encodeURIComponent(coordsPath)}`,
        `https://router.project-osrm.org/trip/v1/driving/${coordsPath}?source=first&roundtrip=false&destination=any&overview=full&geometries=geojson`,
      ]
    : [
        `https://router.project-osrm.org/trip/v1/driving/${coordsPath}?source=first&roundtrip=false&destination=any&overview=full&geometries=geojson`,
      ];

  try {
    for (const url of endpoints) {
      try {
        const res = await fetch(url, { signal });
        if (!res.ok) continue;
        const data = await res.json();
        const trip = data?.trips?.[0];
        const waypoints = data?.waypoints;
        const coords = trip?.geometry?.coordinates;
        if (Array.isArray(waypoints) && Array.isArray(coords) && coords.length >= 2) {
          const stopOrderWithIdx = waypoints
            .map((wp: any, origIdx: number) => ({ origIdx, tripIdx: Number(wp.waypoint_index) }))
            .filter((item) => item.origIdx > 0)
            .sort((a, b) => a.tripIdx - b.tripIdx);
          const orderedStops = stopOrderWithIdx
            .map((item) => validStops[item.origIdx - 1])
            .filter(Boolean);

          const leafletCoords: [number, number][] = coords
            .filter((pair: any) => Array.isArray(pair) && isValidLatLng(pair[1], pair[0]))
            .map((pair: [number, number]) => [pair[1], pair[0]]);

          if (orderedStops.length === validStops.length && leafletCoords.length >= 2) {
            return {
              orderedStops,
              route: {
                coordinates: leafletCoords,
                distanceKm: parseFloat(((Number(trip.distance) || 0) / 1000).toFixed(2)),
                durationMin: Math.max(2, Math.round((Number(trip.duration) || 0) / 60)),
                isFallback: false,
              },
            };
          }
        }
      } catch {
        // try next endpoint
      }
    }
  } finally {
    clearTimeout(timer);
  }

  const remaining = [...validStops];
  const greedyOrdered: T[] = [];
  let cursor = startPos;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((s, idx) => {
      const d = calculateDistanceKm(cursor[0], cursor[1], s.position[0], s.position[1]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    });
    const next = remaining.splice(bestIdx, 1)[0];
    greedyOrdered.push(next);
    cursor = next.position;
  }

  const fallbackRoute = buildGeodesicFallback([startPos, ...greedyOrdered.map((s) => s.position)]);
  return { orderedStops: greedyOrdered, route: fallbackRoute };
};
