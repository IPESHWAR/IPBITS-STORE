import { NextResponse } from 'next/server';
import { getOpenRouterCatalog } from '@/lib/openRouterCatalog';

export const dynamic = 'force-dynamic';

/** Legacy alias — same cached OpenRouter free-model catalog as `/api/models`. */
export async function GET() {
  const payload = await getOpenRouterCatalog();
  return NextResponse.json(payload);
}
