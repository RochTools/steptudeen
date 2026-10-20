/**
 * mosqueTimes.ts — مسجد کی جماعت کے اوقات (سادہ نظام)
 *
 *   فجر، مغرب  = الاذان API کا وقت  +  امام کا ± منٹ (fajrOffset / maghribOffset، منفی بھی چلتا ہے)
 *   ظہر، عصر، عشاء = مقررہ وقت (mosque.zuhr / asr / isha) — امام ہاتھ نہ لگائے تو بالکل وہی رہتا ہے
 *
 * امام ڈیش بورڈ اور یوزر ایپ دونوں اسی فائل کا حساب استعمال کریں (buildJamaat ایک ہی جگہ ہے)۔
 */
import type { Mosque } from '../types';
import { computeDay, DEFAULT_PRAYER_CONFIG } from './prayerEngine';
import { getAdhanDay } from './aladhan';
import type { AdhanDay } from './aladhan';
import { addMinutes, dateKeyInZone, minutesToHHMM, parseHHMM } from './zonedTime';

export type OffsetPrayer = 'fajr' | 'maghrib';
export type FixedPrayer = 'zuhr' | 'asr' | 'isha';

/** نئی مسجد کے ڈیفالٹ: اذان کے بعد منٹ */
export const DEFAULT_OFFSETS: Record<OffsetPrayer, number> = { fajr: 15, maghrib: 5 };
/** نئی مسجد کے ڈیفالٹ مقررہ اوقات (24 گھنٹے) */
export const DEFAULT_FIXED: Record<FixedPrayer, string> = { zuhr: '13:30', asr: '16:30', isha: '20:30' };
export const DEFAULT_TIME_ZONE = 'Asia/Karachi';
/** امام کے ± منٹ کی حد */
export const OFFSET_MIN = -60;
export const OFFSET_MAX = 120;

export interface JamaatTimes { fajr: string; zuhr: string; asr: string; maghrib: string; isha: string }

export type MosqueTimingInput = Pick<
  Mosque,
  'latitude' | 'longitude' | 'prayerConfig' | 'fajrOffset' | 'maghribOffset' | 'zuhr' | 'asr' | 'isha'
>;

/** مسجد کا ٹائم زون (امام کے محفوظ کیے ہوئے سے، ورنہ پاکستان) */
export function mosqueTimeZone(mosque: Pick<Mosque, 'prayerConfig'>): string {
  return mosque.prayerConfig?.timeZone || DEFAULT_TIME_ZONE;
}

/** مسجد کے ٹائم زون کے مطابق آج کی تاریخ (dateKey) اور اس دن کی دوپہر کی Date */
export function mosqueDate(now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const dateKey = dateKeyInZone(now, timeZone);
  const [y, m, d] = dateKey.split('-').map(Number);
  return { dateKey, date: new Date(y, m - 1, d, 12) };
}

const finiteOr = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const timeOr = (v: string | null | undefined, fallback: string) => {
  const mins = parseHHMM(v);
  return mins === null ? fallback : minutesToHHMM(mins);
};

/** خالص حساب: اذان کے دو اوقات + امام کی سیٹنگ → پانچوں جماعتیں (سب "HH:MM"، مسجد کے ٹائم زون میں) */
export function buildJamaat(
  settings: {
    fajrOffset?: number | null;
    maghribOffset?: number | null;
    zuhr?: string | null;
    asr?: string | null;
    isha?: string | null;
  },
  adhan: Pick<AdhanDay, 'fajr' | 'maghrib'>
): JamaatTimes {
  return {
    fajr: addMinutes(adhan.fajr, finiteOr(settings.fajrOffset, DEFAULT_OFFSETS.fajr)) ?? adhan.fajr,
    zuhr: timeOr(settings.zuhr, DEFAULT_FIXED.zuhr),
    asr: timeOr(settings.asr, DEFAULT_FIXED.asr),
    maghrib: addMinutes(adhan.maghrib, finiteOr(settings.maghribOffset, DEFAULT_OFFSETS.maghrib)) ?? adhan.maghrib,
    isha: timeOr(settings.isha, DEFAULT_FIXED.isha),
  };
}

export interface MosqueTimes {
  dateKey: string;
  timeZone: string;
  adhan: AdhanDay;
  jamaat: JamaatTimes;
}

/** آج کے اوقات: الاذان API (نہ چلے تو مقامی حساب) + امام کی سیٹنگ */
export async function getMosqueTimes(mosque: MosqueTimingInput, now = new Date()): Promise<MosqueTimes> {
  const adhan = await getAdhanDay(mosque.latitude, mosque.longitude, { now, timeZone: mosqueTimeZone(mosque) });
  return {
    dateKey: dateKeyInZone(now, adhan.timeZone),
    timeZone: adhan.timeZone,
    adhan,
    jamaat: buildJamaat(mosque, adhan),
  };
}

/**
 * @deprecated پرانا بغیر انتظار (sync) راستہ — صرف اس لیے رکھا ہے کہ جو فائلیں اسے ابھی استعمال کرتی ہیں وہ ٹوٹیں نہیں۔
 * یہ انٹرنیٹ کے بغیر مقامی حساب (کراچی طریقہ) سے اذان نکالتا ہے۔ نیا کوڈ `getMosqueTimes` استعمال کرے۔
 */
export function calculateMosqueTimes(mosque: MosqueTimingInput, now = new Date()) {
  if (!Number.isFinite(mosque.latitude) || !Number.isFinite(mosque.longitude) || Math.abs(mosque.latitude) > 90 || Math.abs(mosque.longitude) > 180) {
    throw new Error('Invalid mosque coordinates');
  }
  const timeZone = mosqueTimeZone(mosque);
  const { dateKey, date } = mosqueDate(now, timeZone);
  const adhan = computeDay(mosque.latitude, mosque.longitude, date, { ...DEFAULT_PRAYER_CONFIG, timeZone });
  if (Object.values(adhan).some((value) => !/^\d{2}:\d{2}$/.test(value))) throw new Error('Prayer times could not be calculated');
  return { adhan, jamaat: buildJamaat(mosque, adhan), dateKey };
}
