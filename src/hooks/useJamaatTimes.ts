import { useEffect, useState } from 'react';
import { Mosque } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// useJamaatTimes — ہر مسجد کا جماعت وقت = (آج کا Aladhan وقت) + (امام کا offset)
//
// اصول:
//   • Firestore میں صرف امام کا offset (±منٹ) محفوظ ہوتا ہے
//   • حتمی وقت ہر روز یہاں حساب ہوتا ہے، اس لیے کبھی پرانا نہیں ہوتا
//   • App.tsx کا پاپ اپ اور MosqueFinderView کا کارڈ دونوں یہی استعمال کریں،
//     تاکہ دونوں جگہ ایک ہی وقت دکھے
// ═══════════════════════════════════════════════════════════════════════════

export type PrayerKey = 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha';
export type ApiTimes = Record<PrayerKey, string>;

export const PRAYER_KEYS: PrayerKey[] = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];

// ImamDashboard کے وہی ڈیفالٹ جو نیا امام دیکھتا ہے
const DEFAULT_OFFSETS: Record<PrayerKey, number> = {
  fajr: 15,
  zuhr: 15,
  asr: 15,
  maghrib: 5,
  isha: 15,
};

const CACHE_PREFIX = 'jamaat_api_';

// ── وقت کے ہیلپرز ────────────────────────────────────────────────────────────
const toMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const toHHMM = (mins: number): string => {
  const total = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

// مسجد کے coordinates کو گول کریں (تقریباً 1 کلومیٹر) تاکہ پاس والی مساجد ایک ہی
// API جواب شیئر کر لیں اور Aladhan پر کم بوجھ پڑے
const coordKey = (lat: number, lng: number): string =>
  `${lat.toFixed(2)}_${lng.toFixed(2)}`;

// ── کیش (localStorage، دن کے حساب سے) ──────────────────────────────────────
const readCache = (key: string): ApiTimes | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.day !== todayKey()) return null;
    return parsed.times as ApiTimes;
  } catch {
    return null;
  }
};

// آف لائن ہو تو کل کا آخری وقت بھی چلے گا — اس کی تاریخ نہیں دیکھتے
const readAnyCache = (key: string): ApiTimes | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return (JSON.parse(raw)?.times as ApiTimes) ?? null;
  } catch {
    return null;
  }
};

const writeCache = (key: string, times: ApiTimes) => {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ day: todayKey(), times })
    );
    // پرانے دنوں کی entries صاف کریں، مگر آج والی اور آخری محفوظ رہنے دیں
    const today = todayKey();
    Object.keys(localStorage).forEach((k) => {
      if (!k.startsWith(CACHE_PREFIX) || k === CACHE_PREFIX + key) return;
      try {
        const v = JSON.parse(localStorage.getItem(k) || '{}');
        if (v?.day && v.day !== today) localStorage.removeItem(k);
      } catch {
        localStorage.removeItem(k);
      }
    });
  } catch {
    /* سٹوریج بھری ہو تو نظر انداز */
  }
};

// ── ایک ہی وقت میں ایک ہی coords کی دوہری درخواست نہ ہو ─────────────────────
const inflight = new Map<string, Promise<ApiTimes | null>>();

const fetchFromAladhan = async (lat: number, lng: number): Promise<ApiTimes | null> => {
  const d = new Date();
  const dateStr = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  // method=1 اور school=1: کراچی + حنفی (وہی جو ImamDashboard استعمال کرتا ہے)
  const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=1&school=1`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.code !== 200) return null;
    const t = data.data.timings;
    return {
      fajr: String(t.Fajr).split(' ')[0],
      zuhr: String(t.Dhuhr).split(' ')[0],
      asr: String(t.Asr).split(' ')[0],
      maghrib: String(t.Maghrib).split(' ')[0],
      isha: String(t.Isha).split(' ')[0],
    };
  } catch {
    return null;
  }
};

export const getApiTimes = async (lat: number, lng: number): Promise<ApiTimes | null> => {
  const key = coordKey(lat, lng);

  const fresh = readCache(key);
  if (fresh) return fresh;

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = fetchFromAladhan(lat, lng)
    .then((times) => {
      if (times) {
        writeCache(key, times);
        return times;
      }
      // API ناکام (آف لائن وغیرہ): آخری معلوم وقت دے دیں
      return readAnyCache(key);
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
};

// ── امام کا offset: ہمیشہ عدد لوٹاتا ہے ─────────────────────────────────────
// undefined ہو تو ڈیفالٹ لگتا ہے (نئی مسجد کے لیے وہی جو امام ڈیش بورڈ دکھاتا ہے)
export const getOffset = (mosque: Mosque, prayer: PrayerKey): number => {
  const v = (mosque as any)[`${prayer}Offset`];
  return typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_OFFSETS[prayer];
};

// ── اصل حساب ────────────────────────────────────────────────────────────────
// API وقت آ گیا ہو تو: API + offset
// API نہ آئی ہو (پہلی بار آف لائن) تو: Firestore میں جو پرانا وقت پڑا ہے وہ (آخری سہارا)
export const computeJamaatTime = (
  mosque: Mosque,
  prayer: PrayerKey,
  apiTimes: ApiTimes | null
): string => {
  if (apiTimes?.[prayer]) {
    return toHHMM(toMinutes(apiTimes[prayer]) + getOffset(mosque, prayer));
  }
  return (mosque as any)[prayer] || '';
};

// ═══════════════════════════════════════════════════════════════════════════
// Hook: ایک مسجد کے لیے
// ═══════════════════════════════════════════════════════════════════════════
export const useJamaatTimes = (mosque: Mosque | null) => {
  const lat = mosque?.latitude;
  const lng = mosque?.longitude;

  const [apiTimes, setApiTimes] = useState<ApiTimes | null>(() =>
    typeof lat === 'number' && typeof lng === 'number'
      ? readCache(coordKey(lat, lng))
      : null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      setApiTimes(null);
      return;
    }

    let cancelled = false;
    const cached = readCache(coordKey(lat, lng));
    if (cached) {
      setApiTimes(cached);
    } else {
      setLoading(true);
      // جب تک نیا نہ آئے، آخری معلوم وقت دکھاتے رہیں (خالی کارڈ سے بہتر)
      setApiTimes(readAnyCache(coordKey(lat, lng)));
    }

    getApiTimes(lat, lng).then((times) => {
      if (cancelled) return;
      if (times) setApiTimes(times);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  const get = (prayer: PrayerKey): string =>
    mosque ? computeJamaatTime(mosque, prayer, apiTimes) : '';

  return { apiTimes, loading, get };
};

// ═══════════════════════════════════════════════════════════════════════════
// Hook: مساجد کی فہرست کے لیے (MosqueFinderView)
// ═══════════════════════════════════════════════════════════════════════════
export const useJamaatTimesForMany = (mosques: Mosque[]) => {
  const [byMosque, setByMosque] = useState<Record<string, ApiTimes | null>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  // فہرست کی شناخت: صرف id + coords بدلیں تو دوبارہ چلے
  const signature = mosques
    .map((m) => `${m.id}:${m.latitude}:${m.longitude}`)
    .join('|');

  useEffect(() => {
    let cancelled = false;

    // پہلے کیش سے فوراً بھر دیں تاکہ کارڈ خالی نہ دکھیں
    const initial: Record<string, ApiTimes | null> = {};
    const needFetch: Mosque[] = [];
    for (const m of mosques) {
      if (typeof m.latitude !== 'number' || typeof m.longitude !== 'number') continue;
      const key = coordKey(m.latitude, m.longitude);
      const fresh = readCache(key);
      initial[m.id] = fresh ?? readAnyCache(key);
      if (!fresh) needFetch.push(m);
    }
    setByMosque((prev) => ({ ...prev, ...initial }));

    if (needFetch.length === 0) return;

    setLoadingIds(new Set(needFetch.map((m) => m.id)));

    needFetch.forEach((m) => {
      getApiTimes(m.latitude, m.longitude).then((times) => {
        if (cancelled) return;
        if (times) setByMosque((prev) => ({ ...prev, [m.id]: times }));
        setLoadingIds((prev) => {
          const s = new Set(prev);
          s.delete(m.id);
          return s;
        });
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const get = (mosque: Mosque, prayer: PrayerKey): string =>
    computeJamaatTime(mosque, prayer, byMosque[mosque.id] ?? null);

  return { get, loadingIds };
};
