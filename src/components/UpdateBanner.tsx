import React, { useEffect } from 'react';
import { checkForUpdate, openUpdate, skipBanner, useAppUpdate } from '../utils/appUpdate';

/** APK ایپ میں: نیا ورژن ہو تو نیچے پیغام۔ "Later" کے بعد یہ ہٹ جاتا ہے مگر مینیو میں "Update available" رہتا ہے۔ */
export const UpdateBanner: React.FC = () => {
  const { supported, bannerVisible } = useAppUpdate();

  useEffect(() => {
    if (!supported) return;
    checkForUpdate();
    const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdate(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [supported]);

  if (!bannerVisible) return null;
  return (
    <div className="fixed bottom-16 left-1/2 z-50 w-[calc(100%-24px)] max-w-md -translate-x-1/2 rounded-2xl border border-black/10 bg-white p-3 shadow-[0_6px_24px_rgba(0,0,0,.22)]" dir="ltr">
      <p className="mb-2 text-sm font-bold text-black">A new version is available</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={openUpdate}
          className="flex-1 rounded-full px-4 py-2 text-xs font-bold text-white"
          style={{ background: 'linear-gradient(135deg,#3b8bff 0%,#1a63d8 100%)' }}
        >Update</button>
        <button
          type="button"
          onClick={skipBanner}
          className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600"
        >Later</button>
      </div>
    </div>
  );
};

export default UpdateBanner;
