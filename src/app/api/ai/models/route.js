import { NextResponse } from 'next/server';
import { getOpenRouterCatalog } from '@/lib/openRouterCatalog';

export const revalidate = 3600;

/** Legacy alias — same cached OpenRouter catalog as `/api/models`. */
export async function GET() {
  const payload = await getOpenRouterCatalog();
  return NextResponse.json(payload);
}
