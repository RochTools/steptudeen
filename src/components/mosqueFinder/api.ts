/* Network layer: Overpass (mosques), OSRM (road route), Nominatim (place search).
   Same endpoints and fallback behavior as the standalone HTML app. */
import type { MosqueLite, RouteData, GeocodeHit } from './types';

interface OverpassElement {
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/* Overpass کا مرکزی سرور (overpass-api.de) اب براؤزر کی POST درخواستوں کو
   CORS preflight پر ہی 403/406 کے ساتھ رد کر دیتا ہے (1-2 سیکنڈ میں فوری ناکامی،
   query چلنے سے پہلے ہی)۔ اس لیے:
     1) POST کی بجائے GET — چھوٹی query "simple request" ہے، preflight نہیں چاہیے
     2) ایک سے زیادہ آئینے (mirrors) — پہلا ناکام ہو تو اگلا خود بخود آزمائیں */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

async function fetchFromEndpoint(endpoint: string, query: string, timeoutMs = 15000): Promise<OverpassElement[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
      method: 'GET',
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = (await res.json()) as { elements?: OverpassElement[] };
    return json.elements || [];
  } finally {
    clearTimeout(timer);
  }
}

/** All nearby mosques within `radius` meters of (lat, lng). */
export async function fetchMosquesFromAPI(lat: number, lng: number, radius: number): Promise<MosqueLite[]> {
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

  let lastErr: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const elements = await fetchFromEndpoint(endpoint, query);
      return processElements(elements);
    } catch (err) {
      lastErr = err;
      // اگلے آئینے (mirror) پر آزمائیں
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('All Overpass mirrors failed');
}

/** raw Overpass elements → compact de-duplicated list (small = cache-friendly) */
export function processElements(elements: OverpassElement[]): MosqueLite[] {
  const seen = new Set<string>();
  const out: MosqueLite[] = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    const key = lat.toFixed(4) + ',' + lon.toFixed(4); // ~11m buckets kill node/way duplicates
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: el.tags?.name || el.tags?.['name:en'] || el.tags?.['name:ur'] || 'Mosque',
      lat,
      lon,
    });
  }
  return out;
}

/** Real road distance/duration/geometry via public OSRM (12s timeout). */
export async function fetchOSRMRoute(from: { lat: number; lng: number }, to: { lat: number; lon: number }): Promise<RouteData> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from.lng.toFixed(5)},${from.lat.toFixed(5)};${to.lon.toFixed(5)},${to.lat.toFixed(5)}` +
    `?overview=full&geometries=geojson&alternatives=false`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = (await res.json()) as {
      code: string;
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
    };
    if (j.code !== 'Ok' || !j.routes || !j.routes.length) throw new Error('No route found');
    const r = j.routes[0];
    return {
      d: r.distance,
      t: r.duration,
      c: r.geometry.coordinates.map((p) => [p[1], p[0]] as [number, number]), // [lng,lat] → [lat,lng]
      s: 'osrm',
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Geocode a typed place name (used by the search bar). */
export async function fetchGeocode(query: string): Promise<GeocodeHit | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
    { headers: { 'Accept-Language': 'en' } },
  );
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const results = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (!results.length) return null;
  return {
    lat: parseFloat(results[0].lat),
    lng: parseFloat(results[0].lon),
    label: (results[0].display_name || '').split(',')[0],
  };
}
