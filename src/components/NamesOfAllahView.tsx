import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, AlertTriangle, RefreshCw } from 'lucide-react';

interface NameItem { id: number; arabic: string; transliteration: string; meaning: string }

const LANGS = [
  { code: 'ur', label: 'اردو', dir: 'rtl' },
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'hi', label: 'हिन्दी', dir: 'ltr' },
] as const;
type Lang = typeof LANGS[number]['code'];

const LANG_KEY = 'steptudeen_names99_lang';
const LOCAL = '/allah99names/';
const readLang = (): Lang => {
  try { const v = localStorage.getItem(LANG_KEY); if (v === 'ur' || v === 'en' || v === 'hi') return v; } catch { /* ignore */ }
  return 'ur';
};

const valid = (v: unknown): v is NameItem[] =>
  Array.isArray(v) && v.length > 0 && v.every(x => x && typeof x.arabic === 'string' && typeof x.meaning === 'string');

const cache = new Map<Lang, NameItem[]>();

export const NamesOfAllahView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [lang, setLang] = useState<Lang>(readLang);
  const [items, setItems] = useState<NameItem[] | null>(cache.get(readLang()) || null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
    const hit = cache.get(lang);
    if (hit) { setItems(hit); setError(false); return; }
    let cancelled = false;
    setItems(null); setError(false);
    (async () => {
      try {
        const res = await fetch(`${LOCAL}${lang}.json`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: unknown = await res.json();
        if (!valid(data)) throw new Error('bad format');
        cache.set(lang, data);
        if (!cancelled) setItems(data);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [lang, attempt]);

  const dir = LANGS.find(l => l.code === lang)!.dir;
  const shown = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(n => `${n.id} ${n.arabic} ${n.transliteration} ${n.meaning}`.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="names99 px-4 pb-8 pt-3">
      <style>{`
        @font-face{font-family:"KFGQPC Uthmanic Script HAFS";src:url('/fonts/UthmanicHafs1-Ver09.woff2') format('woff2');font-display:swap}
        .names99 .n-arabic{font-family:"KFGQPC Uthmanic Script HAFS","Amiri Quran","Noto Naskh Arabic",serif;font-size:30px;line-height:1.9;color:#111}
        .names99 .n-grad{background:linear-gradient(135deg,#3b8bff 0%,#1a63d8 100%);color:#fff}
      `}</style>

      <div className="sticky top-0 z-30 mb-3 flex items-center justify-between gap-2 rounded-xl border border-black/10 bg-white p-3 shadow-sm">
        <button onClick={onBack} className="n-grad flex items-center gap-1 rounded-full px-3 py-2 text-[11px] font-bold shadow-md"><ArrowLeft size={13} /> Back</button>
        <div className="min-w-0 flex-1 truncate text-center text-xs font-bold text-black">99 Names of Allah</div>
        <div className="flex gap-1">
          {LANGS.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)}
              className={`rounded-full px-2.5 py-1.5 text-[11px] font-bold ${lang === l.code ? 'n-grad' : 'bg-slate-100 text-slate-600'}`}>{l.label}</button>
          ))}
        </div>
      </div>

      <label className="mb-3 flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 shadow-sm">
        <Search size={16} className="text-slate-500" />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or meaning…"
          className="w-full bg-transparent text-sm text-black outline-none" />
      </label>

      {!items && !error && <div className="py-14 text-center text-sm text-slate-500">Loading…</div>}
      {error && (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <AlertTriangle size={30} className="text-black" />
          <p className="text-sm text-slate-500">Couldn't load the names.</p>
          <button onClick={() => setAttempt(a => a + 1)} className="n-grad flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold"><RefreshCw size={13} /> Retry</button>
        </div>
      )}

      {items && (
        <div className="grid grid-cols-2 gap-3">
          {shown.map(n => (
            <div key={n.id} className="flex min-h-[142px] flex-col items-center justify-center rounded-2xl border border-black/10 bg-white p-3 text-center shadow-[0_3px_10px_rgba(0,0,0,.12)]">
              <span className="n-grad mb-1 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold">{n.id}</span>
              <span className="n-arabic" dir="rtl" lang="ar">{n.arabic}</span>
              <strong className="text-[13px] text-black">{n.transliteration}</strong>
              <span className="mt-1 text-[12px] leading-snug text-slate-600" dir={dir} lang={lang}>{n.meaning}</span>
            </div>
          ))}
          {shown.length === 0 && <p className="col-span-2 py-10 text-center text-sm text-slate-500">No results</p>}
        </div>
      )}
    </div>
  );
};

export default NamesOfAllahView;
