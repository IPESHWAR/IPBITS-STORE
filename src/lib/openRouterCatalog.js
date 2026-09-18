import {
  categorizeOpenRouterModels,
  getFallbackCatalog,
  pickDefaultModel,
} from '@/lib/aiModels';

const CACHE_TTL_MS = 60 * 60 * 1000;
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

let memoryCache = {
  at: 0,
  payload: null,
};

function shapePayload(catalog, source) {
  const free = catalog.free || [];
  const paid = catalog.paid || [];
  const image = catalog.image || [];
  const all = [...free, ...paid, ...image];
  return {
    free,
    paid,
    image,
    all,
    models: all,
    defaultModel: pickDefaultModel(free),
    count: all.length,
    freeCount: free.length,
    imageCount: image.length,
    source,
    cachedAt: new Date().toISOString(),
  };
}

async function fetchLiveCatalog() {
  const apiKey = String(process.env.OPENROUTER_API_KEY || '').trim();
  const headers = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(OPENROUTER_MODELS_URL, {
    headers,
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    throw new Error(`openrouter_models_${res.status}`);
  }

  const data = await res.json();
  const list = Array.isArray(data?.data) ? data.data : [];
  if (!list.length) throw new Error('openrouter_models_empty');

  const { free, paid, image } = categorizeOpenRouterModels(list);
  if (!free.length && !paid.length && !image.length) {
    throw new Error('openrouter_models_filtered_empty');
  }

  return shapePayload({ free, paid, image }, 'openrouter');
}

export async function getOpenRouterCatalog() {
  const now = Date.now();
  if (memoryCache.payload && now - memoryCache.at < CACHE_TTL_MS) {
    return { ...memoryCache.payload, cache: 'hit' };
  }

  try {
    const payload = await fetchLiveCatalog();
    memoryCache = { at: now, payload };
    return { ...payload, cache: 'miss' };
  } catch (error) {
    if (memoryCache.payload) {
      return {
        ...memoryCache.payload,
        cache: 'stale',
        warning: String(error?.message || 'fetch_failed'),
      };
    }

    const fallback = getFallbackCatalog();
    return {
      ...shapePayload(fallback, 'fallback'),
      cache: 'fallback',
      warning: String(error?.message || 'fetch_failed'),
    };
  }
}
