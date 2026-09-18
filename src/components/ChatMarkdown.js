'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Expand, X } from 'lucide-react';
import CodeBlock from '@/components/CodeBlock';

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatInline(text) {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/`([^`]+)`/g, '<code class="chat-md-inline">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+|data:image\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-md-link">$1</a>'
    );
}

function Inline({ text }) {
  return <span dangerouslySetInnerHTML={{ __html: formatInline(text) }} />;
}

const MD_IMAGE_RE = /^!\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=\s]+)\)$/;
const BARE_IMAGE_URL_RE =
  /^(https?:\/\/[^\s]+\.(?:png|jpe?g|gif|webp|bmp)(?:\?[^\s]*)?|https?:\/\/image\.pollinations\.ai\/[^\s]+|data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=\s]+)$/i;

export function ChatImagePreview({ src, alt = 'AI Image', caption }) {
  const [zoomed, setZoomed] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!zoomed) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setZoomed(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [zoomed]);

  const cleanSrc = String(src || '').trim();
  if (!cleanSrc) return null;

  return (
    <>
      <figure className="group relative my-1 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-md dark:border-white/10 dark:bg-white/[0.03] dark:shadow-black/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cleanSrc}
          alt={alt}
          loading="lazy"
          className="block w-full max-h-[min(70vh,28rem)] object-contain bg-slate-100 dark:bg-black/40 cursor-zoom-in"
          onClick={() => setZoomed(true)}
        />
        <button
          type="button"
          onClick={() => setZoomed(true)}
          className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/55 px-2 py-1 text-[10px] font-medium text-white opacity-90 backdrop-blur-sm transition hover:bg-black/70 cursor-pointer"
          aria-label="Zoom image"
        >
          <Expand size={12} />
        </button>
        {caption ? (
          <figcaption className="border-t border-slate-200/80 px-3 py-1.5 text-[10px] text-slate-600 dark:border-white/10 dark:text-white/45">
            {caption}
          </figcaption>
        ) : null}
      </figure>

      {portalReady && zoomed
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              onClick={() => setZoomed(false)}
            >
              <button
                type="button"
                className="absolute top-4 end-4 rounded-full border border-white/20 bg-white/10 p-2 text-white hover:bg-white/20 cursor-pointer"
                onClick={() => setZoomed(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cleanSrc}
                alt={alt}
                className="max-h-[92vh] max-w-[96vw] rounded-xl object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>,
            document.body
          )
        : null}
    </>
  );
}

/** Extract markdown / bare image URLs from assistant content. */
export function extractImageSources(content) {
  const text = String(content || '');
  const found = [];
  const mdRe = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=\s]+)\)/g;
  let match;
  while ((match = mdRe.exec(text)) !== null) {
    found.push({ alt: match[1] || 'AI Image', src: match[2].replace(/\s+/g, '') });
  }
  if (!found.length && BARE_IMAGE_URL_RE.test(text.trim())) {
    found.push({ alt: 'AI Image', src: text.trim() });
  }
  return found;
}

export default function ChatMarkdown({ content, imageCaption }) {
  if (typeof content !== 'string' || !content) return null;

  const chunks = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="chat-md space-y-2.5 leading-7 text-start break-words [&_.chat-md-inline]:rounded [&_.chat-md-inline]:bg-slate-950 [&_.chat-md-inline]:px-1.5 [&_.chat-md-inline]:py-0.5 [&_.chat-md-inline]:font-mono [&_.chat-md-inline]:text-[11px] [&_.chat-md-link]:text-teal-600 [&_.chat-md-link]:underline dark:[&_.chat-md-link]:text-teal-300">
      {chunks.map((chunk, idx) => {
        if (chunk.startsWith('```') && chunk.endsWith('```')) {
          const match = chunk.match(/```(\w+)?\n?([\s\S]*?)```/);
          const language = match ? match[1] || 'code' : 'code';
          const code = match ? match[2].replace(/\n$/, '') : chunk.slice(3, -3);
          return <CodeBlock key={`code-${idx}`} code={code} language={language} />;
        }

        return chunk.split(/\n{2,}/).map((block, bi) => {
          const trimmed = block.trim();
          if (!trimmed) return null;

          const image = trimmed.match(MD_IMAGE_RE);
          if (image) {
            return (
              <ChatImagePreview
                key={`img-${idx}-${bi}`}
                src={image[2].replace(/\s+/g, '')}
                alt={image[1] || 'AI'}
                caption={imageCaption}
              />
            );
          }

          if (BARE_IMAGE_URL_RE.test(trimmed)) {
            return (
              <ChatImagePreview
                key={`img-bare-${idx}-${bi}`}
                src={trimmed}
                alt="AI"
                caption={imageCaption}
              />
            );
          }

          // Inline markdown images mixed with text
          if (/!\[[^\]]*\]\((https?:\/\/|data:image\/)/.test(trimmed)) {
            const parts = [];
            let last = 0;
            const inlineRe =
              /!\[([^\]]*)\]\((https?:\/\/[^\s)]+|data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=\s]+)\)/g;
            let m;
            let key = 0;
            while ((m = inlineRe.exec(trimmed)) !== null) {
              if (m.index > last) {
                parts.push(
                  <p key={`t-${idx}-${bi}-${key++}`} className="whitespace-pre-wrap">
                    <Inline text={trimmed.slice(last, m.index)} />
                  </p>
                );
              }
              parts.push(
                <ChatImagePreview
                  key={`i-${idx}-${bi}-${key++}`}
                  src={m[2].replace(/\s+/g, '')}
                  alt={m[1] || 'AI'}
                  caption={imageCaption}
                />
              );
              last = m.index + m[0].length;
            }
            if (last < trimmed.length) {
              parts.push(
                <p key={`t-${idx}-${bi}-${key++}`} className="whitespace-pre-wrap">
                  <Inline text={trimmed.slice(last)} />
                </p>
              );
            }
            return <div key={`mix-${idx}-${bi}`}>{parts}</div>;
          }

          if (/^#{1,3}\s/.test(trimmed)) {
            const level = trimmed.match(/^(#{1,3})/)[1].length;
            const Tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5';
            return (
              <Tag
                key={`h-${idx}-${bi}`}
                className="font-black text-slate-900 dark:text-white"
              >
                <Inline text={trimmed.replace(/^#{1,3}\s+/, '')} />
              </Tag>
            );
          }

          if (trimmed.startsWith('> ')) {
            return (
              <blockquote
                key={`q-${idx}-${bi}`}
                className="border-s-2 border-emerald-500/60 ps-3 text-slate-600 dark:border-emerald-400/60 dark:text-slate-300"
              >
                <Inline text={trimmed.replace(/^>\s?/gm, '')} />
              </blockquote>
            );
          }

          if (/^(\s*[-*]\s|\s*\d+\.\s)/.test(trimmed)) {
            const items = trimmed.split('\n').filter(Boolean);
            const ordered = /^\s*\d+\.\s/.test(items[0]);
            const List = ordered ? 'ol' : 'ul';
            return (
              <List
                key={`l-${idx}-${bi}`}
                className={`ps-5 space-y-1 ${ordered ? 'list-decimal' : 'list-disc'}`}
              >
                {items.map((item, li) => (
                  <li key={li}>
                    <Inline text={item.replace(/^\s*(?:[-*]|\d+\.)\s+/, '')} />
                  </li>
                ))}
              </List>
            );
          }

          return (
            <p key={`p-${idx}-${bi}`} className="whitespace-pre-wrap">
              <Inline text={trimmed} />
            </p>
          );
        });
      })}
    </div>
  );
}
