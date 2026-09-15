import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeVoucherCode } from '@/lib/voucherStore';

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'db_unavailable', vouchers: [] }, { status: 503 });
  }

  const selects = [
    'id, code, amount_iqd, is_used, used_by, used_at, is_printed, printed_at, status',
    'code, amount_iqd, is_used, used_by, used_at, is_printed, printed_at, status',
    'code, amount_iqd, is_used, used_by, used_at, is_printed, printed_at',
    'code, amount_iqd, is_used, used_by, used_at',
  ];

  let data = null;
  let error = null;
  for (const columns of selects) {
    ({ data, error } = await supabaseAdmin
      .from('vouchers')
      .select(columns)
      .order('used_at', { ascending: false, nullsFirst: true }));
    if (!error) break;
    if (!/column|schema cache/i.test(error.message || '')) break;
  }

  if (error) {
    return NextResponse.json({ error: error.message, vouchers: [] }, { status: 500 });
  }

  return NextResponse.json({ vouchers: data || [] });
}

export async function POST(req) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const code = normalizeVoucherCode(body.code || body.voucher_code);
  const amountIqd = Math.round(Number(body.amount_iqd || body.amountIqd || 0));

  if (!code || code.length < 4) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }
  if (!Number.isFinite(amountIqd) || amountIqd <= 0) {
    return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
  }

  const insertAttempts = [
    { code, amount_iqd: amountIqd, is_used: false, is_printed: false, status: 'available' },
    { code, amount_iqd: amountIqd, is_used: false, is_printed: false },
    { code, amount_iqd: amountIqd, is_used: false },
  ];

  let data = null;
  let error = null;
  for (const payload of insertAttempts) {
    ({ data, error } = await supabaseAdmin
      .from('vouchers')
      .insert(payload)
      .select('id, code, amount_iqd, is_used, used_by, used_at, is_printed, printed_at, status')
      .single());
    if (!error) break;
    if (!/column|schema cache/i.test(error.message || '')) break;
    ({ data, error } = await supabaseAdmin
      .from('vouchers')
      .insert(payload)
      .select('code, amount_iqd, is_used, used_by, used_at')
      .single());
    if (!error) break;
    if (!/column|schema cache/i.test(error.message || '')) break;
  }

  if (error) {
    const status = /duplicate|23505/i.test(error.message || '') ? 409 : 500;
    return NextResponse.json({ error: error.message, code: status === 409 ? 'exists' : 'db_error' }, { status });
  }

  return NextResponse.json({ success: true, voucher: data });
}
