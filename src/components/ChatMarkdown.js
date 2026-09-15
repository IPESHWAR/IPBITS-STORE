'use client';

import React from 'react';
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
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="chat-md-link">$1</a>');
}

function Inline({ text }) {
  return <span dangerouslySetInnerHTML={{ __html: formatInline(text) }} />;
}

export default function ChatMarkdown({ content }) {
  if (typeof content !== 'string' || !content) return null;

  const chunks = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="chat-md space-y-2.5 leading-7 text-start break-words [&_.chat-md-inline]:rounded [&_.chat-md-inline]:bg-slate-950 [&_.chat-md-inline]:px-1.5 [&_.chat-md-inline]:py-0.5 [&_.chat-md-inline]:font-mono [&_.chat-md-inline]:text-[11px] [&_.chat-md-link]:text-teal-300 [&_.chat-md-link]:underline">
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

          const image = trimmed.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
          if (image) {
            return (
              <img
                key={`img-${idx}-${bi}`}
                src={image[2]}
                alt={image[1] || 'AI'}
                className="rounded-2xl max-w-full border border-emerald-500/30 shadow-lg"
              />
            );
          }

          if (/^#{1,3}\s/.test(trimmed)) {
            const level = trimmed.match(/^(#{1,3})/)[1].length;
            const Tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5';
            return (
              <Tag key={`h-${idx}-${bi}`} className="font-black text-white">
                <Inline text={trimmed.replace(/^#{1,3}\s+/, '')} />
              </Tag>
            );
          }

          if (trimmed.startsWith('> ')) {
            return (
              <blockquote
                key={`q-${idx}-${bi}`}
                className="border-s-2 border-emerald-400/60 ps-3 text-slate-300"
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
