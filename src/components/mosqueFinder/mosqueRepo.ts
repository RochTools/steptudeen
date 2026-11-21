/* پاکستان کی مسجدیں ہمارے اپنے ڈیٹا ریپو (pakistan-mosques) سے — Overpass کی جگہ پہلی ترجیح۔
   ریپو میں tile فائلیں ہیں (data/tiles/<y>_<x>.json)؛ ایپ صرف اپنے آس پاس کی tile اٹھاتی ہے۔
   کچھ بھی ناکام ہو (ریپو نہ ملے، نیٹ ورک، پاکستان سے باہر، نتیجہ خالی) تو null واپس،
   اور api.ts پرانے طریقے (/api/mosques → Overpass) پر چلا جاتا ہے۔ */
import type { MosqueLite } from './types';

export const MOSQUE_REPO = 'RochTools/pakistan-mosques';
const REF = 'main';
const BASES = [
  `https://cdn.jsdelivr.net/gh/${MOSQUE_REPO}@${REF}/data/`,
  `https://raw.githubusercontent.com/${MOSQUE_REPO}/${REF}/data/`,
];

interface RepoIndex { size: number; tiles: string[]; bbox: [number, number, number, number] | null }
type TileRow = [number, number, string];

let indexPromise: Promise<RepoIndex | null> | null = null;
const tileCache = new Map<string, TileRow[]>();

async function getJson(path: string, timeoutMs = 12000): Promise<unknown | null> {
  for (const base of BASES) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(base + path, { signal: ctrl.signal });
      if (res.status === 404) return null;
      if (!res.ok) continue;
      return await res.json();
    } catch {
      /* اگلا mirror */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

function loadIndex(): Promise<RepoIndex | null> {
  if (!indexPromise) {
    indexPromise = (async () => {
      const j = (await getJson('index.json')) as RepoIndex | null;
      return j && typeof j.size === 'number' && Array.isArray(j.tiles) ? j : null;
    })();
    indexPromise.then(v => { if (!v) indexPromise = null; }); // ناکامی یاد نہ رکھو، اگلی بار پھر کوشش
  }
  return indexPromise;
}

function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function fetchMosquesFromRepo(lat: number, lng: number, radius: number): Promise<MosqueLite[] | null> {
  try {
    const index = await loadIndex();
    if (!index || !index.bbox) return null;
    const [s, w, n, e] = index.bbox;
    if (lat < s - 0.3 || lat > n + 0.3 || lng < w - 0.3 || lng > e + 0.3) return null; // پاکستان سے باہر

    const dLat = radius / 111320;
    const dLng = radius / (111320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    const y0 = Math.floor((lat - dLat) / index.size), y1 = Math.floor((lat + dLat) / index.size);
    const x0 = Math.floor((lng - dLng) / index.size), x1 = Math.floor((lng + dLng) / index.size);
    if ((y1 - y0 + 1) * (x1 - x0 + 1) > 36) return null; // بہت بڑا رقبہ — پرانا راستہ

    const have = new Set(index.tiles);
    const jobs: Promise<TileRow[]>[] = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const key = `${y}_${x}`;
        if (!have.has(key)) continue; // اس tile میں کوئی مسجد نہیں
        const cached = tileCache.get(key);
        if (cached) { jobs.push(Promise.resolve(cached)); continue; }
        jobs.push((async () => {
          const rows = (await getJson(`tiles/${key}.json`)) as TileRow[] | null;
          if (!Array.isArray(rows)) throw new Error('tile ' + key);
          tileCache.set(key, rows);
          return rows;
        })());
      }
    }
    const all = (await Promise.all(jobs)).flat();
    const out: MosqueLite[] = [];
    for (const [la, lo, name] of all) {
      if (distanceM(lat, lng, la, lo) <= radius) out.push({ name: name || 'Mosque', lat: la, lon: lo });
    }
    return out.length ? out : null; // خالی ہو تو Overpass سے بھی پوچھ لو
  } catch {
    return null;
  }
}
