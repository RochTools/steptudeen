import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Volume2, VolumeX, Sparkles, Plus, Settings, X, Flame, Clock, Check, Trash2, Smartphone, Smile } from 'lucide-react';

interface DhikrItem {
  ar: string;
  ur: string;
  en: string;
  meaning: string;
  count: number;
  savedProgress: number;
}

const DEFAULT_DHIKRS: DhikrItem[] = [
  { ar: 'سُبْحَانَ ٱللَّٰهِ', ur: 'سبحان اللہ', en: 'SubhanAllah', meaning: 'اللہ ہر عیب سے پاک ہے', count: 33, savedProgress: 0 },
  { ar: 'ٱلْحَمْدُ لِلَّٰهِ', ur: 'الحمد للہ', en: 'Alhamdulillah', meaning: 'سب تعریفیں اللہ کے لیے ہیں', count: 33, savedProgress: 0 },
  { ar: 'ٱللَّٰهُ أَكْبَرُ', ur: 'اللہ اکبر', en: 'Allahu Akbar', meaning: 'اللہ سب سے بڑا ہے', count: 34, savedProgress: 0 },
  { ar: 'لَآ اِلٰهَ اِلَّا اللهُ', ur: 'لا الہ الا اللہ', en: 'La ilaha illallah', meaning: 'اللہ کے سوا کوئی معبود نہیں', count: 100, savedProgress: 0 },
  { ar: 'أَسْتَغْفِرُ ٱللَّٰهَ', ur: 'استغفر اللہ', en: 'Astaghfirullah', meaning: 'میں اللہ سے گناہوں کی معافی مانگتا ہوں', count: 100, savedProgress: 0 }
];

let sharedAudioCtx: AudioContext | null = null;

export const TasbihView: React.FC = () => {
  // Navigation Tabs within Tasbih
  const [activeTab, setActiveTab] = useState<'counter' | 'stats'>('counter');

  // Load custom list or default list of Dhikrs
  const [dhikrList, setDhikrList] = useState<DhikrItem[]>(() => {
    try {
      const saved = localStorage.getItem('tasbih_dhikr_list_v4');
      return saved ? JSON.parse(saved) : DEFAULT_DHIKRS;
    } catch {
      return DEFAULT_DHIKRS;
    }
  });

  const [activeDhikrIndex, setActiveDhikrIndex] = useState<number>(() => {
    return Number(localStorage.getItem('tasbih_dhikr_idx_v4') || 0);
  });

  const [count, setCount] = useState<number>(() => {
    return Number(localStorage.getItem('tasbih_cycle_count_v4') || 0);
  });

  // Settings states
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('tasbih_sound_v4') !== 'false';
  });
  const [vibrateEnabled, setVibrateEnabled] = useState<boolean>(() => {
    return localStorage.getItem('tasbih_vibrate_v4') !== 'false';
  });
  const [autoCompleteAlert, setAutoCompleteAlert] = useState<boolean>(() => {
    return localStorage.getItem('tasbih_alert_v4') !== 'false';
  });

  // History state of counts per day { "2026-05-24": 120 }
  const [history, setHistory] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('tasbih_history_v4');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [target, setTarget] = useState<number>(() => {
    return Number(localStorage.getItem('tasbih_target_v4') || 33);
  });

  // Interactive Overlays
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showAddDhikrModal, setShowAddDhikrModal] = useState<boolean>(false);
  
  // Custom Dhikr Form Inputs
  const [customAr, setCustomAr] = useState<string>('');
  const [customUr, setCustomUr] = useState<string>('');
  const [customEn, setCustomEn] = useState<string>('');
  const [customMeaning, setCustomMeaning] = useState<string>('');
  const [customLimit, setCustomLimit] = useState<number>(33);

  // Status & Device tap effects
  const [isLightGlow, setIsLightGlow] = useState<boolean>(false);
  const [resetNotice, setResetNotice] = useState<string>('');
  const [tapEffect, setTapEffect] = useState<boolean>(false);
  
  // Live Clock header state
  const [timeStr, setTimeStr] = useState<string>('');
  const tapTimeoutRef = useRef<any>(null);

  // Sync state helpers
  useEffect(() => {
    localStorage.setItem('tasbih_dhikr_list_v4', JSON.stringify(dhikrList));
  }, [dhikrList]);

  useEffect(() => {
    localStorage.setItem('tasbih_dhikr_idx_v4', String(activeDhikrIndex));
  }, [activeDhikrIndex]);

  useEffect(() => {
    localStorage.setItem('tasbih_cycle_count_v4', String(count));
  }, [count]);

  useEffect(() => {
    localStorage.setItem('tasbih_sound_v4', String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('tasbih_vibrate_v4', String(vibrateEnabled));
  }, [vibrateEnabled]);

  useEffect(() => {
    localStorage.setItem('tasbih_alert_v4', String(autoCompleteAlert));
  }, [autoCompleteAlert]);

  useEffect(() => {
    localStorage.setItem('tasbih_history_v4', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('tasbih_target_v4', String(target));
  }, [target]);

  // Live clock tracker (updates every 10 secs)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const suffix = h >= 12 ? 'PM' : 'AM';
      let h12 = h % 12;
      if (h12 === 0) h12 = 12;
      setTimeStr(`${h12}:${String(m).padStart(2, '0')} ${suffix}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 10000);
    return () => clearInterval(interval);
  }, []);

  // Web Audio quick click generator
  const playClickSound = (freq = 540, duration = 0.04) => {
    if (!soundEnabled) return;
    try {
      if (!sharedAudioCtx) {
        sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume();
      }
      const audioCtx = sharedAudioCtx;
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime); 
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  };

  const triggerHaptic = (duration: number | number[] = 15) => {
    if (vibrateEnabled && navigator.vibrate) {
      navigator.vibrate(duration);
    }
  };

  // Date generators
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getHijriDateStringUrdu = () => {
    const d = new Date();
    const days = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
    const months = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
    return `${days[d.getDay()]}، ${d.getDate()} ${months[d.getMonth()]}`;
  };

  const activeDhikr = dhikrList[activeDhikrIndex] || DEFAULT_DHIKRS[0];

  // Calculate current active prayer timing based on current time
  const getActivePrayerNotification = () => {
    const now = new Date();
    const hrs = now.getHours();
    const mins = now.getMinutes();
    const totalMins = hrs * 60 + mins;

    if (totalMins >= 1245 || totalMins < 315) {
      return { label: 'عشاء کا وقت', time: '8:45 PM' };
    } else if (totalMins >= 1145) {
      return { label: 'مغرب کا وقت', time: '7:05 PM' };
    } else if (totalMins >= 990) {
      return { label: 'عصر کا وقت', time: '4:30 PM' };
    } else if (totalMins >= 810) {
      return { label: 'ظہر کا وقت', time: '1:30 PM' };
    } else {
      return { label: 'فجر کا وقت', time: '5:15 AM' };
    }
  };

  const activePrayer = getActivePrayerNotification();

  // Handle Increments (The Core click action)
  const handleIncrement = () => {
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    setTapEffect(true);

    const nextCount = count + 1;
    const todayKey = getLocalDateString();

    // Increment today's count in history
    const updatedHistory = {
      ...history,
      [todayKey]: (history[todayKey] || 0) + 1
    };
    setHistory(updatedHistory);

    // Save individual Dhikr progress
    const updatedDhikrs = [...dhikrList];
    if (updatedDhikrs[activeDhikrIndex]) {
      updatedDhikrs[activeDhikrIndex].savedProgress += 1;
      setDhikrList(updatedDhikrs);
    }

    // Target Limit check with celebration
    if (target > 0 && nextCount === target) {
      if (autoCompleteAlert) {
        playClickSound(880, 0.25); // Target chime
        triggerHaptic([80, 40, 80]); // Distinct vibration pattern
      } else {
        playClickSound(540, 0.04);
        triggerHaptic(12);
      }
      // Target hit, flash the light screen once as a nice indicator
      setIsLightGlow(true);
      setTimeout(() => setIsLightGlow(false), 220);
    } else {
      playClickSound(540, 0.04);
      triggerHaptic(12); // Shorter duration is cleaner and tighter for ultra fast clicks
    }

    setCount(nextCount);
    setResetNotice('');

    tapTimeoutRef.current = setTimeout(() => {
      setTapEffect(false);
    }, 70); 
  };

  const handleResetCurrent = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    playClickSound(300, 0.1);
    triggerHaptic(60);
    setCount(0);
    setResetNotice('موجودہ چکر صفر کر دیا گیا ہے');
    setTimeout(() => setResetNotice(''), 2200);
  };

  const handleResetAllRecords = () => {
    playClickSound(220, 0.2);
    triggerHaptic([80, 50, 80]);
    setCount(0);
    setHistory({});
    const baseReset = dhikrList.map(item => ({ ...item, savedProgress: 0 }));
    setDhikrList(baseReset);
    setResetNotice('تسبیح کے سارے دن اور ذکر کے اوقات کا ریکارڈ صاف کر دیا گیا');
    setTimeout(() => setResetNotice(''), 2500);
    setShowSettingsModal(false);
  };

  const selectDhikr = (idx: number) => {
    playClickSound(750, 0.05);
    triggerHaptic(20);
    setActiveDhikrIndex(idx);
    setTarget(dhikrList[idx].count);
    setCount(0);
    setResetNotice('');
  };

  const changeTargetLimit = (limit: number) => {
    playClickSound(720, 0.05);
    triggerHaptic(20);
    setTarget(limit);
    setCount(0);
    setResetNotice('');
  };

  // Add custom dhikr
  const handleAddCustomDhikr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAr.trim() || !customUr.trim()) return;

    const newItem: DhikrItem = {
      ar: customAr.trim(),
      ur: customUr.trim(),
      en: customEn.trim() || 'Custom Dhikr',
      meaning: customMeaning.trim() || 'میرا اپنا ذکر',
      count: customLimit,
      savedProgress: 0
    };

    const newList = [...dhikrList, newItem];
    setDhikrList(newList);
    setActiveDhikrIndex(newList.length - 1);
    setTarget(customLimit);
    setCount(0);

    // Reset inputs
    setCustomAr('');
    setCustomUr('');
    setCustomEn('');
    setCustomMeaning('');
    setCustomLimit(33);
    setShowAddDhikrModal(false);

    playClickSound(880, 0.15);
    triggerHaptic([40, 40]);
    setResetNotice('نیا ذکر کسٹم لسٹ میں شامل کر دیا گیا ہے!');
    setTimeout(() => setResetNotice(''), 2200);
  };

  const handleDeleteDhikr = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    if (dhikrList.length <= 1) return; // Must keep at least one
    
    playClickSound(200, 0.1);
    triggerHaptic(40);

    const newList = dhikrList.filter((_, i) => i !== idx);
    setDhikrList(newList);
    if (activeDhikrIndex >= newList.length) {
      setActiveDhikrIndex(0);
      setTarget(newList[0].count);
    } else {
      setTarget(newList[activeDhikrIndex].count);
    }
    setCount(0);
  };

  // Calculate statistics metrics
  const getTodayDhikrCount = () => {
    return history[getLocalDateString()] || 0;
  };

  const getWeekDhikrCount = () => {
    let sum = 0;
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      sum += history[key] || 0;
    }
    return sum;
  };

  const getMonthDhikrCount = () => {
    let sum = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      sum += history[key] || 0;
    }
    return sum;
  };

  // Calculation for active consecutive days streak
  const calculateStreakCount = () => {
    let streak = 0;
    const today = new Date();
    
    const formatDateObj = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    let currentDate = new Date(today);
    let checkDateStr = formatDateObj(currentDate);
    
    // Check if we did any dhikr today. If not, check from yesterday to maintain streak
    if (!history[checkDateStr] || history[checkDateStr] === 0) {
      currentDate.setDate(currentDate.getDate() - 1);
      checkDateStr = formatDateObj(currentDate);
    }
    
    while (history[checkDateStr] && history[checkDateStr] > 0) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
      checkDateStr = formatDateObj(currentDate);
    }
    return streak;
  };

  const streakVal = calculateStreakCount();

  // Format past 7 days statistics map for our bar custom graphs
  // Graph functionality removed to maximize space for saved records list

  // Grand Total of all records compiled
  const getGrandTotalCount = () => {
    return Object.values(history).reduce((a, b) => (a as number) + (b as number), 0);
  };

  const grandTotalAll = getGrandTotalCount();

  return (
    <div 
      onClick={handleIncrement}
      className="fixed inset-x-0 top-0 bottom-[6px] w-full bg-gradient-to-b from-[#fffefe] via-[#fffdf0] to-[#fef2c7] px-3 pt-3 pb-2 flex flex-col items-center select-none overflow-hidden max-w-md mx-auto cursor-pointer active:brightness-[0.99] transition-all duration-150 group touch-manipulation"
      style={{
        touchAction: 'manipulation'
      }}
      dir="rtl"
    >
      {/* Background Beautiful Islamic Geometric lattice spanning entire layout background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.11] z-0">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="islamic-grid-tasbih" width="45" height="45" patternUnits="userSpaceOnUse">
              <path d="M 22.5,0 L 45,22.5 L 22.5,45 L 0,22.5 Z" fill="none" stroke="#d97706" strokeWidth="0.4" />
              <circle cx="22.5" cy="22.5" r="3.5" fill="none" stroke="#d97706" strokeWidth="0.3" />
              <path d="M 0,0 L 45,45 M 0,45 L 45,0" fill="none" stroke="#d97706" strokeWidth="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#islamic-grid-tasbih)" />
        </svg>
      </div>

      {/* Soft elegant Mosque domes silhouette background at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-28 pointer-events-none opacity-[0.06] z-0 flex items-end justify-center">
        <svg width="100%" height="100%" viewBox="0 0 400 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M 0,120 L 400,120 L 400,100 C 370,100 360,80 340,80 C 320,80 310,100 280,100 C 250,100 240,60 200,60 C 160,60 150,100 120,100 C 90,100 80,75 60,75 C 40,75 30,100 0,100 Z" fill="#d97706" />
        </svg>
      </div>

      {/* Real Traditional Gold Border Arc Outline Overlay */}
      <div className="absolute inset-2 border border-[#fbbf24]/35 pointer-events-none rounded-[22px] z-0" />

      {/* Ornate Arch/Dome effect details */}
      <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none z-0 flex flex-col justify-between items-center opacity-[0.14]">
        <div className="w-full h-24 border-b border-[#f59e0b]/25" style={{
          background: 'radial-gradient(ellipse at bottom, transparent 45%, rgba(245, 158, 11, 0.08) 100%)'
        }} />
        <div className="w-full h-16 border-t border-[#f59e0b]/25" style={{
          background: 'radial-gradient(ellipse at top, transparent 45%, rgba(245, 158, 11, 0.08) 100%)'
        }} />
      </div>

      {/* ================= HEADER REMINDER & SYSTEM ACTIONS ================= */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full flex justify-between items-center relative z-40 bg-white/75 backdrop-blur border border-amber-500/15 p-2 rounded-2xl shadow-sm tracking-tight select-none shrink-0"
      >
        {/* Date, Clock & Prayer reminders */}
        <div className="flex items-center gap-1.5 flex-row-reverse text-right">
          <div className="p-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center justify-center">
            <Clock size={12} className="text-emerald-700" />
          </div>
          <div>
            <div className="flex gap-1 items-center justify-end">
              <span className="text-[9px] font-mono font-black text-amber-950">{timeStr}</span>
              <span className="text-[9px] font-bold text-stone-500 font-urdu">{getHijriDateStringUrdu()}</span>
            </div>
            <p className="text-[7.5px] font-bold text-emerald-800 font-urdu mt-0.5 leading-none">
              {activePrayer.label}: <span className="font-mono text-[8px] font-black text-emerald-700">{activePrayer.time}</span>
            </p>
          </div>
        </div>

        {/* Tab switcher design & Settings Button */}
        <div className="flex items-center gap-1">
          {/* Navigation Segments Toggle */}
          <div className="bg-amber-100/55 p-0.5 rounded-lg border border-amber-200/30 flex items-center">
            <button
              onClick={() => { playClickSound(700, 0.05); triggerHaptic(15); setActiveTab('counter'); }}
              className={`px-2 py-1 rounded-md text-[8.5px] font-bold font-urdu transition-all cursor-pointer ${
                activeTab === 'counter'
                  ? 'bg-gradient-to-tr from-[#d97706] to-[#78350f] text-white shadow-md'
                  : 'text-amber-900/60 hover:text-amber-950'
              }`}
            >
              کاؤنٹر
            </button>
            <button
              onClick={() => { playClickSound(700, 0.05); triggerHaptic(15); setActiveTab('stats'); }}
              className={`px-2 py-1 rounded-md text-[8.5px] font-bold font-urdu transition-all cursor-pointer ${
                activeTab === 'stats'
                  ? 'bg-gradient-to-tr from-[#d97706] to-[#78350f] text-white shadow-md'
                  : 'text-amber-900/60 hover:text-amber-950'
              }`}
            >
              رِکارڈ
            </button>
          </div>

          {/* Setting gear trigger */}
          <button
            onClick={() => { playClickSound(720, 0.06); triggerHaptic(20); setShowSettingsModal(true); }}
            className="p-1.5 rounded-xl border border-amber-200/60 bg-white hover:bg-amber-50 text-amber-900 shadow-sm transition-all cursor-pointer relative"
            title="ترتیبات"
          >
            <Settings size={13} className="text-amber-800" />
          </button>
        </div>
      </div>

      {/* ================= VIEW 1: MAIN TACTILE COUNTER INTERFACE ================= */}
      {activeTab === 'counter' ? (
        <div className="w-full flex-1 flex flex-col justify-between items-center relative z-20 mt-2 select-none min-h-0">
          
          {/* DHIKR BANNER SELECTION TRAY */}
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white/90 backdrop-blur rounded-2xl border border-amber-200/60 p-2 text-center shadow-sm w-full shrink-0"
          >
            <div className="flex items-center justify-between pb-1 flex-row-reverse mb-1 px-1">
              <button
                onClick={() => { playClickSound(750, 0.06); triggerHaptic(20); setShowAddDhikrModal(true); }}
                className="py-1 px-2.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-all text-[8.5px] font-extrabold font-urdu flex items-center gap-1 cursor-pointer"
              >
                <Plus size={10} className="text-emerald-700 stroke-[3]" />
                نیا ذکر
              </button>
              
              <h3 className="text-[9.5px] font-black text-amber-950 font-urdu flex items-center gap-1">
                <Sparkles size={11} className="text-amber-500" />
                تسبیح کا ذکر منتخب کیجئیے:
              </h3>
            </div>

            {/* Dhikr scroll container */}
            <div className="flex gap-1.5 overflow-x-auto py-1 px-0.5 no-scrollbar flex-row-reverse" dir="rtl">
              {dhikrList.map((item, idx) => (
                <div key={idx} className="relative shrink-0 group/card">
                  <button
                    onClick={() => selectDhikr(idx)}
                    className={`py-1.5 px-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center min-w-[85px] h-[48px] ${
                      activeDhikrIndex === idx
                        ? 'bg-gradient-to-br from-[#d97706] to-[#78350f] text-white border-amber-500 shadow-md transform scale-[1.02]'
                        : 'bg-amber-50/45 text-amber-950 border border-amber-200/40 hover:bg-amber-50/80'
                    }`}
                  >
                    <span className="text-[10px] font-bold font-urdu leading-tight">{item.ur}</span>
                    <span className="text-[7.5px] font-mono leading-none mt-1 opacity-80">{item.count} بار</span>
                    {item.savedProgress > 0 && (
                      <span className="text-[6.5px] font-urdu font-black mt-0.5 opacity-90 text-amber-100">({item.savedProgress})</span>
                    )}
                  </button>

                  {/* Deletion cross button for custom loaded dhikrs, ensures safe default locking */}
                  {dhikrList.length > 1 && idx >= DEFAULT_DHIKRS.length && (
                    <button
                      onClick={(e) => handleDeleteDhikr(e, idx)}
                      className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-rose-600 text-white flex items-center justify-center border border-rose-300 hover:bg-rose-700 cursor-pointer shadow-sm z-30 transition-all opacity-0 group-hover/card:opacity-100"
                      title="ترک کریں"
                    >
                      <X size={7} strokeWidth={4} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* TARGETS & PROGRESS SUMMARY HEADER BAR */}
          <div className="w-full flex justify-between items-center shrink-0 py-1.5 relative z-20" onClick={(e) => e.stopPropagation()}>
            {/* Target values */}
            <div className="flex items-center gap-1 bg-white/90 backdrop-blur px-2 py-0.5 rounded-lg border border-amber-200 shadow-xs text-amber-950">
              <span className="text-[8.5px] text-amber-800 font-urdu font-black leading-none">حد:</span>
              {[33, 99, 100, 0].map((limit) => (
                <button
                  key={limit}
                  onClick={(e) => {
                     e.stopPropagation();
                     changeTargetLimit(limit);
                  }}
                  className={`w-6 py-0.5 rounded font-mono text-[8.5px] font-black border transition-all cursor-pointer ${
                    target === limit
                      ? 'bg-gradient-to-r from-[#d97706] to-[#b45309] border-[#b45309] text-white shadow-xs'
                      : 'bg-[#faf6eb] border-amber-200 text-stone-600 hover:bg-amber-50'
                  }`}
                >
                  {limit === 0 ? '∝' : limit}
                </button>
              ))}
            </div>

            {/* Today progress & total counter */}
            <div className="flex items-center gap-2 bg-white/90 backdrop-blur px-2.5 py-0.5 rounded-lg border border-amber-200 shadow-xs text-right font-bold text-stone-850">
              <div className="flex items-center gap-1 pl-1 border-r border-[#edd6b3]">
                <span className="text-[7.5px] text-stone-550 font-mono leading-none">آج کُل:</span>
                <span className="font-mono text-[10px] font-black text-emerald-800">
                  {getTodayDhikrCount()}
                </span>
              </div>
              
              <div className="flex gap-1 items-center">
                <span className="text-[7.5px] text-amber-800 font-urdu leading-none">مجموعی کُل:</span>
                <span className="font-mono text-[9px] font-bold text-stone-600">
                  {grandTotalAll}
                </span>
              </div>
            </div>
          </div>

          {/* THE GOLDEN MIHRAB SHAPED CONTAINER CARD FROM USER SCREENSHOT */}
          <div className="relative w-full max-w-[290px] mx-auto flex flex-col items-center justify-between px-4 pt-3 pb-5 my-1 flex-1 min-h-0 z-20">
            {/* Real SVG backdrop forming the steps and dome shape */}
            <div className="absolute inset-0 pointer-events-none z-0">
              <svg className="w-full h-full drop-shadow-[0_6px_14px_rgba(180,83,9,0.18)]" viewBox="0 0 290 355" fill="none" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="mihrab-grad" x1="145" y1="0" x2="145" y2="355" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#fef3c7" />
                    <stop offset="30%" stopColor="#fcd34d" />
                    <stop offset="85%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                  
                  {/* Fine traditional geometric line tile pattern */}
                  <pattern id="mihrab-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
                    <path d="M 12,0 L 24,12 L 12,24 L 0,12 Z" fill="none" stroke="#d97706" strokeWidth="0.15" strokeOpacity="0.3" />
                    <circle cx="12" cy="12" r="2" fill="none" stroke="#d97706" strokeWidth="0.12" strokeOpacity="0.3" />
                    <path d="M 0,0 L 24,24 M 0,24 L 24,0" fill="none" stroke="#d97706" strokeWidth="0.1" strokeOpacity="0.25" />
                  </pattern>
                </defs>
                
                {/* Stepped traditional Islamic dome arch silhouette */}
                <path 
                  d="M 145,4 
                     C 175,22 215,32 235,46 
                     L 245,46 
                     L 245,64 
                     L 262,64 
                     C 272,110 274,180 274,290 
                     C 274,315 240,333 210,341 
                     L 145,351 
                     L 80,341 
                     C 50,333 16,315 16,290 
                     C 16,180 18,110 28,64 
                     L 45,64 
                     L 45,46 
                     L 55,46 
                     C 75,32 115,22 145,4 Z"
                  fill="url(#mihrab-grad)"
                  stroke="#fbbf24"
                  strokeWidth="1.2"
                />
                <path 
                  d="M 145,4 
                     C 175,22 215,32 235,46 
                     L 245,46 
                     L 245,64 
                     L 262,64 
                     C 272,110 274,180 274,290 
                     C 274,315 240,333 210,341 
                     L 145,351 
                     L 80,341 
                     C 50,333 16,315 16,290 
                     C 16,180 18,110 28,64 
                     L 45,64 
                     L 45,46 
                     L 55,46 
                     C 75,32 115,22 145,4 Z"
                  fill="url(#mihrab-pattern)"
                />
                
                {/* Thin gold accent border line inside the dome card */}
                <path 
                  d="M 145,10 
                     C 172,26 210,36 228,48 
                     L 238,48 
                     L 238,58 
                     L 254,58 
                     C 264,102 266,175 266,285 
                     C 266,307 234,323 206,333 
                     L 145,343 
                     L 84,333 
                     C 56,323 24,307 24,285 
                     C 24,175 26,102 36,58 
                     L 52,58 
                     L 52,48 
                     L 62,48 
                     C 80,36 118,26 145,10 Z"
                  fill="none"
                  stroke="#d97706"
                  strokeWidth="0.75"
                  strokeOpacity="0.45"
                />
              </svg>
            </div>

            {/* MIDDLE UPPER HOLY DISPLAY TEXT */}
            <div className="w-full flex flex-col items-center justify-center text-center mt-2.5 pb-1 relative z-10 select-none pointer-events-none">
              <span className="text-[10px] font-amiri font-bold text-amber-950/80 tracking-wide leading-none mb-1 block">
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </span>

              <h2 className="text-2xl sm:text-[27px] font-naskh font-black text-amber-950 my-1 leading-snug select-none filter drop-shadow-[0_1.5px_1px_rgba(255,255,255,0.7)]">
                {activeDhikr.ar}
              </h2>

              <span className="text-[9px] sm:text-[9.5px] font-sans font-extrabold text-[#7c2d12] tracking-widest uppercase opacity-90 select-none block">
                {activeDhikr.en}
              </span>
              <span className="text-[8.5px] sm:text-[9px] font-urdu text-amber-950/80 mt-1 max-w-[210px] leading-snug select-none block">
                {activeDhikr.meaning}
              </span>
            </div>

            {/* THE SEAMLESS GREEN HAND HELD DEVICE TACTILE HOUSINGS */}
            <div 
              className="relative w-[138px] h-[168px] shrink-0 flex flex-col items-center justify-start z-10 select-none my-1"
              onClick={(e) => {
                e.stopPropagation();
                handleIncrement();
              }}
            >
              {/* SVG counter base structure precisely tapered narrowing at the bottom edge */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 138 168" fill="none" xmlns="http://www.w3.org/2005/svg">
                <defs>
                  <linearGradient id="body-grad" x1="69" y1="0" x2="69" y2="168" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#41dc7c" />
                    <stop offset="35%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#036045" />
                  </linearGradient>
                  <linearGradient id="inner-shadow-grad" x1="69" y1="0" x2="69" y2="168" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.32" />
                    <stop offset="20%" stopColor="#ffffff" stopOpacity="0.05" />
                    <stop offset="75%" stopColor="#000000" stopOpacity="0.0" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
                  </linearGradient>
                  <linearGradient id="shiny-grad" x1="69" y1="3" x2="69" y2="45" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                <path 
                  d="M 69,2 C 114,2 136,10 136,40 C 136,66 122,80 112,92 C 102,104 118,118 118,137 C 118,152 96,166 69,166 C 42,166 20,152 20,137 C 20,118 36,104 26,92 C 16,80 2,66 2,40 C 2,10 24,2 69,2 Z" 
                  fill="url(#body-grad)"
                  stroke="#032d19"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
                <path 
                  d="M 69,2 C 114,2 136,10 136,40 C 136,66 122,80 112,92 C 102,104 118,118 118,137 C 118,152 96,166 69,166 C 42,166 20,152 20,137 C 20,118 36,104 26,92 C 16,80 2,66 2,40 C 2,10 24,2 69,2 Z" 
                  fill="url(#inner-shadow-grad)"
                />
                <path 
                  d="M 12,32 C 12,18 25,6 69,6 C 113,6 126,18 126,32 C 126,35 110,18 69,18 C 28,18 12,35 12,32 Z" 
                  fill="url(#shiny-grad)"
                />
              </svg>

              {/* LCD Digital Backlight Display Screen housing with glass reflection glare overlays */}
              <div className="w-[102px] mt-3.5 p-[1px] bg-[#111812] rounded-lg shadow-inner relative z-10" style={{ border: '0.75px solid #031c10' }}>
                <div className={`w-full h-10 rounded-md flex items-center justify-center relative overflow-hidden transition-all duration-300 ${
                  isLightGlow 
                    ? 'bg-[#1de9b6] shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_0_10px_rgba(29,233,182,0.6)]' 
                    : 'bg-[#bbc7bc] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)]'
                }`}>
                  {/* 3D Recessed edge level frame shadows */}
                  <div className="absolute inset-0 rounded-md pointer-events-none z-20" style={{ boxShadow: 'inset 0 3.5px 4px rgba(0,0,0,0.5), inset 0 -1.5px 2px rgba(255,255,255,0.2)' }} />

                  {/* Glare effect sheen */}
                  <div className={`absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/25 pointer-events-none z-15 transition-opacity duration-300 ${isLightGlow ? 'opacity-40' : 'opacity-85'}`} />

                  {/* Retro micro scan lines */}
                  <div className="absolute inset-0 bg-linear-to-b from-transparent via-black/[0.03] to-transparent bg-[size:100%_2px] pointer-events-none z-10 opacity-30" />

                  {/* The Digit Numbers - Aligned nicely starting dynamically right justified representation */}
                  <div className="flex gap-[3.5px] justify-center items-center relative z-10 font-digital text-[23px] font-black leading-none select-none" dir="ltr">
                    {(count === 0 ? ['0', '0', '0', '0'] : String(count).padStart(4, ' ').split('')).map((digit, idx) => (
                      <div key={idx} className="w-[16px] h-7 flex items-center justify-center relative">
                        <span className={`absolute inset-0 flex items-center justify-center opacity-[0.06] pointer-events-none z-5 ${
                          isLightGlow ? 'text-[#04281e]' : 'text-black/85'
                        }`}>
                          8
                        </span>
                        {digit !== ' ' && (
                          <span className={`absolute inset-0 flex items-center justify-center transition-colors duration-300 z-10 ${
                            isLightGlow ? 'text-[#115947]' : 'text-[#445242]'
                          }`} style={{ 
                            textShadow: isLightGlow 
                              ? '0.5px 1px 1.5px rgba(2,30,22,0.25)' 
                              : '0.5px 1px 0.5px rgba(255,255,255,0.4)' 
                          }}>
                            {digit}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Hardware marking labels */}
              <div className="w-[82px] flex justify-between px-1.5 mt-1.5 text-[5px] font-mono font-extrabold text-[#d1faf0]/75 tracking-tight uppercase select-none pointer-events-none relative z-10">
                <span>Reset</span>
                <span>Count</span>
                <span>Light</span>
              </div>

              {/* Micro functional buttons */}
              <div className="w-[82px] flex justify-between items-center px-0.5 mt-0.5 select-none relative z-10">
                {/* Reset current toggle */}
                <button
                  onClick={(e) => handleResetCurrent(e)}
                  className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-stone-50 via-stone-200 to-stone-400 active:scale-90 transition-all cursor-pointer relative"
                  style={{
                    border: '0.5px solid #2e2a24', 
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}
                  title="تسبیح صفر کریں"
                >
                  <div className="absolute inset-0.5 rounded-full bg-white/30" />
                </button>

                {/* Light Led Status */}
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-950/20 border-[0.5px] border-emerald-950/45 flex items-center justify-center animate-pulse">
                  <div className={`w-1 h-1 rounded-full ${isLightGlow ? 'bg-emerald-400' : 'bg-emerald-800'}`} />
                </div>

                {/* Light Screen Switch button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playClickSound(640, 0.04);
                    triggerHaptic(15);
                    setIsLightGlow(!isLightGlow);
                  }}
                  className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-stone-50 via-stone-200 to-stone-400 active:scale-95 transition-all cursor-pointer relative"
                  style={{
                    border: '0.5px solid #2e2a24',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                  }}
                  title="سکرین لائٹ آن / آف"
                >
                  <div className="absolute inset-0.5 rounded-full bg-white/30" />
                </button>
              </div>

              {/* GOLD METALLIC KEY TRIGGER */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleIncrement();
                }}
                className={`mt-2.5 w-[46px] h-[46px] rounded-full bg-gradient-to-b from-[#ffebaa] via-[#e5b539] to-[#ac8010] cursor-pointer transform transition-all duration-75 flex items-center justify-center relative z-10 select-none ${
                  tapEffect ? 'scale-[0.88] translate-y-[1.5px] shadow-inner brightness-[0.93]' : 'scale-100 hover:brightness-[1.04]'
                }`}
                style={{
                  border: '1px solid #7c5c07', 
                  boxShadow: tapEffect 
                    ? 'inset 0 4px 6px rgba(0,0,0,0.4), 0 1px 1px rgba(255,255,255,0.2)' 
                    : 'inset 0 1px 2px rgba(255,255,255,0.65), 0 3px 8px rgba(0,0,0,0.35)',
                  touchAction: 'manipulation'
                }}
              >
                <div className="w-[32px] h-[32px] rounded-full bg-gradient-to-tr from-[#dfb02a] via-[#fef2c7] to-white shadow-sm flex items-center justify-center pointer-events-none" style={{ border: '0.5px solid #c59714' }}>
                  <div className="w-[24px] h-[24px] rounded-full bg-gradient-to-b from-[#fffae8] via-[#e5b33a] to-[#b38515] relative overflow-hidden" style={{ border: '0.5px solid #a1780b' }}>
                    <div className="absolute top-[1.5px] left-[1.5px] w-[14px] h-[7px] bg-gradient-to-b from-white/70 to-transparent rounded-full pointer-events-none" />
                  </div>
                </div>
                <div className="absolute top-0.5 inset-x-2 h-3.5 bg-gradient-to-b from-white/55 to-transparent rounded-full blur-[0.25px] pointer-events-none" />
              </button>
            </div>

            {/* PROGRESS VALUE RATIO UNDERNEATH DEVICE */}
            <div className="flex flex-col items-center justify-center mt-1 relative z-10" onClick={(e) => e.stopPropagation()}>
              <span className="text-sm font-mono font-black text-amber-950 select-none block tracking-wide">
                {count} / {target === 0 ? 'infinite' : target}
              </span>
            </div>

            {/* Clean, elegant white Reset button under counts exactly as shown in the screenshot */}
            <button
              onClick={(e) => handleResetCurrent(e)}
              className="mt-1 px-6 py-1 select-none text-[10px] font-black tracking-tight text-amber-950 bg-white border border-amber-500/15 hover:bg-stone-50 rounded-lg active:scale-95 transition-all shadow-sm shrink-0 font-urdu relative z-10"
              title="تسبیح صفر کریں"
            >
              شروع سے
            </button>
          </div>
        </div>
      ) : (
        /* ================= VIEW 2: STATISTICS & HISTORY ANALYTICS ================= */
        <div 
          onClick={(e) => e.stopPropagation()}
          className="w-full flex-1 flex flex-col gap-3 relative z-20 mt-2 text-right select-none animate-fadeIn text-amber-950"
        >
          {/* STATS MATRIX CARDS ROW */}
          <div className="grid grid-cols-4 gap-1.5 font-urdu">
            <div className="bg-gradient-to-tr from-[#fef3c7] to-[#fde68a] p-1.5 rounded-xl border border-amber-300 text-center shadow-xs flex flex-col justify-center relative overflow-hidden text-amber-950">
              <div className="absolute -top-1 -right-1 opacity-10">
                <Flame size={24} className="text-orange-500" />
              </div>
              <span className="text-[7.5px] font-black text-amber-900 flex items-center justify-center gap-0.5 animate-pulse">
                سلسلہ وار دن
                <Flame size={7} className="text-orange-600 fill-orange-500 animate-bounce" />
              </span>
              <span className="font-mono text-base font-black text-amber-950 mt-1 leading-none">{streakVal}</span>
              <span className="text-[6.5px] text-amber-800 font-bold mt-1">روزانہ سٹریک</span>
            </div>

            {/* Today card */}
            <div className="bg-white/85 p-1.5 rounded-xl border border-amber-200 text-center shadow-xs flex flex-col justify-center">
              <span className="text-[7.5px] font-bold text-stone-550">آج کی گِنتی</span>
              <span className="font-mono text-base font-black text-amber-950 mt-1 leading-none">{getTodayDhikrCount()}</span>
              <span className="text-[6.5px] text-emerald-800 font-bold mt-1">بار کیا گیا</span>
            </div>

            {/* Week total card */}
            <div className="bg-white/85 p-1.5 rounded-xl border border-amber-200 text-center shadow-xs flex flex-col justify-center">
              <span className="text-[7.5px] font-bold text-stone-550">حالیہ ہفتہ</span>
              <span className="font-mono text-base font-black text-amber-950 mt-1 leading-none">{getWeekDhikrCount()}</span>
              <span className="text-[6.5px] text-stone-550 font-bold mt-1">گزشتہ 7 روز</span>
            </div>

            {/* Monthly tally card */}
            <div className="bg-white/85 p-1.5 rounded-xl border border-amber-200 text-center shadow-xs flex flex-col justify-center">
              <span className="text-[7.5px] font-bold text-stone-550">حالیہ مہینہ</span>
              <span className="font-mono text-base font-black text-amber-950 mt-1 leading-none">{getMonthDhikrCount()}</span>
              <span className="text-[6.5px] text-stone-550 font-bold mt-1">گزشتہ 30 روز</span>
            </div>
          </div>

          {/* LIST OF SAVED DHIKRS WITH THEIR UNIQUE PROGRESS PERCENTAGE ACHIEVEMENTS */}
          <div className="bg-white/95 backdrop-blur rounded-2xl p-4 border border-amber-200 flex-1 overflow-y-auto no-scrollbar text-right flex flex-col min-h-0">
            <h4 className="text-[11px] font-extrabold text-[#7c2d12] font-urdu mb-3 pb-1.5 border-b border-amber-100/60">
              ہر ذکر کا انفرادی محفوظ ریکارڈ (پروگریس):
            </h4>
            <div className="space-y-2 select-none flex-1 overflow-y-auto no-scrollbar" dir="rtl">
              {dhikrList.map((item, idx) => {
                const currentGoal = item.count || 100;
                // Ratio helper
                const percentDone = Math.round((item.savedProgress / currentGoal) * 100);
                return (
                  <div key={idx} className="bg-amber-50/70 hover:bg-amber-50/95 rounded-xl p-2.5 border border-amber-200/50 flex items-center justify-between text-right shadow-xs transition-all duration-150">
                    <div>
                      <p className="text-[11.5px] font-black text-[#5c1d06] font-urdu">{item.ur}</p>
                      <p className="text-[8px] font-mono text-stone-500 uppercase font-black leading-none mt-1">{item.en}</p>
                    </div>

                    <div className="text-left font-bold font-mono flex flex-col items-end">
                      <p className="text-[11px] text-[#b45309]">{item.savedProgress} <span className="text-[8px] text-stone-550 font-urdu">بار پڑھے</span></p>
                      <div className="w-24 h-1.5 mt-1.5 bg-amber-100 rounded-full overflow-hidden relative">
                        <div className="absolute inset-y-0 right-0 bg-[#d97706] rounded-full transition-all" style={{ width: `${Math.min(percentDone, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= ALERTS & BOTTOM NOTICE BANNER ================= */}
      <div className="absolute bottom-1.5 right-1 left-1 h-4 flex items-center justify-center pointer-events-none z-10 leading-none">
        {resetNotice && (
          <span className="text-[7.5px] font-bold bg-white text-amber-950 font-urdu px-2 py-0.5 rounded-md border border-amber-200 animate-fadeIn shadow-md">
             {resetNotice}
          </span>
        )}
      </div>

      {/* ================= OVERLAY DIALOG 1: SETTINGS DIALOG ================= */}
      {showSettingsModal && (
        <div 
          onClick={() => setShowSettingsModal(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-[1.5px] z-50 flex items-center justify-center p-3 animate-fadeIn"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-[280px] rounded-2xl p-4 shadow-2xl border border-stone-200 space-y-3.5 relative select-none font-urdu"
            dir="rtl"
          >
            {/* Header Dialog */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-1.5 text-right flex-row-reverse">
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="p-1 hover:bg-stone-100 rounded-full text-stone-400 transition-colors cursor-pointer"
              >
                <X size={13} className="text-stone-600" />
              </button>
              <h3 className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                <Settings size={12} className="text-amber-800" />
                تسبیح کاؤنٹر کی ترتیب
              </h3>
            </div>

            {/* Control Options */}
            <div className="space-y-3.5 pt-1.5">
              {/* Vibrate setting */}
              <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-1.5 flex-row-reverse text-right">
                  <span className="text-[10px] font-bold text-stone-850">ہلکی وائبریشن (کلک پر)</span>
                  <Smartphone size={11} className="text-stone-500" />
                </div>
                <button
                  onClick={() => setVibrateEnabled(!vibrateEnabled)}
                  className={`w-7 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${
                    vibrateEnabled ? 'bg-emerald-600' : 'bg-stone-300'
                  }`}
                >
                  <div className={`w-3 h-3 bg-white rounded-full transition-transform transform ${vibrateEnabled ? '-translate-x-3' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Click Sound setting */}
              <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-1.5 flex-row-reverse text-right">
                  <span className="text-[10px] font-bold text-stone-850">کلک کی باریک آواز (صوتی اثر)</span>
                  <Volume2 size={11} className="text-stone-500" />
                </div>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`w-7 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${
                    soundEnabled ? 'bg-emerald-600' : 'bg-stone-300'
                  }`}
                >
                  <div className={`w-3 h-3 bg-white rounded-full transition-transform transform ${soundEnabled ? '-translate-x-3' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Completion notification setting */}
              <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-1.5 flex-row-reverse text-right">
                  <span className="text-[10px] font-bold text-stone-850">مکمل ہونے پر چام (الارم)</span>
                  <Smile size={11} className="text-stone-500" />
                </div>
                <button
                  onClick={() => setAutoCompleteAlert(!autoCompleteAlert)}
                  className={`w-7 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${
                    autoCompleteAlert ? 'bg-emerald-600' : 'bg-stone-300'
                  }`}
                >
                  <div className={`w-3 h-3 bg-white rounded-full transition-transform transform ${autoCompleteAlert ? '-translate-x-3' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Danger/Reset Total Records Area */}
              <div className="border-t border-stone-100 pt-3 text-center space-y-1">
                <p className="text-[7.5px] text-stone-400 font-urdu leading-snug">
                  اس بٹن سے آج کے اور پچھلے تمام دنوں کی گنتی اور ذکر کا ریکارڈ مستقل مٹ جائے گا۔
                </p>
                <button
                  type="button"
                  onClick={handleResetAllRecords}
                  className="w-full py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 text-[9px] font-black flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 size={11} className="text-rose-650" />
                  تمام تاریخی ریکارڈ صاف کریں
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= OVERLAY DIALOG 2: ADD CUSTOM DHIKR DIALOG ================= */}
      {showAddDhikrModal && (
        <div 
          onClick={() => setShowAddDhikrModal(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-[1.5px] z-50 flex items-center justify-center p-3 animate-fadeIn"
        >
          <form 
            onSubmit={handleAddCustomDhikr}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-[280px] rounded-2xl p-4 shadow-2xl border border-stone-200 space-y-3 relative select-none font-urdu"
            dir="rtl"
          >
            {/* Header dialog */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-1.5 text-right flex-row-reverse">
              <button 
                type="button"
                onClick={() => setShowAddDhikrModal(false)}
                className="p-1 hover:bg-stone-100 rounded-full text-stone-400 transition-colors cursor-pointer"
              >
                <X size={13} className="text-stone-600" />
              </button>
              <h3 className="text-xs font-black text-amber-950 flex items-center gap-1">
                <Plus size={12} className="text-emerald-800 stroke-[3]" />
                نیا کسٹم ذکر ریکارڈ شامل کریں
              </h3>
            </div>

            {/* Inputs list */}
            <div className="space-y-2 pt-1 text-right">
              {/* Arabic */}
              <div>
                <label className="text-[8.5px] font-black text-stone-500 block mb-0.5">عربی تحریر:</label>
                <input 
                  type="text" 
                  value={customAr} 
                  onChange={(e) => setCustomAr(e.target.value)}
                  placeholder="مثال: لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ" 
                  required
                  className="w-full text-xs font-bold font-naskh text-right border border-stone-300 rounded-lg p-1.5 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-300 outline-none text-[#124d33]"
                />
              </div>

              {/* Urdu Name */}
              <div>
                <label className="text-[8.5px] font-black text-stone-500 block mb-0.5">اردو ترجمہ / مختصر پکار:</label>
                <input 
                  type="text" 
                  value={customUr} 
                  onChange={(e) => setCustomUr(e.target.value)}
                  placeholder="مثال: لَاحَوْلَ" 
                  required
                  className="w-full text-xs font-bold font-urdu text-right border border-stone-300 rounded-lg p-1.5 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-300 outline-none"
                />
              </div>

              {/* English */}
              <div>
                <label className="text-[8.5px] font-black text-stone-500 block mb-0.5">English Roman Text (Optional):</label>
                <input 
                  type="text" 
                  value={customEn} 
                  onChange={(e) => setCustomEn(e.target.value)}
                  placeholder="e.g. Lahawla walakuata" 
                  className="w-full text-[10px] font-sans text-right border border-stone-300 rounded-lg p-1.5 focus:border-emerald-600 outline-none"
                />
              </div>

              {/* Urdu Meaning */}
              <div>
                <label className="text-[8.5px] font-black text-stone-500 block mb-0.5">مکمل ترجمہ / فضیلت (Optional):</label>
                <input 
                  type="text" 
                  value={customMeaning} 
                  onChange={(e) => setCustomMeaning(e.target.value)}
                  placeholder="مثال: کوئی طاقت اور قدرت نہیں مگر اللہ کی طرف سے" 
                  className="w-full text-[10px] font-urdu text-right border border-stone-300 rounded-lg p-1.5 focus:border-emerald-600 outline-none"
                />
              </div>

              {/* Target Count */}
              <div>
                <label className="text-[8.5px] font-black text-stone-500 block mb-0.5">تسبیح چکر کی حد (Target Limit):</label>
                <input 
                  type="number" 
                  value={customLimit} 
                  onChange={(e) => setCustomLimit(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="33" 
                  className="w-full text-xs font-mono text-center font-bold border border-stone-300 rounded-lg p-1.5 focus:border-emerald-600 outline-none"
                />
              </div>
            </div>

            {/* Actions button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-2 bg-gradient-to-tr from-[#124d33] to-[#072016] text-amber-100 hover:brightness-105 transition-all text-[9.5px] font-black rounded-lg shadow-md flex items-center justify-center gap-1 cursor-pointer"
              >
                <Check size={11} strokeWidth={3} />
                شامل کر کے منتخب کریں
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
