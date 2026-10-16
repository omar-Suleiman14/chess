"use client";

import { useEffect, useRef } from "react";

const CELL = 15; // px per character cell
const CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE_ALPHA = 0.1; // brightest a resting character gets
const RIPPLE_SPEED = 0.55; // px per ms
const RIPPLE_LIFE = 1600; // ms
const RIPPLE_WIDTH = 34; // px, thickness of the lit band
const AMBIENT_MS = 220; // redraw interval when nothing is rippling

type Ripple = { x: number; y: number; t0: number };

/** Interactive elements keep their own clicks; only empty space ripples. */
const INTERACTIVE = "button,a,input,select,textarea,label,summary,[role=gridcell],[role=dialog],[role=switch],[contenteditable]";

const randomChar = () => CHARS[(Math.random() * CHARS.length) | 0];

/** Cheap, smooth "cloud" field in 0..1 that drifts slowly with time. */
function cloud(x: number, y: number, t: number) {
  const a = Math.sin(x * 0.011 + t * 0.00007) + Math.sin(y * 0.013 - t * 0.00005);
  const b = Math.sin((x + y) * 0.006 + t * 0.00004) + Math.sin((x - y) * 0.009 + 1.7);
  // A third, incommensurate wave keeps the islands from repeating as neat circles.
  const c = Math.sin(x * 0.0037 + y * 0.0071 + Math.sin(y * 0.004) * 2 + t * 0.00003);
  const v = (a + b + c) / 6 + 0.5; // ~0..1
  // Sharpen hard so the field breaks into sparse islands with wide empty gaps.
  return Math.max(0, Math.min(1, (v - 0.6) * 4.5));
}

/**
 * A field of faint, slowly changing characters behind the app. Tapping empty
 * space sends a ripple through it that briefly lights and scrambles the
 * characters it passes. Renders a still field when motion is reduced.
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
    let color = "0 0 0";
    const ripples: Ripple[] = [];
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const readColor = () => {
      // The theme's text colour, so it works in light and dark.
      const probe = getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#000";
      const m = probe.match(/^#([0-9a-f]{6})$/i);
      color = m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(" ") : "128 128 128";
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `500 ${CELL - 4}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      cols = Math.ceil(w / CELL);
      rows = Math.ceil(h / CELL);
      chars = Array.from({ length: cols * rows }, randomChar);
      readColor();
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      // Drop finished ripples.
      for (let i = ripples.length - 1; i >= 0; i--) if (now - ripples[i].t0 > RIPPLE_LIFE) ripples.splice(i, 1);
      const t = reducedMotion ? 0 : now;
      for (let r = 0; r < rows; r++) {
        const cy = r * CELL + CELL / 2;
        for (let c = 0; c < cols; c++) {
          const cx = c * CELL + CELL / 2;
          let alpha = cloud(cx, cy, t) * BASE_ALPHA;
          let lit = 0;
          for (const rp of ripples) {
            const age = now - rp.t0;
            const ring = age * RIPPLE_SPEED;
            const d = Math.abs(Math.hypot(cx - rp.x, cy - rp.y) - ring);
            if (d < RIPPLE_WIDTH) lit = Math.max(lit, (1 - d / RIPPLE_WIDTH) * (1 - age / RIPPLE_LIFE));
          }
          const i = r * cols + c;
          if (lit > 0.15 && Math.random() < 0.35) chars[i] = randomChar();
          alpha = Math.min(0.9, alpha + lit * lit * 0.8);
          if (alpha < 0.012) continue;
          ctx.fillStyle = `rgb(${color} / ${alpha.toFixed(3)})`;
          ctx.fillText(chars[i], cx, cy);
        }
      }
    };

    const schedule = () => {
      if (document.hidden) return;
      if (ripples.length) raf = requestAnimationFrame(tick);
      else if (!reducedMotion) timer = setTimeout(() => (raf = requestAnimationFrame(tick)), AMBIENT_MS);
    };

    const tick = (now: number) => {
      // Ambient flicker: a few characters change each frame.
      if (!reducedMotion) for (let k = 0; k < Math.max(1, (cols * rows) / 300); k++) chars[(Math.random() * chars.length) | 0] = randomChar();
      draw(now);
      schedule();
    };

    const restart = () => {
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      timer = null;
      raf = requestAnimationFrame(tick);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (reducedMotion || !(e.target instanceof Element) || e.target.closest(INTERACTIVE)) return;
      const rect = canvas.getBoundingClientRect();
      ripples.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, t0: performance.now() });
      if (ripples.length > 6) ripples.shift();
      restart();
    };

    const onVisibility = () => (document.hidden ? (cancelAnimationFrame(raf), timer && clearTimeout(timer)) : restart());
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      readColor();
      restart();
    };

    resize();
    restart();
    const ro = new ResizeObserver(() => {
      resize();
      restart();
    });
    ro.observe(canvas);
    window.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("visibilitychange", onVisibility);
    scheme.addEventListener("change", onScheme);
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener("pointerdown", onPointerDown);
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
