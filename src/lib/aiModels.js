import { isFreeAiModel } from '@/lib/wallet';

/** OpenRouter auto-router across live free models. */
export const OPENROUTER_FREE_ROUTER_ID = 'openrouter/free';

/** Preferred default free chat model (auto-router, then static fallback). */
export const DEFAULT_FREE_MODEL_ID = OPENROUTER_FREE_ROUTER_ID;

const PROVIDER_LABELS = {
  google: 'Google',
  'meta-llama': 'Meta',
  meta: 'Meta',
  facebook: 'Meta',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  alibaba: 'Qwen',
  nvidia: 'NVIDIA',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  mistralai: 'Mistral',
  mistral: 'Mistral',
  microsoft: 'Microsoft',
  azure: 'Microsoft',
  cohere: 'Cohere',
  'x-ai': 'xAI',
  xai: 'xAI',
  amazon: 'Amazon',
  nousresearch: 'Nous',
  openchat: 'OpenChat',
  liquid: 'LiquidAI',
  liquidai: 'LiquidAI',
  minimax: 'MiniMax',
  inclusionai: 'inclusionAI',
  openrouter: 'OpenRouter',
  cognitivecomputations: 'Cognitive Computations',
  huggingface: 'Hugging Face',
  together: 'Together',
  groq: 'Groq',
  perplexity: 'Perplexity',
  infinisilicon: 'InfiniSilicon',
  moonshotai: 'Moonshot',
  moonshot: 'Moonshot',
  '01': '01.AI',
  '01-ai': '01.AI',
  'black-forest-labs': 'Black Forest Labs',
  stabilityai: 'Stability AI',
  'stability-ai': 'Stability AI',
  recraft: 'Recraft',
  ideogram: 'Ideogram',
};

const IMAGE_MODEL_RE =
  /\b(flux|flux-1|recraft|recraft-ai|dall-?e|stable.?diffusion|sdxl|sd3|imagen|ideogram|playground.?v|black-forest-labs|midjourney|kandinsky|lumina)\b/i;

export function inferProvider(modelId, modelName = '') {
  const slug = String(modelId || '').split('/')[0].toLowerCase();
  if (PROVIDER_LABELS[slug]) return PROVIDER_LABELS[slug];
  const fromName = String(modelName || '').split(':')[0].trim();
  if (fromName && fromName.length < 24 && !fromName.includes(' ')) return fromName;
  return slug
    ? slug.replace(/(^|[-_])(\w)/g, (_, sep, ch) => (sep ? ' ' : '') + ch.toUpperCase())
    : 'OpenRouter';
}

export function cleanModelName(rawName, modelId) {
  let name = String(rawName || modelId || '').trim();
  name = name.replace(/\s*\((free|gratis)\)\s*/gi, '').trim();
  name = name.replace(/:free$/i, '').trim();
  const colon = name.indexOf(':');
  if (colon > 0 && colon < 28) {
    name = name.slice(colon + 1).trim();
  }
  if (!name && modelId) {
    const slug = String(modelId).replace(/:free$/i, '').split('/').pop();
    name = slug || modelId;
  }
  return name;
}

export const OPENROUTER_FREE_AUTO = {
  id: OPENROUTER_FREE_ROUTER_ID,
  name: 'Auto Router',
  provider: 'OpenRouter',
  context_length: null,
  tier: 'free',
  isFree: true,
  isImageModel: false,
  isRouter: true,
};

/**
 * Robust static fallback when OpenRouter is unreachable.
 * DeepSeek / Gemini / Claude + popular free chat models.
 */
export const FALLBACK_FREE_MODELS = [
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1', tier: 'free' },
  { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek Chat V3', tier: 'free' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash Exp', tier: 'free' },
  { id: 'google/gemma-3-4b-it:free', name: 'Gemma 3 4B', tier: 'free' },
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B Instruct', tier: 'free' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct', tier: 'free' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1 24B', tier: 'free' },
  { id: 'qwen/qwen3-4b:free', name: 'Qwen3 4B', tier: 'free' },
  { id: 'microsoft/phi-4:free', name: 'Phi-4', tier: 'free' },
  { id: 'openchat/openchat-7b:free', name: 'OpenChat 7B', tier: 'free' },
];

export const FALLBACK_PAID_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', tier: 'paid' },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', tier: 'paid' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', tier: 'paid' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', tier: 'paid' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', tier: 'paid' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini 1.5 Pro', tier: 'paid' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', tier: 'paid' },
];

export const FALLBACK_IMAGE_MODELS = [
  {
    id: 'black-forest-labs/flux-1-schnell',
    name: 'FLUX.1 Schnell',
    type: 'Image',
    tier: 'paid',
    isImageModel: true,
  },
  {
    id: 'black-forest-labs/flux-1-dev',
    name: 'FLUX.1 Dev',
    type: 'Image',
    tier: 'paid',
    isImageModel: true,
  },
  {
    id: 'stabilityai/stable-diffusion-xl-base-1.0',
    name: 'Stable Diffusion XL',
    type: 'Image',
    tier: 'paid',
    isImageModel: true,
  },
  {
    id: 'recraft-ai/recraft-v3',
    name: 'Recraft V3',
    type: 'Image',
    tier: 'paid',
    isImageModel: true,
  },
];

/** Always-available image models (injected even if OpenRouter omits them). */
export const ESSENTIAL_IMAGE_MODELS = FALLBACK_IMAGE_MODELS.map((m) => ({ ...m }));

/** Alternate OpenRouter slugs → canonical essential id */
const ESSENTIAL_IMAGE_ALIASES = {
  'black-forest-labs/flux.1-schnell': 'black-forest-labs/flux-1-schnell',
  'black-forest-labs/flux.1-dev': 'black-forest-labs/flux-1-dev',
  'black-forest-labs/flux-schnell': 'black-forest-labs/flux-1-schnell',
  'stabilityai/stable-diffusion-xl': 'stabilityai/stable-diffusion-xl-base-1.0',
  'stabilityai/sdxl': 'stabilityai/stable-diffusion-xl-base-1.0',
  'recraft-ai/recraft-v3-svg': 'recraft-ai/recraft-v3',
  'recraft/recraft-v3': 'recraft-ai/recraft-v3',
};

function essentialAliasIds(canonicalId) {
  const id = String(canonicalId || '').toLowerCase();
  const alts = [id];
  for (const [alias, canon] of Object.entries(ESSENTIAL_IMAGE_ALIASES)) {
    if (String(canon).toLowerCase() === id) alts.push(alias.toLowerCase());
  }
  // flux-1 ↔ flux.1
  if (id.includes('flux-1-')) alts.push(id.replace('flux-1-', 'flux.1-'));
  if (id.includes('flux.1-')) alts.push(id.replace('flux.1-', 'flux-1-'));
  return [...new Set(alts)];
}

/**
 * Guarantee FLUX / SDXL / Recraft appear in the image list with isImageModel: true.
 * Prefers live OpenRouter rows when an alias match exists; otherwise injects essentials.
 */
export function ensureEssentialImageModels(imageList = []) {
  const list = Array.isArray(imageList) ? imageList.map((m) => ({ ...m })) : [];

  for (const ess of ESSENTIAL_IMAGE_MODELS) {
    const aliases = essentialAliasIds(ess.id);
    const idx = list.findIndex((m) => aliases.includes(String(m.id || '').toLowerCase()));

    if (idx >= 0) {
      const row = list[idx];
      list[idx] = {
        ...row,
        name: ess.name || row.name,
        type: 'Image',
        isImageModel: true,
        tier: row.tier || ess.tier || 'paid',
        isFree: row.isFree === true || row.tier === 'free',
      };
    } else {
      list.unshift({
        id: ess.id,
        name: ess.name,
        type: 'Image',
        tier: 'paid',
        isFree: false,
        isImageModel: true,
        isRouter: false,
        provider: inferProvider(ess.id, ess.name),
        context_length: null,
        pricing: {
          prompt: '0.00002',
          completion: '0',
          points: mapPricingToPoints({ prompt: '0.00002', completion: '0' }),
        },
      });
    }
  }

  // Dedupe by lowercase id (keep first)
  const seen = new Set();
  return list.filter((m) => {
    const id = String(m.id || '').toLowerCase();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** @deprecated use FALLBACK_FREE_MODELS + FALLBACK_PAID_MODELS */
export const CONFIGURED_AI_MODELS = [...FALLBACK_FREE_MODELS, ...FALLBACK_PAID_MODELS];

const AGENTIC_ONLY_IDS = [
  'thinkingmachines/inkling-small:free',
  'thinkingmachines/inkling',
];

export function isPricingFree(pricing) {
  if (!pricing) return false;
  const prompt = parseFloat(pricing.prompt);
  const completion = parseFloat(pricing.completion);
  return Number.isFinite(prompt) && Number.isFinite(completion) && prompt === 0 && completion === 0;
}

/** Map OpenRouter USD-per-token pricing → VIP points ($1 = 1000 pts). */
export function mapPricingToPoints(pricing) {
  const promptUsd = Number.parseFloat(pricing?.prompt);
  const completionUsd = Number.parseFloat(pricing?.completion);
  const prompt = Number.isFinite(promptUsd) ? promptUsd : 0;
  const completion = Number.isFinite(completionUsd) ? completionUsd : 0;
  const isFree = prompt === 0 && completion === 0;
  return {
    prompt_usd: prompt,
    completion_usd: completion,
    prompt_points_per_1m: Math.max(0, Math.round(prompt * 1_000_000 * 1000)),
    completion_points_per_1m: Math.max(0, Math.round(completion * 1_000_000 * 1000)),
    isFree,
  };
}

export function isFreeCatalogModel(model) {
  if (!model?.id) return false;
  if (model.isFree === true) return true;
  if (String(model.id).endsWith(':free')) return true;
  if (isPricingFree(model.pricing)) return true;
  if (model.tier === 'free') return true;
  return isFreeAiModel(model.id, model.name);
}

/** Detect image-generation models via architecture or slug. */
export function isImageGenerationModel(modelOrId) {
  if (!modelOrId) return false;
  if (typeof modelOrId === 'string') {
    return IMAGE_MODEL_RE.test(modelOrId);
  }
  const id = String(modelOrId.id || '').toLowerCase();
  const name = String(modelOrId.name || '').toLowerCase();
  const desc = String(modelOrId.description || '').toLowerCase();
  const label = `${id} ${name} ${desc}`;

  const arch = modelOrId.architecture || {};
  const outMods = (arch.output_modalities || []).map((m) => String(m).toLowerCase());
  const inMods = (arch.input_modalities || []).map((m) => String(m).toLowerCase());

  if (outMods.includes('image')) {
    if (!outMods.includes('text') || IMAGE_MODEL_RE.test(label)) return true;
  }
  if (IMAGE_MODEL_RE.test(label)) return true;
  if (
    inMods.includes('text') &&
    outMods.includes('image') &&
    !/instruct|chat|llm|claude|gpt|gemini/i.test(label)
  ) {
    return true;
  }
  return false;
}

/**
 * Exclude embedding-only, agentic-harness-only, and other non-chat models.
 * Image-gen models are handled separately via isImageGenerationModel.
 */
export function isChatCompatibleModel(model) {
  if (!model?.id) return false;
  if (isImageGenerationModel(model)) return false;

  const id = String(model.id).toLowerCase();
  const name = String(model.name || '').toLowerCase();
  const desc = String(model.description || '').toLowerCase();
  const label = `${id} ${name} ${desc}`;

  if (AGENTIC_ONLY_IDS.some((x) => id === x || id.startsWith(x))) return false;
  if (/inkling|agentic.?harness|harness.?only|agent.?only/i.test(label)) return false;

  if (/\bembed(ding)?s?\b/.test(label) || id.includes('/embed') || id.includes('-embed')) return false;
  if (/\brerank\b/.test(label)) return false;
  if (/\btts\b|\bstt\b|\bwhisper\b|\basr\b|speech.?to.?text|text.?to.?speech/i.test(label)) return false;

  const arch = model.architecture || {};
  const inMods = (arch.input_modalities || []).map((m) => String(m).toLowerCase());
  const outMods = (arch.output_modalities || []).map((m) => String(m).toLowerCase());

  if (outMods.length && !outMods.includes('text')) return false;
  if (outMods.includes('embeddings') && !outMods.includes('text')) return false;
  if (outMods.includes('image') && !outMods.includes('text')) return false;
  if (outMods.includes('audio') && !outMods.includes('text')) return false;

  if (inMods.length && !inMods.includes('text') && (inMods.includes('image') || inMods.includes('file'))) {
    return false;
  }

  if (id === OPENROUTER_FREE_ROUTER_ID) return true;
  if (id.endsWith('/free') && id.split('/').length === 2 && !id.includes(':')) {
    return false;
  }

  if (/\bmoderat(ion|e)\b|\bclassif(y|ier)\b/.test(label)) return false;

  return true;
}

export function modelTier(modelId, modelName = '', pricing) {
  if (String(modelId || '') === OPENROUTER_FREE_ROUTER_ID) return 'free';
  if (isPricingFree(pricing)) return 'free';
  const label = `${modelId || ''} ${modelName || ''}`.toLowerCase();
  if (
    isFreeAiModel(modelId, modelName) ||
    label.includes('(free)') ||
    label.includes(':free') ||
    String(modelId || '').endsWith(':free') ||
    /\bfree\b/.test(label)
  ) {
    return 'free';
  }
  return 'paid';
}

export function normalizeOpenRouterModel(raw) {
  if (!raw?.id) return null;
  const id = String(raw.id);
  const isImageModel = isImageGenerationModel(raw);
  const tier = modelTier(id, raw.name, raw.pricing);
  const name = cleanModelName(raw.name, id);
  const points = mapPricingToPoints(raw.pricing);
  const isFree = points.isFree || tier === 'free' || String(id).endsWith(':free');
  return {
    id,
    name,
    provider: inferProvider(id, raw.name),
    context_length: raw.context_length || raw.top_provider?.context_length || null,
    tier: isFree ? 'free' : tier,
    isFree,
    isImageModel,
    type: isImageModel ? 'Image' : undefined,
    isRouter: id === OPENROUTER_FREE_ROUTER_ID,
    pricing: {
      ...(raw.pricing || {}),
      points,
    },
    architecture: raw.architecture || null,
    description: raw.description || '',
  };
}

/**
 * Categorize OpenRouter catalog into chat-safe free + paid + image lists.
 */
export function categorizeOpenRouterModels(rawList = []) {
  const free = [];
  const paid = [];
  const image = [];
  const seen = new Set();

  for (const raw of rawList) {
    const m = normalizeOpenRouterModel(raw);
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);

    if (m.isImageModel || isImageGenerationModel(raw)) {
      image.push({ ...m, isImageModel: true });
      continue;
    }

    if (!isChatCompatibleModel(raw) && !isChatCompatibleModel(m)) continue;

    if (isFreeCatalogModel(m) || m.tier === 'free' || m.isFree) {
      free.push({ ...m, tier: 'free', isFree: true });
    } else {
      paid.push({ ...m, tier: 'paid', isFree: false });
    }
  }

  free.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  paid.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  image.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

  const freeWithRouter = [
    OPENROUTER_FREE_AUTO,
    ...free.filter((m) => m.id !== OPENROUTER_FREE_ROUTER_ID),
  ];

  return { free: freeWithRouter, paid, image };
}

export function pickDefaultModel(freeList = []) {
  if (freeList.some((m) => m.id === OPENROUTER_FREE_ROUTER_ID)) return OPENROUTER_FREE_ROUTER_ID;
  if (!freeList.length) return DEFAULT_FREE_MODEL_ID;
  if (freeList.some((m) => m.id === DEFAULT_FREE_MODEL_ID)) return DEFAULT_FREE_MODEL_ID;

  const prefer = [
    /^deepseek\/.*:free$/i,
    /^google\/gemini.*:free$/i,
    /^meta-llama\/llama-3\.2-.*:free$/i,
    /^meta-llama\/llama-3\.3-.*:free$/i,
    /^meta-llama\/.*:free$/i,
    /^google\/gemma-.*:free$/i,
    /^mistralai\/.*:free$/i,
    /^qwen\/.*:free$/i,
  ];
  for (const re of prefer) {
    const hit = freeList.find((m) => re.test(m.id));
    if (hit) return hit.id;
  }
  return freeList[0].id;
}

function decorateFallback(m, extras = {}) {
  const points = mapPricingToPoints(m.pricing || { prompt: '0', completion: '0' });
  const isImageModel = Boolean(m.isImageModel || extras.isImageModel);
  const isFree = m.tier === 'free' || points.isFree || String(m.id).endsWith(':free');
  return {
    ...m,
    name: cleanModelName(m.name, m.id),
    provider: inferProvider(m.id, m.name),
    context_length: m.context_length || null,
    isRouter: false,
    isFree,
    isImageModel,
    pricing: { ...(m.pricing || {}), points },
    ...extras,
  };
}

export function getFallbackCatalog() {
  const free = [
    { ...OPENROUTER_FREE_AUTO },
    ...FALLBACK_FREE_MODELS.map((m) => decorateFallback(m, { isFree: true, isImageModel: false })),
  ];
  const paid = FALLBACK_PAID_MODELS.map((m) =>
    decorateFallback({ ...m, pricing: { prompt: '0.000003', completion: '0.000015' } }, {
      isFree: false,
      isImageModel: false,
    })
  );
  const image = FALLBACK_IMAGE_MODELS.map((m) =>
    decorateFallback({ ...m, pricing: { prompt: '0.00002', completion: '0' } }, {
      isImageModel: true,
    })
  );
  return {
    free,
    paid,
    image,
    source: 'fallback',
  };
}
