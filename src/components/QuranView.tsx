import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  Languages,
  MoreVertical,
  Pause,
  Play,
  RefreshCw,
  Search,
  Square,
  Volume2,
  X,
} from 'lucide-react';

/**
 * Combined replacement for the old QuranView + SurahReader components.
 * It intentionally ships in light mode only. The optional legacy prop is
 * retained so existing <QuranView onSelectSurah={...} /> usage still compiles.
 */
interface QuranViewProps {
  onSelectSurah?: (surahNum: number) => void;
}

type SurahMeta = {
  n: number;
  ar: string;
  en: string;
  ur: string;
  ayahs: number;
};

type QuranLanguage = {
  code: string;
  native: string;
  english: string;
  dir: 'ltr' | 'rtl';
};

type Verse = {
  id?: number;
  text?: string;
  translation?: string;
};

type SurahPayload = {
  id?: number;
  name?: string;
  type?: string;
  total_verses?: number;
  verses?: Verse[];
};

type TafsirEdition = {
  slug: string;
  name: string;
  language: string;
  author: string;
};

type TafsirBlock = {
  from: number;
  to: number;
  text: string;
};

type TafsirPayload = {
  blocks?: TafsirBlock[];
};

type LastSeen = {
  surah: number;
  ayah: number;
  surahName: string;
  savedAt: number;
};

type OfflineStatus = 'idle' | 'downloading' | 'done' | 'error';

type OfflineState = {
  status: OfflineStatus;
  done: number;
  total: number;
  lang: string;
};

type AudioMode = 'surah' | 'ayah';
type AudioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'complete' | 'error';

type AudioState = {
  surah: number;
  ayah: number;
  total: number;
  mode: AudioMode;
  status: AudioStatus;
};

const QURAN_CDN = 'https://cdn.jsdelivr.net/gh/RochTools/quran-api@main/Quran/';
const QURAN_FALLBACK = 'https://raw.githubusercontent.com/RochTools/quran-api/main/Quran/';
const TAFSIR_CDN = 'https://cdn.jsdelivr.net/gh/RochTools/quran-tafsir-api@main/tafsir/';
const TAFSIR_FALLBACK = 'https://raw.githubusercontent.com/RochTools/quran-tafsir-api/main/tafsir/';
const AUDIO_BASE = 'https://everyayah.com/data/Alafasy_128kbps/';

const LANGUAGE_KEY = 'steptudeen_app_quran_language';
const TAFSIR_KEY = 'steptudeen_app_quran_tafsir';
const LAST_SEEN_KEY = 'steptudeen_app_quran_last_seen';
const SEARCH_TARGET_KEY = 'steptudeen_app_quran_search_target';
const OFFLINE_DONE_KEY = 'steptudeen_app_quran_offline_done'; // value = language code that is fully downloaded
const SURAH_TOTAL = 114;

const QURAN_LANGUAGES: QuranLanguage[] = [
  { code: 'ur', native: 'اردو', english: 'Urdu', dir: 'rtl' },
  { code: 'en', native: 'English', english: 'English', dir: 'ltr' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali', dir: 'ltr' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi', dir: 'ltr' },
  { code: 'es', native: 'Español', english: 'Spanish', dir: 'ltr' },
  { code: 'fr', native: 'Français', english: 'French', dir: 'ltr' },
  { code: 'id', native: 'Bahasa Indonesia', english: 'Indonesian', dir: 'ltr' },
  { code: 'ru', native: 'Русский', english: 'Russian', dir: 'ltr' },
  { code: 'sv', native: 'Svenska', english: 'Swedish', dir: 'ltr' },
  { code: 'tr', native: 'Türkçe', english: 'Turkish', dir: 'ltr' },
  { code: 'zh', native: '中文', english: 'Chinese', dir: 'ltr' },
];

const TAFSIR_EDITIONS: TafsirEdition[] = [
  { slug: 'ahsanul-bayan-bn', name: 'Ahsanul Bayan', language: 'Bengali', author: 'Hafiz Salahuddin Yusuf' },
  { slug: 'ibn-kathir-ar', name: 'Tafsir Ibn Kathir', language: 'Arabic', author: 'Ibn Kathir' },
  { slug: 'ibn-kathir-bn', name: 'Tafsir Ibn Kathir', language: 'Bengali', author: 'Ibn Kathir' },
  { slug: 'ibn-kathir-en', name: 'Tafsir Ibn Kathir', language: 'English', author: 'Ibn Kathir' },
  { slug: 'ibn-kathir-ru', name: 'Tafsir Ibn Kathir', language: 'Russian', author: 'Ibn Kathir' },
  { slug: 'ibn-kathir-ur', name: 'Tafsir Ibn Kathir', language: 'Urdu', author: 'Ibn Kathir' },
  { slug: 'mukhtasar-en', name: 'Al-Mukhtasar', language: 'English', author: 'Tafsir Center for Quranic Studies' },
  { slug: 'mukhtasar-hi', name: 'Al-Mukhtasar', language: 'Hindi', author: 'Tafsir Center for Quranic Studies' },
  { slug: 'mukhtasar-id', name: 'Al-Mukhtasar', language: 'Indonesian', author: 'Tafsir Center for Quranic Studies' },
  { slug: 'mukhtasar-ru', name: 'Al-Mukhtasar', language: 'Russian', author: 'Tafsir Center for Quranic Studies' },
  { slug: 'mukhtasar-tr', name: 'Al-Mukhtasar', language: 'Turkish', author: 'Tafsir Center for Quranic Studies' },
  { slug: 'saadi-id', name: 'Tafsir As-Saadi', language: 'Indonesian', author: 'Abd al-Rahman al-Saadi' },
  { slug: 'saadi-tr', name: 'Tafsir As-Saadi', language: 'Turkish', author: 'Abd al-Rahman al-Saadi' },
  { slug: 'saadi-ur', name: 'Tafsir As-Saadi', language: 'Urdu', author: 'Abd al-Rahman al-Saadi' },
];

const PREFERRED_TAFSIR: Record<string, string> = {
  ur: 'ibn-kathir-ur',
  en: 'ibn-kathir-en',
  bn: 'ibn-kathir-bn',
  hi: 'mukhtasar-hi',
  id: 'saadi-id',
  ru: 'ibn-kathir-ru',
  tr: 'saadi-tr',
};

const ENGLISH_NAMES = [
  'Al-Fatihah','Al-Baqarah','Aal-Imran','An-Nisa',"Al-Ma'idah","Al-An'am","Al-A'raf",'Al-Anfal','At-Tawbah','Yunus','Hud','Yusuf',"Ar-Ra'd",'Ibrahim','Al-Hijr','An-Nahl','Al-Isra','Al-Kahf','Maryam','Ta-Ha','Al-Anbiya','Al-Hajj',"Al-Mu'minun",'An-Nur','Al-Furqan',"Ash-Shu'ara",'An-Naml','Al-Qasas','Al-Ankabut','Ar-Rum','Luqman','As-Sajdah','Al-Ahzab','Saba','Fatir','Ya-Sin','As-Saffat','Sad','Az-Zumar','Ghafir','Fussilat','Ash-Shura','Az-Zukhruf','Ad-Dukhan','Al-Jathiyah','Al-Ahqaf','Muhammad','Al-Fath','Al-Hujurat','Qaf','Adh-Dhariyat','At-Tur','An-Najm','Al-Qamar','Ar-Rahman',"Al-Waqi'ah",'Al-Hadid','Al-Mujadila','Al-Hashr','Al-Mumtahanah','As-Saff',"Al-Jumu'ah",'Al-Munafiqun','At-Taghabun','At-Talaq','At-Tahrim','Al-Mulk','Al-Qalam','Al-Haqqah',"Al-Ma'arij",'Nuh','Al-Jinn','Al-Muzzammil','Al-Muddaththir','Al-Qiyamah','Al-Insan','Al-Mursalat','An-Naba',"An-Nazi'at",'Abasa','At-Takwir','Al-Infitar','Al-Mutaffifin','Al-Inshiqaq','Al-Buruj','At-Tariq',"Al-A'la",'Al-Ghashiyah','Al-Fajr','Al-Balad','Ash-Shams','Al-Layl','Ad-Duha','Ash-Sharh','At-Tin','Al-Alaq','Al-Qadr','Al-Bayyinah','Az-Zalzalah','Al-Adiyat',"Al-Qari'ah",'At-Takathur','Al-Asr','Al-Humazah','Al-Fil','Quraysh',"Al-Ma'un",'Al-Kawthar','Al-Kafirun','An-Nasr','Al-Masad','Al-Ikhlas','Al-Falaq','An-Nas'
];

const ARABIC_NAMES = [
  'الفاتحة','البقرة','آل عمران','النساء','المائدة','الأنعام','الأعراف','الأنفال','التوبة','يونس','هود','يوسف','الرعد','إبراهيم','الحجر','النحل','الإسراء','الكهف','مريم','طه','الأنبياء','الحج','المؤمنون','النور','الفرقان','الشعراء','النمل','القصص','العنكبوت','الروم','لقمان','السجدة','الأحزاب','سبأ','فاطر','يس','الصافات','ص','الزمر','غافر','فصلت','الشورى','الزخرف','الدخان','الجاثية','الأحقاف','محمد','الفتح','الحجرات','ق','الذاريات','الطور','النجم','القمر','الرحمن','الواقعة','الحديد','المجادلة','الحشر','الممتحنة','الصف','الجمعة','المنافقون','التغابن','الطلاق','التحريم','الملك','القلم','الحاقة','المعارج','نوح','الجن','المزمل','المدثر','القيامة','الإنسان','المرسلات','النبأ','النازعات','عبس','التكوير','الإنفطار','المطففين','الإنشقاق','البروج','الطارق','الأعلى','الغاشية','الفجر','البلد','الشمس','الليل','الضحى','الشرح','التين','العلق','القدر','البينة','الزلزلة','العاديات','القارعة','التكاثر','العصر','الهمزة','الفيل','قريش','الماعون','الكوثر','الكافرون','النصر','المسد','الإخلاص','الفلق','الناس'
];

const URDU_NAMES = [
  'الفاتحہ','البقرہ','آل عمران','النساء','المائدہ','الانعام','الاعراف','الانفال','التوبہ','یونس','ہود','یوسف','الرعد','ابراہیم','الحجر','النحل','الاسراء','الکہف','مریم','طہ','الانبیاء','الحج','المومنون','النور','الفرقان','الشعراء','النمل','القصص','العنکبوت','الروم','لقمان','السجدہ','الاحزاب','سبا','فاطر','یٰسین','الصافات','ص','الزمر','غافر','فصلت','الشوریٰ','الزخرف','الدخان','الجاثیہ','الاحقاف','محمد','الفتح','الحجرات','ق','الذاریات','الطور','النجم','القمر','الرحمٰن','الواقعہ','الحدید','المجادلہ','الحشر','الممتحنہ','الصف','الجمعہ','المنافقون','التغابن','الطلاق','التحریم','الملک','القلم','الحاقہ','المعارج','نوح','الجن','المزمل','المدثر','القیامہ','الانسان','المرسلات','النبا','النازعات','عبس','التکویر','الانفطار','المطففین','الانشقاق','البروج','الطارق','الاعلیٰ','الغاشیہ','الفجر','البلد','الشمس','اللیل','الضحیٰ','الشرح','التین','العلق','القدر','البینہ','الزلزلہ','العادیات','القارعہ','التکاثر','العصر','الہمزہ','الفیل','قریش','الماعون','الکوثر','الکافرون','النصر','المسد','الاخلاص','الفلق','الناس'
];

const AYAH_COUNTS = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

const SURAHS: SurahMeta[] = ARABIC_NAMES.map((ar, i) => ({
  n: i + 1,
  ar,
  en: ENGLISH_NAMES[i],
  ur: URDU_NAMES[i],
  ayahs: AYAH_COUNTS[i],
}));

const surahCache = new Map<string, SurahPayload>();
const tafsirCache = new Map<string, TafsirPayload>();

async function fetchJson<T>(primary: string, fallback: string, signal?: AbortSignal): Promise<T> {
  const request = async (url: string) => {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<T>;
  };
  try {
    return await request(primary);
  } catch (error) {
    if (signal?.aborted) throw error;
    return request(fallback);
  }
}

// Fallback when no service worker is available: the app downloads every surah itself.
// The browser HTTP cache keeps them, and surahCache serves them in this session.
async function downloadAllSurahsDirect(
  lang: string,
  onProgress: (done: number) => void,
  signal: AbortSignal
): Promise<boolean> {
  let done = 0;
  let failed = 0;
  const batch = 6;
  for (let i = 1; i <= SURAH_TOTAL; i += batch) {
    const nums = Array.from({ length: Math.min(batch, SURAH_TOTAL - i + 1) }, (_, k) => i + k);
    await Promise.all(nums.map(async (n) => {
      const key = `${lang}_${n}`;
      try {
        if (!surahCache.has(key)) {
          const data = await fetchJson<SurahPayload>(`${QURAN_CDN}${lang}/${n}.json`, `${QURAN_FALLBACK}${lang}/${n}.json`, signal);
          surahCache.set(key, data);
        }
      } catch {
        failed++;
      } finally {
        done++;
        onProgress(done);
      }
    }));
    if (signal.aborted) return false;
  }
  return failed === 0;
}

function pad3(value: number) {
  return String(value).padStart(3, '0');
}

function disposeAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  // Removing src can emit an error event in some mobile browsers. Detach every
  // handler first so an old track cannot mark the new, already-playing track as failed.
  audio.onplay = null;
  audio.onpause = null;
  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
}

function readLastSeen(): LastSeen | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(localStorage.getItem(LAST_SEEN_KEY) || 'null');
    return value?.surah && value?.ayah ? value : null;
  } catch {
    return null;
  }
}

function splitTafsirIntoPages(blocks: TafsirBlock[]) {
  const expanded: TafsirBlock[] = [];
  const maxPartChars = 16000;

  for (const block of blocks) {
    let remaining = block.text || '';
    if (!remaining) {
      expanded.push(block);
      continue;
    }
    while (remaining.length > maxPartChars) {
      let cut = remaining.lastIndexOf('\n\n', maxPartChars);
      if (cut < maxPartChars * 0.55) cut = remaining.lastIndexOf(' ', maxPartChars);
      if (cut < maxPartChars * 0.55) cut = maxPartChars;
      expanded.push({ ...block, text: remaining.slice(0, cut) });
      remaining = remaining.slice(cut).trimStart();
    }
    if (remaining) expanded.push({ ...block, text: remaining });
  }

  const pages: TafsirBlock[][] = [];
  let page: TafsirBlock[] = [];
  let chars = 0;
  for (const block of expanded) {
    const length = block.text?.length || 0;
    if (page.length && (page.length >= 5 || chars + length > 24000)) {
      pages.push(page);
      page = [];
      chars = 0;
    }
    page.push(block);
    chars += length;
  }
  if (page.length) pages.push(page);
  return pages;
}

const BrandLoader = ({ label = 'Loading surah' }: { label?: string }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
    <div className="quran-brand-loader flex font-serif text-2xl font-bold tracking-wider" dir="ltr">
      {'steptudeen'.split('').map((letter, index) => (
        <span key={index} style={{ animationDelay: `${index * 0.08}s` }}>{letter}</span>
      ))}
    </div>
    <div className="text-xs text-slate-500">{label}...</div>
  </div>
);

export const QuranView: React.FC<QuranViewProps> = () => {
  const [search, setSearch] = useState('');
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [picker, setPicker] = useState<'quran' | 'tafsir' | null>(null);

  const [language, setLanguage] = useState(() => {
    if (typeof window === 'undefined') return 'ur';
    return localStorage.getItem(LANGUAGE_KEY) || 'ur';
  });
  const [tafsirSlug, setTafsirSlug] = useState(() => {
    if (typeof window === 'undefined') return 'ibn-kathir-ur';
    return localStorage.getItem(TAFSIR_KEY) || 'ibn-kathir-ur';
  });
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(LANGUAGE_KEY);
  });
  // In the welcome popup the user first highlights a language, then presses Continue.
  const [pendingLanguage, setPendingLanguage] = useState('ur');
  const [offline, setOffline] = useState<OfflineState>({ status: 'idle', done: 0, total: SURAH_TOTAL, lang: '' });
  // Which language is fully saved offline right now (persists across app restarts).
  const [offlineDoneLang, setOfflineDoneLang] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(OFFLINE_DONE_KEY);
  });
  const [offlineOpen, setOfflineOpen] = useState(false); // progress popup visible?
  const offlineAbortRef = useRef<AbortController | null>(null);

  const [surahData, setSurahData] = useState<SurahPayload | null>(null);
  const [surahLoading, setSurahLoading] = useState(false);
  const [surahError, setSurahError] = useState('');
  const [retryToken, setRetryToken] = useState(0);

  const [tafsirOpen, setTafsirOpen] = useState(false);
  const [tafsirPages, setTafsirPages] = useState<TafsirBlock[][]>([]);
  const [tafsirPage, setTafsirPage] = useState(0);
  const [tafsirLoading, setTafsirLoading] = useState(false);
  const [tafsirError, setTafsirError] = useState('');

  const [audioChoiceAyah, setAudioChoiceAyah] = useState<number | null>(null);
  const [audioState, setAudioState] = useState<AudioState | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioStateRef = useRef<AudioState | null>(null);

  const [lastSeen, setLastSeen] = useState<LastSeen | null>(() => readLastSeen());
  const [toast, setToast] = useState('');
  const pendingAyahTarget = useRef<{ surah: number; ayah: number } | null>(null);
  const readerScrollRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const currentLanguage = QURAN_LANGUAGES.find((item) => item.code === language) || QURAN_LANGUAGES[0];
  const currentTafsir = TAFSIR_EDITIONS.find((item) => item.slug === tafsirSlug) || TAFSIR_EDITIONS[5];
  const selectedMeta = selectedSurah ? SURAHS[selectedSurah - 1] : null;

  const filteredSurahs = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return SURAHS;
    return SURAHS.filter((surah) =>
      String(surah.n).includes(value) ||
      surah.ar.includes(search.trim()) ||
      surah.ur.includes(search.trim()) ||
      surah.en.toLowerCase().includes(value)
    );
  }, [search]);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  useEffect(() => {
    // HomeView stores the requested Surah/Ayah immediately before navigating here.
    // Consume it once, open the Surah, then let the existing scroll/highlight effect run.
    try {
      const raw = localStorage.getItem(SEARCH_TARGET_KEY);
      localStorage.removeItem(SEARCH_TARGET_KEY);
      if (!raw) return;
      const target = JSON.parse(raw) as { surah?: number; ayah?: number };
      const surah = Number(target.surah);
      const ayah = Number(target.ayah);
      if (!Number.isInteger(surah) || surah < 1 || surah > 114) return;
      if (Number.isInteger(ayah) && ayah > 0) pendingAyahTarget.current = { surah, ayah };
      setSelectedSurah(surah);
    } catch {
      localStorage.removeItem(SEARCH_TARGET_KEY);
    }
  }, []);

  useEffect(() => {
    if (!selectedSurah) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    return () => {
      document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      window.scrollTo(0, scrollY);
      requestAnimationFrame(() => document.documentElement.style.removeProperty('scroll-behavior'));
    };
  }, [selectedSurah]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data.type !== 'string' || !data.type.startsWith('QURAN_PRECACHE_')) return;
      if (data.type === 'QURAN_PRECACHE_PROGRESS') {
        setOffline((prev) => ({ ...prev, status: 'downloading', done: data.done, total: data.total || SURAH_TOTAL, lang: data.lang }));
      } else if (data.type === 'QURAN_PRECACHE_DONE') {
        localStorage.setItem(OFFLINE_DONE_KEY, data.lang);
        setOfflineDoneLang(data.lang);
        setOffline({ status: 'done', done: data.total || SURAH_TOTAL, total: data.total || SURAH_TOTAL, lang: data.lang });
      } else if (data.type === 'QURAN_PRECACHE_ERROR') {
        setOffline((prev) => ({ ...prev, status: 'error', lang: data.lang }));
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    return () => offlineAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!selectedSurah) return;
    const controller = new AbortController();
    const key = `${language}_${selectedSurah}`;
    setSurahError('');
    setTafsirOpen(false);
    setTafsirPages([]);
    setTafsirError('');

    const cached = surahCache.get(key);
    if (cached) {
      setSurahData(cached);
      setSurahLoading(false);
      return () => controller.abort();
    }

    setSurahData(null);
    setSurahLoading(true);
    fetchJson<SurahPayload>(
      `${QURAN_CDN}${language}/${selectedSurah}.json`,
      `${QURAN_FALLBACK}${language}/${selectedSurah}.json`,
      controller.signal
    )
      .then((data) => {
        surahCache.set(key, data);
        setSurahData(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setSurahError(error instanceof Error ? error.message : 'Could not load this surah.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setSurahLoading(false);
      });

    return () => controller.abort();
  }, [selectedSurah, language, retryToken]);

  useEffect(() => {
    if (!surahData || !pendingAyahTarget.current || !selectedSurah) return;
    const pending = pendingAyahTarget.current;
    if (pending.surah !== selectedSurah) return;
    pendingAyahTarget.current = null;
    const timer = window.setTimeout(() => {
      const target = document.getElementById(`app-ayah-${pending.surah}-${pending.ayah}`);
      const scroller = readerScrollRef.current;
      if (!target || !scroller) return;
      const top = target.offsetTop - Math.max(20, (scroller.clientHeight - target.offsetHeight) / 2);
      scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      window.setTimeout(() => {
        target.classList.add('quran-last-seen-highlight');
        window.setTimeout(() => target.classList.remove('quran-last-seen-highlight'), 1700);
      }, 450);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [surahData, selectedSurah]);

  useEffect(() => {
    if (!audioState || audioState.status !== 'playing' || audioState.surah !== selectedSurah) return;
    const target = document.getElementById(`app-ayah-${audioState.surah}-${audioState.ayah}`);
    const scroller = readerScrollRef.current;
    if (!target || !scroller) return;
    const targetRect = target.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    if (targetRect.top < scrollerRect.top || targetRect.bottom > scrollerRect.bottom) {
      const top = target.offsetTop - Math.max(20, (scroller.clientHeight - target.offsetHeight) / 2);
      scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }, [audioState, selectedSurah]);

  useEffect(() => {
    return () => {
      disposeAudio(audioRef.current);
      audioRef.current = null;
    };
  }, []);

  const startOfflineDownload = async (code: string) => {
    setOffline({ status: 'downloading', done: 0, total: SURAH_TOTAL, lang: code });
    setOfflineOpen(true);

    // Preferred path: ask the service worker (survives the popup being closed).
    if ('serviceWorker' in navigator) {
      try {
        const reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 4000)),
        ]);
        const worker = reg?.active || navigator.serviceWorker.controller;
        if (worker) {
          worker.postMessage({ type: 'PRECACHE_QURAN', lang: code });
          return;
        }
      } catch {
        /* fall through to direct download */
      }
    }

    // Fallback path: no service worker, download directly from the app.
    offlineAbortRef.current?.abort();
    const controller = new AbortController();
    offlineAbortRef.current = controller;
    const ok = await downloadAllSurahsDirect(
      code,
      (done) => setOffline((prev) => ({ ...prev, status: 'downloading', done })),
      controller.signal
    );
    if (controller.signal.aborted) return;
    if (ok) {
      localStorage.setItem(OFFLINE_DONE_KEY, code);
      setOfflineDoneLang(code);
      setOffline({ status: 'done', done: SURAH_TOTAL, total: SURAH_TOTAL, lang: code });
    } else {
      setOffline((prev) => ({ ...prev, status: 'error' }));
    }
  };

  const continueWelcome = () => {
    const code = pendingLanguage;
    chooseQuranLanguage(code);
    startOfflineDownload(code);
  };

  const skipWelcome = () => {
    localStorage.setItem(LANGUAGE_KEY, language);
    setShowWelcome(false);
  };

  const chooseQuranLanguage = (code: string) => {
    setLanguage(code);
    localStorage.setItem(LANGUAGE_KEY, code);
    const preferred = PREFERRED_TAFSIR[code];
    if (preferred) {
      setTafsirSlug(preferred);
      localStorage.setItem(TAFSIR_KEY, preferred);
    }
    setPicker(null);
    setShowWelcome(false);
  };

  const chooseTafsir = (slug: string) => {
    setTafsirSlug(slug);
    localStorage.setItem(TAFSIR_KEY, slug);
    setPicker(null);
    setTafsirOpen(false);
    setTafsirPages([]);
  };

  const closeReader = () => {
    disposeAudio(audioRef.current);
    audioRef.current = null;
    audioStateRef.current = null;
    setAudioState(null);
    setSelectedSurah(null);
    setSurahData(null);
  };

  const loadTafsir = async () => {
    if (!selectedSurah) return;
    if (tafsirOpen) {
      setTafsirOpen(false);
      return;
    }
    setTafsirOpen(true);
    setTafsirError('');
    const key = `${tafsirSlug}_${selectedSurah}`;
    const cached = tafsirCache.get(key);
    if (cached) {
      setTafsirPages(splitTafsirIntoPages(cached.blocks || []));
      setTafsirPage(0);
      return;
    }
    setTafsirLoading(true);
    try {
      const data = await fetchJson<TafsirPayload>(
        `${TAFSIR_CDN}${tafsirSlug}/${selectedSurah}.json`,
        `${TAFSIR_FALLBACK}${tafsirSlug}/${selectedSurah}.json`
      );
      tafsirCache.set(key, data);
      setTafsirPages(splitTafsirIntoPages(data.blocks || []));
      setTafsirPage(0);
      if (!data.blocks?.length) setTafsirError('No tafsir was returned for this surah.');
    } catch (error) {
      setTafsirError(error instanceof Error ? error.message : 'Could not load tafsir.');
    } finally {
      setTafsirLoading(false);
    }
  };

  const saveLastSeen = (ayah: number) => {
    if (!selectedMeta) return;
    const value: LastSeen = {
      surah: selectedMeta.n,
      ayah,
      surahName: selectedMeta.en,
      savedAt: Date.now(),
    };
    localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(value));
    setLastSeen(value);
    setToast('Your last seen ayah has been saved in the three-dot menu.');
  };

  const openLastSeen = () => {
    setMenuOpen(false);
    if (!lastSeen) {
      setToast('No last seen ayah has been saved yet.');
      return;
    }
    pendingAyahTarget.current = lastSeen;
    setSelectedSurah(lastSeen.surah);
  };

  const updateAudio = (value: AudioState) => {
    audioStateRef.current = value;
    setAudioState(value);
  };

  const playTrack = (state: AudioState) => {
    disposeAudio(audioRef.current);
    audioRef.current = null;

    const audio = new Audio(`${AUDIO_BASE}${pad3(state.surah)}${pad3(state.ayah)}.mp3`);
    audio.preload = 'auto';
    audioRef.current = audio;
    updateAudio({ ...state, status: 'loading' });

    audio.onplay = () => {
      if (audioRef.current !== audio || !audioStateRef.current) return;
      updateAudio({ ...audioStateRef.current, status: 'playing' });
    };
    audio.onpause = () => {
      if (audioRef.current !== audio || audio.ended || !audioStateRef.current) return;
      updateAudio({ ...audioStateRef.current, status: 'paused' });
    };
    audio.onended = () => {
      if (audioRef.current !== audio) return;
      const current = audioStateRef.current;
      if (!current) return;
      if (current.mode === 'surah' && current.ayah < current.total) {
        playTrack({ ...current, ayah: current.ayah + 1, status: 'loading' });
      } else {
        updateAudio({ ...current, status: 'complete' });
      }
    };
    audio.onerror = () => {
      // Ignore stale errors fired by a track that has already been replaced.
      if (audioRef.current !== audio || !audioStateRef.current) return;
      updateAudio({ ...audioStateRef.current, status: 'error' });
    };

    audio.play().catch(() => {
      if (audioRef.current === audio) updateAudio({ ...state, status: 'paused' });
    });
  };

  const startAudio = (mode: AudioMode) => {
    if (!selectedSurah || !surahData?.verses?.length || audioChoiceAyah == null) return;
    const ayah = mode === 'surah' ? 1 : audioChoiceAyah;
    playTrack({
      surah: selectedSurah,
      ayah,
      total: mode === 'surah' ? surahData.verses.length : ayah,
      mode,
      status: 'loading',
    });
    setAudioChoiceAyah(null);
  };

  const toggleAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => undefined);
    else audio.pause();
  };

  const stopAudio = () => {
    disposeAudio(audioRef.current);
    audioRef.current = null;
    audioStateRef.current = null;
    setAudioState(null);
  };

  const verses = surahData?.verses || [];
  const currentTafsirPage = tafsirPages[tafsirPage] || [];

  return (
    <div dir="ltr" className="mx-auto w-full max-w-[900px] bg-white p-2 text-left text-slate-900">
      <style>{`
        @font-face{font-family:'KFGQPC Hafs';src:url('https://cdn.jsdelivr.net/gh/mustafa0x/qpc-fonts@f93bf5f3/various-woff2/UthmanicHafs1%20Ver09.woff2') format('woff2');font-display:swap}
        .quran-hafs{font-family:'KFGQPC Hafs','Noto Naskh Arabic',serif;font-weight:700;color:#111;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}
        .quran-brand-loader span{animation:quran-bounce 1.1s ease-in-out infinite;background:linear-gradient(180deg,#b8860b,#14532d);-webkit-background-clip:text;background-clip:text;color:transparent}
        @keyframes quran-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-10px)}}
        .quran-last-seen-highlight{background:rgba(224,178,58,.22)!important;box-shadow:0 0 0 3px rgba(184,134,11,.55),0 0 22px rgba(20,83,45,.25)!important;border-radius:12px}
      `}</style>

      {/* Search with Blogger-style three-dot menu */}
      <div className="relative mb-4" ref={menuRef}>
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by surah name or number..."
          className="w-full rounded-xl border border-[#d8e4da] bg-white py-3 pl-10 pr-14 text-sm outline-none transition focus:border-[#14532d]"
        />
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[#14532d] text-white"
          aria-label="Quran settings"
        >
          <MoreVertical size={17} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-[calc(100%+6px)] z-40 w-[min(320px,92vw)] overflow-hidden rounded-xl border border-[#d8e4da] bg-white shadow-2xl">
            <button onClick={openLastSeen} className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-[#f0f7f1]">
              <Bookmark size={17} className="mt-0.5 text-[#14532d]" />
              <span><strong className="block text-sm">Last Seen</strong><small className="block text-[11px] text-slate-500">{lastSeen ? `${lastSeen.surahName} - Ayah ${lastSeen.ayah}` : 'No ayah saved yet'}</small></span>
            </button>
            <button onClick={() => { setPicker('quran'); setMenuOpen(false); }} className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-[#f0f7f1]">
              <Languages size={17} className="mt-0.5 text-[#14532d]" />
              <span><strong className="block text-sm">Select Quran language</strong><small className="block text-[11px] text-slate-500">{currentLanguage.native}</small></span>
            </button>
            <button onClick={() => { setPicker('tafsir'); setMenuOpen(false); }} className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-[#f0f7f1]">
              <BookOpen size={17} className="mt-0.5 text-[#14532d]" />
              <span><strong className="block text-sm">Select Tafsir</strong><small className="block text-[11px] text-slate-500">{currentTafsir.name} - {currentTafsir.language}</small></span>
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                if (offlineDoneLang === language) return;
                if (offline.status === 'downloading') { setOfflineOpen(true); return; }
                startOfflineDownload(language);
              }}
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[#f0f7f1]"
            >
              {offlineDoneLang === language ? <CheckCircle2 size={17} className="mt-0.5 text-[#14532d]" /> : <Download size={17} className="mt-0.5 text-[#14532d]" />}
              <span>
                <strong className="block text-sm">Download for offline</strong>
                <small className="block text-[11px] text-slate-500">
                  {offlineDoneLang === language
                    ? `${currentLanguage.native} is saved offline`
                    : offline.status === 'downloading' && offline.lang === language
                    ? `Downloading... ${offline.done}/${offline.total}`
                    : `${currentLanguage.native} is not downloaded yet`}
                </small>
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Background download pill (popup closed but download still running) */}
      {!offlineOpen && offline.status === 'downloading' && (
        <button onClick={() => setOfflineOpen(true)} className="mb-3 flex w-full items-center justify-between gap-2 rounded-xl border border-[#d8e4da] bg-[#f0f7f1] px-3 py-2 text-left text-[11px] font-bold text-[#14532d]">
          <span className="flex items-center gap-2"><Download size={14} className="animate-pulse" /> Saving Quran offline... {Math.round((offline.done / offline.total) * 100)}%</span>
          <ChevronRight size={13} />
        </button>
      )}

      {/* Surah cards */}
      {filteredSurahs.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filteredSurahs.map((surah) => (
            <button
              key={surah.n}
              type="button"
              onClick={() => setSelectedSurah(surah.n)}
              className="rounded-lg bg-white px-3 py-4 text-center shadow-[0_3px_10px_rgba(0,0,0,.12)] transition active:scale-[.97]"
            >
              <span className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#f0f7f1] text-xs font-bold text-[#14532d]">{surah.n}</span>
              <div className="quran-hafs text-[23px] leading-relaxed" dir="rtl">{surah.ar}</div>
              <div className="text-[13px] font-semibold text-[#14532d]">{surah.en}</div>
              <div className="mt-1 text-[11px] text-slate-500">{surah.ayahs} verses</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-slate-500">No surahs match your search.</div>
      )}

      {/* Surah reader bottom sheet */}
      {selectedSurah && selectedMeta && (
        <div dir="ltr" className="fixed inset-0 z-50 flex items-end justify-center bg-black/55" onMouseDown={(event) => { if (event.target === event.currentTarget) closeReader(); }}>
          <div dir="ltr" className="flex max-h-[88vh] w-full max-w-[700px] flex-col overflow-hidden rounded-t-[18px] bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#d8e4da] px-4 py-3">
              <h3 dir="ltr" className="truncate text-sm font-bold text-[#14532d]">Surah {selectedMeta.en} <span dir="rtl">({selectedMeta.ar})</span></h3>
              <button onClick={closeReader} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100" aria-label="Close"><X size={17} /></button>
            </div>

            <div ref={readerScrollRef} className="overflow-y-auto overscroll-contain p-4">
              {surahLoading && <BrandLoader />}

              {surahError && (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <AlertTriangle className="text-rose-600" size={30} />
                  <p className="max-w-sm text-sm text-slate-500">Could not load this surah. Please check your connection.</p>
                  <button onClick={() => setRetryToken((value) => value + 1)} className="flex items-center gap-2 rounded-full bg-[#14532d] px-4 py-2 text-xs font-bold text-white"><RefreshCw size={14} /> Retry Surah</button>
                </div>
              )}

              {surahData && (
                <>
                  <div className="mb-4 border-b-2 border-[#f0f7f1] pb-4 text-center">
                    <div className="quran-hafs text-[32px]" dir="rtl">{surahData.name || selectedMeta.ar}</div>
                    <div className="mt-1 text-sm font-semibold text-[#14532d]">{selectedMeta.en}</div>
                    <div className="mt-1 text-xs text-slate-500">{String(surahData.type || '').toLowerCase() === 'meccan' ? 'Meccan' : 'Medinan'} surah | {verses.length} verses</div>
                    {selectedSurah !== 1 && selectedSurah !== 9 && <div className="quran-hafs mt-4 border-t border-dashed border-[#d8e4da] pt-4 text-[29px]" dir="rtl">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>}
                    <button onClick={loadTafsir} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-[#d8e4da] bg-[#f0f7f1] px-4 py-2.5 text-sm font-bold text-[#14532d]"><BookOpen size={16} /> {tafsirOpen ? 'Hide Tafsir' : 'View Full Surah Tafsir'}</button>

                    {tafsirOpen && (
                      <div className="mt-3 max-h-[60vh] overflow-y-auto rounded-lg border-l-[3px] border-[#b8860b] bg-[#faf9f5] p-3 text-left">
                        {tafsirLoading && <BrandLoader label="Loading tafsir" />}
                        {tafsirError && <div className="py-6 text-center text-xs text-rose-600"><p>{tafsirError}</p><button onClick={() => { setTafsirOpen(false); window.setTimeout(loadTafsir, 0); }} className="mt-3 rounded-full bg-[#14532d] px-4 py-2 font-bold text-white">Retry Tafsir</button></div>}
                        {!tafsirLoading && !tafsirError && currentTafsirPage.map((block, index) => (
                          <div key={`${block.from}-${block.to}-${index}`} className="mb-4 border-b border-dashed border-[#d8e4da] pb-4 last:mb-0 last:border-0 last:pb-0">
                            <span className="mb-2 inline-block rounded-full border border-[#b8860b] bg-white px-2.5 py-1 text-[10px] font-bold text-[#b8860b]">{block.from === block.to ? `Ayah ${block.from}` : `Ayahs ${block.from}-${block.to}`}</span>
                            <div className={`whitespace-pre-wrap text-[15px] leading-8 text-slate-800 ${currentTafsir.language === 'Urdu' ? 'text-right font-urdu text-[18px] font-bold' : ''}`} dir={['Urdu','Arabic'].includes(currentTafsir.language) ? 'rtl' : 'ltr'}>{block.text}</div>
                          </div>
                        ))}
                        {tafsirPages.length > 1 && !tafsirLoading && !tafsirError && (
                          <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-[#d8e4da] bg-white p-2">
                            <button disabled={tafsirPage === 0} onClick={() => setTafsirPage((value) => value - 1)} className="rounded-full bg-[#14532d] px-3 py-2 text-[11px] font-bold text-white disabled:opacity-30">Previous</button>
                            <span className="text-[10px] text-slate-500">Section {tafsirPage + 1} of {tafsirPages.length}</span>
                            <button disabled={tafsirPage >= tafsirPages.length - 1} onClick={() => setTafsirPage((value) => value + 1)} className="rounded-full bg-[#14532d] px-3 py-2 text-[11px] font-bold text-white disabled:opacity-30">Next</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    {verses.map((verse, index) => {
                      const ayah = verse.id || index + 1;
                      const saved = lastSeen?.surah === selectedSurah && lastSeen?.ayah === ayah;
                      const isCurrentAudio = audioState?.surah === selectedSurah && audioState?.ayah === ayah;
                      const playing = isCurrentAudio && audioState?.status === 'playing';
                      const loadingAudio = isCurrentAudio && audioState?.status === 'loading';
                      return (
                        <article id={`app-ayah-${selectedSurah}-${ayah}`} key={ayah} className={`border-b border-slate-100 py-4 transition ${playing ? 'rounded-xl bg-[#f0f7f1] px-3' : ''}`}>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <button onClick={() => saveLastSeen(ayah)} className="rounded-full bg-[#f0f7f1] px-2.5 py-1 text-[11px] font-bold text-[#14532d]">Ayah {ayah}</button>
                            <div className="flex items-center gap-2">
                              <button onClick={() => saveLastSeen(ayah)} className={`flex h-8 w-8 items-center justify-center rounded-full border ${saved ? 'border-[#14532d] bg-[#14532d] text-white' : 'border-[#d8e4da] text-slate-500'}`} aria-label="Save last seen"><Bookmark size={14} fill={saved ? 'currentColor' : 'none'} /></button>
                              <button onClick={() => setAudioChoiceAyah(ayah)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold ${playing ? 'border-[#14532d] bg-[#14532d] text-white' : 'border-[#d8e4da] bg-[#f0f7f1] text-[#14532d]'}`}><Volume2 size={14} /> {loadingAudio ? 'Loading' : playing ? 'Playing' : 'Listen'}</button>
                            </div>
                          </div>
                          <div className="quran-hafs mb-2 text-right text-[29px] leading-[2.15]" dir="rtl">{verse.text}</div>
                          {!!verse.translation && <div className={`text-[15px] leading-7 text-slate-800 ${language === 'ur' ? 'text-right font-urdu text-[18px] font-bold leading-9' : ''}`} dir={currentLanguage.dir}>{verse.translation}</div>}
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quran language / tafsir picker */}
      {(picker || showWelcome) && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !showWelcome) setPicker(null); }}>
          <div dir="ltr" className="flex max-h-[84vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-[#14532d]">{picker === 'tafsir' ? 'Select Tafsir' : 'Select Quran language'}</h3>
                {showWelcome && <p className="mt-1 text-[11px] text-slate-500">Which language do you want to read the Quran in?</p>}
              </div>
              {!showWelcome && <button onClick={() => setPicker(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100"><X size={15} /></button>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {(picker === 'tafsir' ? TAFSIR_EDITIONS : QURAN_LANGUAGES).map((item) => {
                const isTafsir = 'slug' in item;
                const active = isTafsir ? item.slug === tafsirSlug : (showWelcome ? item.code === pendingLanguage : item.code === language);
                return (
                  <button
                    key={isTafsir ? item.slug : item.code}
                    onClick={() => isTafsir ? chooseTafsir(item.slug) : (showWelcome ? setPendingLanguage(item.code) : chooseQuranLanguage(item.code))}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left ${active ? 'bg-[#f0f7f1] text-[#14532d]' : 'hover:bg-slate-50'}`}
                  >
                    <span>
                      <strong className="block text-sm" dir="auto">{isTafsir ? item.name : item.native}</strong>
                      <small className="mt-1 block text-[10px] text-slate-500">{isTafsir ? `${item.language} - ${item.author}` : item.english}</small>
                    </span>
                    {active && <Check size={16} />}
                  </button>
                );
              })}
            </div>
            {showWelcome && (
              <div className="shrink-0 border-t border-slate-100 p-3">
                <p className="mb-2 text-center text-[10px] text-slate-500">Continue saves the whole Quran on your device for offline reading.</p>
                <div className="flex gap-2">
                  <button onClick={skipWelcome} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600">Skip for now</button>
                  <button onClick={continueWelcome} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#14532d] py-2.5 text-xs font-bold text-white"><Check size={14} /> Continue</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offline download progress popup */}
      {offlineOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/65 p-4">
          <div dir="ltr" className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl">
            {offline.status === 'done' ? (
              <>
                <CheckCircle2 className="mx-auto mb-3 text-[#14532d]" size={44} />
                <h3 className="text-base font-bold text-[#14532d]">Quran is ready for offline use!</h3>
                <p className="mt-2 text-xs text-slate-500">All 114 surahs are saved on your device.</p>
              </>
            ) : offline.status === 'error' ? (
              <>
                <AlertTriangle className="mx-auto mb-3 text-rose-600" size={40} />
                <h3 className="text-base font-bold text-slate-800">Download interrupted</h3>
                <p className="mt-2 text-xs text-slate-500">Check your internet and try again. Surahs already saved will not be downloaded again.</p>
              </>
            ) : (
              <>
                <Download className="mx-auto mb-3 animate-pulse text-[#14532d]" size={38} />
                <h3 className="text-base font-bold text-[#14532d]">Preparing your Quran for offline use...</h3>
                <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-[#f0f7f1]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((offline.done / offline.total) * 100)}>
                  <div className="h-full rounded-full bg-[#14532d] transition-all duration-300" style={{ width: `${Math.round((offline.done / offline.total) * 100)}%` }} />
                </div>
                <p className="mt-2 text-sm font-bold text-[#14532d]">{Math.round((offline.done / offline.total) * 100)}%</p>
                <p className="mt-1 text-xs text-slate-500">{offline.done} of {offline.total} surahs downloaded</p>
              </>
            )}
            <p className="mt-3 text-[10px] text-slate-400">Saved only on your device. Nothing is sent to any server.</p>
            <div className="mt-4 flex gap-2">
              {offline.status === 'error' && (
                <button onClick={() => startOfflineDownload(offline.lang || language)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#14532d] py-2.5 text-xs font-bold text-white"><RefreshCw size={13} /> Try again</button>
              )}
              <button onClick={() => setOfflineOpen(false)} className={`flex-1 rounded-xl py-2.5 text-xs font-bold ${offline.status === 'done' ? 'bg-[#14532d] text-white' : 'border border-slate-200 text-slate-600'}`}>
                {offline.status === 'done' ? 'Done' : offline.status === 'error' ? 'Close' : 'Continue in background'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audio choice */}
      {audioChoiceAyah != null && selectedMeta && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setAudioChoiceAyah(null); }}>
          <div dir="ltr" className="relative w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl">
            <button onClick={() => setAudioChoiceAyah(null)} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100"><X size={15} /></button>
            <Volume2 className="mx-auto mb-3 mt-2 text-[#14532d]" size={28} />
            <h3 className="text-lg font-bold text-[#14532d]">Choose Recitation</h3>
            <p className="mb-4 mt-1 text-xs text-slate-500">Surah {selectedMeta.en} - Ayah {audioChoiceAyah}</p>
            <button onClick={() => startAudio('surah')} className="mb-2 flex w-full items-center justify-between rounded-xl border border-[#d8e4da] p-3 text-left hover:bg-[#f0f7f1]"><span><strong className="block text-sm">Full Surah Recitation</strong><small className="text-[10px] text-slate-500">Play all ayahs from the beginning</small></span><ChevronRight size={14} /></button>
            <button onClick={() => startAudio('ayah')} className="flex w-full items-center justify-between rounded-xl border border-[#d8e4da] p-3 text-left hover:bg-[#f0f7f1]"><span><strong className="block text-sm">Single Ayah Recitation</strong><small className="text-[10px] text-slate-500">Play Ayah {audioChoiceAyah} only</small></span><ChevronRight size={14} /></button>
          </div>
        </div>
      )}

      {/* Compact audio player */}
      {audioState && (
        <div dir="ltr" className="fixed bottom-3 left-3 right-3 z-[90] mx-auto flex max-w-lg items-center justify-between gap-3 rounded-2xl border border-[#d8e4da] bg-white p-3 shadow-2xl">
          <div className="flex min-w-0 items-center gap-2"><Volume2 className="shrink-0 text-[#14532d]" size={19} /><div className="min-w-0"><strong className="block truncate text-xs">{SURAHS[audioState.surah - 1]?.en} - Ayah {audioState.ayah}</strong><small className="block text-[10px] text-slate-500">{audioState.status === 'loading' ? 'Loading audio...' : audioState.status === 'error' ? 'Audio could not be loaded' : audioState.status === 'complete' ? 'Recitation complete' : audioState.status}</small></div></div>
          <div className="flex shrink-0 gap-2"><button onClick={toggleAudio} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#14532d] text-white">{audioState.status === 'playing' ? <Pause size={15} /> : <Play size={15} />}</button><button onClick={stopAudio} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#14532d] text-white"><Square size={14} /></button></div>
        </div>
      )}

      {/* Last-seen toast */}
      {toast && (
        <div className="fixed right-4 top-4 z-[100] flex w-[min(360px,calc(100vw-32px))] items-center gap-3 rounded-xl border border-[#d8e4da] bg-white p-3 text-xs shadow-2xl">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f0f7f1] text-[#14532d]"><Bookmark size={15} /></span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default QuranView;
