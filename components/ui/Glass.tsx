"use client";

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { useGlassOn } from "@/lib/client/settings";

export type GlassLayerProps = {
  tier?: "navigation" | "control" | "sheet";
  radius?: number | "pill";
  className?: string;
  style?: CSSProperties;
};

/** One bounded, static material layer. Content never goes through an SVG filter. */
export function GlassLayer({ tier = "control", radius = "pill", className = "", style }: GlassLayerProps) {
  const enabled = useGlassOn();
  if (!enabled) return null;
  return <span aria-hidden="true" data-material={tier} className={`glass-layer glass-layer--${tier} ${className}`} style={{ borderRadius: radius === "pill" ? 9999 : radius, ...style }} />;
}

type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "clear" | "tint";
  radius?: number | "pill";
  glass?: Omit<GlassLayerProps, "radius">;
  children?: ReactNode;
};

/** Shared accessible button, skinned by the current app appearance. */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { variant = "clear", radius = "pill", glass, className = "", children, ...props }, ref,
) {
  const enabled = useGlassOn();
  const surface = variant === "tint" ? "bg-accent text-accent-text" : "bg-surface shadow-[var(--shadow)]";
  return <button ref={ref} {...props} data-variant={variant} className={`${enabled ? "glass-button" : `press-overlay ${surface}`} disabled:opacity-40 ${className}`}>
    {enabled && <GlassLayer radius={radius} {...glass} />}
    {children}
  </button>;
});
