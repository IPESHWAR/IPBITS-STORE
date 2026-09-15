import { NextResponse } from 'next/server';
import { consumeAiUsage, getOrCreateWallet } from '@/lib/walletService';
import { estimateAiUsageCost, isFreeAiModel, normalizeWalletId } from '@/lib/wallet';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizeWalletId(body.phone);
  const model = String(body.model || '');
  const isImage = !!body.isImage;
  const cost = estimateAiUsageCost(model, isImage);

  if (isFreeAiModel(model) && !isImage) {
    return NextResponse.json({ success: true, charged_iqd: 0, free: true });
  }

  if (!phone) {
    return NextResponse.json({ error: 'invalid_phone', code: 'invalid_phone' }, { status: 400 });
  }

  const preview = await getOrCreateWallet(phone);
  if (!preview.ok) {
    return NextResponse.json(
      { error: preview.error || preview.code, code: preview.code },
      { status: preview.code === 'db_unavailable' ? 503 : 400 }
    );
  }

  if (Number(preview.wallet.balance_iqd) <= 0 || Number(preview.wallet.balance_iqd) < cost.iqd) {
    return NextResponse.json(
      {
        error: 'insufficient_balance',
        code: 'insufficient_balance',
        balance_iqd: preview.wallet.balance_iqd,
        required_iqd: cost.iqd,
      },
      { status: 402 }
    );
  }

  const result = await consumeAiUsage({
    phone,
    amountIqd: cost.iqd,
    amountUsd: cost.usd,
    description: `AI Hub · ${model || 'query'}`,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || result.code, code: result.code, balance_iqd: result.balanceIqd },
      { status: result.code === 'insufficient_balance' ? 402 : 400 }
    );
  }

  return NextResponse.json({
    success: true,
    charged_iqd: cost.iqd,
    charged_usd: cost.usd,
    balance_iqd: result.wallet?.balance_iqd,
    balance_usd: Number(result.wallet?.balance_usd || 0),
  });
}
