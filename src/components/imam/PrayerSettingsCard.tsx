/**
 * PrayerSettingsCard.tsx — امام پینل کے لیے «اذان کی سیٹنگ + پلس/مائنس» کارڈ
 *
 * یہ کارڈ امام کو دیتا ہے:
 *   - حساب کا طریقہ (Karachi، MWL، UmmAlQura ...)
 *   - مشرب (حنفی / شافعی — عصر کے لیے)
 *   - Fajr / Isha کا زاویہ (اختیاری، 12–20°)
 *   - ہر نماز پر ±منٹ کا آفسیٹ (دوسرا لیور)
 *   - اگلے 3 دن کا پیش نظارہ + اگلی نماز کا countdown
 *
 * یہ `mosque.prayerConfig` کو Firestore میں محفوظ کرنے کے لیے تیار payload بناتا ہے۔
 */
import React, { useMemo, useState } from 'react';
import { Clock, Sun, Moon, Compass, RotateCcw, MapPin, Info } from 'lucide-react';
import {
  ALL_PRAYER_KEYS, PrayerConfig, PrayerKey, PRAYER_LABELS_UR, PRESET_CITIES,
  computeDay, computeRange, nextPrayerInfo, toDateKey,
} from '../../lib/prayerEngine';

type MethodKey = NonNullable<PrayerConfig['method']>;

const METHODS: { key: MethodKey; label: string; hint: string }[] = [
  { key: 'Karachi', label: 'کراچی (18°/18°)', hint: 'پاکستان، بنگلہ دیش، افغانستان، ہندوستان (کچھ)' },
  { key: 'MuslimWorldLeague', label: 'مسلم ورلڈ لیگ (18°/17°)', hint: 'یورپ، مشرقِ وسطیٰ کے بہت سے ممالک' },
  { key: 'MoonsightingCommittee', label: 'Moonsighting Committee', hint: 'برطانیہ (مشرقی لندن مسجد کے قریب ترین)' },
  { key: 'UmmAlQura', label: 'ام القری (مکہ)', hint: 'سعودی عرب — عشاء اذان + 90 منٹ' },
  { key: 'Egyptian', label: 'مصری (19.5°/17.5°)', hint: 'مصر، شام، عراق کے کچھ حصے' },
  { key: 'Dubai', label: 'دبئی', hint: 'متحدہ عرب امارات' },
  { key: 'Turkey', label: 'ترکی (Diyanet)', hint: 'ترکی' },
  { key: 'NorthAmerica', label: 'ISNA (شمالی امریکہ)', hint: 'امریکہ، کینیڈا' },
  { key: 'Kuwait', label: 'کویت', hint: 'کویت' },
  { key: 'Qatar', label: 'قطر', hint: 'قطر' },
  { key: 'Singapore', label: 'سنگاپور', hint: 'سنگاپور، ملائیشیا، انڈونیشیا' },
  { key: 'Tehran', label: 'تہران', hint: 'ایران' },
];

interface PrayerSettingsCardProps {
  config: PrayerConfig;
  onChange: (config: PrayerConfig) => void;
  latitude: number;
  longitude: number;
  timeZone?: string;
  /** پیش نظارے کے دن (ڈیفالٹ 3) */
  previewDays?: number;
  className?: string;
}

export const PrayerSettingsCard: React.FC<PrayerSettingsCardProps> = ({
  config, onChange, latitude, longitude, timeZone, previewDays = 3, className = '',
}) => {
  const [showAngles, setShowAngles] = useState(false);
  const now = new Date();
  const tz = timeZone ?? config.timeZone;

  const preview = useMemo(
    () => computeRange(latitude, longitude, now, previewDays, config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [latitude, longitude, previewDays, JSON.stringify(config), toDateKey(now)]
  );
  const todayTimes = preview[0]?.times;
  const next = todayTimes ? nextPrayerInfo(todayTimes, now) : null;

  const patch = (p: Partial<PrayerConfig>) => onChange({ ...config, ...p });
  const setOffset = (key: PrayerKey, value: number) =>
    patch({ offsets: { ...(config.offsets ?? {}), [key]: value } });
  const resetOffsets = () => patch({ offsets: {} });

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
      active
        ? 'bg-emerald-600 text-white border-emerald-600'
        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
    }`;

  return (
    <div dir="rtl" className={`bg-white rounded-2xl border border-slate-200 p-4 space-y-4 ${className}`}>
      {/* سرخی */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
            <Clock size={17} className="text-emerald-700" />
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-slate-800 font-urdu">اذان کے اوقات کی سیٹنگ</p>
            <p className="text-[11px] text-slate-400 font-urdu">طریقہ + مشرب + پلس/مائنس — امام ایک بار سیٹ کرے</p>
          </div>
        </div>
        {next && (
          <div className="text-left shrink-0">
            <p className="text-[11px] text-slate-400 font-urdu">اگلی نماز</p>
            <p className="text-sm font-bold text-emerald-700 font-urdu">
              {PRAYER_LABELS_UR[next.key]} · {next.minutesLeft} منٹ
            </p>
          </div>
        )}
      </div>

      {/* شہر کے تیار پروفائل */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-500 font-urdu flex items-center gap-1">
          <MapPin size={13} /> شہر کا تیار طریقہ
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESET_CITIES.slice(0, 5).map((c) => (
            <button
              type="button"
              key={c.label}
              onClick={() => patch({ method: c.config.method, madhab: c.config.madhab, timeZone: c.tz })}
              className={chip(config.method === c.config.method && config.madhab === c.config.madhab)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* طریقہ / مشرب / بلند عرض بلد */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-[11px] font-bold text-slate-500 font-urdu">حساب کا طریقہ</span>
          <select
            value={config.method ?? 'Karachi'}
            onChange={(e) => patch({ method: e.target.value as MethodKey })}
            className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-urdu"
          >
            {METHODS.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
          <span className="mt-1 block text-[10px] text-slate-400 font-urdu">
            {METHODS.find((m) => m.key === (config.method ?? 'Karachi'))?.hint}
          </span>
        </label>

        <label className="block">
          <span className="text-[11px] font-bold text-slate-500 font-urdu">عصر کا مشرب</span>
          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => patch({ madhab: 'hanafi' })} className={chip((config.madhab ?? 'hanafi') === 'hanafi')}>
              حنفی
            </button>
            <button type="button" onClick={() => patch({ madhab: 'shafi' })} className={chip(config.madhab === 'shafi')}>
              شافعی
            </button>
          </div>
          <span className="mt-1 block text-[10px] text-slate-400 font-urdu">غلط مشرب = عصر میں 29–75 منٹ کا فرق</span>
        </label>

        <label className="block">
          <span className="text-[11px] font-bold text-slate-500 font-urdu">بلند عرض بلد (48°+ کے لیے)</span>
          <select
            value={config.highLatitudeRule ?? 'SeventhOfTheNight'}
            onChange={(e) => patch({ highLatitudeRule: e.target.value as PrayerConfig['highLatitudeRule'] })}
            className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-urdu"
          >
            <option value="SeventhOfTheNight">رات کا ساتواں حصہ</option>
            <option value="MiddleOfTheNight">رات کا نصف</option>
            <option value="TwilightAngle">زاویہ کے مطابق</option>
          </select>
          <span className="mt-1 block text-[10px] text-slate-400 font-urdu">پاکستان میں عام طور پر فرق نہیں پڑتا</span>
        </label>
      </div>

      {/* زاویے (اختیاری) */}
      <div className="border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setShowAngles((v) => !v)}
          className="text-xs font-bold text-emerald-700 font-urdu flex items-center gap-1"
        >
          <Compass size={14} /> {showAngles ? 'زاویے چھپائیں' : 'فجر/عشاء کے زاویے (ماہرین کے لیے)'}
        </button>
        {showAngles && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <label className="block">
              <span className="text-[11px] text-slate-500 font-urdu flex items-center gap-1">
                <Sun size={12} /> فجر کا زاویہ: <b className="text-emerald-700">{config.fajrAngle ?? 'خودکار'}</b>
              </span>
              <input
                type="range" min={12} max={20} step={0.5}
                value={config.fajrAngle ?? 18}
                onChange={(e) => patch({ fajrAngle: Number(e.target.value) })}
                className="w-full accent-emerald-600"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500 font-urdu flex items-center gap-1">
                <Moon size={12} /> عشاء کا زاویہ: <b className="text-emerald-700">{config.ishaAngle ?? 'خودکار'}</b>
              </span>
              <input
                type="range" min={12} max={20} step={0.5}
                value={config.ishaAngle ?? 17}
                onChange={(e) => patch({ ishaAngle: Number(e.target.value) })}
                className="w-full accent-emerald-600"
              />
            </label>
            <p className="text-[10px] text-slate-400 font-urdu sm:col-span-2">
              نوٹ: زاویہ بدلنے سے فجر/عشاء کے اوقات موسم کے ساتھ مختلف انداز میں سرکیں گے — یہی وہ لیور ہے جو صرف آفسیٹ سے نہیں بنتا۔
            </p>
          </div>
        )}
      </div>

      {/* پلس / مائنس */}
      <div className="border-t border-slate-100 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500 font-urdu">پلس / مائنس (منٹ)</p>
          <button
            type="button"
            onClick={resetOffsets}
            className="text-[11px] text-slate-500 hover:text-rose-600 font-urdu flex items-center gap-1"
          >
            <RotateCcw size={12} /> سب صفر
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          {ALL_PRAYER_KEYS.map((key) => {
            const value = config.offsets?.[key] ?? 0;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-20 text-[11px] font-bold text-slate-600 font-urdu shrink-0">
                  {PRAYER_LABELS_UR[key]}
                </span>
                <input
                  type="range" min={-30} max={30} step={1} value={value}
                  onChange={(e) => setOffset(key, Number(e.target.value))}
                  className="flex-1 accent-emerald-600"
                />
                <span className={`w-12 text-center text-xs font-bold ${value === 0 ? 'text-slate-400' : value > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {value > 0 ? `+${value}` : value}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* پیش نظارہ */}
      {preview.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs font-bold text-slate-500 font-urdu mb-2">پیش نظارہ (آپ کی سیٹنگ کے مطابق)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-urdu">
              <thead>
                <tr className="text-slate-400">
                  <th className="text-right py-1">دن</th>
                  {ALL_PRAYER_KEYS.map((k) => (
                    <th key={k} className="py-1">{PRAYER_LABELS_UR[k]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.date} className="border-t border-slate-100 text-slate-700">
                    <td className="text-right py-1 font-bold">{row.date}</td>
                    {ALL_PRAYER_KEYS.map((k) => (
                      <td key={k} className="text-center py-1">{row.times[k]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400 font-urdu flex items-start gap-1">
        <Info size={12} className="mt-0.5 shrink-0" />
        یہ اوقات ایپ ہر بار خود حساب کرے گی (انٹرنیٹ کے بغیر بھی) — یعنی یہی سیٹنگ یوزر ایپ اور گھڑی دونوں پر لگے گی۔
      </p>
    </div>
  );
};

export default PrayerSettingsCard;
