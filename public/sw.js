// StepToDeen Service Worker — Offline v12
// ───────────────────────────────────────────────────────────────────────────
// v10 میں `install` event کی لائن غائب تھی جس سے فائل میں SyntaxError آ رہا تھا
// اور SW register ہی نہیں ہو رہا تھا۔ اس ورژن میں:
//   • install ٹھیک کیا گیا
//   • index.html کے اندر سے Vite کی hashed JS/CSS فائلیں نکال کر precache ہوتی ہیں
//   • ہر strategy میں offline fallback ہے
//   • raw.githubusercontent.com (Quran fallback) اور firebase config بھی cache ہوتے ہیں
// ───────────────────────────────────────────────────────────────────────────

const VERSION     = 'v12';
const CACHE_NAME  = `steptudeen-${VERSION}`;
const CDN_CACHE   = `steptudeen-cdn-${VERSION}`;
const FONTS_CACHE = `steptudeen-fonts-${VERSION}`;

const ALL_CACHES = [CACHE_NAME, CDN_CACHE, FONTS_CACHE];

// ── Quran precache (v12) ─────────────────────────────────────────────────────
// یہ URLs QuranView.tsx کے QURAN_CDN / font @font-face سے بالکل میل کھانے چاہییں،
// ورنہ cache میں الگ entries بنیں گی اور آف لائن میں کام نہیں کریں گی۔
const QURAN_CDN_BASE = 'https://cdn.jsdelivr.net/gh/RochTools/quran-api@main/Quran/';
const QURAN_FONT_URL = 'https://cdn.jsdelivr.net/gh/mustafa0x/qpc-fonts@f93bf5f3/various-woff2/UthmanicHafs1%20Ver09.woff2';
const SURAH_COUNT    = 114;
const PRECACHE_BATCH = 6;          // ایک وقت میں کتنی سورتیں (موبائل پر نرمی)
const SAFE_LANG      = /^[a-z]{2,3}$/;

let precacheRunning = null;        // موجودہ زبان جس کا precache چل رہا ہے

async function broadcast(msg) {
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of list) c.postMessage(msg);
}

// ایک زبان کی 114 سورتیں cache میں ڈالتا ہے، ہر قدم پر progress بھیجتا ہے۔
// جو سورتیں پہلے سے cache میں ہوں انہیں دوبارہ ڈاؤن لوڈ نہیں کرتا (resume).
async function precacheQuran(lang) {
  if (!SAFE_LANG.test(lang)) {
    await broadcast({ type: 'QURAN_PRECACHE_ERROR', lang, reason: 'bad-language' });
    return;
  }
  if (precacheRunning === lang) return;     // وہی کام دوبارہ شروع نہ ہو
  precacheRunning = lang;

  try {
    const cache = await caches.open(CDN_CACHE);

    // عربی فونٹ (چھوٹا، مگر آف لائن میں ضروری)
    try {
      if (!(await cache.match(QURAN_FONT_URL))) {
        const fr = await fetch(QURAN_FONT_URL);
        if (fr && fr.ok) await cache.put(QURAN_FONT_URL, fr.clone());
      }
    } catch (_) { /* فونٹ نہ ملا تو Noto Naskh fallback چلے گا */ }

    const urls = [];
    for (let n = 1; n <= SURAH_COUNT; n++) urls.push(`${QURAN_CDN_BASE}${lang}/${n}.json`);

    let done = 0;
    let failed = 0;
    await broadcast({ type: 'QURAN_PRECACHE_PROGRESS', lang, done, total: SURAH_COUNT });

    for (let i = 0; i < urls.length; i += PRECACHE_BATCH) {
      const batch = urls.slice(i, i + PRECACHE_BATCH);
      await Promise.all(batch.map(async (url) => {
        try {
          if (await cache.match(url)) return;          // پہلے سے موجود
          const res = await fetch(url);
          if (!res || !res.ok) throw new Error('HTTP ' + (res && res.status));
          await cache.put(url, res.clone());
        } catch (_) {
          failed++;
        } finally {
          done++;
          await broadcast({ type: 'QURAN_PRECACHE_PROGRESS', lang, done, total: SURAH_COUNT });
        }
      }));
    }

    if (failed > 0) {
      await broadcast({ type: 'QURAN_PRECACHE_ERROR', lang, reason: 'network', failed });
    } else {
      await broadcast({ type: 'QURAN_PRECACHE_DONE', lang, total: SURAH_COUNT });
    }
  } catch (err) {
    await broadcast({ type: 'QURAN_PRECACHE_ERROR', lang, reason: 'unknown' });
  } finally {
    precacheRunning = null;
  }
}

// یہ فائلیں ہمیشہ precache ہوں گی
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/mosque-header.webp',
  '/firebase-applet-config.json',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

// index.html کے متن سے تمام local /assets/... اور /src/... links نکالتا ہے
function extractAssetUrls(html) {
  const urls = new Set();
  const re = /(?:src|href)=["'](\/(?:assets)\/[^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) urls.add(m[1]);
  return [...urls];
}

// Vite کے JS chunk کے اندر جو dynamic import / modulepreload ہوں انہیں بھی نکالتا ہے
function extractChunkImports(js) {
  const urls = new Set();
  const re = /["'](?:\.\/|\/assets\/)([A-Za-z0-9_\-.]+\.(?:js|css))["']/g;
  let m;
  while ((m = re.exec(js)) !== null) urls.add('/assets/' + m[1]);
  return [...urls];
}

// ایک URL کو fetch کر کے cache میں ڈالتا ہے (ناکامی پر خاموشی سے آگے بڑھتا ہے)
async function safeAdd(cache, url) {
  try {
    const res = await fetch(url, { cache: 'reload' });
    if (res && res.ok) {
      await cache.put(url, res.clone());
      return res;
    }
  } catch (_) { /* offline یا 404 — نظر انداز */ }
  return null;
}

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // 1) بنیادی فائلیں — ایک ناکام ہو تو باقی نہ رکیں
    await Promise.all(CORE_ASSETS.map((u) => safeAdd(cache, u)));

    // 2) index.html پڑھ کر hashed JS/CSS نکالیں اور precache کریں
    try {
      const htmlRes = await cache.match('/index.html');
      if (htmlRes) {
        const html = await htmlRes.clone().text();
        const assetUrls = extractAssetUrls(html);
        await Promise.all(assetUrls.map((u) => safeAdd(cache, u)));

        // 3) ہر JS فائل کے اندر جو دوسرے chunks import ہوتے ہیں (lazy chunks) وہ بھی
        for (const u of assetUrls.filter((x) => x.endsWith('.js'))) {
          const jsRes = await cache.match(u);
          if (!jsRes) continue;
          const js = await jsRes.clone().text();
          const nested = extractChunkImports(js).filter((n) => !assetUrls.includes(n));
          await Promise.all(nested.map((n) => safeAdd(cache, n)));
        }
      }
    } catch (_) { /* precache ادھورا رہے تو بھی SW install ہو */ }

    await self.skipWaiting();
  })());
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // صرف GET cache ہو سکتی ہے
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // ✅ 1. Navigation — network first، offline میں cache شدہ index.html (SPA)
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(request);
        if (res && res.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put('/index.html', res.clone());
        }
        return res;
      } catch (_) {
        const cache = await caches.open(CACHE_NAME);
        return (
          (await cache.match('/index.html')) ||
          (await cache.match('/')) ||
          new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
        );
      }
    })());
    return;
  }

  // ✅ 2. Quran / Hadith / Tafsir data — jsdelivr + raw.githubusercontent
  //       cache first، پھر network، پھر (آخر میں) پرانا cache
  if (
    url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname === 'raw.githubusercontent.com'
  ) {
    event.respondWith((async () => {
      const cache = await caches.open(CDN_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const res = await fetch(request);
        if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
        return res;
      } catch (err) {
        // ایک ہی CDN کے دوسرے hostname سے بھی ڈھونڈ لیں
        const keys = await cache.keys();
        const tail = url.pathname.split('/').slice(-2).join('/');
        for (const k of keys) {
          if (k.url.endsWith(tail)) return cache.match(k);
        }
        throw err;
      }
    })());
    return;
  }

  // ✅ 3. Google Fonts + FontAwesome — cache first
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'cdnjs.cloudflare.com'
  ) {
    event.respondWith((async () => {
      const cache = await caches.open(FONTS_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const res = await fetch(request);
        if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
        return res;
      } catch (err) {
        return cached || Response.error();
      }
    })());
    return;
  }

  // باہر کی دوسری requests (Firebase, Maps, Prayer API) — SW کو نہ چھیڑیں
  if (url.origin !== self.location.origin) return;

  // ✅ 4. sw.js خود کبھی cache نہ ہو
  if (url.pathname === '/sw.js') return;

  // ✅ 5. Firebase config — network first، offline میں cache
  if (url.pathname === '/firebase-applet-config.json') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const res = await fetch(request);
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(request)) || Response.error();
      }
    })());
    return;
  }

  // ✅ 6. Vite assets (/assets/...) — hashed ہوتے ہیں اس لیے cache first محفوظ ہے
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const res = await fetch(request);
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      } catch (err) {
        return Response.error();
      }
    })());
    return;
  }

  // ✅ 7. باقی local static فائلیں (png, webp, json, ...) — stale-while-revalidate
  if (/\.(js|css|png|jpg|jpeg|webp|svg|woff2?|ico|json)(\?.*)?$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => null);
      return cached || (await network) || Response.error();
    })());
    return;
  }
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { /* text payload */ }
  event.waitUntil(
    self.registration.showNotification(data.title || 'StepTuDeen', {
      body: data.body || 'نماز کا وقت ہو گیا ہے',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      dir: 'rtl',
      lang: 'ur',
      vibrate: [200, 100, 200],
      data: data.url || '/',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = typeof event.notification.data === 'string' ? event.notification.data : '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow(target);
    })
  );
});

// ── Message ───────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'PRECACHE_QURAN' && typeof data.lang === 'string') {
    // waitUntil تاکہ براؤزر کام کے دوران SW کو بند نہ کر دے
    event.waitUntil(precacheQuran(data.lang));
  }
});
