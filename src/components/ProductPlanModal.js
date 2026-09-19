'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import ProductLogoBadge from '@/components/ProductLogoBadge';
import { useLanguage } from '@/components/LanguageProvider';
import { formatMoney } from '@/lib/i18n';
import { getProductName, getProductPlans, getProductSubtitle, startingPlan } from '@/lib/catalog';

const BUY_BTN =
  'w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-300 dark:text-emerald-400 dark:bg-emerald-500/[0.06] dark:hover:bg-emerald-500/[0.14] dark:border-emerald-500/25 dark:hover:border-emerald-400/50 shadow-sm transition-all duration-150 ease-out active:scale-[0.96] cursor-pointer select-none';

export default function ProductPlanModal({ product, open, onClose, onConfirm }) {
  const { lang, t, dir } = useLanguage();
  const s = t.store;
  const plans = getProductPlans(product);
  const [selectedId, setSelectedId] = useState(startingPlan(product)?.id);

  useEffect(() => {
    if (!open || !product) return;
    setSelectedId(startingPlan(product)?.id);
  }, [open, product]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const selected = plans.find((plan) => plan.id === selectedId) || plans[0];
  const brand = product?.brandColor || '#7C3AED';

  return (
    <AnimatePresence>
      {open && product && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="plan-modal-title"
          dir={dir}
          onClick={onClose}
        >
          <motion.div
            key="plan-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            aria-hidden="true"
          />

          <motion.div
            key="plan-panel"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full sm:max-w-md bg-white/95 dark:bg-[#0d1117]/95 border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="pointer-events-none absolute -top-16 -end-12 w-44 h-44 rounded-full blur-3xl opacity-35"
              style={{ backgroundColor: brand }}
              aria-hidden="true"
            />

            <div className="relative flex items-start justify-between gap-3 p-5 sm:p-6 border-b border-slate-200 dark:border-white/8">
              <div className="flex items-center gap-3 min-w-0">
                <ProductLogoBadge
                  name={product.name}
                  brandIcon={product.brandIcon}
                  alt={product.name}
                />
                <div className="min-w-0">
                  <h2 id="plan-modal-title" className="font-black text-base sm:text-lg text-slate-900 dark:text-white leading-tight truncate">
                    {getProductName(product, lang)}
                  </h2>
                  <span className="mt-1 block text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 tracking-wide leading-snug">
                    {getProductSubtitle(product, lang)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 inline-flex items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-slate-400 dark:hover:text-white cursor-pointer transition-all duration-200 ease-out shrink-0"
                aria-label={s.closeBtn}
              >
                <X size={15} />
              </button>
            </div>

            <div className="relative p-5 sm:p-6 space-y-4 overflow-y-auto">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{s.selectDuration}</p>
              <div className="grid grid-cols-1 gap-2.5" role="radiogroup" aria-label={s.selectDuration}>
                {plans.map((plan) => {
                  const active = plan.id === selected?.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSelectedId(plan.id)}
                      className={`w-full text-start rounded-2xl px-4 py-3.5 border transition-all duration-200 ease-out cursor-pointer ${
                        active
                          ? 'bg-cyan-50 border-cyan-400/60 shadow-[0_0_22px_rgba(34,211,238,0.12)] dark:bg-cyan-500/10 dark:shadow-[0_0_22px_rgba(34,211,238,0.22)]'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300 dark:bg-slate-950/50 dark:border-slate-800/80 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ease-out ${
                              active ? 'border-cyan-500 dark:border-cyan-300' : 'border-slate-300 dark:border-slate-600'
                            }`}
                            aria-hidden="true"
                          >
                            {active && <span className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-300" />}
                          </span>
                          <span className={`text-sm font-bold truncate ${active ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                            {plan.duration || plan.name}
                          </span>
                        </div>
                        <span className={`text-sm font-semibold shrink-0 tabular-nums ${active ? 'text-cyan-700 dark:text-cyan-200' : 'text-slate-900 dark:text-white'}`} dir="ltr">
                          {formatMoney(lang, plan)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative p-5 sm:p-6 pt-2 border-t border-slate-200 dark:border-white/8">
              <button
                type="button"
                onClick={() => selected && onConfirm?.(product, selected)}
                className={BUY_BTN}
              >
                {s.buyNowBtn}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
