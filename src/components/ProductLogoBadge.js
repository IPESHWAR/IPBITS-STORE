'use client';

import React, { useMemo, useState } from 'react';
import { ProductIcon } from '@/components/ProductIcons';

/**
 * Official logos from /public (preferred), with SVG ProductIcon fallback.
 * Keys match catalog brandIcon / product name heuristics.
 */
const PUBLIC_LOGO_CANDIDATES = {
  claude: ['/claude.png'],
  gemini: [], // SVG via ProductIcon / BrandIcon
  canva: ['/canva.png', '/canva-logo-png.png'],
  capcut: ['/capcut-logo.webp', '/capcut-logo-png_seeklogo-437025.png'],
  shahid: ['/shahid.png'],
  shahid_vip: ['/shahid.png'],
  kling: ['/kling.png', '/kling-ai-icon-logo-png_seeklogo-673995.png'],
  higgsfield: ['/higgsfield-seeklogo.svg'],
  paypal: ['/paypal.png'],
  elevenlabs: ['/ElevenLabs_logo_(2022-2024).png'],
  apple_gift: ['/apple-gift-card.svg'],
  openai: [],
  chatgpt: [],
};

const BADGE_CLASS =
  'lm-product-logo relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 p-2.5 bg-white/[0.04] dark:bg-white/[0.03] border border-white/10 backdrop-blur-md shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:border-white/20';

const CAPCUT_BADGE_CLASS =
  'lm-product-logo relative w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 p-0 overflow-hidden bg-white/[0.04] dark:bg-white/[0.03] border border-white/10 backdrop-blur-md shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:border-white/20';

function resolveBrandKey(name = '', brandIcon = '') {
  const icon = String(brandIcon || '').toLowerCase().trim();
  if (icon && (PUBLIC_LOGO_CANDIDATES[icon] || icon === 'shahid' || icon === 'shahid_vip')) {
    return icon === 'shahid' ? 'shahid' : icon;
  }

  const raw = String(name || '').toLowerCase().trim();
  if (raw.includes('claude')) return 'claude';
  if (raw.includes('canva')) return 'canva';
  if (raw.includes('capcut')) return 'capcut';
  if (raw.includes('shahid')) return 'shahid';
  if (raw.includes('gemini')) return 'gemini';
  if (raw.includes('kling')) return 'kling';
  if (raw.includes('higgsfield') || raw.includes('higgs field')) return 'higgsfield';
  if (raw.includes('paypal')) return 'paypal';
  if (raw.includes('elevenlabs') || raw.includes('eleven labs')) return 'elevenlabs';
  if (raw.includes('gift') && raw.includes('apple')) return 'apple_gift';
  if (raw.includes('گێفت') || raw.includes('جفت')) return 'apple_gift';
  if (raw.includes('chatgpt') || raw.includes('openai')) return 'chatgpt';
  return icon || raw;
}

/**
 * Glassmorphic product logo badge — uses /public assets when available.
 */
export default function ProductLogoBadge({
  name = '',
  brandIcon = '',
  alt,
  className = '',
  iconClassName = 'w-full h-full object-contain',
}) {
  const key = useMemo(() => resolveBrandKey(name, brandIcon), [name, brandIcon]);
  const candidates = PUBLIC_LOGO_CANDIDATES[key] || [];
  const [srcIndex, setSrcIndex] = useState(0);
  const [useSvgFallback, setUseSvgFallback] = useState(candidates.length === 0);
  const isCapCut = key === 'capcut';
  const isKling = key === 'kling';

  const currentSrc = !useSvgFallback && candidates[srcIndex] ? candidates[srcIndex] : null;

  const handleError = () => {
    if (srcIndex + 1 < candidates.length) {
      setSrcIndex((i) => i + 1);
      return;
    }
    setUseSvgFallback(true);
  };

  const badgeClass = `${isCapCut ? CAPCUT_BADGE_CLASS : BADGE_CLASS} ${className}`.trim();
  const imgClass = isCapCut
    ? 'w-full h-full object-cover'
    : isKling
      ? `${iconClassName} brightness-0 dark:brightness-100`.trim()
      : iconClassName;
  const svgClass = isCapCut ? 'w-full h-full' : 'w-7 h-7';

  return (
    <div className={badgeClass} aria-hidden={false}>
      {currentSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentSrc}
          alt={alt || name || 'Product'}
          className={imgClass}
          loading="lazy"
          decoding="async"
          onError={handleError}
        />
      ) : (
        <ProductIcon name={name || key} className={svgClass} />
      )}
    </div>
  );
}

export { resolveBrandKey, PUBLIC_LOGO_CANDIDATES };
