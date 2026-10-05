import { useState, useRef, useCallback, useEffect } from 'react';
import { Mosque } from '../types';

interface UseNavigationProps {
  selectedMosque: Mosque | null;
  setSelectedMosque: (m: Mosque | null) => void;
  setSelectedSurahNum: (n: number | null) => void;
}

export const useNavigation = ({
  selectedMosque,
  setSelectedMosque,
  setSelectedSurahNum
}: UseNavigationProps) => {

  // ریفریش (اوپر سے نیچے کھینچنا) پر انہی اسکرینوں پر واپس آئیں جہاں تھے۔
  // صرف محفوظ اسکرینیں؛ لاگ ان اسکرین/نقشہ وغیرہ کبھی بحال نہیں ہوتے۔
  const RESTORABLE_VIEWS = [
    'quran', 'hadith', 'namaz', 'duas', 'tasbih', 'qibla',
    'mosques', 'user-dashboard', 'imam-login',
  ];
  const VIEW_KEY = 'steptudeen_last_view';

  const getInitialHistory = (): string[] => {
    try {
      const saved = sessionStorage.getItem(VIEW_KEY);
      if (saved && RESTORABLE_VIEWS.includes(saved)) return ['home', saved];
    } catch { /* سٹوریج نہ ملے تو ہوم */ }
    return ['home'];
  };

  const getInitialView = useCallback(() => 'home', []);

  const navRef = useRef<string[]>(getInitialHistory());
  const [navigationHistory, setNavigationHistory] = useState<string[]>(
    () => [...navRef.current]
  );

  const currentView = navigationHistory[navigationHistory.length - 1];

  // موجودہ اسکرین یاد رکھیں (ٹیب بند ہونے پر خود مٹ جاتی ہے)
  useEffect(() => {
    try {
      if (RESTORABLE_VIEWS.includes(currentView)) sessionStorage.setItem(VIEW_KEY, currentView);
      else sessionStorage.removeItem(VIEW_KEY);
    } catch { /* نظر انداز */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  const navigateTo = useCallback((newView: string) => {
    if (navRef.current[navRef.current.length - 1] === newView) return;
    navRef.current = [...navRef.current, newView];
    setNavigationHistory([...navRef.current]);
  }, []);

  const goBack = useCallback(() => {
    if (navRef.current.length <= 1) {
      navRef.current = ['home'];
      setNavigationHistory(['home']);
      return;
    }
    navRef.current = navRef.current.slice(0, -1);
    setNavigationHistory([...navRef.current]);
  }, []);

  const goHome = useCallback(() => {
    navRef.current = ['home'];
    setNavigationHistory(['home']);
    setSelectedSurahNum(null);
    setSelectedMosque(null);
  }, [setSelectedSurahNum, setSelectedMosque]);

  const setNavigationHistoryDirect = useCallback((views: string[]) => {
    navRef.current = views;
    setNavigationHistory(views);
  }, []);

  const selectedMosqueRef = useRef(selectedMosque);
  useEffect(() => {
    selectedMosqueRef.current = selectedMosque;
  }, [selectedMosque]);

  const setSelectedMosqueRef = useRef(setSelectedMosque);
  const goBackRef = useRef(goBack);
  useEffect(() => {
    goBackRef.current = goBack;
  }, [goBack]);

  // ============ ANDROID BACK BUTTON ============
  useEffect(() => {
    window.history.pushState({ view: 'app' }, '', window.location.href);

    const handlePopState = () => {
      // ✅ فوراً push کرو تاکہ stack کبھی ختم نہ ہو
      window.history.pushState({ view: 'app' }, '', window.location.href);

      if (selectedMosqueRef.current) {
        setSelectedMosqueRef.current(null);
        return;
      }

      const current = navRef.current[navRef.current.length - 1];

      if (current === 'surah') {
        goBackRef.current();
        return;
      }

      if (current === 'hadith') {
        window.dispatchEvent(new Event('hadith-back'));
        return;
      }

      if (navRef.current.length > 1) {
        goBackRef.current();
        return;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ============ SURAH RESET ON VIEW CHANGE ============
  useEffect(() => {
    if (currentView !== 'surah') setSelectedSurahNum(null);
  }, [currentView, setSelectedSurahNum]);

  return {
    currentView,
    navigationHistory,
    navigateTo,
    goBack,
    goHome,
    setNavigationHistory: setNavigationHistoryDirect,
  };
};
