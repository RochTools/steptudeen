import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Bell, BookOpen, CalendarDays, ChevronDown, CircleDot, Compass, Heart, MapPin, MapPinned, Menu, MoreVertical, Scroll, Search, SlidersHorizontal, Sunrise, User, X } from 'lucide-react';
import { Mosque } from '../types';
import CelestialHeaderScene from './CelestialHeaderScene';
import { InboxItem, readInbox, markInboxRead } from '../utils/notifications';

interface HomeViewProps {
  onNavigate: (view: string) => void;
  prayerTimes: { [key: string]: string };
  currentPrayer: string;
  todayDate: string;
  nearbyMosques: Mosque[];
  savedMosqueIds?: string[];
  onOpenMosque: (mosque: Mosque) => void;
  userCoords: { latitude: number; longitude: number } | null;
  requestLocation: () => void;
  isAuthenticated: boolean;
  isUserAuthenticated: boolean;
  userAuthName: string;
  authName: string;
  isLoading?: boolean;
}

const SURAH_NAMES_UR = [
  'الفاتحہ','البقرہ','آل عمران','النساء','المائدہ','الانعام','الاعراف','الانفال',
  'التوبہ','یونس','ہود','یوسف','الرعد','ابراہیم','الحجر','النحل','الاسراء',
  'الکہف','مریم','طہ','الانبیاء','الحج','المومنون','النور','الفرقان','الشعراء',
  'النمل','القصص','العنکبوت','الروم','لقمان','السجدہ','الاحزاب','سبا','فاطر',
  'یسین','الصافات','ص','الزمر','غافر','فصلت','الشوریٰ','الزخرف','الدخان',
  'الجاثیہ','الاحقاف','محمد','الفتح','الحجرات','ق','الذاریات','الطور','النجم',
  'القمر','الرحمٰن','الواقعہ','الحدید','المجادلہ','الحشر','الممتحنہ','الصف',
  'الجمعہ','المنافقون','التغابن','الطلاق','التحریم','الملک','القلم','الحاقہ',
  'المعارج','نوح','الجن','المزمل','المدثر','القیامہ','الانسان','المرسلات',
  'النبا','النازعات','عبس','التکویر','الانفطار','المطففین','الانشقاق','البروج',
  'الطارق','الاعلیٰ','الغاشیہ','الفجر','البلد','الشمس','اللیل','الضحیٰ',
  'الشرح','التین','العلق','القدر','البینہ','الزلزلہ','العادیات','القارعہ',
  'التکاثر','العصر','الہمزہ','الفیل','قریش','الماعون','الکوثر','الکافرون',
  'النصر','المسد','الاخلاص','الفلق','الناس'
];

const QURAN_CDN = 'https://cdn.jsdelivr.net/gh/RochTools/quran-api@main/Quran/';
const QURAN_FALLBACK = 'https://raw.githubusercontent.com/RochTools/quran-api/main/Quran/';
const QURAN_SEARCH_TARGET_KEY = 'steptudeen_app_quran_search_target';
const HADITH_HOME_TARGET_KEY = 'steptudeen_app_hadith_book_target';

const formatTo12Hour = (time24: string) => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  const strHrs = h < 10 ? '0' + h : h;
  const strMins = m < 10 ? '0' + m : m;
  return `${strHrs}:${strMins} ${ampm}`;
};

const SECTIONS = [
  { icon: '', title: 'Quran', subtitle: '114 Surahs', type: 'Section', nav: 'quran' },
  { icon: '', title: 'Hadith', subtitle: 'Authentic Hadith collections', type: 'Section', nav: 'hadith' },
  { icon: '', title: 'Prayer Guide', subtitle: 'Learn how to pray', type: 'Section', nav: 'namaz' },
  { icon: '', title: 'Duas', subtitle: 'Daily supplications', type: 'Section', nav: 'duas' },
  { icon: '', title: 'Tasbih Counter', subtitle: 'Daily dhikr', type: 'Section', nav: 'tasbih' },
  { icon: '', title: 'Qibla Direction', subtitle: 'Find the Qibla', type: 'Section', nav: 'qibla' },
  { icon: '', title: 'Nearby Mosques', subtitle: 'Jumu’ah timings', type: 'Section', nav: 'mosques' },
];

const SURAH_MAP: { [key: string]: number } = {
  'فاتحہ': 1, 'بقرہ': 2, 'آل عمران': 3, 'نساء': 4, 'مائدہ': 5,
  'انعام': 6, 'اعراف': 7, 'انفال': 8, 'توبہ': 9, 'یونس': 10,
  'ہود': 11, 'یوسف': 12, 'رعد': 13, 'ابراہیم': 14, 'حجر': 15,
  'نحل': 16, 'اسراء': 17, 'کہف': 18, 'مریم': 19, 'طہ': 20,
  'انبیاء': 21, 'حج': 22, 'مومنون': 23, 'نور': 24, 'فرقان': 25,
  'شعراء': 26, 'نمل': 27, 'قصص': 28, 'عنکبوت': 29, 'روم': 30,
  'لقمان': 31, 'سجدہ': 32, 'احزاب': 33, 'سبا': 34, 'فاطر': 35,
  'یاسین': 36, 'یٰسین': 36, 'صافات': 37, 'ص': 38, 'زمر': 39,
  'غافر': 40, 'فصلت': 41, 'شوریٰ': 42, 'زخرف': 43, 'دخان': 44,
  'جاثیہ': 45, 'احقاف': 46, 'محمد': 47, 'فتح': 48, 'حجرات': 49,
  'ق': 50, 'ذاریات': 51, 'طور': 52, 'نجم': 53, 'قمر': 54,
  'رحمن': 55, 'واقعہ': 56, 'حدید': 57, 'مجادلہ': 58,
  'حشر': 59, 'ممتحنہ': 60, 'صف': 61, 'جمعہ': 62, 'منافقون': 63,
  'تغابن': 64, 'طلاق': 65, 'تحریم': 66, 'ملک': 67, 'قلم': 68,
  'حاقہ': 69, 'معارج': 70, 'نوح': 71, 'جن': 72, 'مزمل': 73,
  'مدثر': 74, 'قیامہ': 75, 'انسان': 76, 'مرسلات': 77, 'نبا': 78,
  'نازعات': 79, 'عبس': 80, 'تکویر': 81, 'انفطار': 82, 'مطففین': 83,
  'انشقاق': 84, 'بروج': 85, 'طارق': 86, 'اعلیٰ': 87, 'غاشیہ': 88,
  'فجر': 89, 'بلد': 90, 'شمس': 91, 'لیل': 92, 'ضحیٰ': 93,
  'شرح': 94, 'انشراح': 94, 'تین': 95, 'علق': 96, 'قدر': 97,
  'بینہ': 98, 'زلزلہ': 99, 'عادیات': 100, 'قارعہ': 101, 'تکاثر': 102,
  'عصر': 103, 'ہمزہ': 104, 'فیل': 105, 'قریش': 106, 'ماعون': 107,
  'کوثر': 108, 'کافرون': 109, 'نصر': 110, 'مسد': 111, 'لہب': 111,
  'اخلاص': 112, 'فلق': 113, 'ناس': 114,
  'fatiha': 1, 'baqarah': 2, 'al-baqarah': 2, 'imran': 3, 'nisa': 4,
  'maidah': 5, 'anam': 6, 'araf': 7, 'anfal': 8, 'tawbah': 9,
  'yunus': 10, 'hud': 11, 'yusuf': 12, 'rad': 13, 'ibrahim': 14,
  'hijr': 15, 'nahl': 16, 'isra': 17, 'kahf': 18, 'maryam': 19,
  'taha': 20, 'anbiya': 21, 'hajj': 22, 'muminun': 23, 'nur': 24,
  'furqan': 25, 'shuara': 26, 'naml': 27, 'qasas': 28, 'ankabut': 29,
  'rum': 30, 'luqman': 31, 'sajdah': 32, 'ahzab': 33, 'saba': 34,
  'fatir': 35, 'yaseen': 36, 'yasin': 36, 'saffat': 37, 'zumar': 39,
  'ghafir': 40, 'fussilat': 41, 'shura': 42, 'zukhruf': 43, 'dukhan': 44,
  'jathiyah': 45, 'ahqaf': 46, 'muhammad': 47, 'fath': 48, 'hujurat': 49,
  'dhariyat': 51, 'tur': 52, 'najm': 53, 'qamar': 54,
  'rahman': 55, 'waqiah': 56, 'hadid': 57, 'mujadila': 58,
  'hashr': 59, 'mumtahina': 60, 'saff': 61, 'jumuah': 62, 'munafiqun': 63,
  'taghabun': 64, 'talaq': 65, 'tahrim': 66, 'mulk': 67, 'qalam': 68,
  'haqqah': 69, 'maarij': 70, 'nuh': 71, 'jinn': 72, 'muzzammil': 73,
  'muddaththir': 74, 'qiyamah': 75, 'insan': 76, 'mursalat': 77,
  'naba': 78, 'naziat': 79, 'abasa': 80, 'takwir': 81, 'infitar': 82,
  'mutaffifin': 83, 'inshiqaq': 84, 'buruj': 85, 'tariq': 86,
  'ala': 87, 'ghashiyah': 88, 'fajr': 89, 'balad': 90, 'shams': 91,
  'layl': 92, 'duha': 93, 'sharh': 94, 'tin': 95, 'alaq': 96,
  'qadr': 97, 'bayyinah': 98, 'zalzalah': 99, 'adiyat': 100,
  'qariah': 101, 'takathur': 102, 'asr': 103, 'humazah': 104,
  'fil': 105, 'quraysh': 106, 'maun': 107, 'kawthar': 108,
  'kafirun': 109, 'nasr': 110, 'masad': 111, 'ikhlas': 112,
  'falaq': 113, 'nas': 114,
  'الفاتحة': 1, 'البقرة': 2, 'النساء': 4, 'المائدة': 5, 'يس': 36,
  'الواقعة': 56, 'الملك': 67, 'الإخلاص': 112,
};

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  prayerTimes,
  currentPrayer,
  todayDate,
  nearbyMosques,
  savedMosqueIds = [],
  onOpenMosque,
  userCoords,
  requestLocation,
  isAuthenticated,
  isUserAuthenticated,
  userAuthName,
  authName,
  isLoading = false,
}) => {
  const [dailyAyah, setDailyAyah] = useState<{ ar: string; ur: string; ref: string } | null>(null);
  const [dailyHadith, setDailyHadith] = useState<{ ar: string; ur: string; ref: string } | null>(null);
  const [loadingAyah, setLoadingAyah] = useState(true);
  const [loadingHadith, setLoadingHadith] = useState(true);
  const [isDeviceOffline, setIsDeviceOffline] = useState<boolean>(!navigator.onLine);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [locationName, setLocationName] = useState('Current location');

  // ═══════════════════ Bell / Inbox ═══════════════════
  // Announcements (محفوظ مساجد سے) + نماز کی یاد دہانیوں کی تاریخ — ایک ہی فہرست میں
  const [bellOpen, setBellOpen] = useState(false);
  const [prayerInbox, setPrayerInbox] = useState<InboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const savedMosquesWithAnnouncement = nearbyMosques.filter(
    (m) => savedMosqueIds.includes(m.id) && m.announcement && m.announcement.trim() !== ''
  );

  // ہر بار ہوم صفحہ کھلنے پر تازہ ترین گنتی لے لیں (نئی نماز notification کے بعد بھی)
  useEffect(() => {
    const refresh = () => {
      setPrayerInbox(readInbox());
      const unreadPrayers = readInbox().filter((i) => !i.read).length;
      setUnreadCount(unreadPrayers + savedMosquesWithAnnouncement.length);
    };
    refresh();
    // ہر منٹ ریفریش — تاکہ ابھی ابھی آئی نماز کی نوٹیفکیشن بھی نظر آئے
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedMosquesWithAnnouncement.length]);

  const openBell = () => {
    setBellOpen((v) => !v);
    if (!bellOpen) {
      markInboxRead();
      setUnreadCount(0);
      setPrayerInbox(readInbox());
    }
  };

  const timeAgo = (ts: number): string => {
    const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60000));
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} hr ago`;
    return `${Math.floor(diffH / 24)} day${Math.floor(diffH / 24) > 1 ? 's' : ''} ago`;
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ icon: string; title: string; subtitle?: string; type: string; action: () => void }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const parseSurahAyah = (query: string): { surah: number; ayah?: number } | null => {
    const normalizedDigits = query
      .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    const text = normalizedDigits.toLowerCase().trim();
    if (!text) return null;

    // Direct forms: 2:255 or 2 255
    const directAyah = text.match(/^(\d+)[:\s]+(\d+)$/);
    if (directAyah) {
      const surah = Number(directAyah[1]);
      const ayah = Number(directAyah[2]);
      return surah >= 1 && surah <= 114 && ayah >= 1 ? { surah, ayah } : null;
    }

    // A single number from 1-114 means a Surah number.
    if (/^\d+$/.test(text)) {
      const surah = Number(text);
      return surah >= 1 && surah <= 114 ? { surah } : null;
    }

    const ayahMatch = text.match(/(?:آیت|ايت|ayat|ayah|verse|:)\s*(?:نمبر|number|no\.?)?\s*(\d+)/i);
    const ayah = ayahMatch ? Number(ayahMatch[1]) : undefined;
    let surah = 0;

    // Prefer the longest matching alias so short keys do not win first.
    const aliases = Object.entries(SURAH_MAP).sort((a, b) => b[0].length - a[0].length);
    for (const [alias, number] of aliases) {
      if (text.includes(alias.toLowerCase())) {
        surah = number;
        break;
      }
    }

    if (!surah) return null;
    return ayah && ayah > 0 ? { surah, ayah } : { surah };
  };

  const saveQuranSearchTarget = (target: { surah: number; ayah?: number }) => {
    try {
      localStorage.setItem(QURAN_SEARCH_TARGET_KEY, JSON.stringify(target));
    } catch (error) {
      console.warn('Could not save Quran search target:', error);
    }
    // Navigation must still happen even if storage is unavailable.
    onNavigate('quran');
  };

  const fetchQuranSurah = async (surah: number) => {
    const savedLanguage = localStorage.getItem('steptudeen_app_quran_language') || 'ur';
    const request = async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    };
    try {
      return await request(`${QURAN_CDN}${savedLanguage}/${surah}.json`);
    } catch {
      return request(`${QURAN_FALLBACK}${savedLanguage}/${surah}.json`);
    }
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    const localResults = SECTIONS
      .filter(section => section.title.includes(query) || (section.subtitle || '').includes(query))
      .map(section => ({ icon: section.icon, title: section.title, subtitle: section.subtitle, type: section.type, action: () => onNavigate(section.nav) }));
    const mosqueResults = nearbyMosques
      .filter(mosque => mosque.name.includes(query))
      .slice(0, 2)
      .map(mosque => ({ icon: '', title: mosque.name, subtitle: `Jumu’ah: ${mosque.jumah}`, type: 'Mosque', action: () => onOpenMosque(mosque) }));

    setSearchResults([...localResults, ...mosqueResults]);
    const parsed = parseSurahAyah(query);
    if (!parsed) return;

    // Surah-only search does not need a network request.
    if (!parsed.ayah) {
      const surahResult = {
        icon: '',
        title: `Surah ${parsed.surah}`,
        subtitle: `Surah ${parsed.surah} — open complete Surah`,
        type: 'Surah',
        action: () => saveQuranSearchTarget(parsed),
      };
      setSearchResults(previous => [surahResult, ...previous]);
      return;
    }

    setIsSearching(true);
    try {
      const data = await fetchQuranSurah(parsed.surah);
      const verses = Array.isArray(data?.verses) ? data.verses : [];
      const verse = verses.find((item: any) => Number(item.id) === parsed.ayah) || verses[parsed.ayah - 1];
      if (!verse) throw new Error('Ayah not found');

      const ayahResult = {
        icon: '',
        title: String(verse.text || '').slice(0, 70) + (String(verse.text || '').length > 70 ? '...' : ''),
        subtitle: String(verse.translation || '').slice(0, 90) + (String(verse.translation || '').length > 90 ? '...' : ''),
        type: 'Ayah',
        action: () => saveQuranSearchTarget(parsed),
      };
      setSearchResults(previous => [ayahResult, ...previous]);
    } catch {
      setSearchResults(previous => [{
        icon: '',
        title: 'The Ayah could not be loaded',
        subtitle: 'Check your internet connection and try again',
        type: 'Error',
        action: () => undefined,
      }, ...previous]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const local = SECTIONS
      .filter(s => s.title.includes(searchQuery) || (s.subtitle || '').includes(searchQuery))
      .map(s => ({ icon: s.icon, title: s.title, subtitle: s.subtitle, type: s.type, action: () => onNavigate(s.nav) }));
    const mosques = nearbyMosques
      .filter(m => m.name.includes(searchQuery))
      .slice(0, 2)
      .map(m => ({ icon: '', title: m.name, subtitle: `Jumu’ah: ${m.jumah}`, type: 'Mosque', action: () => onOpenMosque(m) }));
    setSearchResults([...local, ...mosques]);
  }, [searchQuery, nearbyMosques, onNavigate, onOpenMosque]);

  useEffect(() => {
    const handleOnline = () => setIsDeviceOffline(false);
    const handleOffline = () => setIsDeviceOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    if (!userCoords) {
      setLocationName('Current location');
      return;
    }
    const cacheKey = `location_name_${userCoords.latitude.toFixed(2)}_${userCoords.longitude.toFixed(2)}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setLocationName(cached);
      return;
    }
    const controller = new AbortController();
    fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${userCoords.latitude}&longitude=${userCoords.longitude}&localityLanguage=en`, { signal: controller.signal })
      .then(response => response.json())
      .then(data => {
        const name = data.city || data.locality || data.principalSubdivision || 'Current location';
        setLocationName(name);
        localStorage.setItem(cacheKey, name);
      })
      .catch(() => setLocationName('Current location'));
    return () => controller.abort();
  }, [userCoords]);

  const getNextPrayerDetails = () => {
    const now = new Date();
    const currentInMins = now.getHours() * 60 + now.getMinutes();
    const parseToMins = (timeStr: string) => { if (!timeStr) return 0; const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; };
    const prayers = [
      { name: 'fajr',    label: 'Fajr',    urdu: 'فجر',  mins: parseToMins(prayerTimes.fajr) },
      { name: 'zuhr',    label: 'Dhuhr',   urdu: 'ظہر',  mins: parseToMins(prayerTimes.zuhr) },
      { name: 'asr',     label: 'Asr',     urdu: 'عصر',  mins: parseToMins(prayerTimes.asr) },
      { name: 'maghrib', label: 'Maghrib', urdu: 'مغرب', mins: parseToMins(prayerTimes.maghrib) },
      { name: 'isha',    label: 'Isha',    urdu: 'عشاء', mins: parseToMins(prayerTimes.isha) },
    ];
    prayers.sort((a, b) => a.mins - b.mins);

    // کیا ابھی کوئی نماز کا وقت چل رہا ہے؟ (اذان ہوئی لیکن 30 منٹ نہیں گزرے)
    const current = prayers.find(p => currentInMins >= p.mins && currentInMins < p.mins + 30);
    if (current) {
      const minsLeft = (current.mins + 30) - currentInMins;
      return {
        label: current.label,
        urdu: current.urdu,
        time: formatTo12Hour(prayerTimes[current.name] || '--:--'),
        countdown: `${minsLeft} min remaining`,
        shortCountdown: `${current.label} time`,
        isCurrent: true,
      };
    }

    // اگلی نماز
    let next = prayers.find(p => p.mins > currentInMins);
    let isNextDay = false;
    if (!next) { next = prayers[0]; isNextDay = true; }
    const nextPrayer = next || prayers[0]!;
    const diff = isNextDay ? (1440 - currentInMins) + nextPrayer.mins : nextPrayer.mins - currentInMins;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return {
      label: nextPrayer.label,
      urdu: nextPrayer.urdu,
      time: formatTo12Hour(prayerTimes[nextPrayer.name] || '--:--'),
      countdown: hrs > 0 ? `${hrs}h ${mins}m remaining` : `${mins} minutes remaining`,
      shortCountdown: hrs > 0 ? `${nextPrayer.label} in ${hrs}h ${mins}m` : `${nextPrayer.label} in ${mins}m`,
      isCurrent: false,
    };
  };

  useEffect(() => {
    const d = new Date();
    const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
    const FAMOUS_AYAHS = [
      { s: 2, a: 255 }, { s: 2, a: 286 }, { s: 3, a: 185 }, { s: 2, a: 152 },
      { s: 13, a: 28 }, { s: 2, a: 153 }, { s: 65, a: 3 }, { s: 94, a: 5 },
      { s: 2, a: 201 }, { s: 3, a: 8 }, { s: 39, a: 53 }, { s: 55, a: 13 }, { s: 50, a: 16 }
    ];
    const idx = dayOfYear % FAMOUS_AYAHS.length;
    const chosen = FAMOUS_AYAHS[idx];
    fetch(`https://api.alquran.cloud/v1/ayah/${chosen.s}:${chosen.a}/editions/quran-uthmani,ur.jalandhry`)
      .then(r => r.json())
      .then(json => {
        if (json.code === 200 && json.data?.length >= 2) {
          setDailyAyah({ ar: json.data[0].text, ur: json.data[1].text, ref: `Surah ${chosen.s} · Ayah ${chosen.a}` });
        } else {
          setDailyAyah({ ar: "وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ ۚ عَلَيْهِ تَوَكَّلْتُ وَإِلَيْهِ أُنِيبُ", ur: "اور میری توفیق صرف اللہ کی طرف سے ہے، اسی پر میں نے بھروسہ کیا اور اسی کی طرف رجوع کرتا ہوں۔", ref: "Surah Hud · Ayah 88" });
        }
        setLoadingAyah(false);
      })
      .catch(() => {
        setDailyAyah({ ar: "وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ ۚ عَلَيْهِ تَوَكَّلْتُ وَإِلَيْهِ أُنِيبُ", ur: "اور میری توفیق صرف اللہ کی طرف سے ہے، اسی پر میں نے بھروسہ کیا اور اسی کی طرف رجوع کرتا ہوں۔", ref: "Surah Hud · Ayah 88" });
        setLoadingAyah(false);
      });

    const DAILY_HADITHS = [
      { ar: "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ", ur: "اعمال کا دارومدار نیتوں پر ہے۔", ref: "Sahih Bukhari · Hadith 1" },
      { ar: "الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ", ur: "مسلمان وہ ہے جس کی زبان اور ہاتھ سے دوسرے مسلمان محفوظ رہیں۔", ref: "Sahih Bukhari · Hadith 10" },
      { ar: "لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ", ur: "تم میں سے کوئی اس وقت تک مومن نہیں ہو سکتا جب تک اپنے بھائی کے لیے وہ نہ چاہے جو اپنے لیے چاہتا ہے۔", ref: "Sahih Bukhari · Hadith 13" },
      { ar: "مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ", ur: "جو اللہ اور آخرت کے دن پر ایمان رکھتا ہو وہ اچھی بات کہے یا خاموش رہے۔", ref: "Sahih Bukhari · Hadith 6018" },
      { ar: "الدِّينُ النَّصِيحَةُ", ur: "دین خیرخواہی کا نام ہے۔", ref: "Sahih Muslim · Hadith 55" },
      { ar: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ", ur: "تم میں سے بہترین وہ ہے جو قرآن سیکھے اور سکھائے۔", ref: "Sahih Bukhari · Hadith 5027" },
      { ar: "اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ وَأَتْبِعِ السَّيِّئَةَ الْحَسَنَةَ تَمْحُهَا", ur: "جہاں بھی ہو اللہ سے ڈرو، اور برائی کے بعد نیکی کرو وہ اسے مٹا دے گی۔", ref: "Sunan Tirmidhi · Hadith 1987" },
      { ar: "الطَّهُورُ شَطْرُ الْإِيمَانِ", ur: "پاکیزگی نصف ایمان ہے۔", ref: "Sahih Muslim · Hadith 223" },
      { ar: "أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ", ur: "اللہ کو سب سے محبوب عمل وہ ہے جو ہمیشہ کیا جائے، چاہے تھوڑا ہی ہو۔", ref: "Sahih Bukhari · Hadith 6465" },
      { ar: "مَنْ صَامَ رَمَضَانَ إِيمَانًا وَاحْتِسَابًا غُفِرَ لَهُ مَا تَقَدَّمَ مِنْ ذَنْبِهِ", ur: "جس نے ایمان اور ثواب کی نیت سے رمضان کے روزے رکھے اس کے پچھلے گناہ معاف کر دیے گئے۔", ref: "Sahih Bukhari · Hadith 38" },
      { ar: "بُنِيَ الْإِسْلَامُ عَلَى خَمْسٍ", ur: "اسلام پانچ چیزوں پر قائم ہے: توحید، نماز، زکوٰۃ، حج اور روزہ۔", ref: "Sahih Bukhari · Hadith 8" },
      { ar: "خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ", ur: "لوگوں میں سب سے بہتر وہ ہے جو لوگوں کے لیے سب سے زیادہ نفع بخش ہو۔", ref: "Al-Mu'jam al-Awsat · Hadith 5787" },
      { ar: "إِنَّ اللَّهَ رَفِيقٌ يُحِبُّ الرِّفْقَ", ur: "بے شک اللہ نرم مزاج ہے اور نرمی کو پسند کرتا ہے۔", ref: "Sahih Bukhari · Hadith 6927" },
      { ar: "مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ طَرِيقًا إِلَى الْجَنَّةِ", ur: "جو علم کی تلاش میں کوئی راستہ اختیار کرے اللہ اس کے لیے جنت کا راستہ آسان کر دیتا ہے۔", ref: "Sahih Muslim · Hadith 2699" },
      { ar: "اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا", ur: "اے اللہ! کوئی چیز آسان نہیں مگر جسے تو آسان بنا دے۔", ref: "Ibn Hibban · Hadith 974" },
      { ar: "أَفْضَلُ الصَّلَاةِ بَعْدَ الْفَرِيضَةِ صَلَاةُ اللَّيْلِ", ur: "فرض نماز کے بعد سب سے افضل نماز رات کی نماز (تہجد) ہے۔", ref: "Sahih Muslim · Hadith 1163" },
      { ar: "الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ", ur: "طاقتور مومن کمزور مومن سے بہتر اور اللہ کو زیادہ محبوب ہے۔", ref: "Sahih Muslim · Hadith 2664" },
      { ar: "كُلُّ مَعْرُوفٍ صَدَقَةٌ", ur: "ہر نیکی صدقہ ہے۔", ref: "Sahih Bukhari · Hadith 6021" },
      { ar: "إِنَّ مِنْ أَكْمَلِ الْمُؤْمِنِينَ إِيمَانًا أَحْسَنُهُمْ خُلُقًا", ur: "ایمان میں سب سے کامل مومن وہ ہے جس کے اخلاق سب سے اچھے ہوں۔", ref: "Sunan Tirmidhi · Hadith 1162" },
      { ar: "مَنْ لَا يَشْكُرُ النَّاسَ لَا يَشْكُرُ اللَّهَ", ur: "جو لوگوں کا شکریہ ادا نہیں کرتا وہ اللہ کا بھی شکر ادا نہیں کرتا۔", ref: "Sunan Tirmidhi · Hadith 1954" },
    ];
    const hadithIdx = dayOfYear % DAILY_HADITHS.length;
    setDailyHadith(DAILY_HADITHS[hadithIdx]);
    setLoadingHadith(false);
  }, []);

  const openHadithBook = (bookKey: string) => {
    try {
      localStorage.setItem(HADITH_HOME_TARGET_KEY, bookKey);
    } catch (error) {
      console.warn('Could not save Hadith book target:', error);
    }
    onNavigate('hadith');
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
  };

  const nextPrayerDetails = getNextPrayerDetails();
  const gregorianDate = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  // ✅ اب Imam بھی login نہیں اور یوزر بھی login نہیں → پھر بھی یوزر ڈش بورڈ کھلے گا (Guest mode)
  const accountLabel = isAuthenticated ? (authName || 'Imam account') : isUserAuthenticated ? (userAuthName || 'My account') : 'My Dashboard';
  const accountTarget = isAuthenticated ? 'imam-login' : 'user-dashboard';

  return (
    <div className="pb-16 animate-fadeIn bg-slate-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@500;700&display=swap');
        .home-card-urdu-title {
          font-family: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif;
          font-weight: 700;
          line-height: 1.9;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
        }
      `}</style>

      {/* ═══════════ PROFESSIONAL BLUE PRAYER HEADER ═══════════ */}
      <div className="relative min-h-[320px] overflow-hidden rounded-b-[26px] bg-[#063b9d] text-white shadow-[0_10px_30px_rgba(5,69,166,.28)]">
        <CelestialHeaderScene prayerTimes={prayerTimes} />

<img
  src="/mosque-header.webp"
  alt=""
  aria-hidden="true"
  className="pointer-events-none absolute z-[12] select-none opacity-90"
  style={{ 
    right: '21px',
    top: '-10px',
    width: '94%',
    maxHeight: 'calc(100% - 90px)',
    objectFit: 'contain',
    objectPosition: 'top right'
  }}
  decoding="async"
  fetchPriority="high"
/>
        { /* Top actions */ }
<div className="relative z-20 flex items-center justify-between px-4 pt-3">

  <div className="relative flex items-center gap-2">
    {/* Mosque map — full-screen live finder (Overpass + routing) */}
    <button
      type="button"
      onClick={() => onNavigate('mosque-map')}
      className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm transition-transform active:scale-95"
      aria-label="Mosque map"
      title="Find mosques on the map"
    >
      <MapPinned size={20} />
    </button>

    <button type="button" onClick={openBell} className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm" aria-label="Notifications" title="Inbox">
      <Bell size={21} />
      {unreadCount > 0 && (
        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold leading-none text-slate-900">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>

    {bellOpen && createPortal(
      <>
        {/* transparent full-screen backdrop so tapping outside closes it */}
        <div className="fixed inset-0 z-[9998]" onClick={() => setBellOpen(false)} />
        <div className="fixed left-4 right-4 top-16 z-[9999] mx-auto max-w-sm overflow-hidden rounded-2xl border border-white/20 bg-white text-slate-800 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-[15px] font-bold text-slate-900">Inbox</h3>
            <button type="button" onClick={() => setBellOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {savedMosquesWithAnnouncement.length === 0 && prayerInbox.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No new notifications yet
              </div>
            )}

            {savedMosquesWithAnnouncement.length > 0 && (
              <div className="border-b border-slate-100 px-4 py-2">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">Mosque Announcements</div>
                {savedMosquesWithAnnouncement.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { onOpenMosque(m); setBellOpen(false); }}
                    className="mb-2 flex w-full items-start gap-2.5 rounded-xl bg-emerald-50 p-3 text-left last:mb-0"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><MapPinned size={14} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-slate-800">{m.name}</span>
                      <span className="mt-0.5 block text-[12.5px] leading-relaxed text-slate-600">{m.announcement}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {prayerInbox.length > 0 && (
              <div className="px-4 py-2">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Prayer Reminders</div>
                {prayerInbox.map((item) => (
                  <div key={item.id} className="mb-2 flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 last:mb-0">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600"><Bell size={13} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold text-slate-800">{item.title}</span>
                      <span className="mt-0.5 block text-[12.5px] leading-relaxed text-slate-600">{item.body}</span>
                      <span className="mt-1 block text-[10.5px] text-slate-400">{timeAgo(item.timestamp)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </>,
      document.body
    )}
  </div>
        

          <div className="relative flex items-center gap-2">
            <button type="button" onClick={() => setHeaderMenuOpen(value => !value)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm" aria-label="Account options">
              <Menu size={22} />
            </button>

            {headerMenuOpen && (
              <div className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-xl border border-white/20 bg-white text-slate-800 shadow-2xl">
                <button type="button" onClick={() => { setHeaderMenuOpen(false); onNavigate(accountTarget); }} className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-3 text-left text-xs font-semibold hover:bg-blue-50">
                  <User size={15} className="text-blue-700" /> {accountLabel}
                </button>
                <button type="button" onClick={() => { setHeaderMenuOpen(false); onNavigate('menu'); }} className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-semibold hover:bg-blue-50">
                  <SlidersHorizontal size={15} className="text-blue-700" /> App menu
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Date and next prayer summary */}
        <div className="relative z-10 mt-10 w-[58%] px-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-amber-200 backdrop-blur-sm"><CalendarDays size={22} /></span>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-urdu font-bold text-amber-100" dir="auto">{todayDate || 'Hijri date'}</div>
              <div className="mt-1 text-[12px] font-semibold text-white/90">{gregorianDate}</div>
            </div>
          </div>


        </div>

        {/* Main prayer glass card */}
        <div className={`relative z-20 mx-4 mt-14 rounded-[20px] border p-3 shadow-[0_12px_35px_rgba(0,34,110,.28)] backdrop-blur-md ${nextPrayerDetails.isCurrent ? 'border-amber-300/50 bg-amber-500/20' : 'border-white/35 bg-white/12'}`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-lg ${nextPrayerDetails.isCurrent ? 'bg-amber-300 text-amber-900' : 'bg-white text-[#0755bd]'}`}>
              <Sunrise size={27} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className={`text-[11px] font-semibold uppercase tracking-wide ${nextPrayerDetails.isCurrent ? 'text-amber-200' : 'text-white/75'}`}>
                {nextPrayerDetails.isCurrent ? '🕌 Current Prayer' : 'Next Prayer'}
              </div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="font-urdu text-[22px] font-bold text-white" dir="rtl">{nextPrayerDetails.urdu}</span>
                <span className="text-[10px] font-semibold text-amber-100">{nextPrayerDetails.label}</span>
              </div>
              <div className={`mt-1 text-[10px] ${nextPrayerDetails.isCurrent ? 'text-amber-200' : 'text-white/75'}`}>
                {nextPrayerDetails.countdown}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[27px] font-mono font-bold leading-none tracking-tight text-white">{nextPrayerDetails.time.replace(/\s?(AM|PM)$/i, '')}</div>
              <div className="mt-1 text-[11px] font-bold text-amber-100">{nextPrayerDetails.time.match(/AM|PM/i)?.[0] || ''}</div>
              <button type="button" onClick={() => onNavigate('settings')} className="mt-2 flex max-w-[120px] items-center gap-1 rounded-full bg-[#063a93]/70 px-2.5 py-1.5 text-[9px] font-semibold text-white">
                <MapPin size={11} className="shrink-0" /><span className="truncate">{locationName}</span><ChevronDown size={10} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative z-30 mx-4 my-4">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-[0_5px_18px_rgba(15,53,111,.10)]">
          <Search size={19} className="shrink-0 text-blue-700" />
          <input
            type="text"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && handleSearch()}
            placeholder="Search Surah or Ayah, e.g. Yaseen Ayah 7..."
            className="min-w-0 flex-1 bg-transparent text-left text-[12px] text-slate-700 outline-none placeholder:text-slate-400"
            dir="ltr"
          />
          {searchQuery && (
            <button type="button" onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X size={14} /></button>
          )}

        </div>

        {searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            {searchResults.map((result, index) => (
              <button key={index} type="button" onClick={() => { result.action(); setSearchQuery(''); setSearchResults([]); }} className="flex w-full items-center gap-3 border-b border-slate-100 bg-white px-4 py-3 text-left transition-colors last:border-0 hover:bg-blue-50 active:bg-blue-100">
                <span className="flex-1 text-left"><span className="block text-[12px] font-bold text-slate-800" dir="auto">{result.title}</span>{result.subtitle && <span className="block text-[10px] text-slate-400" dir="auto">{result.subtitle}</span>}</span>
                <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{result.type}</span>
              </button>
            ))}
          </div>
        )}

        {isSearching && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600" />
            <span className="text-[12px] text-slate-500">Searching...</span>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="relative space-y-4 bg-slate-50 pt-1">

          {isDeviceOffline && (
            <div className="mx-4 p-2.5 bg-amber-50/70 shadow-[0_2px_10px_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.03)] flex items-center gap-2.5 text-amber-900 animate-fadeIn">
              <AlertTriangle size={15} className="shrink-0 text-amber-600" />
              <div className="text-[11px] leading-relaxed text-left flex-1">
                Offline mode: Your internet connection is unavailable. Some content may not load.
              </div>
            </div>
          )}

          {/* مسجد کارڈ */}
          <div className="mx-4 bg-white rounded-lg shadow-[0_2px_10px_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.03)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold text-slate-800 flex items-center gap-1 uppercase tracking-tight">
                <Compass size={13} className="text-emerald-600 shrink-0" />
                Nearby Mosques &amp; Jumu’ah
              </h3>
              <div className="flex items-center gap-2">
  <span className="text-[10px] text-emerald-700 font-bold cursor-pointer hover:underline" onClick={() => onNavigate('mosques')}>View all →</span>
  <span className="text-[10px] text-blue-700 font-bold cursor-pointer hover:underline flex items-center gap-0.5" onClick={() => onNavigate('mosque-map')}><MapPinned size={11} /> On Map</span>
</div>
            </div>
            {!userCoords ? (
              <div className="p-4 bg-slate-50 rounded-lg text-center space-y-2.5 shadow-[0_1px_6px_rgba(0,0,0,0.05)]">
                <p className="text-[11px] text-slate-600 leading-relaxed">Enable location to see nearby mosques and their congregation times.</p>
                <button onClick={() => onNavigate('settings')} className="py-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 mx-auto transition-colors">
                  <MapPin size={11} />
                  Enable Location
                </button>
              </div>
            ) : (
              <div className="space-y-2">
{nearbyMosques.length === 0 ? (
  isLoading ? (
    <div className="flex items-center justify-center py-4">
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div>
    </div>
  ) : (
    <p className="text-xs text-center text-gray-500 py-2">
      No registered mosque was found nearby.
    </p>
  )
) : (
                
                  (() => {
                    const mosquesWithDistance = nearbyMosques.map(mosque => ({ mosque, distance: calculateDistance(userCoords.latitude, userCoords.longitude, mosque.latitude, mosque.longitude) }));
                    return mosquesWithDistance.sort((a, b) => a.distance - b.distance).slice(0, 3).map(({ mosque, distance }) => (
                      <div key={mosque.id} onClick={() => onOpenMosque(mosque)} className="p-3 bg-slate-50/50 hover:bg-emerald-50/35 transition-all cursor-pointer shadow-[0_1px_5px_rgba(0,0,0,0.05)] flex items-center justify-between group">
                        <div className="text-center bg-emerald-600 text-white py-1 px-2.5 rounded-lg text-[9px] font-bold border border-emerald-700 group-hover:bg-emerald-700 transition-colors">
                          <div className="opacity-95 text-[8px]">Jumu’ah</div>
                          <div className="font-mono mt-0.5">{mosque.jumah}</div>
                        </div>
                        <div className="text-right flex-1 pr-3">
                          <div className="text-xs font-bold text-slate-800 font-urdu">{mosque.name}</div>
                          <div className="text-[9px] text-slate-400 font-urdu flex items-center justify-end gap-1 mt-0.5 font-mono">
                            <span>{distance} km away</span>
                            <MapPin size={10} className="text-emerald-500" />
                          </div>
                        </div>
                      </div>
                    ));
                  })()
                )}
              </div>
            )}
          </div>

          {/* Main features and individual Hadith books — one equal square grid */}
          <div className="mx-3 grid grid-cols-2 gap-3 pb-1">
            <button type="button" onClick={() => onNavigate('quran')} className="aspect-square rounded-md bg-white p-3 shadow-[0_4px_14px_rgba(0,0,0,0.10)] transition-all active:scale-[0.96] active:shadow-[0_2px_6px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center text-center">
              <BookOpen size={30} strokeWidth={2} className="mb-2 shrink-0 text-slate-800" />
              <span className="home-card-urdu-title mb-1.5 text-[16px] text-slate-800" dir="rtl">القرآن الكريم</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-800">Quran</span>
            </button>

            <button type="button" onClick={() => onNavigate('namaz')} className="aspect-square rounded-md bg-white p-3 shadow-[0_4px_14px_rgba(0,0,0,0.10)] transition-all active:scale-[0.96] active:shadow-[0_2px_6px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center text-center">
              <User size={30} strokeWidth={2} className="mb-2 shrink-0 text-slate-800" />
              <span className="home-card-urdu-title mb-1.5 text-[16px] text-slate-800" dir="rtl">نماز کا طریقہ</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-800">Prayer</span>
            </button>

            <button type="button" onClick={() => onNavigate('duas')} className="aspect-square rounded-md bg-white p-3 shadow-[0_4px_14px_rgba(0,0,0,0.10)] transition-all active:scale-[0.96] active:shadow-[0_2px_6px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center text-center">
              <Heart size={30} strokeWidth={2} className="mb-2 shrink-0 text-slate-800" />
              <span className="home-card-urdu-title mb-1.5 text-[16px] text-slate-800" dir="rtl">مسنون دعائیں</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-800">Duas</span>
            </button>

            <button type="button" onClick={() => onNavigate('tasbih')} className="aspect-square rounded-md bg-white p-3 shadow-[0_4px_14px_rgba(0,0,0,0.10)] transition-all active:scale-[0.96] active:shadow-[0_2px_6px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center text-center">
              <CircleDot size={30} strokeWidth={2} className="mb-2 shrink-0 text-slate-800" />
              <span className="home-card-urdu-title mb-1.5 text-[16px] text-slate-800" dir="rtl">تسبیح کاؤنٹر</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-800">Tasbih</span>
            </button>

            <button type="button" onClick={() => onNavigate('qibla')} className="aspect-square rounded-md bg-white p-3 shadow-[0_4px_14px_rgba(0,0,0,0.10)] transition-all active:scale-[0.96] active:shadow-[0_2px_6px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center text-center">
              <Compass size={30} strokeWidth={2} className="mb-2 shrink-0 text-slate-800" />
              <span className="home-card-urdu-title mb-1.5 text-[16px] text-slate-800" dir="rtl">قبلہ رخ سمت</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-800">Qibla</span>
            </button>

            <button type="button" onClick={() => openHadithBook('bukhari')} className="aspect-square rounded-md bg-white p-3 shadow-[0_4px_14px_rgba(0,0,0,0.10)] transition-all active:scale-[0.96] active:shadow-[0_2px_6px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center text-center">
              <BookOpen size={30} strokeWidth={2} className="mb-2 text-slate-800" />
              <span className="home-card-urdu-title mb-1.5 text-[16px] text-slate-800" dir="rtl">صحیح بخاری</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-slate-800">Sahih Bukhari</span>
            </button>

            <button type="button" onClick={() => openHadithBook('muslim')} className="aspect-square rounded-md bg-white p-3 shadow-[0_4px_14px_rgba(0,0,0,0.10)] transition-all active:scale-[0.96] active:shadow-[0_2px_6px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center text-center">
              <BookOpen size={30} strokeWidth={2} className="mb-2 text-slate-800" />
              <span className="home-card-urdu-title mb-1.5 text-[16px] text-slate-800" dir="rtl">صحیح مسلم</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-slate-800">Sahih Muslim</span>
            </button>

            <button type="button" onClick={() => openHadithBook('abudawud')} className="aspect-square rounded-md bg-white p-3 shadow-[0_4px_14px_rgba(0,0,0,0.10)] transition-all active:scale-[0.96] active:shadow-[0_2px_6px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center text-center">
              <Scroll size={30} strokeWidth={2} className="mb-2 text-slate-800" />
              <span className="home-card-urdu-title mb-1.5 text-[16px] text-slate-800" dir="rtl">سنن ابو داود</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-slate-800">Sunan Abu Dawud</span>
            </button>

            <button type="button" onClick={() => openHadithBook('tirmidhi')} className="aspect-square rounded-md bg-white p-3 shadow-[0_4px_14px_rgba(0,0,0,0.10)] transition-all active:scale-[0.96] active:shadow-[0_2px_6px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center text-center">
              <Scroll size={30} strokeWidth={2} className="mb-2 text-slate-800" />
              <span className="home-card-urdu-title mb-1.5 text-[16px] text-slate-800" dir="rtl">جامع ترمذی</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-slate-800">Jami at-Tirmidhi</span>
            </button>

            <button type="button" onClick={() => openHadithBook('nasai')} className="aspect-square rounded-md bg-white p-3 shadow-[0_4px_14px_rgba(0,0,0,0.10)] transition-all active:scale-[0.96] active:shadow-[0_2px_6px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center text-center">
              <BookOpen size={30} strokeWidth={2} className="mb-2 text-slate-800" />
              <span className="home-card-urdu-title mb-1.5 text-[16px] text-slate-800" dir="rtl">سنن نسائی</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-slate-800">Sunan an-Nasai</span>
            </button>

            <button type="button" onClick={() => openHadithBook('ibnmajah')} className="aspect-square rounded-md bg-white p-3 shadow-[0_4px_14px_rgba(0,0,0,0.10)] transition-all active:scale-[0.96] active:shadow-[0_2px_6px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center text-center">
              <BookOpen size={30} strokeWidth={2} className="mb-2 text-slate-800" />
              <span className="home-card-urdu-title mb-1.5 text-[16px] text-slate-800" dir="rtl">سنن ابن ماجہ</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-slate-800">Sunan Ibn Majah</span>
            </button>
<button 
  type="button" 
  onClick={() => openHadithBook('malik')} 
  className="aspect-square rounded-md bg-white p-3 shadow-[0_4px_14px_rgba(0,0,0,0.10)] transition-all active:scale-[0.96] active:shadow-[0_2px_6px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center text-center"
>
  <BookOpen size={30} strokeWidth={2} className="mb-2 shrink-0 text-slate-800" />
  <span className="home-card-urdu-title mb-1.5 text-[16px] text-slate-800" dir="rtl">موطا امام مالک</span>
  <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-slate-800">Muwatta Imam Malik</span>
</button>
            </div>
          {/* آیتِ روز */}
          <div className="mx-4">
            <div className="text-center text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">✦ Verse of the Day ✦</div>
            <div className="bg-white rounded-lg shadow-[0_2px_10px_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.03)] p-4 text-center space-y-2.5">
              {loadingAyah ? (
                <div className="flex items-center justify-center py-4"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div></div>
              ) : (
                <>
                  <p className="text-base leading-loose font-amiri text-slate-800" dir="rtl">{dailyAyah?.ar}</p>
                  <p className="text-xs text-emerald-800 font-urdu leading-relaxed border-t border-slate-100 pt-2" dir="rtl">{dailyAyah?.ur}</p>
                  <div className="text-[9px] text-slate-400 font-mono text-left tracking-tight">{dailyAyah?.ref}</div>
                </>
              )}
            </div>
          </div>

          {/* حدیثِ روز */}
          <div className="mx-4">
            <div className="text-center text-[9px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">✦ Hadith of the Day ✦</div>
            <div className="bg-white rounded-lg shadow-[0_2px_10px_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.03)] border-r-4 border-r-emerald-600 p-4 text-center space-y-2.5">
              {loadingHadith ? (
                <div className="flex items-center justify-center py-4"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600"></div></div>
              ) : (
                <>
                  <p className="text-sm leading-relaxed font-amiri text-slate-800 text-right font-medium" dir="rtl">{dailyHadith?.ar}</p>
                  <p className="text-xs text-slate-600 font-urdu leading-relaxed border-t border-slate-100 pt-2 text-right" dir="rtl">{dailyHadith?.ur}</p>
                  <div className="text-[9px] text-slate-400 font-mono text-left tracking-tight">{dailyHadith?.ref}</div>
                </>
              )}
            </div>
          </div>

      </div>
    </div>
  );
};
