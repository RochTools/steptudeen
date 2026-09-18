/* Shared types for the MosqueFinder component (ported from the standalone
   masjid-finder HTML app — same logic, same design, same perf choices). */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Compact cached form (Overpass → stored). Note: `lon` (not lng) — matches Overpass. */
export interface MosqueLite {
  name: string;
  lat: number;
  lon: number;
}

/** A search result = cached mosque + straight-line distance from search center. */
export interface MosqueResult extends MosqueLite {
  distance: number;
}

/** Cached OSRM route summary. s = source; 'straight' = fallback line. */
export interface RouteData {
  d: number;
  t: number | null;
  c: [number, number][] | null;
  s: 'osrm' | 'straight';
}

export interface GeocodeHit {
  lat: number;
  lng: number;
  label: string;
}

export type StatusTone = 'loading' | 'success' | 'error';

export interface StatusMsg {
  tone: StatusTone;
  msg: string;
}

/** Text state of the top route bar (null = hidden). */
export interface RouteInfo {
  name: string;
  remain: string;
  badge: string;
  warn: boolean;
}
