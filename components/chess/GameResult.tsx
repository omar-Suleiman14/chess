"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import type { Color } from "@/lib/chess/rules";

type Props = {
  result?: string;
  reason?: string;
  human: Color;
  description: string;
  reducedMotion: boolean;
  onRematch: () => void;
  reviewUrl?: string;
};

const CONFETTI = Array.from({ length: 24 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  color: ["#a3c96b", "#f7d76b", "#e9efdf", "#80c4b7"][i % 4],
  delay: (i % 6) * 0.07,
  drift: ((i % 5) - 2) * 24,
}));

/** A finite end-of-game celebration; dismiss it to inspect the final board. */
export function GameResult({ result, reason, human, description, reducedMotion, onRematch, reviewUrl }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  const draw = result === "1/2-1/2";
  const won = !!result && !draw && (result === "1-0") === (human === "w");
  const resigned = reason === "resign";
  const title = !result ? "Game ended" : draw ? "Draw" : won ? "You win!" : resigned ? "You resigned" : "Fatma wins";
  const score = result === "1-0" ? "1 – 0" : result === "0-1" ? "0 – 1" : draw ? "½ – ½" : "—";
  const accent = won ? "#a3c96b" : draw ? "#d5c5a1" : "#b0b8ca";

  return (
    <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center overflow-hidden rounded-xl">
      {won && !reducedMotion && (
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          {CONFETTI.map((piece, i) => (
            <motion.span key={i} className="absolute top-0 h-3 w-1.5 rounded-sm" style={{ left: piece.left, backgroundColor: piece.color }}
              initial={{ y: -24, x: 0, rotate: 0, opacity: 0 }}
              animate={{ y: [0, 420, 800], x: piece.drift, rotate: (i % 2 ? 1 : -1) * 480, opacity: [0, 1, 1, 0] }}
              transition={{ duration: 2.4, delay: piece.delay, ease: "easeOut" }} />
          ))}
        </div>
      )}
      <motion.div
        role="status"
        className="pointer-events-auto relative mx-4 max-h-full w-[min(290px,calc(100%-2rem))] overflow-y-auto rounded-3xl border border-line bg-surface/95 px-5 pb-5 pt-6 text-center shadow-[0_18px_65px_rgba(0,0,0,0.45)] backdrop-blur-md"
        initial={reducedMotion ? false : { opacity: 0, y: 22, scale: 0.88 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 22 }}
      >
        <button onClick={() => setDismissed(true)} aria-label="Dismiss result" className="absolute right-1 top-1 grid h-11 w-11 place-items-center rounded-full text-muted">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <div className="relative mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full" style={{ color: accent, backgroundColor: `${accent}20` }} aria-hidden="true">
          <motion.div
            className="origin-bottom text-6xl leading-none"
            initial={reducedMotion ? false : { rotate: won || draw ? -12 : 0, scale: 0.6, opacity: 0 }}
            animate={reducedMotion ? { rotate: resigned ? -22 : 0, scale: 1, opacity: 1 } : { rotate: resigned ? [0, 8, -28, -22] : won ? [-12, 10, -6, 0] : draw ? [-10, 10, -5, 0] : [0, 12, 65, 60], scale: [0.6, 1.12, 1], opacity: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.85, delay: reducedMotion ? 0 : 0.15 }}
          >
            {resigned ? (
              <svg viewBox="0 0 64 64" className="h-14 w-14"><path d="M16 55V10m0 0h34l-8 12 8 12H16" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            ) : draw ? "½" : won ? "♛" : "♚"}
          </motion.div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
        <p className="my-3 font-mono text-xl font-semibold tabular-nums" aria-label={`Final score ${score}`}>{score}</p>
        <div className="grid gap-2">
          <button onClick={onRematch} className="min-h-11 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-text">Rematch</button>
          {reviewUrl && <Link href={reviewUrl} prefetch={false} className="grid min-h-11 place-items-center rounded-full bg-surface-2 px-3 py-2 text-sm">Review in Time Machine</Link>}
          <button onClick={() => setDismissed(true)} className="min-h-11 rounded-full px-3 py-2 text-sm text-muted">View board</button>
        </div>
      </motion.div>
    </div>
  );
}
