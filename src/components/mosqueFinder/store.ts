/* Two-layer cache: in-memory Map + localStorage with TTL, stale fallback,
   quota-safe pruning and a startup sweep. Keys are namespaced 'mf2:'. */

const mem = new Map<string, { t: number; v: unknown }>();
const P = 'mf2:';
const HARD_MAX = 24 * 3600 * 1000; // entries older than 24h are dropped on startup

export const TTL_MOSQUES = 30 * 60 * 1000; // 30 minutes
export const TTL_GEOCODE = 7 * 24 * 3600 * 1000; // 7 days (places don't move; also respects Nominatim rate limits)
export const TTL_ROUTE = 30 * 60 * 1000; // 30 minutes
export const STALE_MAX = 24 * 3600 * 1000; // offline fallback window

function raw(key: string): { t: number; v: unknown } | null {
  if (mem.has(key)) return mem.get(key)!;
  try {
    const s = localStorage.getItem(P + key);
    if (!s) return null;
    const o = JSON.parse(s);
    if (!o || typeof o.t !== 'number') return null;
    mem.set(key, o);
    return o;
  } catch {
    return null;
  }
}

export function get<T>(key: string, ttl: number): T | null {
  const o = raw(key);
  if (!o || Date.now() - o.t > ttl) return null;
  return o.v as T;
}

/** expired-but-recent data, used as offline fallback */
export function getStale<T>(key: string, maxAge: number): T | null {
  const o = raw(key);
  if (!o || Date.now() - o.t > maxAge) return null;
  return o.v as T;
}

export function set(key: string, v: unknown): void {
  const o = { t: Date.now(), v };
  mem.set(key, o);
  try {
    localStorage.setItem(P + key, JSON.stringify(o));
  } catch {
    pruneOldest();
    try {
      localStorage.setItem(P + key, JSON.stringify(o));
    } catch {
      /* storage unavailable (private mode etc.) — memory layer still works */
    }
  }
}

function pruneOldest(): void {
  try {
    const entries: [string, number][] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(P) && !k.startsWith(P + 'pref:')) {
        let t = 0;
        try {
          t = JSON.parse(localStorage.getItem(k) as string).t || 0;
        } catch {
          /* ignore */
        }
        entries.push([k, t]);
      }
    }
    entries.sort((a, b) => a[1] - b[1]);
    entries
      .slice(0, Math.max(1, Math.ceil(entries.length / 2)))
      .forEach(([k]) => {
        localStorage.removeItem(k);
        mem.delete(k.slice(P.length));
      });
  } catch {
    /* ignore */
  }
}

export function startupClean(): void {
  try {
    const now = Date.now();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(P) && !k.startsWith(P + 'pref:')) {
        try {
          const o = JSON.parse(localStorage.getItem(k) as string);
          if (!o || now - o.t > HARD_MAX) {
            localStorage.removeItem(k);
            mem.delete(k.slice(P.length));
          }
        } catch {
          localStorage.removeItem(k);
        }
      }
    }
  } catch {
    /* ignore */
  }
}

export function prefSet(k: string, v: string): void {
  try {
    localStorage.setItem(P + 'pref:' + k, String(v));
  } catch {
    /* ignore */
  }
}

export function prefGet(k: string): string | null {
  try {
    return localStorage.getItem(P + 'pref:' + k);
  } catch {
    return null;
  }
}
