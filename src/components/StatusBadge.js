'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/components/LanguageProvider';

/**
 * Compact pulsing system-status badge linking to /status.
 */
export default function StatusBadge({ compact = false, className = '' }) {
  const { t } = useLanguage();
  const st = t.status;
  const [overall, setOverall] = useState('operational');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/status', { cache: 'no-store' });
        const data = await res.json();
        const next = data?.status || data?.overall;
        if (!cancelled && next) setOverall(next);
      } catch {
        if (!cancelled) setOverall('degraded');
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const isOk = overall === 'operational';
  const isDown = overall === 'outage';
  const label = isOk ? st.badgeOk : isDown ? st.badgeOutage : st.badgeDegraded;
  const dot = isOk ? 'bg-cyan-400' : isDown ? 'bg-rose-400' : 'bg-amber-400';
  const border = isOk
    ? 'border-cyan-500/30 bg-cyan-500/5 text-cyan-300'
    : isDown
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-300';

  return (
    <Link
      href="/status"
      className={`lm-status-badge inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] sm:text-[11px] font-bold transition-all hover:opacity-90 ${border} ${className}`}
      title={st.pageTitle}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${dot}`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dot}`} />
      </span>
      <span className={compact ? 'hidden sm:inline whitespace-nowrap' : 'whitespace-nowrap'}>{label}</span>
    </Link>
  );
}
