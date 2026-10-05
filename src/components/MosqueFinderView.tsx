import React, { useState, useEffect, useContext, createContext } from 'react';
import {
  Search,
  MapPin,
  Compass,
  Bell,
  BellRing,
  Heart,
  Plus,
  Minus,
  RefreshCw,
  AlertCircle,
  Info,
  Navigation,
} from 'lucide-react';
import { Mosque } from '../types';
import { useJamaatTimesForMany, mosqueJumuah } from '../hooks/useJamaatTimes';
import type { PrayerKey } from '../hooks/useJamaatTimes';
import { setMosqueFollow, getFollowedMosques } from '../utils/fcm';
import './MosqueFinderView.css';

// ═══════════════════════════════════════════════════════════════════════════
// مستقل چیزیں
// ═══════════════════════════════════════════════════════════════════════════

/** اوقات اتنے دن سے اپڈیٹ نہ ہوئے ہوں تو «پرانے» کی وارننگ دکھائیں */
const STALE_DAYS = 60;

const PRAYERS: { key: PrayerKey; label: string }[] = [
  { key: 'fajr', label: 'فجر' },
  { key: 'zuhr', label: 'ظہر' },
  { key: 'asr', label: 'عصر' },
  { key: 'maghrib', label: 'مغرب' },
  { key: 'isha', label: 'عشاء' },
];

const WEEKDAYS = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
const MONTHS = [
  'جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون',
  'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر',
];

const pad2 = (n: number) => String(n).padStart(2, '0');

// ── وقت کے ہیلپرز ────────────────────────────────────────────────────────────

/** "18:19" یا "6:19 PM" → دن کے سیکنڈ؛ سمجھ نہ آئے تو null */
const parseToSeconds = (raw?: string): number | null => {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([aApP][mM])?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (min > 59 || h > 24) return null;
  if (m[3]) {
    const pm = m[3].toLowerCase() === 'pm';
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  }
  return h * 3600 + min * 60;
};

/** وقت کو بڑے عدد + چھوٹے AM/PM میں توڑیں (تاکہ لائن نہ ٹوٹے) */
const split12 = (raw?: string): { time: string; suffix: string } | null => {
  const s = parseToSeconds(raw);
  if (s === null) return null;
  const h24 = Math.floor(s / 3600) % 24;
  const m = Math.floor((s % 3600) / 60);
  return { time: `${h24 % 12 || 12}:${pad2(m)}`, suffix: h24 >= 12 ? 'PM' : 'AM' };
};

/** "6:19 PM" جیسی ایک ہی سٹرنگ (جملوں کے اندر کے لیے) */
const format12 = (raw?: string, fallback = ''): string => {
  const parts = split12(raw || fallback);
  if (parts) return `${parts.time} ${parts.suffix}`;
  return raw || fallback;
};

const secondsOfDay = (ms: number): number => {
  const d = new Date(ms);
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
};

interface LiveState {
  curIdx: number;       // اب جس نماز کا دور ہے
  nextIdx: number;      // اگلی نماز
  remaining: number;    // اگلی نماز تک سیکنڈ
  progress: number;     // موجودہ اور اگلی کے درمیان کتنا وقت گزر چکا (0..1)
}

/** پانچوں جماعت کے اوقات (دن کے سیکنڈ) سے «اب کون سی نماز» اور «کتنا باقی» */
const computeLive = (secs: (number | null)[], nowSec: number): LiveState | null => {
  if (secs.length !== 5) return null;
  const s: number[] = [];
  for (const v of secs) {
    if (v === null) return null;
    s.push(v);
  }
  for (let i = 1; i < 5; i++) if (s[i] <= s[i - 1]) return null; // بے ترتیب ڈیٹا ہو تو نہ دکھائیں

  let cur = -1;
  for (let i = 0; i < 5; i++) if (s[i] <= nowSec) cur = i;

  const start = cur === -1 ? s[4] - 86400 : s[cur];
  const end = cur === 4 ? s[0] + 86400 : cur === -1 ? s[0] : s[cur + 1];
  const span = end - start;
  return {
    curIdx: cur === -1 ? 4 : cur,
    nextIdx: (cur + 1) % 5,
    remaining: Math.max(0, end - nowSec),
    progress: span > 0 ? Math.min(1, Math.max(0, (nowSec - start) / span)) : 0,
  };
};

const formatUpdated = (iso: string): { date: string; clock: string; ageDays: number } | null => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return {
    date: `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    clock: format12(`${d.getHours()}:${pad2(d.getMinutes())}`),
    ageDays: (Date.now() - t) / 86400000,
  };
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
};

// ═══════════════════════════════════════════════════════════════════════════
// «اب» کا وقت: ایک ہی ٹکر پوری فہرست کے لیے (ہر کارڈ کا الگ timer نہیں)
// ═══════════════════════════════════════════════════════════════════════════
const NowContext = createContext<number>(Date.now());

const NowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
};

// ═══════════════════════════════════════════════════════════════════════════
// چھوٹے حصے
// ═══════════════════════════════════════════════════════════════════════════

/** ڈیجیٹل گھڑی + تاریخ */
const DigitalClock: React.FC = () => {
  const now = useContext(NowContext);
  const d = new Date(now);
  const h = d.getHours();
  return (
    <div className="mfv-clock" aria-label="موجودہ وقت">
      <div className="mfv-clock-time">
        <span>{`${pad2(h % 12 || 12)}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`}</span>
        <span className="mfv-clock-ampm">{h >= 12 ? 'PM' : 'AM'}</span>
      </div>
      <div className="mfv-clock-date">
        {WEEKDAYS[d.getDay()]}، {d.getDate()} {MONTHS[d.getMonth()]}
      </div>
    </div>
  );
};

/** لائیو نماز: «اب فلاں کا وقت ہے» + اگلی نماز + گول کاؤنٹ ڈاؤن */
const RING_R = 38;
const RING_C = 2 * Math.PI * RING_R;

const LivePanel: React.FC<{ secs: (number | null)[]; raws: string[] }> = ({ secs, raws }) => {
  const now = useContext(NowContext);
  const live = computeLive(secs, secondsOfDay(now));
  if (!live) return null;

  const cur = PRAYERS[live.curIdx];
  const next = PRAYERS[live.nextIdx];
  const curTime = split12(raws[live.curIdx]);
  const rem = live.remaining;
  // ایک گھنٹے سے کم باقی ہو تو MM:SS (چھوٹا، رنگ کے اندر آرام سے آئے)، ورنہ H:MM:SS
  const hrs = Math.floor(rem / 3600);
  const countdown = hrs > 0
    ? `${hrs}:${pad2(Math.floor((rem % 3600) / 60))}:${pad2(rem % 60)}`
    : `${pad2(Math.floor(rem / 60))}:${pad2(rem % 60)}`;

  return (
    <div className="mfv-live">
      <div className="mfv-live-text">
        <span className="mfv-live-now">
          <i className="mfv-live-dot" />
          اب {cur.label} کا وقت ہے
        </span>
        {curTime && (
          <span className="mfv-live-time">
            {curTime.time}
            <small>{curTime.suffix}</small>
          </span>
        )}
        <span className="mfv-live-next">
          اگلی نماز: <b>{next.label}</b> <span dir="ltr">{format12(raws[live.nextIdx])}</span>
        </span>
      </div>

      <div className="mfv-ring" role="timer" aria-label={`اگلی نماز میں ${countdown} باقی`}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="mfv-ring-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
          </defs>
          <circle className="mfv-ring-track" cx="50" cy="50" r={RING_R} />
          <circle
            className="mfv-ring-bar"
            cx="50"
            cy="50"
            r={RING_R}
            stroke="url(#mfv-ring-grad)"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * live.progress}
          />
        </svg>
        <div className="mfv-ring-center">
          <span className="mfv-ring-count">{countdown}</span>
          <span className="mfv-ring-label">باقی وقت</span>
        </div>
      </div>
    </div>
  );
};

interface StripItem {
  key: string;
  label: string;
  raw: string;
  kind: 'prayer' | 'jumuah';
  prayerIdx: number; // جمعہ کے لیے -1
}

/**
 * پانچ نمازیں ایک ہی قطار میں (سکرول کے بغیر، سب نظر آئیں)؛ موجودہ نماز چمکتی ہے۔
 * جمعہ اس کے نیچے الگ چوڑی پٹی میں۔
 */
const PrayerStrip: React.FC<{ items: StripItem[]; secs: (number | null)[] }> = ({ items, secs }) => {
  const now = useContext(NowContext);
  const live = computeLive(secs, secondsOfDay(now));
  const curIdx = live ? live.curIdx : -1;

  const prayers = items.filter((i) => i.kind === 'prayer');
  const jumuah = items.find((i) => i.kind === 'jumuah');
  const jumuahTime = jumuah ? split12(jumuah.raw) : null;

  return (
    <div className="mfv-times">
      <div className="mfv-strip">
        {prayers.map((item) => {
          const isCurrent = item.prayerIdx === curIdx;
          const t = split12(item.raw);
          return (
            <div
              key={item.key}
              className="mfv-chip"
              data-current={isCurrent ? 'true' : 'false'}
            >
              {isCurrent && <span className="mfv-chip-badge">ابھی</span>}
              <span className="mfv-chip-name">{item.label}</span>
              <span className="mfv-chip-time">{t ? t.time : item.raw || '—'}</span>
              {t && <span className="mfv-chip-ampm">{t.suffix}</span>}
            </div>
          );
        })}
      </div>

      {jumuah && (
        <div className="mfv-jumuah-pill">
          <span>🕌 {jumuah.label}</span>
          <b>{jumuahTime ? `${jumuahTime.time} ${jumuahTime.suffix}` : jumuah.raw}</b>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// مسجد کا کارڈ
// ═══════════════════════════════════════════════════════════════════════════
type MosqueWithDistance = Mosque & { distance: number | null };

interface MosqueCardProps {
  mosque: MosqueWithDistance;
  showDistance: boolean;
  hasSubscribed: boolean;
  isSaved: boolean;
  isApiLoading: boolean;
  getJamaat: (mosque: Mosque, prayer: PrayerKey) => string;
  onOpen: () => void;
  onToggleNotification: (e: React.MouseEvent) => void;
  onToggleSave: (e: React.MouseEvent) => void;
}

const MosqueCard: React.FC<MosqueCardProps> = ({
  mosque,
  showDistance,
  hasSubscribed,
  isSaved,
  isApiLoading,
  getJamaat,
  onOpen,
  onToggleNotification,
  onToggleSave,
}) => {
  const [infoOpen, setInfoOpen] = useState(false);

  // ── پانچوں نمازوں کے جماعت اوقات (حساب وہی پرانا، صرف دکھانے کا انداز نیا) ──
  const raws = PRAYERS.map((p) => getJamaat(mosque, p.key));
  const secs = raws.map((r) => parseToSeconds(r));

  const stripItems: StripItem[] = PRAYERS.map((p, i) => ({
    key: p.key,
    label: p.label,
    raw: raws[i],
    kind: 'prayer',
    prayerIdx: i,
  }));
  if (mosque.jumah) {
    stripItems.push({ key: 'jumuah', label: 'جمعہ', raw: mosque.jumah, kind: 'jumuah', prayerIdx: -1 });
  }

  const jumuahSlots = mosqueJumuah(mosque);
  const updated = formatUpdated(mosque.updatedAt);
  const isStale = !!updated && updated.ageDays > STALE_DAYS;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${mosque.latitude},${mosque.longitude}`;

  return (
    <article className="mfv-card" onClick={onOpen}>
      {/* نام، پتہ، فاصلہ + بٹن */}
      <header className="mfv-card-head">
        <div className="mfv-card-title-wrap">
          <h4 className="mfv-card-name">{mosque.name}</h4>
          <p className="mfv-card-address">{mosque.address}</p>
          {showDistance && mosque.distance !== null && (
            <span className="mfv-distance">
              <MapPin size={13} />
              {mosque.distance} کلومیٹر دور
            </span>
          )}
        </div>
        <div className="mfv-card-actions">
          <button
            type="button"
            className="mfv-icon-btn mfv-bell"
            data-on={hasSubscribed}
            onClick={onToggleNotification}
            aria-label={hasSubscribed ? 'نوٹیفکیشن بند کریں' : 'نوٹیفکیشن آن کریں'}
            aria-pressed={hasSubscribed}
          >
            {hasSubscribed ? <BellRing size={17} /> : <Bell size={17} />}
          </button>
          <button
            type="button"
            className="mfv-icon-btn mfv-heart"
            data-on={isSaved}
            onClick={onToggleSave}
            aria-label={isSaved ? 'محفوظ شدہ سے ہٹائیں' : 'مسجد محفوظ کریں'}
            aria-pressed={isSaved}
          >
            <Heart size={17} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        </div>
      </header>

      {/* امام کا اعلان */}
      {mosque.announcement && (
        <div className="mfv-note">
          <Info size={15} />
          <span>{mosque.announcement}</span>
        </div>
      )}

      {/* لائیو نماز + گول کاؤنٹ ڈاؤن */}
      <LivePanel secs={secs} raws={raws} />

      {/* چھ نمازوں کی پٹی */}
      <PrayerStrip items={stripItems} secs={secs} />

      {/* جمعہ: ایک سے زیادہ جماعتیں ہوں تو الگ حصہ */}
      {jumuahSlots.length > 1 && (
        <section className="mfv-jumuah">
          <h5 className="mfv-jumuah-title">🕌 جمعہ کی نماز</h5>
          {jumuahSlots.map((slot, i) => (
            <div className="mfv-jumuah-row" key={`${slot.label}-${i}`}>
              <span>{slot.label}</span>
              <b>{format12(slot.time)}</b>
            </div>
          ))}
        </section>
      )}

      {/* خاص اوقات: رمضان + عیدین */}
      <div className="mfv-special">
        {(mosque.sehri || mosque.iftar) && (
          <section className="mfv-special-card" data-kind="ramadan">
            <h5 className="mfv-special-title">🌙 رمضان</h5>
            <div className="mfv-special-items">
              {mosque.sehri && (
                <div className="mfv-special-item">
                  <span>سحری</span>
                  <b>{format12(mosque.sehri, '04:30')}</b>
                </div>
              )}
              {mosque.iftar && (
                <div className="mfv-special-item">
                  <span>افطار</span>
                  <b>{format12(mosque.iftar, '18:30')}</b>
                </div>
              )}
            </div>
          </section>
        )}
        <section className="mfv-special-card" data-kind="eid">
          <h5 className="mfv-special-title">✨ عیدین</h5>
          <div className="mfv-special-items">
            <div className="mfv-special-item">
              <span>عیدالفطر</span>
              <b>{format12(mosque.eidFitr, '07:00')}</b>
            </div>
            <div className="mfv-special-item">
              <span>عیدالاضحیٰ</span>
              <b>{format12(mosque.eidAdha, '07:15')}</b>
            </div>
          </div>
        </section>
      </div>

      {/* مسجد کی معلومات (کھلنے والا حصہ) */}
      <button
        type="button"
        className="mfv-info-toggle"
        aria-expanded={infoOpen}
        onClick={(e) => {
          stop(e);
          setInfoOpen((v) => !v);
        }}
      >
        <span>مسجد کی معلومات</span>
        {infoOpen ? <Minus size={18} /> : <Plus size={18} />}
      </button>
      {infoOpen && (
        <div className="mfv-info" onClick={stop}>
          <div className="mfv-info-row">
            <span>مکمل پتہ</span>
            <strong>{mosque.address}</strong>
          </div>
          {mosque.imamName && (
            <div className="mfv-info-row">
              <span>امام</span>
              <strong>{mosque.imamName}</strong>
            </div>
          )}
          <a className="mfv-nav-link" href={navUrl} target="_blank" rel="noopener noreferrer">
            <Navigation size={15} />
            گوگل میپس میں راستہ دیکھیں
          </a>
        </div>
      )}

      {/* اپڈیٹ کی حالت */}
      <footer className="mfv-footer">
        <span className="mfv-updated">
          <RefreshCw size={13} data-spin={isApiLoading} />
          {isApiLoading
            ? 'اوقات اپڈیٹ ہو رہے ہیں…'
            : updated
              ? <>آخری اپڈیٹ: {updated.date}، <span dir="ltr">{updated.clock}</span></>
              : 'آخری اپڈیٹ معلوم نہیں'}
        </span>
        {updated && (
          <span className="mfv-badge" data-stale={isStale}>
            {isStale ? 'پرانا' : 'Live'}
          </span>
        )}
        {isStale && (
          <span className="mfv-stale">
            <AlertCircle size={14} />
            اوقات کافی عرصے سے اپڈیٹ نہیں ہوئے
          </span>
        )}
      </footer>
    </article>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// اسکرین
// ═══════════════════════════════════════════════════════════════════════════
interface MosqueFinderViewProps {
  nearbyMosques: Mosque[];
  userCoords: { latitude: number; longitude: number } | null;
  requestLocation: () => void;
  onOpenMosque: (mosque: Mosque) => void;
  isLoading?: boolean;
}

export const MosqueFinderView: React.FC<MosqueFinderViewProps> = ({
  nearbyMosques,
  userCoords,
  requestLocation,
  onOpenMosque,
  isLoading = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [notifPreferences, setNotifPreferences] = useState<{ [key: string]: boolean }>(() => getFollowedMosques());
  // ایپ کے اندر کا چھوٹا پیغام (براؤزر کے alert کی جگہ، جس پر سائٹ کا پتہ لکھا آتا ہے)
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = React.useRef<number | undefined>(undefined);
  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  };
  const [savedMosques, setSavedMosques] = useState<{ [key: string]: boolean }>(() => {
    try {
      const saved = localStorage.getItem('user_saved_mosques');
      if (!saved) return {};
      const list: Mosque[] = JSON.parse(saved);
      return list.reduce((acc, m) => ({ ...acc, [m.id]: true }), {});
    } catch { return {}; }
  });

  // ── جماعت کا وقت: مسجد کی اپنی سیٹنگ (آف لائن) یا پرانا API + امام کا offset ──
  const { get: getJamaat, loadingIds: apiLoadingIds } = useJamaatTimesForMany(nearbyMosques);

  const handleToggleSave = (mosque: Mosque, e: React.MouseEvent) => {
    e.stopPropagation();
    const isSaved = !!savedMosques[mosque.id];
    const updatedMap = { ...savedMosques, [mosque.id]: !isSaved };
    setSavedMosques(updatedMap);
    try {
      const allSaved: Mosque[] = JSON.parse(localStorage.getItem('user_saved_mosques') || '[]');
      let newList: Mosque[];
      if (isSaved) {
        newList = allSaved.filter(m => m.id !== mosque.id);
      } else {
        newList = [...allSaved.filter(m => m.id !== mosque.id), mosque];
      }
      localStorage.setItem('user_saved_mosques', JSON.stringify(newList));
    } catch {}
  };

  const handleToggleNotification = async (mosque: Mosque, e: React.MouseEvent) => {
    e.stopPropagation();
    const want = !notifPreferences[mosque.id];
    setNotifPreferences((prev) => ({ ...prev, [mosque.id]: want }));   // فوراً دکھائیں
    const res = await setMosqueFollow(mosque.id, want);
    if (!res.ok) {
      setNotifPreferences((prev) => ({ ...prev, [mosque.id]: !want })); // ناکام: واپس
      showToast(res.message || 'کچھ گڑبڑ ہو گئی، دوبارہ کوشش کریں۔');
    } else if (want) {
      showToast(`✅ ${mosque.name.trim()} کی جماعت کے نوٹیفکیشن آن ہو گئے`);
    }
  };

  const processedMosques: MosqueWithDistance[] = nearbyMosques
    .map((m) => ({
      ...m,
      distance: userCoords
        ? calculateDistance(userCoords.latitude, userCoords.longitude, m.latitude, m.longitude)
        : null,
    }))
    .sort((a, b) => {
      if (a.distance === null || b.distance === null) return 0;
      return a.distance - b.distance;
    });

  const q = searchQuery.trim().toLowerCase();
  const filteredMosques = processedMosques.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.address.toLowerCase().includes(q)
  );

  return (
    <NowProvider>
      <div className="mfv-root" dir="rtl">
        {toast && (
          <div
            role="status"
            style={{
              position: 'fixed', left: 16, right: 16, bottom: 96, zIndex: 1000,
              margin: '0 auto', maxWidth: 420, padding: '12px 16px',
              background: '#0f5a43', color: '#fff', borderRadius: 14,
              textAlign: 'center', fontSize: 14, fontWeight: 600, lineHeight: 1.6,
              boxShadow: '0 8px 24px rgba(0,0,0,.25)',
            }}
          >
            {toast}
          </div>
        )}

        {/* ہیڈر */}
        <section className="mfv-hero">
          <svg className="mfv-hero-mosque" viewBox="0 0 120 64" fill="currentColor" aria-hidden="true">
            <path d="M32 64V40Q32 20 60 20Q88 20 88 40V64Z" />
            <rect x="57" y="8" width="6" height="14" />
            <path d="M60 0L64 8H56Z" />
            <rect x="12" y="26" width="10" height="38" />
            <path d="M17 14L24 26H10Z" />
            <rect x="98" y="26" width="10" height="38" />
            <path d="M103 14L110 26H96Z" />
          </svg>
          <div className="mfv-hero-top">
            <span className="mfv-hero-icon"><Compass size={22} /></span>
            <div>
              <h3 className="mfv-hero-title">قریبی مساجد کے اوقات</h3>
              <p className="mfv-hero-sub">اپنے قریب مساجد کے نماز، جمعہ اور جماعت کے اوقات دیکھیں۔</p>
            </div>
          </div>
          <DigitalClock />
        </section>

        {/* سرچ */}
        <label className="mfv-search">
          <Search size={18} />
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="مسجد کا نام یا پتہ تلاش کریں..."
            aria-label="مسجد تلاش کریں"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            dir="rtl"
          />
        </label>

        {/* لوکیشن مانگنا */}
        {!userCoords && (
          <div className="mfv-locate">
            <p>
              اپنے مقام کے مطابق قریبی ترین مساجد اور ان کا فاصلہ دیکھنے کے لیے موبائل لوکیشن (GPS) تلاش کریں۔
            </p>
            <button type="button" className="mfv-btn-primary" onClick={requestLocation}>
              <MapPin size={15} />
              لوکیشن آن کریں
            </button>
          </div>
        )}

        {/* مساجد کی فہرست */}
        <div className="mfv-list">
          {isLoading ? (
            <div className="mfv-state">
              <div className="mfv-spinner" />
              <p>مساجد لوڈ ہو رہی ہیں...</p>
            </div>
          ) : filteredMosques.length === 0 ? (
            <div className="mfv-state">
              کوئی مسجد نہیں ملی۔ امام پینل سے نئی مسجد رجسٹر کریں۔
            </div>
          ) : (
            filteredMosques.map((mosque) => (
              <MosqueCard
                key={mosque.id}
                mosque={mosque}
                showDistance={!!userCoords}
                hasSubscribed={!!notifPreferences[mosque.id]}
                isSaved={!!savedMosques[mosque.id]}
                isApiLoading={apiLoadingIds.has(mosque.id)}
                getJamaat={getJamaat}
                onOpen={() => onOpenMosque(mosque)}
                onToggleNotification={(e) => handleToggleNotification(mosque, e)}
                onToggleSave={(e) => handleToggleSave(mosque, e)}
              />
            ))
          )}
        </div>
      </div>
    </NowProvider>
  );
};
