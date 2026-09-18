/* Geometry + formatting helpers (Haversine, bearings, display units). */

export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371008.8; // mean earth radius (m) — slightly more accurate than 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Initial great-circle bearing (deg, clockwise from true north). */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(r(lon2 - lon1)) * Math.cos(r(lat2));
  const x =
    Math.cos(r(lat1)) * Math.sin(r(lat2)) -
    Math.sin(r(lat1)) * Math.cos(r(lat2)) * Math.cos(r(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function fmtDist(d: number): string {
  if (d < 950) return Math.round(d / 10) * 10 + ' m';
  const km = d / 1000;
  return (km < 10 ? km.toFixed(1) : String(Math.round(km))) + ' km';
}

export function fmtDur(sec: number): string {
  const min = Math.max(1, Math.round(sec / 60));
  if (min < 60) return min + ' min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** HTML-escape for strings injected into Leaflet popups (React escapes JSX itself). */
export function esc(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
