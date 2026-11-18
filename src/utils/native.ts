// ═══════════════════════════════════════════════════════════════
// native.ts — StepTuDeen
// Android (Capacitor) ایپ میں نوٹیفکیشن کی آواز اور نیٹو پش ٹوکن
// ویب/PWA پر یہ فائل کچھ نہیں کرتی (isNative() false ہوتا ہے)
// ═══════════════════════════════════════════════════════════════
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { logInboxItem } from './notifications';

export type SoundId = 'azan' | 'voice' | 'tone';

export interface SoundOption {
  id: SoundId;
  label: string;     // سیٹنگز میں نام
  hint: string;      // مختصر وضاحت
  file: string;      // public/sounds/ اور android res/raw میں فائل کا نام (چھوٹے حروف!)
}

// ⚠️ id وہی ہیں جو worker/index.ts کے SOUND_IDS میں ہیں — دونوں جگہ ایک جیسے رکھیں
export const SOUNDS: SoundOption[] = [
  { id: 'azan',  label: 'Azan',          hint: 'اذان کی آواز',        file: 'azan.mp3'  },
  { id: 'voice', label: 'Voice message', hint: 'بول کر بتانا',        file: 'voice.mp3' },
  { id: 'tone',  label: 'Simple tone',   hint: 'ایک سادہ ٹون',        file: 'tone.mp3'  },
];

export const DEFAULT_SOUND: SoundId = 'azan';
const SOUND_KEY = 'steptudeen_notification_sound';
// جس آواز کے topics میں فون ابھی شامل ہے (آواز بدلتے وقت پرانے سے نکالنے کے لیے)
const SUBSCRIBED_SOUND_KEY = 'steptudeen_subscribed_sound';

export const isNative = (): boolean => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

const isSoundId = (v: unknown): v is SoundId => SOUNDS.some((s) => s.id === v);

export function getSound(): SoundId {
  try {
    const v = localStorage.getItem(SOUND_KEY);
    return isSoundId(v) ? v : DEFAULT_SOUND;
  } catch { return DEFAULT_SOUND; }
}

export function saveSound(id: SoundId): void {
  try { localStorage.setItem(SOUND_KEY, id); } catch { /* نظر انداز */ }
}

export function getSubscribedSound(): SoundId {
  try {
    const v = localStorage.getItem(SUBSCRIBED_SOUND_KEY);
    return isSoundId(v) ? v : getSound();
  } catch { return getSound(); }
}

export function saveSubscribedSound(id: SoundId): void {
  try { localStorage.setItem(SUBSCRIBED_SOUND_KEY, id); } catch { /* نظر انداز */ }
}

/** سیٹنگز میں "سن کر دیکھیں" — آواز ایپ کے اندر چلتی ہے */
let previewAudio: HTMLAudioElement | null = null;
export function previewSound(id: SoundId): void {
  const opt = SOUNDS.find((s) => s.id === id);
  if (!opt) return;
  try {
    previewAudio?.pause();
    previewAudio = new Audio(`/sounds/${opt.file}`);
    void previewAudio.play().catch(() => { /* آواز کی فائل نہ ہو تو خاموش */ });
  } catch { /* نظر انداز */ }
}

// ── نیٹو پش ───────────────────────────────────────────────────
let initDone = false;
let nativeToken: string | null = null;

/** ایپ کھلتے ہی ایک بار: تینوں آوازوں کے چینل بنانا اور سننے والے لگانا */
export async function initNativePush(): Promise<void> {
  if (!isNative() || initDone) return;
  initDone = true;
  try {
    // Android میں چینل کی آواز ایک بار بن جانے کے بعد بدلی نہیں جا سکتی، اس لیے ہر آواز کا اپنا چینل
    for (const s of SOUNDS) {
      await PushNotifications.createChannel({
        id: s.id,
        name: `StepTuDeen — ${s.label}`,
        description: s.hint,
        sound: s.file,
        importance: 5,
        visibility: 1,
        vibration: true,
      });
    }

    await PushNotifications.addListener('registration', (t) => {
      nativeToken = t.value;
      try { localStorage.setItem('fcm_token', t.value); } catch { /* نظر انداز */ }
    });
    await PushNotifications.addListener('registrationError', (e) => {
      console.error('Native push registration error:', e);
    });

    // ایپ کھلی ہو تو سسٹم نوٹیفکیشن نہیں دکھاتا؛ اس لیے خود آواز چلا دیں اور بیل انبکس میں لکھ دیں
    await PushNotifications.addListener('pushNotificationReceived', (n) => {
      logInboxItem(n.title || 'StepTuDeen', n.body || '');
      previewSound(getSound());
    });
  } catch (err) {
    console.error('Native push init failed:', err);
  }
}

/** اجازت مانگ کر فون کا FCM ٹوکن لینا؛ نہ ملے تو null */
export async function getNativeToken(): Promise<string | null> {
  if (!isNative()) return null;
  await initNativePush();
  try {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return null;

    if (nativeToken) return nativeToken;
    const cached = localStorage.getItem('fcm_token');

    const waitForToken = new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(cached), 10000);
      void PushNotifications.addListener('registration', (t) => {
        clearTimeout(timer);
        resolve(t.value);
      });
    });
    await PushNotifications.register();
    return await waitForToken;
  } catch (err) {
    console.error('getNativeToken failed:', err);
    return null;
  }
}
