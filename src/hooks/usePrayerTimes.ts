/**
 * usePrayerTimes.new.ts — یوزر ایپ کے لیے نیا اوقات ہُک (drop-in replacement)
 *
 * پرانی فائل: src/hooks/usePrayerTimes.ts  (AlAdhan API `method=1` + cache)
 * یہ فائل اُسی کی جگہ لگائیں — return API وہی رہتا ہے، اس لیے باقی ایپ نہیں ٹوٹے گی:
 *   { prayerTimes, currentPrayer, userCoords, todayDate, requestLocation }
 * اور ساتھ نیا کچھ:
 *   { iqama, jumuah, nextPrayer, prayerConfig, mosqueUsed, source, isRamadan }
 *
 * فرق:
 *   1) اوقات اب adhan-js سے، **مسجد کی سیٹنگ کے مطابق**، انٹرنیٹ کے بغیر حساب ہوتے ہیں
 *   2) مسجد نہ ہو تو AlAdhan API (پرانا طریقہ) بطور fallback — ایپ کبھی خالی نہیں رہتی
 *   3) آخری کامیاب اوقات `prayer_last_good` میں محفوظ — نیٹ ورک گیا تو بھی وقت چلتا رہے
 *   4) جماعت کا وقت شیڈول سے نکالا جاتا ہے (اذان + منٹ یا مقررہ گھڑی)
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getCurrentPrayer } from '../utils/timeHelpers';
import { fetchHijriDate, getHijriMath } from '../constants/hijri';
import {
  PrayerConfig, PrayerKey, computeDay, nextPrayerInfo, toDateKey, DEFAULT_PRAYER_CONFIG,
} from '../lib/prayerEngine';
import { IqamaSchedule, JumuahSlot, pickSchedule, resolveIqama } from '../lib/iqama';

const LAST_GOOD_KEY = 'prayer_last_good';
const DEFAULT_COORDS = { latitude: 31.5204, longitude: 74.3587 }; // لاہور (پرانا ڈیفالٹ)

/** کم از کم (کم سے کم) مسجد کی قسم — صرف وہ فیلڈز جو یہاں درکار ہیں */
export interface MosqueForTimes {
  id: string;
  name?: string;
  latitude: number;
  longitude: number;
  prayerConfig?: PrayerConfig;
  iqamaSchedule?: IqamaSchedule;
  iqamaHistory?: IqamaSchedule[];
  jumuah?: JumuahSlot[];
  jumah?: string;
  jumah2?: string;
  /** پرانے فیلڈ (ایک مقررہ وقفہ) — back-compat */
  fajrOffset?: number; zuhrOffset?: number; asrOffset?: number; maghribOffset?: number; ishaOffset?: number;
}

type Times = Record<PrayerKey, string>;

const readJSON = <T,>(key: string): T | null => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
};
const writeJSON = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

/** دو نقاط کے درمیان فاصلہ (کلومیٹر) */
const distanceKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** مسجد کا شیڈول نکالیں (نئی iqamaHistory + iqamaSchedule، یا پرانے offsets سے) */
const scheduleFor = (mosque: MosqueForTimes | null, dateKey: string): IqamaSchedule | null => {
  if (!mosque) return null;
  const all = [...(mosque.iqamaHistory ?? []), ...(mosque.iqamaSchedule ? [mosque.iqamaSchedule] : [])];
  const picked = pickSchedule(all, dateKey);
  if (picked) return picked;
  // پرانا انداز: offsets = جماعت کا وقفہ (min)
  const legacy: IqamaSchedule = {
    effectiveFrom: '2000-01-01',
    iqama: {
      fajr: { delay: mosque.fajrOffset ?? 15 },
      zuhr: { delay: mosque.zuhrOffset ?? 15 },
      asr: { delay: mosque.asrOffset ?? 15 },
      maghrib: { delay: mosque.maghribOffset ?? 5 },
      isha: { delay: mosque.ishaOffset ?? 15 },
    },
  };
  return legacy;
};

export interface UsePrayerTimesOptions {
  /** مساجد کی فہرست (App سے) — نیڑے ترین/محفوظ مسجد کا config لگے گا */
  mosques?: MosqueForTimes[];
  /** صارف کی محفوظ کی گئی مساجد */
  savedMosqueIds?: string[];
  /** اگر صارف نے خاص مسجد منتخب کی ہو تو وہی */
  selectedMosque?: MosqueForTimes | null;
  /** «اب کون سی نماز» iqama کے حساب سے گنیں (ڈیفالٹ: پرانا طریقہ) */
  preferIqamaForCurrent?: boolean;
}

export const usePrayerTimes = (options: UsePrayerTimesOptions = {}) => {
  const { mosques = [], savedMosqueIds = [], selectedMosque = null, preferIqamaForCurrent = false } = options;
  const isMounted = useRef(true);

  const [prayerTimes, setPrayerTimes] = useState<Times>(
    () => (readJSON<{ times: Times }>(LAST_GOOD_KEY)?.times) ?? { fajr: '05:15', sunrise: '06:40', zuhr: '13:30', asr: '16:30', maghrib: '19:05', isha: '20:45' }
  );
  const [currentPrayer, setCurrentPrayer] = useState<string>('zuhr');
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [todayDate, setTodayDate] = useState<string>('');
  const [source, setSource] = useState<'mqtt' | 'engine' | 'api' | 'cache'>('engine');
  const [mosqueUsed, setMosqueUsed] = useState<MosqueForTimes | null>(null);
  const [tick, setTick] = useState(0);

  // ہر منٹ بڑھیں (اگلی نماز/کاؤنٹ ڈاؤن تازہ رہے)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // ============ ہجری تاریخ ============
  useEffect(() => { fetchHijriDate().then((d) => setTodayDate(d)); }, []);

  const now = new Date();
  const dateKey = toDateKey(now);
  const isRamadan = useMemo(() => getHijriMath(now).hMonth === 9, [dateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============ نیٹ ورک والا پرانا راستہ (fallback) ============
  const fetchFromApi = useCallback(async (lat: number, lng: number) => {
    const d = new Date();
    const today = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
    const cacheKey = `prayer_cache_${today}_${Math.round(lat * 10)}_${Math.round(lng * 10)}`;
    const cached = readJSON<Times>(cacheKey);
    if (cached) return cached;
    try {
      const res = await fetch(`https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}&method=1`);
      const data = await res.json();
      if (data?.code === 200) {
        const t = data.data.timings;
        const times: Times = { fajr: t.Fajr, sunrise: t.Sunrise, zuhr: t.Dhuhr, asr: t.Asr, maghrib: t.Maghrib, isha: t.Isha };
        writeJSON(cacheKey, times);
        return times;
      }
    } catch { console.warn('Prayer API failed — cached/last-good استعمال ہو رہا ہے'); }
    return null;
  }, []);

  // ============ بنیادی حساب ============
  const recompute = useCallback(async (coords: { latitude: number; longitude: number } | null) => {
    const dk = toDateKey(new Date());

    // 1) مسجد منتخب کریں
    let mosque: MosqueForTimes | null = selectedMosque ?? null;
    if (!mosque && mosques.length) {
      const saved = mosques.filter((m) => savedMosqueIds.includes(m.id));
      const pool = saved.length ? saved : mosques;
      if (coords) {
        const sorted = [...pool].sort(
          (a, b) => distanceKm(coords.latitude, coords.longitude, a.latitude, a.longitude)
                 - distanceKm(coords.latitude, coords.longitude, b.latitude, b.longitude)
        );
        const nearest = sorted[0];
        const dist = distanceKm(coords.latitude, coords.longitude, nearest.latitude, nearest.longitude);
        mosque = dist <= 25 ? nearest : null;      // 25 کلومیٹر سے دور ہو تو user کے اپنے نقاط
      } else {
        mosque = pool[0] ?? null;
      }
    }
    if (isMounted.current) setMosqueUsed(mosque);

    // 2) اگر مسجد کے اپنی سیٹنگ ہے → آف لائن حساب
    const config: PrayerConfig | undefined = mosque?.prayerConfig;
    if (mosque && config && Object.keys(config).length) {
      const cfg: PrayerConfig = { ...DEFAULT_PRAYER_CONFIG, ...config };
      const lat = coords?.latitude ?? mosque.latitude;
      const lng = coords?.longitude ?? mosque.longitude;
      const times = computeDay(lat, lng, new Date(), cfg);
      if (isMounted.current) { setPrayerTimes(times); setSource('engine'); }
      writeJSON(LAST_GOOD_KEY, { times, mosqueId: mosque.id, dateKey: dk, config });
      return;
    }

    // 3) ورنہ API (پرانا راستہ)
    const c = coords ?? DEFAULT_COORDS;
    const apiTimes = await fetchFromApi(c.latitude, c.longitude);
    if (apiTimes && isMounted.current) {
      setPrayerTimes(apiTimes);
      setSource('api');
      writeJSON(LAST_GOOD_KEY, { times: apiTimes, mosqueId: null, dateKey: dk });
      return;
    }
    if (isMounted.current) setSource('cache');   // last-good ہی چلے
  }, [mosques, savedMosqueIds, selectedMosque, fetchFromApi]);

  // ============ مقام ============
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setUserCoords(null);
      recompute(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isMounted.current) return;
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserCoords(coords);
        recompute(coords);
      },
      (err) => {
        console.warn('Location denied:', err);
        if (isMounted.current) { setUserCoords(null); recompute(null); }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [recompute]);

  useEffect(() => {
    requestLocation();
    return () => { isMounted.current = false; };
  }, [requestLocation]);

  // mosques بدلیں/آن لائن ہوں تو دوبارہ حساب
  useEffect(() => {
    recompute(userCoords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosques.length, JSON.stringify(mosques.map((m) => [m.id, m.prayerConfig, m.iqamaSchedule, m.iqamaHistory?.length]))]);

  // ============ جماعت ============
  const schedule = useMemo(() => scheduleFor(mosqueUsed, dateKey), [mosqueUsed, dateKey]);
  const iqama = useMemo(
    () => resolveIqama(schedule, dateKey, prayerTimes, { isRamadan }),
    [schedule, dateKey, prayerTimes, isRamadan]
  );
  const jumuah: JumuahSlot[] = useMemo(
    () => schedule?.jumuah?.length
      ? schedule.jumuah
      : [...(mosqueUsed?.jumah ? [{ label: 'جمعہ', time: mosqueUsed.jumah }] : []),
         ...(mosqueUsed?.jumah2 ? [{ label: 'دوسری جمعہ', time: mosqueUsed.jumah2 }] : [])],
    [schedule, mosqueUsed]
  );

  // ============ اب کون سی نماز ============
  useEffect(() => {
    const compute = () =>
      setCurrentPrayer(
        preferIqamaForCurrent
          ? getCurrentPrayer(Object.fromEntries(Object.entries(iqama).filter(([, v]) => v)) as Record<string, string>)
          : getCurrentPrayer(prayerTimes)
      );
    compute();
    const interval = setInterval(compute, 30000);
    return () => clearInterval(interval);
  }, [prayerTimes, iqama, preferIqamaForCurrent]);

  const nextPrayer = useMemo(() => nextPrayerInfo(prayerTimes, new Date()), [prayerTimes, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // پرانا API (وہی)
    prayerTimes, currentPrayer, userCoords, todayDate, requestLocation,
    // نیا
    iqama, jumuah, nextPrayer, isRamadan,
    prayerConfig: mosqueUsed?.prayerConfig ?? null,
    mosqueUsed, source,
  };
};
