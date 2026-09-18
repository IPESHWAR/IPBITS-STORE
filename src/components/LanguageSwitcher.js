'use client';

import React, { useEffect, useRef } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { LANGS } from '@/lib/i18n';
import { useLanguage } from '@/components/LanguageProvider';
import { useHoverDropdown } from '@/hooks/useHoverDropdown';

const PILL_BTN =
  'inline-flex items-center justify-center gap-1.5 h-9 px-3.5 text-xs tracking-wide rounded-full backdrop-blur-md bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:bg-white/[0.04] dark:border-white/10 dark:text-zinc-300 dark:hover:border-cyan-400/40 dark:hover:text-white transition-all duration-200 ease-out active:scale-[0.97] cursor-pointer';

export default function LanguageSwitcher({
  compact = false,
  iconOnly = false,
  pill = false,
}) {
  const { lang, setLang, isRtl, mounted } = useLanguage();
  const { open, setOpen, closeMenu, onMouseEnter, onMouseLeave, onClickToggle } = useHoverDropdown(160);
  const rootRef = useRef(null);

  useEffect(() => {
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) closeMenu();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [closeMenu]);

  const current = LANGS.find((l) => l.id === lang) || LANGS[0];
  const label = !mounted ? LANGS[0].label : compact && lang === 'en' ? 'EN' : current.label;

  return (
    <div
      className="group relative"
      ref={rootRef}
      suppressHydrationWarning
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={onClickToggle}
        className={
          iconOnly
            ? `${PILL_BTN} w-9 px-0`
            : pill
              ? PILL_BTN
              : 'flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 dark:bg-slate-900/80 dark:hover:bg-slate-800 dark:border-slate-800/90 dark:hover:border-cyan-500/40 dark:text-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ease-out cursor-pointer shadow-sm active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60'
        }
      >
        <Globe size={14} className={iconOnly ? 'text-slate-600 dark:text-zinc-300 shrink-0' : 'text-cyan-600 dark:text-cyan-400 shrink-0'} />
        {!iconOnly && (
          <>
            <span className="whitespace-nowrap" suppressHydrationWarning>
              {label}
            </span>
            <ChevronDown
              size={12}
              className={`text-slate-400 dark:text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>

      {mounted && (
        <div
          role="listbox"
          className={`absolute top-full mt-1.5 bg-white border border-slate-200 dark:bg-[#0c1022]/95 dark:border-slate-800 rounded-xl shadow-2xl shadow-emerald-950/40 p-1 z-50 flex flex-col gap-0.5 min-w-[118px] backdrop-blur-xl transition-all duration-150 ${
            iconOnly || isRtl ? 'end-0' : 'start-0'
          } ${
            open
              ? 'opacity-100 visible pointer-events-auto'
              : 'opacity-0 invisible pointer-events-none'
          }`}
        >
          {LANGS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={lang === item.id}
              onClick={() => {
                setLang(item.id);
                setOpen(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                lang === item.id
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-600/30 dark:text-cyan-300'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{item.label}</span>
              {lang === item.id && <Check size={12} className="text-emerald-600 dark:text-cyan-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
