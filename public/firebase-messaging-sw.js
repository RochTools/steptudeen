// ═══════════════════════════════════════════════════════════════
// firebase-messaging-sw.js — StepToDeen Service Worker
// ═══════════════════════════════════════════════════════════════

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAlivb1p_ptLEfxxitQTUZ0jtBz9HDvHk8",
  authDomain: "steptodeen.firebaseapp.com",
  projectId: "steptodeen",
  storageBucket: "steptodeen.firebasestorage.app",
  messagingSenderId: "215948293153",
  appId: "1:215948293153:web:5a633139552f795bd41f60"
});

const messaging = firebase.messaging();

// ── Firebase سے background push آئے تو ─────────────────────────
messaging.onBackgroundMessage((payload) => {
  // سرور data-only پیغام بھیجتا ہے (title/body data میں)؛ پرانے پیغام notification میں
  const title = payload.data?.title || payload.notification?.title || 'StepTuDeen';
  const body  = payload.data?.body  || payload.notification?.body  || 'namaz ka waqt ho gaya hai';
  const icon  = payload.notification?.icon  || '/icon-192.png';

  self.registration.showNotification(title, {
    body,
    icon,
    badge: '/icon-192.png',
    dir: 'rtl',
    lang: 'ur',
    vibrate: [200, 100, 200],
    tag: payload.data?.tag || 'prayer-notification',   // ہر مسجد/نماز کا اپنا tag، تاکہ ایک دوسرے کو نہ مٹائیں
    renotify: true,
    data: payload.data || {}
  });
});

// ── ایپ سے directly notification request آئے تو ────────────────
// (جب notifications.ts سے showViaServiceWorker call ہو)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // نوٹیفکیشن tap کرنے پر ایپ کھلے
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // پہلے سے کھلی window ہو تو focus کریں
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      // نہیں ہے تو نئی کھولیں
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// ── Service Worker activate ─────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
