'use client';

import React, { useState } from 'react';

/** Local /public assets first; Simple Icons CDN for the rest. */
const BRAND_LOGO_SRC = {
  canva: '/canva.png',
  capcut: '/capcut-logo.webp',
  kling: '/kling.png',
  higgsfield: '/higgsfield-seeklogo.svg',
  claude: '/claude.png',
  shahid: '/shahid.png',
  paypal: '/paypal.png',
  elevenlabs: '/ElevenLabs_logo_(2022-2024).png',
  apple_gift: '/apple-gift-card.svg',
  ipbits: '/logo.png',
  google: 'https://cdn.simpleicons.org/google',
  netflix: 'https://cdn.simpleicons.org/netflix/E50914',
  spotify: 'https://cdn.simpleicons.org/spotify/1DB954',
  apple: 'https://cdn.simpleicons.org/apple/A2AAAD',
  youtube: 'https://cdn.simpleicons.org/youtube/FF0000',
  playstation: 'https://cdn.simpleicons.org/playstation/003791',
  default: '/logo.png',
};

const LOGO_IMG = 'w-6 h-6 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]';

function SvgShell({ label, className = '', children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      className={className || LOGO_IMG}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

/** Official OpenAI mark */
function OpenAiMark({ className = '' }) {
  return (
    <SvgShell label="OpenAI" className={className}>
      <path
        fill="#10A37F"
        d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.499 4.499 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"
      />
    </SvgShell>
  );
}

/** Google Gemini spark mark */
function GeminiMark({ className = '' }) {
  return (
    <SvgShell label="Gemini" className={className}>
      <path
        fill="#8E75B2"
        d="M12 0C12 6.627 6.627 12 0 12c6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12z"
      />
    </SvgShell>
  );
}

/** Midjourney mark — clean geometric M */
function MidjourneyMark({ className = '' }) {
  return (
    <SvgShell label="Midjourney" className={className}>
      <path
        fill="currentColor"
        className="text-zinc-800 dark:text-white"
        d="M12 2.5 3.5 21h3.2l1.7-3.7h7.2L17.3 21h3.2L12 2.5zm0 5.1 2.5 5.5h-5L12 7.6z"
      />
    </SvgShell>
  );
}

/** Perplexity asterisk mark */
function PerplexityMark({ className = '' }) {
  return (
    <SvgShell label="Perplexity" className={className}>
      <path
        fill="#20808D"
        d="M12 2.2 9.85 9.85 2.2 12l7.65 2.15L12 21.8l2.15-7.65L21.8 12l-7.65-2.15L12 2.2zm0 4.6 1.15 4.05L17.2 12l-4.05 1.15L12 17.2l-1.15-4.05L6.8 12l4.05-1.15L12 6.8z"
      />
    </SvgShell>
  );
}

const SVG_MARKS = {
  openai: OpenAiMark,
  gemini: GeminiMark,
  midjourney: MidjourneyMark,
  perplexity: PerplexityMark,
};

export default function BrandIcon({ type = 'default', alt = 'Brand', className = '' }) {
  const [failed, setFailed] = useState(false);
  const imgClass = `${LOGO_IMG} ${className}`.trim();

  const SvgMark = SVG_MARKS[type];
  if (SvgMark) {
    return <SvgMark className={imgClass} />;
  }

  const src = failed ? '/logo.png' : BRAND_LOGO_SRC[type] || BRAND_LOGO_SRC.default;
  const themedImgClass =
    type === 'kling' ? `${imgClass} brightness-0 dark:brightness-100`.trim() : imgClass;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={themedImgClass}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
