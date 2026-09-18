'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { KeyRound, Loader2, Lock, X } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

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
 * In-chat redeem / top-up gate when credits hit zero — uses vouchers table.
 */
export default function CreditRedeemModal({
  open,
  onClose,
  onRedeemed,
  closable = true,
}) {
  const { t, dir } = useLanguage();
  const g = t.chat || {};
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setKey('');
      setError('');
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const redeem = async (e) => {
    e?.preventDefault?.();
    const next = String(key || '').trim().toUpperCase();
    if (!next || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await unlockWithVoucher(next);
      if (!result.ok || !result.license) {
        setError(g.gateInvalidKey || '');
        return;
      }
      onRedeemed?.(result.license);
    } catch (err) {
      console.log('Unlock Error:', err);
      setError(g.gateInvalidKey || '');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        if (closable) onClose?.();
      }}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white/95 text-slate-900 dark:border-white/[0.08] dark:bg-[#0c1018]/95 dark:text-white p-6 sm:p-7 shadow-2xl shadow-black/50 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {closable && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 start-4 text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        )}

        <div className="mb-5 flex flex-col items-center text-center">
          <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]">
            <Lock size={18} className="text-amber-500 dark:text-amber-300/90" strokeWidth={1.75} />
          </span>
          <h2 className="text-[15px] font-semibold text-slate-900/90 dark:text-white/90 tracking-tight">{g.redeemTitle}</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-white/50 max-w-[16rem]">{g.redeemBody}</p>
        </div>

        <form onSubmit={redeem} className="space-y-3">
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder={g.gateKeyPlaceholder || 'IPBITS-XXXX-XXXX'}
            autoFocus
            dir="ltr"
            spellCheck={false}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-center font-mono text-sm tracking-[0.14em] text-slate-900 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-white/30 focus:border-slate-400 dark:focus:border-white/30 focus:outline-none transition-colors"
          />
          {error ? (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-3 py-2 text-center text-[12px] text-rose-600 dark:text-rose-300">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy || !key.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/15 hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {g.gateBtn}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400 dark:text-white/40">
          <Link
            href="/#pricing"
            className="font-medium text-sky-600 dark:text-sky-300/85 hover:text-sky-700 dark:hover:text-sky-200 underline underline-offset-4"
            onClick={onClose}
          >
            {g.gateBuyLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
