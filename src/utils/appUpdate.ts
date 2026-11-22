import { useEffect, useState } from 'react';
import { isNative } from './native';
import { APK_URL, BUILD_NUMBER, LATEST_RELEASE_API } from '../config/app';

/* APK کے نئے ورژن کی جانچ — ایک ہی جگہ (store) تاکہ نیچے کا بینر اور مینیو کی آئٹم ایک ہی حالت دکھائیں۔ */
export type UpdateStatus = 'idle' | 'checking' | 'available' | 'uptodate' | 'error';

const SKIP_KEY = 'steptudeen_update_skipped_build';
let status: UpdateStatus = 'idle';
let latestBuild = 0;
let skippedBuild = 0;
try { skippedBuild = Number(localStorage.getItem(SKIP_KEY)) || 0; } catch { /* ignore */ }

const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export async function checkForUpdate(): Promise<void> {
  if (!isNative() || !BUILD_NUMBER) return;
  status = 'checking'; emit();
  try {
    const res = await fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    const n = Number(String(j?.tag_name || '').replace(/\D/g, ''));
    if (!n) throw new Error('no tag');
    latestBuild = n;
    status = n > BUILD_NUMBER ? 'available' : 'uptodate';
  } catch {
    status = status === 'available' ? 'available' : 'error';
  }
  emit();
}

/** "Later" دبانے پر بینر ہٹ جائے (مینیو میں آئٹم رہتی ہے)۔ اگلے نئے ورژن پر بینر پھر آئے گا۔ */
export function skipBanner(): void {
  skippedBuild = latestBuild;
  try { localStorage.setItem(SKIP_KEY, String(latestBuild)); } catch { /* ignore */ }
  emit();
}

export function openUpdate(): void {
  window.location.href = APK_URL;
}

export function useAppUpdate() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(n => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return {
    status,
    latestBuild,
    currentBuild: BUILD_NUMBER,
    bannerVisible: status === 'available' && latestBuild !== skippedBuild,
    supported: isNative() && BUILD_NUMBER > 0,
  };
}
