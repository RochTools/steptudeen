/**
 * CalibrationWizard.tsx — «مسجد کے اصل اوقات سے خودکار کیلیبریشن»
 *
 * نیا بہاؤ (کم سے کم ٹائپنگ):
 *   1) آج کا دن ایپ کے موجودہ اوقات کے ساتھ پہلے سے بھرا ہوتا ہے
 *   2) امام مسجد کے وقت سے جو وقت مختلف ہو وہ بدلتا ہے (گھڑی والا ان پٹ، ٹائپنگ نہیں)
 *      — جو وقت ایپ سے الگ ہو اس کے نیچے فرق (+3 / −2) نظر آتا ہے
 *   3) «یہ اوقات مسجد کے مطابق ہیں» دبا کر دن کی تصدیق کرتا ہے (بغیر تصدیق دن شمار نہیں ہوتے،
 *      تاکہ ایپ کے اپنے اوقات غلطی سے «مسجد کے اصل اوقات» نہ بن جائیں)
 *   4) کیلیبریٹ → نتیجہ سادہ اردو میں: پہلے کتنی غلطی تھی، اب کتنی، کس نماز میں کتنا ±،
 *      بھروسے کا درجہ، اور اگلا کون سا دن ڈالنا مفید ہے
 *
 * سالانہ ٹیبل پیسٹ والا راستہ پہلے کی طرح موجود ہے (اب 5 اوقات اور 12 گھنٹے والے ٹیبل بھی پڑھتا ہے)۔
 */
import React, { useMemo, useRef, useState } from 'react';
import { Sparkles, Plus, Trash, ClipboardPaste, Check, AlertCircle, Wand2, Clock } from 'lucide-react';
import { ClockPicker, formatTo12Hour } from './ClockPicker';
import {
  SampleDays, CalibrationReport, calibrate, configError, suggestSampleDates,
  parsePastedTable, to24h, DEMO_SAMPLES, PAKISTAN_METHODS,
} from '../../lib/calibrate';
import {
  PrayerConfig, PrayerKey, PRAYER_LABELS_UR, ALL_PRAYER_KEYS, computeDay, toDateKey, hhmmToMinutes,
} from '../../lib/prayerEngine';

// پرانی جگہوں سے import چلتا رہے
export { parsePastedTable };

interface CalibrationWizardProps {
  latitude: number;
  longitude: number;
  timeZone?: string;
  /** موجودہ سیٹنگ (پہلے سے بھرنے اور «پہلے/بعد» دکھانے کے لیے) */
  currentConfig?: PrayerConfig;
  /** «لاگو کریں» دبانے پر نیا config واپس */
  onApply: (config: PrayerConfig, report: CalibrationReport) => void;
  className?: string;
}

type Times = Record<PrayerKey, string>;
interface Row { id: number; date: string; times: Times; confirmed: boolean }

const blankTimes = (): Times => ({ fajr: '', sunrise: '', zuhr: '', asr: '', maghrib: '', isha: '' });
const isoOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

const CONF_UI = {
  high:   { text: 'بھروسہ: اچھا',    cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  medium: { text: 'بھروسہ: درمیانہ', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  low:    { text: 'بھروسہ: کم',      cls: 'bg-rose-100 text-rose-800 border-rose-200' },
} as const;

const fmtOffset = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

export const CalibrationWizard: React.FC<CalibrationWizardProps> = ({
  latitude, longitude, timeZone, currentConfig, onApply, className = '',
}) => {
  const nextId = useRef(1);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [result, setResult] = useState<{ report: CalibrationReport; before: number | null } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<{ rowId: number; key: PrayerKey } | null>(null);

  /** ایپ اس وقت جس config سے اوقات دکھا رہی ہے */
  const baseConfig = useMemo<PrayerConfig>(
    () => ({ ...(currentConfig ?? {}), timeZone: timeZone ?? currentConfig?.timeZone }),
    [currentConfig, timeZone]
  );

  const appTimesFor = (date: string): Times | null => {
    if (!isoOk(date)) return null;
    const [y, m, d] = date.split('-').map(Number);
    try { return computeDay(latitude, longitude, new Date(y, m - 1, d), baseConfig); } catch { return null; }
  };

  const makeRow = (date: string, confirmed = false, times?: Times): Row => ({
    id: nextId.current++, date, confirmed, times: times ?? appTimesFor(date) ?? blankTimes(),
  });

  const [rows, setRows] = useState<Row[]>(() => [makeRow(toDateKey(new Date()))]);

  const suggestions = useMemo(() => suggestSampleDates(rows.map((r) => r.date)), [rows]);

  // ── قطاروں کی ترمیم ──
  const setDate = (id: number, date: string) =>
    setRows((p) => p.map((r) => {
      if (r.id !== id) return r;
      // بغیر تصدیق والی قطار نئی تاریخ کے ایپ-اوقات سے دوبارہ بھر جاتی ہے
      return r.confirmed ? { ...r, date } : { ...r, date, times: appTimesFor(date) ?? r.times };
    }));
  const setTime = (id: number, key: PrayerKey, value: string) =>
    setRows((p) => p.map((r) => (r.id === id ? { ...r, confirmed: true, times: { ...r.times, [key]: value } } : r)));
  const confirmRow = (id: number) => setRows((p) => p.map((r) => (r.id === id ? { ...r, confirmed: true } : r)));
  const addRow = (date?: string) => setRows((p) => [...p, makeRow(date ?? suggestions[0] ?? toDateKey(new Date()))]);
  const removeRow = (id: number) =>
    setRows((p) => (p.length === 1 ? [makeRow(toDateKey(new Date()))] : p.filter((r) => r.id !== id)));

  const confirmedCount = rows.filter((r) => r.confirmed && isoOk(r.date)).length;

  const toSamples = (): SampleDays => {
    const samples: SampleDays = {};
    for (const r of rows) {
      if (!r.confirmed || !isoOk(r.date)) continue;
      const entry: Partial<Record<PrayerKey, string>> = {};
      for (const key of ALL_PRAYER_KEYS) {
        const v = r.times[key];
        if (v && /^\d{1,2}:\d{2}$/.test(v)) entry[key] = to24h(key, v);
      }
      if (Object.keys(entry).length >= 3) samples[r.date] = entry;
    }
    return samples;
  };

  const run = () => {
    setError('');
    const samples = toSamples();
    if (!Object.keys(samples).length) {
      setError('کم از کم ایک دن کی تصدیق کریں: مسجد کے اوقات سے ملا کر «یہ اوقات مسجد کے مطابق ہیں» دبائیں');
      return;
    }
    setBusy(true);
    // UI کو جواب دینے کا موقع دیں
    setTimeout(() => {
      try {
        const report = calibrate(latitude, longitude, samples, {
          timeZone,
          baseConfig,
          methods: timeZone === 'Asia/Karachi' ? PAKISTAN_METHODS : undefined,
        });
        setResult({ report, before: configError(latitude, longitude, samples, baseConfig) });
      } catch (e: any) {
        setError(e?.message ?? 'کیلیبریشن ناکام');
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  const loadDemo = () => {
    setRows(Object.entries(DEMO_SAMPLES).map(([date, t]) => makeRow(date, true, { ...blankTimes(), ...(t as Partial<Times>) } as Times)));
    setResult(null);
  };

  const applyPaste = () => {
    const parsed = parsePastedTable(pasteText);
    if (!parsed.length) {
      setError('کوئی سطر نہیں پڑھی گئی — فارمیٹ: تاریخ, فجر, طلوع, ظہر, عصر, مغرب, عشاء (طلوع کے بغیر 5 اوقات بھی چلیں گے)');
      return;
    }
    setError('');
    setRows(parsed.map((p) => makeRow(p.date, true, {
      fajr: p.fajr, sunrise: p.sunrise, zuhr: p.zuhr, asr: p.asr, maghrib: p.maghrib, isha: p.isha,
    })));
    setPasteMode(false);
    setPasteText('');
    setResult(null);
  };

  const report = result?.report;

  return (
    <div dir="rtl" className={`bg-white rounded-2xl border border-slate-200 p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center">
          <Wand2 size={17} className="text-violet-700" />
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-800 font-urdu">خودکار کیلیبریشن</p>
          <p className="text-[11px] text-slate-400 font-urdu">
            مسجد کے اوقات سے ملائیں، جو مختلف ہو وہ درست کریں — باقی ایپ خود نکالے گی
          </p>
        </div>
      </div>

      {/* موڈ */}
      <div className="flex gap-2">
        <button type="button" onClick={() => setPasteMode(false)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold font-urdu border ${!pasteMode ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-600'}`}>
          دن بہ دن
        </button>
        <button type="button" onClick={() => setPasteMode(true)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold font-urdu border flex items-center gap-1 ${pasteMode ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-600'}`}>
          <ClipboardPaste size={13} /> ٹیبل پیسٹ کریں
        </button>
      </div>

      {!pasteMode ? (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const app = appTimesFor(r.date);
            return (
              <div key={r.id} className={`rounded-xl border p-2.5 space-y-2 ${r.confirmed ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
                <div className="flex items-center gap-2">
                  <input
                    type="date" dir="ltr" value={r.date}
                    onChange={(e) => setDate(r.id, e.target.value)}
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[12px] font-mono"
                  />
                  <span className={`text-[10px] font-urdu font-bold px-2 py-1 rounded-full border ${r.confirmed ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                    {r.confirmed ? 'تصدیق شدہ' : 'ایپ کے اوقات'}
                  </span>
                  <button type="button" onClick={() => removeRow(r.id)} aria-label="حذف"
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-600 flex items-center justify-center">
                    <Trash size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {ALL_PRAYER_KEYS.map((k) => {
                    const v = r.times[k];
                    const diff = v && app?.[k] ? hhmmToMinutes(to24h(k, v)) - hhmmToMinutes(app[k]) : 0;
                    return (
                      <div key={k} className="block text-center">
                        <span className="block text-[10px] font-urdu text-slate-500 mb-0.5">{PRAYER_LABELS_UR[k]}</span>
                        <button type="button" onClick={() => setPicker({ rowId: r.id, key: k })}
                          className={`w-full py-2 active:scale-95 border rounded-xl text-xs text-center font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${diff ? 'bg-blue-50 border-blue-200 text-slate-900' : 'bg-white hover:bg-blue-50 border-slate-200 text-slate-800'}`}>
                          <Clock size={13} className="text-black shrink-0" /><span dir="ltr">{formatTo12Hour(v)}</span>
                        </button>
                        <span className={`block h-4 text-[10px] font-urdu ${Math.abs(diff) >= 90 ? 'text-rose-600 font-bold' : diff ? 'text-violet-700 font-bold' : 'text-transparent'}`}>
                          {diff ? (Math.abs(diff) >= 90 ? 'AM/PM دیکھیں' : `ایپ سے ${fmtOffset(diff)} منٹ`) : '·'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {!r.confirmed && (
                  <button type="button" onClick={() => confirmRow(r.id)}
                    className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold font-urdu flex items-center justify-center gap-1">
                    <Check size={13} /> یہ اوقات مسجد کے مطابق ہیں
                  </button>
                )}
              </div>
            );
          })}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <button type="button" onClick={() => addRow()} className="text-[11px] font-urdu text-emerald-700 flex items-center gap-1">
              <Plus size={13} /> ایک اور دن
            </button>
            <button type="button" onClick={loadDemo} className="text-[11px] font-urdu text-slate-500 flex items-center gap-1">
              <Sparkles size={13} /> نمونہ (ٹیسٹ)
            </button>
          </div>
          <p className="text-[10px] text-slate-400 font-urdu leading-relaxed">
            ایک دن کافی ہے تو صرف ±منٹ درست ہوں گے۔ فجر/عشاء پورے سال ٹھیک رکھنے کے لیے کم از کم دو ایسے دن ڈالیں جن میں دو ماہ سے زیادہ فاصلہ ہو (مثلاً جون اور دسمبر)۔
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            dir="ltr" value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={5}
            placeholder={'2026-06-21, 04:20, 05:44, 12:37, 17:09, 19:30, 20:55\n21-12-2026  5:52  12:31  3:30  5:52  7:10   (5 اوقات، 12 گھنٹے بھی چلے گا)'}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-[11px] font-mono"
          />
          <button type="button" onClick={applyPaste}
            className="px-3 py-1.5 rounded-xl text-xs font-bold font-urdu bg-emerald-600 text-white">
            پیسٹ کریں ({parsePastedTable(pasteText).length} دن)
          </button>
        </div>
      )}

      <button type="button" onClick={run} disabled={busy || confirmedCount === 0}
        className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold font-urdu disabled:opacity-50">
        {busy ? 'حساب ہو رہا ہے…' : confirmedCount ? `کیلیبریٹ کریں (${confirmedCount} دن)` : 'پہلے ایک دن کی تصدیق کریں'}
      </button>

      {error && (
        <p className="text-[11px] text-rose-600 font-urdu flex items-start gap-1">
          <AlertCircle size={13} className="shrink-0 mt-0.5" /> {error}
        </p>
      )}

      {report && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-emerald-800 font-urdu">
              {report.method} · {report.madhab === 'hanafi' ? 'حنفی' : 'شافعی'} · {report.samples} دن
            </p>
            <span className={`text-[10px] font-urdu font-bold px-2 py-0.5 rounded-full border ${CONF_UI[report.confidence].cls}`}>
              {CONF_UI[report.confidence].text}
            </span>
          </div>

          {result?.before != null && (
            <p className="text-[11px] text-emerald-900 font-urdu">
              {result.before <= 1 && report.overallWorst <= 1
                ? 'موجودہ سیٹنگ پہلے ہی مسجد کے مطابق ہے۔'
                : <>موجودہ سیٹنگ کی غلطی: <b>±{result.before} منٹ</b> ← کیلیبریشن کے بعد: <b>±{report.overallWorst} منٹ</b></>}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-urdu">
              <thead>
                <tr className="text-emerald-800/70">
                  <th className="text-right py-1 font-normal">نماز</th>
                  <th className="font-normal">ایپ کے وقت میں</th>
                  <th className="font-normal">باقی فرق</th>
                </tr>
              </thead>
              <tbody>
                {ALL_PRAYER_KEYS.map((k) => {
                  const r = report.perPrayer[k];
                  if (!r) return null;
                  return (
                    <tr key={k} className="border-t border-emerald-100 text-emerald-950">
                      <td className="text-right py-1 font-bold">{PRAYER_LABELS_UR[k]}</td>
                      <td className="text-center font-mono" dir="ltr">
                        {r.offset === 0 ? 'کوئی تبدیلی نہیں' : `${fmtOffset(r.offset)} منٹ`}
                      </td>
                      <td className="text-center">±{r.worstErr} منٹ</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {report.anglesTuned && (
            <p className="text-[10px] font-urdu text-emerald-900/70">
              فجر/عشاء کا زاویہ بھی مسجد کے مطابق ایڈجسٹ ہوا ({report.config.fajrAngle ? `فجر ${report.config.fajrAngle}°` : ''}{report.config.fajrAngle && report.config.ishaAngle ? ' · ' : ''}{report.config.ishaAngle ? `عشاء ${report.config.ishaAngle}°` : ''}).
            </p>
          )}

          {report.warnings.map((w) => (
            <p key={w} className="text-[11px] text-amber-800 font-urdu flex items-start gap-1">
              <AlertCircle size={13} className="shrink-0 mt-0.5" /> {w}
            </p>
          ))}

          {report.suspects.length > 0 && (
            <ul className="text-[11px] text-rose-700 font-urdu space-y-0.5">
              {report.suspects.map((s) => (
                <li key={`${s.date}-${s.prayer}`}>
                  <span dir="ltr" className="font-mono">{s.date}</span> کی {PRAYER_LABELS_UR[s.prayer]}: باقی دنوں سے {s.errorMinutes} منٹ ہٹی ہوئی — کیا وقت درست لکھا ہے؟
                </li>
              ))}
            </ul>
          )}

          {report.confidence !== 'high' && suggestions.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-urdu text-emerald-900/70">نتیجہ بہتر کرنے کے لیے ان میں سے کوئی دن بھی شامل کریں:</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((d) => (
                  <button key={d} type="button" onClick={() => { setPasteMode(false); addRow(d); }}
                    className="px-2 py-1 rounded-lg bg-white border border-emerald-200 text-[11px] font-mono text-emerald-800 flex items-center gap-1">
                    <Plus size={11} /> {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {report.comparedMethods.length > 1 && (
            <details className="text-[10px] font-urdu text-emerald-900/80">
              <summary className="cursor-pointer">دوسرے طریقوں کا موازنہ</summary>
              <ul className="mt-1 space-y-0.5">
                {report.comparedMethods.map((m) => (
                  <li key={m.method + m.madhab}>
                    {m.method} ({m.madhab === 'hanafi' ? 'حنفی' : 'شافعی'}) — زیادہ سے زیادہ ±{m.worst} منٹ
                  </li>
                ))}
              </ul>
            </details>
          )}

          <button type="button" onClick={() => onApply(report.config, report)}
            className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold font-urdu flex items-center justify-center gap-1">
            <Check size={14} /> یہ سیٹنگ لاگو کریں
          </button>
        </div>
      )}

      {picker && (() => {
        const row = rows.find((x) => x.id === picker.rowId);
        if (!row) return null;
        return (
          <ClockPicker
            label={PRAYER_LABELS_UR[picker.key]}
            value={row.times[picker.key]}
            defaultPm={picker.key !== 'fajr' && picker.key !== 'sunrise'}
            onCancel={() => setPicker(null)}
            onSave={(v) => { setTime(picker.rowId, picker.key, v); setPicker(null); }}
          />
        );
      })()}
    </div>
  );
};

export default CalibrationWizard;
