'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Live frequency-bar waveform visualizer driven by the Web Audio API,
 * connected to the given <audio> element ref. Falls back to a gentle
 * idle animation while the audio is paused or before playback starts.
 */
export default function Waveform({ audioRef, active }) {
  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const rafRef = useRef(null);
  const idlePhaseRef = useRef(0);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || sourceRef.current) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      const source = ctx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch {
      /* AudioContext already connected to this element or unsupported */
    }
    return () => {
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
    };
  }, [audioRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx2d = canvas.getContext('2d');
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const width = canvas.clientWidth || 480;
    const height = canvas.clientHeight || 64;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx2d.scale(dpr, dpr);

    const barCount = 40;
    const analyser = analyserRef.current;
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    const draw = () => {
      ctx2d.clearRect(0, 0, width, height);
      const barWidth = width / barCount - 2;

      if (active && analyser && audioCtxRef.current?.state !== 'suspended') {
        analyser.getByteFrequencyData(dataArray);
      }

      for (let i = 0; i < barCount; i++) {
        let ratio;
        if (active && analyser) {
          const bin = dataArray[Math.floor((i / barCount) * dataArray.length)] || 0;
          ratio = Math.max(0.06, bin / 255);
        } else {
          idlePhaseRef.current += 0.05;
          ratio = 0.12 + 0.08 * Math.abs(Math.sin(idlePhaseRef.current + i * 0.35));
        }
        const barHeight = ratio * height;
        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;

        const gradient = ctx2d.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, '#c084fc');
        gradient.addColorStop(1, '#6366f1');
        ctx2d.fillStyle = gradient;
        if (ctx2d.roundRect) {
          ctx2d.beginPath();
          ctx2d.roundRect(x, y, barWidth, barHeight, 2);
          ctx2d.fill();
        } else {
          ctx2d.fillRect(x, y, barWidth, barHeight);
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-16 rounded-xl bg-slate-950/60 border border-emerald-500/20"
      style={{ width: '100%', height: 64 }}
    />
  );
}
