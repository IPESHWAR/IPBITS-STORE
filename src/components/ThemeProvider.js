'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useServerInsertedHTML } from 'next/navigation';

const ThemeContext = createContext({
  theme: 'dark',
  mounted: false,
  toggleTheme: () => {},
});

const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('ipbits-theme');var r=document.documentElement;if(t==='light'){r.classList.add('light-mode');r.classList.remove('dark');}else{r.classList.remove('light-mode');r.classList.add('dark');}}catch(e){}})();`;

function applyThemeClass(next) {
  const root = document.documentElement;
  const isLight = next === 'light';
  root.classList.toggle('light-mode', isLight);
  root.classList.toggle('dark', !isLight);
}

export function ThemeProvider({ children }) {
  // Fixed default for SSR + first client paint — never read localStorage here
  // (avoids hydration mismatch with the theme toggle icon / aria-label).
  const [theme, setTheme] = useState('dark');
  const [mounted, setMounted] = useState(false);

  // Inject FOUC-prevention script into the SSR stream outside the React client tree
  // (avoids React 19 "Encountered a script tag while rendering" console error).
  useServerInsertedHTML(() => (
    <script
      id="ipbits-theme-bootstrap"
      dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }}
    />
  ));

  useEffect(() => {
    const stored = localStorage.getItem('ipbits-theme') || 'dark';
    setTheme(stored);
    applyThemeClass(stored);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyThemeClass(theme);
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('ipbits-theme', next);
      applyThemeClass(next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, mounted, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
