// StepToDeen Service Worker — Offline v7
const CACHE_NAME    = 'steptudeen-v7';
const CDN_CACHE     = 'steptudeen-cdn-v7';
const FONTS_CACHE   = 'steptudeen-fonts-v7';

const ALL_CACHES = [CACHE_NAME, CDN_CACHE, FONTS_CACHE];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([
      '/index.html',
      '/manifest.json',
      '/icon-192.png',
      '/icon-512.png',
      '/offline.html',
      '/mosque-bg.jpg',
      '/mosque-header.webp',
      '/namaz.png',
      '/tasbeeh.jpg',
      '/dua.jpg',
      '/Hadith.jpg',
      '/Quran.jpeg',
    ])).then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => !ALL_CACHES.includes(k))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ✅ 1. Quran/Hadith CDN — cache first
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(
      caches.open(CDN_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request, { redirect: 'follow' }).then(res => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => cache.match(request));
        })
      )
    );
    return;
  }

  // ✅ 2. Google Fonts + FontAwesome — cache first
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'cdnjs.cloudflare.com'
  ) {
    event.respondWith(
      caches.open(FONTS_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request, { redirect: 'follow' }).then(res => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => cached);
        })
      )
    );
    return;
  }

  // باہر کی دوسری requests (Firebase, Maps, Prayer API)
  if (url.origin !== location.origin) return;

  // ✅ 3. Navigation — redirect follow کریں
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { redirect: 'follow' })
        .then(res => {
          // صرف ok response cache کریں redirect نہیں
          if (res.ok && res.type !== 'opaqueredirect') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => {
          // Offline — cache سے دیں
          const cached = await caches.match('/index.html');
          return cached || caches.match('/offline.html');
        })
    );
    return;
  }

  // ✅ 4. Vite assets (/assets/...) — cache first
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request, { redirect: 'follow' }).then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // ✅ 5. Images, CSS, JS, fonts (local) — cache first
  if (/\.(js|css|png|jpg|jpeg|webp|svg|woff2?|ico)(\?.*)?$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request, { redirect: 'follow' }).then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, copy));
          }
          return res;
        });
      })
    );
    return;
  }
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'StepTuDeen', {
      body: data.body || 'نماز کا وقت ہو گیا ہے',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      dir: 'rtl',
      lang: 'ur',
      vibrate: [200, 100, 200],
      data: data.url || '/'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data || '/'));
});

// ── Message ───────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
