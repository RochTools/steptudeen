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

/* پہلے یہاں GET (query کو URL میں) استعمال ہو رہا تھا، اس خیال پر کہ overpass-api.de
   POST کو preflight پر رد کرتا ہے۔ یہ خیال غلط ثابت ہوا: ہماری اصل standalone HTML
   فائل آج بھی اسی overpass-api.de کو POST سے کال کر کے کامیابی سے چلتی ہے۔

   اصل وجہ کچھ اور تھی: ہماری query میں 4 شرطیں ہیں (node/way × place_of_worship/mosque)،
   جو GET میں پورے کی پوری URL کے اندر جاتی ہے۔ کئی سرور/پراکسی لمبے URL کو 414 یا
   خاموشی سے رد کر دیتے ہیں — اور وہ ناکامی بھی ہمارے catch میں پھنس کر وہی عمومی
   "servers busy" پیغام بنا دیتی تھی، اصل وجہ کبھی نظر نہیں آئی۔

   حل: standalone HTML کے عین مطابق POST پر واپس، جہاں query request body میں جاتی
   ہے (URL کی لمبائی کی حد کا مسئلہ ہی نہیں رہتا)۔ آئینوں (mirrors) کی اصل ترتیب بھی
   واپس — overpass-api.de پہلے نمبر پر، کیونکہ عملی طور پر یہی سب سے تیز/قابلِ اعتماد
   نکلا۔ باقی تین بدستور fallback کے طور پر موجود ہیں۔ */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function fetchFromEndpoint(endpoint: string, query: string, timeoutMs = 15000): Promise<OverpassElement[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${endpoint}`);
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

  const failures: string[] = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const elements = await fetchFromEndpoint(endpoint, query);
      return processElements(elements);
    } catch (err) {
      // ہر آئینے کی اصل ناکامی محفوظ کر لیں (صرف last error نہیں) تاکہ اگر سب ناکام
      // ہوں تو console میں اصل وجہ (timeout؟ HTTP 414؟ CORS؟) نظر آئے، اندازہ نہ لگانا پڑے۔
      const reason = err instanceof Error ? err.message : String(err);
      failures.push(`${endpoint}: ${reason}`);
      // اگلے آئینے (mirror) پر آزمائیں
    }
  }
  console.error('All Overpass mirrors failed:\n' + failures.join('\n'));
  // Keep this short: it's rendered directly in the on-screen status toast on the phone.
  // Shows only the LAST (most recent) mirror's reason — full detail for every mirror is
  // still in console.error above for anyone who does have dev tools open.
  const lastReason = failures[failures.length - 1] || 'unknown error';
  throw new Error(`${OVERPASS_ENDPOINTS.length} servers tried, all failed. Last: ${lastReason}`);
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
