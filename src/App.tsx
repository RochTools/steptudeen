import React, { Component, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { initializeFirebaseAtRuntime, subscribeToAuthState } from './firebase';
import { onSnapshot, collection, doc, getDoc } from 'firebase/firestore';
import { initFCM, listenForegroundMessages } from './utils/fcm';
import { requestNotificationPermission, scheduleAllPrayerNotifications } from './utils/notifications';

// ============ HOOKS ============
import { useAuth } from './hooks/useAuth';
import { usePrayerTimes } from './hooks/usePrayerTimes';
import { useMosques } from './hooks/useMosques';
import { useNavigation } from './hooks/useNavigation';

// ============ HOME: eager load (first screen) ============
import { HomeView } from './components/HomeView';

// ============ ALL OTHER COMPONENTS: lazy loaded ============
// These components are loaded only when the user opens the relevant page.
const QuranView       = lazy(() => import('./components/QuranView').then(m => ({ default: m.QuranView })));
const HadithView      = lazy(() => import('./components/HadithView').then(m => ({ default: m.HadithView })));
const NamazView       = lazy(() => import('./components/NamazView').then(m => ({ default: m.NamazView })));
const DuasView        = lazy(() => import('./components/DuasView').then(m => ({ default: m.DuasView })));
const MosqueFinderView = lazy(() => import('./components/MosqueFinderView').then(m => ({ default: m.MosqueFinderView })));
const ImamDashboard   = lazy(() => import('./components/ImamDashboard').then(m => ({ default: m.ImamDashboard })));
const TasbihView      = lazy(() => import('./components/TasbihView').then(m => ({ default: m.TasbihView })));
const QiblaView       = lazy(() => import('./components/QiblaView').then(m => ({ default: m.QiblaView })));
const UserDashboard   = lazy(() => import('./components/UserDashboard').then(m => ({ default: m.UserDashboard })));
const LoginChoiceView = lazy(() => import('./components/LoginChoiceView').then(m => ({ default: m.LoginChoiceView })));
const FullScreenMenu  = lazy(() => import('./components/FullScreenMenu'));
const AboutPage       = lazy(() => import('./components/AboutPage'));
const ContactPage     = lazy(() => import('./components/ContactPage'));
const PrivacyPolicyPage = lazy(() => import('./components/PrivacyPolicyPage'));
const FAQPage         = lazy(() => import('./components/FAQPage'));
const TermsOfServicePage = lazy(() => import('./components/TermsOfServicePage'));
const ShareAppPage    = lazy(() => import('./components/ShareAppPage'));
const FeedbackPage    = lazy(() => import('./components/FeedbackPage'));
const HelpCenterPage  = lazy(() => import('./components/HelpCenterPage'));
const SettingsPage    = lazy(() => import('./components/SettingsPage'));
const RatingApp       = lazy(() => import('./components/RatingApp'));
const MosqueFinder = lazy(() => import('./components/mosqueFinder/MosqueFinder'));
import { Mosque } from './types';
import { BookOpen, Scroll, Heart, Compass, Bell, X, MapPin } from 'lucide-react';
import { formatTo12Hour } from './utils/timeHelpers';
import { useJamaatTimes } from './hooks/useJamaatTimes';

// ============ MOSQUE PRAYER GRID ============
// جماعت کا وقت = آج کا API وقت + امام کا offset۔ روز خود اپڈیٹ ہوتا ہے۔
// (الگ کمپوننٹ اس لیے کہ hook شرطی رینڈر کے اندر نہیں چل سکتا)
const MosquePrayerGrid: React.FC<{ mosque: Mosque }> = ({ mosque }) => {
  const { get, loading } = useJamaatTimes(mosque);

  const row1: [string, string][] = [
    ['Fajr', get('fajr')],
    ['Dhuhr', get('zuhr')],
    ['Asr', get('asr')],
  ];
  const row2: [string, string][] = [
    ['Maghrib', get('maghrib')],
    ['Isha', get('isha')],
    ['Jumu’ah', mosque.jumah],
  ];

  return (
    <div className="border-t border-slate-100 pt-3 space-y-2">
      <div className="text-left text-[9px] text-slate-400 uppercase font-bold tracking-tight flex items-center gap-1.5">
        Prayer Times
        {loading && (
          <span
            className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"
            title="Updating today's times"
          />
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {row1.map(([label, time]) => (
          <div key={label} className="p-1.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-[9px] text-slate-500">{label} congregation</div>
            <div className="text-xs font-mono font-bold text-slate-800 mt-0.5">
              {formatTo12Hour(time, '--:--')}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        {row2.map(([label, time]) => (
          <div
            key={label}
            className={`p-1.5 rounded-lg border ${label === 'Jumu’ah' ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}
          >
            <div className={`text-[9px] ${label === 'Jumu’ah' ? 'text-emerald-800 font-bold' : 'text-slate-500'}`}>
              {label} congregation
            </div>
            <div className={`text-xs font-mono font-bold mt-0.5 ${label === 'Jumu’ah' ? 'text-emerald-700' : 'text-slate-800'}`}>
              {formatTo12Hour(time, '--:--')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============ ERROR BOUNDARY ============
class ErrorBoundary extends Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('StepToDeen Error:', error, errorInfo);
  }
  handleRetry = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 p-6">
          <div className="text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 mx-auto"><X size={22} /></div>
            <h2 className="text-xl font-bold text-slate-800">Something went wrong</h2>
            <p className="max-w-sm px-2 text-sm text-slate-500">The application could not load this screen. Please try again.</p>
            <button
              onClick={this.handleRetry}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============ MAIN APP ============
export default function App() {

  // Kept for compatibility with the navigation hook; QuranView now contains its own reader.
  const [, setSelectedSurahNum] = useState<number | null>(null);

  // Hadith navigation requested from UserDashboard.
  const [pendingHadithNav, setPendingHadithNav] = useState<{
    bookKey: string; chapterKey: string; chapterName: string;
    from: number; to: number; hadithNum: number;
  } | null>(null);
  const [scrollToHadithNum, setScrollToHadithNum] = useState<number | null>(null);
  const [realtimeDb, setRealtimeDb] = useState<any>(null);
  const [realtimeAuth, setRealtimeAuth] = useState<any>(null);
  const [realFirebaseActive, setRealFirebaseActive] = useState<boolean>(false);
  const isMounted = useRef(true);

  // ============ HOOKS ============
  const auth = useAuth();
  const prayer = usePrayerTimes();
  const mosques = useMosques(realtimeDb, realFirebaseActive);
  const nav = useNavigation({
    selectedMosque: mosques.selectedMosque,
    setSelectedMosque: mosques.setSelectedMosque,
    setSelectedSurahNum,
  });

  // ============ FCM ============
  useEffect(() => {
    let isMountedLocal = true;
    let unsubscribe: (() => void) | undefined;

    if (auth.isAnyUser || auth.isAuthenticated) {
      initFCM(auth.authUid || undefined)
        .then(token => { if (isMountedLocal && token) console.log('FCM ready ✅'); })
        .catch(err => console.warn('FCM init failed:', err));
      unsubscribe = listenForegroundMessages();
    }

    // Prayer notification setup.
    const setupPrayerNotifications = async () => {
      const granted = await requestNotificationPermission();
      if (!granted || !isMountedLocal) return;

      // Schedule notifications when prayer times are available.
      if (prayer.prayerTimes) {
        scheduleAllPrayerNotifications({
          fajr:    prayer.prayerTimes.fajr,
          zuhr:    prayer.prayerTimes.zuhr,
          asr:     prayer.prayerTimes.asr,
          maghrib: prayer.prayerTimes.maghrib,
          isha:    prayer.prayerTimes.isha,
        });
      }
    };
    setupPrayerNotifications();

    return () => {
      isMountedLocal = false;
      if (unsubscribe) unsubscribe();
    };
  }, [auth.isAnyUser, auth.isAuthenticated, auth.authUid, prayer.prayerTimes]);

  // ============ FIREBASE SETUP ============
  useEffect(() => {
    let unsubMosques: (() => void) | null = null;
    let unsubAuth: (() => void) | null = null;

    const runSetup = async () => {
      try {
        const {
          db: loadedDb,
          auth: loadedAuth,
          isRealFirebase: loadedIsReal
        } = await initializeFirebaseAtRuntime();

        if (!isMounted.current) return;

        setRealtimeDb(loadedDb);
        setRealtimeAuth(loadedAuth);
        setRealFirebaseActive(loadedIsReal);

        if (loadedIsReal && loadedDb && loadedAuth) {
          unsubAuth = subscribeToAuthState(loadedAuth, async (user) => {
            if (!isMounted.current) return;
            if (user) {
              auth.setAuthEmail(user.email || '');
              auth.setAuthName(user.displayName || user.email?.split('@')[0] || '');
              auth.setAuthUid(user.uid);

              try {
                const userDocSnap = await getDoc(doc(loadedDb, 'users', user.uid));
                const role = userDocSnap.exists() ? userDocSnap.data()?.role : 'user';
                if (isMounted.current) {
                  if (role === 'imam') {
                    auth.setIsAuthenticated(true);
                    auth.setIsUserAuthenticated(false);
                    auth.setIsOTPAuthenticated(false);
                  } else {
                    auth.setIsAuthenticated(false);
                    auth.setIsUserAuthenticated(true);
                    auth.setUserAuthName(
                      user.displayName || user.email?.split('@')[0] || ''
                    );
                  }
                }
              } catch (error) {
                console.warn('Error fetching user role:', error);
              }
            }
          });

          unsubMosques = onSnapshot(
            collection(loadedDb, 'mosques'),
            (snapshot) => {
              if (isMounted.current) {
                const list: Mosque[] = [];
                snapshot.forEach((docSnap) => {
                  list.push({ id: docSnap.id, ...docSnap.data() } as Mosque);
                });
                mosques.setMosques(list);
              }
            },
            (error) => {
              console.error('Firestore load failed:', error);
            }
          );
        }
      } catch (error) {
        console.error('Firebase init failed:', error);
      }
    };

    runSetup();
    return () => {
      isMounted.current = false;
      if (unsubMosques) unsubMosques();
      if (unsubAuth) unsubAuth();
    };
  }, []);

  const { currentView } = nav;

  // ============ RENDER ============
  return (
    <ErrorBoundary>
      <div dir="ltr" className={`w-full max-w-md mx-auto min-h-screen relative flex flex-col shadow-xl overflow-hidden pb-14 ${currentView === 'tasbih' ? 'bg-[#fef2c7]' : 'bg-slate-50'}`}>

        {/* LOGIN SPLASH */}
        {currentView === 'login-splash' && (
          <LoginChoiceView
            onImamLoginSuccess={() => {
              auth.setIsAuthenticated(true);
              nav.setNavigationHistory(['home']);
            }}
            onUserLogin={(name, phone) => {
              auth.handleUserLogin(name, phone);
              nav.setNavigationHistory(['home']);
            }}
            isRealFirebase={realFirebaseActive}
            realtimeAuth={realtimeAuth}
            setIsAuthenticated={auth.setIsAuthenticated}
            setAuthEmail={auth.setAuthEmail}
            setAuthName={auth.setAuthName}
            setAuthUid={auth.setAuthUid}
          />
        )}

        {/* MAIN CONTENT */}
        {currentView !== 'login-splash' && (
          <>
            {/* FIX: Suspense fallback for lazy-loaded pages */}
            <Suspense fallback={
              <div className="flex items-center justify-center flex-1 min-h-[300px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
              </div>
            }>
            <div className={`flex-1 min-h-[500px] flex flex-col ${currentView === 'tasbih' ? 'bg-[#fef2c7]' : 'bg-slate-50'}`}>

              {currentView === 'home' && (
                <HomeView
                  onNavigate={(view) => nav.navigateTo(view)}
                  prayerTimes={prayer.prayerTimes}
                  currentPrayer={prayer.currentPrayer}
                  todayDate={prayer.todayDate}
                  nearbyMosques={mosques.mosques}
                  savedMosqueIds={mosques.savedPopupMosques}
                  onOpenMosque={(m) => mosques.setSelectedMosque(m)}
                  userCoords={prayer.userCoords}
                  requestLocation={prayer.requestLocation}
                  isAuthenticated={auth.isAuthenticated}
                  isUserAuthenticated={auth.isAnyUser}
                  userAuthName={auth.currentUserName}
                  authName={auth.authName}
                  isLoading={mosques.isLoading}
                />
              )}

              {currentView === 'quran' && (
                <QuranView />
              )}

              {currentView === 'hadith' && (
                <HadithView
                  onBack={() => nav.goBack()}
                  pendingHadithNav={pendingHadithNav}
                  onPendingHandled={() => setPendingHadithNav(null)}
                  scrollToHadithNum={scrollToHadithNum}
                  onScrollHandled={() => setScrollToHadithNum(null)}
                />
              )}

              {currentView === 'namaz' && <NamazView />}
              {currentView === 'duas' && <DuasView />}

              {currentView === 'tasbih' && (
                <div className="flex flex-col justify-center animate-fadeIn flex-1 bg-[#fef2c7]">
                  <TasbihView />
                </div>
              )}

              {currentView === 'qibla' && (
                <QiblaView
                  userCoords={prayer.userCoords}
                  requestLocation={prayer.requestLocation}
                />
              )}

              {currentView === 'mosques' && (
  <MosqueFinderView
    nearbyMosques={mosques.mosques}
    userCoords={prayer.userCoords}
    requestLocation={prayer.requestLocation}
    onOpenMosque={(m) => mosques.setSelectedMosque(m)}
    isLoading={mosques.isLoading}
  />
)}

              {currentView === 'user-dashboard' && (
                <UserDashboard
                  /* ✅ Guest mode: login نہیں ہے تو "Guest"، ورنے اصل نام (imam ہو تو امام کا نام) */
                  userName={auth.isAnyUser ? (auth.currentUserName || 'My Account') : auth.isAuthenticated ? (auth.authName || 'Imam Account') : 'Guest'}
                  userPhone={auth.currentUserEmail}
                  isGuest={!auth.isAnyUser && !auth.isAuthenticated}
                  onClose={() => nav.goBack()}
                  onOpenMosque={(mosque) => {
                    mosques.setSelectedMosque(mosque);
                    nav.goHome();
                  }}
                  onLogout={() => {
                    auth.handleLogoutAll();
                    mosques.setSavedPopupMosques([]);
                    nav.setNavigationHistory(['login-splash']);
                  }}
                  onGoToSavedHadith={(bookKey, chapterKey, chapterName, from, to, hadithNum) => {
                    setPendingHadithNav({ bookKey, chapterKey, chapterName, from, to, hadithNum });
                    setScrollToHadithNum(hadithNum);
                    nav.navigateTo('hadith');
                  }}
                  /* ✅ Quran: آخری دیکھی گئی آیت پر جانے کے لیے (QuranView اسی key کو پڑھتا ہے) */
                  onGoToQuran={(surah, ayah) => {
                    try {
                      localStorage.setItem('steptudeen_app_quran_search_target', JSON.stringify({ surah, ayah }));
                    } catch (error) {
                      console.warn('Could not save Quran target:', error);
                    }
                    nav.navigateTo('quran');
                  }}
                  /* ✅ امام سیکشن:
                     لاگ ان نہیں ہے → بٹن سے امام ڈش بورڈ نہیں کھلے گا،
                     اصل لاگ ان اسکرین (LoginChoiceView) پر جائے گا جہاں امام لاگ ان ہو سکتا ہے۔
                     لاگ ان ہے → Imam Panel سے امام ڈش بورڈ کھلے گا۔ */
                  onImamLogin={() => nav.navigateTo('login-splash')}
                  onImamDashboard={() => nav.navigateTo('imam-login')}
                  isImamLoggedIn={auth.isAuthenticated}
                  onImamLogout={() => {
                    try { realtimeAuth?.signOut?.(); } catch (error) { console.warn('Imam sign-out failed:', error); }
                    auth.setIsAuthenticated(false);
                    auth.setAuthEmail('');
                    auth.setAuthName('');
                    auth.setAuthUid('');
                    nav.setNavigationHistory(['home']);
                  }}
                />
              )}

           {currentView === 'menu' && (
             <FullScreenMenu 
        onNavigate={(view) => nav.navigateTo(view)} 
             onClose={() => nav.navigateTo('home')} 
        />
          )}
           {/* Ratings */}
{currentView === 'ratings' && (
  <RatingApp onBack={() => nav.goBack()} />
)}

{/* About */}
{currentView === 'about' && (
  <AboutPage onBack={() => nav.goBack()} />
)}

{/* Contact */}
{currentView === 'contact' && (
  <ContactPage onBack={() => nav.goBack()} />
)}

{/* Privacy */}
{currentView === 'privacy' && (
  <PrivacyPolicyPage onBack={() => nav.goBack()} />
)}

{/* FAQ */}
{currentView === 'faq' && (
  <FAQPage onBack={() => nav.goBack()} />
)}

{/* Terms */}
{currentView === 'terms' && (
  <TermsOfServicePage onBack={() => nav.goBack()} />
)}

{/* Share */}
{currentView === 'share' && (
  <ShareAppPage onBack={() => nav.goBack()} />
)}

{/* Feedback */}
{currentView === 'feedback' && (
  <FeedbackPage onBack={() => nav.goBack()} />
)}

{/* Help Center */}
{currentView === 'help' && (
  <HelpCenterPage onBack={() => nav.goBack()} />
)}

{/* Settings */}
{currentView === 'settings' && (
  <SettingsPage onBack={() => {
    prayer.requestLocation(); 
    nav.goBack();
  }} />
)}

              {currentView === 'mosque-map' && (
  <div className="fixed inset-0 z-50 bg-white">
    <MosqueFinder />
  </div>
)}
              
     {currentView === 'imam-login' && (
                <ImamDashboard
                onAddOrUpdateMosque={mosques.handleAddOrUpdateMosque}
                  onDeleteMosque={mosques.handleDeleteMosque}
                mosques={mosques.mosques}
                  userCoords={prayer.userCoords}
                  requestLocation={prayer.requestLocation}
                  isRealFirebase={realFirebaseActive}
                  isAuthenticated={auth.isAuthenticated}
                  setIsAuthenticated={(val) => {
                    auth.setIsAuthenticated(val);
                    if (val) nav.setNavigationHistory(['home']);
                  }}
                  authEmail={auth.authEmail}
                  setAuthEmail={auth.setAuthEmail}
                  authName={auth.authName}
                  setAuthName={auth.setAuthName}
                  authUid={auth.authUid}
                  setAuthUid={auth.setAuthUid}
                  realtimeAuth={realtimeAuth}
                  onLoggedOut={() => nav.setNavigationHistory(['login-splash'])}
                />
              )}
            </div>
            </Suspense>


            {/* BOTTOM NAV */}
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 flex justify-around p-2 z-40 shadow-xl">
              <button
                onClick={() => nav.navigateTo('hadith')}
                className={`flex flex-col items-center justify-center flex-1 transition-all ${currentView === 'hadith' ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}
              >
                <Scroll size={17} />
                <span className="text-[10px] mt-0.5">Hadith</span>
              </button>

              <button
                onClick={() => nav.navigateTo('quran')}
                className={`flex flex-col items-center justify-center flex-1 transition-all ${currentView === 'quran' ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}
              >
                <BookOpen size={17} />
                <span className="text-[10px] mt-0.5">Quran</span>
              </button>

              <button
                onClick={nav.goHome}
                className="relative -top-3.5 w-11 h-11 bg-emerald-600 rounded-xl flex items-center justify-center border border-emerald-500 shadow-lg text-white transition-transform hover:scale-105"
              >
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18" />
                  <path d="M12 2v3M12 5C8.5 5 6 7.5 6 11v10h12V11c0-3.5-2.5-6-6-6z" />
                  <path d="M9 14h6v7H9z" />
                </svg>
              </button>

              <button
                onClick={() => nav.navigateTo('mosques')}
                className={`flex flex-col items-center justify-center flex-1 transition-all ${currentView === 'mosques' ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}
              >
                <Compass size={17} />
                <span className="text-[10px] mt-0.5">Mosques</span>
              </button>

              <button
                onClick={() => nav.navigateTo('duas')}
                className={`flex flex-col items-center justify-center flex-1 transition-all ${currentView === 'duas' ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}
              >
                <Heart size={17} />
                <span className="text-[10px] mt-0.5">Duas</span>
              </button>
            </div>

            {/* MOSQUE MODAL */}
            {mosques.selectedMosque && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-3 animate-fadeIn">
                <div className="bg-white w-full max-w-sm rounded-2xl p-4 space-y-3.5 shadow-2xl pb-6 border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2" dir="ltr">
                    <h3 className="text-sm font-bold text-slate-800">
                      {mosques.selectedMosque.name || 'Mosque'}
                    </h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => mosques.handleToggleSaveMosque(mosques.selectedMosque!)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                          mosques.savedPopupMosques.includes(mosques.selectedMosque.id)
                            ? 'bg-red-50 border-red-200 text-red-500'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                      >
                        {mosques.savedPopupMosques.includes(mosques.selectedMosque.id)
                          ? '✓ Saved'
                          : 'Save'}
                      </button>
                      <button
                        onClick={() => mosques.setSelectedMosque(null)}
                        className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {mosques.selectedMosque.address && (
                    <div className="text-left space-y-0.5">
                      <span className="text-[9px] text-slate-400 uppercase font-bold block">Address</span>
                      <p className="text-xs text-slate-600">{mosques.selectedMosque.address}</p>
                    </div>
                  )}

                  {mosques.selectedMosque.imamName && (
                    <div className="text-left space-y-0.5">
                      <span className="text-[9px] text-slate-400 uppercase font-bold block">Imam</span>
                      <p className="text-xs text-emerald-700 font-bold">{mosques.selectedMosque.imamName}</p>
                    </div>
                  )}

                  {mosques.selectedMosque.announcement && (
                    <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-left text-xs text-amber-800 flex items-start gap-2 justify-start">
                      <Bell size={13} className="text-amber-600 shrink-0 mt-0.5" />
                      <span>{mosques.selectedMosque.announcement}</span>
                    </div>
                  )}

                  <MosquePrayerGrid mosque={mosques.selectedMosque} />

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={() => {
                        mosques.handleMosqueAlert(mosques.selectedMosque!);
                        mosques.setSelectedMosque(null);
                      }}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-bold rounded-xl flex items-center justify-center gap-1"
                    >
                      <Bell size={12} /><span>Enable Alerts</span>
                    </button>
                    {mosques.selectedMosque.latitude && mosques.selectedMosque.longitude && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${mosques.selectedMosque.latitude},${mosques.selectedMosque.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2.5 bg-[#4285F4] hover:bg-[#357ae8] text-white text-[10.5px] font-bold rounded-xl flex items-center justify-center gap-1.5"
                      >
                        <MapPin size={12} /><span>Directions in Google Maps</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}
