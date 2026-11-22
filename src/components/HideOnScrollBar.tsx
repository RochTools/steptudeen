import React, { useLayoutEffect, useRef, useState } from 'react';
import { useHideOnScroll } from '../hooks/useHideOnScroll';

/** دعاؤں والی بار: صفحے کے اوپر fixed، نیچے سکرول پر چھپتی ہے اور ذرا سا اوپر سکرول پر واپس آ جاتی ہے۔
 *  (sticky یہاں کام نہیں کرتا کیونکہ ایپ کا روٹ overflow-hidden ہے، اس لیے fixed + برابر کی خالی جگہ۔)
 *  className = اندر والے کارڈ کا انداز، bg = بار کے پیچھے کا رنگ (صفحے کے رنگ جیسا)۔ */
export const HideOnScrollBar: React.FC<{
  className?: string;
  bg?: string;
  paused?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}> = ({ className, bg = '#fff', paused = false, innerRef, children }) => {
  const hidden = useHideOnScroll(paused);
  const outerRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(64);

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => {
      // خالی جگہ = بار کی اونچائی منہا سٹیٹس بار (روٹ کی padding پہلے ہی اتنی جگہ دے رہی ہے)
      const sat = parseFloat(getComputedStyle(el).paddingTop) || 0;
      setH(Math.max(0, Math.round(el.offsetHeight - sat)));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <div aria-hidden style={{ height: h }} />
      <div
        ref={outerRef}
        className="fixed left-1/2 top-0 z-40 w-full max-w-md px-2 pb-2"
        style={{
          background: bg,
          paddingTop: 'calc(0.5rem + var(--sat, 0px))',
          transform: `translateX(-50%) translateY(${hidden ? '-130%' : '0'})`,
          transition: 'transform .28s ease',
        }}
      >
        <div className={className} ref={innerRef}>{children}</div>
      </div>
    </>
  );
};
