import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'steptudeen_install_dismissed_at';
const DISMISS_DAYS = 7;

/* ───── Module-level store ─────
   Chrome can fire `beforeinstallprompt` before React has mounted, so the listener is attached
   as soon as this module is imported and the event is kept until a component asks for it. */
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true);

if (typeof window !== 'undefined') {
  installed = isStandalone();

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); // stop Chrome's mini-infobar; we show our own button
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    notify();
  });
}

const wasRecentlyDismissed = () => {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return !!at && Date.now() - at < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
};

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !(window as any).MSStream;

export const useInstallPrompt = () => {
  const [, force] = useState(0);
  const [dismissed, setDismissed] = useState(wasRecentlyDismissed);

  useEffect(() => {
    const update = () => force(n => n + 1);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);

  /** Shows the native install dialog. Resolves true if the user accepted. */
  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    const promptEvent = deferredPrompt;
    deferredPrompt = null; // an event can only be used once
    notify();
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      return outcome === 'accepted';
    } catch {
      return false;
    }
  }, []);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setDismissed(true);
  }, []);

  const ios = isIOS();

  return {
    /** Android / desktop Chrome / Edge: native prompt is available. */
    canInstall: !installed && !!deferredPrompt,
    /** iPhone Safari has no install event, so we can only show instructions. */
    showIosHint: !installed && ios,
    isInstalled: installed,
    dismissed,
    promptInstall,
    dismiss,
  };
};
