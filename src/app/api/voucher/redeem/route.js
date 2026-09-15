import { NextResponse } from 'next/server';
import { redeemVoucher } from '@/lib/walletService';
import { normalizeWalletId } from '@/lib/wallet';
import { VOUCHER_INVALID_MSG } from '@/lib/voucherStore';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizeWalletId(body.phone);
  const voucherCode = body.voucher_code || body.code || body.voucherCode || '';

  if (!phone) {
    return NextResponse.json(
      { success: false, error: 'invalid_phone', code: 'invalid_phone' },
      { status: 400 }
    );
  }

  const result = await redeemVoucher({ phone, code: voucherCode });
  if (!result.ok) {
    if (result.code === 'invalid_voucher' || result.code === 'voucher_used') {
      return NextResponse.json(
        { success: false, error: VOUCHER_INVALID_MSG, code: result.code },
        { status: 400 }
      );
    }
    const status = result.code === 'db_unavailable' ? 503 : 400;
    return NextResponse.json(
      { success: false, error: result.error || result.code, code: result.code },
      { status }
    );
  }

  return NextResponse.json({
    success: true,
    creditedIqd: result.creditedIqd,
    balance_iqd: result.wallet?.balance_iqd,
    balance_usd: Number(result.wallet?.balance_usd || 0),
    phone: result.wallet?.phone,
  });
}
