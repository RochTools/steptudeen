/**
 * aladhan.ts — فجر اور مغرب کی اذان: الاذان (AlAdhan) API سے
 *
 * - طریقہ method=1 (University of Islamic Sciences, Karachi)، school=1 (حنفی)
 * - ٹائم زون API خود کوآرڈینیٹس سے نکالتی ہے (meta.timezone) — یہ مسجد کے مقام کا ہے، دیکھنے والے کا نہیں
 * - دن میں ایک ہی بار مانگتا ہے (localStorage میں رکھتا ہے)، ایک ہی وقت کی کئی مانگیں ایک بنتی ہیں
 * - انٹرنیٹ/API نہ چلے تو پرانے مقامی انجن (adhan-js، کراچی طریقہ) سے وہی حساب، تاکہ وقت خالی نہ رہے
 */
import { computeDay, DEFAULT_PRAYER_CONFIG } from './prayerEngine';
import { dateKeyInZone } from './zonedTime';

export interface AdhanDay {
  /** اذانِ فجر "HH:MM" (مسجد کے ٹائم زون میں) */
  fajr: string;
  /** اذانِ مغرب "HH:MM" (مسجد کے ٹائم زون میں) */
  maghrib: string;
  /** مسجد کے مقام کا ٹائم زون، مثلاً "Asia/Karachi" */
  timeZone: string;
  /** 'api' = الاذان سے، 'local' = انٹرنیٹ نہ ہونے پر مقامی حساب */
  source: 'api' | 'local';
}

const DEFAULT_TIME_ZONE = 'Asia/Karachi';
const REQUEST_TIMEOUT_MS = 8000;

const cleanTime = (v: unknown): string | null => {
  const m = typeof v === 'string' ? /^(\d{1,2}):(\d{2})/.exec(v.trim()) : null; // "05:12" یا پرانا "05:12 (PKT)"
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
};

const cacheKey = (lat: number, lng: number) => `aladhan:v1:${lat.toFixed(3)}:${lng.toFixed(3)}`;

function readCache(lat: number, lng: number, dateKey: string): AdhanDay | null {
  try {
    const raw = localStorage.getItem(cacheKey(lat, lng));
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (c?.dateKey === dateKey && cleanTime(c.fajr) && cleanTime(c.maghrib) && typeof c.timeZone === 'string') {
      return { fajr: c.fajr, maghrib: c.maghrib, timeZone: c.timeZone, source: 'api' };
    }
  } catch { /* اسٹوریج بند/خراب ہو تو نظرانداز */ }
  return null;
}

function writeCache(lat: number, lng: number, dateKey: string, day: AdhanDay) {
  try {
    localStorage.setItem(cacheKey(lat, lng), JSON.stringify({ dateKey, fajr: day.fajr, maghrib: day.maghrib, timeZone: day.timeZone }));
  } catch { /* اسٹوریج بھرا ہو تو بھی کام چلتا رہے */ }
}

async function fetchFromApi(lat: number, lng: number, dateKey: string, fallbackTz: string): Promise<AdhanDay> {
  const [y, m, d] = dateKey.split('-');
  // timezonestring جان بوجھ کر نہیں بھیجا: API مسجد کے کوآرڈینیٹس سے خود درست ٹائم زون نکالتی ہے
  const url = `https://api.aladhan.com/v1/timings/${d}-${m}-${y}?latitude=${lat}&longitude=${lng}&method=1&school=1`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Aladhan HTTP ${res.status}`);
    const json = await res.json();
    const fajr = cleanTime(json?.data?.timings?.Fajr);
    const maghrib = cleanTime(json?.data?.timings?.Maghrib);
    if (!fajr || !maghrib) throw new Error('Aladhan: unexpected response');
    const tz = json?.data?.meta?.timezone;
    return { fajr, maghrib, timeZone: typeof tz === 'string' && tz ? tz : fallbackTz, source: 'api' };
  } finally {
    clearTimeout(timer);
  }
}

function computeLocally(lat: number, lng: number, dateKey: string, timeZone: string): AdhanDay {
  const [y, m, d] = dateKey.split('-').map(Number);
  const t = computeDay(lat, lng, new Date(y, m - 1, d, 12), { ...DEFAULT_PRAYER_CONFIG, timeZone });
  return { fajr: t.fajr, maghrib: t.maghrib, timeZone, source: 'local' };
}

/** فوری (انتظار کے بغیر) جواب: آج کا کیش شدہ API وقت، نہ ہو تو null — رینڈر کے دوران استعمال کے لیے */
export function peekAdhanDay(
  latitude: number,
  longitude: number,
  opts: { now?: Date; timeZone?: string } = {}
): AdhanDay | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const dateKey = dateKeyInZone(opts.now ?? new Date(), opts.timeZone || DEFAULT_TIME_ZONE);
  return readCache(latitude, longitude, dateKey);
}

/** فوری مقامی حساب (کراچی طریقہ، حنفی) — API کے انتظار میں خالی کارڈ سے بہتر */
export function localAdhanDay(
  latitude: number,
  longitude: number,
  opts: { now?: Date; timeZone?: string } = {}
): AdhanDay {
  const tz = opts.timeZone || DEFAULT_TIME_ZONE;
  return computeLocally(latitude, longitude, dateKeyInZone(opts.now ?? new Date(), tz), tz);
}

const inflight = new Map<string, Promise<AdhanDay>>();

/**
 * آج (مسجد کی تاریخ کے مطابق) کی اذانِ فجر اور اذانِ مغرب۔
 * @param opts.timeZone اندازہ برائے تاریخ (ڈیفالٹ Asia/Karachi)؛ اصل ٹائم زون جواب میں API سے آتا ہے
 */
export async function getAdhanDay(
  latitude: number,
  longitude: number,
  opts: { now?: Date; timeZone?: string } = {}
): Promise<AdhanDay> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error('Invalid mosque coordinates');
  }
  const hintTz = opts.timeZone || DEFAULT_TIME_ZONE;
  const dateKey = dateKeyInZone(opts.now ?? new Date(), hintTz);

  const cached = readCache(latitude, longitude, dateKey);
  if (cached) return cached;

  const key = `${cacheKey(latitude, longitude)}|${dateKey}`;
  let pending = inflight.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const day = await fetchFromApi(latitude, longitude, dateKey, hintTz);
        writeCache(latitude, longitude, dateKey, day);
        return day;
      } catch {
        // مقامی حساب کیش نہیں کرتے، تاکہ اگلی بار API دوبارہ آزمائی جائے
        return computeLocally(latitude, longitude, dateKey, hintTz);
      }
    })().finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}
