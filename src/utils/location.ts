// ═══════════════════════════════════════════════════════════════
// location.ts — StepTuDeen
// لوکیشن کا مشترکہ نظام: اجازت کی حالت، دو مرحلوں میں کوشش، آخری معلوم مقام، اور
// ہر ناکامی کی صحیح وجہ + حل (اجازت بند / GPS بند / سگنل نہیں)۔
// ═══════════════════════════════════════════════════════════════
import { isNative } from './native';

export type LocationFailure = 'denied' | 'unavailable' | 'timeout' | 'unsupported';
export type PermissionStateLite = 'granted' | 'denied' | 'prompt' | 'unsupported';
export interface Coords { latitude: number; longitude: number; accuracy?: number }
export type LocationResult =
  | { ok: true; coords: Coords }
  | { ok: false; reason: LocationFailure; lastKnown: Coords | null };

const LAST_KEY = 'steptudeen_last_coords';
const LAST_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;   // 14 دن سے پرانا مقام استعمال نہیں ہوتا

// ── آخری معلوم مقام ─────────────────────────────────────────
export function getLastKnown(): Coords | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (
      Number.isFinite(c?.latitude) && Number.isFinite(c?.longitude) &&
      Math.abs(c.latitude) <= 90 && Math.abs(c.longitude) <= 180 &&
      typeof c.at === 'number' && Date.now() - c.at < LAST_MAX_AGE_MS
    ) return { latitude: c.latitude, longitude: c.longitude };
  } catch { /* اسٹوریج بند/خراب ہو تو نظر انداز */ }
  return null;
}

function saveLastKnown(c: Coords): void {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ latitude: c.latitude, longitude: c.longitude, at: Date.now() }));
  } catch { /* نظر انداز */ }
}

// ── اجازت کی حالت ───────────────────────────────────────────
export async function getPermissionState(): Promise<PermissionStateLite> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unsupported';
  try {
    const res = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    if (res && (res.state === 'granted' || res.state === 'denied' || res.state === 'prompt')) return res.state;
  } catch { /* پرانے براؤزر میں permissions API نہیں */ }
  return 'prompt';
}

/**
 * اجازت کی حالت بدلے (یا صارف سیٹنگز سے واپس آئے) تو cb چلے۔
 * واپس آنے والا فنکشن سننا بند کر دیتا ہے۔
 */
export function watchPermissionState(cb: (s: PermissionStateLite) => void): () => void {
  let dead = false;
  let status: PermissionStatus | null = null;
  const refresh = () => { void getPermissionState().then((s) => { if (!dead) cb(s); }); };
  try {
    void navigator.permissions?.query({ name: 'geolocation' as PermissionName })
      .then((r) => { if (dead) return; status = r; r.onchange = refresh; })
      .catch(() => { /* نظر انداز */ });
  } catch { /* نظر انداز */ }
  document.addEventListener('visibilitychange', refresh);   // سیٹنگز سے واپس آنے پر
  window.addEventListener('focus', refresh);
  refresh();
  return () => {
    dead = true;
    if (status) status.onchange = null;
    document.removeEventListener('visibilitychange', refresh);
    window.removeEventListener('focus', refresh);
  };
}

// ── مقام لینا ───────────────────────────────────────────────
interface Attempt { pos?: GeolocationPosition; code?: number }

function attempt(options: PositionOptions): Promise<Attempt> {
  return new Promise((resolve) => {
    let finished = false;
    // کچھ WebView میں getCurrentPosition کبھی جواب ہی نہیں دیتا — اس لیے اپنی حد
    const guard = setTimeout(() => finish({ code: 3 }), (options.timeout ?? 10000) + 3000);
    function finish(a: Attempt) {
      if (finished) return;
      finished = true;
      clearTimeout(guard);
      resolve(a);
    }
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => finish({ pos }),
        (err) => finish({ code: err.code }),
        options,
      );
    } catch {
      finish({ code: 2 });
    }
  });
}

/**
 * مقام لینے کی ہوشیار کوشش:
 *  1) تیز: نیٹ ورک/محفوظ مقام، کم درستگی (8 سیکنڈ)
 *  2) ناکام ہو (اجازت کے علاوہ) تو GPS کے ساتھ سست مگر درست (20 سیکنڈ)
 * ناکام ہو تو اصل وجہ اور آخری معلوم مقام واپس کرتا ہے، تاکہ ایپ چلتی رہے۔
 */
export async function requestPosition(): Promise<LocationResult> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { ok: false, reason: 'unsupported', lastKnown: getLastKnown() };
  }
  let a = await attempt({ enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 });
  if (!a.pos && a.code !== 1) {
    a = await attempt({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }
  if (a.pos) {
    const coords: Coords = {
      latitude: a.pos.coords.latitude,
      longitude: a.pos.coords.longitude,
      accuracy: a.pos.coords.accuracy,
    };
    saveLastKnown(coords);
    return { ok: true, coords };
  }
  const reason: LocationFailure = a.code === 1 ? 'denied' : a.code === 2 ? 'unavailable' : 'timeout';
  return { ok: false, reason, lastKnown: getLastKnown() };
}

// ── صارف کو صحیح بات بتانا ──────────────────────────────────
export interface FailureInfo { title: string; summary: string; steps: string[] }

export function describeFailure(reason: LocationFailure, lang: 'en' | 'ur' = 'en'): FailureInfo {
  const native = isNative();
  if (lang === 'ur') {
    switch (reason) {
      case 'denied':
        return native ? {
          title: 'لوکیشن کی اجازت بند ہے',
          summary: 'اس ایپ کو لوکیشن کی اجازت نہیں ملی۔ اب اسے فون کی سیٹنگز سے کھولنا ہوگا۔',
          steps: ['فون کی Settings کھولیں', 'Apps ← StepTuDeen ← Permissions', 'Location ← "ایپ استعمال کرتے وقت اجازت دیں" چنیں', 'واپس آ کر "دوبارہ جانچیں" دبائیں'],
        } : {
          title: 'لوکیشن کی اجازت بند ہے',
          summary: 'براؤزر Block کے بعد دوبارہ نہیں پوچھتا، اس لیے سائٹ کی سیٹنگز سے خود کھولنی ہوگی۔',
          steps: ['ایڈریس بار کے ساتھ تالے (🔒) یا مینو (⋮) پر ٹیپ کریں', 'Site settings ← Location ← Allow', 'واپس آ کر "دوبارہ جانچیں" دبائیں'],
        };
      case 'unavailable':
        return {
          title: 'مقام نہیں مل رہا',
          summary: 'فون کا GPS/لوکیشن بند ہو سکتا ہے، یا سگنل نہیں آ رہا۔',
          steps: ['فون کی اوپر والی پٹی سے Location (GPS) آن کریں', 'کھلی جگہ یا کھڑکی کے قریب جائیں', '"دوبارہ کوشش" دبائیں'],
        };
      case 'timeout':
        return {
          title: 'مقام ملنے میں دیر لگ رہی ہے',
          summary: 'اس وقت سگنل کمزور ہے۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔',
          steps: ['انٹرنیٹ اور GPS چیک کریں', 'کھلی جگہ جائیں', '"دوبارہ کوشش" دبائیں'],
        };
      default:
        return { title: 'لوکیشن سپورٹ نہیں', summary: 'یہ ڈیوائس یا براؤزر لوکیشن سپورٹ نہیں کرتا۔', steps: [] };
    }
  }
  switch (reason) {
    case 'denied':
      return native ? {
        title: 'Location permission is off',
        summary: 'This app has no location permission. It can only be turned on from your phone settings now.',
        steps: ['Open the phone Settings', 'Apps → StepTuDeen → Permissions', 'Location → choose "Allow only while using the app"', 'Come back here and tap "Check again"'],
      } : {
        title: 'Location permission is blocked',
        summary: 'After "Block", the browser will not ask again, so it has to be allowed from the site settings.',
        steps: ['Tap the lock (🔒) next to the address, or the ⋮ menu', 'Site settings → Location → Allow', 'Come back here and tap "Check again"'],
      };
    case 'unavailable':
      return {
        title: "Can't find your position",
        summary: 'Your phone\'s GPS/Location may be off, or there is no signal.',
        steps: ['Turn on Location (GPS) from the phone\'s top panel', 'Go outdoors or near a window', 'Tap "Try again"'],
      };
    case 'timeout':
      return {
        title: 'Location is taking too long',
        summary: 'The signal is weak right now. Please try again in a moment.',
        steps: ['Check internet and GPS', 'Move to an open area', 'Tap "Try again"'],
      };
    default:
      return { title: 'Location not supported', summary: 'This device or browser does not support location.', steps: [] };
  }
}
