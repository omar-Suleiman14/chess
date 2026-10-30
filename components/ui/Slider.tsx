"use client";

import type { CSSProperties, InputHTMLAttributes } from "react";

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

/** Classic slider: a native range input, so keyboard, touch and screen readers behave natively. */
export function Slider({ value, min = 0, max = 100, onValueChange, fill = "var(--switch-on)", className = "", style, ...input }: SliderProps) {
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
