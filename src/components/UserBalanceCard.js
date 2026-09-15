'use client';
import React, { useState, useEffect } from 'react';
import { Loader2, DollarSign, ShieldCheck, AlertCircle } from 'lucide-react';

export default function UserBalanceCard({ apiKey }) {
  const [keyData, setKeyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('کلیل چەوتە یان کار ناکەت');
        return res.json();
      })
      .then((data) => {
        setKeyData(data.data);
      })
      .catch((err) => {
        setError(err.message || 'ئاریشەیەک د پشکنینا باڵانسی دا چێبوو');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [apiKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-purple-300">
        <Loader2 size={14} className="animate-spin text-purple-400" />
        <span>پشکنینا بالانسی...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
        <AlertCircle size={15} className="shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!keyData) return null;

  const usage = keyData.usage ?? 0;
  const limit = keyData.limit;
  const remaining = limit !== null ? Math.max(0, limit - usage) : null;

  return (
    <div className="p-3.5 bg-slate-900/90 border border-purple-500/30 rounded-xl space-y-2 text-xs font-sans">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-slate-400 flex items-center gap-1">
          <ShieldCheck size={14} className="text-emerald-400" />
          ڕەوشا کلیلێ:
        </span>
        <span className="text-emerald-400 font-bold">چالاکە (VIP)</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-slate-400 flex items-center gap-1">
          <DollarSign size={14} className="text-purple-400" />
          باڵانسێ مایی:
        </span>
        <span className="text-white font-mono font-bold">
          {remaining !== null ? `$${remaining.toFixed(2)}` : 'بێ سنور (Unlimited)'}
        </span>
      </div>

      {keyData.label && (
        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
          <span>ناڤێ پاکێجێ:</span>
          <span className="text-purple-300">{keyData.label}</span>
        </div>
      )}
    </div>
  );
}
