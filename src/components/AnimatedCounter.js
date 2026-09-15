'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import { toLocalizedNumber } from '@/lib/i18n';
import { useLanguage } from '@/components/LanguageProvider';

/**
 * Counts up from 0 to `value` once mounted and in view.
 * First paint always shows 0 so SSR and hydration match.
 */
export default function AnimatedCounter({ value, prefix = '', suffix = '', lang = 'en', duration = 1.4 }) {
  const { mounted } = useLanguage();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!mounted || !isInView) return undefined;
    let raf;
    const start = performance.now();

    const tick = (now) => {
      const elapsed = (now - start) / 1000;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mounted, isInView, value, duration]);

  return (
    <span ref={ref} suppressHydrationWarning>
      {prefix}
      {toLocalizedNumber(mounted ? display : 0, lang)}
      {suffix}
    </span>
  );
}
