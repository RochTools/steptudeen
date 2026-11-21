import { useEffect, useState } from 'react';

/** نیچے سکرول پر اوپر کی بار چھپ جائے، ذرا سا اوپر سکرول پر فوراً واپس (دعاؤں والا انداز)۔
 *  `paused` true ہو (مثلاً مینیو کھلا ہو) تو بار نظر آتی رہتی ہے۔
 *  window اور اندرونی سکرول والے دونوں کو سنبھالتا ہے۔ */
export function useHideOnScroll(paused = false): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = (e: Event) => {
      const t = e.target as Element | Document;
      const y = t === document || t === document.documentElement ? window.scrollY : (t as Element).scrollTop;
      const delta = y - lastY;
      if (y < 40) setHidden(false);
      else if (delta > 6) setHidden(true);
      else if (delta < -4) setHidden(false);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
  }, []);
  return hidden && !paused;
}
