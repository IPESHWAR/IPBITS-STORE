'use client';

import React from 'react';

/**
 * IPBITS brand mark — processed emerald `/iconT.png` (transparent, cropped).
 * `framed` / `height` / `style` kept for API compatibility.
 */
export default function Logo({
  height = 36,
  className = '',
  framed: _framed = false,
  compact = false,
  style: styleProp,
}) {
  const sizeClass = compact ? 'h-8 w-auto' : '';

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/iconT.png"
      alt="IPBITS STORE"
      width={compact ? 32 : height}
      height={compact ? 32 : height}
      className={`ipbits-logo shrink-0 object-contain drop-shadow-[0_0_12px_rgba(52,211,153,0.8)] ${sizeClass} ${className}`.trim()}
      style={
        compact
          ? { height: '2rem', width: 'auto', ...styleProp }
          : { height, width: 'auto', ...styleProp }
      }
      decoding="async"
    />
  );
}
