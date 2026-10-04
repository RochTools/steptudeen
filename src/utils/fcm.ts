import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAlivb1p_ptLEfxxitQTUZ0jtBz9HDvHk8",
  authDomain: "steptodeen.firebaseapp.com",
  projectId: "steptodeen",
  storageBucket: "steptodeen.firebasestorage.app",
  messagingSenderId: "215948293153",
  appId: "1:215948293153:web:5a633139552f795bd41f60"
};

const VAPID_KEY = "BEV0ZYHrs3B70HGoupXn-JlJ8C4RY2P6FD-lnlGX_gGp4P0C7lmN8lrlZc6q_OOUNJpWJrPrcXSa-iMQmvac4wQ";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export async function initFCM(uid?: string): Promise<string | null> {
  try {
    if (!('Notification' in window)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    
    if (token) {
      console.log('FCM Token:', token);
      localStorage.setItem('fcm_token', token);

      // ── Firestore میں save کریں ──
      if (uid) {
        const db = getFirestore(app);
        await setDoc(doc(db, 'users', uid), {
          fcmToken: token,
          tokenUpdatedAt: new Date().toISOString(),
          platform: 'web'
        }, { merge: true }); // merge تاکہ باقی data نہ مٹے
        console.log('FCM token Firestore میں save ✅');
      }

      return token;
    }
    return null;
  } catch (err) {
    console.error('FCM error:', err);
    return null;
  }
}

export function listenForegroundMessages() {
  try {
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      // سرور data-only پیغام بھیجتا ہے (title/body data میں)، پرانے پیغام notification میں
      const title = payload.data?.title || payload.notification?.title || 'StepTuDeen';
      const body = payload.data?.body || payload.notification?.body || 'namaz ka waqt ho gaya hai';
      const tag = payload.data?.tag || 'prayer-notification';
      if (Notification.permission !== 'granted') return;
      const opts: any = { body, icon: '/icon-192.png', badge: '/icon-192.png', dir: 'rtl', lang: 'ur', tag, renotify: true, data: payload.data || {} };
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => reg.showNotification(title, opts))
          .catch(() => new Notification(title, opts));
      } else {
        new Notification(title, opts);
      }
    });
  } catch (err) {
    console.error('FCM foreground error:', err);
    return undefined;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// مسجد فالو (گھنٹی): فون کا ٹوکن سرور کے ذریعے مسجد کے topic میں جاتا ہے
// ═══════════════════════════════════════════════════════════════════════════
// Cloudflare Worker بن جانے کے بعد اس کا پتہ یہاں لکھیں، مثلاً:
//   'https://steptudeen-notify.آپ-کا-نام.workers.dev'
export const NOTIFY_URL = 'PASTE_WORKER_URL_HERE';

const FOLLOW_KEY = 'steptudeen_followed_mosques';

export function getFollowedMosques(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(FOLLOW_KEY) || '{}'); } catch { return {}; }
}

function saveFollowed(id: string, on: boolean) {
  try {
    const all = getFollowedMosques();
    if (on) all[id] = true; else delete all[id];
    localStorage.setItem(FOLLOW_KEY, JSON.stringify(all));
  } catch { /* سٹوریج بھری ہو تو نظر انداز */ }
}

/** گھنٹی دبانے پر: true = فالو ہو گئی، false = ناکام (وجہ message میں) */
export async function setMosqueFollow(
  mosqueId: string,
  follow: boolean
): Promise<{ ok: boolean; message?: string }> {
  if (NOTIFY_URL.includes('PASTE_')) return { ok: false, message: 'نوٹیفکیشن سرور کا پتہ ابھی نہیں لکھا گیا۔' };
  if (!('Notification' in window)) return { ok: false, message: 'اس براؤزر میں نوٹیفکیشن کی سہولت نہیں۔' };

  let token = localStorage.getItem('fcm_token');
  if (follow) {
    token = await initFCM(undefined);            // اجازت مانگے گا اور ٹوکن لے گا
    if (!token) return { ok: false, message: 'نوٹیفکیشن کی اجازت نہیں ملی۔ فون/براؤزر کی سیٹنگ میں اجازت دیں۔' };
  }
  if (!token) { saveFollowed(mosqueId, false); return { ok: true }; }

  try {
    const res = await fetch(`${NOTIFY_URL}/follow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, mosqueId, follow }),
    });
    if (!res.ok) return { ok: false, message: 'سرور سے رابطہ نہ ہو سکا، دوبارہ کوشش کریں۔' };
    saveFollowed(mosqueId, follow);
    return { ok: true };
  } catch {
    return { ok: false, message: 'انٹرنیٹ نہیں ہے، دوبارہ کوشش کریں۔' };
  }
}
