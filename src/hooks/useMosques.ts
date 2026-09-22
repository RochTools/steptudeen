import { useState, useCallback, useEffect } from 'react';
import {
  getLocalMosques,
  saveLocalMosque,
  deleteLocalMosque
} from '../firebase';
import {
  onSnapshot, collection, addDoc,
  doc, setDoc, deleteDoc
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
  const [selectedMosque, setSelectedMosque] = useState<Mosque | null>(null);
  const [savedPopupMosques, setSavedPopupMosques] = useState<string[]>(
    () => parseSavedMosques(localStorage.getItem('user_saved_mosques'))
  );

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

  // ============ ADD / UPDATE ============
  const handleAddOrUpdateMosque = useCallback(async (
    data: Omit<Mosque, 'id' | 'updatedAt'> & { id?: string }
  ) => {
    // ✅ Firestore rules چیک کرتے ہیں: request.resource.data.ownerId == request.auth.uid
    // ImamDashboard صرف imamUid بھیجتا ہے (جو دراصل Firebase Auth کا وہی uid ہے)،
    // اس لیے یہاں ownerId خود بھر دیتے ہیں تاکہ rules سے میل کھائے۔
    // imamUid کو بھی ساتھ رکھا ہے تاکہ باقی جگہ استعمال ہونے والا کوڈ نہ ٹوٹے۔
    const freshMosque = {
      ...data,
      ownerId: (data as any).imamUid || (data as any).ownerId,
      updatedAt: new Date().toISOString(),
    };
    if (realFirebaseActive && realtimeDb) {
      try {
        const { id, ...firestoreData } = freshMosque;
        if (data.id) {
          await setDoc(doc(realtimeDb, 'mosques', data.id), firestoreData);
        } else {
          await addDoc(collection(realtimeDb, 'mosques'), firestoreData);
        }
      } catch (error) {
        // ✅ صرف localStorage میں رکھ کر خاموش نہ ہوں — بلانے والے کو بھی بتائیں
        // (ورنہ ImamDashboard جھوٹی "کامیابی" دکھاتا رہتا ہے جبکہ Firestore نے رد کیا ہو)
        console.error('Firestore save failed:', error);
        setMosquesAndStopLoading(saveLocalMosque(freshMosque));
        throw error;
      }
    } else {
      setMosquesAndStopLoading(saveLocalMosque(freshMosque));
    }
  }, [realFirebaseActive, realtimeDb, setMosquesAndStopLoading]);

  // ============ DELETE ============
  const handleDeleteMosque = useCallback(async (id: string) => {
    if (realFirebaseActive && realtimeDb) {
      try {
        await deleteDoc(doc(realtimeDb, 'mosques', id));
      } catch (error) {
        console.error('Firestore delete failed:', error);
        setMosquesAndStopLoading(deleteLocalMosque(id));
      }
    } else {
      setMosquesAndStopLoading(deleteLocalMosque(id));
    }
  }, [realFirebaseActive, realtimeDb, setMosquesAndStopLoading]);

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
