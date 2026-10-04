/**
 * prayerEngine.ts — اذان کے اوقات کا انجن (آف لائن، فی مسجد سیٹنگز کے ساتھ)
 *
 * کیوں: ایپ ابھی AlAdhan API (`method=1`) سے اوقات لاتی ہے۔ وہ ٹھیک ہے مگر:
 *   1) انٹرنیٹ جائے تو اوقات نہیں آتے (صرف پرانا cache)
 *   2) ہر مسجد کا طریقہ/مشرب ایک جیسا فرض کر لیا جاتا ہے
 *   3) امام پینل `school=1` (حنفی) اور یوزر ایپ default (شافعی) — آپس میں ایک گھنٹے کا فرق!
 *
 * یہ انجن adhan-js (MIT) سے حساب کرتا ہے، فی مسجد `PrayerConfig` لگاتا ہے،
 * اور پھر ہر نماز پر ±منٹ کا آفسیٹ (imam کی کیلیبریشن) لگاتا ہے۔
 *
 * استعمال:
 *   const times = computeDay(31.5204, 74.3587, new Date(), mosque.prayerConfig);
 *   // -> { fajr: '05:12', sunrise: '06:41', zuhr: '12:24', asr: '16:05', maghrib: '19:05', isha: '20:31' }
 */
import * as adhan from 'adhan';

// ── اقسام ──────────────────────────────────────────────────────────────────
export type PrayerKey = 'fajr' | 'sunrise' | 'zuhr' | 'asr' | 'maghrib' | 'isha';

/** جماعت کے اوقات والی نمازیں (sunrise شامل نہیں) */
export const PRAYER_NAMES = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerName = (typeof PRAYER_NAMES)[number];

export const ALL_PRAYER_KEYS: PrayerKey[] = ['fajr', 'sunrise', 'zuhr', 'asr', 'maghrib', 'isha'];

export const PRAYER_LABELS_UR: Record<PrayerKey, string> = {
  fajr: 'فجر',
  sunrise: 'طلوعِ آفتاب',
  zuhr: 'ظہر',
  asr: 'عصر',
  maghrib: 'مغرب',
  isha: 'عشاء',
};

export type MethodKey = keyof typeof adhan.CalculationMethod;
export type MadhabKey = 'shafi' | 'hanafi';
export type HighLatKey = 'MiddleOfTheNight' | 'SeventhOfTheNight' | 'TwilightAngle';

/** فی مسجد اذان کی سیٹنگ — یہی چیز فائر بیس میں `mosque.prayerConfig` بن کر جاتی ہے */
export interface PrayerConfig {
  /** حساب کا طریقہ (adhan-js)۔ پاکستان کے لیے 'Karachi' */
  method?: MethodKey;
  /** عصر کا مشرب */
  madhab?: MadhabKey;
  /** بلند عرض بلد کا قاعدہ (48°+ کے لیے) */
  highLatitudeRule?: HighLatKey;
  /** اختیاری: فجر کا زاویہ (عام 18، کچھ مساجد 19/20 استعمال کرتی ہیں) */
  fajrAngle?: number;
  /** اختیاری: عشاء کا زاویہ */
  ishaAngle?: number;
  /** اختیاری: عشاء زاویے کی جگہ منٹ (مثلاً ام القری 90 منٹ) */
  ishaInterval?: number;
  /** فی نماز ±منٹ کی درستی (امام کی کیلیبریشن) — یہی «پلس/مائنس» والا لیور */
  offsets?: Partial<Record<PrayerKey, number>>;
  /** ٹائم زون (ڈیفالٹ: آلے کا مقامی)۔ کراچی: 'Asia/Karachi' */
  timeZone?: string;
}

export const DEFAULT_PRAYER_CONFIG: PrayerConfig = {
  method: 'Karachi',       // پاکستان: University of Islamic Sciences, Karachi (18°, 18°)
  madhab: 'hanafi',        // پاکستان: عصرِ حنفی
  highLatitudeRule: 'SeventhOfTheNight',
  offsets: {},
};

/** کراچی، لاہور، اسلام آباد جیسے شہروں کے لیے تیار پروفائل */
export const PRESET_CITIES: { label: string; lat: number; lng: number; tz: string; config: PrayerConfig }[] = [
  { label: 'کراچی', lat: 24.8607, lng: 67.0011, tz: 'Asia/Karachi', config: { method: 'Karachi', madhab: 'hanafi' } },
  { label: 'لاہور', lat: 31.5204, lng: 74.3587, tz: 'Asia/Karachi', config: { method: 'Karachi', madhab: 'hanafi' } },
  { label: 'اسلام آباد', lat: 33.6844, lng: 73.0479, tz: 'Asia/Karachi', config: { method: 'Karachi', madhab: 'hanafi' } },
  { label: 'پشاور', lat: 34.0151, lng: 71.5249, tz: 'Asia/Karachi', config: { method: 'Karachi', madhab: 'hanafi' } },
  { label: 'کوئٹہ', lat: 30.1798, lng: 66.975, tz: 'Asia/Karachi', config: { method: 'Karachi', madhab: 'hanafi' } },
  { label: 'مکہ مکرمہ', lat: 21.3891, lng: 39.8579, tz: 'Asia/Riyadh', config: { method: 'UmmAlQura', madhab: 'shafi' } },
  { label: 'مدینہ منورہ', lat: 24.5247, lng: 39.5692, tz: 'Asia/Riyadh', config: { method: 'UmmAlQura', madhab: 'shafi' } },
];

// ── اندرونی ہیلپرز ────────────────────────────────────────────────────────
export function buildParams(config: PrayerConfig = {}): adhan.CalculationParameters {
  const methodKey: MethodKey =
    config.method && (adhan.CalculationMethod as Record<string, unknown>)[config.method]
      ? config.method
      : 'Karachi';
  const params = (adhan.CalculationMethod[methodKey] as () => adhan.CalculationParameters)();
  params.method = methodKey;
  params.madhab = (config.madhab ?? 'hanafi') === 'hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
  if (config.highLatitudeRule && adhan.HighLatitudeRule[config.highLatitudeRule]) {
    params.highLatitudeRule = adhan.HighLatitudeRule[config.highLatitudeRule];
  }
  if (typeof config.fajrAngle === 'number') params.fajrAngle = config.fajrAngle;
  if (typeof config.ishaAngle === 'number') { params.ishaAngle = config.ishaAngle; params.ishaInterval = 0; }
  if (typeof config.ishaInterval === 'number' && config.ishaInterval > 0) {
    params.ishaInterval = config.ishaInterval;
    params.ishaAngle = 0;
  }
  return params;
}

/** Date → اس دن کے منٹ (مقامی/دیے گئے ٹائم زون میں) */
export function minutesOf(date: Date, timeZone?: string): number {
  if (!timeZone) return date.getHours() * 60 + date.getMinutes();
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false });
  const [h, m] = fmt.format(date).split(':').map(Number);
  return (h % 24) * 60 + m;
}

/** منٹ → "HH:MM" */
export function minutesToHHMM(total: number): string {
  const t = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** "HH:MM" → منٹ */
export function hhmmToMinutes(value: string): number {
  const [h, m] = (value || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

const adhanKeyOf: Record<PrayerKey, keyof adhan.PrayerTimes> = {
  fajr: 'fajr', sunrise: 'sunrise', zuhr: 'dhuhr', asr: 'asr', maghrib: 'maghrib', isha: 'isha',
};

// ── مرکزی فنکشن ───────────────────────────────────────────────────────────
/** ایک دن کے اذان کے اوقات (منٹوں میں، آفسیٹ سمیت) */
export function computeDayMinutes(
  latitude: number,
  longitude: number,
  date: Date,
  config: PrayerConfig = {}
): Record<PrayerKey, number> {
  const coords = new adhan.Coordinates(latitude, longitude);
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const pt = new adhan.PrayerTimes(coords, noon, buildParams(config));
  const out = {} as Record<PrayerKey, number>;
  for (const key of ALL_PRAYER_KEYS) {
    const raw = minutesOf(pt[adhanKeyOf[key]] as Date, config.timeZone);
    out[key] = raw + (config.offsets?.[key] ?? 0);
  }
  return out;
}

/** ایک دن کے اوقات بطور "HH:MM" */
export function computeDay(
  latitude: number,
  longitude: number,
  date: Date,
  config: PrayerConfig = {}
): Record<PrayerKey, string> {
  const mins = computeDayMinutes(latitude, longitude, date, config);
  return ALL_PRAYER_KEYS.reduce((acc, k) => {
    acc[k] = minutesToHHMM(mins[k]);
    return acc;
  }, {} as Record<PrayerKey, string>);
}

/** کئی دن (شیڈول/پیش نظارہ کے لیے) */
export function computeRange(
  latitude: number,
  longitude: number,
  from: Date,
  days: number,
  config: PrayerConfig = {}
): { date: string; times: Record<PrayerKey, string> }[] {
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    out.push({ date: toDateKey(d), times: computeDay(latitude, longitude, d, config) });
  }
  return out;
}

/** yyyy-mm-dd (مقامی تاریخ کے مطابق) */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** اگلی نماز + countdown (یوزر اسکرین کے لیے) */
export function nextPrayerInfo(
  times: Record<PrayerKey, string>,
  now: Date = new Date()
): { key: PrayerKey; at: string; minutesLeft: number } {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const order: PrayerKey[] = ['fajr', 'sunrise', 'zuhr', 'asr', 'maghrib', 'isha'];
  for (const key of order) {
    const t = hhmmToMinutes(times[key]);
    if (t > nowMins) return { key, at: times[key], minutesLeft: t - nowMins };
  }
  const fajr = hhmmToMinutes(times.fajr);
  return { key: 'fajr', at: times.fajr, minutesLeft: 1440 - nowMins + fajr };
}

/**
 * جانچ: دیے گئے نمونہ دنوں (mosque کے اصل اوقات) پر موجودہ config کتنا درست ہے۔
 * `samples`: { '2026-06-17': { fajr: '03:20', ... }, ... }
 */
export function accuracyReport(
  latitude: number,
  longitude: number,
  samples: Record<string, Partial<Record<PrayerKey, string>>>,
  config: PrayerConfig = {}
): { perPrayer: Record<PrayerKey, { mean: number; worst: number }>; overallWorst: number } {
  const acc: Record<string, number[]> = {};
  for (const [dateKey, expected] of Object.entries(samples)) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const times = computeDayMinutes(latitude, longitude, new Date(y, m - 1, d), config);
    for (const key of ALL_PRAYER_KEYS) {
      const exp = expected[key];
      if (!exp) continue;
      (acc[key] ||= []).push(times[key] - hhmmToMinutes(exp));
    }
  }
  const perPrayer = {} as Record<PrayerKey, { mean: number; worst: number }>;
  let overallWorst = 0;
  for (const key of ALL_PRAYER_KEYS) {
    const list = acc[key] || [];
    if (!list.length) continue;
    const mean = list.reduce((a, b) => a + b, 0) / list.length;
    const worst = Math.max(...list.map((x) => Math.abs(x - mean)));
    perPrayer[key] = { mean: Math.round(mean * 10) / 10, worst: Math.round(worst * 10) / 10 };
    overallWorst = Math.max(overallWorst, worst);
  }
  return { perPrayer, overallWorst: Math.round(overallWorst * 10) / 10 };
}
