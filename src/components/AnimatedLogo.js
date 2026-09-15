'use client';

import React, { useId } from 'react';

export default function AnimatedLogo({ className = 'w-10 h-10' }) {
  const uid = useId().replace(/:/g, '');
  const gradId = `ipbitsGlowGrad-${uid}`;
  const filterId = `neonFilter-${uid}`;

  return (
    <div className={`relative flex items-center justify-center transform-gpu ${className}`}>
      <div className="absolute inset-0 rounded-full bg-emerald-600/25 blur-xl animate-pulse pointer-events-none" />
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 transition-transform duration-500 hover:scale-105"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#a855f7" floodOpacity="0.6" />
          </filter>
        </defs>
        <style>{`
          @keyframes drawOutline {
            0% {
              stroke-dashoffset: 280;
              opacity: 0;
            }
            40% {
              opacity: 1;
            }
            100% {
              stroke-dashoffset: 0;
              opacity: 1;
            }
          }
          @keyframes fillIn {
            0%, 65% {
              fill-opacity: 0;
            }
            100% {
              fill-opacity: 1;
            }
          }
          @keyframes fadeIn {
            to {
              opacity: 1;
            }
          }
          @keyframes floatMicro {
            0%, 100% {
              transform: translateY(0px) scale(1);
            }
            50% {
              transform: translateY(-1.5px) scale(1.02);
            }
          }
          .logo-diamond-path {
            stroke-dasharray: 280;
            stroke-dashoffset: 280;
            animation: drawOutline 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards,
                       fillIn 2.2s ease-out forwards,
                       floatMicro 4s ease-in-out infinite 2.2s;
            transform-origin: center;
          }
          .logo-bit-square {
            opacity: 0;
            animation: fadeIn 1.5s ease-out 0.8s forwards;
          }
        `}</style>
        <path
          d="M50 12 L85 50 L50 88 L15 50 Z"
          stroke={`url(#${gradId})`}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={`url(#${gradId})`}
          filter={`url(#${filterId})`}
          className="logo-diamond-path"
        />
        <rect x="46" y="24" width="8" height="8" rx="1.5" fill="#ffffff" className="logo-bit-square" />
        <rect x="46" y="68" width="8" height="8" rx="1.5" fill="#ffffff" className="logo-bit-square" />
      </svg>
    </div>
  );
}
