/* Cloudflare Pages Function  →  GET /api/mosques?lat=..&lng=..&r=..
   نقشے کو 0.1° (~11 km) کے خانوں (tiles) میں بانٹتا ہے۔ ہر خانے کی مساجد KV میں 30 دن
   کے لیے محفوظ ہوتی ہیں، اس لیے ایک شہر کے ہزاروں صارفین کے لیے Overpass کو صرف ایک بار
   کال جاتی ہے۔ (KV نہ جڑا ہو تو بھی چلتا ہے، بس cache کے بغیر۔) */

interface KV {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string, opts?: { expirationTtl: number }): Promise<void>;
}
interface Env { MOSQUES?: KV }
interface Mosque { name: string; lat: number; lon: number }

const TILE = 0.1;                       // degrees
const TTL_SECONDS = 60 * 60 * 24 * 30;  // 30 days
const MAX_RADIUS = 15000;
const MAX_TILES = 16;
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
// Overpass کی پالیسی کے مطابق اپنی ایپ کی پہچان بھیجیں (اپنا ای میل/سائٹ لکھ دیں)
const UA = 'StepTuDeen/1.0 (mosque finder; contact: https://steptudeen.pages.dev)';

const json = (body: unknown, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cache },
  });

function distM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fetchTileFromOverpass(ix: number, iy: number): Promise<Mosque[]> {
  const s = iy * TILE, n = s + TILE, w = ix * TILE, e = w + TILE;
  const bbox = `${s},${w},${n},${e}`;
  const query =
    `[out:json][timeout:25];(` +
    `nwr["amenity"="place_of_worship"]["religion"="muslim"](${bbox});` +
    `nwr["building"="mosque"](${bbox});` +
    `);out center qt;`;

  let lastErr = 'unknown';
  for (const ep of OVERPASS) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = (await res.json()) as {
        elements?: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[];
      };
      const seen = new Set<string>();
      const out: Mosque[] = [];
      for (const el of data.elements || []) {
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (typeof lat !== 'number' || typeof lon !== 'number') continue;
        // صرف وہی مسجد رکھیں جو اس خانے کے اندر ہو — ورنہ ہمسایہ خانوں سے duplicate بنتے ہیں
        if (lat < s || lat >= n || lon < w || lon >= e) continue;
        const key = lat.toFixed(4) + ',' + lon.toFixed(4);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          name: el.tags?.name || el.tags?.['name:en'] || el.tags?.['name:ur'] || 'Mosque',
          lat, lon,
        });
      }
      return out;
    } catch (err) {
      lastErr = `${new URL(ep).hostname}: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
  throw new Error(lastErr);
}

async function getTile(env: Env, ix: number, iy: number): Promise<Mosque[]> {
  const key = `t1:${ix}:${iy}`;
  if (env.MOSQUES) {
    try {
      const hit = (await env.MOSQUES.get(key, 'json')) as Mosque[] | null;
      if (hit) return hit;
    } catch { /* KV خراب ہو تو سیدھا Overpass */ }
  }
  const fresh = await fetchTileFromOverpass(ix, iy);
  if (env.MOSQUES) {
    try { await env.MOSQUES.put(key, JSON.stringify(fresh), { expirationTtl: TTL_SECONDS }); } catch { /* ignore */ }
  }
  return fresh;
}

export const onRequestGet = async (ctx: { request: Request; env: Env }): Promise<Response> => {
  const u = new URL(ctx.request.url);
  const lat = parseFloat(u.searchParams.get('lat') || '');
  const lng = parseFloat(u.searchParams.get('lng') || '');
  let r = parseFloat(u.searchParams.get('r') || '5000');
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ error: 'bad lat/lng' }, 400);
  }
  r = Math.min(Math.max(Number.isFinite(r) ? r : 5000, 100), MAX_RADIUS);

  // دائرے کا bounding box → کون سے خانے درکار ہیں
  const dLat = r / 111320;
  const dLng = r / (111320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const ix0 = Math.floor((lng - dLng) / TILE), ix1 = Math.floor((lng + dLng) / TILE);
  const iy0 = Math.floor((lat - dLat) / TILE), iy1 = Math.floor((lat + dLat) / TILE);
  const tiles: [number, number][] = [];
  for (let ix = ix0; ix <= ix1; ix++) for (let iy = iy0; iy <= iy1; iy++) tiles.push([ix, iy]);
  if (tiles.length > MAX_TILES) return json({ error: 'area too large' }, 400);

  try {
    const lists = await Promise.all(tiles.map(([ix, iy]) => getTile(ctx.env, ix, iy)));
    const inCircle = lists.flat().filter((m) => distM(lat, lng, m.lat, m.lon) <= r);
    // browser اور Cloudflare edge پر بھی ایک گھنٹہ cache
    return json(inCircle, 200, 'public, max-age=3600');
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
};
