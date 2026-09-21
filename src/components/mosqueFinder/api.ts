/* Network layer: Overpass (mosques), OSRM (road route), Nominatim (place search).
   Robust version with Overpass fallbacks and request timeouts. */

import type { MosqueLite, RouteData, GeocodeHit } from './types';

interface OverpassElement {
  type: string;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

/* Public Overpass servers.
   If one is unavailable/overloaded, the next one is tried automatically.
*/
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
] as const;

/** Client-side timeout for each Overpass request. */
const OVERPASS_CLIENT_TIMEOUT = 15000;

/** All nearby mosques within `radius` meters of (lat, lng). */
export async function fetchMosquesFromAPI(
  lat: number,
  lng: number,
  radius: number,
): Promise<MosqueLite[]> {
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="place_of_worship"]["religion"="muslim"](around:${radius},${lat},${lng});
      way["amenity"="place_of_worship"]["religion"="muslim"](around:${radius},${lat},${lng});
      node["building"="mosque"](around:${radius},${lat},${lng});
      way["building"="mosque"](around:${radius},${lat},${lng});
    );
    out center;
  `;

  let lastError: unknown = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();

    const timer = window.setTimeout(() => {
      controller.abort();
    }, OVERPASS_CLIENT_TIMEOUT);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'application/json',
        },
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal,
      });

      if (!res.ok) {
        const serverText = await res.text().catch(() => '');
        throw new Error(
          `Overpass HTTP ${res.status}${
            serverText ? `: ${serverText.slice(0, 200)}` : ''
          }`,
        );
      }

      const json = (await res.json()) as OverpassResponse;

      if (!json || !Array.isArray(json.elements)) {
        throw new Error('Invalid response from Overpass server');
      }

      return processElements(json.elements);
    } catch (error) {
      lastError = error;

      console.warn(
        `[Mosque API] Overpass server failed: ${endpoint}`,
        error,
      );
    } finally {
      window.clearTimeout(timer);
    }
  }

  if (lastError instanceof Error) {
    if (lastError.name === 'AbortError') {
      throw new Error(
        'Mosque server timed out. Please try again in a few seconds.',
      );
    }

    throw new Error(
      `Unable to load nearby mosques: ${lastError.message}`,
    );
  }

  throw new Error('Unable to load nearby mosques.');
}

/** raw Overpass elements → compact de-duplicated list */
export function processElements(
  elements: OverpassElement[],
): MosqueLite[] {
  const seen = new Set<string>();
  const out: MosqueLite[] = [];

  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      continue;
    }

    const key =
      lat.toFixed(4) + ',' + lon.toFixed(4);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    out.push({
      name:
        el.tags?.name ||
        el.tags?.['name:en'] ||
        el.tags?.['name:ur'] ||
        'Mosque',

      lat,
      lon,
    });
  }

  return out;
}

/** Real road distance/duration/geometry via public OSRM. */
export async function fetchOSRMRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lon: number },
): Promise<RouteData> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from.lng.toFixed(5)},${from.lat.toFixed(5)};` +
    `${to.lon.toFixed(5)},${to.lat.toFixed(5)}` +
    `?overview=full&geometries=geojson&alternatives=false`;

  const controller = new AbortController();

  const timer = window.setTimeout(() => {
    controller.abort();
  }, 12000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }

    const j = (await res.json()) as {
      code: string;
      routes?: {
        distance: number;
        duration: number;
        geometry: {
          coordinates: [number, number][];
        };
      }[];
    };

    if (
      j.code !== 'Ok' ||
      !j.routes ||
      !j.routes.length
    ) {
      throw new Error('No route found');
    }

    const r = j.routes[0];

    return {
      d: r.distance,
      t: r.duration,

      c: r.geometry.coordinates.map(
        (p) => [p[1], p[0]] as [number, number],
      ),

      s: 'osrm',
    };
  } finally {
    window.clearTimeout(timer);
  }
}

/** Geocode a typed place name (used by the search bar). */
export async function fetchGeocode(
  query: string,
): Promise<GeocodeHit | null> {
  const controller = new AbortController();

  const timer = window.setTimeout(() => {
    controller.abort();
  }, 10000);

  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?format=json` +
      `&limit=1` +
      `&q=${encodeURIComponent(query)}`;

    const res = await fetch(url, {
      signal: controller.signal,

      headers: {
        'Accept-Language': 'en',
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }

    const results = (await res.json()) as {
      lat: string;
      lon: string;
      display_name: string;
    }[];

    if (!results.length) {
      return null;
    }

    return {
      lat: parseFloat(results[0].lat),
      lng: parseFloat(results[0].lon),
      label:
        (results[0].display_name || '').split(',')[0],
    };
  } finally {
    window.clearTimeout(timer);
  }
}
