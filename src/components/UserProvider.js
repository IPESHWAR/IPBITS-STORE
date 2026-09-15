'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { WALLET_STORAGE_KEY, normalizeWalletId, toWalletAmount } from '@/lib/wallet';

const UserContext = createContext(null);
const IS_DEV = process.env.NODE_ENV === 'development';
const DEV_MOCK_BALANCE_IQD = 100_000;

function readSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(WALLET_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function UserProvider({ children }) {
  const [phone, setPhone] = useState('');
  const [balanceIqd, setBalanceIqd] = useState(0);
  const [balanceUsd, setBalanceUsd] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const phoneRef = useRef('');
  const lastRefreshKey = useRef('');

  useEffect(() => {
    phoneRef.current = phone;
  }, [phone]);

  const applyWallet = useCallback((data) => {
    if (!data) return;
    const nextPhone = data.phone || data.phone_id || '';
    if (nextPhone) {
      setPhone((prev) => (prev === nextPhone ? prev : nextPhone));
    }
    if (data.balance_iqd != null && data.balance_iqd !== '') {
      const nextIqd = toWalletAmount(data.balance_iqd);
      setBalanceIqd((prev) => (prev === nextIqd ? prev : nextIqd));
    }
    if (data.balance_usd != null && data.balance_usd !== '') {
      const nextUsd = toWalletAmount(data.balance_usd);
      setBalanceUsd((prev) => (prev === nextUsd ? prev : nextUsd));
    }
    if (Array.isArray(data.transactions)) {
      setTransactions((prev) => {
        try {
          if (JSON.stringify(prev) === JSON.stringify(data.transactions)) return prev;
        } catch {
          /* fall through */
        }
        return data.transactions;
      });
    }
  }, []);

  const refresh = useCallback(async (overridePhone) => {
    const id = normalizeWalletId(overridePhone || phoneRef.current);
    if (!id) return null;
    try {
      const res = await fetch(`/api/wallet?phone=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return null;
      applyWallet(data);
      return data;
    } catch {
      return null;
    }
  }, [applyWallet]);

  const identify = useCallback(async (rawPhone) => {
    const id = normalizeWalletId(rawPhone);
    if (!id) return null;
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return null;
      applyWallet({ ...data, phone: data.phone || id });
      const latest = await refresh(id);
      return latest || data;
    } catch {
      return null;
    }
  }, [applyWallet, refresh]);

  useEffect(() => {
    const saved = readSession();
    if (saved?.phone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhone(saved.phone);
      setBalanceIqd(Number(saved.balance_iqd || 0));
      setBalanceUsd(Number(saved.balance_usd || 0));
    } else if (IS_DEV) {
      // Local testing without a real wallet session.
      setBalanceIqd(DEV_MOCK_BALANCE_IQD);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        WALLET_STORAGE_KEY,
        JSON.stringify({ phone, balance_iqd: balanceIqd, balance_usd: balanceUsd })
      );
    } catch {
      /* ignore */
    }
  }, [phone, balanceIqd, balanceUsd, hydrated]);

  useEffect(() => {
    if (!hydrated || !phone) return;
    if (lastRefreshKey.current === phone) return;
    lastRefreshKey.current = phone;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh(phone);
  }, [hydrated, phone, refresh]);

  const value = useMemo(
    () => ({
      phone,
      balanceIqd,
      balanceUsd,
      transactions,
      hydrated,
      identify,
      refresh,
      applyWallet,
      openTopUp: () => setTopUpOpen(true),
      closeTopUp: () => setTopUpOpen(false),
      topUpOpen,
      openHistory: () => setHistoryOpen(true),
      closeHistory: () => setHistoryOpen(false),
      historyOpen,
    }),
    [phone, balanceIqd, balanceUsd, transactions, hydrated, identify, refresh, applyWallet, topUpOpen, historyOpen]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within UserProvider');
  }
  return ctx;
}
