'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Check,
  CheckCircle2,
  Copy,
  Send,
  RefreshCw,
  Clock,
  Zap,
  Loader2,
  Upload,
  ImageIcon,
} from 'lucide-react';
import { PAYMENT_ACCOUNTS, CHECKOUT_PAYMENT_METHODS } from '@/lib/catalog';
import { isValidFullName, isValidWhatsAppPhone, isValidContact } from '@/lib/orderValidation';
import { parseDeliveryPayload } from '@/lib/inventory';
import { formatTotal } from '@/lib/i18n';
import { useLanguage } from '@/components/LanguageProvider';

const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-2 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 via-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/25 hover:opacity-95 active:scale-[0.96] transition-all duration-150 ease-out cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed';

const PANEL =
  'relative w-full sm:max-w-md bg-white/95 dark:bg-[#0B0D14]/95 border border-slate-200/90 dark:border-white/[0.08] backdrop-blur-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl dark:shadow-[0_0_50px_-10px_rgba(0,0,0,0.8)] overflow-hidden max-h-[92vh] flex flex-col';

const INPUT =
  'w-full rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/60 transition-all';

const PAYMENT_PILL =
  'px-3.5 py-1.5 rounded-xl text-xs tracking-wider font-medium select-none transition-all duration-200 cursor-pointer';

const PAYMENT_PILL_IDLE =
  'text-slate-700 bg-slate-100/90 border border-slate-200 hover:border-emerald-500/40 hover:text-emerald-600 hover:bg-emerald-50 dark:text-zinc-300 dark:bg-white/[0.03] dark:border-white/[0.08] dark:hover:border-emerald-500/40 dark:hover:text-emerald-400 dark:hover:bg-emerald-500/[0.04]';

const PAYMENT_PILL_ACTIVE =
  'text-emerald-600 bg-emerald-50 border border-emerald-500/40 dark:text-emerald-400 dark:bg-emerald-500/[0.04] dark:border-emerald-500/40';

/**
 * Manual Telegram checkout — unified one-page royal modal.
 */
export function CheckoutModal({
  open,
  onClose,
  s,
  dir,
  totalLabel,
  itemsLabel,
  customerName,
  setCustomerName,
  contactValue,
  setContactValue,
  email,
  setEmail,
  paymentMethod,
  setPaymentMethod,
  transactionId,
  setTransactionId,
  receiptImage,
  setReceiptImage,
  loading,
  formError,
  onSubmit,
  copied,
  onCopyPaymentNumber,
  success,
  orderStatus,
  generatedKey,
  pendingOrderId,
  keyCopied,
  onCopyLicenseKey,
  onLaunchChat,
  onSendTelegram,
  onNewOrder,
  totalIqd = 0,
  totalUsd = 0,
  deliveredItems = [],
  copiedDeliveryIndex = null,
  onCopyDelivery,
  purchaseToast = '',
  manualSubmitted = false,
}) {
  const fileRef = useRef(null);
  const [localToast, setLocalToast] = useState('');
  const { lang } = useLanguage();
  const displayTotal = formatTotal(lang, totalIqd, totalUsd) || totalLabel;

  const nameOk = isValidFullName(customerName);
  const phoneOk = isValidWhatsAppPhone(contactValue) || isValidContact(contactValue);
  const canSubmit = nameOk && phoneOk && !!paymentMethod && !loading;
  const account = PAYMENT_ACCOUNTS[paymentMethod];
  const toastText = purchaseToast || localToast;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setLocalToast('');
  }, [open]);

  useEffect(() => {
    if (!paymentMethod || CHECKOUT_PAYMENT_METHODS.includes(paymentMethod)) return;
    setPaymentMethod?.('FIB');
  }, [paymentMethod, setPaymentMethod]);

  useEffect(() => {
    if (!localToast) return undefined;
    const timer = setTimeout(() => setLocalToast(''), 4200);
    return () => clearTimeout(timer);
  }, [localToast]);

  if (!s) return null;

  const onPickReceipt = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setReceiptImage?.(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setLocalToast(s.alertProofRequired || 'Image required');
      return;
    }
    if (file.size > 4.5 * 1024 * 1024) {
      setLocalToast(s.alertError || 'File too large');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      setReceiptImage?.({ base64, type: file.type, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const showManualSuccess =
    success && manualSubmitted && !generatedKey && deliveredItems.length === 0 && orderStatus !== 'rejected';

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
          dir={dir}
        >
          <motion.div
            key="checkout-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            aria-hidden="true"
          />

          <motion.div
            key="checkout-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-label={s.checkoutTitle}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={PANEL}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="pointer-events-none absolute -top-16 -end-16 w-44 h-44 rounded-full bg-emerald-500/15 blur-3xl opacity-60"
              aria-hidden="true"
            />

            {/* Header */}
            <div className="relative flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-200/80 dark:border-white/[0.08] shrink-0">
              <h2 className="font-black text-[15px] text-slate-900 dark:text-white truncate">
                {s.checkoutTitle}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 inline-flex items-center justify-center rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer transition-colors shrink-0 text-base leading-none"
                aria-label={s.closeBtn || 'Close'}
              >
                ✕
              </button>
            </div>

            <div className="relative px-4 sm:px-5 py-4 overflow-y-auto overscroll-contain">
              {success ? (
                <div className="text-center py-1 animate-fade-up">
                  {orderStatus === 'rejected' ? (
                    <>
                      <X className="w-14 h-14 text-rose-400 mx-auto mb-3" />
                      <h4 className="text-lg font-bold mb-1 text-slate-900 dark:text-white">{s.successRejected}</h4>
                    </>
                  ) : deliveredItems.length > 0 ? (
                    <>
                      <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
                      <h4 className="text-lg font-bold mb-3 text-slate-900 dark:text-white leading-relaxed">
                        {s.purchaseSuccessMsg}
                      </h4>
                      <div className="space-y-3 mb-3">
                        {deliveredItems.map((item, idx) => {
                          const parsed = parseDeliveryPayload(item.payload, item.item_type);
                          const copiedItem = copiedDeliveryIndex === idx;
                          return (
                            <div
                              key={item.inventory_id || `${item.product_slug}-${idx}`}
                              className="rounded-2xl border border-emerald-400/30 bg-slate-50 dark:bg-white/[0.03] p-3 text-start"
                            >
                              <p className="text-[11px] font-semibold text-slate-500 mb-2">
                                {parsed.kind === 'credentials' ? s.credentialsLabel : s.giftCodeLabel}
                              </p>
                              {parsed.email ? (
                                <div className="space-y-1.5 mb-3">
                                  <p className="font-mono text-sm text-emerald-600 dark:text-emerald-300 break-all select-all">
                                    {parsed.email}
                                  </p>
                                  <p className="font-mono text-sm text-emerald-700 dark:text-emerald-200 break-all select-all">
                                    {parsed.password}
                                  </p>
                                </div>
                              ) : (
                                <div className="mb-3 px-3 py-3 rounded-xl border-2 border-dashed border-emerald-400/50 font-mono text-sm font-black text-emerald-600 dark:text-emerald-300 break-all select-all">
                                  {parsed.raw}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => onCopyDelivery?.(parsed.raw, idx)}
                                className="w-full bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs cursor-pointer"
                              >
                                {copiedItem ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                <span>{copiedItem ? s.copiedKeyBtn : s.copyKeyBtn}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : generatedKey ? (
                    <>
                      <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
                      <h4 className="text-lg font-bold mb-1 text-slate-900 dark:text-white">{s.successTitle}</h4>
                      <p className="text-slate-500 text-xs leading-relaxed mb-4">{s.successDesc}</p>
                      <div className="mb-3 px-3 py-3 rounded-xl border-2 border-dashed border-emerald-400/50 bg-slate-50 dark:bg-white/[0.03] font-mono text-sm font-black text-emerald-600 dark:text-emerald-300 break-all select-all">
                        {generatedKey}
                      </div>
                      <button type="button" onClick={onCopyLicenseKey} className={`${PRIMARY_BTN} w-full py-2.5 text-xs mb-2.5`}>
                        {keyCopied ? <Check size={14} /> : <Copy size={14} />}
                        <span>{keyCopied ? s.copiedKeyBtn : s.copyKeyBtn}</span>
                      </button>
                      <button type="button" onClick={onLaunchChat} className={`${PRIMARY_BTN} w-full py-3 text-xs mb-2.5`}>
                        <Zap size={15} />
                        <span>{s.launchChatBtn}</span>
                      </button>
                    </>
                  ) : showManualSuccess ? (
                    <>
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/30">
                        <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                      </div>
                      <h4 className="text-lg font-bold mb-2 text-slate-900 dark:text-white leading-relaxed">
                        {s.manualOrderSuccess}
                      </h4>
                      <p className="text-slate-500 dark:text-zinc-400 text-xs leading-relaxed mb-5">
                        {s.manualOrderSuccessDesc}
                      </p>
                      {itemsLabel && <p className="text-[11px] text-slate-500 mb-1">{itemsLabel}</p>}
                      <p className="text-emerald-400 font-bold text-xl mb-5 tabular-nums">{displayTotal}</p>
                    </>
                  ) : (
                    <>
                      <div className="relative w-14 h-14 mx-auto mb-3">
                        <span className="absolute inset-0 rounded-full border-2 border-amber-400/30 animate-ping" />
                        <Clock className="w-14 h-14 text-amber-300 relative" />
                      </div>
                      <h4 className="text-lg font-bold mb-1 text-slate-900 dark:text-white">{s.successWaitingTitle}</h4>
                      <p className="text-amber-600/90 dark:text-amber-300/90 text-xs leading-relaxed mb-3">
                        {s.successPendingKey}
                      </p>
                      {pendingOrderId && (
                        <p className="text-[11px] text-slate-500 mb-4 font-mono">
                          {s.orderIdLabel}: {pendingOrderId}
                        </p>
                      )}
                    </>
                  )}

                  {!showManualSuccess && (
                    <button
                      type="button"
                      onClick={onSendTelegram}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xs shadow-lg shadow-emerald-600/30 mb-2.5 transition-all cursor-pointer"
                    >
                      <Send size={15} />
                      <span>{s.telegramBtn}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onNewOrder}
                    className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-all cursor-pointer"
                  >
                    <RefreshCw className="text-emerald-500" size={13} />
                    <span>{s.newOrderBtn}</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3.5">
                  {/* Order summary banner */}
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.03] px-3.5 py-3">
                    <div className="min-w-0 flex-1 text-start">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-zinc-500 font-semibold mb-0.5">
                        {s.subscriptions || 'Order'}
                      </p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                        {itemsLabel || '—'}
                      </p>
                    </div>
                    <p className="shrink-0 text-emerald-400 font-bold text-xl tabular-nums tracking-tight">
                      {displayTotal}
                    </p>
                  </div>

                  {/* Customer details */}
                  <div className="grid grid-cols-1 gap-2.5">
                    <label className="block space-y-1">
                      <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                        {s.customerNameLabel}
                      </span>
                      <input
                        type="text"
                        value={customerName || ''}
                        onChange={(e) => setCustomerName?.(e.target.value)}
                        placeholder={s.customerNamePlaceholder}
                        className={INPUT}
                        autoComplete="name"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                        {s.contactLabel}
                      </span>
                      <input
                        type="tel"
                        value={contactValue || ''}
                        onChange={(e) => setContactValue?.(e.target.value)}
                        placeholder={s.contactPlaceholder}
                        className={INPUT}
                        autoComplete="tel"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                        {s.emailLabel}
                      </span>
                      <input
                        type="email"
                        value={email || ''}
                        onChange={(e) => setEmail?.(e.target.value)}
                        placeholder={s.emailPlaceholder}
                        className={INPUT}
                        autoComplete="email"
                      />
                    </label>
                  </div>

                  {/* Payment method pills */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">{s.labelPayment}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {CHECKOUT_PAYMENT_METHODS.map((id) => {
                        const active = paymentMethod === id;
                        const label = id === 'QiCard' ? 'Qi Card' : id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setPaymentMethod?.(id)}
                            className={`${PAYMENT_PILL} ${active ? PAYMENT_PILL_ACTIVE : PAYMENT_PILL_IDLE}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {account && (
                      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.06] px-3.5 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 text-start">
                          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-300/80 font-semibold truncate">
                            {account.title || account.note}
                          </p>
                          <code className="text-sm font-bold text-slate-900 dark:text-white break-all select-all">
                            {account.number}
                          </code>
                        </div>
                        <button
                          type="button"
                          onClick={onCopyPaymentNumber}
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 text-[11px] font-bold cursor-pointer transition-all"
                        >
                          {copied ? <Check size={13} /> : <Copy size={13} />}
                          {copied ? s.copiedAccountBtn : s.copyAccountBtn}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Verification */}
                  <div className="space-y-2">
                    <label className="block space-y-1">
                      <span className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">
                        {s.verificationLabel}
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={transactionId || ''}
                          onChange={(e) => setTransactionId?.(e.target.value)}
                          placeholder={s.placeholderTxId}
                          className={`${INPUT} flex-1`}
                        />
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickReceipt} />
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          title={s.uploadReceiptHint}
                          className={`shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 transition-all cursor-pointer ${
                            receiptImage?.name
                              ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                              : 'border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-500 dark:text-zinc-400 hover:border-emerald-400/40'
                          }`}
                        >
                          {receiptImage?.name ? <ImageIcon size={15} /> : <Upload size={15} />}
                        </button>
                      </div>
                      {receiptImage?.name && (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate">{receiptImage.name}</p>
                      )}
                    </label>
                  </div>

                  {formError && <p className="text-xs text-rose-500 font-medium">{formError}</p>}
                  {toastText && <p className="text-xs text-amber-600 dark:text-amber-300 font-medium">{toastText}</p>}

                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={onSubmit}
                    className={`${PRIMARY_BTN} w-full py-3.5 text-sm shadow-[0_0_28px_-4px_rgba(16,185,129,0.55)]`}
                  >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                    <span>{loading ? s.submittingBtn : s.submitManualOrder}</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default CheckoutModal;
