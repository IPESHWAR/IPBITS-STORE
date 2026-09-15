'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, RefreshCw, Undo2 } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Logo from '@/components/Logo';
import { useLanguage } from '@/components/LanguageProvider';

const SERVICE_I18N = {
  openrouter: 'svcOpenRouter',
  database: 'svcDatabase',
  fulfillment: 'svcKeyDelivery',
  key_delivery: 'svcKeyDelivery',
};

function StatusPill({ status, labels }) {
  const map = {
    operational: {
      text: labels.operational,
      cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    },
    degraded: {
      text: labels.degraded,
      cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    },
    outage: {
      text: labels.outage,
      cls: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    },
  };
  const m = map[status] || map.degraded;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${m.cls}`}>
      {m.text}
    </span>
  );
}

function GlowDot({ ok = true }) {
  const color = ok ? 'bg-emerald-400 shadow-[0_0_16px_rgba(56,189,248,0.85)]' : 'bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.75)]';
  return (
    <span className="relative flex h-3.5 w-3.5 shrink-0">
      <span className={`absolute inset-0 rounded-full animate-ping opacity-50 ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      <span className={`relative inline-flex h-3.5 w-3.5 rounded-full ${color}`} />
    </span>
  );
}

export default function StatusPage() {
  const { t, dir, isRtl } = useLanguage();
  const st = t.status;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'failed');
      setData(json);
    } catch {
      setError(st.loadError);
    } finally {
      setLoading(false);
    }
  }, [st.loadError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch + 30s polling interval
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const overall = data?.status || data?.overall || 'operational';
  const isOk = overall === 'operational';
  const banner =
    overall === 'operational'
      ? st.bannerOk
      : overall === 'outage'
        ? st.bannerOutage
        : st.bannerDegraded;

  const uptime = typeof data?.uptime30d === 'number' ? data.uptime30d : 99.9;

  return (
    <div
      dir={dir}
      suppressHydrationWarning
      className="lm-status-page min-h-screen w-full bg-[#070913] text-white relative overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-40 start-1/2 -translate-x-1/2 w-[50rem] h-[28rem] rounded-full bg-emerald-700/15 blur-[120px]" />
        <div className="absolute bottom-10 end-0 w-80 h-80 rounded-full bg-emerald-600/10 blur-[100px]" />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-[#0c1022]/80 backdrop-blur-xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Logo framed compact />
          <div className="min-w-0">
            <h1 className="text-sm font-black truncate lm-status-title">{st.pageTitle}</h1>
            <p className="text-[10px] text-slate-400 truncate lm-status-sub">{st.pageSubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {st.refresh}
          </button>
          <LanguageSwitcher compact />
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-5">
        {/* Main status card */}
        <div
          className={`lm-status-hero relative overflow-hidden rounded-3xl border px-5 sm:px-7 py-7 sm:py-8 backdrop-blur-xl shadow-2xl ${
            isOk
              ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/50 via-slate-900/80 to-slate-950/90'
              : overall === 'outage'
                ? 'border-rose-500/40 bg-gradient-to-br from-rose-950/50 via-slate-900/80 to-slate-950/90'
                : 'border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-slate-900/80 to-slate-950/90'
          }`}
        >
          <div
            className={`pointer-events-none absolute -top-10 -end-10 w-40 h-40 rounded-full blur-3xl ${
              isOk ? 'bg-emerald-500/25' : overall === 'outage' ? 'bg-rose-500/25' : 'bg-amber-500/25'
            }`}
            aria-hidden="true"
          />
          <div className="relative flex items-center gap-3.5">
            <GlowDot ok={isOk} />
            <div>
              <p className="text-lg sm:text-xl font-black leading-snug text-white lm-status-banner">{banner}</p>
              {(data?.lastUpdated || data?.lastChecked) && (
                <p className="text-[11px] text-slate-400 mt-1.5 lm-status-meta">
                  {st.lastChecked}: {new Date(data.lastUpdated || data.lastChecked).toLocaleString()}
                  {(data.latency || data.latencyMs != null) && (
                    <span className="ms-2">
                      · {st.totalLatency}: {data.latency || `${data.latencyMs}ms`}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs px-4 py-3 font-semibold">
            {error}
          </div>
        )}

        {/* Service rows */}
        <div className="rounded-3xl border border-white/10 bg-slate-900/55 backdrop-blur-xl overflow-hidden shadow-2xl shadow-emerald-950/20 lm-status-card">
          <div className="px-4 sm:px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xs font-black tracking-wide text-white lm-status-card-title">{st.servicesTitle}</h2>
            <span className="text-[10px] text-slate-500 font-medium">{st.autoRefresh}</span>
          </div>

          <ul className="divide-y divide-white/5">
            {(data?.services || []).map((svc) => {
              const labelKey = SERVICE_I18N[svc.id];
              const name = (labelKey && st[labelKey]) || svc.name;
              const latencyLabel = svc.latency || (svc.latencyMs != null ? `${svc.latencyMs}ms` : '—');
              return (
                <li
                  key={svc.id}
                  className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 justify-between"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        svc.status === 'operational'
                          ? 'bg-emerald-400'
                          : svc.status === 'outage'
                            ? 'bg-rose-400'
                            : 'bg-amber-400'
                      }`}
                    />
                    <p className="text-sm font-bold text-white lm-status-svc-name">{name}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ps-4 sm:ps-0">
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums lm-status-svc-meta">
                      {st.latency}: <span className="text-slate-200 font-bold">~{latencyLabel}</span>
                    </span>
                    <StatusPill
                      status={svc.status}
                      labels={{
                        operational: st.operational,
                        degraded: st.degraded,
                        outage: st.outage,
                      }}
                    />
                  </div>
                </li>
              );
            })}

            {loading && !data && (
              <li className="px-5 py-10 flex justify-center text-slate-400 text-xs gap-2">
                <Loader2 size={14} className="animate-spin" />
                {st.loading}
              </li>
            )}
          </ul>
        </div>

        {/* 30-day uptime bar */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-4 sm:p-5 lm-status-card">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-xs font-black text-white lm-status-card-title">{st.uptime30Title}</h3>
            <span className="text-sm font-black text-emerald-300 tabular-nums">{uptime}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-800/90 overflow-hidden border border-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.45)] transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, uptime))}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-2.5 lm-status-svc-meta">{st.uptime30Hint}</p>
        </div>

        <Link
          href="/"
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-xs font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white shadow-lg shadow-emerald-600/25 hover:opacity-95 transition-all"
        >
          {isRtl ? <ArrowRight size={14} /> : <Undo2 size={14} />}
          {st.backHome}
        </Link>

        <p className="text-center text-[11px] text-slate-500 leading-relaxed max-w-md mx-auto">
          {st.footerNote}
        </p>
      </main>
    </div>
  );
}
