"use client";

import { useEffect, useRef } from "react";
import type { AmbientSettings } from "@/lib/experience/config";
import { isWeakDevice } from "@/lib/client/settings";

const GLYPHS = {
  notation: ["e4", "Nf3", "O-O", "d5", "Bb5", "c6", "g3", "..."],
  chess: ["♙", "♘", "♗", "♜", "♞", "♔"],
  mono: ["0", "1", "+", "=", ":", "x", "·", "/"],
  mix: ["e4", "Nf3", "O-O", "d5", "♞", "♙", "+", "·"],
};
const INTERACTIVE = "button,a,input,select,textarea,label,summary,[role=grid],[role=dialog],[role=switch]";
type Glyph = { x: number; y: number; phase: number; text: string };

/** Original glyph field, bounded to its game-scene parent. No React frame updates. */
export function CharacterField({ settings, reducedMotion, reducedTransparency, tint }: { settings: AmbientSettings; reducedMotion: boolean; reducedTransparency: boolean; tint: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    const scene = canvas?.parentElement?.parentElement;
    if (!canvas || !context || !scene) return;
    const limited = settings.adaptive && isWeakDevice();
    const fps = reducedMotion || reducedTransparency ? 0 : Math.min(settings.fps, limited ? 15 : 60);
    canvas.dataset.effectiveFps = String(fps);
    canvas.dataset.fallback = limited ? "adaptive-low-power" : fps === 0 ? "static" : "manual-cap";
    let width = 0, height = 0;
    let glyphs: Glyph[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;
    let visible = true;
    let pointer: { x: number; y: number } | null = null;
    let seed = 1977;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const stop = () => { if (timer) clearTimeout(timer); cancelAnimationFrame(raf); };
    const draw = (now: number) => {
      context.clearRect(0, 0, width, height);
      const speed = settings.speed * ({ subtle: 0.4, normal: 0.7, dynamic: 1 }[settings.motion]);
      const time = fps ? now * 0.00002 * speed : 0;
      const intensity = { low: 0.6, medium: 0.8, high: 1 }[settings.intensity];
      context.fillStyle = tint;
      for (const glyph of glyphs) {
        const x = ((glyph.x + time * 0.25) % 1) * width;
        const y = ((glyph.y + time * 0.12) % 1) * height;
        const edge = Math.min(1, x / 60, (width - x) / 60, y / 60, (height - y) / 60);
        const response = pointer && settings.interactive && fps ? Math.max(0, 1 - Math.hypot(pointer.x - x, pointer.y - y) / 110) : 0;
        context.globalAlpha = Math.min(0.2, settings.opacity * intensity * Math.max(0, edge) * (0.6 + 0.4 * Math.sin(glyph.phase + time)) + response * 0.025);
        context.fillText(glyph.text, x + response * 3, y - response * 2);
      }
    };
    const tick = (now: number) => {
      if (!visible || document.hidden) return;
      draw(now);
      if (fps > 0) timer = setTimeout(() => { raf = requestAnimationFrame(tick); }, Math.max(0, 1000 / fps - 3));
    };
    const start = () => { stop(); if (visible && !document.hidden) tick(performance.now()); };
    const resize = () => {
      width = canvas.clientWidth; height = canvas.clientHeight;
      const dpr = Math.min(limited ? 1 : 1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.font = `500 ${Math.round(13 * settings.scale)}px ui-monospace, monospace`;
      context.textBaseline = "middle";
      context.filter = settings.blur && !limited ? `blur(${settings.blur}px)` : "none";
      const count = Math.min(limited ? 90 : 300, Math.floor(width * height / 1800 * settings.density));
      const vocabulary = GLYPHS[settings.glyphs];
      seed = 1977;
      glyphs = Array.from({ length: count }, () => ({ x: random(), y: random(), phase: random() * Math.PI, text: vocabulary[Math.floor(random() * vocabulary.length)] }));
      start();
    };
    const onPointer = (event: PointerEvent) => {
      if (!settings.interactive || fps === 0 || !visible || event.pointerType === "touch" || event.target instanceof Element && event.target.closest(INTERACTIVE)) { pointer = null; return; }
      const rect = canvas.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const leave = () => { pointer = null; };
    const observer = new ResizeObserver(resize);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; start(); });
    observer.observe(canvas); intersection.observe(canvas);
    scene.addEventListener("pointermove", onPointer, { passive: true });
    scene.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", start);
    resize();
    return () => { stop(); observer.disconnect(); intersection.disconnect(); scene.removeEventListener("pointermove", onPointer); scene.removeEventListener("pointerleave", leave); document.removeEventListener("visibilitychange", start); };
  }, [settings, reducedMotion, reducedTransparency, tint]);
  return <canvas ref={canvasRef} data-ambient-renderer="canvas2d" className="block h-full w-full" aria-hidden="true" />;
}
