'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, Mail, KeyRound, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Logo from '@/components/Logo';
import { useLanguage } from '@/components/LanguageProvider';

export default function LoginPage() {
  const { t, dir, isRtl, mounted } = useLanguage();
  const l = t.login;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (!supabase) {
      setErrorMsg(l.errorServer);
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setErrorMsg(l.errorAuth);
        setLoading(false);
      } else {
        router.push('/chat');
      }
    } catch {
      setErrorMsg(l.errorServer);
      setLoading(false);
    }
  };

  const iconPos = isRtl ? 'right-3' : 'left-3';
  const inputPad = isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4';

  return (
    <div
      dir={dir}
      suppressHydrationWarning
      className="min-h-screen bg-[#070913] text-white flex items-center justify-center p-4 relative overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(147,51,234,0.18),_transparent_55%)]" />
      <div
        className="pointer-events-none absolute -top-16 -start-16 w-72 h-72 rounded-full bg-emerald-700/20 blur-[100px] animate-blob"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 -end-16 w-80 h-80 rounded-full bg-emerald-700/20 blur-[100px] animate-blob"
        style={{ animationDelay: '4s' }}
        aria-hidden="true"
      />

      <div className="absolute top-5 end-5 z-10">
        <LanguageSwitcher />
      </div>

      <motion.div
        initial={false}
        animate={mounted ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md bg-slate-900/80 border border-slate-800 p-7 sm:p-8 rounded-3xl shadow-2xl shadow-emerald-950/30 backdrop-blur-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <Logo framed />
          </div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">
            {l.title}
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 font-medium">{l.subtitle}</p>
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl text-xs mb-5 text-center font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">{l.emailLabel}</label>
            <div className="relative">
              <input
                required
                type="email"
                placeholder={l.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full bg-slate-950 border border-slate-800 rounded-xl py-3 text-xs text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors ${inputPad}`}
              />
              <Mail className={`absolute top-3.5 text-slate-500 ${iconPos}`} size={16} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">{l.passwordLabel}</label>
            <div className="relative">
              <input
                required
                type="password"
                placeholder={l.passwordPlaceholder}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-slate-950 border border-slate-800 rounded-xl py-3 text-xs text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors ${inputPad}`}
              />
              <KeyRound className={`absolute top-3.5 text-slate-500 ${iconPos}`} size={16} />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:opacity-95 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 mt-2 cursor-pointer active:scale-[0.98]"
          >
            {loading ? (
              l.loadingText
            ) : (
              <>
                <Lock size={15} />
                <span>{l.btnText}</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-emerald-300 transition inline-flex items-center gap-1"
          >
            <span>{l.backToStore}</span>
            <ArrowRight className={`w-3 h-3 ${isRtl ? 'rotate-180' : ''}`} />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
