import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  User
} from 'firebase/auth';
import { Capacitor, registerPlugin } from '@capacitor/core';
import {
  getFirestore,
  Firestore,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';

let app: any;
let db: Firestore | null = null;
let auth: Auth | null = null;
let isRealFirebase = false;

export async function initializeFirebaseAtRuntime(): Promise<{
  db: Firestore | null;
  auth: Auth | null;
  isRealFirebase: boolean;
}> {
  if (isRealFirebase && db && auth) {
    return { db, auth, isRealFirebase };
  }
  try {
    const response = await fetch('/firebase-applet-config.json').catch(() => null);
    if (response && response.ok) {
      const firebaseConfig = await response.json().catch(() => null);
      if (firebaseConfig && firebaseConfig.apiKey) {
        app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
        db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
        auth = getAuth(app);
        isRealFirebase = true;
        console.log('StepToDeen: Connected successfully to real Firebase backend at runtime.');
      }
    }
  } catch (error) {
    console.log(
      'StepToDeen: Running in secure offline/local simulation mode until Firebase is provisioned.',
      error
    );
  }
  return { db, auth, isRealFirebase };
}

// ─── Real Firebase Auth helpers ───────────────────────────────────────────────

export async function firebaseSignIn(
  firebaseAuth: Auth,
  email: string,
  password: string
): Promise<User> {
  const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
  return cred.user;
}

export async function firebaseSignUp(
  firebaseAuth: Auth,
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  await updateProfile(cred.user, { displayName });
  return cred.user;
}

export async function firebaseGoogleSignIn(firebaseAuth: Auth): Promise<User> {
  // Android ایپ (APK): ویب والا popup/redirect نیٹو WebView میں کام نہیں کرتا ("The requested action is invalid")،
  // اس لیے فون کا اپنا Google سائن اِن استعمال ہوتا ہے، پھر اسی ٹوکن سے JS Firebase میں لاگ ان۔
  if (Capacitor.isNativePlatform()) {
    const FirebaseAuthentication = registerPlugin<any>('FirebaseAuthentication');
    let r: any;
    try {
      r = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
    } catch (e: any) {
      const msg = String(e?.message || e?.code || e || '').toLowerCase();
      if (msg.includes('cancel') || msg.includes('12501') || msg.includes('dismiss')) {
        throw { code: 'auth/popup-closed-by-user', message: 'cancelled' };
      }
      throw e;
    }
    const idToken = r?.credential?.idToken;
    if (!idToken) throw { code: 'auth/native-no-token', message: 'Google did not return an ID token' };
    const credential = GoogleAuthProvider.credential(idToken, r?.credential?.accessToken || undefined);
    const res = await signInWithCredential(firebaseAuth, credential);
    return res.user;
  }
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(firebaseAuth, provider);
  return result.user;
}

export async function firebaseSignOut(firebaseAuth: Auth): Promise<void> {
  await signOut(firebaseAuth);
}

export function subscribeToAuthState(
  firebaseAuth: Auth,
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(firebaseAuth, callback);
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔐 OTP EMAIL VERIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

const HF_SPACE_URL = 'https://zameerbaloch12458-steptodeen.hf.space';

/**
 * Send OTP to user's email via Hugging Face Space API
 * API خود OTP جنریٹ کرتا ہے اور ای میل کرتا ہے
 */
export async function sendOTPToEmail(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${HF_SPACE_URL}/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (data.success) {
      return { success: true, message: data.message || 'OTP آپ کے ای میل پر بھیج دی گئی ہے' };
    } else {
      return { success: false, message: data.message || 'OTP بھیجنے میں ناکامی' };
    }
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    return { success: false, message: 'سرور سے رابطہ نہیں ہو سکا: ' + (error.message || 'دوبارہ کوشش کریں') };
  }
}

/**
 * Verify OTP code via Hugging Face Space API
 * API خود OTP چیک کرتا ہے
 */
export async function verifyOTP(email: string, code: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${HF_SPACE_URL}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp: code })
    });

    const data = await response.json();

    if (data.success) {
      return { success: true, message: data.message || 'OTP کامیابی سے تصدیق ہو گئی' };
    } else {
      return { success: false, message: data.message || 'OTP غلط ہے' };
    }
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    return { success: false, message: 'تصدیق میں خرابی: ' + (error.message || 'دوبارہ کوشش کریں') };
  }
}

/**
 * Check if email already has an account in Firestore
 */
export async function checkEmailExists(email: string): Promise<{ exists: boolean; userData?: any }> {
  try {
    const { db: freshDb } = await initializeFirebaseAtRuntime();
    if (!freshDb) return { exists: false };

    const usersRef = collection(freshDb, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      return { exists: true, userData: { uid: userDoc.id, ...userDoc.data() } };
    }
    return { exists: false };
  } catch (error) {
    console.error('Error checking email:', error);
    return { exists: false };
  }
}

/**
 * Save user to Firestore after OTP verification + password creation
 */
export async function saveUserToFirestore(
  email: string,
  password: string,
  name: string,
  role: 'user' | 'imam'
): Promise<{ success: boolean; message: string }> {
  try {
    const { db: freshDb } = await initializeFirebaseAtRuntime();
    if (!freshDb) {
      return { success: false, message: 'ڈیٹابیس سے رابطہ نہیں ہو سکا، دوبارہ کوشش کریں' };
    }

    // email کو safe document ID بنائیں
    const safeId = email.replace(/[^a-zA-Z0-9_\-@.]/g, '_').slice(0, 128);

    const userData = {
      email,
      password,
      name,
      role,
      createdAt: new Date().toISOString(),
      emailVerified: true
    };

    await setDoc(doc(freshDb, 'users', safeId), userData);
    return { success: true, message: 'اکاؤنٹ کامیابی سے بن گیا' };
  } catch (error: any) {
    console.error('Error saving user:', error);
    return { success: false, message: 'اکاؤنٹ بنانے میں خرابی: ' + (error.message || 'دوبارہ کوشش کریں') };
  }
}

/**
 * Login with email + password (Firestore check)
 */
export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<{ success: boolean; message: string; userData?: any }> {
  try {
    const { db: freshDb } = await initializeFirebaseAtRuntime();
    if (!freshDb) {
      return { success: false, message: 'ڈیٹابیس سے رابطہ نہیں ہو سکا، دوبارہ کوشش کریں' };
    }

    const usersRef = collection(freshDb, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { success: false, message: 'اکاؤنٹ موجود نہیں۔ نیا اکاؤنٹ بنائیں' };
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    if (userData.password !== password) {
      return { success: false, message: 'پاسورڈ غلط ہے۔ دوبارہ کوشش کریں' };
    }

    return { success: true, message: 'لاگ ان کامیاب', userData: { uid: userDoc.id, ...userData } };
  } catch (error: any) {
    console.error('Error logging in:', error);
    return { success: false, message: 'لاگ ان میں خرابی: ' + (error.message || 'دوبارہ کوشش کریں') };
  }
}

// ═══════════════════════════════════════════════════════════════════════════

// ─── LocalStorage fallback helpers (offline / demo mode) ──────────────────────

const LOCAL_MOSQUES_KEY = 'steptodeen_local_mosques';
const INITIAL_MOCK_MOSQUES = [
  {
    id: 'mosque_1',
    name: 'جامع مسجد بلال (G-11)',
    imamName: 'قاری محمد امین',
    imamEmail: 'imam.bilal@example.com',
    imamUid: 'mock_uid_1',
    address: 'جی الیون مرکز، اسلام آباد',
    latitude: 33.6675,
    longitude: 72.9984,
    fajr: '05:15',
    zuhr: '01:30',
    asr: '04:30',
    maghrib: '07:05',
    isha: '08:45',
    jumah: '01:30',
    announcement: 'نمازِ عشاء کی جماعت اب سے پونے نو بجے (8:45) ہوگی۔',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mosque_2',
    name: 'جامع مسجد رحمانیہ',
    imamName: 'مولانا ساجد الرحمن',
    imamEmail: 'imam.rehman@example.com',
    imamUid: 'mock_uid_2',
    address: 'سیکٹر F-10، اسلام آباد',
    latitude: 33.6892,
    longitude: 73.0104,
    fajr: '05:30',
    zuhr: '01:15',
    asr: '04:45',
    maghrib: '07:08',
    isha: '08:30',
    jumah: '02:00',
    announcement: 'جمعہ کا پہلا خطبہ ٹھیک ڈیڑھ بجے شروع ہوگا۔',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mosque_3',
    name: 'فیصل مسجد',
    imamName: 'ڈاکٹر قاری ضیاء الرحمن',
    imamEmail: 'imam.faisal@example.com',
    imamUid: 'mock_uid_3',
    address: 'شاہراہِ اسلام آباد، مارگلہ ہلز',
    latitude: 33.7298,
    longitude: 73.0372,
    fajr: '05:10',
    zuhr: '01:45',
    asr: '04:30',
    maghrib: '07:05',
    isha: '09:00',
    jumah: '01:30',
    announcement: 'نمازِ عشاء اور خطبہء جمعہ مبارکہ کا وقت تبدیل کر دیا گیا ہے۔',
    updatedAt: new Date().toISOString()
  }
];

export function getLocalMosques() {
  const data = localStorage.getItem(LOCAL_MOSQUES_KEY);
  if (!data) {
    localStorage.setItem(LOCAL_MOSQUES_KEY, JSON.stringify(INITIAL_MOCK_MOSQUES));
    return INITIAL_MOCK_MOSQUES;
  }
  return JSON.parse(data);
}

export function saveLocalMosque(mosque: any) {
  const list = getLocalMosques();
  const index = list.findIndex((m: any) => m.id === mosque.id);
  if (index > -1) {
    list[index] = { ...mosque, updatedAt: new Date().toISOString() };
  } else {
    list.push({ ...mosque, id: 'mosque_' + Date.now(), updatedAt: new Date().toISOString() });
  }
  localStorage.setItem(LOCAL_MOSQUES_KEY, JSON.stringify(list));
  return list;
}

/**
 * Reset password after OTP verification
 * Firestore میں password update کرتا ہے
 */
export async function resetPasswordInFirestore(
  email: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { db: freshDb } = await initializeFirebaseAtRuntime();
    if (!freshDb) {
      return { success: false, message: 'Database connection failed. Please try again.' };
    }

    const usersRef = collection(freshDb, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { success: false, message: 'No account found with this email.' };
    }

    const userDoc = querySnapshot.docs[0];
    await setDoc(doc(freshDb, 'users', userDoc.id), { password: newPassword }, { merge: true });

    return { success: true, message: 'Password updated successfully!' };
  } catch (error: any) {
    return { success: false, message: 'Error updating password: ' + (error.message || 'Please try again.') };
  }
}


export function deleteLocalMosque(id: string) {
  const list = getLocalMosques();
  const filtered = list.filter((m: any) => m.id !== id);
  localStorage.setItem(LOCAL_MOSQUES_KEY, JSON.stringify(filtered));
  return filtered;
}
