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
};

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
  isRouter: true,
};

/**
 * Robust static fallback when OpenRouter is unreachable.
 * 10+ popular free chat models.
 */
export const FALLBACK_FREE_MODELS = [
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B Instruct', tier: 'free' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct', tier: 'free' },
  { id: 'google/gemma-3-4b-it:free', name: 'Gemma 3 4B', tier: 'free' },
  { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B', tier: 'free' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1 24B', tier: 'free' },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct', tier: 'free' },
  { id: 'qwen/qwen3-4b:free', name: 'Qwen3 4B', tier: 'free' },
  { id: 'qwen/qwen-2.5-7b-instruct:free', name: 'Qwen 2.5 7B Instruct', tier: 'free' },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1', tier: 'free' },
  { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek Chat V3', tier: 'free' },
  { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Phi-3 Mini 128K', tier: 'free' },
  { id: 'microsoft/phi-4:free', name: 'Phi-4', tier: 'free' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash Exp', tier: 'free' },
  { id: 'openchat/openchat-7b:free', name: 'OpenChat 7B', tier: 'free' },
];

export const FALLBACK_PAID_MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', tier: 'paid' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', tier: 'paid' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', tier: 'paid' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', tier: 'paid' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini 1.5 Pro', tier: 'paid' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', tier: 'paid' },
];

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

export function isFreeCatalogModel(model) {
  if (!model?.id) return false;
  if (String(model.id).endsWith(':free')) return true;
  if (isPricingFree(model.pricing)) return true;
  if (model.tier === 'free') return true;
  return isFreeAiModel(model.id, model.name);
}

/**
 * Exclude embedding-only, agentic-harness-only, vision/image-output-only,
 * and other models that break plain text chat.
 */
export function isChatCompatibleModel(model) {
  if (!model?.id) return false;
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

  // Vision-only / image-gen only (no text input)
  if (inMods.length && !inMods.includes('text') && (inMods.includes('image') || inMods.includes('file'))) {
    return false;
  }

  if (/\b(flux|recraft|dall-?e|stable.?diffusion|sdxl|imagen)\b/.test(label) && !/instruct|chat|llm/i.test(label)) {
    return false;
  }

  if (id === OPENROUTER_FREE_ROUTER_ID) return true;
  // Other /free aliases that are not real chat endpoints
  if (id.endsWith('/free') && id.split('/').length === 2 && !id.includes(':')) {
    return false;
  }

  // Moderation / classifier utilities
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
  const tier = modelTier(id, raw.name, raw.pricing);
  const name = cleanModelName(raw.name, id);
  return {
    id,
    name,
    provider: inferProvider(id, raw.name),
    context_length: raw.context_length || raw.top_provider?.context_length || null,
    tier,
    isRouter: id === OPENROUTER_FREE_ROUTER_ID,
    pricing: raw.pricing || null,
    architecture: raw.architecture || null,
    description: raw.description || '',
  };
}

/**
 * Categorize OpenRouter catalog into chat-safe free + paid lists.
 */
export function categorizeOpenRouterModels(rawList = []) {
  const free = [];
  const paid = [];
  const seen = new Set();

  for (const raw of rawList) {
    const m = normalizeOpenRouterModel(raw);
    if (!m || seen.has(m.id)) continue;
    if (!isChatCompatibleModel(raw) && !isChatCompatibleModel(m)) continue;
    seen.add(m.id);

    if (isFreeCatalogModel(m) || m.tier === 'free') {
      free.push({ ...m, tier: 'free' });
    } else {
      paid.push({ ...m, tier: 'paid' });
    }
  }

  free.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  paid.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

  const freeWithRouter = [OPENROUTER_FREE_AUTO, ...free.filter((m) => m.id !== OPENROUTER_FREE_ROUTER_ID)];

  return { free: freeWithRouter, paid };
}

export function pickDefaultModel(freeList = []) {
  if (freeList.some((m) => m.id === OPENROUTER_FREE_ROUTER_ID)) return OPENROUTER_FREE_ROUTER_ID;
  if (!freeList.length) return DEFAULT_FREE_MODEL_ID;
  if (freeList.some((m) => m.id === DEFAULT_FREE_MODEL_ID)) return DEFAULT_FREE_MODEL_ID;

  const prefer = [
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

export function getFallbackCatalog() {
  const free = [
    { ...OPENROUTER_FREE_AUTO },
    ...FALLBACK_FREE_MODELS.map((m) => ({
      ...m,
      name: cleanModelName(m.name, m.id),
      provider: inferProvider(m.id, m.name),
      context_length: m.context_length || null,
      isRouter: false,
    })),
  ];
  const paid = FALLBACK_PAID_MODELS.map((m) => ({
    ...m,
    name: cleanModelName(m.name, m.id),
    provider: inferProvider(m.id, m.name),
    context_length: m.context_length || null,
    isRouter: false,
  }));
  return {
    free,
    paid,
    source: 'fallback',
  };
}
