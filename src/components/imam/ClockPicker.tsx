/**
 * ClockPicker.tsx — ڈیش بورڈ کی «جمعہ/عید/سحری» والی گھنٹہ-منٹ-صبح/شام گھڑی، الگ کمپوننٹ کی صورت میں۔
 * شکل اور طریقہ بالکل وہی ہے (ImamDashboard کا activePicker موڈل)، تاکہ پورے پینل میں وقت ایک ہی طرح چنا جائے۔
 *
 * value: 24 گھنٹے کا "HH:MM" (خالی ہو تو defaultPm کے مطابق 12:00 سے شروع)
 * onSave: 24 گھنٹے کا "HH:MM" واپس دیتا ہے
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sunrise, Moon } from 'lucide-react';

interface ClockPickerProps {
  /** عنوان، مثلاً «فجر» — اوپر «<عنوان> کا وقت» لکھا آتا ہے */
  label: string;
  /** موجودہ وقت 24 گھنٹے "HH:MM" میں (خالی ہو سکتا ہے) */
  value: string;
  /** خالی value پر صبح/شام کی ابتدائی چوائس */
  defaultPm?: boolean;
  onSave: (value24: string) => void;
  onCancel: () => void;
}

/** "HH:MM" (24 گھنٹے) → "07:05 AM" — دکھانے کے لیے */
export const formatTo12Hour = (timeStr: string): string => {
  if (!timeStr) return '--:--';
  const [hs, ms] = timeStr.split(':');
  const h = parseInt(hs, 10);
  const m = parseInt(ms, 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
};

export const ClockPicker: React.FC<ClockPickerProps> = ({ label, value, defaultPm = true, onSave, onCancel }) => {
  const [state, setState] = useState(() => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(value || '');
    if (!m) return { hour: 12, minute: 0, isPm: defaultPm };
    const h24 = Number(m[1]);
    return { hour: h24 % 12 === 0 ? 12 : h24 % 12, minute: Number(m[2]), isPm: h24 >= 12 };
  });

  // پیچھے والے صفحے کا اسکرول بند (ڈیش بورڈ کے موڈل کی طرح)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const save = () => {
    let h24 = state.hour;
    if (state.isPm && state.hour < 12) h24 += 12;
    if (!state.isPm && state.hour === 12) h24 = 0;
    onSave(`${String(h24).padStart(2, '0')}:${String(state.minute).padStart(2, '0')}`);
  };

  const pad = (n: number) => String(n).padStart(2, '0');
  const set = (patch: Partial<typeof state>) => setState((s) => ({ ...s, ...patch }));

  const modal = (
    <div dir="rtl" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-4 touch-none overscroll-none select-none">
      <div className="bg-white rounded-3xl w-full max-w-[340px] shadow-xl overflow-hidden border border-slate-200 flex flex-col animate-fadeIn">
        <div className="bg-[#75b5ff] text-black p-4 text-center space-y-0.5">
          <div className="text-[10px] text-black font-bold uppercase tracking-wider font-urdu">وقت تبدیل کریں</div>
          <h3 className="text-sm font-bold font-urdu text-black">{label} کا وقت</h3>
          <div className="text-xl font-mono font-extrabold tracking-widest mt-1 bg-[#75b5ff] py-1 px-3 rounded-lg inline-block" dir="ltr">
            {pad(state.hour)}:{pad(state.minute)}{' '}
            <span className="text-xs">{state.isPm ? 'PM' : 'AM'}</span>
          </div>
        </div>

        <div className="p-3.5 space-y-3 text-right">
          <div className="grid grid-cols-2 gap-3">
            {/* گھنٹہ */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center font-urdu">گھنٹہ</div>
              <div className="grid grid-cols-3 gap-1">
                {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
                  <button key={h} type="button" onClick={() => set({ hour: h })}
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${state.hour === h ? 'bg-[#75b5ff] text-black' : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'}`}>
                    {pad(h)}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-1 pt-1 bg-white rounded-lg p-1 border border-slate-100">
                <button type="button" onClick={() => set({ hour: state.hour - 1 < 1 ? 12 : state.hour - 1 })}
                  className="w-6 h-6 bg-white hover:bg-slate-100 text-slate-700 rounded-md font-bold flex items-center justify-center text-xs border border-slate-200 cursor-pointer">-</button>
                <span className="text-xs font-mono font-bold text-slate-700">{pad(state.hour)}</span>
                <button type="button" onClick={() => set({ hour: state.hour + 1 > 12 ? 1 : state.hour + 1 })}
                  className="w-6 h-6 bg-white hover:bg-slate-100 text-slate-700 rounded-md font-bold flex items-center justify-center text-xs border border-slate-200 cursor-pointer">+</button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                <button type="button" onClick={() => set({ isPm: false })}
                  className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer border ${!state.isPm ? 'bg-[#75b5ff] text-black border-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                  <Sunrise size={15} /><span className="text-[10px] leading-none mt-0.5 font-urdu">صبح</span>
                </button>
                <button type="button" onClick={() => set({ isPm: true })}
                  className={`py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 transition-all cursor-pointer border ${state.isPm ? 'bg-[#75b5ff] text-black border-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                  <Moon size={15} /><span className="text-[10px] leading-none mt-0.5 font-urdu">شام</span>
                </button>
              </div>
            </div>

            {/* منٹ */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center font-urdu">منٹ</div>
              <div className="grid grid-cols-3 gap-1">
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                  <button key={m} type="button" onClick={() => set({ minute: m })}
                    className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${state.minute === m ? 'bg-[#75b5ff] text-black' : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'}`}>
                    {pad(m)}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-1 pt-1 bg-white rounded-lg p-1 border border-slate-100 mt-1">
                <button type="button" onClick={() => set({ minute: state.minute - 1 < 0 ? 59 : state.minute - 1 })}
                  className="w-6 h-6 bg-white hover:bg-slate-100 text-slate-700 rounded-md font-bold flex items-center justify-center text-xs border border-slate-200 cursor-pointer">-</button>
                <span className="text-xs font-mono font-bold text-slate-700">{pad(state.minute)}</span>
                <button type="button" onClick={() => set({ minute: state.minute + 1 > 59 ? 0 : state.minute + 1 })}
                  className="w-6 h-6 bg-white hover:bg-slate-100 text-slate-700 rounded-md font-bold flex items-center justify-center text-xs border border-slate-200 cursor-pointer">+</button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100 font-urdu">
            <button type="button" onClick={onCancel} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer">منسوخ کریں</button>
            <button type="button" onClick={save} className="flex-1 py-2 bg-[#75b5ff] hover:bg-[#96c7ff] text-black rounded-xl text-xs font-bold cursor-pointer">محفوظ کریں</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ویزرڈ کسی بھی کارڈ کے اندر ہو، موڈل پوری اسکرین پر کھلے — اس لیے body میں
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
};

export default ClockPicker;
