import { NextResponse } from 'next/server';
import { generateBulkKeys, MAX_BATCH } from '@/lib/bulkKeyGenerator';
import { listBulkKeyTiers } from '@/lib/bulkKeyTiers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** List available pricing tiers */
export async function GET() {
  return NextResponse.json({
    ok: true,
    tiers: listBulkKeyTiers(),
    max_batch: MAX_BATCH,
  });
}

/**
 * Generate a batch of AI Hub voucher codes (+ OpenRouter sub-keys).
 * Body: { tier: 'weekly', quantity: 20, skipOpenRouter?: boolean }
 */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const tier = body.tier || body.packageType || body.plan;
    const quantity = body.quantity ?? body.qty ?? body.count ?? 10;
    const provisionOpenRouter = !(body.skipOpenRouter === true || body.skip_openrouter === true);

    const result = await generateBulkKeys({
      tier,
      quantity,
      provisionOpenRouter,
    });

    if (!result.ok && result.code === 'invalid_tier') {
      return NextResponse.json(
        { ok: false, error: result.error, tiers: listBulkKeyTiers() },
        { status: 400 }
      );
    }

    if (!result.ok && (!result.created || result.created === 0)) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || result.failures?.[0]?.error || 'generation_failed',
          failures: result.failures || [],
          codes: result.codes || [],
          items: result.items || [],
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      tier: result.tier,
      requested: result.requested,
      created: result.created,
      codes: result.codes,
      items: result.items,
      failures: result.failures,
    });
  } catch (error) {
    console.error('Bulk keys error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'generation_failed' },
      { status: 500 }
    );
  }
}
