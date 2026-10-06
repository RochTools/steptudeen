import { useState, useEffect } from 'react';
import { firebaseGoogleSignIn, initializeFirebaseAtRuntime } from '../firebase';
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { GoogleAuthProvider, getRedirectResult, signInWithRedirect } from 'firebase/auth';

interface LoginChoiceViewProps {
  onImamLoginSuccess: () => void;
  onUserLogin: (name: string, phone: string) => void;
  isRealFirebase: boolean;
  realtimeAuth: any;
  setIsAuthenticated: (val: boolean) => void;
  setAuthEmail: (val: string) => void;
  setAuthName: (val: string) => void;
  setAuthUid: (val: string) => void;
}

// کیا ایپ PWA (standalone) موڈ میں چل رہی ہے؟
const isStandalonePwa = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as any).standalone === true;

export function LoginChoiceView({
  onImamLoginSuccess,
  isRealFirebase,
  realtimeAuth,
  setIsAuthenticated,
  setAuthEmail,
  setAuthName,
  setAuthUid,
}: LoginChoiceViewProps) {
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  // ─────────────────────────────────────────────────────────────
  // ✅ لاگ ان کے بعد اکاؤنٹٹ کی ایڈجسٹمنٹ:
  //    • پہلے سے رجسٹر ہے → اُسے کا اکاؤنٹ واپس مل جائے گا
  //    • پہلے سے رجسٹر نہیں → خودکار نیا اکاؤنٹ ببن جائے گا
  // ─────────────────────────────────────────────────────────────
  const processSignedInUser = async (user: any): Promise<void> => {
    setAuthEmail(user.email || '');
    setAuthName(user.displayName || user.email?.split('@')[0] || '');
    setAuthUid(user.uid);

    if (!isRealFirebase || !realtimeAuth?.currentUser || realtimeAuth.currentUser.isAnonymous || realtimeAuth.currentUser.uid !== user.uid) throw new Error('Verified Firebase login required');
    const { db } = await initializeFirebaseAtRuntime();
    if (!db) throw new Error('Database unavailable');
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDocFromServer(userDocRef);

    if (!userDoc.exists()) {
      // ✅ نیا اکاؤنٹ — پہلی بار لاگ ان کرنے والے کے لیے
      await setDoc(userDocRef, {
        role: 'imam',
        email: user.email || '',
        name: user.displayName || user.email?.split('@')[0] || '',
        createdAt: new Date().toISOString(),
      });
    } else if (userDoc.data()?.role !== 'imam') {
      // ڈاکیومنٹ موجود ہے مگر role مختلف ہے — امام لاگ ان سے آئے ہیں تو role درست کر دو
      await setDoc(userDocRef, { role: 'imam' }, { merge: true });
    }

    // ✅ لاگ ان مکمل — ہوم پر چلو
    const confirmed = await getDocFromServer(userDocRef);
    if (realtimeAuth.currentUser?.uid !== user.uid || confirmed.data()?.role !== 'imam') throw new Error('Account verification failed');
    // The central session listener, not a local flag, authorizes the dashboard.
    onImamLoginSuccess();
  };

  // ─────────────────────────────────────────────────────────────
  // ✅ PWA سہولت: اگر redirect کے ذریعے واپس آئے ہوں تو نتیجہ سنبھالو
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRealFirebase || !realtimeAuth) return;
    let cancelled = false;

    getRedirectResult(realtimeAuth)
      .then(async (result: any) => {
        if (cancelled || !result?.user) return;   // redirect نہیں تھا، کچھ نہ کرو
        setVerifying(true);
        await processSignedInUser(result.user);
      })
      .catch((err: any) => {
        console.error('Redirect sign-in error:', err?.code || err);
        if (!cancelled) {
          setError('Sign-in could not be completed. Please try again.');
          setVerifying(false);
        }
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeAuth, isRealFirebase]);

  // ─────────────────────────────────────────────────────────────
  // ✅ Continue with Google — کوئی بھی لاگ ان کر سکتا ہے
  // ─────────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    if (!isRealFirebase || !realtimeAuth) {
      setError('No internet connection. Please try again.');
      return;
    }
    setLoading(true);
    setError('');

    // ── مرحلہ 1: Google سائن اِن ──
    let user: any = null;
    try {
      user = await firebaseGoogleSignIn(realtimeAuth);
    } catch (err: any) {
      const code = err?.code || '';
      console.error('Google sign-in error:', code, err);

      // ✅ PWA میں popup بلاک/فیل ہو جائے تو redirect خودکار
      if ((code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') && isStandalonePwa()) {
        try {
          await signInWithRedirect(realtimeAuth, new GoogleAuthProvider());
          return; // واپسی پر اوپر والا useEffect سنبھالے گا
        } catch (redirectErr: any) {
          console.error('Redirect sign-in failed:', redirectErr);
          setError('Could not open Google sign-in. Please try again.');
          setLoading(false);
          return;
        }
      }

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Sign-in was cancelled. Please try again.');
      } else if (code === 'auth/popup-blocked') {
        setError('Pop-up was blocked by your browser. Please allow pop-ups and try again.');
      } else if (code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection and try again.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else if (code === 'auth/user-disabled') {
        setError('This account has been disabled. Please contact support.');
      } else if (code === 'auth/account-exists-with-different-credential') {
        setError('An account already exists with a different sign-in method.');
      } else if (code === 'permission-denied' || code === 'firestore/permission-denied') {
        setError('Access denied. You do not have permission to sign in.');
      } else if (code === 'unavailable') {
        setError('Service is temporarily unavailable. Please try again later.');
      } else {
        setError('Something went wrong. Please try again.');
      }
      setLoading(false);
      return;
    }

    if (!user) {
      setError('Google sign-in failed. Please try again.');
      setLoading(false);
      return;
    }
    setLoading(false);

    // ── مرحلہ 2: اکاؤنٹ موجود ہے یا نیا بنانا ہے ──
    setVerifying(true);
    try {
      await processSignedInUser(user);   // ✅ کامیابی پر ہوم نویگیشن اسی کے اندر ہے
    } catch (err: any) {
      console.error('Account setup error:', err?.code || err);
      setError('Your account was signed in, but setup failed. Please check your internet connection and try again.');
      setVerifying(false);   // ✅ ایرر پر بھی واپس فارم پر، spinner میں نہیں پھنسنا
    }
  };

  // ─────────────────────────────────────────────────────────────
  // UI: تصدیق کی اسکرین (اب صرف چند سیکنڈ دیکھائی دیتی ہے)
  // ─────────────────────────────────────────────────────────────
  if (verifying) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
        <div className="text-center space-y-6">
          {/* Spinning mosque icon */}
          <div className="relative mx-auto h-20 w-20">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-100" />
            <div className="absolute inset-0 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
            <div className="absolute inset-2 flex items-center justify-center rounded-full bg-emerald-50">
              <svg className="h-8 w-8 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18" />
                <path d="M12 2v3M12 5C8.5 5 6 7.5 6 11v10h12V11c0-3.5-2.5-6-6-6z" />
                <path d="M9 14h6v7H9z" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800">Setting up your account...</p>
            <p className="mt-1 text-sm text-slate-400">Please wait a moment</p>
          </div>
          {/* Animated dots */}
          <div className="flex items-center justify-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="h-2 w-2 rounded-full bg-emerald-300 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg">
          <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18" />
            <path d="M12 2v3M12 5C8.5 5 6 7.5 6 11v10h12V11c0-3.5-2.5-6-6-6z" />
            <path d="M9 14h6v7H9z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-800">Imam Login</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to manage your mosque</p>
      </div>

      <div className="w-full max-w-xs space-y-4">
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:shadow-md active:scale-95 disabled:opacity-50"
        >
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-center text-xs text-red-600">{error}</p>
        )}

        <p className="text-center text-[11px] text-slate-400">
          New accounts are created automatically on first sign-in.
        </p>
      </div>
    </div>
  );
}
