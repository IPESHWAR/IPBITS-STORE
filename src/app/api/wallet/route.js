import { NextResponse } from 'next/server';
import { getOrCreateWallet, getWalletHistory } from '@/lib/walletService';
import { normalizeWalletId } from '@/lib/wallet';

export async function GET(req) {
  const phone = normalizeWalletId(req.nextUrl.searchParams.get('phone'));
  if (!phone) {
    return NextResponse.json({ error: 'invalid_phone', code: 'invalid_phone' }, { status: 400 });
  }

  const walletRes = await getOrCreateWallet(phone);
  if (!walletRes.ok) {
    return NextResponse.json(
      { error: walletRes.error || walletRes.code, code: walletRes.code },
      { status: walletRes.code === 'db_unavailable' ? 503 : 400 }
    );
  }

  const history = await getWalletHistory(phone, 20);
  return NextResponse.json({
    phone: walletRes.wallet.phone,
    balance_iqd: walletRes.wallet.balance_iqd,
    balance_usd: Number(walletRes.wallet.balance_usd || 0),
    transactions: history.ok ? history.transactions : [],
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizeWalletId(body.phone);
  if (!phone) {
    return NextResponse.json({ error: 'invalid_phone', code: 'invalid_phone' }, { status: 400 });
  }

  const walletRes = await getOrCreateWallet(phone);
  if (!walletRes.ok) {
    return NextResponse.json(
      { error: walletRes.error || walletRes.code, code: walletRes.code },
      { status: walletRes.code === 'db_unavailable' ? 503 : 400 }
    );
  }

  return NextResponse.json({
    phone: walletRes.wallet.phone,
    balance_iqd: walletRes.wallet.balance_iqd,
    balance_usd: Number(walletRes.wallet.balance_usd || 0),
  });
}
