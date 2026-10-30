"use client";

import { motion } from "motion/react";
import { barFill, describeScore, formatScore, type WhiteScore } from "@/lib/chess/engine/uci";
import type { Color } from "@/lib/chess/rules";

/**
 * chess.com-style evaluation bar: White-positive, the number sits on the
 * winning side in a clear bold face. The fill is
 * a display mapping, not a win probability.
 */
export function EvalBar({ score, orientation, depth, reducedMotion, horizontal = false, stale = false }: { score: WhiteScore | null; orientation: Color; depth?: number; reducedMotion?: boolean; horizontal?: boolean; /** Last known score while the new position is analysed. */ stale?: boolean }) {
  const fill = score ? barFill(score) : 0.5;
  const whitePct = `${(fill * 100).toFixed(1)}%`;
  const text = score ? formatScore(score) : "Analyzing";
  const whiteBetter = fill >= 0.5;
  const whiteAtBottom = orientation === "w";
  // The number sits at the end of whichever side is ahead.
  const numberAtBottom = whiteBetter === whiteAtBottom;
  return (
    <div className={`${horizontal ? "flex h-[22px] w-full shrink-0" : "flex w-[28px] shrink-0 self-stretch"} transition-opacity duration-200 ${stale ? "opacity-70" : ""}`}>
      <div
        className="relative w-full flex-1 overflow-hidden rounded-[5px] bg-[#403d39] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)]"
        role="meter"
        aria-label={`Evaluation: ${score ? describeScore(score) : "calculating"}${depth ? `, depth ${depth}` : ""}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill * 100)}
        aria-valuetext={score ? describeScore(score) : "Analysis unavailable or in progress"}
        title={score ? `${describeScore(score)}${depth ? ` · depth ${depth}` : ""}` : "Calculating"}
      >
        <motion.div
          className={horizontal ? `absolute inset-y-0 bg-white ${orientation === "w" ? "left-0" : "right-0"}` : `absolute inset-x-0 bg-white ${whiteAtBottom ? "bottom-0" : "top-0"}`}
          initial={false}
          animate={horizontal ? { width: whitePct } : { height: whitePct }}
          transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 26 }}
        />
        {text && (
          <span
            className={horizontal
              // Like chess.com: the score sits at the leading side's end, dark on white or white on dark.
              ? `absolute inset-y-0 flex items-center px-2 text-[13px] font-bold tabular-nums ${whiteBetter === (orientation === "w") ? "left-0" : "right-0"} ${whiteBetter ? "text-[#2b2926]" : "text-white"}`
              : `absolute inset-x-0 text-center text-[11px] font-bold leading-none tabular-nums ${numberAtBottom ? "bottom-1.5" : "top-1.5"} ${
              whiteBetter ? "text-[#403d39]" : "text-white"
            }`}
          >
            {text}
          </span>
        )}
      </div>
    </div>
  );
}
