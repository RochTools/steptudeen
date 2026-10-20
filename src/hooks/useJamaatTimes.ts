import { useEffect, useMemo, useState } from 'react';
import type { Mosque } from '../types';
import { IqamaSchedule, pickSchedule } from '../lib/iqama';
import { getAdhanDay, localAdhanDay, peekAdhanDay } from '../lib/aladhan';
import type { AdhanDay } from '../lib/aladhan';
import { buildJamaat, DEFAULT_FIXED, DEFAULT_OFFSETS as ADHAN_OFFSET_DEFAULTS, mosqueTimeZone } from '../lib/mosqueTimes';
import { addMinutes, dateKeyInZone, minutesToHHMM, parseHHMM } from '../lib/zonedTime';

// ═══════════════════════════════════════════════════════════════════════════
// useJamaatTimes — ہر مسجد کا جماعت وقت (سادہ نظام)
//
//   فجر، مغرب     = الاذان API (مسجد کے محفوظ کوآرڈینیٹس پر) + امام کا ± منٹ
//   ظہر، عصر، عشاء = مقررہ وقت جو امام نے لگایا (mosque.zuhr / asr / isha)
//
// • سب اوقات "HH:MM" میں، مسجد کے اپنے ٹائم زون کے مطابق — دیکھنے والا کسی بھی ملک میں ہو، وقت وہی دکھتا ہے۔
// • API نہ چلے تو اسی کوآرڈینیٹس پر مقامی حساب (کراچی طریقہ)؛ کوآرڈینیٹس ہی نہ ہوں تو مسجد میں محفوظ پرانا وقت۔
// • باہر کا API وہی ہے (get, loading, apiTimes, useJamaatTimesForMany, mosqueJumuah…)
//   تاکہ App.tsx اور MosqueFinderView میں کوئی تبدیلی نہ لگے۔
// ═══════════════════════════════════════════════════════════════════════════

export type PrayerKey = 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha';
export type ApiTimes = Record<PrayerKey, string>;

export const PRAYER_KEYS: PrayerKey[] = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];

const FIXED_KEYS = ['zuhr', 'asr', 'isha'] as const;

// ── وقت کے ہیلپرز (پرانے نام، تاکہ دوسری فائلیں چلتی رہیں) ─────────────────
export const toMinutes = (t: string): number => parseHHMM(t) ?? 0;
export const toHHMM = (mins: number): string => minutesToHHMM(mins);

const validCoords = (m?: Pick<Mosque, 'latitude' | 'longitude'> | null): m is Pick<Mosque, 'latitude' | 'longitude'> =>
  !!m && Number.isFinite(m.latitude) && Number.isFinite(m.longitude)
  && Math.abs(m.latitude) <= 90 && Math.abs(m.longitude) <= 180;

// ── امام کے منٹ: صرف فجر اور مغرب کے ہوتے ہیں ───────────────────────────────
export const getOffset = (mosque: Mosque, prayer: PrayerKey): number => {
  if (prayer !== 'fajr' && prayer !== 'maghrib') return 0; // ظہر/عصر/عشاء مقررہ ہیں، offset نہیں
  const v = (mosque as any)[`${prayer}Offset`];
  return typeof v === 'number' && Number.isFinite(v) ? v : ADHAN_OFFSET_DEFAULTS[prayer];
};

/** @deprecated پرانا شیڈول فارمیٹ — نیا نظام اسے استعمال نہیں کرتا */
export const legacySchedule = (mosque: Mosque): IqamaSchedule => ({
  effectiveFrom: '1970-01-01',
  iqama: {
    fajr: { delay: getOffset(mosque, 'fajr') },
    maghrib: { delay: getOffset(mosque, 'maghrib') },
  },
});

// ── آج کی اذان: بہترین دستیاب فوری جواب (API کیش → مقامی حساب) ───────────────
const bestAdhanNow = (mosque: Mosque, now: Date): AdhanDay | null => {
  if (!validCoords(mosque)) return null;
  const tz = mosqueTimeZone(mosque);
  const opts = { now, timeZone: tz };
  return peekAdhanDay(mosque.latitude, mosque.longitude, opts) ?? localAdhanDay(mosque.latitude, mosque.longitude, opts);
};

/** مسجد کی سیٹنگ + اذان → پانچوں جماعتیں؛ اذان نہ ہو (کوآرڈینیٹس نہیں) تو null */
const jamaatFromAdhan = (mosque: Mosque, adhan: AdhanDay | null): Record<PrayerKey, string> | null => {
  if (!adhan) return null;
  return buildJamaat(mosque, adhan);
};

/** فی مسجد، آج کے جماعت اوقات (فوری، بغیر انتظار کے) */
export const mosqueDayJamaat = (mosque: Mosque, now: Date = new Date()): Record<PrayerKey, string> | null => {
  try {
    return jamaatFromAdhan(mosque, bestAdhanNow(mosque, now));
  } catch {
    return null;
  }
};

// ── پرانے نام: ایپ کی دوسری فائلیں انہیں import کر رہی ہو سکتی ہیں ───────────
/**
 * @deprecated اب صرف فجر اور مغرب کی اذان API سے آتی ہے۔ باقی تین خانے خالی ہیں۔
 * نیا کوڈ `getAdhanDay` (lib/aladhan) استعمال کرے۔
 */
export const getApiTimes = async (lat: number, lng: number): Promise<ApiTimes | null> => {
  try {
    const d = await getAdhanDay(lat, lng);
    return { fajr: d.fajr, zuhr: '', asr: '', maghrib: d.maghrib, isha: '' };
  } catch {
    return null;
  }
};

/** ایک نماز کا جماعت وقت: apiTimes (اذان) ہو تو اس سے، ورنہ مسجد میں محفوظ وقت */
export const computeJamaatTime = (
  mosque: Mosque,
  prayer: PrayerKey,
  apiTimes: ApiTimes | null
): string => {
  if (prayer === 'fajr' || prayer === 'maghrib') {
    const adhan = apiTimes?.[prayer];
    return (adhan && addMinutes(adhan, getOffset(mosque, prayer))) || (mosque as any)[prayer] || '';
  }
  const mins = parseHHMM((mosque as any)[prayer]);
  return mins === null ? DEFAULT_FIXED[prayer as (typeof FIXED_KEYS)[number]] : minutesToHHMM(mins);
};

// ═══════════════════════════════════════════════════════════════════════════
// Hook: ایک مسجد کے لیے
// ═══════════════════════════════════════════════════════════════════════════
function useTimeRefresh() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export const useJamaatTimes = (mosque: Mosque | null) => {
  const now = useTimeRefresh();
  const lat = mosque?.latitude;
  const lng = mosque?.longitude;
  const tz = mosque ? mosqueTimeZone(mosque) : 'Asia/Karachi';
  const dateKey = dateKeyInZone(now, tz);  // مسجد کی تاریخ بدلے تو اوقات دوبارہ آئیں

  const [adhan, setAdhan] = useState<AdhanDay | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mosque || !validCoords(mosque)) {
      setAdhan(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const opts = { now: new Date(), timeZone: tz };
    const cached = peekAdhanDay(mosque.latitude, mosque.longitude, opts);
    if (cached) {
      setAdhan(cached);
    } else {
      setLoading(true);
      setAdhan(localAdhanDay(mosque.latitude, mosque.longitude, opts)); // API آنے تک مقامی حساب
    }
    getAdhanDay(mosque.latitude, mosque.longitude, opts)
      .then((day) => { if (!cancelled) setAdhan(day); })
      .catch(() => { /* مقامی حساب پہلے ہی دکھ رہا ہے */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, tz, dateKey]);

  const jamaat = useMemo(
    () => (mosque ? jamaatFromAdhan(mosque, adhan ?? bestAdhanNow(mosque, now)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mosque?.fajrOffset, mosque?.maghribOffset, mosque?.zuhr, mosque?.asr, mosque?.isha, adhan, lat, lng, dateKey]
  );

  const get = (prayer: PrayerKey): string =>
    jamaat?.[prayer] || (mosque ? computeJamaatTime(mosque, prayer, null) : '');

  // apiTimes: فجر/مغرب کی اذان؛ باقی نمازوں کی اذان اب نہیں نکالی جاتی (خالی)
  const apiTimes: ApiTimes | null = adhan
    ? { fajr: adhan.fajr, zuhr: '', asr: '', maghrib: adhan.maghrib, isha: '' }
    : null;

  return { apiTimes, loading, get };
};

// ═══════════════════════════════════════════════════════════════════════════
// Hook: مساجد کی فہرست کے لیے (MosqueFinderView)
// ═══════════════════════════════════════════════════════════════════════════
export const useJamaatTimesForMany = (mosques: Mosque[]) => {
  const now = useTimeRefresh();
  const [byMosque, setByMosque] = useState<Record<string, AdhanDay>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  // فہرست کی شناخت: id + کوآرڈینیٹس + ٹائم زون + مسجد کی تاریخ (آدھی رات پر نیا دن)
  const signature = mosques
    .map((m) => JSON.stringify([m.id, m.latitude, m.longitude, mosqueTimeZone(m), dateKeyInZone(now, mosqueTimeZone(m))]))
    .join('|');

  useEffect(() => {
    let cancelled = false;
    const needFetch: Mosque[] = [];
    const initial: Record<string, AdhanDay> = {};

    for (const m of mosques) {
      if (!validCoords(m)) continue;
      const cached = peekAdhanDay(m.latitude, m.longitude, { now: new Date(), timeZone: mosqueTimeZone(m) });
      if (cached) initial[m.id] = cached;
      else needFetch.push(m);
    }
    setByMosque((prev) => ({ ...prev, ...initial }));

    if (needFetch.length === 0) {
      setLoadingIds(new Set());
      return;
    }
    setLoadingIds(new Set(needFetch.map((m) => m.id)));

    needFetch.forEach((m) => {
      getAdhanDay(m.latitude, m.longitude, { now: new Date(), timeZone: mosqueTimeZone(m) })
        .then((day) => { if (!cancelled) setByMosque((prev) => ({ ...prev, [m.id]: day })); })
        .catch(() => { /* مقامی حساب get() میں خود لگ جاتا ہے */ })
        .finally(() => {
          if (cancelled) return;
          setLoadingIds((prev) => {
            const s = new Set(prev);
            s.delete(m.id);
            return s;
          });
        });
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const get = (mosque: Mosque, prayer: PrayerKey): string => {
    const adhan = byMosque[mosque.id] ?? bestAdhanNow(mosque, now);
    const jamaat = jamaatFromAdhan(mosque, adhan);
    return jamaat?.[prayer] || computeJamaatTime(mosque, prayer, null);
  };

  return { get, loadingIds };
};

// ═══════════════════════════════════════════════════════════════════════════
// اضافی مددگار (ہوم کارڈ / جمعہ کے لیے)
// ═══════════════════════════════════════════════════════════════════════════
/** مسجد کے جمعہ کے سلاٹ (نئے `jumuah` یا پرانے `jumah/jumah2`) */
export const mosqueJumuah = (mosque: Mosque): { label: string; time: string }[] => {
  const dateKey = dateKeyInZone(new Date(), mosqueTimeZone(mosque));
  const schedules: IqamaSchedule[] = [
    ...(mosque.iqamaHistory ?? []),
    ...(mosque.iqamaSchedule ? [mosque.iqamaSchedule] : []),
  ];
  const schedule = pickSchedule(schedules, dateKey);
  if (schedule?.jumuah?.length) return schedule.jumuah;
  const list: { label: string; time: string }[] = [];
  if (mosque.jumah) list.push({ label: 'جمعہ', time: mosque.jumah });
  if ((mosque as any).jumah2) list.push({ label: 'دوسری جمعہ', time: (mosque as any).jumah2 });
  return list;
};

/** رمضان کا خصوصی وقت (افطار/تراویح) اگر سیٹ ہو */
export const mosqueRamadanInfo = (mosque: Mosque) => {
  const dateKey = dateKeyInZone(new Date(), mosqueTimeZone(mosque));
  const schedules: IqamaSchedule[] = [
    ...(mosque.iqamaHistory ?? []),
    ...(mosque.iqamaSchedule ? [mosque.iqamaSchedule] : []),
  ];
  const schedule = pickSchedule(schedules, dateKey);
  return schedule?.ramadan ?? null;
};
