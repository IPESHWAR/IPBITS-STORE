'use client';

import React, { useMemo, useState } from 'react';
import { Check, Code2, Copy, Download } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import { useLanguage } from '@/components/LanguageProvider';

function getPrismLanguage(lang) {
  switch (lang) {
    case 'html':
      return 'markup';
    case 'js':
    case 'javascript':
      return 'javascript';
    case 'jsx':
      return 'jsx';
    case 'ts':
    case 'typescript':
      return 'typescript';
    case 'tsx':
      return 'tsx';
    case 'css':
      return 'css';
    case 'python':
    case 'py':
      return 'python';
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
      return null;
  }
}

function getExtension(lang) {
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
}

export default function CodeBlock({ code, language }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const cleanLang = (language || 'code').trim().toLowerCase();

  const highlightedHtml = useMemo(() => {
    const prismLang = getPrismLanguage(cleanLang);
    const grammar = prismLang && Prism.languages[prismLang];
    if (!grammar) return null;
    try {
      return Prism.highlight(code, grammar, prismLang);
    } catch {
      return null;
    }
  }, [code, cleanLang]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
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
    <div className="my-3 rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950 font-mono text-xs shadow-xl text-left" dir="ltr">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-slate-400">
        <div className="flex items-center gap-2">
          <Code2 className="text-emerald-400" size={14} />
          <span className="uppercase text-[11px] font-bold text-emerald-300">{cleanLang}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            {copied ? <Check className="text-emerald-400" size={13} /> : <Copy size={13} />}
            <span className="text-[10px]">{copied ? t.common.copied : t.common.copy}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/30 rounded-lg transition active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <Download size={13} />
            <span className="text-[10px]">.{getExtension(cleanLang)}</span>
          </button>
        </div>
      </div>
      <pre className="p-4 overflow-x-auto text-slate-200 leading-relaxed font-mono">
        {highlightedHtml ? (
          <code
            className={`language-${getPrismLanguage(cleanLang)}`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <code>{code}</code>
        )}
      </pre>
    </div>
  );
}
