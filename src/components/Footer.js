'use client';

import React from 'react';
import Link from 'next/link';
import { Send, Mail, ShieldCheck, Zap, Headset } from 'lucide-react';
import Logo from '@/components/Logo';
import StatusBadge from '@/components/StatusBadge';
import { useLanguage } from '@/components/LanguageProvider';
import { TELEGRAM_URL } from '@/lib/catalog';

const PAYMENT_BADGE =
  'px-3.5 py-1.5 rounded-xl text-xs tracking-wider font-medium text-slate-700 bg-slate-100/90 border border-slate-200 hover:border-emerald-500/40 hover:text-emerald-600 hover:bg-emerald-50 dark:text-zinc-300 dark:bg-white/[0.03] dark:border-white/[0.08] dark:hover:border-emerald-500/40 dark:hover:text-emerald-400 dark:hover:bg-emerald-500/[0.04] transition-all duration-200 select-none';

export default function Footer() {
  const { t } = useLanguage();
  const f = t.footer;
  const s = t.store;

  const paymentMethods = ['FIB', 'FastPay', 'ZainCash', 'Qi Card', 'PayPal'];

  const quickLinks = [
    { href: '/', label: t.common.navStore },
    { href: '/chat', label: t.common.navChat },
  ];

  const trustBadges = [
    { icon: ShieldCheck, label: f.trustWarranty },
    { icon: Zap, label: f.trustInstant },
    { icon: Headset, label: f.trustSupport },
  ];

  const socials = [
    { icon: Send, href: TELEGRAM_URL, label: f.contactTelegram },
    { icon: Mail, href: 'mailto:ip@ipbits.store', label: 'ip@ipbits.store' },
  ];

  return (
    <footer id="contact" className="relative w-full border-t border-slate-200 bg-slate-50 mt-4 scroll-mt-20 transition-colors duration-200 dark:border-white/10 dark:bg-[#090A0F]">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <Logo compact />
              <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
                {t.common.storeName}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed max-w-xs">{f.about}</p>
          </div>

          <div>
            <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500 mb-3">
              {f.quickLinksTitle}
            </h5>
            <ul className="space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs text-slate-600 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-cyan-300 transition-colors leading-relaxed"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500 mb-3">
              {f.supportTitle}
            </h5>
            <div className="flex items-center gap-2">
              {socials.map((social) => {
                const Icon = social.icon;
                const className =
                  'w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 dark:bg-white/[0.03] dark:border-white/[0.08] dark:text-zinc-400 dark:hover:text-cyan-300 dark:hover:border-cyan-400/40 transition-all active:scale-[0.98]';
                if (social.href.startsWith('/')) {
                  return (
                    <Link key={social.label} href={social.href} aria-label={social.label} className={className}>
                      <Icon size={14} />
                    </Link>
                  );
                }
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    title={social.label}
                    className={className}
                  >
                    <Icon size={14} />
                  </a>
                );
              })}
            </div>
          </div>

          <div>
            <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500 mb-3">
              {f.trustTitle}
            </h5>
            <ul className="space-y-2.5">
              {trustBadges.map((badge) => {
                const Icon = badge.icon;
                return (
                  <li key={badge.label} className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                    <Icon size={14} className="text-emerald-600 dark:text-cyan-400 shrink-0" />
                    {badge.label}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-white/10 pt-6 pb-5">
          <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-zinc-500 font-medium mb-3 text-center">
            {s.paymentLabel}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {paymentMethods.map((label) => (
              <span key={label} className={PAYMENT_BADGE}>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-white/10 pt-5 flex flex-col items-center justify-center gap-2 text-center">
          <StatusBadge />
          <span className="text-[11px] text-slate-500 dark:text-zinc-500 leading-relaxed">
            © 2026 {t.common.storeName}. {t.common.allRightsReserved}
          </span>
          <span className="text-[11px] text-slate-600 dark:text-zinc-600 leading-relaxed">{f.madeWith}</span>
        </div>
      </div>
    </footer>
  );
}
