'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Send,
  LayoutGrid,
  Bot,
  Clapperboard,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { CheckoutModal } from '@/components/CheckoutModal';
import ProductPlanModal from '@/components/ProductPlanModal';
import ProductLogoBadge from '@/components/ProductLogoBadge';
import { useLanguage } from '@/components/LanguageProvider';
import { useUser } from '@/components/UserProvider';
import { formatPrice, formatTotal, formatMoney } from '@/lib/i18n';
import { AI_TIERS_DATA, LOCKED_PRODUCTS, PAYMENT_ACCOUNTS, TELEGRAM_URL, getInstantCatalogProduct, getProductName, getProductPromoBadge, getProductSubtitle, hasMultiplePlans, isComingSoon, startingPlan, toCheckoutItem } from '@/lib/catalog';
import { supabase } from '@/lib/supabaseClient';
import { normalizePhone, validateOrderPayload } from '@/lib/orderValidation';

const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium text-white bg-gradient-to-r from-cyan-500 to-emerald-500 border border-white/20 shadow-[0_0_15px_-3px_rgba(16,185,129,0.35)] hover:shadow-[0_0_22px_-2px_rgba(34,211,238,0.45)] active:scale-[0.96] transition-all duration-150 ease-out cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed';

const CARD_BUY_BTN =
  'w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-300 dark:text-emerald-400 dark:bg-emerald-500/[0.06] dark:hover:bg-emerald-500/[0.14] dark:border-emerald-500/25 dark:hover:border-emerald-400/50 shadow-sm transition-all duration-150 ease-out active:scale-[0.96] cursor-pointer select-none';

const CARD_SOON_BTN =
  'w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold opacity-60 cursor-not-allowed bg-slate-100 text-slate-500 border border-slate-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700/50 hover:bg-slate-100 dark:hover:bg-zinc-800/60 select-none pointer-events-none';

const PILL_BTN =
  'inline-flex items-center justify-center gap-1.5 h-9 px-3.5 text-xs tracking-wide rounded-full backdrop-blur-md border border-slate-300 dark:border-white/10 text-slate-800 dark:text-zinc-200 bg-white dark:bg-white/[0.03] hover:bg-slate-50 dark:hover:bg-white/[0.06] hover:border-slate-400 dark:hover:border-cyan-400/40 transition-all duration-150 ease-out active:scale-[0.96] cursor-pointer select-none';


const HEADING =
  'text-slate-950 dark:text-white font-extrabold tracking-tight';
const BODY_SECONDARY =
  'text-slate-600 dark:text-zinc-400 font-medium';
const BODY_MUTED =
  'text-slate-800 dark:text-zinc-200';
const SURFACE_CARD =
  'bg-white/80 dark:bg-white/[0.02] border border-slate-200/90 dark:border-white/[0.08] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-none backdrop-blur-xl rounded-2xl';
const OFFER_SURFACE =
  'bg-white/90 dark:bg-[#0B0D14]/70 border border-slate-200/90 dark:border-white/[0.08] shadow-xl dark:shadow-[0_0_50px_-12px_rgba(16,185,129,0.12)] backdrop-blur-2xl rounded-3xl p-6 sm:p-8';
const TIER_ACTIVE =
  'lm-tier-selected bg-emerald-50 dark:bg-emerald-500/15 border-2 border-emerald-500 dark:border-emerald-400 text-emerald-800 dark:text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.15)] dark:shadow-[0_0_15px_rgba(52,211,153,0.2)]';
const TIER_IDLE =
  'lm-tier-unselected bg-transparent border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20';

const FEATURED_PRODUCT_IDS = ['chatgpt', 'claude', 'canva'];

function BuyAiHubFromQuery({ beginCheckout, tierName }) {
  const searchParams = useSearchParams();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    if (searchParams?.get('buy') !== 'ai_hub') return;
    opened.current = true;
    const tier = AI_TIERS_DATA.find((item) => item.id === '30_days') || AI_TIERS_DATA[2];
    beginCheckout({
      id: 'ai_bundle_30_days',
      name: `AI Hub - ${tierName || '٣٠ ڕۆژ'}`,
      priceIQD: tier.priceIQD,
      priceUSD: tier.priceUSD,
    });
  }, [searchParams, beginCheckout, tierName]);

  return null;
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export default function StorePage() {
  const { lang, t, dir, mounted } = useLanguage();
  const s = t.store;
  const {
    identify,
    applyWallet,
    refresh,
    phone,
    balanceIqd,
    balanceUsd,
    openTopUp,
  } = useUser();
  const router = useRouter();

  const [selectedTierId, setSelectedTierId] = useState('30_days');
  const [activeFilter, setActiveFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [checkoutItem, setCheckoutItem] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [contactValue, setContactValue] = useState('');
  const [optionalNote, setOptionalNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('FIB');
  const [transactionId, setTransactionId] = useState('');
  const [receiptImage, setReceiptImage] = useState(null);
  const [manualSubmitted, setManualSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payingWithBalance, setPayingWithBalance] = useState(false);
  const [success, setSuccess] = useState(false);
  const [generatedKey, setGeneratedKey] = useState(null);
  const [pendingOrderId, setPendingOrderId] = useState(null);
  const [orderStatus, setOrderStatus] = useState(null); // pending | approved | rejected
  const [keyCopied, setKeyCopied] = useState(false);
  const [formError, setFormError] = useState('');
  const [purchaseToast, setPurchaseToast] = useState('');
  const [deliveredItems, setDeliveredItems] = useState([]);
  const [copiedDeliveryIndex, setCopiedDeliveryIndex] = useState(null);
  const [stockAvailable, setStockAvailable] = useState(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const purchaseToastTimer = useRef(null);

  // Feature 1 — Live Search
  const [searchQuery, setSearchQuery] = useState('');
  const [showFullCatalog, setShowFullCatalog] = useState(false);

  // Feature 2 — Quick View Modal
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [planProduct, setPlanProduct] = useState(null);

  // Feature 3 — Notify Me Modal
  const [notifyProduct, setNotifyProduct] = useState(null);
  const [notifyContact, setNotifyContact] = useState('');
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyDone, setNotifyDone] = useState(false);

  const totalIQD = Number(checkoutItem?.priceIQD || 0);
  const totalUSD = Number(checkoutItem?.priceUSD || 0);
  const checkoutItems = checkoutItem ? [checkoutItem] : [];

  // Live order status: Realtime + polling fallback until key arrives
  useEffect(() => {
    if (!pendingOrderId || generatedKey || orderStatus === 'rejected') return;

    const applyStatus = (row) => {
      if (!row) return;
      setOrderStatus(row.status);
      if (row.status === 'approved' && (row.license_key || row.licenseKey?.key_code)) {
        const key = row.license_key || row.licenseKey?.key_code;
        setGeneratedKey(key);
        setLastOrder((prev) => (prev ? { ...prev, licenseKey: key } : prev));
      }
    };

    let channel;
    if (supabase) {
      channel = supabase
        .channel(`order-${pendingOrderId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${pendingOrderId}` },
          (payload) => applyStatus(payload.new)
        )
        .subscribe();
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(pendingOrderId)}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          applyStatus({
            status: data.status,
            license_key: data.licenseKey?.key_code || null,
            licenseKey: data.licenseKey,
          });
        }
      } catch {
        /* ignore poll errors */
      }
    };

    poll();
    const interval = setInterval(poll, 3000);

    return () => {
      clearInterval(interval);
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [pendingOrderId, generatedKey, orderStatus]);

  const productsSectionRef = useRef(null);

  const inventoryCartItems = useMemo(
    () => (checkoutItem && getInstantCatalogProduct(checkoutItem.id) ? [checkoutItem] : []),
    [checkoutItem]
  );
  const needsInventory = inventoryCartItems.length > 0;

  // Refresh wallet once when checkout opens (not on every keystroke / step).
  useEffect(() => {
    if (!checkoutOpen) return;
    const id = phone || contactValue;
    if (!id) return;
    let cancelled = false;
    (async () => {
      await refresh(id);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutOpen]);

  const inventorySlugsKey = inventoryCartItems.map((item) => item.id).join('|');

  useEffect(() => {
    if (!checkoutOpen || !needsInventory) {
      setStockAvailable(null);
      setStockLoading(false);
      return;
    }

    let cancelled = false;
    setStockLoading(true);
    Promise.all(
      inventoryCartItems.map((item) =>
        fetch(`/api/inventory/availability?slug=${encodeURIComponent(item.id)}`, { cache: 'no-store' })
          .then((res) => res.json())
          .catch(() => ({ available: false }))
      )
    )
      .then((results) => {
        if (cancelled) return;
        const available = results.every((row) => row.available);
        setStockAvailable(available);
        if (available) {
          setFormError((prev) => (prev === s.outOfStock ? '' : prev));
          setPurchaseToast((prev) => (prev === s.outOfStock ? '' : prev));
        }
      })
      .finally(() => {
        if (!cancelled) setStockLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // inventorySlugsKey is a stable string fingerprint of cart inventory ids
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutOpen, needsInventory, inventorySlugsKey, s.outOfStock]);

  const currentTierData = AI_TIERS_DATA.find((item) => item.id === selectedTierId) || AI_TIERS_DATA[2];
  const currentTierText = s.tiers[selectedTierId];

  const filterTabs = [
    { id: 'all', label: s.filterAll, icon: LayoutGrid },
    { id: 'ai', label: s.filterAi, icon: Bot },
    { id: 'media', label: s.filterMedia, icon: Clapperboard },
    { id: 'other', label: s.filterOther, icon: Layers },
  ];

  const filteredProducts = useMemo(() => {
    let list = showFullCatalog
      ? activeFilter === 'all'
        ? LOCKED_PRODUCTS
        : LOCKED_PRODUCTS.filter((p) => p.filterGroup === activeFilter)
      : LOCKED_PRODUCTS.filter((p) => FEATURED_PRODUCT_IDS.includes(p.id));
    if (showFullCatalog && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => {
        const sub = p.subtitle;
        const subHaystack =
          sub && typeof sub === 'object'
            ? [sub.ku, sub.ar, sub.en].filter(Boolean).join(' ').toLowerCase()
            : String(p.category || '').toLowerCase();
        return p.name.toLowerCase().includes(q) || subHaystack.includes(q);
      });
    }
    return list;
  }, [activeFilter, searchQuery, showFullCatalog]);

  const openFullCatalog = () => {
    setShowFullCatalog(true);
    setTimeout(() => {
      document.getElementById('store')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Deep-link hashes: /#pricing, /#store, /#faq, /#contact, /#features (+ legacy aliases)
  useEffect(() => {
    const raw = String(window.location.hash || '').replace(/^#/, '');
    if (!raw) return undefined;
    const aliases = { 'special-offer': 'pricing', catalog: 'store' };
    const id = aliases[raw] || raw;
    if (id === 'store') setShowFullCatalog(true);
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, []);

  const beginCheckout = (item) => {
    if (!item) return;
    setCheckoutItem(item);
    setSuccess(false);
    setGeneratedKey(null);
    setDeliveredItems([]);
    setPendingOrderId(null);
    setOrderStatus(null);
    setManualSubmitted(false);
    setFormError('');
    setPurchaseToast('');
    setCheckoutOpen(true);
  };

  const showPurchaseToast = (msg) => {
    setFormError(msg);
    setPurchaseToast(msg);
    if (purchaseToastTimer.current) clearTimeout(purchaseToastTimer.current);
    purchaseToastTimer.current = setTimeout(() => setPurchaseToast(''), 4200);
  };

  const handleResetForNewOrder = () => {
    setSuccess(false);
    setGeneratedKey(null);
    setDeliveredItems([]);
    setCopiedDeliveryIndex(null);
    setPendingOrderId(null);
    setOrderStatus(null);
    setKeyCopied(false);
    setFormError('');
    setPurchaseToast('');
    setCustomerName('');
    setContactValue('');
    setOptionalNote('');
    setTransactionId('');
    setReceiptImage(null);
    setManualSubmitted(false);
    setPaymentMethod('FIB');
    setCheckoutItem(null);
    setCheckoutOpen(false);
    productsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /** One-click: select the current AI Hub tier and jump straight into checkout. */
  const handleBuyNow = () => {
    beginCheckout({
      id: `ai_bundle_${selectedTierId}`,
      name: `AI Hub - ${currentTierText.name}`,
      priceIQD: currentTierData.priceIQD,
      priceUSD: currentTierData.priceUSD,
    });
  };

  /** One-click checkout for an instantly-deliverable catalog product (e.g. ChatGPT Plus, Claude Pro). */
  const handleBuyProduct = (product, plan) => {
    if (!product || isComingSoon(product)) return;
    setPlanProduct(null);
    setQuickViewProduct(null);
    beginCheckout(toCheckoutItem(product, plan));
  };

  /** Multi-plan cards open a picker; single-plan cards go straight to checkout. */
  const startProductPurchase = (product) => {
    if (!product || isComingSoon(product)) return;
    if (hasMultiplePlans(product)) {
      setQuickViewProduct(null);
      setPlanProduct(product);
      return;
    }
    handleBuyProduct(product);
  };

  const copyPaymentNumber = async () => {
    const accNum = PAYMENT_ACCOUNTS[paymentMethod]?.number || '';
    if (!accNum) return;
    try {
      await navigator.clipboard.writeText(accNum);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const validationMessage = (code) => {
    if (code === 'empty_cart') return s.alertEmptyCart;
    if (code === 'invalid_phone') return s.alertInvalidContact;
    if (code === 'invalid_name') return s.alertInvalidName;
    if (code === 'invalid_payment') return s.alertError;
    return s.alertError;
  };

  const handleSubmit = async () => {
    setFormError('');

    const validation = validateOrderPayload({
      name: customerName,
      phone: contactValue,
      totalIQD,
      items: checkoutItems,
      paymentMethod,
    });

    if (!validation.ok) {
      setFormError(validationMessage(validation.code));
      return;
    }

    setLoading(true);
    const formattedTotal = formatTotal(lang, totalIQD, totalUSD);
    const cleanContact = normalizePhone(contactValue) || contactValue.trim();
    const orderDetails = {
      name: customerName.trim(),
      phone: cleanContact,
      note: optionalNote.trim() || undefined,
      paymentMethod,
      transactionId: String(transactionId || '').trim(),
      items: checkoutItems.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity || 1 })),
      total: formattedTotal,
      totalIQD,
      totalUSD,
      image: receiptImage || null,
    };

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderDetails),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setLastOrder({
          ...orderDetails,
          items: checkoutItems.map((i) => i.name).join(', '),
          licenseKey: null,
          orderId: null,
        });
        setPendingOrderId(null);
        setOrderStatus('pending');
        setGeneratedKey(null);
        setKeyCopied(false);
        setManualSubmitted(true);
        setSuccess(true);
        setFormError('');
      } else {
        const msg = data.error || validationMessage(data.code) || s.alertError;
        setFormError(msg);
      }
    } catch (err) {
      console.error(err);
      setFormError(s.alertServer);
    } finally {
      setLoading(false);
    }
  };

  const handlePayWithBalance = async () => {
    setFormError('');
    setPurchaseToast('');
    const identified = await identify(contactValue);
    if (!identified) {
      setFormError(s.alertInvalidContact);
      return;
    }
    const payPhone = identified.phone || contactValue;
    const liveBalance = Number(
      identified.balance_iqd != null ? identified.balance_iqd : balanceIqd || 0
    );
    const needed = Number(totalIQD || 0);
    const isDev = process.env.NODE_ENV === 'development';
    const insufficient = needed > 0 && liveBalance < needed;

    if (insufficient && !isDev) {
      showPurchaseToast(t.wallet?.balanceTooLow || 'باڵانسێ تە بەس نینە بۆ ڤێ کڕینێ.');
      return;
    }

    const useDevBypass = insufficient && isDev;
    if (useDevBypass) {
      applyWallet({
        phone: payPhone,
        balance_iqd: Math.max(needed, 100000),
        balance_usd: identified.balance_usd ?? balanceUsd ?? 0,
      });
    }

    setPayingWithBalance(true);
    try {
      const inventoryItems = checkoutItems.filter((i) => getInstantCatalogProduct(i.id));
      const otherItems = checkoutItems.filter((i) => !getInstantCatalogProduct(i.id));

      if (inventoryItems.length > 0 && otherItems.length === 0) {
        const first = getInstantCatalogProduct(inventoryItems[0].id);
        const res = await fetch('/api/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: payPhone,
            slug: inventoryItems[0].id || first?.id,
            price: inventoryItems[0].priceIQD || first?.priceIQD,
            items: inventoryItems.map((i) => ({ id: i.id, slug: i.id, quantity: i.quantity || 1 })),
            ...(useDevBypass ? { devBypass: true } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            data.code === 'insufficient_balance'
              ? t.wallet?.balanceTooLow || s.insufficientPurchase
              : data.code === 'out_of_stock'
                ? s.outOfStock
                : data.error || s.alertError;
          showPurchaseToast(msg);
          if (data.balance_iqd != null) applyWallet(data);
          return;
        }
        applyWallet(data);
        await refresh(payPhone);
        const deliveries = Array.isArray(data.deliveries) ? data.deliveries : data.delivery ? [data.delivery] : [];
        setDeliveredItems(deliveries);
        setLastOrder({
          name: contactValue.trim(),
          phone: contactValue,
          items: checkoutItems.map((i) => i.name).join(', '),
          total: formatTotal(lang, totalIQD, totalUSD),
          paymentMethod: 'WALLET',
          licenseKey: deliveries[0]?.payload || null,
          orderId: null,
        });
        setPendingOrderId(null);
        setOrderStatus('approved');
        setGeneratedKey(null);
        setKeyCopied(false);
        setSuccess(true);
        return;
      }

      const res = await fetch('/api/wallet/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: payPhone,
          name: contactValue.trim(),
          items: checkoutItems.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity || 1 })),
          totalIQD,
          totalUSD,
          ...(useDevBypass ? { devBypass: true } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data.code === 'insufficient_balance'
            ? t.wallet?.balanceTooLow || s.insufficientPurchase
            : data.error || s.alertError;
        showPurchaseToast(msg);
        return;
      }
      applyWallet(data);
      const issuedKey = data.licenseKey?.key_code || data.licenseKey?.keyCode || null;
      setDeliveredItems([]);
      setLastOrder({
        name: contactValue.trim(),
        phone: contactValue,
        items: checkoutItems.map((i) => i.name).join(', '),
        total: formatTotal(lang, totalIQD, totalUSD),
        paymentMethod: 'WALLET',
        licenseKey: issuedKey,
        orderId: data.orderId,
      });
      setPendingOrderId(data.orderId || null);
      setOrderStatus('approved');
      setGeneratedKey(issuedKey);
      setKeyCopied(false);
      setSuccess(true);
    } catch (err) {
      console.error(err);
      showPurchaseToast(s.alertServer);
    } finally {
      setPayingWithBalance(false);
    }
  };

  const copyLicenseKey = async () => {
    if (!generatedKey) return;
    try {
      await navigator.clipboard.writeText(generatedKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const copyDelivery = async (text, index) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedDeliveryIndex(index);
      setTimeout(() => setCopiedDeliveryIndex(null), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const launchChatWithKey = async () => {
    if (generatedKey) {
      try {
        await navigator.clipboard.writeText(generatedKey);
      } catch {
        /* clipboard optional */
      }
      router.push(`/chat?key=${encodeURIComponent(generatedKey)}`);
    } else {
      router.push('/chat');
    }
  };

  const sendToTelegram = () => {
    if (!lastOrder) return;
    const msg = `Hello IPBITS STORE,%0A%0A👤 Contact: ${lastOrder.name}%0A📦 Plan: ${lastOrder.items}%0A💰 Total: ${lastOrder.total}%0A💳 Method: ${lastOrder.paymentMethod}`;
    window.open(`${TELEGRAM_URL}?text=${msg}`, '_blank');
  };

  const featureChecklist = [s.featureAllModels, s.featureInstant, s.featureSupport, s.featureWarranty];

  return (
    <div
      className="min-h-screen bg-[#F8FAFC] dark:bg-[#07080E] text-slate-900 dark:text-zinc-100 font-sans flex flex-col justify-between transition-colors duration-200"
      dir={dir}
      suppressHydrationWarning
    >
      <Navbar onOpenCatalog={openFullCatalog} />
      <React.Suspense fallback={null}>
        <BuyAiHubFromQuery
          beginCheckout={beginCheckout}
          tierName={s.tiers?.['30_days']?.name}
        />
      </React.Suspense>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-12 flex-1 w-full relative">
        <div
          className="pointer-events-none absolute inset-x-0 -top-6 h-64 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.10),_transparent_60%)]"
          aria-hidden="true"
        />

        <motion.div
          ref={productsSectionRef}
          initial="hidden"
          animate={mounted ? 'show' : 'hidden'}
          variants={staggerContainer}
          className="relative text-center max-w-3xl mx-auto mb-8 md:mb-10"
        >
          <motion.h1
            variants={fadeUp}
            className="lm-hero-title mb-5 text-3xl sm:text-5xl text-slate-900 dark:text-white font-extrabold tracking-tight leading-[1.3]"
          >
            {s.heroTitle1}{' '}
            <span className="lm-hero-accent bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-500 dark:via-teal-400 dark:to-cyan-400 bg-clip-text text-transparent font-extrabold">
              {s.heroTitle2}
            </span>
          </motion.h1>

          <motion.div variants={fadeUp} className="flex items-center justify-center px-3">
            <a
              href={`${TELEGRAM_URL}?text=${encodeURIComponent(s.sponsorTelegramMsg)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${PILL_BTN} max-w-full h-auto min-h-9 inline-flex flex-nowrap items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1 text-xs sm:text-sm whitespace-nowrap group`}
            >
              <span className="inline-flex items-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap">
                <span className="text-emerald-600 dark:text-emerald-400/80" aria-hidden="true">
                  •
                </span>
                <span className="text-cyan-700 dark:text-cyan-300 text-[10px] sm:text-xs font-semibold tracking-wide">
                  {s.sponsorTag}
                </span>
                <span className="text-slate-300 dark:text-white/20" aria-hidden="true">
                  |
                </span>
              </span>
              <span
                className={`${BODY_SECONDARY} group-hover:text-slate-950 dark:group-hover:text-white text-xs sm:text-sm leading-none transition-colors truncate max-w-[15rem] sm:max-w-none`}
              >
                <span className="sm:hidden">{s.sponsorTextMobile || s.sponsorText}</span>
                <span className="hidden sm:inline">{s.sponsorText}</span>
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500 dark:text-zinc-500 group-hover:text-emerald-600 dark:group-hover:text-emerald-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
            </a>
          </motion.div>
        </motion.div>

        <div className="max-w-3xl mx-auto space-y-8 md:space-y-10">
          <div className="space-y-8">
            <motion.div
              initial={false}
              whileInView={mounted ? { opacity: 1, y: 0 } : undefined}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              id="pricing"
              className={`relative ${OFFER_SURFACE} scroll-mt-20`}
            >
              <div
                className="pointer-events-none absolute -top-16 end-0 w-56 h-56 rounded-full bg-emerald-500/10 blur-3xl"
                aria-hidden="true"
              />

              {/* Bundle title */}
              <div className="relative mb-6 text-center">
                <h2 className="lm-offer-vip-title text-xl sm:text-3xl font-extrabold tracking-tight leading-snug text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-600 to-orange-600 dark:from-amber-100 dark:via-amber-300 dark:to-yellow-500 dark:drop-shadow-[0_2px_12px_rgba(245,158,11,0.15)]">
                  {s.specialOfferTitle1} {s.specialOfferTitle2}
                </h2>
              </div>

              <ul id="features" className="relative grid grid-cols-2 gap-x-3 gap-y-2.5 sm:gap-x-6 sm:gap-y-3 max-w-xl mx-auto my-5 text-start scroll-mt-20">
                {featureChecklist.map((feature, idx) => (
                  <li key={idx} className="lm-offer-feature flex items-center gap-1.5 sm:gap-2 justify-start">
                    <CheckCircle2 className="lm-offer-check w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                    <span className="text-[11px] sm:text-xs font-normal text-slate-800 dark:text-zinc-200 tracking-tight leading-snug">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="relative mb-6">
                <label className="lm-offer-label block text-[11px] text-slate-600 dark:text-zinc-400 font-medium mb-2.5 tracking-wide">
                  {s.selectDuration}
                </label>
                <div
                  role="radiogroup"
                  aria-label={s.selectDuration}
                  className="grid grid-cols-2 sm:grid-cols-5 gap-2"
                >
                  {AI_TIERS_DATA.map((tierData) => {
                    const isSelected = selectedTierId === tierData.id;
                    const tierLang = s.tiers[tierData.id];
                    return (
                      <button
                        key={tierData.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setSelectedTierId(tierData.id)}
                        className={`relative p-3 rounded-xl text-start transition-all duration-150 ease-out cursor-pointer select-none flex flex-col gap-1 active:scale-[0.96] ${
                          isSelected ? TIER_ACTIVE : TIER_IDLE
                        }`}
                      >
                        <span className={`lm-tier-name text-xs sm:text-sm font-bold tracking-tight ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>
                          {tierLang.name}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <span className={`lm-tier-price text-sm font-extrabold tabular-nums ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-zinc-200'}`}>
                            {formatPrice(lang, tierData.priceIQD, tierData.priceUSD)}
                          </span>
                          <span className="lm-tier-old text-[10px] text-slate-400 dark:text-zinc-500 line-through tabular-nums">
                            {formatPrice(lang, tierData.oldPriceIQD, tierData.oldPriceUSD)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative flex items-end justify-between gap-3 p-4 rounded-2xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.08] mb-5">
                <div className="min-w-0">
                  <span className="text-[11px] text-slate-600 dark:text-zinc-400 font-medium block leading-relaxed">
                    {s.selectedPriceFor}:
                  </span>
                  <div className="flex items-baseline gap-2.5 mt-1 flex-wrap">
                    <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatPrice(lang, currentTierData.priceIQD, currentTierData.priceUSD)}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-zinc-500 line-through tabular-nums">
                      {formatPrice(lang, currentTierData.oldPriceIQD, currentTierData.oldPriceUSD)}
                    </span>
                  </div>
                </div>
                {currentTierText.badge ? (
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-medium shrink-0 ${
                      selectedTierId === '1_year' || /VIP/i.test(currentTierText.badge)
                        ? 'bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300'
                        : 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                    }`}
                  >
                    {currentTierText.badge}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handleBuyNow}
                className={`${BTN_PRIMARY} relative w-full py-3.5 text-sm font-bold`}
              >
                <span>
                  {s.buyNowBtn} — {currentTierText.name} ·{' '}
                  {formatPrice(lang, currentTierData.priceIQD, currentTierData.priceUSD)}
                </span>
              </button>
            </motion.div>

            <div id="store" className="scroll-mt-20 space-y-5">
              <div className={`flex items-center gap-3 ${showFullCatalog ? 'justify-between' : 'justify-end'}`}>
                {showFullCatalog ? (
                  <h3 className={`text-sm sm:text-base ${HEADING} tracking-tight`}>
                    {t.menu.sectionCatalog}
                  </h3>
                ) : null}
                {!showFullCatalog ? (
                  <button
                    type="button"
                    onClick={openFullCatalog}
                    className="text-[11px] font-medium text-cyan-700 dark:text-cyan-300 hover:text-cyan-800 dark:hover:text-cyan-200 cursor-pointer transition-colors active:scale-[0.98]"
                  >
                    {t.menu.viewAll} →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowFullCatalog(false);
                      setSearchQuery('');
                      setActiveFilter('all');
                    }}
                    className={`text-[11px] ${BODY_SECONDARY} hover:text-zinc-950 dark:hover:text-white cursor-pointer transition-colors`}
                  >
                    {t.menu.viewAll}
                  </button>
                )}
              </div>

              {showFullCatalog && (
                <div className="flex flex-wrap gap-2">
                  <div className="relative mb-2 w-full">
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={s.searchPlaceholder}
                      className="lm-search-input w-full bg-white/[0.02] border border-white/10 rounded-xl px-4 py-2.5 ps-10 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-400/40 transition-colors backdrop-blur-xl"
                    />
                    <span className="lm-search-icon absolute start-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    </span>
                    {searchQuery && (
                      <button type="button" onClick={() => setSearchQuery('')} className="absolute end-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors text-lg leading-none cursor-pointer">×</button>
                    )}
                  </div>
                  {filterTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveFilter(tab.id)}
                        className={`${PILL_BTN} h-8 px-3 ${
                          isActive
                            ? 'lm-filter-active border-cyan-400/40 text-white bg-cyan-500/15'
                            : 'lm-filter-idle'
                        }`}
                      >
                        <Icon size={13} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              )}

            <motion.div
              key={`${showFullCatalog}-${activeFilter}-${searchQuery}`}
              initial="hidden"
              animate="show"
              variants={staggerContainer}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"
            >
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-12 text-neutral-500 text-sm">
                  <p className="font-medium">{s.searchEmpty}</p>
                </div>
              )}
              {filteredProducts.map((product) => {
                const soon = isComingSoon(product);
                const promoText = !soon ? getProductPromoBadge(product, lang) : '';
                const badgeLabel =
                  soon
                    ? (s.badgeComingSoon || s.comingSoonBadge || 'ل نێزیک')
                    : product.highlight === 'offer' && !promoText
                      ? s.badgeSpecialOffer
                      : (!promoText && product.badge) || null;

                return (
                <motion.div
                  key={product.id}
                  variants={fadeUp}
                  style={{ '--brand-color': product.brandColor || '#10B981' }}
                  className={`card-brand-hover group relative p-4 sm:p-5 ${SURFACE_CARD} flex flex-col justify-between overflow-hidden transition-all duration-150 ease-out select-none ${
                    soon
                      ? 'cursor-default'
                      : 'cursor-pointer hover:border-emerald-500/40 dark:hover:border-cyan-400/30 hover:shadow-[0_8px_28px_-6px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_0_24px_rgba(16,185,129,0.1)] active:scale-[0.96]'
                  }`}
                  onClick={() => {
                    if (!soon) startProductPurchase(product);
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-cyan-500/0 group-hover:from-emerald-500/[0.05] group-hover:to-cyan-500/[0.04] transition-all duration-500"
                    aria-hidden="true"
                  />
                  {badgeLabel && (
                    <span
                      className={`absolute top-3 end-3 z-10 px-2 py-0.5 text-[11px] font-medium tracking-wide rounded-full backdrop-blur-md ${
                        soon
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {badgeLabel}
                    </span>
                  )}
                  <div className="relative">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <ProductLogoBadge
                        name={product.name}
                        brandIcon={product.brandIcon}
                        alt={product.name}
                      />
                    </div>
                    <h3
                      className={`lm-product-name ${HEADING} text-sm sm:text-base mb-1 ${badgeLabel ? 'pe-16' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!soon) startProductPurchase(product);
                      }}
                    >{getProductName(product, lang)}</h3>
                    <span className="lm-product-cat block text-[11px] sm:text-xs font-normal text-zinc-400 dark:text-zinc-400 tracking-wide mt-0.5 mb-1.5 leading-snug">
                      {getProductSubtitle(product, lang)}
                    </span>
                    {promoText ? (
                      <span className="mb-2 inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-full font-medium max-w-full">
                        <span className="truncate">{promoText}</span>
                      </span>
                    ) : null}
                    <span className={`lm-product-price text-base sm:text-lg ${HEADING} block mb-4`}>
                      {hasMultiplePlans(product)
                        ? `${s.fromPrice} ${formatMoney(lang, startingPlan(product))}`
                        : formatMoney(lang, product)}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={soon}
                    aria-disabled={soon}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!soon) startProductPurchase(product);
                    }}
                    className={`relative ${soon ? CARD_SOON_BTN : CARD_BUY_BTN}`}
                  >
                    {soon ? (s.comingSoonBtn || 'ل نێزیک دێ ڤەبیت') : s.buyNowBtn}
                  </button>
                </motion.div>
              );
              })}
            </motion.div>
            </div>
          </div>

        </div>
      </main>

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        s={s}
        dir={dir}
        totalLabel={formatTotal(lang, totalIQD, totalUSD)}
        totalUsd={totalUSD}
        itemsLabel={checkoutItem?.name || ''}
        customerName={customerName}
        setCustomerName={setCustomerName}
        contactValue={contactValue}
        setContactValue={setContactValue}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        transactionId={transactionId}
        setTransactionId={setTransactionId}
        receiptImage={receiptImage}
        setReceiptImage={setReceiptImage}
        loading={loading}
        formError={formError}
        onSubmit={handleSubmit}
        copied={copied}
        onCopyPaymentNumber={copyPaymentNumber}
        success={success}
        orderStatus={orderStatus}
        generatedKey={generatedKey}
        pendingOrderId={pendingOrderId}
        keyCopied={keyCopied}
        onCopyLicenseKey={copyLicenseKey}
        onLaunchChat={launchChatWithKey}
        onSendTelegram={sendToTelegram}
        onNewOrder={handleResetForNewOrder}
        totalIqd={totalIQD}
        totalUsd={totalUSD}
        deliveredItems={deliveredItems}
        copiedDeliveryIndex={copiedDeliveryIndex}
        onCopyDelivery={copyDelivery}
        purchaseToast={purchaseToast}
        manualSubmitted={manualSubmitted}
      />

      {/* FAQ Section */}
      <section id="faq" className="max-w-3xl mx-auto px-4 sm:px-6 mb-12 md:mb-14 w-full scroll-mt-20" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className={`lm-faq-title text-lg sm:text-xl ${HEADING} mb-5 text-center`}>
          {s.faqTitle}
        </h2>
        <div className={`lm-faq-card ${SURFACE_CARD} overflow-hidden divide-y divide-slate-200 dark:divide-white/10`}>
          {[
            { q: s.faqQ1, a: s.faqA1 },
            { q: s.faqQ2, a: s.faqA2 },
            { q: s.faqQ3, a: s.faqA3 },
          ].map((item, i) => {
            const open = openFaq === i;
            return (
              <div key={i} className="border-slate-200 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setOpenFaq(open ? null : i)}
                  aria-expanded={open}
                  className="lm-faq-q w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-3.5 text-sm font-medium text-slate-800 dark:text-zinc-200 text-start cursor-pointer hover:text-slate-950 dark:hover:text-cyan-300 transition-colors"
                >
                  <span className="leading-relaxed pe-2">{item.q}</span>
                  <span
                    className={`lm-faq-icon text-slate-500 dark:text-zinc-500 text-lg leading-none shrink-0 transition-transform duration-200 ${open ? 'rotate-45 text-emerald-600 dark:text-emerald-400' : ''}`}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                >
                  <div className="overflow-hidden">
                    <p className={`lm-faq-a px-4 sm:px-5 pb-3.5 text-xs text-slate-700 dark:text-zinc-300 leading-relaxed`}>
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feature 3 — Notify Me Modal */}
      {notifyProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => { setNotifyProduct(null); setNotifyDone(false); setNotifyContact(''); }}>
          <div className="relative w-full max-w-sm bg-white/95 border border-slate-200 text-slate-900 dark:bg-slate-900/95 dark:border-slate-700/60 dark:text-white rounded-3xl p-6 shadow-2xl backdrop-blur-xl" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => { setNotifyProduct(null); setNotifyDone(false); setNotifyContact(''); }} className="absolute top-4 end-4 text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white cursor-pointer text-xl">×</button>
            <div className="text-2xl mb-3">🔔</div>
            <h3 className="font-black text-base text-slate-900 dark:text-white mb-1">{s.notifyTitle}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{notifyProduct.name}</p>
            {notifyDone ? (
              <p className="text-emerald-600 dark:text-emerald-400 font-bold text-sm text-center py-4">{s.notifySuccess}</p>
            ) : (
              <form onSubmit={async e => {
                e.preventDefault();
                setNotifyLoading(true);
                await new Promise(r => setTimeout(r, 800));
                setNotifyLoading(false);
                setNotifyDone(true);
              }}>
                <input required type="text" value={notifyContact} onChange={e => setNotifyContact(e.target.value)} placeholder={s.notifyPlaceholder}
                  className="w-full bg-white text-slate-900 placeholder-slate-400 border border-slate-300 dark:bg-slate-950 dark:text-white dark:placeholder-slate-500 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 mb-3 transition-colors" />
                <button type="submit" disabled={notifyLoading}
                  className={`${BTN_PRIMARY} w-full py-2.5 text-xs`}>
                  {notifyLoading ? '...' : s.notifyBtn}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <ProductPlanModal
        product={planProduct}
        open={Boolean(planProduct)}
        onClose={() => setPlanProduct(null)}
        onConfirm={handleBuyProduct}
      />

      {/* ── Product Details Modal ─────────────────────── */}
      <AnimatePresence>
        {quickViewProduct && (
          <motion.div
            key="quick-view"
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={() => setQuickViewProduct(null)}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" aria-hidden="true" />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-full sm:max-w-lg bg-white/95 dark:bg-[#0d1117] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Ambient glow */}
              <div
                className="pointer-events-none absolute -top-16 -end-16 w-48 h-48 rounded-full blur-3xl opacity-30"
                style={{ backgroundColor: quickViewProduct.brandColor || '#7C3AED' }}
                aria-hidden="true"
              />

              {/* Header */}
              <div className="relative flex items-start justify-between gap-3 p-5 sm:p-6 border-b border-slate-200 dark:border-white/8">
                <div className="flex items-center gap-3">
                  <ProductLogoBadge
                    name={quickViewProduct.name}
                    brandIcon={quickViewProduct.brandIcon}
                    alt={quickViewProduct.name}
                  />
                  <div>
                    <h2 className="font-black text-lg text-slate-900 dark:text-white leading-tight">{getProductName(quickViewProduct, lang)}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 tracking-wide leading-snug">
                        {getProductSubtitle(quickViewProduct, lang)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickViewProduct(null)}
                  className="text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-white transition-all duration-150 ease-out active:scale-[0.96] text-2xl leading-none shrink-0 cursor-pointer select-none mt-0.5"
                  aria-label="Close"
                >×</button>
              </div>

              <div className="p-5 sm:p-6 space-y-5">
                {/* Price */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800/60">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{s.selectedPriceFor}:</span>
                  <span className="font-black text-xl text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-cyan-500 dark:from-emerald-300 dark:to-cyan-200">
                    {formatMoney(lang, quickViewProduct)}
                  </span>
                </div>

                {/* Specs */}
                <div>
                  <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2.5 uppercase tracking-wider">{s.modalSpecs}</h3>
                  <ul className="space-y-2">
                    {[
                      { icon: '📧', text: s.modalDelivery },
                      { icon: '📅', text: s.modalDuration },
                      { icon: '📱', text: s.modalDevices },
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50 rounded-xl px-3 py-2">
                        <span className="shrink-0">{item.icon}</span>
                        {item.text}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Terms */}
                <div>
                  <h3 className="text-xs font-black text-slate-700 dark:text-slate-300 mb-2.5 uppercase tracking-wider">{s.modalTerms}</h3>
                  <ul className="space-y-2">
                    {[
                      { icon: '🛡️', text: s.modalWarranty },
                      { icon: '✅', text: s.modalOfficial },
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl px-3 py-2">
                        <span className="shrink-0">{item.icon}</span>
                        {item.text}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Feature checklist */}
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {featureChecklist.map((feat, i) => (
                    <li key={i} className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300">
                      <CheckCircle2 size={13} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>

                {/* Action buttons */}
                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => startProductPurchase(quickViewProduct)}
                    className={`flex-1 ${CARD_BUY_BTN}`}
                  >
                    {s.buyNowBtn}
                  </button>
                  <a
                    href={`${TELEGRAM_URL}?text=${encodeURIComponent(`IPBITS STORE - ${quickViewProduct.name}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${PILL_BTN} h-auto py-3 px-4`}
                  >
                    <Send size={14} />
                    <span className="hidden sm:inline">{s.modalTelegram}</span>
                    <span className="sm:hidden">Telegram</span>
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}
