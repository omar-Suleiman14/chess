"use client";

import { useEffect, useRef } from "react";

const CELL = 14; // px per character cell
const CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const FLOOR_ALPHA = 0.035; // every cell, everywhere
const CLOUD_ALPHA = 0.12; // extra in the denser, drifting patches
const BLANK_RATE = 0.12; // share of cells left empty, for texture
const FRAME_MS = 70; // ~14 fps: smooth enough for drifting text, cheap on battery
const MUTATE_SHARE = 0.025; // share of characters that change each frame
const HOVER_RADIUS = 130; // px
const HOVER_ALPHA = 0.32;
const RIPPLE_SPEED = 0.55; // px per ms
const RIPPLE_LIFE = 1600; // ms
const RIPPLE_WIDTH = 34; // px, thickness of the lit band

type Ripple = { x: number; y: number; t0: number };

/** Interactive elements keep their own clicks; only empty space ripples. */
const INTERACTIVE = "button,a,input,select,textarea,label,summary,[role=gridcell],[role=dialog],[role=switch],[contenteditable]";

const randomChar = () => (Math.random() < BLANK_RATE ? " " : CHARS[(Math.random() * CHARS.length) | 0]);

/** Smooth, slowly drifting density field in 0..1 (denser patches and thinner gaps). */
function cloud(x: number, y: number, t: number) {
  const a = Math.sin(x * 0.0065 + t * 0.00021) + Math.sin(y * 0.0083 - t * 0.00017);
  const b = Math.sin((x + y) * 0.0041 + t * 0.00013) + Math.sin((x - y) * 0.0057 + 1.7 - t * 0.00011);
  const c = Math.sin(x * 0.0023 + y * 0.0047 + Math.sin(y * 0.003 + t * 0.00009) * 2);
  const v = (a + b + c) / 6 + 0.5; // ~0..1
  return Math.max(0, Math.min(1, (v - 0.35) * 2.2));
}

/**
 * Faint characters across the whole screen behind the app, always drifting and
 * changing. They brighten near the pointer, and tapping empty space sends a
 * ripple through them. Renders a still field when motion is reduced.
 */
export function CharacterField({ reducedMotion }: { reducedMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let cols = 0;
    let rows = 0;
    let chars: string[] = [];
    let color = "128 128 128";
    const ripples: Ripple[] = [];
    let pointer: { x: number; y: number } | null = null;
    let raf = 0;
    let last = 0;

    const readColor = () => {
      // The theme's text colour, so it works in light and dark.
      const value = getComputedStyle(document.documentElement).getPropertyValue("--text").trim();
      const m = value.match(/^#([0-9a-f]{6})$/i);
      color = m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(" ") : "128 128 128";
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `500 ${CELL - 3}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      cols = Math.ceil(w / CELL);
      rows = Math.ceil(h / CELL);
      chars = Array.from({ length: cols * rows }, randomChar);
      readColor();
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      for (let i = ripples.length - 1; i >= 0; i--) if (now - ripples[i].t0 > RIPPLE_LIFE) ripples.splice(i, 1);
      const t = reducedMotion ? 0 : now;
      for (let r = 0; r < rows; r++) {
        const cy = r * CELL + CELL / 2;
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const cx = c * CELL + CELL / 2;
          let lit = 0;
          for (const rp of ripples) {
            const age = now - rp.t0;
            const d = Math.abs(Math.hypot(cx - rp.x, cy - rp.y) - age * RIPPLE_SPEED);
            if (d < RIPPLE_WIDTH) lit = Math.max(lit, (1 - d / RIPPLE_WIDTH) * (1 - age / RIPPLE_LIFE));
          }
          if (lit > 0.15 && Math.random() < 0.35) chars[i] = CHARS[(Math.random() * CHARS.length) | 0];
          const ch = chars[i];
          if (ch === " ") continue;
          let alpha = FLOOR_ALPHA + cloud(cx, cy, t) * CLOUD_ALPHA;
          if (pointer) {
            const d = Math.hypot(cx - pointer.x, cy - pointer.y);
            if (d < HOVER_RADIUS) alpha += (1 - d / HOVER_RADIUS) ** 2 * HOVER_ALPHA;
          }
          alpha = Math.min(0.9, alpha + lit * lit * 0.8);
          ctx.fillStyle = `rgb(${color} / ${alpha.toFixed(3)})`;
          ctx.fillText(ch, cx, cy);
        }
      }
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_MS && !ripples.length) return;
      last = now;
      const changes = Math.max(1, (chars.length * MUTATE_SHARE) | 0);
      for (let k = 0; k < changes; k++) chars[(Math.random() * chars.length) | 0] = randomChar();
      draw(now);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (document.hidden) return;
      if (reducedMotion) draw(0);
      else raf = requestAnimationFrame(tick);
    };

    const local = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onPointerDown = (e: PointerEvent) => {
      if (reducedMotion || !(e.target instanceof Element) || e.target.closest(INTERACTIVE)) return;
      ripples.push({ ...local(e), t0: performance.now() });
      if (ripples.length > 6) ripples.shift();
    };
    // Hover glow follows mice and pens; a finger has no hover.
    const onPointerMove = (e: PointerEvent) => {
      pointer = e.pointerType === "touch" ? null : local(e);
      if (reducedMotion) draw(0);
    };
    const onPointerLeave = () => {
      pointer = null;
    };

    const onVisibility = () => (document.hidden ? cancelAnimationFrame(raf) : start());
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      readColor();
      start();
    };

    resize();
    start();
    const ro = new ResizeObserver(() => {
      resize();
      start();
    });
    ro.observe(canvas);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    scheme.addEventListener("change", onScheme);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      scheme.removeEventListener("change", onScheme);
    };
  }, [reducedMotion]);

  return (
    // Sticky (not fixed): the app container is transformed while the menu is
    // open, and fixed elements inside a transform stop following the viewport.
    <div className="pointer-events-none sticky top-0 -z-10 -mb-[100dvh] h-dvh w-full" aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
