import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BookOpen, ChevronRight, Search, RefreshCw, X, Layers, Globe, AlertCircle } from 'lucide-react';
import { loadDuaChapters, loadDuaSummaries, loadDuaInfo, loadDuaEntry } from '../lib/openDua';
import type { ApiResult, DuaStep, DuaReference, DuaEntry, DuaChapter, DuaSummary, DuaApiInfo } from '../lib/openDua';

const IA_DUAS: { c: string; ar: string; ur: string }[] = [
  {c:"صبح اٹھ کر پڑھنے کی دعا",ar:"أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ",ur:"ہم نے صبح کی اور سارا ملک اللہ ہی کا ہے، اور سب تعریف اللہ کے لیے ہے۔"},
  {c:"رات کو سونے کی دعا",ar:"بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا",ur:"اے اللہ! تیرے نام کے ساتھ میں مرتا ہوں اور جیتا ہوں۔"},
  {c:"کھانا شروع کرنے کی دعا",ar:"بِسْمِ اللَّهِ وَعَلَى بَرَكَةِ اللَّهِ",ur:"میں اللہ کے نام سے اور اللہ کی برکت کے ساتھ کھانا شروع کرتا ہوں۔"},
  {c:"کھانے کے بعد کی دعا",ar:"الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِينَ",ur:"سب تعریفیں اللہ ہی کے لیے ہیں جس نے ہمیں کھلایا پلایا اور مسلمان بنایا۔"},
  {c:"گھر سے نکلتے وقت کی دعا",ar:"بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ",ur:"اللہ کے نام کے ساتھ، میں نے اللہ پر توکل کیا، ہر طاقت اللہ ہی سے ہے۔"},
  {c:"گھر میں داخل ہوتے وقت کی دعا",ar:"اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ الْمَوْلِجِ وَخَيْرَ الْمَخْرَجِ",ur:"اے اللہ! میں تجھ سے گھر داخل ہونے اور باہر نکلنے کی بھلائی کا طالب ہوں۔"},
  {c:"مسجد میں داخل ہونے کی دعا",ar:"اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ",ur:"اے اللہ! میرے لیے اپنی رحمت کے دروازے کھول دے۔"},
  {c:"مسجد سے نکلتے وقت کی دعا",ar:"اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ",ur:"اے اللہ! میں تجھ سے تیرے فضل کا سوال کرتا ہوں۔"},
  {c:"استغفار کی جامع دعا",ar:"أَسْتَغْفِرُ اللَّهَ الَّذِي لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ وَأَتُوبُ إِلَيْهِ",ur:"میں اس اللہ سے معافی مانگتا ہوں جس کے سوا کوئی معبود نہیں، جو ہمیشہ زندہ اور قائم ہے اور اسی کی طرف رجوع کرتا ہوں۔"},
  {c:"پریشانی اور مصیبت کی دعا",ar:"لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ",ur:"تیرے سوا کوئی معبود نہیں، تو پاک ہے، بے شک میں ہی قصوروار تھا۔"}
];

interface Library { chapters: DuaChapter[]; entries: DuaSummary[]; info: DuaApiInfo | null }
function useResource<T>(loader: (signal: AbortSignal) => Promise<ApiResult<T>> | null) {
  const [state, setState] = useState<{ result: ApiResult<T> | null; loading: boolean; error: string }>({ result: null, loading: true, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    const promise = loader(controller.signal);
    if (!promise) { setState({ result: null, loading: false, error: '' }); return () => controller.abort(); }
    setState({ result: null, loading: true, error: '' });
    promise.then(result => {
      if (!controller.signal.aborted) setState({ result, loading: false, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ result: null, loading: false, error: error instanceof Error ? error.message : 'Could not load this content.' });
    });
    return () => controller.abort();
  }, [loader]);
  return state;
}
export function DuaBrandLoader() {
  return <div className="dv-loader" role="status" aria-live="polite">
    <div className="dv-brand-word" aria-hidden="true">{'StepTuDeen'.split('').map((letter, index) => <span key={index} style={{ animationDelay: `${index * .075}s` }}>{letter}</span>)}</div>
    <div className="dv-loader-track" aria-hidden="true"><span /></div>
    <p>StepTuDeen — Loading duas…</p>
  </div>;
}
function References({ values }: { values?: DuaReference[] }) {
  if (!values?.length) return null;
  return <div className="dv-references"><span className="dv-label">References supplied by OpenDua</span>{values.map((ref, index) => <p key={index}>{ref.reference}{ref.grades?.map((grade, i) => <span key={i}> · {grade.value}{grade.gradedBy ? ` (${grade.gradedBy})` : ''}</span>)}</p>)}</div>;
}
function Steps({ steps, transliteration }: { steps: DuaStep[]; transliteration: boolean }) {
  return <div className="dv-steps">{steps.map((step, index) => {
    if (step.type === 'repeat') return <section className="dv-repeat" key={index}><span className="dv-pill">Repeat this sequence {step.times} times</span><Steps steps={step.steps} transliteration={transliteration}/><References values={step.references}/></section>;
    if (step.type === 'recitation') return <section className="dv-step" key={index}>
      {step.condition && <p className="dv-note">{step.condition}</p>}
      {step.speaker && <p className="dv-note">Speaker: {step.speaker}</p>}
      {step.items.map((item, i) => <div className="dv-dua-text" key={`${item.dua.id}-${i}`}>
        <div className="dv-row dv-spread"><span className="dv-label">{item.dua.id}</span>{item.times && <span className="dv-pill">Repeat {item.times} times</span>}</div>
        <p className="dv-arabic font-amiri" dir="rtl" lang="ar">{item.dua.arabic}</p>
        {transliteration && item.dua.transliteration && <div className="dv-text-block"><span className="dv-label">Transliteration</span><p className="dv-transliteration">{item.dua.transliteration}</p></div>}
        <div className="dv-text-block"><span className="dv-label">English translation</span><p>{item.dua.translation}</p></div>
        {item.dua.placeholders?.map(placeholder => <p className="dv-note" key={placeholder.key}>{placeholder.instruction}</p>)}
        <References values={item.dua.references}/>
      </div>)}
      <References values={step.references}/>
    </section>;
    return <section className="dv-step" key={index}><span className="dv-pill">{step.type === 'instruction' ? 'Instruction' : 'Narration'}</span>{step.arabic && <p className="dv-arabic font-amiri" dir="rtl" lang="ar">{step.arabic}</p>}<p className="dv-context">{step.text}</p><References values={step.references}/></section>;
  })}</div>;
}
function EntryReader({ entry, transliteration }: { entry: DuaEntry; transliteration: boolean }) {
  return <article className="dv-card dv-reader">
    <header className="dv-reader-heading"><span className="dv-pill">{entry.type}</span><h2>{entry.title}</h2>{entry.sourceReference && <p className="dv-muted">Hisn al-Muslim · Entry {entry.sourceReference}</p>}</header>
    {entry.variations?.map((variation, i) => <section className="dv-variation" key={variation.id}>
      {(variation.label || entry.variations!.length > 1) && <h3>{variation.label || `Variation ${i + 1}`}</h3>}
      {variation.condition && <p className="dv-note">{variation.condition}</p>}
      <Steps steps={variation.steps} transliteration={transliteration}/><References values={variation.references}/>
    </section>)}
    {entry.steps && <Steps steps={entry.steps} transliteration={transliteration}/>}
    <References values={entry.references}/>
  </article>;
}
const normalize = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g, '');
const PAGE_SIZE = 16;
export const DuasView: React.FC = () => {
  const [source, setSource] = useState<'opendua' | 'urdu'>('opendua');
  const [mode, setMode] = useState<'chapters' | 'entries'>('chapters');
  const [chapter, setChapter] = useState<DuaChapter | null>(null);
  const [selected, setSelected] = useState<DuaSummary | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [entryRetry, setEntryRetry] = useState(0);
  const [transliteration, setTransliteration] = useState(true);
  const libraryLoader = useCallback(async (signal: AbortSignal): Promise<ApiResult<Library>> => {
    const [chapters, entries, info] = await Promise.all([loadDuaChapters(signal, retry > 0), loadDuaSummaries(signal, undefined, retry > 0), loadDuaInfo(signal, retry > 0).catch(() => null)]);
    return { data: { chapters: chapters.data, entries: entries.data, info: info?.data || null }, cached: chapters.cached || entries.cached, savedAt: Math.min(chapters.savedAt, entries.savedAt) };
  }, [retry]);
  const library = useResource(libraryLoader);
  const chapterLoader = useCallback((signal: AbortSignal) => chapter && source === 'opendua' ? loadDuaSummaries(signal, chapter.id, retry > 0) : null, [chapter, source, retry]);
  const chapterState = useResource(chapterLoader);
  const entryLoader = useCallback((signal: AbortSignal) => selected && source === 'opendua' ? loadDuaEntry(selected.id, signal, entryRetry > 0) : null, [selected, source, entryRetry]);
  const entryState = useResource(entryLoader);
  const search = normalize(query.trim());
  const items = chapter ? chapterState.result?.data || [] : mode === 'chapters' ? library.result?.data.chapters || [] : library.result?.data.entries || [];
  const filtered = useMemo(() => items.filter(item => normalize(`${item.title} ${item.id} ${'sourceReference' in item ? item.sourceReference : ''}`).includes(search)), [items, search]);
  const local = IA_DUAS.filter(item => normalize(`${item.c} ${item.ar} ${item.ur}`).includes(search));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const listState = chapter ? chapterState : library;
  const info = library.result?.data.info;
  const resetSearch = () => { setQuery(''); setPage(1); };
  const changeSource = (next: 'opendua' | 'urdu') => { setSource(next); setSelected(null); setChapter(null); setEntryRetry(0); resetSearch(); };
  const back = () => {
    if (selected) { setSelected(null); setEntryRetry(0); }
    else if (chapter) { setChapter(null); resetSearch(); }
  };
  const failure = (message: string, onRetry: () => void) => <div className="dv-card dv-empty" role="alert"><AlertCircle size={25}/><h3>Content could not be loaded</h3><p>{message}</p><button className="dv-btn" onClick={onRetry}><RefreshCw size={15}/> Try again</button><p className="font-urdu" dir="rtl">پہلے سے موجود اردو دعائیں دوسرے ٹیب میں دستیاب ہیں۔</p></div>;

  return <main className="dv" dir="ltr">
    <style>{`
      .dv{--dv-blue:#75b5ff;--dv-ink:#080808;min-height:100vh;background:#fff;color:var(--dv-ink);padding:22px 16px 90px;font-family:inherit;box-sizing:border-box}
      .dv *{box-sizing:border-box}.dv button,.dv input{font:inherit}.dv button{cursor:pointer}.dv h1,.dv h2,.dv h3,.dv p{margin:0}.dv .dv-shell{max-width:980px;margin:auto}
      .dv .dv-card{background:#fff;border:1px solid #0000000e;border-radius:22px;box-shadow:0 12px 30px #00000008,0 3px 7px #00000006}
      .dv .dv-hero{border-top:3px solid var(--dv-blue);padding:26px 22px;margin-bottom:22px}.dv .dv-row{display:flex;align-items:center;gap:10px}.dv .dv-spread{justify-content:space-between;flex-wrap:wrap}.dv .dv-icon{display:grid;place-items:center;width:46px;height:46px;border-radius:15px;background:var(--dv-blue);flex-shrink:0}
      .dv .dv-kicker{font-size:10px;font-weight:800;letter-spacing:.18em;opacity:.55;margin-bottom:6px}.dv h1{font-size:29px;font-weight:800;letter-spacing:-.035em;line-height:1.4}.dv .dv-hero-description{font-size:13px;opacity:.65;line-height:1.9;margin-top:12px}.dv .dv-stats{display:flex;gap:20px;border-top:1px solid #0000000c;margin-top:20px;padding-top:18px}.dv .dv-stats strong{font-size:23px;letter-spacing:-.04em;display:block}.dv .dv-stats span{font-size:10px;opacity:.55}
      .dv .dv-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--dv-blue);color:#000;border:1px solid #00000010;border-radius:12px;padding:10px 14px;min-height:42px;font-size:12px;font-weight:700;box-shadow:0 3px 0 #00000010;transition:background .15s,box-shadow .15s}.dv .dv-btn:hover{background:#96c7ff;box-shadow:0 5px 12px #00000012}.dv button:focus-visible,.dv input:focus-visible{outline:3px solid #1680ef;outline-offset:3px}.dv .dv-btn:disabled{opacity:.4;cursor:not-allowed}
      .dv .dv-tabs{display:flex;gap:10px;margin-bottom:18px}.dv .dv-tabs .dv-btn{flex:1;background:#d9eaff;box-shadow:none}.dv .dv-tabs .dv-active{background:var(--dv-blue);box-shadow:0 3px 0 #00000015;border-color:#3284de}
      .dv .dv-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap}.dv .dv-search{display:flex;align-items:center;gap:10px;border:1px solid #00000018;box-shadow:0 3px 10px #00000004;border-radius:14px;padding:7px 12px;flex:1;min-width:180px;min-height:46px}.dv .dv-search input{background:#fff;color:#000;border:0;width:100%;min-width:0;font-size:12px;padding:5px 0;outline:none}.dv .dv-clear{background:var(--dv-blue);border:0;border-radius:8px;display:grid;place-items:center;min-width:30px;min-height:30px;color:#000}
      .dv .dv-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:20px 0 14px}.dv .dv-section-head h2{font-size:15px;font-weight:800}.dv .dv-count{font-size:11px;padding:6px 9px;border:1px solid #00000015;border-radius:8px}.dv .dv-catalogue{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
      .dv .dv-catalogue-card{padding:18px;text-align:left;display:flex;flex-direction:column;gap:13px;transition:box-shadow .2s;color:#000;width:100%}.dv .dv-catalogue-card:hover{box-shadow:0 14px 30px #00000010;border-color:#75b5ff}.dv .dv-catalogue-card h3{font-size:13px;font-weight:700;line-height:1.65;overflow-wrap:anywhere}.dv .dv-catalogue-card .dv-open{display:inline-flex;align-items:center;gap:6px;background:var(--dv-blue);color:#000;font-size:10px;font-weight:700;border-radius:8px;padding:6px 9px}.dv .dv-card-number{font-size:10px;opacity:.5;font-weight:700}.dv .dv-card-bottom{margin-top:auto}
      .dv .dv-muted{font-size:11px;opacity:.58;line-height:1.7}.dv .dv-note{font-size:12px;line-height:1.8;padding:12px 14px;border:1px solid #bcd9fc;border-inline-start:3px solid var(--dv-blue);border-radius:10px;margin:12px 0!important}.dv .dv-cache{font-size:10px;opacity:.6;margin:10px 0 16px;line-height:1.7}.dv .dv-pagination{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:22px}.dv .dv-pagination span{font-size:11px;opacity:.65}
      .dv .dv-reader{padding:24px 20px}.dv .dv-reader-heading{border-bottom:1px solid #0000000d;padding-bottom:19px;margin-bottom:20px}.dv .dv-reader-heading h2{font-size:20px;line-height:1.6;font-weight:800;margin:12px 0 8px;letter-spacing:-.025em}.dv .dv-pill{display:inline-flex;font-size:10px;font-weight:700;padding:6px 10px;border:1px solid #00000018;border-radius:8px}.dv .dv-label{display:block;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.5;margin-bottom:6px}.dv .dv-steps{display:grid;gap:20px}.dv .dv-step+.dv-step{border-top:1px solid #00000010;padding-top:20px}.dv .dv-dua-text+.dv-dua-text{border-top:1px solid #00000010;margin-top:22px;padding-top:22px}.dv .dv-arabic{font-size:clamp(30px,6vw,38px);line-height:2.2;text-align:right;color:#000;margin:18px 0 24px;overflow-wrap:anywhere}.dv .dv-text-block{border-top:1px solid #0000000a;padding-top:15px;margin-top:15px}.dv .dv-text-block p,.dv .dv-context{font-size:14px;line-height:1.95;overflow-wrap:anywhere}.dv .dv-context{margin-top:12px}.dv .dv-transliteration{font-style:italic;opacity:.72}.dv .dv-variation+.dv-variation{border-top:2px solid #75b5ff;margin-top:24px;padding-top:22px}.dv .dv-variation h3{font-size:14px;margin-bottom:14px}.dv .dv-repeat{border-inline-start:3px solid #75b5ff;padding-inline-start:15px}.dv .dv-repeat>.dv-pill{margin-bottom:14px}.dv .dv-references{border-top:1px solid #00000012;margin-top:18px;padding-top:14px}.dv .dv-references p{font-size:11px;line-height:1.85}.dv .dv-local{display:grid;gap:18px}.dv .dv-local h3{font-size:15px;line-height:1.9}.dv .dv-local .dv-urdu{font-size:14px;line-height:2.2;text-align:right;border-top:1px solid #00000010;padding-top:15px}
      .dv .dv-loader{padding:56px 12px;text-align:center}.dv .dv-brand-word{display:flex;justify-content:center;font-size:29px;font-weight:800;letter-spacing:-.03em}.dv .dv-brand-word span{display:inline-block;animation:dv-brand-wave 1.35s ease-in-out infinite}.dv .dv-loader p{font-size:11px;opacity:.55;margin-top:17px}.dv .dv-loader-track{width:100px;height:3px;background:#0000000b;border-radius:10px;overflow:hidden;margin:16px auto 0}.dv .dv-loader-track span{display:block;width:40%;height:100%;background:var(--dv-blue);animation:dv-loader-slide 1.4s ease-in-out infinite}.dv .dv-empty{display:flex;flex-direction:column;align-items:center;gap:14px;padding:38px 20px;text-align:center}.dv .dv-empty h3{font-size:14px}.dv .dv-empty p{font-size:12px;line-height:1.8;opacity:.65}.dv .dv-footer{border-top:1px solid #0000000c;padding-top:20px;margin-top:30px;font-size:10px;line-height:1.9;opacity:.65}.dv .dv-footer a{color:#000;text-decoration:underline;text-underline-offset:3px}
      @keyframes dv-brand-wave{0%,65%,100%{transform:translateY(0);color:#080808}30%{transform:translateY(-7px);color:#1680ef}}@keyframes dv-loader-slide{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}
      @media(min-width:700px){.dv{padding:30px 24px 90px}.dv .dv-catalogue{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:360px){.dv .dv-catalogue{grid-template-columns:1fr}.dv .dv-stats{gap:15px}.dv .dv-btn{padding:9px 11px}}@media(prefers-reduced-motion:reduce){.dv .dv-brand-word span,.dv .dv-loader-track span{animation:none}.dv *{transition:none!important}}
    `}</style>
    <div className="dv-shell">
      <header className="dv-card dv-hero"><div className="dv-row dv-spread"><div><p className="dv-kicker">StepTuDeen · Daily remembrance</p><h1>Dua Library</h1></div><span className="dv-icon"><BookOpen size={23}/></span></div><p className="dv-hero-description font-urdu" dir="rtl">ہر لمحے کے لیے دعا — پڑھیں، سمجھیں اور یاد رکھیں۔</p>
        <div className="dv-stats"><div><strong>{library.result?.data.chapters.length ?? '—'}</strong><span>Chapters</span></div><div><strong>{library.result?.data.entries.length ?? '—'}</strong><span>Entries</span></div><div><strong>{info?.counts.duas ?? '—'}</strong><span>Canonical duas</span></div></div>
      </header>
      <nav className="dv-tabs" aria-label="Dua collection"><button className={`dv-btn ${source === 'opendua' ? 'dv-active' : ''}`} aria-pressed={source === 'opendua'} onClick={() => changeSource('opendua')}><Globe size={15}/> OpenDua Library</button><button className={`dv-btn font-urdu ${source === 'urdu' ? 'dv-active' : ''}`} aria-pressed={source === 'urdu'} onClick={() => changeSource('urdu')}>موجودہ اردو دعائیں</button></nav>
      {source === 'opendua' && <p className="dv-muted" style={{marginBottom:16}}>Hisn al-Muslim · Arabic text with English translation. Includes invocations, instructions and narrations.</p>}
      {(selected || chapter) && source === 'opendua' && <div className="dv-toolbar"><button className="dv-btn" onClick={back}><ArrowLeft size={15}/>{selected ? 'Back to entries' : 'All chapters'}</button>{selected && <button className="dv-btn" aria-pressed={transliteration} onClick={() => setTransliteration(value => !value)}>{transliteration ? 'Hide' : 'Show'} transliteration</button>}</div>}
      {!selected && <div className="dv-toolbar"><label className="dv-search"><Search size={17} aria-hidden="true"/><input aria-label={source === 'urdu' ? 'Search Urdu duas' : 'Search chapter or entry titles'} placeholder={source === 'urdu' ? 'دعا تلاش کریں…' : 'Search titles or entry numbers…'} value={query} onChange={event => {setQuery(event.target.value);setPage(1);}}/>{query && <button type="button" className="dv-clear" aria-label="Clear search" onClick={resetSearch}><X size={14}/></button>}</label>{source === 'opendua' && <button className="dv-btn" aria-label="Refresh OpenDua library" disabled={listState.loading} onClick={() => setRetry(value => value + 1)}><RefreshCw size={16}/></button>}</div>}
      {source === 'urdu' ? <>
        <p className="dv-note font-urdu" dir="rtl">یہ ایپ کا پہلے سے موجود اردو مجموعہ ہے، OpenDua کا اردو ترجمہ نہیں۔</p><div className="dv-local">{local.map((dua, index) => <article className="dv-card dv-reader" key={dua.c}><div className="dv-row dv-spread"><span className="dv-card-number">DUA {index + 1}</span><h3 className="font-urdu" dir="rtl">{dua.c}</h3></div><p className="dv-arabic font-amiri" dir="rtl" lang="ar">{dua.ar}</p><p className="dv-urdu font-urdu" dir="rtl" lang="ur">{dua.ur}</p></article>)}</div>{!local.length && <div className="dv-empty"><Search size={25}/><h3>No matching duas</h3><button className="dv-btn" onClick={resetSearch}>Clear search</button></div>}
      </> : selected ? <>
        {entryState.loading ? <DuaBrandLoader/> : entryState.error ? failure(entryState.error, () => setEntryRetry(value => value + 1)) : entryState.result && <>
          {entryState.result.cached && <p className="dv-cache">Saved copy · {new Date(entryState.result.savedAt).toLocaleString()} <button className="dv-btn" onClick={() => setEntryRetry(value => value + 1)}>Refresh</button></p>}
          <EntryReader entry={entryState.result.data} transliteration={transliteration}/>
        </>}
      </> : <>
        {!chapter && <div className="dv-tabs" aria-label="Browse mode"><button className={`dv-btn ${mode === 'chapters' ? 'dv-active' : ''}`} aria-pressed={mode === 'chapters'} onClick={() => {setMode('chapters');resetSearch();}}><Layers size={14}/> Chapters</button><button className={`dv-btn ${mode === 'entries' ? 'dv-active' : ''}`} aria-pressed={mode === 'entries'} onClick={() => {setMode('entries');resetSearch();}}>All entries <ArrowUpRight size={14}/></button></div>}
        {listState.loading ? <DuaBrandLoader/> : listState.error ? failure(listState.error, () => setRetry(value => value + 1)) : <>
          {listState.result?.cached && <p className="dv-cache">Showing a saved copy · {new Date(listState.result.savedAt).toLocaleString()}. Use Refresh to check for updates.</p>}
          <div className="dv-section-head"><h2>{chapter?.title || (mode === 'chapters' ? 'Find a moment. Find a dua.' : 'All entries')}</h2><span className="dv-count">{filtered.length}</span></div>
          {!filtered.length ? <div className="dv-card dv-empty"><Search size={25}/><h3>No matching results</h3><p>Try a shorter English title or an entry number.</p><button className="dv-btn" onClick={resetSearch}>Clear search</button></div> : <div className="dv-catalogue">{filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE).map(item => {
            const isChapter = 'entryCount' in item;
            return <button className="dv-card dv-catalogue-card" key={item.id} onClick={() => { if (isChapter) {setChapter(item as DuaChapter);resetSearch();} else {setSelected(item as DuaSummary);setEntryRetry(0);} }}>
              <div className="dv-row dv-spread"><span className="dv-card-number">{isChapter ? `CHAPTER ${(item as DuaChapter).number || item.id.split('-').pop()}` : `ENTRY ${(item as DuaSummary).sourceReference || item.id.split('-').pop()}`}</span><BookOpen size={15}/></div><h3>{item.title}</h3><div className="dv-row dv-spread dv-card-bottom"><span className="dv-muted">{isChapter ? `${(item as DuaChapter).entryCount} entries` : (item as DuaSummary).type}</span><span className="dv-open">Open <ChevronRight size={12}/></span></div>
            </button>;
          })}</div>}
          {pages > 1 && <nav className="dv-pagination" aria-label="Library pages"><button className="dv-btn" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}><ArrowLeft size={14}/> Previous</button><span>{safePage} / {pages}</span><button className="dv-btn" disabled={safePage === pages} onClick={() => setPage(safePage + 1)}>Next <ChevronRight size={14}/></button></nav>}
        </>}
      </>}
      <footer className="dv-footer">API text: <a href="https://opendua.org" target="_blank" rel="noopener noreferrer">OpenDua</a> · Hisn al-Muslim{info?.dataVersion ? ` · Data ${info.dataVersion}` : ''}<br/><a href="https://opendua.org/licence/data" target="_blank" rel="noopener noreferrer">OpenDua data licence</a> · Text and references displayed as supplied; no generated translations.</footer>
    </div>
  </main>;
};
export default DuasView;
