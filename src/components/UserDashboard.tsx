import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, Check, Heart, MapPin, LogIn, LayoutDashboard, LogOut, Bookmark, Clock, Layers, X } from 'lucide-react';
import type { Mosque } from '../types';

interface UserDashboardProps {
  profileImageSrc?: string;
  userName?: string;
  onClose: () => void;
  onOpenMosque: (mosque: Mosque) => void;
  onGoToSavedHadith?: (bookKey: string, chapterKey: string, chapterName: string, from: number, to: number, hadithNum: number) => void;
  onImamLogin: () => void;
  onImamDashboard: () => void;
  isImamLoggedIn: boolean;
  onImamLogout: () => void;
  onGoToQuran?: (surah: number, ayah: number) => void;
  isGuest?: boolean;
  userPhone?: string;
  onLogout?: () => void;
}


interface LastSeenQuran {
  surah: number;
  ayah: number;
  surahName: string;
  savedAt: number;
}

export function UserDashboard({
  userName = 'Guest',
  onClose,
  onOpenMosque,
  onGoToSavedHadith,
  onImamLogin,
  onImamDashboard,
  isImamLoggedIn,
  onImamLogout,
  onGoToQuran,
  isGuest = false,
  userPhone,
  onLogout,
  profileImageSrc = '/profile.jpg'
}: UserDashboardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [profileImageSrc]);
  const [showAllDhikr, setShowAllDhikr] = useState(false);


  const [toast, setToast] = useState('');


  const [lastSeenQuran, setLastSeenQuran] = useState<LastSeenQuran | null>(() => {
    try {
      const data = localStorage.getItem('steptudeen_app_quran_last_seen');
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  });


  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'steptudeen_app_quran_last_seen') {
        try {
          const data = e.newValue ? JSON.parse(e.newValue) : null;
          setLastSeenQuran(data);
          if (data) {
            setToast(`Quran last seen: Surah ${data.surahName} - Ayah ${data.ayah}`);
          }
        } catch {
          setLastSeenQuran(null);
        }
      }
    };


    const handleCustomEvent = (e: CustomEvent) => {
      if (e.detail?.type === 'quranLastSeenUpdated') {
        try {
          const data = localStorage.getItem('steptudeen_app_quran_last_seen');
          const parsed = data ? JSON.parse(data) : null;
          setLastSeenQuran(parsed);
          if (parsed) {
            setToast(`Quran last seen updated: Surah ${parsed.surahName} - Ayah ${parsed.ayah}`);
          }
        } catch {
          setLastSeenQuran(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('quranLastSeenUpdated', handleCustomEvent as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('quranLastSeenUpdated', handleCustomEvent as EventListener);
    };
  }, []);


  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);


  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const tasbihHistory = (() => {
    try { return JSON.parse(localStorage.getItem('tasbih_history_v4') || '{}'); } catch { return {}; }
  })();

  const tasbihToday = tasbihHistory[today] || 0;
  const tasbihYesterday = tasbihHistory[yesterday] || 0;
  const tasbihTotal = Object.values(tasbihHistory).reduce((s: number, v) => s + Number(v), 0);

  const dhikrList = (() => {
    try {
      const saved = localStorage.getItem('tasbih_dhikr_list_v4');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  })();


  const [savedHadiths, setSavedHadiths] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('user_saved_hadiths') || '[]'); } catch { return []; }
  });


  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user_saved_hadiths') {
        try {
          const data = e.newValue ? JSON.parse(e.newValue) : [];
          setSavedHadiths(data);
        } catch {
          setSavedHadiths([]);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleRemoveHadith = (num: any, book: string) => {
    const updated = savedHadiths.filter(h => !(h.num === num && h.book === book));
    setSavedHadiths(updated);
    localStorage.setItem('user_saved_hadiths', JSON.stringify(updated));
    setToast('Hadith removed from saved list');
  };


  const [savedMosques, setSavedMosques] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('user_saved_mosques') || '[]');
    } catch { return []; }
  });

  const handleRemoveMosque = (id: string) => {
    const updated = savedMosques.filter(m => m.id !== id);
    setSavedMosques(updated);
    localStorage.setItem('user_saved_mosques', JSON.stringify(updated));
    const mosqueMap = JSON.parse(localStorage.getItem('user_saved_mosques_map') || '{}');
    delete mosqueMap[id];
    localStorage.setItem('user_saved_mosques_map', JSON.stringify(mosqueMap));
    setToast('Mosque removed from saved list');
  };


  const getTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <main className="ud" dir="ltr">
      <style>{`
        .ud { --blue:#75b5ff; --ink:#080808; box-sizing:border-box; min-height:100vh; background:#fff; color:var(--ink); padding:28px 20px 40px; font-family:inherit; }
        .ud *, .ud *::before, .ud *::after { box-sizing:border-box; }
        .ud .ud-shell { max-width:1080px; margin:auto; }
        .ud h1,.ud h2,.ud h3,.ud p { margin:0; }
        .ud button { font:inherit; cursor:pointer; }
        .ud .ud-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:42px; padding:10px 16px; border:1px solid #00000012; border-radius:12px; background:var(--blue); color:#000; font-size:12px; font-weight:700; box-shadow:0 3px 0 #00000012; transition:transform .18s,background .18s,box-shadow .18s; text-decoration:none; }
        .ud .ud-btn:hover { background:#96c7ff; transform:translateY(-2px); box-shadow:0 6px 12px #00000010; }
        .ud .ud-btn:active { transform:translateY(1px); }
        .ud button:focus-visible { outline:3px solid #1674de; outline-offset:4px; }
        .ud .ud-icon-btn { padding:10px; flex-shrink:0; }
        .ud .ud-top,.ud .ud-actions,.ud .ud-row { display:flex; align-items:center; gap:12px; }
        .ud .ud-top { justify-content:space-between; flex-wrap:wrap; margin-bottom:26px; }
        .ud .ud-actions { flex-wrap:wrap; }
        .ud .ud-brand { display:flex; align-items:center; gap:10px; font-size:13px; font-weight:800; letter-spacing:.04em; }
        .ud .ud-brand-mark,.ud .ud-symbol { display:grid; place-items:center; width:38px; height:38px; border:1px solid #00000010; border-radius:12px; color:#0870df; background:#fff; flex-shrink:0; }
        .ud .ud-card { background:#fff; border:1px solid #0000000d; border-radius:23px; box-shadow:0 12px 32px #00000008,0 3px 7px #00000006; }
        .ud .ud-profile { padding:30px; display:flex; align-items:center; gap:23px; position:relative; overflow:hidden; margin-bottom:24px; border-top:3px solid var(--blue); }
        .ud .ud-avatar { width:92px; height:92px; flex-shrink:0; border-radius:25px; padding:5px; border:1px solid #00000012; box-shadow:0 5px 16px #0000000c; background:#fff; }
        .ud .ud-avatar img { width:100%;height:100%;object-fit:cover;border-radius:19px;display:block; }
        .ud .ud-initials { height:100%; display:grid;place-items:center;background:var(--blue);border-radius:19px;font-size:26px;font-weight:800; }
        .ud .ud-kicker { font-size:10px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;opacity:.55;margin-bottom:8px; }
        .ud h1 { font-size:clamp(24px,4vw,34px);font-weight:800;letter-spacing:-.04em;line-height:1.2;overflow-wrap:anywhere; }
        .ud .ud-muted { font-size:12px;line-height:1.7;opacity:.58; }
        .ud .ud-profile-copy { flex:1;min-width:0; }
        .ud .ud-profile-copy .ud-muted { margin-top:6px;overflow-wrap:anywhere; }
        .ud .ud-badge { display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid #00000012;border-radius:9px;font-size:10px;font-weight:700;white-space:nowrap; }
        .ud .ud-section { padding:25px;min-width:0; }
        .ud .ud-heading { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:22px; }
        .ud h2 { font-size:15px;font-weight:800;letter-spacing:-.02em; }
        .ud .ud-sub { font-size:11px;opacity:.5;margin-top:5px;line-height:1.5; }
        .ud .ud-grid { display:grid;grid-template-columns:1.15fr 1fr;gap:24px;margin-top:24px;align-items:start; }
        .ud .ud-stats { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px; }
        .ud .ud-stat { padding:22px 18px;border:1px solid #0000000c;border-radius:17px;box-shadow:0 5px 14px #00000006;background:white; }
        .ud .ud-stat:first-child { border-top:3px solid var(--blue);padding-top:20px; }
        .ud .ud-number { display:block;font-size:clamp(22px,3.5vw,34px);font-weight:800;letter-spacing:-.045em;overflow-wrap:anywhere;margin:8px 0 4px; }
        .ud .ud-stat-label { font-size:11px;opacity:.6; }
        .ud .ud-list { display:grid;gap:13px; }
        .ud .ud-item { border:1px solid #0000000d;border-radius:15px;padding:17px;background:#fff;box-shadow:0 4px 10px #00000004;min-width:0; }
        .ud .ud-spread { justify-content:space-between; }
        .ud .ud-dhikr { margin-top:18px; }
        .ud .ud-arabic { font-size:17px;line-height:1.95;text-align:right;overflow-wrap:anywhere; }
        .ud .ud-empty { min-height:170px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:9px;padding:24px 12px;border:1px dashed #00000019;border-radius:15px; }
        .ud .ud-empty svg { color:#2586f0;margin-bottom:5px; }
        .ud .ud-empty strong { font-size:12px;font-weight:600; }
        .ud .ud-count { font-size:11px;padding:5px 9px;border:1px solid #00000014;border-radius:8px;font-weight:700; }
        .ud .ud-full { width:100%;margin-top:16px; }
        .ud .ud-reading { font-size:25px;font-weight:800;letter-spacing:-.035em;margin:15px 0 8px; }
        .ud .ud-meta { display:flex;align-items:center;gap:6px;font-size:11px;opacity:.6; }
        .ud .ud-divider { border:0;border-top:1px solid #0000000c;margin:14px 0; }
        .ud .ud-footer { margin-top:28px;display:flex;align-items:center;justify-content:space-between;gap:16px; }
        .ud .ud-toast { position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:100;display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #00000012;border-radius:15px;padding:16px 20px;box-shadow:0 12px 45px #00000020;width:max-content;max-width:calc(100vw - 32px);font-size:12px; }
        @media(max-width:700px) { .ud{padding:18px 14px 28px}.ud .ud-grid{grid-template-columns:1fr;gap:18px;margin-top:18px}.ud .ud-profile{padding:23px 19px;gap:16px;flex-wrap:wrap}.ud .ud-avatar{width:76px;height:76px}.ud .ud-section{padding:20px 16px}.ud .ud-stats{gap:8px}.ud .ud-stat{padding:16px 10px}.ud .ud-stat:first-child{padding-top:14px}.ud .ud-profile>.ud-badge{margin-left:92px}.ud .ud-footer{align-items:flex-start;flex-direction:column}.ud .ud-top{gap:18px}.ud .ud-btn{font-size:11px;padding:10px 12px} }
        @media(prefers-reduced-motion:reduce) { .ud .ud-btn{transition:none}.ud .ud-btn:hover{transform:none} }
      `}</style>
      <div className="ud-shell">
        <header className="ud-top">
          <div className="ud-brand"><span className="ud-brand-mark"><LayoutDashboard size={19}/></span> MY DASHBOARD</div>
          <nav className="ud-actions" aria-label="Account actions">
            {isImamLoggedIn ? <>
              <button className="ud-btn" onClick={onImamDashboard}><LayoutDashboard size={15}/> Go to Imam Dashboard</button>
              <button className="ud-btn" onClick={onImamLogout}><LogOut size={15}/> Imam Logout</button>
            </> : <button className="ud-btn" onClick={onImamLogin}><LogIn size={15}/> Imam Login</button>}
            {!isGuest && onLogout && <button className="ud-btn" onClick={onLogout}><LogOut size={15}/> Logout</button>}
          </nav>
        </header>

        <section className="ud-card ud-profile" aria-label="Your profile">
          <div className="ud-avatar">
            {!imageFailed ? <img src={profileImageSrc} alt={`${userName}'s profile`} onError={() => setImageFailed(true)}/> : <span className="ud-initials" aria-label={userName}>{userName.trim().slice(0,2).toUpperCase() || 'GU'}</span>}
          </div>
          <div className="ud-profile-copy">
            <p className="ud-kicker">Your personal space</p>
            <h1>{userName}</h1>
            {userPhone && <p className="ud-muted">{userPhone}</p>}
            <p className="ud-muted">{isGuest ? 'Guest mode — data is saved on this device only.' : 'Your daily remembrance, reading and saved places.'}</p>
          </div>
          <span className="ud-badge">{isGuest ? <Bookmark size={13}/> : <Check size={13}/>} {isGuest ? 'Guest account' : 'Personal dashboard'}</span>
        </section>

        <section className="ud-card ud-section">
          <div className="ud-heading"><div className="ud-row"><span className="ud-symbol"><Layers size={19}/></span><div><h2>Tasbih Counter</h2><p className="ud-sub">Small moments. Meaningful progress.</p></div></div><span className="ud-badge">Daily activity</span></div>
          <div className="ud-stats">
            {[['Today', tasbihToday], ['Yesterday', tasbihYesterday], ['All time', tasbihTotal]].map(([label, value]) => <div className="ud-stat" key={String(label)}><span className="ud-stat-label">{label}</span><strong className="ud-number">{Number(value).toLocaleString()}</strong><span className="ud-stat-label">remembrances</span></div>)}
          </div>
          {dhikrList.length > 0 && <div className="ud-list ud-dhikr">
            {(showAllDhikr ? dhikrList : dhikrList.slice(0,3)).map((d: any, i: number) => <div className="ud-item ud-row ud-spread" key={i}><div><strong>{Number(d.savedProgress || 0).toLocaleString()}</strong><p className="ud-sub">times</p></div><div style={{textAlign:'right'}}><p className="ud-arabic" dir="rtl">{d.ur}</p><p className="ud-sub">{d.en}</p></div></div>)}
            {dhikrList.length > 3 && <button className="ud-btn" aria-expanded={showAllDhikr} onClick={() => setShowAllDhikr(!showAllDhikr)}>{showAllDhikr ? 'Show less' : `Show more (${dhikrList.length - 3})`}</button>}
          </div>}
        </section>

        <div className="ud-grid">
          <section className="ud-card ud-section">
            <div className="ud-heading"><div className="ud-row"><span className="ud-symbol"><BookOpen size={19}/></span><div><h2>Continue your Quran</h2><p className="ud-sub">Pick up where you left off.</p></div></div></div>
            {lastSeenQuran ? <div className="ud-item">
              <span className="ud-badge">Last viewed</span><h3 className="ud-reading">Surah {lastSeenQuran.surahName}</h3><p className="ud-muted">Ayah {lastSeenQuran.ayah}</p><hr className="ud-divider"/>
              <span className="ud-meta"><Clock size={13}/>{getTimeAgo(lastSeenQuran.savedAt)}</span>
              <button className="ud-btn ud-full" onClick={() => onGoToQuran ? onGoToQuran(lastSeenQuran.surah,lastSeenQuran.ayah) : onClose()}>Continue reading <ArrowUpRight size={16}/></button>
            </div> : <div className="ud-empty"><BookOpen size={27}/><strong>Your reading journey starts here</strong><p className="ud-muted">Your last viewed ayah will appear here.</p></div>}
          </section>
          <section className="ud-card ud-section">
            <div className="ud-heading"><div className="ud-row"><span className="ud-symbol"><Bookmark size={19}/></span><div><h2>Saved Hadiths</h2><p className="ud-sub">Words to return to.</p></div></div><span className="ud-count">{savedHadiths.length}</span></div>
            {savedHadiths.length === 0 ? <div className="ud-empty"><Bookmark size={27}/><strong>No hadiths saved yet</strong><p className="ud-muted">Tap Save on any hadith to keep it here.</p></div> : <div className="ud-list">
              {savedHadiths.map((h,i) => <article className="ud-item" key={`${h.book}-${h.num}-${i}`}>
                <div className="ud-row ud-spread"><div><strong style={{fontSize:12}}>{h.bookName}</strong><p className="ud-sub">Hadith {h.num}</p></div><button className="ud-btn ud-icon-btn" aria-label={`Remove hadith ${h.num}`} onClick={() => handleRemoveHadith(h.num,h.book)}><X size={14}/></button></div>
                <hr className="ud-divider"/><p className="ud-arabic" dir="rtl">{h.ar}</p>{h.ur && <p className="ud-muted" style={{textAlign:'right',marginTop:8}} dir="rtl">{h.ur}</p>}
                {onGoToSavedHadith && h.chapterKey && <button className="ud-btn ud-full" onClick={() => onGoToSavedHadith(h.book,h.chapterKey,h.chapterName || '',h.from || 0,h.to || 0,h.num)}>Open hadith <ArrowUpRight size={15}/></button>}
              </article>)}
            </div>}
          </section>
          <section className="ud-card ud-section" style={{gridColumn:'1 / -1'}}>
            <div className="ud-heading"><div className="ud-row"><span className="ud-symbol"><MapPin size={19}/></span><div><h2>Saved Mosques</h2><p className="ud-sub">Your places of prayer, together.</p></div></div><span className="ud-count">{savedMosques.length}</span></div>
            {savedMosques.length === 0 ? <div className="ud-empty"><Heart size={27}/><strong>No mosques saved yet</strong><p className="ud-muted">Tap the heart icon next to a mosque to save it.</p></div> : <div className="ud-list">
              {savedMosques.map(mosque => <article className="ud-item" key={mosque.id}>
                <div className="ud-row ud-spread"><div><h3 style={{fontSize:15,fontWeight:700}}>{mosque.name}</h3>{mosque.address && <p className="ud-muted" style={{marginTop:5}}>{mosque.address}</p>}</div><button className="ud-btn ud-icon-btn" aria-label={`Remove ${mosque.name} from saved mosques`} onClick={() => handleRemoveMosque(mosque.id)}><X size={15}/></button></div>
                <button className="ud-btn ud-full" onClick={() => onOpenMosque(mosque)}><MapPin size={15}/> View Prayer Times <ArrowUpRight size={15}/></button>
              </article>)}
            </div>}
          </section>
        </div>
        <footer className="ud-footer"><p className="ud-muted">A little progress, every day.</p><button className="ud-btn" onClick={onClose}><ArrowLeft size={16}/> Back to App</button></footer>
      </div>
      {toast && <div className="ud-toast" role="status" aria-live="polite"><Check size={18} style={{flexShrink:0,color:'#0870df'}}/><span>{toast}</span></div>}
    </main>
  );
}
