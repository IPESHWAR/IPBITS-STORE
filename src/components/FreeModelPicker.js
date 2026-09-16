'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, Sparkles } from 'lucide-react';
import { OPENROUTER_FREE_ROUTER_ID } from '@/lib/aiModels';
import { toLocalizedNumber } from '@/lib/i18n';

function formatContext(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return '';
  if (num >= 1000) return `${Math.round(num / 1000)}k`;
  return String(num);
}

const ABBREV_RULES = [
  [/openrouter\/free|auto.?router/i, 'AR'],
  [/claude|anthropic/i, 'CL'],
  [/gpt|openai/i, 'GP'],
  [/deepseek/i, 'DS'],
  [/gemini/i, 'GM'],
  [/gemma/i, 'GE'],
  [/llama|meta-llama/i, 'LM'],
  [/qwen/i, 'QW'],
  [/nvidia|nemotron/i, 'NV'],
  [/mistral/i, 'MS'],
  [/minimax/i, 'MM'],
  [/liquid|lfm/i, 'LQ'],
  [/cohere/i, 'CO'],
  [/phi-?\d|microsoft/i, 'PH'],
  [/dots/i, 'DT'],
  [/poolside|laguna/i, 'PS'],
  [/ling|inclusion/i, 'LG'],
];

function modelAbbrev(m) {
  if (!m) return 'AR';
  if (m.isRouter || m.id === OPENROUTER_FREE_ROUTER_ID) return 'AR';
  const hay = `${m.id || ''} ${m.name || ''} ${m.provider || ''}`;
  for (const [re, tag] of ABBREV_RULES) {
    if (re.test(hay)) return tag;
  }
  return 'AR';
}

export default function FreeModelPicker({
  model,
  freeModels = [],
  paidModels = [],
  onChange,
  labels = {},
  lang = 'ku',
  premiumUnlocked = false,
  disabled = false,
  onRequireUnlock,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  const selected = useMemo(
    () => [...freeModels, ...paidModels].find((m) => m.id === model) || freeModels[0] || null,
    [freeModels, paidModels, model]
  );

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => searchRef.current?.focus(), 40);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filterList = (list) => {
    if (!q) return list;
    return list.filter((m) => {
      const hay = `${m.name || ''} ${m.id || ''} ${m.provider || ''}`.toLowerCase();
      return hay.includes(q);
    });
  };

  const visibleFree = filterList(freeModels);
  const visiblePaid = filterList(paidModels);
  const countLabel = (labels.freeModelsCount || '{n}+ Free AI Models').replace(
    '{n}',
    toLocalizedNumber(Math.max(freeModels.length, 0), lang === 'en' ? 'en' : 'ku')
  );

  const displayName = (m) => {
    if (!m) return labels.loadingModels || '...';
    if (m.isRouter || m.id === OPENROUTER_FREE_ROUTER_ID) {
      return labels.autoRouterName || m.name || 'Auto Router';
    }
    return m.name || m.id;
  };

  const pick = (id, isProtected = false) => {
    if (isProtected && !premiumUnlocked) {
      onRequireUnlock?.();
      return;
    }
    onChange?.(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={displayName(selected)}
        title={displayName(selected)}
        onClick={() => setOpen((v) => !v)}
        className="h-8 px-2.5 rounded-full border border-neutral-200/80 bg-neutral-50 hover:bg-neutral-100 text-xs font-mono text-neutral-700 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-white/80 transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/30 dark:focus-visible:ring-white/20 disabled:opacity-50"
      >
        <span className="font-mono text-[11px] font-semibold tracking-wide tabular-nums">
          {modelAbbrev(selected)}
        </span>
        <ChevronDown
          size={12}
          className={`shrink-0 text-neutral-400 dark:text-white/45 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-1.5 z-50 w-[calc(100vw-2rem)] max-w-sm sm:w-80 rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden bg-white/95 border-neutral-200 text-neutral-800 dark:bg-[#0c0e14]/95 dark:border-white/10 dark:text-white dark:shadow-black/50">
          <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold tracking-wide text-neutral-500 dark:text-white/55 truncate min-w-0">
              {countLabel}
            </span>
            <span className="shrink-0 inline-flex items-center rounded-md bg-neutral-100 border border-neutral-200/80 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-600 dark:bg-white/[0.06] dark:border-white/10 dark:text-white/70">
              {labels.freeBadge || 'بەلاش / Free'}
            </span>
          </div>
          <div className="px-2.5 pb-2">
            <label className="flex items-center gap-2 rounded-xl bg-neutral-50 border border-neutral-200/80 px-2.5 py-1.5 dark:bg-white/[0.03] dark:border-white/10">
              <Search size={13} className="text-neutral-400 dark:text-white/40 shrink-0" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={labels.searchModels || 'Gemini, DeepSeek, Llama...'}
                className="w-full min-w-0 bg-transparent text-[11px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none dark:text-white/90 dark:placeholder:text-white/35"
              />
            </label>
          </div>
          <div
            className="max-h-60 overflow-y-auto overscroll-contain pb-1.5 [-webkit-overflow-scrolling:touch]"
            role="listbox"
          >
            {visibleFree.map((m) => {
              const active = m.id === model;
              const router = m.isRouter || m.id === OPENROUTER_FREE_ROUTER_ID;
              const ctx = formatContext(m.context_length);
              const locked = !premiumUnlocked;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(m.id, locked)}
                  className={`w-full text-start px-3 py-2.5 flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-white/[0.05] cursor-pointer ${
                    active ? 'bg-neutral-100 dark:bg-white/[0.07]' : ''
                  } ${locked ? 'opacity-70' : ''}`}
                >
                  {router ? (
                    <Sparkles size={13} className="text-sky-500 dark:text-sky-300/80 shrink-0" />
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 min-w-0 w-full">
                      <span
                        className="truncate min-w-0 flex-1 text-[12px] font-semibold text-neutral-800 dark:text-white/90"
                        title={displayName(m)}
                      >
                        {displayName(m)}
                      </span>
                      {locked ? (
                        <span className="shrink-0 text-[11px]" title={labels.paidLocked || 'Locked'}>
                          🔒
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-700 dark:text-emerald-300/90 whitespace-nowrap">
                          {labels.freeBadge || 'بەلاش / Free'}
                        </span>
                      )}
                    </span>
                    <span className="block text-[10px] text-neutral-500 dark:text-white/40 truncate">
                      {[m.provider, ctx ? `${ctx} ctx` : ''].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {active && <Check size={13} className="text-sky-500 dark:text-sky-300 shrink-0" />}
                </button>
              );
            })}
            {visiblePaid.length > 0 && (
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-neutral-500 dark:text-white/45">
                {labels.premiumModelsSection || labels.premiumModels || 'Pro'}
              </div>
            )}
            {visiblePaid.map((m) => {
              const active = m.id === model;
              const locked = !premiumUnlocked;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(m.id, true)}
                  className={`w-full text-start px-3 py-2.5 flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-white/[0.05] cursor-pointer ${
                    active ? 'bg-neutral-100 dark:bg-white/[0.07]' : ''
                  } ${locked ? 'opacity-70' : ''}`}
                >
                  <span className="w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 min-w-0 w-full">
                      <span
                        className="truncate min-w-0 flex-1 text-[12px] font-semibold text-neutral-800 dark:text-white/90"
                        title={displayName(m)}
                      >
                        {displayName(m)}
                      </span>
                      {locked ? (
                        <span className="shrink-0 text-[11px]" title={labels.paidLocked || 'Locked'}>
                          🔒
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 text-[8px] font-semibold text-sky-700 dark:text-sky-300/90 whitespace-nowrap">
                          Pro
                        </span>
                      )}
                    </span>
                    <span className="block text-[10px] text-neutral-500 dark:text-white/40 truncate">
                      {(locked ? '🔒 Pro · ' : 'Pro · ') + (m.provider || '')}
                    </span>
                  </span>
                  {active && <Check size={13} className="text-sky-500 dark:text-sky-300 shrink-0" />}
                </button>
              );
            })}
            {!visibleFree.length && !visiblePaid.length && (
              <p className="px-3 py-3 text-[11px] text-neutral-500 dark:text-white/40">{labels.searchModels}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
