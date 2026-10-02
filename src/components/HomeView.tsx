import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, Bell, CalendarDays, ChevronDown, Compass,
  MapPin, MapPinned, Menu, Search, SlidersHorizontal, Sunrise, User, X,
} from 'lucide-react';
import { Mosque } from '../types';
import CelestialHeaderScene from './CelestialHeaderScene';
import { InboxItem, readInbox, markInboxRead } from '../utils/notifications';

/* ═══════════════════════════ Types ═══════════════════════════ */

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

interface DailyText { ar: string; ur: string; ref: string }

interface SearchResult {
  title: string;
  subtitle?: string;
  type: string;
  action: () => void;
}

interface SurahTarget { surah: number; ayah?: number }

/* ═══════════════════════════ Constants ═══════════════════════════ */

const QURAN_CDN = 'https://cdn.jsdelivr.net/gh/RochTools/quran-api@main/Quran/';
const QURAN_FALLBACK = 'https://raw.githubusercontent.com/RochTools/quran-api/main/Quran/';
const QURAN_SEARCH_TARGET_KEY = 'steptudeen_app_quran_search_target';
const QURAN_LANGUAGE_KEY = 'steptudeen_app_quran_language';
const HADITH_HOME_TARGET_KEY = 'steptudeen_app_hadith_book_target';

const CARD_SHADOW = 'shadow-[0_2px_10px_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.03)]';
const DEFAULT_LOCATION_NAME = 'Current location';
const CURRENT_PRAYER_WINDOW_MINS = 30;

const SECTIONS = [
  { title: 'Quran', subtitle: '114 Surahs', nav: 'quran' },
  { title: 'Hadith', subtitle: 'Authentic Hadith collections', nav: 'hadith' },
  { title: 'Prayer Guide', subtitle: 'Learn how to pray', nav: 'namaz' },
  { title: 'Duas', subtitle: 'Daily supplications', nav: 'duas' },
  { title: 'Tasbih Counter', subtitle: 'Daily dhikr', nav: 'tasbih' },
  { title: 'Qibla Direction', subtitle: 'Find the Qibla', nav: 'qibla' },
  { title: 'Nearby Mosques', subtitle: 'Jumu’ah timings', nav: 'mosques' },
];

const SURAH_MAP: Record<string, number> = {
  // Urdu
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
  // English
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
  // Arabic
  'الفاتحة': 1, 'البقرة': 2, 'النساء': 4, 'المائدة': 5, 'يس': 36,
  'الواقعة': 56, 'الملك': 67, 'الإخلاص': 112,
};

// Longest alias first, so short keys never win over longer, more specific ones.
const SURAH_ALIASES = Object.entries(SURAH_MAP)
  .map(([alias, number]) => [alias.toLowerCase(), number] as const)
  .sort((a, b) => b[0].length - a[0].length);

const FAMOUS_AYAHS = [
  { s: 2, a: 255 }, { s: 2, a: 286 }, { s: 3, a: 185 }, { s: 2, a: 152 },
  { s: 13, a: 28 }, { s: 2, a: 153 }, { s: 65, a: 3 }, { s: 94, a: 5 },
  { s: 2, a: 201 }, { s: 3, a: 8 }, { s: 39, a: 53 }, { s: 55, a: 13 }, { s: 50, a: 16 },
];

const FALLBACK_AYAH: DailyText = {
  ar: 'وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ ۚ عَلَيْهِ تَوَكَّلْتُ وَإِلَيْهِ أُنِيبُ',
  ur: 'اور میری توفیق صرف اللہ کی طرف سے ہے، اسی پر میں نے بھروسہ کیا اور اسی کی طرف رجوع کرتا ہوں۔',
  ref: 'Surah Hud · Ayah 88',
};

const DAILY_HADITHS: DailyText[] = [
  { ar: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ', ur: 'اعمال کا دارومدار نیتوں پر ہے۔', ref: 'Sahih Bukhari · Hadith 1' },
  { ar: 'الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ', ur: 'مسلمان وہ ہے جس کی زبان اور ہاتھ سے دوسرے مسلمان محفوظ رہیں۔', ref: 'Sahih Bukhari · Hadith 10' },
  { ar: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ', ur: 'تم میں سے کوئی اس وقت تک مومن نہیں ہو سکتا جب تک اپنے بھائی کے لیے وہ نہ چاہے جو اپنے لیے چاہتا ہے۔', ref: 'Sahih Bukhari · Hadith 13' },
  { ar: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ', ur: 'جو اللہ اور آخرت کے دن پر ایمان رکھتا ہو وہ اچھی بات کہے یا خاموش رہے۔', ref: 'Sahih Bukhari · Hadith 6018' },
  { ar: 'الدِّينُ النَّصِيحَةُ', ur: 'دین خیرخواہی کا نام ہے۔', ref: 'Sahih Muslim · Hadith 55' },
  { ar: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ', ur: 'تم میں سے بہترین وہ ہے جو قرآن سیکھے اور سکھائے۔', ref: 'Sahih Bukhari · Hadith 5027' },
  { ar: 'اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ وَأَتْبِعِ السَّيِّئَةَ الْحَسَنَةَ تَمْحُهَا', ur: 'جہاں بھی ہو اللہ سے ڈرو، اور برائی کے بعد نیکی کرو وہ اسے مٹا دے گی۔', ref: 'Sunan Tirmidhi · Hadith 1987' },
  { ar: 'الطَّهُورُ شَطْرُ الْإِيمَانِ', ur: 'پاکیزگی نصف ایمان ہے۔', ref: 'Sahih Muslim · Hadith 223' },
  { ar: 'أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ', ur: 'اللہ کو سب سے محبوب عمل وہ ہے جو ہمیشہ کیا جائے، چاہے تھوڑا ہی ہو۔', ref: 'Sahih Bukhari · Hadith 6465' },
  { ar: 'مَنْ صَامَ رَمَضَانَ إِيمَانًا وَاحْتِسَابًا غُفِرَ لَهُ مَا تَقَدَّمَ مِنْ ذَنْبِهِ', ur: 'جس نے ایمان اور ثواب کی نیت سے رمضان کے روزے رکھے اس کے پچھلے گناہ معاف کر دیے گئے۔', ref: 'Sahih Bukhari · Hadith 38' },
  { ar: 'بُنِيَ الْإِسْلَامُ عَلَى خَمْسٍ', ur: 'اسلام پانچ چیزوں پر قائم ہے: توحید، نماز، زکوٰۃ، حج اور روزہ۔', ref: 'Sahih Bukhari · Hadith 8' },
  { ar: 'خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ', ur: 'لوگوں میں سب سے بہتر وہ ہے جو لوگوں کے لیے سب سے زیادہ نفع بخش ہو۔', ref: "Al-Mu'jam al-Awsat · Hadith 5787" },
  { ar: 'إِنَّ اللَّهَ رَفِيقٌ يُحِبُّ الرِّفْقَ', ur: 'بے شک اللہ نرم مزاج ہے اور نرمی کو پسند کرتا ہے۔', ref: 'Sahih Bukhari · Hadith 6927' },
  { ar: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ طَرِيقًا إِلَى الْجَنَّةِ', ur: 'جو علم کی تلاش میں کوئی راستہ اختیار کرے اللہ اس کے لیے جنت کا راستہ آسان کر دیتا ہے۔', ref: 'Sahih Muslim · Hadith 2699' },
  { ar: 'اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا', ur: 'اے اللہ! کوئی چیز آسان نہیں مگر جسے تو آسان بنا دے۔', ref: 'Ibn Hibban · Hadith 974' },
  { ar: 'أَفْضَلُ الصَّلَاةِ بَعْدَ الْفَرِيضَةِ صَلَاةُ اللَّيْلِ', ur: 'فرض نماز کے بعد سب سے افضل نماز رات کی نماز (تہجد) ہے۔', ref: 'Sahih Muslim · Hadith 1163' },
  { ar: 'الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ', ur: 'طاقتور مومن کمزور مومن سے بہتر اور اللہ کو زیادہ محبوب ہے۔', ref: 'Sahih Muslim · Hadith 2664' },
  { ar: 'كُلُّ مَعْرُوفٍ صَدَقَةٌ', ur: 'ہر نیکی صدقہ ہے۔', ref: 'Sahih Bukhari · Hadith 6021' },
  { ar: 'إِنَّ مِنْ أَكْمَلِ الْمُؤْمِنِينَ إِيمَانًا أَحْسَنُهُمْ خُلُقًا', ur: 'ایمان میں سب سے کامل مومن وہ ہے جس کے اخلاق سب سے اچھے ہوں۔', ref: 'Sunan Tirmidhi · Hadith 1162' },
  { ar: 'مَنْ لَا يَشْكُرُ النَّاسَ لَا يَشْكُرُ اللَّهَ', ur: 'جو لوگوں کا شکریہ ادا نہیں کرتا وہ اللہ کا بھی شکر ادا نہیں کرتا۔', ref: 'Sunan Tirmidhi · Hadith 1954' },
];

/* ═══════════════════════════ Home cards ═══════════════════════════ */

type CardTheme = { bg: string; icon: string; title: string; label: string };

const CARD_THEMES: Record<string, CardTheme> = {
  green:  { bg: '#E1F5EE', icon: '#0F6E56', title: '#04342C', label: '#085041' },
  purple: { bg: '#EEEDFE', icon: '#534AB7', title: '#26215C', label: '#3C3489' },
  pink:   { bg: '#FBEAF0', icon: '#993556', title: '#4B1528', label: '#72243E' },
  amber:  { bg: '#FAEEDA', icon: '#854F0B', title: '#412402', label: '#633806' },
  blue:   { bg: '#E6F1FB', icon: '#185FA5', title: '#042C53', label: '#0C447C' },
  coral:  { bg: '#FAECE7', icon: '#993C1D', title: '#4A1B0C', label: '#712B13' },
  teal:   { bg: '#DDF3F0', icon: '#0E7C74', title: '#053B37', label: '#0A5A54' },
  rose:   { bg: '#FCE8EC', icon: '#B0294A', title: '#5A0F22', label: '#7E1B36' },
};

interface HomeCardConfig {
  theme: keyof typeof CARD_THEMES;
  urdu: string;
  label: string;
  /** Either a top-level view to open, or a Hadith book to open inside the Hadith view. */
  nav?: string;
  hadithBook?: string;
}

const HOME_CARDS: HomeCardConfig[] = [
  { theme: 'green',  urdu: 'القرآن الکریم',   label: 'Quran',            nav: 'quran' },
  { theme: 'purple', urdu: 'نماز کا طریقہ',   label: 'Prayer',           nav: 'namaz' },
  { theme: 'pink',   urdu: 'مسنون دعائیں',    label: 'Duas',             nav: 'duas' },
  { theme: 'amber',  urdu: 'تسبیح کاؤنٹر',   label: 'Tasbih',           nav: 'tasbih' },
  { theme: 'blue',   urdu: 'قبلہ رخ سمت',     label: 'Qibla',            nav: 'qibla' },
  { theme: 'coral',  urdu: 'صحیح بخاری',      label: 'Sahih Bukhari',    hadithBook: 'bukhari' },
  { theme: 'teal',   urdu: 'صحیح مسلم',       label: 'Sahih Muslim',     hadithBook: 'muslim' },
  { theme: 'rose',   urdu: 'سنن ابو داود',    label: 'Sunan Abu Dawud',  hadithBook: 'abudawud' },
  { theme: 'purple', urdu: 'جامع ترمذی',      label: 'Jami at-Tirmidhi', hadithBook: 'tirmidhi' },
  { theme: 'green',  urdu: 'سنن نسائی',       label: 'Sunan an-Nasai',   hadithBook: 'nasai' },
  { theme: 'amber',  urdu: 'سنن ابن ماجہ',    label: 'Sunan Ibn Majah',  hadithBook: 'ibnmajah' },
  { theme: 'blue',   urdu: 'موطا امام مالک',  label: 'Muwatta Malik',    hadithBook: 'malik' },
];

/* ═══════════════════════════ Helpers ═══════════════════════════ */

const readStorage = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};

const writeStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Could not save "${key}":`, error);
  }
};

const formatTo12Hour = (time24: string) => {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  const hours24 = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
};

const timeAgo = (timestamp: number): string => {
  const diffMin = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const days = Math.floor(diffHours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
};

const truncate = (text: unknown, max: number) => {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max)}...` : value;
};

const getDayOfYear = (date = new Date()) =>
  Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);

const parseSurahAyah = (query: string): SurahTarget | null => {
  const text = query
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .toLowerCase()
    .trim();
  if (!text) return null;

  // "2:255" or "2 255"
  const direct = text.match(/^(\d+)[:\s]+(\d+)$/);
  if (direct) {
    const surah = Number(direct[1]);
    const ayah = Number(direct[2]);
    return surah >= 1 && surah <= 114 && ayah >= 1 ? { surah, ayah } : null;
  }

  // A lone number 1-114 is a Surah number.
  if (/^\d+$/.test(text)) {
    const surah = Number(text);
    return surah >= 1 && surah <= 114 ? { surah } : null;
  }

  const ayahMatch = text.match(/(?:آیت|ايت|ayat|ayah|verse|:)\s*(?:نمبر|number|no\.?)?\s*(\d+)/i);
  const ayah = ayahMatch ? Number(ayahMatch[1]) : undefined;

  const match = SURAH_ALIASES.find(([alias]) => text.includes(alias));
  if (!match) return null;

  return ayah && ayah > 0 ? { surah: match[1], ayah } : { surah: match[1] };
};

const fetchQuranSurah = async (surah: number) => {
  const language = readStorage(QURAN_LANGUAGE_KEY) || 'ur';
  const request = async (base: string) => {
    const response = await fetch(`${base}${language}/${surah}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };
  try {
    return await request(QURAN_CDN);
  } catch {
    return request(QURAN_FALLBACK);
  }
};

const getNextPrayerDetails = (prayerTimes: Record<string, string>) => {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const toMins = (time?: string) => {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const prayers = [
    { key: 'fajr',    label: 'Fajr',    urdu: 'فجر' },
    { key: 'zuhr',    label: 'Dhuhr',   urdu: 'ظہر' },
    { key: 'asr',     label: 'Asr',     urdu: 'عصر' },
    { key: 'maghrib', label: 'Maghrib', urdu: 'مغرب' },
    { key: 'isha',    label: 'Isha',    urdu: 'عشاء' },
  ]
    .map(p => ({ ...p, mins: toMins(prayerTimes[p.key]), time: formatTo12Hour(prayerTimes[p.key] || '--:--') }))
    .sort((a, b) => a.mins - b.mins);

  // A prayer is "current" for 30 minutes after its start time.
  const current = prayers.find(p => nowMins >= p.mins && nowMins < p.mins + CURRENT_PRAYER_WINDOW_MINS);
  if (current) {
    const minsLeft = current.mins + CURRENT_PRAYER_WINDOW_MINS - nowMins;
    return {
      label: current.label,
      urdu: current.urdu,
      time: current.time,
      countdown: `${minsLeft} min remaining`,
      isCurrent: true,
    };
  }

  const upcoming = prayers.find(p => p.mins > nowMins);
  const next = upcoming ?? prayers[0];
  const diff = upcoming ? next.mins - nowMins : 1440 - nowMins + next.mins;
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  return {
    label: next.label,
    urdu: next.urdu,
    time: next.time,
    countdown: hrs > 0 ? `${hrs}h ${mins}m remaining` : `${mins} minutes remaining`,
    isCurrent: false,
  };
};

/** Section + mosque matches for the live search dropdown. */
const buildLocalResults = (
  query: string,
  mosques: Mosque[],
  onNavigate: (view: string) => void,
  onOpenMosque: (mosque: Mosque) => void,
): SearchResult[] => {
  const sections = SECTIONS
    .filter(s => s.title.includes(query) || s.subtitle.includes(query))
    .map(s => ({ title: s.title, subtitle: s.subtitle, type: 'Section', action: () => onNavigate(s.nav) }));
  const mosqueMatches = mosques
    .filter(m => m.name.includes(query))
    .slice(0, 2)
    .map(m => ({ title: m.name, subtitle: `Jumu’ah: ${m.jumah}`, type: 'Mosque', action: () => onOpenMosque(m) }));
  return [...sections, ...mosqueMatches];
};

/* ═══════════════════════════ Small components ═══════════════════════════ */

const Spinner: React.FC<{ className?: string }> = ({ className = 'h-5 w-5' }) => (
  <div className={`animate-spin rounded-full border-b-2 border-emerald-600 ${className}`} />
);

/** Small Islamic scroll ornament for one card corner (rotate it for the other three). */
const CornerOrnament: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 40 40"
    className={`pointer-events-none absolute h-9 w-9 text-slate-400/80 ${className}`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M5 5c0 9 10 9 10 3 0-4-5-4-5 0" />
    <path d="M19 6c6-2 12 0 16 5-6 1-12 0-16-5Z" />
    <path d="M6 19c-2 6 0 12 5 16 1-6 0-12-5-16Z" />
    <circle cx="22" cy="22" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

const HomeCard: React.FC<{ config: HomeCardConfig; onClick: () => void }> = ({ config, onClick }) => {
  const { theme, urdu, label } = config;
  const color = CARD_THEMES[theme].icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden rounded-md bg-white px-3 text-center shadow-[0_3px_10px_rgba(0,0,0,0.10)] transition-transform active:scale-[0.97]"
    >
      <CornerOrnament className="left-1 top-1" />
      <CornerOrnament className="right-1 top-1 rotate-90" />
      <CornerOrnament className="bottom-1 right-1 rotate-180" />
      <CornerOrnament className="bottom-1 left-1 -rotate-90" />

      <span dir="rtl" style={{ color }} className="home-card-urdu-title text-[18px]">
        {urdu}
      </span>
      <span className="mt-0.5 text-[15px] font-medium text-slate-800">{label}</span>
      <span className="mt-2 text-[13px] font-medium text-emerald-700">Open</span>
    </button>
  );
};

/* ═══════════════════════════ HomeView ═══════════════════════════ */

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  prayerTimes,
  todayDate,
  nearbyMosques,
  savedMosqueIds = [],
  onOpenMosque,
  userCoords,
  isAuthenticated,
  isUserAuthenticated,
  userAuthName,
  authName,
  isLoading = false,
}) => {
  const [dailyAyah, setDailyAyah] = useState<DailyText | null>(null);
  const [loadingAyah, setLoadingAyah] = useState(true);
  const [isDeviceOffline, setIsDeviceOffline] = useState<boolean>(!navigator.onLine);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [locationName, setLocationName] = useState(DEFAULT_LOCATION_NAME);

  // Bell / inbox
  const [bellOpen, setBellOpen] = useState(false);
  const [prayerInbox, setPrayerInbox] = useState<InboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const savedMosquesWithAnnouncement = useMemo(
    () => nearbyMosques.filter(m => savedMosqueIds.includes(m.id) && m.announcement?.trim()),
    [nearbyMosques, savedMosqueIds],
  );
  const announcementCount = savedMosquesWithAnnouncement.length;

  const dailyHadith = useMemo(() => DAILY_HADITHS[getDayOfYear() % DAILY_HADITHS.length], []);

  const closestMosques = useMemo(() => {
    if (!userCoords) return [];
    return nearbyMosques
      .map(mosque => ({
        mosque,
        distance: calculateDistance(userCoords.latitude, userCoords.longitude, mosque.latitude, mosque.longitude),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
  }, [nearbyMosques, userCoords]);

  const nextPrayer = getNextPrayerDetails(prayerTimes);
  const gregorianDate = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());

  // Guest mode: if neither an Imam nor a user is logged in, the user dashboard still opens.
  const accountLabel = isAuthenticated
    ? (authName || 'Imam account')
    : isUserAuthenticated ? (userAuthName || 'My account') : 'My Dashboard';
  const accountTarget = isAuthenticated ? 'imam-login' : 'user-dashboard';

  /* ───── Inbox: refresh on mount and every minute ───── */
  useEffect(() => {
    const refresh = () => {
      const inbox = readInbox();
      setPrayerInbox(inbox);
      setUnreadCount(inbox.filter(item => !item.read).length + announcementCount);
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => clearInterval(timer);
  }, [announcementCount]);

  const toggleBell = () => {
    if (!bellOpen) {
      markInboxRead();
      setUnreadCount(0);
      setPrayerInbox(readInbox());
    }
    setBellOpen(open => !open);
  };

  /* ───── Live search (sections + mosques) ───── */
  useEffect(() => {
    const query = searchQuery.trim();
    setSearchResults(query ? buildLocalResults(searchQuery, nearbyMosques, onNavigate, onOpenMosque) : []);
  }, [searchQuery, nearbyMosques, onNavigate, onOpenMosque]);

  const saveQuranTarget = (target: SurahTarget) => {
    writeStorage(QURAN_SEARCH_TARGET_KEY, JSON.stringify(target));
    onNavigate('quran'); // navigate even if storage is unavailable
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    const parsed = parseSurahAyah(query);
    if (!parsed) return;

    // Surah-only: no network needed.
    if (!parsed.ayah) {
      const surahResult: SearchResult = {
        title: `Surah ${parsed.surah}`,
        subtitle: `Surah ${parsed.surah} — open complete Surah`,
        type: 'Surah',
        action: () => saveQuranTarget(parsed),
      };
      setSearchResults(previous => [surahResult, ...previous]);
      return;
    }

    setIsSearching(true);
    try {
      const data = await fetchQuranSurah(parsed.surah);
      const verses: any[] = Array.isArray(data?.verses) ? data.verses : [];
      const verse = verses.find(item => Number(item.id) === parsed.ayah) || verses[parsed.ayah - 1];
      if (!verse) throw new Error('Ayah not found');

      const ayahResult: SearchResult = {
        title: truncate(verse.text, 70),
        subtitle: truncate(verse.translation, 90),
        type: 'Ayah',
        action: () => saveQuranTarget(parsed),
      };
      setSearchResults(previous => [ayahResult, ...previous]);
    } catch {
      const errorResult: SearchResult = {
        title: 'The Ayah could not be loaded',
        subtitle: 'Check your internet connection and try again',
        type: 'Error',
        action: () => undefined,
      };
      setSearchResults(previous => [errorResult, ...previous]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  /* ───── Online / offline banner ───── */
  useEffect(() => {
    const goOnline = () => setIsDeviceOffline(false);
    const goOffline = () => setIsDeviceOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  /* ───── City name from coordinates (cached) ───── */
  useEffect(() => {
    if (!userCoords) {
      setLocationName(DEFAULT_LOCATION_NAME);
      return;
    }
    const { latitude, longitude } = userCoords;
    const cacheKey = `location_name_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;
    const cached = readStorage(cacheKey);
    if (cached) {
      setLocationName(cached);
      return;
    }

    const controller = new AbortController();
    fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      { signal: controller.signal },
    )
      .then(response => response.json())
      .then(data => {
        const name = data.city || data.locality || data.principalSubdivision || DEFAULT_LOCATION_NAME;
        setLocationName(name);
        writeStorage(cacheKey, name);
      })
      .catch(() => setLocationName(DEFAULT_LOCATION_NAME));
    return () => controller.abort();
  }, [userCoords]);

  /* ───── Ayah of the day ───── */
  useEffect(() => {
    let cancelled = false;
    const chosen = FAMOUS_AYAHS[getDayOfYear() % FAMOUS_AYAHS.length];

    fetch(`https://api.alquran.cloud/v1/ayah/${chosen.s}:${chosen.a}/editions/quran-uthmani,ur.jalandhry`)
      .then(response => response.json())
      .then(json => {
        if (cancelled) return;
        const ok = json.code === 200 && json.data?.length >= 2;
        setDailyAyah(ok
          ? { ar: json.data[0].text, ur: json.data[1].text, ref: `Surah ${chosen.s} · Ayah ${chosen.a}` }
          : FALLBACK_AYAH);
      })
      .catch(() => { if (!cancelled) setDailyAyah(FALLBACK_AYAH); })
      .finally(() => { if (!cancelled) setLoadingAyah(false); });

    return () => { cancelled = true; };
  }, []);

  const openHadithBook = (bookKey: string) => {
    writeStorage(HADITH_HOME_TARGET_KEY, bookKey);
    onNavigate('hadith');
  };

  const handleCardClick = (card: HomeCardConfig) => {
    if (card.hadithBook) openHadithBook(card.hadithBook);
    else if (card.nav) onNavigate(card.nav);
  };

  /* ═══════════════════════════ Render ═══════════════════════════ */

  return (
    <div className="pb-16 animate-fadeIn bg-slate-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@700&display=swap');
        .home-card-urdu-title {
          font-family: 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif;
          font-weight: 700;
          line-height: 1.9;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
        }
      `}</style>

      {/* ═══════════ Header ═══════════ */}
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
            objectPosition: 'top right',
          }}
          decoding="async"
          fetchPriority="high"
        />

        {/* Top actions */}
        <div className="relative z-20 flex items-center justify-between px-4 pt-3">
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('mosque-map')}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm transition-transform active:scale-95"
              aria-label="Mosque map"
              title="Find mosques on the map"
            >
              <MapPinned size={20} />
            </button>

            <button
              type="button"
              onClick={toggleBell}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm"
              aria-label="Notifications"
              title="Inbox"
            >
              <Bell size={21} />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold leading-none text-slate-900">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {bellOpen && createPortal(
              <>
                {/* transparent backdrop: tapping outside closes the inbox */}
                <div className="fixed inset-0 z-[9998]" onClick={() => setBellOpen(false)} />
                <div className="fixed left-4 right-4 top-16 z-[9999] mx-auto max-w-sm overflow-hidden rounded-2xl border border-white/20 bg-white text-slate-800 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <h3 className="text-[15px] font-bold text-slate-900">Inbox</h3>
                    <button type="button" onClick={() => setBellOpen(false)} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
                      <X size={16} />
                    </button>
                  </div>

                  <div className="max-h-[60vh] overflow-y-auto">
                    {announcementCount === 0 && prayerInbox.length === 0 && (
                      <div className="px-4 py-8 text-center text-sm text-slate-400">No new notifications yet</div>
                    )}

                    {announcementCount > 0 && (
                      <div className="border-b border-slate-100 px-4 py-2">
                        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">Mosque Announcements</div>
                        {savedMosquesWithAnnouncement.map(m => (
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
                        {prayerInbox.map(item => (
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
              document.body,
            )}
          </div>

          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHeaderMenuOpen(open => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm"
              aria-label="Account options"
            >
              <Menu size={22} />
            </button>

            {headerMenuOpen && (
              <div className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-xl border border-white/20 bg-white text-slate-800 shadow-2xl">
                <button
                  type="button"
                  onClick={() => { setHeaderMenuOpen(false); onNavigate(accountTarget); }}
                  className="flex w-full items-center gap-2 border-b border-slate-100 px-4 py-3 text-left text-xs font-semibold hover:bg-blue-50"
                >
                  <User size={15} className="text-blue-700" /> {accountLabel}
                </button>
                <button
                  type="button"
                  onClick={() => { setHeaderMenuOpen(false); onNavigate('menu'); }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-semibold hover:bg-blue-50"
                >
                  <SlidersHorizontal size={15} className="text-blue-700" /> App menu
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="relative z-10 mt-10 w-[58%] px-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-amber-200 backdrop-blur-sm"><CalendarDays size={22} /></span>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-urdu font-bold text-amber-100" dir="auto">{todayDate || 'Hijri date'}</div>
              <div className="mt-1 text-[12px] font-semibold text-white/90">{gregorianDate}</div>
            </div>
          </div>
        </div>

        {/* Prayer glass card */}
        <div className={`relative z-20 mx-4 mt-14 rounded-[20px] border p-3 shadow-[0_12px_35px_rgba(0,34,110,.28)] backdrop-blur-md ${nextPrayer.isCurrent ? 'border-amber-300/50 bg-amber-500/20' : 'border-white/35 bg-white/12'}`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-lg ${nextPrayer.isCurrent ? 'bg-amber-300 text-amber-900' : 'bg-white text-[#0755bd]'}`}>
              <Sunrise size={27} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className={`text-[11px] font-semibold uppercase tracking-wide ${nextPrayer.isCurrent ? 'text-amber-200' : 'text-white/75'}`}>
                {nextPrayer.isCurrent ? ' Current Prayer' : 'Next Prayer'}
              </div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="font-urdu text-[22px] font-bold text-white" dir="rtl">{nextPrayer.urdu}</span>
                <span className="text-[10px] font-semibold text-amber-100">{nextPrayer.label}</span>
              </div>
              <div className={`mt-1 text-[10px] ${nextPrayer.isCurrent ? 'text-amber-200' : 'text-white/75'}`}>
                {nextPrayer.countdown}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[27px] font-mono font-bold leading-none tracking-tight text-white">{nextPrayer.time.replace(/\s?(AM|PM)$/i, '')}</div>
              <div className="mt-1 text-[11px] font-bold text-amber-100">{nextPrayer.time.match(/AM|PM/i)?.[0] || ''}</div>
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="mt-2 flex max-w-[120px] items-center gap-1 rounded-full bg-[#063a93]/70 px-2.5 py-1.5 text-[9px] font-semibold text-white"
              >
                <MapPin size={11} className="shrink-0" />
                <span className="truncate">{locationName}</span>
                <ChevronDown size={10} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ Search ═══════════ */}
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
            <button type="button" onClick={clearSearch} className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100" aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            {searchResults.map((result, index) => (
              <button
                key={index}
                type="button"
                onClick={() => { result.action(); clearSearch(); }}
                className="flex w-full items-center gap-3 border-b border-slate-100 bg-white px-4 py-3 text-left transition-colors last:border-0 hover:bg-blue-50 active:bg-blue-100"
              >
                <span className="flex-1 text-left">
                  <span className="block text-[12px] font-bold text-slate-800" dir="auto">{result.title}</span>
                  {result.subtitle && <span className="block text-[10px] text-slate-400" dir="auto">{result.subtitle}</span>}
                </span>
                <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{result.type}</span>
              </button>
            ))}
          </div>
        )}

        {isSearching && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600" />
            <span className="text-[12px] text-slate-500">Searching...</span>
          </div>
        )}
      </div>

      {/* ═══════════ Main content ═══════════ */}
      <div className="relative space-y-4 bg-slate-50 pt-1">
        {isDeviceOffline && (
          <div className={`mx-4 flex animate-fadeIn items-center gap-2.5 bg-amber-50/70 p-2.5 text-amber-900 ${CARD_SHADOW}`}>
            <AlertTriangle size={15} className="shrink-0 text-amber-600" />
            <div className="flex-1 text-left text-[11px] leading-relaxed">
              Offline mode: Your internet connection is unavailable. Some content may not load.
            </div>
          </div>
        )}

        {/* Nearby mosques */}
        <div className={`mx-4 space-y-3 rounded-lg bg-white p-4 ${CARD_SHADOW}`}>
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight text-slate-800">
              <Compass size={13} className="shrink-0 text-emerald-600" />
              Nearby Mosques &amp; Jumu’ah
            </h3>
            <div className="flex items-center gap-2">
              <button type="button" className="text-[10px] font-bold text-emerald-700 hover:underline" onClick={() => onNavigate('mosques')}>
                View all →
              </button>
              <button type="button" className="flex items-center gap-0.5 text-[10px] font-bold text-blue-700 hover:underline" onClick={() => onNavigate('mosque-map')}>
                <MapPinned size={11} /> On Map
              </button>
            </div>
          </div>

          {!userCoords ? (
            <div className="space-y-2.5 rounded-lg bg-slate-50 p-4 text-center shadow-[0_1px_6px_rgba(0,0,0,0.05)]">
              <p className="text-[11px] leading-relaxed text-slate-600">Enable location to see nearby mosques and their congregation times.</p>
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="mx-auto flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                <MapPin size={11} />
                Enable Location
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {closestMosques.length === 0 ? (
                isLoading ? (
                  <div className="flex items-center justify-center py-4"><Spinner /></div>
                ) : (
                  <p className="py-2 text-center text-xs text-gray-500">No registered mosque was found nearby.</p>
                )
              ) : (
                closestMosques.map(({ mosque, distance }) => (
                  <div
                    key={mosque.id}
                    onClick={() => onOpenMosque(mosque)}
                    className="group flex cursor-pointer items-center justify-between bg-slate-50/50 p-3 shadow-[0_1px_5px_rgba(0,0,0,0.05)] transition-all hover:bg-emerald-50/35"
                  >
                    <div className="rounded-lg border border-emerald-700 bg-emerald-600 px-2.5 py-1 text-center text-[9px] font-bold text-white transition-colors group-hover:bg-emerald-700">
                      <div className="text-[8px] opacity-95">Jumu’ah</div>
                      <div className="mt-0.5 font-mono">{mosque.jumah}</div>
                    </div>
                    <div className="flex-1 pr-3 text-right">
                      <div className="font-urdu text-xs font-bold text-slate-800">{mosque.name}</div>
                      <div className="mt-0.5 flex items-center justify-end gap-1 font-mono font-urdu text-[9px] text-slate-400">
                        <span>{distance} km away</span>
                        <MapPin size={10} className="text-emerald-500" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Features + Hadith books */}
        <div className="mx-3 grid grid-cols-2 gap-3 pb-1">
          {HOME_CARDS.map(card => (
            <HomeCard key={`${card.theme}-${card.label}`} config={card} onClick={() => handleCardClick(card)} />
          ))}
        </div>

        {/* Verse of the day */}
        <div className="mx-4">
          <div className="mb-1.5 text-center text-[9px] font-bold uppercase tracking-widest text-slate-400">✦ Verse of the Day ✦</div>
          <div className={`space-y-2.5 rounded-lg bg-white p-4 text-center ${CARD_SHADOW}`}>
            {loadingAyah ? (
              <div className="flex items-center justify-center py-4"><Spinner /></div>
            ) : (
              <>
                <p className="font-amiri text-base leading-loose text-slate-800" dir="rtl">{dailyAyah?.ar}</p>
                <p className="border-t border-slate-100 pt-2 font-urdu text-xs leading-relaxed text-emerald-800" dir="rtl">{dailyAyah?.ur}</p>
                <div className="text-left font-mono text-[9px] tracking-tight text-slate-400">{dailyAyah?.ref}</div>
              </>
            )}
          </div>
        </div>

        {/* Hadith of the day */}
        <div className="mx-4">
          <div className="mb-1.5 text-center text-[9px] font-bold uppercase tracking-widest text-slate-400">✦ Hadith of the Day ✦</div>
          <div className={`space-y-2.5 rounded-lg border-r-4 border-r-emerald-600 bg-white p-4 text-center ${CARD_SHADOW}`}>
            <p className="text-right font-amiri text-sm font-medium leading-relaxed text-slate-800" dir="rtl">{dailyHadith.ar}</p>
            <p className="border-t border-slate-100 pt-2 text-right font-urdu text-xs leading-relaxed text-slate-600" dir="rtl">{dailyHadith.ur}</p>
            <div className="text-left font-mono text-[9px] tracking-tight text-slate-400">{dailyHadith.ref}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
