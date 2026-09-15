'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles } from 'lucide-react';

const INVALID_MSG = 'ئەڤ کلیلە نەیا دروستە یان دەمێ وێ ب سەرڤە چوویە. هیڤیە پشتڕاست ببە.';

export default function AiHubGateModal({ open, onUnlocked, onClose, submitting = false, error = '' }) {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  const activate = async (raw) => {
    const next = String(raw || '').trim();
    if (!next || busy) return;
    setBusy(true);
    setLocalError('');
    try {
      const res = await fetch('/api/ai/hub-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: next, key: next, phone: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setLocalError(data.error || INVALID_MSG);
        return;
      }
      onUnlocked?.(data, next);
    } catch {
      setLocalError(INVALID_MSG);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const btn = document.getElementById('ai-hub-activate');
    if (!btn) return undefined;
    const onClick = (event) => {
      event.preventDefault();
      const form = document.getElementById('ai-hub-gate-form');
      const next = String(form?.querySelector('[name="hub-key"]')?.value || '').trim();
      if (next) activate(next);
    };
    btn.addEventListener('click', onClick);
    return () => btn.removeEventListener('click', onClick);
  }, [open, busy]);

  if (!open) return null;

  const showError = localError || error;
  const pending = busy;

  const readKey = (el) => {
    const form = el?.closest?.('form') || document.getElementById('ai-hub-gate-form');
    return String(form?.querySelector('[name="hub-key"]')?.value || '').trim();
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-[#050714]/80 backdrop-blur-xl" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-slate-950/70 p-6 shadow-[0_20px_80px_rgba(76,29,149,0.45)] backdrop-blur-2xl">
        <div className="mb-5 flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-teal-900/40">
            <Sparkles size={18} className="text-white" />
          </span>
          <div>
            <h2 className="text-lg font-black text-white leading-7">سەنتەرێ ژیریا دەستکرد (AI Hub)</h2>
          </div>
        </div>
        <p className="mb-4 text-sm leading-7 text-slate-200">
          بۆ بکارئینانا هەمی مۆدێلێن پێشکەفتی یێن جیهانی، هیڤیە کلیلا ئەکاونتێ خۆ یێ تە کڕی بنڤیسە:
        </p>
        <form
          id="ai-hub-gate-form"
          onSubmit={(e) => {
            e.preventDefault();
            activate(readKey(e.currentTarget));
          }}
          className="space-y-3"
        >
          <input
            name="hub-key"
            defaultValue=""
            placeholder="کلیلا پشکداریێ (Access Key) یان ژمارا مۆبایلێ..."
            autoFocus
            className="w-full rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-teal-400 focus:outline-none"
          />
          {showError && (
            <p className="text-[12px] font-bold leading-6 text-rose-300">{showError}</p>
          )}
          <button
            type="button"
            id="ai-hub-activate"
            disabled={pending}
            onClick={(e) => activate(readKey(e.currentTarget))}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 py-3 text-sm font-black text-white shadow-lg shadow-teal-900/30 disabled:opacity-50"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : null}
            چالاککرن و چوونا ژوورڤە
          </button>
        </form>
        <p className="mt-4 text-center text-xs leading-6 text-slate-300">
          تە پشکداری نینە؟{' '}
          <Link href="/?buy=ai_hub" className="font-black text-teal-300 underline underline-offset-4">
            بکڕە ب ١٢,٠٠٠ دینار
          </Link>
        </p>
        {typeof onClose === 'function' && (
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 text-xs font-bold text-slate-200 hover:bg-white/10 cursor-pointer"
          >
            بەردەوام بە ب مۆدێلێن بێ بەرامبەر
          </button>
        )}
      </div>
    </div>
  );
}
