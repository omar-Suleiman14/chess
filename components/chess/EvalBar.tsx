"use client";

import { motion } from "motion/react";
import { barFill, describeScore, formatScore, type WhiteScore } from "@/lib/chess/engine/uci";
import type { Color } from "@/lib/chess/rules";

/**
 * Narrow White-positive evaluation bar. The fill is a display mapping, not a
 * win probability. The score chip sits on the advantaged side, upright and
 * high-contrast, so it reads at a glance.
 */
export function EvalBar({ score, orientation, depth, reducedMotion }: { score: WhiteScore | null; orientation: Color; depth?: number; reducedMotion?: boolean }) {
  const fill = score ? barFill(score) : 0.5;
  const whitePct = `${(fill * 100).toFixed(1)}%`;
  const text = score ? formatScore(score).replace(/^\+/, "") : "";
  const whiteBetter = fill >= 0.5;
  // Chip at the end belonging to the side that is better.
  const chipAtBottom = whiteBetter === (orientation === "w");
  return (
    <div
      className="relative w-[22px] shrink-0 self-stretch overflow-hidden rounded-[7px] bg-[#3a3833] ring-1 ring-black/10"
      role="meter"
      aria-label={`Evaluation: ${score ? describeScore(score) : "calculating"}${depth ? `, depth ${depth}` : ""}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fill * 100)}
      title={score ? `${describeScore(score)}${depth ? ` · depth ${depth}` : ""}` : "Calculating"}
    >
      <motion.div
        className={`absolute inset-x-0 bg-[#f7f5f0] ${orientation === "w" ? "bottom-0" : "top-0"}`}
        initial={false}
        animate={{ height: whitePct }}
        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 26 }}
      />
      <div className="absolute inset-x-0 top-1/2 h-px bg-[#8a867d]/60" aria-hidden="true" />
      {text && (
        <span
          className={`absolute inset-x-0 text-center font-mono text-[10px] font-bold leading-none tracking-tighter ${chipAtBottom ? "bottom-1.5" : "top-1.5"} ${
            whiteBetter ? "text-[#1d1c1a]" : "text-[#f7f5f0]"
          }`}
        >
          {text}
        </span>
      )}
    </div>
  );
}
