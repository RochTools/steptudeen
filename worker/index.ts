/**
 * steptudeen-notify — Cloudflare Worker
 *
 * 1) ہر منٹ (cron): ہر مسجد کی آج کی جماعت نکالتا ہے۔ جس مسجد کی جماعت "اسی منٹ" ہو،
 *    اس کے FCM topic (`mosque_<id>`) پر پش بھیجتا ہے۔ جماعت کا حساب ایپ والے ہی
 *    کوڈ (src/lib/prayerEngine.ts + iqama.ts) سے ہوتا ہے، اس لیے ایپ اور نوٹیفکیشن کا وقت ایک ہی رہتا ہے۔
 * 2) POST /follow : فون کا FCM ٹوکن کسی مسجد کے topic میں ڈالتا/نکالتا ہے (گھنٹی دبانے پر)۔
 * 3) POST /test   : (ADMIN_KEY کے ساتھ) کسی مسجد کے topic پر ٹیسٹ پش۔
 * 4) GET  /health : کتنی مساجد پڑھیں۔
 */
import { PrayerConfig, PrayerName, PRAYER_NAMES, computeDay, DEFAULT_PRAYER_CONFIG } from '../src/lib/prayerEngine';
import { IqamaSchedule, pickSchedule, resolveIqama } from '../src/lib/iqama';
import { getHijriMath } from '../src/constants/hijri';

interface KV {
  get(key: string, type: 'json'): Promise<any>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
interface Env {
  STATE: KV;
  FIREBASE_PROJECT_ID: string;
  FCM_SERVICE_ACCOUNT: string;
  ADMIN_KEY?: string;
}

interface MosqueLite {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  prayerConfig?: PrayerConfig;
  iqamaSchedule?: IqamaSchedule;
  iqamaHistory?: IqamaSchedule[];
  offsets?: Partial<Record<PrayerName, number>>;
}

const DEFAULT_TZ = 'Asia/Karachi';
const LIST_TTL_MS = 30 * 60 * 1000;                 // مساجد کی فہرست ہر 30 منٹ بعد تازہ
const DEFAULT_OFFSETS: Record<PrayerName, number> = { fajr: 15, zuhr: 15, asr: 15, maghrib: 5, isha: 15 };

const NAMES_UR: Record<PrayerName, string> = {
  fajr: 'فجر', zuhr: 'ظہر', asr: 'عصر', maghrib: 'مغرب', isha: 'عشاء',
};

// ── Firestore کی ٹائپ والی قدریں عام JS میں ──────────────────────────────────
export function decodeValue(v: any): any {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) {
    const out: Record<string, any> = {};
    for (const [k, val] of Object.entries(v.mapValue.fields ?? {})) out[k] = decodeValue(val);
    return out;
  }
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decodeValue);
  return null;
}

// ── سروس اکاؤنٹ → OAuth ٹوکن (WebCrypto، کوئی لائبریری نہیں) ───────────────────
const b64url = (data: ArrayBuffer | string): string => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export async function signJwt(sa: { client_email: string; private_key: string }, scope: string, nowSec: number): Promise<string> {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email, scope, aud: 'https://oauth2.googleapis.com/token',
    iat: nowSec, exp: nowSec + 3600,
  }));
  const pem = sa.private_key.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claim}`));
  return `${header}.${claim}.${b64url(sig)}`;
}

let memToken: { value: string; exp: number } | null = null;

async function getAccessToken(env: Env): Promise<string> {
  const now = Date.now();
  if (memToken && memToken.exp > now + 60_000) return memToken.value;
  const cached = await env.STATE.get('access_token', 'json');
  if (cached && cached.exp > now + 60_000) {
    memToken = cached;
    return cached.value;
  }
  const sa = JSON.parse(env.FCM_SERVICE_ACCOUNT);
  const jwt = await signJwt(sa, 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase.messaging', Math.floor(now / 1000));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error('token ' + res.status + ' ' + (await res.text()).slice(0, 200));
  const data = (await res.json()) as { access_token: string; expires_in: number };
  const tok = { value: data.access_token, exp: now + (data.expires_in - 120) * 1000 };
  memToken = tok;
  await env.STATE.put('access_token', JSON.stringify(tok), { expirationTtl: Math.max(60, data.expires_in - 120) });
  return tok.value;
}

// ── مساجد کی فہرست (Firestore REST، KV میں کیش) ───────────────────────────────
const FIELDS = ['name', 'latitude', 'longitude', 'prayerConfig', 'iqamaSchedule', 'iqamaHistory',
  'fajrOffset', 'zuhrOffset', 'asrOffset', 'maghribOffset', 'ishaOffset'];

async function fetchMosques(env: Env): Promise<MosqueLite[]> {
  const token = await getAccessToken(env);
  const out: MosqueLite[] = [];
  let pageToken = '';
  do {
    const qs = new URLSearchParams({ pageSize: '300' });
    FIELDS.forEach((f) => qs.append('mask.fieldPaths', f));
    if (pageToken) qs.set('pageToken', pageToken);
    const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/mosques?${qs}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('firestore ' + res.status + ' ' + (await res.text()).slice(0, 200));
    const data = (await res.json()) as { documents?: any[]; nextPageToken?: string };
    for (const d of data.documents ?? []) {
      const f: Record<string, any> = {};
      for (const [k, v] of Object.entries(d.fields ?? {})) f[k] = decodeValue(v);
      if (typeof f.latitude !== 'number' || typeof f.longitude !== 'number') continue;
      const offsets: Partial<Record<PrayerName, number>> = {};
      for (const p of PRAYER_NAMES) if (typeof f[`${p}Offset`] === 'number') offsets[p] = f[`${p}Offset`];
      out.push({
        id: String(d.name).split('/').pop() as string,
        name: f.name || 'مسجد',
        latitude: f.latitude, longitude: f.longitude,
        prayerConfig: f.prayerConfig && Object.keys(f.prayerConfig).length ? f.prayerConfig : undefined,
        iqamaSchedule: f.iqamaSchedule ?? undefined,
        iqamaHistory: Array.isArray(f.iqamaHistory) ? f.iqamaHistory : undefined,
        offsets,
      });
    }
    pageToken = data.nextPageToken ?? '';
  } while (pageToken);
  return out;
}

async function getMosques(env: Env, force = false): Promise<MosqueLite[]> {
  const cached = await env.STATE.get('mosques', 'json');
  if (!force && cached && Date.now() - cached.at < LIST_TTL_MS) return cached.list as MosqueLite[];
  try {
    const list = await fetchMosques(env);
    await env.STATE.put('mosques', JSON.stringify({ at: Date.now(), list }));
    return list;
  } catch (err) {
    console.error('mosque list refresh failed', err);
    if (cached?.list) return cached.list as MosqueLite[];   // پرانی فہرست سے کام چلاؤ
    throw err;
  }
}

// ── مسجد کے اپنے ٹائم زون میں "اب" ───────────────────────────────────────────
const fmtCache = new Map<string, Intl.DateTimeFormat>();
export function localParts(now: Date, timeZone: string) {
  let fmt = fmtCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    fmtCache.set(timeZone, fmt);
  }
  const parts = fmt.formatToParts(now);
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: g('year'), m: g('month'), d: g('day'), minutes: (g('hour') % 24) * 60 + g('minute') };
}

const dayCache = new Map<string, Record<PrayerName, string>>();

/** آج کی جماعت (ایپ کے mosqueDayJamaat والا ہی اصول) */
export function jamaatToday(m: MosqueLite, now: Date): { times: Record<PrayerName, string>; minutes: number } {
  const tz = m.prayerConfig?.timeZone || DEFAULT_TZ;
  const { y, m: mo, d, minutes } = localParts(now, tz);
  const dateKey = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const ck = `${m.id}|${dateKey}|${JSON.stringify([m.prayerConfig, m.iqamaSchedule, m.iqamaHistory?.length, m.offsets])}`;
  const hit = dayCache.get(ck);
  if (hit) return { times: hit, minutes };
  if (dayCache.size > 5000) dayCache.clear();
  // adhan تاریخ runtime کے مقامی (Worker میں UTC) y/m/d سے پڑھتا ہے؛ اس لیے مسجد کی تاریخ UTC میں بنائی
  const dayDate = new Date(Date.UTC(y, mo - 1, d, 12));

  const config: PrayerConfig = { ...(m.prayerConfig ?? DEFAULT_PRAYER_CONFIG), timeZone: tz };
  const adhan = computeDay(m.latitude, m.longitude, dayDate, config);

  const schedules: IqamaSchedule[] = [...(m.iqamaHistory ?? []), ...(m.iqamaSchedule ? [m.iqamaSchedule] : [])];
  const legacy: IqamaSchedule = {
    effectiveFrom: '1970-01-01',
    iqama: Object.fromEntries(PRAYER_NAMES.map((p) => [p, { delay: m.offsets?.[p] ?? DEFAULT_OFFSETS[p] }])) as IqamaSchedule['iqama'],
  };
  const schedule = pickSchedule(schedules, dateKey) ?? legacy;
  const isRamadan = getHijriMath(dayDate).hMonth === 9;
  const iqama = resolveIqama(schedule, dateKey, adhan, { isRamadan });

  const times = {} as Record<PrayerName, string>;
  for (const p of PRAYER_NAMES) times[p] = iqama[p] ?? adhan[p];
  dayCache.set(ck, times);
  return { times, minutes };
}

const toMin = (t: string) => { const [h, mi] = t.split(':').map(Number); return (h || 0) * 60 + (mi || 0); };

/** "18:12" → "6:12" */
export const pretty12 = (t: string) => { const [h, mi] = t.split(':').map(Number); return `${h % 12 || 12}:${String(mi).padStart(2, '0')}`; };

export const topicOf = (id: string) => `mosque_${id}`;

export function buildMessage(m: MosqueLite, prayer: PrayerName, time: string) {
  return {
    message: {
      topic: topicOf(m.id),
      data: {
        title: `🕌 ${NAMES_UR[prayer]} کی جماعت کا وقت`,
        body: `آپ کے قریب ${m.name} میں ${NAMES_UR[prayer]} کا وقت ہو چکا ہے (${pretty12(time)})`,
        tag: `jamaat-${m.id}-${prayer}`,
        mosqueId: m.id,
        prayer,
      },
      webpush: { headers: { TTL: '600', Urgency: 'high' } },   // 10 منٹ سے پرانا پش نہ پہنچے
    },
  };
}

async function sendFcm(env: Env, body: unknown): Promise<void> {
  const token = await getAccessToken(env);
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error('fcm send failed', res.status, (await res.text()).slice(0, 300));
}

// ── cron: ہر منٹ ──────────────────────────────────────────────────────────────
async function tick(env: Env, now = new Date()): Promise<number> {
  const mosques = await getMosques(env);
  const jobs: Promise<void>[] = [];
  for (const m of mosques) {
    try {
      const { times, minutes } = jamaatToday(m, now);
      for (const p of PRAYER_NAMES) {
        if (toMin(times[p]) === minutes) jobs.push(sendFcm(env, buildMessage(m, p, times[p])));
      }
    } catch (err) {
      console.error('skip mosque', m.id, err);
    }
  }
  await Promise.all(jobs);
  return jobs.length;
}

// ── HTTP: /follow /test /health ───────────────────────────────────────────────
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
};
const reply = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function topicSubscribe(env: Env, token: string, topic: string, follow: boolean): Promise<boolean> {
  const access = await getAccessToken(env);
  const res = await fetch(`https://iid.googleapis.com/iid/v1:${follow ? 'batchAdd' : 'batchRemove'}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json', access_token_auth: 'true' },
    body: JSON.stringify({ to: `/topics/${topic}`, registration_tokens: [token] }),
  });
  if (!res.ok) { console.error('iid', res.status, (await res.text()).slice(0, 300)); return false; }
  const data = (await res.json()) as { results?: { error?: string }[] };
  return !data.results?.[0]?.error;
}

async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

  if (url.pathname === '/health') {
    // /health?check=1&key=ADMIN_KEY : ابھی مساجد پڑھ کر دکھاؤ، ناکامی ہو تو اصل وجہ بتاؤ
    if (url.searchParams.get('check') && env.ADMIN_KEY && url.searchParams.get('key') === env.ADMIN_KEY) {
      try {
        const list = await getMosques(env, true);
        let sample: string[] = [];
        try {
          const now = new Date();
          sample = list.slice(0, 5).map((m) => { const j = jamaatToday(m, now).times; return `${m.name} [id: ${m.id}]: ${j.fajr} ${j.zuhr} ${j.asr} ${j.maghrib} ${j.isha}`; });
        } catch (e) { sample = ['حساب میں ایرر: ' + String((e as Error)?.message ?? e).slice(0, 200)]; }
        return reply({ ok: true, mosques: list.length, sample });
      } catch (e) {
        return reply({ ok: false, hasKey: !!env.FCM_SERVICE_ACCOUNT, error: String((e as Error)?.message ?? e).slice(0, 400) });
      }
    }
    const c = await env.STATE.get('mosques', 'json');
    return reply({ ok: true, hasKey: !!env.FCM_SERVICE_ACCOUNT, mosques: c?.list?.length ?? 0, refreshedAt: c?.at ? new Date(c.at).toISOString() : null });
  }

  // /test براؤزر سے بھی: /test?key=ADMIN_KEY&mosque=ID
  if (url.pathname === '/test' && req.method === 'GET') {
    if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) return reply({ error: 'forbidden' }, 403);
    const list = await getMosques(env, true);
    const m = list.find((x) => x.id === url.searchParams.get('mosque'));
    if (!m) return reply({ error: 'unknown mosque' }, 404);
    await sendFcm(env, buildMessage(m, 'maghrib', jamaatToday(m, new Date()).times.maghrib));
    return reply({ ok: true, sentTo: topicOf(m.id) });
  }

  if (req.method !== 'POST') return reply({ error: 'not found' }, 404);
  const body = (await req.json().catch(() => ({}))) as Record<string, any>;

  if (url.pathname === '/follow') {
    const { token, mosqueId, follow } = body;
    if (typeof token !== 'string' || token.length < 50 || token.length > 4096) return reply({ error: 'bad token' }, 400);
    if (typeof mosqueId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(mosqueId)) return reply({ error: 'bad mosque' }, 400);
    let list = await getMosques(env);
    if (!list.some((m) => m.id === mosqueId)) list = await getMosques(env, true);   // نئی رجسٹر مسجد
    if (!list.some((m) => m.id === mosqueId)) return reply({ error: 'unknown mosque' }, 404);
    const ok = await topicSubscribe(env, token, topicOf(mosqueId), follow !== false);
    return ok ? reply({ ok: true }) : reply({ error: 'subscribe failed' }, 502);
  }

  if (url.pathname === '/test') {
    if (!env.ADMIN_KEY || req.headers.get('X-Admin-Key') !== env.ADMIN_KEY) return reply({ error: 'forbidden' }, 403);
    const list = await getMosques(env, true);
    const m = list.find((x) => x.id === body.mosqueId);
    if (!m) return reply({ error: 'unknown mosque' }, 404);
    await sendFcm(env, buildMessage(m, 'maghrib', jamaatToday(m, new Date()).times.maghrib));
    return reply({ ok: true, sentTo: topicOf(m.id) });
  }
  return reply({ error: 'not found' }, 404);
}

export default {
  async scheduled(_e: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    ctx.waitUntil(tick(env).catch((err) => console.error('tick failed', err)));
  },
  async fetch(req: Request, env: Env): Promise<Response> {
    try { return await handle(req, env); }
    catch (err) { console.error(err); return reply({ error: 'server error' }, 500); }
  },
};
