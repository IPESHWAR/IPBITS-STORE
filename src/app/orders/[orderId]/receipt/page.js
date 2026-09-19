'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Printer, ArrowRight } from 'lucide-react';

function moneyLine(totalUsd, totalIqd) {
  const usd = Number(totalUsd) || 0;
  const iqd = Number(totalIqd) || 0;
  if (usd > 0 && iqd > 0) return `$${usd.toFixed(2)} · IQD ${iqd.toLocaleString('en-US')}`;
  if (usd > 0) return `$${usd.toFixed(2)}`;
  if (iqd > 0) return `IQD ${iqd.toLocaleString('en-US')}`;
  return '—';
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Baghdad', hour12: false });
  } catch {
    return String(iso);
  }
}

export default function OrderReceiptPage({ params }) {
  const resolved = use(Promise.resolve(params));
  const orderId = resolved?.orderId || '';
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setError('order_id required');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}?receipt=1`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setError(data.error || 'Order not found');
          return;
        }
        if (!cancelled) setOrder(data);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const status = String(order?.status || '').toLowerCase();
  const confirmed = status === 'approved' || status === 'confirmed' || status === 'completed';
  const licenseKey = order?.licenseKey?.key_code || order?.license_key || '';

  return (
    <div className="min-h-[100dvh] bg-[#090A0F] text-white" dir="rtl">
      <div className="mx-auto max-w-lg px-4 py-8 print:max-w-none print:px-0 print:py-0 print:bg-white print:text-black">
        <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowRight size={14} />
            گەڕانەوە بۆ فرۆشگەهـ
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!order}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-4 py-2 text-xs font-bold transition-all cursor-pointer active:scale-[0.98]"
          >
            <Printer size={14} />
            پرێنت / Print
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-400 text-center py-16">بارکرن…</p>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
            <p className="text-sm font-bold text-rose-300 mb-1">ئۆردەر نەهاتە دیتن</p>
            <p className="text-xs text-zinc-400 font-mono break-all">{orderId}</p>
            <p className="text-xs text-zinc-500 mt-2">{error}</p>
          </div>
        ) : (
          <article
            className="rounded-2xl border border-white/10 bg-[#0d1118] p-6 sm:p-8 shadow-xl print:border print:border-black print:rounded-none print:shadow-none print:bg-white"
            id="ipbits-receipt"
          >
            <header className="text-center border-b border-white/10 print:border-black/20 pb-4 mb-5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-400 print:text-emerald-700 font-semibold mb-1">
                IPBITS STORE
              </p>
              <h1 className="text-xl font-black tracking-tight">وەسڵ / Receipt</h1>
              <p
                className={`mt-2 inline-flex text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  confirmed
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 print:text-emerald-800'
                    : status === 'rejected'
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}
              >
                {confirmed
                  ? '✅ پەسەندکر (Confirmed)'
                  : status === 'rejected'
                    ? '❌ ڕەتکری'
                    : '⏳ چاڤەرێی پەسەندکرنێ'}
              </p>
            </header>

            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-400 print:text-zinc-600 shrink-0">ئۆردەر</dt>
                <dd className="font-mono text-xs sm:text-sm text-end break-all">{order.id}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-400 print:text-zinc-600 shrink-0">کات</dt>
                <dd className="text-end tabular-nums" dir="ltr">
                  {formatWhen(order.updatedAt || order.createdAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-400 print:text-zinc-600 shrink-0">کڕیار</dt>
                <dd className="text-end font-semibold">{order.customerName || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-400 print:text-zinc-600 shrink-0">واتساپ</dt>
                <dd className="text-end font-mono text-xs" dir="ltr">
                  {order.customerPhone || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-400 print:text-zinc-600 shrink-0">بەرهەم / پلان</dt>
                <dd className="text-end">
                  {order.itemsLabel || order.planType || '—'}
                  {order.durationDays ? ` · ${order.durationDays} ڕۆژ` : ''}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-400 print:text-zinc-600 shrink-0">گشتی</dt>
                <dd className="text-end font-bold text-emerald-400 print:text-emerald-700" dir="ltr">
                  {moneyLine(order.totalUsd, order.totalIqd)}
                </dd>
              </div>
              {order.paymentMethod ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-400 print:text-zinc-600 shrink-0">پارەدان</dt>
                  <dd className="text-end">{order.paymentMethod}</dd>
                </div>
              ) : null}
              {order.transactionId ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-zinc-400 print:text-zinc-600 shrink-0">کۆدێ وەسڵی</dt>
                  <dd className="text-end font-mono text-xs break-all">{order.transactionId}</dd>
                </div>
              ) : null}
            </dl>

            {licenseKey ? (
              <div className="mt-6 rounded-xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 print:border-emerald-700 print:bg-emerald-50 p-4 text-center">
                <p className="text-[10px] uppercase tracking-wider text-emerald-400/80 print:text-emerald-800 mb-2">
                  License Key
                </p>
                <p className="font-mono text-base sm:text-lg font-black break-all select-all" dir="ltr">
                  {licenseKey}
                </p>
              </div>
            ) : confirmed ? (
              <p className="mt-6 text-center text-xs text-zinc-400">
                Account Service — کلیلێ IPBITS ناهێتە دروستکرن. زانیاریێن ئەکاونتی ب واتساپێ دهێنە ناردن.
              </p>
            ) : (
              <p className="mt-6 text-center text-xs text-amber-300/90">
                کلیل پشتی پەسەندکرنا ئەدمینێ دێ دەرکەڤیت.
              </p>
            )}

            <footer className="mt-8 pt-4 border-t border-white/10 print:border-black/20 text-center text-[10px] text-zinc-500 print:text-zinc-600">
              ipbits.store · پشتەڤانی ٢٤/٧
            </footer>
          </article>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
