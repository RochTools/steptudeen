// StepToDeen Service Worker — Offline v5
const CACHE_NAME = 'steptudeen-v5';
const CDN_CACHE = 'steptudeen-cdn-v5';

// ── Install: cache essential files ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([
      '/',
      '/index.html',
      '/manifest.json',
      '/icon-192.png',
      '/offline.html',
      '/mosque-bg.jpg',
      '/mosque-header.webp',
    ])).then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CDN_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ✅ CDN (Quran/Hadith data) — cache first, network fallback
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(
      caches.open(CDN_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => {
            // Offline میں cached version واپس کریں
            return cache.match(request);
          });
        })
      )
    );
    return;
  }

  // باہر کی requests (Firebase, Maps, APIs) — network only
  // offline ہو تو gracefully fail ہو
  if (url.origin !== location.origin) return;

  // Navigation (HTML pages) — network first, cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          return cached || caches.match('/offline.html');
        })
    );
    return;
  }

  // JS, CSS, images, fonts — cache first
  if (/\.(js|css|png|jpg|jpeg|webp|svg|woff2?|ico)(\?.*)?$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
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

  // Vite hashed assets (/assets/...) — cache first
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
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
  event.waitUntil(self.registration.showNotification(data.title || 'StepTuDeen', {
    body: data.body || 'namaz ka waqt ho gaya hai',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'ltr', lang: 'en',
    vibrate: [200, 100, 200],
    data: data.url || '/'
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data || '/'));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
