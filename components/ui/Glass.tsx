"use client";

import { isMotionValue, motion, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import { forwardRef, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { glassMaps, supportsSvgBackdrop, type GlassOptics } from "@/lib/client/liquidGlass";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

let svgBackdrop: boolean | null = null;
function canRefract() {
  if (svgBackdrop === null) svgBackdrop = supportsSvgBackdrop() && !matchMedia("(prefers-reduced-transparency: reduce)").matches;
  return svgBackdrop;
}

export type GlassLayerProps = GlassOptics & {
  /** Corner radius in px; `"pill"` uses half the height. */
  radius?: number | "pill";
  /** Backdrop blur (stdDeviation) inside the glass. */
  blur?: number;
  /** 0..1 multiplier on the refraction strength; animate it for press effects. */
  refraction?: number | MotionValue<number>;
  /** Strength of the rim light. */
  specularOpacity?: number;
  /** Extra saturation of light passing through the rim. */
  specularSaturation?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * The glass itself: an absolutely positioned layer that fills its (relative)
 * parent and bends whatever is behind it. Put content in a sibling above it.
 * Chromium gets true refraction through an SVG filter; other browsers get a
 * frosted blur with the same rim light, so it still reads as glass.
 */
export function GlassLayer({ radius = "pill", blur = 0.6, refraction = 1, specularOpacity = 0.5, specularSaturation = 5, className = "", style, ...optics }: GlassLayerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const id = `glass${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [refract, setRefract] = useState(false);

  useIsoLayoutEffect(() => {
    setRefract(canRefract());
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // offsetWidth ignores transforms, so a pressed (scaled) button keeps its map.
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setSize((s) => (s && s.w === w && s.h === h ? s : w && h ? { w, h } : null));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const r = size ? (radius === "pill" ? size.h / 2 : Math.min(radius, size.h / 2, size.w / 2)) : typeof radius === "number" ? radius : 9999;
  const { surface, glassThickness, bezelWidth, refractiveIndex } = optics;
  // `refract` only turns true after mount, so this never runs on the server.
  const maps = useMemo(
    () => (refract && size ? glassMaps(size.w, size.h, r, { surface, glassThickness, bezelWidth, refractiveIndex }) : null),
    [refract, size, r, surface, glassThickness, bezelWidth, refractiveIndex],
  );

  const fallbackRatio = useMotionValue(typeof refraction === "number" ? refraction : 1);
  useEffect(() => {
    if (typeof refraction === "number") fallbackRatio.set(refraction);
  }, [refraction, fallbackRatio]);
  const ratio = isMotionValue(refraction) ? refraction : fallbackRatio;
  const max = maps?.maxDisplacement ?? 0;
  const scale = useTransform(ratio, (v) => v * max);

  const live = refract && maps && size;
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={`glass-layer ${live ? "glass-layer--refract" : "glass-layer--frost"} ${className}`}
      style={{ borderRadius: r, ...style }}
    >
      {/* The lens must stay unstyled: a background or shadow on the element that
          carries an SVG backdrop-filter shifts the filter's coordinates in Chromium. */}
      <span className="glass-lens" style={live ? { backdropFilter: `url(#${id})`, WebkitBackdropFilter: `url(#${id})` } : undefined} />
      {live && (
        <svg className="glass-defs" colorInterpolationFilters="sRGB" aria-hidden="true" focusable="false">
          <defs>
            <filter id={id}>
              <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blurred" />
              <feImage href={maps.displacement} x={0} y={0} width={size.w} height={size.h} result="displacement_map" preserveAspectRatio="none" />
              <motion.feDisplacementMap in="blurred" in2="displacement_map" scale={scale} xChannelSelector="R" yChannelSelector="G" result="displaced" />
              <feColorMatrix in="displaced" type="saturate" values={String(specularSaturation)} result="displaced_saturated" />
              <feImage href={maps.specular} x={0} y={0} width={size.w} height={size.h} result="specular" preserveAspectRatio="none" />
              <feComposite in="displaced_saturated" in2="specular" operator="in" result="specular_saturated" />
              <feComponentTransfer in="specular" result="specular_faded">
                <feFuncA type="linear" slope={specularOpacity} />
              </feComponentTransfer>
              <feBlend in="specular_saturated" in2="displaced" mode="normal" result="with_saturation" />
              <feBlend in="specular_faded" in2="with_saturation" mode="normal" />
            </filter>
          </defs>
        </svg>
      )}
    </span>
  );
}

/** Spring shared by every glass press so they all feel like the same material. */
const PRESS = { stiffness: 900, damping: 40, mass: 0.6 };

/** Press state that also ends when the pointer is released outside the element. */
function usePressed() {
  const pressed = useMotionValue(0);
  useEffect(() => {
    const up = () => pressed.set(0);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [pressed]);
  return pressed;
}

type GlassButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> & {
  /** `clear` floats over content; `tint` is the filled primary action. */
  variant?: "clear" | "tint";
  radius?: number | "pill";
  glass?: Omit<GlassLayerProps, "radius" | "refraction">;
  style?: CSSProperties;
  children?: ReactNode;
};

/**
 * A Liquid Glass button. Pressing it swells the glass slightly and doubles the
 * refraction, the same "lens pushes in" feel as iOS 26 controls.
 */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { variant = "clear", radius = "pill", glass, className = "", style, children, onPointerDown, disabled, ...rest },
  ref,
) {
  const pressed = usePressed();
  const lift = useSpring(useTransform(pressed, [0, 1], [1, 1.06]), PRESS);
  const refraction = useSpring(useTransform(pressed, [0, 1], [0.55, 1]), PRESS);
  return (
    <motion.button
      ref={ref}
      {...(rest as object)}
      disabled={disabled}
      data-variant={variant}
      className={`glass-button ${className}`}
      style={{ scale: lift, ...style }}
      onPointerDown={(e) => {
        if (!disabled) pressed.set(1);
        onPointerDown?.(e);
      }}
    >
      <GlassLayer radius={radius} refraction={refraction} glassThickness={40} bezelWidth={12} {...glass} />
      {children}
    </motion.button>
  );
});

/** A glass panel for popups and sheets: same material, softer and thicker. */
export function GlassPanel({ radius = 28, className = "", children, ...rest }: { radius?: number; className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`glass-panel ${className}`} style={{ borderRadius: radius }} {...rest}>
      <GlassLayer radius={radius} blur={8} glassThickness={90} bezelWidth={22} specularOpacity={0.6} />
      {children}
    </div>
  );
}
