'use client';

import React from 'react';
import {
  siAnthropic,
  siApple,
  siApplemusic,
  siElevenlabs,
  siGooglegemini,
  siNetflix,
  siPaypal,
  siPerplexity,
  siPlaystation,
  siSpotify,
  siYoutubemusic,
} from 'simple-icons';

/**
 * Official brand marks via simple-icons where available.
 * Custom path fallbacks for brands missing from the package (OpenAI, Canva, etc.).
 */
export function ProductIcon({ name = '', className = 'w-7 h-7' }) {
  const baseClasses = `${className} shrink-0 transition-transform duration-200 object-contain drop-shadow-sm`;
  const raw = String(name || '').toLowerCase().trim();

  let key = raw;
  if (raw.includes('chatgpt') || raw.includes('gpt-4') || raw === 'openai') key = 'chatgpt';
  else if (raw.includes('claude')) key = 'claude';
  else if (raw.includes('canva')) key = 'canva';
  else if (raw.includes('gemini')) key = 'gemini';
  else if (raw.includes('perplexity')) key = 'perplexity';
  else if (raw.includes('midjourney')) key = 'midjourney';
  else if (raw.includes('elevenlabs') || raw.includes('eleven labs')) key = 'elevenlabs';
  else if (raw.includes('capcut')) key = 'capcut';
  else if (raw.includes('shahid')) key = 'shahid';
  else if (raw.includes('paypal')) key = 'paypal';
  else if (raw.includes('kling')) key = 'kling';
  else if (raw.includes('netflix')) key = 'netflix';
  else if (raw.includes('youtube')) key = 'youtube music';
  else if (raw.includes('apple music')) key = 'apple music';
  else if ((raw.includes('gift') && raw.includes('apple')) || raw.includes('apple_gift') || raw.includes('گێفت') || raw.includes('جفت كارد') || raw.includes('جفت كارد')) key = 'apple gift';
  else if (raw.includes('apple id') || raw.includes('apple-id') || (raw.includes('apple') && raw.includes('ئەکاونت'))) key = 'apple id';
  else if (raw.includes('چێکرنا apple') || (raw.includes('apple') && raw.includes('id'))) key = 'apple id';
  else if (raw.includes('playstation') || raw.includes('ps plus') || raw.includes('پلەیستەیشن')) key = 'playstation';
  else if (raw.includes('spotify')) key = 'spotify';
  else if (raw.includes('apple')) key = 'apple id';

  const brand = {
    claude: siAnthropic,
    gemini: siGooglegemini,
    perplexity: siPerplexity,
    elevenlabs: siElevenlabs,
    netflix: siNetflix,
    spotify: siSpotify,
    'youtube music': siYoutubemusic,
    'apple id': siApple,
    'apple music': siApplemusic,
    playstation: siPlaystation,
    paypal: siPaypal,
  }[key];

  if (brand) {
    const toneClass =
      key === 'apple id'
        ? 'text-zinc-900 dark:text-white'
        : key === 'elevenlabs'
          ? 'text-zinc-900 dark:text-white'
          : '';

    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        className={`${baseClasses} ${toneClass}`.trim()}
        fill={toneClass ? 'currentColor' : `#${brand.hex}`}
        aria-hidden="true"
      >
        <title>{brand.title}</title>
        <path d={brand.path} />
      </svg>
    );
  }

  /* Custom fallbacks — not in simple-icons (or renamed away) */
  switch (key) {
    case 'chatgpt':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${baseClasses} text-[#10A37F]`} aria-hidden="true">
          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.774-4.333 5.986 5.986 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.038zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.515 18.3a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.897a4.5 4.5 0 0 1-6.225-1.597zM2.34 7.276a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.276zm16.597 3.777-5.83-3.387L15.126 6.5a.075.075 0 0 1 .071 0l4.83 2.787a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.408-.662zm2.01-3.023-.141-.085-4.784-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135L6.289 10.98v-2.34a.08.08 0 0 1 .033-.061l4.83-2.787a.783.783 0 0 1 .786 0l4.783 2.76a.07.07 0 0 1 .036.061v2.34l-2.023-1.165a.774.774 0 0 0-.78 0l-5.837 3.37z" />
        </svg>
      );

    case 'canva':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${baseClasses} text-[#00C4CC]`} aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9.5c-.8-.8-2-1.2-3.2-1.2-2.5 0-4.3 1.8-4.3 4.5s1.8 4.5 4.3 4.5c1.4 0 2.5-.5 3.3-1.4" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'midjourney':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${baseClasses} text-indigo-600 dark:text-zinc-200`} aria-hidden="true">
          <path d="M3 18c6 2 12 2 18 0-2-4-5-8-9-14-4 6-7 10-9 14z" />
          <path d="M12 4v14" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );

    case 'capcut':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`${baseClasses} text-zinc-900 dark:text-white`} aria-hidden="true">
          <path d="m3 7 9 5-9 5V7z" />
          <path d="m21 7-9 5 9 5V7z" />
        </svg>
      );

    case 'shahid':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${baseClasses} text-amber-500`} aria-hidden="true">
          <path d="M5 3l4 9-4 9h14l-4-9 4-9H5z" />
          <circle cx="12" cy="12" r="3" className="fill-white dark:fill-[#0B0D14]" />
        </svg>
      );

    case 'kling':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${baseClasses} text-zinc-900 dark:text-white`} aria-hidden="true">
          <path d="M4 5h4l4 7-4 7H4l4-7-4-7zm8 0h4l4 7-4 7h-4l4-7-4-7z" />
        </svg>
      );

    case 'apple gift':
    case 'apple_gift':
      return (
        <svg viewBox="0 0 24 24" className={`${baseClasses}`} aria-hidden="true">
          <defs>
            <linearGradient id="apple-gift-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF375F" />
              <stop offset="20%" stopColor="#FF9F0A" />
              <stop offset="40%" stopColor="#FFD60A" />
              <stop offset="60%" stopColor="#30D158" />
              <stop offset="80%" stopColor="#0A84FF" />
              <stop offset="100%" stopColor="#BF5AF2" />
            </linearGradient>
          </defs>
          <path
            fill="url(#apple-gift-grad)"
            d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
          />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={`${baseClasses} text-emerald-600 dark:text-emerald-400`} aria-hidden="true">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      );
  }
}

export default ProductIcon;
