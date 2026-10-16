"use client";

import { motion } from "motion/react";
import { barFill, describeScore, formatScore, type WhiteScore } from "@/lib/chess/engine/uci";
import type { Color } from "@/lib/chess/rules";

/**
 * Narrow White-positive evaluation bar. The fill is a display mapping, not a
 * win probability. Label text keeps it readable without relying on colour.
 */
export function EvalBar({ score, orientation, depth, reducedMotion }: { score: WhiteScore | null; orientation: Color; depth?: number; reducedMotion?: boolean }) {
  const fill = score ? barFill(score) : 0.5;
  const whitePct = `${(fill * 100).toFixed(1)}%`;
  const text = score ? formatScore(score) : "…";
  const whiteBetter = fill >= 0.5;
  return (
    <div
      className="relative w-3.5 shrink-0 self-stretch overflow-hidden rounded-full bg-[#2a2926] sm:w-4"
      role="meter"
      aria-label={`Evaluation: ${score ? describeScore(score) : "calculating"}${depth ? `, depth ${depth}` : ""}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fill * 100)}
      title={score ? `${describeScore(score)}${depth ? ` · depth ${depth}` : ""}` : "Calculating"}
    >
      <motion.div
        className={`absolute inset-x-0 bg-[#f4f1ea] ${orientation === "w" ? "bottom-0" : "top-0"}`}
        initial={false}
        animate={{ height: whitePct }}
        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 24 }}
      />
      <span
        className={`absolute inset-x-0 text-center text-[8px] font-bold leading-none ${
          whiteBetter === (orientation === "w") ? "bottom-1" : "top-1"
        } ${whiteBetter ? "text-[#2a2926]" : "text-[#f4f1ea]"}`}
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {text}
      </span>
    </div>
  );
}
