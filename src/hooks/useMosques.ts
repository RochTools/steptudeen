import { getAuth } from 'firebase/auth';
import { useState, useCallback, useEffect } from 'react';
import {
  getLocalMosques,
  saveLocalMosque,
  deleteLocalMosque
} from '../firebase';
import {
  onSnapshot, collection, addDoc,
  doc, setDoc, deleteDoc, getDocFromServer
} from 'firebase/firestore';
import { Mosque } from '../types';
import { validateMosqueId, parseSavedMosques } from '../utils/mosqueHelpers';

const MOSQUES_CACHE_KEY = 'steptudeen_mosques_cache';

// ── Cache helpers ────────────────────────────────────────────────────────────
const saveMosquesToCache = (list: Mosque[]) => {
  try { localStorage.setItem(MOSQUES_CACHE_KEY, JSON.stringify(list)); } catch {}
};

const getMosquesFromCache = (): Mosque[] => {
  try {
    const raw = localStorage.getItem(MOSQUES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

export const useMosques = (
  realtimeDb: any,
  realFirebaseActive: boolean
) => {
  // ✅ offline ہو تو cache سے شروع کریں — loading فوری بند
  const cachedMosques = getMosquesFromCache();

  const [mosques, setMosquesState] = useState<Mosque[]>(cachedMosques);
  const [isLoading, setIsLoading] = useState(cachedMosques.length === 0); // cache ہو تو loading نہیں
  const [selectedMosqueSnapshot, setSelectedMosque] = useState<Mosque | null>(null);
  const [savedPopupMosques, setSavedPopupMosques] = useState<string[]>(
    () => parseSavedMosques(localStorage.getItem('user_saved_mosques'))
  );

  // A saved bookmark contains an old snapshot; prefer the live mosque by ID.
  const selectedMosque = selectedMosqueSnapshot
    ? mosques.find(m => m.id === selectedMosqueSnapshot.id) ?? selectedMosqueSnapshot
    : null;

  // ── setMosques wrapper جو cache بھی save کرے ──
  const setMosquesAndStopLoading = useCallback((list: Mosque[]) => {
    setMosquesState(list);
    setIsLoading(false);
    saveMosquesToCache(list); // ✅ ہر بار cache update ہو
  }, []);

  // ✅ Offline safety: اگر 8 سیکنڈ میں Firebase نہ آئے تو loading بند
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, []);

  // ✅ Network واپس آئے تو refresh کریں
  useEffect(() => {
    const handleOnline = () => {
      if (realFirebaseActive && realtimeDb) {
        // App.tsx کا onSnapshot خود refresh کرے گا
        console.log('Network back online ✅');
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [realFirebaseActive, realtimeDb]);

  const requireImam = useCallback(async () => {
    if (!realFirebaseActive || !realtimeDb) throw new Error('Firebase login required.');
    const firebaseAuth = getAuth(realtimeDb.app);
    const user = firebaseAuth.currentUser;
    if (!user || user.isAnonymous) throw new Error('Please sign in to manage a mosque.');
    const profile = await getDocFromServer(doc(realtimeDb, 'users', user.uid));
    if (firebaseAuth.currentUser?.uid !== user.uid || profile.data()?.role !== 'imam') throw new Error('Imam access is not verified.');
    return user;
  }, [realFirebaseActive, realtimeDb]);

  const handleAddOrUpdateMosque = useCallback(async (
    data: Omit<Mosque, 'id' | 'updatedAt'> & { id?: string }
  ) => {
    const user = await requireImam();
    const { id, ...fields } = data;
    if (id) {
      const existing = await getDocFromServer(doc(realtimeDb, 'mosques', id));
      if (!existing.exists() || existing.data().imamUid !== user.uid) throw new Error('You can only edit your own mosque.');
    }
    const record = { ...fields, imamUid: user.uid, imamEmail: user.email || '', ownerId: user.uid, updatedAt: new Date().toISOString() };
    // Never fall back to an unverified local write on permission/network failure.
    if (id) await setDoc(doc(realtimeDb, 'mosques', id), record, { merge: true });
    else await addDoc(collection(realtimeDb, 'mosques'), record);
  }, [requireImam, realtimeDb]);

  const handleDeleteMosque = useCallback(async (id: string) => {
    const user = await requireImam();
    const existing = await getDocFromServer(doc(realtimeDb, 'mosques', id));
    if (!existing.exists() || existing.data().imamUid !== user.uid) throw new Error('You can only delete your own mosque.');
    await deleteDoc(doc(realtimeDb, 'mosques', id));
  }, [requireImam, realtimeDb]);

  // ============ SAVE / UNSAVE ============
  const handleToggleSaveMosque = useCallback((mosque: Mosque) => {
    try {
      const savedData = localStorage.getItem('user_saved_mosques');
      let currentList: Mosque[] = [];
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (Array.isArray(parsed)) {
            if (parsed.length > 0 && typeof parsed[0] === 'object') {
              currentList = parsed;
            } else if (parsed.length > 0 && typeof parsed[0] === 'string') {
              currentList = parsed
                .filter(validateMosqueId)
                .map((id: string) => ({ id } as Mosque));
            }
          }
        } catch { currentList = []; }
      }
      const exists = currentList.find(m => m.id === mosque.id);
      const newList = exists
        ? currentList.filter(m => m.id !== mosque.id)
        : [...currentList, mosque];
      localStorage.setItem('user_saved_mosques', JSON.stringify(newList));
      setSavedPopupMosques(newList.map((m: Mosque) => m.id));
    } catch (error) {
      console.error('Error saving mosque:', error);
    }
  }, []);

  // ============ ALERT ============
  const handleMosqueAlert = useCallback((mosque: Mosque) => {
    try {
      const alertList = JSON.parse(
        localStorage.getItem('mosque_alerts') || '[]'
      );
      if (!alertList.includes(mosque.id)) {
        alertList.push(mosque.id);
        localStorage.setItem('mosque_alerts', JSON.stringify(alertList));
      }
      alert(`StepToDeen الرٹ:\n\nآپ کو ${mosque.name} کی نماز کے بدلتے ہوئے اوقات کی ریئل ٹائم اپڈیٹس کا نوٹیفیکیشن آن کر دیا گیا ہے۔`);
    } catch (error) {
      console.error('Error setting alert:', error);
    }
  }, []);

  return {
    mosques,
    setMosques: setMosquesAndStopLoading,
    isLoading,
    setIsLoading,
    selectedMosque, setSelectedMosque,
    savedPopupMosques, setSavedPopupMosques,
    handleAddOrUpdateMosque,
    handleDeleteMosque,
    handleToggleSaveMosque,
    handleMosqueAlert,
  };
};
