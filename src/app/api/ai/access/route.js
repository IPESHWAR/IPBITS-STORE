import { NextResponse } from 'next/server';
import { activateLicenseKey, findActiveLicenseByPhone } from '@/lib/licenseService';
import { getOrCreateWallet } from '@/lib/walletService';
import { normalizeWalletId } from '@/lib/wallet';

export async function GET(req) {
  const phone = normalizeWalletId(req.nextUrl.searchParams.get('phone') || '');
  const key = String(req.nextUrl.searchParams.get('key') || '').trim();

  let license = null;
  if (key) {
    const vip = await activateLicenseKey({ keyCode: key, phone }).catch(() => ({ ok: false }));
    if (vip.ok) license = vip.license;
  }
  if (!license && phone) {
    const found = await findActiveLicenseByPhone(phone).catch(() => ({ ok: false }));
    if (found.ok) license = found.license;
  }

  let balanceIqd = 0;
  if (phone) {
    const wallet = await getOrCreateWallet(phone);
    if (wallet.ok) balanceIqd = Number(wallet.wallet.balance_iqd || 0);
  }

  return NextResponse.json({
    subscribed: !!license,
    license,
    balance_iqd: balanceIqd,
  });
}
