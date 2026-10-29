"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, type CSSProperties, type InputHTMLAttributes } from "react";
import { useGlassOn } from "@/lib/client/settings";
import { GlassLayer } from "./Glass";

const THUMB_W = 38;
const THUMB_H = 24;
const SPRING = { stiffness: 2000, damping: 80 };

type SliderProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "style"> & {
  value: number;
  min?: number;
  max?: number;
  onValueChange: (v: number) => void;
  /** Colour of the filled part of the track. */
  fill?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Liquid Glass slider. A real <input type="range"> sits on top (invisible) so
 * keyboard, screen readers and touch all behave natively; underneath, the
 * thumb is a convex glass lens that grows and turns clear while you drag,
 * bending the track beneath it.
 */
export function Slider(props: SliderProps) {
  return useGlassOn() ? <GlassSlider {...props} /> : <PlainSlider {...props} />;
}

/** The original native slider, used whenever Liquid Glass is off. */
function PlainSlider({ value, min = 0, max = 100, onValueChange, fill = "#0a84ff", className = "", style, ...input }: SliderProps) {
  const pct = max > min ? ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100 : 0;
  return (
    <input
      {...input}
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onValueChange(Number(e.target.value))}
      className={`ios-range ${className}`}
      style={{ ["--pct" as string]: `${pct}%`, ["--range-fill" as string]: fill, ...style }}
    />
  );
}

function GlassSlider({ value, min = 0, max = 100, onValueChange, fill = "var(--switch-on)", className = "", style, onPointerDown, ...input }: SliderProps) {
  const pct = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;
  const pressed = useMotionValue(0);
  const scale = useSpring(useTransform(pressed, [0, 1], [1, 1.55]), SPRING);
  const fillAlpha = useSpring(useTransform(pressed, [0, 1], [1, 0.06]), SPRING);
  const background = useTransform(fillAlpha, (a) => `rgb(255 255 255 / ${a})`);

  useEffect(() => {
    const up = () => pressed.set(0);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [pressed]);

  return (
    <div className={`glass-slider relative h-11 ${className}`} style={{ ["--thumb-w" as string]: `${THUMB_W}px`, ...style }}>
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--switch-off)]">
        <div className="h-full rounded-full ltr:origin-left rtl:ml-auto" style={{ width: `calc(${THUMB_W / 2}px + (100% - ${THUMB_W}px) * ${pct})`, background: fill }} />
      </div>
      <motion.span
        className="pointer-events-none absolute top-1/2 block rounded-full shadow-[0_3px_10px_rgb(0_0_0/0.14)]"
        style={{ width: THUMB_W, height: THUMB_H, marginTop: -THUMB_H / 2, insetInlineStart: `calc((100% - ${THUMB_W}px) * ${pct})`, scale, background }}
      >
        <GlassLayer radius="pill" />
      </motion.span>
      <input
        {...input}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onValueChange(Number(e.target.value))}
        onPointerDown={(e) => {
          pressed.set(1);
          onPointerDown?.(e);
        }}
        className="glass-slider__input absolute inset-0 h-full w-full cursor-pointer"
      />
    </div>
  );
}
