import { NextResponse } from 'next/server';
import { getOpenRouterCatalog } from '@/lib/openRouterCatalog';

/** Cache OpenRouter catalog for 1 hour (also mirrored in-memory). */
export const revalidate = 3600;

const PREFERRED_DEFAULT = 'meta-llama/llama-3.2-3b-instruct:free';

function resolveDefaultModel(free = [], fallbackId) {
  if (free.some((m) => m.id === PREFERRED_DEFAULT)) return PREFERRED_DEFAULT;
  const firstVerifiedFree = free.find(
    (m) => m?.id && !m.isRouter && (String(m.id).endsWith(':free') || m.isFree || m.tier === 'free')
  );
  if (firstVerifiedFree) return firstVerifiedFree.id;
  if (fallbackId && free.some((m) => m.id === fallbackId)) return fallbackId;
  return free[0]?.id || PREFERRED_DEFAULT;
}

/**
 * Live OpenRouter catalog (text + image).
 * Each model: id, name, isFree, isImageModel, pricing (with points map).
 */
export async function GET() {
  const payload = await getOpenRouterCatalog();
  const free = Array.isArray(payload.free) ? payload.free : [];
  const paid = Array.isArray(payload.paid) ? payload.paid : [];
  const image = Array.isArray(payload.image) ? payload.image : [];
  const all = Array.isArray(payload.all) ? payload.all : [...free, ...paid, ...image];
  const defaultModel = resolveDefaultModel(free, payload.defaultModel);

  return NextResponse.json({
    ...payload,
    free,
    paid,
    image,
    all,
    models: all,
    defaultModel,
    count: all.length,
    labels: {
      all: 'هەموو / All',
      free: 'بێبەرامبەر / Free',
      image: '🎨 وێنە / Image',
      paid: 'مۆدێلێن Pro (Premium Models)',
    },
  });
}
