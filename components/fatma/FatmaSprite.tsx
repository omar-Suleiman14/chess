"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import atlas from "@/public/fatma/atlas.json";
import { EXPRESSION_ANIMATION, type Expression } from "@/lib/chess/personality/fatma";

type Atlas = { cellWidth: number; cellHeight: number; columns: number; rows: number; animations: Record<string, number[]> };
const A = atlas as Atlas;
// Alternate the existing neutral and open-mouth poses while text is appearing.
const TALK_FRAMES = [0, 3, 0, 4, 3, 0];
const TALK_ANIMATION = { animation: "idle", fps: 7, loop: true };

/** Pixel-art Sherine, animated from the sliced atlas. Lazy image, no layout shift. */
export function FatmaSprite({ expression, speaking = false, size = 64, reducedMotion = false, className = "" }: { expression: Expression; speaking?: boolean; size?: number; reducedMotion?: boolean; className?: string }) {
  const systemReducedMotion = useReducedMotion();
  const still = reducedMotion || !!systemReducedMotion;
  const spec = speaking ? TALK_ANIMATION : EXPRESSION_ANIMATION[expression];
  const frames = speaking ? TALK_FRAMES : A.animations[spec.animation] ?? A.animations.idle;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndex(0);
    if (still || frames.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => {
        if (i + 1 < frames.length) return i + 1;
        return spec.loop ? 0 : i;
      });
    }, 1000 / spec.fps);
    return () => clearInterval(timer);
  }, [expression, speaking, frames.length, spec.fps, spec.loop, still]);

  // With reduced motion, show a representative final frame.
  const frame = frames[still ? frames.length - 1 : Math.min(index, frames.length - 1)];
  const scale = size / A.cellHeight;
  const col = frame % A.columns;
  const row = Math.floor(frame / A.columns);
  return (
    <div
      role="img"
      aria-label={speaking ? "Sherine is talking" : `Sherine looks ${expression}`}
      className={`pixelated shrink-0 ${className}`}
      style={{
        width: A.cellWidth * scale,
        height: size,
        backgroundImage: "url(/fatma/fatma-atlas.png)",
        backgroundRepeat: "no-repeat",
        backgroundSize: `${A.columns * A.cellWidth * scale}px ${A.rows * A.cellHeight * scale}px`,
        backgroundPosition: `-${col * A.cellWidth * scale}px -${row * A.cellHeight * scale}px`,
      }}
    />
  );
}
