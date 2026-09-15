import { NextResponse } from 'next/server';
import { getOpenRouterCatalog } from '@/lib/openRouterCatalog';

export const dynamic = 'force-dynamic';

const PREFERRED_DEFAULT = 'meta-llama/llama-3.2-3b-instruct:free';

function resolveDefaultModel(free = [], fallbackId) {
  if (free.some((m) => m.id === PREFERRED_DEFAULT)) return PREFERRED_DEFAULT;
  const firstVerifiedFree = free.find(
    (m) => m?.id && !m.isRouter && (String(m.id).endsWith(':free') || m.tier === 'free')
  );
  if (firstVerifiedFree) return firstVerifiedFree.id;
  if (fallbackId && free.some((m) => m.id === fallbackId)) return fallbackId;
  return free[0]?.id || PREFERRED_DEFAULT;
}

/**
 * Live OpenRouter catalog with in-memory cache (see getOpenRouterCatalog).
 * Free = id ends with :free OR zero prompt/completion pricing (chat-safe only).
 * Pro  = remaining paid chat models.
 * Falls back to 10+ static free models when OpenRouter is unreachable.
 */
export async function GET() {
  const payload = await getOpenRouterCatalog();
  const free = Array.isArray(payload.free) ? payload.free : [];
  const paid = Array.isArray(payload.paid) ? payload.paid : [];
  const defaultModel = resolveDefaultModel(free, payload.defaultModel);

  return NextResponse.json({
    ...payload,
    free,
    paid,
    models: free,
    defaultModel,
    count: free.length,
    labels: {
      free: 'مۆدێلێن بەلاش (Free Models)',
      paid: 'مۆدێلێن Pro (Premium Models)',
    },
  });
}
