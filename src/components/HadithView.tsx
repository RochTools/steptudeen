import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Heart,
  Check,
  ChevronLeft,
  ChevronRight,
  Languages,
  Minus,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';

type PendingHadithNavigation = {
  bookKey: string;
  chapterKey: string;
  chapterName: string;
  from: number;
  to: number;
  hadithNum: number;
};

interface HadithViewProps {
  onBack: () => void;
  pendingHadithNav?: PendingHadithNavigation | null;
  onPendingHandled?: () => void;
  scrollToHadithNum?: number | null;
  onScrollHandled?: () => void;
}

type Book = {
  key: string;
  name: string;
  total: number;
};

type Language = {
  code: string;
  name: string;
  dir: 'ltr' | 'rtl';
};

type Chapter = {
  key: string;
  name: string;
  from: number;
  to: number;
};

type Hadith = {
  num: number | string;
  arabic: string;
  translation: string;
  grades: Array<{ grade?: string }>;
};

type Screen = 'books' | 'chapters' | 'reader';

const BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions';
const HOME_BOOK_TARGET_KEY = 'steptudeen_app_hadith_book_target';
const LANGUAGE_KEY = 'steptudeen_hadith_language';
const PER_PAGE = 10;
const SAVED_HADITHS_KEY = 'user_saved_hadiths';

type SavedHadith = {
  book: string;
  bookName: string;
  num: number | string;
  chapterKey: string;
  chapterName: string;
  from: number;
  to: number;
  ar: string;
  ur: string;
  translation?: string;
  translationLanguage?: string;
  savedAt: number;
};

function readSavedHadiths(): SavedHadith[] {
  if (typeof window === 'undefined') return [];
  const value: unknown = JSON.parse(localStorage.getItem(SAVED_HADITHS_KEY) || '[]');
  if (!Array.isArray(value) || value.some(item => !item || typeof item.book !== 'string' || !['number', 'string'].includes(typeof item.num))) {
    throw new Error('Invalid saved hadith data');
  }
  return value as SavedHadith[];
}

const BOOKS: Book[] = [
  { key: 'bukhari', name: 'Sahih Bukhari', total: 7563 },
  { key: 'muslim', name: 'Sahih Muslim', total: 3033 },
  { key: 'abudawud', name: 'Sunan Abu Dawud', total: 5274 },
  { key: 'tirmidhi', name: 'Jami at-Tirmidhi', total: 3956 },
  { key: 'nasai', name: 'Sunan an-Nasai', total: 5758 },
  { key: 'ibnmajah', name: 'Sunan Ibn Majah', total: 4341 },
  { key: 'malik', name: 'Muwatta Imam Malik', total: 1857 },
];

const LANGUAGES: Language[] = [
  { code: 'ara', name: 'Arabic', dir: 'rtl' },
  { code: 'ben', name: 'Bengali', dir: 'ltr' },
  { code: 'eng', name: 'English', dir: 'ltr' },
  { code: 'fra', name: 'French', dir: 'ltr' },
  { code: 'ind', name: 'Indonesian', dir: 'ltr' },
  { code: 'rus', name: 'Russian', dir: 'ltr' },
  { code: 'tam', name: 'Tamil', dir: 'ltr' },
  { code: 'tur', name: 'Turkish', dir: 'ltr' },
  { code: 'urd', name: 'Urdu', dir: 'rtl' },
];

const AVAILABLE: Record<string, string[]> = {
  bukhari: ['ara', 'ben', 'eng', 'fra', 'ind', 'rus', 'tam', 'tur', 'urd'],
  muslim: ['ara', 'ben', 'eng', 'fra', 'ind', 'rus', 'tam', 'tur', 'urd'],
  abudawud: ['ara', 'ben', 'eng', 'fra', 'ind', 'rus', 'tur', 'urd'],
  tirmidhi: ['ara', 'ben', 'eng', 'ind', 'tur', 'urd'],
  nasai: ['ara', 'ben', 'eng', 'fra', 'ind', 'tur', 'urd'],
  ibnmajah: ['ara', 'ben', 'eng', 'fra', 'ind', 'tur', 'urd'],
  malik: ['ara', 'ben', 'eng', 'fra', 'ind', 'tur', 'urd'],
};

const chapterCache = new Map<string, Record<string, any>>();
const readerCache = new Map<string, [any, any]>();

function bookByKey(key: string | null | undefined) {
  return BOOKS.find((book) => book.key === key) || null;
}

function languageByCode(code: string) {
  return LANGUAGES.find((language) => language.code === code) || LANGUAGES[8];
}

function isLanguageAvailable(bookKey: string, language: string) {
  return (AVAILABLE[bookKey] || []).includes(language);
}

async function requestJson(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function requestEdition(path: string, signal?: AbortSignal) {
  try {
    return await requestJson(`${BASE}/${path}.min.json`, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
    return requestJson(`${BASE}/${path}.json`, signal);
  }
}

function gradeInfo(grades: Array<{ grade?: string }>) {
  if (!grades?.length) return null;
  const original = String(grades[0]?.grade || '');
  const grade = original.toLowerCase();
  if (grade.includes('sahih') || grade.includes('صحيح')) return { className: 'bg-blue-100 text-black', label: 'Sahih' };
  if (grade.includes('hasan') || grade.includes('حسن')) return { className: 'bg-blue-100 text-black', label: 'Hasan' };
  if (grade.includes('daif') || grade.includes("da'if") || grade.includes('weak') || grade.includes('ضعيف')) return { className: 'bg-blue-100 text-black', label: 'Daif' };
  return { className: 'bg-[#75b5ff] text-slate-600', label: original };
}

const BrandLoader = () => (
  <div className="flex flex-col items-center justify-center gap-3 py-14">
    <div className="hadith-brand flex font-serif text-2xl font-bold tracking-wider" dir="ltr">
      {'steptudeen'.split('').map((letter, index) => (
        <span key={index} style={{ animationDelay: `${index * 0.08}s` }}>{letter}</span>
      ))}
    </div>
    <div className="text-xs text-slate-500">Loading...</div>
  </div>
);

export const HadithView: React.FC<HadithViewProps> = ({
  onBack,
  pendingHadithNav = null,
  onPendingHandled,
  scrollToHadithNum = null,
  onScrollHandled,
}) => {
  const [screen, setScreen] = useState<Screen>('books');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [hadiths, setHadiths] = useState<Hadith[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchMessage, setSearchMessage] = useState('');
  const [searchError, setSearchError] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [language, setLanguage] = useState(() => {
    if (typeof window === 'undefined') return 'urd';
    return localStorage.getItem(LANGUAGE_KEY) || 'urd';
  });

  const [savedHadiths, setSavedHadiths] = useState<SavedHadith[]>(() => {
    try { return readSavedHadiths(); } catch { return []; }
  });
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const syncSaved = (event: StorageEvent) => {
      if (event.key === SAVED_HADITHS_KEY || event.key === null) {
        try { setSavedHadiths(readSavedHadiths()); }
        catch { setSaveMessage('Could not read saved hadiths. Please check browser storage.'); }
      }
    };
    window.addEventListener('storage', syncSaved);
    return () => window.removeEventListener('storage', syncSaved);
  }, []);

  useEffect(() => {
    if (!saveMessage) return;
    const timer = window.setTimeout(() => setSaveMessage(''), 4000);
    return () => window.clearTimeout(timer);
  }, [saveMessage]);

  const toggleSaveHadith = (hadith: Hadith) => {
    if (!selectedBook || !selectedChapter) return;
    try {
      // Read the latest list so changes from other views/tabs are retained.
      const current = readSavedHadiths();
      const matches = (item: SavedHadith) => item.book === selectedBook.key && String(item.num) === String(hadith.num);
      const alreadySaved = current.some(matches);
      const updated: SavedHadith[] = alreadySaved
        ? current.filter(item => !matches(item))
        : [...current, {
            book: selectedBook.key,
            bookName: selectedBook.name,
            num: hadith.num,
            chapterKey: selectedChapter.key,
            chapterName: selectedChapter.name,
            from: selectedChapter.from,
            to: selectedChapter.to,
            ar: hadith.arabic,
            // The dashboard's `ur` field must contain Urdu only.
            ur: language === 'urd' ? hadith.translation : '',
            translation: hadith.translation,
            translationLanguage: language,
            savedAt: Date.now(),
          }];
      localStorage.setItem(SAVED_HADITHS_KEY, JSON.stringify(updated));
      setSavedHadiths(updated);
      setSaveMessage(alreadySaved ? 'Hadith removed from saved list.' : 'Hadith saved. Find it in your dashboard.');
    } catch {
      setSaveMessage('Could not update saved hadiths. Browser storage may be full, blocked or unreadable.');
    }
  };

  const pendingScrollRef = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const currentLanguage = languageByCode(language);
  const totalPages = Math.max(1, Math.ceil(hadiths.length / PER_PAGE));
  const visibleHadiths = useMemo(
    () => hadiths.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [hadiths, page]
  );

  const chooseSupportedLanguage = (book: Book, requested: string) => {
    if (isLanguageAvailable(book.key, requested)) return requested;
    return isLanguageAvailable(book.key, 'eng') ? 'eng' : 'urd';
  };

  const openBook = (book: Book) => {
    const nextLanguage = chooseSupportedLanguage(book, language);
    if (nextLanguage !== language) {
      setLanguage(nextLanguage);
      localStorage.setItem(LANGUAGE_KEY, nextLanguage);
    }
    setSelectedBook(book);
    setSelectedChapter(null);
    setChapters([]);
    setHadiths([]);
    setPage(1);
    setSearch('');
    setSearchMessage('');
    setError('');
    setScreen('chapters');
  };

  useEffect(() => {
    try {
      const key = localStorage.getItem(HOME_BOOK_TARGET_KEY);
      localStorage.removeItem(HOME_BOOK_TARGET_KEY);
      const book = bookByKey(key);
      if (book) openBook(book);
    } catch {
      // The normal book grid remains available when storage is blocked.
    }
    // This should run only once when the Hadith view mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pendingHadithNav) return;
    const book = bookByKey(pendingHadithNav.bookKey);
    if (!book) return;
    const nextLanguage = chooseSupportedLanguage(book, language);
    if (nextLanguage !== language) {
      setLanguage(nextLanguage);
      localStorage.setItem(LANGUAGE_KEY, nextLanguage);
    }
    setSelectedBook(book);
    setSelectedChapter({
      key: pendingHadithNav.chapterKey,
      name: pendingHadithNav.chapterName,
      from: pendingHadithNav.from,
      to: pendingHadithNav.to,
    });
    pendingScrollRef.current = pendingHadithNav.hadithNum;
    setPage(1);
    setScreen('reader');
    onPendingHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingHadithNav]);

  useEffect(() => {
    if (!scrollToHadithNum) return;
    pendingScrollRef.current = scrollToHadithNum;
    onScrollHandled?.();
  }, [scrollToHadithNum, onScrollHandled]);

  useEffect(() => {
    if (screen !== 'chapters' || !selectedBook) return;
    const controller = new AbortController();
    const cached = chapterCache.get(selectedBook.key);
    if (cached) {
      const items = Object.keys(cached).map((key, index) => {
        const section = cached[key];
        const name = typeof section === 'string' && section
          ? section
          : section?.english || section?.arabic || section?.urdu || `Chapter ${index + 1}`;
        return {
          key,
          name,
          from: Number(section?.hadithnumber_first || section?.hadith_number_first || 0),
          to: Number(section?.hadithnumber_last || section?.hadith_number_last || 0),
        };
      });
      setChapters(items);
      setLoading(false);
      return () => controller.abort();
    }

    setLoading(true);
    setError('');
    requestEdition(`ara-${selectedBook.key}`, controller.signal)
      .then((data) => {
        const sections = data?.metadata?.sections;
        if (!sections || !Object.keys(sections).length) throw new Error('No chapters found');
        chapterCache.set(selectedBook.key, sections);
        const items = Object.keys(sections).map((key, index) => {
          const section = sections[key];
          const name = typeof section === 'string' && section
            ? section
            : section?.english || section?.arabic || section?.urdu || `Chapter ${index + 1}`;
          return {
            key,
            name,
            from: Number(section?.hadithnumber_first || section?.hadith_number_first || 0),
            to: Number(section?.hadithnumber_last || section?.hadith_number_last || 0),
          };
        });
        setChapters(items);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Chapters could not be loaded.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [screen, selectedBook, retryToken]);

  useEffect(() => {
    if (screen !== 'reader' || !selectedBook || !selectedChapter) return;
    const controller = new AbortController();
    const supportedLanguage = chooseSupportedLanguage(selectedBook, language);
    if (supportedLanguage !== language) {
      setLanguage(supportedLanguage);
      localStorage.setItem(LANGUAGE_KEY, supportedLanguage);
      return () => controller.abort();
    }

    const cacheKey = `${selectedBook.key}_${selectedChapter.key}_${language}`;
    const parse = (arabicData: any, translationData: any) => {
      const translationMap = new Map<number | string, string>();
      for (const item of translationData?.hadiths || []) {
        translationMap.set(item.hadithnumber, item.text || '');
      }
      const result: Hadith[] = (arabicData?.hadiths || []).map((item: any) => ({
        num: item.hadithnumber,
        arabic: item.text || '',
        translation: translationMap.get(item.hadithnumber) || '',
        grades: item.grades || [],
      }));
      setHadiths(result);
      setLoading(false);
    };

    const cached = readerCache.get(cacheKey);
    if (cached) {
      parse(cached[0], cached[1]);
      return () => controller.abort();
    }

    setLoading(true);
    setError('');
    const translationRequest = language === 'ara'
      ? Promise.resolve({ hadiths: [] })
      : requestEdition(`${language}-${selectedBook.key}/sections/${selectedChapter.key}`, controller.signal);

    Promise.all([
      requestEdition(`ara-${selectedBook.key}/sections/${selectedChapter.key}`, controller.signal),
      translationRequest,
    ])
      .then(([arabicData, translationData]) => {
        readerCache.set(cacheKey, [arabicData, translationData]);
        parse(arabicData, translationData);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Hadith could not be loaded.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, selectedBook, selectedChapter, language, retryToken]);

  useEffect(() => {
    const target = pendingScrollRef.current;
    if (!target || !hadiths.length) return;
    const index = hadiths.findIndex((hadith) => Number(hadith.num) === Number(target));
    if (index < 0) return;
    setPage(Math.floor(index / PER_PAGE) + 1);
    const timer = window.setTimeout(() => {
      const card = document.getElementById(`hadith-${target}`);
      if (!card) return;
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('hadith-target-highlight');
      window.setTimeout(() => card.classList.remove('hadith-target-highlight'), 1800);
      pendingScrollRef.current = null;
    }, 220);
    return () => window.clearTimeout(timer);
  }, [hadiths, page]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const openChapter = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    setHadiths([]);
    setPage(1);
    setSearch('');
    setSearchMessage('');
    setError('');
    setScreen('reader');
  };

  const chooseLanguage = (code: string) => {
    if (!selectedBook || !isLanguageAvailable(selectedBook.key, code)) return;
    setLanguage(code);
    localStorage.setItem(LANGUAGE_KEY, code);
    setLanguagePickerOpen(false);
    setPage(1);
    setSearchMessage('');
    if (screen === 'reader') setHadiths([]);
  };

  const runSearch = () => {
    const number = Number(search);
    if (!Number.isInteger(number) || number <= 0) {
      setSearchError(true);
      setSearchMessage('Please enter a valid Hadith number.');
      return;
    }
    const index = hadiths.findIndex((hadith) => Number(hadith.num) === number);
    if (index < 0) {
      setSearchError(true);
      setSearchMessage('This Hadith number was not found in this chapter.');
      return;
    }
    setSearchError(false);
    setSearchMessage(`Hadith number ${number} found.`);
    setPage(Math.floor(index / PER_PAGE) + 1);
    window.setTimeout(() => {
      const card = document.getElementById(`hadith-${number}`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card?.classList.add('hadith-target-highlight');
      window.setTimeout(() => card?.classList.remove('hadith-target-highlight'), 1800);
    }, 180);
  };

  const goToBooks = () => {
    setScreen('books');
    setSelectedBook(null);
    setSelectedChapter(null);
    setChapters([]);
    setHadiths([]);
    setError('');
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const goToChapters = () => {
    setScreen('chapters');
    setSelectedChapter(null);
    setHadiths([]);
    setSearch('');
    setSearchMessage('');
    setError('');
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const retry = () => {
    setError('');
    setRetryToken((value) => value + 1);
  };

  return (
    <div dir="ltr" className="hadith-view mx-auto w-full max-w-[900px] bg-white px-2 pb-20 text-left text-black">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;600;700&family=Scheherazade+New:wght@400;700&family=Noto+Sans+Bengali:wght@400;600;700&family=Noto+Sans+Tamil:wght@400;600;700&display=swap');
        .hadith-arabic{font-family:'Scheherazade New','Noto Naskh Arabic',serif;font-weight:700;line-height:1.9;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}
        .hadith-translation{font-family:Inter,'Segoe UI',sans-serif;line-height:1.85}
        .hadith-translation[dir='rtl']{font-family:'Scheherazade New','Noto Naskh Arabic',serif;font-weight:700;line-height:2;text-align:right}
        .hadith-translation[data-lang='ben']{font-family:'Noto Sans Bengali',sans-serif}
        .hadith-translation[data-lang='tam']{font-family:'Noto Sans Tamil',sans-serif}
        .hadith-brand span{display:inline-block;animation:hadith-bounce 1.1s ease-in-out infinite;background:linear-gradient(180deg,#75b5ff,#080808);-webkit-background-clip:text;background-clip:text;color:transparent}
        .hadith-view button:focus-visible{outline:2px solid #1680ef;outline-offset:3px}
        .hadith-view button:disabled{cursor:not-allowed}
        @media(prefers-reduced-motion:reduce){.hadith-view .hadith-brand span{animation:none}.hadith-view *{scroll-behavior:auto!important;transition:none!important}}
        @keyframes hadith-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-10px)}}
        .hadith-target-highlight{box-shadow:0 0 0 3px rgba(117,181,255,.85),0 0 24px rgba(0,0,0,.10)!important;background:#fff!important}
      `}</style>

      {screen === 'books' && (
        <>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {BOOKS.map((book, index) => (
              <button
                key={book.key}
                type="button"
                onClick={() => openBook(book)}
                className={`flex min-h-[142px] flex-col items-center justify-center rounded-2xl border border-black/10 bg-white p-3 text-center shadow-[0_3px_10px_rgba(0,0,0,.12)] transition active:scale-[.97] ${index === BOOKS.length - 1 ? 'col-span-2 sm:col-span-1' : ''}`}
              >
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#75b5ff] text-black"><BookOpen size={19} /></span>
                <strong className="text-sm text-black">{book.name}</strong>
                <small className="mt-2 rounded-full bg-[#75b5ff] px-2.5 py-1 text-[10px] font-semibold text-slate-500">{book.total.toLocaleString('en-US')} Hadith</small>
              </button>
            ))}
          </div>
          <button onClick={onBack} className="mx-auto mt-5 flex items-center gap-2 rounded-full bg-[#75b5ff] px-4 py-2 text-xs font-bold text-black"><ArrowLeft size={14} /> Back</button>
        </>
      )}

      {screen === 'chapters' && selectedBook && (
        <>
          <div className="sticky top-0 z-30 mb-3 flex items-center justify-between gap-2 rounded-xl border border-black/10 bg-white p-3 shadow-sm">
            <button onClick={goToBooks} className="flex items-center gap-1 rounded-full bg-[#75b5ff] px-3 py-2 text-[11px] font-bold text-black"><ArrowLeft size={13} /> Books</button>
            <div className="min-w-0 flex-1 truncate text-center text-xs font-bold text-black">{selectedBook.name} · {currentLanguage.name}</div>
            <button onClick={() => setLanguagePickerOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#75b5ff] text-black" aria-label="Select language"><Languages size={15} /></button>
          </div>

          {loading && <BrandLoader />}
          {error && (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <AlertTriangle size={30} className="text-black" />
              <p className="max-w-sm text-sm text-slate-500">{error}</p>
              <div className="flex gap-2"><button onClick={retry} className="flex items-center gap-2 rounded-full bg-[#75b5ff] px-4 py-2 text-xs font-bold text-black"><RefreshCw size={13} /> Retry</button><button onClick={goToBooks} className="rounded-full bg-[#75b5ff] px-4 py-2 text-xs font-bold text-slate-600">All books</button></div>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-2">
              {chapters.map((chapter, index) => (
                <button key={chapter.key} onClick={() => openChapter(chapter)} className="flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-white p-3 text-left shadow-[0_2px_8px_rgba(0,0,0,.08)]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#75b5ff] text-[10px] font-bold text-black">{index + 1}</span>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-[13px]">{chapter.name}</strong>{chapter.from > 0 && chapter.to > 0 && <small className="mt-1 block text-[10px] text-slate-500">Hadith {chapter.from}–{chapter.to}</small>}</span>
                  <ChevronRight size={15} className="text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {screen === 'reader' && selectedBook && selectedChapter && (
        <>
          <div className="sticky top-0 z-30 mb-3 flex items-center justify-between gap-2 rounded-xl border border-black/10 bg-white p-3 shadow-sm" ref={menuRef}>
            <button onClick={goToChapters} className="flex items-center gap-1 rounded-full bg-[#75b5ff] px-3 py-2 text-[11px] font-bold text-black"><ArrowLeft size={13} /> Chapters</button>
            <div className="min-w-0 flex-1 truncate text-center text-xs font-bold text-black">{selectedChapter.name}</div>
            <div className="relative">
              <button onClick={() => setMenuOpen((value) => !value)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#75b5ff]" aria-label="More options"><MoreVertical size={15} /></button>
              {menuOpen && (
                <div className="absolute right-0 top-10 z-50 w-48 overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl">
                  <button onClick={() => { setLanguagePickerOpen(true); setMenuOpen(false); }} className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-3 text-left text-xs hover:bg-[#75b5ff]"><Languages size={14} /> Translation: {currentLanguage.name}</button>
                  <button onClick={goToChapters} className="w-full border-b border-slate-100 px-3 py-3 text-left text-xs hover:bg-[#75b5ff]">Back to chapters</button>
                  <button onClick={goToBooks} className="w-full border-b border-slate-100 px-3 py-3 text-left text-xs hover:bg-[#75b5ff]">All books</button>
                  <button onClick={() => { setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-full px-3 py-3 text-left text-xs hover:bg-[#75b5ff]">Scroll to top</button>
                </div>
              )}
            </div>
          </div>

          <div className="fixed bottom-16 left-3 z-40 flex items-center rounded-full bg-[#75b5ff] p-1 shadow-xl">
            <button onClick={() => setFontScale((value) => Math.max(.8, Math.round((value - .1) * 10) / 10))} className="flex h-8 w-8 items-center justify-center rounded-full text-black"><Minus size={14} /></button>
            <span className="min-w-10 text-center text-[10px] font-bold text-black">{Math.round(fontScale * 100)}%</span>
            <button onClick={() => setFontScale((value) => Math.min(1.6, Math.round((value + .1) * 10) / 10))} className="flex h-8 w-8 items-center justify-center rounded-full text-black"><Plus size={14} /></button>
          </div>

          <div className="mb-3 flex items-center gap-2 rounded-xl border border-black/10 bg-white p-2">
            <Search size={16} className="ml-1 text-slate-400" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setSearchMessage(''); }} onKeyDown={(event) => { if (event.key === 'Enter') runSearch(); }} type="number" placeholder="Enter Hadith number..." className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm outline-none" />
            <button onClick={runSearch} className="rounded-full bg-[#75b5ff] px-4 py-2 text-xs font-bold text-black">Search</button>
          </div>
          {searchMessage && <div className={`mb-3 rounded-lg px-3 py-2 text-center text-xs ${searchError ? 'bg-blue-100 text-black' : 'bg-[#75b5ff] text-black'}`}>{searchMessage}</div>}

          {loading && <BrandLoader />}
          {error && (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <AlertTriangle size={30} className="text-black" />
              <p className="max-w-sm text-sm text-slate-500">{error}</p>
              <div className="flex gap-2"><button onClick={retry} className="flex items-center gap-2 rounded-full bg-[#75b5ff] px-4 py-2 text-xs font-bold text-black"><RefreshCw size={13} /> Retry</button><button onClick={goToBooks} className="rounded-full bg-[#75b5ff] px-4 py-2 text-xs font-bold text-slate-600">All books</button></div>
            </div>
          )}

          {!loading && !error && (
            <>
              {visibleHadiths.map((hadith) => {
                const grade = gradeInfo(hadith.grades);
                const isSaved = savedHadiths.some(item => item.book === selectedBook.key && String(item.num) === String(hadith.num));
                return (
                  <article key={String(hadith.num)} id={`hadith-${hadith.num}`} className="mb-3 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_10px_28px_rgba(0,0,0,.07),0_3px_7px_rgba(0,0,0,.04)] transition">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-white px-3 py-2">
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-black">#{hadith.num}</span>
                        <button
                          type="button"
                          onClick={() => toggleSaveHadith(hadith)}
                          aria-pressed={isSaved}
                          aria-label={`${isSaved ? 'Remove saved' : 'Save'} hadith ${hadith.num} from ${selectedBook.name}`}
                          title={isSaved ? 'Remove from saved hadiths' : 'Save hadith'}
                          className={`hadith-heart inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${isSaved ? 'text-red-600' : 'text-black'}`}
                        >
                          <Heart size={19} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
                        </button>
                      </div>
                      {grade && <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${grade.className}`}>{grade.label}</span>}
                      <span className="text-[10px] font-bold text-black">{selectedBook.name}</span>
                    </div>
                    <div className="p-4 text-right">
                      <div className="hadith-arabic whitespace-pre-wrap text-right text-black" dir="rtl" style={{ fontSize: `${21 * fontScale}px` }}>{hadith.arabic}</div>
                      {!!hadith.translation && <div className="hadith-translation mt-3 whitespace-pre-wrap border-t border-slate-100 pt-3 text-black" data-lang={language} dir={currentLanguage.dir} style={{ fontSize: `${17 * fontScale}px` }}>{hadith.translation}</div>}
                    </div>
                  </article>
                );
              })}

              {totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-black/10 bg-white p-3">
                  <button disabled={page <= 1} onClick={() => { setPage((value) => value - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-1 rounded-full bg-[#75b5ff] px-3 py-2 text-xs font-bold text-black disabled:opacity-30"><ChevronLeft size={13} /> Previous</button>
                  <span className="text-[10px] text-slate-500">{page} / {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => { setPage((value) => value + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-1 rounded-full bg-[#75b5ff] px-3 py-2 text-xs font-bold text-black disabled:opacity-30">Next <ChevronRight size={13} /></button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {saveMessage && (
        <div role="status" aria-live="polite" className="fixed bottom-28 left-1/2 z-[80] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl border border-blue-200 bg-white px-4 py-3 text-center text-sm text-black shadow-xl">
          {saveMessage}
        </div>
      )}

      {languagePickerOpen && selectedBook && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setLanguagePickerOpen(false); }}>
          <div className="max-h-[82vh] w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><strong className="text-sm text-black">Select Translation Language</strong><button onClick={() => setLanguagePickerOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#75b5ff]"><X size={15} /></button></div>
            <div className="max-h-[65vh] overflow-y-auto p-2">
              {LANGUAGES.filter((item) => isLanguageAvailable(selectedBook.key, item.code)).map((item) => (
                <button key={item.code} onClick={() => chooseLanguage(item.code)} className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left ${item.code === language ? 'bg-[#75b5ff] text-black' : 'hover:bg-blue-100'}`}>
                  <span><strong className="block text-sm">{item.name}</strong><small className="mt-1 block text-[10px] text-slate-500">Available for {selectedBook.name}</small></span>
                  {item.code === language && <Check size={16} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HadithView;
