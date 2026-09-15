'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  User,
  Sparkles,
  Loader2,
  Image as ImageIcon,
  X,
  Paperclip,
  Check,
  Copy,
  Download,
  Code2,
  FileText,
} from 'lucide-react';
import ChatHeader from '@/components/ChatHeader';
import FreeModelPicker from '@/components/FreeModelPicker';
import ChatAccessGate from '@/components/ChatAccessGate';
import CreditRedeemModal from '@/components/CreditRedeemModal';
import { useLanguage } from '@/components/LanguageProvider';
import { useUser } from '@/components/UserProvider';
import {
  getAccessCredits,
  isLicenseActive,
  readLicenseSession,
  writeLicenseSession,
} from '@/lib/licenseSession';
import { deductVipPoints, getVipPoints } from '@/lib/vipPoints';

const FALLBACK_DEFAULT = 'meta-llama/llama-3.2-3b-instruct:free';
const MAX_ATTACHMENT_TEXT = 120_000;

const TEXT_FILE_RE =
  /\.(txt|md|markdown|json|csv|js|jsx|ts|tsx|py|html|css|sql|env|php|cpp|c|h|java|xml|yml|yaml|log|rtf)$/i;
const IMAGE_FILE_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageFile(file) {
  if (!file) return false;
  if (file.type?.startsWith('image/')) return true;
  return IMAGE_FILE_RE.test(file.name || '');
}

function isTextExtractable(file) {
  if (!file) return false;
  if (file.type?.startsWith('text/')) return true;
  if (
    file.type === 'application/json' ||
    file.type === 'application/javascript' ||
    file.type === 'application/xml'
  ) {
    return true;
  }
  return TEXT_FILE_RE.test(file.name || '');
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function AttachmentChip({ attachment, onRemove, removeLabel = 'Remove' }) {
  if (!attachment) return null;
  const Icon = attachment.kind === 'image' ? ImageIcon : FileText;
  return (
    <div className="max-w-3xl mx-auto mb-2">
      <div className="inline-flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.05] pl-2.5 pr-1.5 py-1.5 backdrop-blur-md shadow-lg max-w-full">
        {attachment.kind === 'image' && attachment.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attachment.previewUrl}
            alt=""
            className="h-9 w-9 rounded-lg object-cover border border-white/10 shrink-0"
          />
        ) : (
          <span className="h-9 w-9 rounded-lg bg-sky-500/15 border border-sky-400/20 text-sky-300 flex items-center justify-center shrink-0">
            <Icon size={16} strokeWidth={1.75} />
          </span>
        )}
        <div className="min-w-0 flex flex-col leading-tight pe-1">
          <span className="text-[12px] font-medium text-white/90 truncate max-w-[14rem] sm:max-w-[20rem]">
            {attachment.name}{' '}
            <span className="font-normal text-white/45">({formatFileSize(attachment.size)})</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded-xl text-white/45 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function DocumentCard({ attachment }) {
  if (!attachment) return null;

  if (attachment.kind === 'image' && attachment.previewUrl) {
    return (
      <div className="mb-2.5 space-y-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.previewUrl}
          alt={attachment.name || 'Uploaded'}
          className="max-w-full max-h-52 rounded-xl border border-white/10 object-cover"
        />
        <div className="inline-flex items-center gap-1.5 text-[10px] text-white/50">
          <ImageIcon size={11} className="shrink-0" />
          <span className="truncate max-w-[14rem]">{attachment.name}</span>
          <span className="tabular-nums">({formatFileSize(attachment.size)})</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2.5 inline-flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 max-w-full">
      <span className="h-10 w-10 rounded-lg bg-white/[0.06] border border-white/10 text-white/70 flex items-center justify-center shrink-0">
        <FileText size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-white/90 truncate max-w-[12rem] sm:max-w-[16rem]">
          {attachment.name}
        </p>
        <p className="text-[10px] text-white/45 tabular-nums">{formatFileSize(attachment.size)}</p>
      </div>
    </div>
  );
}

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);
  const cleanLang = (language || 'code').trim().toLowerCase();

  const getExtension = (lang) => {
    switch (lang) {
      case 'html':
        return 'html';
      case 'js':
      case 'javascript':
        return 'js';
      case 'jsx':
        return 'jsx';
      case 'ts':
      case 'typescript':
        return 'ts';
      case 'tsx':
        return 'tsx';
      case 'css':
        return 'css';
      case 'python':
      case 'py':
        return 'py';
      case 'sql':
        return 'sql';
      case 'json':
        return 'json';
      case 'php':
        return 'php';
      case 'cpp':
      case 'c++':
        return 'cpp';
      case 'c':
        return 'c';
      case 'java':
        return 'java';
      default:
        return 'txt';
    }
  };

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownload = () => {
    try {
      const ext = getExtension(cleanLang);
      const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `code-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div
      className="my-3 rounded-2xl overflow-hidden border border-white/10 bg-[#0a0c12] font-mono text-xs shadow-xl text-left"
      dir="ltr"
    >
      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/[0.08] text-white/50">
        <div className="flex items-center gap-2">
          <Code2 className="text-sky-300/80" size={14} />
          <span className="uppercase text-[11px] font-semibold text-white/70">{cleanLang}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 bg-white/[0.05] hover:bg-white/[0.09] text-white/80 rounded-lg transition active:scale-95 cursor-pointer"
          >
            {copied ? <Check className="text-emerald-400" size={13} /> : <Copy size={13} />}
            <span className="text-[10px]">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1 px-2.5 py-1 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 border border-sky-400/20 rounded-lg transition active:scale-95 cursor-pointer"
          >
            <Download size={13} />
            <span className="text-[10px]">.{getExtension(cleanLang)}</span>
          </button>
        </div>
      </div>
      <pre className="p-4 overflow-x-auto text-white/80 leading-relaxed font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderMessageContent(content) {
  if (typeof content !== 'string') return content;
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part && part.startsWith('```') && part.endsWith('```')) {
      const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
      const language = match ? match[1] || 'code' : 'code';
      const code = match ? match[2].trim() : part.slice(3, -3).trim();
      return <CodeBlock key={index} code={code} language={language} />;
    }
    return (
      <span key={index} className="whitespace-pre-wrap leading-relaxed">
        {part}
      </span>
    );
  });
}

export default function ChatPage() {
  const { lang, t, isRtl, dir } = useLanguage();
  const { balanceIqd, identify } = useUser();
  const c = t.chat || {};
  const common = t.common || {};

  const [messages, setMessages] = useState([]);
  const [welcomeSeeded, setWelcomeSeeded] = useState(false);
  const [input, setInput] = useState('');
  const [model, setModel] = useState(FALLBACK_DEFAULT);
  const [freeModels, setFreeModels] = useState([]);
  const [paidModels, setPaidModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [license, setLicense] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [gateKeyHint, setGateKeyHint] = useState('');
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [toast, setToast] = useState('');

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const codeFileInputRef = useRef(null);
  const toastTimer = useRef(null);

  const credits = useMemo(() => getAccessCredits(license), [license]);
  const vipPoints = useMemo(() => getVipPoints(license), [license]);
  const accessUnlocked =
    Number(balanceIqd || 0) > 0 || (credits > 0 && vipPoints > 0);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3200);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    const session = readLicenseSession();
    if (session?.key_code) {
      // Persist derived VIP points for older sessions
      const saved = writeLicenseSession(session);
      setLicense(saved);
      setHasSession(true);
      if (saved.customer_phone) {
        identify(saved.customer_phone).catch(() => null);
      }
      if (!isLicenseActive(saved)) {
        setRedeemOpen(true);
      }
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = String(params.get('key') || '').trim();
      if (fromQuery) setGateKeyHint(fromQuery.toUpperCase());
    } catch {
      /* ignore */
    }
    setAuthReady(true);
  }, [identify]);

  // Expire → locked in real time while the tab is open
  useEffect(() => {
    if (!hasSession || !license?.expires_at) return undefined;
    const tick = () => {
      const next = readLicenseSession();
      if (!next) return;
      setLicense(next);
      if (!isLicenseActive(next)) setRedeemOpen(true);
    };
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [hasSession, license?.expires_at]);

  useEffect(() => {
    if (!hasSession || !c.welcome) return;
    if (!welcomeSeeded) {
      setMessages([{ role: 'assistant', content: c.welcome }]);
      setWelcomeSeeded(true);
      return;
    }
    // Keep the greeting in sync when language changes (single welcome bubble).
    setMessages((prev) => {
      if (prev.length === 1 && prev[0]?.role === 'assistant') {
        return [{ role: 'assistant', content: c.welcome }];
      }
      return prev;
    });
  }, [c.welcome, hasSession, welcomeSeeded, lang]);

  useEffect(() => {
    if (!hasSession) return undefined;

    let cancelled = false;
    setLoadingModels(true);

    fetch('/api/models')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const frees = Array.isArray(data?.free) ? data.free : [];
        const paids = Array.isArray(data?.paid) ? data.paid : [];
        setFreeModels(frees);
        setPaidModels(paids);

        const preferred = data?.defaultModel || FALLBACK_DEFAULT;
        const all = [...frees, ...paids];
        if (all.some((m) => m.id === preferred)) {
          setModel(preferred);
        } else if (frees[0]?.id) {
          setModel(frees[0].id);
        }
      })
      .catch((err) => {
        console.error('Error fetching models:', err);
        if (!cancelled) {
          setFreeModels([
            {
              id: FALLBACK_DEFAULT,
              name: 'Llama 3.2 3B Instruct',
              tier: 'free',
              provider: 'Meta',
            },
          ]);
          setModel(FALLBACK_DEFAULT);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasSession]);

  useEffect(() => {
    if (!hasSession) return;
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, hasSession]);

  const pickerLabels = useMemo(
    () => ({
      freeModelsCount: c.freeModelsCount,
      freeBadge: c.freeBadge,
      searchModels: c.searchModels,
      premiumModelsSection: c.premiumModelsSection || c.premiumModels,
      autoRouterName: c.autoRouterName,
      loadingModels: c.loadingModels,
      paidLocked: c.paidLocked,
    }),
    [c]
  );

  const applyLicense = (lic, { toastSuccess = false } = {}) => {
    const saved = writeLicenseSession(lic);
    setLicense(saved);
    setHasSession(true);
    setRedeemOpen(false);
    if (saved?.customer_phone) {
      identify(saved.customer_phone).catch(() => null);
    }
    if (toastSuccess) showToast(c.activateSuccess || '');
  };

  const handleUnlocked = (lic) => {
    applyLicense(lic, { toastSuccess: true });
  };

  const openRedeem = () => setRedeemOpen(true);

  if (!authReady) {
    return (
      <div className="min-h-screen w-full bg-[#07090e]" aria-busy="true" aria-label="Loading" />
    );
  }

  if (!hasSession) {
    return <ChatAccessGate onUnlocked={handleUnlocked} initialKey={gateKeyHint} />;
  }

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAttachment({
        kind: 'image',
        name: file.name,
        size: file.size,
        mime: file.type || 'image/*',
        previewUrl: dataUrl,
        dataUrl,
      });
    } catch {
      showToast(c.attachError || 'Attachment failed');
    }
  };

  const handleCodeFileUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      if (isImageFile(file)) {
        const dataUrl = await readFileAsDataUrl(file);
        setAttachment({
          kind: 'image',
          name: file.name,
          size: file.size,
          mime: file.type || 'image/*',
          previewUrl: dataUrl,
          dataUrl,
        });
        return;
      }

      let text = '';
      if (isTextExtractable(file)) {
        text = await readFileAsText(file);
        if (text.length > MAX_ATTACHMENT_TEXT) {
          text = `${text.slice(0, MAX_ATTACHMENT_TEXT)}\n\n…[truncated]`;
        }
      } else {
        // PDF / DOCX / other binary — keep chip only; payload notes the attachment
        text = '';
      }

      setAttachment({
        kind: 'file',
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
        text,
      });
    } catch {
      showToast(c.attachError || 'Attachment failed');
    }
  };

  const clearAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (codeFileInputRef.current) codeFileInputRef.current.value = '';
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if ((!input.trim() && !attachment) || loading) return;

    // Real-time credit / VIP points guard — block API before any completion call
    if (credits <= 0 || vipPoints <= 0 || !accessUnlocked) {
      openRedeem();
      return;
    }

    const userText = input.trim();
    const currentAttachment = attachment;

    const displayAttachment = currentAttachment
      ? {
          kind: currentAttachment.kind,
          name: currentAttachment.name,
          size: currentAttachment.size,
          mime: currentAttachment.mime,
          previewUrl:
            currentAttachment.kind === 'image'
              ? currentAttachment.previewUrl || currentAttachment.dataUrl
              : undefined,
        }
      : null;

    let apiContent = userText;
    if (currentAttachment?.kind === 'file') {
      const header = `${c.fileHeader || '[File: '}${currentAttachment.name}]`;
      const body = currentAttachment.text
        ? `${header}\n\`\`\`\n${currentAttachment.text}\n\`\`\``
        : `${header}\n(${formatFileSize(currentAttachment.size)} — binary attachment; respond using the user prompt and filename context.)`;
      apiContent = userText ? `${userText}\n\n${body}` : body;
    } else if (currentAttachment?.kind === 'image' && !userText) {
      apiContent = c.analyzePrompt || 'Analyze this image:';
    }

    const userMsg = {
      role: 'user',
      content: userText,
      apiContent,
      attachment: displayAttachment,
      image: currentAttachment?.kind === 'image' ? currentAttachment.dataUrl : null,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    clearAttachment();
    setLoading(true);

    try {
      const apiMessages = newMessages.map((m) => {
        if (m.image) {
          return {
            role: m.role,
            content: [
              {
                type: 'text',
                text: m.apiContent || m.content || c.analyzePrompt || 'Analyze this image:',
              },
              { type: 'image_url', image_url: { url: m.image } },
            ],
          };
        }

        return {
          role: m.role,
          content: m.apiContent || m.content,
        };
      });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          model: model || FALLBACK_DEFAULT,
          userEmail: license?.customer_email || license?.customer_phone || null,
        }),
      });

      const data = await res.json();

      if (res.ok && (data.reply || data.choices?.[0]?.message?.content)) {
        const replyText = data.reply || data.choices[0].message.content;
        const spent = Math.max(0, Math.round(Number(data.points_spent) || 0));

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: replyText,
            pointsSpent: spent,
            modelUsed: model || FALLBACK_DEFAULT,
          },
        ]);

        if (spent > 0)  {
          setLicense((prev) => {
            const nextLic = deductVipPoints(prev, spent);
            if (!nextLic) return prev;
            const saved = writeLicenseSession(nextLic);
            if (getVipPoints(saved) <= 0) {
              queueMicrotask(() => setRedeemOpen(true));
            }
            return saved;
          });
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: (c.errorPrefix || '') + (data.error || c.errorDefault || 'Error'),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: c.errorConnection || 'Connection error' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir={dir || (isRtl ? 'rtl' : 'ltr')}
      className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#090a0f] text-white flex flex-col justify-between font-sans selection:bg-sky-500/30"
    >
      <ChatHeader
        backHref="/"
        backLabel={common.navBackToStore || 'Back'}
        vipPoints={vipPoints}
        pointsLabel={c.vipPointsLabel || 'خاڵ'}
        lang={lang}
        onlineLabel={lang === 'en' ? 'Online' : lang === 'ar' ? 'متصل' : 'ئۆنلاین'}
        modelPicker={
          loadingModels ? (
            <div className="h-8 px-2.5 rounded-full border border-white/10 bg-white/[0.04] text-xs font-mono text-white/50 flex items-center gap-1.5 backdrop-blur-md">
              <Loader2 size={12} className="animate-spin text-white/50" />
              <span>..</span>
            </div>
          ) : (
            <FreeModelPicker
              model={model}
              freeModels={freeModels}
              paidModels={paidModels}
              onChange={setModel}
              labels={pickerLabels}
              lang={lang}
              premiumUnlocked={accessUnlocked}
              onRequireUnlock={openRedeem}
            />
          )
        }
      />

      {toast ? (
        <div className="pointer-events-none fixed top-16 inset-x-0 z-[110] flex justify-center px-4">
          <div className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-200 shadow-lg backdrop-blur-md">
            {toast}
          </div>
        </div>
      ) : null}

      <CreditRedeemModal
        open={redeemOpen || !accessUnlocked}
        onClose={() => {
          if (accessUnlocked) setRedeemOpen(false);
        }}
        onRedeemed={(lic) => applyLicense(lic, { toastSuccess: true })}
        closable={accessUnlocked}
      />

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5 max-w-3xl w-full mx-auto">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 max-w-full ${m.role === 'user' ? 'flex-row' : 'flex-row-reverse'}`}
          >
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 border ${
                m.role === 'user'
                  ? 'bg-white/[0.08] border-white/10 text-white/80'
                  : 'bg-white/[0.04] border-white/[0.08] text-white/60'
              }`}
            >
              {m.role === 'user' ? (
                <User size={14} />
              ) : (
                <Sparkles size={14} className="text-sky-300/80" />
              )}
            </div>

            <div
              className={`px-3.5 py-3 sm:px-4 sm:py-3.5 rounded-2xl max-w-[85%] sm:max-w-[80%] text-[13px] sm:text-sm leading-relaxed overflow-hidden break-words whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-white/[0.08] border border-white/10 text-white/90 rounded-br-md'
                  : 'bg-transparent text-white/70 rounded-bl-md'
              }`}
            >
              {m.attachment ? (
                <DocumentCard attachment={m.attachment} />
              ) : m.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.image}
                  alt="Uploaded Asset"
                  className="max-w-full max-h-52 rounded-xl mb-2.5 border border-white/10 object-cover"
                />
              ) : null}

              {m.content ? (
                typeof m.content === 'string' &&
                (m.content.includes('![AI Image]') ||
                  m.content.includes('image.pollinations.ai') ||
                  m.content.startsWith('http://') ||
                  m.content.startsWith('https://')) &&
                (m.content.includes('.jpg') ||
                  m.content.includes('.png') ||
                  m.content.includes('pollinations.ai')) ? (
                  <div className="space-y-2 max-w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.content.replace('![AI Image](', '').replace(')', '').trim()}
                      alt="AI Generated"
                      className="rounded-2xl max-w-full w-full border border-white/10 shadow-xl object-cover"
                    />
                    <span className="text-[10px] text-white/45 block">{c.imageCreated}</span>
                  </div>
                ) : (
                  <div className="max-w-full overflow-x-auto">{renderMessageContent(m.content)}</div>
                )
              ) : m.attachment && !m.content ? (
                <span className="text-white/45 text-xs italic">{c.attachedOnly || ''}</span>
              ) : null}

              {/* نیشاندانا مۆدێل و خاڵێن مەسرەفبووی بۆ کڕیاری */}
              {m.role === 'assistant' && (m.pointsSpent !== undefined || m.modelUsed) && (
                <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-center gap-2 text-[10px] text-white/40 select-none">
                  {m.modelUsed && (
                    <span className="truncate max-w-[10rem] font-mono text-white/50 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.05]">
                      {m.modelUsed.split('/').pop()?.replace(':free', '')}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-emerald-400/90 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    <Sparkles size={10} />
                    {m.pointsSpent > 0 ? `-${m.pointsSpent} ${c.vipPointsLabel || 'خاڵ'}` : 'بێ بەرامبەر'}
                  </span>
                </div>
              )}
        
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-3 flex-row-reverse">
            <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="IPBITS AI"
                className="w-full h-full object-contain rounded-full animate-pulse"
              />
            </div>

            <div className="bg-white/[0.03] border border-white/[0.08] px-3.5 py-2 rounded-2xl text-xs text-white/55 flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400/70 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-400" />
              </span>
              <span>{c.thinking}</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </main>

      <footer className="sticky bottom-0 z-20 w-full px-3 sm:px-4 pb-3 sm:pb-4 pt-2 bg-gradient-to-t from-[#090a0f] via-[#090a0f]/95 to-transparent">
        <AttachmentChip
          attachment={attachment}
          onRemove={clearAttachment}
          removeLabel={c.removeAttachment || 'Remove'}
        />

        <form
          onSubmit={handleSend}
          className="max-w-3xl mx-auto flex items-center gap-2 bg-[#10131c]/80 border border-white/10 focus-within:border-white/25 rounded-2xl backdrop-blur-xl shadow-2xl px-2 py-1.5 sm:px-2.5 sm:py-2 transition-colors"
        >
          <input
            type="file"
            accept=".js,.jsx,.ts,.tsx,.py,.html,.css,.json,.txt,.sql,.md,.env,.php,.cpp,.c,.java,.pdf,.docx,.doc,.csv,.xml,.yml,.yaml,.log,.rtf,image/*"
            ref={codeFileInputRef}
            onChange={handleCodeFileUpload}
            className="hidden"
            disabled={!accessUnlocked}
          />
          <button
            type="button"
            onClick={() => {
              if (!accessUnlocked) {
                openRedeem();
                return;
              }
              codeFileInputRef.current?.click();
            }}
            className="text-white/45 hover:text-white/80 hover:bg-white/[0.06] p-2.5 rounded-xl transition-all shrink-0 cursor-pointer"
            title={c.uploadFileTitle}
          >
            <Paperclip size={16} />
          </button>

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
            disabled={!accessUnlocked}
          />
          <button
            type="button"
            onClick={() => {
              if (!accessUnlocked) {
                openRedeem();
                return;
              }
              fileInputRef.current?.click();
            }}
            className="text-white/45 hover:text-white/80 hover:bg-white/[0.06] p-2.5 rounded-xl transition-all shrink-0 cursor-pointer"
            title={c.uploadImageTitle}
          >
            <ImageIcon size={16} />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => {
              if (!accessUnlocked) openRedeem();
            }}
            placeholder={accessUnlocked ? c.inputPlaceholder : c.lockedInputPlaceholder}
            disabled={!accessUnlocked}
            className="flex-1 bg-transparent px-1 sm:px-2 py-2 text-[13px] text-white/90 placeholder-white/35 focus:outline-none min-w-0 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!accessUnlocked || (!input.trim() && !attachment) || loading}
            title={c.sendTooltip || c.sendBtn}
            aria-label={c.sendTooltip || c.sendBtn}
            className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-lg shadow-sky-500/20 hover:brightness-110 disabled:opacity-35 disabled:hover:brightness-100 transition-all cursor-pointer"
          >
            <Send size={15} className={isRtl ? 'transform rotate-180' : ''} />
          </button>
        </form>
      </footer>
    </div>
  );
}
