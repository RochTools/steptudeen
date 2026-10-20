/**
 * zonedTime.ts — وقت اور ٹائم زون کے چھوٹے، آزاد ہیلپرز (کسی لائبریری کے بغیر)
 *
 * بنیادی اصول: مسجد کا وقت "HH:MM" کی شکل میں مسجد کے اپنے ٹائم زون کا دیوار گھڑی (wall-clock) وقت ہے۔
 * دوسرے ملک میں بیٹھا صارف دیکھے تو اسے وہ وقت اس کے اپنے ٹائم زون میں بدل کر دکھانا ہے:
 *   مسجد (پاکستان) ظہر 13:30  →  سعودی عرب کے صارف کو 11:30
 */

const dtfCache = new Map<string, Intl.DateTimeFormat>();
const dtf = (key: string, make: () => Intl.DateTimeFormat) => {
  let f = dtfCache.get(key);
  if (!f) { f = make(); dtfCache.set(key, f); }
  return f;
};

/** "13:30"، "1:30 PM"، "05:12 (PKT)" → دن کے منٹ؛ سمجھ نہ آئے تو null */
export function parseHHMM(raw?: string | null): number | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([aApP][mM])?/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (min > 59 || h > 24) return null;
  if (m[3]) {
    const pm = m[3].toLowerCase() === 'pm';
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  }
  return (h % 24) * 60 + min;
}

/** منٹ → "HH:MM" (آدھی رات پار کرے تو گھوم جاتا ہے) */
export function minutesToHHMM(total: number): string {
  const t = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** "HH:MM" + منٹ (منفی بھی چلے گا)؛ وقت سمجھ نہ آئے تو null */
export function addMinutes(hhmm: string | null | undefined, delta: number): string | null {
  const base = parseHHMM(hhmm);
  return base === null ? null : minutesToHHMM(base + delta);
}

/** کسی ٹائم زون میں تاریخ "yyyy-mm-dd" */
export function dateKeyInZone(now: Date, timeZone: string): string {
  const f = dtf(`date|${timeZone}`, () => new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }));
  const parts = f.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** اس لمحے اس ٹائم زون کا UTC سے فرق (منٹ) */
function zoneOffsetMinutes(utcMs: number, timeZone: string): number {
  const f = dtf(`off|${timeZone}`, () => new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }));
  const parts = f.formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

/**
 * «تاریخ + دیوار گھڑی کا وقت + ٹائم زون» → اصل لمحہ (UTC ملی سیکنڈ)۔
 * غلط تاریخ/وقت/ٹائم زون ہو تو null۔
 */
export function zonedInstant(dateKey: string, hhmm: string | null | undefined, timeZone: string): number | null {
  const mins = parseHHMM(hhmm);
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (mins === null || !d) return null;
  try {
    const wall = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), 0, mins);
    let utc = wall - zoneOffsetMinutes(wall, timeZone) * 60000;
    utc = wall - zoneOffsetMinutes(utc, timeZone) * 60000; // دوسرا چکر: DST کی سرحد کے لیے
    return utc;
  } catch {
    return null;
  }
}

/** لمحے کو کسی ٹائم زون میں "HH:MM" (24 گھنٹے) لکھیں */
export function formatHHMMInZone(ms: number, timeZone?: string): string {
  const f = dtf(`hm|${timeZone ?? ''}`, () => new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }));
  return f.format(new Date(ms));
}

/** دیکھنے والے کا اپنا ٹائم زون (آلے کا) */
export function viewerTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * مسجد کے وقت کو دیکھنے والے کے ٹائم زون میں بدلیں۔
 * ٹائم زون ایک ہو، یا وقت پڑھا نہ جا سکے، تو اصل سٹرنگ ویسی ہی لوٹتی ہے۔
 */
export function convertWallClock(
  raw: string | null | undefined,
  dateKey: string,
  fromTimeZone: string,
  toTimeZone: string
): string {
  if (!raw) return raw ?? '';
  if (fromTimeZone === toTimeZone) return raw;
  const ms = zonedInstant(dateKey, raw, fromTimeZone);
  return ms === null ? raw : formatHHMMInZone(ms, toTimeZone);
}
