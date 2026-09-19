import React, { useEffect, useMemo, useState } from 'react';

/**
 * CelestialHeaderScene — realistic, time-aware sky for the prayer-times header.
 *
 * How it works
 * ------------
 * 1. Sunrise / sunset are read from `prayerTimes` (falls back to sane defaults).
 * 2. Real clock time is converted into a "solar hour" (0..24):
 *      06 = sunrise, 12 = solar noon, 18 = sunset, 00/24 = solar midnight.
 *    Because it is solar time, the palette automatically adapts to the season
 *    and to the user's city (long summer days vs short winter days).
 * 3. A keyframed palette table (see PALETTES) is interpolated in linear RGB,
 *    so midnight → pre-dawn → fajr glow → sunrise → morning → noon →
 *    afternoon → golden hour → sunset → maghrib → isha → deep night
 *    all blend smoothly into each other.
 *
 * Drop-in replacement for the previous component: same props, same export.
 */

export interface CelestialHeaderSceneProps {
  prayerTimes: { [key: string]: string };
  /** Only for testing: force the clock to `minutes` past midnight (0–1439). */
  testMinutes?: number;
  /** Optional manual override, "HH:MM" (24h) — used if prayerTimes has no sunrise. */
  sunrise?: string;
  /** Optional manual override, "HH:MM" (24h) — used if prayerTimes has no sunset. */
  sunset?: string;
  /** How often the scene refreshes, in ms. Default 15000. */
  updateIntervalMs?: number;
  /**
   * Hijri date used to shape the moon.
   *  - pass a number = day of the Hijri month (1–30), or
   *  - pass { day, month?, year? } — recommended, so the moon is in sync with
   *    whatever Hijri date your app already shows (API / local moon sighting).
   * If omitted, the component computes the tabular (arithmetic) Hijri date
   * itself. That can differ by ±1 day from the sighted calendar, which only
   * shifts the crescent by one step.
   */
  hijriDate?: number | { day: number; month?: number; year?: number };
  /**
   * Travel path of the sun and moon, in percent of the header box.
   * Both bodies share it. Defaults to DEFAULT_CELESTIAL_PATH, which starts
   * behind the "Next Prayer" card and ends at the ⋮ three-dot menu.
   */
  path?: CelestialPath;
}

/* ------------------------------------------------------------------ *
 * Small math / parsing helpers (unchanged behaviour from the original)
 * ------------------------------------------------------------------ */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Fade in over the first `edge` of the journey and out over the last `edge`. */
const pathFade = (progress: number, edge: number) =>
  clamp(progress / edge, 0, 1) * clamp((1 - progress) / edge, 0, 1);

const extractClockTime = (timeValue?: string) => {
  if (!timeValue) return '';
  const match = timeValue.match(/(\d{1,2}):(\d{2})/);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

const parseTimeToMinutes = (timeValue?: string) => {
  const normalized = extractClockTime(timeValue);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const getPrayerTimeValue = (times: { [key: string]: string }, aliases: string[]) => {
  for (const alias of aliases) {
    if (times?.[alias]) return times[alias];
  }
  const entries = Object.entries(times || {});
  for (const alias of aliases.map(item => item.toLowerCase())) {
    const match = entries.find(([key, value]) => key.toLowerCase() === alias && !!value);
    if (match) return match[1];
  }
  return '';
};

/* ------------------------------------------------------------------ *
 * Colour helpers — mixing happens in linear space so sunsets do not
 * turn muddy grey when blue blends into orange.
 * ------------------------------------------------------------------ */

type RGB = [number, number, number];

const rgbCache = new Map<string, RGB>();

const toRgb = (color: string): RGB => {
  const cached = rgbCache.get(color);
  if (cached) return cached;
  let hex = color.trim().replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const value: RGB = [
    parseInt(hex.slice(0, 2), 16) || 0,
    parseInt(hex.slice(2, 4), 16) || 0,
    parseInt(hex.slice(4, 6), 16) || 0,
  ];
  rgbCache.set(color, value);
  return value;
};

const toLinear = (channel: number) => Math.pow(channel / 255, 2.2);
const fromLinear = (channel: number) => Math.round(Math.pow(clamp(channel, 0, 1), 1 / 2.2) * 255);

const mixRgb = (a: RGB, b: RGB, t: number): RGB => [
  fromLinear(lerp(toLinear(a[0]), toLinear(b[0]), t)),
  fromLinear(lerp(toLinear(a[1]), toLinear(b[1]), t)),
  fromLinear(lerp(toLinear(a[2]), toLinear(b[2]), t)),
];

const css = (c: RGB) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const cssA = (c: RGB, alpha: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${clamp(alpha, 0, 1).toFixed(3)})`;

/* ------------------------------------------------------------------ *
 * The palette table.  `at` is the SOLAR hour (0–24), not the clock hour.
 * ------------------------------------------------------------------ */

interface RawPalette {
  at: number;
  top: string;
  mid: string;
  bottom: string;
  haze: string;
  hazeOpacity: number;
  star: number;
  sunCore: string;
  sunMid: string;
  sunEdge: string;
  sunGlow: string;
  sunGlowOpacity: number;
  sunSize: number;
  cloudTop: string;
  cloudBottom: string;
  cloudOpacity: number;
  moonLight: string;
  moonDark: string;
  moonGlowOpacity: number;
}

const RAW_PALETTES: RawPalette[] = [
  // ---- 00:00 solar midnight — deep night, full stars, cold moon -------------
  {
    at: 0,
    top: '#03050d', mid: '#070c1e', bottom: '#0e1633',
    haze: '#1a2550', hazeOpacity: 0.2,
    star: 1,
    sunCore: '#ffffff', sunMid: '#ffe9b0', sunEdge: '#ff9a3c', sunGlow: '#ff8a3c', sunGlowOpacity: 0, sunSize: 1,
    cloudTop: '#1e2a4c', cloudBottom: '#111832', cloudOpacity: 0.3,
    moonLight: '#ffffff', moonDark: '#c6d3ea', moonGlowOpacity: 0.55,
  },
  // ---- 03:00 — still dead of night ----------------------------------------
  {
    at: 3,
    top: '#04060f', mid: '#080e24', bottom: '#111a3a',
    haze: '#1c2757', hazeOpacity: 0.2,
    star: 1,
    sunCore: '#ffffff', sunMid: '#ffe9b0', sunEdge: '#ff9a3c', sunGlow: '#ff8a3c', sunGlowOpacity: 0, sunSize: 1,
    cloudTop: '#212d51', cloudBottom: '#121a35', cloudOpacity: 0.3,
    moonLight: '#ffffff', moonDark: '#c9d5ec', moonGlowOpacity: 0.5,
  },
  // ---- 04:20 — astronomical dawn, first hint of light ----------------------
  {
    at: 4.3,
    top: '#0a1130', mid: '#111a42', bottom: '#1d2559',
    haze: '#2b3768', hazeOpacity: 0.26,
    star: 0.88,
    sunCore: '#fff8e8', sunMid: '#ffe0a8', sunEdge: '#ff9a52', sunGlow: '#ff9a45', sunGlowOpacity: 0, sunSize: 1.1,
    cloudTop: '#26325a', cloudBottom: '#151d3c', cloudOpacity: 0.32,
    moonLight: '#fdfbff', moonDark: '#c2cfe6', moonGlowOpacity: 0.42,
  },
  // ---- 05:05 — fajr / civil dawn, purple band on the horizon ---------------
  {
    at: 5.1,
    top: '#141d4c', mid: '#2c2d5f', bottom: '#5c3f6c',
    haze: '#8a5a72', hazeOpacity: 0.4,
    star: 0.42,
    sunCore: '#fff4dd', sunMid: '#ffd79b', sunEdge: '#ff8f4a', sunGlow: '#ff9a45', sunGlowOpacity: 0.35, sunSize: 1.14,
    cloudTop: '#4a3d63', cloudBottom: '#241d40', cloudOpacity: 0.34,
    moonLight: '#fff6f0', moonDark: '#bcc4dd', moonGlowOpacity: 0.3,
  },
  // ---- 05:40 — pre-sunrise glow -------------------------------------------
  {
    at: 5.65,
    top: '#24345f', mid: '#594b78', bottom: '#c47a62',
    haze: '#ff9d6a', hazeOpacity: 0.55,
    star: 0.12,
    sunCore: '#fff6de', sunMid: '#ffd489', sunEdge: '#ff8f42', sunGlow: '#ff9a45', sunGlowOpacity: 0.7, sunSize: 1.16,
    cloudTop: '#a06a72', cloudBottom: '#3a2a4c', cloudOpacity: 0.36,
    moonLight: '#ffeede', moonDark: '#b6bcd6', moonGlowOpacity: 0.18,
  },
  // ---- 06:00 — SUNRISE -----------------------------------------------------
  {
    at: 6,
    top: '#3d5f9c', mid: '#a06e77', bottom: '#ffab5e',
    haze: '#ffb066', hazeOpacity: 0.95,
    star: 0,
    sunCore: '#fff7e0', sunMid: '#ffd489', sunEdge: '#ff8f42', sunGlow: '#ff9a45', sunGlowOpacity: 0.95, sunSize: 1.16,
    cloudTop: '#ffcf9e', cloudBottom: '#8a6a8a', cloudOpacity: 0.55,
    moonLight: '#ffe9d2', moonDark: '#aeb4cf', moonGlowOpacity: 0.12,
  },
  // ---- 06:55 — golden morning ---------------------------------------------
  {
    at: 6.9,
    top: '#5188c6', mid: '#95bade', bottom: '#ffd8a4',
    haze: '#ffd9a0', hazeOpacity: 0.6,
    star: 0,
    sunCore: '#fffdf2', sunMid: '#ffe6a8', sunEdge: '#ffbe57', sunGlow: '#ffd06a', sunGlowOpacity: 0.7, sunSize: 1.06,
    cloudTop: '#ffffff', cloudBottom: '#d9e8f8', cloudOpacity: 0.6,
    moonLight: '#ffffff', moonDark: '#aab2cc', moonGlowOpacity: 0,
  },
  // ---- 08:30 — morning -----------------------------------------------------
  {
    at: 8.5,
    top: '#3b8bd8', mid: '#7cc0f0', bottom: '#d5edff',
    haze: '#eaf6ff', hazeOpacity: 0.35,
    star: 0,
    sunCore: '#ffffff', sunMid: '#fffbe6', sunEdge: '#ffe066', sunGlow: '#ffe680', sunGlowOpacity: 0.5, sunSize: 0.99,
    cloudTop: '#ffffff', cloudBottom: '#e2eefb', cloudOpacity: 0.72,
    moonLight: '#ffffff', moonDark: '#a8b0ca', moonGlowOpacity: 0,
  },
  // ---- 12:00 — NOON, whitest + brightest -----------------------------------
  {
    at: 12,
    top: '#1b78da', mid: '#54b1f0', bottom: '#c1e7ff',
    haze: '#ffffff', hazeOpacity: 0.42,
    star: 0,
    sunCore: '#ffffff', sunMid: '#fffef0', sunEdge: '#fff07a', sunGlow: '#fff3a0', sunGlowOpacity: 0.42, sunSize: 0.94,
    cloudTop: '#ffffff', cloudBottom: '#eaf3ff', cloudOpacity: 0.8,
    moonLight: '#ffffff', moonDark: '#a8b0ca', moonGlowOpacity: 0,
  },
  // ---- 15:00 — afternoon ---------------------------------------------------
  {
    at: 15,
    top: '#2a86dc', mid: '#6cbff0', bottom: '#daf0ff',
    haze: '#ffffff', hazeOpacity: 0.4,
    star: 0,
    sunCore: '#ffffff', sunMid: '#fffdf0', sunEdge: '#ffe98a', sunGlow: '#ffe98a', sunGlowOpacity: 0.5, sunSize: 0.97,
    cloudTop: '#ffffff', cloudBottom: '#e8f2ff', cloudOpacity: 0.78,
    moonLight: '#ffffff', moonDark: '#a8b0ca', moonGlowOpacity: 0,
  },
  // ---- 16:55 — late afternoon, sun starts dropping --------------------------
  {
    at: 16.9,
    top: '#3f8ad2', mid: '#97c7ea', bottom: '#ffddaa',
    haze: '#ffd79a', hazeOpacity: 0.5,
    star: 0,
    sunCore: '#ffffff', sunMid: '#fff6dd', sunEdge: '#ffd36a', sunGlow: '#ffd98a', sunGlowOpacity: 0.62, sunSize: 1.03,
    cloudTop: '#fff4e2', cloudBottom: '#dfeaf8', cloudOpacity: 0.72,
    moonLight: '#ffffff', moonDark: '#b0b6ce', moonGlowOpacity: 0.05,
  },
  // ---- 17:35 — golden hour -------------------------------------------------
  {
    at: 17.6,
    top: '#4e85bb', mid: '#d09a71', bottom: '#ffc07a',
    haze: '#ffb066', hazeOpacity: 0.78,
    star: 0,
    sunCore: '#fff8e6', sunMid: '#ffd894', sunEdge: '#ffa74f', sunGlow: '#ffa855', sunGlowOpacity: 0.85, sunSize: 1.1,
    cloudTop: '#ffd6a4', cloudBottom: '#c98f7f', cloudOpacity: 0.68,
    moonLight: '#fff2e0', moonDark: '#b4bacf', moonGlowOpacity: 0.12,
  },
  // ---- 18:00 — SUNSET ------------------------------------------------------
  {
    at: 18,
    top: '#3a568d', mid: '#e07c4f', bottom: '#ffb163',
    haze: '#ff9847', hazeOpacity: 1,
    star: 0,
    sunCore: '#fff3d2', sunMid: '#ffb257', sunEdge: '#ff6b2c', sunGlow: '#ff7a33', sunGlowOpacity: 1, sunSize: 1.18,
    cloudTop: '#ffb277', cloudBottom: '#8d5a72', cloudOpacity: 0.62,
    moonLight: '#ffe9cf', moonDark: '#b7bcd2', moonGlowOpacity: 0.18,
  },
  // ---- 18:30 — maghrib, afterglow ------------------------------------------
  {
    at: 18.5,
    top: '#23386f', mid: '#7b4d7e', bottom: '#e0715a',
    haze: '#e0705a', hazeOpacity: 0.8,
    star: 0.1,
    sunCore: '#ffeccb', sunMid: '#ffa85c', sunEdge: '#ff6b2c', sunGlow: '#ff7a33', sunGlowOpacity: 0.5, sunSize: 1.16,
    cloudTop: '#c2707a', cloudBottom: '#3d2a52', cloudOpacity: 0.5,
    moonLight: '#ffe4cc', moonDark: '#bcc2d8', moonGlowOpacity: 0.3,
  },
  // ---- 19:15 — isha / nautical dusk ----------------------------------------
  {
    at: 19.2,
    top: '#15204f', mid: '#383761', bottom: '#7c4a62',
    haze: '#8a4f60', hazeOpacity: 0.5,
    star: 0.5,
    sunCore: '#ffe7c4', sunMid: '#ffa85c', sunEdge: '#ff6b2c', sunGlow: '#ff7a33', sunGlowOpacity: 0, sunSize: 1.14,
    cloudTop: '#4a3560', cloudBottom: '#221a3c', cloudOpacity: 0.4,
    moonLight: '#fff1e4', moonDark: '#c3c9de', moonGlowOpacity: 0.45,
  },
  // ---- 20:15 — night settles in --------------------------------------------
  {
    at: 20.2,
    top: '#0c1334', mid: '#18214c', bottom: '#2b3459',
    haze: '#3b4571', hazeOpacity: 0.32,
    star: 0.85,
    sunCore: '#ffffff', sunMid: '#ffe9b0', sunEdge: '#ff9a3c', sunGlow: '#ff8a3c', sunGlowOpacity: 0, sunSize: 1,
    cloudTop: '#2b3557', cloudBottom: '#161e3c', cloudOpacity: 0.34,
    moonLight: '#ffffff', moonDark: '#c7d3ea', moonGlowOpacity: 0.62,
  },
  // ---- 21:30 — full night ---------------------------------------------------
  {
    at: 21.5,
    top: '#070c1e', mid: '#0d1433', bottom: '#182246',
    haze: '#232f5c', hazeOpacity: 0.22,
    star: 1,
    sunCore: '#ffffff', sunMid: '#ffe9b0', sunEdge: '#ff9a3c', sunGlow: '#ff8a3c', sunGlowOpacity: 0, sunSize: 1,
    cloudTop: '#232d52', cloudBottom: '#131a35', cloudOpacity: 0.32,
    moonLight: '#ffffff', moonDark: '#ccd8ef', moonGlowOpacity: 0.7,
  },
  // ---- 24:00 — wraps back to solar midnight ---------------------------------
  {
    at: 24,
    top: '#03050d', mid: '#070c1e', bottom: '#0e1633',
    haze: '#1a2550', hazeOpacity: 0.2,
    star: 1,
    sunCore: '#ffffff', sunMid: '#ffe9b0', sunEdge: '#ff9a3c', sunGlow: '#ff8a3c', sunGlowOpacity: 0, sunSize: 1,
    cloudTop: '#1e2a4c', cloudBottom: '#111832', cloudOpacity: 0.3,
    moonLight: '#ffffff', moonDark: '#c6d3ea', moonGlowOpacity: 0.55,
  },
];

interface Palette {
  at: number;
  top: RGB; mid: RGB; bottom: RGB;
  haze: RGB; hazeOpacity: number;
  star: number;
  sunCore: RGB; sunMid: RGB; sunEdge: RGB; sunGlow: RGB;
  sunGlowOpacity: number; sunSize: number;
  cloudTop: RGB; cloudBottom: RGB; cloudOpacity: number;
  moonLight: RGB; moonDark: RGB; moonGlowOpacity: number;
}

const resolvePalette = (raw: RawPalette): Palette => ({
  at: raw.at,
  top: toRgb(raw.top), mid: toRgb(raw.mid), bottom: toRgb(raw.bottom),
  haze: toRgb(raw.haze), hazeOpacity: raw.hazeOpacity,
  star: raw.star,
  sunCore: toRgb(raw.sunCore), sunMid: toRgb(raw.sunMid),
  sunEdge: toRgb(raw.sunEdge), sunGlow: toRgb(raw.sunGlow),
  sunGlowOpacity: raw.sunGlowOpacity, sunSize: raw.sunSize,
  cloudTop: toRgb(raw.cloudTop), cloudBottom: toRgb(raw.cloudBottom),
  cloudOpacity: raw.cloudOpacity,
  moonLight: toRgb(raw.moonLight), moonDark: toRgb(raw.moonDark),
  moonGlowOpacity: raw.moonGlowOpacity,
});

const PALETTES: Palette[] = RAW_PALETTES.map(resolvePalette);

const blendPalette = (a: Palette, b: Palette, t: number): Palette => ({
  at: lerp(a.at, b.at, t),
  top: mixRgb(a.top, b.top, t),
  mid: mixRgb(a.mid, b.mid, t),
  bottom: mixRgb(a.bottom, b.bottom, t),
  haze: mixRgb(a.haze, b.haze, t),
  hazeOpacity: lerp(a.hazeOpacity, b.hazeOpacity, t),
  star: lerp(a.star, b.star, t),
  sunCore: mixRgb(a.sunCore, b.sunCore, t),
  sunMid: mixRgb(a.sunMid, b.sunMid, t),
  sunEdge: mixRgb(a.sunEdge, b.sunEdge, t),
  sunGlow: mixRgb(a.sunGlow, b.sunGlow, t),
  sunGlowOpacity: lerp(a.sunGlowOpacity, b.sunGlowOpacity, t),
  sunSize: lerp(a.sunSize, b.sunSize, t),
  cloudTop: mixRgb(a.cloudTop, b.cloudTop, t),
  cloudBottom: mixRgb(a.cloudBottom, b.cloudBottom, t),
  cloudOpacity: lerp(a.cloudOpacity, b.cloudOpacity, t),
  moonLight: mixRgb(a.moonLight, b.moonLight, t),
  moonDark: mixRgb(a.moonDark, b.moonDark, t),
  moonGlowOpacity: lerp(a.moonGlowOpacity, b.moonGlowOpacity, t),
});

const getPaletteForSolarHour = (solarHour: number): Palette => {
  const hour = ((solarHour % 24) + 24) % 24;
  for (let i = 0; i < PALETTES.length - 1; i += 1) {
    const a = PALETTES[i];
    const b = PALETTES[i + 1];
    if (hour >= a.at && hour <= b.at) {
      const span = b.at - a.at;
      return blendPalette(a, b, span <= 0 ? 0 : (hour - a.at) / span);
    }
  }
  return PALETTES[PALETTES.length - 1];
};

/* ------------------------------------------------------------------ *
 * The path the sun AND the moon travel along (percent of the header box).
 * Both bodies share exactly the same curve — only "how far along" differs
 * (day = sunrise→sunset, night = maghrib→fajr).
 *
 * It is a cubic Bézier tuned for the prayer header, where:
 *   · the big "Next Prayer" glass card sits in the lower half  → horizon
 *   · /mosque-header.webp (minarets) sits at z-12              → sun passes
 *     BEHIND it, because this scene renders at z-index 10
 *   · the ⋮ (MoreVertical) button is top-right at z-20         → sun ends
 *     there and fades out (and is covered by the button itself)
 *
 * So the journey is: out from under the card → up across the sky →
 * behind the minarets → vanish at the three-dot menu.
 * ------------------------------------------------------------------ */

export interface CelestialPoint {
  x: number;
  y: number;
}

export interface CelestialPath {
  start: CelestialPoint;
  control1: CelestialPoint;
  control2: CelestialPoint;
  end: CelestialPoint;
}

export const DEFAULT_CELESTIAL_PATH: CelestialPath = {
  start: { x: 8, y: 64 },      // tucked behind the "Next Prayer" card (hidden)
  control1: { x: 20, y: 22 },  // steep climb out from behind the card
  control2: { x: 60, y: 8 },   // high afternoon, crossing behind the minarets
  end: { x: 91, y: 10 },       // ⋮ three-dot menu, top-right — it vanishes here
};

const getCubicPoint = (progress: number, path: CelestialPath) => {
  const t = clamp(progress, 0, 1);
  const k = 1 - t;
  const a = k * k * k;
  const b = 3 * k * k * t;
  const c = 3 * k * t * t;
  const d = t * t * t;
  return {
    x: a * path.start.x + b * path.control1.x + c * path.control2.x + d * path.end.x,
    y: a * path.start.y + b * path.control1.y + c * path.control2.y + d * path.end.y,
  };
};

/** Moon and sun cross briefly at dawn / dusk — how many minutes they overlap. */
const HANDOFF_WINDOW = 38;

/* ------------------------------------------------------------------ *
 * Hijri calendar  ->  moon phase
 *
 * The Hijri month begins at new moon (conjunction), so the shape of the
 * moon follows the day of the Islamic month almost exactly:
 *   1st = thin hilal · 7th = first quarter · 14/15th = full moon
 *   21/22nd = last quarter · 28–30th = thin waning crescent
 *
 * The implementation below is the tabular (arithmetic) Islamic calendar:
 * 30-year cycle, 19 common years of 354 days and 11 leap years of 355.
 * It is always within about ±1 day of the sighted / Umm al-Qura calendar.
 * ------------------------------------------------------------------ */

const ISLAMIC_EPOCH_JD = 1948440; // Julian day of 1 Muharram AH 1
const ISLAMIC_LEAP_YEARS = [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29]; // 1-indexed inside the 30y cycle
const HIJRI_MONTH_NAMES = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani", 'Jumada al-Awwal',
  'Jumada al-Thani', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
];

const isIslamicLeapYear = (year: number) => ISLAMIC_LEAP_YEARS.includes(((year - 1) % 30 + 30) % 30 + 1);

const islamicMonthLength = (month: number, year: number) =>
  month % 2 === 1 ? 30 : month === 12 && isIslamicLeapYear(year) ? 30 : 29;

const gregorianToJulianDay = (year: number, month: number, day: number) => {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
};

const getHijriDate = (date: Date) => {
  const jd = gregorianToJulianDay(date.getFullYear(), date.getMonth() + 1, date.getDate());
  let dayOfYear = Math.floor(jd - ISLAMIC_EPOCH_JD);
  const cycles = Math.floor(dayOfYear / 10631);
  let year = 1 + cycles * 30;
  dayOfYear -= cycles * 10631;

  const yearLength = (y: number) => (isIslamicLeapYear(y) ? 355 : 354);
  while (dayOfYear >= yearLength(year)) {
    dayOfYear -= yearLength(year);
    year += 1;
  }

  let month = 1;
  while (dayOfYear >= islamicMonthLength(month, year)) {
    dayOfYear -= islamicMonthLength(month, year);
    month += 1;
  }

  return { day: dayOfYear + 1, month, year, monthName: HIJRI_MONTH_NAMES[month - 1] };
};

/** SVG path of the sunlit part of the moon, drawn lit-on-the-right (waxing). */
const MOON_CENTER = 24;
const MOON_RADIUS = 17;

const getMoonLitPath = (illuminated: number) => {
  // minimum 0.08 تاکہ پہلے دن بھی پتلا crescent دکھے
  const k = clamp(Math.max(illuminated, 0.08), 0, 1);
  const terminator = MOON_RADIUS * Math.abs(1 - 2 * k); // half-width of the terminator ellipse
  const gibbousSweep = k > 0.5 ? 1 : 0; // crescent: terminator bulges into the lit side
  const top = MOON_CENTER - MOON_RADIUS;
  const bottom = MOON_CENTER + MOON_RADIUS;
  return (
    `M ${MOON_CENTER} ${top} ` +
    `A ${MOON_RADIUS} ${MOON_RADIUS} 0 0 1 ${MOON_CENTER} ${bottom} ` +
    `A ${terminator.toFixed(2)} ${MOON_RADIUS} 0 0 ${gibbousSweep} ${MOON_CENTER} ${top} Z`
  );
};

/**
 * @param dayOfMonth  Hijri day (1–30)
 * @param fraction    how far the current Islamic night/day has advanced (0 at Maghrib)
 */
const getMoonPhase = (dayOfMonth: number, fraction: number, month?: number, year?: number) => {
  const monthLength = month ? islamicMonthLength(month, year ?? 1448) : 30;
  // +1 day: the hilal of the 1st is already roughly one day old, which is why
  // it is visible at all.
  const age = dayOfMonth - 1 + fraction + 1;
  const cycle = (((age / monthLength) % 1) + 1) % 1; // 0 = new, 0.5 = full
  const illuminated = (1 - Math.cos(2 * Math.PI * cycle)) / 2;
  return {
    age,
    cycle,
    illuminated: clamp(illuminated, 0, 1),
    waxing: cycle < 0.5,
    path: getMoonLitPath(illuminated),
  };
};

/* ------------------------------------------------------------------ *
 * Main scene calculation
 * ------------------------------------------------------------------ */

const getCelestialScene = (
  times: { [key: string]: string },
  nowDate: Date,
  overrides?: {
    sunrise?: string;
    sunset?: string;
    testMinutes?: number;
    hijriDate?: number | { day: number; month?: number; year?: number };
    path?: CelestialPath;
  }
) => {
  const fajrMinutes = parseTimeToMinutes(getPrayerTimeValue(times, ['fajr', 'Fajr']));
  const sunriseMinutes =
    parseTimeToMinutes(overrides?.sunrise || '') ??
    parseTimeToMinutes(getPrayerTimeValue(times, ['sunrise', 'Sunrise', 'shurooq', 'Shurooq']));
  const maghribMinutes = parseTimeToMinutes(getPrayerTimeValue(times, ['maghrib', 'Maghrib']));
  const sunsetMinutes =
    parseTimeToMinutes(overrides?.sunset || '') ??
    parseTimeToMinutes(getPrayerTimeValue(times, ['sunset', 'Sunset'])) ??
    maghribMinutes;

  const sunrise = sunriseMinutes ?? (fajrMinutes !== null ? clamp(fajrMinutes + 25, 0, 1439) : 360);
  const sunset = sunsetMinutes ?? clamp(sunrise + 12 * 60, 0, 1439);

  const path: CelestialPath = { ...DEFAULT_CELESTIAL_PATH, ...(overrides?.path || {}) };

  const currentMinutes =
    overrides?.testMinutes !== undefined
      ? clamp(overrides.testMinutes, 0, 1439)
      : nowDate.getHours() * 60 + nowDate.getMinutes() + nowDate.getSeconds() / 60;

  const daylight = Math.max(1, sunset - sunrise);
  const nightLength = Math.max(1, sunrise + 1440 - sunset);
  const isDay = currentMinutes >= sunrise && currentMinutes <= sunset;

  // ---- clock time  ->  solar hour (6 = sunrise, 12 = noon, 18 = sunset) ----
  let solarHour: number;
  let dayProgress = 0;
  let nightProgress = 0;

  if (isDay) {
    dayProgress = clamp((currentMinutes - sunrise) / daylight, 0, 1);
    solarHour = 6 + dayProgress * 12;
  } else {
    const shifted = currentMinutes < sunrise ? currentMinutes + 1440 : currentMinutes;
    nightProgress = clamp((shifted - sunset) / nightLength, 0, 1);
    solarHour = (18 + nightProgress * 12) % 24;
  }

  const palette = getPaletteForSolarHour(solarHour);

  // ---- positions -----------------------------------------------------------
  const sunPoint = getCubicPoint(dayProgress, path);

  const moonVisibleStart = clamp(sunset - HANDOFF_WINDOW, 0, 1439);
  const moonVisibleEnd = clamp(sunrise + HANDOFF_WINDOW, 0, 1439);
  const moonShifted = currentMinutes < moonVisibleStart ? currentMinutes + 1440 : currentMinutes;
  const moonProgress = clamp(
    (moonShifted - moonVisibleStart) / Math.max(1, moonVisibleEnd + 1440 - moonVisibleStart),
    0,
    1
  );
  const moonPoint = getCubicPoint(moonProgress, path);

  // ---- visibility / fading -------------------------------------------------
  // The fade is tied to the JOURNEY, not the clock: the sun is invisible while
  // it is still tucked behind the prayer card, and it is fully gone the moment
  // it reaches the three-dot menu — in every season.
  const showSun = isDay;
  const sunOpacity = !showSun ? 0 : pathFade(dayProgress, 0.055);

  const inWrappedWindow = (current: number, start: number, end: number) =>
    start <= end ? current >= start && current <= end : current >= start || current <= end;

  const showMoon = inWrappedWindow(currentMinutes, moonVisibleStart, moonVisibleEnd);
  const moonFadeIn = clamp((moonShifted - moonVisibleStart) / HANDOFF_WINDOW, 0, 1);
  const moonFadeOut = clamp((moonVisibleEnd + 1440 - moonShifted) / HANDOFF_WINDOW, 0, 1);
  const moonOpacity = !showMoon ? 0 : Math.min(moonFadeIn, moonFadeOut);

  // ---- Hijri date and the shape of the moon -------------------------------
  // The Islamic day starts at Maghrib, so the phase advances at sunset — the
  // same moment the Hijri date ticks over.
  const computedHijri = getHijriDate(nowDate);
  const hijriOverride = overrides?.hijriDate;
  const hijri =
    typeof hijriOverride === 'number'
      ? { day: clamp(Math.round(hijriOverride), 1, 30), month: computedHijri.month, year: computedHijri.year }
      : hijriOverride && typeof hijriOverride === 'object' && hijriOverride.day
      ? {
          day: clamp(Math.round(hijriOverride.day), 1, 30),
          month: hijriOverride.month ?? computedHijri.month,
          year: hijriOverride.year ?? computedHijri.year,
        }
      : computedHijri;

  const dayFraction = ((currentMinutes - sunset + 1440) % 1440) / 1440; // 0 at Maghrib
  const moonPhase = getMoonPhase(hijri.day, dayFraction, hijri.month, hijri.year);

  // ---- horizon afterglow follows the (real) sun, even below the horizon ----
  // After sunset it sits where the sun went down (right), then slides across
  // the bottom to where it will come up (left) by the time fajr arrives.
  const glowX = isDay ? sunPoint.x : lerp(path.end.x, path.start.x, nightProgress);

  const skyBackground = `linear-gradient(180deg, ${css(palette.top)} 0%, ${css(
    palette.mid
  )} 48%, ${css(palette.bottom)} 100%)`;

  const horizonGlow = `radial-gradient(120% 90% at ${glowX.toFixed(1)}% 112%, ${cssA(
    palette.haze,
    palette.hazeOpacity
  )} 0%, ${cssA(palette.haze, palette.hazeOpacity * 0.45)} 34%, ${cssA(
    palette.haze,
    0
  )} 72%), radial-gradient(180deg, ${cssA(palette.haze, palette.hazeOpacity * 0.22)} 0%, ${cssA(
    palette.haze,
    0
  )} 46%)`;

  // Handy if you want to drive other UI from the current mood of the sky.
  const phase: 'night' | 'predawn' | 'dawn' | 'sunrise' | 'morning' | 'day' | 'afternoon' | 'golden' | 'dusk' =
    !isDay
      ? solarHour >= 19.6 || solarHour < 3.8
        ? 'night'
        : solarHour < 5
        ? 'predawn'
        : solarHour < 6
        ? 'dawn'
        : 'dusk'
      : solarHour < 6.35
      ? 'sunrise'
      : solarHour < 8.6
      ? 'morning'
      : solarHour < 15.4
      ? 'day'
      : solarHour < 17.1
      ? 'afternoon'
      : 'golden';

  return {
    solarHour,
    phase,
    isDay,
    showSun,
    showMoon,
    hijri,
    skyBackground,
    horizonGlow,
    starOpacity: clamp(palette.star, 0, 1),
    sun: {
      x: sunPoint.x,
      y: sunPoint.y,
      opacity: clamp(sunOpacity, 0, 1),
      scale: palette.sunSize,
      core: `radial-gradient(circle at 36% 32%, ${css(palette.sunCore)} 0%, ${css(
        palette.sunMid
      )} 44%, ${css(palette.sunEdge)} 100%)`,
      halo: `radial-gradient(circle, ${cssA(palette.sunGlow, 0.5 * palette.sunGlowOpacity)} 0%, ${cssA(
        palette.sunGlow,
        0.26 * palette.sunGlowOpacity
      )} 38%, ${cssA(palette.sunGlow, 0)} 72%)`,
      ring: cssA(palette.sunGlow, 0.35 * palette.sunGlowOpacity),
      shadow:
        `0 0 16px ${cssA(palette.sunGlow, 0.55 * palette.sunGlowOpacity)}, ` +
        `0 0 42px ${cssA(palette.sunGlow, 0.3 * palette.sunGlowOpacity)}, ` +
        `0 0 90px ${cssA(palette.sunGlow, 0.14 * palette.sunGlowOpacity)}`,
    },
    moon: {
      x: moonPoint.x,
      y: moonPoint.y,
      opacity: clamp(moonOpacity, 0, 1) * 0.98,
      scale: 0.98 + Math.sin(moonProgress * Math.PI) * 0.08,
      light: css(palette.moonLight),
      dark: css(palette.moonDark),
      // a thin crescent does not light up the sky as much as a full moon
      glowOpacity: clamp(palette.moonGlowOpacity * (0.28 + 0.72 * moonPhase.illuminated), 0, 1),
      litPath: moonPhase.path,
      waxing: moonPhase.waxing,
      illuminated: moonPhase.illuminated,
      age: moonPhase.age,
    },
    cloud: {
      top: cssA(palette.cloudTop, palette.cloudOpacity),
      bottom: cssA(palette.cloudBottom, palette.cloudOpacity * 0.55),
    },
  };
};

/* ------------------------------------------------------------------ *
 * Static decorations
 * ------------------------------------------------------------------ */

const STAR_COUNT = 46;

const useStarField = () =>
  useMemo(() => {
    let seed = 20240517;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    return Array.from({ length: STAR_COUNT }, (_, index) => ({
      id: index,
      left: random() * 100,
      top: random() * 68,
      size: 0.9 + random() * 2,
      base: 0.32 + random() * 0.68,
      duration: 2.6 + random() * 4.4,
      delay: random() * 6,
    }));
  }, []);

const CLOUDS = [
  { top: 16, scale: 0.9, duration: 74, delay: -6 },
  { top: 44, scale: 1.25, duration: 96, delay: -48 },
  { top: 66, scale: 0.72, duration: 62, delay: -30 },
];

const SCENE_CSS = `
  .celestial-cloud { position: absolute; left: -30%; animation-name: celestial-drift; animation-timing-function: linear; animation-iteration-count: infinite; will-change: left; }
  .celestial-cloud-piece { position: absolute; bottom: 0; border-radius: 999px; }
  .celestial-star { position: absolute; border-radius: 999px; background: #ffffff; animation: celestial-twinkle ease-in-out infinite; }
  .celestial-sun-halo { position: absolute; inset: -120%; border-radius: 999px; animation: celestial-breathe 5.4s ease-in-out infinite; }
  .celestial-moon-halo { position: absolute; inset: -70%; border-radius: 999px; animation: celestial-breathe 6.8s ease-in-out infinite; }
  @keyframes celestial-drift { from { left: -32%; } to { left: 118%; } }
  @keyframes celestial-twinkle { 0%, 100% { opacity: 0.25; transform: scale(0.75); } 50% { opacity: 1; transform: scale(1.15); } }
  @keyframes celestial-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
  @media (prefers-reduced-motion: reduce) {
    .celestial-cloud, .celestial-star, .celestial-sun-halo, .celestial-moon-halo { animation: none !important; }
  }
`;

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

const CelestialHeaderScene: React.FC<CelestialHeaderSceneProps> = ({
  prayerTimes,
  testMinutes,
  sunrise,
  sunset,
  hijriDate,
  path,
  updateIntervalMs = 15000,
}) => {
  const [now, setNow] = useState(() => new Date());
  const stars = useStarField();

  useEffect(() => {
    if (testMinutes !== undefined) return undefined;
    const updateNow = () => setNow(new Date());
    updateNow();
    const intervalId = window.setInterval(updateNow, updateIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [testMinutes, updateIntervalMs]);

  const scene = getCelestialScene(prayerTimes, now, { sunrise, sunset, testMinutes, hijriDate, path });

  return (
    <>
      <style>{SCENE_CSS}</style>

      {/* sky gradient */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background: scene.skyBackground,
          transition: 'background 1200ms linear',
        }}
      />

      {/* horizon glow / twilight afterglow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background: scene.horizonGlow,
          transition: 'background 1200ms linear',
        }}
      />

      {/* stars */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          opacity: scene.starOpacity,
          transition: 'opacity 1600ms linear',
        }}
      >
        {stars.map(star => (
          <span
            key={star.id}
            className="celestial-star"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              width: star.size,
              height: star.size,
              opacity: star.base,
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      {/* drifting clouds, tinted by the current light */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 3, overflow: 'hidden' }}>
        {CLOUDS.map((cloud, index) => (
          <div
            key={index}
            className="celestial-cloud"
            style={{
              top: `${cloud.top}%`,
              transform: `scale(${cloud.scale})`,
              animationDuration: `${cloud.duration}s`,
              animationDelay: `${cloud.delay}s`,
              opacity: 0.75,
            }}
          >
            <div style={{ position: 'relative', height: 14, width: 58 }}>
              <span
                className="celestial-cloud-piece"
                style={{ left: 0, width: 30, height: 11, background: scene.cloud.top }}
              />
              <span
                className="celestial-cloud-piece"
                style={{ left: 14, width: 26, height: 14, background: scene.cloud.top }}
              />
              <span
                className="celestial-cloud-piece"
                style={{ left: 32, width: 26, height: 10, background: scene.cloud.bottom }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* sun + moon */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 10, overflow: 'hidden' }}>
        {scene.showSun && (
          <div
            style={{
              position: 'absolute',
              left: `${scene.sun.x}%`,
              top: `${scene.sun.y}%`,
              opacity: scene.sun.opacity,
              transform: `translate(-50%, -50%) scale(${scene.sun.scale})`,
              transition: 'left 1200ms linear, top 1200ms linear, opacity 1200ms linear, transform 1200ms linear',
            }}
          >
            <div style={{ position: 'relative', height: 44, width: 44 }}>
              <div className="celestial-sun-halo" style={{ background: scene.sun.halo }} />
              <div
                style={{
                  position: 'absolute',
                  inset: -8,
                  borderRadius: 999,
                  border: `1px solid ${scene.sun.ring}`,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 999,
                  background: scene.sun.core,
                  border: '1px solid rgba(255,255,255,0.35)',
                  boxShadow: scene.sun.shadow,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: 9,
                    top: 8,
                    height: 8,
                    width: 8,
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.55)',
                    filter: 'blur(1px)',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {scene.showMoon && (
          <div
            style={{
              position: 'absolute',
              left: `${scene.moon.x}%`,
              top: `${scene.moon.y}%`,
              opacity: scene.moon.opacity,
              transform: `translate(-50%, -50%) scale(${scene.moon.scale})`,
              transition: 'left 1300ms linear, top 1300ms linear, opacity 1300ms linear, transform 1300ms linear',
            }}
          >
            <div style={{ position: 'relative', height: 42, width: 42 }}>
              <div
                className="celestial-moon-halo"
                style={{
                  background: `radial-gradient(circle, rgba(255,255,255,${(
                    0.3 * scene.moon.glowOpacity
                  ).toFixed(3)}) 0%, rgba(226,238,255,${(0.16 * scene.moon.glowOpacity).toFixed(
                    3
                  )}) 42%, rgba(226,238,255,0) 74%)`,
                }}
              />
              <svg viewBox="0 0 48 48" width="100%" height="100%">
                <defs>
                  {/* sunlit surface */}
                  <linearGradient id="celestialMoonFill" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={scene.moon.light} />
                    <stop offset="52%" stopColor={scene.moon.light} />
                    <stop offset="100%" stopColor={scene.moon.dark} />
                  </linearGradient>
                  {/* the lit part doubles as a clip, so the maria follow the phase */}
                  <clipPath id="celestialMoonLit" clipPathUnits="userSpaceOnUse">
                    <path
                      d={scene.moon.litPath}
                      transform={scene.moon.waxing ? undefined : `translate(48, 0) scale(-1, 1)`}
                    />
                  </clipPath>
                  <radialGradient id="celestialMoonShade" cx="38%" cy="30%" r="78%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                    <stop offset="100%" stopColor="rgba(15,23,42,0.35)" />
                  </radialGradient>
                </defs>

                {/* dark side of the moon — faintly lit by earthshine */}
                <circle cx="24" cy="24" r="17" fill="rgba(226,238,255,0.10)" stroke="rgba(255,255,255,0.16)" />

                {/* sunlit part */}
                <g clipPath="url(#celestialMoonLit)">
                  <path
                    d={scene.moon.litPath}
                    fill="url(#celestialMoonFill)"
                    transform={scene.moon.waxing ? undefined : `translate(48, 0) scale(-1, 1)`}
                  />
                  {/* maria — the familiar dark patches of the full moon */}
                  <g fill="rgba(148,163,184,0.20)">
                    <ellipse cx="18" cy="15" rx="5.4" ry="4.2" />
                    <ellipse cx="29" cy="18" rx="3.4" ry="3.0" />
                    <ellipse cx="16" cy="27" rx="4.2" ry="3.6" />
                    <ellipse cx="27" cy="31" rx="3.0" ry="2.4" />
                    <ellipse cx="35" cy="27" rx="2.2" ry="2.6" />
                  </g>
                  <circle cx="24" cy="24" r="17" fill="url(#celestialMoonShade)" />
                </g>
              </svg>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CelestialHeaderScene;
