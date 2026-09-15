'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Crown } from 'lucide-react';
import { toLocalizedNumber } from '@/lib/i18n';

/**
 * Ultra-minimal chat chrome (Linear/Vercel-inspired).
 * Crown badge shows live VIP points: "{n} خاڵ"
 */
export default function ChatHeader({
  backHref = '/',
  backLabel = 'Back',
  brand = 'IPBITS AI HUB',
  vipPoints = 0,
  pointsLabel = 'خاڵ',
  modelPicker = null,
  lang = 'ku',
  onlineLabel = 'Online',
}) {
  const target = Math.max(0, Math.round(Number(vipPoints) || 0));
  const [displayPoints, setDisplayPoints] = useState(target);

  useEffect(() => {
    if (displayPoints === target) return undefined;

    const start = displayPoints;
    const delta = target - start;
    const duration = Math.min(700, Math.max(280, Math.abs(delta) * 12));
    const t0 = performance.now();
    let raf = 0;

    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      // ease-out cubic
      const eased = 1 - (1 - t) ** 3;
      setDisplayPoints(Math.round(start + delta * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- animate only when target changes
  }, [target]);

  const pointsText = `${toLocalizedNumber(displayPoints, lang === 'en' ? 'en' : 'ku')} ${pointsLabel}`;
  const dropping = target < displayPoints;

  return (
    <header
      dir="ltr"
      className="sticky top-0 z-30 h-14 w-full shrink-0 backdrop-blur-xl bg-black/40 border-b border-white/[0.08] px-5 flex items-center justify-between"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Link
          href={backHref}
          aria-label={backLabel}
          title={backLabel}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-white/70 hover:text-white"
        >
          <ArrowLeft size={18} strokeWidth={1.75} />
        </Link>

        <div className="flex min-w-0 items-center gap-2">
          <span
            className="w-2 h-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse"
            aria-hidden="true"
            title={onlineLabel}
          />
          <h1 className="truncate font-semibold tracking-tight text-sm text-white/90" title={brand}>
            {brand}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {modelPicker}

        <span
          className={`border border-white/10 bg-white/[0.04] text-white/75 text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 max-w-[11rem] sm:max-w-none backdrop-blur-md tabular-nums transition-colors duration-300 ${
            dropping ? 'border-amber-400/25 text-amber-100' : ''
          }`}
          title={pointsText}
          aria-live="polite"
        >
          <Crown size={12} className="shrink-0 text-amber-300/90" strokeWidth={1.75} aria-hidden="true" />
          <span className="truncate">
            {toLocalizedNumber(displayPoints, lang === 'en' ? 'en' : 'ku')} {pointsLabel}
          </span>
        </span>
      </div>
    </header>
  );
}
