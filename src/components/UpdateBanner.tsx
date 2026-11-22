import React, { useEffect, useState } from 'react';
import { isNative } from '../utils/native';
import { APK_URL, BUILD_NUMBER, LATEST_RELEASE_API } from '../config/app';

const SKIP_KEY = 'steptudeen_update_skipped_build';

/** APK ایپ میں: نیا ورژن (GitHub Release) ہو تو نیچے ایک پیغام اور "اپڈیٹ" بٹن۔ ویب پر کچھ نہیں دکھاتا۔ */
export const UpdateBanner: React.FC = () => {
  const [latest, setLatest] = useState<number>(0);

  useEffect(() => {
    if (!isNative() || !BUILD_NUMBER) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } });
        if (!res.ok) return;
        const j = await res.json();
        const n = Number(String(j?.tag_name || '').replace(/\D/g, ''));
        let skipped = 0;
        try { skipped = Number(localStorage.getItem(SKIP_KEY)) || 0; } catch { /* ignore */ }
        if (!cancelled && n > BUILD_NUMBER && n !== skipped) setLatest(n);
      } catch { /* نیٹ نہ ہو تو خاموش */ }
    };
    check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  if (!latest) return null;
  return (
    <div className="fixed bottom-16 left-1/2 z-50 w-[calc(100%-24px)] max-w-md -translate-x-1/2 rounded-2xl border border-black/10 bg-white p-3 shadow-[0_6px_24px_rgba(0,0,0,.22)]" dir="rtl">
      <p className="mb-2 text-sm font-bold text-black">ایپ کا نیا ورژن دستیاب ہے</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { window.location.href = APK_URL; }}
          className="flex-1 rounded-full px-4 py-2 text-xs font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#3b8bff 0%,#1a63d8 100%)' }}
        >اپڈیٹ کریں</button>
        <button
          type="button"
          onClick={() => { try { localStorage.setItem(SKIP_KEY, String(latest)); } catch { /* ignore */ } setLatest(0); }}
          className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600"
        >بعد میں</button>
      </div>
    </div>
  );
};

export default UpdateBanner;
