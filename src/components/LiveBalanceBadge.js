'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

const POLL_MS = 60_000;

/**
 * Compact live OpenRouter balance badge for the chat workspace header.
 */
export default function LiveBalanceBadge({ refreshKey = 0 }) {
  const { t, lang } = useLanguage();
  const [remaining, setRemaining] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ok | error

  useEffect(() => {
    let cancelled = false;
    let timer;

    const load = async () => {
      try {
        const res = await fetch('/api/credits', { cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || typeof json.remaining !== 'number') {
          setStatus('error');
          return;
        }
        setRemaining(json.remaining);
        setStatus('ok');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to loading before (re)polling on refreshKey change
    setStatus((prev) => (prev === 'ok' ? 'ok' : 'loading'));
    load();
    timer = setInterval(load, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refreshKey]);

  const label =
    lang === 'en' ? 'Balance' :
    lang === 'ar' ? 'الرصيد' :
    'باڵانس';

  if (status === 'loading' && remaining === null) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-[11px] sm:text-xs text-slate-300 font-bold shrink-0">
        <Loader2 size={12} className="animate-spin text-emerald-400" />
        <span className="hidden sm:inline">{label}…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] sm:text-xs text-rose-300 font-bold shrink-0"
        title={t.balance?.subtitle || 'OpenRouter'}
      >
        <AlertCircle size={12} />
        <span className="hidden sm:inline">{label}</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] sm:text-xs text-emerald-200 font-bold shrink-0 tabular-nums">
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <span>
        {label}: ${Number(remaining || 0).toFixed(2)}
      </span>
    </div>
  );
}
