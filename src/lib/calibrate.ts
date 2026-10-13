/**
 * calibrate.ts — «اپنی مسجد کے مطابق خودکار کیلیبریشن»
 *
 * امام چند دن کے اصل اوقات دیتا ہے → یہ فنکشن خود بہترین
 * (طریقہ + مشرب + Fajr/Isha کا زاویہ + فی نماز ±منٹ) نکال کر دیتا ہے۔
 *
 * تجربہ (27 اوپن ڈیٹا سیٹ):
 *   - Sunrise / Zuhr / Maghrib: ایک ہی آفسیٹ پورے سال ±0.5–1 منٹ تک ٹھیک بیٹھتا ہے
 *   - Fajr / Isha: صرف آفسیٹ سے کام نہیں چلتا، زاویہ بھی بدلنا پڑتا ہے (±6–7 منٹ)
 *   - Asr: مشرب (حنفی/شافعی) غلط ہو تو 29–75 منٹ کا فرق — اکیلے آفسیٹ سے نہیں بنتا
 *
 * اس ورژن میں نیا کیا ہے (پرانا API ویسا ہی چلتا ہے، رپورٹ میں صرف نئے خانے بڑھے ہیں):
 *   1) 12 گھنٹے کے اوقات ("5:09" عصر) خود 24 گھنٹے میں بدلتے ہیں
 *   2) فجر اور عشاء کا زاویہ اب ہر ایک اپنی غلطی پر الگ ٹیون ہوتا ہے
 *      (پہلے پوری سب سے بڑی غلطی دیکھی جاتی تھی، تو اکثر زاویہ بدلتا ہی نہیں تھا)
 *   3) کم ڈیٹا (ایک دن، یا ایک ہی موسم) پر طریقہ/زاویہ نہیں چھیڑتا، صرف ±منٹ نکالتا ہے
 *   4) بھروسے کا درجہ، انتباہات اور مشکوک اندراجات (ٹائپو) کی نشاندہی
 *   5) عرض بلد 48° سے کم ہو تو بلند عرض بلد کے قاعدے آزمانے کی ضرورت نہیں (3 گنا کم حساب)
 */
import * as adhan from 'adhan';
import {
  ALL_PRAYER_KEYS, PrayerConfig, PrayerKey, MethodKey, MadhabKey, HighLatKey,
  buildParams, minutesOf, hhmmToMinutes,
} from './prayerEngine';

/** نمونہ: { '2026-06-17': { fajr: '03:20', zuhr: '12:30', ... } } */
export type SampleDays = Record<string, Partial<Record<PrayerKey, string>>>;

export type Confidence = 'high' | 'medium' | 'low';

export interface SuspectEntry {
  date: string;
  prayer: PrayerKey;
  /** باقی دنوں کے رجحان سے کتنے منٹ ہٹ کر ہے */
  errorMinutes: number;
}

export interface CalibrationReport {
  config: PrayerConfig;
  method: MethodKey;
  madhab: MadhabKey;
  highLatitudeRule: HighLatKey;
  /** فی نماز: بہترین آفسیٹ + باقی غلطی */
  perPrayer: Partial<Record<PrayerKey, { offset: number; meanErr: number; worstErr: number }>>;
  /** تمام نمازوں میں سب سے بڑی باقی غلطی (منٹ) */
  overallWorst: number;
  /** اوسط غلطی (RMSE) تمام نمازوں کا */
  overallRmse: number;
  samples: number;
  comparedMethods: { method: MethodKey; madhab: MadhabKey; worst: number }[];
  /** نتیجے پر کتنا بھروسہ کیا جائے */
  confidence: Confidence;
  /** اردو انتباہات (امام کو دکھانے کے لیے) */
  warnings: string[];
  /** وہ اندراجات جو باقی دنوں سے بے میل لگتے ہیں (غالباً ٹائپو) */
  suspects: SuspectEntry[];
  /** کیا زاویے بھی ٹیون ہوئے؟ (false = صرف آفسیٹ) */
  anglesTuned: boolean;
  /** پہلے اور آخری نمونہ دن کے درمیان دن */
  spanDays: number;
}

/** پاکستان کی مساجد میں عام طور پر یہی طریقے چلتے ہیں — حساب ہلکا اور اوور فٹنگ کم */
export const PAKISTAN_METHODS: MethodKey[] = [
  'Karachi', 'MuslimWorldLeague', 'Egyptian', 'MoonsightingCommittee',
];

const adhanKeyOf: Record<PrayerKey, keyof adhan.PrayerTimes> = {
  fajr: 'fajr', sunrise: 'sunrise', zuhr: 'dhuhr', asr: 'asr', maghrib: 'maghrib', isha: 'isha',
};

const HIGH_LAT_CANDIDATES: HighLatKey[] = ['SeventhOfTheNight', 'MiddleOfTheNight', 'TwilightAngle'];

/** اتنے دن کا فرق ہو تو ہی زاویہ ٹیون کرنا بامعنی ہے (فجر/عشاء موسم کے ساتھ بدلتے ہیں) */
const MIN_SPAN_FOR_ANGLES = 60;

// ── وقت کی صفائی ──────────────────────────────────────────────────────────
/**
 * مساجد کے کیلنڈر اکثر 12 گھنٹے والے ہوتے ہیں اور AM/PM نہیں لکھتے:
 * ظہر "1:15"، عصر "5:09"، مغرب "7:30"، عشاء "8:55"۔ انہیں 24 گھنٹے میں بدلتا ہے۔
 * پہلے سے 24 گھنٹے والی قدر (13 یا اس سے اوپر) ویسی ہی رہتی ہے۔
 */
export function to24h(key: PrayerKey, value: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec((value ?? '').trim());
  if (!m) return value;
  let h = Number(m[1]);
  const min = m[2];
  if (key === 'zuhr' && h === 0) h = 12;           // "12:24 AM" غلطی سے منتخب ہو جائے تو بھی ظہر دوپہر ہی ہے
  else if (key === 'zuhr' && h >= 1 && h <= 6) h += 12;
  else if ((key === 'asr' || key === 'maghrib' || key === 'isha') && h >= 1 && h <= 11) h += 12;
  return `${String(h).padStart(2, '0')}:${min}`;
}

const isValidHHMM = (v: unknown): v is string => {
  if (typeof v !== 'string') return false;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  return !!m && Number(m[1]) <= 23 && Number(m[2]) <= 59;
};

function cleanSamples(samples: SampleDays): SampleDays {
  const out: SampleDays = {};
  for (const [date, v] of Object.entries(samples)) {
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(date)) continue;
    const entry: Partial<Record<PrayerKey, string>> = {};
    for (const key of ALL_PRAYER_KEYS) {
      const val = v[key];
      if (isValidHHMM(val)) entry[key] = to24h(key, val.trim());
    }
    if (Object.keys(entry).length) out[date] = entry;
  }
  return out;
}

// ── پیسٹ شدہ ٹیبل پڑھنا ──────────────────────────────────────────────────
export type PastedRow = { date: string; fajr: string; sunrise: string; zuhr: string; asr: string; maghrib: string; isha: string };

/**
 * سالانہ ٹیبل سے پیسٹ کی گئی سطریں پڑھیں:
 *  2026-06-21, 04:20, 05:44, 12:37, 17:09, 19:30, 20:55          (6 اوقات: فجر، طلوع، ظہر، عصر، مغرب، عشاء)
 *  21-06-2026  4:20 12:37 5:09 7:30 8:55                         (5 اوقات: طلوع کے بغیر؛ 12 گھنٹے بھی چلے گا)
 */
export function parsePastedTable(text: string): PastedRow[] {
  const out: PastedRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = line.split(/[,\t;|]+|\s+/).map((c) => c.trim()).filter(Boolean);
    if (cells.length < 6) continue;

    let date = '';
    const iso = cells.find((c) => /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(c));
    const dmy = cells.find((c) => /^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(c));
    if (iso) {
      const [y, m, d] = iso.split(/[-/]/).map(Number);
      date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    } else if (dmy) {
      const [d, m, y] = dmy.split(/[-/]/).map(Number);
      date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    if (!date) continue;

    const times = cells.filter(isValidHHMM);
    if (times.length < 5) continue;
    // 5 اوقات = طلوع کے بغیر (پہلے یہ حالت طلوع کی جگہ ظہر ڈال دیتی تھی)
    const keys: PrayerKey[] =
      times.length === 5 ? ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] : ['fajr', 'sunrise', 'zuhr', 'asr', 'maghrib', 'isha'];
    const row: PastedRow = { date, fajr: '', sunrise: '', zuhr: '', asr: '', maghrib: '', isha: '' };
    keys.forEach((k, i) => { row[k] = to24h(k, times[i]); });
    out.push(row);
  }
  return out;
}

// ── اندرونی حساب ──────────────────────────────────────────────────────────
/** فرق کو (-12گھنٹے، +12گھنٹے) میں رکھیں تاکہ آدھی رات پار کرنے والا وقت 1440 منٹ کا فرق نہ بنے */
const wrapDiff = (x: number) => ((((x + 720) % 1440) + 1440) % 1440) - 720;

type Diff = { date: string; d: number };

/** ایک config کے تحت، نمونہ دنوں کا فرق (حساب − مسجد) فی نماز */
function sampleDiffs(
  latitude: number,
  longitude: number,
  samples: SampleDays,
  config: PrayerConfig
): Partial<Record<PrayerKey, Diff[]>> {
  const coords = new adhan.Coordinates(latitude, longitude);
  const params = buildParams(config);
  const out: Partial<Record<PrayerKey, Diff[]>> = {};
  for (const [dateKey, expected] of Object.entries(samples)) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const noon = new Date(y, m - 1, d, 12, 0, 0);
    const pt = new adhan.PrayerTimes(coords, noon, params);
    for (const key of ALL_PRAYER_KEYS) {
      const exp = expected[key];
      if (!exp) continue;
      const computed = minutesOf(pt[adhanKeyOf[key]] as Date, config.timeZone);
      (out[key] ||= []).push({ date: dateKey, d: wrapDiff(computed - hhmmToMinutes(exp)) });
    }
  }
  return out;
}

/** ایسا آفسیٹ جو سب سے بڑی غلطی کو کم سے کم کرے (min-max fit) */
function bestOffset(diffs: number[], maxAbs = 90, step = 1) {
  let best = { offset: 0, meanErr: 0, worstErr: Infinity };
  for (let off = -maxAbs; off <= maxAbs; off += step) {
    let worst = 0, sum = 0, n = 0;
    for (const d of diffs) {
      // اذان کا آفسیٹ: ہم computed پر +off لگاتے ہیں → باقی غلطی = d + off
      const e = Math.abs(d + off);
      if (e > worst) worst = e;
      sum += e; n++;
    }
    if (worst < best.worstErr - 1e-9) best = { offset: off, meanErr: sum / Math.max(n, 1), worstErr: worst };
  }
  return {
    offset: best.offset,
    meanErr: Math.round(best.meanErr * 10) / 10,
    worstErr: Math.round(best.worstErr * 10) / 10,
  };
}

function evaluate(latitude: number, longitude: number, samples: SampleDays, config: PrayerConfig) {
  const diffs = sampleDiffs(latitude, longitude, samples, config);
  const perPrayer: CalibrationReport['perPrayer'] = {};
  const offsets: Partial<Record<PrayerKey, number>> = {};
  let worst = 0, se = 0, n = 0;
  for (const key of ALL_PRAYER_KEYS) {
    const list = diffs[key];
    if (!list?.length) continue;
    const fit = bestOffset(list.map((x) => x.d));
    perPrayer[key] = fit;
    offsets[key] = fit.offset;
    worst = Math.max(worst, fit.worstErr);
    se += fit.meanErr * fit.meanErr; n++;
  }
  return { perPrayer, offsets, worst, rmse: n ? Math.sqrt(se / n) : 0 };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const dayNumber = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

/**
 * موجودہ config (اپنے آفسیٹ سمیت) کی غلطی: نمونہ دنوں پر سب سے بڑا فرق، منٹوں میں۔
 * کیلیبریشن سے «پہلے» کی حالت دکھانے کے لیے۔ (دوبارہ فٹ نہیں کرتا۔)
 */
export function configError(
  latitude: number,
  longitude: number,
  samples: SampleDays,
  config: PrayerConfig
): number | null {
  const clean = cleanSamples(samples);
  if (!Object.keys(clean).length) return null;
  const diffs = sampleDiffs(latitude, longitude, clean, config);
  let worst = 0;
  for (const key of ALL_PRAYER_KEYS) {
    for (const x of diffs[key] ?? []) worst = Math.max(worst, Math.abs(x.d + (config.offsets?.[key] ?? 0)));
  }
  return Math.round(worst * 10) / 10;
}

/** اگلے نمونہ دن کی تجویز: سال کے چار موسمی نقطوں (21 مارچ/جون/ستمبر/دسمبر) میں سے جو ابھی خالی ہوں */
export function suggestSampleDates(existing: string[], today: Date = new Date()): string[] {
  const have = existing.filter((d) => /^\d{4}-\d{1,2}-\d{1,2}$/.test(d)).map(dayNumber);
  const todayN = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000;
  const anchors: [number, number][] = [[2, 21], [5, 21], [8, 21], [11, 21]];
  const cands: { key: string; n: number }[] = [];
  for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
    for (const [m, d] of anchors) {
      const n = Date.UTC(year, m, d) / 86400000;
      if (have.some((h) => Math.abs(h - n) < 45 || Math.abs(Math.abs(h - n) - 365) < 45)) continue;
      cands.push({ key: `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, n });
    }
  }
  return cands
    .sort((a, b) => Math.abs(a.n - todayN) - Math.abs(b.n - todayN))
    .slice(0, 3)
    .map((c) => c.key);
}

// ── مکمل کیلیبریشن ────────────────────────────────────────────────────────
/**
 * اگر نمونے کافی ہوں (کم از کم 2 دن، اور 60 دن کا فاصلہ): تمام طریقے × دونوں مشرب
 * (× بلند عرض بلد کے قواعد) → پھر فجر/عشاء کے زاویوں کی بہتری۔
 * ورنہ: صرف ±منٹ، `opts.baseConfig` کا طریقہ/مشرب/زاویہ ویسا ہی رہتا ہے۔
 */
export function calibrate(
  latitude: number,
  longitude: number,
  samples: SampleDays,
  opts: { timeZone?: string; methods?: MethodKey[]; baseConfig?: PrayerConfig } = {}
): CalibrationReport {
  const clean = cleanSamples(samples);
  const dates = Object.keys(clean).sort();
  if (!dates.length) throw new Error('کم از کم ایک نمونہ دن درکار ہے');

  const n = dates.length;
  const spanDays = Math.round(dayNumber(dates[n - 1]) - dayNumber(dates[0]));
  const tunable = n >= 2 && spanDays >= MIN_SPAN_FOR_ANGLES;
  const warnings: string[] = [];

  type Cand = { config: PrayerConfig; res: ReturnType<typeof evaluate> };
  const better = (a: Cand['res'], b: Cand['res']) =>
    a.worst < b.worst - 1e-9 || (Math.abs(a.worst - b.worst) <= 1e-9 && a.rmse < b.rmse - 1e-9);

  const board = new Map<string, { method: MethodKey; madhab: MadhabKey; worst: number }>();
  let best: Cand | null = null;
  let anglesTuned = false;

  if (tunable) {
    const available = (m: MethodKey) => (adhan.CalculationMethod as Record<string, unknown>)[m] !== undefined;
    const methods: MethodKey[] = (opts.methods?.length
      ? opts.methods.filter(available)
      : (Object.keys(adhan.CalculationMethod) as MethodKey[]).filter((m) => m !== 'Other'));
    if (!methods.length) throw new Error('کوئی درست طریقہ نہیں ملا');
    const highLats: HighLatKey[] = Math.abs(latitude) >= 48 ? HIGH_LAT_CANDIDATES : ['SeventhOfTheNight'];

    for (const method of methods) {
      for (const madhab of ['hanafi', 'shafi'] as MadhabKey[]) {
        for (const highLatitudeRule of highLats) {
          const cfg: PrayerConfig = { method, madhab, highLatitudeRule, timeZone: opts.timeZone };
          const res = evaluate(latitude, longitude, clean, cfg);
          if (!best || better(res, best.res)) best = { config: cfg, res };
          const k = `${method}|${madhab}`;
          const prev = board.get(k);
          if (!prev || res.worst < prev.worst) board.set(k, { method, madhab, worst: res.worst });
        }
      }
    }
    if (!best) throw new Error('کیلیبریشن ناکام');

    // ── زاویوں کی بہتری: فجر کا زاویہ صرف فجر کی غلطی دیکھ کر، عشاء کا صرف عشاء کی ──
    const tune = (which: 'fajrAngle' | 'ishaAngle', prayer: PrayerKey) => {
      const cur = best!.res.perPrayer[prayer];
      if (!cur) return;
      let bestAngle: number | undefined;
      let bestWorst = cur.worstErr;
      for (let angle = 12; angle <= 20.001; angle += 0.5) {
        const res = evaluate(latitude, longitude, clean, { ...best!.config, [which]: angle });
        const w = res.perPrayer[prayer]?.worstErr;
        // کم از کم آدھے منٹ کی حقیقی بہتری ہو، ورنہ طریقے کا اپنا زاویہ رہنے دیں
        if (w !== undefined && w < bestWorst - 0.5) { bestWorst = w; bestAngle = angle; }
      }
      if (bestAngle !== undefined) {
        const cfg: PrayerConfig = { ...best!.config, [which]: bestAngle };
        best = { config: cfg, res: evaluate(latitude, longitude, clean, cfg) };
        anglesTuned = true;
      }
    };
    tune('fajrAngle', 'fajr');
    tune('ishaAngle', 'isha');
  } else {
    const base = opts.baseConfig ?? {};
    const cfg: PrayerConfig = {
      ...base,
      method: base.method ?? 'Karachi',
      madhab: base.madhab ?? 'hanafi',
      highLatitudeRule: base.highLatitudeRule ?? 'SeventhOfTheNight',
      timeZone: opts.timeZone ?? base.timeZone,
    };
    delete cfg.offsets;
    let res0 = evaluate(latitude, longitude, clean, cfg);

    // عصر کا وقت 15–75 منٹ الگ ہو تو اصل وجہ عموماً مشرب ہے (آفسیٹ سے نہیں بنتا، موسم کے ساتھ فرق بدلتا ہے)
    const asrNow = res0.perPrayer.asr;
    if (asrNow) {
      const alt: MadhabKey = cfg.madhab === 'hanafi' ? 'shafi' : 'hanafi';
      const altCfg: PrayerConfig = { ...cfg, madhab: alt };
      const altRes = evaluate(latitude, longitude, clean, altCfg);
      const rawNow = Math.abs(sampleDiffs(latitude, longitude, clean, cfg).asr?.[0]?.d ?? 0);
      const rawAlt = Math.abs(sampleDiffs(latitude, longitude, clean, altCfg).asr?.[0]?.d ?? 0);
      if (rawNow >= 15 && rawAlt <= 6 && rawAlt < rawNow - 10) {
        cfg.madhab = alt;
        res0 = altRes;
        warnings.push(`عصر کا وقت ${alt === 'shafi' ? 'شافعی' : 'حنفی'} مشرب سے ملتا ہے، اس لیے عصر کا مشرب بدل دیا گیا۔`);
      }
    }
    best = { config: cfg, res: res0 };
    warnings.push(
      n < 2
        ? 'صرف ایک دن کا ڈیٹا ہے: صرف ±منٹ ایڈجسٹ ہوئے ہیں، طریقہ اور زاویہ نہیں بدلے گئے۔ موسم بدلنے پر فجر/عشاء میں فرق آ سکتا ہے۔'
        : 'سارے دن ایک ہی موسم کے ہیں: صرف ±منٹ ایڈجسٹ ہوئے ہیں، طریقہ اور زاویہ نہیں بدلے گئے۔ کم از کم 2 ماہ کے فاصلے پر ایک اور دن شامل کریں۔'
    );
  }

  const final = best as Cand;
  const finalConfig: PrayerConfig = { ...final.config, offsets: final.res.offsets };

  // ── مشکوک اندراجات: باقی دنوں کے رجحان سے بہت ہٹے ہوئے ──
  const suspects: SuspectEntry[] = [];
  const finalDiffs = sampleDiffs(latitude, longitude, clean, finalConfig);
  for (const key of ALL_PRAYER_KEYS) {
    const list = finalDiffs[key];
    if (!list || list.length < 3) continue;
    const center = median(list.map((x) => x.d));
    const devs = list.map((x) => ({ date: x.date, dev: Math.abs(x.d - center) }));
    const mad = median(devs.map((x) => x.dev));
    const floor = key === 'fajr' || key === 'isha' ? 12 : 5;
    for (const x of devs) {
      if (x.dev > Math.max(floor, 3 * mad)) suspects.push({ date: x.date, prayer: key, errorMinutes: Math.round(x.dev) });
    }
  }
  if (suspects.length) warnings.push('کچھ اندراجات باقی دنوں سے میل نہیں کھاتے — شاید وقت غلط لکھا گیا ہو۔ نیچے دیکھ لیں۔');

  const overallWorst = Math.round(final.res.worst * 10) / 10;
  if (overallWorst > 10) warnings.push('باقی غلطی 10 منٹ سے زیادہ ہے — اوقات یا تاریخیں ایک بار دوبارہ دیکھ لیں۔');

  let confidence: Confidence = !tunable ? 'low' : n >= 4 && spanDays >= 150 ? 'high' : 'medium';
  if ((overallWorst > 10 || suspects.length) && confidence !== 'low') confidence = confidence === 'high' ? 'medium' : 'low';

  const leaderboard = [...board.values()].sort((a, b) => a.worst - b.worst).slice(0, 6);

  return {
    config: finalConfig,
    method: final.config.method as MethodKey,
    madhab: final.config.madhab as MadhabKey,
    highLatitudeRule: final.config.highLatitudeRule as HighLatKey,
    perPrayer: final.res.perPrayer,
    overallWorst,
    overallRmse: Math.round(final.res.rmse * 10) / 10,
    samples: n,
    comparedMethods: leaderboard,
    confidence,
    warnings,
    suspects,
    anglesTuned,
    spanDays,
  };
}

/** چند تیار نمونہ دن (ٹیسٹ کے لیے) — کراچی کے عام اوقات */
export const DEMO_SAMPLES: SampleDays = {
  // کراچی کی ایک نمونہ مسجد (کراچی طریقہ + عصرِ حنفی) کے اصل اوقات
  '2026-06-21': { fajr: '04:13', sunrise: '05:43', zuhr: '12:36', asr: '17:17', maghrib: '19:28', isha: '20:56' },
  '2026-12-21': { fajr: '05:50', sunrise: '07:12', zuhr: '12:32', asr: '16:12', maghrib: '17:52', isha: '19:12' },
};
