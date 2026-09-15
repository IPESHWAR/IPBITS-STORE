'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LANG_STORAGE_KEY, TRANSLATIONS, normalizeLang } from '@/lib/i18n';

const LanguageContext = createContext(null);
const SSR_LANG = 'ku';

export function LanguageProvider({ children }) {
  const [mounted, setMounted] = useState(false);
  const [lang, setLangState] = useState(SSR_LANG);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      const storedLang = stored ? normalizeLang(stored) : '';
      if (storedLang && TRANSLATIONS[storedLang]) setLangState(storedLang);
    } catch {
      /* ignore */
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const pack = TRANSLATIONS[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = pack.dir;
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang, mounted]);

  const setLang = useCallback((next) => {
    const canonical = normalizeLang(next);
    if (TRANSLATIONS[canonical]) setLangState(canonical);
  }, []);

  const value = useMemo(() => {
    // Keep SSR and the first client render on the same locale so React
    // hydration matches. Stored language is applied only after mount.
    const activeLang = mounted ? lang : SSR_LANG;
    const t = TRANSLATIONS[activeLang] || TRANSLATIONS.ku;
    return {
      lang: activeLang,
      setLang,
      t,
      dir: t.dir,
      isRtl: t.dir === 'rtl',
      mounted,
    };
  }, [lang, setLang, mounted]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}
