import { NextResponse } from 'next/server';
import { payWithBalance, getOrCreateWallet, applyWalletChange } from '@/lib/walletService';
import { iqdToUsd, normalizeWalletId } from '@/lib/wallet';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizeWalletId(body.phone);
  const items = Array.isArray(body.items) ? body.items : [];
  const totalIQD = Number(body.totalIQD || body.total_iqd || 0);
  const totalUSD = Number(body.totalUSD || body.total_usd || 0);
  const name = String(body.name || phone || '').trim();
  const allowDevBypass =
    process.env.NODE_ENV === 'development' && Boolean(body.devBypass);

  if (allowDevBypass && phone && totalIQD > 0) {
    const walletRes = await getOrCreateWallet(phone);
    if (walletRes.ok && Number(walletRes.wallet.balance_iqd) < totalIQD) {
      const gap = Math.ceil(totalIQD - Number(walletRes.wallet.balance_iqd) + 1);
      await applyWalletChange({
        phone,
        type: 'top_up',
        amountIqd: gap,
        amountUsd: iqdToUsd(gap),
        description: 'DEV bypass top-up',
      });
    }
  }

  const result = await payWithBalance({ phone, items, totalIQD, totalUSD, name });
  if (!result.ok) {
    const status =
      result.code === 'insufficient_balance'
        ? 402
        : result.code === 'db_unavailable'
          ? 503
          : 400;
    return NextResponse.json(
      {
        error: result.error || result.code,
        code: result.code,
        balanceIqd: result.balanceIqd,
      },
      { status }
    );
  }

  return NextResponse.json({
    success: true,
    orderId: result.orderId,
    status: result.status,
    licenseKey: result.licenseKey,
    balance_iqd: result.wallet?.balance_iqd,
    balance_usd: Number(result.wallet?.balance_usd || 0),
  });
}
