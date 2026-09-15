import { NextResponse } from 'next/server';
import { generateLicenseForOrder } from '@/lib/licenseService';
import { normalizePhone } from '@/lib/orderValidation';

export async function POST(req) {
  try {
    const adminSecret = process.env.LICENSE_ADMIN_SECRET || process.env.TELEGRAM_BOT_TOKEN;
    const provided = req.headers.get('x-admin-secret') || '';
    if (!adminSecret || provided !== adminSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { phone, name, items, planType, durationDays, planSuffix } = body;

    const license = await generateLicenseForOrder({
      items: items || [],
      phone: phone ? normalizePhone(phone) : null,
      name: name ? String(name).trim() : null,
      planType,
      durationDays,
      planSuffix,
    });

    return NextResponse.json({ success: true, licenseKey: license });
  } catch (error) {
    console.error('Key generate error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate license key' },
      { status: 500 }
    );
  }
}
