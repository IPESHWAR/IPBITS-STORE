'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { KeyRound, Loader2, Lock } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageSwitcher from '@/components/LanguageSwitcher';

async function unlockWithVoucher(rawKey) {
  const next = String(rawKey || '').trim().toUpperCase();
  if (!next) return { ok: false };

  const res = await fetch('/api/vouchers/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: next, key: next }),
  });
  const data = await res.json().catch((err) => {
    console.log('Unlock Error:', err);
    return {};
  });

  if (!res.ok || !(data.ok || data.success) || !data.license) {
    console.log('Unlock Error:', data.error || data.detail || data);
    return { ok: false, error: data.error };
  }

  return { ok: true, license: data.license };
}

/**
 * Full-page voucher gate for /chat — blocks the hub until a valid unused voucher unlocks.
 */
export default function ChatAccessGate({ onUnlocked, initialKey = '' }) {
  const { t, dir, isRtl } = useLanguage();
  const g = t.chat || {};
  const [key, setKey] = useState(initialKey || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (initialKey) setKey(initialKey);
  }, [initialKey]);

  const activate = async (e) => {
    e?.preventDefault?.();
    const next = String(key || '').trim().toUpperCase();
    if (!next || busy) return;

    setBusy(true);
    setError('');

    try {
      const result = await unlockWithVoucher(next);
      if (!result.ok || !result.license) {
        setError(g.gateInvalidKey || '');
        setShake(true);
        window.setTimeout(() => setShake(false), 450);
        return;
      }
      onUnlocked?.(result.license);
    } catch (err) {
      console.log('Unlock Error:', err);
      setError(g.gateInvalidKey || '');
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      dir={dir}
      className="relative min-h-screen w-full overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#07090e] dark:text-white flex items-center justify-center px-4 py-10"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(56,189,248,0.12),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_50%_30%,rgba(56,189,248,0.1),transparent_55%)]"
        aria-hidden="true"
      />

      <div className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} z-10`}>
        <LanguageSwitcher iconOnly />
      </div>

      <div
        className={`relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 sm:p-8 shadow-xl shadow-slate-200/60 dark:border-white/[0.08] dark:bg-[#0c1018]/90 dark:shadow-black/40 backdrop-blur-xl ${
          shake ? 'translate-x-[-4px]' : 'translate-x-0'
        } transition-transform duration-150`}
      >
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="relative mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]">
            <Lock size={20} className="text-slate-700 dark:text-white/75" strokeWidth={1.75} />
            <KeyRound
              size={13}
              className="absolute -bottom-0.5 -end-0.5 text-sky-600 dark:text-sky-300/90 animate-pulse"
              strokeWidth={2}
            />
          </span>
          <h1 className="text-[15px] sm:text-base font-semibold tracking-tight text-slate-900 dark:text-white/90 leading-snug">
            {g.gateTitle}
          </h1>
          <p className="mt-2.5 text-xs leading-relaxed text-slate-600 dark:text-white/50 max-w-[16rem]">
            {g.gateDesc}
          </p>
        </div>

        <form onSubmit={activate} className="space-y-3">
          <label className="block">
            <span className="sr-only">{g.activateKey || 'License Key'}</span>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              placeholder={g.gateKeyPlaceholder || 'IPBITS-XXXX-XXXX'}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-center font-mono text-sm tracking-[0.14em] text-slate-900 placeholder:text-slate-400 placeholder:tracking-normal focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-white/30 dark:focus:border-white/30 dark:focus:bg-white/[0.04] transition-colors"
            />
          </label>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-3 py-2 text-center text-[12px] font-medium text-rose-600 dark:text-rose-300"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || !key.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/15 hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100 transition-all cursor-pointer"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {g.gateBtn}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500 dark:text-white/40">
          <Link
            href="/#pricing"
            className="font-medium text-sky-700 hover:text-sky-800 dark:text-sky-300/85 dark:hover:text-sky-200 underline underline-offset-4 transition-colors"
          >
            {g.gateBuyLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
