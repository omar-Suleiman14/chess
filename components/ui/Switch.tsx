"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useId, useRef } from "react";
import { GlassLayer } from "./Glass";

export const IOS_SPRING = { type: "spring" as const, stiffness: 520, damping: 38, mass: 0.9 };

const TRACK_W = 64;
const TRACK_H = 28;
const THUMB_W = 40;
const THUMB_H = 24;
const TRAVEL = TRACK_W - THUMB_W - 4;
const DRAG_SPRING = { stiffness: 1000, damping: 80 };

/**
 * iOS 26-style Liquid Glass switch. The thumb is a lip-shaped lens: at rest
 * it is solid white; held, it swells and clears so you see the track bend
 * through it. Tap or drag it. Fully keyboard and screen-reader accessible.
 */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  const pressed = useMotionValue(0);
  const drag = useMotionValue<number | null>(null);
  const start = useRef<{ x: number; moved: boolean } | null>(null);
  const position = useSpring(useTransform(() => drag.get() ?? (checked ? 1 : 0)), DRAG_SPRING);
  const x = useTransform(position, (p) => 2 + p * TRAVEL);
  const thumbScale = useSpring(useTransform(pressed, [0, 1], [1, 1.45]), DRAG_SPRING);
  const thumbFill = useSpring(useTransform(pressed, [0, 1], [1, 0.08]), DRAG_SPRING);
  const background = useTransform(thumbFill, (a) => `rgb(255 255 255 / ${a})`);
  const refraction = useSpring(useTransform(pressed, [0, 1], [0.4, 1]), DRAG_SPRING);
  const on = useTransform((): number => ((drag.get() ?? (checked ? 1 : 0)) > 0.5 ? 1 : 0));
  const trackColor = useTransform(useSpring(on, DRAG_SPRING), (v) => `color-mix(in srgb, var(--switch-on) ${v * 100}%, var(--switch-off))`);

  useEffect(() => position.jump(checked ? 1 : 0), []); // eslint-disable-line react-hooks/exhaustive-deps

  const end = (clientX: number | null) => {
    const s = start.current;
    start.current = null;
    pressed.set(0);
    const d = drag.get();
    drag.set(null);
    if (!s || disabled) return;
    if (s.moved && d !== null) {
      if (d > 0.5 !== checked) onChange(d > 0.5);
    } else if (clientX !== null) onChange(!checked);
  };

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="relative shrink-0 touch-pan-y rounded-full disabled:opacity-40 rtl:-scale-x-100"
      style={{ width: TRACK_W, height: TRACK_H, backgroundColor: trackColor }}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, moved: false };
        pressed.set(1);
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        const dx = e.clientX - s.x;
        if (Math.abs(dx) > 4) s.moved = true;
        if (!s.moved) return;
        const dir = getComputedStyle(e.currentTarget).direction === "rtl" ? -1 : 1;
        const ratio = (checked ? 1 : 0) + (dir * dx) / TRAVEL;
        // Rubber-band a little past either end, like the real thing.
        const over = ratio < 0 ? ratio : ratio > 1 ? ratio - 1 : 0;
        drag.set(Math.min(1, Math.max(0, ratio)) + over / 22);
      }}
      onPointerUp={(e) => end(e.clientX)}
      onPointerCancel={() => end(null)}
      onClick={(e) => {
        // Pointer clicks are handled in pointerup; this is keyboard (Space / Enter).
        if (e.detail === 0 && !disabled) onChange(!checked);
      }}
    >
      <motion.span
        className="glass-switch-thumb absolute left-0 top-[2px] block rounded-full"
        style={{ width: THUMB_W, height: THUMB_H, x, scale: thumbScale, background }}
      >
        <GlassLayer radius="pill" surface="lip" glassThickness={30} bezelWidth={10} refractiveIndex={1.5} blur={0.2} refraction={refraction} specularOpacity={0.5} specularSaturation={6} />
      </motion.span>
    </motion.button>
  );
}

/** A settings row: label (and hint) on the left, switch on the right. */
export function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-b border-line px-4 py-2.5 last:border-b-0">
      <span id={id}>
        <span className="block">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
