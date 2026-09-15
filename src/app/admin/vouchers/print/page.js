'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import VoucherPrintCard, { QR_IMAGE_SRC } from '@/components/VoucherPrintCard';

export default function VoucherBatchPrintPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#fff' }}>ئامادەکرنا چاپێ...</div>}>
      <VoucherBatchPrintInner />
    </Suspense>
  );
}

function VoucherBatchPrintInner() {
  const searchParams = useSearchParams();
  const amount = Math.round(Number(searchParams.get('amount') || searchParams.get('amount_iqd') || 5000));
  const qty = Math.min(200, Math.max(1, Math.round(Number(searchParams.get('qty') || searchParams.get('limit') || 10))));
  const unprinted = searchParams.get('unprinted') !== '0';
  const autoprint = searchParams.get('autoprint') !== '0';

  const [vouchers, setVouchers] = useState([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError('');

    const loadAndMark = async () => {
      const qs = new URLSearchParams({
        amount_iqd: String(amount),
        limit: String(qty),
        fill: '1',
        mark: '1',
        unprinted: unprinted ? '1' : '0',
      });
      const res = await fetch(`/api/admin/vouchers/print?${qs}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'load_failed');
      }
      return Array.isArray(data.vouchers) ? data.vouchers : [];
    };

    loadAndMark()
      .then((list) => {
        if (cancelled) return;
        setVouchers(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'load_failed');
      });

    return () => {
      cancelled = true;
    };
  }, [amount, qty, unprinted]);

  const pages = useMemo(() => {
    const size = 8;
    const chunks = [];
    for (let i = 0; i < vouchers.length; i += size) {
      chunks.push(vouchers.slice(i, i + size));
    }
    return chunks;
  }, [vouchers]);

  useEffect(() => {
    if (!vouchers.length || ready) return;
    const qr = new Image();
    qr.onload = () => setReady(true);
    qr.onerror = () => setReady(true);
    qr.src = QR_IMAGE_SRC;
  }, [vouchers, ready]);

  useEffect(() => {
    if (!autoprint || !ready || !vouchers.length) return;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [autoprint, ready, vouchers.length]);

  return (
    <div className="voucher-print-root">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&display=swap"
      />
      <style>{PRINT_CSS}</style>
      <div className="voucher-print-toolbar no-print">
        <p>
          {error
            ? error
            : ready
              ? `${vouchers.length} کارت — ${amount.toLocaleString('en-US')} IQD`
              : 'ئامادەکرنا چاپێ...'}
        </p>
        <button type="button" onClick={() => window.print()} disabled={!vouchers.length}>
          چاپ بکە
        </button>
      </div>
      {pages.map((page, pageIdx) => (
        <section className="card-grid" key={`page-${pageIdx}`}>
          {page.map((voucher) => (
            <VoucherPrintCard
              key={voucher.code}
              code={voucher.code}
              amountIqd={voucher.amount || voucher.amount_iqd || amount}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

const PRINT_CSS = `
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .voucher-print-root {
    min-height: 100vh;
    background: #fff;
    color: #0b0c16;
    font-family: var(--font-vazirmatn), 'Vazirmatn', sans-serif;
  }
  .voucher-print-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    background: #111827;
    color: #fff;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .voucher-print-toolbar button {
    background: #7c3aed;
    color: #fff;
    border: 0;
    border-radius: 10px;
    padding: 8px 14px;
    font-weight: 800;
    cursor: pointer;
  }
  .voucher-print-toolbar button:disabled { opacity: 0.45; cursor: not-allowed; }
  .card-grid { display: grid; grid-template-columns: repeat(2, 85.6mm); gap: 6mm; justify-content: center; }
  .theme-card {
    width: 85.6mm;
    height: 53.98mm;
    border-radius: 4.5mm;
    position: relative;
    overflow: hidden;
    background: linear-gradient(140deg, #2b08e5 0%, #6817e8 45%, #a118df 75%, #e11ddb 100%) !important;
    padding: 4.5mm 5.5mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    color: #ffffff;
    page-break-inside: avoid;
    break-inside: avoid;
    font-family: var(--font-vazirmatn), 'Vazirmatn', sans-serif;
  }
  .header-row { display: flex; justify-content: space-between; align-items: center; direction: ltr; }
  .brand-wrap { display: flex; align-items: center; gap: 3mm; }
  .logo-box { width: 9.5mm; height: 9.5mm; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .brand-text { display: flex; flex-direction: column; text-align: left; }
  .brand-name { font-size: 16px; font-weight: 900; letter-spacing: 1.5px; line-height: 1; }
  .brand-sub { font-size: 6.2px; font-weight: 700; letter-spacing: 0.8px; color: rgba(255, 255, 255, 0.85); margin-top: 2px; text-transform: uppercase; }
  .amount-box { text-align: right; direction: rtl; }
  .amount-title { font-size: 6.5px; font-weight: 700; color: rgba(255, 255, 255, 0.85); }
  .amount-val { font-size: 20px; font-weight: 900; line-height: 1.1; letter-spacing: -0.5px; direction: ltr; }
  .amount-val span { font-size: 10px; font-weight: 800; margin-left: 2px; }
  .middle-row { display: flex; align-items: center; justify-content: space-between; gap: 3.5mm; margin: auto 0; direction: ltr; }
  .code-container { flex: 1; background: rgba(10, 11, 24, 0.65); border: 1px dashed rgba(255, 255, 255, 0.45); border-radius: 2.2mm; padding: 2mm 3.5mm; display: flex; flex-direction: column; gap: 1mm; }
  .code-top { display: flex; justify-content: space-between; align-items: center; }
  .code-lbl-en { font-size: 5.5px; font-weight: 800; letter-spacing: 0.6px; color: #e879f9; text-transform: uppercase; }
  .code-lbl-ku { font-size: 6.5px; font-weight: 700; color: #e2e8f0; direction: rtl; }
  .code-val { font-family: 'Courier New', Courier, monospace; font-size: 13px; font-weight: 900; letter-spacing: 2px; color: #ffffff; text-align: left; }
  .qr-container { width: 15.5mm; height: 15.5mm; background: #ffffff; border-radius: 2mm; padding: 1mm; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
  .qr-img { width: 11.5mm; height: 11.5mm; display: block; }
  .qr-text { font-size: 4px; font-weight: 900; color: #0b0c16; letter-spacing: 0.4px; margin-top: 0.4mm; }
  .footer-row { display: flex; justify-content: space-between; align-items: center; border-top: 0.5px solid rgba(255, 255, 255, 0.25); padding-top: 1.8mm; }
  .footer-ku { font-size: 7px; font-weight: 700; direction: rtl; }
  .footer-web { font-size: 7.5px; font-weight: 800; letter-spacing: 1px; direction: ltr; }
  @media print {
    html, body {
      background: #fff !important;
      color-scheme: light;
      overflow: visible !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print { display: none !important; }
    .voucher-print-root { background: #fff; }
    .card-grid {
      break-after: page;
      page-break-after: always;
    }
    .card-grid:last-child {
      break-after: auto;
      page-break-after: auto;
    }
    .theme-card {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
  }
`;
