/**
 * calibrate.ts — «اپنی مسجد کے مطابق خودکار کیلیبریشن»
 *
 * امام چند دن کے اصل اوقات ٹائپ کرتا ہے → یہ فنکشن خود بہترین
 * (طریقہ + مشرب + Fajr/Isha کا زاویہ + فی نماز ±منٹ) نکال کر دیتا ہے۔
 *
 * یہ اسی تجربے پر بنا ہے جو 27 اوپن ڈیٹا سیٹوں پر آزمایا گیا:
 *   - Sunrise / Zuhr / Maghrib: ایک ہی آفسیٹ پورے سال ±0.5–1 منٹ تک ٹھیک بیٹھتا ہے
 *   - Fajr / Isha: صرف آفسیٹ سے کام نہیں چلتا، زاویہ بھی بدلنا پڑتا ہے (±6–7 منٹ)
 *   - Asr: مشرب (حنفی/شافعی) غلط ہو تو 29–75 منٹ کا فرق — اکیلے آفسیٹ سے نہیں بنتا
 */
import * as adhan from 'adhan';
import {
  ALL_PRAYER_KEYS, PrayerConfig, PrayerKey, MethodKey, MadhabKey, HighLatKey,
  buildParams, minutesOf, hhmmToMinutes,
} from './prayerEngine';

/** نمونہ: { '2026-06-17': { fajr: '03:20', zuhr: '12:30', ... } } */
export type SampleDays = Record<string, Partial<Record<PrayerKey, string>>>;

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
}

const adhanKeyOf: Record<PrayerKey, keyof adhan.PrayerTimes> = {
  fajr: 'fajr', sunrise: 'sunrise', zuhr: 'dhuhr', asr: 'asr', maghrib: 'maghrib', isha: 'isha',
};

const HIGH_LAT_CANDIDATES: HighLatKey[] = ['SeventhOfTheNight', 'MiddleOfTheNight', 'TwilightAngle'];

/** ایک config کے تحت، نمونہ دنوں کا فرق (حساب − مسجد) فی نماز */
function sampleDiffs(
  latitude: number,
  longitude: number,
  samples: SampleDays,
  config: PrayerConfig
): Partial<Record<PrayerKey, number[]>> {
  const coords = new adhan.Coordinates(latitude, longitude);
  const params = buildParams(config);
  const out: Partial<Record<PrayerKey, number[]>> = {};
  for (const [dateKey, expected] of Object.entries(samples)) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const noon = new Date(y, m - 1, d, 12, 0, 0);
    const pt = new adhan.PrayerTimes(coords, noon, params);
    for (const key of ALL_PRAYER_KEYS) {
      const exp = expected[key];
      if (!exp) continue;
      const computed = minutesOf(pt[adhanKeyOf[key]] as Date, config.timeZone);
      (out[key] ||= []).push(computed - hhmmToMinutes(exp));
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

function evaluate(
  latitude: number,
  longitude: number,
  samples: SampleDays,
  config: PrayerConfig
) {
  const diffs = sampleDiffs(latitude, longitude, samples, config);
  const perPrayer: CalibrationReport['perPrayer'] = {};
  const offsets: Partial<Record<PrayerKey, number>> = {};
  let worst = 0, se = 0, n = 0;
  for (const key of ALL_PRAYER_KEYS) {
    const list = diffs[key];
    if (!list?.length) continue;
    const fit = bestOffset(list);
    perPrayer[key] = fit;
    offsets[key] = fit.offset;
    worst = Math.max(worst, fit.worstErr);
    se += fit.meanErr * fit.meanErr; n++;
  }
  return { perPrayer, offsets, worst, rmse: n ? Math.sqrt(se / n) : 0 };
}

/**
 * مکمل کیلیبریشن: تمام طریقے × دونوں مشرب × بلند عرض بلد کے قواعد → پھر زاویوں کی بہتری۔
 */
export function calibrate(
  latitude: number,
  longitude: number,
  samples: SampleDays,
  opts: { timeZone?: string; methods?: MethodKey[] } = {}
): CalibrationReport {
  const cleanSamples: SampleDays = {};
  for (const [k, v] of Object.entries(samples)) {
    const filtered = Object.fromEntries(
      Object.entries(v).filter(([, val]) => typeof val === 'string' && /^\d{1,2}:\d{2}$/.test(val as string))
    ) as Partial<Record<PrayerKey, string>>;
    if (Object.keys(filtered).length) cleanSamples[k] = filtered;
  }
  if (!Object.keys(cleanSamples).length) throw new Error('کم از کم ایک نمونہ دن درکار ہے');

  const methods: MethodKey[] = opts.methods?.length
    ? opts.methods
    : (Object.keys(adhan.CalculationMethod) as MethodKey[]).filter((m) => m !== 'Other');

  const leaderboard: { method: MethodKey; madhab: MadhabKey; worst: number }[] = [];
  let best: { config: PrayerConfig; res: ReturnType<typeof evaluate>; method: MethodKey; madhab: MadhabKey; highLat: HighLatKey } | null = null;

  for (const method of methods) {
    for (const madhab of ['hanafi', 'shafi'] as MadhabKey[]) {
      for (const highLatitudeRule of HIGH_LAT_CANDIDATES) {
        const base: PrayerConfig = { method, madhab, highLatitudeRule, timeZone: opts.timeZone };
        const res = evaluate(latitude, longitude, cleanSamples, base);
        if (!best || res.worst < best.res.worst - 1e-9) {
          best = { config: base, res, method, madhab, highLat: highLatitudeRule };
        }
        leaderboard.push({ method, madhab, worst: res.worst });   // highLat کے بغیر نمایاں کرنے کے لیے
      }
    }
  }
  if (!best) throw new Error('کیلیبریشن ناکام');

  // ── زاویوں کی بہتری (Fajr، پھر Isha) ──
  const tuneAngle = (which: 'fajrAngle' | 'ishaAngle') => {
    let bestAngle = best!.config[which];
    let bestWorst = best!.res.worst;
    for (let angle = 12; angle <= 20.001; angle += 0.5) {
      const cfg: PrayerConfig = { ...best!.config, [which]: angle };
      const res = evaluate(latitude, longitude, cleanSamples, cfg);
      if (res.worst < bestWorst - 1e-9) { bestWorst = res.worst; bestAngle = angle; }
    }
    if (typeof bestAngle === 'number') {
      const cfg: PrayerConfig = { ...best!.config, [which]: bestAngle };
      const res = evaluate(latitude, longitude, cleanSamples, cfg);
      best = { ...best!, config: cfg, res };
    }
  };
  tuneAngle('fajrAngle');
  tuneAngle('ishaAngle');

  const finalConfig: PrayerConfig = { ...best.config, offsets: best.res.offsets };

  const board = leaderboard
    .sort((a, b) => a.worst - b.worst)
    .filter((row, i, arr) => arr.findIndex((x) => x.method === row.method && x.madhab === row.madhab) === i)
    .slice(0, 6);

  return {
    config: finalConfig,
    method: best.method,
    madhab: best.madhab,
    highLatitudeRule: best.highLat,
    perPrayer: best.res.perPrayer,
    overallWorst: Math.round(best.res.worst * 10) / 10,
    overallRmse: Math.round(best.res.rmse * 10) / 10,
    samples: Object.keys(cleanSamples).length,
    comparedMethods: board,
  };
}

/** چند تیار نمونہ دن (ٹیسٹ کے لیے) — کراچی کے عام اوقات */
export const DEMO_SAMPLES: SampleDays = {
  // کراچی کی ایک نمونہ مسجد (کراچی طریقہ + عصرِ حنفی) کے اصل اوقات
  '2026-06-21': { fajr: '04:13', sunrise: '05:43', zuhr: '12:36', asr: '17:17', maghrib: '19:28', isha: '20:56' },
  '2026-12-21': { fajr: '05:50', sunrise: '07:12', zuhr: '12:32', asr: '16:12', maghrib: '17:52', isha: '19:12' },
};
