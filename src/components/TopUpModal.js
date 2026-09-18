'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Wallet, Check, Ticket, History, Loader2, Send } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { useUser } from '@/components/UserProvider';
import { PAYMENT_ACCOUNTS } from '@/lib/catalog';
import { TOPUP_PACKAGES, iqdToUsd, normalizeWalletId } from '@/lib/wallet';
import { isValidContact } from '@/lib/orderValidation';
import { formatPrice } from '@/lib/i18n';

const PAYMENT_METHODS = [
  { id: 'FIB', logo: '/FIB.png' },
  { id: 'FastPay', logo: '/fastpay.png' },
  { id: 'USDT', logo: '/usdt.svg' },
];

export default function TopUpModal() {
  const { t, lang, dir } = useLanguage();
  const w = t.wallet;
  const s = t.store;
  const {
    phone,
    balanceIqd,
    balanceUsd,
    transactions,
    identify,
    refresh,
    applyWallet,
    topUpOpen,
    closeTopUp,
    historyOpen,
    openHistory,
    closeHistory,
  } = useUser();

  const open = topUpOpen || historyOpen;
  const [tab, setTab] = useState('packages');
  const [contact, setContact] = useState('');
  const [selectedPkg, setSelectedPkg] = useState(TOPUP_PACKAGES[1].id);
  const [customIqd, setCustomIqd] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('FIB');
  const [voucher, setVoucher] = useState('');
  const [loading, setLoading] = useState(false);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toast, setToast] = useState('');

  const contactValue = contact || phone || '';

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        closeTopUp();
        closeHistory();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, closeTopUp, closeHistory]);

  if (!w) return null;

  const pkg = TOPUP_PACKAGES.find((p) => p.id === selectedPkg);
  const custom = Math.round(Number(customIqd || 0));
  const amountIqd = custom >= 1000 ? custom : pkg?.amountIqd || 0;
  const amountUsd = custom >= 1000 ? iqdToUsd(custom) : pkg?.amountUsd || 0;
  const contactOk = isValidContact(contactValue);

  const ensureIdentified = async () => {
    const id = normalizeWalletId(contactValue);
    if (!isValidContact(contactValue)) {
      setError(w.alertInvalidContact);
      return null;
    }
    await identify(contactValue);
    return id;
  };

  const handleTopUp = async () => {
    setError('');
    setSuccess('');
    const id = await ensureIdentified();
    if (!id) return;
    if (amountIqd < 1000) {
      setError(w.alertInvalidAmount);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: id, amountIqd, amountUsd, paymentMethod }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(w.alertError);
        return;
      }
      if (data.status === 'approved') {
        applyWallet(data);
        setSuccess(w.topupSuccess);
        refresh(id);
      } else {
        setSuccess(w.topupPending);
      }
    } catch {
      setError(w.alertError);
    } finally {
      setLoading(false);
    }
  };

  const handleVoucher = async () => {
    setError('');
    setSuccess('');
    setToast('');
    const cleaned = voucher.trim().replace(/\s+/g, '');
    if (!cleaned || cleaned.length < 4) {
      setError(w.alertVoucherEmpty);
      return;
    }
    const id = await ensureIdentified();
    if (!id) return;
    setVoucherLoading(true);
    try {
      const res = await fetch('/api/voucher/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: id, voucher_code: cleaned }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || w.alertVoucherInvalid);
        return;
      }
      applyWallet({
        phone: data.phone || id,
        balance_iqd: data.balance_iqd,
        balance_usd: data.balance_usd,
      });
      setVoucher('');
      setSuccess(w.voucherSuccess || w.topupSuccess);
      setToast(w.topupSuccess);
      setTimeout(() => setToast(''), 3200);
      refresh(id);
    } catch {
      setError(w.alertError);
    } finally {
      setVoucherLoading(false);
    }
  };

  const typeLabel = (type) => {
    if (type === 'top_up') return w.txTopUp;
    if (type === 'purchase') return w.txPurchase;
    if (type === 'ai_usage') return w.txAiUsage;
    if (type === 'voucher') return w.txVoucher;
    return type;
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => {
            closeTopUp();
            closeHistory();
          }}
          dir={dir}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={w.title}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full sm:max-w-md bg-white border border-slate-200 text-slate-900 dark:bg-[#0d1020] dark:border-teal-400/25 dark:text-white rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-emerald-950/50 overflow-hidden max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-white/8">
              <div className="flex items-center gap-2 min-w-0">
                <Wallet className="text-emerald-500 dark:text-emerald-400 shrink-0" size={18} />
                <h2 className="font-black text-base text-slate-900 dark:text-white truncate">
                  {historyOpen ? w.historyTitle : w.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeTopUp();
                  closeHistory();
                }}
                className="w-8 h-8 inline-flex items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900 dark:bg-white/5 dark:border-white/10 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                aria-label={s.closeBtn}
                title={s.closeBtn}
              >
                <X size={15} />
              </button>
            </div>

            <div className="relative p-5 sm:p-6 overflow-y-auto space-y-4">
              {toast && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2.5 text-[11px] font-black text-emerald-700 dark:text-emerald-200 text-center animate-fade-up">
                  {toast}
                </div>
              )}

              <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-50 via-slate-50 to-emerald-50 dark:from-emerald-950/40 dark:via-slate-950/80 dark:to-emerald-950/40 p-3.5">
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300 mb-0.5">{w.availableBalance}</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">
                  {formatPrice(lang, balanceIqd, balanceUsd)}
                </p>
                {phone && <p className="text-[10px] text-slate-500 mt-1 font-mono truncate">{phone}</p>}
              </div>

              {!historyOpen && <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{w.subtitle}</p>}

              <div className="flex gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200 dark:bg-slate-950/70 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    closeHistory();
                    setTab('packages');
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                    !historyOpen && tab === 'packages' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {w.tabPackages}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeHistory();
                    setTab('voucher');
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                    !historyOpen && tab === 'voucher' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {w.tabVoucher}
                </button>
                <button
                  type="button"
                  onClick={openHistory}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors inline-flex items-center justify-center gap-1 ${
                    historyOpen ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <History size={11} />
                  {w.tabHistory}
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{w.phoneLabel}</label>
                <input
                  type="text"
                  value={contactValue}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={w.phonePlaceholder}
                  className="w-full bg-white text-slate-900 placeholder-slate-400 border border-slate-300 dark:bg-slate-950 dark:text-white dark:placeholder-slate-500 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {historyOpen ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {transactions.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">{w.historyEmpty}</p>
                  ) : (
                    transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">{typeLabel(tx.type)}</p>
                          <p className="text-[10px] text-slate-500 truncate">{tx.description}</p>
                        </div>
                        <span
                          className={`text-xs font-black shrink-0 ${
                            tx.amount_iqd > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-300'
                          }`}
                        >
                          {tx.amount_iqd > 0 ? '+' : ''}
                          {Number(tx.amount_iqd).toLocaleString()} IQD
                        </span>
                      </div>
                    ))
                  )}
                </div>
              ) : tab === 'voucher' ? (
                <div className="space-y-3">
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">{w.voucherLabel}</label>
                  <input
                    type="text"
                    value={voucher}
                    onChange={(e) => {
                      setError('');
                      setVoucher(e.target.value.toUpperCase());
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !voucherLoading) handleVoucher();
                    }}
                    placeholder={w.voucherPlaceholder}
                    disabled={voucherLoading}
                    className="w-full bg-white text-slate-900 placeholder-slate-400 border border-slate-300 dark:bg-slate-950 dark:text-white dark:placeholder-slate-500 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:border-emerald-500 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={voucherLoading || !contactOk || voucher.trim().length < 4}
                    onClick={handleVoucher}
                    className="w-full bg-gradient-to-r from-emerald-600 to-emerald-600 hover:opacity-95 disabled:opacity-40 text-white font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {voucherLoading ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />}
                    {voucherLoading ? s.submittingBtn : w.voucherBtn}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {TOPUP_PACKAGES.map((p) => {
                      const active = selectedPkg === p.id && custom < 1000;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedPkg(p.id);
                            setCustomIqd('');
                          }}
                          className={`p-3 rounded-2xl border text-start cursor-pointer transition-all ${
                            active
                              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500 dark:bg-emerald-600/20'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300 dark:bg-slate-950/60 dark:border-slate-800 dark:hover:border-slate-700'
                          }`}
                        >
                          <span className="block text-sm font-black text-slate-900 dark:text-white">
                            {p.amountIqd.toLocaleString()} IQD
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">${p.amountUsd.toFixed(2)}</span>
                          {active && <Check className="text-emerald-500 dark:text-emerald-400 mt-1" size={12} />}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="number"
                    min="1000"
                    value={customIqd}
                    onChange={(e) => setCustomIqd(e.target.value)}
                    placeholder={w.customAmount}
                    className="w-full bg-white text-slate-900 placeholder-slate-400 border border-slate-300 dark:bg-slate-950 dark:text-white dark:placeholder-slate-500 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:border-emerald-500"
                  />

                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{s.checkoutStep2Title}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map((m) => {
                      const active = paymentMethod === m.id;
                      const label = s[`payment${m.id === 'USDT' ? 'USDT' : m.id}`] || m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id)}
                          className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1.5 cursor-pointer ${
                            active
                              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500 dark:bg-emerald-600/20'
                              : 'bg-slate-50 border-slate-200 dark:bg-slate-950/60 dark:border-slate-800'
                          }`}
                        >
                          <span className="w-9 h-9 rounded-xl bg-white flex items-center justify-center p-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.logo} alt={label} className="w-full h-full object-contain" />
                          </span>
                          <span className="text-[9px] font-bold text-slate-700 dark:text-slate-300 text-center leading-tight">{label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {PAYMENT_ACCOUNTS[paymentMethod] && (
                    <p className="text-[10px] text-slate-500 font-mono truncate">
                      {PAYMENT_ACCOUNTS[paymentMethod].number}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={loading || !contactOk || amountIqd < 1000}
                    onClick={handleTopUp}
                    className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:opacity-95 disabled:opacity-40 text-white font-black py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
                    {w.proceedBtn}
                  </button>
                </div>
              )}

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-[11px] font-bold rounded-xl px-3 py-2 text-center">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold rounded-xl px-3 py-2 text-center">
                  {success}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
