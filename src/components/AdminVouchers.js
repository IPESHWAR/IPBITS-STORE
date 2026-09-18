'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Plus,
  RefreshCw,
  Ticket,
  Shield,
  Package,
  Printer,
  KeyRound,
  Copy,
  Download,
  Check,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/components/LanguageProvider';
import { LOCKED_PRODUCTS, getInstantCatalogProduct, getProductFulfillment } from '@/lib/catalog';
import { listBulkKeyTiers } from '@/lib/bulkKeyTiers';

function randomCode() {
  const chunk = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `IPBITS-${chunk()}-${chunk()}`;
}

const INSTANT_PRODUCTS = LOCKED_PRODUCTS.filter((p) => p.deliveryType === 'instant');
const BULK_TIERS = listBulkKeyTiers();

export default function AdminVouchers({ initialTab = 'vouchers' }) {
  const { dir } = useLanguage();
  const [tab, setTab] = useState(
    ['vouchers', 'inventory', 'bulk'].includes(initialTab) ? initialTab : 'vouchers'
  );

  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [amountIqd, setAmountIqd] = useState('5000');
  const [printOpen, setPrintOpen] = useState(false);
  const [printAmount, setPrintAmount] = useState('5000');
  const [printQty, setPrintQty] = useState('10');
  const [printUnprintedOnly, setPrintUnprintedOnly] = useState(true);
  const [printBusy, setPrintBusy] = useState(false);
  const [printError, setPrintError] = useState('');

  const [inventory, setInventory] = useState([]);
  const [counts, setCounts] = useState([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invSaving, setInvSaving] = useState(false);
  const [invError, setInvError] = useState('');
  const [invSuccess, setInvSuccess] = useState('');
  const [invSlug, setInvSlug] = useState(INSTANT_PRODUCTS[0]?.id || 'chatgpt');
  const [invType, setInvType] = useState(getProductFulfillment(INSTANT_PRODUCTS[0]?.id || 'chatgpt'));
  const [invLines, setInvLines] = useState('');
  const [invFilter, setInvFilter] = useState('');

  const [bulkTier, setBulkTier] = useState(BULK_TIERS[1]?.id || 'weekly');
  const [bulkQty, setBulkQty] = useState('20');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkItems, setBulkItems] = useState([]);
  const [bulkCopied, setBulkCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/vouchers', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'load_failed');
        setVouchers([]);
        return;
      }
      setVouchers(Array.isArray(data.vouchers) ? data.vouchers : []);
    } catch {
      setError('load_failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInventory = useCallback(async () => {
    setInvLoading(true);
    setInvError('');
    try {
      const qs = invFilter ? `?slug=${encodeURIComponent(invFilter)}` : '';
      const res = await fetch(`/api/admin/inventory${qs}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInvError(data.error || 'load_failed');
        setInventory([]);
        return;
      }
      setInventory(Array.isArray(data.items) ? data.items : []);
      setCounts(Array.isArray(data.counts) ? data.counts : []);
    } catch {
      setInvError('load_failed');
    } finally {
      setInvLoading(false);
    }
  }, [invFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'inventory') loadInventory();
  }, [tab, loadInventory]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code || randomCode(), amount_iqd: amountIqd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'create_failed');
        return;
      }
      setCode('');
      await load();
    } catch {
      setError('create_failed');
    } finally {
      setSaving(false);
    }
  };

  const handleInventoryInsert = async (e) => {
    e.preventDefault();
    setInvSaving(true);
    setInvError('');
    setInvSuccess('');
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_slug: invSlug,
          item_type: invType,
          lines: invLines,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInvError(data.error || 'create_failed');
        return;
      }
      setInvLines('');
      setInvSuccess(`${data.inserted || 0} دانە هاتنە زێدەکرن`);
      await loadInventory();
    } catch {
      setInvError('create_failed');
    } finally {
      setInvSaving(false);
    }
  };

  const handleBulkGenerate = async (e) => {
    e?.preventDefault?.();
    const qty = Math.round(Number(bulkQty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 100) {
      setBulkError('Quantity must be 1–100');
      return;
    }
    setBulkBusy(true);
    setBulkError('');
    setBulkCopied(false);
    try {
      const res = await fetch('/api/admin/bulk-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: bulkTier, quantity: qty }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setBulkError(data.error || 'generation_failed');
        if (Array.isArray(data.codes) && data.codes.length) {
          setBulkItems(data.items || data.codes.map((code) => ({ code })));
        }
        return;
      }
      setBulkItems(Array.isArray(data.items) ? data.items : []);
      await load();
    } catch {
      setBulkError('generation_failed');
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkCodesText = useMemo(
    () => bulkItems.map((row) => row.code).filter(Boolean).join('\n'),
    [bulkItems]
  );

  const copyAllBulkCodes = async () => {
    if (!bulkCodesText) return;
    try {
      await navigator.clipboard.writeText(bulkCodesText);
      setBulkCopied(true);
      window.setTimeout(() => setBulkCopied(false), 1800);
    } catch {
      setBulkError('clipboard_failed');
    }
  };

  const exportBulkCsv = () => {
    if (!bulkItems.length) return;
    const header = 'code,tier,amount_iqd,days,limit_usd';
    const lines = bulkItems.map((row) =>
      [row.code, row.tier || bulkTier, row.amount_iqd ?? '', row.days ?? '', row.limit_usd ?? ''].join(',')
    );
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ipbits-${bulkTier}-keys-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedBulkTier = useMemo(
    () => BULK_TIERS.find((t) => t.id === bulkTier) || BULK_TIERS[0],
    [bulkTier]
  );

  const selectedProduct = useMemo(() => getInstantCatalogProduct(invSlug), [invSlug]);
  const countFor = (slug) => counts.find((c) => c.product_slug === slug);

  const printAmounts = useMemo(() => {
    const set = new Set([5000, 10000, 25000, 50000, Number(amountIqd) || 0]);
    vouchers.forEach((v) => {
      const n = Number(v.amount_iqd || 0);
      if (n > 0) set.add(n);
    });
    return [...set].filter((n) => n >= 1000).sort((a, b) => a - b);
  }, [vouchers, amountIqd]);

  const unusedForPrint = useMemo(
    () =>
      vouchers.filter((v) => {
        const unused = v.is_used !== true;
        const status = String(v.status || 'available').toLowerCase();
        const amountMatch = Number(v.amount_iqd) === Number(printAmount);
        const unprinted = v.is_printed !== true;
        return unused && status === 'available' && amountMatch && (!printUnprintedOnly || unprinted);
      }).length,
    [vouchers, printAmount, printUnprintedOnly]
  );

  const openPrintSheet = () => {
    const amount = Math.round(Number(printAmount));
    const qty = Math.round(Number(printQty));
    if (!Number.isFinite(amount) || amount < 1000) {
      setPrintError('بڕێ کارتی هەلبژێرە');
      return;
    }
    if (!Number.isFinite(qty) || qty < 1) {
      setPrintError('ژمارا کارتان بنڤیسە');
      return;
    }
    setPrintError('');
    setPrintBusy(true);
    const qs = new URLSearchParams({
      amount: String(amount),
      qty: String(qty),
      unprinted: printUnprintedOnly ? '1' : '0',
    });
    const win = window.open(`/admin/vouchers/print?${qs}`, '_blank', 'noopener,noreferrer');
    setPrintBusy(false);
    if (!win) {
      setPrintError('پەنجەرەیا چاپێ نەهاتە ڤەکرن. ڕێ بدە پەنجەرێن نوی.');
      return;
    }
    setPrintOpen(false);
    window.setTimeout(() => {
      load();
    }, 1600);
  };

  return (
    <div dir={dir} className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 text-emerald-300 text-xs font-bold mb-2">
              <Shield size={14} />
              <span>ڕێڤەبەریا کارتان (Admin)</span>
            </div>
            <h1 className="text-2xl font-black text-white">
              {tab === 'inventory'
                ? 'کۆگەها کارتان (Inventory)'
                : tab === 'bulk'
                  ? 'Bulk Key Generator'
                  : 'کارتیێن باڵانسی'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {tab === 'inventory'
                ? 'زێدەکرنا کۆدێن دیاری یان زانیاریێن ئەکاونتی بۆ هەر بەرهەمی، هەر رێزێک دانەیەکە'
                : tab === 'bulk'
                  ? 'Generate AI Hub voucher codes by pricing tier (OpenRouter + vouchers)'
                  : 'دروستکرن و چاڤدێرییا کۆدێن کارتی / Gift Card'}
            </p>
          </div>
          <Link
            href="/"
            className="text-xs font-bold text-slate-400 hover:text-white border border-white/10 rounded-xl px-3 py-2"
          >
            زڤڕین بۆ فرۆشگەهێ
          </Link>
        </div>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setTab('vouchers')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer border ${
              tab === 'vouchers'
                ? 'bg-emerald-600 border-emerald-400 text-white'
                : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <Ticket size={13} /> کارتیێن باڵانسی
          </button>
          <button
            type="button"
            onClick={() => setTab('inventory')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer border ${
              tab === 'inventory'
                ? 'bg-emerald-600 border-emerald-400 text-white'
                : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <Package size={13} /> کۆگەها کارتان (Inventory)
          </button>
          <button
            type="button"
            onClick={() => setTab('bulk')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer border ${
              tab === 'bulk'
                ? 'bg-emerald-600 border-emerald-400 text-white'
                : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound size={13} /> Bulk Keys
          </button>
        </div>

        {tab === 'vouchers' ? (
          <>
            <div className="mb-4">
              <button
                type="button"
                onClick={() => {
                  setPrintAmount(String(amountIqd || '5000'));
                  setPrintError('');
                  setPrintOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black cursor-pointer shadow-lg shadow-teal-900/30"
              >
                <Printer size={14} />
                چاپکرنا کارتان (Batch Print Cards)
              </button>
            </div>
            <form
              onSubmit={handleCreate}
              className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5 mb-6 grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-2.5"
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="IPBITS-XXXX"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono"
              />
              <input
                type="number"
                min="1000"
                value={amountIqd}
                onChange={(e) => setAmountIqd(e.target.value)}
                placeholder="IQD"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCode(randomCode())}
                  className="px-3 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                >
                  کۆدێ خۆکار
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  دروست بکە
                </button>
              </div>
            </form>

            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400">{vouchers.length} کارت</p>
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                <RefreshCw size={12} /> نووکرن
              </button>
            </div>

            {error && (
              <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200 font-bold">
                {error}
              </div>
            )}

            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-slate-900/80 text-slate-400">
                    <tr>
                      <th className="px-3 py-2.5 font-bold">کۆد</th>
                      <th className="px-3 py-2.5 font-bold">بڕ</th>
                      <th className="px-3 py-2.5 font-bold">ڕەوش</th>
                      <th className="px-3 py-2.5 font-bold">بکارهێنەر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-10 text-center text-slate-500">
                          <Loader2 className="inline animate-spin" size={16} />
                        </td>
                      </tr>
                    ) : vouchers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-10 text-center text-slate-500">
                          <Ticket className="inline mb-1" size={16} /> هێشتا چ کارت نینن
                        </td>
                      </tr>
                    ) : (
                      vouchers.map((v) => (
                        <tr key={v.code} className="border-t border-white/5 hover:bg-white/5">
                          <td className="px-3 py-2.5 font-mono text-white">{v.code}</td>
                          <td className="px-3 py-2.5 text-emerald-300 font-bold">
                            {Number(v.amount_iqd || 0).toLocaleString()} IQD
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {v.is_used ? (
                                <span className="text-rose-300">هاتیە مەزاختن</span>
                              ) : (
                                <span className="text-emerald-300">بەردەستە</span>
                              )}
                              {v.is_printed ? (
                                <span className="inline-flex items-center rounded-lg border border-sky-400/30 bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-black text-sky-200">
                                  چاپکری / Printed
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-400 font-mono">
                            {v.used_by || v.used_by_phone || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : tab === 'bulk' ? (
          <>
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5 mb-6">
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-[11px] text-start">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="px-2 py-1.5 font-bold">Tier</th>
                      <th className="px-2 py-1.5 font-bold">Days</th>
                      <th className="px-2 py-1.5 font-bold">OR Limit</th>
                      <th className="px-2 py-1.5 font-bold">IQD</th>
                      <th className="px-2 py-1.5 font-bold">Prefix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BULK_TIERS.map((t) => (
                      <tr
                        key={t.id}
                        className={`border-t border-white/5 ${
                          t.id === bulkTier ? 'bg-emerald-500/10 text-emerald-100' : 'text-slate-300'
                        }`}
                      >
                        <td className="px-2 py-1.5 font-mono">{t.id}</td>
                        <td className="px-2 py-1.5">{t.days}</td>
                        <td className="px-2 py-1.5">${t.limit_usd.toFixed(2)}</td>
                        <td className="px-2 py-1.5">{t.amount_iqd.toLocaleString()}</td>
                        <td className="px-2 py-1.5 font-mono">IPBITS-{t.prefix}-XXXXXXXX</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <form
                onSubmit={handleBulkGenerate}
                className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2.5"
              >
                <select
                  value={bulkTier}
                  onChange={(e) => setBulkTier(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white"
                >
                  {BULK_TIERS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} — {t.amount_iqd.toLocaleString()} IQD / ${t.limit_usd}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={bulkQty}
                  onChange={(e) => setBulkQty(e.target.value)}
                  placeholder="Qty"
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white"
                />
                <button
                  type="submit"
                  disabled={bulkBusy}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  {bulkBusy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                  Generate Batch
                </button>
              </form>

              {selectedBulkTier ? (
                <p className="mt-3 text-[11px] text-slate-400">
                  Selected: <span className="text-white font-mono">{selectedBulkTier.id}</span> ·{' '}
                  {selectedBulkTier.days} days · ${selectedBulkTier.limit_usd} OR ·{' '}
                  {selectedBulkTier.amount_iqd.toLocaleString()} IQD · prefix{' '}
                  <span className="font-mono text-sky-300">{selectedBulkTier.prefix}</span>
                </p>
              ) : null}

              {bulkError ? (
                <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200 font-bold">
                  {bulkError}
                </div>
              ) : null}
            </div>

            {bulkItems.length > 0 ? (
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-slate-900/80 border-b border-white/5">
                  <p className="text-xs text-slate-300 font-bold">
                    {bulkItems.length} code{bulkItems.length === 1 ? '' : 's'} generated
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={copyAllBulkCodes}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-[11px] font-black text-slate-200 hover:text-white cursor-pointer"
                    >
                      {bulkCopied ? <Check size={12} className="text-emerald-300" /> : <Copy size={12} />}
                      {bulkCopied ? 'Copied' : 'Copy All'}
                    </button>
                    <button
                      type="button"
                      onClick={exportBulkCsv}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[11px] font-black text-white cursor-pointer"
                    >
                      <Download size={12} />
                      Export CSV
                    </button>
                  </div>
                </div>
                <ul className="max-h-[28rem] overflow-y-auto divide-y divide-white/5">
                  {bulkItems.map((row) => (
                    <li
                      key={row.code}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs hover:bg-white/[0.03]"
                    >
                      <span className="font-mono text-white tracking-wide">{row.code}</span>
                      <span className="text-slate-400 shrink-0">
                        {Number(row.amount_iqd || 0).toLocaleString()} IQD
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-slate-500 text-xs">
                <KeyRound className="inline mb-2 opacity-50" size={18} />
                <p>Choose a tier and quantity, then Generate Batch.</p>
              </div>
            )}
          </>
        ) : (
          <>
            <form
              onSubmit={handleInventoryInsert}
              className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 sm:p-5 mb-6 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={invSlug}
                  onChange={(e) => {
                    setInvSlug(e.target.value);
                    setInvType(getProductFulfillment(e.target.value));
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white"
                >
                  {INSTANT_PRODUCTS.map((p) => {
                    const c = countFor(p.id);
                    const avail = c?.available || 0;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.id}) — {avail} بەردەست
                      </option>
                    );
                  })}
                </select>
                <select
                  value={invType}
                  onChange={(e) => setInvType(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white"
                >
                  <option value="gift_code">کۆدێ دیاری (Gift Code)</option>
                  <option value="credentials">زانیاریێن ئەکاونتی (Account)</option>
                </select>
              </div>
              <textarea
                value={invLines}
                onChange={(e) => setInvLines(e.target.value)}
                rows={7}
                placeholder={
                  invType === 'credentials'
                    ? 'email@example.com:password\nuser@mail.com|pass123'
                    : 'XXXX-XXXX-XXXX\nGIFT-CODE-2'
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono leading-relaxed"
              />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[11px] text-slate-500">
                  {selectedProduct?.name || invSlug} — هەر رێزێک دێ وەک دانەیەکا جودا بهێتە هەلگرتن
                </p>
                <button
                  type="submit"
                  disabled={invSaving || !invLines.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  {invSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  زێدەکرنا کۆگەهێ
                </button>
              </div>
            </form>

            {invError && (
              <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200 font-bold">
                {invError}
              </div>
            )}
            {invSuccess && (
              <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200 font-bold">
                {invSuccess}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <select
                value={invFilter}
                onChange={(e) => setInvFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="">هەمی بەرهەم</option>
                {INSTANT_PRODUCTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={loadInventory}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                <RefreshCw size={12} /> نووکرن
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-slate-900/80 text-slate-400">
                    <tr>
                      <th className="px-3 py-2.5 font-bold">بەرهەم</th>
                      <th className="px-3 py-2.5 font-bold">زانیاری</th>
                      <th className="px-3 py-2.5 font-bold">جۆر</th>
                      <th className="px-3 py-2.5 font-bold">ڕەوش</th>
                      <th className="px-3 py-2.5 font-bold">بکارهێنەر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invLoading ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                          <Loader2 className="inline animate-spin" size={16} />
                        </td>
                      </tr>
                    ) : inventory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-10 text-center text-slate-500">
                          <Package className="inline mb-1" size={16} /> کۆگەه ڤالایە
                        </td>
                      </tr>
                    ) : (
                      inventory.map((row) => (
                        <tr key={row.id} className="border-t border-white/5 hover:bg-white/5">
                          <td className="px-3 py-2.5 font-mono text-emerald-200">{row.product_slug}</td>
                          <td className="px-3 py-2.5 font-mono text-white break-all max-w-[280px]">
                            {row.payload}
                          </td>
                          <td className="px-3 py-2.5 text-slate-400">
                            {row.item_type === 'credentials' ? 'ئەکاونت' : 'کۆد'}
                          </td>
                          <td className="px-3 py-2.5">
                            {row.is_used ? (
                              <span className="text-rose-300">هاتیە مەزاختن</span>
                            ) : (
                              <span className="text-emerald-300">بەردەستە</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-slate-400 font-mono">{row.used_by || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
      {printOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setPrintOpen(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-2xl border border-white/10 bg-[#0d1020] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-black text-white mb-1">چاپکرنا کارتان (Batch Print Cards)</h2>
            <p className="text-[11px] text-slate-400 mb-4">
              بڕ و ژمارا کارتێن بەردەست هەلبژێرە. دێ چاپەکا A4 ب دوو ستوونان ڤەبیت.
            </p>
            <label className="block text-[11px] font-bold text-slate-300 mb-1.5">بڕێ کارتی</label>
            <select
              value={printAmount}
              onChange={(e) => setPrintAmount(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white mb-3"
            >
              {printAmounts.map((n) => (
                <option key={n} value={n}>
                  {n.toLocaleString('en-US')} IQD
                </option>
              ))}
            </select>
            <label className="block text-[11px] font-bold text-slate-300 mb-1.5">ژمارا کارتان</label>
            <div className="flex gap-2 mb-2">
              {['10', '50', '100'].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPrintQty(n)}
                  className={`flex-1 py-2 rounded-xl text-xs font-black border cursor-pointer ${
                    printQty === n
                      ? 'bg-emerald-600 border-emerald-400 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              max="200"
              value={printQty}
              onChange={(e) => setPrintQty(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white mb-3"
            />
            <label className="flex items-start gap-2.5 mb-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={printUnprintedOnly}
                onChange={(e) => setPrintUnprintedOnly(e.target.checked)}
                className="mt-0.5 accent-teal-500"
              />
              <span className="text-[11px] font-bold text-slate-200 leading-5">
                تنێ کارتێن نەچاپکری (Only unprinted vouchers)
              </span>
            </label>
            <p className="text-[11px] text-slate-400 mb-3">
              {unusedForPrint.toLocaleString()} کارتێن {Number(printAmount).toLocaleString('en-US')} IQD
              {printUnprintedOnly ? ' یێن نەچاپکری و بەردەست. ' : ' یێن بەردەست. '}
              ئەگەر کێمتر بن، دێ کۆدێن نوی هێنە دروستکرن.
            </p>
            {printError && (
              <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200 font-bold">
                {printError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPrintOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-slate-300 cursor-pointer"
              >
                داخستن
              </button>
              <button
                type="button"
                onClick={openPrintSheet}
                disabled={printBusy}
                className="flex-[2] inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {printBusy ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />} چاپ بکە
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
