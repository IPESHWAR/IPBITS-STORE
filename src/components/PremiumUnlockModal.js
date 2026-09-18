'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Crown, KeyRound, Loader2, Wallet, X } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

export default function PremiumUnlockModal({
  open,
  onClose,
  onTopUp,
  onActivate,
  activating,
  activateError,
}) {
  const { t, dir } = useLanguage();
  const c = t.chat;
  const [phone, setPhone] = useState('');
  const [key, setKey] = useState('');

  if (!open) return null;

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-3xl border border-slate-200 bg-white text-slate-900 dark:border-teal-400/25 dark:bg-[#0d1020] dark:text-white p-5 shadow-2xl shadow-teal-950/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500">
              <Crown size={18} className="text-white" />
            </span>
            <div>
              <p className="text-[10px] font-black text-teal-600 dark:text-teal-300">پڕۆ / Premium</p>
              <h2 className="text-base font-black text-slate-900 dark:text-white">{c.unlockTitle}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-6 mb-4">{c.unlockBody}</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Link
            href="/#pricing"
            onClick={onClose}
            className="rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black py-2.5 text-center"
          >
            {c.unlockSubscribe}
          </Link>
          <button
            type="button"
            onClick={() => {
              onTopUp?.();
              onClose();
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200 text-xs font-black py-2.5 cursor-pointer"
          >
            <Wallet size={13} />
            {c.unlockTopup}
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onActivate?.(key, phone);
          }}
          className="space-y-2"
        >
          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">{c.activatePhone}</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07XXXXXXXXX"
            className="w-full bg-white text-slate-900 placeholder-slate-400 border border-slate-300 dark:bg-slate-950 dark:text-white dark:placeholder-slate-500 dark:border-slate-700 rounded-xl px-3 py-2 text-xs"
          />
          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400">{c.activateKey}</label>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder="IPBITS-30D-XXXXXXXX"
            className="w-full bg-white text-slate-900 placeholder-slate-400 border border-slate-300 dark:bg-slate-950 dark:text-white dark:placeholder-slate-500 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono"
          />
          {activateError && <p className="text-[11px] text-rose-600 dark:text-rose-300 font-bold">{activateError}</p>}
          <button
            type="submit"
            disabled={activating || !key.trim()}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black py-2.5 cursor-pointer"
          >
            {activating ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
            {c.unlockActivate}
          </button>
        </form>
      </div>
    </div>
  );
}
