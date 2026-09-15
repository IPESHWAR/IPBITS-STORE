'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Legacy /hub entry — soft-redirect into the live AI workspace (`/chat`)
 * so navbar and old bookmarks never land on a dead lock screen.
 */
export default function HubPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/chat');
  }, [router]);

  return (
    <div className="min-h-screen w-full bg-[#0a0b14] text-white flex flex-col items-center justify-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-400" aria-hidden="true" />
      <p className="text-xs text-zinc-400">AI Hub…</p>
    </div>
  );
}
