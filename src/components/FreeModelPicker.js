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
        className="h-8 px-2.5 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono text-white/80 transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:opacity-50"
      >
        <span className="font-mono text-[11px] font-semibold tracking-wide tabular-nums">
          {modelAbbrev(selected)}
        </span>
        <ChevronDown
          size={12}
          className={`shrink-0 text-white/45 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-1.5 z-50 w-[min(22rem,calc(100vw-1.25rem))] rounded-2xl border border-white/10 bg-[#0c0e14]/95 shadow-2xl shadow-black/50 backdrop-blur-xl overflow-hidden">
          <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold tracking-wide text-white/55">{countLabel}</span>
            <span className="inline-flex items-center rounded-md bg-white/[0.06] border border-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-white/70">
              {labels.freeBadge || 'بەلاش / Free'}
            </span>
          </div>
          <div className="px-2.5 pb-2">
            <label className="flex items-center gap-2 rounded-xl bg-white/[0.03] border border-white/10 px-2.5 py-1.5">
              <Search size={13} className="text-white/40 shrink-0" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={labels.searchModels || 'Gemini, DeepSeek, Llama...'}
                className="w-full bg-transparent text-[11px] text-white/90 placeholder:text-white/35 focus:outline-none"
              />
            </label>
          </div>
          <div className="max-h-72 overflow-y-auto pb-1.5" role="listbox">
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
                  className={`w-full text-start px-3 py-2 flex items-start gap-2 hover:bg-white/[0.05] cursor-pointer ${
                    active ? 'bg-white/[0.07]' : ''
                  } ${locked ? 'opacity-70' : ''}`}
                >
                  {router ? (
                    <Sparkles size={13} className="mt-0.5 text-sky-300/80 shrink-0" />
                  ) : (
                    <span className="mt-0.5 w-3.5 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[12px] font-semibold text-white/90">{displayName(m)}</span>
                      {locked ? (
                        <span className="shrink-0 text-[11px]" title={labels.paidLocked || 'Locked'}>
                          🔒
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-md bg-white/[0.06] border border-white/10 px-1 py-px text-[8px] font-semibold text-white/55">
                          {labels.freeBadge || 'بەلاش / Free'}
                        </span>
                      )}
                    </span>
                    <span className="block text-[10px] text-white/40 truncate">
                      {[m.provider, ctx ? `${ctx} ctx` : ''].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {active && <Check size={13} className="text-sky-300 shrink-0 mt-0.5" />}
                </button>
              );
            })}
            {visiblePaid.length > 0 && (
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-white/45">
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
                  className={`w-full text-start px-3 py-2 flex items-start gap-2 hover:bg-white/[0.05] cursor-pointer ${
                    active ? 'bg-white/[0.07]' : ''
                  } ${locked ? 'opacity-70' : ''}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[12px] font-semibold text-white/90">{displayName(m)}</span>
                      {locked ? (
                        <span className="shrink-0 text-[11px]" title={labels.paidLocked || 'Locked'}>
                          🔒
                        </span>
                      ) : (
                        <span className="shrink-0 text-[9px] font-semibold text-sky-300/80">Pro</span>
                      )}
                    </span>
                    <span className="block text-[10px] text-white/40 truncate">
                      {(locked ? '🔒 Pro · ' : 'Pro · ') + (m.provider || '')}
                    </span>
                  </span>
                  {active && <Check size={13} className="text-sky-300 shrink-0 mt-0.5" />}
                </button>
              );
            })}
            {!visibleFree.length && !visiblePaid.length && (
              <p className="px-3 py-3 text-[11px] text-white/40">{labels.searchModels}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
