'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2,
  Mic,
  FileText,
  Sparkles,
  AlertCircle,
  Download,
  Loader2,
  ArrowRight,
  UploadCloud,
  Radio,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Logo from '@/components/Logo';
import Waveform from '@/components/Waveform';
import { useLanguage } from '@/components/LanguageProvider';

const VOICE_IDS = {
  adam: 'pNInz6obpgDQGcFmaJgB',
  rachel: '21m00Tcm4TlvDq8ikWAM',
  antoni: 'ErXwobaYiN019PkySvjV',
};

export default function VoiceHubPage() {
  const { t, dir, isRtl, mounted } = useLanguage();
  const v = t.tts;

  const [redeemCode, setRedeemCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState({ text: '', type: '' });
  const [activeTab, setActiveTab] = useState('tts');
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(VOICE_IDS.adam);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioFileName, setAudioFileName] = useState('');
  const [sttResult, setSttResult] = useState('');
  const [error, setError] = useState('');
  const [charsLeft, setCharsLeft] = useState(null);
  const [user, setUser] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const voices = [
    { id: VOICE_IDS.adam, name: v.voices.adam },
    { id: VOICE_IDS.rachel, name: v.voices.rachel },
    { id: VOICE_IDS.antoni, name: v.voices.antoni },
  ];

  useEffect(() => {
    async function fetchUserData() {
      if (!supabase) return;
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          const { data: profile } = await supabase
            .from('profiles')
            .select('tts_characters_left')
            .eq('id', session.user.id)
            .single();
          if (profile) setCharsLeft(profile.tts_characters_left);
        }
      } catch {
        /* Supabase session fetch failed — user stays null */
      }
    }
    fetchUserData().catch(() => {});
  }, []);

  const handleRedeem = async () => {
    if (!redeemCode.trim()) return;
    setRedeemLoading(true);
    setRedeemMsg({ text: '', type: '' });

    if (!user) {
      setRedeemMsg({ text: v.loginFirst, type: 'error' });
      setRedeemLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: redeemCode, userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRedeemMsg({ text: data.message, type: 'success' });
      setCharsLeft(data.newTotal);
      setRedeemCode('');
    } catch (err) {
      setRedeemMsg({ text: err.message, type: 'error' });
    } finally {
      setRedeemLoading(false);
    }
  };

  const resetOutputs = () => {
    setError('');
    setAudioUrl(null);
    setSttResult('');
    setIsPlaying(false);
  };

  const handleProcess = async () => {
    setLoading(true);
    resetOutputs();

    if (!user) {
      setError(v.loginFirst);
      setLoading(false);
      return;
    }

    try {
      if (activeTab === 'sts' || activeTab === 'stt') {
        if (!file) throw new Error(v.needAudio);

        const formData = new FormData();
        formData.append('mode', activeTab);
        formData.append('file', file);
        formData.append('userId', user.id);
        formData.append('voiceId', selectedVoice);

        const res = await fetch('/api/tts', { method: 'POST', body: formData });

        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.error || v.genericError);
        }

        if (activeTab === 'stt') {
          const data = await res.json();
          setSttResult(data.text);
        } else {
          const blob = await res.blob();
          setAudioUrl(URL.createObjectURL(blob));
          setAudioFileName(`ipbits-${activeTab}-${Date.now()}.mp3`);
        }
      } else {
        if (!text.trim()) throw new Error(v.needText);

        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: activeTab,
            text,
            voiceId: selectedVoice,
            userId: user.id,
          }),
        });

        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.error || v.genericError);
        }

        const blob = await res.blob();
        setAudioUrl(URL.createObjectURL(blob));
        setAudioFileName(`ipbits-${activeTab}-${Date.now()}.mp3`);

        if (activeTab === 'tts') {
          setCharsLeft((prev) => (prev !== null ? Math.max(0, prev - text.trim().length) : prev));
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'tts', icon: Volume2, label: v.tabTts },
    { id: 'sts', icon: Mic, label: v.tabSts },
    { id: 'stt', icon: FileText, label: v.tabStt },
    { id: 'sfx', icon: Radio, label: v.tabSfx },
  ];

  const field =
    'w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition';

  return (
    <div
      dir={dir}
      suppressHydrationWarning
      className="min-h-screen bg-[#0a0b14] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden"
    >
      <div
        className="pointer-events-none absolute -top-24 start-1/3 w-[30rem] h-[20rem] rounded-full bg-emerald-700/15 blur-[100px] animate-blob"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 end-1/4 w-[26rem] h-[18rem] rounded-full bg-emerald-700/15 blur-[100px] animate-blob"
        style={{ animationDelay: '3s' }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-2xl mb-3 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 group">
          <Logo framed compact />
        </Link>
        <LanguageSwitcher />
      </div>

      <motion.div
        initial={false}
        animate={mounted ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-2xl bg-[#0c1022]/90 border border-slate-800 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-2xl shadow-emerald-950/20 space-y-6"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative p-3 bg-emerald-600/20 text-emerald-400 rounded-2xl border border-emerald-500/20 shrink-0">
              <span className="absolute -inset-0.5 rounded-2xl bg-emerald-500/30 blur-md animate-glow-pulse" aria-hidden="true" />
              <Volume2 className="relative w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-emerald-300 to-emerald-200 bg-clip-text text-transparent">
                {v.title}
              </h1>
              <p className="text-xs text-slate-400">{v.subtitle}</p>
            </div>
          </div>
          {charsLeft !== null && (
            <div className="bg-slate-900 border border-emerald-500/30 px-3 py-1.5 rounded-full text-xs font-medium text-emerald-300 shrink-0">
              {v.charsLeft}: <span className="text-white font-bold">{charsLeft.toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="bg-slate-950/50 border border-slate-800/80 p-3.5 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-slate-300">{v.redeemTitle}</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={v.redeemPlaceholder}
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              className={`${field} flex-1 uppercase tracking-wider placeholder:normal-case`}
            />
            <button
              type="button"
              onClick={handleRedeem}
              disabled={redeemLoading || !redeemCode.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center min-w-[80px] cursor-pointer"
            >
              {redeemLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : v.redeemBtn}
            </button>
          </div>
          {redeemMsg.text && (
            <div
              className={`flex items-center gap-1.5 text-[11px] font-medium pt-1 ${
                redeemMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {redeemMsg.type === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <span>{redeemMsg.text}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  resetOutputs();
                }}
                className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-emerald-600/25 border border-emerald-500/50 text-emerald-200 shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {(activeTab === 'tts' || activeTab === 'sts') && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">{v.voiceLabel}</label>
            <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className={field}>
              {voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {(activeTab === 'tts' || activeTab === 'sfx') && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <label className="font-medium text-slate-300">{activeTab === 'tts' ? v.textLabel : v.sfxLabel}</label>
              {activeTab === 'tts' && (
                <span>
                  {text.length} {v.chars}
                </span>
              )}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={activeTab === 'tts' ? v.textPlaceholder : v.sfxPlaceholder}
              className="w-full h-32 p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition resize-none text-xs leading-relaxed"
            />
          </div>
        )}

        {(activeTab === 'sts' || activeTab === 'stt') && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">{v.audioLabel}</label>
            <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-6 text-center cursor-pointer bg-slate-950/40 transition">
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="audio-upload"
              />
              <label htmlFor="audio-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <UploadCloud className="w-8 h-8 text-emerald-400" />
                <span className="text-xs text-slate-300 font-medium">{file ? file.name : v.audioHint}</span>
                <span className="text-[10px] text-slate-500">{v.audioSize}</span>
              </label>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleProcess}
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:opacity-95 disabled:opacity-50 text-white font-semibold rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 text-xs transition active:scale-[0.99] cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{v.processing}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{v.startBtn}</span>
            </>
          )}
        </button>

        {sttResult && (
          <div className="p-4 bg-slate-900/80 border border-slate-700/60 rounded-2xl space-y-2">
            <p className="text-xs text-emerald-300 font-medium">{v.sttResult}</p>
            <p className="text-xs text-slate-200 bg-slate-950/90 p-3 rounded-xl leading-relaxed border border-slate-800 select-all">
              {sttResult}
            </p>
          </div>
        )}

        <AnimatePresence>
          {audioUrl && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-4 bg-slate-900/60 border border-emerald-500/20 rounded-2xl backdrop-blur-md space-y-3"
            >
              <p className="text-xs text-emerald-300 font-medium">{v.audioReady}</p>
              <Waveform audioRef={audioRef} active={isPlaying} />
              <audio
                ref={audioRef}
                controls
                src={audioUrl}
                className="w-full h-10 accent-emerald-500"
                autoPlay
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onError={() => setError(v.genericError || 'Audio playback error')}
                crossOrigin="anonymous"
              />
              <a
                href={audioUrl}
                download={audioFileName || `ipbits-${activeTab}.mp3`}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{v.downloadMp3}</span>
              </a>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center pt-2">
          <Link href="/" className="text-xs text-slate-500 hover:text-emerald-300 transition inline-flex items-center gap-1">
            <span>{v.backHome}</span>
            <ArrowRight className={`w-3 h-3 ${isRtl ? 'rotate-180' : ''}`} />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
