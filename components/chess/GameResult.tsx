"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import type { Color } from "@/lib/chess/rules";
import { useSettings } from "@/lib/client/settings";
import { Piece } from "./Pieces";

type Props = {
  result?: string;
  reason?: string;
  human: Color;
  description: string;
  reducedMotion: boolean;
  onRematch: () => void;
  reviewUrl?: string;
  /** Who "they" are in the title (default Sherine). */
  opponentName?: string;
  rematchLabel?: string;
  rematchDisabled?: boolean;
};

/** A finite end-of-game celebration; dismiss it to inspect the final board. */
export function GameResult({ result, reason, human, description, reducedMotion, onRematch, reviewUrl, opponentName = "Sherine", rematchLabel = "Rematch", rematchDisabled = false }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const { settings } = useSettings();
  if (dismissed) return null;
  const draw = result === "1/2-1/2";
  const won = !!result && !draw && (result === "1-0") === (human === "w");
  const resigned = reason === "resign";
  const title = !result ? "Game ended" : draw ? "Draw" : won ? "You win!" : resigned ? "You resigned" : `${opponentName} wins`;
  const score = result === "1-0" ? "1 – 0" : result === "0-1" ? "0 – 1" : draw ? "½ – ½" : "—";
  const accent = won ? "#a3c96b" : draw ? "#d5c5a1" : "#b0b8ca";

  // Fixed to the viewport so the card floats above the board instead of being clipped to it.
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] grid place-items-center p-4">
      <motion.div
        role="status"
        className="pointer-events-auto relative max-h-[calc(100dvh-2rem)] w-[min(300px,100%)] overflow-y-auto rounded-3xl border border-line bg-surface/95 px-5 pb-5 pt-6 text-center shadow-[0_18px_65px_rgba(0,0,0,0.45)] backdrop-blur-md"
        initial={reducedMotion ? false : { opacity: 0, y: 22, scale: 0.88 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 30, delay: resigned ? 0.15 : 0.45 }}
      >
        <button onClick={() => setDismissed(true)} aria-label="Dismiss result" className="absolute end-1 top-1 grid h-11 w-11 place-items-center rounded-full text-muted">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
        <div className="relative mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full" style={{ color: accent, backgroundColor: `${accent}20` }} aria-hidden="true">
          {/* Rotates about its own centre so the icon stays centred in the disc. */}
          <motion.div
            className="grid h-12 w-12 origin-center place-items-center text-5xl font-semibold leading-none"
            initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
            animate={{ rotate: resigned || (!won && !draw) ? -20 : 0, scale: 1, opacity: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.35, delay: reducedMotion ? 0 : resigned ? 0.2 : 0.5 }}
          >
            {resigned ? (
              <svg viewBox="0 0 64 64" className="h-12 w-12"><path d="M20 56V8m0 0h30l-7 11 7 11H20" stroke="currentColor" strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            ) : draw ? "½" : (
              <Piece type="k" color={won ? human : human === "w" ? "b" : "w"} set={settings.pieceSet} className="h-12 w-12" />
            )}
          </motion.div>
        </div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
        <p className="my-3 font-mono text-xl font-semibold tabular-nums" aria-label={`Final score ${score}`}>{score}</p>
        <div className="grid gap-2">
          <button onClick={onRematch} disabled={rematchDisabled} className="min-h-11 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-text disabled:opacity-60">{rematchLabel}</button>
          {reviewUrl && <Link href={reviewUrl} prefetch={false} className="grid min-h-11 place-items-center rounded-full bg-surface-2 px-3 py-2 text-sm">Review in Time Machine</Link>}
          <button onClick={() => setDismissed(true)} className="min-h-11 rounded-full px-3 py-2 text-sm text-muted">View board</button>
        </div>
      </motion.div>
    </div>
  );
}
