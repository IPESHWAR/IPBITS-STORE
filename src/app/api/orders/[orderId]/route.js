import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(_req, context) {
  try {
    const params = await context.params;
    const orderId = params?.orderId;
    if (!orderId) {
      return NextResponse.json({ error: 'order_id required' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('id, status, license_key, plan_type, duration_days, updated_at, created_at')
      .eq('id', orderId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      orderId: data.id,
      status: data.status,
      licenseKey: data.license_key
        ? { key_code: data.license_key, plan_type: data.plan_type, duration_days: data.duration_days }
        : null,
      updatedAt: data.updated_at,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
