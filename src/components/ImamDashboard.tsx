import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  LogIn, Key, UserPlus, Info, Save, RotateCcw, MapPin, 
  CheckCircle, Trash, PlusCircle, AlertCircle, RefreshCw, Clock,
  Lock, Sunrise, Sunset, Moon, Pencil
} from 'lucide-react';
import { Mosque } from '../types';
import { firebaseSignIn, firebaseSignUp, firebaseSignOut } from '../firebase';
import { Auth } from 'firebase/auth';

// ── انٹرفیسز ──
interface ImamDashboardProps {
  onAddOrUpdateMosque: (mosque: Omit<Mosque, 'id' | 'updatedAt'> & { id?: string }) => void;
  onDeleteMosque: (id: string) => void;
  mosques: Mosque[];
  onLoggedOut?: () => void;
  onNavigateToSettings?: () => void; // ✅ لوکیشن آف ہونے پر سیٹنگز پیج پر بھیجنے کے لیے
  userCoords: { latitude: number; longitude: number } | null;
  requestLocation: () => void;
  isRealFirebase: boolean;
  isAuthenticated: boolean;
  setIsAuthenticated: (val: boolean) => void;
  authEmail: string;
  setAuthEmail: (val: string) => void;
  authName: string;
  setAuthName: (val: string) => void;
  authUid: string;
  setAuthUid: (val: string) => void;
  realtimeAuth: Auth | null; // ✅ 'any' کو درست کیا
}

// ── ٹائم ہیلپرز ──
const minutesToHHMM = (totalMinutes: number): string => {
  const total = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const hhmmToMinutes = (timeStr: string): number => {
  const parts = timeStr.split(':');
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
};

const to12Hour = (timeStr: string): string => {
  if (!timeStr) return '--:--';
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '--:--';
  const suffix = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
};

// ── تصویر کمپریس کرنے کا فنکشن ──
const compressImage = (file: File, maxWidth = 200, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width = (maxWidth / height) * width;
            height = maxWidth;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// ── MosqueCard کمپوننٹ (پرفارمنس کے لیے) ──
const MosqueCard = React.memo(({ 
  mosque, 
  onEdit, 
  onDelete 
}: { 
  mosque: Mosque; 
  onEdit: (mosque: Mosque) => void; 
  onDelete: (id: string) => void;
}) => {
  return (
    <div className="flex items-center justify-between gap-2 py-3 px-3.5 bg-white rounded-2xl border border-slate-200">
      <div className="text-right flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 font-urdu truncate">{mosque.name}</p>
        <p className="text-xs text-slate-400 font-urdu truncate">{mosque.address}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button 
          type="button" 
          onClick={() => onEdit(mosque)} 
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 text-slate-500 hover:text-emerald-700 transition-all cursor-pointer"
        >
          <Pencil size={14} />
        </button>
        <button 
          type="button" 
          onClick={() => onDelete(mosque.id)} 
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-200 text-slate-500 hover:text-rose-600 transition-all cursor-pointer"
        >
          <Trash size={14} />
        </button>
      </div>
    </div>
  );
});

MosqueCard.displayName = 'MosqueCard';

// ── مین کمپوننٹ ──
export const ImamDashboard: React.FC<ImamDashboardProps> = ({
  onAddOrUpdateMosque,
  onDeleteMosque,
  mosques,
  userCoords,
  requestLocation,
  isRealFirebase,
  isAuthenticated,
  setIsAuthenticated,
  authEmail,
  setAuthEmail,
  authName,
  setAuthName,
  authUid,
  setAuthUid,
  realtimeAuth,
  onLoggedOut,
  onNavigateToSettings
}) => {
  // ── ریفرنسز ──
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const apiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // ── اسٹیٹس ──
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savingStep, setSavingStep] = useState(3);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLocationOffPopup, setShowLocationOffPopup] = useState(false);
  const [locationOffMessage, setLocationOffMessage] = useState('');
  const [showEditInfoModal, setShowEditInfoModal] = useState(false);
  const [editInfoName, setEditInfoName] = useState('');
  const [editInfoAddress, setEditInfoAddress] = useState('');
  const [isGrabbingLocation, setIsGrabbingLocation] = useState(false);

  const [mosqueImage, setMosqueImage] = useState<string | null>(() => {
    return localStorage.getItem('mosque_profile_image') || null;
  });

  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [imamName, setImamName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null); // ✅ null استعمال کریں
  const [longitude, setLongitude] = useState<number | null>(null); // ✅ null استعمال کریں

  // ── جماعت offsets ──
  const [fajrOffset, setFajrOffset] = useState<number>(15);
  const [zuhrOffset, setZuhrOffset] = useState<number>(15);
  const [asrOffset, setAsrOffset] = useState<number>(15);
  const [maghribOffset, setMaghribOffset] = useState<number>(5);
  const [ishaOffset, setIshaOffset] = useState<number>(15);

  // ── manual اوقات ──
  const [jumah, setJumah] = useState('13:30');
  const [eidFitr, setEidFitr] = useState('07:00');
  const [eidAdha, setEidAdha] = useState('07:15');
  const [sehri, setSehri] = useState('04:30');
  const [iftar, setIftar] = useState('18:30');
  const [announcement, setAnnouncement] = useState('');

  // ── API اوقات ──
  const [apiTimes, setApiTimes] = useState<Record<string, string> | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState(false);

  const [activePicker, setActivePicker] = useState<{
    prayerKey: 'jumah' | 'eidFitr' | 'eidAdha' | 'sehri' | 'iftar';
    label: string;
    hour: number;
    minute: number;
    isPm: boolean;
  } | null>(null);

  // ── مسجد کی لسٹ ──
  const myMosques = useMemo(() => {
    return mosques.filter((m) => m.imamEmail === authEmail);
  }, [mosques, authEmail]);

  // ── کلین اپ ──
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // ✅ تمام انٹروال اور ٹائم آؤٹ کلئیر کریں
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (apiTimeoutRef.current) {
        clearTimeout(apiTimeoutRef.current);
        apiTimeoutRef.current = null;
      }
      document.body.style.overflow = '';
    };
  }, []);

  // ── Authenticated ہونے پر امام کا نام سیٹ کریں ──
  useEffect(() => {
    if (isAuthenticated) {
      setImamName(authName || authEmail.split('@')[0]);
    }
  }, [isAuthenticated, authEmail, authName]);

  // ── موجودہ مسجد لوڈ کریں ──
  useEffect(() => {
    if (isAuthenticated && !editId) {
      const existing = mosques.find((m) => m.imamEmail === authEmail);
      if (existing) handleEditMosque(existing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, mosques, editId, authEmail]);

  // ── Active Picker کے لیے باڈی اسکرول بند کریں ──
  useEffect(() => {
    if (activePicker) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [activePicker]);

  // ── API سے اوقات حاصل کریں (Debounce کے ساتھ) ──
  useEffect(() => {
    // پہلے سے چل رہی ٹائمر کلئیر کریں
    if (apiTimeoutRef.current) {
      clearTimeout(apiTimeoutRef.current);
      apiTimeoutRef.current = null;
    }

    if (latitude === null || longitude === null) {
      setApiTimes(null);
      return;
    }

    // ✅ 500ms ڈیلی کے ساتھ API کال
    apiTimeoutRef.current = setTimeout(() => {
      let cancelled = false;
      setApiLoading(true);
      setApiError(false);

      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const dateStr = `${dd}-${mm}-${yyyy}`;
      const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=1&school=1`;

      fetch(url)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json();
        })
        .then((data) => {
          if (cancelled || !isMountedRef.current) return;
          if (data.code === 200) {
            const t = data.data.timings;
            setApiTimes({
              fajr: t.Fajr.split(' ')[0],
              zuhr: t.Dhuhr.split(' ')[0],
              asr: t.Asr.split(' ')[0],
              maghrib: t.Maghrib.split(' ')[0],
              isha: t.Isha.split(' ')[0],
            });
            setApiError(false);
          } else {
            setApiError(true);
            setErrorMessage('API سے درست ڈیٹا نہیں ملا');
            setTimeout(() => setErrorMessage(''), 4000);
          }
        })
        .catch((err) => {
          if (cancelled || !isMountedRef.current) return;
          setApiError(true);
          // ✅ مخصوص ایرر میسجز
          if (err.name === 'AbortError') {
            setErrorMessage('درخواست منسوخ کر دی گئی');
          } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
            setErrorMessage('انٹرنیٹ کنکشن چیک کریں');
          } else if (err.message?.includes('429')) {
            setErrorMessage('بہت زیادہ درخواستیں، تھوڑا انتظار کریں');
          } else {
            setErrorMessage(`سرور سے رابطہ ممکن نہیں: ${err.message}`);
          }
          setTimeout(() => setErrorMessage(''), 5000);
        })
        .finally(() => {
          if (!cancelled && isMountedRef.current) {
            setApiLoading(false);
          }
        });

      return () => { cancelled = true; };
    }, 500);

    return () => {
      if (apiTimeoutRef.current) {
        clearTimeout(apiTimeoutRef.current);
        apiTimeoutRef.current = null;
      }
    };
  }, [latitude, longitude]);

  // ── جماعت کا فائنل وقت ──
  const getJamaatTime = useCallback((prayerKey: 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha', offset: number): string | null => {
    if (!apiTimes || !apiTimes[prayerKey]) return null;
    return minutesToHHMM(hhmmToMinutes(apiTimes[prayerKey]) + offset);
  }, [apiTimes]);

  // ── فارمیٹ ہیلپرز ──
  const formatTo12HourString = (timeStr: string) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const suffix = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
  };

  const openCustomTimePicker = (
    prayerKey: 'jumah' | 'eidFitr' | 'eidAdha' | 'sehri' | 'iftar',
    label: string,
    currentTimeString: string
  ) => {
    const parts = currentTimeString.split(':');
    const h24 = parseInt(parts[0], 10) || 12;
    const minute = parseInt(parts[1], 10) || 0;
    let isPm = h24 >= 12;
    let hour = h24 % 12;
    if (hour === 0) hour = 12;
    setActivePicker({ prayerKey, label, hour, minute, isPm });
  };

  const saveCustomTime = () => {
    if (!activePicker) return;
    const { prayerKey, hour, minute, isPm } = activePicker;
    let h24 = hour;
    if (isPm && hour < 12) h24 += 12;
    if (!isPm && hour === 12) h24 = 0;
    const newTimeValue = `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    if (prayerKey === 'jumah') setJumah(newTimeValue);
    else if (prayerKey === 'eidFitr') setEidFitr(newTimeValue);
    else if (prayerKey === 'eidAdha') setEidAdha(newTimeValue);
    else if (prayerKey === 'sehri') setSehri(newTimeValue);
    else if (prayerKey === 'iftar') setIftar(newTimeValue);
    setActivePicker(null);
  };

  // ── لوکیشن حاصل کریں ──
  const handleAutoGrabLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('آپ کا براؤزر لوکیشن سپورٹ نہیں کرتا۔');
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }
    setIsGrabbingLocation(true);
    setErrorMessage('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGrabbingLocation(false);
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setSuccessMessage(`لوکیشن کامیابی سے حاصل ہوئی — درستگی: ${Math.round(pos.coords.accuracy)} میٹر`);
        setTimeout(() => setSuccessMessage(''), 5000);
      },
      (err) => {
        setIsGrabbingLocation(false);
        // ✅ GPS بند ہونے یا پرمیشن نہ ہونے کی تشخیص — گائیڈ پاپ اپ دکھائیں
        if (err.code === err.PERMISSION_DENIED) {
          setLocationOffMessage('آپ نے لوکیشن کی اجازت مسترد کر دی ہے۔ براہ کرم اپنے براؤزر/فون کی سیٹنگز میں اس ایپ کے لیے لوکیشن کی اجازت دیں، یا نیچے دیے گئے بٹن سے دستی طور پر لوکیشن سیٹ کریں۔');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setLocationOffMessage('برائے مہربانی پہلے اپنا لوکیشن (GPS) آن کریں۔ GPS آن کرنے کے بعد دوبارہ کوشش کریں، یا نیچے دیے گئے بٹن سے دستی طور پر لوکیشن سیٹ کریں۔');
        } else {
          setLocationOffMessage('لوکیشن حاصل نہیں ہو سکی۔ براہ کرم پہلے اپنا GPS آن کریں اور دوبارہ کوشش کریں، یا دستی طور پر لوکیشن سیٹ کریں۔');
        }
        setShowLocationOffPopup(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // ── Auth Submit ──
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmailInput || !authPassword) {
      setErrorMessage('براہ کرم تمام معلومات کلاؤڈ میں لکھیں۔');
      return;
    }
    if (isSignUp && !authName) {
      setErrorMessage('برائے مہربانی اپنا نام تحریر کریں۔');
      return;
    }
    setErrorMessage('');

    // ✅ سیکیورٹی: بغیر Firebase کے لاگ ان نہیں ہوگا
    if (!isRealFirebase || !realtimeAuth) {
      setErrorMessage('سرور سے رابطہ قائم نہیں ہو سکا۔ براہ کرم انٹرنیٹ کنکشن چیک کر کے دوبارہ کوشش کریں۔');
      return;
    }

    try {
      if (isSignUp) {
        await firebaseSignUp(realtimeAuth, authEmailInput, authPassword, authName);
      } else {
        await firebaseSignIn(realtimeAuth, authEmailInput, authPassword);
      }
      setSuccessMessage(isSignUp ? 'مبارک ہو! آپ کا امام اکاؤنٹ کامیابی سے رجسٹر ہو گیا ہے۔' : 'خوش آمدید! آپ کامیابی سے لاگ ان ہو گئے ہیں۔');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      const code: string = err?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setErrorMessage('ای میل یا پاسورڈ غلط ہے۔ دوبارہ کوشش کریں۔');
      } else if (code === 'auth/email-already-in-use') {
        setErrorMessage('یہ ای میل پہلے سے رجسٹر ہے۔ لاگ ان کریں۔');
      } else if (code === 'auth/weak-password') {
        setErrorMessage('پاسورڈ کم از کم 6 حروف کا ہونا چاہیے۔');
      } else if (code === 'auth/invalid-email') {
        setErrorMessage('ای میل کا فارمیٹ درست نہیں ہے۔');
      } else if (code === 'auth/network-request-failed') {
        setErrorMessage('انٹرنیٹ کنکشن چیک کریں اور دوبارہ کوشش کریں۔');
      } else {
        setErrorMessage('لاگ ان میں دشواری پیش آئی: ' + (err?.message || code));
      }
    }
  };

  // ── لاگ آؤٹ ──
  const handleLogOut = async () => {
    if (isRealFirebase && realtimeAuth) {
      try { await firebaseSignOut(realtimeAuth); } catch (err) { console.error(err); }
    } else {
      setIsAuthenticated(false);
      setAuthEmail('');
      setAuthUid('');
    }
    setAuthPassword('');
    setAuthName('');
    setEditId(undefined);
    resetForm();
    if (onLoggedOut) onLoggedOut();
  };

  // ── فارم ری سیٹ ──
  const resetForm = () => {
    setEditId(undefined);
    setName('');
    setAddress('');
    setLatitude(null);
    setLongitude(null);
    setJumah('13:30');
    setEidFitr('07:00');
    setEidAdha('07:15');
    setSehri('04:30');
    setIftar('18:30');
    setAnnouncement('');
    setFajrOffset(15);
    setZuhrOffset(15);
    setAsrOffset(15);
    setMaghribOffset(5);
    setIshaOffset(15);
  };

  // ── مسجد ایڈٹ ──
  const handleEditMosque = (mosque: Mosque) => {
    setEditId(mosque.id);
    setName(mosque.name);
    setImamName(mosque.imamName);
    setAddress(mosque.address);
    setLatitude(mosque.latitude);
    setLongitude(mosque.longitude);
    setJumah(mosque.jumah);
    setEidFitr(mosque.eidFitr || '07:00');
    setEidAdha(mosque.eidAdha || '07:15');
    setSehri(mosque.sehri || '04:30');
    setIftar(mosque.iftar || '18:30');
    setAnnouncement(mosque.announcement || '');
    setFajrOffset(mosque.fajrOffset ?? 15);
    setZuhrOffset(mosque.zuhrOffset ?? 15);
    setAsrOffset(mosque.asrOffset ?? 15);
    setMaghribOffset(mosque.maghribOffset ?? 5);
    setIshaOffset(mosque.ishaOffset ?? 15);
  };

  // ── پینسل آئیکن پر کلک: مسجد لوڈ کریں اور نام/پتہ کا چھوٹا ماڈل کھولیں ──
  const handleEditMosqueClick = (mosque: Mosque) => {
    handleEditMosque(mosque);
    setEditInfoName(mosque.name);
    setEditInfoAddress(mosque.address);
    setShowEditInfoModal(true);
  };

  // ── نام اور پتہ محفوظ کریں (ماڈل سے) ──
  const saveNameAddress = () => {
    if (!editInfoName.trim() || !editInfoAddress.trim()) {
      setErrorMessage('براہ کرم مسجد کا نام اور پتہ درج کریں۔');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    setName(editInfoName.trim());
    setAddress(editInfoAddress.trim());
    setShowEditInfoModal(false);
  };

  // ── فارم جمع کروائیں ──
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ چیک کریں کہ null نہ ہوں
    if (!name || !address || latitude === null || longitude === null) {
      setErrorMessage('براہ کرم سرخ نشان والی تمام معلومات پُر کریں۔');
      return;
    }
    if (!apiTimes) {
      setErrorMessage('جماعت کے اوقات API سے ابھی تک نہیں آئے۔ تھوڑا انتظار کریں یا انٹرنیٹ چیک کریں۔');
      return;
    }
    
    setIsSaving(true);
    setSavingStep(3);
    
    // ✅ پہلے سے چل رہا انٹروال کلئیر کریں
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    
    // ✅ نیا انٹروال شروع کریں
    countdownIntervalRef.current = setInterval(() => {
      setSavingStep((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const finalFajr = getJamaatTime('fajr', fajrOffset) || '05:30';
    const finalZuhr = getJamaatTime('zuhr', zuhrOffset) || '13:30';
    const finalAsr = getJamaatTime('asr', asrOffset) || '16:30';
    const finalMaghrib = getJamaatTime('maghrib', maghribOffset) || '19:05';
    const finalIsha = getJamaatTime('isha', ishaOffset) || '20:30';

    setTimeout(async () => {
      // ✅ انٹروال کلئیر کریں
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      try {
        // ✅ await لازمی — ورنہ Firestore کے جواب کا انتظار کیے بغیر
        // "کامیابی" دکھا دی جاتی ہے، چاہے سیو ناکام ہی کیوں نہ ہوا ہو
        await onAddOrUpdateMosque({
          id: editId,
          name,
          imamName,
          imamEmail: authEmail,
          imamUid: authUid || ('demo_' + authEmail.split('@')[0]),
          address,
          latitude: Number(latitude),
          longitude: Number(longitude),
          fajr: finalFajr,
          zuhr: finalZuhr,
          asr: finalAsr,
          maghrib: finalMaghrib,
          isha: finalIsha,
          jumah,
          eidFitr,
          eidAdha,
          sehri,
          iftar,
          announcement,
          fajrOffset,
          zuhrOffset,
          asrOffset,
          maghribOffset,
          ishaOffset,
        });
        setIsSaving(false);
        setSuccessMessage(editId
          ? 'الحمد للہ! کلاؤڈ سرور پر مسجد کے نئے اوقات کامیابی کے ساتھ اپڈیٹ ہو گئے ہیں۔'
          : 'مبارک ہو! نئی مسجد کا کلاؤڈ ریکارڈ کامیابی سے رجسٹر ہو گیا ہے۔'
        );
        setErrorMessage('');
        resetForm();
      } catch (err: any) {
        // ✅ اگر سیو کرنے میں ایرر آئے تو جھوٹی کامیابی نہ دکھائیں
        setIsSaving(false);
        setSuccessMessage('');
        const code = err?.code || '';
        const friendly =
          code === 'permission-denied'
            ? 'اجازت نہیں ملی۔ ممکن ہے آپ کا لاگ ان سیشن ختم ہو گیا ہو — دوبارہ Google سے لاگ ان کریں، یا یہ مسجد کسی اور امام کے اکاؤنٹ سے پہلے بنی ہو۔'
            : (err?.message || 'نامعلوم خرابی');
        setErrorMessage('مسجد کا ریکارڈ محفوظ کرنے میں مسئلہ پیش آیا: ' + friendly);
      }
    }, 3000);
  };

  // ── تھیمز (اب ایک ہی متفقہ، صاف رنگ سکیم) ──
  const PRAYER_THEMES: Record<string, { bg: string; border: string; text: string; btn: string; solidBg: string }> = {
    fajr: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-800', btn: 'border-slate-200 text-emerald-700', solidBg: 'bg-emerald-700' },
    zuhr: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-800', btn: 'border-slate-200 text-emerald-700', solidBg: 'bg-emerald-700' },
    asr: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-800', btn: 'border-slate-200 text-emerald-700', solidBg: 'bg-emerald-700' },
    maghrib: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-800', btn: 'border-slate-200 text-emerald-700', solidBg: 'bg-emerald-700' },
    isha: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-800', btn: 'border-slate-200 text-emerald-700', solidBg: 'bg-emerald-700' },
  };

  const PRAYER_LABELS: Record<string, string> = {
    fajr: 'فجر', zuhr: 'ظہر', asr: 'عصر', maghrib: 'مغرب', isha: 'عشاء',
  };

  // ── JamaatCard کمپوننٹ ──
  const JamaatCard = ({
    prayerKey, offset, onChange
  }: {
    prayerKey: 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha';
    offset: number; onChange: (v: number) => void;
  }) => {
    const theme = PRAYER_THEMES[prayerKey];
    const apiVal = apiTimes?.[prayerKey];
    const jamaatVal = getJamaatTime(prayerKey, offset);

    // ✅ منفی آفسیٹ کو روکیں
    const handleDecrement = () => {
      if (offset > 0) {
        onChange(offset - 1);
      }
    };

    return (
      <div className={`flex flex-col items-center gap-1.5 ${theme.bg} border ${theme.border} rounded-2xl p-3`}>
        <span className={`text-sm font-bold font-urdu ${theme.text}`}>{PRAYER_LABELS[prayerKey]}</span>

        <div className="text-[10px] font-mono text-slate-400 leading-tight text-center">
          {apiLoading ? 'لوڈ ہو رہا ہے...' : apiVal ? `اذان: ${to12Hour(apiVal)}` : '—'}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleDecrement}
            className={`w-7 h-7 rounded-lg bg-slate-50 border ${theme.btn} font-bold text-base flex items-center justify-center active:scale-95 cursor-pointer shrink-0 ${offset === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
            disabled={offset === 0}
          >−</button>
          <span className={`w-9 text-center font-mono font-bold text-xs ${theme.text}`}>
            {offset > 0 ? `+${offset}` : offset}
          </span>
          <button
            type="button"
            onClick={() => onChange(offset + 1)}
            className={`w-7 h-7 rounded-lg bg-slate-50 border ${theme.btn} font-bold text-base flex items-center justify-center active:scale-95 cursor-pointer shrink-0`}
          >+</button>
        </div>
        <span className="text-[9px] text-slate-400 font-mono -mt-1">منٹ</span>

        <div className={`w-full text-sm font-mono font-bold text-white ${theme.solidBg} rounded-lg px-1.5 py-1.5 text-center leading-tight`}>
          {jamaatVal ? to12Hour(jamaatVal) : '—:—'}
        </div>
        <span className="text-[9px] text-slate-400 font-urdu">جماعت کا وقت</span>
      </div>
    );
  };

  // ── رینڈر ──
  return (
    <>
      <div className="space-y-4 pb-20 animate-fadeIn">

        {!isAuthenticated ? (
          <div className="mx-4 mt-8 bg-slate-50 rounded-2xl border border-slate-200 p-8 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-white border border-slate-200 flex items-center justify-center">
              <Lock size={22} className="text-slate-400" />
            </div>
            <p className="text-slate-500 font-urdu text-sm">براہ کرم پہلے لاگ ان کریں</p>
          </div>
        ) : (
          <div className="space-y-3">

            <div className="animate-fadeIn">
              <div className="bg-white pt-5 pb-4 px-4 text-center">
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() => setShowLogoutConfirm(true)}
                    className="text-xs font-urdu text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1 rounded-full border border-rose-100 transition-all cursor-pointer"
                  >لاگ آؤٹ</button>
                  <span className="text-[11px] font-urdu flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    {isRealFirebase ? 'لائیو' : 'آف لائن'}
                  </span>
                </div>
                <div className="flex justify-center -mt-2 mb-2">
                  <div className="relative">
                    <div className="w-28 h-28 rounded-full border-4 border-emerald-100 shadow-lg overflow-hidden bg-emerald-50 flex items-center justify-center">
                      {mosqueImage ? <img src={mosqueImage} alt="مسجد" className="w-full h-full object-cover" /> : <span className="text-4xl">🕌</span>}
                    </div>
                    <label className="absolute bottom-0.5 right-0.5 w-6 h-6 bg-emerald-600 hover:bg-emerald-700 rounded-full flex items-center justify-center cursor-pointer border-2 border-white shadow-md transition-all">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            // ✅ تصویر کمپریس کریں
                            const compressed = await compressImage(file, 200, 0.7);
                            setMosqueImage(compressed);
                            try {
                              localStorage.setItem('mosque_profile_image', compressed);
                            } catch (storageErr) {
                              // ✅ اسٹوریج بھرا ہو تو بھی تصویر اسکرین پر دکھائیں، صرف خبردار کریں
                              setErrorMessage('تصویر دکھ تو رہی ہے، مگر محفوظ نہیں ہو سکی (اسٹوریج بھرا ہوا ہے)۔');
                              setTimeout(() => setErrorMessage(''), 4000);
                              return;
                            }
                            setSuccessMessage('تصویر کامیابی سے اپ لوڈ ہوگئی');
                            setTimeout(() => setSuccessMessage(''), 3000);
                          } catch (error) {
                            setErrorMessage('تصویر کمپریس کرنے میں مسئلہ ہوا');
                            setTimeout(() => setErrorMessage(''), 3000);
                          }
                        }} 
                      />
                    </label>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-slate-900 font-urdu leading-snug">{imamName || authName || 'امام صاحب'}</h2>
                <p className="text-base text-emerald-700 font-bold font-urdu mt-0.5">{name || myMosques[0]?.name || 'مسجد کا نام'}</p>
                <p className="text-xs text-slate-400 font-mono mt-1">{authEmail}</p>
              </div>
            </div>

            {myMosques.length > 0 && (
              <div className="px-4 space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between px-1 mb-1">
                  <span className="text-xs text-emerald-700 font-urdu font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">{myMosques.length} مسجد</span>
                  <span className="text-xs font-bold text-slate-500 font-urdu flex items-center gap-1">
                    <MapPin size={13} className="text-emerald-600" /> رجسٹر مساجد
                  </span>
                </div>
                {myMosques.map((mosque) => (
                  <MosqueCard
                    key={mosque.id}
                    mosque={mosque}
                    onEdit={handleEditMosqueClick}
                    onDelete={setDeleteConfirmId}
                  />
                ))}
              </div>
            )}

            <div className="space-y-4 animate-fadeIn px-4">
              <div className="flex items-center justify-end">
                <span className="text-xs text-amber-700 font-urdu font-bold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                  {editId ? 'پبلک اوقات ترمیم' : 'نیا ریکارڈ'}
                </span>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4 text-right">
                {!editId && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm text-slate-700 font-bold font-urdu block">مسجد کا نام *</label>
                      <input type="text" required placeholder="مثال: جامع مسجد مدینہ" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-400 transition-all text-right font-urdu" dir="rtl" />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm text-slate-700 font-bold font-urdu block">پتہ / ریجن / سیکٹر *</label>
                      <input type="text" required placeholder="مثال: سیکٹر ایف ٹین، اسلام آباد" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-400 transition-all text-right font-urdu" dir="rtl" />
                    </div>
                  </>
                )}

                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleAutoGrabLocation}
                      disabled={isGrabbingLocation}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all font-urdu flex items-center gap-1.5 cursor-pointer ${isGrabbingLocation ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 active:scale-95 border-emerald-100'}`}
                    >
                      {isGrabbingLocation ? (
                        <>
                          <RefreshCw size={13} className="shrink-0 animate-spin" /> لوکیشن ڈھونڈ رہے ہیں...
                        </>
                      ) : (
                        <>
                          <MapPin size={13} className="shrink-0" /> موجودہ لوکیشن آٹو حاصل کریں
                        </>
                      )}
                    </button>
                    <label className="text-sm text-slate-700 font-bold font-urdu block">نقشہ کے کوآرڈینیٹس (GPS) *</label>
                  </div>
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider text-left">Longitude</div>
                      <input 
                        type="text" 
                        inputMode="decimal" 
                        pattern="[0-9.]*"
                        required 
                        placeholder="72.9984" 
                        value={longitude ?? ''} 
                        onChange={(e) => {
                          // ✅ صرف نمبر اور ڈیسیمل پوائنٹ
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          setLongitude(value === '' ? null : Number(value));
                        }} 
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 transition-all text-left font-mono" 
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider text-left">Latitude</div>
                      <input 
                        type="text" 
                        inputMode="decimal" 
                        pattern="[0-9.]*"
                        required 
                        placeholder="33.6675" 
                        value={latitude ?? ''} 
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          setLatitude(value === '' ? null : Number(value));
                        }} 
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 transition-all text-left font-mono" 
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-end gap-2">
                    <div className="text-right">
                      <span className="text-sm font-bold font-urdu text-slate-700 block">جماعت کا وقت سیٹ کریں</span>
                    </div>
                  </div>

                  {latitude === null || longitude === null ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-right">
                      <p className="text-xs text-slate-500 font-urdu leading-relaxed">
                        پہلے اوپر GPS کوآرڈینیٹس درج کریں، تب اذان کا لائیو وقت یہاں نظر آئے گا۔
                      </p>
                    </div>
                  ) : apiError ? (
                    <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-right">
                      <p className="text-xs text-rose-700 font-urdu leading-relaxed">
                        اذان کا وقت لانے میں مسئلہ ہوا۔ انٹرنیٹ چیک کریں۔
                      </p>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-3 gap-2">
                    <JamaatCard prayerKey="fajr" offset={fajrOffset} onChange={setFajrOffset} />
                    <JamaatCard prayerKey="zuhr" offset={zuhrOffset} onChange={setZuhrOffset} />
                    <JamaatCard prayerKey="asr" offset={asrOffset} onChange={setAsrOffset} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <JamaatCard prayerKey="maghrib" offset={maghribOffset} onChange={setMaghribOffset} />
                    <JamaatCard prayerKey="isha" offset={ishaOffset} onChange={setIshaOffset} />
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-end">
                    <span className="text-sm font-bold font-urdu text-slate-700">جمعہ، عیدین اور رمضان کے اوقات</span>
                  </div>

                  <div className="bg-emerald-700 rounded-2xl p-3.5 flex items-center justify-between gap-2">
                    <button type="button" onClick={() => openCustomTimePicker('jumah', 'نمازِ جمعہ', jumah)} className="py-2 px-3 bg-white/15 hover:bg-white/25 active:scale-95 rounded-xl text-xs text-center font-mono font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer">
                      <Clock size={13} className="shrink-0" /><span>{formatTo12HourString(jumah)}</span>
                    </button>
                    <span className="text-sm text-white font-bold font-urdu">نمازِ جمعہ</span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1.5">
                        <span className="text-xs text-slate-600 font-bold font-urdu block text-right">عید الفطر جماعت</span>
                        <button type="button" onClick={() => openCustomTimePicker('eidFitr', 'عید الفطر جماعت', eidFitr)} className="w-full py-2 bg-slate-50 hover:bg-emerald-50 active:scale-95 border border-slate-200 rounded-xl text-xs text-center font-mono font-bold text-slate-800 flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                          <Clock size={13} className="text-emerald-600 shrink-0" /><span>{formatTo12HourString(eidFitr)}</span>
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-xs text-slate-600 font-bold font-urdu block text-right">عید الاضحی جماعت</span>
                        <button type="button" onClick={() => openCustomTimePicker('eidAdha', 'عید الاضحی جماعت', eidAdha)} className="w-full py-2 bg-slate-50 hover:bg-emerald-50 active:scale-95 border border-slate-200 rounded-xl text-xs text-center font-mono font-bold text-slate-800 flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                          <Clock size={13} className="text-emerald-600 shrink-0" /><span>{formatTo12HourString(eidAdha)}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1.5">
                        <span className="text-xs text-slate-600 font-bold font-urdu flex items-center justify-end gap-1"><Moon size={12} className="text-emerald-600" /> سحری کا وقت</span>
                        <button type="button" onClick={() => openCustomTimePicker('sehri', 'سحری کا وقت', sehri)} className="w-full py-2 bg-slate-50 hover:bg-emerald-50 active:scale-95 border border-slate-200 rounded-xl text-xs text-center font-mono font-bold text-slate-800 flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                          <Clock size={13} className="text-emerald-600 shrink-0" /><span>{formatTo12HourString(sehri)}</span>
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-xs text-slate-600 font-bold font-urdu flex items-center justify-end gap-1"><Sunrise size={12} className="text-emerald-600" /> افطاری کا وقت</span>
                        <button type="button" onClick={() => openCustomTimePicker('iftar', 'افطاری کا وقت', iftar)} className="w-full py-2 bg-slate-50 hover:bg-emerald-50 active:scale-95 border border-slate-200 rounded-xl text-xs text-center font-mono font-bold text-slate-800 flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                          <Clock size={13} className="text-emerald-600 shrink-0" /><span>{formatTo12HourString(iftar)}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-slate-100 pt-3">
                  <label className="text-sm text-slate-700 font-bold font-urdu block">اہم اعلان یا وقتی تبدیلی (اختیاری)</label>
                  <textarea placeholder="مثال: کل انشاء اللہ فجر کی نماز نئے وقت پر ادا کی جائے گی۔" value={announcement} onChange={(e) => setAnnouncement(e.target.value)} className="w-full p-3 h-16 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-400 transition-all text-right font-urdu" dir="rtl" />
                </div>

                <div className="pt-3 border-t border-slate-100">
                  <button type="submit" className="w-full py-3.5 bg-emerald-700 text-white rounded-xl text-sm font-urdu font-bold hover:bg-emerald-800 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                    <Save size={15} />
                    {editId ? 'ترمیم کلاؤڈ پر محفوظ کریں' : 'مسجد ریکارڈ کلاؤڈ پر رجسٹر کریں'}
                  </button>
                </div>
              </form>
            </div>

            <div className="pt-1 pb-2 select-none px-4">
              <button type="button" onClick={() => setShowLogoutConfirm(true)} className="w-full py-2.5 bg-white hover:bg-rose-50 text-rose-600 font-urdu font-bold text-sm rounded-xl border border-slate-200 hover:border-rose-100 transition-all flex items-center justify-center gap-2 cursor-pointer">
                لاگ آؤٹ کریں
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Active Picker ── */}
      {activePicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-4 touch-none overscroll-none select-none">
          <div className="bg-white rounded-3xl w-full max-w-[340px] shadow-xl overflow-hidden border border-slate-200 flex flex-col animate-fadeIn">
            <div className="bg-emerald-700 text-white p-4 text-center space-y-0.5">
              <div className="text-[10px] text-emerald-100 font-bold uppercase tracking-wider font-urdu">وقت تبدیل کریں</div>
              <h3 className="text-sm font-bold font-urdu text-amber-300">{activePicker.label} کا وقت</h3>
              <div className="text-xl font-mono font-extrabold tracking-widest mt-1 bg-emerald-800 py-1 px-3 rounded-lg inline-block">
                {String(activePicker.hour).padStart(2, '0')}:{String(activePicker.minute).padStart(2, '0')}{' '}
                <span className="text-xs">{activePicker.isPm ? 'PM' : 'AM'}</span>
              </div>
            </div>
            <div className="p-3.5 space-y-3 text-right">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center font-urdu">گھنٹہ</div>
                  <div className="grid grid-cols-3 gap-1">
                    {[12,1,2,3,4,5,6,7,8,9,10,11].map((h) => (
                      <button key={h} type="button" onClick={() => setActivePicker({ ...activePicker, hour: h })}
                        className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${activePicker.hour === h ? 'bg-emerald-700 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'}`}>
                        {String(h).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-1 pt-1 bg-slate-50 rounded-lg p-1 border border-slate-100">
                    <button type="button" onClick={() => { let h = activePicker.hour - 1; if (h < 1) h = 12; setActivePicker({ ...activePicker, hour: h }); }} className="w-6 h-6 bg-white hover:bg-slate-100 text-slate-700 rounded-md font-bold flex items-center justify-center text-xs border border-slate-200 cursor-pointer">-</button>
                    <span className="text-xs font-mono font-bold text-slate-700">{String(activePicker.hour).padStart(2, '0')}</span>
                    <button type="button" onClick={() => { let h = activePicker.hour + 1; if (h > 12) h = 1; setActivePicker({ ...activePicker, hour: h }); }} className="w-6 h-6 bg-white hover:bg-slate-100 text-slate-700 rounded-md font-bold flex items-center justify-center text-xs border border-slate-200 cursor-pointer">+</button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mt-1">
                    <button type="button" onClick={() => setActivePicker({ ...activePicker, isPm: false })} className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer border ${!activePicker.isPm ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                      <Sunrise size={15} /><span className="text-[10px] leading-none mt-0.5 font-urdu">صبح</span>
                    </button>
                    <button type="button" onClick={() => setActivePicker({ ...activePicker, isPm: true })} className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer border ${activePicker.isPm ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                      <Moon size={15} /><span className="text-[10px] leading-none mt-0.5 font-urdu">شام</span>
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center font-urdu">منٹ</div>
                  <div className="grid grid-cols-3 gap-1">
                    {[0,5,10,15,20,25,30,35,40,45,50,55].map((m) => (
                      <button key={m} type="button" onClick={() => setActivePicker({ ...activePicker, minute: m })}
                        className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${activePicker.minute === m ? 'bg-emerald-700 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'}`}>
                        {String(m).padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-1 pt-1 bg-slate-50 rounded-lg p-1 border border-slate-100 mt-1">
                    <button type="button" onClick={() => { let m = activePicker.minute - 1; if (m < 0) m = 59; setActivePicker({ ...activePicker, minute: m }); }} className="w-6 h-6 bg-white hover:bg-slate-100 text-slate-700 rounded-md font-bold flex items-center justify-center text-xs border border-slate-200 cursor-pointer">-</button>
                    <span className="text-xs font-mono font-bold text-slate-700">{String(activePicker.minute).padStart(2, '0')}</span>
                    <button type="button" onClick={() => { let m = activePicker.minute + 1; if (m > 59) m = 0; setActivePicker({ ...activePicker, minute: m }); }} className="w-6 h-6 bg-white hover:bg-slate-100 text-slate-700 rounded-md font-bold flex items-center justify-center text-xs border border-slate-200 cursor-pointer">+</button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-100 font-urdu">
                <button type="button" onClick={() => setActivePicker(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer">منسوخ کریں</button>
                <button type="button" onClick={saveCustomTime} className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer">محفوظ کریں</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── نام/پتہ ترمیم موڈل ── */}
      {showEditInfoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 touch-none overscroll-none select-none animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-[340px] shadow-xl border border-slate-200 p-5 space-y-4 text-right">
            <div className="flex items-center gap-2 justify-end text-emerald-700 border-b border-slate-100 pb-3">
              <span className="text-sm font-bold font-urdu">نام اور پتہ تبدیل کریں</span>
              <Pencil size={16} className="shrink-0 text-emerald-600" />
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm text-slate-700 font-bold font-urdu block">مسجد کا نام *</label>
                <input
                  type="text"
                  value={editInfoName}
                  onChange={(e) => setEditInfoName(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-400 transition-all text-right font-urdu"
                  dir="rtl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-slate-700 font-bold font-urdu block">پتہ / ریجن / سیکٹر *</label>
                <input
                  type="text"
                  value={editInfoAddress}
                  onChange={(e) => setEditInfoAddress(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-400 transition-all text-right font-urdu"
                  dir="rtl"
                />
              </div>
            </div>
            <div className="flex gap-2.5 pt-1 font-urdu">
              <button type="button" onClick={() => setShowEditInfoModal(false)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold cursor-pointer">منسوخ کریں</button>
              <button type="button" onClick={saveNameAddress} className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold cursor-pointer">محفوظ کریں</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ڈیلیٹ کنفرم ── */}
      {deleteConfirmId && (() => {
        const target = myMosques.find(m => m.id === deleteConfirmId);
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 touch-none overscroll-none select-none animate-fadeIn">
            <div className="bg-white rounded-3xl w-full max-w-[325px] shadow-xl border border-slate-200 p-5 space-y-4 text-right">
              <div className="flex items-center gap-2 justify-end text-rose-600 border-b border-slate-100 pb-3">
                <span className="text-sm font-bold font-urdu">مسجد ڈیلیٹ کریں</span>
                <Trash size={16} className="shrink-0 text-rose-500" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-700 leading-relaxed font-urdu">کیا آپ واقعی یہ مسجد مکمل طور پر ڈیلیٹ کرنا چاہتے ہیں؟</p>
                {target && <p className="text-sm font-bold text-rose-700 font-urdu bg-rose-50 px-3 py-2 rounded-xl border border-rose-100">{target.name}</p>}
                <p className="text-xs text-slate-400 font-urdu">یہ عمل واپس نہیں ہو سکتا۔</p>
              </div>
              <div className="flex gap-2.5 pt-1 font-urdu">
                <button type="button" onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold cursor-pointer">منسوخ کریں</button>
                <button type="button" onClick={() => { onDeleteMosque(deleteConfirmId); if (editId === deleteConfirmId) resetForm(); setDeleteConfirmId(null); setSuccessMessage('مسجد کا ریکارڈ کامیابی سے ڈیلیٹ کر دیا گیا ہے۔'); setTimeout(() => setSuccessMessage(''), 4000); }} className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold cursor-pointer">ہاں، ڈیلیٹ کریں</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── لوکیشن آف / GPS گائیڈ پاپ اپ ── */}
      {showLocationOffPopup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 touch-none overscroll-none select-none animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-[340px] shadow-xl border border-slate-200 p-5 space-y-4 text-right">
            <div className="flex items-center gap-2 justify-end text-amber-600 border-b border-slate-100 pb-3">
              <span className="text-sm font-bold font-urdu">لوکیشن آن کریں</span>
              <MapPin size={16} className="shrink-0 text-amber-500" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm text-slate-700 leading-relaxed font-urdu font-bold">
                برائے مہربانی پہلے اپنا لوکیشن (GPS) آن کریں۔
              </p>
              <p className="text-xs text-slate-500 leading-relaxed font-urdu">
                {locationOffMessage}
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1 font-urdu">
              <button
                type="button"
                onClick={() => { setShowLocationOffPopup(false); handleAutoGrabLocation(); }}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center gap-1.5"
              >
                <MapPin size={14} /> دوبارہ کوشش کریں
              </button>
              {onNavigateToSettings && (
                <button
                  type="button"
                  onClick={() => { setShowLocationOffPopup(false); onNavigateToSettings(); }}
                  className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-sm font-bold border border-amber-200 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  دستی طور پر لوکیشن سیٹ کریں (سیٹنگز)
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowLocationOffPopup(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold cursor-pointer"
              >منسوخ کریں</button>
            </div>
          </div>
        </div>
      )}

      {/* ── لاگ آؤٹ کنفرم ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 touch-none overscroll-none select-none animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-[325px] shadow-xl border border-slate-200 p-5 space-y-4 text-right">
            <div className="flex items-center gap-2 justify-end text-rose-600 border-b border-slate-100 pb-3">
              <span className="text-sm font-bold font-urdu">تصدیق لاگ آؤٹ</span>
              <AlertCircle size={16} className="shrink-0 text-rose-500" />
            </div>
            <p className="text-sm text-slate-700 leading-relaxed font-urdu">کیا آپ واقعی لاگ آؤٹ کرنا چاہتے ہیں؟</p>
            <div className="flex gap-2.5 pt-1 font-urdu">
              <button type="button" onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold cursor-pointer">منسوخ کریں</button>
              <button type="button" onClick={() => { setShowLogoutConfirm(false); handleLogOut(); }} className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold cursor-pointer">جی ہاں، لاگ آؤٹ کریں</button>
            </div>
          </div>
        </div>
      )}

      {/* ── سیونگ اوورلے ── */}
      {isSaving && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[999999] flex flex-col items-center justify-center p-6 text-center select-none touch-none animate-fadeIn">
          <div className="bg-emerald-900/40 p-7 rounded-full border-2 border-emerald-600/30 relative mb-4 animate-scaleUp">
            <RefreshCw className="text-amber-400 animate-spin" size={54} strokeWidth={2} />
            <span className="absolute inset-x-0 top-[26px] flex items-center justify-center font-mono font-bold text-white text-sm">{savingStep}</span>
          </div>
          <h3 className="text-base font-bold font-urdu text-amber-300 animate-pulse tracking-wide">اوقاتِ جماعت کلاؤڈ سرور پر اپڈیٹ ہو رہے ہیں...</h3>
          <p className="text-sm text-emerald-100 leading-relaxed font-urdu max-w-xs mt-2.5">براہ کرم تھوڑا انتظار کیجیئے۔</p>
          <div className="w-52 bg-slate-800 rounded-full h-1.5 mt-5 overflow-hidden">
            <div className="bg-amber-400 h-full rounded-full" style={{ width: `${((3 - savingStep) / 3) * 100}%`, transition: 'width 1.1s linear' }}></div>
          </div>
        </div>
      )}

      {/* ── نوٹیفکیشن پوپ اپ (تمام سکسس / فیل پیغامات) ── */}
      {(successMessage || errorMessage) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999999] flex items-center justify-center p-3 touch-none overscroll-none select-none animate-fadeIn">
          <div className="bg-white rounded-3xl w-full max-w-[320px] shadow-xl border border-slate-200 p-6 space-y-4 text-center animate-scaleUp">
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${errorMessage ? 'bg-rose-50' : 'bg-emerald-50'}`}>
              {errorMessage ? (
                <AlertCircle size={30} className="text-rose-600" />
              ) : (
                <CheckCircle size={30} className="text-emerald-600" />
              )}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed font-urdu font-bold">{errorMessage || successMessage}</p>
            <button
              type="button"
              onClick={() => { setSuccessMessage(''); setErrorMessage(''); }}
              className={`w-full py-2.5 rounded-xl text-sm font-bold font-urdu cursor-pointer text-white transition-all ${errorMessage ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-700 hover:bg-emerald-800'}`}
            >
              ٹھیک ہے
            </button>
          </div>
        </div>
      )}
    </>
  );
};
