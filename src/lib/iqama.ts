/**
 * iqama.ts — جماعت (اقامہ) کا شیڈول: اذان کے بعد «مقررہ منٹ» یا «مقررہ گھڑی»
 *
 * اصل مسئلہ: ایپ ابھی جماعت = «اذان + ایک مقررہ وقفہ» لگاتی ہے (fajrOffset=15 وغیرہ)۔
 * مگر حقیقت میں مساجد موسم کے ساتھ وقفہ بدلتی ہیں یا سیدھی گھڑی کا وقت مقرر کرتی ہیں:
 *   مشرقی لندن مسجد: Fajr +15/20/30 منٹ، Isha +6 سے +118 منٹ تک، Maghrib +7 (رمضان +15)
 *   لندن (آنٹاریو): Fajr 06:30 → 4 اکتوبر 06:45 → 25 اکتوبر 06:50 (قدم بہ قدم، تاریخ کے ساتھ)
 *
 * اس لیے دو موڈ رکھے گئے ہیں اور دونوں ایک ہی شیڈول میں رہ سکتے ہیں:
 *   - delay: اذان کے بعد منٹ (مثلاً { delay: 15 })
 *   - time : مقررہ گھڑی (مثلاً { time: '13:30' })
 *   - daily: کسی خاص تاریخ کے لیے مقررہ وقت (رمضان/جمعہ/خصوصی دن)
 */
import { PrayerName, PRAYER_NAMES, PrayerKey, hhmmToMinutes, minutesToHHMM } from './prayerEngine';

export interface IqamaRule {
  /** اذان کے بعد منٹ */
  delay?: number;
  /** مقررہ گھڑی "HH:MM" (اس صورت میں delay نظر انداز ہو گا) */
  time?: string;
}

export interface JumuahSlot {
  label: string;      // مثلاً "پہلی جمعہ"
  time: string;       // "13:00"
}

export interface IqamaSchedule {
  /** ایک شناخت (فائر بیس میں دستاویز کی id بھی ہو سکتی ہے) */
  id?: string;
  effectiveFrom: string;             // 'yyyy-mm-dd' (شامل)
  effectiveTo?: string;              // 'yyyy-mm-dd' (شامل) — نہ ہو تو لامحدود
  /** روزانہ کی بنیاد پر اصول */
  iqama?: Partial<Record<PrayerName, IqamaRule>>;
  /** خاص تاریخوں کے مقررہ اوقات: { '2026-03-01': { fajr: '05:15', ... } } */
  daily?: Record<string, Partial<Record<PrayerName, string>>>;
  /** جمعہ کی جماعتیں */
  jumuah?: JumuahSlot[];
  /** رمضان میں تبدیلیاں */
  ramadan?: {
    fajrDelay?: number;
    iftarDelay?: number;      // مغرب/افطار کے بعد جماعت کے منٹ
    ishaDelay?: number;
    taraweeh?: string;        // مقررہ وقت
  };
  note?: string;              // امام کا نوٹ (اختیاری)
}

/** تاریخ کے مطابق لاگو ہونے والا شیڈول چنیں (آخری effectiveFrom جیتتا ہے) */
export function pickSchedule(schedules: IqamaSchedule[] | undefined, dateKey: string): IqamaSchedule | null {
  if (!schedules?.length) return null;
  const active = schedules.filter(
    (s) => s.effectiveFrom <= dateKey && (!s.effectiveTo || s.effectiveTo >= dateKey)
  );
  if (!active.length) return null;
  return active.sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];
}

/**
 * آج کی جماعت کے اوقات نکالیں۔
 * @param schedule  منتخب شیڈول (pickSchedule سے)
 * @param dateKey   'yyyy-mm-dd'
 * @param adhan     اُس دن کے اذان کے اوقات ("HH:MM")
 * @param opts      { isRamadan }
 */
export function resolveIqama(
  schedule: IqamaSchedule | null,
  dateKey: string,
  adhan: Record<PrayerKey, string>,
  opts: { isRamadan?: boolean } = {}
): Record<PrayerName, string | null> {
  const out = {} as Record<PrayerName, string | null>;
  const isRamadan = !!opts.isRamadan;

  for (const name of PRAYER_NAMES) {
    // 1) خاص تاریخ کا مقررہ وقت
    const dailyTime = schedule?.daily?.[dateKey]?.[name];
    if (dailyTime) { out[name] = dailyTime; continue; }

    const rule = schedule?.iqama?.[name];
    // 2) مقررہ گھڑی
    if (rule?.time) { out[name] = rule.time; continue; }

    // 3) اذان + منٹ (رمضان میں fajr/iftar/isha کی تبدیلیاں)
    const ramadan = schedule?.ramadan;
    let delay = rule?.delay;
    if (isRamadan && ramadan) {
      if (name === 'fajr' && typeof ramadan.fajrDelay === 'number') delay = ramadan.fajrDelay;
      if (name === 'maghrib' && typeof ramadan.iftarDelay === 'number') delay = ramadan.iftarDelay;
      if (name === 'isha' && typeof ramadan.ishaDelay === 'number') delay = ramadan.ishaDelay;
    }
    if (typeof delay === 'number') {
      out[name] = minutesToHHMM(hhmmToMinutes(adhan[name]) + delay);
      continue;
    }
    // 4) کچھ نہیں ملا → روایتی جماعت (اذان + 15/5 منٹ) بطور fallback
    const fallback = name === 'maghrib' ? 5 : name === 'fajr' ? 20 : 15;
    out[name] = minutesToHHMM(hhmmToMinutes(adhan[name]) + fallback);
  }
  return out;
}

/** جمعہ کے اوقات (جمعہ کے دن Jumuah slots، ورنہ عادی ظہر) */
export function jumuahFor(schedule: IqamaSchedule | null): JumuahSlot[] {
  return schedule?.jumuah?.length ? schedule.jumuah : [];
}

/** ماہ کے شیڈول کا خلاصہ (پیش نظارے کے لیے) */
export function describeSchedule(schedule: IqamaSchedule | null): string {
  if (!schedule) return 'کوئی شیڈول مقرر نہیں';
  const parts: string[] = [];
  for (const name of PRAYER_NAMES) {
    const r = schedule.iqama?.[name];
    if (r?.time) parts.push(`${name}: ${r.time}`);
    else if (typeof r?.delay === 'number') parts.push(`${name}: +${r.delay} منٹ`);
  }
  return parts.join(' · ') || 'خالی شیڈول';
}
