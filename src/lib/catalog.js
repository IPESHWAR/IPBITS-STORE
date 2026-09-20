import { buildAiTiersData } from '@/config/plans';
import { normalizeLang, usdToIqd } from '@/lib/i18n';

export const AI_TIERS_DATA = buildAiTiersData();

/** Resolve product card subtitle for the active UI language (ku / ar / en). */
export function getProductSubtitle(product, lang) {
  if (!product) return '';
  const key = normalizeLang(lang);
  const sub = product.subtitle;
  if (sub && typeof sub === 'object') {
    return sub[key] || sub.ku || sub.en || sub.ar || '';
  }
  if (typeof product.category === 'string') return product.category;
  return '';
}

/** Resolve display title for the active UI language. */
export function getProductName(product, lang) {
  if (!product) return '';
  const key = normalizeLang(lang);
  const localized = product.nameLocalized;
  if (localized && typeof localized === 'object') {
    return localized[key] || localized.en || localized.ku || localized.ar || product.name || '';
  }
  if (typeof product.name === 'object') {
    return product.name[key] || product.name.en || product.name.ku || product.name.ar || '';
  }
  return product.name || '';
}

/** Resolve optional promo / offer pill text for the active UI language. */
export function getProductPromoBadge(product, lang) {
  if (!product?.promoBadge) return '';
  const key = normalizeLang(lang);
  const badge = product.promoBadge;
  if (typeof badge === 'string') return badge;
  if (typeof badge === 'object') {
    return badge[key] || badge.ku || badge.en || badge.ar || '';
  }
  return '';
}

export const LOCKED_PRODUCTS = [
  {
    id: 'chatgpt',
    name: 'ChatGPT Plus',
    subtitle: {
      ku: 'هزر، نڤیسین و وەرگێڕانا زیرەک',
      ar: 'تفكير، كتابة وترجمة ذكية',
      en: 'Smart reasoning, writing & translation',
    },
    priceIQD: 35000,
    priceUSD: 23,
    filterGroup: 'ai',
    brandColor: '#10A37F',
    brandIcon: 'openai',
    deliveryType: 'instant',
    plans: [
      { id: 'chatgpt-1m', duration: '١ مەهـ', price_iqd: 35000, price_usd: 23.0 },
    ],
  },
  {
    id: 'claude',
    name: 'Claude Pro',
    subtitle: {
      ku: 'بەرهەمهێنەرێ کۆد و شیکاری',
      ar: 'تطوير البرمجيات والتحليل المتقدم',
      en: 'Advanced coding & in-depth analysis',
    },
    priceIQD: 35000,
    priceUSD: 23,
    filterGroup: 'ai',
    brandColor: '#CC785C',
    brandIcon: 'claude',
    deliveryType: 'instant',
    plans: [
      { id: 'claude-1m', duration: '١ مەهـ', price_iqd: 35000, price_usd: 23.0 },
    ],
  },
  {
    id: 'gemini',
    name: 'Gemini Pro AI',
    subtitle: {
      ku: 'ژیرییا هەمەلایەنە یا گووگڵ',
      ar: 'الذكاء الاصطناعي الشامل من جوجل',
      en: "Google's versatile multimodal AI",
    },
    priceIQD: 35000,
    priceUSD: 23,
    filterGroup: 'ai',
    brandColor: '#8E75B2',
    brandIcon: 'gemini',
    deliveryType: 'instant',
    plans: [
      { id: 'gemini-1m', duration: '١ مەهـ', price_iqd: 35000, price_usd: 23.0 },
    ],
  },
  {
    id: 'midjourney',
    name: 'Midjourney',
    subtitle: {
      ku: 'دروستکرنا وێنەیێن سەرسوڕهێنەر',
      ar: 'توليد صور فنية فائقة الدقة',
      en: 'High-tier AI art & image generation',
    },
    priceIQD: 50000,
    priceUSD: 33,
    filterGroup: 'ai',
    brandColor: '#FFFFFF',
    brandIcon: 'midjourney',
    deliveryType: 'instant',
    plans: [
      { id: 'midjourney-1m', duration: '١ مەهـ', price_iqd: 50000, price_usd: 33.0 },
    ],
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    subtitle: {
      ku: 'گەڕیان و لێکۆڵینا بلەز د ئینتەرنێتێ دا',
      ar: 'بحث وتحليل فوري للويب',
      en: 'Instant web research & real-time answers',
    },
    priceIQD: 35000,
    priceUSD: 23,
    filterGroup: 'ai',
    brandColor: '#20808D',
    brandIcon: 'perplexity',
    deliveryType: 'instant',
    plans: [
      { id: 'perplexity-1m', duration: '١ مەهـ', price_iqd: 35000, price_usd: 23.0 },
    ],
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs AI',
    subtitle: {
      ku: 'دەنگێن سروشتی و دوبلاژکرن',
      ar: 'أصوات طبيعية ودبلجة متقدمة',
      en: 'Hyper-realistic voice & audio synthesis',
    },
    priceIQD: usdToIqd(10),
    priceUSD: 10,
    filterGroup: 'ai',
    brandColor: '#10B981',
    brandIcon: 'elevenlabs',
    deliveryType: 'instant',
    plans: [
      { id: 'elevenlabs-1m', duration: '١ مەهـ', price_iqd: usdToIqd(10), price_usd: 10.0 },
      { id: 'elevenlabs-1m-27', duration: '١ مەهـ', price_iqd: usdToIqd(27), price_usd: 27.0 },
      { id: 'elevenlabs-1m-150', duration: '١ مەهـ', price_iqd: usdToIqd(150), price_usd: 150.0 },
    ],
  },
  {
    id: 'kling',
    name: 'Kling AI Video',
    subtitle: {
      ku: 'بەرهەمهێنانا ڤیدیۆ ب ژیرییا دەستکرد',
      ar: 'توليد فيديو احترافي بالذكاء الاصطناعي',
      en: 'Cinematic AI video generation',
    },
    priceIQD: usdToIqd(15),
    priceUSD: 15,
    filterGroup: 'media',
    brandColor: '#C026D3',
    brandIcon: 'kling',
    deliveryType: 'instant',
    plans: [
      { id: 'kling-1m', duration: '١ مەهـ', price_iqd: usdToIqd(15), price_usd: 15.0 },
      { id: 'kling-1m-45', duration: '١ مەهـ', price_iqd: usdToIqd(45), price_usd: 45.0 },
      { id: 'kling-1m-105', duration: '١ مەهـ', price_iqd: usdToIqd(105), price_usd: 105.0 },
    ],
  },
  {
    id: 'canva',
    name: 'Canva Pro',
    subtitle: {
      ku: 'دیزاین و گرافیکێ سۆشیال میدیا',
      ar: 'تصميم الغرافيك ومحتوى التواصل',
      en: 'Graphic design & social media assets',
    },
    priceIQD: usdToIqd(18),
    priceUSD: 18,
    filterGroup: 'other',
    brandColor: '#00C4CC',
    brandIcon: 'canva',
    deliveryType: 'manual',
    orderType: 'telegram',
    plans: [
      { id: 'canva-1m', duration: '١ مەهـ (تایبەت)', price_iqd: usdToIqd(18), price_usd: 18.0 },
    ],
    telegramMessage: 'سلاڤ، من دڤێت ئیشتراکا Canva Pro (١ مەهـ) بکڕم.',
  },
  {
    id: 'capcut',
    name: 'CapCut Pro',
    subtitle: {
      ku: 'مۆنتاژ و ڤیدیۆیێن بێ لۆگۆ',
      ar: 'مونتاج متقدم بدون علامة مائية',
      en: 'Watermark-free pro video editing',
    },
    priceIQD: usdToIqd(25),
    priceUSD: 25,
    filterGroup: 'media',
    brandColor: '#00D2FF',
    brandIcon: 'capcut',
    deliveryType: 'instant',
    plans: [
      { id: 'capcut-1m', duration: '١ مەهـ', price_iqd: usdToIqd(25), price_usd: 25.0 },
    ],
  },
  {
    id: 'paypal_acc',
    name: 'PayPal Verified Account',
    subtitle: {
      ku: 'شاندن و کڕینا جیهانی یا پاراستی',
      ar: 'دفع وشراء إلكتروني آمن عالمياً',
      en: 'Secure global checkout & payments',
    },
    priceIQD: usdToIqd(60),
    priceUSD: 60,
    filterGroup: 'other',
    brandColor: '#003087',
    brandIcon: 'paypal',
    deliveryType: 'manual',
    orderType: 'telegram',
    comingSoon: true,
    plans: [
      { id: 'paypal-acc-1', duration: 'هەژمارێکی پشتڕاستکری', price_iqd: usdToIqd(60), price_usd: 60.0 },
    ],
    telegramMessage: 'سلاڤ، من دڤێت هەژمارێکی PayPal یێ پشتڕاستکری بکڕم.',
  },
  {
    id: 'netflix',
    name: 'Netflix Premium (4K UHD)',
    subtitle: {
      ku: 'فلیم و زنجیرەیێن جیهانی ب کوالیتییا 4K',
      ar: 'أحدث الأفلام والمسلسلات بدقة 4K',
      en: 'Global films & series in 4K UHD',
    },
    priceIQD: 7000,
    priceUSD: 5,
    filterGroup: 'media',
    brandColor: '#E50914',
    brandIcon: 'netflix',
    deliveryType: 'manual',
    orderType: 'telegram',
    plans: [
      { id: 'netflix-1m', duration: '١ مەهـ (پرۆفایل)', price_iqd: 7000, price_usd: 5.0 },
    ],
    telegramMessage: 'سلاڤ، من دڤێت بەشدارییا Netflix Premium بکڕم.',
  },
  {
    id: 'shahid_vip',
    name: 'Shahid VIP',
    subtitle: {
      ku: 'فلیم، زنجیرە و وەرزش ب کوالیتییا بەرز',
      ar: 'أفلام، مسلسلات ورياضة بجودة عالية',
      en: 'Premium shows, movies & sports',
    },
    priceIQD: usdToIqd(7),
    priceUSD: 7,
    filterGroup: 'media',
    brandColor: '#F0A500',
    brandIcon: 'shahid',
    deliveryType: 'instant',
    plans: [
      { id: 'shahid-1m', duration: '١ مەهـ', price_iqd: usdToIqd(7), price_usd: 7.0 },
      { id: 'shahid-1m-9', duration: '١ مەهـ', price_iqd: usdToIqd(9), price_usd: 9.0 },
    ],
  },
  {
    id: 'spotify',
    name: 'Spotify Premium',
    subtitle: {
      ku: 'مەزنترین پەرتووکخانا دەنگ و مۆسیقایێ',
      ar: 'أكبر مكتبة للموسيقى والبودكاست',
      en: 'Endless music streaming & podcasts',
    },
    priceIQD: 9000,
    priceUSD: 6,
    filterGroup: 'media',
    brandColor: '#1DB954',
    brandIcon: 'spotify',
    deliveryType: 'instant',
    highlight: 'offer',
    promoBadge: {
      ku: '٣ هەیڤ دیاری بۆ دەمەکێ دیارکری',
      ar: '٣ أشهر هدية لفترة محدودة',
      en: '3 Months Free (Limited Time)',
    },
    plans: [
      { id: 'spotify-1m', duration: '١ مەهـ', price_iqd: 9000, price_usd: 6.0 },
      { id: 'spotify-3m', duration: '٣ مەهـ', price_iqd: 35000, price_usd: 23.0 },
      { id: 'spotify-12m', duration: '١٢ مەهـ', price_iqd: 120000, price_usd: 80.0 },
    ],
  },
  {
    id: 'apple_music',
    name: 'Apple Music',
    subtitle: {
      ku: 'دەنگێ بێ سنور و Spatial Audio',
      ar: 'صوت مكاني نقي وبدون حدود',
      en: 'Lossless audio & Spatial Audio',
    },
    priceIQD: usdToIqd(16),
    priceUSD: 16,
    filterGroup: 'media',
    brandColor: '#FA2D55',
    brandIcon: 'apple_music',
    deliveryType: 'instant',
    plans: [
      { id: 'apple-music-1m', duration: '١ مەهـ', price_iqd: usdToIqd(16), price_usd: 16.0 },
    ],
  },
  {
    id: 'youtube_music',
    name: 'YouTube + YouTube Music',
    nameLocalized: {
      ku: 'یوتیوب + یوتیوب میوزیک',
      ar: 'يوتيوب + يوتيوب ميوزك',
      en: 'YouTube + YouTube Music',
    },
    subtitle: {
      ku: 'گوهداریکرنا بێ ڕیکلام د پاشخانێ دا',
      ar: 'استماع في الخلفية وبدون إعلانات',
      en: 'Ad-free background playback',
    },
    priceIQD: 13000,
    priceUSD: 9,
    filterGroup: 'media',
    brandColor: '#FF0000',
    brandIcon: 'youtube',
    deliveryType: 'instant',
    plans: [
      { id: 'youtube-1m', duration: '١ مەهـ', price_iqd: 13000, price_usd: 9.0 },
      { id: 'youtube-3m', duration: '٣ مەهـ', price_iqd: 35000, price_usd: 23.0 },
      { id: 'youtube-12m', duration: '١٢ مەهـ', price_iqd: 120000, price_usd: 80.0 },
    ],
  },
  {
    id: 'ps_plus',
    name: 'PlayStation Plus',
    subtitle: {
      ku: 'پڵەس و کڕینا یارییان ب کارتێن فەرمی',
      ar: 'اشتراك بلس وبطاقات الألعاب الرسمية',
      en: 'PlayStation Plus & official gift cards',
    },
    priceIQD: 22000,
    priceUSD: 15,
    filterGroup: 'other',
    brandColor: '#003791',
    brandIcon: 'playstation',
    deliveryType: 'instant',
    plans: [
      { id: 'ps-ess-1m', duration: 'Essential (١ مەهـ)', price_iqd: 22000, price_usd: 15.0 },
      { id: 'ps-ext-3m', duration: 'Extra (٣ مەهـ)', price_iqd: 55000, price_usd: 37.0 },
      { id: 'ps-dlx-12m', duration: 'Deluxe (١٢ مەهـ)', price_iqd: 145000, price_usd: 97.0 },
    ],
  },
  {
    id: 'apple_gift_card',
    name: 'Apple Gift Card',
    nameLocalized: {
      ku: 'کارتا ئەپڵ گێفت',
      ar: 'بطاقة أبل جفت كارد',
      en: 'Apple Gift Card',
    },
    subtitle: {
      ku: 'بۆ بەرنامە، یاری، ئایکلاود و هەمی خزمەتگوزاریێن ئەپڵ',
      ar: 'للتطبيقات، الألعاب، آيكلاود وجميع خدمات أبل',
      en: 'Apps, games, music, movies & iCloud storage',
    },
    priceIQD: usdToIqd(7),
    priceUSD: 7,
    filterGroup: 'other',
    brandColor: '#A2AAAD',
    brandIcon: 'apple_gift',
    deliveryType: 'instant',
    plans: [
      { id: 'apple-gift-5', duration: '$5', price_iqd: usdToIqd(7), price_usd: 7.0 },
      { id: 'apple-gift-7', duration: '$7', price_iqd: usdToIqd(10), price_usd: 10.0 },
      { id: 'apple-gift-20', duration: '$20', price_iqd: usdToIqd(25), price_usd: 25.0 },
      { id: 'apple-gift-50', duration: '$50', price_iqd: usdToIqd(55), price_usd: 55.0 },
    ],
  },
  {
    id: 'apple-id-custom',
    name: 'چێکرنا Apple ID (تایبەت)',
    subtitle: {
      ku: 'ئەکاونتێ فەرمی و پاراستی یێ ئەمریکی',
      ar: 'حساب أمريكي رسمي وآمن',
      en: 'Verified US Apple ID account',
    },
    priceIQD: 5000,
    priceUSD: 3.5,
    filterGroup: 'other',
    brandColor: '#A2AAAD',
    brandIcon: 'apple',
    deliveryType: 'manual',
    orderType: 'telegram',
    badge: 'ب دەستێ تە',
    plans: [
      {
        id: 'apple-id-custom-1',
        duration: 'هەر وەلاتەکێ تە بڤێت (ل سەر ئیمەیڵ و ژمارا تە)',
        price_iqd: 5000,
        price_usd: 3.5,
      },
    ],
    telegramMessage: 'سلاڤ، من دڤێت Apple ID ب ئیمەیڵ و ژمارا خۆ دروست بکەم (وەڵات: ...).',
  },
];

export const PAYMENT_ACCOUNTS = {
  FIB: { title: 'First Iraqi Bank (FIB)', number: '07504060378', note: 'FIB Account', logo: '/FIB.png' },
  FastPay: { title: 'FastPay Wallet', number: '07504060378', note: 'FastPay Account', logo: '/fastpay.png' },
  ZainCash: { title: 'ZainCash', number: '07504060378', note: 'ZainCash Wallet', logo: '/zaincash.svg' },
  QiCard: { title: 'Qi Card', number: '07504060378', note: 'Qi Card Account', logo: '/qi-card.svg' },
  USDT: { title: 'Tether (USDT Crypto)', number: 'TUeqkjzFdD7b1EtnAJL9tbzB1uN8wDbU6T', note: 'TRC20 Network Only', logo: '/usdt.svg' },
};

export const CHECKOUT_PAYMENT_METHODS = ['FIB', 'FastPay', 'ZainCash', 'QiCard'];

export const TELEGRAM_USERNAME = 'ipeshwar';
export const TELEGRAM_URL = 'https://t.me/ipeshwar';

export function isTelegramOrder(product) {
  return product?.orderType === 'telegram' || product?.deliveryType === 'manual';
}

export function isComingSoon(product) {
  return Boolean(product?.comingSoon);
}

export function telegramOrderUrl(product, fallbackMessage = '') {
  const text = String(product?.telegramMessage || fallbackMessage || '').trim();
  return `${TELEGRAM_URL}?text=${encodeURIComponent(text)}`;
}

const GIFT_CODE_SLUGS = new Set(['ps_plus', 'playstation-plus', 'ps-plus']);

const SLUG_ALIASES = {
  chatgpt: ['chatgpt-plus', 'chatgpt_plus', 'chatgptplus'],
  claude: ['claude-pro', 'claude_pro'],
  gemini: ['gemini-pro', 'gemini_pro', 'google-gemini'],
  midjourney: ['mid-journey', 'mj'],
  perplexity: ['perplexity-ai', 'perplexity_pro'],
  elevenlabs: ['eleven-labs', 'eleven_labs'],
  youtube_music: ['youtube', 'youtube-premium', 'youtube_premium'],
  apple_music: ['apple-music', 'applemusic'],
  apple_gift_card: ['apple-gift', 'apple-gift-card', 'apple_gift', 'applegift'],
  shahid_vip: ['shahid', 'shahid-vip'],
  paypal_acc: ['paypal', 'paypal-acc'],
  ps_plus: ['ps-plus', 'playstation-plus', 'playstation'],
  canva: ['canva-pro', 'canva_pro'],
  netflix: ['netflix-premium', 'netflix-4k', 'netflix_premium'],
  'apple-id-custom': ['apple-id-creation', 'apple-id', 'apple_id_custom'],
};

const PLAN_ID_ALIASES = {
  'ps-ess-1m': ['ps_plus_essential_1m', 'ps-plus-essential-1m'],
  'ps-ext-3m': ['ps_plus_extra_3m', 'ps-plus-extra-3m'],
  'ps-dlx-12m': ['ps_plus_deluxe_12m', 'ps-plus-deluxe-12m'],
  'chatgpt-1m': ['chatgpt'],
  'claude-1m': ['claude'],
  'gemini-1m': ['gemini'],
  'midjourney-1m': ['midjourney'],
  'perplexity-1m': ['perplexity'],
  'canva-1m': ['canva_1m', 'canva-1y', 'canva_1y', 'canva-12m', 'canva_12m'],
  'capcut-1m': ['capcut_1m', 'capcut-3m', 'capcut_3m', 'capcut-12m', 'capcut_12m'],
  'netflix-1m': ['netflix_1m', 'netflix-3m', 'netflix_3m', 'netflix-12m', 'netflix_12m'],
  'spotify-1m': ['spotify_1m'],
  'spotify-3m': ['spotify_3m'],
  'spotify-12m': ['spotify_12m'],
  'elevenlabs-1m': ['elevenlabs_1m'],
  'elevenlabs-1m-27': ['elevenlabs-3m', 'elevenlabs_3m'],
  'elevenlabs-1m-150': ['elevenlabs-12m', 'elevenlabs_12m'],
  'kling-1m': ['kling_1m'],
  'kling-1m-45': ['kling-3m', 'kling_3m'],
  'kling-1m-105': ['kling-12m', 'kling_12m'],
  'shahid-1m': ['shahid_1m'],
  'shahid-1m-9': ['shahid-12m', 'shahid_12m'],
  'apple-music-1m': ['apple_music_1m', 'apple-music-12m', 'apple_music_12m'],
  'youtube-1m': ['youtube_1m'],
  'youtube-3m': ['youtube_3m'],
  'youtube-12m': ['youtube_12m'],
  'apple-gift-5': ['apple_gift_5', 'apple-gift-card-5'],
  'apple-gift-7': ['apple_gift_7', 'apple-gift-card-7', 'apple-gift-10', 'apple_gift_10'],
  'apple-gift-20': ['apple_gift_20', 'apple-gift-card-20', 'apple-gift-25', 'apple_gift_25'],
  'apple-gift-50': ['apple_gift_50', 'apple-gift-card-50'],
};

export function normalizeProductSlug(slug) {
  return String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
}

export function catalogSlugCandidates(slug) {
  const normalized = normalizeProductSlug(slug);
  const product = resolveCatalogProduct(slug);
  const base = normalizeProductSlug(product?.id || normalized);
  const extras = SLUG_ALIASES[product?.id] || SLUG_ALIASES[base] || [];
  const planIds = (product?.plans || []).flatMap((plan) => [plan.id, ...(PLAN_ID_ALIASES[plan.id] || [])]);
  const values = new Set([
    normalized,
    base,
    product?.id,
    ...extras.map(normalizeProductSlug),
    ...planIds.map(normalizeProductSlug),
  ]);
  if (product?.id) values.add(normalizeProductSlug(product.id));
  return [...values].filter(Boolean).flatMap((value) => [value, value.replace(/-/g, '_')]);
}

function planLabel(plan, product) {
  return plan?.duration || plan?.name || product?.name || '';
}

function planPriceIQD(plan, fallback = 0) {
  return Number(plan?.price_iqd ?? plan?.priceIQD ?? fallback);
}

function planPriceUSD(plan, fallback = 0) {
  return Number(plan?.price_usd ?? plan?.priceUSD ?? fallback);
}

function planIdMatches(planId, candidate) {
  const normalized = normalizeProductSlug(candidate);
  const canonical = normalizeProductSlug(planId);
  if (canonical === normalized) return true;
  const aliases = PLAN_ID_ALIASES[planId] || PLAN_ID_ALIASES[canonical] || [];
  return aliases.some((alias) => normalizeProductSlug(alias) === normalized);
}

export function normalizePlan(plan, product) {
  if (!plan) return null;
  const duration = planLabel(plan, product);
  const priceUSD = planPriceUSD(plan, product?.priceUSD);
  const rawIqd = planPriceIQD(plan, product?.priceIQD);
  const priceIQD = Number.isFinite(priceUSD) && priceUSD > 0 ? usdToIqd(priceUSD) : rawIqd;
  return {
    ...plan,
    id: plan.id,
    duration,
    name: duration,
    price_iqd: priceIQD,
    price_usd: priceUSD,
    priceIQD,
    priceUSD,
  };
}

export function getProductPlans(product) {
  if (!product) return [];
  if (Array.isArray(product.plans) && product.plans.length > 0) {
    return product.plans.map((plan) => normalizePlan(plan, product));
  }
  return [
    normalizePlan(
      {
        id: product.id,
        duration: product.name,
        price_iqd: product.priceIQD,
        price_usd: product.priceUSD,
      },
      product
    ),
  ];
}

export function hasMultiplePlans(product) {
  return Array.isArray(product?.plans) && product.plans.length > 1;
}

export function startingPlan(product) {
  const plans = getProductPlans(product);
  return plans.reduce((lowest, plan) => (plan.priceIQD < lowest.priceIQD ? plan : lowest), plans[0]);
}

export function findPlanById(product, planId) {
  if (!product || !planId) return null;
  return getProductPlans(product).find((plan) => planIdMatches(plan.id, planId)) || null;
}

export function resolveCatalogUnit(slug) {
  const product = resolveCatalogProduct(slug);
  if (!product) return { product: null, plan: null, priceIQD: 0, priceUSD: 0, price_iqd: 0, price_usd: 0 };
  const plan = findPlanById(product, slug) || startingPlan(product);
  return {
    product,
    plan,
    priceIQD: plan.priceIQD,
    priceUSD: plan.priceUSD,
    price_iqd: plan.price_iqd,
    price_usd: plan.price_usd,
  };
}

export function toCheckoutItem(product, plan) {
  const selected = normalizePlan(plan, product) || startingPlan(product);
  const duration = selected?.duration && selected.duration !== product.name ? selected.duration : '';
  return {
    id: selected.id,
    name: duration ? `${product.name} — ${duration}` : product.name,
    priceIQD: selected.priceIQD,
    priceUSD: selected.priceUSD,
    replaceGroup: product.id,
  };
}

export function resolveCatalogProduct(slug) {
  const normalized = normalizeProductSlug(slug);
  if (!normalized) return null;
  const exact = LOCKED_PRODUCTS.find((p) => normalizeProductSlug(p.id) === normalized);
  if (exact) return exact;
  const byPlan = LOCKED_PRODUCTS.find((p) =>
    (p.plans || []).some((plan) => planIdMatches(plan.id, normalized))
  );
  if (byPlan) return byPlan;
  return (
    LOCKED_PRODUCTS.find((p) => {
      const id = normalizeProductSlug(p.id);
      const aliases = [id, ...(SLUG_ALIASES[p.id] || []).map(normalizeProductSlug)];
      return (
        aliases.includes(normalized) ||
        aliases.some((alias) => normalized.startsWith(`${alias}-`) || alias.startsWith(`${normalized}-`))
      );
    }) || null
  );
}

export function getCatalogProduct(slug) {
  return resolveCatalogProduct(slug);
}

export function getInstantCatalogProduct(slug) {
  const product = getCatalogProduct(slug);
  if (!product || isTelegramOrder(product) || product.deliveryType !== 'instant') return null;
  return product;
}

export function getProductFulfillment(slug) {
  const product = resolveCatalogProduct(slug);
  return GIFT_CODE_SLUGS.has(product?.id || slug) ? 'gift_code' : 'credentials';
}

export function isAiHubItem(item) {
  return String(item?.id || '').startsWith('ai_bundle_');
}
