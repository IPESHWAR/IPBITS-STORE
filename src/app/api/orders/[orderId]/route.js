import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req, context) {
  try {
    const params = await context.params;
    const orderId = params?.orderId;
    if (!orderId) {
      return NextResponse.json({ error: 'order_id required' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const receipt = searchParams.get('receipt') === '1';

    const columns = receipt
      ? 'id, status, license_key, plan_type, duration_days, customer_name, customer_phone, phone, items_label, total_iqd, total_usd, payment_method, transaction_id, updated_at, created_at'
      : 'id, status, license_key, plan_type, duration_days, updated_at, created_at';

    let { data, error } = await supabaseAdmin
      .from('orders')
      .select(columns)
      .eq('id', orderId)
      .maybeSingle();

    // Fallback if some receipt columns are missing on older schemas
    if (error && /column|schema cache|does not exist/i.test(error.message || '')) {
      ({ data, error } = await supabaseAdmin
        .from('orders')
        .select('id, status, license_key, plan_type, duration_days, updated_at, created_at, phone, items_label, total_iqd')
        .eq('id', orderId)
        .maybeSingle());
    }

    if (error || !data) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      orderId: data.id,
      id: data.id,
      status: data.status,
      licenseKey: data.license_key
        ? { key_code: data.license_key, plan_type: data.plan_type, duration_days: data.duration_days }
        : null,
      license_key: data.license_key || null,
      planType: data.plan_type || null,
      durationDays: data.duration_days || null,
      customerName: data.customer_name || null,
      customerPhone: data.customer_phone || data.phone || null,
      itemsLabel: data.items_label || null,
      totalIqd: data.total_iqd ?? null,
      totalUsd: data.total_usd ?? null,
      paymentMethod: data.payment_method || null,
      transactionId: data.transaction_id || null,
      updatedAt: data.updated_at,
      createdAt: data.created_at,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
