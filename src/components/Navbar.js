'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowRight,
  Undo2,
  X,
  Sun,
  Moon,
  Globe,
  Check,
  ChevronLeft,
  Send,
} from 'lucide-react';
import Logo from '@/components/Logo';
import { LANGS } from '@/lib/i18n';
import { TELEGRAM_URL } from '@/lib/catalog';
import { useLanguage } from '@/components/LanguageProvider';
import { useTheme } from '@/components/ThemeProvider';

const DRAWER_MS = 300;

/** Legacy hashes → current section ids */
const SECTION_ALIASES = {
  'special-offer': 'pricing',
  catalog: 'store',
};

function resolveSectionId(id) {
  const key = String(id || '').replace(/^#/, '');
  return SECTION_ALIASES[key] || key;
}

const MENU_COPY = {
  ku: {
    menu: 'مێنیو',
    close: 'داخستن',
    language: 'زمان',
    aiHub: 'سەنتەرێ ژیریێ (AI Hub)',
    allProducts: 'هەمی بەرهەم و خزمەتگوزاری',
    navProducts: 'بەرهەم',
    navOffer: 'ئۆفەرا تایبەت',
    navFaq: 'پرسیارێن دووبارە',
    dark: 'شەڤ',
    light: 'ڕۆژ',
    brandTag: 'IPBITS STORE • خزمەتگوزاریێن دیجیتاڵ',
    supportCta: 'پشتەڤانیا بەردەوام ٢٤/٧',
    themeLabel: 'شەڤ و ڕۆژ',
  },
  ar: {
    menu: 'القائمة',
    close: 'إغلاق',
    language: 'اللغة',
    aiHub: 'مركز الذكاء الاصطناعي (AI Hub)',
    allProducts: 'جميع المنتجات والخدمات',
    navProducts: 'المنتجات',
    navOffer: 'العرض الخاص',
    navFaq: 'الأسئلة الشائعة',
    dark: 'ليلي',
    light: 'نهاري',
    brandTag: 'IPBITS STORE • خدمات رقمية',
    supportCta: 'دعم متواصل ٢٤/٧',
    themeLabel: 'الوضع الليلي والنهاري',
  },
  en: {
    menu: 'Menu',
    close: 'Close',
    language: 'Language',
    aiHub: 'AI Hub Workspace',
    allProducts: 'All Products & Services',
    navProducts: 'Products',
    navOffer: 'Special Offer',
    navFaq: 'FAQ',
    dark: 'Dark',
    light: 'Light',
    brandTag: 'IPBITS STORE • Digital Services',
    supportCta: '24/7 Live Support',
    themeLabel: 'Dark / Light Mode',
  },
};

const NAV_ROW =
  'group w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 transition-all duration-200 hover:bg-slate-100/80 dark:hover:bg-white/[0.04] active:scale-[0.98] cursor-pointer select-none';

const MENU_BTN =
  'p-2 rounded-xl text-slate-600 hover:text-slate-950 dark:text-zinc-300 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/[0.06] transition-all duration-150 ease-out active:scale-[0.96] cursor-pointer select-none';

const CENTER_LINK =
  'text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer select-none whitespace-nowrap';

function HamburgerIcon({ open }) {
  return (
    <span className="relative flex h-3.5 w-5 flex-col items-end justify-center gap-[5px]" aria-hidden="true">
      <span
        className={`block h-[1.5px] origin-center rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1.4,0.36,1)] ${
          open ? 'w-5 translate-y-[3.25px] rotate-45' : 'w-5'
        }`}
      />
      <span
        className={`block h-[1.5px] origin-center rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1.4,0.36,1)] ${
          open ? 'w-5 -translate-y-[3.25px] -rotate-45' : 'w-3.5'
        }`}
      />
    </span>
  );
}

export default function Navbar({ onOpenCatalog }) {
  const { t, dir, lang, setLang } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const menuPanelRef = useRef(null);
  const closeTimerRef = useRef(null);
  const pendingNavRef = useRef(null);
  const lockedScrollYRef = useRef(0);

  const menuLang = lang === 'ar' || lang === 'en' ? lang : 'ku';
  const m = MENU_COPY[menuLang];
  const isRtl = lang === 'ku' || lang === 'ar';
  const isDarkMode = theme !== 'light';
  const isChat = pathname?.startsWith('/chat') || pathname?.startsWith('/hub');
  const isHome = pathname === '/';

  const openMenu = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setMenuOpen(true);
    setDrawerMounted(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setDrawerVisible(true));
    });
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setDrawerVisible(false);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setDrawerMounted(false);
      closeTimerRef.current = null;
    }, DRAWER_MS);
  };

  const toggleMenu = () => {
    if (menuOpen || drawerVisible) closeMenu();
    else openMenu();
  };

  useEffect(() => {
    setPortalReady(true);
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!drawerMounted) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeMenu();
    };
    const scrollY = window.scrollY || window.pageYOffset || 0;
    lockedScrollYRef.current = scrollY;
    document.addEventListener('keydown', onKey);
    document.body.classList.add('drawer-open');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('drawer-open');
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.height = '';
      window.scrollTo(0, lockedScrollYRef.current);

      const pendingNav = pendingNavRef.current;
      pendingNavRef.current = null;
      if (typeof pendingNav === 'function') {
        // After unlocking position:fixed, wait a tick so smooth scroll lands correctly
        window.setTimeout(() => pendingNav(), 50);
      }
    };
  }, [drawerMounted]);

  const scrollToId = (id) => {
    const el = document.getElementById(resolveSectionId(id));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }
    return false;
  };

  const runSectionNav = (id) => {
    const targetId = resolveSectionId(id);
    if (targetId === 'store' && typeof onOpenCatalog === 'function' && isHome) {
      onOpenCatalog();
      return;
    }
    if (isHome && scrollToId(targetId)) {
      try {
        window.history.replaceState(null, '', `/#${targetId}`);
      } catch {
        /* ignore */
      }
      return;
    }
    router.push(`/#${targetId}`);
  };

  const goToSection = (id) => {
    const targetId = resolveSectionId(id);
    if (drawerMounted || menuOpen) {
      pendingNavRef.current = () => runSectionNav(targetId);
      closeMenu();
      return;
    }
    runSectionNav(targetId);
  };

  const handleSectionClick = (e, id) => {
    e.preventDefault();
    goToSection(id);
  };

  const handleAllProducts = (e) => {
    e.preventDefault();
    goToSection('store');
  };

  // Drawer: ku/ar from left; English from right
  const closedTranslate = isRtl ? '-translate-x-full' : 'translate-x-full';
  const panelEdge = isRtl ? 'left-0 top-0 bottom-0 border-r' : 'right-0 top-0 bottom-0 border-l';

  const centerLinks = [
    { id: 'store', label: m.navProducts },
    { id: 'pricing', label: m.navOffer },
    { href: '/chat', label: m.aiHub },
    { id: 'faq', label: m.navFaq },
  ];

  const drawer =
    portalReady &&
    !isChat &&
    drawerMounted &&
    createPortal(
      <div className="fixed inset-0 z-50 overflow-hidden touch-none" role="presentation">
        {/* Backdrop */}
        <div
          className={`absolute inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${
            drawerVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          aria-hidden="true"
          onClick={closeMenu}
        />

        {/* Drawer Panel — 320px / 85vw; RTL from right, LTR from left */}
        <aside
          id="mobile-nav-drawer"
          ref={menuPanelRef}
          role="dialog"
          aria-modal="true"
          aria-label={m.menu}
          dir={isRtl ? 'rtl' : 'ltr'}
          className={`fixed z-50 ${panelEdge} h-[100dvh] max-h-[100dvh] w-[320px] max-w-[85vw] sm:max-w-sm flex flex-col justify-start gap-3 overflow-y-auto pt-5 px-5 bg-[#0a0f12] text-white shadow-2xl border-white/10 transform transition-transform duration-300 ease-in-out will-change-transform ${
            drawerVisible ? 'translate-x-0' : closedTranslate
          }`}
        >
          {/* Top Section */}
          <div className="flex flex-col gap-4 shrink-0">
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-white/10">
              <div className="flex min-w-0 items-center gap-2.5">
                <Logo compact className="w-7 h-7" />
                <span className="text-sm font-semibold tracking-tight text-white">{m.menu}</span>
              </div>
              <button
                type="button"
                onClick={closeMenu}
                className="w-8 h-8 inline-flex items-center justify-center rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white transition-all active:scale-95 cursor-pointer text-base leading-none"
                aria-label={m.close}
              >
                ✕
              </button>
            </div>

            {/* Language Selector */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                <Globe size={13} className="text-emerald-400" />
                {m.language}
              </div>
              <div
                className="bg-white/[0.04] p-1 rounded-xl border border-white/[0.06] flex items-center justify-between gap-1"
                role="listbox"
                aria-label={m.language}
              >
                {LANGS.map((item) => {
                  const active = lang === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => setLang(item.id)}
                      className={`flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] sm:text-xs transition-all cursor-pointer ${
                        active
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold shadow-sm'
                          : 'border border-transparent text-zinc-400 hover:text-white'
                      }`}
                    >
                      {active && <Check size={11} className="text-emerald-400 shrink-0" />}
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-emerald-500/30 text-xs font-medium text-zinc-300 transition-all cursor-pointer"
              aria-label={m.themeLabel}
            >
              <span>{m.themeLabel}</span>
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Moon className="w-4 h-4 text-zinc-300 shrink-0" />
              )}
            </button>
          </div>

          {/* Middle nav — fills remaining space, scrolls if needed */}
          <nav
            className="shrink-0 flex flex-col gap-1 py-3"
            aria-label={m.menu}
          >
            <a href="/#pricing" onClick={(e) => handleSectionClick(e, 'pricing')} className={`${NAV_ROW} text-start`}>
              <span>{m.navOffer}</span>
              <ChevronLeft className={`w-4 h-4 text-zinc-400 shrink-0 ${isRtl ? '' : 'rotate-180'}`} />
            </a>

            <a href="/#store" onClick={handleAllProducts} className={`${NAV_ROW} text-start`}>
              <span>{m.allProducts}</span>
              <ChevronLeft className={`w-4 h-4 text-zinc-400 shrink-0 ${isRtl ? '' : 'rotate-180'}`} />
            </a>

            <Link href="/chat" onClick={closeMenu} className={NAV_ROW}>
              <span>{m.aiHub}</span>
              <ChevronLeft className={`w-4 h-4 text-zinc-400 shrink-0 ${isRtl ? '' : 'rotate-180'}`} />
            </Link>

            <a href="/#faq" onClick={(e) => handleSectionClick(e, 'faq')} className={`${NAV_ROW} text-start`}>
              <span>{m.navFaq}</span>
              <ChevronLeft className={`w-4 h-4 text-zinc-400 shrink-0 ${isRtl ? '' : 'rotate-180'}`} />
            </a>
          </nav>

          {/* Bottom Footer */}
          <div className="pt-4 pb-safe border-t border-white/10 shrink-0">
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
              className="w-full py-2.5 px-4 mb-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.14] border border-emerald-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
              <span>{m.supportCta}</span>
            </a>
            <p className="text-[11px] text-zinc-400 text-center font-light">
              {m.brandTag}
            </p>
          </div>
        </aside>
      </div>,
      document.body
    );

  return (
    <>
      <nav
        className="fixed top-0 inset-x-0 z-40 h-16 backdrop-blur-xl border-b transition-colors duration-200 bg-[#F8FAFC]/80 border-slate-200/80 dark:bg-[#07080E]/80 dark:border-white/[0.08]"
        dir={dir}
      >
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 relative">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3 group shrink-0 z-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/iconT.png"
              alt="IPBITS STORE"
              className="ipbits-logo h-7 sm:h-8 w-auto object-contain drop-shadow-[0_0_12px_rgba(52,211,153,0.8)] shrink-0"
            />
            <span className="lm-brand-title whitespace-nowrap text-slate-900 dark:text-white font-bold text-base sm:text-lg tracking-tight leading-none select-none">
              {t.common.storeName}
            </span>
          </Link>

          {/* Desktop horizontal nav — never tied to drawer transforms */}
          {!isChat && (
            <div className="hidden md:flex flex-1 items-center justify-center gap-6 px-2">
              {centerLinks.map((link) =>
                link.href ? (
                  <Link key={link.href} href={link.href} className={CENTER_LINK}>
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.id}
                    href={`/#${link.id}`}
                    onClick={(e) => handleSectionClick(e, link.id)}
                    className={CENTER_LINK}
                  >
                    {link.label}
                  </a>
                )
              )}
            </div>
          )}

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 z-10">
            {isChat ? (
              <button
                type="button"
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/[0.06] transition-all active:scale-95 cursor-pointer"
              >
                {dir === 'rtl' ? (
                  <ArrowRight size={13} className="shrink-0" />
                ) : (
                  <Undo2 size={13} className="shrink-0" />
                )}
                <span className="sm:hidden">{t.common.navBackToStoreShort}</span>
                <span className="hidden sm:inline">{t.common.navBackToStore}</span>
              </button>
            ) : (
              <>
                {/* Theme — mobile */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="p-1.5 bg-transparent border-0 shadow-none hover:opacity-80 transition-all duration-200 cursor-pointer flex md:hidden items-center justify-center"
                  aria-label={isDarkMode ? m.light : m.dark}
                >
                  {isDarkMode ? (
                    <Sun
                      className="text-amber-400 fill-amber-400/80 transition-transform duration-200 hover:rotate-45"
                      size={20}
                    />
                  ) : (
                    <Moon
                      className="text-purple-400 fill-purple-400 transition-transform duration-200 hover:-rotate-12"
                      size={20}
                    />
                  )}
                </button>

                {/* Theme — desktop */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="p-1.5 bg-transparent border-0 shadow-none hover:opacity-80 transition-all duration-200 cursor-pointer hidden md:flex items-center justify-center"
                  aria-label={isDarkMode ? m.light : m.dark}
                >
                  {isDarkMode ? (
                    <Sun
                      className="text-amber-400 fill-amber-400/80 transition-transform duration-200 hover:rotate-45"
                      size={20}
                    />
                  ) : (
                    <Moon
                      className="text-purple-400 fill-purple-400 transition-transform duration-200 hover:-rotate-12"
                      size={20}
                    />
                  )}
                </button>

                {/* Hamburger — all viewports */}
                <button
                  type="button"
                  onClick={toggleMenu}
                  className={MENU_BTN}
                  aria-expanded={menuOpen}
                  aria-haspopup="dialog"
                  aria-controls="mobile-nav-drawer"
                  aria-label={menuOpen ? m.close : m.menu}
                >
                  {menuOpen ? <X className="w-5 h-5" strokeWidth={1.75} /> : <HamburgerIcon open={menuOpen} />}
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Offset for fixed header */}
      <div className="h-16 shrink-0" aria-hidden="true" />

      {drawer}
    </>
  );
}